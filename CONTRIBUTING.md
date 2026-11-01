# Contributing

Install Node.js 22+, pnpm and the workspace dependencies. Install Playwright Chromium for the full suite. Run `pnpm dev` to inspect `examples/generic-demo`.

Before submitting a change, run `pnpm typecheck`, `pnpm lint`, `pnpm test`, `pnpm test:browser` and `pnpm build`. Open the generated QA screenshots when changing art, rigs, animation or layout. Do not substitute compilation for visual inspection.

Keep static assets, schemas, motion, renderer and exporter adapters separate. Avoid domain-specific logic in the core. Any new canonical JSON resource needs an explicit schema version. New property or format support needs validation, runtime behavior, documentation and tests for its meaningful failure modes.

Use permissively licensed dependencies and self-contained SVG/JSON. Do not add paid service requirements. Keep examples reproducible in `scripts/generate-demo.ts`; do not regenerate or overwrite user projects.

Use descriptive change summaries explaining the trigger, final behavior and validation. Do not commit generated export directories, node_modules, browser traces or local absolute paths into shared configuration.
