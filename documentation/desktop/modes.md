# Navigation modes: spec

The site is one set of pages that can be explored in more than one way. The **site** itself (the regular pages, which the game calls the classic site) is always there. A **navigation mode** is an optional, pluggable way to move through the same content: the little planet is one. A mode is made on its own, against a fixed contract, and plugs into any site that turns it on. Think of Steam and its Big Picture mode: two ways into the same library, and here anyone can make another. This page is the spec (v1, for review; nothing is built yet). It's part of the [desktop app spec](spec.md), whose [plan](plan.md) schedules it.

> **TL;DR.**
> - **The site is enough.** A person can have just the site: no mode, no game code, no 3D assets in their build, no Explore button. Every mode can be turned on and off at any time, in edit mode and in the app (§2).
> - **A mode navigates; it never owns content.** It gets a read-only, build-time snapshot of the site's sections and their published open pages (**mode data**), arranges them its own way (buildings, rooms, stars), and opens every page in the engine's **reading frame**, so a page reads the same everywhere and always has its address on the site (§3, §5).
> - **The engine wraps every mode in the same shell** (the **mode host**): the header with the way back to the site, the capability gate, the poster before it loads, the reading frame, the fallback when it fails, deep links, telemetry and budgets. A mode can't remove any of it, so every mode keeps the site's guarantees (§4).
> - **The contract** is a manifest (`mode.json`), an entry with `mount(root, host)`, a JSON schema for the mode's own structure and settings, and a conformance suite: a keyboard and DOM route to every section, reduced motion, budgets, no network of its own, credited assets (§5, §6).
> - **Made in isolation.** A mode is its own package, with its own dependencies, dev server, tests and budgets, run against starter content by the mode kit's harness. It never imports the site, and the site never imports it (§7).
> - **Three kinds.** *Built in*: shipped with the engine for any site (Little planet, and a small reference mode). *A site's own*: in the site's repository, like the owner's planet. *From someone else*: pinned by version and checksum, and run in a sandboxed frame with no access to the site's storage (later; §8).
> - **The planet splits in two.** Little planet becomes the generic, built-in mode: the world, the buildings, crafting, wildlife, without the owner's characters. **Prabin's planet** is his own mode, built on Little planet with his residents (Chopper, the family, Prabin) and his music, kept in his repository and never in an engine release (§9).

