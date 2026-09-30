# Edit mode: plan and Definition of Done

How the local editor ([spec](spec.md)) is built: five phases, each leaving the site working, then the tests that hold it and the Definition of Done. The editor exists only in the dev server, so none of this changes what GitHub Pages serves, apart from the content source reading files from disk and the inline Markdown parser, both of which render the site exactly as before.

> **TL;DR.**
> - **E0: foundations.**
>   - Content: the source reads from disk with a content generation; drafts are resolved but not built; one inline Markdown parser and serializer; one paragraph or list per text block.
>   - The dev-only integration: routes, content events and the root.
>   - The server: the request guard with framing headers, and the transactional store and its API.
>   - The design system: Dialog, Tabs, the icons, editor tokens in their own stylesheet, and the editor's frame.
> - **E1: the article editor.**
>   - The canvas with comment markers.
>   - Inline text: marks, input methods, paste and drop.
>   - Blocks, the palette, the outline and the inspector.
>   - Choosing existing media.
>   - The save queue, versions, undo and redo.
> - **E2: media.** Uploads, the library, focus points, and deletes by the reference graph.
> - **E3: the rest of the content.** The articles list, new and delete, the dashboard, the sections tree, the settings.
> - **E4: publishing.** Changes, discard, the checked commit, the push that never prompts, Push again.
> - **Tests** run the editor's E2E on its own dev server, started by a wrapper that first builds a throwaway git repository of the content with its own remote, so a test never touches the real content or pushes to GitHub.

## 1. Phases

### E0: foundations

1. **The content source.**
   - `source.ts` reads the content folder into a snapshot `{ docs, masters, digest }` with `fs`. The integration defines the folder's absolute path from Astro's root; `CONTENT_ROOT` may replace it in dev only.
   - The repository re-reads when the process-wide content generation changes.
   - `pictures.ts` builds a master's metadata with sharp in dev, and imports the masters in a build (from a module only a build loads).
2. **The loader and routes:** every node is resolved and checked, drafts included, and only published items become routes. The canvas uses the full resolution; `getStaticPaths` uses the published routes.
3. **Markdown:** `markdown.ts` becomes a tokenizer, an inline tree, a renderer and a serializer, with backslash escapes and double-backtick code. The site's pages render as before, which a test compares.
4. **The text-block rule** (one paragraph or list), in the contract; the current content already meets it.
5. **`integrations/editor.mjs`:**
   - it defines the content root and refuses `CONTENT_ROOT` in a build;
   - it injects the routes for `dev`;
   - it watches the content folder: `astro:content-changed` to the `ssr` and `prerender` environments on every change; for a change the editor didn't make, it advances the generation and sends `site:content-changed` to the browser;
   - it prints the editor's address.
   
   A small listener in the page frame reloads public pages on `site:content-changed` (dev only).
6. **The guard** (`model/guard.ts`, pure), with the framing headers.
7. **The store** (`server/store.ts`): the writer lock, versions, the content check, ordered renames with Windows retries, rollback, self-write records and the generation.
8. **The API endpoint** (`pages/api.ts`): routing, JSON and errors.
9. **The design system:**
   - the Dialog and Tabs compounds, with stories;
   - the editor's icons (done: `icon-set.json`);
   - `c.editor` tokens, written by `build-site-tokens.mjs` to `editor-tokens.css`;
   - the editor's layout (side navigation, top bar, live status);
   - the design-system test extended to the editor tier.

### E1: the article editor

1. **The content page component.** The composition in `src/pages/[...path].astro` moves into a `Page` component (content), used by the public route and the canvas; the canvas adds only the comment markers and the editor's overlay.
2. **The canvas route and its script:**
   - hover, select, the toolbar and the "+" inserters;
   - inline text: marks, the format bar, links, Enter and Backspace;
   - input methods, `beforeinput`, plain paste and drop;
   - pending blocks, the drop cap switched off while editing, and the Preview toggle.
