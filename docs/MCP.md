# MCP setup and reference

The local MCP server implements official SDK stdio JSON-RPC. It writes protocol data to stdout and errors to stderr. It binds to one project directory per process. The client must have access to the local project and repository; nothing is sent to a model provider by VectorForge.

```json
{
  "mcpServers": {
    "vectorforge": {
      "command": "pnpm",
      "args": [
        "--dir",
        "/absolute/path/vector_forge",
        "vectorforge",
        "mcp",
        "--project",
        "/absolute/path/my-project"
      ]
    }
  }
}
```

Command: `pnpm`. Repository working directory is selected using `--dir`. Project path is selected with `--project`; use an absolute path. If pnpm is unavailable to the client, use its absolute executable path. A Node equivalent is `node --import tsx /absolute/path/vector_forge/packages/cli/src/index.ts mcp --project /absolute/path/my-project`, with the repository as the process working directory.

## Tools

All tool names begin `vectorforge_`.

| Tool                                                                                                   | Purpose / arguments                                                                                                        |
| ------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| project_info                                                                                           | Metadata, counts, root and findings                                                                                        |
| project_context                                                                                        | Fresh project inventory, styles, families and authored rules                                                               |
| list_styles / list_assets / list_actors / list_animations / list_sequences / list_state_machines       | List metadata, optional `family` filter                                                                                    |
| get_style / get_asset / get_actor / get_animation / get_sequence / get_state_machine                   | `id`; actors include source and rig, assets include source                                                                 |
| create_style / create_asset / create_actor / create_animation / create_sequence / create_state_machine | `data` JSON; assets need `svg`; actors need `svg` and `rig`                                                                |
| update_style / update_asset / update_actor / update_animation / update_sequence / update_state_machine | `data`; optional replacement `svg` / `rig`; existing ID required                                                           |
| update_rig                                                                                             | `actorId`, `data` rig JSON                                                                                                 |
| create_variant                                                                                         | `baseId`, `data` metadata overrides (new id/name), `svg`                                                                   |
| validate                                                                                               | Full project report with `valid` and findings                                                                              |
| preview                                                                                                | Optional `id`; start Studio and return a local browser URL                                                                 |
| snapshot                                                                                               | `id`, optional `time`, `clip`, `sequence`, `output`, `overwrite`; returns PNG image content and file location              |
| export / export_to_project                                                                             | `destination`, optional `id`, `format` (`generic`, `web`, `flutter`), `dryRun` (default true), `overwrite` (default false) |

All motion times are seconds. Server previews live until the MCP process closes. Snapshots start an isolated short-lived renderer and do not require a Studio to be running. Install Chromium once with `pnpm exec playwright install chromium`.

## Recommended agent workflow

1. Retrieve `project_context` and `get_style`.
2. List/filter siblings by family and read their actual SVG, not only names.
3. Generate a self-contained SVG with matching dimensions and metadata.
4. Create an asset or variant. For articulation, create an actor with stable IDs and a rig, then create clips/sequences.
5. Run `validate`. Fix errors; review objective style warnings.
6. Call `snapshot` at meaningful key times. Inspect the returned image and repeat an update if needed.
7. Call export with `dryRun: true`. Inspect the file plan. Write using `dryRun: false`; do not set overwrite unless intended.

Tool errors are returned as MCP `isError` text with the failing resource and reason. There is no image-generation model in the server: the connected coding agent creates SVG/JSON using its own capabilities.
