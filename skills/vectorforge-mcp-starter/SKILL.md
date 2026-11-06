---
name: vectorforge-mcp-starter
description: Connect to a local VectorForge MCP server to inspect project art direction, generate style-consistent static SVG assets and sibling variants, validate SVG safety and schema rules, capture deterministic PNG snapshots for visual review, and export portable Generic, Web, or Flutter asset bundles. Use when the user asks to create an SVG icon or illustration matching their existing style, generate a variant of an existing asset, validate vector assets, preview or snapshot a generated SVG, or export VectorForge assets.
license: MIT
compatibility: Requires Node.js 22+ and a local VectorForge MCP server connection (stdio). Optional Playwright Chromium for PNG snapshot rendering.
metadata:
  author: kaandonmez
  version: '1.0.0'
---

# VectorForge MCP Starter Skill

You are operating with **VectorForge**, a local-first 2D SVG asset and motion pipeline connected over the Model Context Protocol (MCP).

> **Important Architectural Boundary:**
> VectorForge is **not** an external AI image-generation model and requires no cloud API keys. **You (the connected coding/multimodal agent)** author the XML SVG markup and resource JSON using your own reasoning capabilities. **VectorForge** provides shared project context, objective style/schema/SVG validation, deterministic DOM rendering, headless PNG snapshots, and safe multi-target exports (`generic`, `web`, `flutter`).

---

## When to Trigger This Skill

Activate this workflow whenever the user asks to:

- _"Create an SVG icon matching my existing style."_
- _"Generate a new variant of this game object or device."_
- _"Validate my vector assets and fix any schema or palette issues."_
- _"Preview the SVG you generated or take a PNG snapshot."_
- _"Export these assets for my Flutter app or web project."_
- _"Set up or verify my VectorForge MCP connection."_

Do **not** merely explain CLI commands when MCP tools (`vectorforge_*`) are available in your toolset—execute the workflow directly using the MCP tools.

---

## Mandatory 11-Step Execution Workflow

Follow these steps in order for every asset creation, variant, validation, or export request. Never skip context discovery or validation before exporting.

### Step 1 — Verify MCP Connection & Project Target

1. Call `vectorforge_project_info` to confirm the MCP server is reachable and check which local project directory (`root`) is bound to this session. (If the directory is empty and not yet initialized, call `vectorforge_init_project` first.)
2. Verify `root` matches the user's intended project directory so you never write assets into the wrong project.
3. If the `vectorforge_*` tools are not loaded in the current session, consult [references/client-setup.md](references/client-setup.md) or run `node skills/vectorforge-mcp-starter/scripts/verify-mcp.mjs` to help the user configure their client.

### Step 2 — Read Project Context

1. Call `vectorforge_project_context` to load:
   - `project`: project name and `defaultStyle`.
   - `rules` and `namingConventions` (default `lowercase-kebab-case`).
   - `collections`: logical project folders (`id`, `name`, `parentId`).
   - `styles`, `families`, existing `assets`, `actors`, and current validation `issues`.
2. Respect existing `collections`: if the user specifies a folder, set `collection` in asset metadata to that folder's `id`.

### Step 3 — Inspect the Active Style Profile

1. Call `vectorforge_get_style` with `id` set to the target style (or `project.defaultStyle`).
2. Extract objective constraints before authoring any SVG:
   - `palette`: approved hex colors (`#RRGGBB`). Use colors from this palette.
   - `prohibitedColors`: colors that trigger validation errors (`STYLE_PROHIBITED_COLOR`). Never use these.
   - `maxColors`: maximum distinct colors permitted in a single SVG.
   - `stroke`: `enabled`, `width`, `maxWidth`, and allowed stroke `colors`.
   - `geometry`, `lighting`, `perspective`, and written `guidance`.

### Step 4 — Inspect Sibling Assets & Family Structure

1. If extending an existing family or matching nearby assets, call `vectorforge_list_assets` (optionally with `family: "<family-id>"`).
2. Call `vectorforge_get_asset` on **at least 1–2 existing sibling assets** in that family or style.
3. Study their actual `svg` source and `metadata`:
   - Root `width`, `height`, and `viewBox` (`[minX, minY, width, height]`).
   - Silhouette proportions, padding/margins, corner radii, shadow placement, and semantic `<g id="...">` grouping.

### Step 5 — Author Self-Contained SVG & Metadata

Construct valid, self-contained SVG XML and `schemaVersion: 1` JSON metadata:

