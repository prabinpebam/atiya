# The action center: spec

One place in Atiya Studio to find anything and do anything: press Ctrl+/, type a few letters, and go to a page, a picture, a section or a screen, run an action, or change a setting right there on a small card. It works the way Spotlight does on a Mac. This page is the spec; its stage and Definition of Done are in the [plan](plan.md) (stage 7E), and the app it lives in is in the [desktop spec](spec.md).

> **TL;DR.**
> - **The promise** (§1): *whatever you want to find or change, it's Ctrl+/ and a few letters away, from anywhere in the app.*
> - **What it finds** (§4): the app's actions, the current screen's own controls, settings, pages (by title, summary and words), sections, pictures and videos, and edit mode's screens. That's everything the app and edit mode can show or do, in one list.
> - **Settings on cards** (§4.3): a setting is changed on its card without leaving: a switch (Little planet, keeping the app in the tray), a choice (the colour theme), a slider (zoom) or a text field (the site's name). A change saves at once and says so.
> - **How it looks** (§6): one floating panel over the window, with the search field, the results in groups on the left and the chosen result's card on the right. It's all keyboard (arrows, Enter, Ctrl+Enter, Tab, Esc) and all pointer, with screen readers told everything.
> - **How it's built** (§8): the panel is the app's frame (`app://`), so it works over edit mode, the site and the app's own pages. Edit mode answers one read-only index (`GET /_edit/api/find`) and one write for its settings, both through the store. The main process holds every action: the panel never sends an address, only what to do.

## 1. The promise

**Whatever you want to find or change, it's Ctrl+/ and a few letters away, from anywhere in the app.**

It keeps three smaller promises:

| # | Promise | What breaks it |
|---|---|---|
| AP1 | **Instant.** The panel is up before you've lifted the keys, and results follow every letter with no wait you can see | A spinner before the first results; a result list that jumps while you type |
| AP2 | **Everything, one way.** If the app or edit mode can show it or do it, you can find it here, and choosing it does exactly what the app's own button does | A setting or a screen you can only reach by clicking through; a result that behaves differently from its button |
| AP3 | **Change it where you are.** A setting is changed on its card, saved at once and said; going to its screen is never needed for a simple change | A card that only links away; a change that isn't saved or isn't said |

## 2. Who and why: scenarios and jobs

The action center serves the same two people as the app (desktop spec §2): the owner, who knows his site well and moves fast, and a person who made their site with the app and doesn't know where everything lives.

| # | When I… | I want to… | So I can… |
|---|---|---|---|
| J1 | am writing and remember another page I need to fix | jump straight to that page in the editor by typing part of its title | carry on without hunting through Pages |
| J2 | remember a sentence but not which page it's on | find the page by words in its body | fix it where it is |
| J3 | need a picture I uploaded weeks ago | find it by its alt text, caption or the page it belongs to, and see it before opening it | pick the right one first time |
| J4 | want to change how the app or the site behaves (dark mode, zoom, the little planet) | find the setting by name and change it right there | not learn where every setting lives |
| J5 | am on a busy screen (the article editor) | run its own controls by name (Undo, a preview width, Save to remote) | keep my hands on the keyboard |
| J6 | am new and don't know the app's screens | type what I want ("pictures", "publish", "theme") and be shown where it is | learn the app by using it |
| J7 | keep going back to the same few things | see them first when I open it | get there with Ctrl+/ and Enter |
| J8 | use a keyboard or a screen reader | do all of the above without a mouse, told what's chosen and what changed | work as fast as anyone |

## 3. What a person can do

Each line serves the jobs in its last column.

| # | A person can… | Jobs |
|---|---|---|
| U1 | open the action center with Ctrl+/ from anywhere in the app: edit mode, the site, the app's own pages, the title bar; and close it with the same keys or Esc | all |
| U2 | open it with the mouse too: the search button in the title bar, or the app's menu | J6 |
| U3 | type and see results follow every letter, grouped by kind, the best one first and chosen | J1–J6 |
| U4 | find a page by its title, its summary or the words in its body, and see its status, section and whether it's private | J1, J2 |
| U5 | open a page in the editor (Enter) or on the site (Ctrl+Enter) | J1, J2 |
| U6 | find a picture or video by its alt text, caption, title, name or the page it belongs to, and see it on the card before opening it in Media | J3 |
| U7 | find a section and open it in Sections or on the site | J1, J6 |
| U8 | go to any of edit mode's screens by name or by what it's for ("publish" finds Save to remote) | J6 |
| U9 | run any of the app's actions: show edit mode or the site, open in the browser, restart edit mode, open the live site, check the site, switch site, sign in or out, make a new page | J4–J6 |
| U10 | run the current screen's own controls by name: its buttons, and each choice of its menus | J5 |
| U11 | change a setting on its card: a switch, a choice, a slider or a text field; the change is saved at once and said | J4 |
| U12 | see what they used last first, when nothing is typed yet | J7 |
| U13 | do all of it by keyboard alone, and hear it with a screen reader | J8 |
| U14 | always be told why something can't be found or done (edit mode still starting, a setting refused) and what to do instead | all |

## 4. What it finds

Everything the action center shows is a **result**: a title, a kind, a line more, and what choosing it does. Results come from two places: the app itself (always there) and edit mode (there once edit mode is ready, §6.6).

### 4.1 Kinds of result

The groups are listed in the order they appear, under the top hit (§7).

| Group | Comes from | Found by | Enter does | Ctrl+Enter does |
|---|---|---|---|---|
| **Actions** | The app (§4.2) | Its name and its other words | The action | – |
| **This screen** | The current screen's own controls (the row's, desktop spec §7.2): every button, link and each choice of its menus | Its label ("Preview width: Phone") | Presses it, as the row would | – |
| **Settings** | The app's and the site's (§4.3) | Its name, what it's about and its other words | Changes it (a switch flips) or moves to its control | Opens its screen (the site's settings) |
| **Pages** | Edit mode's content: every page, open or private | Its title; then its summary, section, kind and status; then the words in its body | Opens it in the editor | Opens it on the site (only when it has an address) |
| **Sections** | The site's sections | Its title, then its address | Opens it in Sections | Opens it on the site |
| **Pictures and videos** | Edit mode's media library | Alt text or title, caption, name, the page or place it belongs to | Opens it in Media | – |
| **Go to** | Edit mode's screens, as its side navigation lists them (the Planet only while it's on; Tests only on a source checkout) | Its name and what it's for (§4.4) | Opens the screen | – |

