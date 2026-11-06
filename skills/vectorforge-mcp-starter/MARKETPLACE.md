# Agensi Marketplace Listing — VectorForge MCP Starter (FREE)

## Product Title

VectorForge MCP Starter — Local SVG Asset, Variant & Export Workflow

## Version Number

`1.0.0`

## Pricing

**FREE** ($0.00 — Open-Source MIT Starter Skill)

## Short Description

Connect your AI coding agent to VectorForge over MCP to inspect project style profiles, generate style-consistent static SVG assets and variants, validate SVG safety and palettes, capture PNG snapshots, and export portable Generic, Web, or Flutter bundles.

## Full Description

**VectorForge MCP Starter** turns your AI coding agent into a structured, style-aware 2D vector asset assistant powered by the open-source [VectorForge](https://github.com/Kaandonmez/vector-forge) pipeline and its official Model Context Protocol (MCP) stdio server.

Instead of generating isolated, inconsistent raw SVGs in chat, an agent equipped with **VectorForge MCP Starter** follows a disciplined 11-step engineering loop directly against your local project files:

1. Verifies the MCP server connection and bound project directory (`vectorforge_project_info`).
2. Reads project context, rules, naming conventions, and folder collections (`vectorforge_project_context`).
3. Loads your target `style.json` palette, prohibited colors, and stroke rules (`vectorforge_get_style`).
4. Inspects existing sibling SVGs (`vectorforge_get_asset`) to match proportions, silhouettes, and viewBox geometry.
5. Authors self-contained, XML-safe SVG and `schemaVersion: 1` metadata.
6. Writes new assets (`vectorforge_create_asset`) or family-inheriting variants (`vectorforge_create_variant`) with atomic rollback protection.
7. Validates schemas, cross-references, and objective style rules (`vectorforge_validate`).
8. Renders deterministic 800×640 PNG snapshots (`vectorforge_snapshot`) for visual inspection.
9. Evaluates the rendered PNG (when the agent supports vision) and repairs clipping or palette drift.
10. Exports portable asset bundles (`vectorforge_export`) for Generic, Web, or Flutter targets using safe dry-run preflight checks.

**Architectural Honesty:** VectorForge runs 100% locally with zero cloud accounts, zero telemetry, and no external API keys. VectorForge does not bundle a proprietary AI image model—your connected coding agent generates the SVG/JSON while VectorForge enforces project structure, validation, deterministic rendering, and safe exports.

## Key Features

- **Complete 11-Step Starter Workflow:** Covers context discovery, style inspection, sibling analysis, asset/variant creation, validation, snapshot rendering, and dry-run exports.
- **Official MCP Tool Mapping:** Aligned 1:1 with all `vectorforge_*` MCP tools (`project_context`, `get_style`, `create_asset`, `create_variant`, `validate`, `snapshot`, `export`).
- **Multi-Client Setup Guides:** Includes ready-to-use configurations for Claude Code, Cursor, VS Code / GitHub Copilot, and generic stdio MCP clients with strict per-project isolation.
- **Diagnostic Helper Script:** Includes `scripts/verify-mcp.mjs` to check Node.js compatibility, project initialization status, and MCP configuration.
- **Real Schema v1 Payloads:** Copy-pasteable JSON and SVG examples in `references/starter-examples.md`.

## Installation Instructions

1. Ensure **Node.js 22+** is installed.
2. Install or build [VectorForge](https://github.com/Kaandonmez/vector-forge) (`pnpm install && pnpm build`, or install from the `vectorforge` npm package/tarball).
3. Optional (for PNG snapshots): install Playwright Chromium via `npx playwright install chromium` (or `pnpm exec playwright install chromium`).
4. Extract `vectorforge-mcp-starter.zip` into your agent's skills directory (e.g., `.claude/skills/vectorforge-mcp-starter/` or `.cursor/skills/vectorforge-mcp-starter/`).
5. Configure the `vectorforge` MCP server in your client using the snippets in `references/client-setup.md`.

## Requirements

- **Runtime:** Node.js 22+ (macOS, Linux, or Windows)
- **MCP Server:** VectorForge v0.1.0+ local stdio MCP server
- **Optional Dependency:** Playwright Chromium (required only for `vectorforge_snapshot` PNG rendering; asset creation, validation, and export work without it)
- **Agent Compatibility:** Claude Code, Cursor, VS Code / GitHub Copilot, Codex CLI, or any Agent Skills (`SKILL.md`) + MCP-compatible client

## Example Use Cases

1. _"Create an SVG shield badge icon matching my project's `clean-ui` style profile."_
2. _"Generate a gold-tier variant of `badge-shield-base` using `vectorforge_create_variant`."_
3. _"Validate all vector assets in my project and fix any prohibited or off-palette colors."_
4. _"Capture a PNG snapshot of my new icon and verify there is no viewBox clipping."_
5. _"Run a dry-run Flutter export for my badge family, then write the export to `./exports/flutter`."_

## Frequently Asked Questions (FAQ)

- **Does VectorForge require an OpenAI/Anthropic API key inside the MCP server?**
  No. VectorForge is model-agnostic and runs locally. Your existing coding agent generates the SVG/JSON and calls VectorForge's local MCP tools.
- **Does Flutter export include a Dart or Flame animation runtime?**
  No. Flutter export packages portable SVGs, rig/animation JSON data, `vectorforge.manifest.json`, and a `pubspec-assets.yaml` snippet. Static SVGs can be rendered with any Flutter SVG package; motion JSON is portable data for your own renderer.
- **What is the difference between VectorForge MCP Starter (Free) and VectorForge Asset Production Pro (Paid)?**
  Starter (Free) focuses on onboarding, MCP setup, single-asset creation, simple sibling variants, validation, snapshots, and basic exports. Production Pro ($14.99) provides multi-asset family production systems, variant matrices, articulated character rigging, multi-clip animation & sequence choreography, state machines, multi-frame visual QA repair loops, and machine-readable production templates.

## Support Information

- **Documentation & Issue Tracker:** [https://github.com/Kaandonmez/vector-forge](https://github.com/Kaandonmez/vector-forge)
- **Diagnostics:** Run `vectorforge doctor --project <path>` or `node skills/vectorforge-mcp-starter/scripts/verify-mcp.mjs`.

## Changelog

### v1.0.0 (2026-11-06)

- Initial release of VectorForge MCP Starter (`SKILL.md`, `README.md`, `references/mcp-tools.md`, `references/client-setup.md`, `references/starter-examples.md`, and `scripts/verify-mcp.mjs`).
