# Atiya: the whole plan

Atiya is a personal portfolio site that anyone can have, on GitHub Pages, at their own address. It holds public pages, private pages that only invited readers can open, and the means to share those with an access code or a magic link. A desktop app, Atiya Studio, sets it up, edits it and publishes it. Visitors read it with **Classic**, the site's own navigation, or with a **way to explore** the site owner turns on, such as a little planet to walk around. Any way to explore that sticks to the contract can plug in, and each one opens a section the same way: a **section trigger** in its own world opens the section as an overlay. This page is the map: what the parts are, how they fit and where each one is specified.

> **TL;DR.**
> - **The site:** a portfolio on GitHub Pages, in the person's own GitHub account, free, working without any service of ours (§2.1).
> - **The content:** public pages for everyone; private pages sealed in the build and opened only by an access code or a magic link the owner shares; edited in edit mode, a local CMS (§2.2).
> - **The app:** Atiya Studio makes the site in three choices and opens edit mode; it saves to GitHub, syncs between computers and checks the site. An AI agent can do the same from the `atiya` command line (§2.3).
> - **Classic** is the default navigation: the header, the sections and their pages. It's always on and always one click away (§2.4).
> - **Ways to explore** are optional and pluggable. A navigation mode can look like anything, as long as it sticks to the contract (a manifest, a data schema, a structure schema and a conformance suite); every one has **section triggers** that open a section, and its pages, in the engine's **section overlay**. Little planet is built in for any site; **Cozy life**, the little planet with the owner's family, Chopper and his music, is his personal mode (§2.5, §2.6).
> - **Where it stands:** the site, its content, private pages and the planet are live; the app and the first parts of ways to explore are built on their branches; the mode host, the planet's split and other modes come next (§4, §5).

