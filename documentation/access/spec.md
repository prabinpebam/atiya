# Protected content: locked sections, private pages and telemetry

How the site shows some pages only to the people you choose, though it's a static site on GitHub Pages with its code in a public repository. It also covers how each recipient's access is recorded and how visits are measured, all on free tiers. The phases, tests and Definition of Done are in the [plan](plan.md).

> **TL;DR.**
> - **Two new kinds of page.**
>   - **Locked sections:** their title is in the navigation, but their pages, titles included, show only after a visitor types an access code.
>   - **Private pages:** not listed anywhere; they open only from a magic link (§2).
> - **One credential per recipient.** Every recruiter or hiring manager gets their own grant: an access code or a magic link. Each records who it's for, why, when it was made, what it opens and when it expires, and can be withdrawn on its own (§4).
> - **Plaintext never goes public.**
>   - Locked and private content lives in a second, private repository.
>   - GitHub Actions builds it with the site, encrypts it, checks that nothing readable is left, and only then uploads to Pages.
>   - The public repository, its history, the build log and the Pages artifact never hold it (§3, §6).
> - **The browser decrypts.**
>   - A grant opens a keyring holding the keys to the pages it covers.
>   - The pages and their pictures and videos are decrypted in the browser with WebCrypto (AES-256-GCM).
>   - There's no server and no library to load (§5).
> - **Expiry and withdrawal work by redeploying.** Every deploy uses fresh keys and leaves out expired or withdrawn grants, and a nightly deploy enforces expiry dates within about a day. Anything a recipient saved while their access worked stays readable to them (§4.5).
> - **Telemetry is PostHog's free tier.** It records page views, clicks, outbound links, IP addresses and their location, and which grant unlocked what, so you can see "the Contoso recruiter opened Case study X twice". It never sends a code, a link's secret or protected text (§9).
> - **No new hosting cost.** GitHub Pages, Actions on a public repository, a private repository and PostHog's free tier are all free.

<figure class="slate-figure" data-diagram="access">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 580" role="img" aria-labelledby="ac-arch__title ac-arch__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ac-arch__title">Protected content: from two repositories to a sealed site</title>
<desc id="ac-arch__desc">On the owner's machine, edit mode writes open content to content/, in the public repository, and locked and private content, with the access grants, to content-private/, in a private repository. GitHub Actions checks out both, builds every page, seals the locked and private ones, checks that no plaintext is left, and uploads the sealed site to GitHub Pages. A visitor's browser fetches the sealed pages and the keyring their access code or magic link opens, and decrypts them in the page. Visits, clicks and unlocks go to PostHog, keyed by the grant, never with the code or the content.</desc>
<g id="ac-arch__edit" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ac-arch__body-1" x="40" y="40" width="220" height="120" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ac-arch__body-1" data-slate-fit-padding="16">Edit mode</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ac-arch__body-1" data-slate-fit-padding="16">localhost, dev only</text>
<text x="60" y="126" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-1" data-slate-fit-padding="16">Pages and media</text>
<text x="60" y="148" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-1" data-slate-fit-padding="16">Codes and links</text>
</g>
<g id="ac-arch__public" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ac-arch__body-2" x="330" y="40" width="260" height="120" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="350" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ac-arch__body-2" data-slate-fit-padding="16">content/</text>
<text x="350" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ac-arch__body-2" data-slate-fit-padding="16">the public repository</text>
<text x="350" y="126" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-2" data-slate-fit-padding="16">Open pages and sections</text>
<text x="350" y="148" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-2" data-slate-fit-padding="16">Locked sections' titles</text>
</g>
<g id="ac-arch__private" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ac-arch__body-3" x="330" y="200" width="260" height="120" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="350" y="232" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ac-arch__body-3" data-slate-fit-padding="16">content-private/</text>
<text x="350" y="254" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ac-arch__body-3" data-slate-fit-padding="16">a private repository</text>
<text x="350" y="286" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-3" data-slate-fit-padding="16">Locked and private pages</text>
<text x="350" y="308" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-3" data-slate-fit-padding="16">Grants: who, when, until</text>
</g>
<g id="ac-arch__build" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ac-arch__body-4" x="660" y="40" width="300" height="280" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ac-arch__body-4" data-slate-fit-padding="16">GitHub Actions</text>
<text x="680" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ac-arch__body-4" data-slate-fit-padding="16">on a push, Deploy now, and nightly</text>
<text x="680" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-4" data-slate-fit-padding="16">1. Check out both repositories</text>
<text x="680" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-4" data-slate-fit-padding="16">2. Build every page, quietly</text>
<text x="680" y="192" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-4" data-slate-fit-padding="16">3. Seal locked and private pages</text>
<text x="680" y="222" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-4" data-slate-fit-padding="16">4. Fresh keys, valid grants only</text>
<text x="680" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-4" data-slate-fit-padding="16">5. Fail on any plaintext left</text>
<text x="680" y="282" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-4" data-slate-fit-padding="16">6. Upload the sealed site</text>
</g>
<g id="ac-arch__pages" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ac-arch__body-5" x="660" y="400" width="300" height="100" rx="16" fill="var(--color-brand-bg)" />
<text x="680" y="432" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ac-arch__body-5" data-slate-fit-padding="16">GitHub Pages</text>
<text x="680" y="454" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ac-arch__body-5" data-slate-fit-padding="16">open pages, sealed pages and media,</text>
<text x="680" y="476" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ac-arch__body-5" data-slate-fit-padding="16">one keyring per grant</text>
</g>
<g id="ac-arch__browser" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="ac-arch__body-6" x="330" y="400" width="260" height="100" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="350" y="432" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ac-arch__body-6" data-slate-fit-padding="16">The visitor's browser</text>
<text x="350" y="454" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ac-arch__body-6" data-slate-fit-padding="16">a code or a magic link opens</text>
<text x="350" y="476" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ac-arch__body-6" data-slate-fit-padding="16">its keyring, then decrypts</text>
</g>
<g id="ac-arch__telemetry" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="ac-arch__body-7" x="40" y="400" width="220" height="100" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="432" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ac-arch__body-7" data-slate-fit-padding="16">PostHog</text>
<text x="60" y="454" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ac-arch__body-7" data-slate-fit-padding="16">visits, clicks, and</text>
<text x="60" y="476" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ac-arch__body-7" data-slate-fit-padding="16">unlocks by grant</text>
</g>
<text x="266" y="92" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">writes</text>
<text x="160" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">writes</text>
<text x="600" y="92" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">read</text>
<text x="596" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">deploy key</text>
<text x="820" y="366" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">deploy</text>
<text x="600" y="442" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">fetch</text>
<text x="266" y="442" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">events</text>
<text x="40" y="550" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Plaintext never reaches the public repository, the build log or the Pages artifact. Keys are only ever used in the browser.</text>
<g id="ac-arch__flow-1" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M260 100 L320 100" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="329,100 320,105 320,95" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ac-arch__flow-2" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M150 160 L150 260 L320 260" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="329,260 320,265 320,255" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ac-arch__flow-3" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M590 100 L650 100" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,100 650,105 650,95" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ac-arch__flow-4" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M590 260 L650 260" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,260 650,265 650,255" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ac-arch__flow-5" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M810 320 L810 390" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="810,399 815,390 805,390" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ac-arch__flow-6" data-slate-svg-step="13" data-slate-svg-effect="draw">
<path d="M660 450 L600 450" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="591,450 600,455 600,445" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ac-arch__flow-7" data-slate-svg-step="14" data-slate-svg-effect="draw">
<path d="M330 450 L270 450" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="261,450 270,455 270,445" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Open content stays in the public repository and locked and private content in a private one. Actions builds both, seals the protected pages and checks for leaks before anything is uploaded. A grant opens only its own keyring, in the visitor's browser.</figcaption>
</figure>

