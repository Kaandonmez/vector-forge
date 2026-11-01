# VECTORFORGE — MASTER BUILD PROMPT

You are building a real developer tool named **VectorForge**.

Do not only create a prototype, architecture document, mock UI, scaffolding, or TODO list.

Implement a complete, working **VectorForge v0.1** locally.

Run it.

Test it.

Open it in a browser.

Inspect the generated visuals.

Fix obvious problems.

Leave the repository in a usable and maintainable state.

Do not stop after project scaffolding.

Do not ask unnecessary questions.

If a technical decision is not specified, make the most reasonable engineering decision yourself and document it.

---

# 1. PRODUCT DEFINITION

VectorForge is:

> **An AI-first, open and portable 2D asset and motion pipeline for games, apps, websites, and other interactive projects.**

VectorForge must allow AI coding agents and humans to create, inspect, animate, validate, preview, organize, and export reusable 2D visual assets.

It should support:

- static SVG assets
- reusable visual styles
- asset families
- asset variants
- animated assets
- articulated actors
- rigs
- keyframe animations
- animation clips
- reusable motion behaviors
- animation sequences
- lightweight state machines
- browser-based previews
- visual snapshots
- project export
- CLI operation
- MCP operation

VectorForge must be:

- completely local-first
- free to run
- model-agnostic
- framework-agnostic
- game-engine-agnostic
- AI-agent friendly
- usable without a proprietary editor
- based on inspectable text formats
- easy to version with Git
- suitable for eventual open-source publication
- useful independently of any specific game or application

The core workflow is:

```text
AI coding agent
      │
      │ MCP / CLI
      ▼
VectorForge
      │
      ├── Project Context
      ├── Styles
      ├── SVG Assets
      ├── Asset Families
      ├── Variants
      ├── Actors
      ├── Rigs
      ├── Animations
      ├── Sequences
      └── Validation
      │
      ▼
Browser Preview
      │
      ▼
Visual Inspection
      │
      ▼
Export
      │
      ▼
External project
```

---

# 2. CORE PHILOSOPHY

VectorForge is primarily an **AI-first asset production system**.

The expected workflow is NOT:

```text
human manually draws everything
↓
human manually rigs everything
↓
human manually edits every keyframe
```

The expected workflow is:

```text
human gives intent
↓
AI agent reads project context
↓
AI reads style rules
↓
AI inspects related assets
↓
AI creates SVG / JSON
↓
VectorForge validates
↓
VectorForge renders
↓
AI or human visually inspects
↓
AI improves if necessary
↓
asset is exported
```

The browser Studio is therefore primarily:

- a preview environment
- an inspection environment
- a debugging environment
- a validation environment
- a lightweight editing environment

It is NOT intended to become Photoshop, Illustrator, After Effects, Blender, or Rive.

---

# 3. GENERIC PRODUCT REQUIREMENT

VectorForge must not contain assumptions about any specific game, application, company, project, or visual style.

Do not hard-code domain concepts.

Do not assume assets are:

- technology products
- characters
- game sprites
- office objects
- UI icons

Those may exist as examples only.

The core system must be generic enough to support things such as:

```text
characters
plants
vehicles
machines
icons
phones
fantasy items
weapons
buildings
UI illustrations
educational diagrams
website illustrations
animated logos
robots
animals
furniture
environment props
```

The same engine should work for all of them.

---

# 4. STYLE IS A FIRST-CLASS SYSTEM

One of VectorForge's most important purposes is to prevent visually inconsistent AI output.

A project should be able to maintain a coherent visual identity across hundreds of independently generated assets.

Style must therefore be a completely generic and configurable system.

Do not hard-code a built-in VectorForge aesthetic.

A VectorForge project may define any number of style profiles.

Example:

```text
styles/
├── clean-flat/
├── retro-futuristic/
├── dark-tech/
├── children's-book/
├── corporate-editorial/
└── custom-project-style/
```

Each style should be independently configurable.

---

# 5. STYLE PROFILE CAPABILITIES

A Style Profile may define things such as:

- palette
- preferred colors
- prohibited colors
- background recommendations
- stroke usage
- stroke width
- stroke colors
- line caps
- line joins
- corner radius philosophy
- shape language
- geometric complexity
- detail level
- object proportions
- character proportions
- visual density
- shadow style
- shadow intensity
- highlight style
- gradient rules
- perspective
- preferred viewing angle
- depth rules
- composition guidance
- whitespace guidance
- motion personality
- animation timing
- anticipation
- overshoot
- elasticity
- default easing
- naming conventions
- written art-direction guidance
- reference assets
- reference images if available

Not every style must use every field.

The schema must be extensible.

---

# 6. STYLE DIRECTORY

A style may look approximately like:

