import { createServer, type Plugin, type ViteDevServer } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import {
  defaultProject,
  initProject,
  readProject,
  saveResource,
  type ResourceKind,
} from '../packages/core/src/index.ts';
import { exportProject, type ExportFormat } from '../packages/exporters/index.ts';

function apiPlugin(initialRoot: string): Plugin {
  let projectRoot = path.resolve(initialRoot),
    server: ViteDevServer;
  return {
    name: 'vectorforge-local-api',
    configureServer(s) {
      server = s;
      const watch = () => server.watcher.add(projectRoot);
      watch();
      server.watcher.on('change', (file) => {
        if (file.startsWith(projectRoot + path.sep) && !file.includes('/exports/'))
          server.ws.send({ type: 'custom', event: 'vectorforge:reload', data: { file } });
      });
      server.watcher.on('add', (file) => {
        if (file.startsWith(projectRoot + path.sep) && !file.includes('/exports/'))
          server.ws.send({ type: 'custom', event: 'vectorforge:reload', data: { file } });
      });
      server.watcher.on('unlink', (file) => {
        if (file.startsWith(projectRoot + path.sep))
          server.ws.send({ type: 'custom', event: 'vectorforge:reload', data: { file } });
      });
      server.middlewares.use(async (req, res, next) => {
        const url = new URL(req.url ?? '/', 'http://localhost');
        if (!url.pathname.startsWith('/api/')) return next();
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Cache-Control', 'no-store');
        const reply = (value: unknown, status = 200) => {
          res.statusCode = status;
          res.end(JSON.stringify(value));
        };
        try {
          if (req.method === 'GET' && url.pathname === '/api/project') {
            reply({
              ...(await readProject(projectRoot)),
              studioRoot: path.resolve(import.meta.dirname, '..'),
            });
            return;
          }
          if (req.method !== 'POST') {
            reply({ error: 'Endpoint not found.' }, 404);
            return;
          }
          if (
            req.headers['sec-fetch-site'] === 'cross-site' ||
            (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host)
          )
            throw new Error('Cross-origin writes are not permitted.');
          if (!req.headers['content-type']?.startsWith('application/json'))
            throw new Error('Use application/json for local API writes.');
          let body = '';
          for await (const chunk of req) {
            body += chunk;
            if (body.length > 4 * 1024 * 1024) throw new Error('Request exceeds 4 MB.');
          }
          const input = JSON.parse(body || '{}');
          if (url.pathname === '/api/create') {
            if (typeof input.path !== 'string' || !path.isAbsolute(input.path))
              throw new Error('Choose an absolute directory path.');
            if (typeof input.name !== 'string' || !input.name.trim())
              throw new Error('Enter a project name.');
            const destination = path.resolve(input.path);
            const contents = await fs.readdir(destination).catch((error: NodeJS.ErrnoException) => {
              if (error.code === 'ENOENT') return [];
              throw error;
            });
            if (contents.length)
              throw new Error(
                'Create a project in an empty or new directory. Existing files are protected.',
              );
            // Reject links before initializing a user-chosen directory.
            for (
              let current = destination;
              current !== path.dirname(current);
              current = path.dirname(current)
            ) {
              const info = await fs.lstat(current).catch((error: NodeJS.ErrnoException) => {
                if (error.code === 'ENOENT') return undefined;
                throw error;
              });
              if (info?.isSymbolicLink())
                throw new Error('Choose a directory without symbolic links.');
            }
            await initProject(destination, input.name.trim());
            input.path = destination;
          }
          if (url.pathname === '/api/open' || url.pathname === '/api/create') {
            const data = await readProject(input.path);
            server.watcher.unwatch(projectRoot);
            projectRoot = data.root;
            watch();
            reply({ ...data, studioRoot: path.resolve(import.meta.dirname, '..') });
            return;
          }
          if (url.pathname === '/api/save') {
            reply(
              await saveResource(projectRoot, input.kind as ResourceKind, input.data, {
                id: input.id,
                svg: input.svg,
                rig: input.rig,
                overwrite: true,
              }),
            );
            return;
          }
          if (url.pathname === '/api/export') {
            reply(
              await exportProject(await readProject(projectRoot), input.destination, {
                id: input.id || undefined,
                format: input.format as ExportFormat,
                dryRun: input.dryRun,
                overwrite: input.overwrite,
              }),
            );
            return;
          }
          if (url.pathname === '/api/snapshot') {
            const { snapshot } = await import('../packages/core/src/snapshot.ts');
            reply(
              await snapshot(projectRoot, input.id, {
                time: input.time,
                clip: input.clip,
                sequence: input.sequence,
                output: path.join(
                  projectRoot,
                  'exports/snapshots',
                  `${input.id}-${Date.now()}.png`,
                ),
              }),
            );
            return;
          }
          if (url.pathname === '/api/validate') {
            reply((await readProject(projectRoot)).issues);
            return;
          }
          reply({ error: 'Endpoint not found.' }, 404);
        } catch (error) {
          reply({ error: error instanceof Error ? error.message : String(error) }, 400);
        }
      });
    },
  };
}
export async function createStudio(project = defaultProject, port = 5173) {
  await readProject(project);
  const root = path.resolve(import.meta.dirname, '../apps/studio');
  const server = await createServer({
    configFile: false,
    root,
    plugins: [react(), apiPlugin(project)],
    server: {
      host: '127.0.0.1',
      port,
      strictPort: port !== 0,
      fs: { allow: [path.resolve(import.meta.dirname, '..')] },
    },
    logLevel: 'error',
  });
  await server.listen();
  const address = server.httpServer!.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return { server, url: `http://127.0.0.1:${actualPort}` };
}
if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(import.meta.filename)) {
  const projectIndex = process.argv.indexOf('--project');
  const { server, url } = await createStudio(
    projectIndex >= 0 ? process.argv[projectIndex + 1] : defaultProject,
  );
  console.log(
    `\n  VectorForge Studio v0.1\n  ${url}\n  Project: ${projectIndex >= 0 ? process.argv[projectIndex + 1] : defaultProject}\n`,
  );
  const close = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
