# Producing a coherent collection

Read project context before drawing. Retrieve the active style, existing family metadata and at least two relevant sibling SVGs when available. Use those files to infer proportions, perspective, material cues, spacing and repeated motifs. Do not invent a fresh art direction for every asset.

Use the intended game's or application's project directory. Read its `collections` and set metadata `collection` to an existing folder ID when requested; static assets and actors use the same folders. Category and family still describe the asset independently. Leave `collection` absent for automatic category grouping. Keep source IDs and paths stable when reorganizing a project.

Start with the silhouette. Reuse camera housings, leaf construction, corner shapes or other motifs only when they belong to the family you are extending. Keep stable bounding dimensions and consistent baseline placement so variants remain interchangeable. Change the requested feature deliberately while preserving the family language.

Use the authored palette. Keep colors purposeful and gradients self-contained. Treat stroke, shadow, depth and whitespace guidance as design constraints. A style schema can check objective discrepancies; it cannot decide whether a silhouette or composition looks good. Inspect snapshots at the size where the asset will actually be used.

Name assets and nodes deterministically. Store generation notes when they explain an intentional decision. Maintain family/base/variant metadata; create a new family/profile when the visual language changes rather than falsely inheriting an incompatible base.

For motion, rig semantic parts with stable SVG IDs. Pick pivots at plausible attachments. Use anticipation, overshoot and settling where useful. Offset secondary motion; avoid synchronizing every leaf or indicator. Keep looping endpoints continuous. Reuse clips and keep sequence movement separate from articulated gesture properties.

Use the feedback loop: context → sibling inspection → SVG/JSON → validation → snapshot → visual assessment → revision → export. Take more than one snapshot for motion: neutral pose, extreme pose, overlap and settling. Inspect animation in Studio before importing it elsewhere.

Export readable files and inspect the dry-run plan. Visual consistency is a relationship among assets, styles and motion, not a single automatic quality score.