```text
styles/
└── clean-flat/
    ├── style.json
    ├── palette.json
    ├── README.md
    └── references/
```

Example:

```json
{
  "schemaVersion": 1,
  "id": "clean-flat",
  "name": "Clean Flat",
  "geometry": {
    "shapeLanguage": "rounded-geometric",
    "detailLevel": "low-medium"
  },
  "stroke": {
    "enabled": false
  },
  "lighting": {
    "shadow": "soft-minimal",
    "highlight": "subtle"
  },
  "perspective": {
    "default": "three-quarter"
  },
  "motion": {
    "defaultEasing": "easeInOutCubic",
    "overshoot": 0.07,
    "anticipation": 0.04,
    "personality": "smooth-controlled"
  }
}
```

---

# 7. ZERO-COST CORE WORKFLOW

The complete core VectorForge workflow must function without requiring:

- a paid API
- a proprietary design application
- a cloud account
- a subscription
- a proprietary animation runtime
- a hosted backend

VectorForge should operate locally.

AI generation will primarily be performed by the user's existing coding agent.

The coding agent may generate:

```text
SVG
JSON
TypeScript
metadata
animation definitions
```

VectorForge provides:

- structure
- context
- style consistency
- validation
- rendering
- animation
- visual feedback
- organization
- export

Optional AI provider integrations may be added in the future, but they must not be necessary for normal VectorForge operation.

---

# 8. LICENSING

Prefer dependencies with permissive licenses such as:

- MIT
- Apache-2.0
- BSD

Avoid dependencies that would make eventual open-source distribution difficult.

Prepare the repository so VectorForge itself can use the:

```text
MIT License
```

Do not publish anything externally.

Do not push to GitHub.

Do not create a public repository.

Simply prepare the project so it could be published later without major cleanup.

---

# 9. TECHNOLOGY STACK

Use a TypeScript-first architecture.

Preferred stack:

- TypeScript
- Node.js
- pnpm workspace
- Vite
- React
- native SVG
- SVG DOM
- requestAnimationFrame
- Zod or equivalent runtime schema validation
- Vitest
- Playwright
- official Model Context Protocol SDK where practical

Avoid unnecessary dependencies.

Do not add a database in v0.1.

Project data should primarily live as normal files.

---

# 10. REPOSITORY ARCHITECTURE

Create a clean monorepo approximately like:

```text
vectorforge/
│
├── apps/
│   └── studio/
│
├── packages/
│   ├── core/
│   ├── schema/
│   ├── svg/
│   ├── motion/
│   ├── renderer-web/
│   ├── cli/
│   ├── mcp/
│   └── exporters/
│       ├── generic/
│       ├── web/
│       └── flutter/
│
├── examples/
│   └── generic-demo/
│
├── fixtures/
│
├── docs/
│
├── scripts/
│
├── LICENSE
├── CONTRIBUTING.md
├── README.md
├── package.json
└── pnpm-workspace.yaml
```

This is guidance, not an absolute requirement.

Change it if a cleaner architecture becomes apparent.

---

# 11. ARCHITECTURAL BOUNDARIES

Keep the following concepts separate:

```text
Project
Style
Asset
Asset Family
Variant
Actor
Rig
Animation
Sequence
State Machine
Renderer
Validator
Exporter
```

Especially:

```text
Static Asset System
        !=
Motion Engine
```

A completely static SVG asset must not unnecessarily depend on motion code.

Likewise the motion system should not know that an actor represents a human, CPU, plant, robot, etc.

---

# 12. VECTORFORGE PROJECT FORMAT

A VectorForge project should be portable and human-readable.

Example:

```text
my-project/
│
├── vectorforge.project.json
│
├── vectorforge.context.json
│
├── styles/
│
├── assets/
│
├── actors/
│
├── animations/
│
├── sequences/
│
└── exports/
```

Example project metadata:

```json
{
  "schemaVersion": 1,
  "name": "Example Project",
  "defaultStyle": "clean-flat"
}
```

All formats must contain schema versions.

Plan for future migrations.

No proprietary binary project format.

---

# 13. CANONICAL DATA FORMAT

Important VectorForge project data should use portable formats such as:

```text
SVG
JSON
directories
```

Everything important should be:

- human-readable
- AI-readable
- Git-diffable
- portable
- inspectable without VectorForge

Do not hide important project information inside opaque binary files.

---

# 14. STATIC ASSET SYSTEM

VectorForge must support normal SVG assets.

Examples include:

```text
phone
tree
CPU
shield
car
chair
sword
icon
logo
machine
house
robot
UI illustration
```

Typical asset:

```text
assets/
└── example-object/
    ├── asset.svg
    └── asset.json
```

Metadata should support:

