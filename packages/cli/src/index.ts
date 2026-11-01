#!/usr/bin/env node
import { promises as fs } from 'node:fs';
import path from 'node:path';
import {
  createVariant,
  defaultProject,
  initProject,
  projectContext,
  readProject,
  saveResource,
  type ResourceKind,
} from '../../core/src/index.ts';
import { snapshot } from '../../core/src/snapshot.ts';
import { exportProject, type ExportFormat } from '../../exporters/index.ts';
import { startMcp } from '../../mcp/src/index.ts';

const help = `VectorForge v0.1 — An AI-first 2D asset and motion pipeline

Usage: pnpm vectorforge <command> [arguments] [options]

  init <directory> [--name NAME]             Create an empty portable project
  studio [--project PATH]                    Start the local Studio
  context                                   Read machine-readable project context
  validate [project-directory]               Validate schemas, SVG, rigs, styles and references
  list assets|actors|styles|animations|sequences|state-machines
  get asset|actor|style|animation|sequence|stateMachine <id>
  create <kind> <metadata.json> [--svg FILE] [--rig FILE]
  update <kind> <metadata.json> [--svg FILE] [--rig FILE]
  variant <base-id> <metadata.json> --svg FILE
  preview <id>                              Start Studio with the selection open
  snapshot <id> [--time SECONDS] [--clip ID] [--sequence ID] [--out FILE] [--overwrite]
  export <id> --dest DIRECTORY [--format generic|web|flutter] [--dry-run] [--overwrite]
  export-all --dest DIRECTORY [--format generic|web|flutter] [--dry-run] [--overwrite]
  mcp                                       Run the official MCP stdio server

Global: --project PATH (defaults to examples/generic-demo)
        --help, -h
All motion times and sequence durations use seconds. No cloud service is required.
Snapshots need Chromium: pnpm exec playwright install chromium.
`;
export async function main(args = process.argv.slice(2)) {
  const options: Record<string, string | boolean> = {},
    positional: string[] = [];
  const flags = new Set(['dry-run', 'overwrite', 'help', 'h']);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--') || arg === '-h') {
      const key = arg.replace(/^-+/, '');
      if (flags.has(key)) options[key] = true;
      else {
        if (!args[i + 1] || args[i + 1].startsWith('--'))
          throw new Error(`Missing value for --${key}.`);
        options[key] = args[++i];
      }
    } else positional.push(arg);
  }
  const [command, first, second] = positional;
  if (!command || options.help || options.h || command === 'help') {
    console.log(help);
    return;
  }
  const root = path.resolve(
    String(options.project ?? (command === 'validate' && first ? first : defaultProject)),
  );
  const output = (value: unknown) => console.log(JSON.stringify(value, null, 2));
  const readJson = async (file?: string) => {
    if (!file) throw new Error('A JSON source file is required.');
    return JSON.parse(await fs.readFile(file, 'utf8'));
  };
  const source = async (key: string) =>
    options[key] ? await fs.readFile(String(options[key]), 'utf8') : undefined;
  if (command === 'init') {
    if (!first) throw new Error('Choose a destination directory.');
    output(await initProject(path.resolve(first), String(options.name ?? 'Untitled project')));
    return;
  }
  if (command === 'mcp') {
    await startMcp(root);
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
    const list = (await readProject(root))[key];
    if (command === 'list') output(list.map((e: any) => e.metadata ?? e));
    else {
      const entry = list.find((e: any) => (e.metadata?.id ?? e.id) === second);
      if (!entry) throw new Error(`${first} ${second} does not exist.`);
      output(entry);
    }
    return;
  }
  if (command === 'create' || command === 'update') {
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
    const svg = await source('svg');
    if (!svg) throw new Error('--svg FILE is required.');
    output(await createVariant(root, first, await readJson(second), svg));
    return;
  }
  if (command === 'snapshot') {
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
    if (!options.dest) throw new Error('--dest DIRECTORY is required.');
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
  throw new Error(`Unknown command "${command}". Run pnpm vectorforge --help.`);
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename))
  main().catch((error) => {
    console.error(`VectorForge: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
