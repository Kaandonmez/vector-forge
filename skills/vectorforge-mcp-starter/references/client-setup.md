# VectorForge MCP Client Setup Guide

VectorForge runs a local stdio Model Context Protocol server (`vectorforge mcp`). Each MCP server process binds strictly to **one project directory** (`--project <path>`) so separate projects never overwrite or pollute each other's files.

> **Package Status Note:**
>
> - **Local Tarball / Built Repository (Works Today):** Run the compiled binary `dist/cli.js` (after `pnpm build`) or install from the local `.tgz` tarball produced by `npm pack`.
> - **After npm Publication:** Once `vectorforge` is published to the npm registry, `npx -y vectorforge mcp --project <path>` will work without a local clone.

---

## Step 0 — Initialize a Project Directory (If Needed)

Before connecting an MCP client to a new project folder, initialize it (or pass `--init` to `vectorforge mcp`):

```bash
# Using a local build or global install:
vectorforge init ./my-vector-project --name "My Game Assets"

# Or inside the VectorForge repository:
pnpm vectorforge init ./projects/my-vector-project --name "My Game Assets"
```

Verify your environment with `doctor`:

```bash
vectorforge doctor --project ./my-vector-project
```

---

## 1. Claude Code

Add VectorForge scoped to your current project using the Claude Code CLI, or commit a `.mcp.json` file at your project root.

### Option A: CLI registration (Global or local tarball installed)

```bash
claude mcp add vectorforge -- vectorforge mcp --project . --init
```

### Option B: Project `.mcp.json` (Portable across team members)

Create `.mcp.json` in the root of your project directory:

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

_(If running from a local VectorForge repository checkout before npm publish, set `"command": "node"` and `"args": ["/path/to/vector_forge/dist/cli.js", "mcp", "--project", "."]`.)_

---

## 2. Cursor

Create `.cursor/mcp.json` inside your project workspace:

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

If you installed the local tarball in your project (`npm install -D /path/to/vectorforge-0.1.0.tgz`) or built the repository locally, `npx vectorforge` resolves the locally installed binary automatically.

---

## 3. VS Code / GitHub Copilot

Create `.vscode/mcp.json` in your workspace:

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

---

## 4. Generic MCP-Compatible Clients (Claude Desktop, Codex CLI, Windsurf, Custom SDK Clients)

Any MCP client supporting stdio transport can launch VectorForge by passing `--project <project-directory>` (or setting the `VECTORFORGE_PROJECT` environment variable):

```json
{
  "mcpServers": {
    "vectorforge": {
      "command": "vectorforge",
      "args": ["mcp", "--project", "/path/to/your/vectorforge-project"]
    }
  }
}
```

### Project Isolation Guarantee

- Every `vectorforge mcp` instance resolves `--project` (or `VECTORFORGE_PROJECT`, or the current working directory if `vectorforge.project.json` is present) once at startup and locks all file reads/writes to that directory.
- Path traversal (`../`) and symbolic links are rejected by `safePath`.
- Pass `--init` (`vectorforge mcp --project ./my-project --init`) if you want the MCP server to initialize an empty project directory automatically on first launch.
