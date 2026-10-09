# Media and assets

Where the pictures, videos and files the content uses live in the repository, what metadata travels with each, the budgets that keep the repository healthy, and how the build turns masters into what a page needs. The [content model](model.md) references media by ID; the [spec](spec.md) explains why (D7).

> **TL;DR.**
> - **Where:** every content asset lives under `content/media/`, in a folder named after what owns it: a content item (`articles/<id>/`, `case-studies/<id>/`, `galleries/<id>/`), a structure's node or place (`structures/site/<node>/`, `structures/planet/<place>/`), a person, the site, or `shared/`.
> - **Master and sidecar:** each asset is a master file plus a JSON sidecar with the same name, holding alt text, caption, credit, licence and focus point. The asset's ID is its path without the extension.
> - **Dark mode versions:** a picture can have a second master for dark pages (`cover.dark.webp`, named in its sidecar). The site shows it whenever the page is dark; without one, the same picture shows in both modes.
> - **Generated at build:** masters are committed; the sizes a page needs are generated at build by Astro's image pipeline and are never committed. Video, captions and PDFs are copied as they are.
> - **Budgets:** photos at most 2560 px and 1.5 MB, video at most 20 MB and 90 seconds (longer goes to YouTube or Vimeo), no Git LFS. The check enforces them.
> - **With a backend,** the same IDs resolve through the backend's media service instead. Only the media resolver's strategy changes.

<figure class="slate-figure" data-diagram="media">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 420" role="img" aria-labelledby="cp-media__title cp-media__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="cp-media__title">The media pipeline</title>
<desc id="cp-media__desc">A master file and its JSON sidecar are committed under content/media. The content check validates alt text, credit and budgets. At build, static images go through Astro's image pipeline; animated WebP masters are emitted directly with still posters. Video, captions and PDFs are copied as they are. The output goes to dist and is published on GitHub Pages. Later, the backend's media service can provide the masters and the sizes instead.</desc>
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
<text x="558" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-media__body-3" data-slate-fit-padding="16">Static: astro:assets</text>
<text x="558" y="106" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="cp-media__body-3" data-slate-fit-padding="16">Animated: direct + poster</text>
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
<figcaption>The media pipeline. A master and its JSON sidecar are committed under content/media. The content check validates the metadata and the budgets. At build, Astro's image pipeline makes sizes for static pictures; animated WebP masters are emitted directly with still posters. Video, captions and PDFs are copied as they are. The output is published with the pages. Later, the backend's media service provides the masters and, optionally, the sizes.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The pipeline, as a table</summary>

