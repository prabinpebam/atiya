# Interactive Presentation Motion Architecture

Status: proposed plan  
Scope: generic Slate package capability  
Primary authority: this document  
Related authoring contracts: [Presentation Deck](SKILL.md), [Slide Design](slide-design.md)  
External reference: [HyperFrames](https://github.com/heygen-com/hyperframes), Apache-2.0

## Purpose

Bring HyperFrames-derived animation capabilities into Slate presentations without turning a deck
into a video or surrendering presenter control.

A Slate presentation remains a discrete, navigable deck. The presenter can move forward or back,
jump to any slide, skip slides, revisit a slide, reveal content incrementally, open speaker notes,
and enter or leave presentation mode at any time. Motion exists **inside that navigation model**:
slide entrance, slide-local choreography, fragment reveals, and transitions between selected slides.
No animation may make navigation wait, force the presenter through intermediate slides, or leave a
directly opened slide in an invalid state.

The target is not a wholesale HyperFrames fork. Slate adapts the parts that serve interactive
presentations:

- deterministic, paused, seekable timelines;
- subject/pose/final-state keyframe discipline;
- atomic motion rules, scene recipes, and transition recipes;
- adapters for GSAP, CSS, WAAPI, Lottie, Three.js/WebGL, and later runtimes;
- motion and media opportunity analysis for agents;
- reusable motion blocks and component discovery;
- lint, runtime checks, snapshots, keyframe diagnostics, and animation maps.

Video rendering, encoding, cloud render farms, batch video production, narration mastering, and
video-only track semantics are not presentation-runtime requirements. They may inform authoring
tools or optional export later, but they must not define the live deck.

## Decision

Create a **Slate-native deterministic motion profile** derived from HyperFrames concepts. Keep the
existing semantic slide markup as the content authority and add a trusted presentation controller
plus a declarative motion vocabulary. The controller owns two independent state dimensions:

1. **Navigation state** - which slide or branch is selected.
2. **Motion state** - which deterministic hold point is shown within that slide.

Navigation always wins. A navigation command cancels the current transition, cleans up slide-owned
media and animation state, selects the requested slide, restores its correct hold point, and updates
the URL and presentation surfaces. Motion never owns slide order.

### Why not embed HyperFrames per slide

Embedding independent compositions would preserve the largest amount of HyperFrames behavior, but
it creates nested browsing contexts, duplicated clocks and focus models, expensive startup, weak
theme integration, awkward presenter-note ownership, and accessibility boundaries. It also makes a
simple static deck dependent on a video composition engine.

### Why not copy HyperFrames wholesale

HyperFrames includes valuable motion doctrine and tools, but its complete runtime is optimized for
continuous media compositions. Copying it would import video-only concerns, a large dependency and
security surface, fast-moving upstream internals, and a second implementation that Slate would have
to keep synchronized. Slate should adapt stable concepts and selectively reuse compatible packages
or algorithms behind its own contract.

### Why this profile wins

The profile preserves Slate's searchable, accessible, source-linked document fallback while making
motion deterministic and agent-authorable. It is incremental: a deck without motion remains valid,
and a motion deck still communicates its complete argument when animation is disabled.

## Critical review findings

The first version of this plan had the correct governing principle - navigation owns motion - but
left several implementation-defining choices unresolved. Those ambiguities would create different
behavior across adapters and make the user experience impossible to validate consistently:

- HyperFrames assumes a fixed pixel frame; Slate currently lays slides out as responsive document
  sections. Geometry-dependent motion cannot be correct without choosing an explicit coordinate
  system and resize policy.
- Cancellation was named but not defined. `AbortController` does not itself cancel WAAPI, GSAP,
  Lottie, CSS animation, or Three.js work, and “settle to a known state” did not identify that state.
- Previous, direct selection, revisit, and browser-history restoration could each plausibly land on
  different fragments of the same slide.
- Rapid keyboard, touch, minimap, history, and presenter-sync inputs had no serialization or
  coalescing contract.
- Canonical talking tracks and editable browser-local speaker notes were not distinguished, creating
  privacy, staleness, and source-of-truth risks.
- Light/dark was only a test dimension, not a transaction that can invalidate geometry, resolved
  colors, raster caches, and active motion.
- Performance budgets lacked hardware, percentile, frame, memory, cache, readiness, and direct-jump
  behavior.
- “HyperFrames parity” was not decomposed into provable capabilities. HyperFrames' deterministic
  time-to-pixels behavior does not prove Slate's interruption, reflow, theme, accessibility, or
  presenter synchronization behavior.

The contracts below resolve those issues. Where evidence is still needed, the plan specifies a
bounded experiment rather than leaving runtime behavior to implementation choice.

## Expected user behavior

### Navigation

- Opening a deck shows slide 1 at its declared initial hold point.
- `Next` advances to the next unrevealed fragment on the current slide; after the final fragment it
  advances to the next slide.
- `Previous` moves to the prior fragment; from the first fragment it moves to the previous slide at
  that slide's final hold point.
- Selecting a minimap item, slide number, search result, or direct URL jumps directly to that slide.
  Intermediate slides and their transitions do not play.
- A presenter can skip from slide 2 to slide 8 while slide 2 is still animating. The deck cancels
  slide 2 cleanly and establishes slide 8 without visual residue.
- Relative `Previous` across a slide boundary lands on the previous slide's final navigable hold.
  Relative `Next` across a boundary lands on the next slide's initial hold. Neither replays the
  skipped side of the boundary.
- Direct selection follows the selected slide's revisit policy: `restore` (default remembered hold),
  `start`, or `end`. Browser history restores its exact recorded hold. A future branch return restores
  the exact suspended parent hold. The presenter can explicitly restart the current slide from its
  initial hold.
- Browser back/forward restores slide and fragment state without replaying unrelated slides.
- The URL encodes stable slide identity and optional fragment identity, not transient milliseconds.
- Fullscreen/presentation mode does not alter navigation semantics.

#### Navigation command policy

All navigation sources use one serialized dispatcher. There is no independent keyboard queue,
minimap queue, transition queue, or audience-sync queue.

- Absolute commands (`goToSlide`, `goToFragment`, browser-history restore, audience snapshot) are
  **latest-intent-wins** and replace pending relative commands.
- Repeated relative commands while unsettled coalesce into a bounded signed delta rather than an
  unbounded FIFO. Opposing uncommitted deltas cancel algebraically.
- A semantic destination commits before any optional transition begins. Animation completion never
  commits navigation state.
- Every asynchronous callback verifies controller generation, navigation revision, deck revision,
  slide ID, fragment ID, theme epoch, and layout epoch before changing state or pixels.
- Deck-edge commands are harmless no-ops, and disabled controls expose their disabled state.
- A watchdog commits the destination's static hold if preparation, cancellation, or transition
  exceeds its budget. Navigation never waits indefinitely for animation readiness.

Canonical URL/history policy:

- adjacent slide changes and direct jumps use `pushState`;
- fragment reveals use `replaceState` by default so browser Back does not traverse every reveal;
- initialization, URL canonicalization, theme/motion preference changes, and sync corrections use
  `replaceState`;
- `popstate` restores the exact stable state with a cut and creates no new history entry;
- an unknown slide ID falls back to the first valid slide and replaces the invalid URL; an unknown
  fragment ID falls back to that slide's initial hold;
- reading-mode anchors retain normal document behavior and are not converted into presentation
  history entries.

### Animation playback

- Motion begins only after the selected slide is mounted, laid out, and ready.
- A slide may have an entrance segment, zero or more fragment segments, an idle hold, and an exit
  segment. Every segment has an explicit deterministic end state.
- The presenter may pause/resume slide-local playback, restart the slide, or seek to a fragment.
- Autoplay never advances to another slide. Auto-advance, if ever supported, is an explicit deck
  option that defaults off and remains interruptible.
- Between-slide transitions run only for adjacent `Next`/`Previous` navigation. Direct jumps use a
  bounded jump transition or no transition; they never simulate traversal through skipped slides.
- Reversing direction during a transition cancels and resolves to a known state before starting the
  new navigation operation.
- Interactive controls inside the active slide remain usable. Hidden or outgoing slides are
  `inert`, `aria-hidden`, and unable to receive pointer events.

#### Interruption transaction

Every navigation operation, including one received midway through an entrance or transition, follows
the same atomic order:

1. Accept the newest command, increment the navigation revision, and invalidate stale callbacks.
2. Abort outgoing transition and slide-local playback; typed cancellation is not an operational
   error.
3. Disable outgoing hit testing and accessibility exposure immediately.
4. Pause/reset outgoing slide-owned media.
5. Apply the outgoing slide's declared cleanup state idempotently without flashing an intermediate
   pose.
6. Select and mount the destination, then synchronously apply its direct-entry stable hold.
7. Commit URL/history and presenter/audience semantic state.
8. Hand off focus according to input modality.
9. Optionally animate from the committed hold only if readiness arrives before the entrance deadline
   and the revision/epochs still match. Never start an entrance late.

Backward navigation does **not** generically reverse a running animation object. Each transition has
an explicit backward variant; absent one, backward navigation uses the reduced transition or a cut.
Adapter `cancel`, stable-state application, and `dispose` operations must be idempotent.

### Responsive reading and fixed presentation geometry

HyperFrames animation is authored against a fixed frame. Slate needs that geometric stability in
presentation mode, but using it everywhere would damage document reading, browser zoom, localization,
and mobile accessibility. Slate therefore uses a **hybrid layout contract**:

- **Reading mode** remains responsive document flow. Slides reflow, talking tracks expand inline,
  search/anchors work normally, and presentation animation is off except for ordinary Slate
  micro-interactions. Reading mode never becomes a scaled desktop slide.
- **Presenter and audience modes** use a bounded logical stage with a per-deck authoring size and
  aspect ratio. The initial default is $1600 \times 900$ CSS units (16:9), but the values are explicit
  deck metadata rather than constants in recipes.
- The stage fits the available audience viewport with one uniform root scale:

  $$s=\min\left(\frac{W_{available}}{W_{stage}},\frac{H_{available}}{H_{stage}}\right)$$

  It is centered and letterboxed. Presenter chrome and safe-area insets are excluded from
  $W_{available}$ and $H_{available}$.
- Motion targets use logical-stage coordinates, normalized proportions, or measured target-relative
  geometry. They never use raw screen pixels. Pointer hit testing is performed by the transformed DOM,
  not by separately scaled coordinate math.
- At high browser zoom, narrow dimensions, large text settings, or content overflow where fitted text
  would fall below the minimum readable size, presentation mode enters an accessible **reflow escape**:
  transitions become cuts, the current slide may scroll inside the audience stage, and all information
  remains reachable. Visual fidelity never outranks readability.
- Localized and data-bound content is resolved before geometry-dependent preparation. Recipes never
  encode distances from one language's line breaks. Text expansion, font fallback, bidirectional
  direction changes, number/date formatting, live-data updates, and user font settings invalidate the
  layout epoch. If expanded content cannot fit the declared stage at readable size, use reflow escape
  rather than clipping, shrinking beyond the floor, or changing Product meaning.
- Reading scroll position and focused origin are preserved when entering/leaving presentation mode.
  Expanding notes in reading mode does not activate fragment navigation.

Geometry-dependent motion uses a `layoutEpoch`. Resize, orientation, browser zoom, device pixel ratio,
display move, font completion, theme change, fullscreen change, presenter-panel resize, and relevant
content mutation invalidate that epoch. Invalidation pauses motion, commits the current stable hold,
remeasures and rebuilds affected handles, then remains paused unless the current command explicitly
permits a new segment. Motion authored against an old epoch must not resume.

Transform rules:

- apply motion to a dedicated wrapper so layout/content transforms and animation transforms never
  compete for the same `transform` property;
- recipes declare transform origin, reference box, composition order, and percentage semantics;
- FLIP/shared-element deltas are measured in one common stage/viewport coordinate space using matrix
  transforms after fonts and media are ready;
- reject shared-element motion and use a crossfade when either endpoint is absent, zero-sized,
  virtualized, clipped incompatibly, inside incompatible transformed ancestors, canvas-only,
  duplicated, semantically different, or invalidated during measurement;
- browser View Transitions may optimize an implementation but are not the portable contract.

### Reduced motion and fallback

- `prefers-reduced-motion: reduce` defaults to semantic cuts and immediate fragment state changes.
- The user can choose `Full`, `Reduced`, or `Off`; this preference is independent from color theme.
- Reduced/off modes preserve every fact, label, relationship, and fragment. Motion cannot be the
  only way information becomes available.
- Printing, static export, indexing, and no-JavaScript fallback show complete slide content in its
  final semantic state, with presenter notes collapsed or omitted according to the export target.
  Static **reading** output exposes all fragment content; a future per-fragment handout/export must
  generate explicit pages rather than hiding answers with runtime-only CSS.
- A failed optional runtime (for example WebGL or Lottie) falls back to a declared static poster or
  final DOM state without blocking slide navigation.

### Presenter and audience surfaces

- `Present` opens an audience surface while the original tab becomes the presenter surface.
- Presenter and audience synchronize stable `{deckId, slideId, fragmentId, revision}` state over a
  same-origin channel; they do not stream wall-clock animation time continuously.
- The audience animates locally from the synchronized hold point and acknowledges readiness. Late or
  backgrounded audience tabs seek to the latest stable state instead of replaying stale commands.
- The presenter surface shows current slide, next-slide preview, editable local notes, slide and
  fragment progress, elapsed time, motion status, and an audience connection indicator.
- Presenter-note edits remain browser-local overlays unless a separate authoring workflow explicitly
  writes them back to source.
- Keyboard, pointer, touch, and assistive-technology controls expose the same operations. Presenter
  shortcuts are ignored while focus is in an input, editable notes, dialog, or native media control.

#### Speaker notes UX and privacy

The `<details class="slate-talktrack">` in source is the canonical speaker script. Presentation mode
shows it read-only by default. Editing creates a clearly labeled **personal overlay**, never a second
silent authority:

- the UI distinguishes `Canonical script` from `My presenter notes` and states `Saved in this
  browser` or `Not saved`;
- overlay storage keys include project/deck identity, source revision, and stable slide ID, never
  slide index;
- after a source revision changes, the old overlay is retained but marked `May be stale`; it never
  silently replaces revised canonical notes;
- autosave is debounced, exposes saving/saved/error status, and preserves in-memory text across
  presenter rerenders; storage denial/quota failure leaves editing usable and visible as unsaved;
- the presenter can reset the overlay to canonical, copy canonical into the overlay, search notes,
  resize notes text, and scroll notes independently of current/next previews;
- leaving presenter mode preserves the overlay or warns when persistence failed;
- notes never enter the audience DOM, accessibility tree, URL, history state, synchronization
  messages, screenshot preview, window title, telemetry, or diagnostics;
- presenter shortcuts are suppressed throughout the editor, IME composition, dialogs, and native
  media controls.

The presenter layout prioritizes current slide, next-slide preview, notes, slide/fragment progress,
elapsed time, and sync status. Panels are resizable with keyboard-accessible controls and saved
locally. Collapse states never change the logical audience stage size; they only change the
presenter's fitted preview.

#### Synchronization and lifecycle

Starting Present creates an unguessable `sessionId` and stable `presenterId`. Messages include
protocol version, deck revision, session/sender IDs, monotonic sequence, message type, and a complete
stable `{deckId, slideId, fragmentId, motionMode, theme}` snapshot.

- Exactly one presenter is authoritative. Audience surfaces never emit navigation.
- Audience startup sends `hello`; the presenter responds with a full snapshot. Full snapshots also
  follow reconnect, visibility restoration, and readiness.
- Audience surfaces ignore wrong-session, wrong-deck, incompatible-version, duplicate, and lower-
  sequence messages.
- Semantic destination commits immediately. Local transition motion runs only for an explicitly
  adjacent action received while ready; otherwise the audience cuts to the stable hold.
- Connection status distinguishes `opening`, `ready`, `stale`, `disconnected`, `incompatible`, and
  `closed`. If the presenter closes, the audience retains the last stable slide and discloses that
  synchronization stopped.
- `BroadcastChannel` is same-origin transport, not authorization. Session nonces and source-window
  binding prevent unrelated same-origin pages from joining accidentally; remote-device presenting
  requires a separately threat-modeled transport.
- Popup denial leaves the source tab unchanged and offers an explicit retry. Fullscreen denial does
  not fail Present. Fullscreen changes invalidate layout but not semantic position.
- Baseline multi-monitor UX asks the user to move the audience window to the intended display.
  Automatic display placement is progressive enhancement only and is never claimed as baseline.

Keyboard/pointer behavior is explicit: Arrow Right/Down, Page Down, and Space advance; Arrow Left/Up,
Page Up, and Shift+Space go back; Home/End jump; Escape closes the topmost dialog/help surface and
then exits fullscreen without navigating. Shortcuts ignore handled events, modifiers, editable
content, IME composition, controls, links, and dialogs. Swipe requires a horizontal-dominant gesture
and never starts from controls, scrollable content, text selection, media, or pan/zoom diagrams.
Keyboard/assistive navigation moves focus to the destination heading; pointer/touch normally retains
control focus. Audience sync does not repeatedly move DOM focus and may use a polite live-region
announcement instead.

## Architecture

### Layer 1: semantic deck content

The existing body-fragment contract remains authoritative:

```html
<div class="slate-deck" data-deck-id="family-2027">
  <section class="slate-slide" id="credible-value">
    <!-- semantic title, visible content, figures, and talking track -->
  </section>
</div>
```

Authors do not add executable scripts, `<style>`, event handlers, or arbitrary library setup. Slate's
sanitizer continues to forbid them. A motion deck without the trusted runtime is still a readable
deck.

### Layer 2: declarative motion plan

Motion is declared with a bounded Slate vocabulary. The final representation should be chosen after
the Stage 2 motion prototype from these two compatible forms:

1. sanitizer-allowlisted `data-motion-*` attributes for small local effects; and
2. one inert JSON motion manifest loaded as a sibling host asset for complex timelines.

Do not permit authored executable JavaScript. Do not use a generic expression language. Manifest
values are data: stable IDs, target IDs, named recipes, normalized times, numeric parameters,
easing IDs, fragment IDs, transition IDs, media IDs, and fallback policy.

Proposed conceptual model:

```json
{
  "version": 1,
  "deckId": "family-2027",
  "defaultRevisit": "restore",
  "slides": {
    "credible-value": {
      "durationMs": 1800,
      "entrance": "rise-stagger",
      "fragments": [
        { "id": "need", "atMs": 450 },
        { "id": "support", "atMs": 1050 },
        { "id": "intersection", "atMs": 1650 }
      ],
      "targets": [
        { "id": "need-ring", "recipe": "draw-stroke", "startMs": 0, "durationMs": 600 },
        { "id": "support-ring", "recipe": "draw-stroke", "startMs": 450, "durationMs": 600 }
      ],
      "fallback": "end"
    }
  },
  "transitions": {
    "defaultForward": "shared-axis-x",
    "defaultBackward": "shared-axis-x-reverse",
    "jump": "crossfade-short"
  }
}
```

All targets use stable authored IDs or future generated `data-slate-motion-id` values. CSS selectors,
DOM traversal expressions, and script strings are forbidden in the portable contract.

### Layer 3: presentation controller

Add one trusted package-owned controller to the Slate shell. It owns:

- deck discovery and manifest validation;
- slide/fragment state, history, direct links, and revisit policy;
- keyboard, pointer, touch, minimap, and presenter controls;
- cancellation through `AbortController` and monotonically increasing navigation revisions;
- transition selection by navigation intent (`forward`, `backward`, `jump`, `restore`);
- active/inert/hidden slide lifecycle;
- media pause/reset policy on slide exit;
- reduced-motion policy;
- presenter/audience synchronization;
- adapter registration, readiness, failure isolation, and fallback;
- state-change events for diagnostics and optional extensions.

The controller exposes commands such as `goToSlide`, `next`, `previous`, `goToFragment`, `restart`,
`pauseMotion`, and `resumeMotion`. It does not expose raw timeline instances as the public contract.

The controller has explicit states (`reading`, `preparing`, `stable`, `playing`, `transitioning`,
`paused`, `degraded`) and one-way recovery for each operation. A failure cannot leave it in an
unnamed in-between state.

### Layer 4: deterministic slide timelines

Adapt HyperFrames' seek-safe rules to one local timeline per slide:

- construct timelines synchronously after sanitized content is attached and layout is stable;
- keep each timeline paused; the controller seeks or plays bounded segments;
- register by stable `deckId/slideId`, never by incidental index;
- finite durations and iterations only;
- no `Date.now`, `performance.now`, unseeded randomness, timers, scroll-triggered critical motion,
  unregistered `requestAnimationFrame`, or asynchronously created critical timelines;
- animate visual channels allowed by the property cost model (`transform`, opacity, bounded masks or
  clip paths, SVG path/dash, approved CSS variables, camera/object transforms), not layout lifecycle
  (`display`, raw visibility, top/left, width/height, margins);
- preserve subject identity where continuity matters; crossfade only for intentional replacement;
- define and verify initial, proof, fragment, final-minus-hold, and exact final states;
- hold readable semantic states long enough for a human presenter to talk to them;
- leave every canceled or completed segment in a declared stable state.

Timeline coordinates are **slide-local normalized milliseconds**, not a deck-wide video clock. This
prevents slide insertion or reordering from invalidating every later animation timestamp.

#### Readiness barrier

“Ready” is bounded and resource-specific. Preparation waits only for resources used by the selected
slide and may include used font faces, `image.decode()`, inline/external SVG resources, video metadata
and requested seek completion, Lottie initialization, Three.js textures/models, and two stable layout
observations for geometry-dependent motion.

Navigation never waits for readiness. A direct destination must show its semantic stable fallback
within 100 ms under the baseline profile. Preparation continues behind that fallback. Entrance motion
may begin only before the slide's declared entrance deadline (initial target: 250 ms after commit) and
only while revision, theme, and layout epochs remain current; after that deadline it is skipped rather
than appearing late. Every resource wait has a timeout, abort path, and diagnostic.

### Layer 5: runtime adapters

Use a small adapter interface so the presentation controller has one lifecycle regardless of motion
runtime:

```text
prepare(slide, plan, context) -> handle
seek(handle, timeMs)
play(handle, fromMs, toMs, signal) -> Promise
cancel(handle, reason, resolution)
pause(handle)
applyStableState(handle, holdId)
finish(handle, fallbackState)
dispose(handle)
inspect(handle) -> diagnostics
```

`applyStableState` is idempotent and independent from prior playback. `cancel` resolves to `start`,
`nearest-hold`, `destination-hold`, or `static-fallback` as directed by the controller. An
`AbortSignal` alone is not considered cancellation support.

Adapter obligations:

- **WAAPI:** enumerate owned animations; pause/cancel explicitly; handle `finished` cancellation;
  avoid uncontrolled `commitStyles`; restore authored styles on disposal.
- **GSAP:** scope work in an owned context; pause/kill/revert owned tweens and callbacks; prohibit
  transform ownership overlap and orphan completion callbacks.
- **CSS:** enumerate owned `Animation` objects and finite durations; negative delay is a seek
  mechanism, not a cleanup mechanism.
- **Lottie:** use frame/time seeking, `goToAndStop`, listener cleanup, and `destroy`; poster fallback
  is mandatory.
- **Three.js/WebGL:** stop owned loops, ignore stale loader completion, dispose geometry/materials/
  textures/render targets, handle context loss, and restore from the current stable hold or poster.
- **Anime.js:** register and remove every instance; prove deterministic seek/cancel before support.

Planned adapters, in order:

1. **WAAPI** - baseline, dependency-free DOM/SVG keyframes and transitions.
2. **GSAP** - default advanced choreography, labels, staggers, FLIP, paths, and richer easing.
3. **CSS keyframes** - simple finite decorative motifs controlled through deterministic negative
   delay/play-state seeking.
4. **Lottie/dotLottie** - pre-baked finite assets with explicit poster fallback.
5. **Three.js/WebGL** - bounded 3D/canvas scenes with explicit frame-seek hooks and static fallback.
6. **Anime.js** - optional lightweight adapter only if it provides a demonstrated size or authoring
   advantage not covered by WAAPI/GSAP.
7. **WebGPU/TypeGPU** - experimental, capability-gated, never required to understand a slide.

Do not load every adapter on every deck. The validated motion manifest declares required capabilities;
the shell loads only approved local/vendored modules. Network CDNs are not part of the portable
runtime contract.

#### Animation property cost model

Do not describe every visual channel as compositor-safe:

- **Preferred:** transforms and opacity on bounded dedicated wrappers.
- **Paint-risk:** SVG paint/dash/path, clip paths, masks, filters, shadows, gradients, background
  colors, and custom properties that drive paint. Use only on bounded regions with measured frame
  evidence.
- **Layout-forbidden during motion:** top/left/right/bottom, width/height, margin/padding, grid/flex
  placement, font size, line height, and DOM insertion/removal as animation state.
- **Adapter-specific:** canvas, WebGL, video, and Lottie updates require their own frame/memory proof.

Large-area masks, filters, backdrop filters, blur, and simultaneous scale/crop motion require an
explicit performance exception. Body text must not use blur, perspective, or rotations that impair
reading.

### Layer 6: transitions

Transitions are owned by the controller, not individual slides. Define a small semantic catalog:

- `cut`
- `crossfade-short`
- `shared-axis-x` / `shared-axis-y`
- `fade-through`
- `push`
- `zoom-focus`
- `shared-element` (later, only when identity mapping is explicit)

Each transition declares forward/backward behavior, duration bounds, interruption behavior, reduced
motion fallback, focus handoff point, and whether it supports arbitrary jump navigation. Avoid video
editing transitions that obscure content or make navigation feel delayed.

Adjacent navigation may animate both outgoing and incoming slides. Jump navigation must remain short
and direction-neutral unless the source and destination have an explicit relationship. Transition
duration should normally remain between 150 and 500 ms; the presenter should never wait through a
cinematic sequence to reach a selected slide.

### Layer 7: themes and visual design

HyperFrames provides two different kinds of visual guidance:

1. a product/docs design system (`DESIGN.md`) for HyperFrames' own brand; and
2. agent creative guidance (`hyperframes-creative`) covering `frame.md`/`design.md` precedence,
   palettes, typography, frame composition, data-in-motion, beat direction, motion principles, and
   house-style defaults when no brand specification exists.

Slate adapts the **method**, not HyperFrames' visual brand. The host's Slate theme and deck visual
philosophy remain authoritative. HyperFrames' video-composition advice (fixed-frame scale, denser
layering, ambient decoration, high visual intensity) is optional inspiration and often conflicts
with a calm, presenter-led, accessible deck. In particular, its house-style advice to animate every
decorative element is not adopted.

