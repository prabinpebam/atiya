# Crafting screen and HUD chrome: research, spec v1, critique, v2

This is the working spec and plan for the owner's review of the crafting table's screen and the play screen's chrome:

- icon-only header buttons;
- no tilt and rotate buttons round the compass;
- a Minecraft-style crafting screen with the backpack and hotbar in it, recipes as a grid of icons, up to four materials a recipe, and an animation that shows where a crafted item went.

The living rules are in [the design system](design-system.md); the crafting rules (recipes, bulk crafting, Chopper's house) are in [crafting.md](../poc-3d-navigation/crafting.md).

> **TL;DR.** The crafting table opens one wood panel in the Minecraft layout: recipes on top, your backpack and hotbar below, so you can see and rearrange what you have while you craft. Recipes are a grid of big icons with no names, dimmed when you can't make them and marked with how many you can. The selected one shows on the right: the result, its name and line, and one slot per material (up to four), each showing what you have against what it takes, in green or red. When you craft, the result flies from the result slot into the backpack or hotbar slot it landed in, and that slot pops. The recipe grid has a thin scrollbar that reads on wood and on paper. The header's Sound and Menu are icon buttons, and the compass stands alone: turning and tilting move to the menu, next to the keys and the drag they stand in for.

## 1. Research: what the practice says

Anything marked *opinion* is a synthesis with no single source.

**Crafting beside the inventory.**

- Minecraft's crafting table screen puts the crafting area above the player's 27 inventory slots and 9 hotbar slots, so materials can be moved in and results picked up without leaving the screen ([Minecraft Wiki: Crafting table](https://minecraft.wiki/w/Crafting_table)).
- Its **recipe book** is a panel of item icons beside that grid. A click on one shows its recipe and fills in the materials you have. A recipe you can't make yet is highlighted red. A toggle shows only what you can craft now, and Shift crafts as many as your materials allow ([Minecraft Wiki: Recipe book](https://minecraft.wiki/w/Recipe_book)).
- Animal Crossing's DIY workbench (the model for the current screen, [crafting.md](../poc-3d-navigation/crafting.md) §1) lists recipes and shows the selected one's materials as have / need, with a quantity to make.
- *Opinion:* the shared pattern is **catalogue → detail → act**: browse by picture, read the one you picked, then make it. Names belong in the detail (and the tooltip), because a grid of names is a list.

**Showing where an item went.**

- Minecraft animates a picked-up item into the player, and the hotbar shows the item's name for a moment. Stardew Valley shows a small "item received" popup with the item's icon at the screen edge (*opinion*: widely copied; no single spec).
- Shops' "add to cart" animation flies a copy of the product image to the cart icon, so the eye follows the item to its new place. Motion that shows where something went helps people keep track of it ([Nielsen Norman Group: The Role of Animation and Motion in UX](https://www.nngroup.com/articles/animation-purpose-ux/)).
- Reduced motion ([WCAG 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html), adopted here): the move is replaced by a still highlight on the destination, and the announcement says where it went.

**Thin scrollbars.**

- CSS Scrollbars Styling sets a thin bar with `scrollbar-width: thin` and its colours with `scrollbar-color: thumb track` (Chrome 121+, Firefox; [MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/scrollbar-width)). Safari still needs `::-webkit-scrollbar`, which takes a width.
- A thumb in the surface's muted text colour on a transparent track reads on dark and light backgrounds alike (*opinion*, following the surface roles).

**Icon-only buttons.**

- An icon button needs an accessible name ([WCAG 4.1.2](https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html)), and a toggle keeps one name with its state in `aria-pressed` ([WAI-ARIA APG: Button](https://www.w3.org/WAI/ARIA/apg/patterns/button/)).
- The hamburger icon for a menu is widely recognised when it's placed where menus usually are (top right or left), and a tooltip gives its name to sighted mouse users ([NN/g: Hamburger menus](https://www.nngroup.com/articles/find-navigation-mobile-even-hamburger/)).

**Removing the view pad.**

- [WCAG 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) (AA) needs a single-pointer alternative to any dragging. Dragging the planet turns and tilts the view, and the pad's buttons were that alternative. Keys don't count, so the buttons must live somewhere.

## 2. Spec v1

1. **Header:** Sound becomes the speaker icon alone (`aria-label="Sound"`, `aria-pressed`). Menu becomes the hamburger icon alone (`aria-label="Menu"`).
2. **View controls:** remove the four tilt and rotate buttons; keep the compass (face north) and Reset.
3. **Crafting screen:**
   - One wood panel: the recipe grid and the detail on top, then the backpack (27) and hotbar (9), the same slots and gestures as the backpack screen.
   - **Recipe grid:** big icons (56 px), no names, a count badge (×n you can make), dimmed when you can't; names in the tooltip and the accessible name.
   - **Detail:** the result (72 px) with its yield, name and line; one material slot per ingredient, up to four, each with have / need, green when there's enough, red when short; the quantity; Craft.
   - **Scrollbar:** thin, tokens only, on the recipe grid.
   - **Landing animation:** after crafting, a copy of the result flies from the result slot to each backpack or hotbar slot it landed in, which then pops.

## 3. Critique of v1

| # | Problem | Why it matters | Fix in v2 |
|---|---|---|---|
| 1 | The tilt and rotate buttons simply go | WCAG 2.5.7: dragging the view needs a single-pointer alternative, and the pad was it | Keep them in the menu (a **View** group: rotate left, rotate right, tilt up, tilt down), with their keys in the labels |
| 2 | "Up to four materials" is only a comment | Nothing stops a fifth, and the layout breaks | `MAX_NEEDS = 4` in `recipes.ts`; a unit test checks every recipe; the detail row is sized for four |
| 3 | The recipe grid takes the arrow keys, but so does the slot grid | Arrows could move in both at once | Each grid owns the keys only while it has focus; the recipe grid is a `grid` of `gridcell` buttons with a roving `tabindex`, and it stops the keys it uses from reaching the panel |
| 4 | ← → were the quantity stepper; in a 2D grid they move across | A key can't do both | ← → ↑ ↓ move in the grid; **−** and **+** (or <kbd>PgDn</kbd> / <kbd>PgUp</kbd>) change the quantity; <kbd>Enter</kbd> crafts; <kbd>Shift</kbd>+<kbd>Enter</kbd> (or Shift+click Craft) makes as many as you can, as Minecraft does |
| 5 | Dim alone is a colour-only cue | WCAG 1.4.1 | Craftable icons carry a count badge (×n); the rest have none and are dimmed; the detail says what's missing in words |
| 6 | The animation targets slots that may be hidden, or off screen on a phone | It flies to nowhere | Fly only to slots that are on screen; otherwise pop the hotbar's backpack button. The announcement always says where it went ("added to your backpack", "to hotbar slot 3") |
| 7 | A result that doesn't fit is dropped at your feet | It shouldn't look as if it went into the backpack | Fly only the part that landed; say how many dropped |
| 8 | The panel is taller with the backpack in it | 390 × 664 phones, and short landscape screens | The panel scrolls as a whole (thin scrollbar); the recipe grid keeps at most three rows before it scrolls |
| 9 | Only the recipe grid gets the thin scrollbar | Other wood and paper surfaces still show the thick default | One `.scroll-thin` rule on every scrolling surface: dialogs, the inventory panels and the recipe grid |
| 10 | Icon buttons lose their visible word | Some people rely on the text | The tooltip gives the name and key ("Menu (M)"); the design system's icon-button rule applies (44 px target, accessible name) |

## 4. Spec v2 (as built)

### 4.1 The header

- **Sound:** a square icon button, the speaker icon (or the muted speaker). Its name stays **Sound**, and `aria-pressed` carries on or off. The tooltip says what a click does.
- **Menu:** a square icon button with the bars icon, named **Menu**, with the tooltip "Menu (M)". It opens the menu dialog as before.

### 4.2 The view controls

- The compass (face north, <kbd>N</kbd>) and **Reset** (<kbd>H</kbd>) only.
- **Menu → View** (a group, "Turn and tilt the view"): **Rotate left** <kbd>,</kbd>, **Rotate right** <kbd>.</kbd>, **Tilt to top** <kbd>PgUp</kbd>, **Tilt to side** <kbd>PgDn</kbd>: one step each (the single-pointer alternative to dragging, WCAG 2.5.7), with their keys in the labels. The menu stays open, so you can step several times and watch the planet turn behind it: the canvas draws only on demand while the menu is open, so a step asks for frames until the view settles (`controller.requestFrame`, `viewEasing`).

### 4.3 The crafting screen

The layout, top to bottom:

| Part | What | Rules |
|---|---|---|
| Head | "Crafting table", the Move toggle (touch), Close | As the backpack screen. Every inventory panel stays below the top bar (the backdrop keeps its height clear), so the head is never under the header on a phone |
| Recipes | A grid of recipe icons (`--c-recipe-cell`, 56 px), 5 across on a wide screen, as tall as its rows | No names; a count badge (×n you can make) on the ones you can; the others dimmed; the selected one ringed. A `listbox` with `aria-activedescendant` (focus stays on the list, which is simpler than a roving `tabindex` and what the old list did); each option's name: "Planks: 4 from 1 wood log. You can make 12.", and its tooltip the recipe's name. At most three rows show, then it scrolls (thin scrollbar) |
| Detail | The result (`--c-recipe-result`, 72 px, its yield in the corner), name, line; **Materials**: one slot per ingredient (1 to `MAX_NEEDS` = 4), each with its icon and have / need, marked ✓ and green when there's enough, red when short; the quantity (− / +) and **Craft** | A line under it says what's missing in words, or how many you can make |
| Backpack | 27 slots | The same slots, gestures and keys as the backpack screen (click, right-click, drag to spread, Shift+click moves to the hotbar and back, 1–9, Q, R) |
| Hotbar | 9 slots | Selected slot marked, as in the backpack screen |
| Help | The keys | Changes with the input (touch or keys) |

**Keys:**

- in the recipes, ← → ↑ ↓ move the selection;
- **−** / **+** (or <kbd>PgDn</kbd> / <kbd>PgUp</kbd>) change the quantity;
- <kbd>Enter</kbd> crafts, and <kbd>Shift</kbd>+<kbd>Enter</kbd> (or <kbd>Shift</kbd>+click on **Craft**) crafts as many as you can;
- <kbd>Tab</kbd> goes on to the materials, the buttons and then the slots, which keep their own keys;
- <kbd>Esc</kbd> or <kbd>E</kbd> closes.

**Materials, up to four.** A recipe lists 1 to 4 needs, and each need is one kind of material or a set that counts together (a paint takes "any three red flowers"). The detail shows one slot per need, in the recipe's order. Have / need counts every item that qualifies, and need is multiplied by the quantity.

**When you craft:**

1. The Craft button runs its short hammering progress (`CRAFT_S`), as before.
2. The materials leave the backpack and the result goes in (`craft()`); anything that doesn't fit drops at your feet.
3. **The landing:** a copy of the result's icon flies from the result slot to each slot that gained it (up to three, the largest first) along a short arc (`--dur-slow`, `--ease-out`). Each slot then pops (a scale and a gold ring, `slot-pop`). If a slot isn't on screen (the panel scrolled), it only pops: there's nothing to fly to, and the announcement says where it went.
4. **Under reduced motion:** no flight; the slots that gained it only pop, which the global reduced-motion rule turns into a brief highlight.
5. **Announced:** "Crafted 4 planks: in hotbar slot 3." (when it all went to one hotbar slot) / "…: in your backpack." / "…; 2 dropped at your feet: your backpack is full."

### 4.4 The thin scrollbar

- One rule for `.dialog`, `.inv-panel` and `.scroll-thin` (`components.css`): the menu and landmark dialogs, the inventory and crafting panels, and the recipe grid.
- `scrollbar-width: thin` and `scrollbar-color: var(--surface-text-muted) transparent`; `::-webkit-scrollbar` at `--c-scrollbar` (6 px) with a rounded thumb.
- It reads on wood and on paper because the thumb is the surface's own muted text colour.

## 5. Plan

| Step | What | Where |
|---|---|---|
| 1 | Header icon buttons; the compass alone; Menu → View | `ui/Hud.tsx`, `ui/ViewControls.tsx`, `ui/MenuDialog.tsx`, `hud.css` |
| 2 | Tokens: `c.recipe.cell`, `c.recipe.result`, `c.scrollbar`; drop the view pad's (`c.view.btn`, `c.view.btn-touch`) | `design/tokens.json` → `build-tokens.mjs` |
| 3 | `MAX_NEEDS`, and which slots a craft filled (pure) | `world/craft/recipes.ts` |
| 4 | The inventory panel takes a top part (the crafting pane), a title and a close | `ui/InventoryPanel.tsx` |
| 5 | The crafting pane: recipe grid, detail, material slots, quantity, craft; the landing animation | `world/craft/ui.tsx`, `panels.css` |
| 6 | Tests: unit (every recipe ≤ 4 needs; the landing slots; the need slots have / need); E2E (the crafting test in the new layout, the landing, the header names, the menu's View group); one look on a real GPU, desktop and phone | `tests/` |

## 6. Definition of Done

| # | Criterion | Evidence | Status |
|---|---|---|---|
| 1 | Sound and Menu are icon buttons with names | E2E "compass shows north and stands alone…": button "Sound" with `aria-pressed`, button "Menu"; the touch test checks both are ≥ 44 px | Done |
| 2 | The compass stands alone; turning and tilting are in the menu | E2E "compass shows north and stands alone…": the view group has two buttons (compass, Reset); the menu's Rotate right turns north to 45° and Tilt to side lowers the pitch | Done |
| 3 | The crafting screen shows the recipes, the detail, the backpack and the hotbar | E2E "the crafting table: its own prompt, the recipe grid over the backpack…": backpack slots 0 and 35 in the screen; a real-GPU look at 1280 × 800 and 390 × 664 | Done |
| 4 | Recipes are an icon grid, with names only in the detail | E2E: the Recipes listbox has no recipe names; the detail's heading is "Planks" | Done |
| 5 | Up to four materials, each marked have / need | Unit (`crafting.test.ts`, "crafting screen"): every recipe has 1 to `MAX_NEEDS` distinct needs; E2E: the need slot reads 3 / 1 and is `ok`, then 1 / 2 and `short` | Done |
| 6 | Crafting shows where the result went | Unit: `landedSlots` (topped-up and new slots, other items, the cap, a full backpack); E2E: "Crafted 8 planks: in hotbar slot 3." announced; the flight and pop seen on a real GPU | Done |
| 7 | Thin scrollbar on wood and paper | One rule on `.dialog`, `.inv-panel` and `.scroll-thin`; seen on the crafting panel (phone) and the menu | Done |
| 8 | Budgets met or a waiver proposed | `npm run verify:prod`: 449.0 KB initial (≤ 450), 88.1 KB on demand, over 87: the waiver is raised to 89 KB and proposed in [plan §6](../poc-3d-navigation/plan.md) | Waiver pending |
