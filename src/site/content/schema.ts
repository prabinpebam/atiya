/**
 * The content contract: the resources in content/ (the mock API) as Zod schemas, shaped as the
 * content model specifies (documentation/content/model.md). Unknown fields are errors in the mock
 * files, so a typo fails the build rather than vanishing. This is the first slice: the article, its
 * blocks, image media, a person, the site settings and the site structure.
 */
import { z } from 'astro/zod';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase kebab-case');
/** A media ID: its path under content/media/ without the extension. */
export const mediaId = z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)+$/, 'a path under content/media/, without the extension');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/, 'an ISO 8601 date');
const width = z.enum(['content', 'popout', 'wide', 'full']);

export const imageMedia = z
  .strictObject({
    kind: z.literal('image'),
    file: z.string().regex(/^[a-z0-9-]+\.(webp|jpg|jpeg|png|avif)$/),
    alt: z.string().min(1).max(250).optional(),
    decorative: z.boolean().optional(),
    caption: z.string().optional(),
    credit: z.string().optional(),
    licence: z.strictObject({ name: z.string(), url: z.url().optional(), owner: z.string().optional() }).optional(),
    source: z.url().optional(),
    focus: z.string().regex(/^\d{1,3}% \d{1,3}%$/).optional(),
    /** A cropped copy: the picture it was cut from, and where (in that picture's pixels). Cropping it again starts from there. */
    crop: z.strictObject({ from: mediaId, x: z.int().min(0), y: z.int().min(0), width: z.int().min(1), height: z.int().min(1) }).optional(),
    /**
     * Its dark mode version: a second master beside it (`<name>.dark.webp`), shown instead when the page is
     * dark (the reader's theme, or their system's). Its words (alt, caption, credit) and focus are the
     * picture's. Without one, the same picture shows in both modes.
     */
    dark: z.strictObject({ file: z.string().regex(/^[a-z0-9-]+\.dark\.(webp|jpg|jpeg|png|avif)$/) }).optional(),
    visibility: z.enum(['public', 'publicRedacted', 'summaryOnly', 'privateDiscussionOnly', 'notPublishable']),
  })
  .refine((m) => m.alt || m.decorative, { message: 'an image needs alt text unless it is decorative', path: ['alt'] })
  .refine((m) => !/^(image|picture|photo) of\b/i.test(m.alt ?? ''), { message: 'alt text never starts with "image of"', path: ['alt'] });

/**
 * A file to download (documentation/content/media.md §11): a PDF master beside its sidecar, published at
 * `<base>/media/<id>.pdf` and linked from Markdown with `ref:media/<id>`. The résumé's PDF is one.
 */
export const documentMedia = z.strictObject({
  kind: z.literal('document'),
  file: z.string().regex(/^[a-z0-9-]+\.pdf$/),
  /** What it is, in words: a link to it can say so ("Prabin Pebam's résumé"). */
  title: z.string().min(1),
  caption: z.string().optional(),
  visibility: z.enum(['public', 'publicRedacted', 'summaryOnly', 'privateDiscussionOnly', 'notPublishable']),
});

const mediaUse = z.strictObject({ media: mediaId, caption: z.string().optional() });

/**
 * A video file (documentation/content/media.md §12): an MP4 (H.264) or WebM master beside its sidecar,
 * published at `<base>/media/<id>.<mp4|webm>` and shown by a video block with `media`. Its poster, a frame
 * from it, is a second master beside it (`<name>.poster.webp`), as a picture's dark version is.
 */
export const videoMedia = z.strictObject({
  kind: z.literal('video'),
  file: z.string().regex(/^[a-z0-9-]+\.(mp4|webm)$/),
  /** What it is, in words: the player's name for a screen reader, and its name in the library. */
  title: z.string().min(1).max(250),
  /** Its own size (px), so the page keeps its shape before it loads. */
  width: z.int().min(1),
  height: z.int().min(1),
  /** Its length in seconds. */
  duration: z.number().positive().optional(),
  poster: z.strictObject({ file: z.string().regex(/^[a-z0-9-]+\.poster\.(webp|jpg|jpeg|png|avif)$/) }).optional(),
  caption: z.string().optional(),
  credit: z.string().optional(),
  licence: z.strictObject({ name: z.string(), url: z.url().optional(), owner: z.string().optional() }).optional(),
  source: z.url().optional(),
  visibility: z.enum(['public', 'publicRedacted', 'summaryOnly', 'privateDiscussionOnly', 'notPublishable']),
});

