import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { promises as fs, existsSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { execFile } from 'node:child_process';
import { readProject, safePath, saveResource } from '../packages/core/src/index.ts';
import { exportProject, planExport } from '../packages/exporters/index.ts';

const exec = promisify(execFile);
const repoRoot = path.resolve(import.meta.dirname, '..');
const compiledCli = path.join(repoRoot, 'dist/cli.js');

let tempRoot: string;

beforeAll(async () => {
  const tmpBase = await fs.realpath(os.tmpdir());
  tempRoot = await fs.mkdtemp(path.join(tmpBase, 'vectorforge-e2e-suite-'));
  if (!existsSync(compiledCli)) {
    await exec(
      process.execPath,
      ['--import', 'tsx', path.join(repoRoot, 'scripts/build-dist.ts')],
      { cwd: repoRoot },
    );
  }
}, 60000);

afterAll(async () => {
  if (tempRoot) {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});

async function connectMcp(projectDir: string, extraArgs: string[] = []) {
  const client = new Client({ name: 'vectorforge-e2e-verifier', version: '1.0.0' });
  await client.connect(
    new StdioClientTransport({
      command: process.execPath,
      args: [compiledCli, 'mcp', '--project', projectDir, ...extraArgs],
      cwd: repoRoot,
      stderr: 'pipe',
    }),
  );
  const call = async (name: string, toolArgs: Record<string, unknown> = {}) => {
    const result = await client.callTool({ name: `vectorforge_${name}`, arguments: toolArgs });
    if (result.isError) {
      throw new Error(`MCP tool vectorforge_${name} failed: ${JSON.stringify(result.content)}`);
    }
    return result;
  };
  const callJson = async (name: string, toolArgs: Record<string, unknown> = {}) => {
    const res = await call(name, toolArgs);
    return JSON.parse((res.content as any[])[0].text);
  };
  return { client, call, callJson };
}

describe('Scenario 1 — Starter Skill End-to-End Flow (Clean Project via MCP)', () => {
  it('connects via MCP to a clean directory, initializes via vectorforge_init_project, creates style, static SVG, variant, validates, snapshots and exports', async () => {
    const starterDir = path.join(tempRoot, 'scenario1-starter');
    // Connect without --init first to prove MCP handshake works on uninitialized directories
    const { client, call, callJson } = await connectMcp(starterDir);

    try {
      // 1. Initialize project purely over MCP, then verify connection and context
      await callJson('init_project', { name: 'Starter Verification Project' });
      const info = await callJson('project_info');
      expect(info.project.name).toBe('Starter Verification Project');
      expect(info.counts.assets).toBe(0);

      await callJson('update_context', {
        data: {
          schemaVersion: 1,
          collections: [{ id: 'ui-badges', name: 'UI Badges' }],
          rules: ['Use 128x128 viewBox with clean-ui palette.'],
          namingConventions: 'lowercase-kebab-case',
          exportDestinations: {},
        },
      });
      const ctx = await callJson('project_context');
      expect(ctx.schemaVersion).toBe(1);
      expect(ctx.collections).toEqual([{ id: 'ui-badges', name: 'UI Badges' }]);

      // 2. Create style profile and set as defaultStyle
      await callJson('create_style', {
        data: {
          schemaVersion: 1,
          id: 'clean-ui',
          name: 'Clean Tactile UI',
          palette: ['#1E293B', '#334155', '#0EA5E9', '#38BDF8', '#F8FAFC', '#F59E0B'],
          prohibitedColors: ['#FF00FF'],
          maxColors: 6,
          stroke: {
            enabled: true,
            width: 2,
            maxWidth: 4,
            colors: ['#1E293B', '#334155'],
          },
        },
      });
      await callJson('update_project', {
        data: {
          schemaVersion: 1,
          name: 'Starter Verification Project',
          defaultStyle: 'clean-ui',
        },
      });

      // 3. Create base static SVG asset
      const baseSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g id="shield-root"><path id="shield-outer" d="M64 16 L108 32 V64 C108 92 64 112 64 112 C64 112 20 92 20 64 V32 Z" fill="#1E293B" stroke="#334155" stroke-width="2"/><path id="shield-inner" d="M64 26 L98 39 V63 C98 84 64 101 64 101 C64 101 30 84 30 63 V39 Z" fill="#0EA5E9"/><circle id="shield-core" cx="64" cy="62" r="14" fill="#F8FAFC"/></g></svg>';
      await callJson('create_asset', {
        data: {
          schemaVersion: 1,
          id: 'badge-shield-base',
          name: 'Security Shield Badge',
          category: 'badges',
          tags: ['security', 'shield'],
          style: 'clean-ui',
          family: 'security-badges',
          width: 128,
          height: 128,
          viewBox: [0, 0, 128, 128],
        },
        svg: baseSvg,
      });

      // 4. Create sibling variant
      const variantSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><g id="shield-root"><path id="shield-outer" d="M64 16 L108 32 V64 C108 92 64 112 64 112 C64 112 20 92 20 64 V32 Z" fill="#1E293B" stroke="#334155" stroke-width="2"/><path id="shield-inner" d="M64 26 L98 39 V63 C98 84 64 101 64 101 C64 101 30 84 30 63 V39 Z" fill="#334155"/><circle id="shield-core" cx="64" cy="62" r="16" fill="#F59E0B"/><circle id="shield-highlight" cx="59" cy="57" r="5" fill="#F8FAFC"/></g></svg>';
      await callJson('create_variant', {
        baseId: 'badge-shield-base',
        data: {
          id: 'badge-shield-gold',
          name: 'Security Shield Badge (Gold Tier)',
          variant: 'gold-tier',
        },
        svg: variantSvg,
      });

      // 5. Validate
      const validation = await callJson('validate');
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);

      // 6. Snapshot
      const snapRes = await call('snapshot', { id: 'badge-shield-gold', overwrite: true });
      const snapContent = snapRes.content as any[];
      expect(snapContent[1].type).toBe('image');
      const pngBuffer = Buffer.from(snapContent[1].data, 'base64');
      expect(pngBuffer.subarray(1, 4).toString()).toBe('PNG');
      expect(pngBuffer.length).toBeGreaterThan(2000);

      // 7. Export (dry-run then write)
      const exportDest = path.join(tempRoot, 'scenario1-flutter-export');
      const dryPlan = await callJson('export', {
        destination: exportDest,
        id: 'badge-shield-gold',
        format: 'flutter',
        dryRun: true,
      });
      expect(dryPlan.dryRun).toBe(true);
      expect(dryPlan.files).toContain('pubspec-assets.yaml');
      expect(dryPlan.files).toContain('assets/vectorforge/static/badge-shield-base/asset.svg');
      expect(dryPlan.files).toContain('assets/vectorforge/static/badge-shield-gold/asset.svg');
      expect(existsSync(exportDest)).toBe(false);

      const writtenPlan = await callJson('export', {
        destination: exportDest,
        id: 'badge-shield-gold',
        format: 'flutter',
        dryRun: false,
      });
      expect(writtenPlan.written.length).toBe(dryPlan.files.length);
      expect(existsSync(path.join(exportDest, 'pubspec-assets.yaml'))).toBe(true);
    } finally {
      await client.close();
    }
  }, 60000);
});

describe('Scenario 2 & 3 — Pro Asset Family (5 Assets) & Articulated Actor Animation Pipeline', () => {
  let proProjectDir: string;

  it('produces 1 style profile, 1 coherent family with 5 static assets/variants, and validates on disk', async () => {
    proProjectDir = path.join(tempRoot, 'scenario2-3-pro-pack');
    const { client, callJson } = await connectMcp(proProjectDir, [
      '--init',
      '--name',
      'Aegis Tactical Command',
    ]);

    try {
      await callJson('create_style', {
        data: {
          schemaVersion: 1,
          id: 'aegis-tactical',
          name: 'Aegis Tactical Precision',
          palette: [
            '#0F172A',
            '#1E293B',
            '#334155',
            '#64748B',
            '#0EA5E9',
            '#38BDF8',
            '#F59E0B',
            '#EF4444',
            '#F8FAFC',
          ],
          prohibitedColors: ['#FF00FF', '#00FF00'],
          maxColors: 8,
          stroke: {
            enabled: true,
            width: 2,
            maxWidth: 4,
            colors: ['#0F172A', '#1E293B', '#334155', '#64748B'],
          },
        },
      });

      const makeCoreSvg = (coreMarkup: string, accentMarkup: string) =>
        `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160" viewBox="0 0 160 160"><g id="slot-shadow"><ellipse id="ground-shadow" cx="80" cy="144" rx="46" ry="8" fill="#0F172A"/></g><g id="slot-body"><rect id="chassis-outer" x="28" y="20" width="104" height="112" rx="16" fill="#1E293B" stroke="#64748B" stroke-width="2"/><rect id="chassis-bezel" x="36" y="28" width="88" height="96" rx="10" fill="#0F172A" stroke="#334155" stroke-width="2"/></g><g id="slot-panel"><rect id="panel-recess" x="44" y="36" width="72" height="80" rx="6" fill="#1E293B" stroke="#334155" stroke-width="2"/></g><g id="slot-core">${coreMarkup}</g><g id="slot-accent">${accentMarkup}</g></svg>`;

      await callJson('create_asset', {
        data: {
          schemaVersion: 1,
          id: 'aegis-core-mk1',
          name: 'Aegis Core Module Mk.I',
          category: 'modules',
          style: 'aegis-tactical',
          family: 'aegis-cores',
          width: 160,
          height: 160,
          viewBox: [0, 0, 160, 160],
        },
        svg: makeCoreSvg(
          '<circle id="core-ring" cx="80" cy="76" r="22" fill="#0F172A" stroke="#0EA5E9" stroke-width="3"/><circle id="core-nucleus" cx="80" cy="76" r="11" fill="#38BDF8"/><circle id="core-spark" cx="76" cy="72" r="4" fill="#F8FAFC"/>',
          '<rect id="led-top" x="68" y="23" width="24" height="3" rx="1" fill="#38BDF8"/>',
        ),
      });

      const variants = [
        {
          id: 'aegis-core-mk2-dual',
          name: 'Aegis Core Module Mk.II Dual-Cell',
          variant: 'mk2-dual',
          core: '<rect id="cell-top" x="54" y="48" width="52" height="22" rx="5" fill="#0EA5E9"/><rect id="cell-bot" x="54" y="82" width="52" height="22" rx="5" fill="#38BDF8"/>',
          accent: '<rect id="bar-left" x="31" y="56" width="3" height="40" fill="#38BDF8"/>',
        },
        {
          id: 'aegis-core-mk3-overclock',
          name: 'Aegis Core Module Mk.III Overclock',
          variant: 'mk3-overclock',
          core: '<polygon id="overclock-poly" points="80,50 106,76 80,102 54,76" fill="#F59E0B" stroke="#1E293B" stroke-width="2"/><circle id="overclock-eye" cx="80" cy="76" r="8" fill="#EF4444"/>',
          accent: '<rect id="vent-top" x="56" y="23" width="48" height="3" fill="#F59E0B"/>',
        },
        {
          id: 'aegis-core-cryo',
          name: 'Aegis Cryo-Stasis Core',
          variant: 'cryo-stasis',
          core: '<polygon id="cryo-hex" points="80,48 104,62 104,90 80,104 56,90 56,62" fill="#38BDF8" stroke="#334155" stroke-width="2"/><circle id="cryo-dot" cx="80" cy="76" r="8" fill="#F8FAFC"/>',
          accent: '<circle id="frost-tl" cx="50" cy="42" r="3" fill="#F8FAFC"/>',
        },
        {
          id: 'aegis-core-bastion',
          name: 'Aegis Bastion Heavy Core',
          variant: 'bastion-heavy',
          core: '<rect id="bastion-slit" x="48" y="68" width="64" height="16" rx="4" fill="#0F172A" stroke="#64748B" stroke-width="2"/><rect id="bastion-beam" x="56" y="73" width="48" height="6" rx="2" fill="#F59E0B"/>',
          accent:
            '<rect id="armor-bolt" x="32" y="24" width="8" height="8" rx="2" fill="#64748B"/>',
        },
      ];

      for (const v of variants) {
        await callJson('create_variant', {
          baseId: 'aegis-core-mk1',
          data: { id: v.id, name: v.name, variant: v.variant },
          svg: makeCoreSvg(v.core, v.accent),
        });
      }

      const familyList = await callJson('list_assets', { family: 'aegis-cores' });
      expect(familyList).toHaveLength(5);

      const validation = await callJson('validate');
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);

      const diskProject = await readProject(proProjectDir);
      expect(diskProject.styles).toHaveLength(1);
      expect(diskProject.assets).toHaveLength(5);
      expect(
        diskProject.assets.every(
          (a) =>
            a.metadata.schemaVersion === 1 &&
            a.metadata.family === 'aegis-cores' &&
            a.metadata.style === 'aegis-tactical',
        ),
      ).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('creates an articulated actor with 7 rig nodes, multiple clips, sequence, state machine, multi-time snapshots and exports', async () => {
    const { client, call, callJson } = await connectMcp(proProjectDir);
    try {
      const actorSvg =
        '<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200" viewBox="0 0 200 200"><g id="shadow"><ellipse id="drone-shadow" cx="100" cy="176" rx="44" ry="8" fill="#0F172A"/></g><g id="chassis"><g id="wing-left"><polygon id="wing-l" points="64,84 24,68 20,104 58,114" fill="#334155" stroke="#64748B" stroke-width="2"/></g><g id="wing-right"><polygon id="wing-r" points="136,84 176,68 180,104 142,114" fill="#334155" stroke="#64748B" stroke-width="2"/></g><rect id="hull" x="58" y="68" width="84" height="58" rx="16" fill="#1E293B" stroke="#64748B" stroke-width="2"/><g id="turret"><g id="antenna"><line id="ant-line" x1="100" y1="48" x2="100" y2="24" stroke="#64748B" stroke-width="3"/><circle id="ant-tip" cx="100" cy="22" r="5" fill="#F59E0B"/></g><rect id="dome" x="70" y="46" width="60" height="28" rx="12" fill="#334155" stroke="#64748B" stroke-width="2"/><circle id="optic-eye" cx="100" cy="60" r="6" fill="#38BDF8"/></g></g></svg>';

      const actorMeta = {
        schemaVersion: 1,
        id: 'aegis-warden-drone',
        name: 'Aegis Warden Recon Drone',
        category: 'units',
        style: 'aegis-tactical',
        family: 'aegis-units',
        width: 200,
        height: 200,
        viewBox: [0, 0, 200, 200],
        clips: [],
      };

      await callJson('create_actor', {
        data: actorMeta,
        svg: actorSvg,
        rig: {
          schemaVersion: 1,
          actorId: 'aegis-warden-drone',
          nodes: {
            shadow: { svgId: 'shadow', pivot: [0.5, 0.5] },
            chassis: { svgId: 'chassis', pivot: [0.5, 0.5] },
            wingLeft: { svgId: 'wing-left', parent: 'chassis', pivot: [0.9, 0.35] },
            wingRight: { svgId: 'wing-right', parent: 'chassis', pivot: [0.1, 0.35] },
            turret: { svgId: 'turret', parent: 'chassis', pivot: [0.5, 0.85] },
            optic: { svgId: 'optic-eye', parent: 'turret', pivot: [0.5, 0.5] },
            antenna: { svgId: 'antenna', parent: 'turret', pivot: [0.5, 1.0] },
          },
        },
      });

      await callJson('create_animation', {
        data: {
          schemaVersion: 1,
          id: 'warden-idle',
          actorId: 'aegis-warden-drone',
          duration: 2.0,
          loop: true,
          tracks: {
            'chassis.position.y': [
              { time: 0, value: 0 },
              { time: 1.0, value: -10, easing: 'easeInOutQuad' },
              { time: 2.0, value: 0, easing: 'easeInOutQuad' },
            ],
            'wingLeft.rotation': [
              { time: 0, value: 0 },
              { time: 1.0, value: -8, easing: 'easeInOutCubic' },
              { time: 2.0, value: 0, easing: 'easeInOutCubic' },
            ],
            'wingRight.rotation': [
              { time: 0, value: 0 },
              { time: 1.0, value: 8, easing: 'easeInOutCubic' },
              { time: 2.0, value: 0, easing: 'easeInOutCubic' },
            ],
          },
        },
      });

      await callJson('create_animation', {
        data: {
          schemaVersion: 1,
          id: 'warden-scan',
          actorId: 'aegis-warden-drone',
          duration: 1.6,
          loop: true,
          tracks: {
            'turret.rotation': [
              { time: 0, value: 0 },
              { time: 0.4, value: -16, easing: 'easeOutBack' },
              { time: 1.2, value: 16, easing: 'easeInOutCubic' },
              { time: 1.6, value: 0, easing: 'easeInOutCubic' },
            ],
            'optic.fill': [
              { time: 0, value: '#38BDF8' },
              { time: 0.8, value: '#F59E0B' },
              { time: 1.6, value: '#38BDF8' },
            ],
          },
        },
      });

      await callJson('create_sequence', {
        data: {
          schemaVersion: 1,
          id: 'warden-patrol-routine',
          name: 'Warden Patrol & Scan Routine',
          actorId: 'aegis-warden-drone',
          loop: true,
          steps: [
            { action: 'play', clip: 'warden-idle', duration: 2.0 },
            {
              action: 'parallel',
              steps: [
                {
                  action: 'moveTo',
                  target: 'chassis',
                  x: 20,
                  y: -8,
                  duration: 0.8,
                  easing: 'easeInOutCubic',
                },
                { action: 'play', clip: 'warden-scan', duration: 1.6 },
              ],
            },
            { action: 'moveTo', target: 'chassis', x: 0, y: 0, duration: 0.8 },
          ],
        },
      });

      await callJson('create_state_machine', {
        data: {
          schemaVersion: 1,
          id: 'warden-states',
          actorId: 'aegis-warden-drone',
          initial: 'idle',
          states: {
            idle: {
              clip: 'warden-idle',
              transitions: [{ to: 'scanning', event: 'scan' }],
            },
            scanning: {
              clip: 'warden-scan',
              transitions: [{ to: 'idle', event: 'clear' }],
            },
          },
        },
      });

      await callJson('update_actor', {
        data: {
          ...actorMeta,
          clips: ['warden-idle', 'warden-scan'],
          stateMachine: 'warden-states',
        },
      });

      const validation = await callJson('validate');
      expect(validation.valid).toBe(true);
      expect(validation.issues).toEqual([]);

      // Capture snapshots at 3 timestamps and verify deterministic pose changes
      const buffers: Buffer[] = [];
      for (const time of [0, 1.0, 2.4]) {
        const snap = await call('snapshot', {
          id: 'warden-patrol-routine',
          time,
          overwrite: true,
        });
        const buf = Buffer.from((snap.content as any[])[1].data, 'base64');
        expect(buf.subarray(1, 4).toString()).toBe('PNG');
        buffers.push(buf);
      }
      expect(buffers[0].equals(buffers[1])).toBe(false);
      expect(buffers[1].equals(buffers[2])).toBe(false);

      // Export to generic, web, and flutter
      for (const format of ['generic', 'web', 'flutter'] as const) {
        const dest = path.join(tempRoot, `scenario3-export-${format}`);
        const plan = await callJson('export', {
          destination: dest,
          format,
          dryRun: false,
        });
        expect(plan.written.length).toBeGreaterThan(10);
      }
    } finally {
      await client.close();
    }
  }, 60000);
});

describe('Scenario 4 — Distribution (Real npm Tarball Clean Environment Test)', () => {
  it('packs a real npm tarball and runs CLI + MCP from a clean unpacked directory without tsx', async () => {
    const packDir = path.join(tempRoot, 'tarball-test');
    const unpackDir = path.join(packDir, 'unpacked');
    await fs.mkdir(unpackDir, { recursive: true });

    const { stdout: packOut } = await exec('npm', ['pack', '--pack-destination', packDir], {
      cwd: repoRoot,
    });
    const tarballName = packOut
      .trim()
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.endsWith('.tgz'))
      .pop()!;
    const tarballPath = path.join(packDir, tarballName);
    expect(existsSync(tarballPath)).toBe(true);

    // Extract tarball into isolated directory
    await exec('tar', ['-xzf', tarballPath, '-C', unpackDir]);
    const pkgDir = path.join(unpackDir, 'package');
    expect(existsSync(path.join(pkgDir, 'dist/cli.js'))).toBe(true);
    expect(existsSync(path.join(pkgDir, 'dist/mcp-bin.js'))).toBe(true);
    expect(existsSync(path.join(pkgDir, 'dist/mcp.js'))).toBe(true);
    expect(existsSync(path.join(pkgDir, 'dist/vectorforge-runtime.js'))).toBe(true);
    expect(existsSync(path.join(pkgDir, 'apps/studio/dist/index.html'))).toBe(true);
    expect(existsSync(path.join(pkgDir, 'skills/vectorforge-mcp-starter/SKILL.md'))).toBe(true);

    // Symlink only the 3 runtime dependencies (@modelcontextprotocol/sdk, @xmldom/xmldom, zod) + @playwright/test for snapshot verification
    const isolatedNodeModules = path.join(pkgDir, 'node_modules');
    await fs.mkdir(path.join(isolatedNodeModules, '@modelcontextprotocol'), { recursive: true });
    await fs.mkdir(path.join(isolatedNodeModules, '@xmldom'), { recursive: true });
    await fs.mkdir(path.join(isolatedNodeModules, '@playwright'), { recursive: true });
    for (const [relTarget, relLink] of [
      ['@modelcontextprotocol/sdk', '@modelcontextprotocol/sdk'],
      ['@xmldom/xmldom', '@xmldom/xmldom'],
      ['zod', 'zod'],
      ['@playwright/test', '@playwright/test'],
    ]) {
      await fs.symlink(
        path.join(repoRoot, 'node_modules', relTarget),
        path.join(isolatedNodeModules, relLink),
      );
    }

    // Create symlink bins like npm does (.bin/vectorforge -> ../dist/cli.js, .bin/vectorforge-mcp -> ../dist/mcp-bin.js)
    const binDir = path.join(packDir, 'bin');
    await fs.mkdir(binDir, { recursive: true });
    const binLink = path.join(binDir, 'vectorforge');
    const mcpBinLink = path.join(binDir, 'vectorforge-mcp');
    await fs.symlink(path.join(pkgDir, 'dist/cli.js'), binLink);
    await fs.symlink(path.join(pkgDir, 'dist/mcp-bin.js'), mcpBinLink);

    // 1. CLI starts via symlinked binary without tsx
    const { stdout: helpOut } = await exec(process.execPath, [binLink, '--help'], {
      cwd: packDir,
    });
    expect(helpOut).toContain('VectorForge v0.1.0');
    expect(helpOut).toContain('doctor');

    const { stdout: doctorOut } = await exec(process.execPath, [binLink, 'doctor'], {
      cwd: packDir,
    });
    const doctorReport = JSON.parse(doctorOut);
    expect(doctorReport.healthy).toBe(true);
    expect(doctorReport.components.mcpServer).toBe(true);

    // 2. Connect MCP client to the unpacked tarball vectorforge-mcp binary using --project=value syntax
    const cleanProjectDir = path.join(packDir, 'clean-user-project');
    const client = new Client({ name: 'tarball-mcp-client', version: '1.0.0' });
    await client.connect(
      new StdioClientTransport({
        command: process.execPath,
        args: [mcpBinLink, `--project=${cleanProjectDir}`, '--init', '--name=Tarball Project'],
        cwd: packDir,
        stderr: 'pipe',
      }),
    );

    try {
      const tools = await client.listTools();
      expect(tools.tools.length).toBeGreaterThanOrEqual(25);

      const callTarball = async (name: string, args: Record<string, unknown> = {}) => {
        const r = await client.callTool({ name: `vectorforge_${name}`, arguments: args });
        if (r.isError) throw new Error(JSON.stringify(r.content));
        return r as { content: any[] };
      };

      await callTarball('create_style', {
        data: {
          schemaVersion: 1,
          id: 'tarball-style',
          name: 'Tarball Style',
          palette: ['#112233', '#445566', '#88CCFF'],
        },
      });
      await callTarball('create_asset', {
        data: {
          schemaVersion: 1,
          id: 'tarball-icon',
          name: 'Tarball Icon',
          style: 'tarball-style',
          width: 64,
          height: 64,
          viewBox: [0, 0, 64, 64],
        },
        svg: '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect id="box" x="8" y="8" width="48" height="48" rx="8" fill="#112233" stroke="#88CCFF" stroke-width="2"/></svg>',
      });

      const valRes = JSON.parse((await callTarball('validate')).content[0].text);
      expect(valRes.valid).toBe(true);

      // Snapshot using the static prebuilt Studio inside the unpacked tarball (no Vite needed!)
      const snapRes = await callTarball('snapshot', { id: 'tarball-icon', overwrite: true });
      const pngBuf = Buffer.from(snapRes.content[1].data, 'base64');
      expect(pngBuf.subarray(1, 4).toString()).toBe('PNG');

      // Web export using prebuilt vectorforge-runtime.js (no Vite needed!)
      const webDest = path.join(packDir, 'web-out');
      const expRes = JSON.parse(
        (
          await callTarball('export', {
            destination: webDest,
            format: 'web',
            dryRun: false,
          })
        ).content[0].text,
      );
      expect(expRes.written).toContain('vectorforge-runtime.js');
    } finally {
      await client.close();
    }
  }, 60000);
});

describe('Scenario 5 — Safety, Overwrite Guards & Commercial Git Hygiene', () => {
  it('enforces path traversal, symlink, SVG safety, overwrite and dry-run protections', async () => {
    const safeProj = path.join(tempRoot, 'scenario5-safety');
    await exec(process.execPath, [compiledCli, 'init', safeProj, '--name', 'Safety Project']);

    // 1. Path traversal blocked
    await expect(safePath(safeProj, '../../etc/passwd')).rejects.toThrow('escapes');

    // 2. Symlink inside project blocked
    const outsideDir = path.join(tempRoot, 'outside-secret');
    await fs.mkdir(outsideDir, { recursive: true });
    await fs.symlink(outsideDir, path.join(safeProj, 'assets/symlinked-asset'));
    await expect(safePath(safeProj, 'assets/symlinked-asset/asset.json')).rejects.toThrow(
      'Symbolic',
    );
    await fs.rm(path.join(safeProj, 'assets/symlinked-asset'), { force: true });

    // 3. Create valid style & asset, then test overwrite protection and unsafe SVG rejection
    await saveResource(safeProj, 'style', {
      schemaVersion: 1,
      id: 'safe-style',
      name: 'Safe Style',
      palette: ['#123456', '#ABCDEF'],
    });
    const cleanSvg =
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect id="r" width="64" height="64" fill="#123456"/></svg>';
    await saveResource(
      safeProj,
      'asset',
      {
        schemaVersion: 1,
        id: 'safe-item',
        name: 'Safe Item',
        style: 'safe-style',
        width: 64,
        height: 64,
        viewBox: [0, 0, 64, 64],
      },
      { svg: cleanSvg },
    );

    // Reject duplicate create without overwrite
    await expect(
      saveResource(
        safeProj,
        'asset',
        {
          schemaVersion: 1,
          id: 'safe-item',
          name: 'Overwrite Attempt',
          style: 'safe-style',
          width: 64,
          height: 64,
          viewBox: [0, 0, 64, 64],
        },
        { svg: cleanSvg, overwrite: false },
      ),
    ).rejects.toThrow('already exists');

    // Reject unsafe SVG payloads
    for (const badSvg of [
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><script>alert(1)</script></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><rect onclick="evil()" width="64" height="64"/></svg>',
      '<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><image href="https://example.com/x.png"/></svg>',
    ]) {
      await expect(
        saveResource(
          safeProj,
          'asset',
          {
            schemaVersion: 1,
            id: 'safe-item',
            name: 'Unsafe Update',
            style: 'safe-style',
            width: 64,
            height: 64,
            viewBox: [0, 0, 64, 64],
          },
          { svg: badSvg, overwrite: true },
        ),
      ).rejects.toThrow();
    }

    // Verify original SVG was preserved untouched
    expect(await fs.readFile(path.join(safeProj, 'assets/safe-item/asset.svg'), 'utf8')).toBe(
      cleanSvg,
    );

    // 4. Dry-run export and conflict protection
    const data = await readProject(safeProj);
    const expDest = path.join(tempRoot, 'scenario5-export');
    const dry = await exportProject(data, expDest, { dryRun: true });
    expect(dry.dryRun).toBe(true);
    expect(existsSync(expDest)).toBe(false);

    await exportProject(data, expDest, { dryRun: false });
    await expect(exportProject(data, expDest, { dryRun: false, overwrite: false })).rejects.toThrow(
      'conflicts',
    );
    await expect(planExport(data, safeProj)).rejects.toThrow('source');
  });

  it('verifies paid Pro skill files and Agensi artifacts are gitignored, untracked and excluded from npm pack', async () => {
    // 1. git check-ignore confirms .private/ and artifacts/agensi/ are ignored
    const { stdout: ignoredOut } = await exec(
      'git',
      [
        'check-ignore',
        '.private/agensi/vectorforge-production-pro/SKILL.md',
        'artifacts/agensi/vectorforge-production-pro.zip',
        'artifacts/agensi/vectorforge-mcp-starter.zip',
      ],
      { cwd: repoRoot },
    );
    expect(ignoredOut).toContain('.private/agensi/vectorforge-production-pro/SKILL.md');
    expect(ignoredOut).toContain('artifacts/agensi/vectorforge-production-pro.zip');

    // 2. git ls-files confirms zero tracked files in .private/ or artifacts/
    const { stdout: trackedPrivate } = await exec('git', ['ls-files', '.private', 'artifacts'], {
      cwd: repoRoot,
    });
    expect(trackedPrivate.trim()).toBe('');

    // 3. npm pack --dry-run --json confirms no private files or personal paths are packaged
    const { stdout: packJsonOut } = await exec('npm', ['pack', '--dry-run', '--json'], {
      cwd: repoRoot,
    });
    const packInfo = JSON.parse(packJsonOut.slice(packJsonOut.indexOf('[')))[0];
    const packagedPaths: string[] = packInfo.files.map((f: { path: string }) => f.path);
    expect(packagedPaths.some((p) => p.startsWith('.private/'))).toBe(false);
    expect(packagedPaths.some((p) => p.startsWith('artifacts/'))).toBe(false);
    expect(packagedPaths).toContain('dist/cli.js');
    expect(packagedPaths).toContain('skills/vectorforge-mcp-starter/SKILL.md');
  });
});
