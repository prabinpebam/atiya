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

export const article = z.strictObject({
  id,
  type: z.literal('article'),
  kind: z.enum(['page', 'note', 'talk']),
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

const itemType = z.enum(['article', 'caseStudy', 'practiceArea', 'leadershipTopic', 'gallery', 'resume']);

export interface ItemNode {
  id: string;
  kind: 'item';
  slug?: string;
  navLabel?: string;
  item: { type: z.infer<typeof itemType>; id: string };
}
export interface HubNode {
  id: string;
  kind: 'hub';
  slug: string;
  title: string;
  navLabel?: string;
  summary?: string;
  template: 'home' | 'workIndex' | 'expertiseOverview' | 'leadershipOverview' | 'notesIndex';
  sequence?: boolean;
  children?: SiteNode[];
}
export type SiteNode = HubNode | ItemNode;

const itemNode = z.strictObject({ id, kind: z.literal('item'), slug: id.optional(), navLabel: z.string().optional(), item: z.strictObject({ type: itemType, id }) });
const hubNode: z.ZodType<HubNode> = z.lazy(() =>
  z.strictObject({
    id,
    kind: z.literal('hub'),
    slug: z.union([id, z.literal('')]),
    title: z.string().min(1),
    navLabel: z.string().optional(),
    summary: z.string().max(160).optional(),
    template: z.enum(['home', 'workIndex', 'expertiseOverview', 'leadershipOverview', 'notesIndex']),
    sequence: z.boolean().optional(),
    children: z.array(z.union([hubNode, itemNode])).optional(),
  }),
);

export const siteStructure = z.strictObject({ home: hubNode });

export type ImageMedia = z.infer<typeof imageMedia>;
export type Block = z.infer<typeof block>;
export type Article = z.infer<typeof article>;
export type Person = z.infer<typeof person>;
export type SiteSettings = z.infer<typeof siteSettings>;
export type SiteStructure = z.infer<typeof siteStructure>;
