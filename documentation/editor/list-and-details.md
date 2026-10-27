# Edit mode: list and details

The one pattern edit mode uses for every screen that manages a collection: a list of what's there on one side, the chosen item's details on the other. Sections, Recommendations, Access, Albums and Home highlights follow it, and every new screen that adds, chooses, edits, orders or removes things follows it too. This page is the pattern's spec: when it applies, its anatomy (built from shared pieces, never copied), how it behaves, and how it's checked.

> **TL;DR.**
> - **When:** a screen manages several things of one kind (sections, people, codes, albums, slides). A screen that edits one object (Settings, Ways to explore) or works on a canvas or grid (the article editor, the themes panel, Media, the album editor) doesn't use it.
> - **Shape:** `SplitView`, with `ListPane scroll="rows"` in its list slot (the screen's settings row in `head`, the Add action in `add`, the items as `ListLink` rows) and a `DetailPane` beside it (the chosen item's heading, line, own actions, then its form).
> - **Behaviour:** the choice is in the address (`?<key>=`), choosing redraws one region without a reload, every action saves on its own with the file's version, unsaved input is never lost, and removing takes two presses.
> - **Never:** one long form for the whole collection, cards that each hold a form, or a screen's own copy of the list and details layout.
> - **Checked by:** `tests/unit/editorDesignSystem.test.ts` (the managers compose the kit pieces; no copied layout CSS) and each screen's E2E.

## 1. Why one pattern

The owner manages his site by screens that look and work alike, so that learning one teaches the rest. Sections, Recommendations and Access were built on this pattern, but new screens were still built another way (Home highlights was first a single long form of cards), and each time he had to ask for it again. This page makes the pattern the default an agent or a contributor reaches for without being told.

| ID | Statement |
|---|---|
| P1 | Every screen that manages a collection looks and works the same way, so the owner knows how to use a new one at first sight. |
| U1 | I can see everything in the collection at once, in its order, with each item's state in a line. |
| U2 | I can choose an item and see and change all of its details, without losing my place in the list. |
| U3 | I can add an item from the top of the list, whatever is chosen, and I land on the new item. |
| U4 | I can change the order, and remove an item, from its details, and nothing is lost by a slip. |
| U5 | I can change the screen's own settings (where the collection shows, how) from the first row of the list. |
| U6 | I can go back and forward through my choices, and share or reload the address of one. |

## 2. When it applies

Use list and details when a screen lets someone **add, choose, edit, order or remove** several things of the same kind, each with more than a name to edit.

| Screen | List | Details | Its key |
|---|---|---|---|
| Sections (and Planet, the same manager) | Sections, the site's settings | A section's Pages and Settings tabs | `?section=` |
| Recommendations | Where they show, then the people | A person, or where they show | `?rec=` |
| Access | Codes and links, by state | A grant, or a new one | `?grant=` |
| Albums (the list view) | The gallery's settings, then its albums | Opens the album editor | the album's address |
| Home highlights | Carousel settings, then the slides | A slide, the settings, or a new slide | `?slide=` |

It doesn't apply to:

