---
name: slide-design
title: Slide Design (canvas-informed)
description: Compose each deck slide as a wide visual canvas - design-forward, spatial, minimal-text - not a narrow column of prose. Adapts the canvas-design philosophy (visual-first, master-craftsmanship) to the live Slate deck. Use alongside the presentation-deck skill when authoring or restyling a deck's slides.
version: 0.1.0
---

# Slide Design Skill (canvas-informed)

A deck slide is a **wide canvas**, not a page of text. This skill adapts the
[canvas-design](https://github.com/anthropics/skills/blob/main/skills/canvas-design/SKILL.md)
philosophy - *visual expression, spatial communication, minimal words, master-level
craftsmanship* - to a **live, functional** Slate deck. It complements the
[presentation-deck skill](SKILL.md): that skill owns the narrative spine and the talking
track; **this** skill owns how each slide **looks and composes across the full width**.

> On presentation pages the heading table-of-contents is replaced by a thin slide
> **minimap**, so the content column runs nearly edge to edge. Treat that reclaimed width
> as canvas - compose *across* it, never as a tall 860px column.

## The two moves (borrowed from canvas-design)

1. **Write the deck's visual philosophy first.** Before styling slides, name the deck's
   aesthetic in 2-4 sentences - a small manifesto. What is the movement? How does it use
   space, scale, colour, rhythm, hierarchy? Example: *"Quiet authority. Vast negative
   space, one sculptural headline per slide, a single accent, evidence shown as diagrams
   not sentences. Every alignment deliberate; nothing cramped, nothing shouting."* The
   philosophy guides every later choice.
2. **Express it visually on each slide.** Compose the slide to *show* the idea - through a
   figure, a metric row, paired columns, a card set - carried by the full width, with text
   reduced to the essential headline, lead, and labels. Depth lives in the talking track.

## Principles

- **Visual-first, minimal text.** Information lives in the design, not paragraphs. One idea
  per slide, `<= 3` **key points** (distinct claims to retain - not items in an enumerated
  set), `<= ~40` visible words of prose in the body. If it needs a paragraph to be understood,
  that paragraph belongs in the talking track.
- **Key points vs. enumerated items.** The three-point budget limits competing *claims*, not
  *facts*. One key point may enumerate a complete set - "five value pillars," "eight planets,"
  "a four-step flow" - shown as a full tile set. Never truncate a factual set to hit three, and
  never split one idea into three rival headlines. When the set *is* the point, show all of it
  as one dominant tile block.
- **Prefer cards and tiles over bullet lists.** Land parallel points as a `slate-card-grid`
  or a `slate-metrics` row - not `slate-slide__points`. Bullets are a last resort for a tight
  sequence with no room for tiles. A tile can carry its own small hero illustration and a
  clear title; a bullet cannot.
- **Use the whole canvas.** Compose across the width: 2-3 column card grids, side-by-side
  `slate-compare`, a metric row spanning the slide, or a large figure. Avoid a lonely
  narrow block adrift in a wide slide - either let the visual span, or balance it with
  deliberate negative space, never accidental emptiness.
- **Sculptural typography.** A large, confident headline (the one thing the slide says); a
  tiny uppercase kicker/beat label; a medium lead sentence in the boldest form. Huge title,
  small labels - strong contrast in scale is the hierarchy. Keep the headline to a tight
  measure (`~20ch`) so it reads as a sculpted statement, not a running line.
- **Readable measures inside a wide frame.** The slide is wide; prose is not. Cap the lead
  (`~52ch`) and any talking-track paragraphs (`~80ch`) so lines never sprawl. Let figures,
  grids, and metric rows use the full width; keep sentences to a column.
- **Negative space is a material.** Generous, width-responsive padding; air around the one
  dominant element; breathing room between slides. Space is not wasted - it is the frame
  that makes the content feel considered.
- **One dominant visual per slide.** Pick the single strongest form for the point (chart,
  diagram, comparison, metrics, cards) and let it lead. Never stack two competing visuals.
- **Limited, intentional palette.** Compose only from Slate tokens. One accent, used
  sparingly to direct the eye. Colour carries meaning; it is not decoration.
- **Rhythm and alignment.** Everything sits on a shared grid; repeated spacing; consistent
  kicker/number/title cadence slide to slide. Consistency reads as craft.
- **Master-level craftsmanship.** The deck should look laboured over - meticulous spacing,
  nothing overflowing, nothing overlapping, flawless in **light and dark**. Before shipping,
  hunt for problems: overloaded slides, text sprawl, low contrast, a slide with no visual,
  inconsistent headers, an element touching an edge. Refine rather than add.

## Visual mechanisms (every slide earns a deliberate choice)

A deck is visual-first, but a visual quota creates filler. Every slide must make an explicit choice:
use a functional visual mechanism that carries the argument, use a restrained editorial illustration
that establishes necessary tone, or state why a text-only composition is clearer. Do not add generic
abstract SVG merely to satisfy the checklist.

For each slide, decide and record:

1. **Define the visual.** In one line, say what the illustration shows and why it belongs -
   the obligation it serves (a decision, a relationship, a contrast, a mood). Keep this as an
   HTML comment beside the figure so intent survives edits.
2. **Route the medium.** Use chart/graph skills for measured data or dense auto-layout. Use the
  [Slate SVG Illustration skill](../visualization/skills/svg-illustration/SKILL.md) for bespoke
  diagrams, editorial vectors, scenes, maps, objects, patterns, and stable presentation motion
  subjects. Use local bitmap imagery when natural detail or texture is the point.
3. **Prefer many small heroes over one big picture.** A hero illustration per tile
   (`slate-card__figure`) usually reads better than one decorative slab. Reserve a slide-level
   hero (`slate-slide__figure`) for a single dominant concept (a Venn, a hub, a staircase).
4. **App windows are Windows windows.** Whenever the art depicts an application window, draw
   the **Windows** title-bar controls - minimize, maximize, close - at the top-right. Never
   the macOS traffic-light dots.

### Figure classes

| Use | Class | Notes |
| --- | --- | --- |
| One dominant slide visual | `slate-slide__figure` (`> svg`) | Full-width; add `--band` for a shorter strip; optional `slate-slide__figcaption`. |
| A hero per tile | `slate-card__figure` (`> svg`) | Tinted panel at the top of a `slate-card`; pair the card with `slate-card--illus`. |

- Give every functional inline `<svg>` an accessible name through `<title>`/`<desc>` and
  `aria-labelledby`; purely decorative art uses `aria-hidden="true"`.
- Validate custom SVG against `slate-inline` or `slate-motion-subject`, render it in the real deck,
  and inspect light/dark plus the smallest expected stage.
- Use semantic host colors. A single `currentColor` accent is useful for simple motifs, not a blanket
  restriction on all explanatory illustration.

### A Windows window, in SVG

Draw the frame and, at the top-right of the title bar, the three controls in order -
minimize (a short line), maximize (a small square), close (an X) - all in `currentColor`:

```html
<svg viewBox="0 0 120 76" fill="none" role="img" aria-label="A Windows app window">
  <rect x="6" y="8" width="108" height="60" rx="7" stroke="currentColor" stroke-width="2.5"/>
  <line x1="6" y1="22" x2="114" y2="22" stroke="currentColor" stroke-width="2" opacity="0.5"/>
  <line x1="86" y1="15" x2="92" y2="15" stroke="currentColor" stroke-width="1.6"/>     <!-- minimize -->
  <rect x="96" y="12" width="6" height="6" stroke="currentColor" stroke-width="1.4"/>   <!-- maximize -->
  <path d="M106 12 L111 17 M111 12 L106 17" stroke="currentColor" stroke-width="1.6"/>    <!-- close -->
</svg>
```

## Title styling: one statement or two

A slide title is either one part or two - style it to match:

- **Short, single-part statement** - one idea on one line: use the **single** title style
  (`slate-slide__title`). Let it be big and punchy. E.g. *"Trying to do both is hard."*
- **Longer, two-part statement** - a setup and its turn or elaboration: **split it onto two
  lines** and lightly differentiate them. Add `slate-slide__title--split` and wrap each part:

  ```html
  <h2 class="slate-slide__title slate-slide__title--split">
    <span class="slate-slide__title-a">Universal Capture:</span>
    <span class="slate-slide__title-b">one familiar capture, everywhere it's needed</span>
  </h2>
  ```

  Part **A** is the statement (full weight, primary); part **B** is its second clause (same
  size, semibold, muted) - a quiet second beat, not a competing headline. Split at the natural
  seam (a dash, a colon, or an "X, or Y" clause) and drop the connector when the line break
  already carries it. Keep two-part titles to about two lines; the split style is a touch
  smaller than a single-part title so the extra words still sit comfortably.

## Mapping to Slate

| The slide wants to… | Compose it with |
| --- | --- |
| State one bold claim | large `slate-slide__title` + a single `slate-slide__lead` |
| Show a few parallel points | a `slate-card-grid` (`data-cols="2"` or `"3"`) of cards/tiles - **not** bullets; give each tile a `slate-card__figure` hero |
| A hero for each point | `slate-card__figure` inside every card (`slate-card--illus`) |
| Contrast two things | `slate-compare` columns, spanning the canvas |
| Land numbers / a trend | `slate-metrics` row + an inline-SVG chart |
| A dominant concept / relationship | a `slate-slide__figure` inline-SVG hero (Venn, hub, staircase), `currentColor`, light/dark aware |
| Cite evidence | an inline `slate-xref` pill (never a paragraph on the slide) |

- **Charts and diagrams follow Slate's visualization routing.** Custom inline vectors use the native
  SVG skill and sanitizer-safe presentation attributes; external figures use local assets and host
  `alt`/caption.
- **Never invent CSS or inline styles** - compose from catalog components and the deck
  classes. The wide-canvas layout is delivered by the shell (`.document.is-deck`,
  `.app--deck`); authors don't hand-size slides.

## Anatomy (unchanged contract, canvas emphasis)

```html
<section class="slate-slide">
  <p class="slate-slide__kicker"><span class="slate-slide__num">03</span> Beat</p>   <!-- tiny label -->
  <h2 class="slate-slide__title">The one sculptural line</h2>                          <!-- large -->
  <p class="slate-slide__lead">One framing sentence, boldest form.</p>                 <!-- medium, capped measure -->
  <div class="slate-slide__body"><!-- ONE dominant visual, spanning the width --></div>
  <details class="slate-talktrack"><summary>Talking track</summary>
    <div class="slate-talktrack__body"><!-- the depth, off the canvas --></div>
  </details>
</section>
```

## Self-review checklist

- [ ] The deck has a stated **visual philosophy**; every slide expresses it.
- [ ] Each slide composes **across the full width** - no lonely narrow column.
- [ ] Parallel points are **cards/tiles**, not bullet lists.
- [ ] Every slide has a deliberate visual choice; any omission has a stated reason, and no visual is
  generic filler.
- [ ] Custom vectors use the Slate SVG Illustration pipeline and pass their production profile.
- [ ] Any depicted **app window uses Windows controls** (minimize, maximize, close), never macOS dots.
- [ ] **One idea, `<= 3` key points** (distinct claims, not enumerated items), **one dominant visual** per slide.
- [ ] **Sculptural hierarchy**: large title, tiny kicker, capped-measure lead.
- [ ] Prose stays to a **readable measure**; figures/grids use the width.
- [ ] Generous, deliberate **negative space**; nothing cramped or touching an edge.
- [ ] **One accent**, tokens only; no invented CSS or inline styles.
- [ ] Flawless in **light and dark**; no overflow, no overlap.
- [ ] Depth is in the **talking track**, not on the slide face.