- **ID rules**: Must start with a letter and contain only letters, numbers, hyphens, or underscores (`^[a-zA-Z][a-zA-Z0-9_-]*$`).
- **Dimension alignment**: Root `<svg xmlns="http://www.w3.org/2000/svg" width="W" height="H" viewBox="0 0 W H">` attributes **must exactly match** metadata `width`, `height`, and `viewBox: [0, 0, W, H]`.
- **Self-contained & safe XML**:
  - No `<script>`, `<foreignObject>`, `<image>`, `<style>`, external URLs (`http://`, `https://`), `data:` URIs, event attributes (`onload`, `onclick`), or `<!DOCTYPE>` / `<!ENTITY>`.
  - Every `id="..."` attribute inside the SVG must be unique (`SVG_ID_DUPLICATE` is an error).
  - Every internal `url(#id)` or `href="#id"` reference must resolve to an existing element ID inside the same SVG.
  - Use 6-digit hex colors (`#RRGGBB`) from the style profile palette.

### Step 6 — Create or Update the Asset or Variant via MCP

Choose the exact MCP tool for your operation:

- **New standalone or base asset**: Call `vectorforge_create_asset` with `{ data: <metadata>, svg: "<svg ...>...</svg>" }`.
- **New sibling variant of an existing base asset**: Call `vectorforge_create_variant` with `{ baseId: "<existing-asset-id>", data: { id: "<new-id>", name: "<Name>", variant: "<variant-label>", generationNotes: "..." }, svg: "<svg ...>...</svg>" }`.
  - `vectorforge_create_variant` automatically inherits `family`, `style`, `width`, `height`, `viewBox`, and sets `baseAsset: baseId`.
- **Updating an existing asset**: Call `vectorforge_update_asset` with `{ data: <metadata>, svg: "<svg ...>...</svg>" }`.
  - Never overwrite an unrelated existing asset unless the user explicitly asked to update that ID.

### Step 7 — Run Project Validation

1. Call `vectorforge_validate`.
2. Inspect `valid` (`boolean`) and every entry in `issues` (`severity: "error" | "warning"`, `code`, `path`, `message`).
3. **All `error` findings must be resolved.** Review `warning` findings (such as off-palette colors or stroke width discrepancies) and fix them unless intentionally requested by the user.

### Step 8 — Capture a Deterministic PNG Snapshot

1. Call `vectorforge_snapshot` with `{ id: "<asset-id>", overwrite: true }`.
2. If Playwright Chromium is not installed, `vectorforge_snapshot` returns an actionable message instructing to run `npx playwright install chromium` (or `pnpm exec playwright install chromium`). Report this clearly if snapshots cannot run.

### Step 9 — Visually Inspect the Snapshot (When Multimodal Vision Is Available)

1. `vectorforge_snapshot` returns both the saved PNG file path and base64 `image/png` content in the MCP tool response.
2. If you have image inspection / vision capabilities, inspect the rendered PNG for:
   - Clipped edges or elements overflowing the `viewBox`.
   - Unintended element overlap, illegible contrast, or broken symmetry.
   - Consistency with sibling assets in the same family.
3. **Honesty Rule**: Never claim _"visual QA passed"_ if `vectorforge_snapshot` was skipped or if you cannot inspect image outputs; state clearly whether verification was structural (`vectorforge_validate`) or visual (`vectorforge_snapshot` + image inspection).

### Step 10 — Repair & Re-Validate If Needed

1. If Step 7 (Validation) or Step 9 (Visual Inspection) revealed issues, call `vectorforge_update_asset` with the corrected SVG/metadata.
2. Re-run `vectorforge_validate` and `vectorforge_snapshot` (`overwrite: true`) until `valid: true` and the visual render is clean.

### Step 11 — Export Portable Assets (When Requested)

When the user asks to export an asset or the full library:

1. **Always dry-run first**: Call `vectorforge_export` with `{ destination: "<target-dir>", id: "<optional-asset-id>", format: "generic" | "web" | "flutter", dryRun: true, overwrite: false }`.
2. Inspect `files` and `conflicts` in the returned plan.
3. If `conflicts` is empty (or the user explicitly approved overwriting existing export files), call `vectorforge_export` with `dryRun: false` (and `overwrite: true` only when approved).
4. Note platform boundaries accurately:
   - `generic`: Portable SVGs, metadata, styles, and `vectorforge.manifest.json` (reopenable as a VectorForge project).
   - `web`: Generic files plus a zero-dependency ES module runtime (`vectorforge-runtime.js`) and `index.html` preview.
   - `flutter`: `assets/vectorforge/...` bundle, manifest, and `pubspec-assets.yaml` snippet. (Note: Flutter export packages portable SVG and JSON data; it does not include a Dart/Flame animation runtime.)

---

## Reference Files in This Skill

- [references/mcp-tools.md](references/mcp-tools.md) — Complete tool reference, input schemas, and validation error codes.
- [references/client-setup.md](references/client-setup.md) — MCP setup for Claude Code, Cursor, VS Code / GitHub Copilot, and generic clients.
- [references/starter-examples.md](references/starter-examples.md) — End-to-end JSON and SVG payload examples for styles, assets, variants, snapshots, and exports.
