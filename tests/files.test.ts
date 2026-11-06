import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  defaultProject,
  createVariant,
  initProject,
  readProject,
  safePath,
  saveResource,
} from '../packages/core/src/index.ts';
import { exportProject, planExport } from '../packages/exporters/index.ts';
import { genericFiles } from '../packages/exporters/generic/src/index.ts';
import { flutterFiles } from '../packages/exporters/flutter/src/index.ts';

let temp: string, root: string;
beforeAll(async () => {
  const tmpBase = await fs.realpath(os.tmpdir());
  temp = await fs.mkdtemp(path.join(tmpBase, 'vectorforge-files-'));
  root = path.join(temp, 'project');
  await fs.cp(defaultProject, root, { recursive: true, filter: (s) => !s.includes('/exports') });
});
afterAll(async () => {
  await fs.rm(temp, { recursive: true, force: true });
});

describe('file-backed project operations', () => {
  it('persists project folders and asset assignment through generic export without moving source files', async () => {
    const project = path.join(temp, 'organized');
    await fs.cp(defaultProject, project, {
      recursive: true,
      filter: (f) => !f.includes('/exports'),
    });
    const data = await readProject(project),
      asset = data.assets[0],
      actor = data.actors[0];
    const folders = [
      { id: 'game', name: 'Game' },
      { id: 'props', name: 'Props', parentId: 'game' },
    ];
    await saveResource(
      project,
      'context',
      { ...data.context, collections: folders },
      { overwrite: true },
    );
    await saveResource(
      project,
      'asset',
      { ...asset.metadata, collection: 'props' },
      { overwrite: true },
    );
    await saveResource(
      project,
      'actor',
      { ...actor.metadata, collection: 'props' },
      { overwrite: true },
    );
    const current = await readProject(project);
    expect(current.context.collections).toEqual(folders);
    expect(current.assets[0].svg).toBe(asset.svg);
    expect(current.actors[0].rig).toEqual(actor.rig);
    const destination = path.join(temp, 'organized-export');
    await exportProject(current, destination, { format: 'generic' });
    const exported = await readProject(destination);
    expect(exported.context.collections).toEqual(folders);
    expect(exported.assets[0].metadata.collection).toBe('props');
    expect(exported.actors[0].metadata.collection).toBe('props');
    expect(exported.issues).toEqual([]);
    await expect(
      saveResource(
        project,
        'context',
        { ...current.context, collections: [] },
        { overwrite: true },
      ),
    ).rejects.toThrow('does not exist');
    await expect(
      saveResource(
        project,
        'context',
        {
          ...current.context,
          collections: [
            { id: 'game', name: 'Game', parentId: 'props' },
            { id: 'props', name: 'Props', parentId: 'game' },
          ],
        },
        { overwrite: true },
      ),
    ).rejects.toThrow('cycle');
    await expect(
      saveResource(
        project,
        'asset',
        { ...asset.metadata, collection: 'absent' },
        { overwrite: true },
      ),
    ).rejects.toThrow('does not exist');
    expect((await readProject(project)).context.collections).toEqual(folders);
    expect((await readProject(project)).assets[0].metadata.collection).toBe('props');
  });
  it('initializes a portable empty project and rejects reinitializing it', async () => {
    const destination = path.join(temp, 'empty');
    await initProject(destination, 'Empty');
    const data = await readProject(destination);
    expect(data.project.name).toBe('Empty');
    expect(data.assets).toEqual([]);
    await expect(initProject(destination)).rejects.toThrow('already exists');
  });
  it('blocks traversal and existing symbolic links', async () => {
    await expect(safePath(root, '../outside')).rejects.toThrow('escapes');
    await fs.symlink(temp, path.join(root, 'linked'));
    await expect(safePath(root, 'linked/target')).rejects.toThrow('Symbolic');
  });
  it('creates a real variant, preserves family/style and refuses collisions', async () => {
    const base = (await readProject(root)).assets.find(
      (a) => a.metadata.id === 'phone-single-camera',
    )!;
    await createVariant(
      root,
      base.metadata.id,
      { id: 'phone-test', name: 'Phone test', variant: 'test', style: 'mono-ink' },
      base.svg,
    );
    const created = (await readProject(root)).assets.find((a) => a.metadata.id === 'phone-test')!;
    expect(created.metadata.family).toBe(base.metadata.family);
    expect(created.metadata.style).toBe(base.metadata.style);
    expect(created.metadata.baseAsset).toBe(base.metadata.id);
    expect(created.svg).toBe(base.svg);
    await expect(
      createVariant(root, base.metadata.id, { id: 'phone-test', name: 'Duplicate' }, base.svg),
    ).rejects.toThrow('already exists');
  });
  it('rejects invalid SVG updates without altering either source file', async () => {
    const item = (await readProject(root)).assets[0];
    const old = await fs.readFile(path.join(root, item.path, 'asset.json'), 'utf8');
    await expect(
      saveResource(
        root,
        'asset',
        { ...item.metadata, name: 'Should not save' },
        { svg: '<svg><script/></svg>', overwrite: true },
      ),
    ).rejects.toThrow();
    expect(await fs.readFile(path.join(root, item.path, 'asset.json'), 'utf8')).toBe(old);
    expect(await fs.readFile(path.join(root, item.path, 'asset.svg'), 'utf8')).toBe(item.svg);
  });
  it('rejects missing actor, missing rig nodes and unsupported schemas', async () => {
    await expect(
      saveResource(root, 'animation', {
        schemaVersion: 1,
        id: 'bad',
        actorId: 'missing',
        duration: 1,
        tracks: {},
      }),
    ).rejects.toThrow('does not exist');
    const actor = (await readProject(root)).actors[0];
    await expect(
      saveResource(
        root,
        'rig',
        { ...actor.rig, nodes: { bad: { svgId: 'absent' } } },
        { id: actor.metadata.id, overwrite: true },
      ),
    ).rejects.toThrow();
    await expect(
      saveResource(root, 'style', {
        schemaVersion: 2,
        id: 'future',
        name: 'Future',
        palette: ['#fff'],
      }),
    ).rejects.toThrow();
  });
  it('reports malformed project resources and recovers after repair', async () => {
    const file = path.join(root, 'animations/broken.json');
    await fs.writeFile(file, '{bad');
    expect((await readProject(root)).issues.some((i) => i.path === 'animations/broken.json')).toBe(
      true,
    );
    await fs.rm(file);
    expect((await readProject(root)).issues).toEqual([]);
  });
});

