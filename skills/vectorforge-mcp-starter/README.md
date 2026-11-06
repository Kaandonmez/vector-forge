# VectorForge MCP Starter (Free Agent Skill)

**VectorForge MCP Starter** is an open-source Agent Skill (`SKILL.md` standard) that teaches coding agents (Claude Code, Cursor, VS Code / GitHub Copilot, Codex CLI, and any MCP-compatible assistant) how to connect to a local **VectorForge** MCP server, inspect your project's art direction, generate style-consistent static SVG assets and variants, validate SVG safety and schema rules, capture deterministic PNG snapshots, and export portable asset bundles.

- **License:** MIT
- **Price:** Free
- **Version:** 1.0.0
- **Repository:** [https://github.com/Kaandonmez/vector-forge](https://github.com/Kaandonmez/vector-forge)

---

## What This Skill Does

1. **Verifies MCP & Project Context:** Reads `vectorforge_project_info` and `vectorforge_project_context` so your agent always operates on the right project directory and respects your folder hierarchy (`collections`).
2. **Enforces Style & Sibling Consistency:** Instructs the agent to read the active `style.json` (`vectorforge_get_style`) and inspect existing sibling SVGs (`vectorforge_get_asset`) before writing a single line of SVG XML.
3. **Creates Assets & Sibling Variants:** Uses `vectorforge_create_asset`, `vectorforge_create_variant`, and `vectorforge_update_asset` with atomic writes and schema validation.
4. **Runs Structural & Visual QA:** Calls `vectorforge_validate` and `vectorforge_snapshot` to catch schema, palette, stroke, and rendering issues before completion.
5. **Safe Dry-Run Exports:** Uses `vectorforge_export` (`dryRun: true` first, then `dryRun: false`) for Generic, Web, and Flutter targets without silently overwriting files.

> **Note:** VectorForge runs 100% locally and requires no external API keys or cloud accounts. Your connected AI coding agent authors the SVG/JSON using its own model; VectorForge supplies context, validation, rendering, snapshots, and export.

---

## Requirements

- **Node.js 22+**
- **VectorForge CLI / MCP Server** (`vectorforge` package or repository build)
- **Optional:** Playwright Chromium (`npx playwright install chromium`) for headless PNG snapshots (`vectorforge_snapshot`). Creating assets, variants, validating, and exporting work without Chromium.

---

## Installation

### 1. Install the Skill

- **From Agensi / ZIP:** Extract `vectorforge-mcp-starter.zip` into your agent's skills directory (for example `.claude/skills/vectorforge-mcp-starter/`, `.cursor/skills/vectorforge-mcp-starter/`, or `.agents/skills/vectorforge-mcp-starter/`).
- **From the VectorForge Repository:** The skill is bundled at `skills/vectorforge-mcp-starter/`.

### 2. Connect the VectorForge MCP Server

See [references/client-setup.md](references/client-setup.md) for copy-paste configurations for:

- **Claude Code** (`.mcp.json` or `claude mcp add`)
- **Cursor** (`.cursor/mcp.json`)
- **VS Code / GitHub Copilot** (`.vscode/mcp.json`)
- **Generic MCP Clients**

You can also run the bundled diagnostic script to generate a configuration for your current directory:

```bash
node skills/vectorforge-mcp-starter/scripts/verify-mcp.mjs --project ./my-project
```

---

## Example Prompts

- _"Create an SVG icon matching my existing style profile."_
- _"Generate a gold-tier variant of `badge-shield-base` in the `security-badges` family."_
- _"Validate my vector assets and fix any off-palette colors."_
- _"Take a PNG snapshot of `phone-triple-camera` and inspect the layout."_
- _"Export `studio-plant` for my Flutter app using a dry run first."_

---

## Need Full-Scale Asset Pack & Animation Production?

**VectorForge MCP Starter (Free)** is designed for single-asset creation, sibling variants, validation, snapshots, and exports.

For multi-asset game/app libraries, articulated character rigging, multi-clip animation pipelines, sequence choreography, state machines, and structured visual QA repair loops, upgrade to **VectorForge Asset Production Pro** on Agensi.
