# Inline table editing

> **TL;DR:** Atiya's tables are small, static parts of portfolio articles and pages. Edit every cell directly in the real page, with the existing rich-text format bar for bold, italic, strikethrough, code and links. Add rows or columns with edge buttons, and use compact row or column menus to insert, move or delete them. Keep the current semantic table, responsive design, autosave, undo and inspector fallback. Do not build spreadsheet or database behavior.

**Status:** Planned  
**Research reviewed:** 9 October 2026

## 1. Fit for Atiya

Atiya is a personal portfolio. A table helps a reader compare short, static facts inside an article or page:

- responsibilities across workstreams;
- a before-and-after comparison;
- a compact schedule or sequence;
- a design or platform capability matrix;
- a short specification.

A table is not the right block for:

- paragraphs that should be read in sequence;
- a set of cards or project highlights, which is a collection;
- a small group of headline values, which is metrics content;
- page layout;
- data that needs sorting, filtering, calculation or frequent bulk updates.

The primary authoring task is changing words. Structural editing is secondary and should remain easy without turning the editor into a spreadsheet.

## 2. Product boundary

The first release provides:

- WYSIWYG rich-text editing in every cell, including column and row headings;
- `Tab` and `Shift+Tab` movement through cells;
- one button to append a row and one to append a column;
- row and column menus to insert, move or delete structure;
- caption, width, row-heading semantics and whole-table bulk editing in the inspector;
- the existing content limits: eight columns and 60 body rows.

It does not provide:

- multi-cell selection, copy, paste or fill;
- merged cells;
- drag reordering;
- manual column widths or row heights;
- author-selected colours, alignment, fonts or sizes;
- sorting, filtering, formulas, calculations or typed properties;
- nested blocks, lists or media inside a cell;
- database conversion or collaboration comments.

These are explicit non-goals, not later requirements hidden inside the MVP.

## 3. Notion as interaction reference

Notion's simple table is the reference for the frontend pattern, not the feature set:

- click a cell and type;
- select text to format it;
- move through cells with `Tab`;
- add a row at the bottom or a column at the side;
- use contextual row and column controls.

