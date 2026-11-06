#!/usr/bin/env node
import { promises as fs, existsSync, realpathSync } from 'node:fs';
import path from 'node:path';
import {
  createVariant,
  initProject,
  packageRoot,
  projectContext,
  readProject,
  resolveProjectRoot,
  saveResource,
  type ResourceKind,
} from '../../core/src/index.ts';
import { checkChromiumStatus, snapshot } from '../../core/src/snapshot.ts';
import { exportProject, type ExportFormat } from '../../exporters/index.ts';
import { createMcpServer, startMcp } from '../../mcp/src/index.ts';

const VERSION = '0.1.0';

const help = `VectorForge v${VERSION} — An AI-first 2D asset and motion pipeline

Usage: vectorforge <command> [arguments] [options]
       pnpm vectorforge <command> [arguments] [options]

  init <directory> [--name NAME]             Create an empty portable project
  studio [--project PATH]                    Start the local Studio UI
  context                                    Read machine-readable project context
  validate [project-directory]               Validate schemas, SVG, rigs, styles and references
  doctor [--project PATH]                    Verify installation, MCP server, Chromium and project health
  list assets|actors|styles|animations|sequences|state-machines
  get asset|actor|style|animation|sequence|stateMachine <id>
  create <kind> <metadata.json> [--svg FILE] [--rig FILE]
  update <kind> <metadata.json> [--svg FILE] [--rig FILE]
  variant <base-id> <metadata.json> --svg FILE
  preview <id>                               Start Studio with the selection open
  snapshot <id> [--time SECONDS] [--clip ID] [--sequence ID] [--out FILE] [--overwrite]
  export <id> --dest DIRECTORY [--format generic|web|flutter] [--dry-run] [--overwrite]
  export-all --dest DIRECTORY [--format generic|web|flutter] [--dry-run] [--overwrite]
  mcp [--project PATH] [--init] [--name NAME] Run the official MCP stdio server

Global options:
  --project PATH    Target project directory (or set VECTORFORGE_PROJECT; defaults to current project or examples/generic-demo)
  --help, -h        Show this help message
  --version, -v     Print VectorForge version

Notes:
  - All motion times and sequence durations use seconds. No cloud service or API key is required.
  - Export --dry-run inspects planned files and conflicts without creating or modifying directories.
  - Snapshots require Playwright Chromium: npx playwright install chromium (or pnpm exec playwright install chromium).
`;

