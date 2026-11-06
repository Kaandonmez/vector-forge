import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { defaultProject, readProject } from '../packages/core/src/index.ts';

const exec = promisify(execFile),
  repo = path.resolve(import.meta.dirname, '..'),
  cli = path.join(repo, 'packages/cli/src/index.ts');
let temp: string, root: string, client: Client;
beforeAll(async () => {
  const tmpBase = await fs.realpath(os.tmpdir());
  temp = await fs.mkdtemp(path.join(tmpBase, 'vectorforge-integration-'));
  root = path.join(temp, 'project');
  await fs.cp(defaultProject, root, { recursive: true, filter: (f) => !f.includes('/exports') });
  client = new Client({ name: 'vectorforge-acceptance-client', version: '1.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', cli, 'mcp', '--project', root],
      cwd: repo,
      stderr: 'pipe',
    }),
  );
});
afterAll(async () => {
  await client?.close();
  await fs.rm(temp, { recursive: true, force: true });
});
async function call(name: string, args: Record<string, unknown> = {}) {
  const result = await client.callTool({ name: `vectorforge_${name}`, arguments: args });
  if (result.isError) throw new Error(JSON.stringify(result.content));
  return result;
}
function firstText(result: any) {
  return JSON.parse(result.content[0].text);
}
const command = async (...args: string[]) =>
  exec(process.execPath, ['--import', 'tsx', cli, ...args, '--project', root], {
    cwd: repo,
    maxBuffer: 5 * 1024 * 1024,
  });

