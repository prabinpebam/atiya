---
name: presentation-deck
title: Presentation Deck (Slate)
description: Author a presenter-led narrative deck as a single scrollable Slate page of slide-like sections, each landing a few key points with a collapsed talking track. Use when asked to build a presentation, pitch, briefing deck, or "slides" to be presented live (not a detailed document for self-reading).
version: 0.1.0
---

# Presentation Deck Skill (Slate)

Build a **presenter-led** narrative as a single Slate page. Not a document to read alone, and not
slide files - one scrollable web page whose **sections behave like slides**. Each slide lands a few
key points, concisely, and carries a **collapsed talking track** (the presenter's script) at the
bottom.

> **A deck is not a doc.** A document explains everything on the surface. A deck shows the *few* points
> that matter and lets the **presenter** carry the rest through the talking track. Concise on screen,
> complete in the notes.

**How each slide should look** is a companion concern: see the
[slide-design skill](slide-design.md) - a canvas-informed guide for composing each slide as a wide,
visual-first canvas. This skill owns the **narrative and talk track**; that one owns the **visual
composition**. On presentation pages the heading TOC is replaced by a thin slide **minimap**, so slides
render **full-width** - compose across that width.

> **Adding motion or presenter-controlled animation?** Read
> the [Slate Presentation Motion skill](motion/SKILL.md), then
> [Presentation Motion v1](motion-authoring.md) and the
> [Interactive Presentation Motion Architecture](motion-architecture.md). The experimental WAAPI v1
> runtime preserves discrete navigation and direct jumps while adding fragments, interruptible
> transitions, fitted presentation stages, speaker notes, and same-origin audience sync. Keep authored
> decks script-free/style-free and validate the companion motion manifest before preview. For a new
> animated deck, read the [generated motion proof](../demo/generated-motion.html) and its
> [manifest](../demo/generated-motion.json), then start from
> [`templates/presentation-motion.json`](../templates/presentation-motion.json); do not treat an
> existing static deck plus generic fades as the target quality bar.

## When to use this skill

Use it when the ask is to **present** to an audience: a pitch, a leadership briefing, a review, a
readout. If the ask is a reference people read on their own, use the base
[Slate skill](../SKILL.md) instead. When unsure, ask: *will someone stand up and talk to
this?* If yes, it's a deck.

## The two non-negotiables

1. **Concise slides.** Each slide lands **1-3 key points** in a suitable visual form - bullets, tiles,
   cards, a chart, columns, a metric row. Never a wall of text. If a slide needs a paragraph to be
   understood, the paragraph belongs in the talking track, not on the slide.
2. **A talking track per slide.** Every slide ends with a **collapsed** talk track carrying what the
   presenter says. The slide is self-explanatory enough to stand without it, but the talk track is
   where the depth, nuance, and transitions live.

> **Visual arguments, not decorative quotas.** Land parallel points as cards/tiles and use one visual
> mechanism when it materially carries the slide's claim. Route bespoke vectors through the
> [Slate SVG Illustration skill](../visualization/skills/svg-illustration/SKILL.md); use chart/graph
> skills when their engines fit better. A deliberately austere text/quote slide may omit a visual
> when adding one would create noise. Any depicted app window uses **Windows** controls (minimize,
> maximize, close), never macOS dots. The [slide-design skill](slide-design.md) owns composition.

## Narrative first: tension carries the deck

A deck is a story, not a list of topics. Before authoring slides, write the **spine**: the throughline
that pulls the audience from the first slide to the last. Every slide must **earn the next one** -
open a question the next slide answers, or raise a tension the next slide resolves.

Author the spine as a one-line-per-slide outline, for example:

```
1  Hook        A durable need most tools only half-serve.
2  Today       It's served in part - and one part is proven, one promising.        (tension: the gap)
3  The strain  The product that tried to do both is stalling - here's the data.    (tension: why?)
4  Turn        The reason it stalled points straight at the fix.                    (release)
5  Direction   The approach - and how it answers each problem.                      (payoff)
6  Close       The feedback and guidance we're seeking on the direction.           (invitation, not a demand)
```

Rules for the spine:

- **Open with tension, not a table of contents.** Lead with the stakes - a number, a gap, a
  surprising claim - not "Agenda."
- **One idea per slide.** If a slide has two ideas, split it.
- **Each transition is a hinge.** Name the motivation that moves the audience to the next slide (the
  `(tension: …)` notes above). If you can't name it, the slide order is wrong.
- **End on the ask - sized to the room.** Close with what you want from the audience, in their register.
  Presenting *up* (senior leaders, CVPs, review boards) the close is almost always an **invitation for
  feedback, input, and guidance on the direction** - alignment and steer, not a demand or a mandate; label the
  beat "Discussion" or "Guidance" rather than a hard "Ask." Reserve imperative "commit / approve / fund"
  language for when you genuinely own the decision and are requesting sign-off. An upward ask that reads as a
  demand undercuts the whole deck.

## Structure of a deck page

A deck is a normal Slate content page (a body fragment - no `<head>`, `<style>`, or `<script>`) with a
short hero, then a `.slate-deck` wrapper containing `.slate-slide` sections. The shell renders decks
**full-width** (the right rail becomes a thin slide minimap, not a heading TOC), so treat each slide as a
wide canvas - see the [slide-design skill](slide-design.md).

```html
<header class="slate-hero">
  <p class="slate-hero__eyebrow">Presentation · Audience</p>
  <h1 class="slate-hero__title">Deck title (the only H1)</h1>
  <p class="slate-hero__summary">One line: what this deck argues.</p>
</header>

<div class="slate-deck">
  <!-- one <section class="slate-slide"> per slide -->
</div>
```

### Anatomy of a slide

```html
<section class="slate-slide">
  <p class="slate-slide__kicker"><span class="slate-slide__num">01</span> Tension</p>
  <h2 class="slate-slide__title">The one thing this slide says</h2>
  <p class="slate-slide__lead">A single framing sentence - the point, in the boldest form.</p>

  <div class="slate-slide__body">
    <!-- ONE visual block: points, cards, metrics, a compare, a figure, a callout. -->
    <ul class="slate-slide__points">
      <li><strong>Point one</strong> - a few words of support.</li>
      <li><strong>Point two</strong> - a few words of support.</li>
      <li><strong>Point three</strong> - a few words of support.</li>
    </ul>
  </div>

  <details class="slate-talktrack">
    <summary>Talking track</summary>
    <div class="slate-talktrack__body">
      <p><span class="slate-talktrack__cue">Open:</span> what the presenter says to land this slide -
         the story, the nuance, the evidence not shown on screen.</p>
      <p><span class="slate-talktrack__cue">Transition:</span> the sentence that hands off to the next
         slide, naming the tension that pulls the audience forward.</p>
    </div>
  </details>
</section>
```

Notes:

- **`slate-slide__num`** is a two-digit slide number chip; **kicker** is a one-word beat label
  (Tension, Turn, Evidence, Direction, Ask). Headings inside `.slate-slide` are intentionally skipped
  by the shell's collapsible-section logic, so slides render clean.
- **`slate-slide__lead`** is optional - use it when one framing sentence carries the slide.
- **`slate-slide__body`** grows to fill the slide; the talk track pins to the bottom.
- The title slide can use `<section class="slate-slide slate-slide--title">`; the closing/ask slide
  `slate-slide--closing`.

## Choosing the on-slide visual (one per slide)

Reach for the form that fits the point - never plain paragraphs, and **prefer cards/tiles over
bullet lists**. One dominant block per slide. Every slide also carries an **illustration** (see the
[slide-design skill](slide-design.md)): a hero per tile, or one slide-level hero.

| The slide's point is… | Use |
| --- | --- |
| A few parallel claims | a **card grid** of tiles (each with a `slate-card__figure` hero); bullets only as a last resort |
| Two things contrasted | **comparison** columns ([comparison.html](../components/comparison.html)) |
| Numbers / KPIs / a trend | **metric tiles** ([metric-tile.html](../components/metric-tile.html)) + an inline-SVG chart |
| A process / sequence | **steps** ([steps.html](../components/steps.html)) or a flow figure |
| One idea + supporting parts | a **hero stat** or a single **callout** ([callout.html](../components/callout.html)) |
| A relationship / model | a validated custom SVG **figure** using the [native SVG pipeline](../visualization/skills/svg-illustration/SKILL.md) |

Charts use the matching chart skill; bespoke diagrams and illustrations use Slate's SVG Illustration
skill. Every figure needs an accessible name or meaningful host `alt`, plus a caption/structured
alternative when the visual is complex.

## Writing the talking track

The talk track is a **script**, written for the presenter to say aloud:

- Lead with the **story or stakes**, not a restatement of the bullets.
- Put the **evidence, caveats, and numbers** here that would clutter the slide.
- End most tracks with an explicit **transition** that names the tension carrying into the next slide.
- Use `<span class="slate-talktrack__cue">Label:</span>` to mark beats (Open, Evidence, Transition,
  Ask). Keep it to a few short paragraphs - a minute or two of speech per slide.

## Density budget (hard limits)

- **<= 3 key points** per slide - where a *key point* is a distinct claim the audience must
  retain, **not** an item in an enumerated set. One key point may present a complete set of
  facts: "Microsoft already offers five value pillars" is *one* point carried by five tiles;
  "the Solar System has eight planets" is one point, and showing only three to "hit the budget"
  would be absurd. When the set itself is the fact, enumerate all of it.
- **<= ~40 words** of visible *prose* (lead + supporting sentences), excluding the talk track.
  Short titles/labels inside an enumerated tile set do not count against this.
- **One** primary visual block per slide (a single tile set counts as one block).
- **One** H2 (the slide title) per slide; no H1s inside the deck (the hero owns the only H1).
- If a slide carries **two or more competing claims**, split it or move detail to the talk track.

## Procedure

1. **Write the spine** - one line per slide, with the tension on each transition (see above).
2. **Draft each slide** from the anatomy: kicker + number, title, optional lead, one visual block.
3. **Write each talking track** - the presenter's script, with a transition at the end.
4. **Enforce the density budget** - trim every slide to a few points; push depth into the track.
5. **Add the deck to `docs-manifest.json`** with an `icon` (e.g. `co_present` / `slideshow`) and a
   `status` if it's a draft.
6. **Self-review visually** (see below); fix overflow, overload, and weak transitions.

## Self-review checklist

- [ ] There is a written **spine**; each slide has a clear **motivation to the next**.
- [ ] Every slide lands **<= 3 key points** (distinct claims, not enumerated items); no walls of text.
- [ ] Every slide has **one** primary visual block, chosen to fit the point.
- [ ] Every slide has a **collapsed talking track** ending in a transition.
- [ ] The deck **opens on tension** and **closes on an ask sized to the room** - an invitation for feedback and guidance when presenting up, never a demand.
- [ ] Slides are **self-explanatory** without the track, yet the track adds real depth.
- [ ] Renders cleanly in **light and dark**; no overflow; charts read in both.
- [ ] Only catalog components + inline-SVG visuals; no inline styles/scripts.
- [ ] The deck is in the manifest with an icon (and status if draft).

## Visual QA (borrowed from deck best-practice)

Assume there are problems; hunt them. Open the rendered deck and check each slide for: overloaded
slides (too many points), text overflow past the slide, low-contrast text, a slide with no visual,
inconsistent kicker/number formatting, and transitions that don't actually hand off. Fix, then
re-check - one fix often reveals another.

## Template & reference

Start from [`templates/presentation.html`](../templates/presentation.html). See the components
[`slide.html`](../components/slide.html) and [`talk-track.html`](../components/talk-track.html) for the
exact markup contracts.