### 4.2 The app's actions

Each is the app's own command: choosing it does what its button or menu item does. An action that can't run now isn't listed (Open my live site before the site is live), except the ones that need edit mode, which say so (§6.6).

| Action | Other words it's found by | Does |
|---|---|---|
| Show edit mode | editor, write, edit | What the title bar's Edit mode does (Ctrl+1) |
| Show the site | preview, view, website | What the title bar's Site does (Ctrl+2) |
| Open in browser | browser, chrome, edge, external | Opens the dev server's site in the system's browser |
| Restart edit mode | server, restart, reload, stuck | Restarts the dev server |
| Open my live site | live, public, github pages | Opens the site's public address (only when it's live) |
| Check my site | check, health, problems | Opens Check my site (a managed site) |
| New page | create, add, write, article | Opens Pages with the New article dialog |
| Save to remote | publish, push, upload, git | Opens Save to remote |
| Switch to *site name* | site, open, switch | Opens another remembered site (one per site) |
| Sign out of GitHub / Sign in with GitHub | account, github, log out, log in | What the account menu's button does (sign out asks first, in the account menu) |
| Make a new site | new site, setup | What the menu's Make a new site does |
| Reload | refresh | Reloads the view |
| Quit Atiya Studio | exit, close | Quits (the dev server stops) |

### 4.3 Settings, and their cards

A setting's card holds its control. Changing it saves at once (a text field saves on Enter or Save); the card says "Saved" (or why not) in its status line, and every screen showing the setting follows (edit mode's screens hear the change through the store, editor spec §2.1).

