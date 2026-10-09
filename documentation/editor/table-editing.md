# Inline table editing

> **TL;DR:** Edit a simple editorial table directly in the article canvas. Click or tap a cell to type, use a compact grid keyboard model, and add, move, duplicate, clear or remove rows and columns from contextual controls. Keep the existing semantic table, content limits, Markdown cells, autosave, undo and inspector fallback. Deliberately do not copy Notion's database features, merged cells, arbitrary colours or mouse-only interactions. Unlike Notion's documented limitation, pasting a rectangular range from a spreadsheet must work atomically.

**Status:** Planned  
**Research reviewed:** 9 October 2026

## 1. Scope

This specification covers the article editor's `table` content block. It is a small, static, presentational table for editorial content. It is not a database, spreadsheet or layout tool.

The implementation must:

- make cell and structure editing direct in the real-page canvas;
- preserve the public page's native `<table>` semantics;
- preserve the current content contract and limits;
- remain usable with keyboard, mouse, touch and assistive technology;
- retain the inspector as a settings and bulk-edit fallback;
- use the parent editor's document, history, save, conflict and live-update systems;
- add no editor code or attributes to production output.

The implementation must not add sorting, filtering, formulas, typed properties, relations, database rows, calculations, arbitrary cell styling or blocks nested inside cells.

## 2. Research method

The research separates three kinds of evidence:

1. **Official behavior** is stated by a current Notion help, release or API page.
2. **Corroborated behavior** appears in a detailed third-party walkthrough and agrees with the official model.
3. **Unknown behavior** was not stated clearly enough to treat as a product fact.

Generic shortcut lists often say "Notion table" without distinguishing a simple table from a database table. This specification does not use those claims as evidence.

### 2.1 Primary sources

