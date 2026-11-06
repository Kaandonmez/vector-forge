# VectorForge MCP Tool & Schema Reference

All MCP tools exposed by the VectorForge server start with `vectorforge_`. Every JSON resource uses `schemaVersion: 1`. All durations and timestamps use **seconds**.

## 1. Discovery & Inspection Tools

| Tool Name                         | Arguments             | Description                                                                                                                                                                                            |
| :-------------------------------- | :-------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vectorforge_project_info`        | `{}`                  | Returns bound project `root`, `project` metadata, resource `counts`, and current validation `issues`.                                                                                                  |
| `vectorforge_project_context`     | `{}`                  | Returns complete machine-readable context: `project`, `rules`, `namingConventions`, `collections`, `styles`, `families`, `assets`, `actors`, `animations`, `sequences`, `stateMachines`, and `issues`. |
| `vectorforge_list_styles`         | `{ family?: string }` | Lists all style profiles in the project.                                                                                                                                                               |
| `vectorforge_list_assets`         | `{ family?: string }` | Lists static asset metadata, optionally filtered by `family`.                                                                                                                                          |
| `vectorforge_list_actors`         | `{ family?: string }` | Lists articulated actor metadata, optionally filtered by `family`.                                                                                                                                     |
| `vectorforge_list_animations`     | `{ family?: string }` | Lists animation clips.                                                                                                                                                                                 |
| `vectorforge_list_sequences`      | `{ family?: string }` | Lists deterministic sequences.                                                                                                                                                                         |
| `vectorforge_list_state_machines` | `{ family?: string }` | Lists state machines.                                                                                                                                                                                  |
| `vectorforge_get_style`           | `{ id: string }`      | Reads full `style.json` for `<id>`.                                                                                                                                                                    |
| `vectorforge_get_asset`           | `{ id: string }`      | Reads `{ metadata, svg, path }` for static asset `<id>`.                                                                                                                                               |
| `vectorforge_get_actor`           | `{ id: string }`      | Reads `{ metadata, svg, rig, path }` for actor `<id>`.                                                                                                                                                 |
| `vectorforge_get_animation`       | `{ id: string }`      | Reads animation clip `<id>`.                                                                                                                                                                           |
| `vectorforge_get_sequence`        | `{ id: string }`      | Reads sequence `<id>`.                                                                                                                                                                                 |
| `vectorforge_get_state_machine`   | `{ id: string }`      | Reads state machine `<id>`.                                                                                                                                                                            |

## 2. Authoring & Mutation Tools

All writes validate schemas, cross-references, and SVG safety before performing atomic file writes with automatic bundle rollback on failure.

| Tool Name                          | Arguments                                                   | Description                                                                                                         |
| :--------------------------------- | :---------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `vectorforge_init_project`         | `{ name?: string }`                                         | Initializes an empty directory as a portable VectorForge project (`vectorforge.project.json` + subfolders).         |
| `vectorforge_update_project`       | `{ data: ProjectJSON }`                                     | Updates `vectorforge.project.json` (`name`, `defaultStyle`, `description`).                                         |
| `vectorforge_update_context`       | `{ data: ContextJSON }`                                     | Updates `vectorforge.context.json` (`collections`, `rules`, `namingConventions`, `exportDestinations`).             |
| `vectorforge_create_style`         | `{ data: StyleJSON }`                                       | Creates `styles/<id>/style.json`. Rejects existing IDs.                                                             |
| `vectorforge_update_style`         | `{ data: StyleJSON }`                                       | Updates an existing style profile.                                                                                  |
| `vectorforge_create_asset`         | `{ data: AssetJSON, svg: string }`                          | Creates `assets/<id>/asset.json` and `asset.svg`. Rejects existing IDs.                                             |
| `vectorforge_update_asset`         | `{ data: AssetJSON, svg?: string }`                         | Updates metadata and/or SVG for an existing static asset.                                                           |
| `vectorforge_create_variant`       | `{ baseId: string, data: Partial<AssetJSON>, svg: string }` | Creates a new static asset variant inheriting `family`, `style`, dimensions, and `baseAsset: baseId` from `baseId`. |
| `vectorforge_create_actor`         | `{ data: ActorJSON, svg: string, rig: RigJSON }`            | Creates `actors/<id>/{actor.json, actor.svg, rig.json}`.                                                            |
| `vectorforge_update_actor`         | `{ data: ActorJSON, svg?: string, rig?: RigJSON }`          | Updates an existing actor's metadata, SVG, or rig.                                                                  |
| `vectorforge_update_rig`           | `{ actorId: string, data: RigJSON }`                        | Replaces `actors/<actorId>/rig.json` after checking SVG node IDs and hierarchy cycles.                              |
| `vectorforge_create_animation`     | `{ data: AnimationJSON }`                                   | Creates `animations/<id>.json`. Target actor and rig nodes must exist.                                              |
| `vectorforge_update_animation`     | `{ data: AnimationJSON }`                                   | Updates an existing animation clip.                                                                                 |
| `vectorforge_create_sequence`      | `{ data: SequenceJSON }`                                    | Creates `sequences/<id>.json`.                                                                                      |
| `vectorforge_update_sequence`      | `{ data: SequenceJSON }`                                    | Updates an existing sequence.                                                                                       |
| `vectorforge_create_state_machine` | `{ data: StateMachineJSON }`                                | Creates `state-machines/<id>.json`.                                                                                 |
| `vectorforge_update_state_machine` | `{ data: StateMachineJSON }`                                | Updates an existing state machine.                                                                                  |

## 3. Validation, Preview, Snapshot & Export Tools

| Tool Name                       | Arguments                                                                                                               | Description                                                                                                                                          |
| :------------------------------ | :---------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vectorforge_validate`          | `{}`                                                                                                                    | Validates all project resources and returns `{ valid: boolean, issues: Issue[] }`.                                                                   |
| `vectorforge_preview`           | `{ id?: string }`                                                                                                       | Starts the local Studio UI server on `127.0.0.1` and returns `{ url, project }`.                                                                     |
| `vectorforge_snapshot`          | `{ id: string, time?: number, clip?: string, sequence?: string, output?: string, overwrite?: boolean }`                 | Renders an asset, actor, clip, or sequence at `time` (seconds) to an `800x640` PNG and returns `{ path, width, height }` plus `image/png` content.   |
| `vectorforge_export`            | `{ destination: string, format?: "generic" \| "web" \| "flutter", id?: string, dryRun?: boolean, overwrite?: boolean }` | Plans (`dryRun: true`, default) or writes (`dryRun: false`) a portable export bundle. Includes dependencies (styles, base assets, actor clips/rigs). |
| `vectorforge_export_to_project` | Same as `vectorforge_export`                                                                                            | Alias for `vectorforge_export` when exporting directly into an external application directory.                                                       |

