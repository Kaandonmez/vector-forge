import { describe, expect, it } from 'vitest';
import {
  animationSchema,
  assetSchema,
  easingNames,
  projectSchema,
  rigSchema,
  sequenceSchema,
  stateMachineSchema,
  styleSchema,
} from '../packages/schema/src/index.ts';
import {
  compileSequence,
  easings,
  evaluateAnimation,
  evaluateSequence,
  hierarchyOrder,
  interpolate,
  registerEasing,
  Machine,
  Playback,
} from '../packages/motion/src/index.ts';
import { inspectSvg } from '../packages/svg/src/index.ts';
import { defaultProject, readProject, validateProject } from '../packages/core/src/index.ts';

const clip = animationSchema.parse({
  schemaVersion: 1,
  id: 'turn',
  actorId: 'object',
  duration: 2,
  loop: false,
  tracks: {
    'leaf.rotation': [
      { time: 0, value: 0 },
      { time: 2, value: 90 },
    ],
  },
});
const source =
  '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><g id="root"><rect id="leaf" width="20" height="20" fill="#203c32"/></g></svg>';
const metadata = assetSchema.parse({
  schemaVersion: 1,
  id: 'object',
  name: 'Object',
  style: 'forest',
  width: 100,
  height: 100,
  viewBox: [0, 0, 100, 100],
});

describe('versioned portable schemas', () => {
  it('accepts extensible style profiles with defaults', () => {
    const style = styleSchema.parse({
      schemaVersion: 1,
      id: 'forest',
      name: 'Forest',
      palette: ['#203c32'],
      customRule: 'quiet',
    });
    expect(style.customRule).toBe('quiet');
    expect(style.prohibitedColors).toEqual([]);
  });
  it('rejects unsupported project versions', () =>
    expect(projectSchema.safeParse({ schemaVersion: 2, name: 'Future' }).success).toBe(false));
  it('rejects unsafe resource IDs and zero dimensions', () => {
    expect(assetSchema.safeParse({ ...metadata, id: '../escape' }).success).toBe(false);
    expect(assetSchema.safeParse({ ...metadata, width: 0 }).success).toBe(false);
  });
  it('rejects unsorted, duplicated and out-of-duration keyframes', () => {
    for (const times of [
      [1, 0],
      [0, 0],
      [0, 3],
    ])
      expect(
        animationSchema.safeParse({
          ...clip,
          tracks: { 'leaf.rotation': times.map((time) => ({ time, value: 1 })) },
        }).success,
      ).toBe(false);
  });
  it('rejects unknown properties, easings and mismatched colors', () => {
    expect(
      animationSchema.safeParse({ ...clip, tracks: { 'leaf.blur': [{ time: 0, value: 1 }] } })
        .success,
    ).toBe(false);
    expect(
      animationSchema.safeParse({
        ...clip,
        tracks: { 'leaf.rotation': [{ time: 0, value: 1, easing: 'mystery' }] },
      }).success,
    ).toBe(false);
    expect(
      animationSchema.safeParse({ ...clip, tracks: { 'leaf.fill': [{ time: 0, value: 1 }] } })
        .success,
    ).toBe(false);
    expect(
      animationSchema.safeParse({ ...clip, tracks: { 'leaf.opacity': [{ time: 0, value: 2 }] } })
        .success,
    ).toBe(false);
  });
  it('validates recursive parallel/repeat actions and limits repeat counts', () => {
    const input = {
      schemaVersion: 1,
      id: 'test',
      name: 'Test',
      actorId: 'object',
      steps: [
        {
          action: 'repeat',
          count: 2,
          steps: [{ action: 'parallel', steps: [{ action: 'wait', duration: 1 }] }],
        },
      ],
    };
    expect(sequenceSchema.safeParse(input).success).toBe(true);
    expect(
      sequenceSchema.safeParse({ ...input, steps: [{ action: 'repeat', count: 1000, steps: [] }] })
        .success,
    ).toBe(false);
  });
});

