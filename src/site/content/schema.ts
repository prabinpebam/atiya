/**
 * The content contract: the resources in content/ (the mock API) as Zod schemas, shaped as the
 * content model specifies (documentation/content/model.md). Unknown fields are errors in the mock
 * files, so a typo fails the build rather than vanishing. This is the first slice: the article, its
 * blocks, image media, a person, the site settings and the site structure.
 */
import { z } from 'astro/zod';
import { paragraphsOf } from './markdown';

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'lowercase kebab-case');
/** A media ID: its path under content/media/ without the extension. */
export const mediaId = z.string().regex(/^[a-z0-9-]+(\/[a-z0-9-]+)+$/, 'a path under content/media/, without the extension');
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}(T[\d:.]+Z)?$/, 'an ISO 8601 date');
const width = z.enum(['content', 'popout', 'wide', 'full']);
/**
 * How a picture is shown in the frame it's given (documentation/content/media.md §9.1): fill (fills the frame,
 * cropped around its focus point), fit (whole, with room round it), actual (its own size, centred, never
 * enlarged) or tile (repeated at its own size across the frame).
 */
export const PICTURE_DISPLAYS = ['fill', 'fit', 'actual', 'tile'] as const;
export type PictureDisplay = (typeof PICTURE_DISPLAYS)[number];
const display = z.enum(PICTURE_DISPLAYS);
/** Behind a picture: a colour taken from its own edges (the space round a fitted or actual-size picture, its transparent parts). Off by default. */
const background = z.boolean();
/** Rounded corners (the design's radius). On by default; false squares them. */
const rounded = z.boolean();
/** A drop shadow under it, following its own shape (transparent parts and all). Off by default. */
const shadow = z.boolean();
/** How a page's cards show its picture (documentation/content/media.md §9.1). */
export const pictureStyle = z.strictObject({ display: display.optional(), background: background.optional(), rounded: rounded.optional(), shadow: shadow.optional() });
/** A figure's frame: its own shape (left out), or one of these. */
export const FIGURE_SHAPES = ['1/1', '4/3', '3/2', '16/9', '21/9'] as const;

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

/** The most blocks (paragraphs and lists) an item's words run to: past these, it's a story of its own, not an item. */
export const ITEM_PARAGRAPHS_MAX = 6;

/** An item's words: a paragraph or a list, or a few of them, of the Markdown subset, a blank line between them. */
const itemWords = z
  .string()
  .min(1)
  .refine((m) => paragraphsOf(m).length >= 1, "an item's words aren't blank")
  .refine((m) => paragraphsOf(m).length <= ITEM_PARAGRAPHS_MAX, `an item's words are at most ${ITEM_PARAGRAPHS_MAX} paragraphs or lists: a blank line starts each`);

/**
 * How a collection's items are laid out (documentation/content/model.md §6.1). The items are the same
 * whatever the layout, so a collection can change layout at any time; a new layout is a new value here and
 * its styles in the Collection compound.
 */
export const COLLECTION_LAYOUTS = ['rows', 'columns', 'tiles', 'masonry', 'carousel', 'timeline', 'timeline-scroll'] as const;
export type CollectionLayout = (typeof COLLECTION_LAYOUTS)[number];
export const COLLECTION_HEADINGS = ['label', 'title'] as const;
export const COLLECTION_MAX = 24;
/** A table's most columns and rows: past these, it's a spreadsheet, not a story's table. */
export const TABLE_MAX_COLUMNS = 8;
export const TABLE_MAX_ROWS = 60;

/** A table's cell: one line of the inline Markdown (bold, italic, code, links), or empty. */
const tableCell = z.string().refine((c) => !/[\r\n]/.test(c), 'a cell is one line');

/** An item's time, as words ("2016", "July 2019 to now"): short enough to sit by a timeline's mark. */
export const COLLECTION_WHEN_MAX = 40;

/**
 * One item of a collection: when it was (for a timeline), a heading, a picture, a subtext (a short line
 * under the heading) and its words (paragraphs and lists of Markdown). Each is optional, and an item has at least
 * one of a heading, a picture, a subtext or its words.
 */
export const collectionItem = z
  .strictObject({
    /** When it was, as words: a timeline sets it by the item's mark; other layouts, over its heading. */
    when: z.string().trim().min(1).max(COLLECTION_WHEN_MAX).optional(),
    heading: z.string().min(1).max(80).optional(),
    media: mediaId.optional(),
    subtext: z.string().min(1).max(160).optional(),
    text: itemWords.optional(),
  })
  .refine((i) => i.heading || i.media || i.subtext || i.text, 'an item needs at least one of a heading, a picture, a subtext or its words');