Add a presentation motion-design companion with these defaults:

- motion communicates hierarchy, causality, sequence, continuity, comparison, or focus;
- one dominant motion event at a time; no continuous decorative motion by default;
- bound travel relative to stage size; large-field pan/zoom and parallax require a reason and a
  reduced-motion replacement;
- preserve reading order, stable line boxes, subject identity, and deliberate final holds;
- use restrained translation/opacity/masks for text; no body-text blur, deep perspective, rapid
  character scatter, or gratuitous rotation;
- transitions express navigation direction and relationship, not spectacle;
- the deck's visual/motion philosophy, Slate tokens, and Product/brand authority override any
  HyperFrames house-style default;
- every recipe documents its communication purpose and when it must not be used.

#### Light and dark mode transaction

Recipes use semantic color roles and theme-resolved CSS variables, never hard-coded theme colors
captured permanently at preparation time. A theme switch is transactional:

1. invalidate the theme and active visual-work revisions;
2. cancel to the current semantic stable hold;
3. apply the new theme;
4. await used fonts/styles and one stable layout observation;
5. invalidate geometry, snapshots, posters, canvas textures, Lottie/theme substitutions, and
   resolved-color caches;
6. rebuild affected handles at the same slide/fragment hold;
7. remain paused unless the user explicitly restarts or resumes.

