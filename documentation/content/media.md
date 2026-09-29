# Media and assets

Where the pictures, videos and files the content uses live in the repository, what metadata travels with each, the budgets that keep the repository healthy, and how the build turns masters into what a page needs. The [content model](model.md) references media by ID; the [spec](spec.md) explains why (D7).

> **TL;DR.**
> - **Where:** every content asset lives under `content/media/`, in a folder named after what owns it: a content item (`articles/<id>/`, `case-studies/<id>/`, `galleries/<id>/`), a structure's node or place (`structures/site/<node>/`, `structures/planet/<place>/`), a person, the site, or `shared/`.
> - **Master and sidecar:** each asset is a master file plus a JSON sidecar with the same name, holding alt text, caption, credit, licence and focus point. The asset's ID is its path without the extension.
> - **Generated at build:** masters are committed; the sizes a page needs are generated at build by Astro's image pipeline and are never committed. Video, captions and PDFs are copied as they are.
> - **Budgets:** photos at most 2560 px and 1.5 MB, video at most 20 MB and 90 seconds (longer goes to YouTube or Vimeo), no Git LFS. The check enforces them.
> - **With a backend,** the same IDs resolve through the backend's media service instead. Only the media resolver's strategy changes.

<figure class="slate-figure" data-diagram="media">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 420" role="img" aria-labelledby="cp-media__title cp-media__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="cp-media__title">The media pipeline</title>
<desc id="cp-media__desc">A master file and its JSON sidecar are committed under content/media. The content check validates alt text, credit and budgets. At build, images go through Astro's image pipeline to WebP sizes from 480 to 2560 pixels; video, captions and PDFs are copied as they are. Both go to dist/ and are published on GitHub Pages. Later, the backend's media service can provide the masters and the sizes instead.</desc>
<g id="cp-media__master" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="cp-media__body-1" x="40" y="60" width="220" height="96" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="58" y="90" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-media__body-1" data-slate-fit-padding="16">Master + sidecar</text>
<text x="58" y="114" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-media__body-1" data-slate-fit-padding="16">content/media/…/</text>
<text x="58" y="136" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-media__body-1" data-slate-fit-padding="16">cover.jpg + cover.json</text>
</g>
<g id="cp-media__check" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="cp-media__body-2" x="300" y="72" width="200" height="72" rx="14" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="318" y="102" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-media__body-2" data-slate-fit-padding="16">content:check</text>
<text x="318" y="126" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="cp-media__body-2" data-slate-fit-padding="16">alt, credit, budgets</text>
</g>
<g id="cp-media__images" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="cp-media__body-3" x="540" y="30" width="200" height="96" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="558" y="60" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-media__body-3" data-slate-fit-padding="16">Images</text>
<text x="558" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-media__body-3" data-slate-fit-padding="16">astro:assets → WebP</text>
<text x="558" y="106" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-media__body-3" data-slate-fit-padding="16">480 to 2560 px</text>
</g>
<g id="cp-media__files" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="cp-media__body-4" x="540" y="162" width="200" height="72" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="558" y="192" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-media__body-4" data-slate-fit-padding="16">Video, captions, PDF</text>
<text x="558" y="216" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-media__body-4" data-slate-fit-padding="16">copied as they are</text>
</g>
<g id="cp-media__output" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="cp-media__body-5" x="780" y="96" width="180" height="72" rx="14" fill="var(--color-brand-bg)" />
<text x="798" y="126" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="cp-media__body-5" data-slate-fit-padding="16">dist/</text>
<text x="798" y="150" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="cp-media__body-5" data-slate-fit-padding="16">GitHub Pages</text>
</g>
<g id="cp-media__backend" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="cp-media__body-6" x="40" y="296" width="220" height="72" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="58" y="326" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="cp-media__body-6" data-slate-fit-padding="16">Backend media</text>
<text x="58" y="350" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-media__body-6" data-slate-fit-padding="16">later: remote or cdn</text>
</g>
<g id="cp-media__flow-1" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M260 108 L290 108" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="299,108 290,113 290,103" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-media__flow-2" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M500 108 L518 108 L518 78 L530 78" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="539,78 530,83 530,73" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-media__flow-3" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M500 108 L518 108 L518 198 L530 198" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="539,198 530,203 530,193" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-media__flow-4" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M740 78 L758 78 L758 124 L770 124" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="779,124 770,129 770,119" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-media__flow-5" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M740 198 L758 198 L758 140 L770 140" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="779,140 770,145 770,135" fill="var(--color-neutral-fg-2)" />
</g>
<g id="cp-media__flow-6" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M150 296 L150 166" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="150,157 155,166 145,166" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>The media pipeline. A master and its JSON sidecar are committed under content/media. The content check validates the metadata and the budgets. At build, Astro's image pipeline makes WebP sizes for each place the picture is used, and video, captions and PDFs are copied as they are; the output is published with the pages. Later, the backend's media service provides the masters and, optionally, the sizes.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The pipeline, as a table</summary>

