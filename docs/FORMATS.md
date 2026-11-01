# Portable format v1

The Zod schemas in `packages/schema/src/index.ts` are authoritative. Every canonical JSON resource has `schemaVersion: 1`; SVG remains native XML. IDs begin with a letter and contain letters, numbers, `_` or `-`. They must match directory names or JSON basenames. No executable condition or script data is allowed.

## Project and context

`vectorforge.project.json` has `name`, optional `description` and `defaultStyle`. `vectorforge.context.json` has `rules`, `namingConventions` and `exportDestinations`; extensible fields can include art direction, family display labels, preferred previews or project-specific conventions. MCP context merges these authored fields with a fresh inventory from disk. No stale derived inventory is used as source of truth.

Context also supports optional `collections`, defaulting to `[]`. Each folder has an `id`, a nonempty `name` and an optional `parentId` referencing another collection. IDs must be unique, parents must exist, and parent cycles are rejected. Asset and actor metadata can set `collection` to an existing folder ID; omitted assignments use the metadata category for Studio grouping. These logical folders do not change source paths. Generic, web and Flutter exports retain collections and assignments. Existing schemaVersion 1 projects need no migration. See [project organization](PROJECTS.md).

## Styles and assets

`styles/<id>/style.json`: `id`, `name`, `palette`, optional `prohibitedColors`, `maxColors`, `stroke`, `geometry`, `lighting`, `perspective`, `motion`, `guidance` and `references`. Profiles accept additional fields. `palette.json` and README/reference folders may supplement the profile; style.json's palette is the authoritative validation palette.

`assets/<id>/asset.json`: `id`, `name`, `style`, `width`, `height`, `viewBox` and optional `category`, `collection`, `tags`, `family`, `baseAsset`, `variant`, `generationNotes`, `source`. SVG root dimensions and viewBox must match metadata. `baseAsset` must exist and share family and style. A stylistically different equivalent belongs to a separate family/profile instead of pretending to be an inheriting variant.

## Actors and rigs

Actors use the same metadata plus optional `clips` and `stateMachine`. `actor.svg` has stable IDs. `rig.json`:

```json
{
  "schemaVersion": 1,
  "actorId": "object",
  "nodes": {
    "body": { "svgId": "body", "pivot": [0.5, 0.5] },
    "arm": { "svgId": "arm", "parent": "body", "pivot": [0.1, 0.2] }
  }
}
```

Pivots default to normalized bounding-box coordinates. `pivotSpace: "absolute"` interprets the pair as user coordinates in the element's authored local space. Existing element transforms are retained. Parent transforms propagate through nested SVG wrapper groups. When a logical rig parent differs from SVG nesting, the renderer preserves the authored world transform during reparenting. Keep logical and SVG hierarchies aligned where possible; inverted ancestor relationships are invalid.

Rig nodes map to one distinct SVG element each. The renderer uses DOM transforms; static SVGs do not need a rig.

## Clips

```json
{
  "schemaVersion": 1,
  "id": "sway",
  "actorId": "object",
  "duration": 2,
  "loop": true,
  "tracks": {
    "arm.rotation": [
      { "time": 0, "value": 0 },
      { "time": 1, "value": -12, "easing": "easeInOutCubic" },
      { "time": 2, "value": 0, "easing": "easeInOutCubic" }
    ]
  }
}
```

Seconds for time; degrees for rotation; SVG user units for position; scalar scale and 0–1 opacity. Tracks also support `fill` and `stroke` with six-digit hex colors. Frames must strictly increase and stay within duration. Values clamp before the first/after the last keyframe. An easing belongs to the destination frame. Looped snapshots can seek the final nonwrapped endpoint; Studio's playback controller handles time wrapping separately from pose evaluation.

## Sequences

Every sequence has `id`, `name`, `actorId`, `steps` and optional `loop`.

| Action   | Fields                                                                          |
| -------- | ------------------------------------------------------------------------------- |
| play     | `clip`, optional `duration` override (looping clips repeat during the override) |
| wait     | `duration`                                                                      |
| moveTo   | `target` rig node, `x`, `y`, `duration`, optional `easing`                      |
| rotateTo | `target` rig node, `rotation`, `duration`, optional `easing`                    |
| parallel | `steps` (children start together; group lasts as long as its longest child)     |
| repeat   | `count` (1–100), `steps`                                                        |

All durations are **seconds**, including sequence durations. Sequence expansion is limited to 10,000 actions. Completed actions hold their last values; later steps overwrite only their own properties. Motion is deterministic for arbitrary seek time. Parallel conflicts use declared action order; choose disjoint properties for intentional composition. Reset tracks explicitly to return to a neutral pose.

## State machines

`state-machines/<id>.json` contains `actorId`, `initial` and `states`. Each state has an optional `clip` and `transitions`. A transition has `to` plus `event`, named `condition` or `onComplete`. Pass condition values as a boolean map to `Machine.transition`; no arbitrary code is evaluated. The first matching declared transition wins.