<figure class="slate-figure" data-diagram="atiya">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" role="img" aria-labelledby="at-plan__title at-plan__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="at-plan__title">Atiya: the whole plan</title>
<desc id="at-plan__desc">Atiya Studio, the desktop app, sets up a person's site and edits and publishes it. It saves to two repositories in the person's own GitHub account: a public one with the site's content and a private one with their private pages. GitHub Actions builds the site and GitHub Pages serves it, with private pages sealed. Visitors explore it with Classic, the default navigation that is always on, or with a way to explore that's turned on: Little planet, built in for any site; Cozy life, the owner's personal mode; or any mode that sticks to the schema. Every mode has section triggers, and each opens a section and its pages in the engine's section overlay, the same in every mode. Private pages open only for readers with an access code or a magic link.</desc>
<g id="at-plan__studio" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="at-plan__body-1" x="40" y="40" width="270" height="150" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="at-plan__body-1" data-slate-fit-padding="16">Atiya Studio</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="at-plan__body-1" data-slate-fit-padding="16">the desktop app</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="at-plan__body-1" data-slate-fit-padding="16">Set up, edit, publish</text>
<text x="60" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="at-plan__body-1" data-slate-fit-padding="16">Sync, Check my site</text>
</g>
<g id="at-plan__github" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="at-plan__body-2" x="365" y="40" width="270" height="150" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="385" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="at-plan__body-2" data-slate-fit-padding="16">Their GitHub account</text>
<text x="385" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="at-plan__body-2" data-slate-fit-padding="16">two repositories, theirs</text>
<text x="385" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="at-plan__body-2" data-slate-fit-padding="16">Public: the site's content</text>
<text x="385" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="at-plan__body-2" data-slate-fit-padding="16">Private: private pages</text>
</g>
<g id="at-plan__pages" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="at-plan__body-3" x="690" y="40" width="270" height="150" rx="18" fill="var(--color-brand-bg)" />
<text x="710" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="at-plan__body-3" data-slate-fit-padding="16">GitHub Pages</text>
<text x="710" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="at-plan__body-3" data-slate-fit-padding="16">built by Actions, free</text>
<text x="710" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="at-plan__body-3" data-slate-fit-padding="16">Public pages, open to all</text>
<text x="710" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="at-plan__body-3" data-slate-fit-padding="16">Private pages, sealed</text>
</g>
<g id="at-plan__classic" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="at-plan__body-4" x="40" y="290" width="215" height="120" rx="16" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="60" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="at-plan__body-4" data-slate-fit-padding="16">Classic</text>
<text x="60" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="at-plan__body-4" data-slate-fit-padding="16">the default, always on</text>
<text x="60" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="at-plan__body-4" data-slate-fit-padding="16">Header, sections, pages</text>
</g>
<g id="at-plan__little-planet" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="at-plan__body-5" x="275" y="290" width="215" height="120" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="295" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="at-plan__body-5" data-slate-fit-padding="16">Little planet</text>
<text x="295" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="at-plan__body-5" data-slate-fit-padding="16">built in, for any site</text>
<text x="295" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="at-plan__body-5" data-slate-fit-padding="16">Buildings are triggers</text>
</g>
<g id="at-plan__cozy-life" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="at-plan__body-6" x="510" y="290" width="215" height="120" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="530" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="at-plan__body-6" data-slate-fit-padding="16">Cozy life</text>
<text x="530" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="at-plan__body-6" data-slate-fit-padding="16">the owner's personal mode</text>
<text x="530" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="at-plan__body-6" data-slate-fit-padding="16">Little planet, his residents</text>
</g>
<g id="at-plan__any-mode" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="at-plan__body-7" x="745" y="290" width="215" height="120" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="765" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="at-plan__body-7" data-slate-fit-padding="16">Any mode</text>
<text x="765" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="at-plan__body-7" data-slate-fit-padding="16">that sticks to the schema</text>
<text x="765" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="at-plan__body-7" data-slate-fit-padding="16">Its own section triggers</text>
</g>
<g id="at-plan__overlay" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="at-plan__body-8" x="275" y="455" width="685" height="95" rx="16" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="295" y="487" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="at-plan__body-8" data-slate-fit-padding="16">The section overlay</text>
<text x="295" y="509" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="at-plan__body-8" data-slate-fit-padding="16">the engine's, the same in every mode</text>
<text x="295" y="535" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="at-plan__body-8" data-slate-fit-padding="16">A trigger opens a section and its pages; Classic is one click away</text>
</g>
<text x="318" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">saves</text>
<text x="646" y="104" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">builds</text>
<text x="300" y="228" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">visitors explore with Classic, or a way to explore that's on</text>
<text x="40" y="580" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Private pages open only for readers with an access code or a magic link.</text>
<g id="at-plan__flow-1" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M310 115 L355 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="364,115 355,120 355,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="at-plan__flow-2" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M635 115 L680 115" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="689,115 680,120 680,110" fill="var(--color-neutral-fg-2)" />
</g>
<g id="at-plan__flow-3" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M825 190 L825 240 L147 240 L147 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="147,289 152,280 142,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="at-plan__flow-4" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M382 240 L382 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="382,289 387,280 377,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="at-plan__flow-5" data-slate-svg-step="13" data-slate-svg-effect="draw">
<path d="M617 240 L617 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="617,289 622,280 612,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="at-plan__flow-6" data-slate-svg-step="14" data-slate-svg-effect="draw">
<path d="M852 240 L852 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="852,289 857,280 847,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="at-plan__flow-7" data-slate-svg-step="15" data-slate-svg-effect="draw">
<path d="M382 410 L382 445" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="382,454 387,445 377,445" fill="var(--color-neutral-fg-2)" />
</g>
<g id="at-plan__flow-8" data-slate-svg-step="16" data-slate-svg-effect="draw">
<path d="M617 410 L617 445" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="617,454 622,445 612,445" fill="var(--color-neutral-fg-2)" />
</g>
<g id="at-plan__flow-9" data-slate-svg-step="17" data-slate-svg-effect="draw">
<path d="M852 410 L852 445" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="852,454 857,445 847,445" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>The whole plan: the app saves to the person's GitHub, which builds and serves the site; visitors explore it with Classic or a way to explore, and every way to explore opens sections in the same overlay.</figcaption>
</figure>