describe('deterministic motion', () => {
  it('registers a new easing in both runtime and schema validation', () => {
    registerEasing('gentleCustom', (t) => t ** 4);
    const custom = animationSchema.parse({
      ...clip,
      tracks: {
        'leaf.rotation': [
          { time: 0, value: 0 },
          { time: 2, value: 90, easing: 'gentleCustom' },
        ],
      },
    });
    expect(evaluateAnimation(custom, 1).leaf.rotation).toBe(90 / 16);
  });
  it('clamps eased opacity without suppressing rotation overshoot', () => {
    const animated = animationSchema.parse({
      ...clip,
      tracks: {
        'leaf.opacity': [
          { time: 0, value: 0 },
          { time: 2, value: 1, easing: 'easeOutBack' },
        ],
      },
    });
    expect(evaluateAnimation(animated, 1.3).leaf.opacity).toBe(1);
  });
  it.each(easingNames)('%s starts at zero and ends at one', (name) => {
    expect(easings[name](0)).toBeCloseTo(0);
    expect(easings[name](1)).toBeCloseTo(1);
    expect(Number.isFinite(easings[name](0.4))).toBe(true);
  });
  it('uses easing attached to the destination keyframe', () => {
    const eased = {
      ...clip,
      tracks: {
        'leaf.rotation': [
          { time: 0, value: 0 },
          { time: 2, value: 90, easing: 'easeInQuad' as const },
        ],
      },
    };
    expect(evaluateAnimation(eased, 1).leaf.rotation).toBe(22.5);
  });
  it('interpolates, clamps and wraps time, including negative loop time', () => {
    expect(evaluateAnimation(clip, 1).leaf.rotation).toBe(45);
    expect(evaluateAnimation(clip, 3).leaf.rotation).toBe(90);
    expect(evaluateAnimation(clip, -1).leaf.rotation).toBe(0);
    expect(evaluateAnimation(clip, 3, true).leaf.rotation).toBe(45);
    expect(evaluateAnimation(clip, -1, true).leaf.rotation).toBe(45);
  });
  it('interpolates colors and bounds overshooting channels', () => {
    expect(interpolate('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(interpolate('#000000', '#ffffff', 1.2)).toBe('#ffffff');
    expect(easings.easeOutBack(0.65)).toBeGreaterThan(1);
  });
  it('supports play/pause/stop/restart/seek, speed and reverse', () => {
    const player = new Playback(2);
    player.play();
    player.advance(0.5);
    expect(player.time).toBe(0.5);
    player.pause();
    player.advance(1);
    expect(player.time).toBe(0.5);
    player.seek(10);
    expect(player.time).toBe(2);
    player.restart();
    player.speed = 2;
    player.advance(0.25);
    expect(player.time).toBe(0.5);
    player.speed = -1;
    player.advance(0.2);
    expect(player.time).toBeCloseTo(0.3);
    player.stop();
    expect(player.time).toBe(0);
    expect(player.playing).toBe(false);
  });
  it('ends non-looping playback and wraps looping playback without drift', () => {
    const p = new Playback(1);
    p.play();
    p.advance(2);
    expect(p.playing).toBe(false);
    expect(p.time).toBe(1);
    p.loop = true;
    p.restart();
    p.advance(2.25);
    expect(p.time).toBe(0.25);
    expect(p.playing).toBe(true);
  });
  it('orders parents before children and rejects cycles/missing parents', () => {
    const rig = rigSchema.parse({
      schemaVersion: 1,
      actorId: 'object',
      nodes: { leaf: { svgId: 'leaf', parent: 'root' }, root: { svgId: 'root' } },
    });
    expect(hierarchyOrder(rig)).toEqual(['root', 'leaf']);
    expect(() =>
      hierarchyOrder({
        ...rig,
        nodes: { ...rig.nodes, root: { ...rig.nodes.root, parent: 'leaf' } },
      }),
    ).toThrow('cycle');
    expect(() => hierarchyOrder({ ...rig, nodes: { leaf: rig.nodes.leaf } })).toThrow(
      'does not exist',
    );
  });
  it('executes every sequence action and holds transforms through waits', () => {
    const seq = sequenceSchema.parse({
      schemaVersion: 1,
      id: 'demo',
      name: 'Demo',
      actorId: 'object',
      loop: false,
      steps: [
        { action: 'moveTo', target: 'root', x: 100, y: 20, duration: 2, easing: 'linear' },
        { action: 'wait', duration: 1 },
        {
          action: 'parallel',
          steps: [
            { action: 'play', clip: 'turn' },
            { action: 'rotateTo', target: 'root', rotation: 45, duration: 1, easing: 'linear' },
          ],
        },
        { action: 'repeat', count: 2, steps: [{ action: 'wait', duration: 0.5 }] },
        { action: 'moveTo', target: 'root', x: 0, y: 0, duration: 1, easing: 'linear' },
      ],
    });
    const compiled = compileSequence(seq, [clip]);
    expect(compiled.duration).toBe(7);
    expect(evaluateSequence(compiled, 1).root['position.x']).toBe(50);
    expect(evaluateSequence(compiled, 2.5).root['position.x']).toBe(100);
    expect(evaluateSequence(compiled, 4).leaf.rotation).toBe(45);
    expect(evaluateSequence(compiled, 5.5).root.rotation).toBe(45);
    expect(evaluateSequence(compiled, 6.5).root['position.x']).toBe(50);
    expect(evaluateSequence(compiled, 7).root['position.x']).toBe(0);
  });
  it('rejects missing sequence clips and explosive nested repeats', () => {
    const seq = sequenceSchema.parse({
      schemaVersion: 1,
      id: 'bad',
      name: 'Bad',
      actorId: 'object',
      steps: [{ action: 'play', clip: 'missing' }],
    });
    expect(() => compileSequence(seq, [])).toThrow('missing');
    const many = {
      ...seq,
      steps: [
        {
          action: 'repeat' as const,
          count: 100,
          steps: [
            {
              action: 'repeat' as const,
              count: 100,
              steps: [{ action: 'wait' as const, duration: 0.01 }],
            },
          ],
        },
      ],
    };
    expect(() => compileSequence(many, [])).toThrow('10,000');
  });
  it('transitions on events, explicit conditions and animation completion', () => {
    const definition = stateMachineSchema.parse({
      schemaVersion: 1,
      id: 'states',
      actorId: 'object',
      initial: 'idle',
      states: {
        idle: {
          clip: 'turn',
          transitions: [
            { event: 'go', to: 'work' },
            { condition: 'busy', to: 'work' },
          ],
        },
        work: { transitions: [{ onComplete: true, to: 'idle' }] },
      },
    });
    const machine = new Machine(definition);
    expect(machine.transition('unknown')).toBe(false);
    expect(machine.transition('go')).toBe(true);
    expect(machine.state).toBe('work');
    machine.transition(undefined, {}, true);
    expect(machine.state).toBe('idle');
    machine.transition(undefined, { busy: true });
    expect(machine.state).toBe('work');
  });
});

describe('SVG and project validation', () => {
  it('reads viewBox, IDs and normalized color values', () => {
    const info = inspectSvg(source);
    expect(info.ids).toEqual(['root', 'leaf']);
    expect(info.colors).toEqual(['#203c32']);
    expect(info.issues).toEqual([]);
  });
  it.each([
    ['missing viewBox', '<svg xmlns="http://www.w3.org/2000/svg"/>', 'SVG_VIEWBOX'],
    ['duplicate IDs', source.replace('id="leaf"', 'id="root"'), 'SVG_DUPLICATE_ID'],
    [
      'external href',
      source.replace('<rect ', '<use href="https://example.org/a.svg"/><rect '),
      'SVG_UNSAFE',
    ],
    ['scripts', source.replace('</svg>', '<script>alert(1)</script></svg>'), 'SVG_UNSAFE'],
    ['event handlers', source.replace('<rect ', '<rect onclick="alert(1)" '), 'SVG_UNSAFE'],
    [
      'external entity',
      '<!DOCTYPE svg [<!ENTITY secret SYSTEM "file:///secret">]>' + source,
      'SVG_UNSAFE',
    ],
    [
      'missing reference',
      source.replace('</svg>', '<use href="#missing"/></svg>'),
      'SVG_REFERENCE',
    ],
    ['malformed markup', source.replace('</g>', ''), 'SVG_PARSE'],
  ])('rejects %s', (_label, svg, code) =>
    expect(inspectSvg(svg).issues.some((i) => i.code === code && i.severity === 'error')).toBe(
      true,
    ),
  );
  it('reports palette, prohibited colors, stroke and dimension violations', () => {
    const style = styleSchema.parse({
      schemaVersion: 1,
      id: 'forest',
      name: 'Forest',
      palette: ['#ffffff'],
      prohibitedColors: ['#203c32'],
      stroke: { enabled: false, maxWidth: 2 },
    });
    const issues = inspectSvg(
      source.replace('<rect ', '<rect stroke="#ff0000" stroke-width="5" '),
      'source.svg',
      style,
      { ...metadata, width: 80 },
    ).issues;
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining([
        'STYLE_PROHIBITED_COLOR',
        'STYLE_PALETTE',
        'STYLE_STROKE',
        'STYLE_STROKE_WIDTH',
        'SVG_DIMENSIONS',
      ]),
    );
  });
  it('normalizes short hex/rgb colors and checks inline named colors', () => {
    const style = styleSchema.parse({
      schemaVersion: 1,
      id: 'forest',
      name: 'Forest',
      palette: ['#fff', '#203c32'],
    });
    const sample = source.replace(
      'fill="#203c32"',
      'style="fill: rgb(255, 255, 255); stroke: red"',
    );
    expect(
      inspectSvg(sample, 'sample.svg', style)
        .issues.filter((i) => i.code === 'STYLE_PALETTE')
        .map((i) => i.message),
    ).toEqual(['red is outside the Forest palette.']);
  });
  it('rejects an external URL even after an internal URL in the same attribute', () => {
    const sample = source.replace(
      '<rect ',
      '<rect style="filter: url(#root) url(file:///secret)" ',
    );
    expect(inspectSvg(sample).issues.some((i) => i.code === 'SVG_UNSAFE')).toBe(true);
  });
  it('loads and validates all demo assets and motions with no findings', async () => {
    const data = await readProject(defaultProject);
    expect(data.assets).toHaveLength(6);
    expect(data.actors).toHaveLength(5);
    expect(data.animations).toHaveLength(17);
    expect(data.styles).toHaveLength(2);
    expect(data.issues).toEqual([]);
  });
  it('detects missing rig nodes, invalid variants, clips, sequences and states', async () => {
    const data = structuredClone(await readProject(defaultProject));
    data.actors[0].rig.nodes.bad = {
      svgId: 'missing',
      pivot: [0.5, 0.5],
      pivotSpace: 'normalized',
    };
    data.assets[0].metadata.baseAsset = 'missing';
    data.animations[0].actorId = 'missing';
    data.sequences[0].steps.push({ action: 'play', clip: 'missing' });
    data.stateMachines[0].initial = 'missing';
    expect(validateProject(data).map((i) => i.code)).toEqual(
      expect.arrayContaining([
        'RIG_NODE',
        'VARIANT_BASE',
        'ANIMATION_ACTOR',
        'SEQUENCE_CLIP',
        'STATE_INITIAL',
      ]),
    );
  });
  it('rejects inverted SVG/rig ancestry and cyclic variant relationships', async () => {
    const data = structuredClone(await readProject(defaultProject));
    data.actors.find((a) => a.metadata.id === 'studio-maker')!.rig.nodes.human.parent = 'head';
    data.assets.find((a) => a.metadata.id === 'phone-single-camera')!.metadata.baseAsset =
      'phone-dual-camera';
    expect(validateProject(data).map((i) => i.code)).toEqual(
      expect.arrayContaining(['RIG_SVG_HIERARCHY', 'VARIANT_CYCLE']),
    );
  });
});
