# Projects and asset organization

Use one VectorForge directory per game, website or application. The Studio opens the bundled demo initially. The project picker opens an existing directory or creates an empty project. Creation requires a new or empty directory and rejects symbolic links; existing files are protected. Recent project shortcuts are saved in this browser, with at most 12 entries. The running Studio uses one active project directory at a time; a CLI or MCP process keeps its own `--project` directory.

The sidebar tree starts with the active project. Its folders contain both static SVG assets and actors. Asset branches reveal variants; actors additionally reveal nested rig parts, clips, sequences and state machines. Styles are shared at the project level. Expand a branch with its chevron or arrow keys; select its label to open its content. Tree search preserves the ancestry of matches. Click a thumbnail to open preview and the Inspector; breadcrumbs and **Back to folder** return to the grid. Mobile exposes the same tree through the top-bar button.

**New folder** creates a named collection at the project root or beneath the selected authored folder. **Edit folder** renames it or changes its parent. The Inspector's **Asset folder** dropdown moves an asset into an authored folder; **Automatic** restores category-based grouping. Folder counts and grids include descendants. Static/animated filters affect the grid rather than the stored organization. **Browse by type** provides the original asset, actor and motion views.

For example, author these fields in `vectorforge.context.json`, alongside the project's rules and export destinations:

```json
{
  "schemaVersion": 1,
  "collections": [
    { "id": "characters", "name": "Characters" },
    { "id": "hero", "name": "Main character", "parentId": "characters" },
    { "id": "interface", "name": "Interface" }
  ]
}
```

Set `"collection": "hero"` in an asset or actor's metadata. Folder IDs follow normal resource ID conventions. Names can be any nonempty text. Missing parents, duplicate IDs, parent cycles and missing asset assignments are validation errors; invalid saves preserve prior files. A folder referenced by assets cannot be removed from context until those assets are reassigned. Metadata category, family and style remain separate from folder membership. Variants are nested under their base within a folder; a variant placed in a different folder remains independently visible there.

Folder definitions and memberships are normal JSON, visible in MCP project context and retained by exports. A coding agent should read the target project's context, choose an existing collection ID when appropriate, then create or update the asset/actor metadata through CLI or MCP. To author folders programmatically, update the context through `pnpm vectorforge update context ./context.json --project /absolute/project`; create the context first if an older project does not have one. Source files stay in `assets/<id>` and `actors/<id>`, so rig mappings, animation IDs and consumer paths remain stable.

Recent-project shortcuts and expanded branches are browser preferences; collections and assignments travel with the project files. Older projects without collections still work and use their categories as automatic folders. No database or migration is needed.