- id
- display name
- category
- tags
- style
- asset family
- variant relationship
- dimensions
- viewBox
- schema version
- optional generation notes
- optional source information

---

# 15. ASSET FAMILY SYSTEM

Related assets should be grouped into families.

Example:

```text
phone-modern/
├── single-camera/
├── dual-camera/
├── triple-camera/
└── foldable/
```

Or:

```text
tree-family/
├── small/
├── medium/
├── large/
└── winter/
```

The family system should make it easy for AI agents to inspect sibling assets before producing a new variant.

This is important for visual consistency.

---

# 16. VARIANT SYSTEM

Variants should inherit conceptual relationships from a base asset or family.

Example:

```text
base phone
   │
   ├── 1 camera
   ├── 2 cameras
   ├── 3 cameras
   └── foldable
```

Variants should preserve:

- visual proportions
- style
- palette
- perspective
- shared motifs

Provide metadata relationships such as:

```json
{
  "family": "phone-modern",
  "baseAsset": "phone-base",
  "variant": "triple-camera"
}
```

---

# 17. ACTOR SYSTEM

Anything containing independently animated parts may be an **Actor**.

Do not use the term Character as the core abstraction.

Actors may include:

```text
human
plant
robot
phone
door
CPU
machine
vehicle
animal
UI illustration
factory equipment
server rack
```

An actor might contain:

```text
actor.svg
actor.json
rig.json
```

---

# 18. ACTOR SVG FORMAT

Prefer layered SVG containing stable IDs.

Example:

```xml
<g id="body">
<g id="head">
<g id="arm-left">
<g id="arm-right">
```

For a machine:

```xml
<g id="base">
<g id="arm">
<g id="claw">
<g id="indicator-light">
```

For a plant:

```xml
<g id="pot">
<g id="stem">
<g id="leaf-left">
<g id="leaf-right">
```

VectorForge must treat all of these identically.

---

# 19. RIG FORMAT

A rig maps logical nodes to SVG elements.

Conceptual example:

```json
{
  "schemaVersion": 1,
  "actorId": "example",
  "nodes": {
    "body": {
      "svgId": "body"
    },
    "head": {
      "svgId": "head",
      "parent": "body",
      "pivot": [0.5, 0.85]
    },
    "armRight": {
      "svgId": "arm-right",
      "parent": "body",
      "pivot": [0.2, 0.1]
    }
  }
}
```

Support hierarchy and nested transforms.

---

# 20. MOTION ENGINE

Implement a lightweight reusable 2D motion engine.

Its purpose is to animate VectorForge actors and SVG elements efficiently.

Initial animatable properties:

```text
position.x
position.y
rotation
scale.x
scale.y
opacity
```

If cleanly achievable also support:

```text
fill color
stroke color
```

The architecture should allow more properties later.

---

# 21. KEYFRAME ANIMATION

Animations use keyframes.

Conceptual format:

```json
{
  "schemaVersion": 1,
  "id": "example-motion",
  "duration": 1.2,
  "loop": true,
  "tracks": {
    "armRight.rotation": [
      {
        "time": 0,
        "value": 0
      },
      {
        "time": 0.35,
        "value": -50,
        "easing": "easeOutBack"
      },
      {
        "time": 0.8,
        "value": -43
      },
      {
        "time": 1.2,
        "value": 0,
        "easing": "easeInOutCubic"
      }
    ]
  }
}
```

Implement:

- play
- pause
- stop
- restart
- seek
- loop
- playback speed

Reverse playback may be added if it remains clean.

---

# 22. EASING SYSTEM

Implement at least:

```text
linear
easeIn
easeOut
easeInOut
easeInQuad
easeOutQuad
easeInOutQuad
easeInCubic
easeOutCubic
easeInOutCubic
easeOutBack
```

Make easing extensible.

The system must be capable of producing visually intentional motion.

---

# 23. MOTION PRINCIPLES

Support animation styles using techniques such as:

- anticipation
- overshoot
- settling
- overlap
- follow-through
- secondary motion
- phase offset
- controlled asymmetry

Avoid robotic motion.

Bad example:

```text
rotation
0 → -45
linear
500ms
```

Better example:

```text
0
→ +4 anticipation
→ -51 overshoot
→ -45 settle
```

---

# 24. SEQUENCE SYSTEM

Animation clips are low-level building blocks.

Implement a higher-level **Sequence system**.

Sequence actions should support at least:

```text
play
wait
moveTo
rotateTo
parallel
repeat
```

Example:

```json
{
  "schemaVersion": 1,
  "id": "presentation",
  "steps": [
    {
      "action": "moveTo",
      "target": "board",
      "duration": 1400
    },
    {
      "action": "play",
      "clip": "point"
    },
    {
      "action": "wait",
      "duration": 500
    },
    {
      "action": "play",
      "clip": "talk",
      "duration": 2500
    }
  ]
}
```