<figure class="slate-figure" data-diagram="modes">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 500" role="img" aria-labelledby="md-arch__title md-arch__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="md-arch__title">Navigation modes: one site, many ways to explore it</title>
<desc id="md-arch__desc">The site's content and the site's settings feed the engine's mode host. The host builds each enabled mode's data from the content (sections and their published open pages, never drafts or private pages) and wraps every mode in the same shell: the header with the way back to the site, the capability gate, the reading frame that shows every page, the fallback and telemetry. The site itself is always on and canonical. Little planet is a mode built into the engine, for any site; the owner's planet is his own mode, built on Little planet with his residents; a new mode is made in isolation with the mode kit, and one from someone else runs sandboxed.</desc>
<g id="md-arch__content" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="md-arch__body-1" x="40" y="40" width="270" height="150" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="md-arch__body-1" data-slate-fit-padding="16">content/</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="md-arch__body-1" data-slate-fit-padding="16">items and structures</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="md-arch__body-1" data-slate-fit-padding="16">Sections and their pages</text>
<text x="60" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="md-arch__body-1" data-slate-fit-padding="16">One structure per mode</text>
</g>
<g id="md-arch__host" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="md-arch__body-2" x="365" y="40" width="270" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="385" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="md-arch__body-2" data-slate-fit-padding="16">The mode host</text>
<text x="385" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="md-arch__body-2" data-slate-fit-padding="16">the shell every mode gets</text>
<text x="385" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="md-arch__body-2" data-slate-fit-padding="16">Header, gate, fallback</text>
<text x="385" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="md-arch__body-2" data-slate-fit-padding="16">Reading frame, telemetry</text>
</g>
<g id="md-arch__settings" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="md-arch__body-3" x="690" y="40" width="270" height="150" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="710" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="md-arch__body-3" data-slate-fit-padding="16">ways.json</text>
<text x="710" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="md-arch__body-3" data-slate-fit-padding="16">which ways to explore are on (content)</text>
<text x="710" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="md-arch__body-3" data-slate-fit-padding="16">Each mode, on or off</text>
<text x="710" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="md-arch__body-3" data-slate-fit-padding="16">Its address; the first offer</text>
</g>
<g id="md-arch__site" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="md-arch__body-4" x="40" y="290" width="215" height="120" rx="16" fill="var(--color-brand-bg)" />
<text x="60" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="md-arch__body-4" data-slate-fit-padding="16">The site</text>
<text x="60" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="md-arch__body-4" data-slate-fit-padding="16">always on, canonical</text>
<text x="60" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="md-arch__body-4" data-slate-fit-padding="16">every page's own address</text>
</g>
<g id="md-arch__little-planet" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="md-arch__body-5" x="275" y="290" width="215" height="120" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="295" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="md-arch__body-5" data-slate-fit-padding="16">Little planet</text>
<text x="295" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="md-arch__body-5" data-slate-fit-padding="16">built in, for any site</text>
<text x="295" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="md-arch__body-5" data-slate-fit-padding="16">Seven buildings</text>
</g>
<g id="md-arch__owner-planet" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="md-arch__body-6" x="510" y="290" width="215" height="120" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="530" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="md-arch__body-6" data-slate-fit-padding="16">Prabin's planet</text>
<text x="530" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="md-arch__body-6" data-slate-fit-padding="16">the owner's own mode</text>
<text x="530" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="md-arch__body-6" data-slate-fit-padding="16">Little planet, his residents</text>
</g>
<g id="md-arch__new-mode" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="md-arch__body-7" x="745" y="290" width="215" height="120" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="765" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="md-arch__body-7" data-slate-fit-padding="16">A new mode</text>
<text x="765" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="md-arch__body-7" data-slate-fit-padding="16">made alone, with the kit</text>
<text x="765" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="md-arch__body-7" data-slate-fit-padding="16">Sandboxed if not ours</text>
</g>
<text x="318" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">read</text>
<text x="646" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">turned on</text>
<text x="512" y="222" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">mode data and the host's calls</text>
<text x="157" y="244" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">every page</text>
<text x="40" y="460" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">A mode arranges and moves; it never owns content. Every page reads in the host's frame and has its address on the site.</text>
<g id="md-arch__flow-1" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M310 115 L355 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="364,115 355,120 355,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="md-arch__flow-2" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M690 115 L645 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="636,115 645,120 645,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="md-arch__flow-3" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M147 190 L147 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="147,289 152,280 142,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="md-arch__flow-4" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M500 190 L500 240 L382 240 L382 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="382,289 387,280 377,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="md-arch__flow-5" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M500 190 L500 240 L617 240 L617 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="617,289 622,280 612,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="md-arch__flow-6" data-slate-svg-step="13" data-slate-svg-effect="draw">
<path d="M500 190 L500 240 L852 240 L852 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="852,289 857,280 847,280" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>One site, many ways to explore it. The host gives every mode the same data and the same shell; the site is always on and canonical.</figcaption>
</figure>

## 1. Words