describe('portable export adapters and safe destinations', () => {
  it('includes variant base dependencies and can reopen generic exports', async () => {
    const data = await readProject(root);
    const files = genericFiles(data, 'phone-test');
    expect(files['assets/phone-single-camera/asset.svg']).toBeTruthy();
    expect(files['styles/editorial-green/style.json']).toBeTruthy();
    const destination = path.join(temp, 'generic');
    await exportProject(data, destination, { id: 'phone-test' });
    expect((await readProject(destination)).issues).toEqual([]);
  });
  it('includes actor rigs, every referenced clip, sequences and machine', async () => {
    const files = genericFiles(await readProject(root), 'studio-maker');
    expect(files['actors/studio-maker/rig.json']).toBeTruthy();
    expect(files['animations/typing.json']).toBeTruthy();
    expect(files['state-machines/maker-states.json']).toBeTruthy();
  });
  it('writes nothing in dry run, detects conflicts and requires explicit overwrite', async () => {
    const data = await readProject(root),
      dest = path.join(temp, 'safe');
    const plan = await exportProject(data, dest, { id: 'phone-test', dryRun: true });
    expect(plan.files.length).toBeGreaterThan(3);
    await expect(fs.access(dest)).rejects.toThrow();
    await exportProject(data, dest, { id: 'phone-test' });
    const next = await planExport(data, dest, 'generic', 'phone-test');
    expect(next.plan.conflicts.length).toBe(plan.files.length);
    await expect(exportProject(data, dest, { id: 'phone-test' })).rejects.toThrow('conflicts');
    const overwritten = await exportProject(data, dest, { id: 'phone-test', overwrite: true });
    expect(overwritten.written).toHaveLength(plan.files.length);
  });
  it('blocks source, parent and symlink destinations', async () => {
    const data = await readProject(root);
    for (const dest of [root, temp, path.join(root, 'assets')])
      await expect(planExport(data, dest)).rejects.toThrow('source');
    const linked = path.join(temp, 'export-link');
    await fs.symlink(root, linked);
    await expect(planExport(data, path.join(linked, 'child'))).rejects.toThrow('symbolic');
  });
  it('checks nested destination links before any write', async () => {
    const data = await readProject(root),
      dest = path.join(temp, 'nested');
    await fs.mkdir(dest);
    await fs.symlink(temp, path.join(dest, 'assets'));
    await expect(exportProject(data, dest, { id: 'phone-test' })).rejects.toThrow('Symbolic');
    expect(await fs.readdir(dest)).toEqual(['assets']);
  });
  it('creates a standalone web runtime and relative manifest paths', async () => {
    const destination = path.join(temp, 'web');
    const plan = await exportProject(await readProject(root), destination, {
      format: 'web',
      id: 'studio-plant',
    });
    expect(plan.written).toContain('vectorforge-runtime.js');
    const runtime = await fs.readFile(path.join(destination, 'vectorforge-runtime.js'), 'utf8');
    expect(runtime).toContain('requestAnimationFrame');
    expect(runtime).not.toContain('node:');
  });
  it('generates Flutter directories and every nested asset entry without Flutter installed', async () => {
    const files = flutterFiles(await readProject(root), 'studio-maker');
    expect(files['assets/vectorforge/actors/studio-maker/actor.svg']).toBeTruthy();
    expect(files['pubspec-assets.yaml']).toContain('assets/vectorforge/actors/studio-maker/');
    expect(files['assets/vectorforge/vectorforge.manifest.json']).toContain('"format": "flutter"');
  });
});
