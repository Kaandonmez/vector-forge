# v0.1 verification

Run `pnpm test` and `pnpm test:browser` after installing dependencies and Chromium. These are real integration tests against local files, an official MCP stdio client and Chromium, not mocked button assertions.

## Automated coverage

- Version rejection, metadata, unsafe IDs, keyframe ordering, property/easing/type validation.
- Every easing endpoint, numeric/color interpolation, looping, timing, playback controls, speed and reverse.
- Rig parent ordering, missing nodes and cycles.
- Every sequence action, parallel timing, repeated actions, deterministic seek, held transforms and bounded expansion.
- Event, named condition and completed-animation state transitions.
- SVG XML, duplicate/missing IDs, external content, scripts/handlers, DTD/entities, dimensions, palette and stroke findings.
- Filesystem creation, inheritance, invalid-write preservation, symlink/traversal rejection and malformed-resource recovery.
- Generic reopenable export, actor/variant dependency closure, dry runs, conflicts, explicit overwrite and nested symlink safety.
- Standalone web runtime and Flutter package structure.
- CLI help/list/context/validate/snapshot/export, including conflict rejection.
- Official MCP context/styles/read/create/update/variant/actor/animation/sequence/preview/snapshot/export.
- Studio loading, every phone variant, search/family filters, non-human motion, every human clip, state events, sequence drawing, style views, validation, source guards, PNG capture, export preflight, external file reload and mobile overflow.
- Project tree completeness, nested collections, variant/rig/motion ownership, tree search and keyboard navigation, mixed static/animated filters, folder assignment/rename/reparent, project creation/switching, persisted organization, export round trips and mobile drawer navigation.

## Visual QA

`tests/browser/studio.spec.ts` writes screenshots under `artifacts/qa/`: all static phone variants; plant, chip and energy motion; eight human poses; the full scene; styles; desktop and mobile Studio. Inspect these after changing artwork or animation. Art quality is not inferred from compilation or passing schemas.

`tests/browser/projects.spec.ts` also captures `project-library.png`, `project-mobile.png` and `project-mobile-tree.png` for the project-centric navigation. Its folder and project lifecycle tests use temporary directories and restore the original project.

The generic demo is expected to validate with zero errors and zero warnings. `pnpm vectorforge validate` should print `valid: true` and an empty issue list. `pnpm build`, `pnpm typecheck` and `pnpm lint` must pass independently.

Tests use temporary copies for file/MCP/export operations. The browser suite briefly opens a disposable temporary project to test live reload and restores the original project in a finally block. Snapshot output and QA files are intentionally ignored by Git.