Theme change does not replay entrances or change navigation history. Validate initial, proof,
fragment, and final states in light and dark, including **intermediate-frame contrast**; endpoint
contrast alone is insufficient because interpolation can cross an unreadable midpoint. Assets that
cannot adapt declare paired variants or one verified theme-neutral treatment. Audience theme follows
the presenter's stable snapshot by default; any local audience override requires a later explicit
policy.

## Agent skill and tool adaptation

Create a presentation-motion router under `slate/presentation/motion/` rather than copying all
HyperFrames skills verbatim. Preserve upstream provenance in each adapted reference and pin the
reviewed HyperFrames revision in a machine-readable inventory.

### Skills to adapt

| HyperFrames capability | Slate adaptation | Include | Exclude or defer |
| --- | --- | --- | --- |
| Core composition contract | Slide-local timeline and fragment contract | determinism, stable IDs, seekability, final-state rules | video clips/tracks, encoding, global video clock |
| Animation rules | Motion recipe catalog | atomic entrance, emphasis, data, path, mask, SVG, text, FLIP, 3D rules | recipes that require linear playback |
| Keyframes | Presentation keyframe skill | subject/pose analysis, mechanism selection, seek-safe rules, diagnostics | video-render-only assumptions |
| Creative direction | Motion direction companion | motion philosophy, beat/rhythm planning, data-in-motion, typography motion | narration and video-density defaults unless requested |
| Registry | Slate motion catalog | discover/install approved recipes and assets by ID/tag | arbitrary pasted scripts/styles |
| Media-use | Presentation media opportunity pass | identify useful image/icon/Lottie/video/SFX opportunities, reuse and provenance | silent automatic media generation; BGM/voice by default |
| CLI diagnostics | Slate motion validation tools | lint, runtime check, snapshots, keyframe strips, animation map, contrast/layout checks | MP4 render/cloud infrastructure |
| HyperFrames slideshow | Navigation behavior reference | fragments, branches, presenter/audience model, media cleanup | its continuous composition clock and wrapper contract |

