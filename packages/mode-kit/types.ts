/**
 * The navigation modes' contract, as types (documentation/desktop/modes.md §5.2, §5.3): what a mode is given
 * and what it gives back. The mode kit's own module, so a mode and the engine share it without importing each
 * other (the site's schemas, in src/site/modes/contract.ts, re-export these). Types only: nothing here runs.
 */

/** A section's view on the site (the site's SECTION_VIEWS; a unit test keeps them equal). */
export type ModeSectionView = 'list' | 'tiles' | 'bento' | 'features' | 'albums';
/** A page's kind (the content contract's article kinds; a unit test keeps them equal). */
export type ModePageKind = 'note' | 'page' | 'gallery' | 'talk';

/** A picture a mode may show (made by the site's picture pipeline). */
export interface ModePicture {
  src: string;
  srcset: string;
  width: number;
  height: number;
  alt: string;
  bg?: string;
  dark?: string;
}

/** A page as a mode sees it: published and open, never a draft or a private page. */
export interface ModePage {
  id: string;
  title: string;
  summary: string;
  kind: ModePageKind;
  url: string;
  thumbnail?: ModePicture;
}

/** What the host gives a mode (modes.md §5.2): built once per build, plain JSON. Nothing private, nothing draft. */
export interface ModeData {
  api: 1;
  mode: { id: string; mount: string; settings: unknown };
  site: { name: string; description: string; locale: string; base: string; owner: { name: string; role?: string; avatar?: ModePicture } };
  sections: Array<{
    id: string;
    title: string;
    summary: string;
    view: ModeSectionView;
    url: string;
    /** That the section has private pages: never which, or how many. */
    hasPrivate: boolean;
    pages: ModePage[];
  }>;
  slots: Array<{ id: string; section: string | null; words: Record<string, string> }>;
  entry: { slot?: string; page?: string };
  links: { home: string; signIn: string; contact?: string };
}

/** Where in a mode: a slot, and optionally one of its pages. */
export interface ModeTarget {
  slot?: string;
  page?: string;
}

/** The visitor's settings a mode follows (modes.md §5.3). */
export interface ModePrefs {
  reducedMotion: boolean;
  scheme: 'light' | 'dark';
  largerText: boolean;
  input: 'mouse' | 'touch' | 'keyboard';
}

/** Something a mode reports; the host passes only its allowlist on (modes.md §4.7). */
export interface ModeEvent {
  name: string;
  props?: Record<string, string | number>;
}

/** What the engine gives a mode at `mount` (modes.md §5.3). */
export interface ModeHost {
  data: ModeData;
  /** The capability gate's tier for this device (modes.md §4.2): the mode loads its lighter self on `low`. */
  tier: 'high' | 'low';
  /** A section trigger: opens the slot's section (or one of its pages) in the section overlay (modes.md §4.4). */
  open(target: { slot: string; page?: string }): void;
  /** Leaves for the site, at the matching page or section when there is one. */
  toSite(context?: ModeTarget): void;
  /** Keeps the address current, so a reload or a shared link returns to the same place. */
  setAddress(context: ModeTarget): void;
  announce(text: string, politeness?: 'polite' | 'assertive'): void;
  prefs: ModePrefs;
  /** The mode's own storage, namespaced (`mode.<id>.`) and capped. */
  storage: { get(key: string): unknown; set(key: string, value: unknown): void; remove(key: string): void };
  /** The mode's own files, through the site's base path. */
  asset(path: string): string;
  track(event: ModeEvent): void;
  /** Aborted at unmount: every listener the mode adds outside its root takes it. */
  signal: AbortSignal;
}

/** What a mode gives back from `mount`. */
export interface ModeInstance {
  goTo(target: ModeTarget): void;
  pause(): void;
  resume(): void;
  unmount(): Promise<void>;
}

/** A mode's entry module (the manifest's `entry`). */
export interface ModeEntry {
  mount(root: HTMLElement, host: ModeHost): Promise<ModeInstance>;
}
