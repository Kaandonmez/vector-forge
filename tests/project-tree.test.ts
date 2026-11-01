import { describe, expect, it } from 'vitest';
import { readProject, defaultProject, validateProject } from '../packages/core/src/index.ts';
import { contextSchema } from '../packages/schema/src/index.ts';
import {
  buildProjectTree,
  collectionKey,
  entityFolder,
  filterTree,
  folderBreadcrumbs,
  folderEntities,
  type TreeNode,
} from '../apps/studio/src/project-tree.ts';

function flatten(node: TreeNode): TreeNode[] {
  return [node, ...(node.children ?? []).flatMap(flatten)];
}
describe('project hierarchy', () => {
  it('opens legacy projects without migration and shows every static and animated asset once', async () => {
    const data = await readProject(defaultProject),
      nodes = flatten(buildProjectTree(data));
    expect(contextSchema.parse({ schemaVersion: 1 }).collections).toEqual([]);
    expect(
      nodes
        .filter((n) => n.kind === 'asset' || n.kind === 'actor')
        .map((n) => n.target)
        .sort(),
    ).toEqual([...data.assets, ...data.actors].map((e) => e.metadata.id).sort());
    expect(folderEntities(data)).toHaveLength(data.assets.length + data.actors.length);
    expect(entityFolder(data, data.actors[0])).toBe(`category:${data.actors[0].metadata.category}`);
  });
  it('keeps variants, actual rig parents, clips, sequences and states under their owning asset', async () => {
    const data = await readProject(defaultProject),
      nodes = flatten(buildProjectTree(data));
    const phone = nodes.find((n) => n.target === 'phone-single-camera')!;
    expect(flatten(phone).map((n) => n.target)).toContain('phone-triple-camera');
    const plant = nodes.find((n) => n.key === 'entity:studio-plant')!;
    const rig = flatten(plant).find((n) => n.key === 'rig:studio-plant:stem')!;
    expect(rig.children?.map((n) => n.target)).toContain('leafLeft');
    const maker = nodes.find((n) => n.key === 'entity:studio-maker')!;
    expect(flatten(maker).filter((n) => n.kind === 'animation')).toHaveLength(8);
    expect(flatten(maker).find((n) => n.kind === 'machine')?.target).toBe('maker-states');
    expect(nodes.find((n) => n.key === 'sequence:idea-to-board')?.owner).toBe('demo-scene');
  });
  it('collects nested project folders without separating static and animated assets', async () => {
    const data = await readProject(defaultProject);
    data.context.collections = [
      { id: 'game', name: 'My game' },
      { id: 'hero', name: 'Hero', parentId: 'game' },
    ];
    data.assets[0].metadata.collection = 'hero';
    data.actors[0].metadata.collection = 'game';
    expect(folderEntities(data, collectionKey('game'))).toHaveLength(2);
    expect(folderEntities(data, collectionKey('hero'))).toHaveLength(1);
    expect(folderBreadcrumbs(data, collectionKey('hero')).map((f) => f.name)).toEqual([
      'My game',
      'Hero',
    ]);
    expect(
      flatten(buildProjectTree(data)).filter((n) => n.kind === 'asset' || n.kind === 'actor'),
    ).toHaveLength(11);
    expect(validateProject(data)).toEqual([]);
  });
  it('finds a nested motion while preserving its project and asset ancestry', async () => {
    const data = await readProject(defaultProject),
      tree = filterTree([buildProjectTree(data)], 'gentle-sway');
    expect(tree[0].kind).toBe('project');
    const nodes = tree.flatMap(flatten);
    expect(nodes.map((n) => n.key)).toContain('entity:studio-plant');
    expect(nodes.map((n) => n.key)).toContain('animation:gentle-sway');
    expect(nodes.some((n) => n.key === 'entity:studio-maker')).toBe(false);
  });
  it('reports missing folders, duplicates and parent cycles without hanging', async () => {
    const data = await readProject(defaultProject);
    data.context.collections = [
      { id: 'a', name: 'A', parentId: 'b' },
      { id: 'b', name: 'B', parentId: 'a' },
      { id: 'a', name: 'Duplicate' },
      { id: 'lost', name: 'Lost', parentId: 'missing' },
    ];
    data.assets[0].metadata.collection = 'missing';
    expect(validateProject(data).map((i) => i.code)).toEqual(
      expect.arrayContaining([
        'COLLECTION_CYCLE',
        'COLLECTION_DUPLICATE',
        'COLLECTION_PARENT',
        'COLLECTION_MISSING',
      ]),
    );
    expect(folderEntities(data, collectionKey('a'))).toEqual([]);
    expect(folderBreadcrumbs(data, collectionKey('a')).length).toBeLessThanOrEqual(2);
  });
});