## 1. Who it's for

| Who | Situation | What Atiya does for them |
|---|---|---|
| A newcomer (a designer, a student, a job hunter) | Needs somewhere to show their work | A professional site at their own address, set up in three choices without a terminal, live the same day ([desktop spec P1, P2](desktop/spec.md#1-the-customer-promise)) |
| The owner | Has an idea for an article | Opens the app and writes: edit mode is there in one launch ([P5](desktop/spec.md#1-the-customer-promise)) |
| A site's owner | A recruiter asks for work they can't publish | Makes the page private and shares it with just that reader, by code or link ([access spec](access/spec.md)) |
| A site's owner | Wants the site to stand out, or to stay plain | Chooses Classic alone, or turns on a way to explore, and changes it any time ([P4](desktop/spec.md#1-the-customer-promise)) |
| An AI agent, asked by a person | "Set up a portfolio site for me", "add this article" | One command with machine-readable answers; the site's repository explains itself in its `AGENTS.md` ([P6](desktop/spec.md#1-the-customer-promise)) |
| A maker | Has an idea for a new way to explore a site | Builds it alone with the mode kit and plugs it into any site ([modes §7](desktop/modes.md#7-making-a-mode-in-isolation)) |

## 2. The parts

### 2.1 The site, on GitHub Pages

- **One repository per site, in the person's own GitHub account,** holding its content, an `atiya.json` that pins the engine release it's built with, and a short workflow. GitHub Actions builds it with that engine and GitHub Pages serves it at `https://<login>.github.io/` (or a path under it). Nothing of ours is in the path: the site keeps working if the app is uninstalled ([desktop spec §6](desktop/spec.md#6-the-product-model)).
- **The engine** is the site's code: pages, layouts, the design system, edit mode and the modes, released as a versioned archive. The owner's own repository is the engine's source and his site at once.
- **Every page has one address on the site**, whatever way a visitor reaches it ([content spec](content/spec.md)).

### 2.2 Public, private and shared content

| Kind | Who can read it | How it's kept |
|---|---|---|
| **Public** | Everyone; search engines index it | `content/` in the site's repository, published as plain pages |
| **Private** | Only readers whose access covers it, after they agree to its terms | `private-pages/`, a second, private repository; built into the site sealed (AES-256-GCM) and decrypted in the reader's browser ([access spec](access/spec.md)) |
| **Shared** | The reader it was shared with | An **access code** they type on the Sign in page, or a **magic link** that opens it with nothing to type; each opens what its scope names, until its last day, and can be withdrawn ([access §8.1](access/spec.md#81-sharing-the-access-screen)) |

- **Edit mode** is a local CMS: every page, section, picture and setting is edited in the browser or the app, checked against the content contract before it's written, and published with **Save to remote** ([edit mode spec](editor/spec.md)).
- **Content is data, not code:** sections, pages, menus and media live in `content/`, shaped by the content contract, and every channel (the site, a mode) maps them through its own structure ([content model](content/model.md)).
- **Private pages start on first use:** the first time a page is made private, the app sets up the private repository and the build's read-only key by itself ([desktop spec §4.4](desktop/spec.md#44-what-setup-does)).

### 2.3 Atiya Studio, the app

- **Set up:** Make my site, Continue with GitHub (one button to sign in or sign up), Create my site; edit mode opens about half a minute later while the site goes live in the background ([desktop spec §4](desktop/spec.md#4-the-first-run-and-setup)).
- **Edit and publish:** edit mode in the app's window, on a server the app runs and supervises; Save to remote commits and pushes, and the frame says when the site is live.
- **Manage:** open the site on another computer (changes from both merge; a page changed on both asks which to keep), Check my site with a fix for each problem, private pages on first use, and the site's ways to explore.
- **For agents:** `atiya setup`, `status`, `doctor`, `sites` and `private setup`, with JSON events and exit codes ([desktop spec §5](desktop/spec.md#5-setting-up-with-an-agent)).
- **For the owner:** his checkout opens as a developer workspace, his own dev server alive as long as the app.

### 2.4 Classic, the default navigation

**Classic** is the site's own navigation: the header's menu, the home page with its list of sections, each section's list of pages in its view (a list, tiles, a bento, features), and the pages themselves. It's always on and isn't a mode: a site can have Classic alone, with no mode code or 3D assets in its build, and every way to explore leads back to it from any state ([modes §2](desktop/modes.md#2-the-site-and-turning-modes-on-and-off)).

### 2.5 Ways to explore: navigation modes

A **navigation mode** is another way into the same pages, like Steam's Big Picture beside its library: optional, turned on or off in edit mode's **Ways to explore**, at its own address (`/play/`). It can be anything, a 3D world, a map of stars, a set of rooms, as long as it sticks to the contract ([modes §5](desktop/modes.md#5-the-contract)):

| The contract holds | So that |
|---|---|
| **A manifest** (`mode.json`, validated by the mode kit's schema): who it is, its entry, its address, its slots, what it needs, its budgets | The engine can gate, load, size-check and list it without running it |
| **Mode data**, a schema the engine fills: the site's sections and their published open pages, nothing draft or private | A mode navigates; it never owns or leaks content |
| **Its structure**, in a schema of its own: each slot and the section it shows, with the mode's words for it | The site owner maps sections to the mode's places in edit mode |
| **The host's calls** (`mount(root, host)`, `host.open`, storage, prefs, announcements) | Every mode gets the same shell: the header, the way back, the gate, the fallback |
| **The conformance suite** (R1 to R12) | Keyboard and DOM routes, reduced motion, text twins, budgets, no network of its own, clean unmount, and section triggers, all checked |

**Section triggers and the section overlay.** Every slot that shows a section has a trigger in the mode's own world: the planet's buildings (walk up, see what it holds, choose Open or press E), a star in Constellation. Using one opens that section as an **overlay** over the mode: its list of pages, then any page, rendered by the site's own layouts with **Open classic page** and Close, while the mode pauses behind it. The overlay is the engine's, so a section reads the same in every mode, keeps its address, and shows its invited-readers panel when it has private pages. A keyboard list of every slot is a trigger too, so a visitor who never moves in the world reaches every section ([modes §4.4](desktop/modes.md#44-section-triggers-and-the-section-overlay)).

**Where modes come from:** built into the engine for any site, a site's own (in its repository), or, after v1, from someone else, pinned and sandboxed ([modes §8](desktop/modes.md#8-where-modes-come-from)).

### 2.6 Little planet and Cozy life

| | Little planet | Cozy life |
|---|---|---|
| What | A small planet with seven buildings round a plaza, a sky with day and night, grass and wildlife, collecting and crafting | Little planet with the owner's residents (Chopper, his family, Prabin), his music and his welcome: his personal mode |
| For | Any site (built in) | Only his site (his repository; never in an engine release) |
| Section triggers | The buildings: each shows one section | The same |
| Today | The owner's planet at `/play/` is both in one, in `src/game/` | Split out in phase M3, unchanged for his visitors ([modes §9](desktop/modes.md#9-the-planet-split-in-two)) |

## 3. A visit, end to end

1. A visitor lands on the home page. Its first button is the way in the site offers first: Classic (**Read the site**) or a mode (**Explore the planet**).
2. **In Classic,** they open a section from the menu or the home page's list, then a page.
3. **In a mode,** they move through its world and use a **section trigger** (a building's door): the section opens in the **overlay**, and from its list, a page.
4. **Back to Classic** is always one click: the header's Classic site, or the overlay's Open classic page, which goes to the same page on the site.
5. **A private page** shows its invited-readers panel: a reader with an access code signs in, one with a magic link is let straight in; both agree to its terms first.

## 4. Where it stands

| Part | State | Where |
|---|---|---|
| The site, Classic, its design system and the content platform | Live | `main` |
| Edit mode | Live (dev only, by construction) | `main` |
| Private pages, access codes, magic links, telemetry | Live | `main` |
| The contact form | Live | `main` |
| The planet (Little planet and Cozy life in one) | Live at `/play/` | `main` |
| Atiya Studio: the owner's app, setup and the CLI, the first run, just the site, the engine release, managed sites | Built (stages 1 to 4, 6 and 7) | `desktop-app` |
| Real GitHub sign-in, private pages on first use | Built (device login through the GitHub CLI: no app of ours); the live check waits on a test account and the first engine release | `desktop-app` |
| Ways to explore: the contract, mode data, V33 to V37, the planet reading mode data, turning modes on and off | Built (8.1 in part, 8.2, 8A) | `desktop-app`, `ways-to-explore` |
| Section triggers as a contract requirement (R12) | Specified; the planet's buildings already behave this way | [modes §4.4](desktop/modes.md#44-section-triggers-and-the-section-overlay) |
| The mode host, the planet's split into Little planet and Cozy life, the mode kit, Constellation | Planned (stage 8: M1 to M5) | [plan](desktop/plan.md#stage-8-navigation-modes) |
| Signing, auto-update, the installer, a study with five people | Planned; blocked on a certificate, an Apple account and participants | [plan](desktop/plan.md#stage-9-distribution-and-hand-out) |
| Modes from other people, sandboxed | After v1 (M6) | [modes §8.3](desktop/modes.md#83-from-someone-else-later) |

The [plan's status](desktop/plan.md#6-status) holds the evidence for each stage.

## 5. What comes next

1. **The mode host (M1):** the planet mounted through the contract, its page and shell generalized, the reading frame becoming the section overlay for every mode, the planet's structure moved under `content/structures/modes/`.
2. **Just the site through the contract (M2):** modes' assets emitted only when they're on.
3. **The split (M3):** `src/game/` becomes Little planet, with extension points; Cozy life is built on it with the owner's residents and music.
4. **The mode kit (M4):** types, schemas, the harness on starter content, the conformance suite R1 to R12 (section triggers included), a template.
5. **Constellation and Ways to explore in full (M5):** a second, light mode that proves the contract isn't planet-shaped; slots and settings edited from each mode's schema.
6. **Distribution (stage 9):** a signed installer that updates itself, a security and accessibility review, and five people who don't write code each reaching a live site.
7. **One engine, two builds (stage 10, decided 14 October 2026):** the owner's site stays on the source, with its tight feedback loop, and is never moved. Both builds run one script and read the site's settings from its content, and a check, on every push, builds his site both from the source and from that commit's engine pack and finds them the same; a second site of his, made with the app, takes each release first (desktop spec §6.4, O15).

Open decisions are kept with the specs: the app's in [desktop §14](desktop/spec.md#14-decisions) (the licence, the GitHub App, the agreement's words) and the modes' in [modes §12](desktop/modes.md#12-open-decisions).

## 6. Where each part is specified

| Part | Spec |
|---|---|
| The site's goals, audiences and navigation | [Seed spec](seed-spec.md), [information architecture](ia-navigation/README.md) |
| How the site looks | [Site design system](site-ui/design-system.md) |
| Content, sections and media | [Content platform](content/spec.md), [sections](sections/spec.md), [media](content/media.md) |
| Edit mode | [Edit mode spec](editor/spec.md) |
| Private pages and sharing | [Protected content](access/spec.md) |
| The app | [Desktop app spec](desktop/spec.md) and its [plan](desktop/plan.md) |
| Ways to explore | [Navigation modes](desktop/modes.md) |
| The planet | [Planet spec](poc-3d-navigation/spec.md), [reading on the planet](sections/spec.md#6-reading-on-the-planet-u13u15) |
| Engineering | [Engineering overview](engineering/overview.md) |