Design it so more actions can be added later.

---

# 25. STATE MACHINE

Implement a lightweight optional state machine.

Example:

```text
IDLE
 │
 ▼
WALK
 │
 ▼
WORK
 │
 ├── TALK
 │
 └── POINT
 │
 ▼
IDLE
```

Transitions may be:

- explicitly triggered
- condition-based
- animation-completed

Keep the initial implementation small and reliable.

---

# 26. NON-CHARACTER ANIMATION

The motion engine must work equally well for objects.

This is an important acceptance requirement.

Examples:

---

## Plant

Nodes:

```text
pot
stem
leaf-left
leaf-right
leaf-top
```

Animation:

```text
gentle-sway
```

Leaves should move with slightly different timing and rotation.

---

## Electronic component

Nodes:

```text
body
indicator-1
indicator-2
indicator-3
```

Animation:

```text
activity
```

Indicators blink asynchronously.

---

## Energy effect

An object may contain:

```text
body
energy-1
energy-2
energy-3
```

Animation may use:

```text
opacity
scale
rotation
position
```

---

## Foldable object

Nodes:

```text
left
right
hinge
```

Animations:

```text
fold
unfold
```

Do not implement object-specific special cases.

All must use the generic motion system.

---

# 27. STYLE VALIDATION

Implement useful automated style checks where technically reasonable.

Examples:

- SVG parses correctly
- viewBox exists
- malformed SVG rejected
- duplicate SVG IDs
- invalid referenced IDs
- colors outside preferred palette
- too many unique colors
- stroke used when style disables strokes
- suspicious stroke width
- missing metadata
- inconsistent dimensions
- invalid variant references

Return:

```text
error
warning
info
```

Do not pretend subjective visual quality can be perfectly validated automatically.

---

# 28. STRUCTURAL VALIDATION

Validation must include:

- valid project
- valid schemas
- asset metadata correctness
- SVG validity
- rig node existence
- animation node references
- keyframe ordering
- valid animation duration
- valid easing names
- sequence references
- state references
- export destination validity

Messages must be human-readable and useful to AI agents.

---

# 29. VECTORFORGE STUDIO

Create a polished local browser application named:

# VectorForge Studio

The Studio is used for:

```text
preview
inspection
validation
debugging
light editing
export
```

Start it through a simple command such as:

```bash
pnpm dev
```

It should show a clear local URL.

---

# 30. STUDIO UX

Suggested navigation:

```text
Project
Assets
Actors
Animations
Sequences
Styles
Export
```

Create a clean developer-oriented interface.

The interface should look intentional and usable, not like raw scaffolding.

---

# 31. ASSET BROWSER

Provide an asset browser with:

- thumbnails
- name
- category
- family
- style
- tags
- variant relationships

Allow filtering/search where reasonably simple.

---

# 32. PREVIEW CANVAS

The preview canvas is one of the most important parts of VectorForge.

Support:

- SVG asset preview
- actor preview
- animation playback
- sequence playback
- configurable background
- zoom
- fit to screen
- reset view

Playback controls:

```text
Play
Pause
Restart
Seek
Loop

0.25x
0.5x
1x
1.5x
2x
```

Display useful debug data:

```text
FPS
current time
duration
current clip
state
selected actor
selected node
```

---

# 33. INSPECTOR

Provide an inspector.

For static assets:

```text
metadata
family
variant
style
SVG information
validation
```

For actors:

```text
nodes
hierarchy
pivots
rig mappings
```

For animations:

```text
duration
tracks
keyframes
easing
loop settings
```

For styles:

```text
palette
geometry
stroke rules
lighting
motion
written guidance
```

---

# 34. SOURCE VIEW

AI-first tooling requires transparent source representation.

Allow users to inspect:

- SVG source
- metadata JSON
- style JSON
- rig JSON
- animation JSON
- sequence JSON

Editing is optional but desirable if safe.

Always validate data before writing modified content.

---

# 35. LIVE FILE RELOAD

When project files change on disk, VectorForge Studio should update automatically where practical.

Desired workflow:

```text
AI modifies SVG
↓
save
↓
Studio refreshes preview
```

And:

```text
AI modifies animation JSON
↓
save
↓
Studio reloads animation
```

Use file watching / Vite / WebSocket / HMR appropriately.

---

# 36. MCP SERVER

Implement a first-class VectorForge MCP server.

It should allow MCP-compatible coding agents to operate VectorForge without manually interacting with the Studio.

Suggested tool surface:

