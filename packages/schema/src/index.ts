import { z } from 'zod';
import { isKnownEasing } from './easing.ts';
export { easingNames } from './easing.ts';

export const idSchema = z
  .string()
  .regex(
    /^[a-zA-Z][a-zA-Z0-9_-]*$/,
    'Use letters, numbers, hyphens or underscores; start with a letter.',
  );
const version = { schemaVersion: z.literal(1) };
const finite = z.number().finite();
export const easingSchema = z
  .string()
  .refine(
    isKnownEasing,
    'Unknown easing. Use a built-in name or register an easing before loading project data.',
  );
export const projectSchema = z
  .object({
    ...version,
    name: z.string().min(1),
    defaultStyle: idSchema.optional(),
    description: z.string().optional(),
  })
  .passthrough();
export const contextSchema = z
  .object({
    ...version,
    collections: z
      .array(
        z.object({
          id: idSchema,
          name: z.string().trim().min(1),
          parentId: idSchema.optional(),
        }),
      )
      .default([]),
    rules: z.array(z.string()).default([]),
    namingConventions: z.string().default('lowercase-kebab-case'),
    exportDestinations: z.record(z.string()).default({}),
  })
  .passthrough();
export const styleSchema = z
  .object({
    ...version,
    id: idSchema,
    name: z.string().min(1),
    description: z.string().optional(),
    palette: z.array(z.string()).min(1),
    prohibitedColors: z.array(z.string()).default([]),
    maxColors: z.number().int().positive().optional(),
    stroke: z
      .object({
        enabled: z.boolean(),
        width: finite.nonnegative().optional(),
        maxWidth: finite.nonnegative().optional(),
        colors: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
    geometry: z.record(z.unknown()).optional(),
    lighting: z.record(z.unknown()).optional(),
    perspective: z.record(z.unknown()).optional(),
    motion: z
      .object({
        defaultEasing: easingSchema.optional(),
        overshoot: finite.optional(),
        anticipation: finite.optional(),
        personality: z.string().optional(),
      })
      .passthrough()
      .optional(),
    guidance: z.string().optional(),
    references: z.array(z.string()).default([]),
  })
  .passthrough();
export const assetSchema = z
  .object({
    ...version,
    id: idSchema,
    name: z.string().min(1),
    category: z.string().default('uncategorized'),
    collection: idSchema.optional(),
    tags: z.array(z.string()).default([]),
    style: idSchema,
    family: idSchema.optional(),
    baseAsset: idSchema.optional(),
    variant: z.string().optional(),
    width: finite.positive(),
    height: finite.positive(),
    viewBox: z.tuple([finite, finite, finite.positive(), finite.positive()]),
    generationNotes: z.string().optional(),
    source: z.string().optional(),
  })
  .passthrough();
export const actorSchema = assetSchema.extend({
  clips: z.array(idSchema).default([]),
  stateMachine: idSchema.optional(),
});
export const rigSchema = z
  .object({
    ...version,
    actorId: idSchema,
    nodes: z.record(
      idSchema,
      z
        .object({
          svgId: idSchema,
          parent: idSchema.optional(),
          pivot: z.tuple([finite, finite]).default([0.5, 0.5]),
          pivotSpace: z.enum(['normalized', 'absolute']).default('normalized'),
        })
        .passthrough(),
    ),
  })
  .passthrough();
export const keyframeSchema = z.object({
  time: finite.nonnegative(),
  value: z.union([
    finite,
    z.string().regex(/^#[a-fA-F0-9]{6}$/, 'Color keyframes must use #RRGGBB.'),
  ]),
  easing: easingSchema.optional(),
});
export const properties = [
  'position.x',
  'position.y',
  'rotation',
  'scale.x',
  'scale.y',
  'opacity',
  'fill',
  'stroke',
] as const;
export const animationSchema = z
  .object({
    ...version,
    id: idSchema,
    name: z.string().optional(),
    actorId: idSchema,
    duration: finite.positive(),
    loop: z.boolean().default(false),
    tracks: z.record(z.string(), z.array(keyframeSchema).min(1)),
  })
  .superRefine((clip, ctx) => {
    for (const [track, frames] of Object.entries(clip.tracks)) {
      const dot = track.indexOf('.');
      const property = track.slice(dot + 1);
      if (dot < 1 || !properties.includes(property as (typeof properties)[number]))
        ctx.addIssue({
          code: 'custom',
          path: ['tracks', track],
          message:
            'Expected node.property (position.x/y, rotation, scale.x/y, opacity, fill, stroke).',
        });
      let previous = -1;
      for (const [i, frame] of frames.entries()) {
        if (frame.time <= previous || frame.time > clip.duration)
          ctx.addIssue({
            code: 'custom',
            path: ['tracks', track, i],
            message: 'Keyframes must be strictly increasing and within clip duration (seconds).',
          });
        if ((property === 'fill' || property === 'stroke') !== (typeof frame.value === 'string'))
          ctx.addIssue({
            code: 'custom',
            path: ['tracks', track, i, 'value'],
            message: 'Use #RRGGBB for color tracks and numbers for other tracks.',
          });
        if (
          property === 'opacity' &&
          typeof frame.value === 'number' &&
          (frame.value < 0 || frame.value > 1)
        )
          ctx.addIssue({
            code: 'custom',
            path: ['tracks', track, i, 'value'],
            message: 'Opacity must be between 0 and 1.',
          });
        previous = frame.time;
      }
    }
  });
export type Action =
  | { action: 'play'; clip: string; duration?: number }
  | { action: 'wait'; duration: number }
  | {
      action: 'moveTo';
      target: string;
      x: number;
      y: number;
      duration: number;
      easing?: z.infer<typeof easingSchema>;
    }
  | {
      action: 'rotateTo';
      target: string;
      rotation: number;
      duration: number;
      easing?: z.infer<typeof easingSchema>;
    }
  | { action: 'parallel'; steps: Action[] }
  | { action: 'repeat'; count: number; steps: Action[] };
export const actionSchema: z.ZodType<Action> = z.lazy(() =>
  z.discriminatedUnion('action', [
    z.object({ action: z.literal('play'), clip: idSchema, duration: finite.positive().optional() }),
    z.object({ action: z.literal('wait'), duration: finite.nonnegative() }),
    z.object({
      action: z.literal('moveTo'),
      target: idSchema,
      x: finite,
      y: finite,
      duration: finite.positive(),
      easing: easingSchema.optional(),
    }),
    z.object({
      action: z.literal('rotateTo'),
      target: idSchema,
      rotation: finite,
      duration: finite.positive(),
      easing: easingSchema.optional(),
    }),
    z.object({ action: z.literal('parallel'), steps: z.array(actionSchema).min(1) }),
    z.object({
      action: z.literal('repeat'),
      count: z.number().int().min(1).max(100),
      steps: z.array(actionSchema).min(1),
    }),
  ]),
);
export const sequenceSchema = z.object({
  ...version,
  id: idSchema,
  name: z.string(),
  actorId: idSchema,
  loop: z.boolean().default(false),
  steps: z.array(actionSchema).min(1),
});
export const stateMachineSchema = z.object({
  ...version,
  id: idSchema,
  actorId: idSchema,
  initial: idSchema,
  states: z.record(
    idSchema,
    z.object({
      clip: idSchema.optional(),
      transitions: z
        .array(
          z.object({
            to: idSchema,
            event: z.string().optional(),
            condition: z.string().optional(),
            onComplete: z.boolean().optional(),
          }),
        )
        .default([]),
    }),
  ),
});
export type Project = z.infer<typeof projectSchema>;
export type Context = z.infer<typeof contextSchema>;
export type Style = z.infer<typeof styleSchema>;
export type Asset = z.infer<typeof assetSchema>;
export type Actor = z.infer<typeof actorSchema>;
export type Rig = z.infer<typeof rigSchema>;
export type Animation = z.infer<typeof animationSchema>;
export type Sequence = z.infer<typeof sequenceSchema>;
export type StateMachine = z.infer<typeof stateMachineSchema>;
export type Severity = 'error' | 'warning' | 'info';
export type Issue = { severity: Severity; code: string; path: string; message: string };
export type AssetEntry = { metadata: Asset; svg: string; path: string };
export type ActorEntry = { metadata: Actor; svg: string; rig: Rig; path: string };
export type ProjectData = {
  root: string;
  studioRoot?: string;
  project: Project;
  context: Context;
  styles: Style[];
  assets: AssetEntry[];
  actors: ActorEntry[];
  animations: Animation[];
  sequences: Sequence[];
  stateMachines: StateMachine[];
  issues: Issue[];
};