export async function runDoctor(root: string) {
  const nodeMajor = Number(process.versions.node.split('.')[0] ?? 0);
  const nodeOk = nodeMajor >= 22;
  const studioDistExists = existsSync(path.join(packageRoot, 'apps/studio/dist/index.html'));
  const studioSrcExists = existsSync(path.join(packageRoot, 'apps/studio/src/main.tsx'));
  const webRuntimeReady =
    existsSync(path.join(packageRoot, 'dist/vectorforge-runtime.js')) ||
    existsSync(path.join(packageRoot, 'packages/exporters/web/src/runtime.ts'));
  const chromiumStatus = await checkChromiumStatus();

  let mcpReady = false;
  try {
    const instance = createMcpServer(root);
    mcpReady = Boolean(instance.server);
    await instance.close();
  } catch {
    mcpReady = false;
  }

  let projectStatus: {
    exists: boolean;
    root: string;
    name?: string;
    valid?: boolean;
    counts?: Record<string, number>;
    errorCount?: number;
    warningCount?: number;
    error?: string;
  } = { exists: false, root };

  try {
    const data = await readProject(root);
    const errorCount = data.issues.filter((i) => i.severity === 'error').length;
    const warningCount = data.issues.filter((i) => i.severity === 'warning').length;
    projectStatus = {
      exists: true,
      root: data.root,
      name: data.project.name,
      valid: errorCount === 0,
      counts: {
        styles: data.styles.length,
        assets: data.assets.length,
        actors: data.actors.length,
        animations: data.animations.length,
        sequences: data.sequences.length,
        stateMachines: data.stateMachines.length,
      },
      errorCount,
      warningCount,
    };
  } catch (error) {
    projectStatus = {
      exists: false,
      root,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const recommendations: string[] = [];
  if (!nodeOk) {
    recommendations.push(`Upgrade Node.js to >= 22 (current: ${process.version}).`);
  }
  if (!chromiumStatus.available) {
    recommendations.push(chromiumStatus.message);
  }
  if (!projectStatus.exists) {
    recommendations.push(
      `Initialize a project with "vectorforge init <directory>" or pass "--project <existing-project-path>".`,
    );
  } else if (!projectStatus.valid) {
    recommendations.push(
      `Run "vectorforge validate --project ${projectStatus.root}" and resolve ${projectStatus.errorCount} validation error(s).`,
    );
  }

  return {
    version: VERSION,
    healthy:
      nodeOk &&
      mcpReady &&
      (studioDistExists || studioSrcExists) &&
      projectStatus.exists &&
      !!projectStatus.valid,
    environment: {
      nodeVersion: process.version,
      nodeSupported: nodeOk,
      platform: process.platform,
      arch: process.arch,
      packageRoot,
    },
    components: {
      cli: true,
      mcpServer: mcpReady,
      studioUi: studioDistExists || studioSrcExists,
      webExporterRuntime: webRuntimeReady,
      chromiumSnapshot: chromiumStatus,
    },
    project: projectStatus,
    recommendations,
  };
}

export async function main(args = process.argv.slice(2)) {
  const invokedBin = process.argv[1] ? path.basename(process.argv[1]).toLowerCase() : '';
  if (invokedBin.startsWith('vectorforge-mcp') && (!args.length || args[0].startsWith('-'))) {
    args = ['mcp', ...args];
  }
  const options: Record<string, string | boolean> = {},
    positional: string[] = [];
  const flags = new Set(['dry-run', 'overwrite', 'help', 'h', 'version', 'v', 'init']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--') || arg === '-h' || arg === '-v') {
      const raw = arg.replace(/^-+/, '');
      const eqIdx = raw.indexOf('=');
      if (eqIdx !== -1) {
        const key = raw.slice(0, eqIdx);
        const val = raw.slice(eqIdx + 1);
        if (!val)
          throw new Error(`Missing value for --${key}. Run "vectorforge --help" for usage.`);
        options[key] = flags.has(key) ? val !== 'false' : val;
      } else if (flags.has(raw)) {
        options[raw] = true;
      } else {
        if (!args[i + 1] || args[i + 1].startsWith('--'))
          throw new Error(`Missing value for --${raw}. Run "vectorforge --help" for usage.`);
        options[raw] = args[++i];
      }
    } else positional.push(arg);
  }
  const [command, first, second] = positional;
  if (options.version || options.v || command === 'version') {
    console.log(VERSION);
    return;
  }
  if (!command || options.help || options.h || command === 'help') {
    console.log(help);
    return;
  }
  const explicitProject =
    typeof options.project === 'string'
      ? options.project
      : (command === 'validate' || command === 'doctor') && first
        ? first
        : undefined;
  const root = resolveProjectRoot(explicitProject);
  const output = (value: unknown) => console.log(JSON.stringify(value, null, 2));
  const readJson = async (file?: string) => {
    if (!file) throw new Error('A JSON source file is required.');
    try {
      const text = await fs.readFile(file, 'utf8');
      return JSON.parse(text);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new Error(`JSON file not found: ${path.resolve(file)}`);
      throw new Error(
        `Invalid JSON in ${file}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  };
  const source = async (key: string) => {
    if (!options[key]) return undefined;
    const file = String(options[key]);
    try {
      return await fs.readFile(file, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        throw new Error(`File not found for --${key}: ${path.resolve(file)}`);
      throw error;
    }
  };
  if (command === 'init') {
    if (!first)
      throw new Error(
        'Choose a destination directory. Example: vectorforge init ./my-project --name "My Project"',
      );
    output(await initProject(path.resolve(first), String(options.name ?? 'Untitled project')));
    return;
  }
  if (command === 'doctor') {
    const report = await runDoctor(root);
    output(report);
    if (!report.healthy) process.exitCode = 1;
    return;
  }
  if (command === 'mcp') {
    await startMcp(root, {
      init: !!options.init,
      name: typeof options.name === 'string' ? options.name : undefined,
    });
    return;
  }
  if (command === 'studio' || command === 'preview') {
    const { createStudio } = await import('../../../scripts/studio.ts');
    const { url, server } = await createStudio(root);
    console.log(
      `VectorForge Studio: ${url}${command === 'preview' && first ? `/?selected=${encodeURIComponent(first)}` : ''}\nProject: ${root}`,
    );
    const close = async () => {
      await server.close();
      process.exit(0);
    };
    process.on('SIGINT', close);
    process.on('SIGTERM', close);
    return;
  }
  if (command === 'context') {
    output(projectContext(await readProject(root)));
    return;
  }
  if (command === 'validate') {
    const data = await readProject(root);
    output({ valid: !data.issues.some((i) => i.severity === 'error'), issues: data.issues });
    if (data.issues.some((i) => i.severity === 'error')) process.exitCode = 1;
    return;
  }
  if (command === 'list' || command === 'get') {
    const mapping = {
      assets: 'assets',
      actors: 'actors',
      styles: 'styles',
      animations: 'animations',
      sequences: 'sequences',
      'state-machines': 'stateMachines',
      asset: 'assets',
      actor: 'actors',
      style: 'styles',
      animation: 'animations',
      sequence: 'sequences',
      stateMachine: 'stateMachines',
    } as const;
    const key = mapping[first as keyof typeof mapping];
    if (!key)
      throw new Error('Choose assets, actors, styles, animations, sequences or state-machines.');
    if (command === 'get' && !second)
      throw new Error(`Specify a resource id. Example: vectorforge get ${first} <id>`);
    const list = (await readProject(root))[key];
    if (command === 'list') output(list.map((e: any) => e.metadata ?? e));
    else {
      const entry = list.find((e: any) => (e.metadata?.id ?? e.id) === second);
      if (!entry) throw new Error(`${first} ${second} does not exist in project ${root}.`);
      output(entry);
    }
    return;
  }
  if (command === 'create' || command === 'update') {
    const validKinds = new Set([
      'style',
      'asset',
      'actor',
      'rig',
      'animation',
      'sequence',
      'stateMachine',
      'project',
      'context',
    ]);
    if (!first || !validKinds.has(first)) {
      throw new Error(
        `Specify a valid resource kind (${[...validKinds].join(', ')}). Example: vectorforge ${command} asset ./asset.json --svg ./asset.svg`,
      );
    }
    output(
      await saveResource(root, first as ResourceKind, await readJson(second), {
        svg: await source('svg'),
        rig: options.rig ? await readJson(String(options.rig)) : undefined,
        overwrite: command === 'update',
      }),
    );
    return;
  }
  if (command === 'variant') {
    if (!first)
      throw new Error(
        'Specify a base asset id. Example: vectorforge variant <base-id> <variant.json> --svg <variant.svg>',
      );
    const svg = await source('svg');
    if (!svg) throw new Error('--svg FILE is required when creating a variant.');
    output(await createVariant(root, first, await readJson(second), svg));
    return;
  }
  if (command === 'snapshot') {
    if (!first)
      throw new Error(
        'Specify an asset, actor, animation or sequence id to snapshot. Example: vectorforge snapshot <id> [--time 0.5]',
      );
    const result = await snapshot(root, first, {
      time: options.time ? Number(options.time) : 0,
      clip: options.clip as string | undefined,
      sequence: options.sequence as string | undefined,
      output: options.out as string | undefined,
      overwrite: !!options.overwrite,
    });
    const { image: _image, ...info } = result;
    output(info);
    return;
  }
  if (command === 'export' || command === 'export-all') {
    if (command === 'export' && !first)
      throw new Error(
        'Specify a resource id to export (or use export-all). Example: vectorforge export <id> --dest ./output --format web',
      );
    if (!options.dest)
      throw new Error(
        '--dest DIRECTORY is required for export. Add --dry-run to preview planned files without writing.',
      );
    output(
      await exportProject(await readProject(root), String(options.dest), {
        id: command === 'export' ? first : undefined,
        format: (options.format ?? 'generic') as ExportFormat,
        dryRun: !!options['dry-run'],
        overwrite: !!options.overwrite,
      }),
    );
    return;
  }
  throw new Error(`Unknown command "${command}". Run vectorforge --help.`);
}

function isMainModule(): boolean {
  if (!process.argv[1]) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(import.meta.filename);
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
  }
}

if (isMainModule())
  main().catch((error) => {
    console.error(`VectorForge: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
