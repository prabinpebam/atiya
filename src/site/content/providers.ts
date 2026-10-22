/**
 * The video providers the site embeds (documentation/gallery/spec.md §4.2, D-G20): one list, read by the
 * video block's component (through `design/videoProviders.ts`), edit mode's link parsing and shape, and the
 * Content Security Policy. Each entry holds the addresses that recognise a pasted link, its ID's shape, its
 * player's, page's and share addresses, its oEmbed endpoint and the hosts its player is framed from. Adding a
 * provider is one entry here and its tests. Pure: no Astro, nothing read.
 */

export const PROVIDER_IDS = ['youtube', 'vimeo'] as const;
export type ProviderId = (typeof PROVIDER_IDS)[number];

/** A provider's video: the video block's `embed` without its shape. */
export interface ProviderVideo {
  provider: ProviderId;
  id: string;
}

/** How a player starts. */
export interface PlayerOptions {
  /** Plays as soon as it loads (the facade's player, made after the reader pressed play). */
  autoplay?: boolean;
}

export interface Provider {
  /** Its name, for the words that name it. */
  name: string;
  /** A video's ID, whole. */
  id: RegExp;
  /** Pasted addresses it recognises, each capturing the ID as its first group. */
  patterns: RegExp[];
  /** Addresses whose video is always portrait though its oEmbed answers 16:9 (a YouTube Short). */
  portrait?: RegExp;
  /** The player the facade swaps in, from the hosts below. */
  player: (id: string, options: PlayerOptions) => string;
  /** The video's own page (the facade's link, and what its oEmbed is asked about). */
  page: (id: string) => string;
  /** The address the person would paste (edit mode shows it back). */
  share: (id: string) => string;
  /** Where to ask for a page's oEmbed: asked for a big player (1920), it answers in the video's own proportions. */
  oembed: (page: string) => string;
  /** The origins its player is framed from (the policy's `frame-src`). */
  hosts: string[];
}

const query = (params: [string, string][]) => (params.length ? `?${params.map(([k, v]) => `${k}=${v}`).join('&')}` : '');

export const PROVIDERS: Record<ProviderId, Provider> = {
  youtube: {
    name: 'YouTube',
    id: /^[\w-]{6,}$/,
    patterns: [/^(?:https?:\/\/)?(?:www\.|m\.)?(?:youtube\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/)|youtu\.be\/|youtube-nocookie\.com\/embed\/)([\w-]{6,})/i],
    portrait: /youtube\.com\/shorts\//i,
    // the privacy-enhanced host: no cookies until the reader plays
    player: (id, o) => `https://www.youtube-nocookie.com/embed/${id}${query(o.autoplay ? [['autoplay', '1']] : [])}`,
    page: (id) => `https://www.youtube.com/watch?v=${id}`,
    share: (id) => `https://youtu.be/${id}`,
    oembed: (page) => `https://www.youtube.com/oembed?format=json&maxwidth=1920&maxheight=1920&url=${encodeURIComponent(page)}`,
    hosts: ['https://www.youtube-nocookie.com'],
  },
  vimeo: {
    name: 'Vimeo',
    id: /^\d+$/,
    patterns: [/^(?:https?:\/\/)?(?:www\.|player\.)?vimeo\.com\/(?:video\/)?(\d+)/i],
    // dnt: Vimeo tracks nothing about the reader
    player: (id, o) => `https://player.vimeo.com/video/${id}${query([...(o.autoplay ? ([['autoplay', '1']] as [string, string][]) : []), ['dnt', '1']])}`,
    page: (id) => `https://vimeo.com/${id}`,
    share: (id) => `https://vimeo.com/${id}`,
    oembed: (page) => `https://vimeo.com/api/oembed.json?maxwidth=1920&url=${encodeURIComponent(page)}`,
    hosts: ['https://player.vimeo.com'],
  },
};

/** Whether a string names a provider. */
export const isProvider = (p: unknown): p is ProviderId => typeof p === 'string' && (PROVIDER_IDS as readonly string[]).includes(p);

/** Whether an ID has its provider's shape. */
export const isProviderId = (provider: ProviderId, id: string): boolean => PROVIDERS[provider].id.test(id);

/** A pasted address as a provider's video, or null when no provider knows it. */
export function parseVideoUrl(url: string): ProviderVideo | null {
  const u = url.trim();
  for (const provider of PROVIDER_IDS) {
    for (const pattern of PROVIDERS[provider].patterns) {
      const m = pattern.exec(u);
      if (m) return { provider, id: m[1] };
    }
  }
  return null;
}

/** Whether an address is always portrait (a YouTube Short), whatever its oEmbed says. */
export const isPortraitUrl = (url: string): boolean => PROVIDER_IDS.some((p) => PROVIDERS[p].portrait?.test(url.trim()) ?? false);

export const playerUrl = (provider: ProviderId, id: string, options: PlayerOptions = {}): string => PROVIDERS[provider].player(id, options);
export const pageUrl = (provider: ProviderId, id: string): string => PROVIDERS[provider].page(id);
export const shareUrl = (provider: ProviderId, id: string): string => PROVIDERS[provider].share(id);
/** Where to ask a provider for the oEmbed of one of its pages. */
export const oembedUrl = (provider: ProviderId, url: string): string => PROVIDERS[provider].oembed(url);

/** Every origin a provider's player is framed from, in the list's order. */
export const VIDEO_HOSTS: string[] = PROVIDER_IDS.flatMap((p) => PROVIDERS[p].hosts);
