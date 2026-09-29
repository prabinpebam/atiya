# The article minimap

A slim strip along the right edge of a long article: one indicator per landmark, the reader's place, a preview on hover, focus or tap, and a jump to any landmark. It's built to stay out of the way of reading, scrolling and the page's other controls. The [site design system](design-system.md) holds the general rules; this page is the minimap's behaviour as built.

> **TL;DR.** `ArticleMinimap` (a compound) is placed once by the article layout and maps the element marked `data-minimap-source`.
> - **Indicators:** a dense column of soft, fully rounded pills, all alike except that a heading's pill is longer the higher its level. A picture, gallery or carousel (counted once, whatever it holds) is a short pill; the tooltip says which kind it is.
> - **Place and hover:** the landmark being read is highlighted in indigo and marked `aria-current="location"`. Hover or focus shows a tooltip and magnifies the indicator, with its neighbours growing less, like a dock.
> - **Choosing:** a click, Enter or a tap scrolls the landmark to 18% down the view, below the sticky header.
> - **Out of the way:** only the strip takes pointer input, and it hides wherever it would cover text (as on a phone). It scrolls on its own, without a scrollbar and without passing the scroll on to the page.
> - **Where the rules live:** the pure rules are in [`scripts/minimap.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/scripts/minimap.ts), unit-tested. The E2E group "article minimap" covers the scenarios.

## 1. Landmarks

- **In document order,** one indicator each, from the source element (the article: its header, its body):
  - headings `h1` to `h6`, where an `h1` is left out if it only repeats the page's title;
  - pictures that say something: alt text or a caption, not `alt=""` or `role="presentation"`, at least 96 px wide as drawn (so not an avatar, an icon or an emoji);
  - galleries (`[data-gallery]`) and carousels (`[data-carousel]`), each as one landmark. The headings and pictures inside one aren't listed.
- **Skipped:** anything hidden, a dialog (the lightbox), and a video's poster.
- **Labels:**
  - a heading's text;
  - a picture's alt text, or else its caption;
  - a gallery's `aria-label` or caption.

  The tooltip's second line is the kind: "Heading 2", "Image" or "Gallery · 6 images".
- **Rebuilt as the content changes:** a mutation or a resize of the source rebuilds the list. The strip is drawn again only when the list itself changes (its count, kinds, levels or labels). Element ids are never written, so heading anchors keep working.

## 2. Indicators

The look is the owner's mock, at about a seventh of its drawn size: a column of soft pills, right-aligned, 4 px thick whatever their state (hover never changes a pill's height), in rows 12 px apart (an 8 px gap). The ends are full half-circles (`--radius-pill`), and every length is rounded to whole pixels, so both ends sit on the pixel grid and render crisp.

| Kind | Pill (mouse) | On touch |
|---|---|---|
| Heading, level 1 to 5 | 32, 24, 18, 13.5 and 10 px long: each level three quarters of the one above (a 25% step) | × 1.15 |
| Picture, gallery or carousel | 16 px long | × 1.15 |

- **Only headings differ:** by the owner's choice, every landmark is the same pill, and only a heading's length (its level) sets it apart. The kind is in the tooltip ("Image", "Gallery · 6 images") and the button's accessible name ("Jump to image: …"), never in colour alone.
- **Rows:** every mark is right-aligned in a full-width row button, 12 px tall with a mouse, at least 24 px on touch (the WCAG 2.5.8 minimum). So targets never overlap. With a mouse they're smaller than the spec's 16 px, for the owner's look; the page scrolls as usual, so the strip stays an extra way to move.
- **Colours:**
  - at rest, one soft neutral for every mark (`--c-minimap-tick`, the `indicator` role): a light warm grey on dark, as in the mock, and stock-500 on paper (3:1);
  - the landmark being read, the spot indigo (`--c-minimap-current`);
  - under the pointer or focus, the text colour (`--c-minimap-active`), which wins over current.
- **Growth:**
  - the active pill grows to 150% of its length, leftward (`--c-minimap-magnify`), and its three neighbours on each side take 60%, 32% and 12% of that growth (the wave, `WAVE`). It never gets thicker;
  - the current pill grows to 115%;
  - the strip (52 px) leaves room for the longest pill at 150%.
- **Reduced motion** turns off the growth animation and the smooth scroll.

## 3. Placement

- **On a page that scrolls:** the strip is fixed 16 px from the right edge, clear of the overlay scrollbar's handle (6 to 10 px wide, 3 px in). It sits below the sticky header and 24 px above the bottom, and is 52 px wide (60 on touch).
- **In a box that scrolls** (the design library's examples): the strip sits inside that box, 16 px from its edges, so a side panel pushes it along with the content.
- **Stacking:** it's on its own layer (`--layer-minimap`, 50), over the article but under the header, menus, dialogs and the lightbox.
- **Never over text:** the strip shows only where the text column leaves it room (checked on load and on every resize). So it's hidden on a phone, and on a phone held sideways when a pull quote steps out that far.
- **A short list** sits in the middle of the strip's height. A long one scrolls inside the strip, without a scrollbar, and doesn't chain its scroll to the page.

## 4. Pointer isolation

- **Only the strip takes input:** the frame around it takes no pointer input, and neither does the tooltip, so neither ever blocks the article.
- **The tooltip** sits outside the strip's scroll (so it isn't clipped), to the left, centred on its indicator. It follows the indicator as the strip scrolls. Its width is capped at 18 rem, and also by the viewport, so it never runs off a phone's edge. It's a status message (`role="status"`), so focus and hover changes are announced.

## 5. Where the reader is

- **The reading line** is a quarter of the way down what the sticky header leaves (`readingLine`). The current landmark is the last one whose top has passed it; before the first reaches it, the first.
- **Why measured below the header:** a jump lands 18% below the header, so a landmark just jumped to is always past the line, and the indicator just chosen becomes the current one. Measured from the top of the viewport, a 72 px header left it short of the line.
- **When it updates:** on scroll, on resize, and whenever the source's content or layout changes (lazy pictures, embeds, galleries built in the browser). While the strip overflows, the current indicator is kept in view unless the reader is browsing the strip.

## 6. Choosing

- **A click or Enter** jumps: the landmark smooth-scrolls to 18% of the view's height below the top (never less than 24 px), plus the sticky header's height (the page's `scroll-padding-top`), using `jumpTarget`.
- **A tap** selects at once: it highlights the indicator, shows the tooltip and jumps. The click the browser sends after a tap is ignored, so one tap doesn't select twice.
  - The rows have `touch-action: pan-y`, so there's no double-tap zoom or tap delay, and a finger still scrolls the strip.
  - A touch selection stays for 3.6 s (`--c-minimap-pin`). A later tap's selection isn't cleared by an earlier tap's timer.
  - Lifting the finger or leaving the strip doesn't clear it.
- **A mouse held still** within 56 px of the strip's top or bottom auto-scrolls it:
  - faster nearer the edge, up to 14 px a frame (`edgeSpeed`);
  - it stops at the ends, when the pointer leaves, or when it moves out of the zone;
  - one loop runs at a time;
  - touch and pen never trigger it.

## 7. Robustness

- **Cleanup:** every listener, observer, timer and animation loop is removed with the strip (the abort signal from `each`).
- **Few landmarks:** nothing shows without a landmark, and a single landmark still shows.
- **The unit tests** hold:
  - the current landmark;
  - the reading line against the jump's landing;
  - the wave;
  - edge speed;
  - the jump target;
  - the list's identity;
  - the tooltip and accessible names;
  - which pictures count;
  - the title rule.
- **The E2E group "article minimap"** covers:
  - the landmarks on the article demo, and each jump landing and becoming current;
  - hover, focus and Enter;
  - opening at a heading's URL anchor;
  - content added after load, and a late tall block shifting the landmarks below;
  - a long list in a box: inside it, overflowing, auto-scrolling near its edges, not chaining its scroll;
  - an article of only pictures, and a gallery first with a heading inside it;
  - touch: a tap, then a second tap before the first's timer runs out;
  - a phone, where the strip stays out of the way.