<details>
<summary>What was asked, and where it's answered</summary>

| # | The owner's request | Where |
|---|---|---|
| A1 | A category of password-protected articles, pages and content, on GitHub Pages | §2, §3 |
| A2 | The protected content is encrypted, kept in GitHub and served by Pages | §3, §5, §6 |
| A3 | Images and videos are encrypted too; videos are small | §5.5 |
| A4 | No additional hosting cost or complexity | §1, §12 |
| A5 | A unique password for each target audience: a specific password for a specific recruiter or hiring manager | §4.2 |
| A6 | A password can expire | §4.5 |
| A7 | Basic telemetry on a free tier: visits, clicks on links, IP addresses | §9 |
| A8 | Magic links to private articles, which aren't publicly visible and open only from the link | §2.2, §4.3 |
| A9 | A magic link is traceable: when it was made and who it was meant for | §4.4, §9.3 |
| A10 | Some articles are in a password-protected section: no titles and no content until the right password | §2.1, §5.4 |
| A11 | Capture all of it in a detailed spec and an implementation plan | This page, the [plan](plan.md) |

</details>

## 1. Goals and boundaries

**Goals.**
- **Share selected work only with chosen people**, each with their own credential, without a server, a paid host or a second site.
- **Keep the site one site.** Locked and private pages use the same layouts, components and edit mode as every other page.
- **Know who looked.** Every credential says who it's for, and telemetry ties each unlock to its credential.
- **Fail closed.** If anything in the pipeline can't prove the content is sealed, nothing is deployed.

**What it protects against:**
- **The public:** search engines, crawlers, scrapers and anyone browsing the site or the repository;
- **people with the wrong credential**, or one that has expired or been withdrawn, for anything published after that;
- **a reader of one grant** seeing pages outside its scope.

**What it doesn't protect against (by design):**
- **A recipient who shares their credential or saves what they saw.** No system can take back what someone has read; withdrawing a grant protects only what's published after it.
- **Unlimited offline guessing.** Anyone can download a sealed file and try codes forever, with no rate limit. The defence is the code's strength and a slow key derivation (§5.2). Magic links carry a 256-bit random secret and can't be guessed.
- **Metadata:** that a locked section exists, its title and summary (you choose them), roughly how many pages it holds, the sizes of the sealed files and when they change are all visible.
- **Material that must not leave Microsoft or a client.** Encryption on a public host is "not public", not "confidential". Confidential or NDA work needs its owner's approval before it goes here, encrypted or not.