### Agent workflow

When creating or reviewing an animated deck, the agent must:

1. Write the narrative spine and static slide composition first.
2. Write a short motion philosophy: what motion communicates, its energy, and what must remain still.
3. Run one **motion opportunity pass** over each slide:
   - identify the subject and the relationship/change that motion can clarify;
   - name initial, proof, fragment, and final states;
   - reject decorative motion with no communication role;
   - choose the smallest recipe/runtime that proves the point;
   - record reduced/off behavior.
4. Run one **media opportunity pass** across the deck, consolidated rather than per element. Propose
   specific additions and obtain approval before adding generated or paid media.
5. Author or select only approved motion recipes and transitions.
6. Validate stable state at direct entry, adjacent entry, revisit, reverse navigation, interruption,
   reduced motion, and exact final state.
7. Preview the interactive deck; do not treat static checks as user approval.

### Motion opportunity record

Each animated slide should have an agent-readable planning record, either in an inert companion file
or generated from the manifest:

```text
slideId: credible-value
communicationGoal: reveal that value exists only in the overlap
subject: two rings and their intersection
states: separate -> approaching -> overlap emphasized -> final labeled model
mechanism: SVG stroke draw + transform + opacity
fragments: need, support, intersection
runtime: WAAPI
reducedMotion: show each fragment as an immediate state change
staticFallback: final labeled model
proofTimes: 0, 450, 1050, 1650, 1800 ms
```