| Word | Means |
|---|---|
| **The site** | The regular pages: the home hub, sections and pages. Always on, the canonical address of every page, the only thing search engines index. In the game's glossary it stays "the classic site" |
| **Navigation mode** (a mode, for short) | An optional way to explore the site, mounted at its own address (`/play/`). Not to be confused with edit mode, which is the editor |
| **Ways to explore** | What a person sees in edit mode and the app: the site, plus the modes they turned on |
| **Mode host** | The engine's part that builds a mode's data, renders its page and shell, and offers its calls (§4) |
| **Mode data** | The read-only snapshot a mode gets: the site's identity, its sections and their published open pages, and the mode's own structure (§5.2) |
| **Slot** | A place in a mode that shows one section: a building, a room, a star. A mode has a fixed set of slots or one per section |
| **Reading frame** | The engine's overlay that shows a section's list and its pages over a mode, rendered by the site's own layouts. Today's planet frame, generalized ([sections §6](../sections/spec.md#6-reading-on-the-planet-u13u15)) |
| **Mode kit** | The SDK for making a mode: types, the manifest schema, the harness and the conformance suite (§7) |

## 2. The site, and turning modes on and off

- **The site is not a mode and can't be turned off.** Like a desktop under Big Picture, it's where everything lives; a mode is a way in. Every page a mode shows has its page on the site (V13).
- **Just the site** is a first-class choice, in setup and at any time after. A site with no mode turned on:
  - builds no mode routes and emits no mode chunks or assets (no textures, models or audio in `dist/`);
  - shows no Explore button in the header and no mode buttons on the home page, whose opening uses the home hub's own picture;
  - ignores a visitor's remembered choice (`site.mode`).
- **Turning a mode on** (edit mode's **Ways to explore** screen, §10) adds it to the site's ways file with its structure: a starting map of its slots to the site's sections, which the person can change. The next Save to remote builds it.
- **Turning it off** keeps its structure in content (so turning it back on restores the map) and leaves, at its address, a small static page that says the site doesn't offer that way of exploring any more, with a link to the home page. It isn't a redirect, and it carries `noindex`.
- **Several modes at once** are allowed, each at its own address. One of them, or the site, is the home page's primary way in (§4.6).

The site's **ways file**, `content/structures/ways.json`, holds which modes are on. It's content, not `atiya.json` (decision D-W1, [plan stage 8A](plan.md#stage-8a-ways-to-explore-on-and-off-the-next-set)): the choice is editorial, made in edit mode, so it goes through edit mode's store (versions, the content check, live updates) and Save to remote like any other content, while `atiya.json` keeps what the app and the build own ([desktop spec, §6.3](spec.md#63-what-a-site-repository-holds)). Without a ways file, a site with a planet structure has Little planet on and offered first, as its home page always did.

```json
{
  "modes": [
    { "id": "little-planet", "on": true, "mount": "play" }
  ],
  "primary": "site"
}
```

- **`id`** names a built-in mode, a site's own (`local:<folder>`, §8.2) or one from elsewhere (`github:<owner>/<repo>`, with `sha256`, §8.3).
- **`version`** (optional) pins it; a built-in mode's version comes with the engine's.
- **`mount`** is its address under the site's base (`/play/`). It defaults to the manifest's, and must not collide with a section's slug, another mode's mount or the site's own routes (V34).
- **`primary`** is the way in a first-time visitor is offered first on the home page: `site` or a mode's `id`.

## 3. What a mode is, and isn't

| A mode does | A mode doesn't |
|---|---|
| Arrange the site's sections in its own space, through its slots | Hold content: no words of a page, no media of its own about the person |
| Show a section's name, kicker, summary and its pages' titles, summaries and thumbnails, from mode data | Render a page's blocks: pages open in the reading frame |
| Offer its own way of moving (walking, flying, scrolling a map) | Take away the way back to the site, the header or the keyboard route |
| Keep its own state in the host's storage (a backpack, where you stood) | Read or write the site's storage, cookies or sessions |
| Ship its own art, sound and code, within its budgets | Fetch anything from another host unless its manifest names it and the person accepts it (§8.3) |
| Show words of its own (a sign, a greeting), from its structure or its code | Show drafts or private pages, or their titles (V28): mode data never holds them |

Content stays where the [content spec](../content/spec.md) puts it: items are channel-agnostic, and each channel maps them through its own structure ([structures §1](../content/ia.md#1-items-and-structures)). A mode is one more channel, and its structure is `content/structures/modes/<id>.json`, checked by the content contract and by the mode's own schema.

## 4. The mode host: what every mode gets

The host is engine code. Every mode runs inside it, so the site's rules hold whatever a mode does.

### 4.1 The page

`/<mount>/` is an engine page (today's `play.astro`, generalized), rendered by a site layout:
- **The header:** the site's name (to home), **Classic site** (to the page or section that matches where the visitor is, else home; always visible, never covered), the theme, and, with several modes on, **Ways to explore** (a menu of them).
- **The poster** (T0): the mode's poster picture and its first words, painted before any of the mode's code loads, as the planet's welcome is today ([progressive loading](../poc-3d-navigation/progressive-loading.md)).
- **The region** the mode mounts into, labelled with the mode's name.
- **A live region** the mode announces through.

### 4.2 The capability gate

The manifest declares what the mode needs (`requires`: WebGL 2, device memory, a fine pointer or any). The host's gate checks it with no import of the mode, as `gate.ts` does today; a device that fails it never downloads the mode's chunks, and sees the poster with **Read the site** and why ("This needs a graphics feature your browser hasn't turned on").

### 4.3 Loading and the fallback

- The host imports the mode's entry dynamically, calls `mount`, and hides the poster when the instance is ready.
- **A failure** (the import, `mount` throwing or never settling within the manifest's `readyTimeoutS`, or an uncaught error in its first seconds) shows the host's card: what happened, **Try again** and **Read the site**. The mode can't replace this card.

### 4.4 The reading frame

- `host.open({ slot, page? })` opens the frame on the slot's section list or one of its pages, at `/<mount>/<slot>/` and `/<mount>/<slot>/<page>/`, static pages built by the site's layouts with the frame chrome (a place bar with the slot's name, Show contents, Open classic page, the theme, Close). It's today's planet frame with its messages renamed from `planet:*` to `frame:*` (each carrying the mode's `id`).
- **While it's open the mode is paused** (`pause()`), and the frame owns focus, Tab, Space and Esc, as in [sections §6.5](../sections/spec.md#65-keys).
- **Links between slots** follow the manifest's `frame.otherSlot`: `note` (today's planet: "That's in the Lighthouse. Walk there to read it.", with the words from the slot's `reach` text) or `open` (the frame moves there, for modes where that's natural).
- **Pages only on the site** open the site in a new tab, as today.

### 4.5 Addresses and switching

- **Into a mode:** `/<mount>/?at=<slot>&page=<id>` (today's `?at=…&open=1&page=…`, kept as an alias for the planet). The host passes it in mode data's `entry` and through `goTo`.
- **From the site into a mode:** the site's Explore link carries the context: the page, in the slot whose section holds it; else the slot whose section this is; else the mode's start. The host computes it at build time from each mode's structure, so the site never loads a mode's code to make a link.
- **From a mode to the site:** Classic site and Open classic page carry the page, else the slot's section, else home.
- **Between modes:** Ways to explore goes to the other mode with the same context.
- **The mode keeps the address current** through `host.setAddress(context)`, with `replaceState`, so a reload or a shared link returns to the same place.

### 4.6 The home page

The home page's opening keeps the name and the standfirst. Its ways in are the site (**Read the site**, to the sections) and one button per mode that's on, with the mode's label from its structure ("Explore the planet"). The visitor's last choice (`site.mode`, now a mode's `id` or `site`) is the primary button; for a first visit it's the ways file's `primary`. The painted picture is the primary mode's poster, or the home hub's picture.

### 4.7 Telemetry

A mode sends nothing itself. `host.track(event)` passes the host's allowlist: `mode:enter`, `mode:ready` (with the load time), `mode:open` (slot, page ID), `mode:exit` (to where), `mode:fail` (a reason code). Mode pages are treated like protected pages ([access spec §9](../access/spec.md)): only the allowlist leaves the browser.

### 4.8 Budgets

The manifest declares budgets in the tiers of [progressive loading §5.6](../poc-3d-navigation/progressive-loading.md): critical JS, each later chunk, and the download before the mode is live. The size report checks each mode against its own, and every mode against the engine's ceilings (today's planet figures: 450 KB, 150 KB and 1.6 MB gzip). A mode over its budget fails the build, naming the chunk.

## 5. The contract

### 5.1 The manifest

`mode.json`, at the root of a mode's package, validated by the mode kit's schema:

```json
{
  "api": 1,
  "id": "little-planet",
  "name": "Little planet",
  "version": "1.0.0",
  "summary": "Walk around a small planet. Each building holds one of your sections.",
  "author": { "name": "Prabin Pebam", "url": "https://github.com/prabinpebam" },
  "licence": "MIT",
  "entry": "dist/entry.js",
  "mount": "play",
  "label": "Explore the planet",
  "poster": { "image": "poster.webp", "dark": "poster.dark.webp", "alt": "A small green planet with seven buildings round a plaza" },
  "requires": { "webgl": 2, "deviceMemoryGB": 4, "pointer": "any" },
  "readyTimeoutS": 20,
  "budgets": { "criticalKB": 450, "laterChunkKB": 150, "beforeLiveKB": 1600 },
  "slots": { "kind": "fixed", "ids": ["workshop", "town-hall", "lighthouse", "library", "amphitheater", "greenhouse", "post-office"] },
  "structure": "structure.schema.json",
  "settings": "settings.schema.json",
  "frame": { "otherSlot": "note" },
  "pictures": { "thumbnail": [256, 512] },
  "network": [],
  "credits": "CREDITS.md"
}
```

| Field | Means |
|---|---|
| `api` | The contract version it implements. The engine hosts a range (§11); outside it, the build refuses the mode by name |
| `id`, `name`, `version`, `summary`, `author`, `licence` | Who it is; shown in edit mode and the app. `licence` is required for anything outside the engine |
| `entry` | The built module exporting `mount` |
| `mount`, `label`, `poster` | Its default address, its button's words and its T0 picture (with a dark version and alt text) |
| `requires`, `readyTimeoutS`, `budgets` | The gate (§4.2), the fallback (§4.3), the size report (§4.8) |
| `slots` | `fixed` with its IDs (a world with seven buildings), or `per-section` with a `max` (a map that grows) |
| `structure`, `settings` | JSON schemas for the slot map and the mode's own settings, in the field kinds edit mode can draw (§10) |
| `frame.otherSlot` | `note` or `open` (§4.4) |
| `pictures` | The thumbnail widths it wants; the host makes them through the site's picture pipeline |
| `network` | Origins it may reach (none by default). Built-in modes have none |
| `credits` | Every asset's source and licence, as `assets-src/CREDITS.md` does today |

### 5.2 Mode data

Built once per build by the host, plain JSON, serialised into the mode's page (as `play.astro` serialises the planet's today):

```ts
interface ModeData {
  api: 1;
  mode: { id: string; mount: string; settings: unknown };      // settings checked by the mode's schema
  site: {
    name: string; description: string; locale: string; base: string;
    owner: { name: string; role?: string; avatar?: Picture };
  };
  sections: Array<{
    id: string; title: string; summary: string; view: SectionView;           // the site's: list, tiles, bento, features
    url: string;                                                 // the section's site address
    hasPrivate: boolean;                                         // never which, or how many
    pages: Array<{ id: string; title: string; summary: string; kind: Article['kind'];
                   url: string; thumbnail?: Picture }>;          // published, open, in the section's order
  }>;
  slots: Array<{ id: string; section: string | null; words: Record<string, string> }>;
  entry: { slot?: string; page?: string };
  links: { home: string; signIn: string; contact?: string };
}
interface Picture { src: string; srcset: string; width: number; height: number; alt: string; bg?: string; dark?: string }
```

Private and draft items never enter it (V28, generalized to every mode, V36). A section with private pages says only `hasPrivate`, so the frame's list can show the invited-readers panel, as the planet's does today.

### 5.3 The entry and the host's calls

```ts
export function mount(root: HTMLElement, host: ModeHost): Promise<ModeInstance>;

interface ModeHost {
  data: ModeData;
  open(target: { slot: string; page?: string }): void;      // the reading frame
  onReading(cb: (open: boolean) => void): () => void;
  toSite(context?: { slot?: string; page?: string }): void;
  setAddress(context: { slot?: string; page?: string }): void;
  announce(text: string, politeness?: 'polite' | 'assertive'): void;
  prefs: { reducedMotion: boolean; scheme: 'light' | 'dark'; theme: 'system' | 'light' | 'dark';
           sound: boolean; largerText: boolean; input: 'mouse' | 'touch' | 'keyboard' };
  onPrefs(cb: (prefs: ModeHost['prefs']) => void): () => void;
  storage: { get(key: string): unknown; set(key: string, value: unknown): void; remove(key: string): void };
  asset(path: string): string;                               // the mode's own files, through the base path
  track(event: ModeEvent): void;
  signal: AbortSignal;                                       // aborted at unmount
}

interface ModeInstance {
  goTo(target: { slot?: string; page?: string }): void;
  pause(): void;
  resume(): void;
  unmount(): Promise<void>;
}
```

- **`storage`** is namespaced (`mode.<id>.`) and capped (256 KB per mode); it's the only storage a mode has. The planet's saved backpack and settings move into it.
- **`prefs`** are the site's own (the theme, Larger text) plus the mode's sound switch, which the host keeps off until a press, as the planet does now.
- **`signal`** is passed to every listener the mode adds outside its root, like the site's `each(…, signal)` rule.

### 5.4 Requirements (the conformance suite)

| # | Requirement | Checked by |
|---|---|---|
| R1 | **A DOM route to every slot.** Every slot with a section can be reached and opened by keyboard alone, from a list in the DOM (the planet's Fast travel), not only by moving in the mode's space | The kit's E2E: Tab to the list, open each slot's frame |
| R2 | **Pages open in the frame.** A mode calls `host.open`; it never renders a page's blocks or fetches content files | The kit's static check (no imports of content; no fetches outside `asset`) |
| R3 | **The way back stays.** Nothing covers the host's header; Tab is never captured; Classic site works from every state | The kit's E2E, in every state the mode reports |
| R4 | **Reduced motion** is honoured: no camera sweeps, no drifting, a steady sign for every cue | E2E with `prefers-reduced-motion` |
| R5 | **Every cue has a text twin** (a label, a prompt or an announcement), and functional text is at least the site's small size | Axe over the mode's DOM, light and dark; the kit's checks |
| R6 | **More sections than slots** (fixed slots): unmapped sections are listed in the DOM route under "More on the site", linking to them | Unit test of the slot map; E2E on a fixture with ten sections |
| R7 | **Fewer sections than slots:** an empty slot shows its state (a closed building with a sign), never an error | E2E on a fixture with one section |
| R8 | **Budgets and the gate**, as declared | The size report; a gated-out run requests no mode chunk |
| R9 | **No network of its own** beyond `network`; no telemetry; no storage beyond `host.storage` | The kit's E2E records every request and storage access |
| R10 | **Credited assets** with licences that allow use on other people's sites | The kit's check of `credits` against the package's files |
| R11 | **Unmount cleans up:** no listener, timer, audio or GPU context left behind | E2E: mount, unmount, mount, compare |

## 6. Slots and the mode's structure

- **The structure** is `content/structures/modes/<id>.json`: the mode's settings and its slot map, each slot naming a section (or none) and the mode's words for it, in the shapes its schema allows. Little planet's is today's `planet.json` (each place's title, kicker, summary and `site`), unchanged in meaning.
- **Rules** the content contract adds for every mode:
  - V33: every mode turned on in the ways file resolves to a known manifest, at an `api` the engine hosts;
  - V34: mounts are unique and collide with no section slug or site route;
  - V35: the structure validates against the mode's schema, and every slot it names is one of the mode's;
  - V36: a slot shows a section that exists; a section is shown by at most one slot of a mode (V15, per mode); mode data holds no draft or private item (V28);
  - V37: a mode turned off keeps its structure, and builds only its "not offered" page.
- **A starting map** when a mode is turned on: the host offers its sections to its slots in order (or the mode's `suggest` export, a pure function of the sections, if it has one), and the person changes it in edit mode.

## 7. Making a mode in isolation

### 7.1 A mode's package

```text
modes/<id>/
  mode.json               the manifest
  package.json            its own dependencies, exact pins; it never lists the engine
  src/entry.ts            mount()
  structure.schema.json   settings.schema.json
  assets/                 its art, sound, models (emitted only when the mode is on)
  CREDITS.md              every asset's source and licence
  tests/                  its unit and E2E tests
```

It builds to `dist/` with its own bundler configuration (the kit's Vite preset, which names chunks `mode-<id>-*`). It imports only its own code, its dependencies and the mode kit's types: never the site, the engine, or another mode, except a mode it's built on (§9), as a package dependency.

### 7.2 The mode kit

`packages/mode-kit/` in the engine repository, published with the engine's releases under a permissive licence so anyone can build a mode:
- **types and schemas:** `ModeData`, `ModeHost`, `ModeInstance`, `mode.json`'s schema, the field kinds for structure and settings;
- **the harness:** `npx atiya-mode dev` runs the mode inside a real host page on its own dev server, with fixture mode data made from the starter content (and variants: one section, ten sections, a section with private pages, empty), the reading frame, and a panel to switch prefs (reduced motion, dark, Larger text, touch);
- **the checks:** `npx atiya-mode check` runs R1 to R11 against a build, with axe, and prints what failed and where;
- **a template:** `npx atiya-mode new <id>` writes a minimal working mode: a DOM list of slots and a canvas, passing every check.

So a mode is made and tested without the site, its content or its dev server, and plugs into any site that turns it on.

### 7.3 The reference mode

The engine ships a second, small mode, **Constellation**: the sections as stars on a 2D canvas, their pages as satellites, `per-section` slots, `otherSlot: open`, no WebGL. It exists to prove the contract isn't shaped like the planet, to be the template's fuller example, and to give a light alternative for any site. It's held to the same checks.

## 8. Where modes come from

### 8.1 Built in

Modes in the engine repository's `modes/` that the release packs (Little planet, Constellation). They come with the engine's version, are reviewed like the engine, and run in the site's page (trusted, as the planet does today).

### 8.2 A site's own

A mode in the site's repository (`modes/<folder>/`, turned on as `local:<folder>`), built by the site's workflow with the engine's host. It's code the person (or someone they asked) wrote, so it runs trusted in the page. The owner's planet is one (§9). Edit mode and the app list it, and say it's the site's own code.

### 8.3 From someone else (later)

- **Pinned:** `github:<owner>/<repo>` at a version and a `sha256` of its release archive; the site's build downloads, checks and builds it. The app offers a short catalogue (`modes/catalogue.json` in the engine repository, each entry reviewed); anything else is behind Settings → Advanced, with the author, licence and requested `network` shown first.
- **Sandboxed:** such a mode runs in an `iframe` with `sandbox="allow-scripts allow-pointer-lock"` and no `allow-same-origin`, so it has an opaque origin: it can't read the site's storage, its access keyrings or its sessions, and a content security policy limits its connections to `network`. The host's calls go over `postMessage` behind the same `ModeHost` interface (the kit hides the transport), and its files are served from the site, which GitHub Pages allows from any origin. The reading frame stays outside the sandbox, over it.
- **Why:** a mode runs on the same origin as private pages. A built-in or site's own mode is code the person chose to run; a stranger's isn't. A spike settles the sandbox's cost to input, audio and WebGL first (§12).

## 9. The planet, split in two

| | Little planet (built in) | Prabin's planet (the owner's own) |
|---|---|---|
| Where | `modes/little-planet/` in the engine | `modes/prabin-planet/` in the owner's repository, excluded from engine releases |
| Holds | The world, the seven buildings, the plaza, the sky and day–night, weather, grass and wildlife, collecting, crafting, the swing and the deck, the player characters, ambient sound | Little planet, plus his **residents**: Chopper, the family and Prabin (their brains, models, portraits and lines), his background music and his welcome |
| Greets visitors with | The site owner's welcome lines (from their person and the structure's `welcome`), spoken by a host the person chooses (desktop spec O5) | Prabin, as today |
| Used by | Any site | Only his |

- **Little planet exposes extension points**, so a mode can be built on it without forking it: `createPlanetMode({ residents, music, welcome, targets })`. A resident is a lazily loaded chunk with a pure brain, a view and its talk lines, attached the way the home and Chopper are today (`controller.attachHome`, `attachChopper`). Prabin's planet is `createPlanetMode` with his three residents and his tracks.
- **Nothing visible changes for the owner's visitors**: the same address (`/play/`), the same world, the same characters. The planet's rules in AGENTS.md move with the code into the mode's own AGENTS.md, and the owner-only parts into his mode's.
- **This is the [app separation](../engineering/app-separation.md) proposal's target, reshaped:** its `apps/planet` becomes `modes/little-planet` plus `modes/prabin-planet`, its `packages/platform` the mode host's shared helpers, and its seams (content, routes, mode memory) the contract above.

## 10. In edit mode and the app

- **Ways to explore** (edit mode, replacing the Planet screen, in the sections manager's pattern): the site, always on, then every mode the site can use (built in and its own), each with:
  - a switch (on or off), its label, its address, and **Make it the first way in**;
  - **Slots**: each slot with its section (a choice of the site's sections) and the mode's words for it, in forms drawn from the mode's schema with the field kinds edit mode knows (text with a length, a section, a page, a choice, a switch, a picture); a mode can't bring its own editor screens in v1;
  - **Settings**: the mode's own, from its settings schema;
  - **Try it**: opens the mode on the dev server, at the chosen slot.
- **The app's setup** asks how visitors explore the site ([desktop spec §4.3](spec.md#43-the-screens)): two cards, **The site, with a little planet to walk around** (chosen) and **Just the site**; other built-in modes are turned on later, here.
- Every change goes through the store and the content check, as every edit does.

## 11. Versions

- **The contract has its own version** (`api`), separate from the engine's. The engine hosts a range (v1: `api` 1); a new `api` adds calls without removing any within a major version.
- **A built-in mode's version** follows the engine release that carries it. A site's own mode is built with the site; one from elsewhere is pinned, and the app offers its updates like the engine's.
- **Moving a site to a newer engine** (desktop spec §10.3) checks each mode that's on: a mode outside the new engine's range must be updated or turned off first, and the app says which and why. A build never drops a mode silently: it fails, naming it, and GitHub Pages keeps serving the last good build.

## 12. Open decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| N1 | Words for people | Ways to explore; Modes; Experiences | "Ways to explore" in the interface; "navigation mode" for authors and these docs |
| N2 | Modes from other people in v1 | Built in and a site's own only; also a reviewed catalogue, sandboxed | Built in and a site's own only in v1; the catalogue after the sandbox spike |
| N3 | A second, reference mode in v1 | Constellation; none | Constellation: the only proof the contract isn't planet-shaped |
| N4 | What setup preselects | Just the site; the site and Little planet | The site and Little planet, with Just the site one click away |
| N5 | Can a mode be the home page | Never (the home is always the site's, with the ways in); allowed | Never: the home page and every page's address stay the site's; `primary` only picks the first button |
| N6 | Editor screens from a mode | Schema forms only; a mode's own screens | Schema forms only in v1 |
| N7 | The mode kit's licence | The engine's (O3); permissive (MIT) | Permissive, so anyone may make and share a mode, whatever O3 decides for the engine |

## 13. Phases

Built as stage 8 of the [plan](plan.md#stage-8-navigation-modes), inside the engine. M1 and M2 change nothing a visitor of the owner's site sees; each phase measures the planet with `npm run verify:prod` and `npm run perf:audit` before and after.

| Phase | What | Leaves |
|---|---|---|
| **M1. The host and the contract** | `ModeData` built from the content (today's `PlanetData`, generalized: sections, their published open pages, slots); the mode page (`play.astro` generalized: header, poster, gate from the manifest, fallback card, live region); the reading frame generalized (`frame:*` messages, `/<mount>/<slot>/…` routes, `otherSlot`); `host.storage`, `prefs`, `track`, `setAddress`; the ways file's `modes` and `primary` (stage 8A, D-W1); V33 to V37 in the loader; `planet.json` moved to `content/structures/modes/<id>.json` by a contract migration. Today's planet mounts through it unchanged, as the first mode | The planet behind the contract, at `/play/`, identical to visitors |
| **M2. Just the site** | A site with no mode on: no mode routes, chunks or assets in `dist/` (the planet's textures, models and audio move from `public/` into the mode's own assets, emitted only when it's on); no Explore button; the home page without a mode; a turned-off mode's "not offered" page | A real classic-only build, tested |
| **M3. The planet split** | `src/game/` moves to `modes/little-planet/` (its own package, dependencies and tests, the [app separation](../engineering/app-separation.md)'s phase 2 reshaped); the extension points (`createPlanetMode`: residents, music, welcome, targets); Chopper, the family, Prabin and the music move to `modes/prabin-planet/` as residents; Little planet's host (O5) and ambient sound (O6); AGENTS.md split with the code | Little planet for anyone; Prabin's planet on his site, unchanged for his visitors |
| **M4. The mode kit** | `packages/mode-kit/`: types, the manifest schema, the harness with fixture mode data (one, seven and ten sections; private pages; empty), the conformance suite R1 to R11, the template; both planets pass it | Modes made and tested alone |
| **M5. The reference mode and the screen** | Constellation (`modes/constellation/`), passing the kit; edit mode's **Ways to explore** screen (switches, slots and settings from the schemas, first way in, Try it), replacing the Planet screen; the site's Explore link and the home page's ways in for several modes | Two built-in modes; any site can choose |
| **M6. Modes from others** (after v1) | The sandbox spike (input, pointer lock, audio, WebGL and asset loading from an opaque-origin frame); the host's calls over `postMessage`; pinned `github:` modes with checksums; the reviewed catalogue; the app's install flow with author, licence and network shown | Other people's modes, isolated from the site's storage |

## 14. As built

On the `desktop-app` branch, and stage 8A on `ways-to-explore` ([plan §6](plan.md#6-status) has the evidence).

- **The contract's first part (M1, 8.2)** is in `src/site/modes/`: `contract.ts` (the manifest's schema, the ways file, `ModeData`, `HOSTED_API` 1 to 1), `builtin.ts` (Little planet's manifest; its structure is still `content/structures/planet.json`, read as its seven slots), `data.ts` (`buildModeData`, through the same rule the planet uses for a building's pages), `rules.ts` (V33 to V37) and `ways.ts` (`effectiveWays`). A section's `view` is any of the site's views (`features` too), and a page's `kind` any of the content contract's (`talk` too), as §5.2 now says.
- **The rules are the content contract's (8A):** `loadContent` reads the ways file into `index.ways` and checks V33 to V37 against the effective ways for every site (the engine's own repository too), once the rest of the content holds, so the store refuses a change that breaks one (422) and a build fails on it, naming the rule.
- **Mounts:** `play`, kept by the site's routes for a mode, is a mode's to take; every other reserved path (`design`, `docs`, `_edit`, …) and every top-level section or page is taken. A mode turned off keeps its mount, since its "not offered" page answers there.
- **The planet reads mode data (8.1, in part):** `play.astro` gets Little planet's `ModeData` from the repository (`getModeData`) and turns it into the buildings with the game's pure `landmarksFrom` (`src/game/world/modeLandmarks.ts`), which declares the few fields it reads, so the game still imports nothing from the site. A unit test holds the result equal to the join `play.astro` made before, on the owner's site; the game's bundles are the same size, since only the page's build changed.
- **On and off (8A):** the repository's `getPlanet()` answers only while Little planet is on, so every page that offers the planet (the header's action, the home page, the buildings' pages, the reading frame's pages) leaves it out when it's off; `integrations/features.mjs` (`planetOn`) decides the same for the build (the footer's link, the game's chunks and assets, the Planet screen). Off, `/play/` renders `NotOffered.astro` (`noindex`, a link home); a site that never had the planet still sends `/play/` home. Edit mode's **Ways to explore** (`/_edit/ways/`, in the Site group: `WaysForm.astro`, `scripts/ways.ts`, `model/ways.ts`, `PUT /_edit/api/ways`) turns it on and off and picks the first offer; turned on for a site without a map, it writes the starting map (the first seven sections), or says seven sections are needed. The dev server restarts on the change, with the new defines written into the configuration its restart reads (the integration's setup isn't run again), and the screen waits for the new server's start mark (`/_edit/__warm`'s `started`) before showing the result.
- **Not yet:** the mode page and the host's calls (`mount(root, host)`, `host.open`, storage, prefs), and the move of the structure to `structures/modes/`, are the rest of M1. The home page follows `primary` for the planet's button (first, or after Read the site); the visitor's remembered choice and other modes' buttons come with the mode host (§4.6, M5).