export const block = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('text'),
    markdown: z
      .string()
      .min(1)
      .refine((m) => !/\n[ \t]*\n/.test(m.trim()), 'a text block is one paragraph or one list: split it into two blocks at the blank line'),
  }),
  z.strictObject({ type: z.literal('heading'), level: z.union([z.literal(2), z.literal(3), z.literal(4)]), text: z.string().min(1), id: id.optional() }),
  z.strictObject({ type: z.literal('figure'), media: mediaId, caption: z.string().optional(), credit: z.string().optional(), showCaption: z.boolean().optional(), width: width.default('content'), lightbox: z.boolean().optional() }),
  z.strictObject({ type: z.literal('gallery'), items: z.array(mediaUse).min(2), layout: z.enum(['grid', 'mosaic', 'row']).optional(), fit: z.enum(['cover', 'contain']).optional(), caption: z.string().optional(), showCaption: z.boolean().optional(), width: width.optional(), lightbox: z.boolean().optional() }),
  z.strictObject({ type: z.literal('carousel'), items: z.array(mediaUse).min(2), label: z.string().min(1), peek: z.boolean().optional(), pager: z.enum(['dots', 'filmstrip', 'filmstrip-wrap']).optional(), arrows: z.boolean().optional(), showCaption: z.boolean().optional(), lightbox: z.boolean().optional() }),
  z.strictObject({
    type: z.literal('video'),
    /** An uploaded video file (a `video` media ID), or else `embed`: exactly one (the loader checks). */
    media: mediaId.optional(),
    /** A YouTube or Vimeo video, which needs its `title` and a `poster` picture. */
    embed: z.strictObject({ provider: z.enum(['youtube', 'vimeo']), id: z.string().regex(/^[\w-]+$/) }).optional(),
    /** The player's name; for a video file, left out, the file's own title. */
    title: z.string().min(1).optional(),
    /** A picture shown before an embed plays; a video file has its own frame. */
    poster: mediaId.optional(),
    duration: z.number().int().positive().optional(),
    caption: z.string().optional(),
    credit: z.string().optional(),
    showCaption: z.boolean().optional(),
    width: width.optional(),
  }),
  z.strictObject({ type: z.literal('quote'), text: z.string().min(1), cite: z.string().optional(), variant: z.enum(['block', 'pull']).default('block') }),
  z.strictObject({ type: z.literal('divider') }),
  z.strictObject({ type: z.literal('facts'), items: z.array(z.strictObject({ label: z.string().min(1), value: z.string().min(1) })).min(1).max(6) }),
  z.strictObject({
    type: z.literal('tiles'),
    items: z
      .array(
        z.strictObject({
          label: z.string().min(1).max(40),
          text: z
            .string()
            .min(1)
            .refine((m) => !/\n[ \t]*\n/.test(m.trim()), "a tile's text is one paragraph"),
        }),
      )
      .min(2)
      .max(6),
    width: z.enum(['content', 'popout', 'wide']).optional(),
  }),
]);

const itemRef = z.strictObject({ type: z.enum(['article', 'caseStudy', 'practiceArea', 'leadershipTopic', 'gallery', 'resume']), id });

/** A page's kind: how its opening reads (documentation/sections/spec.md §3.3). `note` is shown as "Article". */
export const PAGE_KINDS = ['note', 'page', 'gallery', 'talk'] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