```text
vectorforge_project_info
vectorforge_project_context

vectorforge_list_styles
vectorforge_get_style
vectorforge_create_style
vectorforge_update_style

vectorforge_list_assets
vectorforge_get_asset
vectorforge_create_asset
vectorforge_update_asset
vectorforge_create_variant

vectorforge_list_actors
vectorforge_get_actor
vectorforge_create_actor
vectorforge_update_actor
vectorforge_update_rig

vectorforge_list_animations
vectorforge_get_animation
vectorforge_create_animation
vectorforge_update_animation

vectorforge_list_sequences
vectorforge_get_sequence
vectorforge_create_sequence
vectorforge_update_sequence

vectorforge_validate

vectorforge_preview
vectorforge_snapshot

vectorforge_export
vectorforge_export_to_project
```

Adjust names if necessary but keep naming predictable.

---

# 37. MCP PHILOSOPHY

MCP does NOT need to contain an image-generation model.

Instead it gives an AI coding agent access to the VectorForge workspace and workflow.

Example:

```text
User:
Create another vehicle variant matching the existing family.

AI:
→ vectorforge_project_context
→ vectorforge_get_style
→ vectorforge_list_assets
→ inspect vehicle family
→ generate SVG
→ vectorforge_create_variant
→ vectorforge_validate
→ vectorforge_snapshot
→ visually inspect
→ modify if necessary
```

The AI agent is the creative generator.

VectorForge is the visual production system around it.

---

# 38. SNAPSHOT SYSTEM

Implement snapshot generation.

An AI agent should be able to render an asset or animation to an image.

Examples:

```text
snapshot static asset

snapshot actor

snapshot actor at animation time 0.8 sec

snapshot sequence at 3.2 sec
```

Prefer Playwright or another reliable browser rendering mechanism.

Output should provide a useful image file or MCP-compatible image result.

The key loop is:

```text
generate
↓
render
↓
inspect
↓
change
↓
render
↓
approve
```

---

# 39. AI VISUAL FEEDBACK LOOP

Design VectorForge so an autonomous coding agent can repeatedly improve its own asset.

An ideal flow:

```text
1. read style
2. inspect sibling assets
3. generate SVG
4. validate
5. snapshot
6. inspect snapshot
7. identify visual inconsistency
8. edit SVG
9. snapshot again
10. export
```

This is one of the most important product capabilities.

---

# 40. CLI

Implement a useful CLI.

Preferred executable:

```text
vectorforge
```

During development, an equivalent local command is fine.

Commands should include approximately:

```bash
vectorforge init

vectorforge studio

vectorforge validate

vectorforge list assets
vectorforge list actors
vectorforge list styles
vectorforge list animations

vectorforge preview <id>

vectorforge snapshot <id>

vectorforge export <id>

vectorforge export-all

vectorforge mcp
```

Implement:

```text
--help
```

with useful documentation.

---

# 41. EXPORT SYSTEM

Export architecture must be modular.

Create exporters for:

## Generic

Export:

```text
SVG
metadata
rig
animations
sequences
manifest
```

---

## Web

Provide output convenient for normal browser applications.

---

## Flutter

Create a clean asset package structure suitable for Flutter and optionally Flame.

Example:

```text
assets/vectorforge/
├── static/
├── actors/
├── animations/
├── sequences/
└── vectorforge.manifest.json
```

Do not require Flutter itself to be installed for export.

VectorForge should simply generate a valid folder structure and manifest.

---

# 42. EXPORTER ARCHITECTURE

Design exporters as adapters.

Example:

```text
VectorForge Core
       │
       ├── Generic Exporter
       ├── Web Exporter
       └── Flutter Exporter
```

Future exporters might include:

```text
Godot
Unity
React Native
Canvas
PixiJS
```

Do not implement these now unless trivial.

Just make future addition clean.

---

# 43. SAFE EXPORT

Never unexpectedly overwrite external project files.

Export should support:

- dry run
- destination validation
- conflict detection
- explicit overwrite option

Show which files will be written.

---

# 44. DEMO PROJECT

Create:

```text
examples/generic-demo/
```

This exists only to verify and demonstrate VectorForge.

It must not affect core architecture.

Create a coherent example style named something generic, such as:

```text
editorial-tech
```

or another neutral name.

The style should demonstrate:

- geometric vector illustration
- controlled palette
- clean silhouettes
- subtle depth
- deliberate proportions
- polished appearance
- smooth motion

Do not imitate any specific copyrighted studio's exact visual identity.

---

# 45. DEMO ASSET FAMILY — PHONE

Create a polished phone family:

```text
phone-single-camera
phone-dual-camera
phone-triple-camera
phone-foldable-dual-camera
phone-foldable-triple-camera
```

Requirements:

- clearly same asset family
- same perspective
- same visual proportions
- same material language
- same style
- visibly distinct variants

These must look like actual deliberate SVG illustrations.

