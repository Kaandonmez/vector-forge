import { promises as fs } from 'node:fs';
import path from 'node:path';
import { actorSchema, assetSchema } from '../packages/schema/src/index.ts';

const root = path.resolve(import.meta.dirname, '../examples/generic-demo');
const palette = [
  '#203c32',
  '#39594a',
  '#64846b',
  '#9ab59c',
  '#dbe5d0',
  '#f4f1e5',
  '#b8f76a',
  '#849d48',
  '#c7b8ef',
  '#9283b2',
  '#edaf86',
  '#c58362',
  '#182a25',
  '#ffffff',
];
const json = async (file: string, value: unknown) => {
  const dest = path.join(root, file);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, JSON.stringify(value, null, 2) + '\n');
};
const text = async (file: string, value: string) => {
  const dest = path.join(root, file);
  await fs.mkdir(path.dirname(dest), { recursive: true });
  await fs.writeFile(dest, value);
};
const svg = (body: string, width = 320, height = 320) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${body}</svg>`;
const shadow = '<ellipse cx="162" cy="284" rx="82" ry="13" fill="#203c32" opacity=".10"/>';
const meta = (id: string, name: string, category: string, extra = {}) => ({
  schemaVersion: 1,
  id,
  name,
  category,
  tags: [category, 'editorial', 'demo'],
  style: 'editorial-green',
  width: 320,
  height: 320,
  viewBox: [0, 0, 320, 320],
  ...extra,
});
const asset = async (id: string, name: string, category: string, body: string, extra = {}) => {
  await text(`assets/${id}/asset.svg`, svg(body));
  await json(`assets/${id}/asset.json`, assetSchema.parse(meta(id, name, category, extra)));
};
type Node = { svgId: string; parent?: string; pivot: number[]; pivotSpace?: string };
const actor = async (
  id: string,
  name: string,
  category: string,
  source: string,
  nodes: Record<string, Node>,
  extra = {},
) => {
  await text(`actors/${id}/actor.svg`, source);
  await json(`actors/${id}/actor.json`, actorSchema.parse(meta(id, name, category, extra)));
  await json(`actors/${id}/rig.json`, { schemaVersion: 1, actorId: id, nodes });
};
const frames = (values: number[], duration: number, easing = 'easeInOutCubic') =>
  values.map((value, i) => ({
    time: +((duration * i) / (values.length - 1)).toFixed(4),
    value,
    easing,
  }));
const clip = async (
  id: string,
  actorId: string,
  duration: number,
  tracks: Record<string, unknown>,
  loop = true,
  name?: string,
) =>
  json(`animations/${id}.json`, {
    schemaVersion: 1,
    id,
    name: name ?? id.replaceAll('-', ' '),
    actorId,
    duration,
    loop,
    tracks,
  });

await json('vectorforge.project.json', {
  schemaVersion: 1,
  name: 'The everyday collection',
  defaultStyle: 'editorial-green',
  description:
    'A cohesive collection of everyday objects, articulated actors and intentional motion.',
});
await json('vectorforge.context.json', {
  schemaVersion: 1,
  defaultPreview: 'phone-triple-camera',
  defaultActor: 'studio-plant',
  familyLabels: { 'phone-modern': 'Phone family', 'phone-ink': 'Ink family' },
  namingConventions: 'lowercase-kebab-case; prefix scene clips with scene-',
  rules: [
    'Read the style and inspect sibling SVGs before creating variants.',
    'Keep family proportions and three-quarter material cues consistent.',
    'Use stable SVG IDs for every independently animated part.',
    'Motion should use anticipation, overlapping phases and soft settling.',
  ],
  exportDestinations: {
    generic: 'exports/generic',
    web: 'exports/web',
    flutter: 'exports/flutter',
  },
  artDirection:
    'Warm editorial geometry. Quiet forest greens, chalk cream, mint highlights and small lilac accents. Deliberate silhouettes with restrained details.',
});
await json('styles/editorial-green/style.json', {
  schemaVersion: 1,
  id: 'editorial-green',
  name: 'Botanical editorial',
  description: 'Soft geometry, forest tones, and a little unexpected energy.',
  palette,
  maxColors: 14,
  stroke: { enabled: true, width: 2, maxWidth: 4 },
  geometry: {
    shapeLanguage: 'rounded-geometric',
    detailLevel: 'medium',
    corners: 'soft with purposeful asymmetry',
  },
  lighting: { shadow: 'soft-grounded', highlight: 'small-cream-reflections' },
  perspective: { default: 'three-quarter' },
  motion: {
    defaultEasing: 'easeInOutCubic',
    overshoot: 0.06,
    anticipation: 0.04,
    personality: 'gentle and self-assured',
  },
  guidance:
    'Build silhouettes first. Reuse the same camera capsule, inset edge and material colors across the phone family. Avoid tiny ornamental details; leave generous breathing room.',
  references: ['phone-triple-camera', 'studio-plant'],
});
await json('styles/mono-ink/style.json', {
  schemaVersion: 1,
  id: 'mono-ink',
  name: 'Ink & paper',
  description: 'A graphic, high-contrast alternative with precise outlines.',
  palette: ['#182a25', '#f4f1e5', '#ffffff'],
  stroke: { enabled: true, width: 2, maxWidth: 4 },
  geometry: { shapeLanguage: 'outlined-geometric', detailLevel: 'minimal' },
  perspective: { default: 'three-quarter' },
  motion: { defaultEasing: 'easeInOutQuad', personality: 'precise' },
  guidance:
    'Use only ink, cream and white. Outline the main silhouette; keep internal detail spare.',
  references: ['phone-ink'],
});
for (const style of ['editorial-green', 'mono-ink']) {
  await text(
    `styles/${style}/README.md`,
    'Palette and visual rules live in style.json. References name project assets. These are demo art directions, not engine defaults.\n',
  );
  await json(`styles/${style}/palette.json`, {
    schemaVersion: 1,
    colors: style === 'editorial-green' ? palette : ['#182a25', '#f4f1e5', '#ffffff'],
  });
}

function phone(count: number, foldable = false, ink = false) {
  const green = ink ? '#f4f1e5' : '#9ab59c',
    dark = ink ? '#182a25' : '#39594a',
    inset = ink ? '#ffffff' : '#dbe5d0';
  const camera = (x: number, y: number) =>
    `<g transform="translate(${x} ${y})"><circle r="11" fill="${dark}"/><circle r="8" fill="#182a25"/><circle r="5" fill="${ink ? '#f4f1e5' : '#64846b'}"/><circle cx="-2" cy="-2" r="2.3" fill="#ffffff" opacity=".8"/><circle cx="2" cy="3" r="1.3" fill="${inset}"/></g>`;
  const cameras =
    count === 1
      ? camera(26, 27)
      : count === 2
        ? camera(24, 26) + camera(24, 52)
        : camera(24, 26) + camera(24, 52) + camera(48, 39);
  const panel = `<rect x="0" y="0" width="102" height="198" rx="17" fill="${dark}"/><rect x="-5" y="-5" width="102" height="198" rx="17" fill="${green}" ${ink ? 'stroke="#182a25" stroke-width="2"' : ''}/><rect x="0" y="0" width="91" height="187" rx="13" fill="${inset}"/><rect x="3" y="3" width="85" height="181" rx="11" fill="${green}"/><rect x="10" y="10" width="${count === 3 ? 57 : 32}" height="${count === 1 ? 34 : 62}" rx="14" fill="${inset}"/>${cameras}<circle cx="${count === 3 ? 49 : 61}" cy="17" r="3" fill="${ink ? '#ffffff' : '#f4f1e5'}"/><circle cx="60" cy="32" r="2" fill="${dark}"/><path d="M42 105l8 16 8-16h-5l-3 7-3-7z" fill="${dark}" opacity=".65"/><rect x="93" y="42" width="4" height="27" rx="2" fill="${dark}"/><rect x="93" y="85" width="4" height="15" rx="2" fill="${dark}"/><path d="M9 176q0 7 7 7h58" fill="none" stroke="${inset}" stroke-width="2" opacity=".7"/>`;
  return `${ink ? shadow.replace('#203c32', '#182a25') : shadow}<g transform="translate(${foldable ? 112 : 139} 43) rotate(13) skewY(13)">${foldable ? `<g transform="translate(-62 23) skewY(-25)"><rect width="70" height="190" rx="12" fill="${dark}"/><rect x="4" y="5" width="60" height="178" rx="9" fill="${ink ? '#f4f1e5' : '#203c32'}"/><path d="M10 118Q29 59 57 71v96H10z" fill="${ink ? '#ffffff' : '#c7b8ef'}"/><path d="M10 138Q31 96 57 125v42H10z" fill="${ink ? '#182a25' : '#9283b2'}"/><rect x="60" y="13" width="8" height="162" rx="3" fill="${inset}"/></g>` : ''}${panel}</g>`;
}
for (const [id, name, cameras, fold] of [
  ['phone-single-camera', 'Phone · single camera', 1, false],
  ['phone-dual-camera', 'Phone · dual camera', 2, false],
  ['phone-triple-camera', 'Phone · triple camera', 3, false],
  ['phone-foldable-dual-camera', 'Foldable · dual camera', 2, true],
  ['phone-foldable-triple-camera', 'Foldable · triple camera', 3, true],
] as const)
  await asset(id, name, 'Devices', phone(cameras, fold), {
    family: 'phone-modern',
    ...(id !== 'phone-single-camera' ? { baseAsset: 'phone-single-camera' } : {}),
    variant: fold ? `foldable-${cameras}-camera` : `${cameras}-camera`,
    generationNotes: 'Shared rounded shell, three-quarter transform and camera lens motif.',
  });
await asset('phone-ink', 'Phone · ink edition', 'Devices', phone(3, false, true), {
  style: 'mono-ink',
  family: 'phone-ink',
  variant: 'triple-camera',
});

const chip = `${shadow}<g id="body"><g transform="translate(160 158) rotate(-16)"><g fill="#9ab59c">${Array.from({ length: 7 }, (_, i) => `<rect x="${-64 + i * 19}" y="-89" width="8" height="32" rx="3"/><rect x="${-64 + i * 19}" y="57" width="8" height="32" rx="3"/><rect x="-90" y="${-62 + i * 19}" width="32" height="8" rx="3"/><rect x="58" y="${-62 + i * 19}" width="32" height="8" rx="3"/>`).join('')}</g><rect x="-67" y="-61" width="140" height="140" rx="16" fill="#203c32"/><rect x="-72" y="-72" width="140" height="140" rx="16" fill="#64846b"/><rect x="-61" y="-61" width="118" height="118" rx="10" fill="#39594a"/><rect x="-39" y="-39" width="74" height="74" rx="8" fill="#9ab59c"/><path d="M-27-27h50v9h-50zm0 17h35v6h-35zm0 13h43v6h-43zm0 13h23v6h-23z" fill="#dbe5d0"/><circle cx="-52" cy="49" r="3" fill="#dbe5d0"/></g></g><g id="indicator-1"><circle cx="108" cy="105" r="7" fill="#b8f76a"/></g><g id="indicator-2"><circle cx="127" cy="100" r="7" fill="#b8f76a"/></g><g id="indicator-3"><circle cx="146" cy="95" r="7" fill="#c7b8ef"/></g>`;
await actor(
  'signal-chip',
  'Signal chip',
  'Electronics',
  svg(chip),
  {
    body: { svgId: 'body', pivot: [0.5, 0.5] },
    indicator1: { svgId: 'indicator-1', parent: 'body', pivot: [0.5, 0.5] },
    indicator2: { svgId: 'indicator-2', parent: 'body', pivot: [0.5, 0.5] },
    indicator3: { svgId: 'indicator-3', parent: 'body', pivot: [0.5, 0.5] },
  },
  { clips: ['chip-idle', 'activity'] },
);
await clip('chip-idle', 'signal-chip', 3, { 'body.position.y': frames([0, -2, 0], 3) });
await clip('activity', 'signal-chip', 2.4, {
  'indicator1.opacity': frames([0.3, 1, 0.3, 0.4, 0.3], 2.4),
  'indicator2.opacity': frames([0.8, 0.3, 1, 0.3, 0.8], 2.4),
  'indicator3.opacity': frames([1, 0.4, 0.3, 0.8, 1], 2.4),
  'indicator3.scale.x': frames([1, 1.16, 1, 1.1, 1], 2.4),
  'indicator3.scale.y': frames([1, 1.16, 1, 1.1, 1], 2.4),
});

const processor = `${shadow}<g id="body"><path d="M77 115l83-45 83 45v88l-83 44-83-44z" fill="#203c32"/><path d="M77 115l83-45 83 45-83 45z" fill="#9ab59c"/><path d="M89 117l71-38 71 38-71 38z" fill="#dbe5d0"/><path d="M104 117l56-30 56 30-56 30z" fill="#64846b"/><path d="M112 117l48-25 48 25-48 25z" fill="#39594a"/><path d="M77 124l83 44v68l-83-43z" fill="#39594a"/><path d="M169 168l65-35v58l-65 35z" fill="#182a25"/>${Array.from({ length: 5 }, (_, i) => `<path d="M${91 + i * 13} ${179 + i * 7}v19l6 3v-19z" fill="#9ab59c"/><path d="M${175 + i * 12} ${198 - i * 6}v13l5-3v-13z" fill="#64846b"/>`).join('')}<path d="M139 113l13 7 20-11 13 7-33 18-26-14z" fill="#b8f76a"/></g><g id="energy-1"><path d="M58 74l-9 29h14l-6 23 27-33H69l10-19z" fill="#b8f76a"/></g><g id="energy-2"><path d="M235 60l-9 29h14l-6 23 27-33h-15l10-19z" fill="#c7b8ef"/></g><g id="energy-3"><path d="M261 165l-9 29h14l-6 23 27-33h-15l10-19z" fill="#b8f76a"/></g>`;
await actor(
  'energy-core',
  'Energy core',
  'Electronics',
  svg(processor),
  {
    body: { svgId: 'body', pivot: [0.5, 0.5] },
    energy1: { svgId: 'energy-1', pivot: [0.5, 0.5] },
    energy2: { svgId: 'energy-2', pivot: [0.5, 0.5] },
    energy3: { svgId: 'energy-3', pivot: [0.5, 0.5] },
  },
  { clips: ['boost'] },
);
await clip('boost', 'energy-core', 2, {
  'body.position.y': frames([0, -4, 0], 2),
  ...Object.fromEntries(
    [1, 2, 3].flatMap((n) => [
      [`energy${n}.opacity`, frames(n === 2 ? [0.4, 1, 0.2, 0.4] : [1, 0.3, 1, 1], 2)],
      [`energy${n}.rotation`, frames([0, n === 2 ? 8 : -6, 0], 2)],
      [`energy${n}.scale.x`, frames([1, 1.15, 1], 2)],
      [`energy${n}.scale.y`, frames([1, 1.15, 1], 2)],
      [`energy${n}.position.y`, frames([0, -8 - n * 2, 0], 2)],
    ]),
  ),
});

const plant = `${shadow}<g id="stem"><path d="M155 223c-3-36 14-65 7-118l6-1c9 47-7 85-7 120z" fill="#39594a"/><path d="M160 181c-25-16-45-37-52-58l5-3c10 23 28 40 49 53z" fill="#64846b"/><path d="M166 148c18-22 29-34 50-40l2 5c-21 6-33 21-50 42z" fill="#64846b"/><g id="leaf-left"><path d="M111 137C63 151 46 119 50 83c37-3 71 5 66 45z" fill="#64846b"/><path d="M111 130C83 120 69 110 58 91c25 8 45 20 53 39z" fill="#9ab59c"/></g><g id="leaf-right"><path d="M206 129c3-43 29-64 67-48-2 36-18 65-59 51z" fill="#39594a"/><path d="M212 125c17-12 34-21 50-37-8 24-25 35-50 37z" fill="#64846b"/></g><g id="leaf-top"><path d="M166 113C131 88 137 44 174 26c28 27 37 59-3 89z" fill="#9ab59c"/><path d="M166 107c-2-32 1-54 8-72 9 31 3 47-8 72z" fill="#64846b"/></g></g><g id="pot"><path d="M115 216h92l-12 56q-35 22-68 0z" fill="#9283b2"/><path d="M115 216h48v66q-24-1-36-10z" fill="#c7b8ef"/><ellipse cx="161" cy="216" rx="46" ry="14" fill="#c7b8ef"/><ellipse cx="161" cy="214" rx="37" ry="9" fill="#39594a"/><path d="M146 227h8v45l-8-2z" fill="#f4f1e5" opacity=".35"/></g>`;
await actor(
  'studio-plant',
  'Studio plant',
  'Nature',
  svg(plant),
  {
    pot: { svgId: 'pot', pivot: [0.5, 1] },
    stem: { svgId: 'stem', parent: 'pot', pivot: [161, 220], pivotSpace: 'absolute' },
    leafLeft: { svgId: 'leaf-left', parent: 'stem', pivot: [112, 132], pivotSpace: 'absolute' },
    leafRight: { svgId: 'leaf-right', parent: 'stem', pivot: [210, 128], pivotSpace: 'absolute' },
    leafTop: { svgId: 'leaf-top', parent: 'stem', pivot: [167, 110], pivotSpace: 'absolute' },
  },
  { clips: ['gentle-sway'] },
);
await clip('gentle-sway', 'studio-plant', 4.8, {
  'stem.rotation': frames([0, 2.3, 0, -2.3, 0], 4.8),
  'leafLeft.rotation': frames([-1, 5, 2, -4, -1], 4.8),
  'leafRight.rotation': frames([2, -3, -5, 4, 2], 4.8),
  'leafTop.rotation': frames([0, -2, 3, 1, 0], 4.8),
});

const human = `<g id="human"><g id="leg-left"><path d="M140 202l-6 60h21l8-56z" fill="#39594a"/><path d="M135 258h20v15h-33q-5-12 13-15z" fill="#182a25"/></g><g id="leg-right"><path d="M164 202l6 60h21l-6-60z" fill="#203c32"/><path d="M170 258h21l12 10q4 6-3 6h-30z" fill="#182a25"/></g><g id="body"><path d="M131 122q29-15 58 0l11 85q-39 17-78 0z" fill="#64846b"/><path d="M151 123h16l14 88-25 1z" fill="#9ab59c"/><path d="M147 119h22l-11 17z" fill="#f4f1e5"/></g><g id="head"><rect x="152" y="100" width="17" height="28" rx="7" fill="#c58362"/><path d="M136 69q26-24 49 0l-3 31q-22 32-44 0z" fill="#edaf86"/><ellipse cx="135" cy="86" rx="6" ry="9" fill="#edaf86"/><ellipse cx="184" cy="86" rx="6" ry="9" fill="#edaf86"/><circle cx="149" cy="86" r="2.1" fill="#203c32"/><circle cx="173" cy="86" r="2.1" fill="#203c32"/><path d="M154 103q7 5 13-1" fill="none" stroke="#c58362" stroke-width="2"/><g id="hair"><path d="M134 81q-10-37 25-38 31-1 28 37l-10-4-3-14q-14 13-33 12l-2 11z" fill="#203c32"/><path d="M139 65q12-15 31-13" fill="none" stroke="#39594a" stroke-width="4"/></g></g><g id="arm-left"><path d="M135 124q-13-2-17 10l-12 53 17 5 21-55z" fill="#64846b"/><g id="hand-left"><path d="M107 185l-3 23q3 14 12 5l8-22z" fill="#edaf86"/></g></g><g id="arm-right"><path d="M183 124q12-3 18 8l15 56-18 5-23-57z" fill="#39594a"/><g id="hand-right"><path d="M198 189l5 26q10 7 15-6l-3-22z" fill="#edaf86"/></g></g></g>`;
const humanNodes: Record<string, Node> = {
  human: { svgId: 'human', pivot: [160, 268], pivotSpace: 'absolute' },
  body: { svgId: 'body', parent: 'human', pivot: [0.5, 1] },
  head: { svgId: 'head', parent: 'human', pivot: [160, 120], pivotSpace: 'absolute' },
  hair: { svgId: 'hair', parent: 'head', pivot: [0.5, 0.8] },
  armLeft: { svgId: 'arm-left', parent: 'human', pivot: [132, 130], pivotSpace: 'absolute' },
  armRight: { svgId: 'arm-right', parent: 'human', pivot: [184, 130], pivotSpace: 'absolute' },
  handLeft: { svgId: 'hand-left', parent: 'armLeft', pivot: [0.5, 0] },
  handRight: { svgId: 'hand-right', parent: 'armRight', pivot: [0.5, 0] },
  legLeft: { svgId: 'leg-left', parent: 'human', pivot: [149, 202], pivotSpace: 'absolute' },
  legRight: { svgId: 'leg-right', parent: 'human', pivot: [176, 202], pivotSpace: 'absolute' },
};
const humanClips: Record<
  string,
  { duration: number; tracks: Record<string, unknown>; loop?: boolean }
> = {
  idle: {
    duration: 3.2,
    tracks: {
      'human.position.y': frames([0, -1.7, 0], 3.2),
      'head.rotation': frames([-1, 1, -1], 3.2),
      'armLeft.rotation': frames([0, 2, 0], 3.2),
      'armRight.rotation': frames([0, 0], 3.2),
      'legLeft.rotation': frames([0, 0], 3.2),
      'legRight.rotation': frames([0, 0], 3.2),
    },
  },
  walk: {
    duration: 1,
    tracks: {
      'legLeft.rotation': frames([-16, 17, -16], 1),
      'legRight.rotation': frames([17, -16, 17], 1),
      'armLeft.rotation': frames([12, -12, 12], 1),
      'armRight.rotation': frames([-12, 12, -12], 1),
      'human.position.y': frames([0, -4, 0, -4, 0], 1),
    },
  },
  typing: {
    duration: 1.4,
    tracks: {
      'armLeft.rotation': frames([-46, -50, -46, -49, -46], 1.4),
      'armRight.rotation': frames([48, 44, 48, 46, 48], 1.4),
      'handLeft.rotation': frames([-5, 8, -5], 1.4),
      'handRight.rotation': frames([8, -5, 8], 1.4),
      'head.rotation': frames([4, 6, 4], 1.4),
    },
  },
  talk: {
    duration: 2.4,
    tracks: {
      'head.rotation': frames([0, 3, -2, 1, 0], 2.4),
      'armRight.rotation': frames([14, 40, 23, 32, 14], 2.4),
      'handRight.rotation': frames([0, -10, 5, 0], 2.4),
    },
  },
  nod: {
    duration: 1.6,
    loop: false,
    tracks: {
      'head.rotation': frames([0, -3, 9, 2, 0], 1.6),
      'head.position.y': frames([0, -1, 3, 1, 0], 1.6),
    },
  },
  point: {
    duration: 1.8,
    loop: false,
    tracks: {
      'armRight.rotation': [
        { time: 0, value: 0 },
        { time: 0.2, value: -7, easing: 'easeInQuad' },
        { time: 0.8, value: -94, easing: 'easeOutBack' },
        { time: 1.8, value: -82, easing: 'easeInOutCubic' },
      ],
      'head.rotation': frames([0, -4, -2], 1.8),
      'handRight.rotation': frames([0, -9, -6], 1.8),
    },
  },
  write: {
    duration: 2,
    tracks: {
      'armRight.rotation': frames([-70, -75, -69, -74, -70], 2),
      'handRight.rotation': frames([0, 10, -5, 8, 0], 2),
      'head.rotation': frames([-2, 1, -2], 2),
    },
  },
  celebrate: {
    duration: 2.2,
    loop: false,
    tracks: {
      'armLeft.rotation': frames([0, 7, 150, 133, 0], 2.2, 'easeOutBack'),
      'armRight.rotation': frames([0, -7, -150, -133, 0], 2.2, 'easeOutBack'),
      'human.position.y': frames([0, 3, -13, -4, 0], 2.2),
      'head.rotation': frames([0, -5, 2, 0], 2.2),
    },
  },
};
await actor('studio-maker', 'The maker', 'People', svg(shadow + human), humanNodes, {
  clips: Object.keys(humanClips),
  stateMachine: 'maker-states',
});
for (const [id, definition] of Object.entries(humanClips))
  await clip(id, 'studio-maker', definition.duration, definition.tracks, definition.loop ?? true);
await json('state-machines/maker-states.json', {
  schemaVersion: 1,
  id: 'maker-states',
  actorId: 'studio-maker',
  initial: 'idle',
  states: {
    idle: {
      clip: 'idle',
      transitions: [
        { event: 'walk', to: 'walking' },
        { event: 'celebrate', to: 'happy' },
        { condition: 'busy', to: 'working' },
      ],
    },
    walking: { clip: 'walk', transitions: [{ event: 'stop', to: 'idle' }] },
    working: { clip: 'typing', transitions: [{ event: 'stop', to: 'idle' }] },
    happy: { clip: 'celebrate', transitions: [{ onComplete: true, to: 'idle' }] },
  },
});

const desk =
  '<g id="desk"><path d="M42 221h151v13H42z" fill="#9ab59c"/><path d="M53 234h11v89H53zm119 0h11v89h-11z" fill="#39594a"/><path d="M69 218l8-46h63l8 46z" fill="#203c32"/><path d="M81 178h55l5 32H75z" fill="#c7b8ef"/><rect x="71" y="216" width="77" height="5" rx="2" fill="#64846b"/><path d="M161 207h17l-2 14h-13z" fill="#f4f1e5"/></g>';
const board =
  '<g id="board"><rect x="417" y="64" width="243" height="187" rx="12" fill="#9ab59c"/><rect x="425" y="72" width="227" height="171" rx="7" fill="#f4f1e5"/><path d="M453 251h9v74h-9zm161 0h9v74h-9z" fill="#39594a"/><rect x="447" y="243" width="188" height="8" rx="3" fill="#64846b"/><g id="drawing" opacity="0"><rect x="450" y="99" width="113" height="10" rx="5" fill="#39594a"/><rect x="450" y="122" width="76" height="5" rx="2" fill="#9ab59c"/><path d="M452 210v-52h28v52zm42 0v-33h28v33zm42 0v-76h28v76z" fill="#64846b"/><circle cx="599" cy="168" r="27" fill="#c7b8ef"/><path d="M588 168l8 8 16-19" fill="none" stroke="#39594a" stroke-width="4"/></g></g>';
const sceneHuman = human.replace('<g id="human">', '<g id="human" transform="translate(130 45)">');
await actor(
  'demo-scene',
  'An idea takes shape',
  'Scenes',
  svg(
    `<ellipse cx="353" cy="333" rx="310" ry="18" fill="#203c32" opacity=".07"/>${desk}${board}${sceneHuman}`,
    720,
    400,
  ),
  {
    ...humanNodes,
    desk: { svgId: 'desk', pivot: [0.5, 1] },
    board: { svgId: 'board', pivot: [0.5, 1] },
    drawing: { svgId: 'drawing', parent: 'board', pivot: [0.5, 0.5] },
  },
  {
    width: 720,
    height: 400,
    viewBox: [0, 0, 720, 400],
    clips: ['scene-idle', 'scene-walk', 'scene-point', 'scene-talk', 'scene-draw'],
  },
);
for (const id of ['idle', 'walk', 'point', 'talk'])
  await clip(
    `scene-${id}`,
    'demo-scene',
    humanClips[id].duration,
    humanClips[id].tracks,
    humanClips[id].loop ?? true,
  );
await clip(
  'scene-draw',
  'demo-scene',
  1,
  { 'drawing.opacity': frames([0, 1], 1, 'easeOutCubic') },
  false,
);
await json('sequences/idea-to-board.json', {
  schemaVersion: 1,
  id: 'idea-to-board',
  name: 'An idea takes shape',
  actorId: 'demo-scene',
  loop: true,
  steps: [
    { action: 'play', clip: 'scene-idle', duration: 1 },
    {
      action: 'parallel',
      steps: [
        { action: 'moveTo', target: 'human', x: 118, y: 0, duration: 1.8 },
        { action: 'play', clip: 'scene-walk', duration: 1.8 },
      ],
    },
    { action: 'rotateTo', target: 'human', rotation: -3, duration: 0.35 },
    {
      action: 'parallel',
      steps: [
        { action: 'play', clip: 'scene-point' },
        { action: 'play', clip: 'scene-draw' },
      ],
    },
    { action: 'wait', duration: 0.5 },
    { action: 'repeat', count: 2, steps: [{ action: 'play', clip: 'scene-talk' }] },
    {
      action: 'parallel',
      steps: [
        { action: 'moveTo', target: 'human', x: 0, y: 0, duration: 1.8 },
        { action: 'play', clip: 'scene-walk', duration: 1.8 },
      ],
    },
    { action: 'rotateTo', target: 'human', rotation: 0, duration: 0.35 },
    { action: 'play', clip: 'scene-idle', duration: 1.5 },
  ],
});

await fs.mkdir(path.resolve(root, '../../fixtures'), { recursive: true });
await text(
  '../../fixtures/invalid.svg',
  '<svg xmlns="http://www.w3.org/2000/svg"><g id="duplicate"/><g id="duplicate"/><use href="#missing"/></svg>',
);
console.log(`Generated ${root}: 6 assets, 5 actors, 17 animations, 2 styles and 1 sequence.`);
