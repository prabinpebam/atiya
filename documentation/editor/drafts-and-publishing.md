# Edit mode: drafts and publishing (plan)

The plan for keeping everything you haven't published in your private repository: drafts, changes to published pages, and the timeline's versions. Only Publish reaches the public side, and the public repository records only that a publish happened. It also answers whether an old version can be removed from a public repository (not reliably), and so plans to move the published pages themselves out of it. It builds on private pages ([access spec](../access/spec.md)) and Atiya Studio's setup ([desktop spec](../desktop/spec.md)); the history built on it is [Timeline](timeline.md).

> **TL;DR.**
> - **Today every draft is on GitHub.** Each save goes to `content/` in the public repository, and Save to remote commits and pushes it. A draft isn't built into the site (only Published and Stale pages are), but its words, and every version of them, are in the public repository's history.
> - **Your work moves to your private repository:** every page's working copy (public or private), its media, the site's settings, comments, and every version as a commit. It's pushed in the background, so it's backed up, and nothing in it is public. Save to remote retires.
> - **Publish is the only way out.** For a page: Publish, Publish changes, Unpublish. For the site: Publish site changes (sections, menus, settings, sharing). Editing a published page no longer changes the site until you publish the changes.
> - **An old version can't be scrubbed from a public repository.** GitHub keeps rewritten-away commits reachable by their hash, forks and clones keep them, and GitHub Support won't purge data that isn't sensitive. Rewriting the owner's repository would also break every site's engine pin.
> - **So the publication lives privately too** (phase 2): a `published` branch in the private repository, which the build already reads with its key. The public repository holds no article at all; each Publish is one commit there moving its pointer to the private repository, with a message that names no page.
> - **The past:** an app user's site can start its public repository afresh once it holds no content. The owner's existing content history stays public: his repository can't be rewritten.

<figure class="slate-figure" data-diagram="publishing">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 560" role="img" aria-labelledby="ed-publishing__title ed-publishing__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-publishing__title">Drafts and publishing: your work is private, only Publish reaches the public side</title>
<desc id="ed-publishing__desc">Edit mode writes every page's working copy into the private repository's main branch, and keeps every version there as a commit. Publish copies the pages and site changes you choose into the publication, a published branch in the same private repository. The public repository records only that a publish happened: one commit moving its pointer to the private publication. The build, run by that commit, reads the publication with its read-only key and deploys the site: published pages in the clear, private pages sealed. Drafts, versions and unpublished changes never leave the private repository.</desc>
<g id="ed-publishing__editor" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-1" x="40" y="40" width="200" height="140" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-1" data-slate-fit-padding="16">Edit mode</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-publishing__body-1" data-slate-fit-padding="16">on your computer</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-1" data-slate-fit-padding="16">Saves every edit</text>
<text x="60" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-1" data-slate-fit-padding="16">Keeps versions</text>
</g>
<g id="ed-publishing__private" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-2" x="300" y="40" width="340" height="390" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="320" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-2" data-slate-fit-padding="16">Private repository</text>
<text x="320" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ed-publishing__body-2" data-slate-fit-padding="16">your work: never public</text>
<rect id="ed-publishing__body-3" x="320" y="120" width="300" height="120" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="340" y="152" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ed-publishing__body-3" data-slate-fit-padding="16">main: your work</text>
<text x="340" y="184" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-3" data-slate-fit-padding="16">Drafts, changes, private pages</text>
<text x="340" y="212" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-3" data-slate-fit-padding="16">Every version: the timeline</text>
<rect id="ed-publishing__body-4" x="320" y="290" width="300" height="120" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="340" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ed-publishing__body-4" data-slate-fit-padding="16">published: the publication</text>
<text x="340" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-4" data-slate-fit-padding="16">Only what you published</text>
<text x="340" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-4" data-slate-fit-padding="16">Public and private pages</text>
</g>
<g id="ed-publishing__public" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-5" x="700" y="40" width="260" height="140" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="720" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-5" data-slate-fit-padding="16">Public repository</text>
<text x="720" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-publishing__body-5" data-slate-fit-padding="16">code, or just settings</text>
<text x="720" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-5" data-slate-fit-padding="16">One commit per Publish:</text>
<text x="720" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-publishing__body-5" data-slate-fit-padding="16">the pointer moves</text>
</g>
<g id="ed-publishing__build" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-6" x="700" y="250" width="260" height="80" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="720" y="282" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-6" data-slate-fit-padding="16">The build</text>
<text x="720" y="304" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-publishing__body-6" data-slate-fit-padding="16">with its read-only key</text>
</g>
<g id="ed-publishing__site" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ed-publishing__body-7" x="700" y="380" width="260" height="80" rx="16" fill="var(--color-brand-bg)" />
<text x="720" y="412" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ed-publishing__body-7" data-slate-fit-padding="16">Your site</text>
<text x="720" y="434" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ed-publishing__body-7" data-slate-fit-padding="16">published pages; private ones sealed</text>
</g>
<text x="248" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">writes</text>
<text x="480" y="270" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="12" data-slate-fit-target="ed-publishing__body-2" data-slate-fit-padding="16">Publish</text>
<text x="666" y="230" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">records</text>
<text x="840" y="222" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">push</text>
<text x="840" y="360" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">deploys</text>
<text x="648" y="400" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">reads</text>
<text x="40" y="520" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Drafts, versions and unpublished changes never leave the private repository; the public one records only that a Publish happened.</text>
<g id="ed-publishing__flow-1" data-slate-svg-step="6" data-slate-svg-effect="draw">
<path d="M240 150 L310 150" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="319,150 310,155 310,145" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-publishing__flow-2" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M470 240 L470 280" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="470,289 475,280 465,280" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-publishing__flow-3" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M620 320 L660 320 L660 110 L690 110" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="699,110 690,115 690,105" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-publishing__flow-4" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M830 180 L830 240" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="830,249 835,240 825,240" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-publishing__flow-5" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M830 330 L830 370" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="830,379 835,370 825,370" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-publishing__flow-6" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M620 380 L682 380 L682 300 L690 300" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="699,300 690,305 690,295" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Your work, its versions and the publication are all in the private repository; the public repository records only that a Publish happened, and the build reads the publication with its key.</figcaption>
</figure>

