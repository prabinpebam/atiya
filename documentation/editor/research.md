# Edit mode: research

How the visual builders (Squarespace, Webflow, Framer), the block editors (Notion, WordPress) and the git-based CMSs (TinaCMS, Decap, Keystatic, Sveltia, Pages CMS, CloudCannon) let people edit content, and how a local write API is kept safe. Each finding names its source. What it means for this site's editor is in the [spec](spec.md); the last section maps the one to the other.

> **TL;DR.**
> - **Content, not design.** Every hosted builder separates editing content from designing: Webflow's content-editor role, Framer's Content and Design permissions, WordPress's `contentOnly` lock. The editor offers only the content model's fields.
> - **On the page, with a panel.** Webflow outlines what's editable on hover and edits it in place; Framer's on-page editing (August 2025) does the same on the published site. Fields that don't show on the page go in a side panel ("Show all fields"; WordPress's Block and Post tabs).
> - **Blocks from a fixed set.** Blocks come from a fixed list, added with a "+" between blocks or a menu, moved with handles, drag or keys, and listed in an outline (WordPress List View, Webflow Navigator).
> - **Save, then publish.** Edits save as you go; publishing is a separate, reviewed step: CloudCannon's review modal commits to git, and Webflow shows a summary before publishing.
> - **None of the git CMSs fits as is.** Each edits through forms or needs its own renderer or an SSR adapter, so none can edit this site's Astro pages in place with its own design system. Their local modes all write files through a small local server, and that part is worth copying.
> - **A local write API must check `Origin`.** Vite's 2025 advisory showed a localhost dev server can be reached from any website. Vite now checks `Host` before any plugin's middleware, but its CORS layer only sets headers: a write route must check `Origin`, and a custom header forces a preflight.

## 1. Squarespace (7.1, Fluid Engine)

