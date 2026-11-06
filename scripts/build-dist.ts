import { build } from 'vite';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');
const distDir = path.join(repoRoot, 'dist');

async function buildDist() {
  await fs.rm(distDir, { recursive: true, force: true });
  await fs.mkdir(distDir, { recursive: true });

  // 1. Pre-build standalone browser motion runtime for web exporter
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      outDir: distDir,
      emptyOutDir: false,
      minify: false,
      lib: {
        entry: path.join(repoRoot, 'packages/exporters/web/src/runtime.ts'),
        formats: ['es'],
        fileName: () => 'vectorforge-runtime.js',
      },
    },
  });

  // 2. Compile Node ESM entrypoints (cli, mcp, core/index) without requiring tsx at runtime
  const externalPackages = [
    /^node:/,
    '@modelcontextprotocol/sdk',
    /^@modelcontextprotocol\/sdk\//,
    '@xmldom/xmldom',
    'zod',
    'vite',
    '@vitejs/plugin-react',
    '@playwright/test',
    'playwright',
    'playwright-core',
  ];

  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      outDir: distDir,
      emptyOutDir: false,
      minify: false,
      target: 'node22',
      ssr: true,
      lib: {
        entry: {
          cli: path.join(repoRoot, 'packages/cli/src/index.ts'),
          mcp: path.join(repoRoot, 'packages/mcp/src/index.ts'),
          index: path.join(repoRoot, 'packages/core/src/index.ts'),
        },
        formats: ['es'],
        fileName: (_format, entryName) => `${entryName}.js`,
      },
      rollupOptions: {
        external: externalPackages,
      },
    },
  });

  const cliPath = path.join(distDir, 'cli.js');
  const cliContent = await fs.readFile(cliPath, 'utf8');
  const normalizedCli = cliContent.startsWith('#!')
    ? cliContent
    : `#!/usr/bin/env node\n${cliContent}`;
  await fs.writeFile(cliPath, normalizedCli, 'utf8');
  await fs.chmod(cliPath, 0o755);

  const mcpBinPath = path.join(distDir, 'mcp-bin.js');
  const mcpBinContent = `#!/usr/bin/env node
import { main } from './cli.js';
const rawArgs = process.argv.slice(2);
const forwarded = rawArgs[0] === 'mcp' ? rawArgs : ['mcp', ...rawArgs];
main(forwarded).catch((error) => {
  console.error(\`VectorForge: \${error instanceof Error ? error.message : String(error)}\`);
  process.exitCode = 1;
});
`;
  await fs.writeFile(mcpBinPath, mcpBinContent, 'utf8');
  await fs.chmod(mcpBinPath, 0o755);
}

await buildDist();