## 1. Today

| What | Where | Who can read it |
|---|---|---|
| A public page, draft or published, and every version committed | `content/`, public repository | Anyone, on GitHub, for good |
| A private page and its versions | `private-pages/`, private repository | You |
| The live site | Built from both: published public pages in the clear, published private pages sealed | Anyone; private pages only with access |

Save to remote commits and pushes both repositories at once ([editor spec §7](spec.md#7-publishing)), so a public page's draft is on GitHub from the first save to remote after it's written.

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

- **Edit mode reads and writes only here.** The dev server's content reader points at this folder; a public page's working copy and a private page's are equally private.
- **Versions are its commits:** the [timeline's](timeline.md) policy decides when; each commit holds one article's change.
- **It backs itself up:** pushed in the background a minute after each version (retried while offline; never in the way of editing), and pulled at start, fast-forward only. A history that has diverged (edited on two computers) is shown, never merged silently. The top bar's status says **Backed up**, or **Not backed up yet** and why.
- **In the owner's project** it stays the `private-pages/` submodule, marked `ignore = all` in `.gitmodules`: its many commits never show as changes in his code repository, and only Publish moves the pointer.
- **Every site gets one:** Atiya Studio's setup creates it with the site (the private pages machine, `src/core/setup/private.mjs`, becomes part of setup); an existing site is offered it at its next update, before its first edit.

### 2.2 Publish: the only way out

- **A page** has three actions in the article editor's header: **Publish** (a page never published), **Publish changes** (a published page you've edited since) and **Unpublish**. Its status line says *Draft*, *Published* or *Published, with unpublished changes*. The live site shows the published version until you publish the changes.
- **The site** has **Publish site changes**, the screen that replaces Save to remote: everything that differs between your work and the publication (sections, menus, settings, people, recommendations, themes, and codes and links, which take effect when published), with the pages waiting to be published. It checks the content contract, as the build will, and publishes what you tick.
- **What's taken** is worked out by one pure function, `publication(work, chosen)`: the chosen pages' working copies and the media they use, and the site's structure and menus with only published pages in them (a section or menu never names a page that isn't published). The result is checked with the content contract before anything is written.
- **Private pages** publish the same way; sharing a private page takes effect when it's published.
- **Every Publish keeps a version first** (a timeline event).
- **The public message names no page:** *Publish: 2 pages, site settings*. A private page's title never reaches the public repository, as today.

### 2.3 Where the publication goes

| | Phase 1 | Phase 2 |
|---|---|---|
| Public pages | Written into the public repository's `content/`, committed and pushed (`content/` only, as Save to remote does today) | Written to the `published` branch of the private repository, without a checkout (the plumbing `git stash` uses) |
| Private pages | As today: the build reads the private repository at the commit the public one points to | The same `published` branch |
| The public repository | Receives published pages, never a draft | Receives one commit per Publish moving its pointer to the private `published` commit; holds no `content/` |
| The build | As today | Checks out the pointed-to commit with its read-only key (as it already does for private pages) and builds from it |
| Who can read an old published version | Anyone, in the public repository's history | Nobody but you |

## 3. Can an old version be removed from a public repository?

Not reliably, for any repository; and for the owner's, not at all.

- **Rewriting history** (with `git-filter-repo`, then a force push) takes a file's old versions off the branches, but GitHub's own guidance lists where they stay: "in any clones or forks of your repository", "directly via their SHA-1 hashes in cached views on GitHub" and "through any pull requests that reference them". Only GitHub Support can purge those, and "GitHub Support won't remove non-sensitive data": an old article isn't sensitive data in their sense ([removing sensitive data](https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/removing-sensitive-data-from-a-repository)).
- **A rewrite changes the hash of every later commit.** In the owner's repository that breaks every managed site's build, which runs the engine's workflow at a pinned commit (`site-build.yml@<commit>`, [desktop spec §6](../desktop/spec.md)), along with the engine releases and the parity checks.
- **Deleting the repository** removes it and its history from GitHub, but "deleting a public repository will not delete any forks of the repository" ([deleting a repository](https://docs.github.com/en/repositories/creating-and-managing-repositories/deleting-a-repository)), and clones keep theirs.
- **The site itself was public:** a page that was live may have been copied by search engines and archives, whatever the repository does.

So the only way to keep a version unreadable is never to commit it publicly: drafts from phase 1, published versions from phase 2.

## 4. The past

- **The owner's site:** the public repository's content history (`content/` has 74 commits since September 2026) stays public. From phase 1 no draft reaches it; from phase 2 no page does.
- **An app user's site:** after phase 2 its public repository holds only `atiya.json`, the workflow, `AGENTS.md` and the publish pointer, so Atiya Studio can offer **Start the public repository afresh**: it deletes and recreates it through setup's machine (the settings, the workflow, GitHub Pages and the build's key), leaving no old version on GitHub except in forks someone made. It's explicit, confirmed, and never automatic. Their private repository is untouched.

## 5. What changes, by part

| Part | Change |
|---|---|
| Edit mode | Reads and writes your work in the private repository. The article editor gets Publish, Publish changes and Unpublish; Save to remote becomes Publish site changes; Discard goes (a timeline restore replaces it) |
| [Timeline](timeline.md) | Versions are commits in the private repository: private, and backed up by its push |
| The build | Phase 2: reads the publication from the private repository, in both builds (from source, and from an engine release); `build-parity` holds them equal |
| Atiya Studio | Setup always creates the private repository; the background push and its status; Start the public repository afresh (phase 3) |
| Private pages | The same repository and rules; sharing takes effect when published |
| The owner's repository | The submodule ignored by `git status`. Phase 1: `content/` is the public publication. Phase 2: `content/` leaves it, and tests that read the real content read the private repository |
| The starter | Phase 2: a new site's public repository has no `content/`; the starter's sample pages go into its private repository |

## 6. Phases

| Phase | What | What it stops |
|---|---|---|
| 1 | Your work in the private repository: a one-off move of `content/` into it, edit mode reading and writing there, versions as commits with the background push, Publish for pages and the site, Save to remote retired | Drafts and unpublished changes reaching the public repository |
| 2 | The publication in the private repository: the `published` branch, the pointer commit, both builds reading it; `content/` leaves the public repository | Published versions accumulating in the public repository |
| 3 | Start the public repository afresh, for app users | An app user's old content history on GitHub (forks aside) |

The timeline's phase 1 needs this plan's phase 1.

## 7. Definition of Done

**Phase 1**

- [ ] The move is one commit in the private repository, and the site builds the same afterwards (`build-parity`).
- [ ] Editing any page, public or private, writes only in the private repository: the editor E2E edits, waits for versions, and finds the public repository's `git status` clean.
- [ ] A draft never reaches the public repository: an E2E writes a draft, publishes another page, and finds none of the draft's words in any public commit (`git log -p`).
- [ ] Publish, Publish changes and Unpublish work; a published page edited since shows *Published, with unpublished changes*, and a build shows its published version.
- [ ] `publication()` is pure and unit-tested: no unpublished page in a section or menu, media only what published pages use, and the content check passes.
- [ ] No page title in a public commit message (tested, with a private page's title).
- [ ] The background push backs up the work; offline, the status says so and editing is unaffected; a diverged history is shown, not merged.
- [ ] In the owner's project, editing never shows `private-pages` as changed in his repository's `git status`.
- [ ] Atiya Studio's setup creates the private repository for a new site on the fake GitHub; an existing site without one is offered it before its first edit.

**Phase 2**

- [ ] Both builds read the publication, and `build-parity` passes for the owner's site and the starter.
- [ ] The public repository holds no `content/`; a site made by Studio has none.
- [ ] `verify-sealed` and the leak check pass; the publish commit and its pointer reveal no title.
- [ ] A Publish deploys the site (Studio's E2E on the fake GitHub).

**Phase 3**

- [ ] Start the public repository afresh, on the fake GitHub: the new repository has one commit, the site deploys, and the private repository is untouched.

**Docs:** the editor spec's §7, the access spec and the desktop spec are updated as built; this page moves from planned to done with the evidence.

## 8. Decided, and for you

| Question | Decision |
|---|---|
| Where drafts live | The private repository, for public pages too (your call) |
| What reaches the public side | Only Publish (your call) |
| Where history lives | The private repository, as its commits (your call) |
| Scrubbing old versions | Not by rewriting: unreliable on GitHub, and impossible for the owner's repository |

For you:

1. **Phase 2:** move the publication into the private repository, so the public repository holds no article? Recommended: it's the only way old published versions stop being readable.
2. **Save to remote retires,** replaced by the background backup and Publish?
3. **Start afresh:** offer it to app users after phase 2?
