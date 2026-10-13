# Perceived performance: feedback the person can trust

How edit mode and the site stay pleasant while work takes time: what a person must see within 100 ms, 1 s and 10 s, which feedback pattern each kind of wait gets, and the rules that keep feedback honest. It's the design half of performance; the measuring half is in [Measuring performance](performance.md), and the numbers and plan are in [the October 2026 report](performance-report.md).

> **TL;DR.**
> - **Speed is felt, not measured.** A 1.5 s save that shows "Saving…" at once and "Saved" after feels faster than a 0.8 s save with no sign of life. Every action gets the feedback its wait deserves, and none gets more.
> - **Four classes of wait,** after Nielsen's response-time limits and the Doherty threshold: **instant** (under 100 ms: no indicator), **responsive** (100 ms to 1 s: an inline state change, never a spinner that flashes), **waiting** (1 to 10 s: an indicator that says what is happening, and the screen stays usable), **long** (over 10 s: steps and progress, run in the background, cancellable where possible).
> - **Never block input, never lose it, never lie.** Typing is always echoed at once; nothing the person typed is ever dropped by a refresh; "Saved" means it's on disk.
> - **Keep the old view until the new one is ready.** A refresh changes content in place; it never blanks a region, the canvas or the page.
> - **One place tells the truth:** the top bar's status line says what is saving, what is updating and what failed, with how long ago; nothing else invents its own.
> - **Every pattern has a metric** in the benchmark (`npm run perf:bench`), so a feedback promise ("the canvas shows a new block within 1 s") is checked, not hoped.

<figure class="slate-figure">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 300" role="img" aria-labelledby="pp-bands__title pp-bands__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="pp-bands__title">Four classes of wait, and the feedback each gets</title>
<desc id="pp-bands__desc">A timeline from 0 to more than 10 seconds split into four bands. Instant, under 100 milliseconds: the result itself, no indicator. Responsive, 100 milliseconds to 1 second: an inline state such as Saving then Saved, shown only after 300 milliseconds so it never flashes. Waiting, 1 to 10 seconds: an indicator that names the work, keeping the old view and the controls usable. Long, over 10 seconds: steps with progress, in the background, with a way to cancel or leave.</desc>
<g id="pp-bands__instant" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="pp-bands__body-1" x="30" y="40" width="210" height="200" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="50" y="74" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="18" font-weight="600" data-slate-fit-target="pp-bands__body-1" data-slate-fit-padding="16">Instant</text>
<text x="50" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="pp-bands__body-1" data-slate-fit-padding="16">under 100 ms</text>
<text x="50" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="pp-bands__body-1" data-slate-fit-padding="16">The result itself</text>
<text x="50" y="166" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="pp-bands__body-1" data-slate-fit-padding="16">No indicator</text>
<text x="50" y="206" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="pp-bands__body-1" data-slate-fit-padding="16">Type, select, open a menu</text>
</g>
<g id="pp-bands__responsive" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="pp-bands__body-2" x="270" y="40" width="210" height="200" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="290" y="74" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="18" font-weight="600" data-slate-fit-target="pp-bands__body-2" data-slate-fit-padding="16">Responsive</text>
<text x="290" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="pp-bands__body-2" data-slate-fit-padding="16">100 ms to 1 s</text>
<text x="290" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="pp-bands__body-2" data-slate-fit-padding="16">Inline state change</text>
<text x="290" y="166" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="pp-bands__body-2" data-slate-fit-padding="16">Shown after 300 ms</text>
<text x="290" y="206" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="pp-bands__body-2" data-slate-fit-padding="16">Save, swap a region</text>
</g>
<g id="pp-bands__waiting" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="pp-bands__body-3" x="510" y="40" width="210" height="200" rx="16" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="530" y="74" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="18" font-weight="600" data-slate-fit-target="pp-bands__body-3" data-slate-fit-padding="16">Waiting</text>
<text x="530" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="pp-bands__body-3" data-slate-fit-padding="16">1 to 10 s</text>
<text x="530" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="pp-bands__body-3" data-slate-fit-padding="16">Names the work</text>
<text x="530" y="166" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="pp-bands__body-3" data-slate-fit-padding="16">Old view stays usable</text>
<text x="530" y="206" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="12" data-slate-fit-target="pp-bands__body-3" data-slate-fit-padding="16">Open a screen, redraw</text>
</g>
<g id="pp-bands__long" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="pp-bands__body-4" x="750" y="40" width="220" height="200" rx="16" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="770" y="74" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="18" font-weight="600" data-slate-fit-target="pp-bands__body-4" data-slate-fit-padding="16">Long</text>
<text x="770" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="pp-bands__body-4" data-slate-fit-padding="16">over 10 s</text>
<text x="770" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="pp-bands__body-4" data-slate-fit-padding="16">Steps and progress</text>
<text x="770" y="166" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="pp-bands__body-4" data-slate-fit-padding="16">Background, cancel</text>
<text x="770" y="206" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="12" data-slate-fit-target="pp-bands__body-4" data-slate-fit-padding="16">Upload, save to remote</text>
</g>
<g id="pp-bands__axis" data-slate-svg-step="5" data-slate-svg-effect="draw">
<path d="M30 270 L970 270" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="979,270 970,275 970,265" fill="var(--color-neutral-fg-2)" />
</g>
<text x="30" y="292" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">0</text>
<text x="255" y="292" text-anchor="middle" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">100 ms</text>
<text x="495" y="292" text-anchor="middle" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">1 s</text>
<text x="735" y="292" text-anchor="middle" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">10 s</text>
</svg>
<figcaption>The four classes of wait. The boundaries are Nielsen's response-time limits (0.1 s, 1 s, 10 s); the 300 ms delay before an indicator keeps a fast result from flashing one.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The classes, as a table</summary>

