import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { promises as fs, existsSync, realpathSync } from 'node:fs';
import {
  defaultProject,
  initProject,
  packageRoot,
  readProject,
  saveResource,
  type ResourceKind,
} from '../packages/core/src/index.ts';
import { exportProject, type ExportFormat } from '../packages/exporters/index.ts';

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.ico': 'image/x-icon',
};

function createApiHandler(
  initialRoot: string,
  studioRoot: string,
  onProjectSwitch?: (previousRoot: string, nextRoot: string) => void,
) {
  let projectRoot = path.resolve(initialRoot);
  return {
    getProjectRoot: () => projectRoot,
    handle: async (req: IncomingMessage, res: ServerResponse): Promise<boolean> => {
      const url = new URL(req.url ?? '/', 'http://localhost');
      if (!url.pathname.startsWith('/api/')) return false;
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
            studioRoot,
          });
          return true;
        }
        if (req.method !== 'POST') {
          reply({ error: 'Endpoint not found.' }, 404);
          return true;
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
          const prev = projectRoot;
          projectRoot = data.root;
          onProjectSwitch?.(prev, projectRoot);
          reply({ ...data, studioRoot });
          return true;
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
          return true;
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
          return true;
        }
        if (url.pathname === '/api/snapshot') {
          const { snapshot } = await import('../packages/core/src/snapshot.ts');
          reply(
            await snapshot(projectRoot, input.id, {
              time: input.time,
              clip: input.clip,
              sequence: input.sequence,
              output: path.join(projectRoot, 'exports/snapshots', `${input.id}-${Date.now()}.png`),
            }),
          );
          return true;
        }
        if (url.pathname === '/api/validate') {
          reply((await readProject(projectRoot)).issues);
          return true;
        }
        reply({ error: 'Endpoint not found.' }, 404);
        return true;
      } catch (error) {
        reply({ error: error instanceof Error ? error.message : String(error) }, 400);
        return true;
      }
    },
  };
}

export async function createStudio(project = defaultProject, port = 5173) {
  await readProject(project);
  const studioRoot = packageRoot;
  const studioAppDir = path.join(studioRoot, 'apps/studio');
  const studioSrcEntry = path.join(studioAppDir, 'src/main.tsx');
  const studioDistDir = path.join(studioAppDir, 'dist');

  if (existsSync(studioSrcEntry) && process.env.VECTORFORGE_STATIC_STUDIO !== '1') {
    try {
      const [{ createServer }, { default: react }] = await Promise.all([
        import('vite'),
        import('@vitejs/plugin-react'),
      ]);
      const api = createApiHandler(project, studioRoot, (prev, next) => {
        viteServer.watcher.unwatch(prev);
        viteServer.watcher.add(next);
      });
      const viteServer = await createServer({
        configFile: false,
        root: studioAppDir,
        plugins: [
          react(),
          {
            name: 'vectorforge-local-api',
            configureServer(s) {
              s.watcher.add(api.getProjectRoot());
              const notify = (file: string) => {
                const root = api.getProjectRoot();
                if (file.startsWith(root + path.sep) && !file.includes('/exports/'))
                  s.ws.send({ type: 'custom', event: 'vectorforge:reload', data: { file } });
              };
              s.watcher.on('change', notify);
              s.watcher.on('add', notify);
              s.watcher.on('unlink', (file) => {
                const root = api.getProjectRoot();
                if (file.startsWith(root + path.sep))
                  s.ws.send({ type: 'custom', event: 'vectorforge:reload', data: { file } });
              });
              s.middlewares.use(async (req, res, next) => {
                if (!(await api.handle(req, res))) next();
              });
            },
          },
        ],
        server: {
          host: '127.0.0.1',
          port,
          strictPort: port !== 0,
          fs: { allow: [studioRoot] },
        },
        logLevel: 'error',
      });
      await viteServer.listen();
      const address = viteServer.httpServer!.address();
      const actualPort = typeof address === 'object' && address ? address.port : port;
      return { server: viteServer, url: `http://127.0.0.1:${actualPort}` };
    } catch (error) {
      if (!existsSync(path.join(studioDistDir, 'index.html'))) throw error;
    }
  }

  if (!existsSync(path.join(studioDistDir, 'index.html'))) {
    throw new Error(
      `Studio build not found at ${studioDistDir}. Run "pnpm build" inside VectorForge first.`,
    );
  }

  const api = createApiHandler(project, studioRoot);
  const httpServer = http.createServer(async (req, res) => {
    if (await api.handle(req, res)) return;
    const url = new URL(req.url ?? '/', 'http://localhost');
    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname);
    const resolved = path.resolve(studioDistDir, '.' + pathname);
    if (resolved !== studioDistDir && !resolved.startsWith(studioDistDir + path.sep)) {
      res.statusCode = 403;
      res.end('Forbidden');
      return;
    }
    try {
      const stat = await fs.stat(resolved);
      const target = stat.isDirectory() ? path.join(resolved, 'index.html') : resolved;
      const ext = path.extname(target).toLowerCase();
      res.setHeader('Content-Type', MIME_TYPES[ext] ?? 'application/octet-stream');
      res.end(await fs.readFile(target));
    } catch {
      res.statusCode = 404;
      res.end('Not found');
    }
  });

  await new Promise<void>((resolve, reject) => {
    httpServer.once('error', reject);
    httpServer.listen(port, '127.0.0.1', () => resolve());
  });
  const address = httpServer.address();
  const actualPort = typeof address === 'object' && address ? address.port : port;
  return {
    server: {
      close: () =>
        new Promise<void>((resolve, reject) =>
          httpServer.close((err) => (err ? reject(err) : resolve())),
        ),
    },
    url: `http://127.0.0.1:${actualPort}`,
  };
}

function isStudioMainModule(): boolean {
  if (!process.argv[1] || !path.basename(process.argv[1]).startsWith('studio.')) return false;
  try {
    return realpathSync(process.argv[1]) === realpathSync(import.meta.filename);
  } catch {
    return path.resolve(process.argv[1]) === path.resolve(import.meta.filename);
  }
}

if (isStudioMainModule()) {
  const projectIndex = process.argv.indexOf('--project');
  const target = projectIndex >= 0 ? process.argv[projectIndex + 1] : defaultProject;
  const { server, url } = await createStudio(target);
  console.log(`\n  VectorForge Studio v0.1\n  ${url}\n  Project: ${target}\n`);
  const close = async () => {
    await server.close();
    process.exit(0);
  };
  process.on('SIGINT', close);
  process.on('SIGTERM', close);
}
