# Edit mode: Timeline (plan)

The plan for an article's history in edit mode. Versions are kept automatically at moments that mean something, a timeline lets you scrub through them, and you can restore a whole version or copy blocks out of one. It's built on three principles: right-sized for a personal site's articles, private, and never mixed with anyone's code commits, so it works the same for a person who only uses Atiya Studio. Why each alternative was left out is in §4.4 and §9; what other products do is in [AI and history: research §4](ai-research.md#4-version-history).

> **TL;DR.**
> - **When:** a version when you stop for 10 minutes; in a long session, one when 20 minutes *and* a real change (about 100 words, or 2 blocks added, removed, moved or retyped) have passed; never more than an hour of editing without one; and always before an AI change, before a restore, at Save to remote and when an article is published. Never two automatic versions within 5 minutes, never one that changes nothing. A two-hour session gives about four to seven.
> - **Where:** a history store on this computer: a small git repository of its own, outside the site's folder, with one line of versions per article. Your repositories get nothing: no commits, no refs, no hidden branches. Save to remote works exactly as now. Nothing in the store is ever pushed, built or sent anywhere.
> - **What a version holds:** the article and the pictures it uses, so an old version shows its own pictures. Git stores each picture once, however many versions use it.
> - **How you see it:** a History button opens the timeline: the canvas shows the article as it was, with what changed since the version before marked; a rail under it scrubs through versions; the inspector's History tab lists them by day.
> - **What you can do:** Restore this version (a new version, nothing lost), Copy blocks into today's article, Name this version. Compare with now and bringing back one block in place come later, with AI editing's review.
> - **Left out on purpose:** backups, thinning, comparing two arbitrary versions, one block's own history, and importing the old git history. Each can be added later if it's missed.

<figure class="slate-figure" data-diagram="timeline-storage">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 600" role="img" aria-labelledby="ed-tl-storage__title ed-tl-storage__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-tl-storage__title">Timeline: versions kept in a history store of their own</title>
<desc id="ed-tl-storage__desc">Edit mode saves every edit to disk, as now. A checkpoint policy decides when a save becomes a version: after a quiet spell, when enough has changed in a long session, at least hourly while editing, and always at events such as an AI change, a restore or Save to remote. Each version goes into a history store on this computer: a git repository of its own, outside the site's folder, with one line of versions per article. The timeline reads only that store. Save to remote still commits and pushes your repositories exactly as now, so they hold only your own commits and nothing of the history store is ever pushed.</desc>
<g id="ed-tl-storage__saves" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-1" x="40" y="40" width="220" height="170" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-1" data-slate-fit-padding="16">Edit mode saves</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-storage__body-1" data-slate-fit-padding="16">every edit, to disk</text>
<text x="60" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-1" data-slate-fit-padding="16">content/</text>
<text x="60" y="168" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-1" data-slate-fit-padding="16">private-pages/</text>
</g>
<g id="ed-tl-storage__policy" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-2" x="340" y="40" width="240" height="170" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="360" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">Checkpoint policy</text>
<text x="360" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">quiet, size, events</text>
<text x="360" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">Skips no-op changes</text>
<text x="360" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">One per 5 minutes at most</text>
<text x="360" y="188" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">Always before AI, restore</text>
</g>
<g id="ed-tl-storage__store" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-3" x="660" y="40" width="300" height="170" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-3" data-slate-fit-padding="16">History store</text>
<text x="680" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-storage__body-3" data-slate-fit-padding="16">on this computer only</text>
<text x="680" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-3" data-slate-fit-padding="16">A git repository of its own</text>
<text x="680" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-3" data-slate-fit-padding="16">One line per article</text>
<text x="680" y="188" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-3" data-slate-fit-padding="16">Outside the site's folder</text>
</g>
<g id="ed-tl-storage__timeline" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-4" x="660" y="300" width="300" height="80" rx="16" fill="var(--color-brand-bg)" />
<text x="680" y="332" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-4" data-slate-fit-padding="16">Timeline</text>
<text x="680" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ed-tl-storage__body-4" data-slate-fit-padding="16">an article's versions, by its ID</text>
</g>
<g id="ed-tl-storage__remote" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-5" x="40" y="300" width="220" height="80" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="332" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-5" data-slate-fit-padding="16">Save to remote</text>
<text x="60" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-storage__body-5" data-slate-fit-padding="16">when you choose, as now</text>
<rect id="ed-tl-storage__body-6" x="40" y="450" width="220" height="80" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="482" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-6" data-slate-fit-padding="16">Your repositories</text>
<text x="60" y="504" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-storage__body-6" data-slate-fit-padding="16">only your own commits</text>
</g>
<text x="268" y="116" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">saves</text>
<text x="590" y="116" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">version</text>
<text x="820" y="262" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">reads</text>
<text x="160" y="262" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">your choice</text>
<text x="160" y="422" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">commit, push</text>
<text x="280" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">also keeps a version</text>
<text x="40" y="578" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Nothing is added to your repositories, and nothing in the history store is ever pushed or built into the site.</text>
<g id="ed-tl-storage__flow-1" data-slate-svg-step="6" data-slate-svg-effect="draw">
<path d="M260 125 L330 125" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="339,125 330,130 330,120" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-2" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M580 125 L650 125" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,125 650,130 650,120" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-3" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M810 210 L810 290" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="810,299 815,290 805,290" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-4" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M150 210 L150 290" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="150,299 155,290 145,290" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-5" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M150 380 L150 440" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="150,449 155,440 145,440" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-6" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M260 340 L460 340 L460 220" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="460,211 465,220 455,220" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Saves go to disk as now; the policy turns some of them into versions in the history store; the timeline reads only the store, and your repositories hold only your own commits.</figcaption>
</figure>

## 1. Principles

| Principle | What it decides |
|---|---|
| **Right-sized for a personal site** | One person, tens of articles, each a few thousand words. So: a few versions per session, not one per keystroke; keep everything rather than build thinning; a list and a rail, not three ways to browse; no sync, no backup service, no collaboration. |
| **Private** | Drafts, deleted sentences and private pages stay on this computer. The store is never pushed, never inside the site's folder (so it can't be committed by accident), never in a build, and never sent to an AI service. You can forget an article's history, or all of it. |
| **Never mixed with code** | Versions don't touch git as you use it: no commits on any branch, no refs in your repositories, nothing in `git log --all`, a graph view or `git gc`. The owner's code commits stay his; a person who only uses Atiya Studio gets a repository holding only what Save to remote made. |

