# Protected content: locked pages, private pages and telemetry

How the site shows some pages only to the people you choose, though it's a static site on GitHub Pages with its code in a public repository. It also covers how each recipient's access is recorded and how visits are measured, all on free tiers. The phases, tests and Definition of Done are in the [plan](plan.md).

> **TL;DR.**
> - **Two new kinds of page.**
>   - **Locked pages:** pages in an open section, like Work, that are listed and open only for a visitor who has signed in with an access code. Everyone else sees the section's open pages, with no titles or content of the locked ones. No section is locked as a whole.
>   - **Private pages:** not listed anywhere; they open only from a magic link (§2).
> - **Signing in is site-wide.** One access code (or magic link), typed once per session, shows every locked page it covers, in its place among the open ones (§2.3).
> - **One credential per recipient.** Every recruiter or hiring manager gets their own grant: an access code or a magic link. Each records who it's for, why, when it was made, what it opens and when it expires, and can be withdrawn on its own (§4).
> - **Plaintext never goes public.**
>   - Locked and private content lives in a second, private repository, kept inside the project as a git submodule (`private-pages/`), so you work on both from one VS Code window.
>   - GitHub Actions builds it with the site, encrypts it, checks that nothing readable is left, and only then uploads to Pages.
>   - The public repository, its history, the build log and the Pages artifact never hold it (§3, §6).
> - **The browser decrypts.**
>   - A grant opens a keyring holding the keys to the pages it covers.
>   - The pages and their pictures and videos are decrypted in the browser with WebCrypto (AES-256-GCM).
>   - There's no server and no library to load (§5).
> - **Expiry and withdrawal work by redeploying.** Every deploy uses fresh keys and leaves out expired or withdrawn grants, and a nightly deploy enforces expiry dates within about a day. Anything a recipient saved while their access worked stays readable to them (§4.5).
> - **Telemetry is PostHog's free tier.** It records page views, clicks, outbound links, IP addresses and their location, and which grant signed in and what it opened. PostHog only knows a grant's opaque ID; edit mode turns it into "the Contoso recruiter". On protected pages only an allowlist of events is sent, so no code, link secret, protected title or text ever leaves the browser (§9).
> - **Held to a benchmark.** The [quality benchmark](benchmark.md) sets the measurable bar (containment, crypto, scope, accessibility, performance, telemetry and publishing safety) that the [plan's](plan.md) Definition of Done is checked against.
> - **No new hosting cost.** GitHub Pages, Actions on a public repository, a private repository and PostHog's free tier are all free.

<figure class="slate-figure" data-diagram="access">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 580" role="img" aria-labelledby="ac-arch__title ac-arch__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ac-arch__title">Protected content: from two repositories to a sealed site</title>
<desc id="ac-arch__desc">On the owner's machine, edit mode writes open content to content/, in the public repository, and locked and private content, with the access grants, to private-pages/, a private repository kept inside the project as a git submodule. GitHub Actions checks out both, builds every page, seals the locked and private ones, checks that no plaintext is left, and uploads the sealed site to GitHub Pages. A visitor's browser fetches the sealed pages and the keyring their access code or magic link opens, and decrypts them in the page. Visits, clicks and unlocks go to PostHog, keyed by the grant, never with the code or the content.</desc>
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
<text x="350" y="148" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ac-arch__body-2" data-slate-fit-padding="16">Sections and navigation</text>
</g>
<g id="ac-arch__private" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ac-arch__body-3" x="330" y="200" width="260" height="120" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="350" y="232" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ac-arch__body-3" data-slate-fit-padding="16">private-pages/</text>
<text x="350" y="254" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ac-arch__body-3" data-slate-fit-padding="16">a private repo, as a submodule</text>
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
| A10 | Some articles are password-protected: no titles and no content until the right password | §2.1, §5.4 |
| A11 | Capture all of it in a detailed spec and an implementation plan | This page, the [plan](plan.md) |
| A12 | Revised: a whole section is never locked. Work is a section; some work is visible to everyone, and some becomes visible and listed only once you're signed in | §2.1, §2.3 |

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
- **Metadata:** that a section holds locked pages, and how many (its page carries one sealed card for each), the sizes of the sealed files and when they change are all visible to anyone who reads the page's source.
- **Copies already made.** A browser's cache, a saved page or an earlier deploy's files someone downloaded keep working with the keys they had. Withdrawal and expiry stop the *current* build from opening (§4.5), nothing more.
- **A script running on the site itself (XSS).** A signed-in visitor's key is in their browser's storage, and decrypted text is in the page. The site has no user input and escapes everything it renders, so the risk is low, but any same-origin script could read both.
- **Forged telemetry.** PostHog's project key is public, so anyone can send events under any grant's ID. Telemetry is a guide to who looked, never evidence (§9.3).
- **Material that must not leave Microsoft or a client.** Encryption on a public host is "not public", not "confidential". Confidential or NDA work needs its owner's approval before it goes here, encrypted or not.

## 2. Two kinds of protected page

Access belongs to a page, never to a section: every section is open, and any of its pages can be open or locked.

| | Open page | Locked page | Private page |
|---|---|---|---|
| Listed in its section | Always | Only for a signed-in visitor whose grant covers it, in its place among the open pages | Never (it's in no section) |
| Its title is public | Yes | No | No |
| Address | `/<section>/<slug>/` | `/<section>/<token>/` (opaque) | `/p/<token>/` (opaque) |
| Opened with | Nothing | Signing in: an access code or a magic link | A magic link only |
| Search engines | Indexed | `noindex` | `noindex` |
| On the home page, related stories, the planet | If placed | Never (v1) | Never |
| Its source lives in | `content/` (public) | `private-pages/`, placed in an open section | `private-pages/` |

### 2.1 Locked pages (A10, A12)

- **Open and locked work share a section.** Work holds case studies anyone can read and others shared only with invited readers. The section, its title, summary, view and place in the navigation are as public as ever.
- **A locked page lives in the private repository** (§3). The private overlay structure places it in its section and gives its position in the section's order. Its slug is replaced by an opaque token, so its address never hints at its title.
- **Signed out**, the section lists its open pages only, exactly as if the locked ones didn't exist, followed by one line: "More work is shared with invited readers. Sign in to see it." (O6). The locked cards are in the page only as sealed blobs (§5.4): no titles, summaries or thumbnails.
- **Signed in**, the cards the visitor's grant covers are decrypted and take their places among the open ones, in the section's order, each with a small "Shared with you" tag. Cards outside the grant's scope are never decrypted and stay hidden. The sign-in line goes.
- **A section with only locked pages** shows its empty state and the sign-in line when signed out.
- **Elsewhere,** even signed in, locked pages aren't on the home page, in an open page's related stories or next and previous, in the navigation or on the planet (v1).
- **A protected page never names another protected page.** Its own related stories and next and previous list open pages only. So a grant that covers one page learns nothing about its neighbours: no title, no address (§5.4). A link the author writes in a page's text to another protected page is that page's own content, and opens that page's own sign-in or "not shared with you" note.
- **The order:** the public structure keeps the open pages' order on its own (so a public-only build is unchanged). The overlay holds the section's full order, open and locked node IDs together, and the build uses it when the private folder is present.

### 2.2 Private pages (A8)

- **A private page is in no section and on no list.** It exists only in the private repository, at `/p/<token>/`, and opens only from a magic link that covers it.
- **Its token is stable**, so a link keeps working across deploys. **Change address** (edit mode) gives the page a new token, which breaks every link to it at once: a kill switch for that page.
- **Without a valid link**, the shell says only that the page is private and how to ask for access. It has no title, no description and no hint of its subject.
- **Links between protected pages are sealed with the page that holds them.** A link to a page the reader's grant doesn't cover opens that page's own "Your link doesn't open this page" note.

### 2.3 Signing in

- **"Signed in" means this browser holds a valid grant's key** (§7.3). There are no accounts and no server: signing in is typing an access code once, or opening a magic link, which signs you in the same way.
- **One sign-in covers the whole site** for the session: every section shows the locked pages the grant covers, and every locked page it covers opens.
- **Where you sign in:** a **Sign in** page (`/sign-in/`), reached from:
  - the sign-in line under a section that holds locked pages;
  - a **Sign in** link in the footer, on every page;
  - a locked page opened directly while signed out (it shows the same panel in place).

  After signing in you go back to the page you came from (a same-site path only).
- **While signed in**, a slim `AccessBar` under the header says so, with **Sign out** (§7.3).
- **Private pages** are the exception: they open only from their magic link, and signing in with a code never shows them (V26).

## 3. Where the content lives

**The problem.** The repository is public, and edit mode publishes by committing `content/`. A protected page committed in plaintext even once would be readable in the git history forever, whatever the site then serves.

**The design: a governed repository inside the project.**

```
personal-site/            the public repository (prabinpebam/atiya)
├─ content/               open content, as today
├─ private-pages/         a git submodule: the private repository (prabinpebam/atiya-private)
├─ .gitmodules            the manifest: the submodule's path, address and branch
└─ …
```

- **`private-pages/`** is a git submodule: a separate private GitHub repository (`atiya-private`, free), checked out inside the project. The public repository tracks it only as an entry in `.gitmodules` (its path, address and branch) and a pointer to the commit it uses. Not one of its files is in the public repository.
- **One VS Code window.** Source Control shows both repositories side by side, with their own changes, commits and pushes, and edit mode reads and writes both folders.
- **The parent can't swallow it.** Git refuses to add a submodule's files to the parent repository (they belong to the submodule), so a stray `git add -A` at the root can't commit private content. A unit test checks that `private-pages` is a submodule entry (mode 160000) and that the public repository tracks no file under it.
- **Deploys are pinned.** The public repository's pointer says exactly which private commit a deploy uses, so every deploy can be rebuilt as it was, and nothing private reaches the site until the pointer moves (§8.3).
- **Setting up a clone:** `git clone --recurse-submodules`, or `git submodule update --init` in an existing one. Two settings keep it smooth, set once by the setup script (`scripts/setup-private-pages.ps1`):
  - `submodule.recurse true`, so a pull also updates `private-pages/`;
  - `push.recurseSubmodules check`, so git refuses to push a pointer to a private commit that hasn't been pushed (a deploy would fail to fetch it).

  The script also puts the submodule on its `main` branch, not the detached commit a submodule normally starts on, so edits are committed on a branch.
- **What the public repository reveals:** the private repository's name and address in `.gitmodules`, and a pointer commit each time private content changes (when, never what). Pointer commits carry a fixed message, "Private pages: update", which edit mode never lets describe the change. The repository itself stays private, so its address opens nothing.
- **It has the same layout as `content/`:** `articles/`, `media/<owner>/<id>/` and `structures/`.
- **What it holds:**
  - the locked pages and the private pages (articles, the same contract as every page);
  - their media masters and sidecars;
  - `structures/overlay.json`: which open section holds each locked page, each section's full order (open and locked pages together), and each protected page's token;
  - `access.json`: the grants (§4), with their secrets;
  - `access-message.json`: the words of the message edit mode offers to copy (§8.1).
- **What stays public:** nothing about a locked page. The public structure doesn't know it exists. Its only public traces are its sealed card in its section's page and the sign-in line (§2.1).
- **Loading: one source, two origins.** The content source reads both folders and keys every file by where it comes from: `/content/…` for the public folder and `/private/…` for `private-pages/`. Every reader takes the origin from the key, and nothing else assumes one folder:
  - the loader, which indexes both (a private article at `/private/articles/<id>.json`, a private master at `/private/media/…`);
  - picture metadata in dev and the masters a build imports (`masters.ts` globs both);
  - the video and document files the content-files integration serves and copies (a private one is copied only for sealing, §6.2);
  - the dev watcher, and the editor's store (§8).

  The overlay's nodes join their open sections in the route table, and private pages get `/p/<token>/` routes outside the three levels (like `/play/`). Every ID, media ID and route is unique across both folders.
- **A public-only build.** Without `private-pages/` (a fork, a clone without access, a clone made without `--recurse-submodules`), the site builds as before: sections list their open pages, with no sign-in line, and there are no locked or private pages. The deploy workflow refuses to run without it (§6.1).
- **Tests never read the real private content.** Unit and E2E tests use a fixture private folder (`tests/fixtures/private-pages/`) with made-up pages and grants.

## 4. Grants: access codes and magic links

A **grant** is one credential for one recipient. It is how you share, track, expire and withdraw access.

### 4.1 The record

Every grant is a record in `private-pages/access.json`:

| Field | What it holds |
|---|---|
| `id` | Random, opaque and stable (`g` and 8 base32 characters). It's the grant's identity in telemetry, never a name |
| `kind` | `code` (typed) or `link` (a magic link) |
| `recipient` | Who it's for: `name`, `organisation`, `role`, optional `email`. Never shown to anyone else |
| `purpose` | Why it was shared, in your words ("Senior design manager role, first screen") |
| `scope` | What it opens: every locked page in a section (now and later), and/or single pages (locked or private). A code's scope holds locked pages only (V26) |
| `createdAt` | When it was made, with its time zone |
| `expiresAt` | When it stops working (optional; edit mode suggests 30 days) |
| `revokedAt` | When you withdrew it, if you did |
| `secret` | A code's four secret words, or a link's 32-byte key, and the grant's salt (§5.2). Kept so you can copy the message again. The salt is published with the grant's keyring (it isn't secret); the words and the key never are |
| `notes` | Anything else you want to remember. Never published, never sent to telemetry |

**Grants are never deleted**, only expired or withdrawn, so the record stays complete. Edit mode's store enforces it: it refuses to delete a grant, reuse an ID or code name, or change a withdrawn grant's scope or secret, comparing each change with the file's previous version. A hand edit to `access.json` bypasses that, which is why grants are made in edit mode. The private repository's git history is the audit trail: every grant's creation, extension and withdrawal is a commit with its date.

### 4.2 Access codes (A5)

- **One code per audience:** a recruiter, a hiring manager, a panel. Two people never share a code unless you mean them to.
- **The form:** five words joined by hyphens, like `harbor-maple-river-cloud-seven`.
  - **The first word is the code's name:** unique among codes that still work, not secret. It tells the page which keyring to try, so unlocking runs one key derivation, not one per grant.
  - **The other four are the secret**, drawn at random from the EFF large wordlist (7,776 words, CC BY 3.0 US, credited in `assets-src/CREDITS.md`). That's about 51.7 bits, behind PBKDF2 at 600,000 iterations (§5.2). Edit mode can make a longer code for a grant you want stronger.
- **Typed on the Sign in page** (§7.1), or opened from a link that carries it (§4.3): a code grant can also be sent as a link to save the typing.
- **Edit mode generates the code**, never you, so codes aren't reused or guessable from each other.

### 4.3 Magic links (A8)

- **The form:** the page's address and a fragment: `https://prabinpebam.github.io/atiya/p/k3v9q2m7xw/#a=g7k2m9qd4.<secret>`.
  - The fragment (after `#`) is **never sent to any server**, GitHub's included, and never logged by it.
  - The secret is 32 random bytes (base64url), so a link can't be guessed.
  - A link can point at a private page, a locked page or a section; opening it signs the visitor in (§2.3), as a code would.
- **On opening**, the page reads the fragment, removes it from the address bar at once (`history.replaceState`), so it isn't left in a screenshot, a bookmark or a copied address. It then unlocks and keeps the key for the session (§7.3).
- **A link is a bearer credential:** whoever has it can open it. Telemetry shows if it's opened from more than one device or place (§9.3), which is how a forwarded link shows up.

### 4.4 Traceability (A9)

For every grant you can see:
- **who it was for and why:** `recipient` and `purpose`;
- **when it was made, changed, extended or withdrawn:** its record, and the private repository's history;
- **when it was opened, from where and what was read:** its telemetry, keyed by the grant's `id` (§9.3): every sign-in, every protected page viewed, the device, the IP address and its location. It's a guide, not evidence: anyone can send events under any ID (§1);
- **its state:** active, expires soon (within 3 days), expired, withdrawn, or waiting for a deploy (§8).

Edit mode's Access screen shows the record, its state and its history, with a link to the grant's timeline in PostHog (§8.1). PostHog only ever knows the grant's `id`; who it is stays in edit mode.

### 4.5 Expiry and withdrawal (A6)

- **Fresh keys every deploy.** Each build makes new random keys for every sealed page, and a keyring only for each grant that is still valid (not expired and not withdrawn). An expired or withdrawn grant simply has no keyring, so it opens nothing on the live site, including pages published later.
- **A nightly deploy** (a scheduled GitHub Action, shortly after midnight India time) applies expiry dates, so a grant stops opening the current build within 26 hours of its date. GitHub runs scheduled workflows late at busy times, sometimes by an hour or more.
- **Withdraw now:** edit mode sets `revokedAt` and publishes: the private commit, then the pointer, whose push starts a deploy (§8.3). The current build stops opening for it within about 15 minutes: the deploy takes a few, and GitHub Pages lets browsers keep a page for up to 10.
- **The page checks too:** a keyring carries its grant's expiry, and the page refuses an expired one with its own message (§7.2), even in the hours before the nightly deploy runs. That check runs in the visitor's browser, so a determined reader could skip it; the deploy is the real enforcement.
- **What it can't do:** take back what was read or saved while the grant worked, or a copy of an earlier build's files (§1).
- **A GitHub rule to know:** GitHub turns off scheduled workflows in a public repository after 60 days without activity. When the last commit is 50 days old, the nightly run fails on purpose with a message saying so (GitHub emails you about a failed run), and any commit resets the clock.

## 5. Cryptography

Everything uses the Web Crypto API, built into every current browser and into Node 24 (the build's runtime), so the same module runs in both. There's no crypto library to load.

### 5.1 Keys

| Key | Made | Lives | Protects |
|---|---|---|---|
| **Grant key (KEK)** | Derived from the code or the link's secret (§5.2) | Never in the site; in the visitor's browser after unlocking (§7.3) | The grant's keyring |
| **Page key (CK)** | Random, 256 bits, fresh every build | Inside keyrings | One sealed page: its regions and its card |
| **Media key (MK)** | Random, 256 bits, fresh every build | Inside the sealed page that shows the file | One sealed media file |

### 5.2 Deriving the grant key

- **A code:** PBKDF2-HMAC-SHA256 over the four secret words (lowercase, joined by single hyphens), with the grant's own 16-byte salt and 600,000 iterations (OWASP's current recommendation for PBKDF2-SHA256). That takes about half a second on a phone, once per session. Every guess costs an attacker the same 600,000 hashes.
- **A link:** HKDF-SHA256 over its 32 random bytes, with the grant's salt and the info string `atiya/grant/v1`. No slow derivation is needed, since the input is already random.
- **The salt is stable and public.** It's stored with the grant and written in clear in the keyring's header (§5.3), because the browser needs it before it can derive anything. A remembered grant key keeps working across deploys while the keyring it opens changes.

### 5.3 Sealed files

**Every build has a build ID** (16 random bytes, base64url), written into every protected page (`data-build`) and every sealed file's authenticated data. Sealed files live under it, so a deploy never overwrites a file a cached page still asks for:
- `<base>/_access/<build>/c/<name>.json` for a code's keyring, and `<base>/_access/<build>/l/<grant id>.json` for a link's;
- `<base>/_sealed/<build>/<random>.bin` for media;
- page regions and cards inline in their page's HTML, as base64 in `<template data-sealed>` elements, so a page needs no extra request.

A page whose keyring is missing (an old page cached after a deploy) reloads itself once with the cache bypassed. If the keyring is still missing, the grant has expired or been withdrawn (§7.2).

**A keyring** is a small JSON envelope, with its key derivation in clear and everything else encrypted:

```json
{ "v": 1, "build": "…", "kdf": "pbkdf2-sha256", "iterations": 600000, "salt": "…", "iv": "…", "data": "…" }
```

- `kdf` is `pbkdf2-sha256` (a code) or `hkdf-sha256` (a link). The browser accepts only those two, PBKDF2 only at exactly 600,000 iterations, a 16-byte salt, a 12-byte IV and a file under 64 KB. Anything else is refused as a damaged file, never derived (no downgrade, no denial of service by a huge count).
- The clear header is part of the authenticated data (`atiya/keyring/v1|<lookup>|<build>|<kdf>|<iterations>|<salt>`), so changing any of it fails decryption.
- **Decrypted**, it holds the grant's `id` and `expiresAt`, and the page keys it covers by their per-build key IDs (`kid`, random, never the page's ID). It holds no recipient name and no notes.

**Every other sealed file** is binary: `ATS1` (4 bytes, the format and version), a 12-byte random IV, then the AES-256-GCM ciphertext and its 16-byte tag. The additional authenticated data binds it to its build, its purpose and its name:
- **page regions:** `atiya/page/v1|<build>|<kid>`, with the page key;
- **card:** `atiya/card/v1|<build>|<kid>`, with the page key;
- **media:** `atiya/media/v1|<build>|<file name>`, with the media key.

A wrong key, a changed byte, a swapped file or a file from another build all fail the GCM tag check. The page reports it as a code that doesn't work (or, for a build mismatch, reloads), never as a crash. IVs are random for every file (96 bits); no key encrypts more than a page's handful of files.

### 5.4 Sealing a page

The build renders a protected page with the same layouts and components as any other. The layout marks every part that would say what the page is about with a pair of comments (`<!--sealed:main-->` … `<!--/sealed:main-->`), which the layout owns: no component wraps another to do it. The parts:
- `<main>`: the page itself, its breadcrumbs and its minimap;
- the `<title>`, the description and every social meta tag;
- any structured data.

**A protected page's own lists hold open pages only** (§2.1): its related stories and next and previous never name another protected page. So everything sealed with a page's key is about that page, and a grant that opens it learns about nothing else.

**After the build**, the sealer replaces the regions:
- **the regions themselves** are encrypted with the page key into one payload, and swapped for neutral placeholders. The `<title>` becomes "Locked page" or "Private page", there's no description, and `<meta name="robots" content="noindex, nofollow">` and `<meta name="referrer" content="same-origin">` are added;
- **a section's locked cards:** each locked page's card is sealed on its own with its page's key, so a grant decrypts only the cards in its scope (§2.1). A sealed card's payload holds the card's HTML and its place: the open page it follows (or the start). The place is inside the payload, so the page's source doesn't say where locked work sits. The cards wait outside the list, in a hidden holder, so the list's layout (which counts its children) is the open pages' until a card is placed;
- **the page's scripts and styles stay** in the shell. They show which components exist on the site, not what the page says.

### 5.5 Pictures and videos (A3)

- **Every file made from a private master is sealed:**
  - every size of a picture, its full size for the lightbox and its thumbnail;
  - its dark mode version;
  - a video's file and its poster frame.

  Each file gets its own media key, and the readable file is deleted from the build. The build records every file it makes from a private master as it makes it (§6.2), so the sealer knows each one by where it came from, not by guessing from a page.
- **A public picture on a protected page** (its master in `content/`) stays readable: it's public anyway. A private master on an open page is refused (V25).
- **Decrypting is lazy:**
  - **Pictures** decrypt when they come near the viewport, at the one width the layout and the screen's pixel density need, and become `blob:` URLs. The lightbox asks for the full size when it opens.
  - **Videos** decrypt whole when they come near the viewport and play from a `blob:` URL, which seeks normally. Web Crypto decrypts a file in one piece, so for a moment the browser holds the sealed bytes, the plain bytes and the video's blob: about three times the file. That's why a sealed video is capped at **10 MB** (V27), about 30 MB at its peak.
- **Memory:** a page's `blob:` URLs are revoked when the page is left, and on sign-out.

## 6. Building and deploying

### 6.1 The deploy workflow

`.github/workflows/deploy.yml` changes as follows:

1. **Triggers:** a push to `main` (as today, including every pointer commit, §8.3), Deploy now (`workflow_dispatch`, to run it again by hand), and a nightly schedule (§4.5).
2. **It fetches `private-pages/` at the pinned commit** with a **read-only deploy key**: an SSH key added to the private repository with read access only, its private half stored as the public repository's Actions secret `PRIVATE_CONTENT_KEY`. The public repository is checked out as today (without submodules); a second step loads only that key into an SSH agent, points the submodule's address at SSH for this run, and runs `git submodule update --init private-pages`. A deploy key works on one repository only and doesn't expire like a personal token. If the secret or the fetch fails, the deploy stops.
3. **The build runs quietly.** Astro's log names routes and image files, and a content error names IDs and fields. The build's output goes to a file the workflow never prints or uploads. On a failure the step prints only that it failed and that you should run the build locally. Workflow logs on a public repository are public.
4. **The sealer runs inside the build** (`astro:build:done`, §6.2), so `dist/` is never complete and unsealed.
5. **The leak check** (`npm run verify:sealed`, §6.3) runs before the upload, and fails the deploy on any finding.
6. **The upload** keeps the artifact for one day (`retention-days: 1`). On a public repository, any signed-in GitHub user can download a workflow's artifacts; the artifact is sealed anyway, and a short life keeps old copies from piling up.
7. **The deploy job runs only for `main`.** A run on another branch (Deploy now on a branch) builds, seals and checks, and stops before deploying, which is how the workflow itself is tested.
8. **The bundle budgets** and the rest of today's steps are unchanged.

Every step stays on Actions' free minutes for public repositories.

### 6.2 The sealer

- **Where it lives:** an Astro integration, `integrations/seal.mjs`, running last in `astro:build:done` (after the content-files integration has copied the video and document files). The crypto is the same module the browser uses (`src/site/access/crypto.ts`); the integration loads it through a small Node entry built from it, so there is one implementation.
- **The provenance record.** While the build renders, every place that turns a master into a file in `dist/` (the picture sizes in `pictures.ts`, the video and poster copies in content-files) records the file, its master and the master's origin (public or private) in one provenance file (`node_modules/.cache/site-protected/provenance.jsonl`, emptied when a build starts). Protected pages are recorded there too, with their routes and `kid`s.
- **What it does:**
  1. reads the grants and the overlay from `private-pages/` (or, in a test build, the fixtures), and the provenance record;
  2. makes the build ID, the page keys and the media keys;
  3. seals each protected page's regions and each locked card, and every private-origin file a sealed region refers to, rewriting its address inside the sealed HTML (`src`, `srcset`, `href`, `poster` and the lightbox's `data-full…` attributes);
  4. deletes every private-origin file from `dist/` once it's sealed, and refuses (fails the build) if one is left that no sealed page refers to;
  5. writes a keyring for each valid grant.
- **What it never does:** run in dev or in the editor, or print a title, a slug, an ID or a token. Its log says only how many pages, files and keyrings it sealed.
- **Test builds** (`--mode test`) seal the fixture private content with its fixture grants, whose codes the E2E tests know. A production build never reads the fixtures.

### 6.3 The leak check

`scripts/verify-sealed.mjs` checks `dist/` after sealing, in three layers. A finding prints only its category, the file and a count, never the protected words or bytes it matched (the log is public).

1. **Provenance (the primary check).** Every entry in the provenance record (§6.2) is accounted for: a private-origin file is gone from `dist/` and its sealed copy is there; a protected page's route has its sealed regions and no readable ones. Anything unaccounted for fails.
2. **Structure.** No seal comment is left in any file; every protected page's shell has its neutral title, `noindex`, its `data-build` and no description; no open page links to a protected page's token; every `_access` and `_sealed` file belongs to this build.
3. **Words and bytes (defence in depth).** Every file in `dist/` is decoded (HTML entities, JSON escapes) and its whitespace and case folded, then searched for:
   - every protected page's title, summary, headings, alt texts, captions, quotes, facts, tile labels, link text and every run of words in its text of 12 characters or more;
   - its ID, slug and token, and every grant's ID, code name, recipient and purpose;
   - the SHA-256 of every private master and of every file the sealer removed.

It runs in the deploy, in `npm run verify:prod`, and on the E2E build, and its own unit tests plant every kind of leak (a short title, an attribute, an encoded word, JSON, a picture size, a dark version, a poster, a video, an orphan file) and expect each to fail. It's the gate that makes the pipeline fail closed.

## 7. What a visitor sees

### 7.1 Signing in

A compound, `UnlockPanel`, is the form on the Sign in page (`/sign-in/`) and on a locked page opened while signed out. It holds:
- a line saying some work is shared with invited readers;
- the **Access code** field (a password field with Show, so a password manager can keep it);
- **Sign in** (the primary button);
- **Remember on this device** (a checkbox, off by default);
- a line on how to ask for access, linking to the contact page.

On a section, the signed-out state is only the sign-in line under its list (§2.1), never the form.

While a remembered key is tried, the panel and the sign-in line are replaced by a short "Signing in…" status, so there's no flash of the form, and a section's list doesn't reflow twice.

On a private page, the shell shows a short note instead: the page is private, open it with the link you were sent, or get in touch.

### 7.2 Messages

Every message follows the site's copy rules: sentence case, says what happened and what to do. "Get in touch" links to the contact page.

| Case | Message |
|---|---|
| Wrong code, or a damaged file | "That access code doesn't work. Check it and try again, or get in touch for a new one." |
| Expired | "This access expired on 5 November 2026. Get in touch for a new one." |
| Withdrawn or no longer valid (no keyring) | "This access code no longer works. Get in touch for a new one." (a withdrawal isn't disclosed as such) |
| Link without access to this page | "Your link doesn't open this page." |
| Signed in, on a locked page the grant doesn't cover | "This page isn't shared with your access. Get in touch if you'd like to see it." |
| No JavaScript | "This page is shared with invited readers and needs JavaScript to open." (in `<noscript>`) |
| A browser without Web Crypto (very old ones) | "This browser can't open shared pages. Try a current version of Edge, Chrome, Firefox or Safari." |
| The page and its keyring are from different deploys, after one reload | "The site was just updated. Reload the page in a minute." |
| Offline, or the keyring can't be fetched | "Couldn't reach the site to sign in. Check your connection and try again." |

Each message goes into the page's live region as well as on the screen.

### 7.3 Staying signed in

- **By default, for the session:** the grant key is kept in `sessionStorage`, so moving between pages, or coming back in the same tab, needs no code.
- **Remember on this device** keeps it in `localStorage` until it expires.
- **Sign out**, in a slim `AccessBar` under the header on every page while signed in:
  - forgets the key in both storages, and tells every other open tab of the site to do the same (a `BroadcastChannel`, with the `storage` event as its fallback);
  - revokes the page's `blob:` URLs, removes the decrypted regions and cards and puts back the neutral title;
  - resets telemetry's identity (§9.3);
  - and moves on with `location.replace`: from a protected page to its section (or home, for a private one), elsewhere to the same page, so Back doesn't return to the decrypted page.
- **The back and forward cache:** a page shown again from it (`pageshow` with `persisted`) checks whether the visitor is still signed in, and reloads if not.
- **What's stored:** the grant key and the grant's `id`, `expiresAt` and lookup, never the code or the link's secret. After a deploy the same key opens the new keyring, until the grant expires or is withdrawn.
- **Signing in is per browser.** Nothing is sent anywhere to check it; telemetry only records that it happened (§9).

### 7.4 After signing in

- **On a section,** the covered cards are decrypted and inserted in order, and the live region says how many shared pages were added.
- **On a locked page,** the sealed regions are decrypted and swapped in. The page sets its real `<title>`, then fires `astro:page-load`, so every component's script sets up the new elements through `each()` exactly as on an open page (the lightbox, the minimap, the gallery, videos). Focus moves to the page's heading, and the live region says the page is open.
- The page's own media resolver (§5.5) watches sealed pictures and videos and fills them in as they come into view.

### 7.5 Accessibility

- The panel is a labelled form, its errors tied to the field (`aria-describedby`), with 44 px targets, working at 320 px wide and in both themes.
- The decrypted page is the same markup an open page has, so it meets the same checks (axe in both modes).
- Signing in doesn't depend on a pointer, a time limit or a CAPTCHA.

## 8. Edit mode

Everything here is dev-only, like the rest of edit mode ([editor spec](../editor/spec.md)), and reads and writes through the store.

### 8.1 The Access screen

- **The list:** every grant, with its recipient, kind, scope, when it was made, when it expires and its state (active, expires soon, expired, withdrawn, waiting for a deploy). Filters: state, kind, section.
- **New access code** and **New magic link:**
  - who it's for, why, and what it opens (single locked pages, or every locked page in a section, now and later; private pages for a link);
  - an expiry date (30 days suggested; none allowed).

  Edit mode generates the code or link and shows a ready message to copy ("Hi Jane, here's access to my selected work…") with the code or link and its expiry. The words of that message are content (`private-pages/access-message.json`), so you can change them.
- **A grant's page:**
  - its record and its history (from the private repository's log);
  - Copy message again;
  - Extend;
  - Change scope;
  - Withdraw now (§4.5);
  - **Who looked:** a link to the grant's person page in PostHog (its timeline: sign-ins, protected pages viewed, devices, places and IPs), when the PostHog project is set (§9.5). Recipient details never go to PostHog; this screen is where an `id` becomes a name.

### 8.2 Sections and pages

- **A page's Settings** get **Access:** Open, Locked or Private.
  - **Locking an open page** moves it, and the media only it uses, into `private-pages/` in one transaction, keeping its place in its section's order. Media an open page also uses stays public. If the page was ever published openly, edit mode warns first that its earlier text stays readable in the public repository's history, which locking can't undo.
  - **Opening a locked page** moves it, and its private media, back into `content/`, after a confirmation that it becomes public.
  - **Making a page private** takes it out of its section.
- **The Sections screen** lists a section's locked pages among its open ones, each with a lock tag, so you order them together; the order is written to the overlay, and the open pages' order to the public structure too.
- **The articles list** marks locked and private pages and filters by them. **New private page** creates a page in `private-pages/` with its token.
- **A private page's Settings:** its address (token), **Change address** (breaks every link to it, with a confirmation) and **Share**, which opens New magic link for that page.
- **Uploads** for a locked or private page go into `private-pages/media/`.
- **Locked and private pages can't be put on the planet** (V28); the Planet screen doesn't offer them.
- **The editor shows protected pages open**, with a ribbon saying who can see them, and lists every section with its locked pages.
- **Seeing it as a visitor:** `npm run preview:protected` builds the site with the real private content, sealed exactly as the deploy seals it (checked by the leak check), and serves it on `http://localhost:4331/`, where you can sign in with any active grant. The build stays on your machine.

### 8.3 Publishing to two repositories

**The same Publish as today.** There's no second publish flow: edit mode's Publish button (in the top bar, with its count of changes) and the Publish screen ([editor spec §7](../editor/spec.md#7-publishing)) cover both folders. Editing a locked or private page, its media, a grant or the overlay is saved through the same store, counted in the same badge, and published by the same button.

- **The Publish screen** lists every change in both folders as one list, each named as its resource as today, with a lock tag on private ones ("Private page: Contoso redesign", "Access: Jane Doe, Contoso"). Discard works on any of them. The content check runs on the merged content of both folders, and Publish is enabled only when it passes.
- **One message, never in public history when anything private changed.** The form keeps its one message field, and what goes where is fixed by what changed, not by checking your words:
  - **only public changes:** your message, on the public commit, as today;
  - **any private change:** your message goes on the private commit only. The public commit's message is made by edit mode from the public changes alone ("Update the Work section; Private pages: update"), or is the fixed "Private pages: update" when only private files changed. The field says which will happen before you publish;
  - **the suggested message** is made from the public changes only, never from private ones.
- **Publish**, holding the writer lock as today:
  1. reads both folders once and checks them;
  2. in the submodule, on its `main`: stages its changes (`git add -A`), confirms what's staged is what it checked, commits and pushes;
  3. in the public repository: stages `content/` and the moved `private-pages` pointer, confirms that nothing else is staged and that the staged blobs are what it checked, commits (`-- content private-pages`) and pushes, which starts the deploy.

  If only private files changed, the public commit holds only the pointer, so a private change always deploys through an ordinary push; no extra token or `gh` call is needed. Git's `push.recurseSubmodules check` refuses step 3 if step 2's push didn't land.
- **Refusals,** each said in words beside the button, as today: a detached HEAD or a branch without an upstream, in either repository; a submodule that isn't on `main`; a submodule with commits that aren't its pointer's and aren't pushed.
- **The result** shows both commits, and the link to the deploy on GitHub Actions.
- **A failed push** in either repository leaves its commit local, and Push again pushes whichever is behind, private first. The top bar's badge counts unpushed commits in both.
- **Withdraw now** (§4.5) publishes at once: the grant's change in the private repository, then the pointer.
- **Discard** restores a tracked file in its own repository and deletes an untracked one, as today.

## 9. Telemetry

### 9.1 The service

**PostHog Cloud, free tier:** 1 million events a month, no card needed, and it stops recording at the cap rather than billing. It records page views, clicks and outbound links by itself, stores the IP address (`$ip`) and the location it implies, and supports custom events and a timeline per identified person.

Alternatives considered:
- **Umami Cloud's free tier:** 100,000 events a month, simpler, but no IP addresses and no per-person timelines.
- **Microsoft Clarity:** heatmaps and replays, but no IPs and weak custom events.
- **Cloudflare Web Analytics:** no custom events.
- **Your own Cloudflare Worker with D1:** raw logs you own, but code to maintain.

### 9.2 What's recorded

**On open pages** (anything not protected), PostHog's own capture:

| Event | When | Properties |
|---|---|---|
| `$pageview`, `$pageleave` | Every page | The address without its fragment; the title; the referrer; the device; the IP and its location |
| `$autocapture` | Clicks on links and buttons, outbound links, the résumé download | The element, its text and its link |

**On protected pages, and the Sign in page, only an allowlist**, sent by the site itself: PostHog's automatic page views and autocapture are off there (they'd send the decrypted title, link text and link addresses), and every event is built from these properties alone:

| Event | When | Properties |
|---|---|---|
| `$pageview` | A protected page or the Sign in page loads | `$current_url` and `$pathname` as the page's route with its token (opaque); `$title` "Locked page", "Private page" or "Sign in"; the referrer's origin only |
| `access_signed_in` | A code or link signs the visitor in | `grant` (its `id`), `via` (code or link) |
| `access_opened` | A locked or private page opens, or a section shows shared cards | `grant`, `place` (the page's token, or the section's path), `cards` (on a section: how many were shown) |
| `access_failed` | A code or link doesn't work | `reason`: wrong, expired, withdrawn, unsupported, offline. Never the code |
| `access_signed_out` | Sign out | `grant` |
| `access_link` | A link on a protected page is followed | `kind`: internal, outbound or download; for an outbound link, its domain only |

**Everywhere:**

| Event | When | Properties |
|---|---|---|
| `video_played` | A video starts | Its media ID on open pages; nothing but `place` on protected ones |
| `planet_opened` | The planet goes live | None (the game's own events come later) |

### 9.3 Who looked (A9)

- **Identity is the grant.** When a visitor signs in, the page calls `identify(<grant id>)`, and every later page does the same while they stay signed in. Everything they do is on the grant's timeline: the pages, the clicks, the device, the IP and the city.
- **Only the grant's `id` goes to PostHog.** The recipient's name, organisation, role, purpose and notes never do. Edit mode's Access screen joins an `id` to its recipient, and links to its timeline (§8.1).
- **Sign out resets it** (`posthog.reset()`), so what a visitor does after signing out, or under a second grant in the same browser, isn't put on the first grant's timeline.
- **Anonymous visitors** have no profile (`person_profiles: 'identified_only'`). Their events are counted, but no profile is built.
- **A forwarded link** shows up as one grant opened from several devices, places or IPs. It's a hint, not evidence: the project key is public, so events can be forged (§1).

### 9.4 Never sent

- **No code, no link secret:** URLs are sent without their fragment (`before_send` strips it from every address property, on every page), and the fragment is gone from the address bar anyway (§4.3).
- **No protected text, title or address:** on protected pages, only the allowlist above leaves the browser. `before_send` drops any event that isn't on it, and any property that isn't, as a second line. Session replay is off everywhere.
- **No editor or dev traffic:** telemetry loads only in production builds, never in dev, edit mode or test builds (the E2E tests point it at a fake host to inspect what would be sent).

### 9.5 How it's loaded

- `posthog-js`, pinned, in its build that loads no other script (`posthog-js/dist/module.no-external`). Nothing comes from a CDN.
- A tier-0 site script (`src/site/scripts/telemetry.ts`) imports it on idle after the page loads, so it never delays the first paint or the planet's loading budgets. It's set up without cookies (`persistence: 'sessionStorage'`). The sign-in runtime tells it what happened through DOM events, so neither imports the other.
- Its project key and host come from Actions variables (`PUBLIC_POSTHOG_KEY`, `PUBLIC_POSTHOG_HOST`). A build without them, a fork for example, has no telemetry. The key is meant to be public.
- **IP addresses:** PostHog records them only if the project's "Discard client IP data" setting is off; A0 checks it, since it's the whole point of A7 for you.
- **The planet** (`/play/`) loads the same script from its page, after the planet is live, never from the game, which keeps "the game and the site never import each other".

### 9.6 Opting out, and the privacy notice

- **Respected signals:** a browser that sends Global Privacy Control or Do Not Track sends nothing.
- **Your own visits:** opening any page with `?telemetry=off` stops telemetry on that device until `?telemetry=on`. Use it on your own devices.
- **A Privacy page** (content, in the Contact section, linked from the footer) says what's collected (the events, IP addresses and their location), why, who processes it (PostHog), how long it's kept, how to opt out and how to ask for deletion.
- **The law:** an IP address is personal data under the GDPR and India's DPDP Act. A clear notice, no cookies and respected opt-outs are the plan; whether you also need a consent prompt depends on where your visitors are, and that's your call (O4).

## 10. Content rules

New checks, in the loader (`tests/unit/content.test.ts`) and edit mode's check, numbered after the [sections spec's](../sections/spec.md#9-decisions):

| # | Rule |
|---|---|
| V23 | A locked page and a private page live only in `private-pages/`, and the public structure never names them. Every section is open: access is a page's, never a section's |
| V24 | IDs, media IDs, node IDs, tokens and routes are unique across both folders; tokens are 10 base32 characters |
| V25 | An open page never refers to a protected page, or to a master in `private-pages/` (blocks, related, thumbnails, the navigation, the home page, redirects) |
| V26 | A grant's scope names only sections, locked pages and private pages that exist; a code's scope holds no private page |
| V27 | A sealed video is at most 10 MB; a sealed picture's master follows the media budgets |
| V28 | A locked or private page isn't on the planet |
| V29 | Code names are unique among codes that still work; grant IDs are unique and never reused |
| V30 | A grant expires after it's created; a withdrawal is after its creation. (That a grant is never deleted, its ID never reused and a withdrawn grant never changed again are transition rules: edit mode's store enforces them against the file's previous version, §4.1) |
| V31 | The overlay's order for a section holds every open page the public structure lists there, in the same relative order, plus its locked pages |
| V32 | A protected page's own related stories and next and previous are open pages only (§5.4) |

**Who may be built, sealed or not.** Access doesn't override the editorial rules; it adds to them:

| `status` and `visibility` | Open page | Locked or private page |
|---|---|---|
| Published (`published`, `stale`) and `public`, `publicRedacted` or `summaryOnly` | Built | Built and sealed |
| Anything else (a draft, `privateDiscussionOnly`, `notPublishable`) | Not built | Not built, and not sealed: it never leaves `private-pages/` |

So V8 ("only published statuses and public visibilities are built") holds as before, and `privateDiscussionOnly` still means "never published", sealed or not.

## 11. The design system

These follow the [site design system](../site-ui/design-system.md): tokens only, sealed fundamentals, a doc comment and a story for every component.

- **`UnlockPanel`** (compound): `TextField`, `Button`, `Checkbox` and `Text`, with its states (ready, signing in, wrong, expired, not shared with you). Used by the Sign in page and a locked page's shell.
- **`AccessBar`** (compound): the signed-in state and Sign out, under the header.
- **Seal markers are the layouts' own** (comment pairs, §5.4), not a component: a compound may not wrap other compounds.
- **The layouts:**
  - `ArticleLayout` takes a `sealed` prop (`'locked' | 'private'`) that marks its regions (§5.4), gives the head neutral values and lists only open pages after it;
  - `IndexLayout` renders a section's open cards as today, its locked cards sealed in a hidden holder after the list, and the sign-in line;
  - the Sign in page (`src/pages/sign-in.astro`, no style) is `IndexLayout` with the `UnlockPanel` in its slot.
- **`StoryCard`** gains `shared`, which shows the "Shared with you" tag (a `Tag`).
- **The footer** gains its Sign in link.
- **Pure logic** in `src/site/access/` (crypto, keyrings, codes, scope, expiry), shared by the sealer and the browser and unit-tested.
- **Scripts** in `src/site/scripts/`: `sealed.ts` (unlock, regions, the media resolver) and `telemetry.ts`, both set up with `each()` and its signal.
- **The words** of the panel and messages are interface strings in code. The wording of the share message and the Privacy page is content.

## 12. Limits and risks

| # | Risk | Likelihood | Mitigation |
|---|---|---|---|
| R1 | Plaintext committed to the public repository by mistake | Low | `private-pages/` is a submodule, whose files git won't add to the parent; edit mode writes protected content only there; a unit test checks the submodule entry and that no file under it is tracked publicly. The leak check covers the build, not history, so never writing it is the first defence |
| R2 | Plaintext in the build log or the artifact | Medium | A quiet build; seal before upload; the leak check; a one-day artifact |
| R3 | A weak or shared code | Medium | Generated codes only; PBKDF2 at 600,000; one code per audience; telemetry shows sharing |
| R4 | Content left readable after expiry | Certain, by nature | Fresh keys every deploy; the nightly deploy; stated plainly here |
| R5 | A sealed page leaks through another page (a related link, a card, the home page, a redirect) | Medium | V25, V32; the leak check's link rule |
| R6 | Telemetry carries protected text or a secret | Medium | PostHog's automatic capture off on protected pages; an allowlist of events and properties; fragments stripped everywhere; no replay; an E2E test inspects every request to PostHog |
| R7 | Ad blockers hide some visits | High | Accepted: telemetry is a guide, not a ledger. Signing in works whether PostHog loads or not |
| R8 | The nightly deploy stops (60-day rule) | Low | The nightly run fails on purpose at 50 days, and GitHub emails you |
| R9 | The deploy key leaks | Low | Read-only, one repository; rotate it from the private repository's settings |
| R10 | The private repository leaks | Low | It holds the plaintext and the grants' secrets; GitHub account security (2FA, passkeys) is the protection |
| R11 | Employer-confidential material published | Owner's call | §1: not without its owner's approval |
| R12 | A cached page meets a new deploy's keyrings, and a valid code looks wrong | Medium | Build-scoped paths, the build in every file's authenticated data, one reload, then a message that isn't "wrong code" (§5.3) |
| R13 | A script on the site reads a signed-in visitor's key or text | Low | No user input, everything escaped; stated in §1 |
| R14 | A grant learns about pages outside its scope | Medium | Protected pages never name other protected pages (V32); cards sealed per page; an E2E matrix of grants and pages |

## 13. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Protected content in a second, private repository, kept inside the project as a git submodule (`private-pages/`) and built in CI | Plaintext never enters public history; one VS Code window; deploys pinned to a private commit; pages rendered by the real components. A gitignored nested clone was considered: no pointer commits, but nothing pins a deploy, a private change needs a separate deploy call, and only an ignore rule stands between it and a public commit |
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
| D12 | Access is a page's, never a section's: open and locked work share a section, and a section lists its locked pages only to a signed-in visitor | The owner's model (A12): Work holds both kinds |
| D13 | Signing in is site-wide, for the session, from one Sign in page | One code shows every locked page it covers, wherever it is |
| D14 | A build ID in every sealed file's path and authenticated data | A cached page never meets another deploy's keyring by accident |
| D15 | The leak check is provenance first, words second | A word list can't prove a negative; a record of every private-origin file can |
| D16 | Protected pages list open pages only after them | A page's key opens only what's about that page |
| D17 | On protected pages, telemetry is an allowlist the site sends, not PostHog's capture | PostHog's own capture would send the decrypted title and links |
| D18 | A public commit's message is never written by you when anything private changed | No check of your words can promise they hold nothing private |
| D19 | Only the grant's `id` goes to PostHog | Recipient details stay on your machine; PostHog's key is public anyway |
| D20 | Seeing the site as a visitor is a real local build (`npm run preview:protected`), not a simulation in dev | The same sealing the deploy uses, and nothing new to maintain |

### Open, with defaults

| # | Question | Default |
|---|---|---|
| O1 | PostHog's region | US, with IP capture checked on in the project's settings (an EU project starts with it off) |
| O3 | Session replay on open pages | Off |
| O4 | A consent prompt as well as the notice | No prompt: notice, no cookies, GPC and DNT respected |
| O5 | Expiry suggested for new grants | 30 days |
| O6 | The sign-in line under a section that holds locked pages, when signed out | Yes: "More work is shared with invited readers. Sign in to see it." Without it, the only way in is the footer's link or a magic link |
| O7 | The private repository's name, and its folder | `atiya-private`, at `private-pages/` |
| O8 | A Sign in link in the header too | No: the footer and the sign-in line; the header keeps its one action |

O2 (which recipient details go to PostHog) is decided by D19: none.

## 14. The critique, and what changed

An independent review (5 October 2026) of the first version found these; each is fixed above.

| # | Finding | Severity | Fix |
|---|---|---|---|
| C1 | The browser couldn't derive a grant key: the salt was only in the private file | High | The keyring's clear header carries the KDF, its parameters and the salt, all authenticated (§5.3) |
| C2 | A page's key decrypted its related stories and neighbours, outside a single-page grant's scope | High | Protected pages list open pages only (§5.4, V32) |
| C3 | The leak check was a word list with blind spots (short words, picture sizes, encodings) | High | Provenance first, structure second, normalised words and bytes third; planted-leak tests (§6.3) |
| C4 | Keyrings at stable addresses meet cached pages from another deploy | High | Build-scoped paths, the build in the authenticated data, one reload (§5.3) |
| C5 | PostHog's automatic capture sends the decrypted title, link text and addresses | High | Automatic capture off on protected pages; an allowlist; `reset()` on sign-out (§9) |
| C6 | Phase A1 promised previews the single-folder code couldn't give | High | One source with two origins, wired through every reader in A1 (§3) |
| C7 | Sign-out left decrypted text, blobs and other tabs | Medium | Sign-out clears every tab, the page and the back-forward cache (§7.3) |
| C8 | Your message could reach public history with private words in it | Medium | Generated public messages whenever anything private changed (§8.3) |
| C9 | Access and the editorial `visibility` rules were tangled | Medium | The eligibility table (§10) |
| C10 | A5 launched with a grant made by hand; A8 was optional but promised; A7's dependencies were wrong | Medium | The plan's phases reordered; "Who looked" is a link to PostHog (§8.1) |
| C11 | Recipient details sent to PostHog; telemetry presented as evidence; EU projects drop IPs | Medium | Only the grant's `id` (D19); "a hint, not evidence" (§1, §9.3); the region default and the IP setting (O1, §9.5) |
| C12 | A 25 MB video had no memory budget | Medium | 10 MB, about 30 MB at its peak (§5.5) |
| C13 | Grant immutability can't be checked from one snapshot | Medium | The store enforces the transitions (§4.1, V30) |
| C14 | A sealing compound would wrap other compounds | Low | Comment markers owned by the layouts (§11) |

## 15. As built

Built 5 to 6 October 2026, phase by phase as the [plan](plan.md) sets out, and checked against the [benchmark](benchmark.md). What only the owner can do (a PostHog project, pushing `main`, the first real grant) is listed at the end.

### 15.1 What was built, by phase

| Phase | What | Where |
|---|---|---|
| A0 | The private repository `prabinpebam/atiya-private`, at `private-pages/` as a submodule on `main`; a read-only deploy key, its secret `PRIVATE_CONTENT_KEY`; `scripts/setup-private-pages.ps1` for a new clone | [setup script](https://github.com/prabinpebam/atiya/blob/main/scripts/setup-private-pages.ps1) |
| A1 | Two origins read as one: keys `/content/…` and `/private/…`, the overlay merged into the site structure, V23 to V32 and the grants checked by the loader, every reader (routes, masters, pictures, media files) origin-aware, provenance recorded for every private-origin file | `src/site/content/` (`source.ts`, `load.ts`, `routes.ts`, `schema.ts`, `provenance.ts`) |
| A2 | The crypto core (PBKDF2, HKDF, AES-256-GCM, the keyring envelope), generated codes from the EFF word list, grant states and transitions | `src/site/access/` |
| A3 | The sealer, after the build: comment markers become `<template data-sealed>`, media move to `<base>/_sealed/<build>/`, keyrings to `<base>/_access/<build>/`; and the leak check | [`integrations/seal.mjs`](https://github.com/prabinpebam/atiya/blob/main/integrations/seal.mjs), [`scripts/verify-sealed.mjs`](https://github.com/prabinpebam/atiya/blob/main/scripts/verify-sealed.mjs) |
| A4 | The Sign in page, the unlock panel, the access bar, sealed cards in their places, the runtime (sign-in, keyrings, pages, pictures, the lightbox, videos, sign-out in every tab) | `src/pages/sign-in.astro`, `src/site/scripts/sealed.ts`, `UnlockPanel`, `AccessBar` |
| A5 | The deploy workflow: the submodule through the deploy key, a quiet build, the leak check before upload, a one-day artifact, deploys from `main` only, the nightly run at 18:45 UTC with its activity guard | [`.github/workflows/deploy.yml`](https://github.com/prabinpebam/atiya/blob/main/.github/workflows/deploy.yml) |
| A6 | Edit mode's Access screen (`/_edit/access/`), the store writing both folders, Publish to both repositories | `src/site/editor/server/access.ts`, `git.ts`, `store.ts`; `AccessManager.astro` |
| A7 | Telemetry: a 1.1 KB part on every page, PostHog's chunk on idle, the sanitizer; the Privacy page (content, in Contact) and its footer link | `src/site/scripts/telemetry*.ts`; `content/articles/privacy.json` |

### 15.2 Where the build differs from the sections above

- **Page access lives on the Access screen** (§8.2). Lock, Open, Make private, a section's order among its open and locked pages, Change address and Share are on `/_edit/access/`, not in a page's Settings, the Sections screen or the articles list. There's no "New private page" button: make a page, then Make private.
- **Not built in edit mode** (§8.1): the grant list's filters and a grant's history from the private repository's log. The list shows every grant with its state.
- **Withdraw now doesn't publish by itself** (§8.3). It marks the grant withdrawn and says to publish, so it never sweeps other unpublished changes into a deploy.
- **A refused private push** (§8.3): the public commit is still made but held back, never pushed before the private commit it points at. Push again pushes the private repository, then, if you pulled and rebased it, commits the pointer to its new head ("Private pages: update"), then pushes the public one.
- **An expired or withdrawn code** (§7.2) gets no keyring, so typed, it reads "That code doesn't work"; the distinct expired message shows when a remembered session runs out, and a withdrawn magic link says it was withdrawn.
- **Telemetry's always-on part** (§9.5) is `scripts/telemetry.ts` (1.1 KB gzip): it queues the runtime's events, links followed on allowlisted pages and videos played, and fetches PostHog's chunk (`telemetryClient.ts`, with the sanitizer `telemetrySanitize.ts`, 98.5 KB gzip) on idle. PostHog's own page views are off everywhere; the site sends them, the router's page swaps too. A page that shows shared cards becomes allowlisted from then on. On `/play/`, the page's script starts it once the planet is live (the `game:live` mark); the game imports nothing of it.
- **Test builds** send only when a test sets `localStorage['site.test.telemetry'] = '1'`, to the fake host `https://telemetry.test`, unbatched and uncompressed, with PostHog's bot filter off (headless Chromium is a bot to it). Production keeps the filter.
- **`video_played`** carries `media` (the file's ID) on open pages, `place` on protected ones.
- **The Privacy page's address** comes from the site settings' `privacyPage` (like `contactPage`, checked by the loader: a node, and open); the layouts take a `footer` prop and the footer adds it after its own links.

### 15.3 Evidence

| Benchmark | Result |
|---|---|
| QB1, QB1a, QB1b | `verify:sealed` passes on the test and production builds; `tests/unit/sealed.test.ts` (22 tests) plants the leak kinds and captures the tools' output |
| QB2, QB2a, QB2b | `tests/unit/access.test.ts` (14): the RFC 7914, RFC 5869 and GCM test-case-16 vectors, the refusals, the round trips and 100,000 IVs |
| QB3 | E2E "protected content": the scope matrix (every fixture grant) |
| QB4, QB5 | `tests/unit/accessSession.test.ts` (9); E2E: a stale build reloads once, sign-out in every tab and from Back |
| QB6 | `tests/unit/telemetry.test.ts` (16); E2E "protected content: telemetry" (5): every request to the fake host decoded, no title, sentence, code, link secret, fragment or recipient; only the allowlist on protected pages and the Sign in page; GPC, DNT and `?telemetry=off` send nothing; after sign-out, events aren't the grant's |
| QB7 | `verify:prod`: sign-in runtime 6.1 KB, telemetry's always-on part 1.12 KB plus the loader's 0.26 KB (1.38 KB on an open page), PostHog's chunk 98.5 KB on idle |
| QB7a | E2E: deriving under 2 s, swapping under 200 ms, a 10 MB video under 1.5 s |
| QB7b | `verify:prod`: the game's critical JS 449.8 KB, unchanged; the gate 5.8 KB; 1,586 KB before live |
| QB8, QB9 | E2E "protected content" (axe in both themes, 320 px, 44 px targets, the failure messages); "site on a phone" |
| QB10 | `tests/unit/editorAccess.test.ts` (13); E2E `editor-access.spec.ts` (5): codes and links made, extended, rescoped and withdrawn; a page locked in its place; Publish private first with a generated public message and the pointer at the private head; a refused private push recovered after a rebase; axe on the Access screen in both themes |
| QB11 | `npm run check` 0 errors; `npm test` 1,041 passed; the site design system's tests pass |
| QB12 | This section, the plan's Definition of Done, and AGENTS.md's "Protected content" |

The editor's full E2E project passes test by test; run whole and serially, one test in a run of 40 has failed under load (a different one each time, a status text or a navigation aborted by a live reload), and passes on its own.

### 15.4 Yours

- **A PostHog project** (US region, "Discard client IP data" off), then the Actions variables `PUBLIC_POSTHOG_KEY` and `PUBLIC_POSTHOG_HOST`; for "Who looked", `POSTHOG_PROJECT_ID` in your environment for edit mode (the host defaults to US). *Done 5 October 2026: project 646382, US Cloud, both variables set; check the IP setting once in the project's settings.*
- **Pushing `main`**, which starts the deploys and the nightly run (the workflow ran green on the branch `access-ci`).
- **The first real locked page and grant,** made in edit mode and published.
- **One real phone, and Safari and Firefox, by hand** before sharing the first code (benchmark, "What isn't measured").