Do not use trivial placeholder rectangles.

---

# 46. DEMO ASSET — ELECTRONIC CHIP

Create a stylized electronic chip / SoC-like component.

Include individually addressable indicator lights.

Animations:

```text
idle
activity
```

`activity` should contain subtle asynchronous light patterns.

---

# 47. DEMO ASSET — PROCESSOR / ENERGY EFFECT

Create another electronic component such as a processor.

Add reusable vector energy elements around it.

Animation:

```text
boost
```

Demonstrate:

- opacity
- scale
- rotation
- slight translation

The result should be visually polished.

---

# 48. DEMO ACTOR — PLANT

Create an office-style plant actor.

Nodes:

```text
pot
stem
leaf-left
leaf-right
leaf-top
```

Animation:

```text
gentle-sway
```

Requirements:

- leaves move independently
- phase differences
- subtle secondary motion
- no robotic synchronization
- smooth loop

---

# 49. DEMO ACTOR — HUMAN

Create one generic stylized human actor.

Suggested nodes:

```text
body
head
hair
arm-left
arm-right
hand-left
hand-right
leg-left
leg-right
```

Create reusable animations:

```text
idle
walk
typing
talk
nod
point
write
celebrate
```

Use subtle:

- anticipation
- head motion
- body shift
- overshoot
- overlapping motion

Avoid robotic motion.

---

# 50. DEMO SCENE / SEQUENCE

Create a generic demonstration scene containing:

```text
desk
human actor
board
```

Sequence:

```text
actor starts idle
↓
actor walks to board
↓
actor turns
↓
actor raises arm
↓
drawing appears
↓
actor points
↓
actor performs talking motion
↓
actor returns to idle
```

It should be playable inside VectorForge Studio.

This scene exists only as a generic motion demonstration.

---

# 51. AI-SLOP PREVENTION

A major product goal is to avoid generic, inconsistent, obviously AI-generated visual collections.

VectorForge should encourage:

- asset family reuse
- shared proportions
- palette reuse
- consistent perspective
- shared geometry
- repeated visual motifs
- deterministic naming
- variant generation
- sibling asset inspection
- style validation
- explicit project art direction
- consistent motion rules

Create:

```text
docs/AI_ASSET_GUIDELINES.md
```

Explain these concepts clearly.

---

# 52. PROJECT CONTEXT SYSTEM

Create machine-readable project context.

Example:

```text
vectorforge.context.json
```

It should summarize information an AI agent needs:

```text
project identity
default style
available styles
asset families
available assets
actors
animations
sequences
naming conventions
export destinations
project rules
```

Provide the same information through MCP.

---

# 53. PROJECT CONTEXT SHOULD REDUCE PROMPT REPETITION

An AI agent should not require the user to repeatedly explain:

```text
which palette?
which style?
which perspective?
what naming format?
which existing family?
which motion personality?
```

The agent should retrieve these automatically from VectorForge project context.

---

# 54. TESTING

Implement real automated tests.

Unit tests should include:

- schema validation
- asset metadata
- keyframe interpolation
- easing
- animation timing
- hierarchy transforms
- rig validation
- sequence execution
- state transitions
- style validation where objective
- export conflict handling
- path safety

---

# 55. BROWSER TESTS

Use Playwright or equivalent to verify:

- Studio loads
- project opens
- asset appears
- actor renders
- animation plays
- sequence plays
- style view loads
- validation results appear
- snapshot can be generated

---

# 56. MCP TESTS

Verify:

- MCP server starts
- project context is available
- styles can be read
- assets can be listed
- assets can be created
- validation runs
- snapshots work
- export works

---

# 57. CLI TESTS

Verify:

```text
help
project validation
asset listing
snapshot generation
export
MCP launch
```

---

# 58. VISUAL VERIFICATION

Compilation is not enough.

After implementation:

1. start VectorForge Studio
2. open generic-demo
3. inspect every demo asset
4. inspect phone variants
5. play plant animation
6. play electronic activity animation
7. play energy animation
8. inspect human actor
9. play all human clips
10. play the full demo sequence
11. capture screenshots
12. inspect visual problems
13. fix obvious issues
14. rerun tests

Do not declare completion before actually looking at the output.

---

# 59. PERFORMANCE

Animation should run smoothly at normal browser refresh rates.

Use:

```text
requestAnimationFrame
```

Avoid making React rerender the entire application every frame.

Keep:

```text
Studio UI state
```

separate from:

```text
motion runtime state
```

Prefer efficient SVG DOM transforms.

---

# 60. FILE WATCHING

The Studio should react to external file edits.

For example:

```text
external AI agent
↓
updates animation.json
↓
Studio detects change
↓
animation reloads
```

This is essential for AI-assisted workflows.

---