export const article = z.strictObject({
  id,
  type: z.literal('article'),
  kind: z.enum(PAGE_KINDS),
  slug: id,
  title: z.string().min(1),
  navLabel: z.string().optional(),
  summary: z.string().min(1).max(160),
  status: z.enum(['draft', 'factReview', 'editorialReview', 'approved', 'published', 'stale', 'archived']),
  visibility: z.enum(['public', 'publicRedacted', 'summaryOnly', 'privateDiscussionOnly', 'notPublishable']),
  publishedAt: isoDate.optional(),
  updatedAt: isoDate,
  reviewedAt: isoDate.optional(),
  locale: z.literal('en'),
  hero: z.strictObject({ media: mediaId, caption: z.string().optional(), credit: z.string().optional(), showCaption: z.boolean().optional() }).optional(),
  /** The picture on its cards (shown whole); the lead picture when left out. */
  thumbnail: mediaId.optional(),
  /** A picture of the person the page is about (a résumé, About), shown whole beside its title. */
  portrait: mediaId.optional(),
  body: z.array(block),
  related: z.array(itemRef).max(3).optional(),
  topics: z.array(id).optional(),
  seo: z.strictObject({ title: z.string().optional(), description: z.string().max(160).optional(), image: mediaId.optional(), noindex: z.boolean().optional() }).optional(),
});

export const person = z.strictObject({
  id,
  name: z.string().min(1),
  role: z.string().optional(),
  bio: z.string().optional(),
  avatar: mediaId.optional(),
  links: z.array(z.strictObject({ label: z.string(), href: z.url() })).optional(),
});

export const siteSettings = z.strictObject({
  name: z.string().min(1),
  description: z.string().min(1).max(160),
  owner: id,
  locale: z.literal('en'),
  positioning: z.string().optional(),
  socialImage: mediaId.optional(),
  contactEmail: z.email().optional(),
  /** The page "Get in touch" goes to (a node of the site structure): where a reader asks for access. */
  contactPage: id.optional(),
  /** The Privacy page the footer links to (a node of the site structure): what telemetry records (documentation/access/spec.md §9.6). */
  privacyPage: id.optional(),
});

/**
 * What a structure places: a page (the article resource, whatever its kind). The content model's other
 * item types have no repository or renderer yet, so a structure can't refer to them (spec §3.3).
 */
const pageRef = z.strictObject({ type: z.literal('article'), id });

/** How a section (or a building on the planet) lists its pages. */
export const SECTION_VIEWS = ['list', 'tiles', 'bento', 'features'] as const;
export type SectionView = (typeof SECTION_VIEWS)[number];

/** A navigation label: short enough for the header's row (V17). */
const navLabel = z.string().min(1).max(24);

export interface ItemNode {
  id: string;
  kind: 'item';
  slug?: string;
  navLabel?: string;
  item: { type: 'article'; id: string };
}
/** The home hub (the root) or a section (a hub directly under it): documentation/sections/spec.md §3. */
export interface HubNode {
  id: string;
  kind: 'hub';
  slug: string;
  title: string;
  navLabel?: string;
  summary?: string;
  view?: SectionView;
  sequence?: boolean;
  children?: SiteNode[];
}
export type SiteNode = HubNode | ItemNode;

const itemNode = z.strictObject({ id, kind: z.literal('item'), slug: id.optional(), navLabel: navLabel.optional(), item: pageRef });
const hubNode: z.ZodType<HubNode> = z.lazy(() =>
  z.strictObject({
    id,
    kind: z.literal('hub'),
    slug: z.union([id, z.literal('')]),
    title: z.string().min(1),
    navLabel: navLabel.optional(),
    summary: z.string().max(160).optional(),
    view: z.enum(SECTION_VIEWS).optional(),
    sequence: z.boolean().optional(),
    children: z.array(z.union([hubNode, itemNode])).optional(),
  }),
);

/**
 * An entry of the top navigation (spec §4.1): a node of the tree (a section or a page), with an
 * optional label of its own, or a custom link (an https, http or mailto address, or a path on the site).
 */
export type MenuEntry = { node: string; label?: string } | { label: string; href: string };
const menuEntry = z.union([
  z.strictObject({ node: id, label: navLabel.optional() }),
  z.strictObject({ label: navLabel, href: z.string().regex(/^(https?:\/\/\S+|mailto:\S+|\/[^\s]*)$/, 'an https, http or mailto address, or a path on this site (/…)') }),
]);

export const siteStructure = z.strictObject({
  home: hubNode,
  menus: z.strictObject({ primary: z.array(menuEntry).max(8, 'the navigation holds at most eight entries') }).optional(),
});

/**
 * The planet's buildings: the game's own sections, fixed by its world (src/game/world/places.ts, kept in
 * step by a unit test), so the content layer never imports the game (documentation/sections/spec.md §5).
 */
