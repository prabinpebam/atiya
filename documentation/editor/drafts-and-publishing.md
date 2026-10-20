# Edit mode: drafts and publishing (plan)

The plan for keeping drafts private: your first drafts and how a page took shape stay in your private repository, and only the versions you publish reach the public repository. It isn't about secrecy: a public page is public, and the history of its published versions may stay public too. It's about not putting an embarrassing first draft, or the process of writing a page, on GitHub. It builds on private pages ([access spec](../access/spec.md)) and Atiya Studio's setup ([desktop spec](../desktop/spec.md)); the history built on it is [Timeline](timeline.md).

> **TL;DR.**
> - **The requirement:** drafts and the work between publishes stay private; published versions, and their history, may be public. Not high secrecy, just no first drafts on show.
> - **Today every draft is on GitHub.** Each save goes to `content/` in the public repository, and Save to remote commits and pushes it. A draft isn't built into the site, but its words and every saved step are in the public history.
> - **Your work moves to your private repository:** every page's working copy (public or private), its media, comments, and every version as a commit, pushed in the background as its backup.
> - **Publish is the only way out.** For a page: Publish, Publish changes, Unpublish; for the site: Publish site changes (sections, menus, settings, sharing). Each is one commit in the public repository holding only what's published. Editing a published page doesn't change the site until you publish the changes. Save to remote retires.
> - **The public history then reads as published versions,** one commit per Publish, which is fine by the requirement. Drafts written before this change stay in the public history (rewriting it isn't worth it: §3); from the change on, none reaches it.

<figure class="slate-figure" data-diagram="publishing">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 520" role="img" aria-labelledby="ed-publishing__title ed-publishing__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-publishing__title">Drafts and publishing: drafts stay private, published versions go public</title>
<desc id="ed-publishing__desc">Edit mode writes every page's working copy into the private repository's main branch and keeps every version there as a commit, pushed in the background as a backup. Publish copies the pages and site changes you choose into the public repository's content folder and commits it: one commit per Publish, holding only published versions. The build reads the public repository for public pages and the private repository for private pages, and deploys the site. Drafts and the versions between publishes never reach the public repository.</desc>
<g id="ed-publishing__editor" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-1" x="40" y="40" width="200" height="140" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-1" data-slate-fit-padding="16">Edit mode</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-publishing__body-1" data-slate-fit-padding="16">on your computer</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-1" data-slate-fit-padding="16">Saves every edit</text>
<text x="60" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-1" data-slate-fit-padding="16">Keeps versions</text>
</g>
<g id="ed-publishing__private" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-2" x="300" y="40" width="300" height="170" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="320" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-2" data-slate-fit-padding="16">Private repository</text>
<text x="320" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ed-publishing__body-2" data-slate-fit-padding="16">your work: never public</text>
<text x="320" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-2" data-slate-fit-padding="16">Drafts and changes</text>
<text x="320" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-2" data-slate-fit-padding="16">Every version: the timeline</text>
<text x="320" y="188" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-2" data-slate-fit-padding="16">Private pages, comments</text>
</g>
<g id="ed-publishing__public" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-3" x="660" y="40" width="300" height="170" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-3" data-slate-fit-padding="16">Public repository</text>
<text x="680" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-publishing__body-3" data-slate-fit-padding="16">what you published</text>
<text x="680" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-3" data-slate-fit-padding="16">One commit per Publish</text>
<text x="680" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-3" data-slate-fit-padding="16">Published versions only</text>
<text x="680" y="188" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-3" data-slate-fit-padding="16">No drafts, no process</text>
</g>
<g id="ed-publishing__build" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-4" x="660" y="290" width="300" height="80" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-4" data-slate-fit-padding="16">The build</text>
<text x="680" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-publishing__body-4" data-slate-fit-padding="16">published pages from both</text>
</g>
<g id="ed-publishing__site" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-5" x="300" y="290" width="300" height="80" rx="16" fill="var(--color-brand-bg)" />
<text x="320" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-5" data-slate-fit-padding="16">Your site</text>
<text x="320" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ed-publishing__body-5" data-slate-fit-padding="16">published pages; private ones sealed</text>
</g>
<text x="248" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">writes</text>
<text x="608" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Publish</text>
<text x="820" y="256" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">push</text>
<text x="608" y="320" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">deploys</text>
<text x="460" y="256" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">private pages, with its key</text>
<text x="40" y="470" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Your first drafts and how a page took shape stay private; the public history shows only the versions you published.</text>
<g id="ed-publishing__flow-1" data-slate-svg-step="6" data-slate-svg-effect="draw">
<path d="M240 110 L290 110" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="299,110 290,115 290,105" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-publishing__flow-2" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M600 125 L650 125" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,125 650,130 650,120" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-publishing__flow-3" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M810 210 L810 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="810,289 815,280 805,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-publishing__flow-4" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M660 330 L610 330" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="601,330 610,335 610,325" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-publishing__flow-5" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M450 210 L450 240 L700 240 L700 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="700,289 705,280 695,280" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Your work and its versions stay in the private repository; Publish puts only published versions in the public repository; the build reads both, as it does today.</figcaption>
</figure>

## 1. The requirement

| | Private | Public |
|---|---|---|
| A page's first draft and every change before it's published | Yes | |
| The versions between two publishes (the timeline) | Yes | |
| Comments, and AI's proposals | Yes | |
| Private pages, their versions and sharing | Yes | |
| A published public page | | Yes |
| The history of a public page's published versions | | Yes: acceptable |

## 2. The model

### 2.1 Your work: the private repository

Every site has a private repository (today only sites with private pages do). Its `main` branch is your work:

```text
private repository (main)
  content/                 the working copy of everything public: pages, sections, menus,
                           settings, people, recommendations, themes, and their media
  articles/  media/        private pages and their media, as today
  structures/overlay.json  where private pages sit in open sections, as today
  access.json              codes and links, as today
  comments/                comments (AI editing §7.2)
```

- **Edit mode reads and writes only here.** The dev server's content reader points at this folder, so a public page's working copy is as private as a private page.
- **The build never reads its `content/`.** It reads the public repository's `content/` for public pages and the private repository's own folders for private pages, as today; a test holds that a working copy can't reach a build.
- **Versions are its commits:** the [timeline's](timeline.md) policy decides when; each commit holds one article's change.
- **It backs itself up:** pushed in the background a minute after each version (retried while offline; never in the way of editing), and pulled at start, fast-forward only. A history that has diverged (edited on two computers) is shown, never merged silently. The top bar says **Backed up**, or **Not backed up yet** and why.
- **In the owner's project** it stays the `private-pages/` submodule, marked `ignore = all` in `.gitmodules`, so its many commits never show as changes in his code repository.
- **Every site gets one:** Atiya Studio's setup creates it with the site (the private pages machine, `src/core/setup/private.mjs`, becomes part of setup); an existing site is offered it at its next update, before its first edit.

### 2.2 Publish: the only way out

- **A page** has three actions in the article editor's header: **Publish** (never published), **Publish changes** (published, and edited since) and **Unpublish**. Its status line says *Draft*, *Published* or *Published, with unpublished changes*. The live site shows the published version until you publish the changes.
- **The site** has **Publish site changes**, the screen that replaces Save to remote: everything that differs between your work and what's published (sections, menus, settings, people, recommendations, themes, and codes and links, which take effect when published), with the pages waiting to be published. It runs the content check, as the build will, and publishes what you tick.
- **What's taken** is worked out by one pure function, `publication(work, chosen)`: the chosen pages' working copies and the media they use, and the site's structure and menus with only published pages in them (a section or menu never names a page that isn't published). The result is checked with the content contract before anything is written.
- **Where it goes:**
  - **Public pages and site settings** go into the public repository's `content/`, committed and pushed: `content/` only, as Save to remote does today. One commit per Publish, its message naming what was published (*Publish "Do what makes you proud"*). A public page's title is public anyway.
  - **Private pages** go into the private repository's own folders (`articles/`, `media/`, the overlay), committed there. The public repository's pointer to the private one moves in the same Publish, as Save to remote does today, and the public message never names a private page.
- **Every Publish keeps a version first** (a timeline event).
- **Unpublish** removes the page from the public `content/` and the site; its working copy and history stay in the private repository.

## 3. Can a draft already on GitHub be removed?

Not reliably, and not worth it at this level of privacy:

- **Rewriting history** (`git-filter-repo`, then a force push) takes old versions off the branches, but GitHub's own guidance lists where they stay: "in any clones or forks of your repository", "directly via their SHA-1 hashes in cached views on GitHub" and "through any pull requests that reference them"; and "GitHub Support won't remove non-sensitive data" ([removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)).
- **The owner's repository can't be rewritten:** every managed site's build runs the engine's workflow at a pinned commit (`site-build.yml@<commit>`, [desktop spec §6](../desktop/spec.md)), and a rewrite changes every later commit's hash.

So drafts already committed stay where they are, and the plan stops new ones: from the change on, the public history holds only published versions.

## 4. What changes, by part

| Part | Change |
|---|---|
| Edit mode | Reads and writes your work in the private repository. The article editor gets Publish, Publish changes and Unpublish; Save to remote becomes Publish site changes; Discard goes (a timeline restore replaces it) |
| [Timeline](timeline.md) | Versions are commits in the private repository: private, and backed up by its push |
| The build | Unchanged: public pages from the public `content/`, private pages from the private repository. It never reads the private repository's `content/` working copy |
| Atiya Studio | Setup always creates the private repository; the background push and its status |
| Private pages | The same repository and rules; sharing takes effect when published |
| The owner's repository | The submodule ignored by `git status`; `content/` holds only published versions |

## 5. Phases

| Phase | What |
|---|---|
| 1 | The private repository for every site, with its `content/` working copy seeded from the public `content/`; edit mode reading and writing there; the background push |
| 2 | Publish, Publish changes, Unpublish and Publish site changes; Save to remote retired |

The timeline's phase 1 needs phase 1 here. The two land together in practice: until Publish exists, nothing would reach the public side.

## 6. Definition of Done

- [ ] The move seeds the private `content/` from the public one in one commit, and the site builds the same afterwards (`build-parity`).
- [ ] Editing any page writes only in the private repository: the editor E2E edits, waits for versions, and finds the public repository's `git status` clean.
- [ ] A draft never reaches the public repository: an E2E writes a draft, publishes another page, and finds none of the draft's words in any public commit (`git log -p`).
- [ ] Publish, Publish changes and Unpublish work; a published page edited since shows *Published, with unpublished changes*, and a build shows its published version.
- [ ] `publication()` is pure and unit-tested: no unpublished page in a section or menu, media only what published pages use, and the content check passes.
- [ ] A build never reads the private repository's `content/` (unit-tested in the loader).
- [ ] No private page's title in a public commit message (tested).
- [ ] The background push backs up the work; offline, the status says so and editing is unaffected; a diverged history is shown, not merged.
- [ ] In the owner's project, editing never shows `private-pages` as changed in his repository's `git status`.
- [ ] Atiya Studio's setup creates the private repository for a new site on the fake GitHub; an existing site without one is offered it before its first edit.
- [ ] `verify:prod` and `verify-sealed` pass.

**Docs:** the editor spec's §7, the access spec and the desktop spec are updated as built; this page moves from planned to done with the evidence.

## 7. Decided

| Question | Decision |
|---|---|
| What stays private | Drafts, the work between publishes, comments, AI proposals, private pages |
| What may be public | Published versions of public pages, and their history |
| Where drafts and versions live | The private repository, for public pages too |
| What reaches the public repository | Only Publish: one commit per Publish |
| Drafts already in the public history | Left as they are: rewriting is unreliable on GitHub and impossible for the owner's repository |
| Save to remote | Retired: the background backup and Publish replace it |