| Class | Wait | What the person sees | Examples in edit mode |
|---|---|---|---|
| Instant | under 100 ms | The result itself; no indicator | Typing, selecting a block, opening the palette or a menu, switching an inspector tab |
| Responsive | 100 ms to 1 s | An inline state change ("Saving…" then "Saved"), shown only if the wait passes 300 ms | Saving a change, swapping a region, opening a picture's details |
| Waiting | 1 to 10 s | An indicator naming the work ("Updating the canvas…"), with the old view kept and the controls usable | Opening a screen, redrawing the canvas, a picture transformed for the first time |
| Long | over 10 s | Steps with progress and elapsed time, in the background, cancellable or leavable | Uploading a video, cropping a large picture, saving to remote, the first screen after the dev server starts |

</details>

## 1. Why perceived performance

A person doesn't experience milliseconds; they experience whether the tool **answered**, whether it's **still working**, and whether what it says is **true**. The research is old and stable:

- **Response-time limits** (Nielsen, 1993; after Miller, 1968). Under **0.1 s**, an action feels direct. Under **1 s**, the flow of thought holds, though the delay is noticed. Past **10 s**, attention leaves, and the person needs to know how long.
- **The Doherty threshold** (Doherty and Thadani, IBM, 1982): productivity climbs sharply when the system answers within about **400 ms**.
- **Progress indicators** (Nielsen Norman Group): a looping indicator for waits of about 2 to 10 s, and a determinate one (percent done, or steps) past 10 s. People tolerate long waits much better when they can see progress.
- **Web Vitals** for the site: Largest Contentful Paint (good at or under 2.5 s), Interaction to Next Paint (good at or under 200 ms) and Cumulative Layout Shift (good at or under 0.1), at the 75th percentile.

The editor's measured problem ([report §3](performance-report.md#3-findings)) isn't only that work is slow; it's that slow work is **silent** or **disruptive**: the canvas reloads to white after a structural change, a region refresh fetches a whole screen with no sign of it, the inspector tab can flip while the person is moving to another field, and the first screen after a restart takes many seconds with nothing but the browser's own spinner. Faster code fixes some of that; honest feedback fixes the rest, and buys time for the code.

## 2. Principles, in order when they conflict

