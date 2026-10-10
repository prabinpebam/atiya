/**
 * An embedded video's own shape (documentation/editor/spec.md §3.4): where its provider says it (oEmbed),
 * and what that answer means. Pure, so it's unit-tested; the dev server does the asking
 * (server/videoShape.ts), and the article editor keeps the answer on the embed (`width`, `height`), so the
 * player takes just the video's shape.
 */

export interface Shape {
  width: number;
  height: number;
}

type Embed = { provider: 'youtube' | 'vimeo'; id: string };

/** A YouTube Short is portrait, but YouTube's oEmbed answers 16:9 for it: its address says it instead. */
export const isShorts = (url: string) => /youtube\.com\/shorts\//i.test(url.trim());
export const SHORTS_SHAPE: Shape = { width: 1080, height: 1920 };

/**
 * Where to ask: asked for a big player (1920), the provider answers in the video's own proportions with
 * enough pixels that the shape isn't rounded off (Vimeo's default 426 × 160 is a loop of 1920 × 720).
 */
export function oembedUrl(embed: Embed): string {
  const page = embed.provider === 'youtube' ? `https://www.youtube.com/watch?v=${embed.id}` : `https://vimeo.com/${embed.id}`;
  return embed.provider === 'youtube'
    ? `https://www.youtube.com/oembed?format=json&maxwidth=1920&maxheight=1920&url=${encodeURIComponent(page)}`
    : `https://vimeo.com/api/oembed.json?maxwidth=1920&url=${encodeURIComponent(page)}`;
}

/** The shape in an oEmbed answer, or null when it holds none. */
export function shapeOf(answer: unknown): Shape | null {
  const a = answer as { width?: unknown; height?: unknown } | null;
  const width = Number(a?.width);
  const height = Number(a?.height);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width < 1 || height < 1) return null;
  return { width: Math.round(width), height: Math.round(height) };
}

/** The shape in words, for the inspector: "1920 × 720". */
export const shapeLabel = (s: Shape) => `${s.width} \u00d7 ${s.height}`;