## Security, portability, and provenance

- Keep authored presentation fragments script-free and style-free.
- Extend the sanitizer with an explicit allowlist of versioned motion attributes only after schema
  validation exists. Never allow arbitrary `on*`, `style`, selector, URL, or expression fields.
- Load runtime code and adapters from package-owned local assets subject to the existing runtime hash
  and synchronization model.
- Validate all manifest paths against the host root; reject traversal, remote script URLs, oversized
  assets, duplicate IDs, unknown recipes, unknown adapters, and unsupported schema versions.
- Treat SVG and Lottie as untrusted data. Sanitize SVG; validate Lottie structure and resource URLs;
  cap nodes, keyframes, duration, dimensions, and decoded asset size.
- Motion recipes copied or adapted from HyperFrames require source URL, pinned revision, license,
  local modifications, and compatibility notes. Prefer clean-room adaptation of concepts where the
  original recipe contains runtime-specific implementation.
- Do not silently fetch HyperFrames `main` during authoring or runtime. An explicit update tool may
  compare a pinned upstream revision and produce a reviewable change set.
- Preserve Slate's offline, static-host capability. Optional media-generation providers and external
  CLIs are authoring-time tools, never runtime requirements.

## Accessibility requirements

- Slide and fragment controls have accessible names, disabled states, and announced position
  (`Slide 4 of 9`, `Reveal 2 of 3`).