| Setting | Where it's kept | Control | Notes |
|---|---|---|---|
| **Colour theme** | The app's settings | A choice: Match the system, Light, Dark | The same as the title bar's theme button (plan 7D) |
| **Zoom** | The app's settings | A slider, 50% to 200% in steps of 10%, with its value, and Reset to 100% | Zooms edit mode, the site and the app's pages; the title bar keeps its size. Applies as it moves; saved when it stops |
| **Keep running in the tray** | The app's settings | A switch | Closing the window leaves the app (and edit mode) running in the tray |
| **Site name** | `content/site.json` | A text field and Save | Checked by the content contract; a refusal is said on the card |
| **Site description** | `content/site.json` | A text field and Save | The same |
| ***Way* (one per way to explore, like Little planet)** | `content/structures/ways.json` | A switch | Turning one on or off restarts edit mode's server, as the Ways to explore screen does: the card says "Starting the site again…" until it's back, then "Saved". Turning the little planet on for a site without enough sections is refused with the Ways screen's own words |

Site settings are written by edit mode's store (§8.3), exactly as their screens write them; Ctrl+Enter on their card opens their screen (Settings or Ways to explore).

### 4.4 Other words

So that a newcomer's words find the right place (J6), every action, setting and screen has a few other words it's found by. Screens: Dashboard (home, overview), Pages (articles, posts, writing), Sections (structure, categories), Navigation (menu, header), Planet (buildings, game), Media (pictures, images, photos, videos, uploads), Settings (site name, profile), Ways to explore (game mode, planet, modes), Access (private, share, codes, links), Save to remote (publish, push, deploy, git), Tests (checks, e2e).

### 4.5 What it never shows

- Nothing of another site: results are the open site's.
- Access codes, magic links or a grant's secrets (who a page is shared with is the Access screen's).
- A private page in Recent: private pages are found, but never remembered on disk outside the site's own folders (§8.5).

## 5. Task flows

### 5.1 Find a page and open it (J1)

1. Ctrl+/ anywhere. The panel appears with the search field focused, holding the last search selected (typing replaces it), and Recent below.
2. Type "desi". After each letter the results update: the top hit is the page "My journey with DesignUp", chosen; its card shows its picture, Published, its section, its summary.
3. Enter. The panel closes and the page opens in the editor (in edit mode, switching from the site if needed). Focus is in the editor.

Ctrl+Enter at step 3 opens it on the site instead.

### 5.2 Find a sentence (J2)

1. Ctrl+/, type a few words from the body ("ship weekly").
2. Pages whose body holds them are listed after pages whose title or summary does; the card shows the matching line, with the words marked.
3. Enter opens the page in the editor.

### 5.3 Change a setting from its card (J4)

1. Ctrl+/, type "dark". The top hit is Colour theme, its card showing Match the system, Light and Dark.
2. Tab moves into the card, to the choice; the arrows choose Dark. The whole app turns dark at once, and the card says "Saved".
3. Esc goes back to the search field; Esc again closes the panel (or Ctrl+/).

A switch is quicker: type "planet", the top hit is Little planet, Enter flips it. The card says "Starting the site again…" and then "Saved: Little planet is on".

With a mouse: click the result to choose it, then use its control on the card.

### 5.4 Run the screen's own control (J5)

1. In the article editor, Ctrl+/, type "phone".
2. "Preview width: Phone" (This screen) is the top hit. Enter presses it, as the row's button would; the panel closes and the preview narrows.

### 5.5 A picture (J3)

1. Ctrl+/, type "team offsite".
2. Pictures whose alt text, caption or page match are listed with their thumbnails; the card shows the chosen one larger, its alt text (or "No alt text"), its size and where it belongs.
3. Enter opens it in Media, chosen.

### 5.6 Edit mode isn't ready (U14)

While edit mode starts (or after it stops), the app's actions and settings are there as always, and the content groups are replaced by one line: "Pages, pictures and site settings appear when edit mode is ready." with **Restart edit mode** when it's stopped. If the last index is still in memory, it's shown, marked "From before edit mode stopped".