- **a screen that edits one object:** Settings, Ways to explore, Navigation (one menu, previewed as it reads), the themes panel;
- **a canvas or a grid of pictures:** the article editor, the album editor (a studio like the article editor's since 28 October 2026: the list of albums docked beside its grid, and an inspector), Media and the Albums tiles view, where the pictures are the list;
- **a report:** the dashboard, Save to remote, Tests.

One screen is a **known exception, waiting on a rebuild:** **AI** (`/_edit/ai/`). Its services are a collection (added, edited, tested and removed one by one), but it shows them as cards with a form each, and Remove asks with the browser's own confirm instead of a two-press Remove. It was built before this pattern was written down (AI services stage S4) and is recorded here rather than counted as following it. The rebuild puts the services in a `ListPane` (the writer and the decider as its settings row, Add a service in `add`) beside a `DetailPane` for the chosen service (its model, private pages, Test and a two-press Remove), keyed by `?service=` ([AI services §16](./ai-services.md#16-as-built)). It's the owner's to schedule, and until then no new screen may follow its lead.

A new screen that seems to need something else is a design decision for the owner, not a default.

## 3. Anatomy

Every piece is a shared one: a screen composes them, and adds styles only for its own form's parts.

```
SplitView                                   (a website compound: the two columns, stacked under 56 rem)
├─ list slot: ListPane scroll="rows"       (kit: sticky, raised, ruled; only its rows scroll)
│  ├─ head:  ListLink icon="settings"      (the screen's own settings, ruled off from the items)
│  ├─ add:   Button variant="primary" block (Add <thing>; a count line under it if there's a limit)
│  └─ rows:  PlainList as="ol" > li > ListLink (name, one state line, a mark: icon, face or picture)
│            or a muted Text when the collection is empty
└─ details: DetailPane                     (kit: heading, line, own actions, then the form)
   ├─ lead:    a face or a picture (optional)
   ├─ tags:    Hidden, Private (optional)
   ├─ actions: ActionBar gap="sm" with Move up and Move down
   └─ Form > parts (Heading level 3) > fields, IssueNote, ActionBar (Save, then the quiet Remove)
```

| Part | Rule |
|---|---|
| The settings row | First, above a rule, when the collection has screen-wide settings (where it shows, how). Named for what it sets ("Carousel settings", "Where they show"), with a one-line summary of the current settings. |
| Add | A primary button at the top of the list, always in view, labelled "Add <thing>" (a verb and the glossary's word). It opens a details pane for the new item, not a dialog. At a limit it's disabled and the line under it says how to make room. |
| Adding by choosing | When the new item is one of many existing things that differ (a home slide's source), the details for `new` are two steps under the same heading: a **sources step** (one choice per kind with its count and a line on what it shows, a search, tiles with each one's picture, name, kind and status, pictures drawn on demand in their own region) and a **preview step** (the item as it will show, drawn by its real renderer, its details, what it needs if it waits, then Add). The step is in the address (`?slide=new&source=`). Never a dropdown of titles. [Home highlights §2.1](../home-views/highlights.md#21-adding-a-slide-choose-by-seeing) is the first. |
| A row | A `ListLink`: the item's name, one line of state (its kind, Hidden, Waiting: why), and a mark (`icon`, or the `mark` slot for a face or a picture). The chosen row is `current`. No buttons inside a row: the item's actions are in its details. |
| The details | A `DetailPane` named by its heading (the item's name; "Add <thing>" for a new one). Its form is labelled by the same heading. Parts of the form are headed sections, a set space apart. |
| Own actions | Order and removal belong to the item: Move up and Move down at the header's end (disabled at the ends); Remove (quiet, last) in the form's action bar, beside Save. |
| Empty | The list says what's missing and what to do ("No slides yet… Add the first: …"); the details show the new item's form. |

The details keep a form's measure (`--size-popout`) however wide the screen; the list keeps its own width (`c.split-view`).

## 4. Behaviour

| ID | Behaviour |
|---|---|
| B1 | **The choice is in the address.** Each screen has one key (`?slide=`, `?rec=`); `new` and `settings` are reserved values. A missing or unknown value chooses the first item, else `new`. Reload, back and forward show the same choice (`popstate`). The rule is pure and unit-tested (`chosenSlide` in `model/highlights.ts`). |
| B2 | **Choosing redraws one region.** A row is a real link; the script intercepts it, pushes the address and calls `swapRegions([<region>])`, so the list keeps its scroll and the page doesn't reload. Without the script, the link still works. |
| B3 | **Unsaved input is never lost.** Choosing another item with unsaved changes asks first; a change made elsewhere (`onContentChange`) redraws the screen only when nothing is unsaved. |
| B4 | **Each action saves on its own.** Save, Add, Move and Remove each write the file once through the store, with its version (`ifMatch`), and report through `saveStatus`. A conflict (409) keeps what was typed and says so; a refusal (422) is shown in the form's `IssueNote`. |
| B5 | **Removing takes two presses.** The first turns the button into "Remove for good" or "Delete for good" (`data-confirm`); the second removes it. Afterwards the item that took its place is chosen (the next, else the new last), else `new`. |
| B6 | **Focus stays where the person is.** After choosing, focus stays on the chosen row (on Add, it goes to the new item's first field); after a move, on the same Move button, unless the item reached that end (then on the other); after a removal, on the newly chosen row. |
| B7 | **Phones.** Under 56 rem the list sits above the details and its rows scroll within a cap (`--c-editor-scope-list`), so the details are never pushed out of reach. |
| B8 | **Nothing above the list moves.** The screen's heading and line are the same whichever item is chosen, and the list and the details start at the same place; the details open with the item's name as their heading and a line, as every other details pane does. When choosing an item opens a page of its own that isn't a list and details (an album opens the album editor, a studio), the list is docked in that page's own frame instead, with the open item marked. |

## 5. Building a new screen on it

1. Put the collection's pure rules in `src/site/editor/model/<name>.ts` with unit tests: the choice from the address, each row's line, the settings line, the add choices, and add, update, move and remove as pure functions.
2. Make the part (`src/site/editor/components/<Name>Manager.astro`) from `SplitView`, `ListPane scroll="rows"`, `ListLink`, `PlainList`, `DetailPane`, `Form`, `IssueNote` and `ActionBar`. Its root carries `data-region` and its state in a JSON data script. Its own styles are only its form's parts.
3. Write its script after `scripts/recommendations.ts` or `scripts/highlights.ts`: `show`, `leave`, one save per action, `onContentChange`.
4. Give it a story with sample data (`stories/samples.ts`), an entry in the editor's design-system test's list of managers, and an E2E that chooses, adds, edits, moves and removes.
5. If it needs something the kit doesn't have, add it to the kit piece (a slot, a prop) with its story, never to the screen.

## 6. How it's checked

- `tests/unit/editorDesignSystem.test.ts`:
  - every collection manager (`MANAGERS`) imports `SplitView`, `ListPane` and `ListLink`;
  - no part defines the pattern's old copied classes;
  - fewer than 10 identical declaration blocks are copied between parts and kit.
- Each screen's E2E (`--project=editor`) chooses, adds, saves, moves and removes through the pattern.
- The parts library (`/_edit/library/`) shows `ListPane`, `ListLink` and `DetailPane` with every option, and each manager in its states.
- The `visual` project captures those stories in light and dark.

## 7. As built

- **24 October 2026.**
  - `ListPane` gained `scroll="rows"`, with `head` and `add` slots, so the list column's three parts are drawn once.
  - `ListLink` gained `icon`, a mark from the icon set as wide as a face.
  - The new `DetailPane` draws the details' header.
  - Recommendations, Albums (its list) and Home highlights were moved onto them, removing their copied layout CSS.
  - Home highlights was rebuilt from a single form of cards into this pattern ([highlights spec §2](../home-views/highlights.md)).
  - Sections (its own `SectionManager` with tabs) and Access (`GrantDetails`, with its state groups) keep their own list contents inside the same `SplitView` and `ListPane`.
  - The album editor took the Albums screen's heading and line, and its details open with the album's name (B8), so choosing between the gallery and an album no longer moves the list up and down (the owner's report, 24 October 2026).
- **28 October 2026.** The album editor became a studio (the article editor's `Studio`, in its `flow` form): the list of albums is docked as its outline (`ListPane docked`, `AlbumList docked`), the album in the middle, and an inspector on the right, so it no longer draws the Albums screen's heading and line (B8 as changed) ([gallery spec §9.2](../gallery/spec.md#92-the-album-editor)).