# 61. ERROR HANDLING

Bad project data must not crash the Studio silently.

Provide clear errors for:

```text
malformed JSON
invalid SVG
missing asset
missing SVG node
invalid rig
invalid animation
invalid sequence
missing style
unsupported schema version
```

Errors should explain:

- what failed
- where
- why
- likely corrective action

This helps both humans and AI agents.

---

# 62. PUBLICATION-READY REPOSITORY QUALITY

Do NOT publish the project now.

Do NOT push anything externally.

However, structure and document the repository as though it may later become a public GitHub project.

Create:

```text
README.md
LICENSE
CONTRIBUTING.md
docs/
examples/
```

README should contain:

```text
What is VectorForge?
Why does it exist?
Architecture
Quick Start
Studio
CLI
MCP
Styles
Assets
Actors
Animation
Sequences
Validation
Exporting
Development
Testing
Project Format
Roadmap
```

Do not claim unfinished features are complete.

---

# 63. README TAGLINE

Use:

> **VectorForge — An AI-first 2D asset and motion pipeline for games, apps, and the web.**

If appropriate, mention that it is designed around open formats and local workflows.

---

# 64. MCP DOCUMENTATION

Provide setup instructions for generic MCP-compatible agents.

Avoid making documentation specific to one editor or one model.

Where useful, provide example configurations for commonly used MCP clients.

Include:

```text
command
arguments
working directory
project path
```

---

# 65. DEVELOPMENT EXPERIENCE

Target first-run experience:

```bash
pnpm install
pnpm dev
```

Studio should launch or print a clear URL.

Examples:

```bash
pnpm vectorforge validate examples/generic-demo

pnpm vectorforge mcp

pnpm vectorforge snapshot phone-triple-camera
```

Commands may differ if a cleaner implementation exists.

Keep them simple.

---

# 66. V0.1 SCOPE BOUNDARY

VectorForge v0.1 should be complete for its intended workflow, but it should not waste development effort on unrelated product categories.

For v0.1, do NOT build:

- a raster painting application
- a Photoshop replacement
- a full Illustrator replacement
- a complete freehand vector editor
- a giant professional animation timeline editor
- 3D modeling
- 3D animation
- cloud accounts
- authentication
- remote collaboration
- marketplace
- billing
- subscription management
- cloud asset storage
- organization/team administration
- plugin marketplace

These are not required for the core VectorForge workflow.

This does NOT mean the core product should be incomplete.

The following ARE core and must work properly:

```text
styles
SVG assets
families
variants
actors
rigs
animations
sequences
validation
browser preview
snapshots
MCP
CLI
export
```

---

# 67. EXTENSIBILITY

Architecture should make future support possible for:

```text
new renderers
new exporters
new animation properties
new easing functions
new validators
new asset processors
new MCP tools
optional AI providers
additional editor features
```

Use interfaces and modular packages where useful.

Avoid giant switch statements and tightly coupled modules.

---

# 68. DO NOT BUILD A FRAMEWORK FOR IMAGINARY NEEDS

Do not add abstractions merely because they may theoretically be useful someday.

Use this rule:

> Introduce an abstraction when at least two real parts of VectorForge require it, or when the boundary is already clearly necessary.

Prefer:

```text
small
working
well-tested
extensible
```

over:

```text
huge
abstract
unfinished
```

---

# 69. DEMO QUALITY

Demo assets are important because they verify the product.

Do not generate visibly unfinished placeholder artwork and claim success.

The demo should demonstrate that VectorForge can produce:

- coherent asset families
- attractive SVG output
- smooth motion
- reusable rigs
- variants
- visually consistent animation

The demo does not need commercial illustration quality, but it must clearly show the intended capability.

---

# 70. IMPLEMENTATION ORDER

Proceed through these stages automatically.

## Phase 1
Repository and workspace

## Phase 2
Schemas and project format

## Phase 3
Style profiles

## Phase 4
Static SVG asset system

## Phase 5
Families and variants

## Phase 6
Rig / actor model

## Phase 7
Motion engine

## Phase 8
Easing and interpolation

## Phase 9
Sequences

## Phase 10
State machine

## Phase 11
Web renderer

## Phase 12
VectorForge Studio

## Phase 13
File watching / live reload

## Phase 14
Validation

## Phase 15
Generic demo project

## Phase 16
Snapshots

## Phase 17
CLI

## Phase 18
MCP

## Phase 19
Exporters

## Phase 20
Automated tests

## Phase 21
Documentation

## Phase 22
Run everything

## Phase 23
Visually inspect everything

## Phase 24
Fix defects

## Phase 25
Final verification

Do not stop automatically between phases.

---

# 71. IF SOMETHING BECOMES TOO COMPLEX