| Stage | Input | Output | Tool |
|---|---|---|---|
| Author | A master file and its sidecar | Committed under `content/media/` | Any editor |
| Check | Sidecars, masters | Pass, or errors naming the file (alt text, credit, budget) | `npm run content:check` |
| Build, images | The master and each use's layout slot | WebP at the slot's widths, width and height, focus | `astro:assets` (`getImage`) |
| Build, other files | Video, captions, posters, PDFs | Copied to `dist/media/` | A small build integration |
| Publish | `dist/` | GitHub Pages | The deploy workflow |
| Later | The backend's media service | Masters by URL, or ready-made sizes | The resolver's `remote` or `cdn` strategy |

</details>

## 1. Principles

- **Content owns its media.** An asset lives beside the content that uses it, not in `public/`. Deleting a case study's folder deletes its media, and nothing else refers to it.
- **Metadata travels with the file.** Alt text, credit and licence are in the sidecar, not in each use. A use may override the caption.
- **Commit the master, generate the rest.** One good master per asset; every size and format is a build output.
- **Never a URL in content.** Content names an asset by ID; the resolver turns it into URLs. That's what makes the swap to a CDN one setting.

## 2. Where files live

```text
content/media/
├── site/                          site-wide: the social card
│   ├── social-card.jpg
│   └── social-card.json
├── structures/
│   ├── site/<node-id>/            a hub's own media (the home hero)
│   └── planet/<place-id>/         a place's own media, if it ever needs any
├── articles/<article-id>/         an article's figures (pages, notes, talks)
├── case-studies/<case-study-id>/  a case study's cover and figures
│   ├── cover.jpg
│   ├── cover.json
│   ├── before-after.png
│   ├── before-after.json
│   ├── walkthrough.mp4
│   ├── walkthrough.json
│   ├── walkthrough.en.vtt
│   └── walkthrough-poster.jpg (+ .json)
├── practice-areas/<id>/
├── leadership-topics/<id>/
├── galleries/<gallery-id>/         a gallery's images
├── people/<person-id>/            portraits
└── shared/                        used by more than one document (rare; prefer the owner's folder)
```

- **Names** are lowercase `kebab-case`, describe the content (`before-after`, not `img_0042`), and don't repeat the folder. The extension is the real format.
- **The ID** is the path under `content/media/` without the extension: `case-studies/design-system-at-scale/cover`. It never changes. Moving an asset changes its ID, so every reference moves with it, and the check lists any it misses.
- **Belongs elsewhere:** the planet's textures, models, audio and icons (`public/textures/`, `public/models/`, `public/audio/`, `public/icons/`), and the design library's samples (`public/design/`). They're code-owned assets with their own pipelines and credits ([`assets-src/CREDITS.md`](https://github.com/prabinpebam/atiya/blob/main/assets-src/CREDITS.md)), not content.

## 3. The metadata sidecar

`cover.json` beside `cover.jpg`:

```json
{
  "kind": "image",
  "file": "cover.jpg",
  "alt": "Placeholder: what the picture shows, for someone who can't see it.",
  "caption": "Placeholder caption shown under the picture.",
  "credit": "Prabin Pebam",
  "licence": { "name": "All rights reserved", "owner": "Prabin Pebam" },
  "focus": "50% 40%",
  "visibility": "public"
}
```

| Field | For | Required | Notes |
|---|---|---|---|
| `kind` | all | yes | `image`, `video`, `audio`, `document` |
| `file` | all | yes | The master's file name, in the same folder |
| `alt` | image | yes, unless `decorative` | What it shows and why it's there; at most 250 characters; never "image of" |
| `decorative` | image | no | `true` renders `alt=""`; not allowed on a `cover` |
| `caption` | all | no | The default caption; a use may override it |
| `credit` | all | third-party: yes | Shown with the caption where the layout has room |
| `licence` | all | third-party: yes | `{ name, url?, owner? }`; the owner's own work is "All rights reserved" |
| `source` | all | no | Where a third-party asset came from (URL) |
| `focus` | image | no | The point to keep in a crop, as CSS `object-position` (default `50% 50%`) |
| `poster` | video | yes | A media ID (an image with alt text) |
| `captions` | video | yes | `[{ "file": "walkthrough.en.vtt", "srclang": "en", "label": "English", "default": true }]` |
| `transcript` | video, audio | when speech carries meaning | Markdown |
| `visibility` | all | yes | As for documents; a non-public asset can't be used by a published document |

