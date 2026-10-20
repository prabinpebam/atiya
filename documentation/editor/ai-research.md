# Edit mode: AI and history research

What other products do for AI editing, comments that AI works through, and version history, and which AI services can really be connected. Each finding names its source, read on 20 October 2026; what couldn't be confirmed says so. The proposals built on it are [AI editing and comments](ai-editing.md), [AI services](ai-services.md) and [Timeline](timeline.md).

> **TL;DR.**
> - **Propose, then apply.** Google Docs' Preview and Insert, Word's Replace, Insert below and Regenerate, Contentful's preview, Craft's Explore mode: AI never changes saved content without a distinct confirmation.
> - **Where you press decides the scope.** GitHub's Fix with Copilot and Add to batch, CodeRabbit's reply in a thread or in the conversation: one action for one comment, another for all of them.
> - **A change of type is its own action** everywhere it exists (Jetpack's "Turn list into a table", Word's "Transform content").
> - **Nobody reviews an AI rewrite change by change** with a purpose-built screen, and **nobody reports per comment** whether AI addressed it. Word's Track Changes is the closest to the first; the second is a gap.
> - **Comments whose anchor is gone are kept and marked outdated** (GitHub), or disconnected but kept (Figma); never silently moved or deleted.
> - **Version history** findings are in §4.

## 1. AI on one block

