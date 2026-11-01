# VectorForge v0.1 — engineering handoff

Project navigation updated and verified for VectorForge v0.1. The Studio runs locally at **http://127.0.0.1:5173**.

## Implemented

Portable projects/context, configurable styles, SVG assets/families/variants, actors/rigs/hierarchies, keyframes/easings, playback, deterministic sequences, optional state machines, Studio/source editing/live reload, PNG snapshots, CLI, official SDK MCP, safe generic/web/Flutter exporters. Motion uses SVG DOM and requestAnimationFrame; the static SVG layer is independent of motion. Project subjects and aesthetics are data rather than engine assumptions.

The demo contains **6 static assets, 5 actors, 17 clips, 2 styles, 1 sequence and 1 state machine**. Studio now starts with a project tree and a mixed asset grid. Devices → Phone family exposes phone variants; Nature → Studio plant exposes the real rig hierarchy and gentle-sway; People → The maker exposes eight clips and a state machine; Scenes exposes the desk/board sequence. Styles compares botanical editorial with ink and paper. The original type-specific views remain in **Browse by type**.

The project picker opens or creates independent local projects and stores recent shortcuts in this browser. Create, rename and nest custom folders; assign assets and actors through **Asset folder** in the Inspector. Folder definitions live in context `collections`, metadata stores `collection`, and exports retain both. Existing projects group by category without migration. Source paths, motion IDs, CLI and MCP flows remain compatible. See [PROJECTS.md](PROJECTS.md).

## Run

```sh
cd /absolute/path/vector_forge
pnpm install
pnpm exec playwright install chromium
pnpm dev
```

For another project: `pnpm dev --project /absolute/path/my-project`.

```sh
pnpm vectorforge --help
pnpm vectorforge validate
pnpm vectorforge context
pnpm vectorforge list actors
pnpm vectorforge snapshot studio-plant --clip gentle-sway --time 1.2
pnpm vectorforge snapshot idea-to-board --time 5
pnpm vectorforge export studio-plant --dest ./artifacts/my-web-project --format web --dry-run
pnpm vectorforge export studio-plant --dest ./artifacts/my-web-project --format web
```

Use `--project` on CLI commands to select another project. Existing PNGs/export conflicts require explicit `--overwrite`. Web exports include a standalone ES module runtime and HTML demo; serve the export folder through any static HTTP server. Flutter exports package SVG/JSON and a nested pubspec asset snippet.

## MCP setup

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
        "/absolute/path/vector_forge/examples/generic-demo"
      ]
    }
  }
}
```

The working directory is selected by `--dir`; project path by `--project`. This stdio server does not require a model provider. See [MCP.md](MCP.md) for every tool.

## Structure

```text
apps/studio/                  Browser UI
packages/schema/              Schemas and shared types
packages/svg/                 Static SVG/style validation
packages/core/                Files, context, CRUD and snapshots
packages/motion/              Keyframes, clock, sequences and states
packages/renderer-web/        SVG DOM rig rendering
packages/cli/                 Local commands
packages/mcp/                 Official SDK stdio server
packages/exporters/           Generic, web and Flutter adapters
examples/generic-demo/        Real portable demo files
tests/                        Unit and integration tests
docs/                         Formats, setup, architecture and guidelines
```

## Verification

| Command                     | Result                                                                                                                                                                                |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm typecheck`            | Passed                                                                                                                                                                                |
| `pnpm lint`                 | Passed                                                                                                                                                                                |
| `pnpm format:check`         | Passed                                                                                                                                                                                |
| `pnpm test`                 | 74 passed: schemas, motion, validation, files, paths, exporters, project hierarchy, CLI and MCP                                                                                       |
| `pnpm test:browser`         | 13 passed: project/folder lifecycle, tree navigation, Studio, motion, states, sequences, source guards, snapshots, live reload, mobile, rig transforms and standalone web consumption |
| `pnpm build`                | Passed, production browser UI generated                                                                                                                                               |
| `pnpm vectorforge validate` | `valid: true`, zero findings                                                                                                                                                          |

Visual QA images are under `artifacts/qa/`. Every phone variant, all eight human poses, plant/chip/energy motion, the scene and desktop/mobile layouts were inspected. A real MCP client created/updated assets, a variant, a three-part actor, a multi-property clip, a sequence, a PNG and an external export. Browser tests consumed a standalone web export without the Studio at its URL. Invalid SVG writes were rejected without altering the prior files.

## Limits and next milestones

Lightweight source editing only; no drawing editor, IK or additive blending. Sequence actions overlay properties in declared order. Conditions are explicit booleans. Flutter export contains portable data, without a Dart/Flame animation runtime. Workspace modules are private TypeScript source packages; compiled npm distribution is future release work. Resource files use atomic writes and bundle rollback, with no cross-process writer lock. Export preflight checks conflicts and destinations; a later filesystem failure can leave a partial destination and is reported as failure.

Next: explicit migrations and npm packaging, standalone Dart/Godot motion adapters, then richer validators and user-project visual regression references.

[README.md](../README.md) is the main guide. [FORMATS.md](FORMATS.md) defines time/coordinate conventions. [AI_ASSET_GUIDELINES.md](AI_ASSET_GUIDELINES.md) covers the feedback loop. The original source brief is preserved in [BUILD_SPEC.md](BUILD_SPEC.md).
