import { DOMParser } from '@xmldom/xmldom';
import type { Asset, Issue, Style } from '../../schema/src/index.ts';

const allowed = new Set(
  'svg g defs symbol use path rect circle ellipse line polyline polygon text tspan title desc linearGradient radialGradient stop clipPath mask pattern filter feGaussianBlur feOffset feColorMatrix feBlend feComposite feFlood feMerge feMergeNode'.split(
    ' ',
  ),
);
export type SvgInfo = {
  ids: string[];
  colors: string[];
  ancestors?: Record<string, string[]>;
  viewBox?: number[];
  width?: number;
  height?: number;
  issues: Issue[];
};
function normalizeColor(value: string) {
  const color = value.trim().toLowerCase();
  if (/^#[a-f0-9]{3}$/.test(color))
    return (
      '#' +
      color
        .slice(1)
        .split('')
        .map((c) => c + c)
        .join('')
    );
  const rgb = color.match(/^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/);
  if (rgb)
    return (
      '#' +
      rgb
        .slice(1)
        .map((v) => Math.min(255, Number(v)).toString(16).padStart(2, '0'))
        .join('')
    );
  return color;
}
export function inspectSvg(
  svg: string,
  path = 'asset.svg',
  style?: Style,
  metadata?: Asset,
): SvgInfo {
  const issues: Issue[] = [];
  const ids: string[] = [],
    colors = new Set<string>(),
    refs: string[] = [];
  const ancestors: Record<string, string[]> = {};
  const issue = (severity: Issue['severity'], code: string, message: string) =>
    issues.push({ severity, code, path, message });
  if (/<!DOCTYPE|<!ENTITY|<\?xml-stylesheet/i.test(svg)) {
    issue(
      'error',
      'SVG_UNSAFE',
      'DTD, entities and external stylesheets are unsupported. Use self-contained SVG.',
    );
    return { ids, colors: [], issues };
  }
  let doc;
  try {
    doc = new DOMParser({
      errorHandler: {
        warning: (message) => issue('error', 'SVG_PARSE', String(message)),
        error: (message) => issue('error', 'SVG_PARSE', String(message)),
        fatalError: (message) => {
          throw new Error(String(message));
        },
      },
    }).parseFromString(svg, 'image/svg+xml');
  } catch (error) {
    issue('error', 'SVG_PARSE', `Malformed SVG: ${String(error)}. Repair the XML markup.`);
    return { ids, colors: [], issues };
  }
  const root = doc.documentElement;
  if (
    Array.from(doc.childNodes).filter((n) => n.nodeType === 1).length !== 1 ||
    Array.from(doc.childNodes).some((n) => n.nodeType === 3 && n.textContent?.trim())
  )
    issue('error', 'SVG_PARSE', 'SVG must contain exactly one root and no text outside it.');
  if (!root || root.tagName !== 'svg' || root.namespaceURI !== 'http://www.w3.org/2000/svg')
    issue('error', 'SVG_ROOT', 'Root must be <svg xmlns="http://www.w3.org/2000/svg">.');
  const viewBox = root
    ?.getAttribute('viewBox')
    ?.trim()
    .split(/[\s,]+/)
    .map(Number);
  if (
    !viewBox ||
    viewBox.length !== 4 ||
    !viewBox.every(Number.isFinite) ||
    viewBox[2] <= 0 ||
    viewBox[3] <= 0
  )
    issue(
      'error',
      'SVG_VIEWBOX',
      'Add a valid viewBox with four numbers and positive width/height.',
    );
  const width = parseFloat(root?.getAttribute('width') ?? ''),
    height = parseFloat(root?.getAttribute('height') ?? '');
  if (metadata && viewBox && viewBox.length === 4) {
    if (
      metadata.viewBox.some((n, i) => n !== viewBox[i]) ||
      (Number.isFinite(width) && width !== metadata.width) ||
      (Number.isFinite(height) && height !== metadata.height)
    )
      issue(
        'error',
        'SVG_DIMENSIONS',
        'SVG dimensions/viewBox differ from metadata. Update the SVG or asset JSON.',
      );
  }
  const nodes = root ? [root, ...Array.from(root.getElementsByTagName('*'))] : [];
  for (const node of nodes) {
    if (!allowed.has(node.tagName) || node.namespaceURI !== 'http://www.w3.org/2000/svg')
      issue(
        'error',
        'SVG_UNSAFE',
        `Unsupported SVG element <${node.tagName}>. Active content and foreign markup are not permitted.`,
      );
    const id = node.getAttribute('id');
    if (id) {
      if (ids.includes(id))
        issue('error', 'SVG_DUPLICATE_ID', `Duplicate SVG id "${id}". IDs must be unique.`);
      ids.push(id);
      ancestors[id] = [];
      let parent = node.parentNode;
      while (parent && parent.nodeType === 1) {
        const pid = (parent as typeof node).getAttribute('id');
        if (pid) ancestors[id].push(pid);
        parent = parent.parentNode;
      }
    }
    for (const attr of Array.from(node.attributes)) {
      if (
        /^on/i.test(attr.name) ||
        (/javascript:|data:|https?:|@import|expression\s*\(/i.test(attr.value) &&
          attr.name !== 'xmlns' &&
          attr.name !== 'xmlns:xlink')
      )
        issue(
          'error',
          'SVG_UNSAFE',
          `Unsafe or external attribute ${attr.name}. Keep all SVG resources local to this document.`,
        );
      if (attr.name === 'href' || attr.name === 'xlink:href') {
        if (!attr.value.startsWith('#'))
          issue('error', 'SVG_UNSAFE', 'SVG href must reference an internal #id.');
        else refs.push(attr.value.slice(1));
      }
      for (const match of attr.value.matchAll(/url\(\s*['"]?#([^)'"\s]+)['"]?\s*\)/g))
        refs.push(match[1]);
      for (const url of attr.value.matchAll(/url\(\s*([^)]*)\)/gi))
        if (!/^['"]?#[^'"\s]+['"]?$/.test(url[1].trim()))
          issue('error', 'SVG_UNSAFE', 'Only internal url(#id) references are supported.');
      if (['fill', 'stroke', 'stop-color', 'style'].includes(attr.name)) {
        const values =
          attr.name === 'style'
            ? [...attr.value.matchAll(/(?:^|;)\s*(?:fill|stroke|stop-color)\s*:\s*([^;]+)/g)].map(
                (m) => m[1],
              )
            : [attr.value];
        for (const raw of values) {
          const color = normalizeColor(raw);
          if (
            color &&
            !/url\(/i.test(color) &&
            !['none', 'inherit', 'currentcolor', 'transparent'].includes(color)
          )
            colors.add(color);
        }
      }
    }
    const inline = node.getAttribute('style') ?? '';
    const stroke =
      node.getAttribute('stroke') || inline.match(/(?:^|;)\s*stroke\s*:\s*([^;]+)/)?.[1];
    if (style?.stroke?.enabled === false && stroke && stroke !== 'none')
      issue(
        'warning',
        'STYLE_STROKE',
        'This style disables strokes. Use filled shapes or change the style rule.',
      );
    const sw = parseFloat(
      node.getAttribute('stroke-width') || inline.match(/stroke-width\s*:\s*([^;]+)/)?.[1] || '1',
    );
    if (style?.stroke?.maxWidth && sw > style.stroke.maxWidth)
      issue(
        'warning',
        'STYLE_STROKE_WIDTH',
        `Stroke width ${sw} exceeds style maximum ${style.stroke.maxWidth}.`,
      );
  }
  for (const ref of refs)
    if (!ids.includes(ref))
      issue(
        'error',
        'SVG_REFERENCE',
        `SVG references missing id "${ref}". Add that definition or repair the reference.`,
      );
  if (style) {
    const palette = style.palette.map(normalizeColor);
    for (const color of colors) {
      if (style.prohibitedColors.map(normalizeColor).includes(color))
        issue('error', 'STYLE_PROHIBITED_COLOR', `${color} is prohibited by ${style.name}.`);
      else if (!palette.includes(color))
        issue('warning', 'STYLE_PALETTE', `${color} is outside the ${style.name} palette.`);
    }
    if (style.maxColors && colors.size > style.maxColors)
      issue(
        'warning',
        'STYLE_COLOR_COUNT',
        `${colors.size} colors exceeds style maximum ${style.maxColors}.`,
      );
  }
  return {
    ids,
    colors: [...colors],
    ancestors,
    viewBox,
    width: Number.isFinite(width) ? width : undefined,
    height: Number.isFinite(height) ? height : undefined,
    issues,
  };
}
export function assertSafeSvg(svg: string) {
  const errors = inspectSvg(svg).issues.filter((i) => i.severity === 'error');
  if (errors.length) throw new Error(errors.map((e) => e.message).join('\n'));
  return svg;
}