## 2. Scope

| | In this plan | Later, if missed | Not planned |
|---|---|---|---|
| Keeping versions | The policy (§3), Name this version, changes made outside edit mode | | A version per save |
| Storing | The local history store (§4), forgetting history | Thinning, if the store grows past a size worth caring about | Backups, pushing history anywhere |
| Browsing | The History tab, the rail, an old version on the canvas with its changes marked | One block's history (needs block keys) | Comparing two arbitrary versions |
| Restoring | Restore this version, Copy blocks | Compare with now (a partial restore), Bring back a block in place, Make a copy as a new draft | |
| The past | Starts when phase 1 ships | Reading older versions from Save to remote commits | Importing them into the store |

## 3. When a version is kept

### 3.1 The policy

Per article, worked out by edit mode's server from what the store saves, so edits from a second tab, from Atiya Studio or from an agent count the same:

| Trigger | Rule | Number |
|---|---|---|
| **Quiet** | No save to the article for this long, and it changed since its last version | 10 minutes |
| **Long session** | Since the last version, at least this long *and* a significant change | 20 minutes |
| **Ceiling** | Never more than this much editing without a version, if anything changed | 60 minutes |
| **Significant change** | Words changed (added plus removed), or structural changes (a block added, removed, moved or retyped), or any change to the title, summary, lead picture or settings | 100 words, or 2 structural changes |
| **Events** | Before an AI change is applied and after it; before a restore; at Save to remote; when the status changes (publishing); when its access, section or slug changes; when you name a version. Only if the article changed since its last version | Always |
| **Floor** | No two automatic versions closer than this; events aren't held back by it | 5 minutes |
| **Nothing for nothing** | No version when nothing meaningful changed: whitespace only, or only `updatedAt` | Always |