1. **Never block input, never lose it.** Typing is echoed by the browser itself, never by a round trip. A refresh never replaces a field, the canvas text or a selection the person is using (`keep()` in `swapRegions`, the typing guard in `editor.ts`). If a refresh would, it waits, and says why.
2. **Acknowledge within 100 ms.** Every action changes something visible at once: the pressed control, the selection, the new block placeholder. If the real result takes longer, that acknowledgement is the result's stand-in.
3. **Keep the old view until the new one is ready.** Never blank a region, the canvas or the page to redraw it. Swap when the new content is complete (double-buffering), and mark the old one as updating only if the swap passes 300 ms.
4. **Say what is happening, in one place, and show it where it happens.** The top bar's status line (`saveStatus`, `announce`, `remoteSaveStatus` in `scripts/client.ts`) is the one source of truth for saving, updating, background work and failures, and the thing being worked on shows it too (a busy button, a pending row, a region updating). Nothing ever processes without a visible sign: [edit mode §2.2](../editor/spec.md#22-never-a-silent-wait-progress-where-it-happens-proposed-not-built) lists every operation's signs.
5. **Be true.** "Saved" means the store committed it ([edit mode §2.1](../editor/spec.md#21-saved-and-live)). An optimistic view (a block shown before it's saved) is allowed only when a failure puts it back and says so.
6. **Match the indicator to the wait.** No indicator for instant work; no spinner that flashes for a responsive one (delay 300 ms); name the work for a wait; steps and time for a long one.
7. **Preserve context.** Scroll position, focus, the open tab, the selection and the expanded sections survive every refresh.
8. **Fail loudly, recover quietly.** A failure says what happened and what to do, and keeps the person's input; a retry that succeeds just clears the message.

## 3. Patterns

Each pattern names when to use it, how it shows, and the metric that holds it.

| Pattern | Use when | How it shows | Holds it |
|---|---|---|---|
| **Direct echo** | Typing, selecting, toggling | The control's own state; no indicator | `select-block` ≤ 100 ms |
| **Save state** | Any change written to disk | Status line: Unsaved → Saving… (after 300 ms) → Saved, with "just now"; failures stay until fixed | `save-round-trip` ≤ 300 ms; `type-to-saved` ≤ 1.2 s (includes the 800 ms typing pause) |
| **Optimistic placeholder** | A structural change the canvas will redraw (a new block, a move, a deletion) | The outline and canvas show the change at once (a placeholder block); the redraw replaces it in place; a refused save puts it back and says why | `add-block-to-canvas` ≤ 1 s |
| **Stale while updating** | A region or the canvas redrawn after a change elsewhere | The old content stays, dimmed only after 300 ms with "Updating…" in the status line; the new one swaps in complete | `other-tab-updated` ≤ 1 s; `field-to-canvas` ≤ 1 s |
| **Double-buffered canvas** | The canvas must be drawn again | The new canvas loads in a hidden frame and replaces the old one when it says it's ready; scroll and selection carried over | `field-canvas-redraw`; no white frame in the E2E screenshot |
| **Screen skeleton** | Opening a screen that takes over 1 s | The editor's chrome (top bar, navigation) at once; the screen's regions as skeletons with their real layout; content streams in | `warm/*/ready`; `cold/*/ready` |
| **Picture shimmer** | A picture that isn't loaded yet | Its exact box, shimmering (already built: `scripts/pictures.ts`); never a broken icon | `images-settled` |
| **Named wait** | 1 to 10 s of known work | Status line: "Updating the canvas…", "Preparing 118 pictures…", with elapsed time after 3 s | The waiting-class metrics |
| **Background task** | Over 10 s, or work the person needn't watch | A task in the status line with steps ("Checking · Committing · Pushing") and elapsed time; the screen stays usable; a result note when done | `remoteSaveStatus`; upload and crop timings |
| **First-start notice** | The first screen after the dev server starts | A plain page at once: "Starting edit mode: preparing pictures (1 of 2)…", then the screen | `cold/*/ready`, `server-start` |
| **Prefetch on intent** | Navigating between screens and site pages | Hovering or focusing a link fetches the next screen; the click shows it at once | `warm/*/ready` from a hover |

## 4. Rules for building

- **Declare the class.** A new action that waits states its class (instant, responsive, waiting, long) in its pull request, and uses the pattern above for it.
- **Measure it.** Name the wait with `performance.measure('editor:<name>', …)` (as `editor:save`, `editor:swap` and `editor:canvas` are), and add it to the benchmark's interactions with a target in `perf/budgets.json`.
- **Delay indicators by 300 ms,** and keep them up for at least 500 ms once shown, so nothing flickers.
- **Use the status line and the inline sign together,** never a component's own one-off spinner: the inline signs are the shared ones in [edit mode §2.2](../editor/spec.md#22-never-a-silent-wait-progress-where-it-happens-proposed-not-built), driven by the one task tracker.
- **Keep regions independent.** A change redraws only the regions it affects, from data or a fragment, not the whole screen (the report's P1 plan replaces whole-screen fetches).
- **Never reload the canvas while the person is typing in it;** never move focus as a side effect of a save.
- **Copy:** name the work in plain words ("Updating the canvas", not "Loading…"); say the count when there is one ("Preparing 118 pictures"); never apologise in a loop.
- **Accessibility:** the status line is a polite live region; announce the end of a wait, not each tick; honour reduced motion (no shimmer, a still placeholder).

## 5. On the site

The public site follows the same classes, with Web Vitals as its measure:

- **Pictures** keep their box from the first paint (width and height, the shimmer) so nothing shifts (CLS ≤ 0.1).
- **The lead picture** is the Largest Contentful Paint on most pages: it loads first (`fetchpriority`, eager), at the right width; the rest load lazily, nearest first.
- **Section changes** in the design library use the router's in-place swap; a framed page on the planet shows only once ready (`data-ready`).
- **The planet** already loads progressively ([progressive loading](../poc-3d-navigation/progressive-loading.md)): the welcome and the drawn planet are the first paint, and the summoning shows what's coming.

## 6. Where it stands

The patterns already built: the save state and status line, the typing guard, picture shimmer, the planet's progressive load, the framed page's ready fade. The ones the report plans (P1 and P2): the optimistic placeholder, stale while updating, the double-buffered canvas, screen skeletons, named waits, the first-start notice, prefetch on intent and the background task for every long operation. Their order and targets are in [the report, §6](performance-report.md#6-plan). How edit mode applies the optimistic patterns (what shows at once, how the server's redraw confirms it, how a refused change is put back) is proposed in [edit mode's spec, §3.6](../editor/spec.md#36-optimistic-edits-proposed-not-built), for review before it's built.
