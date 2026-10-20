# Edit mode: Timeline (proposal)

A proposal for an article's history in edit mode: versions kept automatically when they mean something, a timeline to scrub through them, and ways to restore a whole version or bring back one part of it. It covers when a version is kept, where it's kept (git, without changing how Save to remote works), and how you browse it, with options, pros and cons and a recommendation for each, for the owner to review; nothing here is built yet. What other products do is in [AI and history: research §4](ai-research.md#4-version-history); AI's use of versions is in [AI editing and comments](ai-editing.md).

> **TL;DR.**
> - **Today's history is too coarse to browse.** Every edit saves to disk at once, but a commit happens only on Save to remote, so one article had 4 commits in three weeks; undo lasts only as long as the tab.
> - **Keep versions on sessions and size, not on a clock.** A version when you stop for 10 minutes; in a long session, one when at least 20 minutes and a real change (about 100 words, or two blocks added, removed, moved or retyped) have passed; never more than an hour of work without one; and always before an AI change, a restore, Save to remote or publishing. Never two automatic versions within 5 minutes, and never one that changes nothing. A two-hour session makes about four to seven.
> - **Keep them beside your branch, not on it.** Each version is a git commit on a ref of its own (`refs/atiya/timeline`), in the public and the private repository separately, written through a temporary index: your branch, staging area and files never move, Discard still means "since Save to remote", and nothing is pushed unless you choose a backup. Your Save to remote commits stay exactly as they are, and show in the timeline too.
> - **Browse with a list and a rail together.** The inspector's History tab lists versions by day; a rail under the canvas has a tick for each, to drag or step with the arrow keys; the canvas shows the article as it was, with what changed marked. Compare puts two handles on the rail.
> - **Restoring never loses anything.** A restore is a new version (with one kept just before); one block can be brought back or copied; Compare with now is a partial restore, change by change, through the same review AI uses.

<figure class="slate-figure" data-diagram="timeline-storage">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 580" role="img" aria-labelledby="ed-tl-storage__title ed-tl-storage__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-tl-storage__title">Timeline: versions kept beside your branch, not on it</title>
<desc id="ed-tl-storage__desc">Edit mode saves every edit to disk, as now. A checkpoint policy decides when a save becomes a version: after a quiet spell, when enough has changed in a long session, or at an event such as an AI change or a restore. It skips changes that change nothing and keeps at most one automatic version per five minutes. Each version is a commit on a timeline ref of its own, one in the public repository and one in the private one, written without touching your branch, your staging area or your files. Save to remote still commits and pushes your branch, as now. The timeline shows an article's versions from both refs and from the branch, found by the article's ID.</desc>
<g id="ed-tl-storage__saves" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-1" x="40" y="40" width="220" height="190" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-1" data-slate-fit-padding="16">Edit mode saves</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-storage__body-1" data-slate-fit-padding="16">every edit, to disk</text>
<text x="60" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-1" data-slate-fit-padding="16">content/</text>
<text x="60" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-1" data-slate-fit-padding="16">private-pages/</text>
</g>
<g id="ed-tl-storage__policy" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-2" x="340" y="40" width="240" height="190" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="360" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">Checkpoint policy</text>
<text x="360" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">quiet, size, events</text>
<text x="360" y="132" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">Skips no-op changes</text>
<text x="360" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">One per 5 minutes at most</text>
<text x="360" y="188" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ed-tl-storage__body-2" data-slate-fit-padding="16">Always before AI, restore</text>
</g>
<g id="ed-tl-storage__refs" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-3" x="660" y="40" width="300" height="80" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="70" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-3" data-slate-fit-padding="16">Public repository</text>
<text x="680" y="94" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-storage__body-3" data-slate-fit-padding="16">refs/atiya/timeline</text>
<rect id="ed-tl-storage__body-4" x="660" y="150" width="300" height="80" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="180" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-4" data-slate-fit-padding="16">Private repository</text>
<text x="680" y="204" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-storage__body-4" data-slate-fit-padding="16">refs/atiya/timeline</text>
</g>
<g id="ed-tl-storage__remote" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-5" x="40" y="320" width="220" height="90" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="352" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-5" data-slate-fit-padding="16">Save to remote</text>
<text x="60" y="374" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-storage__body-5" data-slate-fit-padding="16">as now, when you choose</text>
<rect id="ed-tl-storage__body-6" x="660" y="320" width="300" height="90" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="680" y="352" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-6" data-slate-fit-padding="16">Your branch</text>
<text x="680" y="374" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-storage__body-6" data-slate-fit-padding="16">commits, pushed: also versions</text>
</g>
<g id="ed-tl-storage__timeline" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ed-tl-storage__body-7" x="340" y="460" width="620" height="70" rx="16" fill="var(--color-brand-bg)" />
<text x="360" y="490" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ed-tl-storage__body-7" data-slate-fit-padding="16">Timeline</text>
<text x="360" y="512" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ed-tl-storage__body-7" data-slate-fit-padding="16">an article's versions from the refs and the branch, by its ID</text>
</g>
<text x="268" y="126" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">saves</text>
<text x="592" y="70" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">version</text>
<text x="592" y="180" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">version</text>
<text x="160" y="276" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">your choice</text>
<text x="400" y="356" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">commit, push</text>
<text x="40" y="566" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">The timeline refs never move your branch, your staging area or your files, and are never pushed unless you choose a backup.</text>
<g id="ed-tl-storage__flow-1" data-slate-svg-step="6" data-slate-svg-effect="draw">
<path d="M260 135 L330 135" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="339,135 330,140 330,130" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-2" data-slate-svg-step="7" data-slate-svg-effect="draw">
<path d="M580 80 L650 80" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,80 650,85 650,75" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-3" data-slate-svg-step="8" data-slate-svg-effect="draw">
<path d="M580 190 L650 190" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,190 650,195 650,185" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-4" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M150 230 L150 310" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="150,319 155,310 145,310" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-5" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M260 365 L650 365" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="659,365 650,370 650,360" fill="var(--color-neutral-fg-2)" />
</g>
<g id="ed-tl-storage__flow-6" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M810 410 L810 450" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="810,459 815,450 805,450" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Saves go to disk as now; the policy turns some of them into versions on a timeline ref in each repository; the timeline reads those and your branch's commits.</figcaption>
</figure>

## 1. What's asked for

| ID | As the owner, I can… |
|---|---|
| T1 | Have versions kept automatically, at moments that mean something, without a flood of them |
| T2 | Scrub through an article's versions and see it as it was |
| T3 | See what changed between two versions |
| T4 | Restore a whole version |
| T5 | Bring back or copy one part of an older version |
| T6 | Name a version myself ("Sent to Anna") |
| T7 | Get back to the article as it was before an AI change |

## 2. Today

- **Saves:** every edit is written to `content/` (or `private-pages/`) at once, through the store ([store.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/server/store.ts)).
- **Commits:** only Save to remote commits: the private repository first, then `content/` in the public one, then pushes ([git.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/server/git.ts)). You choose when, so a commit can hold a day of work or a week's. The article *The best AI model won't win. The best learning loop will.* has 4 commits in about three weeks; `content/` has 74 since September.
- **Undo:** whole-article snapshots in the tab's session storage, 50 deep, gone when the tab closes ([editor.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/scripts/editor.ts)).
- **Discard** on the Save to remote screen restores files to their last commit.

So git holds the moments you published, not the moments you'd want back.

## 3. When a version is kept

### 3.1 What others do

| Product | When it keeps a version | Source |
|---|---|---|
| VS Code's local history | Every save, but saves within 10 seconds replace the last entry (`workbench.localHistory.mergeWindow`) | [VS Code 1.66](https://code.visualstudio.com/updates/v1_66#_local-history) |
| WordPress | A revision on every save; an autosave every 60 seconds, one slot per person, overwritten | [Revisions](https://wordpress.org/documentation/article/revisions/) |
| Notion | About every 10 minutes of editing, and when a session ends after a short pause (secondary sources; Notion's help doesn't give numbers) | [super.so](https://super.so/blog/how-to-check-notion-page-history-and-restore-versions) |
| Figma | A checkpoint every 30 minutes, and on a crash or a lost connection; named versions by hand | [Figma](https://help.figma.com/hc/en-us/articles/360038006754-View-a-file-s-version-history) |
| macOS Versions | Every hour, or more often with many changes; and when a document is opened, saved, duplicated, locked, renamed or reverted | [Apple](https://support.apple.com/guide/mac-help/view-and-restore-past-versions-of-documents-mh40710/mac) |
| Google Docs | Continuously, grouped in the list (expand a group for its steps); up to 40 named versions; "Only show named versions" | [Google](https://support.google.com/docs/answer/190843) |
| Time Machine | Hourly for 24 hours, daily for a month, weekly after | [Apple](https://support.apple.com/en-us/104984) |
| Obsidian's file recovery | Snapshots at least 5 minutes apart, kept 7 days by default | [Obsidian](https://help.obsidian.md/plugins/file-recovery) |
| Word, OneDrive, SharePoint | At events (created, uploaded again, a property changed, reopened and saved) and periodically while autosaving, "not every edit"; SharePoint keeps 500 by default | [Microsoft](https://support.microsoft.com/en-us/office/how-versioning-works-in-lists-and-libraries-0f6cd105-974f-44a4-aadb-43ac5bdfd247) |
| JetBrains IDEs | Continuously, with labels at events (tests, deploys, version control); kept 5 working days | [JetBrains](https://www.jetbrains.com/help/idea/local-history.html) |
| Linear | Keeps AI agents' and automations' edits in the same history as people's | [Linear](https://linear.app/docs/documents) |
| Decap, TinaCMS, Keystatic | Nothing between commits: a commit per save or per publish; Decap's editorial workflow can squash a draft's commits into one on merge (`squash_merges`) | [Decap](https://decapcms.org/docs/editorial-workflows/), [Keystatic](https://keystatic.com/docs) |

Three ideas recur: **a quiet spell ends a session** (Notion), **a ceiling on time** (Figma, macOS), and **events always count** (macOS's open, rename, revert; JetBrains' labels). Only macOS weighs how much changed ("more often with many changes"), and no product publishes a word-count rule. None of the git-based CMSs keeps anything finer than a commit.

### 3.2 Options

| Option | Rule | Pros | Cons |
|---|---|---|---|
| A. On a clock | Every N minutes while editing | Simple; predictable | Versions mid-sentence; a busy hour and an idle one look alike; many versions that mean nothing |
| B. On quiet only | When you stop for N minutes | Each version is a finished thought | A three-hour session with no pause is one version |
| **C. Sessions, size and events** (recommended) | B, plus a version in a long session once enough time *and* enough change have passed, plus events | Versions where you'd look for them; few in quiet work, more in heavy rewriting; nothing for nothing | A few numbers to tune; needs a measure of change (§3.4) |
| D. By hand | Only "Name this version" and Save to remote | No noise at all | You forget; the moment you want back is the one you didn't name |

### 3.3 The recommended policy

Per article, worked out on the server from what the store saves (so edits from a second tab, from Atiya Studio or from an agent through MCP count the same):

| Trigger | Rule | Starting number |
|---|---|---|
| **Quiet** | No save to the article for this long, and it changed since its last version | 10 minutes |
| **Long session** | Since the last version, at least this long *and* a significant change (below) | 20 minutes |
| **Ceiling** | Never more than this much editing without a version, if anything changed | 60 minutes |
| **Significant change** | At least this many words changed (added plus removed), or this many structural changes (a block added, removed, moved or retyped), or any change to the title, summary, lead picture or settings | 100 words, 2 structural |
| **Events** (any change at all) | Before an AI change is applied, and after it ("AI: shortened the intro"); before a restore; at Save to remote; when the status changes (publishing); when the access, section or slug changes; when you name a version | Always |
| **Floor** | No two automatic versions closer than this; events aren't held back by it | 5 minutes |
| **Nothing for nothing** | No version when the article is byte-for-byte or meaningfully unchanged: whitespace only, or only `updatedAt` | Always |

What that gives (by the rules above, not measured yet): a typo fix makes one version, ten minutes later; a steady two-hour writing session makes four to seven; an AI rewrite makes two, either side of it. The numbers are settings, held in one place and unit-tested, so they can be tuned after a few weeks' use.

**Calm or fine.** The numbers above lean calm, since you asked for no flood. The research thread proposed finer ones, closer to Notion's reported cadence; both are reasonable, and the difference is how many versions you scroll past:

| Setting | Calm (recommended) | Fine |
|---|---|---|
| Quiet | 10 minutes | 2 minutes |
| Long session | 20 minutes and a significant change | 10 minutes, any change |
| Significant change | 100 words or 2 structural changes | 80 words or 1 structural change, at once |
| Floor | 5 minutes (Obsidian's) | 60 seconds (WordPress's autosave) |
| A two-hour session | about 4 to 7 versions | about 12 to 20 versions |

### 3.4 Measuring a change

A pure function, `significance(before, after)`, compares two versions of the article:

- **Words:** a word-level diff of each block's text, matched by its key ([AI editing §3](ai-editing.md#3-blocks-need-a-stable-name)); without keys, of the article's text as a whole.
- **Structure:** blocks added, removed, moved or retyped, from the sequence of keys and types.
- **Settings:** the title, summary, lead picture, kind and any field outside the blocks.

It also writes the version's message, so every version says what it was without anyone typing: *Edited "Approach": +84 −12 words; added a table*. Named versions keep your name for them, and Save to remote versions keep your commit message.

### 3.5 How long versions are kept

| Option | What | Pros | Cons |
|---|---|---|---|
| **A. Keep everything, group in the list** (recommended) | Every version stays; the list groups them by day, with a filter for named and published ones (Google Docs) | Nothing lost; git stores a version that changed a paragraph as little more than that paragraph once packed | The ref grows forever (slowly: articles are text) |
| B. Thin like Time Machine | All for a day, then hourly, daily and weekly | Bounded | Old detail lost; thinning rewrites the ref's chain |
| C. A cap per article | The last N | Simple | Loses the old moments first, which are often the ones wanted |

Named, published and before-AI versions are never thinned under any option. Pictures and videos are versioned too (so an old version shows its own pictures), and git stores each file once however many versions use it. Unlike text, a picture doesn't compress against its earlier versions: replacing a picture adds the whole new file. That's the cost of old versions showing their own pictures; the 100 MB limit per video still holds.

## 4. Where versions are kept

### 4.1 Options

| Option | How | Pros | Cons |
|---|---|---|---|
| A. Commits on your branch | Each version is an ordinary commit; Save to remote pushes them all | Plain git; GitHub shows every step | The public repository then publishes every draft step, forever, including words you deleted before publishing. Discard ("since the last commit") loses its meaning. Dozens of commits a day crowd the history the site's builds and parity check read |
| B. Commits on your branch, squashed at Save to remote | As A, folded into one commit when you push (Decap's `squash_merges` is the shipped precedent) | GitHub's history stays as it is | Rewrites your branch; the fine versions vanish at the push unless kept somewhere else, which is option C with more steps |
| **C. A timeline ref beside your branch** (recommended) | Each version is a commit on `refs/atiya/timeline`, in the public repository for `content/` and in the private one for `private-pages/`, never pushed by default | Your branch, staging area, files and Save to remote are untouched; Discard keeps its meaning; drafts stay on your computer; it's still git (inspectable, `git show`, packed) | Lost with the computer unless backed up (§4.3); a second history to read beside the branch |
| D. A store outside git | Snapshots in Atiya Studio's app data, or a database | Independent of git; easy to query | Another format to keep; doesn't work for plain `npm run dev` without the app; duplicates what git does well |

### 4.2 How a version is written (option C)

Git can make a commit without touching anything you work with: the same plumbing `git stash` uses ([GIT_INDEX_FILE](https://git-scm.com/docs/git#Documentation/git.txt-GITINDEXFILE), [commit-tree](https://git-scm.com/docs/git-commit-tree), [update-ref](https://git-scm.com/docs/git-update-ref), a [worked example](https://muxup.com/2024q4/directly-committing-files-to-a-separate-git-branch)):

1. **Under the store's writer lock** (Save to remote takes it too), so a version never catches a half-written change.
2. **A temporary index** (`GIT_INDEX_FILE` pointing at a file in `.git/`), filled from the folder: `content/` in the public repository, everything in `private-pages/` in the private one.
3. **`git write-tree`** makes the tree; if it's the same as the last version's tree, stop (nothing for nothing).
4. **`git commit-tree`** makes the commit, its parent the last version, its message the generated one, with trailers: the article it's about, the trigger, and the branch's `HEAD` at the time.
5. **`git update-ref refs/atiya/timeline <new> <old>`** moves the ref only if nobody else moved it meanwhile.

Each repository has its own ref, so the public one never names a private page (the rule [git.ts](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/server/git.ts) already keeps for Save to remote). `git push`, even `git push --all`, pushes branches only, so a ref outside `refs/heads/` stays local, and `git gc` keeps everything a ref reaches ([git push](https://git-scm.com/docs/git-push)). Objects written without a ref would be pruned by the next `gc`, so a version is never left without one.

### 4.3 Backup

Off by default; a decision for you:

- **Private repository only:** push both refs to the private remote (the public one's under its own name). Your drafts stay private, and a new computer gets its history back.
- **Each to its own remote:** simpler, but the public repository would show draft steps (under a ref GitHub's site doesn't list, but anyone who clones with that ref can read it).
- **None:** the history is on this computer, like VS Code's local history.

### 4.4 Reading an article's history

An article's file is named by its ID, which never changes, so its history is the log of `content/articles/<id>.json` (or `private-pages/articles/<id>.json`) and its media folder, on the timeline ref and on the branch, merged by time:

- **A Save to remote commit** whose article file is the same as the version before it is shown as one version, marked *Saved to remote*.
- **A page whose access changed** moved between the repositories; its history is read from both, by ID.
- **Old versions in an old format:** the content contract changes over time (a block type is added, a field renamed). A version that fails today's check is still shown (as readable text and blocks, marked *older format*); restoring it runs the same migration a current file would get, or says what it can't bring back.
- **Edits from outside** (a text editor, an agent, a `git pull`) are on disk like any save, so the next version includes them.

## 5. Browsing the timeline

### 5.1 What others do

- **A list beside the document, the document as it was:** Google Docs (versions grouped by time, expand a group, names, "Show changes", Restore this version, Make a copy), Figma (a sidebar, pan the old file, restore keeps later versions), Notion. Restoring never deletes later versions in Figma or Google Docs.
- **A slider:** WordPress's revisions screen moves through versions with a slider and marks what was added and removed; "Compare any two revisions" gives it two handles ([WordPress](https://wordpress.org/documentation/article/revisions/)). WordPress 7.0 brought the revisions into the editor itself, drawn as the page ([Gutenberg #74742](https://github.com/WordPress/gutenberg/issues/74742)).
- **A timeline in space:** macOS's Browse All Versions puts the current document beside a stack of older windows and a timeline down the side of the screen ([Apple](https://support.apple.com/guide/mac-help/view-and-restore-past-versions-of-documents-mh40710/mac)).
- **Per file, quick:** VS Code's Timeline lists a file's local history and git commits together, and compares any entry with the current file ([VS Code 1.66](https://code.visualstudio.com/updates/v1_66#_local-history)).
- **Compare, with the sameness folded away:** Confluence compares two checked versions and collapses unchanged parts ([Confluence](https://confluence.atlassian.com/doc/page-history-and-page-comparison-views-139379.html)).
- **Taking back a part:** Notion lets you copy blocks out of an old version; Contentful compares a version with now and brings back single fields; Photoshop's History Brush paints back one region. These are the precedents for bringing back one block.
- **A restore is a new version:** Figma keeps a checkpoint either side of a restore; Confluence and SharePoint make the restored content a new version.

### 5.2 Options

| Option | What you see | Pros | Cons |
|---|---|---|---|
| A. A history list | The inspector's History tab: versions by day, with their messages; choosing one shows it on the canvas, changes marked | Familiar; a list is easy for keyboards and screen readers; scales with grouping | Going through many versions is click by click; no feel for time |
| B. A scrubbing rail | A rail under the canvas, a tick per version (marks for named, published and AI); drag it and the canvas follows | Fast to find when something changed; it's the "scrub" you asked for | Must render fast while dragging; dense ticks need grouping; a slider needs care for accessibility |
| C. Compare two | Two handles on the rail (or two picks in the list); the canvas shows the difference between them | Exact: "what did the AI change", "what changed since I sent it" | Not for browsing |
| **A and B together, with C on demand** (recommended) | One Timeline view: the list and the rail are the same versions, choosing in either moves the other; Compare adds the second handle | Each way of looking where it's best; one mental model | The most to build, in phases (§8) |

<figure class="slate-figure" data-diagram="timeline-ux">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 470" role="img" aria-labelledby="ed-tl-ux__title ed-tl-ux__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ed-tl-ux__title">Timeline: the proposed view</title>
<desc id="ed-tl-ux__desc">Opening the timeline turns the article editor's canvas read-only: it shows the article as it was at the chosen version, with what changed since the previous one marked. Under it, a rail holds a tick for every version, with marks for named, published and AI versions; dragging it, or the arrow keys, steps through them. On the right, the inspector's History tab lists the versions by day with their messages, and the chosen one offers Restore this version, Compare and Copy blocks.</desc>
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
<text x="700" y="362" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">Compare</text>
<text x="700" y="388" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ed-tl-ux__body-11" data-slate-fit-padding="16">Copy blocks</text>
</g>
<text x="40" y="458" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">The rail and the list are the same versions: choosing in one moves the other.</text>
</svg>
<figcaption>The proposed Timeline view: the article as it was, a rail of versions under it, and the History tab listing them by day.</figcaption>
</figure>

### 5.3 The recommended view

- **Opening it:** a History button in the article editor's header, and a shortcut (Ctrl+Shift+H is the candidate, to check against the browser and Atiya Studio). The editor switches to Timeline: the canvas becomes read-only, the rail appears under it, and the inspector shows History.
- **The canvas** draws the article as it was, with its own pictures, through the same page the canvas draws today (the dev server reads that version's article and media from git instead of disk). What changed since the previous version is marked: removed words struck, new ones highlighted, added and removed blocks outlined.
- **While scrubbing,** the article's outline and text appear at once from the version's JSON, and the rendered canvas replaces them when it's ready (the old view stays until then); the neighbouring versions are fetched ahead.
- **The list** groups versions by day, then by session; a filter shows only named, published and AI versions. Each shows its time, message and kind.
- **One block's history:** select a block and choose History of this block; the rail keeps only the versions where it changed (possible because blocks have keys).
- **Leaving** returns to editing exactly where you were.

## 6. Restoring and copying

- **Restore this version:** keeps a version of now ("Before restoring"), writes the old article (bringing back any picture since deleted), and keeps a new version, *Restored from Tuesday 14:32*. Later versions stay.
- **Compare with now:** shows the difference from now to the old version in the review AI uses ([AI editing §8](ai-editing.md#8-review-one-component-for-every-proposal)); accepting some changes and not others is a partial restore.
- **Bring back a block:** on an old version's block, Bring back replaces today's block with the same key, or puts a removed block back where it was.
- **Copy blocks:** select blocks in an old version and copy them; paste them anywhere in today's article (their pictures come back if they were deleted).
- **Make a copy:** a new draft article from an old version (Google Docs' Make a copy).
- **Name this version:** on any version, or on now.

Every restore goes through the store like any save, so the content check and its conflict detection still apply.

## 7. Keyboard, screen readers and motion

WordPress's own accessibility review of its in-editor revisions slider found a missing `aria-valuetext`, changes shown by colour alone and uneven announcements ([Gutenberg #77530](https://github.com/WordPress/gutenberg/issues/77530)); the rail is built against those from the start, on the [WAI-ARIA slider pattern](https://www.w3.org/WAI/ARIA/apg/patterns/slider/).

- **The rail is a slider:** arrow keys step one version, Page Up and Page Down a day, Home and End the first and last; its value is read out as the version ("Tuesday 14:32, Edited Approach, 84 words added").
- **The list is a list box,** in step with the rail.
- **Changes on the canvas** are also listed as text (a "What changed" summary above it), so they don't depend on colour.
- **Announcements:** moving to a version announces its message; a restore announces what it did.
- **Reduced motion:** the canvas switches versions without a transition.
- **Esc** leaves the timeline.

## 8. Phases

| Phase | What | Notes |
|---|---|---|
| 1 | The policy and the timeline refs: `significance`, the triggers, writing versions, Name this version | Pure rules unit-tested; a version written in a test repository never moves `HEAD`, the index or the files |
| 2 | The History tab, an old version on the canvas, Restore this version | Needs the canvas to render a version from git |
| 3 | The rail and scrubbing, Compare, partial restore through the review, Copy blocks | The review component is shared with AI editing |
| 4 | One block's history, backups, thinning if the ref grows | Block history needs block keys |

Phase 1 is useful alone: versions start building up before there's any screen to see them, so the timeline has a past when it arrives. Tests run against the editor fixture's own repositories, never the real content.

## 9. Decisions for you

1. **When** (§3.3): sessions, size and events, with the calm numbers (10, 20 and 60 minutes; 100 words or 2 structural changes; a 5-minute floor), or the fine ones?
2. **How long** (§3.5): keep everything and group it?
3. **Where** (§4.1): a timeline ref beside your branch, leaving Save to remote as it is? Or do you want the branch's own history richer (option A or B)?
4. **Backup** (§4.3): none, or both refs to the private repository?
5. **The view** (§5.2): the list and the rail together, with Compare?
6. **Start with phase 1 now,** so history builds up before the screens exist?