## 2. Two kinds of protected page

| | Open | Locked section | Private page |
|---|---|---|---|
| Listed in navigation and sections | Yes | The section is; its pages show only after unlocking | Never |
| Its title is public | Yes | The section's title and summary only | No |
| Address | `/<section>/<slug>/` | `/<section>/<token>/` (opaque) | `/p/<token>/` (opaque) |
| Opened with | Nothing | An access code or a magic link | A magic link only |
| Search engines | Indexed | `noindex` | `noindex` |
| On the planet | If placed | Never (v1) | Never |
| Its source lives in | `content/` (public) | Its section in `content/`, its pages in `content-private/` | `content-private/` |

### 2.1 Locked sections (A10)

- **A section is open or locked** (`access: 'locked'` on its hub). A locked section's title, menu label, summary and view are public, set in `content/structures/site.json` like any section, so the header and the home page can list it.
- **Its pages live in the private repository** (§3), placed in the section by the private overlay structure. Their slugs are replaced by opaque tokens, so an address never hints at a title.
- **Before unlocking**, the section page shows its title, its summary and the unlock panel (§7.1). The list of pages is sealed, card by card (§5.4): no titles, summaries or thumbnails.
- **After unlocking**, the cards the grant covers appear in the section's view; cards outside its scope are never decrypted and stay hidden. If the grant opens nothing here, the panel says so.
- **Moving between its pages** needs no new code: the key is remembered for the session (§7.3).

### 2.2 Private pages (A8)

- **A private page is in no section and on no list.** It exists only in the private repository, at `/p/<token>/`, and opens only from a magic link that covers it.
- **Its token is stable**, so a link keeps working across deploys. **Change address** (edit mode) gives the page a new token, which breaks every link to it at once: a kill switch for that page.
- **Without a valid link**, the shell says only that the page is private and how to ask for access. It has no title, no description and no hint of its subject.
- **Links between protected pages are sealed too.** A link to a page the reader's grant doesn't cover opens that page's own "Your link doesn't open this page" note.

## 3. Where the content lives

**The problem.** The repository is public, and edit mode publishes by committing `content/`. A protected page committed in plaintext even once would be readable in the git history forever, whatever the site then serves.

**The design.**
- **`content-private/`** is a second content folder, a clone of a private GitHub repository (`atiya-private`, free), next to `content/` and listed in the public repository's `.gitignore`. It has the same layout as `content/`: `articles/`, `media/<owner>/<id>/`, and `structures/`.
- **What it holds:**
  - the locked sections' pages, and the private pages (articles, the same contract as every page);
  - their media masters and sidecars;
  - `structures/overlay.json`: which locked section holds which page, in what order, and each protected page's token;
  - `access.json`: the grants (§4), with their secrets;
  - `access-message.json`: the words of the message edit mode offers to copy (§8.1).
- **What stays public:** a locked section's own node (title, label, summary, view, `access: 'locked'`) and its entry in the navigation. Nothing else about it.
- **Loading.** The loader reads both folders into one content snapshot. The overlay's nodes join their sections in the route table, and private pages get `/p/<token>/` routes outside the three levels (like `/play/`). Every ID, media ID and route is unique across both folders.
- **A public-only build.** Without `content-private/` (a fork, a fresh clone, a local build without access), the site builds as before: locked sections show their unlock panel with nothing to unlock, and there are no private pages. The deploy workflow refuses to run without it (§6.1).
- **Tests never read the real private content.** Unit and E2E tests use a fixture private folder (`tests/fixtures/content-private/`) with made-up pages and grants.

## 4. Grants: access codes and magic links

A **grant** is one credential for one recipient. It is how you share, track, expire and withdraw access.

### 4.1 The record

Every grant is a record in `content-private/access.json`:

| Field | What it holds |
|---|---|
| `id` | Random, opaque and stable (`g` and 8 base32 characters). It's the grant's identity in telemetry, never a name |
| `kind` | `code` (typed) or `link` (a magic link) |
| `recipient` | Who it's for: `name`, `organisation`, `role`, optional `email`. Never shown to anyone else |
| `purpose` | Why it was shared, in your words ("Senior design manager role, first screen") |
| `scope` | What it opens: whole locked sections, and/or single pages (a locked section's or a private one's). A code's scope is locked sections and their pages only (V26) |
| `createdAt` | When it was made, with its time zone |
| `expiresAt` | When it stops working (optional; edit mode suggests 30 days) |
| `revokedAt` | When you withdrew it, if you did |
| `secret` | A code's words and salt, or a link's key and salt (§5.2). Kept so you can copy the message again |
| `notes` | Anything else you want to remember. Never published, never sent to telemetry |

**Grants are never deleted**, only expired or withdrawn, so the record stays complete. The private repository's git history is the audit trail: every grant's creation, extension and withdrawal is a commit with its date.

### 4.2 Access codes (A5)