If a specific design becomes unnecessarily complicated:

1. preserve the public file format if possible
2. simplify the implementation
3. keep the full end-to-end workflow functioning
4. document the limitation
5. continue

Do not substitute important functionality with mock buttons.

---

# 72. END-TO-END ACCEPTANCE FLOW

The most important VectorForge scenario is:

```text
AI agent
↓
opens VectorForge project
↓
retrieves project context
↓
retrieves active style
↓
inspects related asset family
↓
creates SVG asset
↓
creates metadata
↓
VectorForge validates it
↓
VectorForge renders it
↓
agent receives screenshot
↓
agent visually evaluates it
↓
agent edits it if necessary
↓
human can inspect it in Studio
↓
asset exports into another project
```

This entire flow must work.

---

# 73. ACCEPTANCE TEST — STATIC ASSET

Using MCP or CLI, create or modify an SVG asset.

Verify:

```text
file creation
metadata
style relationship
preview
validation
snapshot
export
```

---

# 74. ACCEPTANCE TEST — VARIANT

Start from one asset.

Create another variant.

Verify:

```text
family relationship
shared style
shared perspective
shared proportions
visual distinction
preview
export
```

---

# 75. ACCEPTANCE TEST — ACTOR

Create an actor with at least three independently transformable nodes.

Verify:

```text
rig parsing
hierarchical transforms
preview
node inspection
```

---

# 76. ACCEPTANCE TEST — ANIMATION

Create an animation containing:

```text
rotation
position
opacity
scale
multiple keyframes
multiple easing functions
```

Verify smooth playback.

---

# 77. ACCEPTANCE TEST — OBJECT MOTION

Verify at least three different non-human use cases:

```text
swaying plant

blinking electronic indicators

animated energy effect
```

This ensures the animation engine is generic.

---

# 78. ACCEPTANCE TEST — HUMAN MOTION

Verify one generic human actor with:

```text
idle
walk
typing
talk
point
write
celebrate
```

---

# 79. ACCEPTANCE TEST — SEQUENCE

Verify a multi-step sequence involving:

```text
movement
waiting
animation clip
another animation clip
parallel behavior if practical
```

---

# 80. ACCEPTANCE TEST — STYLE CHANGE

Create or use at least two clearly different style profiles.

Render equivalent assets using both styles.

The resulting visuals should visibly differ.

This proves the style system is generic.

Do not hard-code the demo's style into asset-generation logic.

---

# 81. ACCEPTANCE TEST — MCP

An MCP-compatible client must be capable of:

- retrieving project context
- retrieving style information
- listing assets
- reading asset source
- creating an asset
- creating a variant
- creating an actor
- creating an animation
- validating
- rendering a preview
- generating a snapshot
- exporting

---

# 82. ACCEPTANCE TEST — STUDIO

From the Studio I must be able to visually browse:

```text
styles
assets
families
actors
animations
sequences
validation results
```

I must be able to play animations before importing them into another application.

---

# 83. ACCEPTANCE TEST — EXTERNAL EXPORT

Export selected content into an arbitrary local folder.

Verify exported files are usable without requiring VectorForge Studio.

The exported data should remain readable.

---

# 84. ACCEPTANCE TEST — OFFLINE

Core functionality must work without making any required paid cloud API calls.

---

# 85. ACCEPTANCE TEST — TEST SUITE

All automated tests must pass.

Do not disable failing tests merely to make CI green.

---

# 86. FINAL ENGINEERING REVIEW

Before finishing:

- inspect repository structure
- remove dead code
- remove unused dependencies
- fix TypeScript errors
- fix lint errors
- run tests
- inspect Studio
- inspect animations
- inspect demo assets
- inspect snapshots
- verify CLI
- verify MCP
- verify exporter
- review README
- review setup instructions

---

# 87. FINAL HANDOFF

When finished, provide a concise engineering handoff containing:

## Status

What actually works.

## Architecture

Major packages and responsibilities.

## Repository structure

Useful directory tree.

## How to run VectorForge Studio

Exact commands.

## How to use CLI

Important commands.

## MCP setup

Exact configuration.

## Demo

What should be opened first.

## Export

How to export into another project.

## Tests

Commands and results.

## Known limitations

Only real limitations.

## Future milestones

Short prioritized list.

Do not replace implementation with a theoretical plan.

---

# FINAL DIRECTIVE

Build **VectorForge v0.1** now.

VectorForge must be a completely generic product.

It must have no dependency on any existing game or application.

The generic demo exists only to prove its capabilities.

Focus on creating an excellent local AI-assisted loop:

```text
describe
↓
generate
↓
validate
↓
preview
↓
inspect
↓
refine
↓
export
```

The end result should feel like the foundation of a real reusable developer tool rather than a one-off project script.