- **Edit mode:** you open a page from the Pages panel and press Edit. Sections hold blocks; Add Block opens a searchable menu of blocks, and a new block starts with placeholder content ([Fluid Engine](https://support.squarespace.com/hc/en-us/articles/6421525446541-Edit-your-site-with-Fluid-Engine), [blocks](https://support.squarespace.com/hc/en-us/articles/206543757-Add-content-to-your-site-with-blocks)).
- **Text** is typed in place; Enter makes a new paragraph, and pasting as plain text is recommended ([text blocks](https://support.squarespace.com/hc/en-us/articles/205813798-Text-blocks)).
- **Blocks:** delete, duplicate (Ctrl+D), copy and paste, keyboard selection and moves; a right-click menu with the same ([shortcuts](https://support.squarespace.com/hc/en-us/articles/214491097-Squarespace-keyboard-shortcuts-and-tips)).
- **Undo and redo** last until Exit, and don't cover alt text, focal points or the image editor ([undo](https://support.squarespace.com/hc/en-us/articles/4403167416461-Using-undo-and-redo-in-Squarespace)).
- **Device view** toggles mobile; in mobile you can edit and move but not add blocks ([device view](https://support.squarespace.com/hc/en-us/articles/206545667-Device-view)).
- **The Pages panel** has Main navigation and Not linked (reachable, not in the menu; suggested for work in progress) ([Pages panel](https://support.squarespace.com/hc/en-us/articles/217644727-The-Pages-panel)).
- **Blog posts:**
  - the title is at most 200 characters;
  - the settings hold the excerpt, URL, featured image, tags and categories;
  - the status is Draft, Needs Review, Scheduled or Published ([blogging](https://support.squarespace.com/hc/en-us/articles/206543727-Blogging-with-Squarespace)).
- **Focal points** are set by dragging a circle on the image, and save at once ([focal points](https://support.squarespace.com/hc/en-us/articles/205826028-Using-focal-points-to-center-images)).

## 2. Webflow

- **The legacy Editor is retired** on 4 August 2026; content editing now happens on the main canvas, by role ([deprecation](https://webflow.com/blog/legacy-editor-deprecation)).
- **Content editors** get "a simplified interface that ensures the site design stays untouched":
  - hovering outlines an element in blue;
  - clicking shows its kind (text, link, asset, image settings);
  - changes save automatically ([content editor](https://help.webflow.com/hc/en-us/articles/33961251014931-Edit-site-content-as-a-content-editor)).
- **Roles:**
  - a content editor can't create classes, components or variables;
  - a marketer can add existing components to page slots: pages from a fixed set ([roles](https://help.webflow.com/hc/en-us/articles/41015796747667-Site-roles-and-permissions)).
- **CMS items** save automatically, and a draft isn't published with the site. Their statuses are Draft, Changes in draft, Queued, Scheduled, Published and Archived ([publishing items](https://help.webflow.com/hc/en-us/articles/33961230697107-Save-and-publish-Collection-items)).
- **Alt text** belongs to the asset and is inherited wherever it's used, can be overridden per use, and an image can be marked decorative ([alt text](https://help.webflow.com/hc/en-us/articles/33961330170643-Include-alt-text-on-images)).
- **The Navigator** is the element tree, for selecting and reordering ([Navigator](https://help.webflow.com/hc/en-us/articles/33961320786451-Navigator)).

## 3. Framer

- **On-page editing** (Framer's Academy dates it August 2025) lets people with Content permission edit the published site in place: text, rich text, images, component properties and CMS content. Editable elements are highlighted ([on-page editing](https://www.framer.com/help/articles/on-page-editing/)).
- **The editor bar** has Add Page, which makes CMS items only (never free-form pages), and Show All Fields, for fields not on the page such as the SEO description (same source).
- **Permissions** are Design, Content and Deploy; staging keeps every publish as a version with rollback ([permissions](https://www.framer.com/help/articles/member-roles-and-permissions/), [staging](https://www.framer.com/help/articles/staging-and-versions/)).
- **CMS items** carry an ID, a slug, a draft flag and typed fields, including formatted text and image arrays ([CMS API](https://www.framer.com/developers/cms)).

## 4. Block editors: Notion and WordPress

- **Notion:**
  - the "+" in the margin adds a block, and "/" filters the block menu;
  - Enter makes a new block, and Shift+Enter a line break;
  - Esc selects the block, Ctrl+D duplicates, and Ctrl+Shift+arrows move it ([basics](https://www.notion.com/help/writing-and-editing-basics), [shortcuts](https://www.notion.com/help/keyboard-shortcuts)).
- **WordPress** inserts from the toolbar, the "+" between blocks, or "/" ([adding blocks](https://wordpress.org/documentation/article/adding-a-new-block/)). It moves blocks with up and down handles, drag, or Move to ([moving](https://wordpress.org/documentation/article/moving-blocks/)).
- **WordPress's List View** is an outline for reordering ([List View](https://wordpress.org/documentation/article/list-view/)); its settings sidebar has a document tab and a block tab ([settings](https://wordpress.org/documentation/article/page-post-settings-sidebar/)).
- **WordPress's `contentOnly` lock** stops every structural change and leaves only content editable ([templates](https://developer.wordpress.org/block-editor/reference-guides/block-api/block-templates/)).

## 5. Git-based CMSs

| CMS | Local mode | How it writes | Editing | For this site |
|---|---|---|---|---|
| TinaCMS | A local GraphQL server on port 4001 ([CLI](https://tina.io/docs/graphql/cli)) | Straight to files; JSON supported ([collections](https://tina.io/docs/reference/collections)) | A sidebar form; `data-tina-field` focuses a field from the page ([tinaField](https://tina.io/docs/contextual-editing/tinafield)) | Needs an SSR adapter for Astro and React islands ([Astro](https://tina.io/docs/frameworks/astro)) |
| Decap | `local_backend` with `decap-server` ([proxy](https://decapcms.org/docs/decap-proxy/)) | Straight to files, confined to the repository by a real-path check | Forms with a preview pane; blocks need custom preview templates ([widgets](https://decapcms.org/docs/variable-type-widgets/)) | The preview isn't the site's Astro render |
| Keystatic | `storage: local` ([local mode](https://keystatic.com/docs/local-mode)) | A JSON API that requires a custom header and JSON, with allow-listed paths | Forms at `/keystatic`; `fields.blocks` | Needs React and Markdoc, and an adapter to deploy ([Astro](https://keystatic.com/docs/installation-astro)) |
| Sveltia | No server: the browser's File System Access API ([local](https://sveltiacms.app/en/docs/workflows/local)) | The browser writes the files | Forms, Decap-compatible previews | Chromium only; you commit yourself |
| Pages CMS | None: it saves through GitHub ([docs](https://pagescms.org/docs/)) | Commits on GitHub | Forms; `type: block` fields | Needs its own server and a GitHub App |
| CloudCannon | `cloudcannon dev` ([CLI](https://cloudcannon.com/documentation/developer-reference/cli/dev/)) | The hosted app writes to disk | Editable regions marked with `data-editable` on the built page ([regions](https://cloudcannon.com/documentation/developer-reference/editable-regions/)) | A hosted service |

## 6. Keeping a local write API safe

- **Vite's advisory GHSA-vg6x-rcgg-rjx6 (January 2025)** showed that any website could send requests to a dev server on localhost and read the responses, through permissive CORS and DNS rebinding ([advisory](https://github.com/advisories/GHSA-vg6x-rcgg-rjx6)).
- **Vite's defaults now:**
  - the server listens on `localhost`;
  - `allowedHosts` allows only localhost and IP addresses;
  - CORS allows only localhost origins ([server options](https://vite.dev/config/server-options)).
- In the installed Vite (8.3), the CORS and Host checks run before any plugin's middleware, and Astro's `astro:server:setup` runs inside a plugin: an integration's routes are behind the Host check.
- **CORS doesn't reject a request;** it only sets headers. TinaCMS's source says a write route must check `Origin` itself.
- **OWASP's guidance** ([CSRF cheat sheet](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html)):
  - a custom header forces a preflight;
  - compare `Origin` with the exact origin;
  - block a write with neither `Origin` nor `Referer`;
  - use `Sec-Fetch-Site` where it's sent.
- **Astro's `security.checkOrigin`** covers only on-demand pages and form content types, so it doesn't protect a JSON API ([configuration](https://docs.astro.build/en/reference/configuration-reference/)).

## 7. Accessible patterns for an editor

- **Tabs** follow the [APG tabs pattern](https://www.w3.org/WAI/ARIA/apg/patterns/tabs/): arrow keys, Home and End, and automatic activation when panels are ready.
- **A modal dialog** follows the [APG dialog pattern](https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/): focus goes in, Tab stays inside, Escape closes, and focus returns to the opener.
- **A page tree** follows the [APG tree view](https://www.w3.org/WAI/ARIA/apg/patterns/treeview/): arrows open, close and move; Enter activates.
- **Reordering** follows the [rearrangeable listbox](https://www.w3.org/WAI/ARIA/apg/patterns/listbox/examples/listbox-rearrangeable/): Move up and Move down buttons, Alt+Up and Alt+Down, focus kept on the moved item, and a live announcement.
- **WCAG 2.5.7 Dragging Movements** asks for a single-pointer alternative to every drag; a keyboard alternative alone isn't enough ([understanding 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html)).

## 8. What the spec takes from this

| Finding | In the spec |
|---|---|
| Content editors never touch design (Webflow roles, Framer permissions, WordPress `contentOnly`) | Only the content model's fields; a block's look is its design-system choices (G3) |
| Hover outline, click to edit in place (Webflow, Framer, CloudCannon) | The canvas: hover names the block, click selects it, text is typed in place (§3.1, §3.2) |
| "+" between blocks, a menu of allowed blocks (WordPress, Notion, Squarespace) | "+" inserters and the block palette, from the content model's blocks (§3.4) |
| Outline and List View for order (WordPress, Webflow Navigator) | The outline, with drag, buttons and Alt+Up and Alt+Down (§3.3) |
| Block and document tabs, plus "show all fields" (WordPress, Framer) | The inspector's Block and Page tabs (§3.5) |
| Enter for a new paragraph, Shift+Enter for a break, Ctrl+D to duplicate (Notion, Squarespace) | The same keys (§3.2, §3.3) |
| Undo that silently skips some changes confuses people (Squarespace) | Undo covers the article document; picture details save to the picture and say so (§3.3, §6) |
| Save as you go, publish after a review (Webflow, CloudCannon) | Autosave to files; Publish reviews the changes, checks, commits and pushes (§7) |
| Drafts aren't published with the site (Webflow) | A placed draft isn't built until published (§9) |
| Alt text on the asset, overridable per use (Webflow); focal point on the image (Squarespace) | Alt text, caption and focus in the sidecar; captions overridable per block (§6) |
| Write routes check `Origin`, a custom header forces a preflight, paths are allow-listed (Vite, OWASP, TinaCMS, Keystatic, Decap) | The request guard and the store's path checks (§8.2, §8.3) |
| Drag needs a single-pointer alternative (WCAG 2.5.7) | Move up and Move down buttons on every block and row (§3.1, §3.3) |