The behavior is documented in [Simple tables versus databases](https://www.notion.com/help/guides/simple-tables-vs-databases) and [Columns, headings and dividers](https://www.notion.com/help/columns-headings-and-dividers). Notion also supports resizing, colours, merge, drag and database conversion; Atiya deliberately does not.

Notion does not document a complete simple-table keyboard or accessibility contract. Atiya defines its own below.

## 4. Content contract

### 4.1 As built

The table block in [`schema.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/content/schema.ts) already has the right static shape:

```ts
type TableBlock = {
  type: "table";
  columns: string[];
  rows: string[][];
  rowHeadings?: boolean;
  caption?: string;
  width?: "content" | "popout" | "wide";
};
```

- `columns` has one to eight required headings.
- `rows` has one to 60 body rows.
- Every row has exactly one cell per column.
- Body cells are one line of inline Markdown and may be empty.
- `rowHeadings` makes the current first column row headers.

Body cells already render rich text through [`Blocks.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/content/Blocks.astro) and [`Table.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/Table.astro). Column headings currently render as plain strings.

### 4.2 Target rich text

The JSON shape does not change. `columns` becomes the same one-line inline Markdown as body cells.

Every cell supports:

- bold;
- italic;
- strikethrough;
- inline code;
- links (`https:`, `http:`, `mailto:` and `ref:`).

A cell does not support paragraphs, lists, line breaks, headings, media, raw HTML or presentation styling.

The editor shows formatted text, not Markdown punctuation. The saved JSON remains Markdown so the editor and public site continue to use one parser, renderer and serializer.

### 4.3 Column-heading rules

A heading:

- must have visible text after Markdown is parsed;
- may contain the same rich text as any other cell;
- has at most 80 visible characters, excluding Markdown punctuation and a link's address;
- cannot be empty.

Use `plainText()` from the Markdown module for these checks. Existing plain headings remain valid, so no content migration is required.

## 5. Editing experience

### 5.1 Visual pattern

The canvas keeps the real rendered table. Edit controls float over it and do not change its public layout.

```text
                    [column menu]
              +-----------------------+      [add column]
 [row menu]   | Heading | Heading     |            +
              | Cell    | Cell        |
              | Cell    | Cell        |
              +-----------------------+
                         +
                     [add row]
```

- Selecting a table reveals **Add row** and **Add column**.
- Focusing a cell reveals **Row actions** for a body row and **Column actions** for its column.
- A heading shows only **Column actions**.
- Controls stay visible for the active cell on touch; no action depends on hover.
- Preview mode hides the controls and makes the table read-only.
- Controls use the editor's existing `IconButton`, surface, focus, spacing and layer tokens.

The public `Table` compound owns the table's appearance. The edit overlay does not add a second table design.

### 5.2 Editing a cell

- Click or tap text to place the caret and type.
- Clicking cell padding focuses the cell text at its end.
- Select text to show the existing format bar.
- In a cell, the format bar shows only Bold, Italic, Strikethrough, Code and Link.
- List and indent tools are hidden.
- Links stay inert while editing; the existing link dialog changes their target.
- A body cell may be empty.
- An invalid column heading stays in the cell as a local draft until it is fixed or focus leaves.

### 5.3 Adding rows and columns

- **Add row** appends one empty row and focuses its first cell.
- **Add column** appends one empty column, assigns the next available `Column N` heading and selects that heading for replacement.
- An inserted column uses the same generated heading.
- "Next available" is the smallest positive `N` whose visible `Column N` label is not already used.
- At a limit, the relevant button stays visible but disabled and exposes the reason in its accessible description.

### 5.4 Row actions

The active body row's menu contains:

1. **Insert row above**
2. **Insert row below**
3. **Move row up**
4. **Move row down**
5. **Delete row**

Move actions are disabled at their edge. Insert actions are disabled at 60 rows. Delete is disabled when one body row remains.

### 5.5 Column actions

The active column's menu contains:

1. **Insert column left**
2. **Insert column right**
3. **Move column left**
4. **Move column right**
5. **Delete column**

Move actions are disabled at their edge. Insert actions are disabled at eight columns. Delete is disabled when one column remains.

A column operation moves or removes its heading and the corresponding cell in every body row. `rowHeadings` remains positional: when enabled, whichever column is first supplies the row headings.

### 5.6 Focus after a structural action

| Action | Focus |
| --- | --- |
| Add or insert row | First cell in the new row |
| Move row | Same column in the moved row |
| Delete row | Same column in the row now at that position, or the previous row |
| Add or insert column | New column heading |
| Move column | Same row in the moved column |
| Delete column | Same row in the column now at that position, or the previous column |

After the save succeeds and the canvas returns, the editor restores that focus and announces the result, for example, "Row moved to 2 of 5."

## 6. Keyboard contract

Cells are edited directly; there is no separate spreadsheet-style navigation mode.

| Key | While editing a cell |
| --- | --- |
| Arrow keys, `Home`, `End` | Move the text caret normally |
| `Tab` | Commit and edit the next cell in row-major order |
| `Shift+Tab` | Commit and edit the previous cell |
| `Tab` from the last cell | Commit and focus **Add row** |
| `Tab` from the last cell at 60 rows | Commit and leave the table for the next editor control |
| `Shift+Tab` from the first heading | Commit and leave the table for the previous editor control |
| `Enter` | Commit and edit the cell below in the same column |
| `Shift+Enter` | Commit and edit the cell above |
| `Enter` in the final body row | Append a row when allowed and edit its cell in the same column |
| `Enter` in the final body row at 60 rows | Commit and remain in the cell |
| `Shift+Enter` in a heading | Commit and remain in the heading |
| `Escape` | Commit, stop cell editing and leave the whole table selected |
| `Shift+F10` or context-menu key | Open a compact menu with the active row and column actions |
| `Ctrl/Cmd+B` | Bold |
| `Ctrl/Cmd+I` | Italic |
| `Ctrl/Cmd+Shift+X` | Strikethrough |
| `Ctrl/Cmd+K` | Link |

Inline code uses its format-bar button because browsers keep common code shortcuts. `Ctrl/Cmd+U` does not add underline. Composition completes before a commit or focus move.

The context menu shows only column actions for a heading. On a body cell it groups row actions before column actions.

## 7. Paste

Paste affects only the active cell.

- Rich HTML keeps supported inline marks and safe links.
- Plain Markdown keeps the same supported inline marks.
- Paragraphs, list items, hard line breaks, tabs and table cells are joined with one space.
- Pictures and other media are ignored.
- Unsupported colours, fonts, sizes, underline and HTML are discarded.
- Pasting a spreadsheet range does not change neighboring cells or table dimensions.

Extract a pure one-cell paste helper from the existing rich-paste and DOM serializers. Do not serialize from `innerText`.

Whole-table workflows remain separate:

- pasting an HTML table between article blocks creates a table block through the existing rich-paste path;
- the inspector's bulk field replaces the whole table.

## 8. Pure table operations

Keep pipe-separated serialization in [`table.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/model/table.ts). Add `src/site/editor/model/tableGrid.ts` for cell and structure rules.

```ts
type Table = Extract<Block, { type: "table" }>;

type TableCell = {
  row: "header" | number;
  column: number;
};

type TableOperation =
  | { type: "set-cell"; cell: TableCell; markdown: string }
  | { type: "insert-row"; at: number }
  | { type: "move-row"; from: number; to: number }
  | { type: "delete-row"; row: number }
  | { type: "insert-column"; at: number }
  | { type: "move-column"; from: number; to: number }
  | { type: "delete-column"; column: number };

type TableResult =
  | {
      ok: true;
      table: Table;
      focus: TableCell;
      announcement: string;
    }
  | {
      ok: false;
      code: TableProblem;
      message: string;
    };

function applyTableOperation(
  table: Table,
  operation: TableOperation,
): TableResult;
```

Every successful operation:

- returns a new value without mutating the input;
- preserves at least one column and one body row;
- preserves rectangular rows;
- stays within the content limits;
- moves a column heading and all of that column's cells together;
- returns the focus target and announcement.

The DOM scripts do not duplicate these rules.

## 9. Integration with the existing editor

### 9.1 Rendering

[`Blocks.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/content/Blocks.astro):

- renders `columns` through the same `renderInlineMarkdown()` call as body cells;
- keeps edit annotations on links;
- passes the existing edit-mode flag to `Table`.

[`Table.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/Table.astro):

- wraps heading text in `.words` and renders it with `set:html`;
- adds one documented optional `editable` prop;
- adds stable row and column coordinates only in edit mode;
- keeps the public `<table>`, caption, column headers, row headers and overflow region unchanged.

Update [`Table.stories.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/stories/Table.stories.astro) with rich heading and rich body-cell examples.

Production output contains no table-editor attributes or controls.

### 9.2 Canvas

Extend [`canvas.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/scripts/canvas.ts); do not add a second editor controller.

Reuse:

- the block map and selection;
- `contenteditable`;
- the 800 ms dirty timer;
- numeric edit sessions;
- composition handling;
- the DOM-to-Markdown serializer;
- the format bar and link dialog;
- preview mode and overlay positioning.

Add a table-cell branch to the existing `current()`, `valueOf()`, focus and paste paths. A cell serializes as one inline Markdown line, with block boundaries and breaks normalized to spaces.

Mark the existing list-tool group in [`CanvasChrome.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/components/CanvasChrome.astro) so `canvas.ts` can hide it for a cell without duplicating the toolbar.

### 9.3 Messages

Add two messages to the current canvas union:

```ts
| {
    type: "table-text";
    index: number;
    cell: TableCell;
    value: string;
    session: number;
    final: boolean;
  }
| {
    type: "table-op";
    index: number;
    operation: TableOperation;
  }
```

Add one parent-to-canvas focus message:

```ts
{
  type: "table-focus";
  index: number;
  cell: TableCell;
  selectText?: boolean;
}
```

No request IDs, optimistic document copy, cell-specific save queue or region-patching protocol is needed.

### 9.4 Parent editor

Extend the existing message switch in [`editor.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/scripts/editor.ts).

For `table-text`:

1. confirm the indexed block is still a table;
2. apply `set-cell` through `tableGrid.ts`;
3. reuse the existing `textSession` checkpoint rule;
4. replace the block in the parent document;
5. queue the normal save;
6. refresh the inspector on `final`;
7. do not reload the canvas while typing.

For `table-op`:

1. confirm the table block;
2. apply the pure operation;
3. queue `table-focus` and the announcement through the existing `afterReady` list;
4. call the existing `change()` once with canvas and inspector refresh.

One menu action is one checkpoint and one save. Undo, redo, save failure and conflict continue through the existing editor paths.

Structure controls close and disable after an action until a successful save reloads the canvas. The canvas does not optimistically rewrite the table, so a refused save leaves the old canvas and saved document aligned and makes no success announcement.

### 9.5 Invalid heading draft

The canvas keeps the active heading's last valid Markdown and HTML.

- Valid input uses normal debounced messages.
- Empty or overlong input remains local and is not sent as `typing` or article data.
- Leaving the invalid heading restores the last valid content and announces the correction.
- Restoring it creates no history entry or save.

The parent article is schema-valid at every point.

### 9.6 Canvas controls

Extend [`CanvasChrome.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/editor/components/CanvasChrome.astro) with:

- **Row actions**;
- **Column actions**;
- **Add row**;
- **Add column**;
- one reusable action menu with row and column groups.

The menu is semantic DOM, uses named buttons, supports arrow-key movement and closes on `Escape`. It uses the same markup for mouse, keyboard and touch.

Do not place editor controls inside the public `Table` compound. Do not create an editor component that imports another editor component.

### 9.7 Inspector

The inspector remains the place for:

- caption;
- first-column row-heading semantics;
- `content`, `popout` and `wide` width;
- whole-table bulk editing.

Rename **Cells** to **Bulk edit table** and place it in a collapsed disclosure under **Rows and columns**.

```text
**Heading 1** | Heading 2
Cell          | [Linked cell](ref:article/example)
```

Both headings and body cells accept inline Markdown. A valid bulk change is one history and save transaction and reloads the canvas. Invalid input keeps the previous table and uses the existing issue UI.

## 10. Accessibility, phone and error behavior

### 10.1 Semantics and focus

- The public page remains a native semantic table.
- Edit mode keeps the table semantics and gives each active cell text a single-line textbox name derived from its row and column.
- Only one cell editor is in the tab sequence; `Tab` moves that position.
- The table is named by its caption, or "Edit table" when it has none.
- Row and column controls are semantic buttons with at least 44 by 44 CSS pixel targets.
- Every action has a keyboard and single-pointer route.
- Structural changes restore a predictable cell and announce the result.

### 10.2 Phone and touch

- The public responsive table does not change.
- Edit controls are positioned from visible cell geometry after horizontal scrolling.
- Focusing a cell scrolls only the table's overflow region enough to reveal it.
- At 320 px, controls do not make the page itself scroll sideways.
- At 200 percent zoom and with larger text, action menus remain reachable.
- Touch uses the same tap controls; no feature requires dragging or hover.

### 10.3 Errors

An invalid action changes neither parent article nor saved content.

| Condition | Message |
| --- | --- |
| Empty heading | "Column headings cannot be empty. Add a heading to continue." |
| Heading too long | "Column headings can have up to 80 characters. Shorten this heading." |
| Column limit | "This table can have up to 8 columns." |
| Row limit | "This table can have up to 60 rows." |
| Delete last column | "A table needs at least one column." |
| Delete last row | "A table needs at least one row." |
| Stale coordinate | "The table changed before that action finished. Review it and try again." |

Use the editor's existing live region and save status. Do not use browser alerts or silent fallback.

## 11. Implementation sequence

### Phase 1: rich cells

1. Make column headings inline Markdown in the schema and renderer.
2. Add one-cell rich paste normalization.
3. Add `tableGrid.ts` and its unit tests.
4. Add edit-only cell coordinates.
5. Connect cell editing, formatting, messages, save and undo.

At the end of this phase, the core user need is complete: every table cell is easy to edit as rich text in place.

### Phase 2: simple structure editing

1. Add row and column action buttons and their shared menu.
2. Add row and column insert, move and delete operations.
3. Add edge buttons for appending.
4. Restore focus after the existing canvas reload.
5. Move the inspector matrix into the bulk disclosure.

### Phase 3: hardening

1. Add keyboard and touch coverage.
2. Add undo, save-failure and conflict coverage.
3. Check phone width, zoom and axe.
4. Verify that production output has no editor code or hooks.

## 12. Test contract

### 12.1 Unit tests

Cover:

- rich Markdown in headings and body cells;
- visible-text heading validation;
- nested supported marks and safe links;
- refusal or normalization of line breaks, lists and unsupported content;
- set, insert, move and delete operations at every edge;
- one-row, one-column, 60-row and eight-column boundaries;
- rectangularity after every operation;
- generated `Column N` collisions;
- positional `rowHeadings`;
- returned focus and announcements;
- input immutability;
- rich HTML and Markdown paste normalized to one cell.

### 12.2 Editor E2E

Extend [`editor.spec.ts`](https://github.com/prabinpebam/atiya/blob/main/tests/e2e/editor.spec.ts) to prove:

1. a heading, row heading and body cell edit in place and survive reload;
2. bold, italic, strikethrough, code and links persist;
3. list tools stay hidden in a cell;
4. rich paste keeps supported marks and remains one cell;
5. `Tab`, `Shift+Tab`, `Enter`, `Shift+Enter`, `Escape` and the context-menu key match this contract;
6. edge buttons append one row or column;
7. every row and column menu action saves and restores focus;
8. limits disable actions and explain why;
9. an invalid heading restores its prior valid value without saving;
10. one typing session and one structure action each undo in one step;
11. a refused save uses the normal rollback and never announces success;
12. the bulk editor and canvas stay synchronized;
13. real touch can edit and change structure without hover;
14. the editor remains usable at 320 px and 200 percent zoom;
15. edit mode has no serious axe violations;
16. the public article stays a native table with no editor controls.

### 12.3 Validation

Run:

- `npx vitest related <changed files> --run`;
- `npm run check`;
- the targeted editor table E2E test;
- the targeted site design-system table test;
- `npm run verify:prod` because edit-only renderer hooks must not reach production.

## 13. Definition of Done

| ID | Requirement |
| --- | --- |
| TBL-01 | Every heading and body cell is WYSIWYG-editable in the real page |
| TBL-02 | Every cell supports bold, italic, strikethrough, code and links as one-line inline Markdown |
| TBL-03 | The existing format bar shows only cell-valid rich-text tools |
| TBL-04 | `Tab`, `Enter`, `Escape` and the context-menu key follow the documented direct-edit contract |
| TBL-05 | Edge buttons append one row or column and focus the new cell |
| TBL-06 | Row and column menus insert, move and delete structure |
| TBL-07 | Pure operations preserve limits, rectangularity, rich text and predictable focus |
| TBL-08 | Cell typing reuses the editor's session, undo and save queue; a structure action uses one `change()` |
| TBL-09 | Caption, row headings, width and a synchronized bulk editor remain in the inspector |
| TBL-10 | Invalid headings and limit actions keep the last valid table and explain recovery |
| TBL-11 | Mouse, keyboard and touch work at phone width, larger text and 200 percent zoom |
| TBL-12 | The public table's semantics and responsive design do not change |
| TBL-13 | Production output contains no table-editor controls, hooks or code |
| TBL-14 | Focused unit, editor E2E, design-system and production-isolation checks pass |
