# MCP setup and reference

The local MCP server implements official SDK stdio JSON-RPC (`@modelcontextprotocol/sdk`). It writes protocol data to `stdout` and errors to `stderr`. Each MCP server process binds strictly to **one project directory** (`--project <path>`) so separate projects never overwrite or cross-contaminate each other's files. Nothing is sent to an external model provider by VectorForge.

## Starting the MCP Server

### Via `npx` or global `npm` install (Recommended)

```sh
npx -y vectorforge mcp --project /path/to/my-project
# or after npm install -g vectorforge:
vectorforge mcp --project /path/to/my-project
```

Pass `--init` (`npx -y vectorforge mcp --project ./my-new-project --init --name "My Project"`) to automatically initialize an empty directory as a portable VectorForge project on first launch.

### From a built repository checkout

After running `pnpm build`, the compiled CLI/MCP entrypoint (`dist/cli.js`) runs directly on Node.js 22+ without requiring `tsx`:

```sh
node /path/to/vector_forge/dist/cli.js mcp --project /path/to/my-project
```

Or during development inside the repository:

```sh
pnpm vectorforge mcp --project ./examples/generic-demo
```

---

## Client Configuration Examples

### 1. Claude Code (`.mcp.json` at project root)

```json
{
  "mcpServers": {
    "vectorforge": {
      "command": "npx",
      "args": ["-y", "vectorforge", "mcp", "--project", "."]
    }
  }
}
```

Or via the Claude Code CLI:

```sh
claude mcp add vectorforge -- npx -y vectorforge mcp --project . --init
```

### 2. Cursor (`.cursor/mcp.json`)

```json
{
  "mcpServers": {
    "vectorforge": {
      "command": "npx",
      "args": ["-y", "vectorforge", "mcp", "--project", "${workspaceFolder}"]
    }
  }
}
```

### 3. VS Code / GitHub Copilot (`.vscode/mcp.json`)

```json
{
  "servers": {
    "vectorforge": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "vectorforge", "mcp", "--project", "${workspaceFolder}"]
    }
  }
}
```

### 4. Generic MCP Clients (Repository Checkout Mode)

If running directly from a local repository clone before publishing `vectorforge` to npm:

```json
{
  "mcpServers": {
    "vectorforge": {
      "command": "node",
      "args": ["/path/to/vector_forge/dist/cli.js", "mcp", "--project", "/path/to/my-project"]
    }
  }
}
```

### Project Resolution & Isolation

`vectorforge mcp` resolves its bound project directory in this order:

1. Explicit `--project <path>` flag.
2. `VECTORFORGE_PROJECT` environment variable.
3. Current working directory (`process.cwd()`) if it contains `vectorforge.project.json`.
4. The bundled `examples/generic-demo` project.

All file reads and writes are locked to the resolved root and checked via `safePath` (rejecting `../` traversal and symbolic links).

---

## Tools

All tool names begin `vectorforge_`.

| Tool                                                                                                               | Purpose / arguments                                                                                                            |
| ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `init_project`                                                                                                     | Optional `name`; initialize an empty directory as a portable VectorForge project                                               |
| `project_info`                                                                                                     | Metadata, counts, bound `root` and validation findings                                                                         |
| `project_context`                                                                                                  | Fresh project inventory, `collections`, styles, families and authored rules                                                    |
| `update_project`                                                                                                   | `data` JSON (`name`, `defaultStyle`, `description`) for `vectorforge.project.json`                                             |
| `update_context`                                                                                                   | `data` JSON (`collections`, `rules`, `namingConventions`, `exportDestinations`) for `vectorforge.context.json`                 |
| `list_styles` / `list_assets` / `list_actors` / `list_animations` / `list_sequences` / `list_state_machines`       | List metadata, optional `family` filter                                                                                        |
| `get_style` / `get_asset` / `get_actor` / `get_animation` / `get_sequence` / `get_state_machine`                   | `id`; actors include source SVG and rig, assets include source SVG                                                             |
| `create_style` / `create_asset` / `create_actor` / `create_animation` / `create_sequence` / `create_state_machine` | `data` JSON; assets need `svg`; actors need `svg` and `rig`                                                                    |
| `update_style` / `update_asset` / `update_actor` / `update_animation` / `update_sequence` / `update_state_machine` | `data`; optional replacement `svg` / `rig`; existing ID required                                                               |
| `update_rig`                                                                                                       | `actorId`, `data` rig JSON                                                                                                     |
| `create_variant`                                                                                                   | `baseId`, `data` metadata overrides (new id/name), `svg`                                                                       |
| `validate`                                                                                                         | Full project report with `valid` and `issues`                                                                                  |
| `preview`                                                                                                          | Optional `id`; start Studio on loopback and return a local browser URL                                                         |
| `snapshot`                                                                                                         | `id`, optional `time`, `clip`, `sequence`, `output`, `overwrite`; returns PNG image content and file location                  |
| `export` / `export_to_project`                                                                                     | `destination`, optional `id`, `format` (`generic`, `web`, `flutter`), `dryRun` (default `true`), `overwrite` (default `false`) |

All motion times are seconds. Server previews live until the MCP process closes. Snapshots start an isolated short-lived renderer and do not require a Studio to be running. Install Chromium once with `npx playwright install chromium` (or `pnpm exec playwright install chromium`).

---

## Recommended Agent Workflow & Starter Skill

A ready-to-use Agent Skill (`SKILL.md` standard) is bundled at [`skills/vectorforge-mcp-starter/`](../skills/vectorforge-mcp-starter/SKILL.md):

1. Retrieve `project_info`, `project_context` and `get_style`.
2. List/filter siblings by family and read their actual SVG (`get_asset`), not only names.
3. Generate a self-contained SVG with matching dimensions and metadata.
4. Create an asset (`create_asset`) or variant (`create_variant`). For articulation, create an actor with stable IDs and a rig, then create clips/sequences.
5. Run `validate`. Fix errors; review objective style warnings.
6. Call `snapshot` at meaningful key times. Inspect the returned image and repeat an update if needed.
7. Call `export` with `dryRun: true`. Inspect the file plan and conflicts. Write using `dryRun: false`; do not set `overwrite: true` unless intended.

Tool errors are returned as MCP `isError` text with the failing resource and reason. There is no image-generation model in the server: the connected coding agent creates SVG/JSON using its own capabilities.

---

## Troubleshooting

- **Run Diagnostics:** Execute `vectorforge doctor --project /path/to/my-project` (or `pnpm vectorforge doctor`) to check Node.js version, MCP server readiness, Chromium snapshot status, and project validity.
- **Missing Project Error (`No VectorForge project at ...`):** Initialize the target directory first with `vectorforge init /path/to/my-project`, or pass `--init` to `vectorforge mcp`.
- **Snapshot Chromium Error (`Playwright Chromium is missing`):** Install Chromium with `npx playwright install chromium` (or `pnpm exec playwright install chromium`). Creating assets, validating, and exporting work without Chromium.
- **Export Conflicts:** `export` refuses to overwrite existing files by default. Run with `dryRun: true` (`--dry-run` on CLI) to inspect `conflicts`, and only pass `overwrite: true` (`--overwrite`) when intending to replace destination files.