### 5.7 A setting refused, or changed elsewhere

- **Refused** (the content contract, the planet's needs): the control goes back to what's saved, and the card's status line says why in the screen's own words. Nothing else changes.
- **Changed elsewhere** (another window saved it first, a 409): the card shows the saved value and says "Changed elsewhere: this is the saved one now."

## 6. UI and views

### 6.1 Placement and size

- One panel, centred on the window, its top a fifth of the way down the window (never closer than 1 rem below the title bar).
- Width: up to 56 rem, at least 2 rem clear of the window's sides. Height: up to 34 rem, at least 2 rem clear of the bottom. **The panel holds its size** while you type: results change, the panel doesn't (AP1).
- From 46 rem wide, the card sits to the right of the results (results 58%, card 42%). Narrower, the card sits under the results.
- No dimming: like Spotlight, the window stays as it is behind the panel. While it's open the rest of the window doesn't respond; a press outside closes it.

### 6.2 Anatomy

1. **The search field** (top, full width): a search icon, the field (larger text, `--text-lg`), the placeholder "Search pages, pictures, settings and actions", and a Clear button while there's text.
2. **The results** (a list): group headings ("Top hit", "Recent", "Suggested", "Actions", "This screen", "Settings", "Pages", "Sections", "Pictures and videos", "Go to"); each result a row at least 44 px tall with an icon or a thumbnail, the title (the matched letters in bold), and a quieter line (a page's section and status, a setting's value, a picture's page). One row is always chosen (highlighted, `aria-selected`); it moves with the arrows and with the pointer.
   - A group shows at most 5 results (pictures 6). Below a fuller group, a quiet line: "12 more pages: type more to narrow them".
3. **The card** (the chosen result): its picture or icon, its title, its facts (tags: status, Private, kind), a line or two (a summary, a matching sentence, a setting's description), its control (for a setting) and its actions as buttons, the default first (marked with its keys: Enter, Ctrl+Enter). A status line at the bottom says what happened.
4. **The hints** (the bottom edge): Up and down to choose, Enter to open, Ctrl+Enter for the second action, Tab to change a setting, Esc to close. Shortened to the ones that apply to the chosen result.

### 6.3 States

| State | What shows |
|---|---|
| Nothing typed | Recent (up to 5, the last first), then Suggested: New page, Pages, Media, Colour theme, Save to remote. A newcomer with no recent sees Suggested and a line: "Type to find pages, pictures, settings and actions." |
| Typing | The top hit, then the groups (§4.1), every result scored (§7) |
| Nothing found | "Nothing matches 'xyz'. Try fewer letters or another word." The card is empty |
| Edit mode not ready | §5.6 |
| A card's change saving | Its control works on (never blocked); the status line says "Saving…" past 300 ms (the editor's waiting pattern) |

### 6.4 Keyboard

| Keys | In the search field | In the card |
|---|---|---|
| Ctrl+/ | Closes the panel | Closes the panel |
| Up, Down | Chooses the previous or next result (round from the end to the start) | The control's own (a slider moves, a choice changes) |
| Page up, Page down | The first result of the previous or next group | – |
| Enter | The chosen result's default action | The focused button's action; in a text field, Save |
| Ctrl+Enter | The chosen result's second action | The same |
| Tab, Shift+Tab | Into the card's controls; the panel keeps focus inside it | Through the card's controls, then back to the field |
| Esc | Clears the field; when it's empty, closes the panel | Back to the search field (a text field's unsaved words go back to the saved ones first) |

Closing returns focus where it was (the editor's field, the site's page). Choosing a result that goes somewhere puts focus there.

### 6.5 Pointer and touch

Moving the pointer over a result chooses it (the card follows); a click does what Enter does, except on a setting, where a click chooses it and focuses its control, so a stray click never flips a setting. Every row and button is at least 44 px tall.

### 6.6 Edit mode not ready, and the site

The panel works over everything the window shows: setup, the app's pages, the site (the planet too: the keys go to the app, never to the game), edit mode. Content groups need edit mode's index; until it's ready they're replaced as §5.6 says.

### 6.7 Screen readers

- The panel is a modal dialog named "Action center". The field is a combobox controlling the results, which are a listbox of options in named groups; the chosen option is announced as you move (`aria-activedescendant`), with its group and its quieter line.
- The card is a region named after the chosen result; its controls are real controls (a switch is `role="switch"`, the choice a radio group, the slider a range input with its value in words).
- A polite live region says the count after typing settles ("12 results"), each change on a card ("Colour theme: Dark. Saved."), and refusals.

### 6.8 Look

The app's own design: the panel is a raised surface (`--color-bg-raised`, a hairline `--color-rule` border, the large shadow, the popovers' radius), the chosen row a sunk fill with the accent's edge, group headings small and quiet, thumbnails with the media's small radius. Light and dark from the app's theme. It appears with a short fade and rise (none under reduced motion).