- **One code per audience:** a recruiter, a hiring manager, a panel. Two people never share a code unless you mean them to.
- **The form:** five words joined by hyphens, like `harbor-maple-river-cloud-seven`.
  - **The first word is the code's name:** unique among codes that still work, not secret. It tells the page which keyring to try, so unlocking runs one key derivation, not one per grant.
  - **The other four are the secret**, drawn at random from the EFF large wordlist (7,776 words, CC BY 3.0 US, credited in `assets-src/CREDITS.md`). That's about 51.7 bits, behind PBKDF2 at 600,000 iterations (§5.2). Edit mode can make a longer code for a grant you want stronger.
- **Typed in the unlock panel** (§7.1), or opened from a link that carries it (§4.3): a code grant can also be sent as a link to save the typing.
- **Edit mode generates the code**, never you, so codes aren't reused or guessable from each other.

### 4.3 Magic links (A8)

- **The form:** the page's address and a fragment: `https://prabinpebam.github.io/atiya/p/k3v9q2m7xw/#a=g7k2m9qd4.<secret>`.
  - The fragment (after `#`) is **never sent to any server**, GitHub's included, and never logged by it.
  - The secret is 32 random bytes (base64url), so a link can't be guessed.
  - A link can point at a private page or at a locked section (instead of a code).
- **On opening**, the page reads the fragment, removes it from the address bar at once (`history.replaceState`), so it isn't left in a screenshot, a bookmark or a copied address. It then unlocks and keeps the key for the session (§7.3).
- **A link is a bearer credential:** whoever has it can open it. Telemetry shows if it's opened from more than one device or place (§9.3), which is how a forwarded link shows up.

### 4.4 Traceability (A9)

For every grant you can see:
- **who it was for and why:** `recipient` and `purpose`;
- **when it was made, changed, extended or withdrawn:** its record, and the private repository's history;
- **when it was opened, from where and what was read:** its telemetry, keyed by the grant's `id` (§9.3): every unlock, every page viewed, the device, the IP address and its location;
- **its state:** active, expires soon (within 3 days), expired, withdrawn, or waiting for a deploy (§8).

Edit mode's Access screen shows all of these together (§8.1).

### 4.5 Expiry and withdrawal (A6)

- **Fresh keys every deploy.** Each build makes new random keys for every sealed page, and a keyring only for each grant that is still valid (not expired and not withdrawn). An expired or withdrawn grant simply has no keyring, so it opens nothing on the live site, including pages published later.
- **A nightly deploy** (a scheduled GitHub Action, shortly after midnight India time) applies expiry dates, so a grant stops working within about a day of its date. GitHub runs scheduled workflows late at busy times, sometimes by an hour or more.
- **Withdraw now:** edit mode sets `revokedAt`, publishes the private repository and starts a deploy (§8.3). It takes effect in a few minutes.
- **The page checks too:** a keyring carries its grant's expiry, and the page refuses an expired one with its own message (§7.2), even in the hours before the nightly deploy runs. That check runs in the visitor's browser, so a determined reader could skip it; the deploy is the real enforcement.
- **What it can't do:** take back what was read or saved while the grant worked (§1).
- **A GitHub rule to know:** GitHub turns off scheduled workflows in a public repository after 60 days without activity. The nightly workflow warns (an issue on the repository) when the last commit is 50 days old, and any commit resets the clock.

## 5. Cryptography

Everything uses the Web Crypto API, built into every current browser and into Node 24 (the build's runtime), so the same module runs in both. There's no crypto library to load.

### 5.1 Keys

| Key | Made | Lives | Protects |
|---|---|---|---|
| **Grant key (KEK)** | Derived from the code or the link's secret (§5.2) | Never in the site; in the visitor's browser after unlocking (§7.3) | The grant's keyring |
| **Page key (CK)** | Random, 256 bits, fresh every build | Inside keyrings | One sealed page: its regions and its card |
| **Media key (MK)** | Random, 256 bits, fresh every build | Inside the sealed page that shows the file | One sealed media file |

### 5.2 Deriving the grant key

- **A code:** PBKDF2-HMAC-SHA256 over the four secret words, with the grant's own 16-byte salt and 600,000 iterations (OWASP's current recommendation for PBKDF2-SHA256). That takes about half a second on a phone, once per session. Every guess costs an attacker the same 600,000 hashes.
- **A link:** HKDF-SHA256 over its 32 random bytes, with the grant's salt. No slow derivation is needed, since the input is already random.
- **The salt is stable** (stored with the grant), so a remembered grant key keeps working across deploys while the keyring it opens changes.

### 5.3 Sealed files

Every sealed file is `ATS1` (4 bytes, the format and version), a 12-byte random IV, then the AES-256-GCM ciphertext and its 16-byte tag. The additional authenticated data binds each file to its purpose and name, so one sealed file can't be swapped for another:
- **keyring:** `atiya/keyring/v1|<lookup>`, encrypted with the grant key;
- **page regions:** `atiya/page/v1|<kid>`, encrypted with the page key;
- **card:** `atiya/card/v1|<kid>`, encrypted with the page key;
- **media:** `atiya/media/v1|<file name>`, encrypted with the media key.

