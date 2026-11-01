import type { Action, Animation, Rig, Sequence, StateMachine } from '../../schema/src/index.ts';
import { registerEasingName } from '../../schema/src/easing.ts';

export type Pose = Record<string, Record<string, number | string>>;
type Easing = (t: number) => number;
export const easings: Record<string, Easing> = {
  linear: (t) => t,
  easeIn: (t) => t * t,
  easeOut: (t) => 1 - (1 - t) ** 2,
  easeInOut: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  easeInQuad: (t) => t * t,
  easeOutQuad: (t) => 1 - (1 - t) ** 2,
  easeInOutQuad: (t) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2),
  easeInCubic: (t) => t ** 3,
  easeOutCubic: (t) => 1 - (1 - t) ** 3,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2),
  easeOutBack: (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
};
export function registerEasing(name: string, easing: Easing) {
  registerEasingName(name);
  easings[name] = easing;
}
export function interpolate(a: number | string, b: number | string, t: number): number | string {
  if (typeof a === 'number' && typeof b === 'number') return a + (b - a) * t;
  if (typeof a === 'string' && typeof b === 'string') {
    const channels = [1, 3, 5].map((i) =>
      Math.max(
        0,
        Math.min(
          255,
          Math.round(
            parseInt(a.slice(i, i + 2), 16) +
              (parseInt(b.slice(i, i + 2), 16) - parseInt(a.slice(i, i + 2), 16)) * t,
          ),
        ),
      ),
    );
    return '#' + channels.map((c) => c.toString(16).padStart(2, '0')).join('');
  }
  return t < 1 ? a : b;
}
export function evaluateAnimation(clip: Animation, time: number, loop = clip.loop): Pose {
  const t = loop
    ? ((time % clip.duration) + clip.duration) % clip.duration
    : Math.max(0, Math.min(clip.duration, time));
  const pose: Pose = {};
  for (const [track, frames] of Object.entries(clip.tracks)) {
    const dot = track.indexOf('.');
    const node = track.slice(0, dot);
    const property = track.slice(dot + 1);
    let value = frames[0].value;
    if (t >= frames.at(-1)!.time) value = frames.at(-1)!.value;
    else
      for (let i = 1; i < frames.length; i++) {
        if (t <= frames[i].time) {
          const a = frames[i - 1],
            b = frames[i];
          value = interpolate(
            a.value,
            b.value,
            (easings[b.easing ?? 'linear'] ?? easings.linear)(
              Math.max(0, (t - a.time) / (b.time - a.time)),
            ),
          );
          break;
        }
      }
    if (property === 'opacity' && typeof value === 'number')
      value = Math.max(0, Math.min(1, value));
    (pose[node] ??= {})[property] = value;
  }
  return pose;
}
export function mergePose(target: Pose, source: Pose) {
  for (const [id, values] of Object.entries(source)) Object.assign((target[id] ??= {}), values);
  return target;
}
export function defaultValue(property: string) {
  return property.startsWith('scale.') || property === 'opacity' ? 1 : 0;
}
export function hierarchyOrder(rig: Rig): string[] {
  const order: string[] = [],
    visiting = new Set<string>(),
    visited = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id))
      throw new Error(`Rig hierarchy contains a cycle at ${id}. Remove a parent link.`);
    if (visited.has(id)) return;
    const node = rig.nodes[id];
    if (!node) throw new Error(`Rig node ${id} does not exist.`);
    visiting.add(id);
    if (node.parent) visit(node.parent);
    visiting.delete(id);
    visited.add(id);
    order.push(id);
  };
  Object.keys(rig.nodes).forEach(visit);
  return order;
}
export type Segment = {
  start: number;
  duration: number;
  action: Exclude<Action, { action: 'parallel' | 'repeat' }>;
  from: Pose;
};
export type CompiledSequence = {
  duration: number;
  segments: Segment[];
  loop: boolean;
  id: string;
  clips: Record<string, Animation>;
};
export function compileSequence(sequence: Sequence, clips: Animation[]): CompiledSequence {
  const library = Object.fromEntries(clips.map((c) => [c.id, c]));
  const segments: Segment[] = [];
  let expanded = 0;
  const evaluate = (time: number) => sampleSegments(segments, library, time);
  const compile = (steps: Action[], start: number): number => {
    let cursor = start;
    for (const action of steps) {
      if (++expanded > 10000)
        throw new Error('Sequence expands beyond 10,000 actions. Reduce repeat counts.');
      if (action.action === 'parallel') {
        cursor += Math.max(...action.steps.map((step) => compile([step], cursor) - cursor));
      } else if (action.action === 'repeat') {
        for (let i = 0; i < action.count; i++) cursor = compile(action.steps, cursor);
      } else {
        const duration =
          action.action === 'play'
            ? (action.duration ?? library[action.clip]?.duration)
            : action.duration;
        if (duration === undefined)
          throw new Error(
            `Sequence references missing clip ${action.action === 'play' ? action.clip : ''}.`,
          );
        segments.push({ start: cursor, duration, action, from: evaluate(cursor) });
        cursor += duration;
      }
    }
    return cursor;
  };
  const duration = compile(sequence.steps, 0);
  return { id: sequence.id, loop: sequence.loop, duration, segments, clips: library };
}
function sampleSegments(segments: Segment[], clips: Record<string, Animation>, time: number): Pose {
  const pose: Pose = {};
  for (const segment of segments) {
    if (time < segment.start) continue;
    const local = Math.min(segment.duration, time - segment.start);
    const action = segment.action;
    if (action.action === 'play') {
      const clip = clips[action.clip];
      if (!clip) continue;
      // A completed clip holds its final pose. Running looping clips can repeat within an overridden duration.
      mergePose(pose, evaluateAnimation(clip, local, local < segment.duration && clip.loop));
    } else if (action.action === 'moveTo' || action.action === 'rotateTo') {
      const t = (easings[action.easing ?? 'easeInOutCubic'] ?? easings.linear)(
        Math.min(1, local / segment.duration),
      );
      const values =
        action.action === 'moveTo'
          ? { 'position.x': action.x, 'position.y': action.y }
          : { rotation: action.rotation };
      for (const [property, destination] of Object.entries(values))
        (pose[action.target] ??= {})[property] = interpolate(
          segment.from[action.target]?.[property] ?? defaultValue(property),
          destination,
          t,
        );
    }
  }
  return pose;
}
export function evaluateSequence(
  sequence: CompiledSequence,
  time: number,
  loop = sequence.loop,
): Pose {
  const t =
    loop && sequence.duration > 0
      ? ((time % sequence.duration) + sequence.duration) % sequence.duration
      : Math.min(sequence.duration, Math.max(0, time));
  return sampleSegments(sequence.segments, sequence.clips, t);
}
export class Playback {
  time = 0;
  speed = 1;
  playing = false;
  loop: boolean;
  constructor(
    public duration: number,
    loop = false,
  ) {
    this.loop = loop;
  }
  play() {
    if (this.time === this.duration && this.speed >= 0) this.time = 0;
    this.playing = true;
  }
  pause() {
    this.playing = false;
  }
  stop() {
    this.pause();
    this.time = 0;
  }
  restart() {
    this.time = this.speed < 0 ? this.duration : 0;
    this.playing = true;
  }
  seek(time: number) {
    this.time = Math.max(0, Math.min(this.duration, time));
  }
  advance(deltaSeconds: number) {
    if (!this.playing) return this.time;
    const next = this.time + Math.max(0, deltaSeconds) * this.speed;
    if (this.loop && this.duration > 0)
      this.time = ((next % this.duration) + this.duration) % this.duration;
    else {
      this.time = Math.max(0, Math.min(this.duration, next));
      if (next >= this.duration || next < 0) this.pause();
    }
    return this.time;
  }
}
export class Machine {
  state: string;
  constructor(public definition: StateMachine) {
    if (!definition.states[definition.initial])
      throw new Error(`Initial state ${definition.initial} is missing.`);
    this.state = definition.initial;
  }
  get clip() {
    return this.definition.states[this.state].clip;
  }
  transition(event?: string, conditions: Record<string, boolean> = {}, completed = false) {
    const next = this.definition.states[this.state].transitions.find(
      (t) =>
        (t.event !== undefined && t.event === event) ||
        (t.condition !== undefined && conditions[t.condition] === true) ||
        (t.onComplete && completed),
    );
    if (!next) return false;
    if (!this.definition.states[next.to])
      throw new Error(`Transition destination ${next.to} is missing.`);
    this.state = next.to;
    return true;
  }
}