### 6.9 Copy

Sentence case; labels are verbs ("Edit page", "View on site", "Open in Media", "Go to Settings"); the glossary's words (edit mode, the site, Save to remote, private page). No "OK" or "Submit".

## 7. Finding and ordering

Pure, in the app (`src/ui/find-rank.mjs`), unit-tested:

- **Matching:** case, accents and punctuation don't matter; every word typed must match somewhere in the result (titles, other words, the quieter line, a page's body), each word as the start of a word, a part of a word, or (titles only) the initials of its words in order ("lp" finds Little planet).
- **Score:** the best place each word matched: the whole title (100), the title's start (90), a word's start in the title (75), inside the title (55), the initials (50), a word's start in its other words (45), inside its other words or quieter line (30), the body (15). A result's score is its words' lowest, plus: used recently (+12, fading over the last 8), an action or setting (+4, so "theme" finds the setting before a page titled Theme).
- **Order:** the top hit is the best score of all; then the groups in §4.1's order, each sorted by score, then by shorter title, then alphabetically.
- **Speed:** a search over 5,000 results takes under 8 ms (a unit test measures 2,000 under a generous bound); the field never waits on it.

## 8. How it's built

### 8.1 Where it lives

- **The panel is the frame's** (`src/ui/finder.js`, `finder.css`, the panel's markup in `frame.html`): the frame's page covers the whole window and comes on top while a popover is open (`frame:raise`), so the panel floats over whatever the body shows, and works before edit mode is up.
- **The keys:** Ctrl+/ is caught in the main process on both views (`before-input-event`, like Alt+Space), never reaching the page; the main process tells the frame (`finder:toggle`) and gives it focus. The app's menu lists "Action center" with its keys (not registered as an accelerator, so it can't fire twice). It isn't a system-wide shortcut: the app must be the active window.
- **The results' data:** the app's actions and settings come from the frame's own state (`app:state`, the row's header); edit mode's from its index (§8.2), fetched by the main process.

### 8.2 Edit mode's index

`GET /_edit/api/find` (dev only, behind the same guard as every edit mode request) answers:

- `pages`: id, title, kind, status and its label, published, private, section (id and title), its site path (or none), summary, body text (headings and paragraphs as plain text, up to 4,000 characters), its card picture's id, updated;
- `sections`: id, title, path, how many pages;
- `media`: id, kind (picture or video), alt or title, caption, decorative, owner and its label, private, width, height, a video's length;
- `screens`: id, label, href and other words, from the same list as edit mode's side navigation;
- `settings`: id, title, description, control, value, version and limits (§4.3).

It reads the content index alone (no pictures drawn: performance rule), timed as `find.index`. A thumbnail is asked for one at a time, when its row is drawn: `GET /_edit/api/find/thumb?id=` answers the picture's card thumbnail address; the main process fetches it and hands the frame a `data:` URL (the frame's security policy loads nothing from the dev server), keeping the last 200.

### 8.3 Edit mode's settings writes

