# Architecture and engineering decisions

VectorForge is a pnpm workspace with small TypeScript modules and one local React/Vite Studio. Project files are the data source; there is no database, provider API or remote backend.

## Boundaries

- `schema`: Zod runtime validation and shared types; independent of rendering.
- `svg`: XML parsing, self-contained-content checks and objective style validation. Static SVG processing imports no motion code.
- `motion`: pure interpolation, easing, deterministic sequence compilation, playback clock and explicit state transitions.
- `core`: inventory, context, cross-reference validation, safe file paths and atomic resource writes. Snapshot rendering is a separate optional entrypoint.
- `renderer-web`: node-to-DOM mapping, hierarchy and pivots. It knows SVG element IDs and properties rather than domain objects.
- `exporters`: adapters returning file maps; shared preflight/conflict/path checks own writing behavior.
- `cli` and `mcp`: two interfaces to the same operations. MCP uses the official SDK's stdio transport.
- `studio`: inspector UI and local API on loopback, with file watching through Vite.

The demo is generated text data under `examples/generic-demo`. Its palette, subjects, family labels and preferred previews are project context, not production engine logic.

## Motion decisions

Seconds are the uniform timing unit, including sequences. The source brief showed both seconds and millisecond-looking durations; one documented unit prevents ambiguous playback. SVG user units are used for movement and degrees for rotation.

Sequence compilation expands serial/parallel/repeat actions into a bounded timeline. Sampling any timestamp produces the same result without sleeping or relying on previous frames. Values persist until a later step targets them. This supports reliable seek, snapshots and inspection; complex blending/IK is outside v0.1.

The SVG renderer wraps original elements so authored transforms remain intact. Parent-first rig order prevents ambiguous hierarchy construction. Reparenting retains baseline world transforms. SVG DOM values update each animation frame; only control/selection state and completion changes go through React. FPS/time labels and seek position update directly in the DOM at a limited cadence.

## File and API decisions

Resources are validated against the current project before writes. Atomic temporary-file rename protects each file; a bundle restores prior touched files on failure. There is no cross-process transaction coordinator. Concurrent writes to one resource should be avoided.

Paths cannot escape project roots or pass through symlinks. Export adapters compute every destination file before writing. Source roots and their parents cannot be export destinations. No-overwrite writes use exclusive file creation to guard against conflict races. A filesystem failure during a large export can leave a partial destination and is reported as failure.

Studio binds only to 127.0.0.1 and rejects cross-origin writes. The API never executes project scripts. SVG parsing rejects active or external content before Studio insertion. Bad resource JSON produces a validation finding and is excluded from inventory; malformed project metadata produces a clear project-open error.

## Extension points

Add easing functions through `registerEasing` before parsing project data; this registers both the runtime function and its schema name without coupling motion to Zod. Add new properties to schema and renderer together. Add an exporter by returning a file map and registering the adapter in `packages/exporters/index.ts`; shared path safety still applies. New validators can return `Issue` records. Schema migrations must be explicit and preserve portable files.

Private workspace package exports point to TypeScript source, suitable for development with `node --import tsx`. Publishing compiled packages is future release work. The browser `build` is not a standalone hosted file backend; use the documented local entrypoint for Studio, or the standalone web exporter for consumption elsewhere.