A wrong key, a changed byte or a swapped file all fail the GCM tag check, and the page reports it as a code that doesn't work, never as a crash.

**A keyring** (decrypted) holds:
- the format version and the build's time;
- the grant's `id` and its `expiresAt`;
- the page keys it covers, by the page's per-build key ID (`kid`, random, never the page's ID).

It holds no recipient name and no notes.

**Where sealed files live** in the build:
- `<base>/_access/c/<name>.bin` for codes and `<base>/_access/l/<grant id>.bin` for links;
- `<base>/_sealed/<random>.bin` for media, with names that change every build;
- page regions and cards inline in their page's HTML, as base64 in `<template data-sealed>` elements, so a page needs no extra request.

### 5.4 Sealing a page

The build renders a protected page with the same layouts and components as any other. Its layout marks every part that would say what the page is about as a **sealed region**:
- `<main>`: the page itself;
- the breadcrumbs' last crumb;
- the article minimap (its landmarks are the page's headings);
- related stories, next and previous;
- the `<title>`, the description and every social meta tag;
- any structured data.

**After the build**, the sealer replaces the regions:
- **the regions themselves** are encrypted with the page key into one payload, and swapped for neutral placeholders. The `<title>` becomes "Locked page" or "Private page", there's no description, `<meta name="robots" content="noindex, nofollow">` and `<meta name="referrer" content="same-origin">` are added;
- **a locked section's list:** each card is sealed on its own with its page's key, so a grant decrypts only the cards in its scope (§2.1);
- **the page's scripts and styles stay** in the shell. They show which components exist on the site, not what the page says.

### 5.5 Pictures and videos (A3)

- **Every file a sealed region refers to is sealed**:
  - every size of a picture, its full size for the lightbox and its thumbnail;
  - its dark mode version;
  - a video's file and its poster frame.

  Each file gets its own media key, and the readable file is deleted from the build.
- **A file used by both an open page and a sealed one** is allowed only if its master is in `content/`, so it's public anyway (V25).
- **Decrypting is lazy:**
  - **Pictures** decrypt when they come near the viewport, at the one width the layout and the screen's pixel density need, and become `blob:` URLs. The lightbox asks for the full size when it opens.
  - **Videos** decrypt whole when they come near the viewport and play from a `blob:` URL, which seeks normally. That's why a sealed video is capped at **25 MB** (V27): it's held in memory, on phones too.
- **Memory:** a page's `blob:` URLs are revoked when the page is left.

## 6. Building and deploying

### 6.1 The deploy workflow

`.github/workflows/deploy.yml` changes as follows:

1. **Triggers:** a push to `main` (as today), Deploy now (`workflow_dispatch`, which edit mode starts, §8.3), and a nightly schedule (§4.5).
2. **It checks out `content-private/`** from the private repository with a **read-only deploy key**: an SSH key added to the private repository with read access only, its private half stored as the public repository's Actions secret `PRIVATE_CONTENT_KEY`. A deploy key works on one repository only and doesn't expire with a personal token. If the secret or the checkout fails, the deploy stops.
3. **The build runs quietly.** Astro's log names routes and image files, and a content error names IDs and fields. The build's output goes to a file the workflow never prints or uploads. On a failure the step prints only that it failed and that you should run the build locally. Workflow logs on a public repository are public.
4. **The sealer runs inside the build** (`astro:build:done`, §6.2), so `dist/` is never complete and unsealed.
5. **The leak check** (`npm run verify:sealed`, §6.3) runs before the upload, and fails the deploy on any finding.
6. **The upload** keeps the artifact for one day (`retention-days: 1`). On a public repository, any signed-in GitHub user can download a workflow's artifacts; the artifact is sealed anyway, and a short life keeps old copies from piling up.
7. **The bundle budgets** and the rest of today's steps are unchanged.

Every step stays on Actions' free minutes for public repositories.

### 6.2 The sealer

- **Where it lives:** an Astro integration, `integrations/seal.mjs`, running last in `astro:build:done`. It uses the same crypto module as the browser (`src/site/access/crypto.ts`).
- **What it does:**
  1. reads the grants and the overlay from `content-private/`;
  2. makes the page and media keys;
  3. seals each protected page's regions and cards, and each file those regions refer to (rewriting their addresses inside the sealed HTML);
  4. writes a keyring for each valid grant.
- **What it never does:** run in dev or in the editor, or print a title, a slug or an ID. Its log says only how many pages, files and keyrings it sealed.
- **Test builds** (`--mode test`) seal the fixture private content with its fixture grants, whose codes the E2E tests know. Production never contains a fixture.

### 6.3 The leak check

`scripts/verify-sealed.mjs` scans every file in `dist/` after sealing. It fails if any of these is found:
- **any protected text:** every protected page's title, summary, headings, its paragraphs longer than 40 characters, picture alt texts and captions, its ID and slug, and every grant's name, recipient and purpose;
- **any protected file's bytes:** a SHA-256 match with any private master, or with any file the sealer was meant to remove;
- **any readable file** a sealed region referred to;
- **any open page** that links to a protected page's token;
- **a sealed shell without** `noindex` and its neutral title.

It runs in the deploy, in `npm run verify:prod`, and in the E2E build. It's the gate that makes the pipeline fail closed.

## 7. What a visitor sees

### 7.1 The unlock panel

On a locked section (and a locked page opened directly), a compound, `UnlockPanel`, holds:
- a line saying the section is shared with invited readers;
- the **Access code** field (a password field with Show, so a password manager can keep it);
- **Unlock** (the primary button);
- **Remember on this device** (a checkbox, off by default);
- a line on how to ask for access, linking to the contact page.

While a remembered key is tried, the panel is replaced by a short "Unlocking…" status, so there's no flash of the form.

On a private page, the shell shows a short note instead: the page is private, open it with the link you were sent, or get in touch.

### 7.2 Messages

Every message follows the site's copy rules: sentence case, says what happened and what to do. "Get in touch" links to the contact page.

| Case | Message |
|---|---|
| Wrong code, or a damaged file | "That access code doesn't work. Check it and try again, or get in touch for a new one." |
| Expired | "This access expired on 5 November 2026. Get in touch for a new one." |
| Withdrawn or no longer valid (no keyring) | "This access code no longer works. Get in touch for a new one." (a withdrawal isn't disclosed as such) |
| Link without access to this page | "Your link doesn't open this page." |
| The grant opens nothing in this section | "Your access code doesn't open anything in this section." |
| No JavaScript | "This page is shared with invited readers and needs JavaScript to open." (in `<noscript>`) |
| A browser without Web Crypto (very old ones) | "This browser can't open shared pages. Try a current version of Edge, Chrome, Firefox or Safari." |

Each message goes into the page's live region as well as on the screen.

### 7.3 Staying unlocked

- **By default, for the session:** the grant key is kept in `sessionStorage`, so moving between pages, or coming back in the same tab, needs no code.
- **Remember on this device** keeps it in `localStorage` until it expires.
- **Lock again**, in a small `AccessBar` under the header on every unlocked page, forgets the key on this device.
- **What's stored:** the grant key and the grant's `id`, `expiresAt` and lookup, never the code or the link's secret. After a deploy the same key opens the new keyring, until the grant expires or is withdrawn.
- **Unlocking is per browser.** Nothing is sent anywhere to check it; telemetry only records that it happened (§9).

### 7.4 After unlocking

- The sealed regions are decrypted and swapped in. The page sets its real `<title>`, then fires `astro:page-load`, so every component's script sets up the new elements through `each()` exactly as on an open page (the lightbox, the minimap, the gallery, videos).
- The page's own media resolver (§5.5) watches sealed pictures and videos and fills them in as they come into view.
- Focus moves to the page's heading, and the live region says the page is open.

### 7.5 Accessibility

- The panel is a labelled form, its errors tied to the field (`aria-describedby`), with 44 px targets, working at 320 px wide and in both themes.
- The decrypted page is the same markup an open page has, so it meets the same checks (axe in both modes).
- Unlocking doesn't depend on a pointer, a time limit or a CAPTCHA.

## 8. Edit mode

Everything here is dev-only, like the rest of edit mode ([editor spec](../editor/spec.md)), and reads and writes through the store.

### 8.1 The Access screen

- **The list:** every grant, with its recipient, kind, scope, when it was made, when it expires and its state (active, expires soon, expired, withdrawn, waiting for a deploy). Filters: state, kind, section.
- **New access code** and **New magic link:**
  - who it's for, why, and what it opens (locked sections and pages, or private pages for a link);
  - an expiry date (30 days suggested; none allowed).

  Edit mode generates the code or link and shows a ready message to copy ("Hi Jane, here's access to my selected work…") with the code or link and its expiry. The words of that message are content (`content-private/access-message.json`), so you can change them.
- **A grant's page:**
  - its record and its history (from the private repository's log);
  - Copy message again;
  - Extend;
  - Change scope;
  - Withdraw now (§4.5);
  - Open as this grant (a dev preview).
- **Who looked** (phase A6 in the plan): the grant's recent activity from PostHog (§9.3), read with a personal PostHog API key kept in Windows Credential Manager, never in a file.

### 8.2 Sections and pages

- **A section's Settings** get **Access:** Open or Locked. Locking a section moves its pages and their media into `content-private/` in one transaction. If any of them was ever published openly, edit mode warns first that their earlier text stays readable in the public repository's history, which locking can't undo.
- **The articles list** marks locked and private pages and filters by them. **New private page** creates a page in `content-private/` with its token.
- **A private page's Settings:** its address (token), **Change address** (breaks every link to it, with a confirmation) and **Share**, which opens New magic link for that page.
- **Uploads** for a locked or private page go into `content-private/media/`.
- **Locked and private pages can't be put on the planet** (V28); the Planet screen doesn't offer them.
- **The editor shows protected pages open**, with a ribbon saying who can see them. **Preview as a visitor** shows the sealed shell and unlock panel as a visitor would, sealed on the fly with a dev-only grant.

### 8.3 Publishing to two repositories

- **The Publish screen** lists the changes in both folders, grouped as "On the site" (`content/`) and "Private" (`content-private/`), each with its own commit message.
- **Publish:**
  1. commits and pushes `content-private/` first;
  2. then commits and pushes `content/`, which starts the deploy.

  If only private files changed, it starts the deploy itself with **Deploy now** (`gh workflow run deploy.yml`, using your own `gh` sign-in, so no token is stored). If `gh` isn't installed or signed in, it says so and how to fix it.
- **A failed push** in either repository is kept and offered again on its own, as today.
- **Discard and the content check** cover both folders, and the check runs on the merged content.

## 9. Telemetry

### 9.1 The service

**PostHog Cloud, free tier:** 1 million events a month, no card needed, and it stops recording at the cap rather than billing. It records page views, clicks and outbound links by itself, stores the IP address (`$ip`) and the location it implies, and supports custom events and a timeline per identified person.

Alternatives considered:
- **Umami Cloud's free tier:** 100,000 events a month, simpler, but no IP addresses and no per-person timelines.
- **Microsoft Clarity:** heatmaps and replays, but no IPs and weak custom events.
- **Cloudflare Web Analytics:** no custom events.
- **Your own Cloudflare Worker with D1:** raw logs you own, but code to maintain.

### 9.2 What's recorded

| Event | When | Properties |
|---|---|---|
| `$pageview`, `$pageleave` | Every page (PostHog's own) | The address without its fragment; the referrer; the device; the IP and its location |
| `$autocapture` | Clicks on links and buttons, outbound links, the résumé download | The element's role and its link; on sealed pages, no text (§9.4) |
| `access_unlocked` | A grant opens a page | `grant` (its `id`), `via` (code or link), `place` (section or private page, by its opaque token) |
| `access_failed` | A code or link doesn't work | `reason`: wrong, expired, no keyring. Never the code |
| `access_locked` | Lock again | `grant` |
| `video_played` | A video starts | Its media ID (a token on sealed pages) |
| `planet_opened` | The planet goes live | None (the game's own events come later) |

### 9.3 Who looked (A9)

- **Identity is the grant.** When a grant unlocks a page, the page calls `identify(<grant id>)`. Everything that visitor does in that session is on the grant's timeline: the pages, the clicks, the device, the IP and the city.
- **Names stay out of the browser.** When edit mode creates or changes a grant, it sends PostHog the grant's person properties (the recipient's name, organisation, role and purpose; never the email or notes) through PostHog's capture API with the public project key. So PostHog shows "Jane Doe, Contoso, recruiter", while the page itself only ever knows the opaque `id`.
- **Anonymous visitors** have no profile (`person_profiles: 'identified_only'`). Their events are counted, but no profile is built.
- **A forwarded link** shows up as one grant opened from several devices, places or IPs.

### 9.4 Never sent

- **No code, no link secret:** URLs are sent without their fragment (`before_send` strips it from every address property), and the fragment is gone from the address bar anyway (§4.3).
- **No protected text:** session replay is off. Autocapture keeps no element text or attributes inside sealed regions (`before_send` drops them, and sealed regions carry `ph-no-capture`).
- **No editor or dev traffic:** telemetry loads only in production builds, never in dev, edit mode or test builds.

### 9.5 How it's loaded

- `posthog-js`, pinned, in its build that loads no other script (`posthog-js/dist/module.no-external`). Nothing comes from a CDN.
- A tier-0 site script (`src/site/scripts/telemetry.ts`) imports it on idle after the page loads, so it never delays the first paint or the planet's loading budgets. It's set up without cookies (`persistence: 'sessionStorage'`).
- Its project key and host come from Actions variables (`PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST`). A build without them, a fork for example, has no telemetry. The key is meant to be public.
- **The planet** (`/play/`) loads the same script from its page, never from the game, which keeps "the game and the site never import each other".

### 9.6 Opting out, and the privacy notice

- **Respected signals:** a browser that sends Global Privacy Control or Do Not Track sends nothing.
- **Your own visits:** opening any page with `?telemetry=off` stops telemetry on that device until `?telemetry=on`. Use it on your own devices.
- **A Privacy page** (content, in the Contact section, linked from the footer) says what's collected (the events, IP addresses and their location), why, who processes it (PostHog), how long it's kept, how to opt out and how to ask for deletion.
- **The law:** an IP address is personal data under the GDPR and India's DPDP Act. A clear notice, no cookies and respected opt-outs are the plan; whether you also need a consent prompt depends on where your visitors are, and that's your call (O4).

## 10. Content rules

New checks, in the loader (`tests/unit/content.test.ts`) and edit mode's check, numbered after the [sections spec's](../sections/spec.md#9-decisions):

| # | Rule |
|---|---|
| V23 | A locked section's pages and a private page live only in `content-private/`; a locked section in `content/` holds no pages of its own |
| V24 | IDs, media IDs, node IDs, tokens and routes are unique across both folders; tokens are 10 base32 characters |
| V25 | An open page never refers to a protected page, or to a master in `content-private/` (blocks, related, thumbnails, the navigation, the home page, redirects). A locked section itself may be in the navigation |
| V26 | A grant's scope names only locked sections, their pages and private pages that exist; a code's scope holds no private page |
| V27 | A sealed video is at most 25 MB; a sealed picture's master follows the media budgets |
| V28 | A locked or private page isn't on the planet |
| V29 | Code names are unique among codes that still work; grant IDs are unique and never reused |
| V30 | A grant expires after it's created, and a withdrawn grant isn't changed again (except its notes) |

V8 ("only published statuses and public visibilities are built") still holds: a locked or private page is built, and sealed, only when it's published, and `visibility` keeps its editorial meaning.

## 11. The design system

These follow the [site design system](../site-ui/design-system.md): tokens only, sealed fundamentals, a doc comment and a story for every component.

- **`UnlockPanel`** (compound): `TextField`, `Button`, `Checkbox` and `Text`, with its states (ready, unlocking, wrong, expired, none here).
- **`AccessBar`** (compound): the unlocked state and Lock again, under the header.
- **`SealedRegion`** (compound): the `<template data-sealed>` wrapper and its placeholder (a `Skeleton`), used by the layouts.
- **The layouts** (`ArticleLayout`, `IndexLayout`) take a `sealed` prop that wraps their regions (§5.4) and gives the head neutral values.
- **Pure logic** in `src/site/access/` (crypto, keyrings, codes, scope, expiry), shared by the sealer and the browser and unit-tested.
- **Scripts** in `src/site/scripts/`: `sealed.ts` (unlock, regions, the media resolver) and `telemetry.ts`, both set up with `each()` and its signal.
- **The words** of the panel and messages are interface strings in code. The wording of the share message and the Privacy page is content.

## 12. Limits and risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | Plaintext committed to the public repository by mistake | Medium | `.gitignore`; edit mode writes protected content only to `content-private/`; a unit test checks the ignore rule. The leak check covers the build, not history, so never writing it is the first defence |
| R2 | Plaintext in the build log or the artifact | Medium | A quiet build; seal before upload; the leak check; a one-day artifact |
| R3 | A weak or shared code | Medium | Generated codes only; PBKDF2 at 600,000; one code per audience; telemetry shows sharing |
| R4 | Content left readable after expiry | Certain, by nature | Fresh keys every deploy; the nightly deploy; stated plainly here |
| R5 | A sealed page leaks through another page (a related link, a card, the home page, a redirect) | Medium | V25; the leak check's link rule |
| R6 | Telemetry carries protected text or a secret | Low | Fragments stripped; no replay; no text in sealed regions; an E2E test inspects every request to PostHog |
| R7 | Ad blockers hide some visits | High | Accepted: telemetry is a guide, not a ledger. Unlocking works whether PostHog loads or not |
| R8 | The nightly deploy stops (60-day rule) | Low | A warning issue at 50 days |
| R9 | The deploy key leaks | Low | Read-only, one repository; rotate it from the private repository's settings |
| R10 | The private repository leaks | Low | It holds the plaintext and the grants' secrets; GitHub account security (2FA, passkeys) is the protection |
| R11 | Employer-confidential material published | Owner's call | §1: not without its owner's approval |

## 13. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Protected content in a second, private repository, built in CI | Plaintext never enters public history; pages are rendered by the real components |
| D2 | Seal after the build, not before | One rendering path; CSS, the lightbox and the minimap work unchanged |
| D3 | One grant per recipient, as a code or a link | Unique access per audience, traceable and withdrawable on its own |
| D4 | Fresh keys every deploy; keyrings only for valid grants | Expiry and withdrawal reach future content without a server |
| D5 | Expiry enforced by a nightly deploy | No server; about a day's precision |
| D6 | Codes: a name and four EFF words; PBKDF2 at 600,000 | Readable, one derivation per try, a fair cost per guess |
| D7 | Links: a 256-bit secret in the fragment | Unguessable, never sent to a server |
| D8 | Opaque addresses for locked and private pages | An address never hints at a title |
| D9 | Off the planet in v1 | The planet has no unlock flow yet |
| D10 | Grants' secrets stored in the private repository | So a message can be copied again; anyone who can read that repository can read the content anyway |
| D11 | PostHog Cloud, free tier, cookieless, identified by grant | The one free service with clicks, IPs and per-person timelines |

### Open, with defaults

| # | Question | Default |
|---|---|---|
| O1 | PostHog's region | EU |
| O2 | Which recipient details go to PostHog | Name, organisation, role and purpose; never email or notes |
| O3 | Session replay on open pages | Off |
| O4 | A consent prompt as well as the notice | No prompt: notice, no cookies, GPC and DNT respected |
| O5 | Expiry suggested for new grants | 30 days |
| O6 | A locked section in the top navigation | Yes, with a lock icon |
| O7 | The private repository's name | `atiya-private` |

## 14. As built

Nothing is built yet. This section records what's built as the [plan's](plan.md) phases land, with their evidence.