`PUT /_edit/api/find/settings/<id>` with `{ value, version }` changes one site setting through the store (`commit`, `ifMatch`): the site's name and description in `site.json`, a way in `ways.json` (with the same rule the Ways endpoint keeps: the little planet's starting map, or its refusal, in the same transaction; shared, not copied). It answers the setting as saved (`{ ok, setting, restarts }`), or `409` / `422` with the contract's words. A way's change restarts the dev server as the Ways screen's does; the main process waits for the new start (`/_edit/__warm`'s `started` mark) before saying "Saved".

### 8.4 The bridge

The frame's page alone can call these (the main process checks the sender, as for the window's channels):

| Channel | Carries | Does |
|---|---|---|
| `finder:toggle` (main → frame) | – | Opens or closes the panel |
| `finder:index` | – | Edit mode's index for the open site, fresh (with the last one kept if edit mode can't answer) |
| `finder:thumb` | a media id | A `data:` URL or null |
| `finder:run` | `{ kind, id, alt }` | Does a result's action: the main process maps it to a view and an address (`/_edit/articles/<id>/`, the site's path, `/_edit/media/?id=`, `/_edit/sections/?section=`, a screen's href checked against the index's list) or an app action. The frame never sends an address |
| `finder:set` | `{ id, value }` | Changes a setting: the app's own in its settings, the site's through §8.3 |
| `finder:remember` | a result's key | Adds it to Recent |
| `finder:focus` (frame → main) | where to | Gives focus back to the body when the panel closes |

Ids are checked (`/^[a-z0-9][a-z0-9-/]*$/`, bounded), values by the setting's control (a known choice, a number in range, a string of bounded length).

### 8.5 Recent

The last 8 results chosen, per site, kept in the app's settings by key (`page:<id>`, `setting:theme`, `action:restart`…); never a private page's. Shown when nothing's typed, and adding to a result's score (§7).

### 8.6 Zoom

A new app setting, `zoom` (0.5 to 2, default 1): the body's view takes it on every page it loads (`setZoomFactor` on `dom-ready`), so edit mode, the site and the app's pages follow; the frame doesn't zoom.

### 8.7 Performance

| Measure | Budget |
|---|---|
| Ctrl+/ to the panel drawn, with results | ≤ 50 ms (everything is in the frame's memory; the index refreshes behind) |
| A letter typed to its results drawn | ≤ 16 ms with 2,000 results |
| `find.index` on the owner's site | ≤ 300 ms in dev |
| A thumbnail | Drawn when its row shows, never blocking the list |

## 9. Decisions

| # | Question | Decision | Why |
|---|---|---|---|
| D1 | Where does the panel live: edit mode's page or the app's frame? | The frame | It must work over the site, the app's pages and while edit mode starts; the frame already draws over everything and holds the app's actions |
| D2 | A system-wide shortcut? | No: only while the app is the active window | A global Ctrl+/ would take the keys from every other program |
| D3 | A visible way in? | A search button in the title bar's left group (after the theme), and "Action center Ctrl+/" in the app's menu | A newcomer can't guess a shortcut; one icon is the smallest way to show it's there. The owner can move or drop it |
| D4 | Controls inside the result rows, or a card beside them? | A card beside them (Spotlight's preview) | Rows stay simple options a screen reader can list; the card has room for a real control, a picture and the actions |
| D5 | Does a click on a setting's row change it? | No: it chooses it and focuses its control; Enter on a switch flips it | A pointer passing over and clicking shouldn't flip a setting by accident; the keyboard's Enter is deliberate |
| D6 | Search a page's body? | Yes, ranked below titles and summaries | "Search for anything" (J2); local, and small (≤ 4,000 characters a page) |
| D7 | Dim the window behind? | No | Spotlight doesn't; the panel's shadow sets it apart |
| D8 | Remember private pages in Recent? | No | Nothing private is written outside the site's own folders |
| D9 | In edit mode in a browser? | Not now (§10) | The app is the product; the panel's data and rules are shaped so a browser version can reuse them |

## 10. Later

- The action center in edit mode in a browser, with the same index.
- A page's status (Publish, back to Draft) on its card.
- Headings inside a page, to jump to one.
- People shared with (the Access screen's grants), found by name.