- Keyboard and assistive-technology navigation moves focus once to the selected slide's heading;
  pointer/touch navigation normally preserves control focus. Fragment reveals do not steal focus,
  and audience synchronization never repeatedly moves DOM focus.
- Hidden slides are removed from sequential focus and accessibility traversal while preserving the
  full semantic source for print/static fallback.
- No essential meaning depends on motion, color change, parallax, hover, sound, or depth perception.
- Flashing stays below WCAG thresholds; camera motion and large-field zoom are reduced by default for
  reduced-motion users.
- Pausable motion applies to any non-essential motion lasting more than five seconds. Idle animation
  is finite or explicitly user-controlled.
- Animated text preserves reading order and line boxes; character-level effects expose one coherent
  text node to assistive technology.
- Presenter and audience surfaces remain usable at 200% zoom and with keyboard only.

## Performance budgets

Performance is part of navigation correctness. Initial budgets are hypotheses to validate on a
declared baseline profile (browser/version, OS, hardware class, viewport, DPR, cold/warm cache, deck
size, adapter set, and media load). Report p50 and p95 rather than one best run:

- A non-motion deck pays no adapter download cost.
- Base presentation-controller addition: target <= 35 KB compressed.
- WAAPI recipe/catalog addition: target <= 20 KB compressed.
- GSAP and other adapters load on demand and report their cost in diagnostics.
- A direct jump commits a complete semantic stable hold in <= 100 ms p95; it does not wait for heavy
  adapter preparation.
- A normal adjacent transition reaches stable destination in <= 550 ms p95.
- At 60 Hz, target <= 16.7 ms per transition frame and <= 1% dropped frames on the baseline fixture;
  report 120 Hz separately where available.
- No long task over 50 ms and no repeated 20-40 ms main-thread blocks during navigation.
- Layout shift after destination commit is 0 for fitted presentation mode; reflow escape declares and
  tests its intentional scroll/layout behavior.
- Record input delay, stable-state latency, transition duration, dropped-frame ratio, worst frame,
  CLS, adapter parse/compile time, readiness timeouts, disposal time, JS heap, decoded media bytes,
  and estimated GPU texture bytes.
- Canvas/WebGL decks declare memory estimates and recover from context loss.

Instrument with controller performance marks/measures, `PerformanceObserver` where supported
(`event`, `longtask`, `layout-shift`, `resource`), sampled `requestAnimationFrame` deltas, and adapter
diagnostics. Unsupported instrumentation is reported, not silently treated as passing.

Cache policy is explicit:

- immutable adapter modules may remain cached for the session;
- live handles exist only for current/previous/next by default;
- posters, decoded assets, and geometry snapshots have separate byte/count-capped LRU caches;
- geometry caches invalidate on layout/theme/font/DPR/mode/content epochs;
- disposal removes observers/listeners, revokes object URLs, closes `ImageBitmap`s, and frees WebGL
  resources;
- memory pressure or repeated allocation failure degrades the affected slide/adapter to a poster or
  static hold rather than evicting navigation state;
- `pagehide`/`pageshow` and bfcache restoration preserve semantic state and rebuild live handles.

These are hypotheses, not permanent limits. Stage 1 establishes cut-only navigation baselines;
Stage 2 measures motion overhead and must confirm or revise the budgets before they become gates.

## Failure and degradation model

The runtime degrades one way, preserving the selected semantic position:

1. full motion;
2. reduced/cut transitions with fragments;
3. static stable-state slides with navigation;
4. responsive reading document.

- Controller bootstrap failure leaves the original readable document untouched.
- Invalid motion for one slide disables only that slide's motion.
- Duplicate slide IDs or invalid navigation topology disable presentation mode but preserve reading.
- Adapter preparation/transition watchdog expiry commits the destination fallback.
- Repeated adapter failures trip a session circuit breaker for that adapter.
- Context loss rebuilds at the current hold or shows a poster.
- An always-reachable `Disable motion` command uses controller/native UI, never the failed adapter.
- The unenhanced DOM is complete and visible. Only a successfully initialized controller may apply
  enhancement classes that hide fragment/entrance states.
- Invalid manifest, blocked module/CSP, JavaScript disabled, failed media, and print-before-init are
  explicit test fixtures.

## Validation architecture

Add presentation-specific validation rather than relying only on generic Slate tests.

### Static validator

Validate:

- manifest schema/version, stable deck/slide/fragment/target IDs, and unique IDs;
- every plan target resolves to one element in its slide;
- durations are finite, non-negative, and within configured maximums;
- fragment order and hold points are valid;
- recipes, transitions, adapters, easing IDs, and properties are allowlisted;
- all animations declare reduced-motion and static fallback behavior;
- every slide remains understandable when the manifest is absent;
- media paths and provenance records are valid;
- no executable strings, arbitrary selectors, remote runtime URLs, forbidden properties,
  prototype-polluting keys, nonfinite numbers, duplicate normalized IDs, SVG `foreignObject` or
  external references, Lottie external assets, arbitrary shader source, excessive dimensions, or
  oversized compressed/decoded assets.

### Browser behavior suite

Prove at minimum:

- Next/Previous fragment semantics;
- direct jump while entrance or transition is active;
- backward navigation and reverse interruption;
- revisit policies and restart;
- URL deep-link and browser history restoration;
- keyboard scope, touch/swipe thresholds, pointer controls, and focus management;
- hidden slide event/focus gating;
- reduced/off modes;
- presenter/audience synchronization, reconnect, stale-message rejection, and late join;
- media pause/reset on slide exit;
- adapter failure fallback;
- light/dark transactions and intermediate contrast;
- fixed-stage fitting, reflow escape, resize/zoom/DPR/display move, font/media delay, and epoch
  invalidation;