| Product | Where you ask | How the answer shows | Accept | Source |
|---|---|---|---|---|
| Notion AI | The block's handle (Ask AI), `/`, a shortcut | Streams into the block, replacing it | Accept, Discard, Try again | [Notion AI for docs](https://www.notion.com/help/guides/notion-ai-for-docs) |
| Google Docs | A side panel, or Refine over a selection | Preview before Insert | Insert, Retry | [Help me write](https://support.google.com/docs/answer/13447609) |
| Word Copilot | The selection's mini toolbar | A review card | Replace, Insert below (keeps both), Regenerate | [Edit and rewrite](https://support.microsoft.com/en-us/word/copilot/edit-rewrite-content) |
| ChatGPT Canvas | A selection's prompt, beside a chat | Suggested edits as comments; a diff button; version arrows | Apply each suggestion | [Introducing canvas](https://openai.com/index/introducing-canvas/) |
| Claude Artifacts | A side window | Each edit a new version, with diffs | Restore an earlier version | [Artifacts](https://support.claude.com/en/articles/17153992-what-are-artifacts-and-how-do-i-use-them) |
| Cursor | Cmd or Ctrl+K on a selection | A red and green diff in place | Per hunk | [Inline edit](https://cursor.com/help/ai-features/inline-edit) |
| VS Code Copilot | Ctrl+I on a selection | A diff in place | Keep or Undo, whole | [Inline chat](https://code.visualstudio.com/docs/chat/inline-chat) |
| Jetpack AI (WordPress) | A sparkle on supported blocks' toolbars | Streams live; Stop offers Try again or Accept what's there | Accept | [AI Assistant](https://jetpack.com/support/create-better-content-with-jetpack-ai/), [lists to tables](https://jetpack.com/support/enhance-your-list-blocks-with-ai/) |
| Sanity AI Assist | A field's sparkle: saved instructions, not chat | Writes live, as a collaborator | Scoped to "allowed fields" | [AI Assist](https://www.sanity.io/docs/user-guides/ai-assist-working-with-instructions) |
| Craft | Cmd or Ctrl+Return on a block | Explore (proposes) or Execute (applies live) | One undo step for the whole action | Craft's help centre |

- **Changing a block's type is separate:** Notion's Turn into isn't AI; Google Docs does it by prompt ("convert the list into a table"); Jetpack has a "Turn list into a table" button; Word has "Transform content".
- **Stopping without losing:** Jetpack's Stop leaves Try again, Send and Accept on the partial answer.

## 2. From an empty page, and whole rewrites

- **One prompt, one draft:** Notion (Space on an empty line), Google Docs' Help me create ([Google](https://workspaceupdates.googleblog.com/2024/12/help-me-create-in-google-docs.html)), Word's Draft with Copilot, with Keep, Discard, Regenerate and Refine ([Microsoft](https://support.microsoft.com/en-us/word/copilot/draft-and-add-content-with-copilot-in-word)).
- **Outline first:** Gamma's Plan mode asks about the audience, goal and tone, shows an outline to edit, and waits; its Express mode is the one-shot ([Gamma](https://help.gamma.app/en/articles/15002203-how-do-i-create-with-agent-in-gamma)). It's the only product found that makes these two modes.
- **Whole rewrites:** ChatGPT Canvas and Notion restore all or nothing through version history. Word's accessibility guidance recommends turning Track Changes on before editing with Copilot, so each change can be accepted or rejected ([Microsoft](https://support.microsoft.com/en-us/accessibility/copilot/use-microsoft-365-copilot-with-word)): the finest review found, and not built for AI.

## 3. Comments that AI works through

| Product | One comment | All of them | Anchor gone | Resolving | Source |
|---|---|---|---|---|---|
| GitHub Copilot | Fix with Copilot | Add to batch, then Fix | Marked outdated, kept | Manual | [Incorporating feedback](https://docs.github.com/en/pull-requests/how-tos/review-pull-requests/incorporating-feedback-in-your-pull-request#delegating-review-comments-to-copilot) |
| CodeRabbit | Reply in the thread | Post in the conversation, or a checkbox | (code review) | Manual (`resolve`) | [Autofix](https://docs.coderabbit.ai/finishing-touches/autofix) |
| Google Docs and Gemini | "Rewrite the intro based on Anna's comment" | "Catch me up on all comments" | Not documented | Manual | [Google](https://support.google.com/docs/answer/17133843) |
| Word Copilot | A narrower prompt | "Process them and resolve them" | Not documented | Automatic by default | [Modern comments](https://support.microsoft.com/en-us/word/modern-comments-in-word) |
| Figma (no AI) | | | Disconnected, kept in the sidebar | Manual | [Move or edit comments](https://help.figma.com/hc/en-us/articles/360041547853-Move-or-edit-comments) |
| Notion (no AI) | | | Not documented | Resolved ones kept, filterable | [Comments](https://www.notion.com/help/comments-mentions-and-reminders) |

- **Fixing isn't resolving** in the stricter tools: GitHub and CodeRabbit keep resolving manual; CodeRabbit says plainly when it couldn't fix anything.
- **Word posts Copilot's replies under the user's name,** so human and AI comments look alike: an anti-pattern for trust.
- **No product gives each comment an outcome** (addressed, partly, needs you): the change itself is the explanation everywhere.

## 4. Version history

| Product | When a version is kept | Browsing | Restoring | Source |
|---|---|---|---|---|
| Google Docs | Continuously, grouped in the list; up to 40 named versions | A side panel by date; expand a group; Show changes; Only show named versions | Restore this version (the later ones stay); Make a copy | [Google](https://support.google.com/docs/answer/190843) |
| Figma | Every 30 minutes, and on a crash or a lost connection; named versions | A sidebar; pan the file as it was | Restore keeps every later version; duplicate a version | [Figma](https://help.figma.com/hc/en-us/articles/360038006754-View-a-file-s-version-history) |
| Notion | About every 10 minutes of editing, and at the end of a session (secondary sources); kept 7, 30, 90 days or without limit, by plan | A list; preview before restoring | Whole page | [super.so](https://super.so/blog/how-to-check-notion-page-history-and-restore-versions), [Notion's retention settings](https://www.notion.com/help/custom-data-retention-settings) |
| WordPress | A revision on every save; one autosave slot per person, every 60 seconds | A slider through the revisions, additions and removals marked; two handles to compare any two | Restore this revision | [WordPress](https://wordpress.org/documentation/article/revisions/) |
| macOS Versions | Hourly, or more often with many changes; at open, save, duplicate, lock, rename and revert | Browse All Versions: the document beside a stack of older ones and a timeline | Restore, or copy from an old version | [Apple](https://support.apple.com/guide/mac-help/view-and-restore-past-versions-of-documents-mh40710/mac) |
| Time Machine | Hourly for 24 hours, daily for a month, weekly after | A timeline along the screen's edge | Restore | [Apple](https://support.apple.com/en-us/104984) |
| VS Code | Every save; saves within 10 seconds replace the last entry | The Timeline view: local history and git commits together | Compare with the file, restore | [VS Code 1.66](https://code.visualstudio.com/updates/v1_66#_local-history) |
| Ghost | Automatically while editing (no interval published) | Post history | Restore with one click | [Ghost](https://ghost.org/changelog/post-history/) |
| Word, SharePoint | At events and periodically while autosaving; SharePoint keeps 500 by default | A list | The restored version becomes a new one | [Microsoft](https://support.microsoft.com/en-us/office/how-versioning-works-in-lists-and-libraries-0f6cd105-974f-44a4-aadb-43ac5bdfd247) |
| Confluence | Every save | Check two versions to compare; unchanged parts collapsed | The restored version becomes a new one | [Confluence](https://confluence.atlassian.com/doc/page-history-and-page-comparison-views-139379.html) |
| Obsidian | Snapshots at least 5 minutes apart, kept 7 days | Show changes | Restore or copy | [Obsidian](https://help.obsidian.md/plugins/file-recovery) |
| Linear | AI agents' and automations' edits in the same history as people's | A history | Restore | [Linear](https://linear.app/docs/documents) |
| Decap, TinaCMS, Keystatic | Only commits; Decap can squash a draft's commits on merge | Git's own | Git's own | [Decap](https://decapcms.org/docs/editorial-workflows/), [Keystatic](https://keystatic.com/docs) |

- **Restoring never deletes later versions** where it's documented (Figma, Google Docs, Confluence, SharePoint): a restore is a new version. Figma keeps a checkpoint either side of it.
- **Taking back a part:** Notion copies blocks out of an old version; Contentful brings back single fields; Photoshop's History Brush paints back one region.
- **Scrubbing in the editor costs real work:** WordPress 7.0 put visual revisions in the editor ([Gutenberg #74742](https://github.com/WordPress/gutenberg/issues/74742)), and its accessibility review found a slider without `aria-valuetext`, colour-only changes and uneven announcements ([Gutenberg #77530](https://github.com/WordPress/gutenberg/issues/77530)).
- **Sessions, ceilings and events:** Notion ends a version at a pause, Figma and macOS cap the time between versions, and macOS keeps one at meaningful events. Only macOS weighs how much changed.
- **Named versions** are everywhere, with a filter to see only them (Google Docs).
- **Git can keep versions without touching a branch:** a temporary index, `write-tree`, `commit-tree` and `update-ref` on a ref of its own, as `git stash` does ([git](https://git-scm.com/docs/git#Documentation/git.txt-GITINDEXFILE), [example](https://muxup.com/2024q4/directly-committing-files-to-a-separate-git-branch)).

What this means for the site: [Timeline](timeline.md).

## 5. Guidelines

- **Nielsen Norman Group:** disclosure (people read it, so it must reach screen readers) differs from watermarks (machines read them) ([PACED](https://www.nngroup.com/articles/disclose-ai-paced/)); a confident tone makes people check less, so checking must be cheap ([error checking](https://www.nngroup.com/articles/ai-chatbots-discourage-error-checking/)).
- **Microsoft's HAX guidelines:** support efficient correction (G9), give global controls (G17), notify people of changes (G18), scope services when in doubt (G10) ([HAX toolkit](https://www.microsoft.com/en-us/haxtoolkit/library/)).
- **Google PAIR:** people trust a system they can control; never collect data silently; "context errors" are AI's own kind of mistake, a wrong guess at intent ([guidebook](https://pair.withgoogle.com/guidebook-v2/chapters)).
- **Apple:** let people dismiss, revert or retry any transformation; never pass AI's work off as a person's ([generative AI](https://developer.apple.com/design/human-interface-guidelines/generative-ai)).
- **Shape of AI:** verification before overwriting work; variations to choose from; iA Writer's grey text for AI's words until a person revises them ([verification](https://www.shapeof.ai/patterns/verification), [disclosure](https://www.shapeof.ai/patterns/disclosure)).

## 6. AI services

The service-by-service findings (structured output, sign-in and terms, local or cloud) are in [AI services §2](ai-services.md#2-the-wishlist-one-by-one), with their sources. In short: every API and local runner can be held to a JSON schema; only GitHub documents using a person's subscription from another app; and MCP lets your own agent, signed in its own way, reach edit mode.

## 7. What couldn't be confirmed

- Whether ChatGPT Canvas still exists as its own surface in late 2026 (one blog says it was folded into another feature).
- Exactly how Google Docs and Word move a comment when its words change.
- Whether Gemini's OpenAI-compatible endpoint honours strict JSON schemas (its own API does, in shape).
- Hermes 4's presence on Ollama (Hermes 3 is there).
- The press reports of account bans for subscription relaying (the terms themselves are quoted from the vendors).
- Notion's version cadence (about 10 minutes, and a short pause): from secondary sources; Notion's help gives no numbers.
- Contentful's field-by-field restore: from its help centre, which refused automated reading.
- Whether Time Machine's hourly, daily, weekly thinning still holds on the newest macOS, which lets you choose the frequency.
