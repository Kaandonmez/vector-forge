import { SvgRenderer } from '../../../renderer-web/src/index.ts';
import {
  Playback,
  compileSequence,
  evaluateAnimation,
  evaluateSequence,
  Machine,
} from '../../../motion/src/index.ts';
import type { Animation, Rig, Sequence } from '../../../schema/src/index.ts';
export { SvgRenderer, Playback, Machine, compileSequence, evaluateAnimation, evaluateSequence };
export function mount(
  container: HTMLElement,
  source: string,
  rig?: Rig,
  motion?: Animation | Sequence,
  clips: Animation[] = [],
) {
  const renderer = new SvgRenderer(container, source, rig);
  const compiled = motion && 'steps' in motion ? compileSequence(motion, clips) : undefined;
  const playback = new Playback(
    compiled?.duration ?? (motion && 'duration' in motion ? motion.duration : 1),
    motion?.loop,
  );
  const render = () =>
    renderer.apply(
      compiled
        ? evaluateSequence(compiled, playback.time, false)
        : motion && 'tracks' in motion
          ? evaluateAnimation(motion, playback.time, false)
          : {},
    );
  let handle = 0,
    last = performance.now();
  const tick = (now: number) => {
    playback.advance((now - last) / 1000);
    last = now;
    render();
    handle = requestAnimationFrame(tick);
  };
  render();
  handle = requestAnimationFrame(tick);
  return {
    renderer,
    playback,
    destroy() {
      cancelAnimationFrame(handle);
      container.innerHTML = '';
    },
  };
}