- rapid mixed input bursts, command coalescing, watchdog settlement, and no stale callbacks;
- notes storage denial/quota/revision staleness and proof that notes never reach the audience;
- popup/fullscreen denial, presenter/audience refresh/disconnect, and session split-brain rejection;
- responsive reading mode and restoration of reading scroll/focus.

### Motion diagnostics

Adapt HyperFrames' diagnostics to slide-local time:

- `motion-map`: list targets, recipes, timing, overlap, dead zones, and lifecycle warnings;
- `keyframes`: inspect explicit stops, paths, identity continuity, and final state;
- `motion-shot`: render one selected subject at sampled times as a strip/onion overlay;
- `snapshot --slide <id> --at <fragment|ms>`: capture proof states in light/dark/reduced modes;
- `check-motion`: combine static validation, runtime errors, layout/contrast checks, and optional
  motion assertions;
- stable-state pixel comparisons for initial, every fragment, final-minus-hold, and exact final.

Diagnostics must trust painted pixels over timeline metadata. A registered timeline is not proof that
the intended subject moved, remained readable, or ended correctly.

## HyperFrames animation parity policy

Do not call the capability “HyperFrames animation parity” as one blanket feature. HyperFrames and
Slate solve different runtime problems:

- HyperFrames proves deterministic sampling of a fixed composition at arbitrary time for rendered
  video.
- Slate must prove interactive cancellation, user-controlled navigation, backward/direct entry,
  fixed-stage fitting plus responsive fallback, theme mutation, accessibility, presenter/audience
  synchronization, and browser recovery.

Full product parity is neither necessary nor honest. Animation parity is possible only for bounded
capabilities whose semantics match. Maintain a machine-readable matrix pinned to an upstream commit.
Each row records upstream behavior, Slate analogue, reused versus independently implemented code,
supported browsers, fixture, proof artifact, known differences, and one status:

- `unassessed`
- `unsupported`
- `not-applicable`
- `partial`
- `equivalent`

Example capability rows: paused deterministic GSAP seek, WAAPI keyframes, CSS finite keyframes,
Lottie seek, Three.js seek hook, SVG draw, FLIP, path motion, text bands, masks, transition recipe,
keyframe diagnostics, animation map, and snapshot proof. Do not infer “GSAP parity” from one working
tween or family-level “animation parity” from adapter presence.

Why parity cannot be blanket:

- Slate intentionally excludes video encoding, audio mastering, cloud/distributed rendering,
  global media tracks, batch rendering, and arbitrary composition scripts.
- Slate's sanitizer and declarative catalog intentionally reject parts of HyperFrames' open HTML/JS
  authoring model.
- fixed video frames and interactive responsive presentation surfaces have different geometry and
  lifecycle requirements.
- HyperFrames' success at time-to-pixels seeking does not establish interruption, focus, theme,
  presenter, or audience correctness.

Why bounded parity can be real: when the same runtime mechanism has the same inputs, stable states,
seek semantics, visual proof, and diagnostics, a matrix row may reach `equivalent`. That claim stays
pinned to the tested upstream revision and browser/runtime profile.

## Delivery plan

### Stage 0 - evidence and pinning

1. Record the reviewed HyperFrames repository revision, Apache-2.0 license, skill file inventory,
   and capability map in a provenance manifest.
2. Classify each upstream capability as `adapt`, `reuse-package`, `authoring-only`, `defer`, or
   `exclude`, with rationale.
3. Freeze representative reference recipes for keyframes, transitions, text, SVG, FLIP, Lottie,
   Three.js, and diagnostics. Do not vendor the entire upstream repository.
4. Establish baseline Slate deck behavior, bundle size, accessibility, and load/navigation timing.

Exit: reviewed capability matrix and reproducible baseline measurements.

### Stage 1 - cut-only presentation controller prototype

Build a three-surface package demo **without animation** first: responsive reading page, presenter
surface, and differently sized audience surface.

- explicit stable slide/fragment IDs, URL/history policy, and navigation dispatcher;
- Next/Previous/direct jump/restart, rapid mixed input, coalescing, and deck boundaries;
- fixed logical audience stage, fitting, letterboxing, reflow escape, fullscreen, and resize epochs;
- canonical talking tracks plus personal note overlays, storage failure, and privacy checks;
- presenter ownership, audience hello/snapshot/reconnect, stale-message rejection, and popup failure;
- focus by input modality, keyboard scope, pointer controls, and touch exclusions;
- static fallback and the full degradation ladder.

Do not modify the Product logical-chain deck in this stage.

Exit: three-surface navigation, notes, history, focus, geometry, and synchronization remain correct
through rapid input, refresh, disconnect, popup/fullscreen denial, resize, zoom, and display move.
Failure falsifies the presentation state model before animation can obscure it.

### Stage 2 - bounded WAAPI motion prototype

Add WAAPI beneath the proven Stage 1 controller:

- one three-fragment SVG reveal;
- one adjacent transition and one direct-jump transition;
- cancellation at multiple points during entrance and transition;
- backward navigation with explicit backward transition;
- `Full`, `Reduced`, and `Off` modes;
- delayed font/image readiness and entrance deadline;
- theme and layout epoch invalidation midway through motion;
- 100%, 200%, and 400% browser zoom, DPR change, and reflow escape;
- adapter failure, watchdog settlement, memory/disposal checks, and proof-state snapshots.

Exit: direct jump, backward navigation, interruption, theme/resize changes, reduced motion, and static
fallback all land at the correct stable state with no stale callbacks. Failure falsifies the motion
architecture before dependency expansion.

### Stage 3 - versioned motion contract

1. Select attribute + companion-manifest representation from prototype evidence.
2. Add JSON Schema and semantic validation.
3. Add sanitizer allowlist for only the selected declarative fields.
4. Add stable controller API, events, history contract, and error/fallback model.
5. Add authoring components/templates and update the presentation skill.
6. Add runtime-host synchronization and portability coverage.

Exit: a motion deck authored without scripts passes copied-package initialization, runtime drift,
static validation, browser behavior, and accessibility checks.

### Stage 4 - motion catalog and agent skills