3. **Pure document operations** (`model/ops.ts`) and DOM to inline tree (`model/dom.ts`, over a minimal node interface so it runs in the unit tests).
4. **The media field and picker** for existing media, and `GET media`.
5. **The editor screen:**
   - the outline: drag, buttons and Alt+Up and Alt+Down;
   - the inspector's Block and Page forms, rendered by the server;
   - the controller: apply, the save queue, conflicts, refreshing regions and the canvas, undo and redo;
   - the block palette and the insert dialogs.

### E2: media

1. **Uploads** (`server/media.ts`):
   - sharp to WebP within the budgets, with metadata stripped;
   - a unique ID in the owner's folder;
   - the master and its sidecar in one transaction;
   - decorative offered.
2. **The library screen:** the grid, search, the details form, the focus point, Used in (from one reference graph), and delete when unreferenced.
3. **Upload** in the picker.

### E3: the rest of the content

1. **The articles list:** search and filters, New article, New page, Duplicate and Delete (drafts only, optionally with their unreferenced pictures).
2. **The dashboard:** counts, recent articles, unpublished changes, what needs attention, quick actions.
3. **The sections tree:** hub settings, reorder, place, and new section. Moving or removing is limited to drafts; a published address is fixed.
4. **The settings:** the site settings and the owner's profile.

### E4: publishing

1. **Git** (`server/git.ts`): arguments as a list, no shell, no prompts, a time limit.
   - **Changes:** what's uncommitted in the content folder, and the commits not yet pushed.
   - **Discard:** restore, or delete an untracked file.
   - **Publish** under the writer lock: check, stage, compare the staged hashes, a pathspec commit, then push.
   - **Push again.**
2. **`.gitattributes`:** content JSON at LF.
3. **The Publish screen:** the changes by resource, the check, the message, the result, and Push again.

## 2. Order and dependencies

E0 comes first: every screen stands on the source, the guard, the store and the frame. E1 needs E0 only (it chooses existing media). E2 adds uploads to the picker E1 built. E3 and E4 need only E0. Each phase ends with its unit tests and its part of the E2E group "editor", then a commit.

## 3. Definition of Done