**Measured, not written.** Width, height, duration, MIME type, file size and a dominant colour (the placeholder shown while a picture loads) are measured by the build, and returned by the API. They're never typed into a sidecar.

## 4. Formats and budgets

| Kind | Master format | Limit | Notes |
|---|---|---|---|
| Photo, painting, render | JPEG (quality 85 or more), WebP or AVIF | 2560 px on the long side, 1.5 MB | The build makes the smaller sizes |
| Screenshot, UI, diagram with text | PNG or WebP (lossless) | 2560 px, 2 MB | Redraw sensitive diagrams schematically ([confidential work](../ia-navigation/06-content-inventory-and-mapping.md)); don't blur |
| Vector diagram | SVG | 200 KB | Sanitised: no scripts, handlers or external references |
| Video | MP4 (H.264, AAC) | 1080p, 20 MB, 90 s | With a poster and captions; longer videos go to YouTube or Vimeo as an `embed` |
| Audio | MP3 | 10 MB | With a transcript |
| Document | PDF | 2 MB | The résumé; tagged and accessible |

- **Repository health.** The check warns when `content/media/` passes 300 MB and fails a single file over 25 MB. GitHub refuses files over 100 MB and GitHub Pages sites over 1 GB.
- **No Git LFS.** GitHub Pages doesn't serve LFS files, so large media belongs on a video host, not in LFS.
- **Metadata stripped.** The build writes sizes without EXIF data. Masters should be exported without location data, and the check warns when a master has GPS tags.

## 5. The pipeline

**Images.** The media resolver calls `astro:assets`' `getImage` for each use, with the widths of the layout slot the block asks for. So the same master in a `content` figure and in a `full` one produces different sizes.

| Slot (figure `width`) | Widths generated | `sizes` |
|---|---|---|
| `content` | 480, 720, 960, 1440 | up to the text column |
| `popout` | 480, 960, 1440 | up to the popout width |
| `wide` | 960, 1600, 2400 | up to the wide width |
| `full` | 960, 1600, 2560 | the viewport |
| Card, thumbnail | 240, 480 | the card's width |

- **Format:** WebP at quality 80; AVIF can be added as a second source later without touching content. Widths above the master's own size are skipped.
- **Output** goes to `dist/_astro/` with content-hashed names, so a changed master gets a new URL and caches never serve an old picture.
- **Caching:** Astro keeps generated images in `node_modules/.astro/assets`, and CI caches that folder between runs, so an unchanged master isn't processed again.
- **Crops and focus:** a slot with a fixed ratio crops around `focus` (CSS `object-position`, as the `Image` fundamental already does).

**Other files.** A small build integration copies videos, their posters (which also go through the image pipeline), caption files and PDFs to `dist/media/<id>.<ext>`, after checking their budgets.

## 6. With a backend

The resolver has three strategies, chosen by `MEDIA_STRATEGY`:

| Strategy | Masters come from | Sizes are made by | When |
|---|---|---|---|
| `local` (default) | `content/media/` | `astro:assets` at build | Today |
| `remote` | The API's media URLs | `astro:assets` at build, fetching the masters (the API host is in Astro's `image.remotePatterns`) | A backend without an image service |
| `cdn` | The backend's image service | The service, from a URL template such as `{url}?w={width}&fm=webp` | A backend with a CDN; nothing is processed at build |

Content and components don't change between strategies: a block still names an ID, and `Image` still gets `src`, `srcset`, `width`, `height`, `alt` and `focus`.

## 7. What moves into `content/media/` first

| Asset today | Becomes | Why |
|---|---|---|
| `public/og-image.jpg` | `site/social-card` | The site's default social card |
| `public/poster/landing-*.webp` (the landing's hero) | `structures/site/home/hero` (one master) | The home hub's content |
| The owner's portrait in `public/avatars/npc/prabin.webp` | `people/prabin/portrait` (one master) | Used by articles as the author's picture. The planet keeps its own copy, since it's rendered from the game |
| `public/design/samples/*` | Stays | The design library's sample media, owned by the library |

## 8. Credits and accessibility

- **Credits** for content media live in the sidecars, not in `assets-src/CREDITS.md`, which stays the record for the code-owned assets. A colophon page can list every credited asset from the sidecars once it exists.
- **Alt text** is required (V5). The check also flags alt text that repeats the caption word for word, or starts with "image of" or "picture of".
- **Video** needs captions (WebVTT) and a poster with alt text. Speech that carries meaning needs a transcript. Nothing plays on its own (the design system's rule).
