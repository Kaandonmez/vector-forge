import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
  createVariant,
  defaultProject,
  projectContext,
  readProject,
  saveResource,
  type ResourceKind,
} from '../../core/src/index.ts';
import { snapshot } from '../../core/src/snapshot.ts';
import { exportProject } from '../../exporters/index.ts';
import type { ProjectData } from '../../schema/src/index.ts';

export function createMcpServer(root = defaultProject) {
  const server = new McpServer(
    { name: 'vectorforge', version: '0.1.0' },
    {
      instructions:
        'Read project context, styles and sibling assets before generating SVG/JSON. Use create/update tools, validate, snapshot to inspect, then export. All durations use seconds. All tools operate on a local file-backed project.',
    },
  );
  const text = (value: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  });
  const register = (
    name: string,
    description: string,
    schema: Record<string, z.ZodTypeAny>,
    handler: (args: any) => Promise<any>,
  ) =>
    server.registerTool(
      `vectorforge_${name}`,
      { description, inputSchema: schema },
      async (args) => {
        try {
          return await handler(args);
        } catch (error) {
          return {
            isError: true,
            content: [
              { type: 'text', text: error instanceof Error ? error.message : String(error) },
            ],
          };
        }
      },
    );
  const project = () => readProject(root);
  register(
    'project_info',
    'Get local project metadata, root, counts and validation summary.',
    {},
    async () => {
      const p = await project();
      return text({
        root: p.root,
        project: p.project,
        counts: {
          assets: p.assets.length,
          actors: p.actors.length,
          styles: p.styles.length,
          animations: p.animations.length,
          sequences: p.sequences.length,
        },
        issues: p.issues,
      });
    },
  );
  register(
    'project_context',
    'Read machine-readable art direction, styles, families, sibling assets, available actors and motions.',
    {},
    async () => text(projectContext(await project())),
  );
  const collections = {
    style: 'styles',
    asset: 'assets',
    actor: 'actors',
    animation: 'animations',
    sequence: 'sequences',
    stateMachine: 'stateMachines',
  } as const;
  for (const [kind, collection] of Object.entries(collections) as [
    keyof typeof collections,
    keyof ProjectData,
  ][]) {
    const plural = kind === 'stateMachine' ? 'state_machines' : `${kind}s`,
      singular = kind === 'stateMachine' ? 'state_machine' : kind;
    register(
      `list_${plural}`,
      `List project ${plural}, optionally filtered by family.`,
      { family: z.string().optional() },
      async ({ family }) => {
        const data = await project();
        const list = data[collection] as any[];
        return text(list.map((e) => e.metadata ?? e).filter((e) => !family || e.family === family));
      },
    );
    register(
      `get_${singular}`,
      `Read a ${singular}, including source SVG and rig when present.`,
      { id: z.string() },
      async ({ id }) => {
        const list = (await project())[collection] as any[];
        const item = list.find((e) => (e.metadata?.id ?? e.id) === id);
        if (!item) throw new Error(`${singular} ${id} does not exist.`);
        return text(item);
      },
    );
    for (const operation of ['create', 'update'] as const)
      register(
        `${operation}_${singular}`,
        `${operation} a ${singular}. Schema and cross-references are validated before atomic file writes.`,
        {
          data: z.record(z.unknown()),
          svg: z.string().optional(),
          rig: z.record(z.unknown()).optional(),
        },
        async (args) =>
          text(
            await saveResource(root, kind as ResourceKind, args.data, {
              svg: args.svg,
              rig: args.rig,
              overwrite: operation === 'update',
            }),
          ),
      );
  }
  register(
    'update_rig',
    'Update an actor rig, validating mappings and parent cycles.',
    { actorId: z.string(), data: z.record(z.unknown()) },
    async ({ actorId, data }) =>
      text(await saveResource(root, 'rig', data, { id: actorId, overwrite: true })),
  );
  register(
    'create_variant',
    'Create a static asset variant inheriting its base family and style; supply new SVG and metadata overrides.',
    { baseId: z.string(), data: z.record(z.unknown()), svg: z.string() },
    async ({ baseId, data, svg }) => text(await createVariant(root, baseId, data, svg)),
  );
  register(
    'validate',
    'Validate the full project: schemas, SVG safety, style, variants, rigs, clips, sequences and state machines.',
    {},
    async () => {
      const data = await project();
      return text({ valid: !data.issues.some((i) => i.severity === 'error'), issues: data.issues });
    },
  );
  let previewServer:
    Awaited<ReturnType<(typeof import('../../../scripts/studio.ts'))['createStudio']>> | undefined;
  register(
    'preview',
    'Start the local Studio and return a browser URL for the selected asset, actor, animation or sequence.',
    { id: z.string().optional() },
    async ({ id }) => {
      if (!previewServer) {
        const { createStudio } = await import('../../../scripts/studio.ts');
        previewServer = await createStudio(root, 0);
      }
      return text({
        url: previewServer.url + (id ? `/?selected=${encodeURIComponent(id)}` : ''),
        project: root,
      });
    },
  );
  register(
    'snapshot',
    'Render an SVG, actor, animation or sequence at a deterministic time to a PNG and return the image.',
    {
      id: z.string(),
      time: z.number().nonnegative().optional(),
      clip: z.string().optional(),
      sequence: z.string().optional(),
      output: z.string().optional(),
      overwrite: z.boolean().optional(),
    },
    async (args) => {
      const result = await snapshot(root, args.id, args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ path: result.path, width: result.width, height: result.height }),
          },
          { type: 'image', data: result.image, mimeType: 'image/png' },
        ],
      };
    },
  );
  const exportSchema = {
    destination: z.string(),
    format: z.enum(['generic', 'web', 'flutter']).default('generic'),
    id: z.string().optional(),
    dryRun: z.boolean().default(true),
    overwrite: z.boolean().default(false),
  };
  for (const name of ['export', 'export_to_project'])
    register(
      name,
      'Plan or write a portable export. Defaults to dry run; conflicts require explicit overwrite. Actor dependencies are included.',
      exportSchema,
      async (args) => text(await exportProject(await project(), args.destination, args)),
    );
  return {
    server,
    async close() {
      await previewServer?.server.close();
      await server.close();
    },
  };
}
export async function startMcp(root = defaultProject) {
  await readProject(root);
  const mcp = createMcpServer(root);
  const transport = new StdioServerTransport();
  await mcp.server.connect(transport);
  transport.onclose = () => {
    void mcp.close();
  };
  return mcp;
}
