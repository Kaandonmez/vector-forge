import type { ProjectData } from '../../../schema/src/index.ts';
export type ExportFiles = Record<string, string>;
export function genericFiles(data: ProjectData, selected?: string): ExportFiles {
  const files: ExportFiles = {};
  const json = (name: string, value: unknown) => {
    files[name] = JSON.stringify(value, null, 2) + '\n';
  };
  const selectedClip = data.animations.find((a) => a.id === selected),
    selectedSequence = data.sequences.find((s) => s.id === selected);
  const actors = data.actors.filter(
    (a) =>
      !selected ||
      a.metadata.id === selected ||
      a.metadata.id === selectedClip?.actorId ||
      a.metadata.id === selectedSequence?.actorId,
  );
  const assets = data.assets.filter((a) => !selected || a.metadata.id === selected);
  if (selected && !actors.length && !assets.length)
    throw new Error(`No exportable asset, actor, animation or sequence named ${selected}.`);
  // Include a variant's full base chain so its portable metadata never dangles.
  for (let i = 0; i < assets.length; i++) {
    const base = data.assets.find((a) => a.metadata.id === assets[i].metadata.baseAsset);
    if (base && !assets.includes(base)) assets.push(base);
  }
  const actorIds = new Set(actors.map((a) => a.metadata.id));
  const styleIds = new Set([...actors, ...assets].map((a) => a.metadata.style));
  const styles = data.styles.filter((s) => !selected || styleIds.has(s.id));
  const animations = data.animations.filter((a) => !selected || actorIds.has(a.actorId));
  const sequences = data.sequences.filter((s) => !selected || actorIds.has(s.actorId));
  const machines = data.stateMachines.filter((s) => !selected || actorIds.has(s.actorId));
  for (const asset of assets) {
    files[`assets/${asset.metadata.id}/asset.svg`] = asset.svg;
    json(`assets/${asset.metadata.id}/asset.json`, asset.metadata);
  }
  for (const actor of actors) {
    files[`actors/${actor.metadata.id}/actor.svg`] = actor.svg;
    json(`actors/${actor.metadata.id}/actor.json`, actor.metadata);
    json(`actors/${actor.metadata.id}/rig.json`, actor.rig);
  }
  for (const style of styles) json(`styles/${style.id}/style.json`, style);
  for (const animation of animations) json(`animations/${animation.id}.json`, animation);
  for (const sequence of sequences) json(`sequences/${sequence.id}.json`, sequence);
  for (const machine of machines) json(`state-machines/${machine.id}.json`, machine);
  json('vectorforge.project.json', {
    ...data.project,
    defaultStyle: styles.some((s) => s.id === data.project.defaultStyle)
      ? data.project.defaultStyle
      : styles[0]?.id,
  });
  json('vectorforge.context.json', data.context);
  json('vectorforge.manifest.json', {
    schemaVersion: 1,
    format: 'generic',
    project: data.project.name,
    assets: assets.map((a) => ({
      ...a.metadata,
      svg: `assets/${a.metadata.id}/asset.svg`,
      metadata: `assets/${a.metadata.id}/asset.json`,
    })),
    actors: actors.map((a) => ({
      ...a.metadata,
      svg: `actors/${a.metadata.id}/actor.svg`,
      rig: `actors/${a.metadata.id}/rig.json`,
      metadata: `actors/${a.metadata.id}/actor.json`,
    })),
    styles: styles.map((s) => s.id),
    animations: animations.map((a) => a.id),
    sequences: sequences.map((s) => s.id),
    stateMachines: machines.map((s) => s.id),
  });
  return files;
}