| Stage | Input | Output | Tool |
|---|---|---|---|
| Author | A master file and its sidecar | Committed under `content/media/` | Any editor |
| Check | Sidecars, masters | Pass, or errors naming the file (alt text, credit, budget) | `npm run content:check` |
| Build, static images | The master and each use's layout slot | WebP at the slot's widths, width and height, focus | `astro:assets` (`getImage`) |
| Build, animated images | Animated WebP master and its still poster | Original animation URL, responsive still poster, width, height, focus | Media resolver; animation bypasses transforms |
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
| `crop` | image | no | A cropped copy's record: `from` (the original's ID) and `x`, `y`, `width`, `height` in the original's pixels. Cropping the copy again starts from there ([§9](#9-shapes-thumbnails-and-crops)) |
| `animation` | image | no | Present when the WebP master has more than one frame: `{ "poster": "cover.poster.webp" }`. The poster is its still first frame for reduced motion and thumbnails |
| `dark` | image | no | Its dark mode version: `{ "file": "cover.dark.webp" }`, a second master beside it, shown instead when the page is dark ([§10](#10-dark-mode-versions)). Left out, the same picture shows in both modes |
| `poster` | video | yes | A media ID (an image with alt text) |
| `captions` | video | yes | `[{ "file": "walkthrough.en.vtt", "srclang": "en", "label": "English", "default": true }]` |
| `transcript` | video, audio | when speech carries meaning | Markdown |
| `visibility` | all | yes | As for documents; a non-public asset can't be used by a published document |

**Measured, not written.** Width, height, duration, MIME type, file size and a dominant colour (the placeholder shown while a picture loads) are measured by the build, and returned by the API. They're never typed into a sidecar.

## 4. Formats and budgets

| Kind | Master format | Limit | Notes |
|---|---|---|---|
| Photo, painting, render | JPEG (quality 85 or more), WebP or AVIF | 2560 px on the long side, 1.5 MB | The build makes the smaller sizes |
| Animated picture | GIF on upload; animated WebP master | 2560 px per frame on the long side, 1.5 MB | Every frame, delay and loop is preserved; a still WebP poster sits beside it |
| Screenshot, UI, diagram with text | PNG or WebP (lossless) | 2560 px, 2 MB | Redraw sensitive diagrams schematically ([confidential work](../ia-navigation/06-content-inventory-and-mapping.md)); don't blur |
| Vector diagram | SVG | 200 KB | Sanitised: no scripts, handlers or external references |
| Video | MP4 (H.264, AAC) or WebM, kept as uploaded | Under 100 MB (GitHub's limit for a file) | With a poster (a frame from it) and a caption; long videos are better on YouTube or Vimeo as an `embed` ([§12](#12-video-files)) |
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
- **Animation:** a GIF upload is decoded with all of its frames and written as an animated WebP, with its frame delays and loop count preserved. Astro's image transforms flatten animation, so an animated master bypasses `astro:assets` and is emitted directly; its still poster can use the normal image pipeline. `Image` selects that poster for `prefers-reduced-motion: reduce`, including the right poster for a dark mode version. Thumbnails use the poster rather than starting many animations.
- **Output** goes to `dist/_astro/` with content-hashed names, so a changed master gets a new URL and caches never serve an old picture.
- **Caching:** Astro keeps generated images in `node_modules/.astro/assets`, and CI caches that folder between runs, so an unchanged master isn't processed again.
- **Crops and focus:** the lead picture's slot crops to its ratio around `focus` (CSS `object-position`, as the `Image` fundamental does); cards never crop ([§9](#9-shapes-thumbnails-and-crops)).

**Other files.** A PDF is published at `dist/media/<id>.pdf` as it is ([§11](#11-files-to-download)), and a video file at `dist/media/<id>.<mp4|webm>`, its poster made into sizes like any picture ([§12](#12-video-files)).

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

## 9. Shapes, thumbnails and crops

A picture is never cropped blindly. By default it's shown in one of two ways (§9.1 lets a page choose otherwise):
- **Framed whole.** Cards (a section's list, the home page, the planet's lists) show a page's picture whole, in a 3:2 frame: a picture of another shape sits in it with space around it, and a transparent one sits straight on the page.
- **Cropped to a shape.** The lead picture runs across the top of its page at 21:9, cropped around its focus point.

**The shapes are in one place,** `src/site/design/pictures.ts` (`PICTURE_SPECS`): each use's ratio, whether the design crops or frames it by default, and the widest it's shown, so a picture at least that wide stays sharp. The components frame to them, and edit mode shows them as tips.

| Use | Field | Shape | Shown (by default) | Sharp from |
|---|---|---|---|---|
| Lead picture | `hero.media` | 21:9 | Across the top of its page, filling it, cropped around its focus point | 2400 × 1029 px |
| Thumbnail | `thumbnail` (else the lead picture) | 3:2 | Whole on cards | 960 × 640 px |

**A page can have its own thumbnail** (`thumbnail`, a media ID): the picture on its cards. Left out, cards use the lead picture. So one wide lead picture can have a 3:2 thumbnail cut from it.

**Crops are copies.** Cropping (edit mode, [§6.1 of its spec](../editor/spec.md#61-the-crop)) never changes a picture:
- cropping an original makes a new picture beside it, named after its shape (`mark-21x9`), with the original's details and a `crop` record of where it was cut;
- cropping a cropped copy cuts again from its original (so it can grow back) and updates the copy, everywhere it's used;
- a use can ask for another copy of a copy (the thumbnail cut from the lead picture's copy is a second copy of the original);
- a copy is a picture like any other: its own master within the budgets, its own sidecar. If its original is deleted, it stays, and cropping it again starts from itself.

### 9.1 How a picture is shown: fill, fit, actual size, tile; a background; corners; a drop shadow

Every place a page shows a picture lets it choose how (6 October 2026, the owner's request). Left alone, each looks as it always has.

| Choice | Values | Default |
|---|---|---|
| **Shown as** (`display`) | `fill`: fills its frame, cropped around its focus point. `fit`: whole, with room round it. `actual`: its own pixel size, centred, made smaller only to fit, never enlarged. `tile`: repeated at its own size across the frame | Lead picture and carousel: fill. Figure and thumbnail: fit. Gallery: fill (or what its older `fit` says). Collection: fill in a shape, fit in its own |
| **Colour behind it** (`background`) | On: the room round a fitted or actual-size picture, and its transparent parts, take a colour from the picture itself: the average of its opaque edge pixels, or its dominant colour when the edges are transparent. A dark mode version has its own | Off |
| **Rounded corners** (`rounded`) | Off squares the corners (a full-bleed picture is square anyway) | On |
| **Drop shadow** (`shadow`) | On: a soft shadow under it that follows what shows (a filled picture casts its frame's shape, a fitted or transparent one its own shape; the room round it casts none). The lightbox shows a picture with its drop shadow only when this is on. Its offset, softness and colour are the `c.image.shadow-*` tokens | Off |

- **Where:** a figure (`display`, `background`, `rounded`, `shadow`, and its frame's shape, `ratio`: its own, 1:1, 4:3, 3:2, 16:9 or 21:9), a gallery and a carousel (for all their pictures), a collection (for all its items' pictures, with their frame's shape, `ratio`, like a figure's: [model §6.1](model.md#61-collections-one-shape-of-content-any-layout)), the lead picture (`hero.display`, `hero.background`, `hero.rounded`, `hero.shadow`) and the thumbnail on cards (`thumbnailStyle`: `display`, `background`, `rounded`, `shadow`).
- **The colour is worked out when the picture is prepared** (`src/site/content/pictures.ts`, the pure `edgeColour.ts`), once per master, and handed to the page as data; no colour is written in a stylesheet. It follows the theme with the picture's dark mode version.
- **Tiles** are drawn by the `Image` fundamental's script from the file the browser chose (the dark one in dark mode); until then, and without JavaScript, the picture itself shows, fitted.

### 9.2 Justified galleries

The gallery layout stored as `grid` is presented in edit mode as **Justified**. It keeps source order and uses fixed-height rows: 14 rem normally and 10 rem on a phone. The browser measures the gallery's actual column width and recalculates on a `ResizeObserver`, so the same content fits a reading column, a wide breakout and a resized window.

- A pure dynamic-programming pass considers one to eight consecutive pictures for each row. For each candidate it subtracts the exact gaps, scales every cell's natural aspect ratio by the same amount, and scores the horizontal or vertical crop needed to keep the fixed row height. Crop beyond 25 percent is penalised heavily, so another picture count wins when it is materially kinder to the set.
- A complete row consumes the column exactly. Widths are rounded to pixels and the final cell takes the rounding remainder, so the right edge and every gutter stay exact. Each picture fills its cell around its stored focus point.
- The final incomplete row keeps natural widths and the same row height instead of stretching its pictures. An extreme panorama that is wider than the row even on its own becomes a full-width single-picture row; its unavoidable side crop is the exception.
- Without JavaScript, the same links remain in source order in a wrapping, equal-height flex layout. The one page-level Lightbox still enhances them; it is not part of the geometry.

## 10. Dark mode versions

A picture made for a light page can glare on a dark one, or vanish into it (a diagram with dark lines, a logo, a screenshot). So a picture can have a **dark mode version**: the same picture, in colours for a dark page.

- **It's part of the picture,** not a picture of its own: a second master beside it, `<name>.dark.webp`, named in the sidecar as `"dark": { "file": "<name>.dark.webp" }`. It has the same ID, so every use of the picture gets it, and it shares the picture's alt text, caption, credit, licence and focus point. The content check refuses a dark master the sidecar doesn't name, a named one that's missing, and one that doesn't share the picture's name.
- **The site shows it whenever the page is dark:** the reader's chosen theme (the header's switch), or their system's when they haven't chosen. Without one, the same picture shows in both modes.
  - The `Image` fundamental draws it as a `<picture>` whose dark `<source>` answers to the system's `prefers-color-scheme`. Pictures are the one thing that follows a chosen theme by script, since an `<img>` can't take its picture from a colour role: the page's head points each dark source at a chosen theme as the page is read (so the first picture fetched is the right one), and `followThemeInPictures` (`src/site/scripts/theme.ts`) keeps them on it as the theme changes.
  - Figures, galleries, carousels (their filmstrips too), lead pictures, cards, a video's poster, the hero and avatars all pass it on. The lightbox opens the dark version while the page is dark, and changes with the theme while it's open. The social card (`og:image`) stays the light picture.
- **The same shape:** a dark version should match its picture's shape, or a page shifts when the theme changes. Edit mode says so when they differ; the page still lays out without a jump, since the dark source carries its own size.
- **It follows the picture:** a static crop cuts a static dark version from the same place (scaled, if its size differs); an animated picture is not destructively cropped. Replace keeps the dark version, and Delete deletes it and any still poster. It's within the same budgets as every master ([§4](#4-formats-and-budgets)), transparency and animation kept.
- **In edit mode** it's added, replaced and removed from the picture's details in Media ([its spec, §6.2](../editor/spec.md#62-dark-mode-versions)), and the library marks the pictures that have one.

## 11. Files to download

A PDF (the résumé's) is a media item of `kind: "document"`: the file and its sidecar side by side, as a picture's are.

```json
{ "kind": "document", "file": "prabin-pebam-resume.pdf", "title": "Prabin Pebam's résumé", "visibility": "public" }
```

- **Where it's published:** at `<base>/media/<id>.pdf` (the résumé: `/media/people/prabin/prabin-pebam-resume.pdf`), so the file keeps its own name when it's saved. The `content-files` integration ([`integrations/content-files.mjs`](https://github.com/prabinpebam/atiya/blob/main/integrations/content-files.mjs)) serves public documents from the dev server and copies them into `dist/media/` at build; nothing else of `content/` is published as a file.
- **How a page links to it:** a Markdown link with the `ref:` scheme, `[Download the résumé (PDF)](ref:media/people/prabin/prabin-pebam-resume)`, resolved with the base path ([model §5](model.md#5-references-and-targets)). The content check refuses a link to a document that doesn't exist or isn't public, and a sidecar whose file is missing or doesn't share its name.
- **Budget:** a PDF of at most 2 MB ([§4](#4-formats-and-budgets)); the check holds it.
- **Edit mode** doesn't manage documents yet: the library lists pictures and videos only. A document is added by putting its file and sidecar in its owner's folder.

## 12. Video files

A video can be the site's own file, not only a YouTube or Vimeo embed. It's a media item of `kind: "video"`: the file, its poster and its sidecar side by side.

```json
{ "kind": "video", "file": "product-demo.mp4", "title": "The product demo", "width": 1920, "height": 1080, "duration": 83.4, "poster": { "file": "product-demo.poster.webp" }, "caption": "Shot in Hyderabad.", "visibility": "public" }
```

- **Formats:** MP4 (H.264) or WebM, kept as uploaded (no re-encoding, no loss). A MOV is saved as an MP4 by copying its streams into the new container with ffmpeg, and an MP4 gets its index moved to the front of the file (`+faststart`), so it starts playing before it's all downloaded. Without ffmpeg an MP4 is kept as it is and a MOV is refused with what to do.
- **Under 100 MB.** GitHub refuses a file of 100 MiB or more in a push, and the content is published by pushing it, so edit mode refuses a video of 100,000,000 bytes or more, before it's uploaded and again on the server, and says how to make it smaller. Past 50 MB it uploads with a note that GitHub warns about files that big. The content check holds the limit on what's in `content/` (`tests/unit/content.test.ts`). Long or heavy videos are better on YouTube or Vimeo as an `embed`.
- **Its poster** is a frame from it, a second in (a tenth of the way into a short one, whose first frame is often black), taken by the browser when it's chosen. It's a second master beside it, `<name>.poster.webp`, made into sizes like any picture, and named in the sidecar, as a picture's dark version is ([§10](#10-dark-mode-versions)). The content check refuses a poster the sidecar doesn't name, and one that's missing.
- **Its words:** a `title` (required: it names the player for a screen reader, and the video in the library), a `caption` and a `credit` (shown centred under it, as under a picture), a licence and a source. Its size and length are measured when it's uploaded, so the page keeps its shape before it loads.
- **Where it's published:** at `<base>/media/<id>.<mp4|webm>`. The `content-files` integration serves public videos from the dev server, with byte ranges so a reader can seek, and copies them into `dist/media/` at build.
- **How a page shows it:** a `video` block with `media` (its ID) instead of `embed` ([model §6](model.md#6-blocks)). The block's own `title`, `caption` and `credit` override the video's. The `VideoEmbed` compound draws it with the `Video` fundamental: the browser's own controls, its poster, never autoplaying, in its own shape, with the caption centred under it.
- **In edit mode** it's uploaded from the same form as a picture (the picker or the library), chosen for a Video block from the palette, and listed in the library with its poster, its length and a Video tag. Its details (the player, the title and the words) save to its sidecar, and Delete removes the video, its poster and its sidecar once nothing uses it ([editor spec §6](../editor/spec.md#6-media)).