export const block = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('text'),
    markdown: z
      .string()
      .min(1)
      .refine((m) => !/\n[ \t]*\n/.test(m.trim()), 'a text block is one paragraph or one list: split it into two blocks at the blank line'),
  }),
  z.strictObject({ type: z.literal('heading'), level: z.union([z.literal(2), z.literal(3), z.literal(4)]), text: z.string().min(1), id: id.optional() }),
  z.strictObject({
    type: z.literal('figure'),
    media: mediaId,
    caption: z.string().optional(),
    credit: z.string().optional(),
    showCaption: z.boolean().optional(),
    width: width.default('content'),
    lightbox: z.boolean().optional(),
    /** Its frame's shape; left out, the picture's own. */
    ratio: z.enum(FIGURE_SHAPES).optional(),
    /** How it's shown in its frame; left out, fit (in its own shape, as wide as its place). */
    display: display.optional(),
    background: background.optional(),
    rounded: rounded.optional(),
    shadow: shadow.optional(),
  }),
  z.strictObject({ type: z.literal('gallery'), items: z.array(mediaUse).min(2), layout: z.enum(['grid', 'mosaic', 'row']).optional(), fit: z.enum(['cover', 'contain']).optional(), display: display.optional(), background: background.optional(), rounded: rounded.optional(), shadow: shadow.optional(), caption: z.string().optional(), showCaption: z.boolean().optional(), width: width.optional(), lightbox: z.boolean().optional() }),
  z.strictObject({ type: z.literal('carousel'), items: z.array(mediaUse).min(2), label: z.string().min(1), peek: z.boolean().optional(), pager: z.enum(['dots', 'filmstrip', 'filmstrip-wrap']).optional(), arrows: z.boolean().optional(), showCaption: z.boolean().optional(), lightbox: z.boolean().optional(), display: display.optional(), background: background.optional(), rounded: rounded.optional(), shadow: shadow.optional() }),
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
  z.strictObject({
    type: z.literal('collection'),
    items: z.array(collectionItem).min(1).max(COLLECTION_MAX),
    /** How the items are laid out: any layout shows the same items. */
    layout: z.enum(COLLECTION_LAYOUTS),
    /** Items to a row on a wide screen, for tiles and masonry; left out, one for a single item, else from how many there are. */
    columns: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional(),
    /** Tiles only: each tile on the accent's soft surface with an accent edge, to stand out from the page. */
    prominent: z.boolean().optional(),
    /** How the items' headings read: small capitals over the words (labels, the default) or titles. */
    headings: z.enum(COLLECTION_HEADINGS).optional(),
    /** Names a carousel or a scrolling timeline for assistive tech; left out, "Carousel" or "Timeline". */
    label: z.string().min(1).optional(),
    /**
     * Where the article layout places it; left out, in the column. Full (the viewport's width) is for the
     * strips, the carousel and the sideways timeline; the other layouts show it as wide.
     */
    width: z.enum(['content', 'popout', 'wide', 'full']).optional(),
    /** A strip (the carousel, the sideways timeline) reaches out beside its column and fades to nothing there. */
    peek: z.boolean().optional(),
    /** The items' pictures: their frame's shape (left out, each its own), how each sits in it, and the options every picture has. */
    ratio: z.enum(FIGURE_SHAPES).optional(),
    display: display.optional(),
    background: background.optional(),
    rounded: rounded.optional(),
    shadow: shadow.optional(),
  }),
  z
    .strictObject({
      type: z.literal('table'),
      /** Its column headings, in order. */
      columns: z.array(z.string().trim().min(1).max(80)).min(1).max(TABLE_MAX_COLUMNS),
      /** Its rows, in order: a cell for each column. */
      rows: z.array(z.array(tableCell)).min(1).max(TABLE_MAX_ROWS),
      /** The first column names each row (its cells are the rows' headings). */
      rowHeadings: z.boolean().optional(),
      /** What it shows, said above it (and read first by assistive tech). */
      caption: z.string().min(1).optional(),
      /** Where the article layout places it; left out, in the column. */
      width: z.enum(['content', 'popout', 'wide']).optional(),
    })
    .refine((t) => t.rows.every((r) => r.length === t.columns.length), { message: 'every row has a cell for each column', path: ['rows'] }),
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
  hero: z.strictObject({ media: mediaId, caption: z.string().optional(), credit: z.string().optional(), showCaption: z.boolean().optional(), display: display.optional(), background: background.optional(), rounded: rounded.optional(), shadow: shadow.optional() }).optional(),
  /** The picture on its cards (shown whole); the lead picture when left out. */
  thumbnail: mediaId.optional(),
  /** How the picture on its cards is shown in their 3:2 frame: left out, fit (whole), no background, rounded. */
  thumbnailStyle: pictureStyle.optional(),
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

/**
 * A building's words (the game's: its name, its line, its summary on its card) and the section of the site
 * it shows. What it holds follows that section (documentation/sections/spec.md §5.2): the section's
 * published open pages, in its order and its view, so the planet and the site never differ.
 */
const place = z.strictObject({
  id: z.enum(PLACE_IDS),
  title: z.string().min(1).max(40),
  kicker: z.string().min(1).max(60),
  summary: z.string().min(1).max(160),
  site: id,
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

/** A private page's address in place of its slug: opaque, so it never hints at the title (documentation/access/spec.md §2, V24). */
export const accessToken = z.string().regex(/^[a-z2-7]{10}$/, 'a token: 10 characters from a–z and 2–7');
/** A private page's node: its ID, its token and the page it places. */
const protectedNode = z.strictObject({ id, token: accessToken, item: pageRef });

/**
 * The private overlay (private-pages/structures/overlay.json; documentation/access/spec.md §2, §3): the
 * private pages each open section holds, and the section's full order (open and private pages together).
 */
export const overlay = z.strictObject({
  sections: z
    .array(
      z.strictObject({
        /** The open section the private pages are in. */
        section: id,
        pages: z.array(protectedNode),
        /** The section's full order, by node ID; pages it leaves out follow, open ones first. */
        order: z.array(id).optional(),
      }),
    )
    .default([]),
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
