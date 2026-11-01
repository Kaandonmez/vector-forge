import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { ProjectData } from '../schema/src/index.ts';
import { safePath } from '../core/src/index.ts';
import { genericFiles, type ExportFiles } from './generic/src/index.ts';
import { webFiles } from './web/src/index.ts';
import { flutterFiles } from './flutter/src/index.ts';
export const exporters = { generic: genericFiles, web: webFiles, flutter: flutterFiles };
export type ExportFormat = keyof typeof exporters;
export type ExportPlan = {
  destination: string;
  format: ExportFormat;
  files: string[];
  conflicts: string[];
  dryRun: boolean;
  written: string[];
};
export async function planExport(
  data: ProjectData,
  destination: string,
  format: ExportFormat = 'generic',
  id?: string,
  dryRun = true,
): Promise<{ plan: ExportPlan; content: ExportFiles }> {
  if (!destination.trim()) throw new Error('Export destination is required.');
  const dest = path.resolve(destination),
    root = path.resolve(data.root);
  if (
    dest === root ||
    root.startsWith(dest + path.sep) ||
    (dest.startsWith(root + path.sep) &&
      !dest.startsWith(path.join(root, 'exports') + path.sep) &&
      dest !== path.join(root, 'exports'))
  )
    throw new Error(
      'Export into a separate directory or the project exports/ directory. Never export over source files.',
    );
  // Check every existing ancestor before creating anything, including when destination does not yet exist.
  let ancestor = dest;
  while (true) {
    try {
      const info = await fs.lstat(ancestor);
      if (info.isSymbolicLink())
        throw new Error(`Export destination contains a symbolic link: ${ancestor}`);
      if (ancestor === dest && !info.isDirectory())
        throw new Error('Export destination must be a directory.');
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  if (!exporters[format])
    throw new Error(`Unknown export format ${format}. Choose generic, web or flutter.`);
  if (data.issues.some((i) => i.severity === 'error'))
    throw new Error('Project has validation errors. Fix them before exporting.');
  const content = await exporters[format](data, id);
  const files = Object.keys(content).sort(),
    conflicts: string[] = [];
  const destExists = await fs.access(dest).then(
    () => true,
    () => false,
  );
  for (const file of files) {
    const target = destExists ? await safePath(dest, file) : path.join(dest, file);
    const exists = await fs.lstat(target).then(
      () => true,
      (e) => {
        if ((e as NodeJS.ErrnoException).code !== 'ENOENT') throw e;
        return false;
      },
    );
    if (exists) conflicts.push(file);
  }
  return { plan: { destination: dest, format, files, conflicts, dryRun, written: [] }, content };
}
export async function exportProject(
  data: ProjectData,
  destination: string,
  options: { format?: ExportFormat; id?: string; dryRun?: boolean; overwrite?: boolean } = {},
) {
  const { plan, content } = await planExport(
    data,
    destination,
    options.format,
    options.id,
    options.dryRun ?? false,
  );
  if (plan.dryRun) return plan;
  if (plan.conflicts.length && !options.overwrite)
    throw new Error(
      `Export conflicts: ${plan.conflicts.join(', ')}. Use dry run to inspect or explicitly set overwrite.`,
    );
  await fs.mkdir(plan.destination, { recursive: true });
  for (const file of plan.files) {
    const target = await safePath(plan.destination, file);
    await fs.mkdir(path.dirname(target), { recursive: true });
    // wx closes the race between conflict detection and writing when overwrite is disabled.
    await fs.writeFile(target, content[file], { flag: options.overwrite ? 'w' : 'wx' });
    plan.written.push(file);
  }
  return plan;
}
