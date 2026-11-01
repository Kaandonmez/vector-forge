export const easingNames = [
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'easeInQuad',
  'easeOutQuad',
  'easeInOutQuad',
  'easeInCubic',
  'easeOutCubic',
  'easeInOutCubic',
  'easeOutBack',
] as const;
const known = new Set<string>(easingNames);
export function registerEasingName(name: string) {
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(name))
    throw new Error('Easing names must be simple identifiers.');
  known.add(name);
}
export function isKnownEasing(name: string) {
  return known.has(name);
}
