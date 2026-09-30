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
    visibility: z.enum(['public', 'publicRedacted', 'summaryOnly', 'privateDiscussionOnly', 'notPublishable']),
  })
  .refine((m) => m.alt || m.decorative, { message: 'an image needs alt text unless it is decorative', path: ['alt'] })
  .refine((m) => !/^(image|picture|photo) of\b/i.test(m.alt ?? ''), { message: 'alt text never starts with "image of"', path: ['alt'] });

const mediaUse = z.strictObject({ media: mediaId, caption: z.string().optional() });

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
    embed: z.strictObject({ provider: z.enum(['youtube', 'vimeo']), id: z.string().regex(/^[\w-]+$/) }),
    title: z.string().min(1),
    poster: mediaId,
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
});

/**
 * What a structure places: a page (the article resource, whatever its kind). The content model's other
 * item types have no repository or renderer yet, so a structure can't refer to them (spec §3.3).
 */
const pageRef = z.strictObject({ type: z.literal('article'), id });

/** How a section (or a building on the planet) lists its pages. */
export const SECTION_VIEWS = ['list', 'tiles', 'bento'] as const;
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

/** A page's old address sent on to its new one (spec §3.5, V19): both paths on this site. */
export const redirects = z.array(
  z.strictObject({
    from: z.string().regex(/^\/[^\s#?]*\/$/, 'a path on this site, ending in /'),
    to: z.string().regex(/^\/[^\s?]*$/, 'a path on this site (a #fragment may follow)'),
  }),
);

export type ImageMedia = z.infer<typeof imageMedia>;
export type Block = z.infer<typeof block>;
export type Article = z.infer<typeof article>;
export type Person = z.infer<typeof person>;
export type SiteSettings = z.infer<typeof siteSettings>;
export type SiteStructure = z.infer<typeof siteStructure>;
export type Redirect = z.infer<typeof redirects>[number];
