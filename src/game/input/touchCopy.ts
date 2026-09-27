/**
 * What the HUD says while you're using touch (documentation/game-ui/touch.md §5.4). Pure strings, so
 * they load with the touch chunk rather than the main bundle.
 */
export const TOUCH_COPY = {
  hint: [
    'Drag anywhere to walk; push to the edge to run. Tap a place to go there, and tap a prompt to use it.',
    'Turn and tilt the view with a second finger, or with the compass buttons.',
  ],
} as const;

const RULES: [RegExp, string][] = [
  [/Press E to open\./g, 'Tap Open.'],
  [/Press E to feed the ducks, or Escape to stand up\./g, 'Tap Feed the ducks, or Stand up.'],
  [/Press Escape to stand up\./g, 'Tap Stand up to get up.'],
  [/Press E to /g, 'Tap the prompt to '],
  [/: press E\./g, ': tap the prompt.'],
];

/** An announcement written for keys, reworded for touch (the keys it names aren't there). */
export function forTouch(text: string): string {
  for (const [re, to] of RULES) text = text.replace(re, to);
  return text;
}
