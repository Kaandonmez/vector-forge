import { promises as fs, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { idSchema } from '../../schema/src/index.ts';
import { readProject, safePath } from './index.ts';

type ChromiumType = {
  launch(options?: { headless?: boolean }): Promise<any>;
  executablePath(): string;
};

export async function resolveChromium(): Promise<ChromiumType | undefined> {
  const candidates = ['@playwright/test', 'playwright', 'playwright-core'];
  for (const mod of candidates) {
    try {
      const loaded = await import(mod);
      if (loaded?.chromium) return loaded.chromium as ChromiumType;
    } catch {
      // Try resolving from current working directory if installed in user project
      try {
        const req = createRequire(path.join(process.cwd(), 'package.json'));
        const resolved = req.resolve(mod);
        const loaded = await import(pathToFileURL(resolved).href);
        if (loaded?.chromium) return loaded.chromium as ChromiumType;
      } catch {
        // continue
      }
    }
  }
  return undefined;
}

export async function checkChromiumStatus(): Promise<{
  available: boolean;
  executablePath?: string;
  message: string;
}> {
  const chromium = await resolveChromium();
  if (!chromium) {
    return {
      available: false,
      message:
        'Playwright is not installed in this environment. Install it and run "npx playwright install chromium" to enable PNG snapshots.',
    };
  }
  try {
    const execPath = chromium.executablePath();
    if (execPath && existsSync(execPath)) {
      return {
        available: true,
        executablePath: execPath,
        message: 'Playwright Chromium is installed and ready for PNG snapshots.',
      };
    }
    return {
      available: false,
      executablePath: execPath,
      message:
        'Playwright is installed, but the Chromium browser binary is missing. Run "npx playwright install chromium" (or "pnpm exec playwright install chromium").',
    };
  } catch (error) {
    return {
      available: false,
      message: `Cannot verify Chromium binary: ${error instanceof Error ? error.message : String(error)}. Run "npx playwright install chromium".`,
    };
  }
}

export async function snapshot(
  root: string,
  id: string,
  options: {
    time?: number;
    clip?: string;
    sequence?: string;
    output?: string;
    overwrite?: boolean;
    background?: string;
  } = {},
) {
  idSchema.parse(id);
  const data = await readProject(root);
  const clip = data.animations.find((c) => c.id === id),
    sequence = data.sequences.find((s) => s.id === id);
  const entity = [...data.assets, ...data.actors].find(
    (e) => e.metadata.id === (clip?.actorId ?? sequence?.actorId ?? id),
  );
  if (!entity) throw new Error(`No previewable asset, actor, clip or sequence named ${id}.`);
  if (data.issues.some((i) => i.severity === 'error' && i.path.startsWith(entity.path)))
    throw new Error(`Cannot snapshot invalid ${entity.metadata.id}. Run validation first.`);
  if (
    options.clip &&
    !data.animations.some((c) => c.id === options.clip && c.actorId === entity.metadata.id)
  )
    throw new Error('Snapshot clip is missing or belongs to another actor.');
  if (
    options.sequence &&
    !data.sequences.some((s) => s.id === options.sequence && s.actorId === entity.metadata.id)
  )
    throw new Error('Snapshot sequence is missing or belongs to another actor.');
  if (options.time !== undefined && (!Number.isFinite(options.time) || options.time < 0))
    throw new Error('Snapshot time must be a nonnegative number in seconds.');
  const output = options.output
    ? path.resolve(options.output)
    : await safePath(data.root, `exports/snapshots/${id}-${(options.time ?? 0).toFixed(2)}.png`);
  if (
    output === data.root ||
    (output.startsWith(data.root + path.sep) &&
      !output.startsWith(path.join(data.root, 'exports') + path.sep))
  )
    throw new Error(
      'Snapshot output cannot overwrite project source files. Use exports/ or an external folder.',
    );
  if (!output.endsWith('.png')) throw new Error('Snapshot output must end in .png.');
  let ancestor = path.dirname(output);
  while (true) {
    try {
      if ((await fs.lstat(ancestor)).isSymbolicLink())
        throw new Error(`Snapshot destination contains a symbolic link: ${ancestor}`);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const parent = path.dirname(ancestor);
    if (parent === ancestor) break;
    ancestor = parent;
  }
  if (
    !options.overwrite &&
    (await fs.access(output).then(
      () => true,
      () => false,
    ))
  )
    throw new Error(`Snapshot already exists: ${output}. Specify overwrite explicitly.`);
  const chromium = await resolveChromium();
  if (!chromium)
    throw new Error(
      'Playwright Chromium is missing. Install Playwright and run "npx playwright install chromium" (or "pnpm exec playwright install chromium"), then retry.',
    );
  await fs.mkdir(path.dirname(output), { recursive: true });
  await safePath(path.dirname(output), path.basename(output));
  const { createStudio } = await import('../../../scripts/studio.ts');
  const { server, url } = await createStudio(data.root, 0);
  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({
      viewport: { width: 800, height: 640 },
      deviceScaleFactor: 1,
    });
    const params = new URLSearchParams({ snapshot: id, time: String(options.time ?? 0) });
    if (options.clip) params.set('clip', options.clip);
    if (options.sequence) params.set('sequence', options.sequence);
    if (options.background) params.set('background', options.background);
    await page.goto(`${url}/?${params}`);
    await page.waitForFunction(() => window.__VF_READY || window.__VF_RENDER_ERROR, {
      timeout: 20000,
    });
    const error = await page.evaluate(() => window.__VF_RENDER_ERROR);
    if (error) throw new Error(error);
    const buffer = await page.locator('#snapshot-stage').screenshot();
    await fs.writeFile(output, buffer, { flag: options.overwrite ? 'w' : 'wx' });
    return {
      path: output,
      mimeType: 'image/png',
      width: 800,
      height: 640,
      bytes: buffer.length,
      image: buffer.toString('base64'),
    };
  } catch (error) {
    if (String(error).includes('Executable doesn'))
      throw new Error(
        'Playwright Chromium is missing. Run "npx playwright install chromium" (or "pnpm exec playwright install chromium"), then retry.',
      );
    throw error;
  } finally {
    await browser?.close();
    await server.close();
  }
}