Why these numbers: a quiet spell is when a thought is finished (Notion ends a version at a pause); the ceiling keeps a long session from becoming one version (Figma checkpoints every 30 minutes, macOS hourly); the size rule keeps busy rewriting from waiting for the ceiling (macOS saves "more often with many changes"); events are the moments you'll come looking for (macOS keeps one at open, rename and revert); and the floor is Obsidian's 5 minutes, so heavy editing can't flood the list. What they give, by the rules (to be measured in use): a typo fix makes one version ten minutes later; a steady two-hour session makes four to seven; an AI rewrite makes two, either side of it.

The numbers live in one place, as settings with these defaults, and are unit-tested; they can be tuned after a few weeks without touching the rules.

### 3.2 Measuring a change

A pure function, `significance(before, after)`, compares two versions of an article:

- **Words:** a word-level diff of each block's text (our own small diff: an article's blocks are short, so no library is needed). Blocks are matched by their key when they have one ([AI editing §3](ai-editing.md#3-blocks-need-a-stable-name)), else by type and position.
- **Structure:** blocks added, removed, moved or retyped.
- **Settings:** the title, summary, lead picture, kind, and any field outside the blocks.

It also writes the version's message, so every version says what it was without anyone typing one: *Edited "Approach": +84 −12 words; added a table*. An event adds its name: *Saved to remote*, *Published*, *Before AI: shorten the intro*, *Restored from Tuesday 14:32*. A named version shows your name for it.

### 3.3 Changes made outside edit mode

A `git pull`, a branch switch, a text editor or a sync tool can change an article while edit mode isn't watching. They're never lost and never pinned on the wrong edit:

- **At start-up,** after the dev server is ready and in the background, each article's file is compared with its last version (by hash, so it's cheap); one that differs gets a version first, *Changed outside edit mode*.
- **While it runs,** the same check happens before each version is written: a file that differs from what edit mode last saved gets that version first.

## 4. Where versions are kept

### 4.1 The history store

A bare git repository on this computer, created on first use, used only by edit mode:

| | |
|---|---|
| **Atiya Studio** | The app's data folder, beside the per-site cache it already keeps: `<app data>/history/<site>`, where `<site>` is the same hash of the site's folder its cache uses (`ATIYA_CACHE_DIR`), but never inside the cache, which can be cleared. Studio hands the path to its dev server (`ATIYA_HISTORY_DIR`). |
| **Plain `npm run dev`** | `ATIYA_HISTORY_DIR` if set, else the user's data folder: `%LOCALAPPDATA%\Atiya\history\<site>` on Windows, `~/Library/Application Support/Atiya/history/<site>` on macOS, `~/.local/share/atiya/history/<site>` on Linux. |
| **Tests** | Their own temporary folder (the editor's fixture server sets it), never the real one. |

**Inside it,** each article has its own line of versions, `refs/articles/<article-id>`. Each version is a commit whose tree holds:

- `article.json`: the article as it was;
- `media/<media-id>/…`: every picture or video it uses (its own folder's and any it uses from the library): the master, its sidecar, and its dark mode version and poster if it has them. Generated sizes are left out, as in `content/`.

The ID never changes, so a version line follows its article through a rename, a move to another section, and a change of access (public to private and back): the store doesn't care which folder the file is in.

### 4.2 Writing a version

No working tree, no index, and not your repository: only git's plumbing, against the store, with the same `git` helper edit mode uses for Save to remote (on a managed site, the bundled git).

1. **Under the store's writer lock** (saves and Save to remote take it too), so a version never catches a half-written change.
2. **`git hash-object -w --stdin-paths`** writes the article and its media files into the store in one call; git keeps a file it already has only once.
3. **`git mktree`** builds the tree (the article, then a tree per media item).
4. **If the tree is the same as the article's last version,** stop: nothing for nothing.
5. **`git commit-tree -p <last>`** makes the commit, with the message from §3.2 and trailers: the trigger (`quiet`, `session`, `ceiling`, `before-ai`, `after-ai`, `before-restore`, `remote`, `publish`, `named`, `outside`) and the access.
6. **`git update-ref refs/articles/<id> <new> <last>`** moves the line only if nothing else moved it meanwhile ([update-ref](https://git-scm.com/docs/git-update-ref)).

It runs after the save has answered, in a queue, so saving stays as fast as it is today; a version that fails to write is logged and tried at the next trigger, and never fails a save.

Names you give versions are kept in one small file in the store (`names.json`: version to name), so naming an old version never rewrites the history.

### 4.3 Privacy and size

- **Local only:** the store has no remote; a test holds that. It's outside the site's folder, so no `git add` can pick it up, and nothing of it is in a build (it's part of edit mode, which never reaches one).
- **Private pages** are kept there as plainly as they already are in `private-pages/` on the same disk: no less private, and no more.
- **AI never sees history:** an AI request carries only today's article ([AI editing §2](ai-editing.md#2-the-edit-request-one-contract-under-every-feature)).
- **Forgetting:** Settings shows the store's size and how many articles it holds, with Forget an article's history and Clear all history (both then let git drop what nothing uses). Deleting an article asks whether to forget its history too (unticked: a deleted article can then be brought back).
- **Keep everything:** articles are text and pictures are stored once, so a personal site's history stays small; nothing is thinned. If the size ever matters, thinning comes then (§2).

### 4.4 Why not in your repository

Each of these was weighed in the proposal and fails a principle:

| Alternative | Fails |
|---|---|
| Commits on your branch | **Mixed with code, and not private:** dozens of commits a day in the owner's code history, and every draft step published on GitHub with the next push |
| Commits on your branch, squashed at Save to remote | **Mixed with code:** rewrites the branch you work on, and the versions vanish at the push |
| A hidden ref in your repository | **Mixed with code:** shows in `git log --all` and graph views, travels with `git gc` and clones, and lives in an app user's site repository |
| Plain copies of files (like VS Code's local history) | **Right-sized, but no simpler:** we'd write our own de-duplication of pictures, which git already does |

## 5. Browsing

<figure class="slate-figure" data-diagram="timeline-ux">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 470" role="img" aria-labelledby="ed-tl-ux__title ed-tl-ux__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-tl-ux__title">Timeline: the proposed view</title>
<desc id="ed-tl-ux__desc">Opening the timeline turns the article editor's canvas read-only: it shows the article as it was at the chosen version, with what changed since the previous one marked. Under it, a rail holds a tick for every version, with marks for named, published and AI versions; dragging it, or the arrow keys, steps through them. On the right, the inspector's History tab lists the versions by day with their messages, and the chosen one offers Restore this version, Copy blocks and Name this version.</desc>
<g id="ed-tl-ux__canvas" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-ux__body-1" x="40" y="40" width="600" height="290" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-ux__body-1" data-slate-fit-padding="16">The article, as it was</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-ux__body-1" data-slate-fit-padding="16">read only; what changed since the previous version is marked</text>
<rect id="ed-tl-ux__body-2" x="60" y="120" width="560" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="76" y="148" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-2" data-slate-fit-padding="16">Heading and paragraphs, drawn as the page draws them</text>
<rect id="ed-tl-ux__body-3" x="60" y="180" width="560" height="60" rx="10" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="76" y="206" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-3" data-slate-fit-padding="16">A changed paragraph: removed words struck,</text>
<text x="76" y="228" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-3" data-slate-fit-padding="16">new ones marked</text>
<rect id="ed-tl-ux__body-4" x="60" y="256" width="560" height="54" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="76" y="288" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-4" data-slate-fit-padding="16">A figure, from that version's picture</text>
</g>
<g id="ed-tl-ux__rail" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-ux__body-5" x="40" y="350" width="600" height="80" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="378" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-ux__body-5" data-slate-fit-padding="16">Rail</text>
<text x="60" y="400" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-ux__body-5" data-slate-fit-padding="16">drag, or arrow keys: one version a step; Page Up, a day</text>
<rect id="ed-tl-ux__body-6" x="430" y="364" width="8" height="30" rx="3" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="ed-tl-ux__body-7" x="470" y="364" width="8" height="30" rx="3" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="ed-tl-ux__body-8" x="520" y="360" width="12" height="38" rx="3" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<rect id="ed-tl-ux__body-9" x="560" y="364" width="8" height="30" rx="3" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="ed-tl-ux__body-10" x="600" y="360" width="12" height="38" rx="3" fill="var(--color-brand-bg)" />
</g>
<g id="ed-tl-ux__history" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-ux__body-11" x="680" y="40" width="280" height="390" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="700" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">History</text>
<text x="700" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">the inspector's tab, by day</text>
<text x="700" y="134" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">Today</text>
<text x="700" y="162" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">14:32 Edited Approach</text>
<text x="700" y="190" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">11:05 Before AI rewrite</text>
<text x="700" y="230" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">Yesterday</text>
<text x="700" y="258" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">18:40 Saved to remote</text>
<text x="700" y="286" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">09:12 Named: first draft</text>
<text x="700" y="336" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">Restore this version</text>
<text x="700" y="362" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">Copy blocks</text>
<text x="700" y="388" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">Name this version</text>
</g>
<text x="40" y="458" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">The rail and the list are the same versions: choosing in one moves the other.</text>
</svg>
<figcaption>The Timeline view: the article as it was, a rail of versions under it, and the History tab listing them by day.</figcaption>
</figure>

- **Opening it:** a History button in the article editor's header (in Atiya Studio it appears in the app's title bar by itself, like every header tool), and Ctrl+Shift+H, checked against the browser and Studio before it's kept. The editor switches to the timeline: the canvas becomes read-only, the rail appears under it, and the inspector shows History. Esc or the button again returns to editing exactly where you were.
- **The canvas** draws the article as it was, through the same page it draws today: for that request, edit mode's content reader takes the article from the store instead of the disk, and a picture no longer on disk is served from the store. What changed since the version before is marked: removed words struck, new ones highlighted, added and removed blocks outlined, and the same changes listed as text above the article, so nothing depends on colour.
- **An older format:** a version the content contract no longer accepts (a block type renamed since, say) is shown as its text and blocks, marked *older format*, rather than refused.
- **The History tab** lists versions newest first, grouped by day, each with its time, message and kind (named, published, AI); a filter shows only named and published ones.
- **The rail** has a tick per version, marks for named, published and AI ones, and day markers when ticks get dense. Dragging it moves the canvas; the article's text appears at once from the version's JSON and the drawn canvas replaces it when ready (the old view stays until then); neighbouring versions are fetched ahead.
- **The list and the rail** are the same versions: choosing in one moves the other.

### 5.1 Keyboard, screen readers and motion

WordPress's review of its own revisions slider found a missing `aria-valuetext`, colour-only changes and uneven announcements ([Gutenberg #77530](https://github.com/WordPress/gutenberg/issues/77530)); the rail is built against those from the start, on the [WAI-ARIA slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/).

- **The rail is a slider:** arrow keys step one version, Page Up and Page Down a day, Home and End the first and last; its value is read out as the version ("Tuesday 14:32, Edited Approach, 84 words added").
- **The list is a list box,** in step with the rail.
- **Announcements:** moving to a version announces its message; a restore announces what it did.
- **Reduced motion:** versions switch without a transition.

## 6. Restoring and copying

- **Restore this version:** keeps a version of now (*Before restoring*), writes the old article through the store (so the content check and conflict detection apply, and a picture deleted since comes back from the store), and keeps a version, *Restored from Tuesday 14:32*. Later versions stay.
- **Copy blocks:** select blocks in an old version and choose Copy to the article; they're inserted after the block selected in today's article (or at the end), with their pictures brought back if they were deleted. One step in undo.
- **Name this version:** on any version, or on now (which keeps a version if anything changed).

## 7. Phases

| Phase | What | Useful because |
|---|---|---|
| 1 | The store, the policy, outside changes, Name this version, Forget and Clear in Settings | History starts building up before there's a screen, so the timeline has a past when it arrives |
| 2 | The History tab, an old version on the canvas with its changes marked, Restore this version, Copy blocks | Everything needed to get something back |
| 3 | The rail: scrubbing, keyboard, dense ticks | The "scrub through time" you asked for |
| 4 | With AI editing: the before and after AI events, Compare with now (a partial restore through its review), Bring back a block in place (block keys) | Shares AI editing's review and keys instead of building them twice |

## 8. Definition of Done

**Phase 1: keeping versions**

- [ ] `significance` and the policy are pure functions with unit tests for every row of §3.1, including the floor, events past the floor, nothing for nothing and the ceiling, on a fake clock.
- [ ] The store writer, against a temporary site repository: a version is written and read back; the same content twice writes one version; and the site repository's `HEAD`, index, branches, refs (`git for-each-ref`), status and files are byte-for-byte unchanged after many versions.
- [ ] The store has no remote, and its path is never inside the site's folder (both tested).
- [ ] A private article's versions are written and read like a public one's, and follow it through a change of access.
- [ ] Changes made outside edit mode are kept as their own version at start-up and before the next version (tested with a file changed behind the server's back).
- [ ] Saving is no slower: `perf:bench`'s `editor/interaction/save-round-trip` and `type-to-saved` stay within their budgets (300 and 1,200 ms).
- [ ] Atiya Studio sets `ATIYA_HISTORY_DIR` under its data folder, outside the cache; its E2E edits an article on the fake GitHub and finds versions in the store and no new commits or refs in the site's repository.
- [ ] Forget an article's history and Clear all history remove it from the store (tested).
- [ ] `verify:prod` passes: nothing of the history reaches a build.

**Phase 2: getting something back**

- [ ] The History tab lists an article's versions with their messages, grouped by day, filterable.
- [ ] An old version draws on the canvas with its own pictures, including one deleted from disk since, and its changes marked in text as well as colour.
- [ ] Restore this version and Copy blocks work through the store, keep their versions, and survive a conflict (tested in the editor E2E group "editor: timeline", on the fixture server).
- [ ] axe passes on the timeline view in light and dark.

**Phase 3: the rail**

- [ ] The rail meets the slider pattern: keys, `aria-valuetext`, announcements (E2E).
- [ ] Scrubbing never blanks the canvas: the old view stays until the new one is drawn (the "no silent wait" rules).
- [ ] Screenshots of the timeline view in the `visual` project, light and dark.

**Phase 4** is done with AI editing's own Definition of Done.

**Docs:** the editor spec gains a Timeline section as built; this page's status moves from planned to done with the evidence.

## 9. Decided

| Question | Decision | Why |
|---|---|---|
| When | The policy in §3.1, with those numbers | Few versions, each meaningful; tunable later |
| Where | A local history store of its own (§4) | All three principles; the proposal's hidden ref in your repository failed "never mixed with code" |
| Backup | None | Private; Save to remote already keeps what you publish |
| How long | Everything, with Forget and Clear | Small at this scale; simpler than thinning |
| The view | The list and the rail together | What you asked for, without a third mode |
| Compare | Each version against the one before; Compare with now in phase 4 | Covers "what changed" and "what's different from now" without two-handle comparing |
| The old git history | Not imported | Not needed to start; reading it is a later option |
