import { promises as fs } from 'node:fs';
import path from 'node:path';
import type { z } from 'zod';
import {
  actorSchema,
  animationSchema,
  assetSchema,
  contextSchema,
  idSchema,
  projectSchema,
  rigSchema,
  sequenceSchema,
  stateMachineSchema,
  styleSchema,
  type Action,
  type Issue,
  type ProjectData,
  type ActorEntry,
  type AssetEntry,
} from '../../schema/src/index.ts';
import { assertSafeSvg, inspectSvg } from '../../svg/src/index.ts';
import { compileSequence, hierarchyOrder } from '../../motion/src/index.ts';

export function isActorEntry(entry: AssetEntry | ActorEntry): entry is ActorEntry {
  return 'rig' in entry;
}

export const defaultProject = path.resolve(import.meta.dirname, '../../../examples/generic-demo');
export async function safePath(root: string, relative: string): Promise<string> {
  const base = path.resolve(root),
    destination = path.resolve(base, relative);
  if (destination !== base && !destination.startsWith(base + path.sep))
    throw new Error('Path escapes the project directory. Use a relative project path.');
  let current = base;
  const realBase = await fs.realpath(base);
  for (const part of path.relative(base, destination).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    try {
      const info = await fs.lstat(current);
      if (info.isSymbolicLink())
        throw new Error(`Symbolic links are not permitted in project paths: ${current}`);
      const real = await fs.realpath(current);
      if (real !== realBase && !real.startsWith(realBase + path.sep))
        throw new Error('Resolved path escapes the project directory.');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }
  return destination;
}
export async function readText(root: string, relative: string) {
  return fs.readFile(await safePath(root, relative), 'utf8');
}
export async function atomicWrite(root: string, relative: string, text: string) {
  const destination = await safePath(root, relative);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const temporary = destination + `.tmp-${crypto.randomUUID()}`;
  try {
    await fs.writeFile(temporary, text, { flag: 'wx' });
    await fs.rename(temporary, destination);
  } finally {
    await fs.rm(temporary, { force: true });
  }
}
export async function readProject(root: string = defaultProject): Promise<ProjectData> {
  root = path.resolve(root);
  const issues: Issue[] = [];
  const read = async <S extends z.ZodTypeAny>(
    file: string,
    schema: S,
    optional = false,
  ): Promise<z.output<S> | undefined> => {
    try {
      return schema.parse(JSON.parse(await readText(root, file)));
    } catch (error) {
      if (optional && (error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      issues.push({
        severity: 'error',
        code: 'SCHEMA',
        path: file,
        message: `Cannot load ${file}: ${error instanceof Error ? error.message : String(error)}. Correct the JSON and schemaVersion.`,
      });
      return undefined;
    }
  };
  const project = await read('vectorforge.project.json', projectSchema);
  if (!project)
    throw new Error(
      issues[0]?.message ?? `No VectorForge project at ${root}. Run vectorforge init.`,
    );
  const context =
    (await read('vectorforge.context.json', contextSchema, true)) ??
    contextSchema.parse({ schemaVersion: 1 });
  const directories = async (folder: string) => {
    try {
      return (await fs.readdir(await safePath(root, folder), { withFileTypes: true }))
        .filter((d) => d.isDirectory() || d.isSymbolicLink())
        .map((d) => d.name)
        .sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  };
  const files = async (folder: string) => {
    try {
      return (await fs.readdir(await safePath(root, folder)))
        .filter((f) => f.endsWith('.json'))
        .sort();
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw error;
    }
  };
  const data: ProjectData = {
    root,
    project,
    context,
    styles: [],
    assets: [],
    actors: [],
    animations: [],
    sequences: [],
    stateMachines: [],
    issues,
  };
  for (const folder of await directories('styles')) {
    const s = await read(`styles/${folder}/style.json`, styleSchema);
    if (s) {
      data.styles.push(s);
      if (s.id !== folder)
        issues.push({
          severity: 'error',
          code: 'ID_PATH',
          path: `styles/${folder}`,
          message: 'Style id must match its directory name.',
        });
    }
  }
  for (const kind of ['assets', 'actors'] as const)
    for (const folder of await directories(kind)) {
      const prefix = `${kind}/${folder}`,
        filename = kind === 'assets' ? 'asset' : 'actor';
      const metadata = await read(
        `${prefix}/${filename}.json`,
        kind === 'assets' ? assetSchema : actorSchema,
      );
      if (!metadata) continue;
      try {
        const svg = await readText(root, `${prefix}/${filename}.svg`);
        if (metadata.id !== folder)
          issues.push({
            severity: 'error',
            code: 'ID_PATH',
            path: prefix,
            message: 'Asset/actor id must match its directory name.',
          });
        if (kind === 'assets') data.assets.push({ metadata, svg, path: prefix });
        else {
          const rig = await read(`${prefix}/rig.json`, rigSchema);
          if (rig)
            data.actors.push({ metadata: actorSchema.parse(metadata), svg, rig, path: prefix });
        }
      } catch (error) {
        issues.push({
          severity: 'error',
          code: 'SVG_MISSING',
          path: prefix,
          message: `Cannot read SVG: ${String(error)}. Add ${filename}.svg.`,
        });
      }
    }
  for (const f of await files('animations')) {
    const a = await read(`animations/${f}`, animationSchema);
    if (a) {
      data.animations.push(a);
      if (f !== `${a.id}.json`)
        issues.push({
          severity: 'error',
          code: 'ID_PATH',
          path: `animations/${f}`,
          message: 'Animation filename must match its id.',
        });
    }
  }
  for (const f of await files('sequences')) {
    const s = await read(`sequences/${f}`, sequenceSchema);
    if (s) {
      data.sequences.push(s);
      if (f !== `${s.id}.json`)
        issues.push({
          severity: 'error',
          code: 'ID_PATH',
          path: `sequences/${f}`,
          message: 'Sequence filename must match its id.',
        });
    }
  }
  for (const f of await files('state-machines')) {
    const s = await read(`state-machines/${f}`, stateMachineSchema);
    if (s) {
      data.stateMachines.push(s);
      if (f !== `${s.id}.json`)
        issues.push({
          severity: 'error',
          code: 'ID_PATH',
          path: `state-machines/${f}`,
          message: 'State machine filename must match its id.',
        });
    }
  }
  data.issues.push(...validateProject(data));
  return data;
}
export function validateProject(data: ProjectData): Issue[] {
  const issues: Issue[] = [];
  const error = (code: string, file: string, message: string) =>
    issues.push({ severity: 'error', code, path: file, message });
  if (data.project.defaultStyle && !data.styles.some((s) => s.id === data.project.defaultStyle))
    error(
      'STYLE_MISSING',
      'vectorforge.project.json',
      `Default style ${data.project.defaultStyle} does not exist. Create it or change defaultStyle.`,
    );
  const entries = [...data.assets, ...data.actors];
  const collections = data.context.collections;
  const collectionIds = new Set<string>();
  for (const collection of collections) {
    if (collectionIds.has(collection.id))
      error(
        'COLLECTION_DUPLICATE',
        'vectorforge.context.json',
        `Collection ${collection.id} is already used.`,
      );
    collectionIds.add(collection.id);
    if (collection.parentId && !collections.some((c) => c.id === collection.parentId))
      error(
        'COLLECTION_PARENT',
        'vectorforge.context.json',
        `Collection ${collection.id} has a missing parent ${collection.parentId}.`,
      );
    const visited = new Set([collection.id]);
    let cursor = collection.parentId;
    while (cursor) {
      if (visited.has(cursor)) {
        error(
          'COLLECTION_CYCLE',
          'vectorforge.context.json',
          `Collection ${collection.id} contains a parent cycle.`,
        );
        break;
      }
      visited.add(cursor);
      cursor = collections.find((c) => c.id === cursor)?.parentId;
    }
  }
  const allIds = new Set<string>();
  for (const entry of entries) {
    const m = entry.metadata;
    if (allIds.has(m.id))
      error('ID_DUPLICATE', entry.path, `Asset/actor id ${m.id} is already used.`);
    allIds.add(m.id);
    if (m.collection && !collectionIds.has(m.collection))
      error(
        'COLLECTION_MISSING',
        entry.path,
        `Collection ${m.collection} does not exist. Create it or clear the collection field.`,
      );
    const style = data.styles.find((s) => s.id === m.style);
    if (!style) error('STYLE_MISSING', entry.path, `Style ${m.style} does not exist.`);
    const info = inspectSvg(
      entry.svg,
      `${entry.path}/${'rig' in entry ? 'actor' : 'asset'}.svg`,
      style,
      m,
    );
    issues.push(...info.issues);
    if (m.baseAsset) {
      const visited = new Set([m.id]);
      let cursor: string | undefined = m.baseAsset;
      while (cursor) {
        if (visited.has(cursor)) {
          error(
            'VARIANT_CYCLE',
            entry.path,
            'Variant base relationships contain a cycle. Remove a base link.',
          );
          break;
        }
        visited.add(cursor);
        cursor = entries.find((e) => e.metadata.id === cursor)?.metadata.baseAsset;
      }
      const base = entries.find((e) => e.metadata.id === m.baseAsset);
      if (!base || m.baseAsset === m.id)
        error(
          'VARIANT_BASE',
          entry.path,
          `Variant base ${m.baseAsset} must reference another existing asset.`,
        );
      else if (base.metadata.family !== m.family || base.metadata.style !== m.style)
        error('VARIANT_STYLE', entry.path, 'Variant must retain the base family and style.');
    }
    if (isActorEntry(entry)) {
      if (entry.rig.actorId !== m.id)
        error('RIG_ACTOR', `${entry.path}/rig.json`, 'Rig actorId must match actor metadata id.');
      const mapped = new Set<string>();
      for (const [id, node] of Object.entries(entry.rig.nodes)) {
        if (!info.ids.includes(node.svgId))
          error(
            'RIG_NODE',
            `${entry.path}/rig.json`,
            `Rig node ${id} references missing SVG id ${node.svgId}.`,
          );
        if (mapped.has(node.svgId))
          error(
            'RIG_DUPLICATE',
            `${entry.path}/rig.json`,
            `Multiple rig nodes map to SVG id ${node.svgId}. Use one mapping per element.`,
          );
        mapped.add(node.svgId);
        if (
          node.parent &&
          info.ancestors?.[entry.rig.nodes[node.parent]?.svgId]?.includes(node.svgId)
        )
          error(
            'RIG_SVG_HIERARCHY',
            `${entry.path}/rig.json`,
            `Node ${id} cannot parent an SVG ancestor under its own descendant. Align the rig and SVG hierarchy.`,
          );
      }
      try {
        hierarchyOrder(entry.rig);
      } catch (e) {
        error('RIG_HIERARCHY', `${entry.path}/rig.json`, String(e));
      }
      for (const clip of entry.metadata.clips)
        if (!data.animations.some((a) => a.id === clip && a.actorId === m.id))
          error(
            'ACTOR_CLIP',
            entry.path,
            `Actor clip ${clip} is missing or belongs to a different actor.`,
          );
      if (
        entry.metadata.stateMachine &&
        !data.stateMachines.some((s) => s.id === entry.metadata.stateMachine && s.actorId === m.id)
      )
        error(
          'ACTOR_MACHINE',
          entry.path,
          `State machine ${entry.metadata.stateMachine} is missing or belongs to another actor.`,
        );
    }
  }
  for (const clip of data.animations) {
    const file = `animations/${clip.id}.json`,
      actor = data.actors.find((a) => a.metadata.id === clip.actorId);
    if (!actor) error('ANIMATION_ACTOR', file, `Actor ${clip.actorId} does not exist.`);
    else
      for (const track of Object.keys(clip.tracks))
        if (!actor.rig.nodes[track.slice(0, track.indexOf('.'))])
          error('ANIMATION_NODE', file, `Track ${track} references a missing rig node.`);
  }
  for (const sequence of data.sequences) {
    const file = `sequences/${sequence.id}.json`,
      actor = data.actors.find((a) => a.metadata.id === sequence.actorId);
    if (!actor) error('SEQUENCE_ACTOR', file, `Actor ${sequence.actorId} does not exist.`);
    const inspect = (steps: Action[]) => {
      for (const step of steps) {
        if (step.action === 'parallel' || step.action === 'repeat') inspect(step.steps);
        else if (
          step.action === 'play' &&
          !data.animations.some((a) => a.id === step.clip && a.actorId === sequence.actorId)
        )
          error('SEQUENCE_CLIP', file, `Clip ${step.clip} is missing or belongs to another actor.`);
        else if (
          (step.action === 'moveTo' || step.action === 'rotateTo') &&
          !actor?.rig.nodes[step.target]
        )
          error('SEQUENCE_NODE', file, `Target node ${step.target} is missing.`);
      }
    };
    inspect(sequence.steps);
    try {
      compileSequence(sequence, data.animations);
    } catch (e) {
      error('SEQUENCE_COMPILE', file, String(e));
    }
  }
  for (const machine of data.stateMachines) {
    const file = `state-machines/${machine.id}.json`;
    if (!data.actors.some((a) => a.metadata.id === machine.actorId))
      error('STATE_ACTOR', file, `Actor ${machine.actorId} does not exist.`);
    if (!machine.states[machine.initial])
      error('STATE_INITIAL', file, `Initial state ${machine.initial} is missing.`);
    for (const [state, value] of Object.entries(machine.states)) {
      if (
        value.clip &&
        !data.animations.some((a) => a.id === value.clip && a.actorId === machine.actorId)
      )
        error(
          'STATE_CLIP',
          file,
          `State ${state} references missing/incompatible clip ${value.clip}.`,
        );
      for (const transition of value.transitions) {
        if (!machine.states[transition.to])
          error(
            'STATE_TARGET',
            file,
            `Transition from ${state} references missing state ${transition.to}.`,
          );
        if (!transition.event && !transition.condition && !transition.onComplete)
          error(
            'STATE_TRIGGER',
            file,
            `Transition from ${state} must define an event, condition or onComplete.`,
          );
      }
    }
  }
  return issues;
}
export function projectContext(data: ProjectData) {
  return {
    ...data.context,
    schemaVersion: 1,
    project: data.project,
    styles: data.styles,
    families: [
      ...new Set([...data.assets, ...data.actors].map((e) => e.metadata.family).filter(Boolean)),
    ],
    assets: data.assets.map((e) => e.metadata),
    actors: data.actors.map((e) => e.metadata),
    animations: data.animations.map((a) => ({
      id: a.id,
      actorId: a.actorId,
      duration: a.duration,
    })),
    sequences: data.sequences.map((s) => ({ id: s.id, actorId: s.actorId })),
    stateMachines: data.stateMachines,
    issues: data.issues,
  };
}
export type ResourceKind =
  | 'style'
  | 'asset'
  | 'actor'
  | 'rig'
  | 'animation'
  | 'sequence'
  | 'stateMachine'
  | 'project'
  | 'context';
const schemas = {
  style: styleSchema,
  asset: assetSchema,
  actor: actorSchema,
  rig: rigSchema,
  animation: animationSchema,
  sequence: sequenceSchema,
  stateMachine: stateMachineSchema,
  project: projectSchema,
  context: contextSchema,
};
export function resourceFile(kind: ResourceKind, id: string) {
  idSchema.parse(id);
  const paths: Record<ResourceKind, string> = {
    style: `styles/${id}/style.json`,
    asset: `assets/${id}/asset.json`,
    actor: `actors/${id}/actor.json`,
    rig: `actors/${id}/rig.json`,
    animation: `animations/${id}.json`,
    sequence: `sequences/${id}.json`,
    stateMachine: `state-machines/${id}.json`,
    project: 'vectorforge.project.json',
    context: 'vectorforge.context.json',
  };
  if (!paths[kind]) throw new Error(`Unknown resource kind ${kind}.`);
  return paths[kind];
}
export async function saveResource(
  root: string,
  kind: ResourceKind,
  input: unknown,
  options: { svg?: string; rig?: unknown; id?: string; overwrite?: boolean } = {},
) {
  const parsed = schemas[kind]?.parse(input);
  if (!parsed) throw new Error(`Unsupported resource kind ${kind}.`);
  const id =
    options.id ??
    ('id' in parsed ? String(parsed.id) : 'actorId' in parsed ? String(parsed.actorId) : 'project');
  idSchema.parse(id);
  if ('id' in parsed && parsed.id !== id)
    throw new Error('Resource id must match the requested id.');
  const data = await readProject(root);
  const before = new Set(
    data.issues.filter((i) => i.severity === 'error').map((i) => JSON.stringify(i)),
  );
  const file = resourceFile(kind, id);
  const writes: Record<string, string> = { [file]: JSON.stringify(parsed, null, 2) + '\n' };
  const exists = await fs.access(await safePath(root, file)).then(
    () => true,
    () => false,
  );
  if (exists && !options.overwrite)
    throw new Error(`Resource ${id} already exists. Use an explicit update or overwrite option.`);
  if (!exists && options.overwrite)
    throw new Error(`Resource ${id} does not exist. Create it before updating.`);
  if (kind === 'asset' || kind === 'actor') {
    const list = kind === 'asset' ? data.assets : data.actors;
    const old = list.find((e) => e.metadata.id === id);
    const svg = options.svg ?? old?.svg;
    if (!svg) throw new Error('SVG source is required for a new asset/actor.');
    assertSafeSvg(svg);
    const prefix = kind === 'asset' ? `assets/${id}` : `actors/${id}`;
    writes[`${prefix}/${kind}.svg`] = svg;
    if (kind === 'actor') {
      const rig = rigSchema.parse(options.rig ?? (old && isActorEntry(old) ? old.rig : undefined));
      writes[`${prefix}/rig.json`] = JSON.stringify(rig, null, 2) + '\n';
      data.actors = [
        ...data.actors.filter((e) => e.metadata.id !== id),
        { metadata: actorSchema.parse(parsed), svg, rig, path: prefix },
      ];
    } else
      data.assets = [
        ...data.assets.filter((e) => e.metadata.id !== id),
        { metadata: assetSchema.parse(parsed), svg, path: prefix },
      ];
  } else if (kind === 'rig') {
    const actor = data.actors.find((a) => a.metadata.id === id);
    if (!actor) throw new Error(`Actor ${id} does not exist.`);
    actor.rig = rigSchema.parse(parsed);
  } else if (kind === 'style')
    data.styles = [...data.styles.filter((s) => s.id !== id), styleSchema.parse(parsed)];
  else if (kind === 'animation')
    data.animations = [
      ...data.animations.filter((s) => s.id !== id),
      animationSchema.parse(parsed),
    ];
  else if (kind === 'sequence')
    data.sequences = [...data.sequences.filter((s) => s.id !== id), sequenceSchema.parse(parsed)];
  else if (kind === 'stateMachine')
    data.stateMachines = [
      ...data.stateMachines.filter((s) => s.id !== id),
      stateMachineSchema.parse(parsed),
    ];
  else if (kind === 'project') data.project = projectSchema.parse(parsed);
  else if (kind === 'context') data.context = contextSchema.parse(parsed);
  const errors = validateProject(data).filter(
    (i) => i.severity === 'error' && !before.has(JSON.stringify(i)),
  );
  if (errors.length) throw new Error(errors.map((i) => `${i.path}: ${i.message}`).join('\n'));
  // Roll back all touched files if any write fails; never leave a half-updated bundle.
  const backups = new Map<string, string | undefined>();
  try {
    for (const [file, content] of Object.entries(writes)) {
      backups.set(file, await readText(root, file).catch(() => undefined));
      await atomicWrite(root, file, content);
    }
  } catch (error) {
    for (const [file, content] of backups)
      if (content !== undefined) await atomicWrite(root, file, content);
      else await fs.rm(await safePath(root, file), { force: true });
    throw error;
  }
  return {
    id,
    files: Object.keys(writes),
    issues: validateProject(data).filter((i) => i.path.includes(id)),
  };
}
export async function createVariant(root: string, baseId: string, metadata: unknown, svg: string) {
  const data = await readProject(root),
    base = data.assets.find((a) => a.metadata.id === baseId);
  if (!base) throw new Error(`Base asset ${baseId} does not exist.`);
  const overrides = assetSchema.partial().parse(metadata);
  return saveResource(
    root,
    'asset',
    {
      ...base.metadata,
      ...overrides,
      family: base.metadata.family,
      style: base.metadata.style,
      baseAsset: baseId,
    },
    { svg },
  );
}
export async function initProject(destination: string, name = 'Untitled project') {
  await fs.mkdir(destination, { recursive: true });
  if (
    await fs.access(path.join(destination, 'vectorforge.project.json')).then(
      () => true,
      () => false,
    )
  )
    throw new Error('A VectorForge project already exists here.');
  for (const dir of [
    'styles',
    'assets',
    'actors',
    'animations',
    'sequences',
    'state-machines',
    'exports',
  ])
    await fs.mkdir(path.join(destination, dir), { recursive: true });
  await atomicWrite(
    destination,
    'vectorforge.project.json',
    JSON.stringify({ schemaVersion: 1, name }, null, 2) + '\n',
  );
  await atomicWrite(
    destination,
    'vectorforge.context.json',
    JSON.stringify(contextSchema.parse({ schemaVersion: 1 }), null, 2) + '\n',
  );
  return { root: path.resolve(destination), name };
}