1. Create the presentation-motion router and opportunity-pass workflow.
2. Adapt a deliberately small recipe catalog: entrances, emphasis, stagger, SVG draw, path travel,
   masks/reveals, FLIP/shared geometry, text bands, data changes, and state transitions.
3. Add transition catalog with forward/backward/jump/reduced variants.
4. Add recipe metadata: communication purpose, valid subjects, runtime, parameters, fallback,
   reduced-motion behavior, cost, provenance, and diagnostic expectations.
5. Add discovery tooling by intent/tag and prevent arbitrary snippet installation.
6. Adapt motion-map, keyframe, strip/onion, and proof-snapshot tools.

Exit: an agent can inspect a static slide, propose a justified motion plan, install only approved
recipes, author declarative motion, and produce focused proof artifacts.

### Stage 5 - presenter production hardening

1. Refine current/next previews, canonical/personal notes, elapsed timer, progress, and connection
  states from the Stage 1 prototype.
2. Add media cleanup, global mute only when a deck uses sound, and autoplay-policy handling.
3. Test Google Meet/Zoom background rendering behavior and document supported degraded paths.
4. Add optional multi-screen placement only as permission-gated progressive enhancement.
5. Run notes privacy, channel isolation, revision mismatch, split-brain, and background-throttling
  failure tests.

Exit: presenter can navigate, skip, reveal, interrupt, and recover while the audience remains on the
same stable state without exposing notes.

### Stage 6 - advanced adapters

Add one adapter at a time, only with a real communication need and fixture:

1. GSAP
2. CSS finite animation
3. Lottie/dotLottie
4. Three.js/WebGL
5. Anime.js if still justified
6. WebGPU/TypeGPU as experimental

Each adapter ships with capability detection, lazy loading, deterministic seek tests, interruption,
disposal, reduced motion, static fallback, performance measurement, and failure injection. Do not
declare parity with HyperFrames until an explicit capability matrix proves each claimed behavior.

### Stage 7 - optional media authoring integration

1. Add a presentation-specific media opportunity pass.
2. Reuse existing repository image/asset pipelines first.
3. Add optional resolvers for icons, Lottie, images, short evidence video, and SFX with provenance.
4. Require approval before generated or paid assets and before adding sound.
5. Keep voiceover, BGM, captions, and video generation opt-in; presentations are presenter-led by
   default.

Exit: assets are local, attributed, size-bounded, reusable, and absent from runtime network calls.

### Stage 8 - pilot and migration

1. Create a new generic demo deck exercising every supported recipe and transition.
2. Pilot a copy of the logical-chain deck, not its canonical host page.
3. Compare static vs animated comprehension, navigation latency, presenter control, accessibility,
   bundle cost, and authoring effort.
4. Remove motion that does not improve comprehension or orientation.
5. Only after pilot acceptance, migrate selected motion to the canonical deck and record the motion
   plan as host content.

Exit: evidence shows motion improves the presentation without degrading direct navigation, static
reading, accessibility, or maintainability.

## Acceptance criteria

The capability is ready for stable use only when all are true:

- A presenter can navigate forward/back, jump, skip, restart, and use browser history during any
  motion state with no stale pixels, blocked input, or wrong slide.
- Every slide and fragment has a deterministic direct-entry state.
- Reading mode reflows; presentation/audience modes fit a declared logical stage and enter an
  accessible reflow escape instead of shrinking below readable limits.
- Navigation and fragment state are stable IDs and survive slide reordering.
- Motion is authored without executable page scripts or inline styles.
- Full/reduced/off modes expose identical meaning.
- A deck remains readable, printable, searchable, and semantically complete without motion runtime.
- Presenter and audience recover from refresh, disconnect, duplicate, delayed, and stale messages.
- Canonical/personal notes remain distinguishable, recover from storage failure, and never enter the
  audience surface or synchronization channel.
- Active slide focus and hidden slide inertness pass keyboard and assistive-technology checks.
- Optional adapter failure never prevents navigation or content access.
- Motion recipes and assets have provenance and pinned dependencies.
- Package runtime sync, portability, schema, browser, accessibility, performance, and visual proof
  checks pass.
- Documentation claims only the capabilities proven in the explicit parity matrix.

## Non-goals for the first stable release

- Rendering the deck as a linear MP4.
- A general video editor or global multitrack timeline.
- Cloud rendering, distributed frame capture, or batch video production.
- Automatic narration, background music, or sound effects.
- Arbitrary user JavaScript, remote animation plugins, or unreviewed registry snippets.
- Perfect parity with every HyperFrames runtime or recipe.
- Importing HyperFrames' brand/design system as Slate's visual identity.
- Motion that is required to understand Product meaning.

## Open decisions and evidence needed

1. **Timeline baseline:** WAAPI-only core with optional GSAP, or GSAP as the default advanced engine?
  Decide from Stage 2 authoring complexity, bundle cost, interruption behavior, and diagnostics.
2. **Motion plan representation:** attributes only, companion JSON only, or a constrained hybrid?
   Decide from sanitizer safety, readability, reuse, and schema diagnostics.
3. **Slide mounting:** keep all slides in DOM but inert, or virtualize distant presentation handles
  while retaining semantic reading content? Decide from
   accessibility, search, print, memory, and heavy-adapter measurements.
4. **Logical stage metadata:** confirm default $1600 \times 900$, aspect-ratio variants, safe areas,
  minimum readable scale, and reflow-escape thresholds from representative decks/locales.
5. **Presenter synchronization transport:** `BroadcastChannel` is the local same-origin baseline;
   remote-device presenting needs a separately threat-modeled transport and is out of initial scope.
6. **Upstream update policy:** determine review cadence and whether any HyperFrames packages can be
   consumed directly without importing its video engine or weakening offline portability.

## First discriminating experiment

Before motion implementation, build the Stage 1 three-surface cut-only fixture. Prove rapid mixed
navigation, Back/Forward, popup denial, presenter/audience refresh, channel disconnect, notes edits
and storage failure, fullscreen, browser zoom, and moving windows between differently sized displays.
Only then run the Stage 2 motion experiment: during a 1.8-second fragmented entrance on slide A,
jump directly to slide B, immediately go back to A, change theme and DPR, switch reduced motion on,
delay a font/image, and use browser Back/Forward. The test passes only if every command lands on the
correct semantic slide/fragment state, focus is correct, no outgoing element remains interactive or
visible, no stale callback mutates the latest state, and the deck is complete with the motion manifest
removed.

That experiment tests the central claim: HyperFrames-derived seekable motion can live **under** a
presenter-controlled slide state machine rather than replacing it.