| Source | Evidence used |
| --- | --- |
| [Columns, headings and dividers](https://www.notion.com/help/columns-headings-and-dividers) | Creating a simple table; edge buttons; corner drag; column resize; header row and column; cell colour and clearing; fit to page width; rectangular merge; the explicit inability to paste multiple simple-table cells |
| [Simple tables versus databases](https://www.notion.com/help/guides/simple-tables-vs-databases) | The simple-table purpose; click-to-edit; horizontal `Tab` navigation; row and column operations; reorder; comments; conversion to a database |
| [Keyboard shortcuts](https://www.notion.com/help/keyboard-shortcuts) | The generic table shortcut to fill a selected range right or down; general block selection and movement |
| [Writing and editing basics](https://www.notion.com/help/writing-and-editing-basics) | Notion's block selection, drag and mobile editing model |
| [Notion 2.14 release](https://www.notion.com/releases/2021-11-16) | The original simple-table interaction and header toggles |
| [Merge cells release](https://www.notion.com/releases/2026-05-26) | The newer select-then-merge interaction |
| [Notion block API](https://developers.notion.com/reference/block#table) | A simple table is a fixed-width set of rows whose cells contain rich text; header-row and header-column flags are separate table properties |
| [Enhanced Markdown](https://developers.notion.com/guides/data-apis/enhanced-markdown#table) | Table cells contain rich text rather than nested blocks; fit-width and header flags are table-level properties |

The detailed third-party guide [Notion simple tables](https://thomasjfrank.com/notion-simple-tables/) corroborates rich-text cells, row and column reordering, and the absence of nested blocks and multi-cell spreadsheet paste. It is not authority where current official documentation differs.

### 2.2 Accessibility sources

Notion does not publish a table-specific accessibility interaction contract. The site's target behavior therefore follows:

- the [WAI-ARIA Authoring Practices data-grid pattern](https://www.w3.org/WAI/ARIA/apg/patterns/grid/) for roving focus, cell navigation and entering or leaving cell edit mode;
- [WCAG 2.2 SC 2.5.7](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html), which requires a single-pointer alternative to dragging;
- [WCAG 2.2 SC 2.5.8](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html), while retaining this site's stronger 44 px target rule.

## 3. What Notion does

### 3.1 Confirmed simple-table behavior

| Area | Confirmed behavior |
| --- | --- |
| Purpose | A lightweight visual matrix for notes and documentation, separate from databases |
| Cell content | Rich text, not nested content blocks |
| Direct editing | Click a cell and type |
| Keyboard | `Tab` moves horizontally while content is added |
| Add structure | Add one row at the bottom, one column at the right, or drag the corner to change both dimensions |
| Row and column menus | Insert, remove and reorder structure from contextual handles |
| Column size | Drag a column edge |
| Headers | Independently toggle the first row and first column as headers |
| Cell presentation | Set text or background colour and clear the cell |
| Table width | Fit the table to the containing page or column |
| Range actions | Select a rectangular group for merging; a generic table shortcut fills a selected range right or down |
| Promotion | Turn a simple table into a database when filters, sorts, typed properties or row pages become necessary |
| Spreadsheet paste | Not supported across multiple simple-table cells |

The fill shortcut is documented for "a table" but the shortcut page does not say whether that means simple tables, database tables or both. It is not used as a requirement here.

### 3.2 Simple table versus database

A Notion simple table stores formatted text in a visual grid. A database table stores typed properties, and every row can be a page. Sorting, filtering, formulas, calculations, multiple views and relations belong to the database.

That distinction is the right one for this site. Article tables explain content; they do not become a second content-management system.

### 3.3 Unknown or insufficiently documented behavior

The research did not find authoritative simple-table definitions for:

- arrow, `Enter`, `Shift+Tab` and `Escape` behavior in and between cells;
- row-height controls;
- a cell text-alignment control;
- simple-table wrap controls;
- touch-specific structure editing;
- undo granularity for cell and structure changes;
- screen-reader roles, announcements and focus recovery.

These are not copied by guesswork. Section 7 defines them for this editor.

## 4. Product decisions

| Notion pattern | Decision for this site | Reason |
| --- | --- | --- |
| Click a cell and type | Adopt | Direct manipulation is the primary goal |
| `Tab` through cells | Adopt and complete | Add a documented two-mode keyboard model instead of relying on undocumented behavior |
| Edge buttons to add rows and columns | Adopt | Fast and discoverable |
| Drag to reorder rows and columns | Adopt with menu alternatives | Useful for pointer users; alternatives are required by WCAG |
| Corner drag to change both dimensions | Do not adopt | Imprecise, hidden on touch and unnecessary beside explicit add controls |
| Per-column drag resize | Defer | It requires a new persistent width model and adds horizontal-layout complexity |
| Fit to page width | Adapt | Keep the existing `content`, `popout` and `wide` design-system widths |
| Optional header row | Do not adopt | Every site table keeps mandatory column headings for comprehension and accessibility |
| Optional header column | Keep | This is the existing `rowHeadings` setting |
| Cell text and background colours | Do not adopt | Editorial tables use design-system roles, not author-selected styling |
| Merge cells | Do not adopt | Spans complicate editing, paste, responsive behavior and header associations |
| Multi-cell selection and fill | Defer | The first release does not need spreadsheet selection once paste-to-grid works |
| Multi-cell spreadsheet paste | Improve on Notion | This removes a documented Notion pain point and is important for real editorial data |
| Turn into database | Do not adopt | The site has no database-table block |
| Inline comments | Out of scope | The local, single-owner CMS has no collaboration model |

## 5. Current site contract

The authoritative schema is [`src/site/content/schema.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/content/schema.ts):

- one to eight required, non-empty column headings;
- each heading is at most 80 characters;
- one to 60 body rows;
- every body row has exactly one cell per column;
- body cells contain one line of inline Markdown and may be empty;
- `rowHeadings` makes the current first column row headers;
- `caption` is optional;
- width is `content`, `popout` or `wide`.

The public renderer is [`Table.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/Table.astro), reached from [`Blocks.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/content/Blocks.astro). It already provides:

- a native `<table>` and `<thead>`;
- `scope="col"` column headings;
- optional `scope="row"` row headings;
- a caption;
- a focusable horizontal overflow region;
- content-sized, horizontally scrollable cells on small screens.

The editor currently serializes the whole matrix into one pipe-separated inspector field through [`table.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/model/table.ts). The first line is the headings, later lines are rows and `\|` represents a literal pipe. Malformed row widths are refused.

The canvas in [`canvas.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/scripts/canvas.ts) edits text-like blocks through messages to the parent. The parent in [`editor.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/scripts/editor.ts) owns the article, undo history, save queue, conflicts and refreshes. Inline table editing must preserve that ownership boundary.

## 6. Target experience

### 6.1 First contact

1. Selecting a table block shows a subtle edit outline.
2. Clicking or tapping cell text places the caret at that point and enters cell edit mode.
3. Tabbing into the table focuses one cell in navigation mode. The last focused cell is restored while the article remains open; otherwise the first column heading receives focus.
4. The active cell reveals one row handle, one column handle, an add-row button below the table and an add-column button at its inline end.
5. The inspector continues to show caption, row-heading and width settings. The old text matrix moves under a collapsed **Bulk edit table** disclosure.

The cell data remains the source of truth. The overlay controls never become part of saved article HTML.

### 6.2 Modes

| Mode | Focus | Meaning |
| --- | --- | --- |
| Idle | Outside the table | The table is ordinary article content |
| Block selected | Table frame or existing block control | Whole-block move, duplicate and delete are available |
| Cell navigation | One header or data cell | Arrow keys navigate; structure controls apply to that row or column |
| Cell editing | The active cell's text editor | Typing and inline formatting edit that cell |
| Structure menu | A row or column menu | The menu owns focus until an action or dismissal |
| Dragging | A row or column handle | A preview indicates the destination; data changes only on drop |

### 6.3 State transitions

| From | Action | To | Result |
| --- | --- | --- | --- |
| Idle or block selected | Click or tap cell text | Cell editing | Put the caret at the pointer position |
| Idle or block selected | `Tab` into table | Cell navigation | Focus the remembered or first cell |
| Cell navigation | `Enter`, `F2` or printable character | Cell editing | `Enter`/`F2` place the caret at the end; a printable character replaces the cell selection and starts text input |
| Cell editing | `Escape` | Cell navigation | Commit the current value and restore cell focus |
| Cell navigation | `Escape` | Block selected | Return to the existing block-level canvas model |
| Cell navigation | Open row or column handle | Structure menu | Focus the first enabled menu item |
| Structure menu | `Escape` | Cell navigation | Close the menu and restore its cell |
| Cell editing | Blur to editor UI | Cell navigation or idle | Commit before focus moves |
| Dragging | `Escape` | Cell navigation | Cancel with no content change |

`Escape` exits rather than cancels cell edits. Undo is the way to reverse a committed change. This avoids an autosave race and matches the editor's existing continuous-save model.

## 7. Interaction contract

### 7.1 Keyboard in cell navigation mode

The edit canvas uses the WAI-ARIA data-grid conventions:

| Key | Behavior |
| --- | --- |
| `Right Arrow` / `Left Arrow` | Move one cell in the same row; do not wrap |
| `Down Arrow` / `Up Arrow` | Move one row in the same column; the heading row is above body row zero |
| `Home` / `End` | Move to the first or last cell in the current row |
| `Ctrl/Cmd+Home` / `Ctrl/Cmd+End` | Move to the first or last cell in the table |
| `Enter` or `F2` | Enter cell edit mode |
| Printable character | Enter edit mode and replace the cell's current text selection |
| `Delete` | Clear a body cell; do not clear a required heading |
| `Ctrl/Cmd+C` | Copy the selected cell as plain text |
| `Ctrl/Cmd+X` | Copy and clear a body cell; copy but do not clear a heading |
| `Ctrl/Cmd+V` | Paste one value or a rectangular grid at the active cell |
| `Escape` | Select the whole table block |
| `Tab` / `Shift+Tab` | Leave the grid for the next or previous page control |

Only one cell is in the page tab sequence. Navigation changes the roving `tabindex`.

### 7.2 Keyboard in cell edit mode

| Key | Behavior |
| --- | --- |
| Arrow keys, `Home`, `End` | Move the text caret normally |
| `Tab` | Commit and edit the next cell in row-major order |
| `Shift+Tab` | Commit and edit the previous cell |
| `Tab` from the last body cell | Add one row when below the 60-row limit, then edit its first cell |
| `Tab` from the last body cell at the limit | Commit and move focus to the next page control |
| `Shift+Tab` from the first heading | Commit and move focus to the previous page control |
| `Enter` | Commit and return to navigation mode in the same cell |
| `Shift+Enter` | Same as `Enter`; table cells remain one line |
| `Escape` | Commit and return to navigation mode |
| `Ctrl/Cmd+B`, `Ctrl/Cmd+I`, other supported inline commands | Use the existing inline-Markdown formatting behavior in body cells |

Composition events must complete before navigation or commit logic runs. Key handlers must not split an IME composition.

Column headings are plain text. Their cell editor does not offer inline formatting. Body and row-heading cells support the same inline Markdown the public renderer already accepts, but never block content or hard line breaks.

### 7.3 Pointer and touch

- Clicking or tapping text enters edit mode at the intended caret position.
- Clicking cell padding selects the cell in navigation mode.
- Row and column handles appear for the active cell, not for every cell.
- A mouse or pen can drag a handle to reorder. The insertion indicator appears between rows or columns, auto-scrolls the table's overflow region near an edge and does not mutate data until drop.
- A tap opens the same handle menu. Dragging is never the only route to an action.
- Touch does not depend on hover. Controls for the active cell remain visible until focus leaves the table.
- Every actionable control is at least 44 by 44 CSS pixels without making every table cell a 44 px button.
- Horizontal pan in the table's overflow region must not start a row or column drag. Drag starts only from the named handle after the normal movement threshold.

### 7.4 Row menu

The row menu applies only to body rows and contains:

1. **Insert row above**
2. **Insert row below**
3. **Move row up**
4. **Move row down**
5. **Duplicate row**
6. **Clear row**
7. **Delete row**

Move items are disabled at their respective edges. Insert and duplicate are disabled at 60 rows. Delete is disabled when only one body row remains.

After an operation, focus follows the affected row at the same column where possible. Deleting the active row focuses the row now at that index, or the preceding row when the last row was deleted.

### 7.5 Column menu

The column menu contains:

1. **Insert column left**
2. **Insert column right**
3. **Move column left**
4. **Move column right**
5. **Duplicate column**
6. **Clear column**
7. **Use as row headings** or **Stop row headings**, only for the first column
8. **Delete column**

Move items are disabled at their respective edges. Insert and duplicate are disabled at eight columns. Delete is disabled when only one column remains.

Column operations transform the heading and every body row together. A new heading is `Column N`, where `N` is the first positive number that makes the label different from existing generated labels. A duplicated heading adds ` copy`, then the smallest numeric suffix needed to distinguish repeated generated copies.

`rowHeadings` is positional. When it is on, whichever column is currently first is the row-heading column. Moving, inserting or deleting a first column does not attach the setting to the displaced content.

### 7.6 Add controls

- **Add row** appends one empty row and edits its first cell.
- **Add column** appends an empty column, creates its heading and edits that heading.
- At a limit, the corresponding control remains discoverable but disabled and exposes the reason in its accessible description.
- Every successful operation is announced, for example: "Row added. 4 rows." or "Column moved to position 2 of 5."

### 7.7 Cell validation

- A heading may be temporarily empty while its editor has focus.
- Commit is blocked if a heading is empty or longer than 80 characters. Focus stays in that heading and the live region says how to fix it.
- Body cells may be empty.
- Hard line breaks are replaced with spaces during ordinary rich-text paste.
- Inline Markdown is serialized through the existing editor path, not reconstructed from `innerText`.
- A failed operation leaves the article and DOM unchanged.

## 8. Clipboard and spreadsheet interoperability

### 8.1 One-cell paste

Plain or rich text without a table-shaped payload replaces the active cell selection. Rich text is converted to supported inline Markdown. Unsupported block structure is flattened to one line.

### 8.2 Rectangular paste

A paste is a rectangular grid when either:

- `text/html` contains a table; or
- `text/plain` contains a tab or more than one line.

The parser prefers an HTML table, then falls back to tab-separated plain text with `CRLF` and `LF` row endings. It preserves empty cells, including trailing empty cells. Commas alone never imply a grid.

The active cell is the top-left anchor:

- a body-cell anchor writes only body cells;
- a heading anchor writes its first pasted row to headings and later rows to body cells;
- the table expands right or down as needed, within eight columns and 60 body rows;
- columns created by a body-anchored paste receive generated headings;
- an empty or overlong pasted heading rejects the whole paste;
- a non-rectangular payload is padded with empty cells to the widest pasted row;
- the entire paste is one validation, history and save transaction;
- any limit or validation failure rejects the whole paste and explains how to fix it;
- after success, the bottom-right written cell receives navigation focus and a live region announces the pasted dimensions.

The editor must not partially paste a range.

### 8.3 Copy

The first release copies one selected cell or the current text selection. Rectangular range selection and range copy are deferred. The inspector's bulk editor remains available for whole-table extraction.

## 9. Pure table operations

Keep text serialization in [`table.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/model/table.ts). Add a pure `src/site/editor/model/tableGrid.ts` for cell and structure operations.

```ts
type TableCell = {
  row: "header" | number;
  column: number;
};

type TableOperation =
  | { type: "set-cell"; cell: TableCell; value: string }
  | { type: "insert-row"; at: number }
  | { type: "duplicate-row"; row: number }
  | { type: "move-row"; from: number; to: number }
  | { type: "clear-row"; row: number }
  | { type: "delete-row"; row: number }
  | { type: "insert-column"; at: number; heading?: string }
  | { type: "duplicate-column"; column: number }
  | { type: "move-column"; from: number; to: number }
  | { type: "clear-column"; column: number }
  | { type: "delete-column"; column: number }
  | { type: "set-row-headings"; value: boolean }
  | { type: "paste-grid"; anchor: TableCell; cells: string[][] };
```

The module exposes one operation dispatcher returning either a new valid table and next focus or a typed problem:

```ts
type TableGridResult =
  | { ok: true; table: TableBlock; focus: TableCell; announcement: string }
  | { ok: false; code: TableGridProblem; message: string };
```

Every successful result must satisfy the content schema. Operations do not mutate their input. The module owns:

- bounds and rectangularity;
- generated headings;
- row and column limit checks;
- focus recovery after deletion and movement;
- Markdown-cell normalization;
- atomic paste expansion;
- announcements that require row or column counts.

The DOM scripts do not duplicate these rules.

## 10. Canvas and parent message contract

### 10.1 Rendered edit metadata

[`Blocks.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/content/Blocks.astro) passes an edit-only flag to [`Table.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/Table.astro). Only in the editor canvas:

- the table wrapper identifies itself as an editable table;
- every heading and body cell exposes stable zero-based row and column coordinates;
- the actual text has a dedicated editable span;
- no saved content ID is invented from an array position.

The production renderer remains unchanged when the flag is absent. Production builds contain no `data-editor-*` attributes.

### 10.2 Canvas state

[`canvas.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/scripts/canvas.ts) owns ephemeral presentation state only:

- active cell and mode;
- caret and selection;
- roving `tabindex`;
- menu anchor and drag preview;
- edit-only controls;
- optimistic DOM text while a parent update is in flight.

It never owns the article, writes content files or reports a save as successful.

In navigation mode, the table is exposed as an ARIA `grid`; headings are `columnheader`, first-column headings are `rowheader`, and other cells are `gridcell`. The grid references the visible caption when one exists, otherwise it receives the accessible name "Edit table". In edit mode, the active text span is a single-line `textbox`.

### 10.3 Messages

Extend the existing typed canvas message union with:

```ts
type TableCanvasMessage =
  | {
      type: "editor:table-cell";
      block: number;
      cell: TableCell;
      markdown: string;
      session: string;
      phase: "input" | "commit";
    }
  | {
      type: "editor:table-operation";
      block: number;
      operation: TableOperation;
      request: string;
    };
```

The parent responds to a structure request with the authoritative table, focus cell, announcement and matching request ID, or a typed error. The canvas ignores stale responses.

The `session` is created when a cell first enters editing and ends on commit. The parent creates one undo checkpoint for the session, regardless of the number of input messages. Inputs update the in-memory article and use the normal debounced save queue. Commit flushes the final value through that queue; it does not create another checkpoint.

An empty or overlong heading is the exception: the parent holds it as the session's explicit draft instead of placing invalid data in the article or save queue. The editor remains dirty, the inspector continues to show the last valid table and commit remains blocked. As soon as the draft is valid, the parent applies it through the same session and save queue.

Every structure operation and rectangular paste is one undo checkpoint and one save transaction.

### 10.4 Parent ownership

[`editor.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/scripts/editor.ts):

1. validates the origin, source window, article and block index using the existing message guards;
2. confirms that the indexed block is still a table;
3. applies the pure operation to the parent article;
4. updates undo history once at the required boundary;
5. mirrors the new matrix into an open bulk-edit field;
6. queues or flushes save status through the existing mechanism;
7. tells the canvas the authoritative result.

Cell typing must not reload the iframe. A structure operation may replace the table region, but not the whole canvas, and must restore focus by coordinate after the swap.

## 11. Saving, undo, conflicts and live updates

- The first input in a cell-editing session creates one undo checkpoint. Further input in the same session does not.
- Moving to another cell commits the first session and starts another only when that cell changes.
- A row or column action, drag drop or rectangular paste is one checkpoint.
- Undo and redo restore cell values, dimensions, order, `rowHeadings` and focus together.
- The normal `dirty`, `saving`, `saved`, `failed` and `carry` states remain authoritative. Table controls never display a second save status.
- On a validation failure, nothing is queued and the editor announces the actionable error.
- On a server failure, the normal failed state remains visible; the optimistic table is not described as saved.
- An article version conflict uses the existing conflict flow. Unsaved active-cell text is preserved as the local side of the conflict.
- A same-article live update from another tab refreshes an inactive table. If it intersects an active local table session, the editor preserves the local input and surfaces the existing conflict path rather than silently replacing it.

## 12. Inspector fallback

The inspector remains necessary for:

- caption;
- row-heading semantics;
- `content`, `popout` and `wide` width;
- whole-table pipe-separated bulk editing;
- a non-visual recovery path if canvas scripting is unavailable.

Rename the existing **Cells** field to **Bulk edit table** and put its explanation and textarea in a collapsed disclosure. Opening it serializes the current parent document, not stale canvas HTML. A valid bulk change replaces the table in one history and save transaction, then refreshes the canvas region. An invalid matrix keeps the previous table and existing error behavior.

## 13. Responsive behavior

- Public rendering does not change.
- Edit controls are positioned relative to the visible table, not the page viewport.
- When a table scrolls horizontally, the active cell and its controls remain reachable.
- Focus navigation scrolls the newly active cell into view with the minimum movement.
- On a 320 px viewport, controls may overlay editor-only space but must not create page-level sideways scrolling.
- The row handle stays at the table's inline start; the column handle stays above the active column.
- Touch actions use menus rather than requiring precision drag.
- Zoom at 200 percent and larger text must not clip the menu, announcement or active-cell outline.

## 14. Error copy

Errors say what happened and how to fix it:

| Condition | Copy |
| --- | --- |
| Empty heading | "Column headings cannot be empty. Add a heading to continue." |
| Heading too long | "Column headings can have up to 80 characters. Shorten this heading." |
| Too many columns | "This table can have up to 8 columns. Remove a column or paste a smaller range." |
| Too many rows | "This table can have up to 60 rows. Remove a row or paste a smaller range." |
| Last column delete | "A table needs at least one column." |
| Last row delete | "A table needs at least one row." |
| Invalid paste | "That range could not be pasted. Copy a rectangular set of cells and try again." |
| Stale operation | "The table changed before that action finished. Review the latest table and try again." |

Errors are announced in the editor's existing live region and associated with the relevant cell or control. They are not browser alerts.

## 15. Implementation sequence

### Phase 1: pure model

1. Add `tableGrid.ts` and typed problems.
2. Add exhaustive unit tests for every operation, limit and focus result.
3. Add HTML-table and TSV parsing to the existing pure rich-paste layer.

### Phase 2: semantic edit surface

1. Add conditional edit metadata to the renderer.
2. Add grid navigation, edit mode and cell messages to the canvas.
3. Connect the parent document, history and save queue.
4. Move the current matrix field into the bulk-edit disclosure.

### Phase 3: structure controls

1. Add row, column and edge controls.
2. Add menus and single-pointer move alternatives.
3. Add drag previews and drop behavior after the menu operations pass.
4. Add announcements and focus recovery.

### Phase 4: clipboard and hardening

1. Add atomic rectangular paste and expansion.
2. Add conflict and cross-tab cases.
3. Run keyboard, touch, phone, zoom and assistive-technology checks.
4. Verify that production output contains no editor implementation.

Per-column widths, rectangular range selection, range copy, fill right/down and merge remain separate proposals. They are not hidden requirements of these phases.

## 16. Test contract

### 16.1 Unit tests

Pure tests must cover:

- setting headings and body cells;
- empty and 81-character heading refusal;
- every row and column insertion position;
- moving first, middle and last rows and columns;
- duplicate and generated-heading collisions;
- clearing without changing dimensions;
- refusing deletion of the final row or column;
- first-column `rowHeadings` semantics after insert, move and delete;
- rectangularity after every operation;
- 8-column and 60-row boundaries;
- HTML table paste;
- TSV with `LF`, `CRLF`, empty and trailing cells;
- padding ragged pasted rows;
- body-anchored expansion and generated headings;
- heading-anchored paste;
- atomic rejection on heading or size errors;
- stable next-focus coordinates;
- input immutability;
- one-line Markdown normalization.

### 16.2 Editor browser tests

Extend [`tests/e2e/editor.spec.ts`](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/editor.spec.ts) to prove:

1. pointer editing of a heading and body cell persists after reload;
2. supported inline Markdown renders after editing;
3. arrows, `Home`, `End`, `Enter`, `F2`, `Escape`, `Tab` and `Shift+Tab` follow this contract;
4. `Tab` from the last cell adds one row;
5. row and column menu operations save, undo and redo as one step;
6. drag reorder and its menu alternative produce the same content;
7. paste from a spreadsheet expands atomically;
8. an oversized or invalid paste changes nothing and announces the fix;
9. the inspector mirrors an inline change and bulk edit refreshes the canvas;
10. a save failure never reports success;
11. a cross-tab update preserves active local input and exposes a conflict;
12. row and column controls remain usable through real touch events;
13. controls remain reachable at 320 px and 200 percent zoom;
14. the edit grid has one tab stop, correct roles and names, and no axe violations;
15. the public article still renders a native semantic table without edit controls.

### 16.3 Production checks

The production verification must continue to fail if `/_edit/`, editor chunks, editor tokens or `data-editor-*` markers reach `dist/`.

## 17. Definition of Done

| ID | Requirement |
| --- | --- |
| TBL-01 | A heading or body cell can be edited directly in the canvas and survives reload |
| TBL-02 | The two-mode keyboard contract is complete, documented and covered by browser tests |
| TBL-03 | Rows and columns can be inserted, moved, duplicated, cleared and deleted without opening the bulk editor |
| TBL-04 | Every drag action has an equivalent tap or click menu action |
| TBL-05 | Controls are at least 44 px, work with touch and do not cause page-level overflow at 320 px |
| TBL-06 | HTML-table and TSV ranges paste atomically, expand within limits and undo in one step |
| TBL-07 | Pure operations preserve rectangularity, schema validity and stable focus |
| TBL-08 | Cell typing, structure changes and paste use the parent editor's history, save status, conflict and live-update systems |
| TBL-09 | The inspector remains a synchronized settings and bulk-edit fallback |
| TBL-10 | Edit mode exposes an accessible grid while the public page remains a semantic native table |
| TBL-11 | Empty headings, limits, stale actions and invalid paste leave content unchanged and explain how to recover |
| TBL-12 | Production output contains no editor controls, attributes or code |
| TBL-13 | Unit, targeted editor E2E, phone, touch, zoom and axe checks pass |

## 18. Explicit non-goals

This work does not add:

- databases or conversion to them;
- sort, filter, formula, calculation or typed-property behavior;
- optional removal of the column-header row;
- merged cells or row and column spans;
- per-cell colour, alignment or typography controls;
- per-column persistent widths;
- blocks, media or lists inside cells;
- collaborative comments;
- arbitrary row heights;
- rectangular selection, fill or range copy in the first release.

Those features require their own content, accessibility and responsive-design decisions. They must not appear accidentally as side effects of inline editing.
