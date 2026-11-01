import { hierarchyOrder, type Pose } from '../../motion/src/index.ts';
import type { Rig } from '../../schema/src/index.ts';

export class SvgRenderer {
  svg: SVGSVGElement;
  nodes = new Map<
    string,
    {
      wrapper: SVGGElement;
      element: SVGGraphicsElement;
      pivot: [number, number];
      fill: string | null;
      stroke: string | null;
      opacity: string | null;
      base: string;
    }
  >();
  constructor(container: HTMLElement, source: string, rig?: Rig) {
    container.innerHTML = source;
    const svg = container.querySelector('svg');
    if (!svg) throw new Error('SVG root was not found.');
    this.svg = svg;
    svg.style.width = '100%';
    svg.style.height = '100%';
    svg.style.overflow = 'visible';
    if (!rig) return;
    const order = hierarchyOrder(rig);
    for (const id of order) {
      const node = rig.nodes[id];
      const element = Array.from(svg.querySelectorAll<SVGGraphicsElement>('[id]')).find(
        (e) => e.id === node.svgId,
      );
      if (!element) throw new Error(`Rig node ${id} maps to missing SVG element #${node.svgId}.`);
      const bbox = element.getBBox();
      const local: [number, number] =
        node.pivotSpace === 'absolute'
          ? node.pivot
          : [bbox.x + bbox.width * node.pivot[0], bbox.y + bbox.height * node.pivot[1]];
      const authored = element.transform.baseVal.consolidate()?.matrix;
      const pivot: [number, number] = authored
        ? [
            authored.a * local[0] + authored.c * local[1] + authored.e,
            authored.b * local[0] + authored.d * local[1] + authored.f,
          ]
        : local;
      const wrapper = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      wrapper.dataset.vfNode = id;
      element.parentNode!.insertBefore(wrapper, element);
      wrapper.appendChild(element);
      this.nodes.set(id, {
        wrapper,
        element,
        pivot,
        fill: element.getAttribute('fill'),
        stroke: element.getAttribute('stroke'),
        opacity: element.getAttribute('opacity'),
        base: '',
      });
    }
    for (const id of order) {
      const parent = rig.nodes[id].parent;
      if (parent) {
        const p = this.nodes.get(parent)!.wrapper,
          node = this.nodes.get(id)!,
          child = node.wrapper;
        if (!p.contains(child)) {
          // Preserve the authored world position when a logical rig parent differs from SVG nesting.
          const before = child.getCTM(),
            parentMatrix = p.getCTM();
          if (before && parentMatrix) {
            const m = parentMatrix.inverse().multiply(before);
            node.base = `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`;
            child.setAttribute('transform', node.base);
          }
          p.appendChild(child);
        }
      }
    }
  }
  apply(pose: Pose) {
    for (const [id, { wrapper, element, pivot, fill, stroke, opacity, base }] of this.nodes) {
      const p = pose[id] ?? {};
      const x = Number(p['position.x'] ?? 0),
        y = Number(p['position.y'] ?? 0),
        angle = Number(p.rotation ?? 0),
        sx = Number(p['scale.x'] ?? 1),
        sy = Number(p['scale.y'] ?? 1);
      wrapper.setAttribute(
        'transform',
        `${base} translate(${x} ${y}) translate(${pivot[0]} ${pivot[1]}) rotate(${angle}) scale(${sx} ${sy}) translate(${-pivot[0]} ${-pivot[1]})`,
      );
      element.setAttribute('opacity', String(p.opacity ?? opacity ?? 1));
      for (const [prop, original] of [
        ['fill', fill],
        ['stroke', stroke],
      ] as const) {
        if (p[prop] !== undefined) element.setAttribute(prop, String(p[prop]));
        else if (original !== null) element.setAttribute(prop, original);
        else element.removeAttribute(prop);
      }
    }
  }
  select(id?: string) {
    for (const [node, { element }] of this.nodes) {
      element.style.filter = node === id ? 'drop-shadow(0 0 4px #b8f76a)' : '';
    }
  }
}
