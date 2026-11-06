# VectorForge Starter Examples

These examples show real, schema-compliant payloads for the `vectorforge_*` MCP tools.

---

## Example 1 — Create a Style Profile (`vectorforge_create_style`)

If your project is freshly initialized (`vectorforge init`) and has no styles yet, create a style profile first and set it as `defaultStyle`:

```json
{
  "data": {
    "schemaVersion": 1,
    "id": "clean-ui",
    "name": "Clean Tactile UI",
    "description": "High-contrast flat vector icons with subtle layered highlights.",
    "palette": ["#1E293B", "#334155", "#0EA5E9", "#38BDF8", "#F8FAFC", "#F59E0B"],
    "prohibitedColors": ["#FF00FF", "#00FF00"],
    "maxColors": 6,
    "stroke": {
      "enabled": true,
      "width": 2,
      "maxWidth": 4,
      "colors": ["#1E293B", "#334155"]
    },
    "guidance": "Use 128x128 viewBox with 16px outer padding, rounded corners (rx=12), and top-left highlight accents."
  }
}
```

---

## Example 2 — Create a Static SVG Asset (`vectorforge_create_asset`)

Call `vectorforge_create_asset` with matching `width`, `height`, and `viewBox`:

```json
{
  "data": {
    "schemaVersion": 1,
    "id": "badge-shield-base",
    "name": "Security Shield Badge",
    "category": "badges",
    "tags": ["security", "shield", "ui"],
    "style": "clean-ui",
    "family": "security-badges",
    "width": 128,
    "height": 128,
    "viewBox": [0, 0, 128, 128],
    "generationNotes": "Base shield silhouette with centered core emblem."
  },
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"128\" height=\"128\" viewBox=\"0 0 128 128\"><g id=\"shield-root\"><path id=\"shield-outer\" d=\"M64 16 L108 32 V64 C108 92 64 112 64 112 C64 112 20 92 20 64 V32 Z\" fill=\"#1E293B\" stroke=\"#334155\" stroke-width=\"2\"/><path id=\"shield-inner\" d=\"M64 26 L98 39 V63 C98 84 64 101 64 101 C64 101 30 84 30 63 V39 Z\" fill=\"#0EA5E9\"/><circle id=\"shield-core\" cx=\"64\" cy=\"62\" r=\"14\" fill=\"#F8FAFC\"/></g></svg>"
}
```

---

## Example 3 — Create a Sibling Variant (`vectorforge_create_variant`)

Call `vectorforge_create_variant` referencing `baseId: "badge-shield-base"`. VectorForge automatically inherits `style`, `family`, `width`, `height`, `viewBox`, and links `baseAsset: "badge-shield-base"`:

```json
{
  "baseId": "badge-shield-base",
  "data": {
    "id": "badge-shield-gold",
    "name": "Security Shield Badge (Gold Tier)",
    "variant": "gold-tier",
    "tags": ["security", "shield", "gold", "ui"],
    "generationNotes": "Gold emblem variant preserving outer shield silhouette."
  },
  "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" width=\"128\" height=\"128\" viewBox=\"0 0 128 128\"><g id=\"shield-root\"><path id=\"shield-outer\" d=\"M64 16 L108 32 V64 C108 92 64 112 64 112 C64 112 20 92 20 64 V32 Z\" fill=\"#1E293B\" stroke=\"#334155\" stroke-width=\"2\"/><path id=\"shield-inner\" d=\"M64 26 L98 39 V63 C98 84 64 101 64 101 C64 101 30 84 30 63 V39 Z\" fill=\"#334155\"/><circle id=\"shield-core\" cx=\"64\" cy=\"62\" r=\"16\" fill=\"#F59E0B\"/><circle id=\"shield-highlight\" cx=\"59\" cy=\"57\" r=\"5\" fill=\"#F8FAFC\"/></g></svg>"
}
```

---

## Example 4 — Validate, Snapshot & Export

1. **Validate**:

   ```json
   // Tool: vectorforge_validate
   {}
   ```

   Expected result: `{ "valid": true, "issues": [] }`.

2. **Snapshot**:

   ```json
   // Tool: vectorforge_snapshot
   {
     "id": "badge-shield-gold",
     "overwrite": true
   }
   ```

   Inspect the returned PNG image and confirm no clipping or off-palette artifacts exist.

3. **Export (Dry Run first, then Write)**:
   ```json
   // Tool: vectorforge_export (Step 1: Dry Run)
   {
     "destination": "./exports/flutter-badges",
     "id": "badge-shield-gold",
     "format": "flutter",
     "dryRun": true,
     "overwrite": false
   }
   ```
   Notice that exporting `badge-shield-gold` automatically includes its base asset (`badge-shield-base`), style profile (`clean-ui`), `vectorforge.manifest.json`, and `pubspec-assets.yaml`. Then write the files:
   ```json
   // Tool: vectorforge_export (Step 2: Write)
   {
     "destination": "./exports/flutter-badges",
     "id": "badge-shield-gold",
     "format": "flutter",
     "dryRun": false,
     "overwrite": false
   }
   ```
