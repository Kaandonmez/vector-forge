import type { ActorEntry, AssetEntry, ProjectData } from '../../../packages/schema/src/index.ts';

export type Entity = AssetEntry | ActorEntry;
export type ProjectFolder = { key: string; name: string; parent?: string; authoredId?: string };
export type TreeNode = {
  key: string;
  label: string;
  kind:
    | 'project'
    | 'folder'
    | 'asset'
    | 'actor'
    | 'group'
    | 'rig'
    | 'animation'
    | 'sequence'
    | 'machine'
    | 'style'
    | 'styles';
  target?: string;
  folder?: string;
  family?: string;
  owner?: string;
  count?: number;
  children?: TreeNode[];
};

export const allFolder = 'all';
export const collectionKey = (id: string) => `collection:${id}`;
const categoryKey = (category: string) => `category:${category}`;
export function entityFolder(data: ProjectData, entry: Entity): string {
  return entry.metadata.collection &&
    data.context.collections.some((c) => c.id === entry.metadata.collection)
    ? collectionKey(entry.metadata.collection)
    : categoryKey(entry.metadata.category);
}
export function projectFolders(data: ProjectData): ProjectFolder[] {
  const authored = data.context.collections.map((c) => ({
    key: collectionKey(c.id),
    name: c.name,
    parent: c.parentId ? collectionKey(c.parentId) : undefined,
    authoredId: c.id,
  }));
  const categories = [
    ...new Set(
      [...data.assets, ...data.actors]
        .filter(
          (e) =>
            !e.metadata.collection ||
            !data.context.collections.some((c) => c.id === e.metadata.collection),
        )
        .map((e) => e.metadata.category),
    ),
  ].sort();
  return [
    ...authored,
    ...categories.map((category) => ({ key: categoryKey(category), name: category })),
  ];
}
export function folderKeys(data: ProjectData, key: string): Set<string> {
  const folders = projectFolders(data);
  const found = new Set([key]);
  for (let changed = true; changed;) {
    changed = false;
    for (const folder of folders)
      if (folder.parent && found.has(folder.parent) && !found.has(folder.key)) {
        found.add(folder.key);
        changed = true;
      }
  }
  return found;
}
export function folderEntities(data: ProjectData, key = allFolder): Entity[] {
  const entries = [...data.assets, ...data.actors];
  if (key === allFolder) return entries;
  const included = folderKeys(data, key);
  return entries.filter((e) => included.has(entityFolder(data, e)));
}
export function folderBreadcrumbs(data: ProjectData, key: string): ProjectFolder[] {
  const folders = projectFolders(data),
    result: ProjectFolder[] = [],
    visited = new Set<string>();
  let cursor = folders.find((f) => f.key === key);
  while (cursor && !visited.has(cursor.key)) {
    result.unshift(cursor);
    visited.add(cursor.key);
    cursor = folders.find((f) => f.key === cursor?.parent);
  }
  return result;
}
export function buildProjectTree(data: ProjectData): TreeNode {
  const entries = [...data.assets, ...data.actors],
    folders = projectFolders(data);
  const makeEntity = (entry: Entity, siblings: Entity[], visited = new Set<string>()): TreeNode => {
    const id = entry.metadata.id,
      children: TreeNode[] = [],
      folder = entityFolder(data, entry);
    visited = new Set([...visited, id]);
    const variants = siblings.filter(
      (e) => e.metadata.baseAsset === id && !visited.has(e.metadata.id),
    );
    if (variants.length)
      children.push({
        key: `variants:${id}`,
        label: 'Variants',
        kind: 'group',
        count: variants.length,
        children: variants.map((e) => makeEntity(e, siblings, visited)),
      });
    if ('rig' in entry) {
      const rigNode = (nodeId: string, seen = new Set<string>()): TreeNode => ({
        key: `rig:${id}:${nodeId}`,
        label: nodeId,
        kind: 'rig',
        target: nodeId,
        owner: id,
        folder,
        children: Object.entries(entry.rig.nodes)
          .filter(([child, n]) => n.parent === nodeId && !seen.has(child) && child !== nodeId)
          .map(([child]) => rigNode(child, new Set([...seen, nodeId]))),
      });
      children.push({
        key: `rig:${id}`,
        label: 'Parts & rig',
        kind: 'group',
        count: Object.keys(entry.rig.nodes).length,
        children: Object.entries(entry.rig.nodes)
          .filter(([, n]) => !n.parent || !entry.rig.nodes[n.parent])
          .map(([nodeId]) => rigNode(nodeId)),
      });
      const clips = data.animations.filter((a) => a.actorId === id);
      if (clips.length)
        children.push({
          key: `animations:${id}`,
          label: 'Animations',
          kind: 'group',
          count: clips.length,
          children: clips.map((a) => ({
            key: `animation:${a.id}`,
            label: a.name ?? a.id,
            kind: 'animation',
            target: a.id,
            owner: id,
            folder,
          })),
        });
      const sequences = data.sequences.filter((s) => s.actorId === id);
      if (sequences.length)
        children.push({
          key: `sequences:${id}`,
          label: 'Sequences',
          kind: 'group',
          count: sequences.length,
          children: sequences.map((s) => ({
            key: `sequence:${s.id}`,
            label: s.name,
            kind: 'sequence',
            target: s.id,
            owner: id,
            folder,
          })),
        });
      children.push(
        ...data.stateMachines
          .filter((s) => s.actorId === id)
          .map((s): TreeNode => ({
            key: `machine:${s.id}`,
            label: s.id,
            kind: 'machine',
            target: s.id,
            owner: id,
            folder,
          })),
      );
    }
    return {
      key: `entity:${id}`,
      label: entry.metadata.name,
      kind: 'rig' in entry ? 'actor' : 'asset',
      target: id,
      folder,
      children,
    };
  };
  const makeFolder = (folder: ProjectFolder, visited = new Set<string>()): TreeNode => {
    const members = entries.filter((e) => entityFolder(data, e) === folder.key);
    const roots = members.filter(
      (e) => !members.some((base) => base.metadata.id === e.metadata.baseAsset),
    );
    // Invalid relationships remain inspectable in the tree so validation can guide repairs.
    const visible = roots.length ? roots : members;
    const labels = data.context.familyLabels as Record<string, string> | undefined;
    const families = [
      ...new Set(visible.map((e) => e.metadata.family).filter((f): f is string => !!f)),
    ];
    const children: TreeNode[] = [
      ...folders
        .filter((f) => f.parent === folder.key && !visited.has(f.key) && f.key !== folder.key)
        .map((f) => makeFolder(f, new Set([...visited, folder.key]))),
      ...families.map((family): TreeNode => ({
        key: `family:${folder.key}:${family}`,
        label: labels?.[family] ?? family.replaceAll('-', ' '),
        kind: 'folder',
        folder: folder.key,
        family,
        count: members.filter((e) => e.metadata.family === family).length,
        children: visible
          .filter((e) => e.metadata.family === family)
          .map((e) => makeEntity(e, members)),
      })),
      ...visible.filter((e) => !e.metadata.family).map((e) => makeEntity(e, members)),
    ];
    return {
      key: folder.key,
      label: folder.name,
      kind: 'folder',
      folder: folder.key,
      count: folderEntities(data, folder.key).length,
      children,
    };
  };
  return {
    key: 'project',
    label: data.project.name,
    kind: 'project',
    folder: allFolder,
    count: entries.length,
    children: [
      ...folders
        .filter((f) => !f.parent || !folders.some((p) => p.key === f.parent))
        .map((f) => makeFolder(f)),
      {
        key: 'styles',
        label: 'Styles',
        kind: 'styles',
        count: data.styles.length,
        children: data.styles.map((s) => ({
          key: `style:${s.id}`,
          label: s.name,
          kind: 'style',
          target: s.id,
        })),
      },
    ],
  };
}
export function filterTree(nodes: TreeNode[], query: string): TreeNode[] {
  const term = query.trim().toLowerCase();
  if (!term) return nodes;
  return nodes.flatMap((node) => {
    if (`${node.label} ${node.target ?? ''}`.toLowerCase().includes(term)) return [node];
    const children = filterTree(node.children ?? [], term);
    return children.length ? [{ ...node, children }] : [];
  });
}