| # | Phase | Criterion | Evidence |
|---|---|---|---|
| 1 | E0 | A production build has no editor: no route, script, stylesheet, token or marker (`/_edit`, `editor-block`, `--c-editor`, `data-editor`); a build with `CONTENT_ROOT` set fails | `npm run verify:prod` (it searches `dist/`); integration unit test |
| 2 | E0 | The site renders as before: the same HTML for the existing content through the new parser; the site's E2E groups pass | Markdown unit tests; `npm run e2e` site groups |
| 3 | E0 | Every editor route refuses a non-loopback client and a foreign `Host`, and can't be framed by another origin; every write refuses a missing header, a foreign or missing `Origin`, and a cross-site `Sec-Fetch-Site` | Guard unit tests; E2E (a foreign `Origin` gets 403; the headers are present) |
| 4 | E0 | A write the contract refuses changes no file and names the field; a stale version gets 409; a failure on the Nth rename leaves the files as they were | Store unit tests (with injected rename failures and `EPERM` retries) |
| 5 | E0 | A page rendered right after a save shows it; saving reloads no open page; a file edited by hand reloads public pages and marks an editor with unsaved input as conflicted | E2E |
| 6 | E0 | Dialog and Tabs are in the design system with stories and pass its tests; the editor tier is tested | `siteDesignSystem.test.ts`; the design library |
| 7 | E1 | The canvas's DOM is the public page's (the article's element tree matches, apart from the overlay and comments) | E2E |
| 8 | E1 | Text typed on the page, with bold, italic, code, links and line breaks, saves as the Markdown subset and renders the same after a reload; nested marks and escapes round-trip by meaning | Parser, serializer and DOM unit tests; E2E |
| 9 | E1 | Blocks can be added from the palette, moved, duplicated and deleted by mouse, buttons and keys | E2E |
| 10 | E1 | Undo and redo restore the document; no two saves overlap | E2E; controller unit tests |
| 11 | E1 | Every block type's settings save and re-render; an invalid value shows its reason and isn't written | E2E |
| 12 | E1 | A draft renders on the canvas and isn't on the public site; once published it is, without a restart; its slug and section are then fixed | E2E |
| 13 | E2 | An uploaded image becomes a WebP master within budget, with its sidecar and alt text (or decorative), without a restart, and can be used at once | Media unit test (sharp); E2E |
| 14 | E2 | The focus point, alt text and caption save; a referenced picture can't be deleted | Unit test of the reference graph; E2E |
| 15 | E3 | New article, New page, Duplicate and Delete work and leave valid content | E2E |
| 16 | E3 | The sections tree reorders, places, adds hubs and edits them; moving a published node is refused | E2E |
| 17 | E4 | Publish commits only the content folder (staged code stays staged), exactly as checked, and pushes; discard restores; a failed push leaves "not pushed" with Push again; git never prompts | Git unit tests against a temporary repository and bare remote; E2E |
| 18 | all | The editor follows the design system (tokens only; fundamentals, compounds and parts only; scripts through `page.ts`) and passes axe in light and dark | `siteDesignSystem.test.ts`; E2E axe |
| 19 | all | The site is unchanged and every budget holds | `npm run e2e` site groups; `verify:prod` |

## 4. Tests

- **Unit** (Vitest), all pure or against temporary folders:
  - the guard;
  - the inline parser and serializer, compared by meaning;
  - DOM to inline tree (a minimal node interface);
  - document operations;
  - IDs and slugs;
  - route resolution with drafts;
  - the store (versions, refusals, rollback, retries);
  - the reference graph;
  - uploads (a generated PNG through sharp);
  - git (a temporary repository and a bare remote: untracked and staged content, staged code left alone, a failing push);
  - the integration (nothing injected for `build`; `CONTENT_ROOT` refused in a build).
- **E2E**, the group "editor" (`tests/e2e/editor.spec.ts`), is its own Playwright project with its own server:
  - **The server:** `scripts/editor-test-server.mjs` first resets `.editor-test/`. It copies `content/` into `.editor-test/content`, makes `.editor-test/` a git repository with a local identity, and gives it a bare remote `.editor-test-remote.git` as its upstream. Then it starts `astro dev` on port 4330 (strict), with `CONTENT_ROOT` pointing at the copy and its own Vite cache.
  - **Both folders** are in `.gitignore`.
  - **Between tests:** a test that changes the fixture resets it (`git reset --hard`, `git clean -fdx`, the remote's branch reset to the first commit).
  - **Isolation:** the "chromium" project, the site's groups, still runs against the test build; Playwright's `webServer` is an array.
- **The production check:** `scripts/size-report.mjs --prod` fails if `dist/` holds any of the editor's sentinels.

## 5. Risks

| Risk | Effect | Mitigation |
|---|---|---|
| `contenteditable` differs between browsers | Stray markup after editing | Only the inline tree's marks survive; `beforeinput` handles paste and drop; DOM to tree to Markdown is tested |
| The dev server's internals change | The route cache or events misbehave after an Astro update | Public hooks, Astro's own `astro:content-changed` event, Vite's environment API; the E2E checks catch a change (DoD 5, 12) |
| A push fails (credentials, a remote ahead) | Publish stops half way | The commit stays local, shown as not pushed, with Push again; nothing is forced; git never prompts |
| Windows locks a file mid-write | A failed save | Retries on `EPERM` and `EBUSY`, then rollback (DoD 4) |
| Large uploads | A slow editor | At most 20 MB; sharp resizes on upload; the master is at most 2560 px |

## 6. Status

All five phases are built, and every point of the Definition of Done is met. The unit tests are `tests/unit/editor.test.ts`, `editorModel.test.ts` and `editorServer.test.ts`; the E2E group is the Playwright project `editor` (`npx playwright test --project=editor`, `tests/e2e/editor.spec.ts`). What the build added or settled is in the [spec, §13](spec.md#13-as-built).

| # | Met by |
|---|---|
| 1 | `npm run verify:prod` searches `dist/` for `/_edit`, `editor-block`, `--c-editor` and `data-editor` (none found; the design library no longer lists `c.editor`); "the dev integration" unit tests: nothing injected for a build or a preview, `CONTENT_ROOT` refused in a build |
| 2 | The Markdown unit tests (the old renderer's output, byte for byte; a 50,000-tree fuzz); the site's E2E groups (site design system, site on a phone, article minimap, content, landing and classic) |
| 3 | The guard's unit tests; E2E "the guard": a foreign `Origin`, a missing header or `Origin` and a cross-site request get 403, and every screen carries `frame-ancestors 'self'` and `X-Frame-Options` |
| 4 | The store's unit tests: the contract's refusal names the field and writes nothing, a stale version gets 409, the second rename failing leaves every file as it was, `EBUSY` retried |
| 5 | E2E "text typed on the page…" (the site shows the save, an open page on the site isn't reloaded by it, a hand edit reloads it) and "a change made elsewhere…" (the open editor stops saving and shows the conflict; nothing is written over the hand edit) |
| 6 | Dialog and Tabs with stories in the design library; `siteDesignSystem.test.ts` "edit mode" (parts made only of fundamentals, compounds, tier 0 and the editor model; documented; pages without styles; nothing outside the editor imports it; the launcher's styles are tokens only) |
| 7 | E2E "the canvas is the public page": the same elements in the same order, apart from the overlay |
| 8 | The parser, serializer and DOM unit tests (marks in marks, links keep their written target, breaks, lists, compared by meaning); E2E typing with bold saves `**boldly**` and renders it on the site |
| 9 | E2E "blocks": added from the palette, moved with the outline's button, duplicated and deleted from the canvas toolbar |
| 10 | E2E "blocks" (undo brings a deletion back, saved); the save queue's unit tests (one save at a time, requests folded, a conflict stops it) |
| 11 | E2E "the page's settings…": a summary over 160 characters is refused with its reason and not written; a valid one saves |
| 12 | E2E "a new draft…": rendered on the canvas, 404 on the site; published, 200 at once without a restart; its slug then fixed |
| 13 | "uploads" unit tests (a 3200 px JPEG with EXIF becomes a 2560 px WebP under 1.5 MB without metadata; transparency kept; names never overwritten); E2E "media": an upload opens at once in the library |
| 14 | The reference graph's unit tests; "a picture's details" unit tests (a used picture, the site's social image included, can't be deleted); E2E "media" (details save; Delete disabled on a used picture, with Used in) |
| 15 | E2E "a new draft…" (New article, the same form as New page) and "duplicate…" (a draft copy in the same section, without its publication date; Delete removes the draft and its node; a published article offers no Delete) |
| 16 | E2E "sections" (a new section, reordered with Alt+Up, saved; a published section's slug is fixed); `structure` unit tests |
| 17 | "publishing with git" unit tests (only `content/` committed, staged code left staged, the remote gets it, a rejected push leaves the commit with the reason and Push again works after a pull, discard restores and deletes a new picture's two files together, git never prompts); E2E "publish" (discard, then publish to the fixture's remote) and "a push the remote refuses…" (the commit kept, the reason shown, Push again once the branch is up to date) |
| 18 | `siteDesignSystem.test.ts` (tokens only, tiers, hover, scripts through `page.ts`); E2E "every screen passes axe, in light and in dark" |
| 19 | `npm run verify:prod` (every budget held); the site's E2E groups |