## 4. Common Validation Issue Codes

- `SCHEMA`: Malformed JSON or missing/unsupported `schemaVersion: 1`.
- `ID_PATH` / `ID_DUPLICATE`: Resource ID does not match folder/file name or collides with an existing asset/actor.
- `STYLE_MISSING`: Referenced `style` ID does not exist in `styles/`.
- `STYLE_PROHIBITED_COLOR`: SVG uses a color listed in the style's `prohibitedColors` (Error).
- `STYLE_PALETTE` / `STYLE_MAX_COLORS` / `STYLE_STROKE_*`: Objective style discrepancies (Warnings; review before finalizing).
- `SVG_UNSAFE` / `SVG_PARSE`: Disallowed tags (`<script>`, `<foreignObject>`, `<image>`, `<style>`), event handlers, external references, or malformed XML.
- `SVG_DIMENSIONS`: `<svg>` root `width`, `height`, or `viewBox` does not match metadata `width`, `height`, or `viewBox`.
- `SVG_ID_DUPLICATE` / `SVG_REF_MISSING`: Duplicate `id` attribute or broken `url(#...)` reference inside SVG.
- `VARIANT_BASE` / `VARIANT_STYLE` / `VARIANT_CYCLE`: Invalid `baseAsset` reference or mismatched family/style on a variant.
