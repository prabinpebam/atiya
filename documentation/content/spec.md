# Content platform: spec

How the site's content, information architecture (IA) and navigation become data, and how the site renders that data without knowing where it came from. Today the data is mock JSON in the repository; later it's a backend API. This page is the architecture and its decisions. The [content model](model.md), [IA and routes](ia.md), [API contract](api.md) and [media](media.md) pages specify each part. The [plan](plan.md) sequences the work and holds the Definition of Done.

> **TL;DR.**
> - **Code is presentation, content is data.** No page, layout or component holds editorial copy, a navigation item, a URL of a content page or a media path.
> - **One contract, two sources.** A single set of schemas (Zod, exported as JSON Schema) describes every resource. Two source adapters return it: `files` reads the mock JSON in `content/`, and `api` calls the backend. The mock files have exactly the shape of the API's responses, so switching is one environment variable.
> - **Built at build time.** The site stays static on GitHub Pages. A publish in the backend triggers a rebuild through a webhook.
> - **Media by reference.** Content names a media asset by its ID. The asset's master file and its metadata (alt text, credit, focus point) live side by side under `content/media/`, and the build generates the sizes the page needs.
> - **The IA is data too.** Routes, menus, breadcrumbs and the planet's places are all derived from the content. They implement the [information architecture](../ia-navigation/README.md) already specified, rather than restating it.