export const PLACE_IDS = ['workshop', 'town-hall', 'lighthouse', 'library', 'amphitheater', 'greenhouse', 'post-office'] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

/** A building's words and what it holds: which pages, in what order, listed how, and its section on the site. */
const place = z.strictObject({
  id: z.enum(PLACE_IDS),
  title: z.string().min(1).max(40),
  kicker: z.string().min(1).max(60),
  summary: z.string().min(1).max(160),
  view: z.enum(SECTION_VIEWS).optional(),
  site: id.optional(),
  pages: z.array(pageRef),
});

/** The planet structure (spec §5.2): each of the seven buildings once (V14). */
export const planetStructure = z.strictObject({ places: z.array(place) });

/** A page's old address sent on to its new one (spec §3.5, V19): both paths on this site. */
export const redirects = z.array(
  z.strictObject({
    from: z.string().regex(/^\/[^\s#?]*\/$/, 'a path on this site, ending in /'),
    to: z.string().regex(/^\/[^\s?]*$/, 'a path on this site (a #fragment may follow)'),
  }),
);

/** A protected page's address in place of its slug: opaque, so it never hints at the title (documentation/access/spec.md §2, V24). */
export const accessToken = z.string().regex(/^[a-z2-7]{10}$/, 'a token: 10 characters from a–z and 2–7');
/** A locked or private page's node: its ID, its token and the page it places. */
const protectedNode = z.strictObject({ id, token: accessToken, item: pageRef });

/**
 * The private overlay (private-pages/structures/overlay.json; documentation/access/spec.md §2, §3): the
 * locked pages each open section holds, the section's full order (open and locked pages together), and the
 * private pages, which are in no section.
 */
export const overlay = z.strictObject({
  sections: z
    .array(
      z.strictObject({
        /** The open section the locked pages are in. */
        section: id,
        pages: z.array(protectedNode),
        /** The section's full order, by node ID; pages it leaves out follow, open ones first. */
        order: z.array(id).optional(),
      }),
    )
    .default([]),
  private: z.array(protectedNode).default([]),
});

const dateTime = z.string().refine((s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/.test(s) && !Number.isNaN(Date.parse(s)), 'a date and time with its time zone (ISO 8601)');
/** A grant: one credential for one recipient (documentation/access/spec.md §4.1). Mirrors src/site/access/types.ts. */
export const grant = z.strictObject({
  id: z.string().regex(/^g[a-z2-7]{8}$/, 'g and 8 characters from a–z and 2–7'),
  kind: z.enum(['code', 'link']),
  /** A code's first word: its name, not secret. */
  name: z.string().regex(/^[a-z]+$/, 'one lowercase word').optional(),
  recipient: z.strictObject({ name: z.string().min(1), organisation: z.string().optional(), role: z.string().optional(), email: z.email().optional() }),
  purpose: z.string(),
  scope: z.strictObject({ sections: z.array(id).optional(), pages: z.array(id).optional() }),
  createdAt: dateTime,
  expiresAt: dateTime.optional(),
  revokedAt: dateTime.optional(),
  secret: z.strictObject({ words: z.string().optional(), key: z.string().optional(), salt: z.string() }),
  notes: z.string().optional(),
});
export const accessFile = z.strictObject({ grants: z.array(grant) });
/** The message offered with a new grant ({name}, {code}, {link} and {expires} are filled in), and the live site's address a magic link starts with. */
export const accessMessage = z.strictObject({ site: z.url(), code: z.string().min(1), link: z.string().min(1) });

export type ImageMedia = z.infer<typeof imageMedia>;
export type DocumentMedia = z.infer<typeof documentMedia>;
export type VideoMedia = z.infer<typeof videoMedia>;
export type Block = z.infer<typeof block>;
export type Article = z.infer<typeof article>;
export type Person = z.infer<typeof person>;
export type SiteSettings = z.infer<typeof siteSettings>;
export type SiteStructure = z.infer<typeof siteStructure>;
export type Redirect = z.infer<typeof redirects>[number];
export type PlanetStructure = z.infer<typeof planetStructure>;
export type Overlay = z.infer<typeof overlay>;
export type GrantRecord = z.infer<typeof grant>;
export type AccessMessage = z.infer<typeof accessMessage>;
export type Place = PlanetStructure['places'][number];