describe('official MCP stdio integration', () => {
  it('shares project folders between CLI context updates and MCP asset operations', async () => {
    const data = await readProject(root);
    const file = path.join(temp, 'organized-context.json');
    await fs.writeFile(
      file,
      JSON.stringify({ ...data.context, collections: [{ id: 'interface', name: 'Interface' }] }),
    );
    await command('update', 'context', file);
    expect(firstText(await call('project_context')).collections).toEqual([
      { id: 'interface', name: 'Interface' },
    ]);
    const base = data.assets.find((a) => a.metadata.id === 'phone-triple-camera')!;
    await call('update_asset', { data: { ...base.metadata, collection: 'interface' } });
    expect(firstText(await call('get_asset', { id: base.metadata.id })).metadata.collection).toBe(
      'interface',
    );
    expect(
      (await readProject(root)).assets.find((a) => a.metadata.id === base.metadata.id)!.svg,
    ).toBe(base.svg);
  });
  it('starts and exposes predictable tools, project context and styles', async () => {
    const tools = await client.listTools();
    expect(tools.tools.map((t) => t.name)).toEqual(
      expect.arrayContaining([
        'vectorforge_create_asset',
        'vectorforge_create_variant',
        'vectorforge_create_actor',
        'vectorforge_snapshot',
        'vectorforge_export',
      ]),
    );
    expect(firstText(await call('project_context')).styles).toHaveLength(2);
    expect(
      firstText(await call('get_style', { id: 'editorial-green' })).palette.length,
    ).toBeGreaterThan(3);
    expect(firstText(await call('list_assets', { family: 'phone-modern' }))).toHaveLength(5);
  });
  it('creates, reads and updates an actual asset on disk', async () => {
    const base = (await readProject(root)).assets[0];
    const metadata = {
      ...base.metadata,
      id: 'mcp-created',
      name: 'MCP asset',
      baseAsset: undefined,
    };
    await call('create_asset', { data: metadata, svg: base.svg });
    expect(firstText(await call('get_asset', { id: metadata.id })).svg).toBe(base.svg);
    await call('update_asset', { data: { ...metadata, name: 'Updated via MCP' } });
    expect(firstText(await call('get_asset', { id: metadata.id })).metadata.name).toBe(
      'Updated via MCP',
    );
    const rejected = await client.callTool({
      name: 'vectorforge_update_asset',
      arguments: { data: metadata, svg: '<svg><script/></svg>' },
    });
    expect(rejected.isError).toBe(true);
  });
  it('creates a sibling variant with an inherited family relationship', async () => {
    const base = firstText(await call('get_asset', { id: 'phone-single-camera' }));
    await call('create_variant', {
      baseId: 'phone-single-camera',
      data: { id: 'mcp-variant', name: 'MCP variant', variant: 'new' },
      svg: base.svg,
    });
    const created = firstText(await call('get_asset', { id: 'mcp-variant' }));
    expect(created.metadata.baseAsset).toBe('phone-single-camera');
    expect(created.metadata.family).toBe('phone-modern');
  });
  it('creates a generic three-part actor, rig, multi-property clip and sequence', async () => {
    const data = {
      schemaVersion: 1,
      id: 'test-actor',
      name: 'Three parts',
      style: 'editorial-green',
      width: 100,
      height: 100,
      viewBox: [0, 0, 100, 100],
    };
    const svg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g id="body"><rect width="60" height="60" fill="#39594a"/><g id="arm"><rect x="50" width="30" height="12" fill="#9ab59c"/><g id="light"><circle cx="80" cy="6" r="5" fill="#b8f76a"/></g></g></g></svg>';
    await call('create_actor', {
      data,
      svg,
      rig: {
        schemaVersion: 1,
        actorId: 'test-actor',
        nodes: {
          body: { svgId: 'body' },
          arm: { svgId: 'arm', parent: 'body', pivot: [0, 0.5] },
          light: { svgId: 'light', parent: 'arm' },
        },
      },
    });
    const tracks = Object.fromEntries(
      ['rotation', 'position.x', 'scale.x', 'opacity'].map((p, i) => [
        `arm.${p}`,
        [
          { time: 0, value: i > 1 ? 1 : 0 },
          { time: 0.5, value: i > 1 ? 0.5 : 15, easing: 'easeOutBack' },
          { time: 1, value: i > 1 ? 1 : 0, easing: 'easeInOutCubic' },
        ],
      ]),
    );
    await call('create_animation', {
      data: {
        schemaVersion: 1,
        id: 'test-motion',
        actorId: 'test-actor',
        duration: 1,
        loop: true,
        tracks,
      },
    });
    await call('create_sequence', {
      data: {
        schemaVersion: 1,
        id: 'test-sequence',
        name: 'Generic sequence',
        actorId: 'test-actor',
        steps: [
          { action: 'play', clip: 'test-motion' },
          { action: 'wait', duration: 0.1 },
        ],
      },
    });
    expect(firstText(await call('validate')).valid).toBe(true);
  });
  it('returns a real local preview URL', async () => {
    const result = firstText(await call('preview', { id: 'test-actor' }));
    expect(result.url).toContain('127.0.0.1');
    expect((await fetch(result.url.split('/?')[0] + '/api/project')).ok).toBe(true);
  });
  it('returns a rendered image for a sequence at a deterministic time', async () => {
    const result = await call('snapshot', {
      id: 'test-sequence',
      time: 0.5,
      output: path.join(temp, 'mcp.png'),
    });
    const content = result.content as any[];
    expect(content[1].type).toBe('image');
    const buffer = Buffer.from(content[1].data, 'base64');
    expect(buffer.subarray(1, 4).toString()).toBe('PNG');
    expect(buffer.length).toBeGreaterThan(3000);
  }, 60000);
  it('dry-runs and writes readable exports into an arbitrary external folder', async () => {
    const destination = path.join(temp, 'external-project', 'visuals');
    const plan = firstText(await call('export_to_project', { destination, id: 'test-actor' }));
    expect(plan.dryRun).toBe(true);
    expect(plan.files).toContain('animations/test-motion.json');
    const exported = firstText(
      await call('export', { destination, id: 'test-actor', dryRun: false }),
    );
    expect(exported.written.length).toBeGreaterThan(5);
    expect((await readProject(destination)).issues).toEqual([]);
  });
});

describe('CLI end-to-end acceptance', () => {
  it('documents the command surface and lists real metadata', async () => {
    expect((await command('--help')).stdout).toContain('snapshot');
    const result = JSON.parse((await command('list', 'actors')).stdout);
    expect(result.some((a: any) => a.id === 'test-actor')).toBe(true);
  });
  it('retrieves context and validates the project', async () => {
    expect(JSON.parse((await command('context')).stdout).families).toContain('phone-modern');
    expect(JSON.parse((await command('validate')).stdout).valid).toBe(true);
  });
  it('generates a PNG without a pre-running Studio', async () => {
    const result = JSON.parse(
      (
        await command(
          'snapshot',
          'studio-plant',
          '--time',
          '1.2',
          '--clip',
          'gentle-sway',
          '--out',
          path.join(temp, 'cli.png'),
        )
      ).stdout,
    );
    expect(result.width).toBe(800);
    expect(result.bytes).toBeGreaterThan(5000);
  }, 60000);
  it('exports an asset and rejects a silent overwrite', async () => {
    const destination = path.join(temp, 'cli-export');
    const result = JSON.parse(
      (await command('export', 'mcp-variant', '--dest', destination)).stdout,
    );
    expect(result.written).toContain('assets/mcp-variant/asset.svg');
    await expect(command('export', 'mcp-variant', '--dest', destination)).rejects.toThrow();
  });
});