<figure class="slate-figure">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 550" role="img" aria-labelledby="cp-arch__title cp-arch__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="cp-arch__title">How content reaches the page</title>
<desc id="cp-arch__desc">Two sources, the mock JSON files in content/ today and the backend API at /v1 later, feed one source adapter chosen by CONTENT_SOURCE. The adapter's output is validated against the contract (schemas and integrity checks), stored by Astro's content layer, queried through the repository, mapped to view models, rendered by the layouts of the design system and published as static pages on GitHub Pages. The planet on /play reads its places from the same repository. A publish in the backend triggers a rebuild through a webhook.</desc>
<g id="cp-arch__source-files" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-1" x="40" y="40" width="200" height="72" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="58" y="70" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-1" data-slate-fit-padding="16">Mock JSON files</text>
<text x="58" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-arch__body-1" data-slate-fit-padding="16">content/ · today</text>
</g>
<g id="cp-arch__source-api" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-2" x="40" y="132" width="200" height="72" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="58" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-2" data-slate-fit-padding="16">Backend API</text>
<text x="58" y="186" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-arch__body-2" data-slate-fit-padding="16">/v1 · later</text>
</g>
<text x="40" y="232" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13">publish → webhook → rebuild</text>
<g id="cp-arch__adapter" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-3" x="280" y="86" width="200" height="72" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="298" y="116" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-3" data-slate-fit-padding="16">Source adapter</text>
<text x="298" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-arch__body-3" data-slate-fit-padding="16">files | api</text>
</g>
<g id="cp-arch__contract" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-4" x="520" y="86" width="200" height="72" rx="14" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="538" y="116" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-4" data-slate-fit-padding="16">Contract</text>
<text x="538" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="cp-arch__body-4" data-slate-fit-padding="16">schemas · integrity</text>
</g>
<g id="cp-arch__content-layer" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-5" x="760" y="86" width="200" height="72" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="778" y="116" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-5" data-slate-fit-padding="16">Content layer</text>
<text x="778" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-arch__body-5" data-slate-fit-padding="16">Astro loaders, cached</text>
</g>
<g id="cp-arch__repository" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-6" x="760" y="300" width="200" height="72" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="778" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-6" data-slate-fit-padding="16">Repository</text>
<text x="778" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-arch__body-6" data-slate-fit-padding="16">getRoute, getMenu, …</text>
</g>
<g id="cp-arch__view-models" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-7" x="520" y="300" width="200" height="72" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="538" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-7" data-slate-fit-padding="16">View models</text>
<text x="538" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-arch__body-7" data-slate-fit-padding="16">entities → props</text>
</g>
<g id="cp-arch__layouts" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-8" x="280" y="300" width="200" height="72" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="298" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-8" data-slate-fit-padding="16">Layouts</text>
<text x="298" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-arch__body-8" data-slate-fit-padding="16">the design system</text>
</g>
<g id="cp-arch__pages" data-slate-svg-step="9" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-9" x="40" y="300" width="200" height="72" rx="14" fill="var(--color-brand-bg)" />
<text x="58" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-9" data-slate-fit-padding="16">Static pages</text>
<text x="58" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="cp-arch__body-9" data-slate-fit-padding="16">GitHub Pages</text>
</g>
<g id="cp-arch__planet" data-slate-svg-step="10" data-slate-svg-effect="fade-rise">
<rect id="cp-arch__body-10" x="760" y="436" width="200" height="72" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="778" y="466" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-arch__body-10" data-slate-fit-padding="16">The planet</text>
<text x="778" y="490" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-arch__body-10" data-slate-fit-padding="16">/play reads places</text>
</g>
<g id="cp-arch__flow-1" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M240 76 L258 76 L258 114 L270 114" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="279,114 270,119 270,109" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-arch__flow-2" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M240 168 L258 168 L258 130 L270 130" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="279,130 270,135 270,125" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-arch__flow-3" data-slate-svg-step="13" data-slate-svg-effect="draw">
<path d="M480 122 L510 122" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="519,122 510,127 510,117" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-arch__flow-4" data-slate-svg-step="14" data-slate-svg-effect="draw">
<path d="M720 122 L750 122" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="759,122 750,127 750,117" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-arch__flow-5" data-slate-svg-step="15" data-slate-svg-effect="draw">
<path d="M860 158 L860 290" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="860,299 865,290 855,290" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-arch__flow-6" data-slate-svg-step="16" data-slate-svg-effect="draw">
<path d="M760 336 L730 336" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="721,336 730,341 730,331" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-arch__flow-7" data-slate-svg-step="17" data-slate-svg-effect="draw">
<path d="M520 336 L490 336" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="481,336 490,341 490,331" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-arch__flow-8" data-slate-svg-step="18" data-slate-svg-effect="draw">
<path d="M280 336 L250 336" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="241,336 250,341 250,331" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-arch__flow-9" data-slate-svg-step="19" data-slate-svg-effect="draw">
<path d="M860 372 L860 426" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="860,435 865,426 855,426" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>How content reaches the page: a content source (the mock files today, the backend API later) is read by one adapter, validated against the contract, cached by Astro's content layer, queried through the repository, mapped to view models and rendered by the layouts into static pages. The planet reads the same repository.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The flow, as a table</summary>

| Step | What it is | Where it lives |
|---|---|---|
| Source | The mock JSON and media files, or the backend API | `content/` or `CONTENT_API_URL` |
| Adapter | `files` or `api`, chosen by `CONTENT_SOURCE` | `src/site/content/source/` |
| Contract | Zod schemas; the build fails on any invalid or dangling item | `src/site/content/schema/` |
| Content layer | Astro collections whose loaders call the adapter; cached between builds | `src/content.config.ts` |
| Repository | The only functions pages call: `getRoute`, `getMenu`, `listCaseStudies`, … | `src/site/content/repository.ts` |
| View models | Entities mapped to the props layouts and components take | `src/site/content/view/` |
| Rendering | Layouts, compounds, fundamentals (the site design system) | `src/site/` |
| Output | Static pages on GitHub Pages; the planet's JSON on `/play` | `dist/` |

</details>

## 1. Goals and non-goals

**Goals**

- **G1: a clean frontend.** The site is a renderer: it knows templates, blocks and components, not what the portfolio says.
- **G2: a data-driven IA.** Pages, their URLs, the menus, breadcrumbs, related links and the planet's places come from content.
- **G3: swap without rewrites.** Moving from mock files to a backend changes one adapter and some configuration. No page, layout, component or test fixture changes.
- **G4: safe by construction.** Content is validated at the boundary. A broken reference, a missing alt text or an unpublishable case study fails the build, never the reader.
- **G5: organised media in the repository.** Every image and video a page uses lives in a predictable folder next to its metadata, with budgets that keep the repository healthy.
- **G6: the IA as written.** The content model encodes the [taxonomy and content model](../ia-navigation/03-taxonomy-and-content-model.md), the [navigation specification](../ia-navigation/04-navigation-specification.md) and the [governance rules](../ia-navigation/07-editorial-and-governance.md).

**Non-goals (for now)**

- **Choosing or building the backend.** The contract is designed so any headless CMS or custom service can serve it; the choice comes later ([plan §6](plan.md#6-later-the-backend)).
- **Runtime (per-request) rendering.** GitHub Pages is static; see D5.
- **Search, comments, forms and analytics.** They're later features in the IA's backlog.
- **The design library (`/design/`) and the documentation (`/docs/`).** They're tools built from the code and the docs, not portfolio content, and they stay as they are.

## 2. Boundaries: what's data and what stays in code

| Data (in the content source) | Code (in the repository's `src/`) |
|---|---|
| Editorial copy: titles, summaries, bodies, captions, quotes | Interface strings: button names, `aria-label`s, error messages, "Skip to content" |
| The IA: which pages exist, their URLs, their parents and order | Templates: how each type of page is laid out (layouts) |
| Menus: primary, actions, footer, local navigation | The rules that apply them (current location, breadcrumbs) |
| Taxonomies: practice areas, contributions, outcome types, topics | The vocabularies' constraints (limits, required fields), as schema |
| SEO fields, social cards, redirects | The sitemap and feed generators |
| Media assets and their metadata (alt, caption, credit, licence, focus) | The image pipeline (sizes, formats) |
| The planet's places: which landmark leads to which page, and its words | The planet's world: geometry, models and rules (`src/game/`) |
| Site settings: name, positioning, owner, social profiles | Tokens, components, the design system |

Interface strings stay in code because they belong to the design system's copy rules and to accessibility, not to the portfolio. They're gathered in one module so they can be localised later (§9).

## 3. Decisions

| ID | Decision | Why | Alternatives considered |
|---|---|---|---|
| D1 | Code is presentation; content is data (§2) | G1, G2 | Keeping "small" copy in pages: it always grows back |
| D2 | One contract: Zod schemas, exported as JSON Schema 2020-12 | The same types check the build, the editor and the backend | Hand-written TypeScript types (no runtime check); OpenAPI first (heavier to start) |
| D3 | A `ContentSource` interface with `files` and `api` adapters, chosen by `CONTENT_SOURCE` | G3 | Two code paths in pages; a CMS SDK in pages |
| D4 | The mock files mirror the API's responses one to one; the same layout is the backend's snapshot format | The swap is transport only; a snapshot gives offline development, fixtures and rollback | A separate mock format (drifts from the API) |
| D5 | Static output: content is read at build time; a publish triggers a rebuild | GitHub Pages serves static files only; static is fast, cheap and robust | Astro live collections or server rendering: needs a server host (§8) |
| D6 | Bodies are typed blocks; text inside them is a Markdown subset (CommonMark, no raw HTML) | Blocks map to the design system's components; Markdown is easy to write in JSON and every CMS can store it | Structured spans (Portable Text): cleaner, but painful to author by hand; raw HTML (unsafe) |
| D7 | Media by ID; master and metadata side by side; sizes generated at build by `astro:assets` | G5; alt text and credit travel with the file; nothing generated is committed | Committing generated sizes (doubles the repository); URLs in content (breaks the swap to a CDN) |
| D8 | Stable IDs for references, slugs for URLs; renaming a published slug needs a redirect (enforced) | The IA's rule: "redirect renamed pages" | References by slug (break on rename) |
| D9 | Routes are derived from content: a route table maps every path to a resource | G2; one place answers "does this URL exist, and what is it?" | Hand-written Astro routes per type (the IA lives in code) |
| D10 | The planet's places are separate resources that point at IA pages | The IA's rule for experimental navigation: no second, conflicting taxonomy | Planet geometry inside each page's content (mixes channels) |
| D11 | Only `published` and `stale` content in a public visibility is built; everything else fails closed | The governance lifecycle and visibility rules | Filtering in templates (easy to forget) |
| D12 | The API is versioned in its path (`/v1/`); changes within a version are additive only | Old snapshots and builds keep working | Header versioning (harder to mirror in files) |

## 4. The source adapter

A source returns plain, already-shaped resources. It never returns components, HTML or view models.

```ts
// src/site/content/source/types.ts
export interface ContentSource {
  /** One resource, e.g. get('site'), get('case-studies/design-system-at-scale'). */
  get<T>(path: string, query?: Query): Promise<T | null>;
  /** A list, with the API's filtering, sorting and paging (list semantics are shared code). */
  list<T>(collection: string, query?: Query): Promise<Page<T>>;
  /** Where a media asset's master is: a local file (files) or a URL (api). */
  mediaLocation(id: string): Promise<{ kind: 'file'; path: string } | { kind: 'url'; href: string }>;
  /** A fingerprint, so Astro skips unchanged loads (a hash of the files, or the API's ETag). */
  digest(path: string): Promise<string>;
}
```

- **`files`** maps `get('case-studies/x')` to `content/case-studies/x.json`, following the [file layout](api.md#6-the-mock-api-files-that-mirror-it). It implements `list` by reading the folder and applying the shared query functions.
- **`api`** maps the same call to `GET {CONTENT_API_URL}/v1/case-studies/x`. It sends the read token, honours `ETag` and `Retry-After`, and caches responses in `.cache/content/`.
- **Choosing:** `CONTENT_SOURCE=files` is the default (development, tests, and today's deploys). `CONTENT_SOURCE=api` needs `CONTENT_API_URL` and `CONTENT_API_TOKEN`, which live in GitHub Actions secrets and are never bundled.
- **Proof of the swap:** a contract test serves `content/` over HTTP as `/v1/…` (a local mock server) and checks that both adapters give identical results for every resource ([plan, phase 3](plan.md#phase-3-api-ready)).

## 5. From source to page

1. **Load.** Each collection in `src/content.config.ts` uses a custom loader, `contentLoader('case-studies')`, which calls the configured source. Astro's content layer stores the result and reloads only what changed (by digest). In development the `files` adapter watches `content/`.
2. **Validate.** The loader parses every item with its Zod schema. Then an integrity pass checks every reference (IDs of pages, people, media and taxonomy terms), unique slugs, menu targets, redirects and the IA rules ([model §8](model.md#8-validation-rules)). Any failure stops the build, naming the resource and the field.
3. **Query.** Pages and layouts call only the repository (`src/site/content/repository.ts`): `getSite()`, `getMenu('primary')`, `getRoute(path)`, `getCaseStudy(slug)`, `listCaseStudies({ practiceArea, featured })`, `getPlaces()`. Nothing else reads the source, the file system or `fetch`.
4. **Map.** View mappers turn entities into the props the design system takes. A case study becomes `ArticleLayout` props, for example, and a figure block becomes `Figure` props with a resolved image. They also resolve links (a target becomes an `href` through `withBase`) and media (an ID becomes `src`, `srcset`, `width`, `height`, `alt` and `focus`).
5. **Render.** One catch-all route, `src/pages/[...path].astro`, gets its static paths from the route table and picks a template by resource type ([IA §3](ia.md#3-routes)). The block renderer maps body blocks to components ([model §6](model.md#6-blocks)). Pages carry no copy and no styles.

**Where the content glue sits in the tiers.** The repository, the mappers and the block renderer live in `src/site/content/`, beside the pages, not in a component tier. They map data to layouts and components, may import any tier, and carry no styles. The [design system's](../site-ui/design-system.md) tier rules are unchanged.

## 6. Publishing, rebuilding and previews

| Situation | What happens |
|---|---|
| Today: a change to `content/` is pushed to `main` | The deploy workflow builds with `files` and publishes to GitHub Pages, as now |
| Later: an editor publishes in the backend | The backend's webhook calls GitHub's `repository_dispatch` (`content-published`); the deploy workflow builds with `api` and publishes |
| A scheduled item (`publishedAt` in the future) | A daily scheduled run of the workflow rebuilds; the item appears on the first build after its time |
| The backend is down during a build | The build fails with the error (no half-built site). With `CONTENT_FALLBACK=snapshot` it builds from the last committed snapshot instead |
| Previewing drafts | `CONTENT_PREVIEW=1` with a preview token includes drafts and review states, locally (`npm run dev`) or in a separate preview deployment, never on the public site |

**The snapshot.** `npm run content:snapshot` asks the API for everything published and writes it in the mock layout. It replaces `content/` in a pull request, so the backend's content can be reviewed, diffed and rolled back like code.

## 7. Performance and budgets

- **No content fetches at run time.** The browser gets HTML and optimised media. Only `/play` inlines the places it needs as JSON, as it does today.
- **Images** are generated at the sizes the layouts ask for, in WebP, with width and height set (no layout shift); details in [media §5](media.md#5-the-pipeline).
- **Build time** grows with content. Astro's content layer skips unchanged entries, and CI caches `node_modules/.astro` (optimised images) and `.cache/content/` between runs.
- **The existing budgets hold:** the landing's initial script, the game's bundle budgets (`npm run verify:prod`), and the font budget on article pages.

## 8. Hosting and the path to runtime content

GitHub Pages serves static files, so content can only change with a rebuild. That suits a portfolio: content changes rarely, and a build takes about a minute. If the site ever needs content that changes faster than it can be rebuilt (search, comments, live notes), the options in order of cost are:

1. **Client-side islands** that call the API from the browser for one feature (a search box), with the rest static.
2. **A host with on-demand rendering** (Netlify, Vercel or Cloudflare, for example) and Astro's live content collections, which read a source at request time. The `ContentSource` interface stays the same, so this is a live loader and a hosting change, not a rewrite.

## 9. Security, privacy and localisation

- **No raw HTML from content.** Markdown is rendered with raw HTML disabled. Links allow `https:`, `http:` and `mailto:` only, plus internal targets. Embeds come from an allowlist of providers (YouTube, Vimeo) and render through `VideoEmbed`'s click-to-load facade, so there's no third-party request until the reader asks.
- **SVG media is sanitised** (no scripts, event handlers or external references) or refused.
- **Secrets** (the API token, the webhook secret) live in GitHub Actions secrets and are never in the client bundle or the snapshot.
- **Visibility** is enforced by the build (D11). Anything not in a public visibility isn't requested from the API with the public token, and isn't built from files.
- **Localisation (reserved, not built).** Every resource carries `locale` (default `en`), and the route table can take a locale prefix. Interface strings live in one module so they can become a dictionary.

## 10. Testing

| Level | What it proves | Where |
|---|---|---|
| Schema | Every file in `content/` matches its schema | `npm run content:check` (also in `npm test`) |
| Integrity | References resolve; slugs are unique; menus, redirects and the routes lock are consistent | `content:check` |
| IA rules | The IA's constraints: required case-study fields, practice-area limits, card metadata limits, breadcrumb and current-location rules | Unit tests on the pure rules in `src/site/content/rules/` |
| Contract | The `files` and `api` adapters return identical data for every resource | Contract test against the mock server (phase 3) |
| Rendering | Every route renders, the right menu item is current, redirects work, 404 is served, media has alt text | E2E, a new "content" group |

The unit and E2E suites keep using fixtures in `content/`, so tests never depend on the backend being up.
