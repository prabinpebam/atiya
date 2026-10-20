# Choosing a view

A visitor can change how the home page is presented at any time, from the same control in every view, and the site remembers the choice on their device. Each view also has its own address, so a recruiter can send a hiring manager the view they found clearest. This page specifies the control, the addresses, what's remembered and in what order, the transition between views, the owner's settings, and how views relate to navigation modes. It's part of [Home page views](README.md).

> **TL;DR.**
> - **Change view** sits in the identity strip of every view (in the menu on a phone) and opens a panel of view cards, the current one marked, with **Use the default** and, apart, **Other ways to explore** (Little planet) (§1).
> - **Addresses:** `/` is the default view; `/views/<id>/` is each view, a static page whose canonical address is `/`. A shared link opens its view without changing the visitor's own choice (§2).
> - **What's remembered:** the visitor's pick, in `localStorage['site.homeView']`. At `/`, a remembered pick that isn't the default replaces the address before the first paint. A link always wins over the memory, and the memory over the default (§3).
> - **Moving between views** keeps the capabilities in sight: each one morphs from where it was to where it goes, and the change is instant under reduced motion (§4).
> - **The owner chooses** the default and which views are offered, in edit mode's Ways to explore (§5).
> - **A home view is not a mode.** It's a way to present Classic's home page; modes still never become the home page, and Little planet keeps its own address and memory (§6).

<figure class="slate-figure" data-diagram="home-switcher">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" role="img" aria-labelledby="hv-switcher__title hv-switcher__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="hv-switcher__title">Change view: the same control in every view</title>
<desc id="hv-switcher__desc">Change view, in the identity strip of every view, opens a panel of view cards: Bento (the default and here the current one), Cover, Spotlight, Showreel, Keywords, Proof grid and Questions, with Use the default. Below them, under Other ways to explore, is Little planet, the game, at its own address. The choice is kept on this device. On a phone, the same list opens as a bottom sheet.</desc>
<text x="40" y="40" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Wide screen, 1280 px</text>
<text x="740" y="40" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Phone, 360 px</text>
<g id="hv-switcher__wide" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="hv-switcher__body-1" x="40" y="56" width="660" height="580" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
</g>
<g id="hv-switcher__strip" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="hv-switcher__body-2" x="56" y="72" width="628" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-switcher__body-2" data-slate-fit-padding="16">Prabin Pebam</text>
<text x="452" y="100" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-switcher__body-2" data-slate-fit-padding="16">Résumé · Contact · Change view</text>
</g>
<g id="hv-switcher__page" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="hv-switcher__body-3" x="56" y="128" width="232" height="492" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="72" y="374" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-3" data-slate-fit-padding="16">The current view</text>
</g>
<g id="hv-switcher__panel" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="hv-switcher__body-4" x="300" y="124" width="384" height="456" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="316" y="156" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-switcher__body-4" data-slate-fit-padding="16">Change view</text>
<text x="316" y="178" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-switcher__body-4" data-slate-fit-padding="16">Kept on this device; change it any time</text>
<rect id="hv-switcher__body-5" x="316" y="194" width="168" height="60" rx="12" fill="var(--color-brand-bg)" />
<text x="332" y="222" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="hv-switcher__body-5" data-slate-fit-padding="16">Bento</text>
<text x="332" y="242" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-switcher__body-5" data-slate-fit-padding="16">The default</text>
<rect id="hv-switcher__body-6" x="500" y="194" width="168" height="60" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="516" y="222" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-switcher__body-6" data-slate-fit-padding="16">Cover</text>
<text x="516" y="242" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-switcher__body-6" data-slate-fit-padding="16">A magazine cover</text>
<rect id="hv-switcher__body-7" x="316" y="264" width="168" height="60" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="332" y="292" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-switcher__body-7" data-slate-fit-padding="16">Spotlight</text>
<text x="332" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-switcher__body-7" data-slate-fit-padding="16">One at a time</text>
<rect id="hv-switcher__body-8" x="500" y="264" width="168" height="60" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="516" y="292" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-switcher__body-8" data-slate-fit-padding="16">Showreel</text>
<text x="516" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-switcher__body-8" data-slate-fit-padding="16">A 90-second film</text>
<rect id="hv-switcher__body-9" x="316" y="334" width="168" height="60" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="332" y="362" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-switcher__body-9" data-slate-fit-padding="16">Keywords</text>
<text x="332" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-switcher__body-9" data-slate-fit-padding="16">By what you pick</text>
<rect id="hv-switcher__body-10" x="500" y="334" width="168" height="60" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="516" y="362" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-switcher__body-10" data-slate-fit-padding="16">Proof grid</text>
<text x="516" y="382" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-switcher__body-10" data-slate-fit-padding="16">Claims and proof</text>
<rect id="hv-switcher__body-11" x="316" y="404" width="168" height="60" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="332" y="432" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-switcher__body-11" data-slate-fit-padding="16">Questions</text>
<text x="332" y="452" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-switcher__body-11" data-slate-fit-padding="16">Ask, get answers</text>
<rect id="hv-switcher__body-12" x="500" y="404" width="168" height="60" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="516" y="440" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-switcher__body-12" data-slate-fit-padding="16">Use the default</text>
<text x="316" y="494" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-4" data-slate-fit-padding="16">Other ways to explore</text>
<rect id="hv-switcher__body-13" x="316" y="504" width="352" height="56" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="332" y="538" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-switcher__body-13" data-slate-fit-padding="16">Little planet</text>
<text x="472" y="538" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-switcher__body-13" data-slate-fit-padding="16">A game, at /play/</text>
</g>
<g id="hv-switcher__phone" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="hv-switcher__body-14" x="740" y="56" width="220" height="580" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
</g>
<g id="hv-switcher__phone-strip" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="hv-switcher__body-15" x="752" y="72" width="196" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="768" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-switcher__body-15" data-slate-fit-padding="16">Prabin Pebam</text>
<text x="896" y="98" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-15" data-slate-fit-padding="16">Menu</text>
</g>
<g id="hv-switcher__phone-page" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="hv-switcher__body-16" x="752" y="124" width="196" height="164" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="768" y="210" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-16" data-slate-fit-padding="16">The current view</text>
</g>
<g id="hv-switcher__phone-sheet" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="hv-switcher__body-17" x="752" y="300" width="196" height="320" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="768" y="328" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-switcher__body-17" data-slate-fit-padding="16">Change view</text>
<rect id="hv-switcher__body-18" x="768" y="340" width="164" height="28" rx="8" fill="var(--color-brand-bg)" />
<text x="784" y="359" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-switcher__body-18" data-slate-fit-padding="16">Bento · the default</text>
<rect id="hv-switcher__body-19" x="768" y="374" width="164" height="28" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="784" y="393" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-19" data-slate-fit-padding="16">Cover</text>
<rect id="hv-switcher__body-20" x="768" y="408" width="164" height="28" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="784" y="427" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-20" data-slate-fit-padding="16">Spotlight</text>
<rect id="hv-switcher__body-21" x="768" y="442" width="164" height="28" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="784" y="461" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-21" data-slate-fit-padding="16">Showreel</text>
<rect id="hv-switcher__body-22" x="768" y="476" width="164" height="28" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="784" y="495" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-22" data-slate-fit-padding="16">Keywords</text>
<rect id="hv-switcher__body-23" x="768" y="510" width="164" height="28" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="784" y="529" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-23" data-slate-fit-padding="16">Proof grid</text>
<rect id="hv-switcher__body-24" x="768" y="544" width="164" height="28" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="784" y="563" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-24" data-slate-fit-padding="16">Questions</text>
<text x="768" y="600" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-switcher__body-17" data-slate-fit-padding="16">Other ways: Little planet</text>
</g>
<text x="40" y="668" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">A shared link opens its own view without changing yours. Change view sits in the same place in every view.</text>
</svg>
<figcaption>Change view, the same in every view: a panel of view cards on a wide screen, a sheet on a phone.</figcaption>
</figure>

## 1. The control

**Where it is.** Change view is a button in the identity strip, after Read résumé and Contact me, in every view. On a phone it's in the menu, and again at the foot of the view, after the sections index. It never moves between views, so a visitor who changed once can always change back.

**The panel.** On a wide screen, a panel opens under the button; on a phone, a sheet rises from the bottom. It holds:
- a heading, Change view, and one line: "Kept on this device; change it any time";
- a card per offered view: a small still of the view (its own first screen, drawn at build), its name and one line (Bento, "The default"; Cover, "A magazine cover"; Spotlight, "One at a time"; Showreel, "A 90-second film"; Keywords, "By what you pick"; Proof grid, "Claims and proof"; Questions, "Ask, get answers");
- the current view marked, with its card filled in the spot colour;
- **Use the default**, which clears the visitor's pick;
- under **Other ways to explore**, Little planet, "A game, at /play/", and any other mode the site has on.

**Behaviour.** Each card is a link to the view's address, so it works without scripts. With scripts, choosing a card also stores the pick (§3). The panel closes on a choice, on Esc, on a press outside it, or with its close button; focus returns to Change view.

## 2. Addresses

| Address | What it shows |
|---|---|
| `/` | The site's default view, or the visitor's remembered pick (§3) |
| `/views/<id>/` | That view, always: `/views/bento/`, `/views/cover/`, `/views/spotlight/`, `/views/showreel/`, `/views/keywords/`, `/views/proof-grid/`, `/views/questions/` |
| `/?view=<id>` | Redirects to `/views/<id>/` (for links typed by hand, or older shares) |
| `?for=<lens>` on any of them | The same view, under that role lens ([foundation §6](foundation.md)) |

- Every view is a **static page**, built like the rest of the site. The default view's content is also what `/` serves, so the home page works with scripts off.
- Every `/views/<id>/` page names `/` as its **canonical** address, so search engines see one home page.
- **`views` becomes a reserved slug**, so no section can take it ([sections spec](../sections/spec.md)). No section uses it today.
- A view the owner hasn't offered answers at its address with a short page that says the site doesn't offer that view and links home, like a mode that's turned off ([navigation modes §2](../desktop/modes.md)).

## 3. What's remembered, and in what order

The visitor's pick is stored in `localStorage['site.homeView']` as a view's `id`. It's written only when the visitor chooses a card in Change view, never when they arrive by a link.

| The visitor arrives at | Shown |
|---|---|
| `/views/<id>/` (a shared link, a card, a bookmark) | That view. Their stored pick is unchanged |
| `/`, with no stored pick | The site's default |
| `/`, with a stored pick that's the default | The default |
| `/`, with a stored pick that's offered and isn't the default | That view: PageShell's head script calls `location.replace('/views/<id>/')` before the first paint, so Back doesn't loop |
| `/`, with a stored pick that's no longer offered | The default; the stored pick is removed |
| Anywhere, with storage unavailable (private browsing, blocked) | The address's view; nothing is stored |

**Use the default** removes the stored pick and goes to `/`. The order is always **a link, then the visitor's pick, then the site's default**.

## 4. Moving between views

Changing view is a navigation to another page, so it uses cross-document view transitions:
- every capability's L1 element has a `view-transition-name` of `cap-<id>`, so each capability morphs from its place in one view to its place in the next (a Bento tile becomes a Cover line, then a Proof grid row); the visitor sees the same six things rearrange, which says "same content, another way";
- the identity strip keeps its place and doesn't animate;
- everything else cross-fades, in about 300 ms on the site's standard easing;
- under `prefers-reduced-motion`, or where view transitions aren't supported, the change is instant.

## 5. The owner's settings

Which views are offered, and which is the default, are content: a `home` key in the site's ways file, `content/structures/ways.json`, which [navigation modes §2](../desktop/modes.md) specifies (the file doesn't exist in this repository yet; it's written the first time a way to explore is changed in edit mode).

```json
{
  "modes": [{ "id": "little-planet", "on": true, "mount": "play" }],
  "primary": "site",
  "home": {
    "default": "bento",
    "offered": ["bento", "cover", "proof-grid"],
    "settings": { "bento": { "density": "full" } }
  }
}
```

- Edited on edit mode's **Home** screen, in its Views tab: a switch per built view, a choice of default among those switched on, each view's settings, and Preview, which opens the view in a new tab ([owner flows §1](owner-flows.md), OF1). **Ways to explore** shows one line for the home page, linking there.
- **`settings`** holds each view's presentation settings, only where they differ from the defaults: one shared vocabulary (Lead, Density, Pictures, Motion, Order) and at most two of a view's own ([controls §3](controls.md)).
- The check refuses a default that isn't offered, an offered view that isn't built, and a setting a view doesn't have. A view below its minimum ([for every site §5](for-every-site.md)) isn't refused (as built): the site falls back from it, and edit mode won't save it as the default. The coverage rule ([foundation §5](foundation.md)) is held by each view's E2E.
- With no `home` key, the home page is the Classic hub until the person makes their home page ([for every site §8](for-every-site.md)); the owner's site sets Bento as its default.

## 6. Views and modes

| | Home view | Navigation mode |
|---|---|---|
| What it is | A way to **present** Classic's home page | A way to **move through** the whole site |
| Where it lives | `/` and `/views/<id>/` | Its own address (Little planet: `/play/`) |
| What it reads | The capability spine | Mode data: sections and their open pages |
| Remembered as | `site.homeView` | `site.mode` |
| Can it be the home page | It *is* the home page's presentation | Never ([navigation modes](../desktop/modes.md), N5) |

The two don't interfere. The home page's ways in to modes ([navigation modes §4.6](../desktop/modes.md)) appear in every view (a button in Bento's lead tile, a line on the Cover, and so on), and Change view lists the modes apart, under Other ways to explore. Choosing Little planet there goes to `/play/` and stores `site.mode`, as the ways in already do; it never changes `site.homeView`.

## 7. Accessibility

- Change view is a `<button>` with `aria-haspopup="dialog"` and `aria-expanded`; the panel is a dialog named "Change view", the cards a list of links, the current one with `aria-current="page"`.
- Focus moves to the current card when the panel opens and returns to the button when it closes.
- Every card is at least 44 px tall, with its name as its accessible name and its line as its description.
- The stills are decorative (`alt=""`): the name and line say what the view is.
- A polite live region says "Showing the Cover view" after a change, since the page itself changed.

## 8. Telemetry

| Event | When | Properties |
|---|---|---|
| `home_view` | A view is shown | `view`, `lens`, `source`: `default`, `stored` or `link` |
| `view_switch` | A card is chosen | `from`, `to` |
| `view_default` | Use the default is chosen | `from` |

## 9. Open decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| S1 | Remember the pick across visits | Yes (`localStorage`); for the visit only | Yes: a returning hiring manager should see what they chose |
| S2 | Where a remembered pick is applied | A redirect from `/`; render every view at `/` and choose in the page | The redirect: each view stays a light static page, and the cost is one fast navigation for returning visitors only |
| S3 | Show a first-visit hint that other views exist | A one-time note by Change view; none | None: the control is always in the same place, and a note would cost the first impression |
| S4 | Offer the switcher when only one view is offered | Hide Change view; show it with modes only | Show it only if a mode is on; otherwise hide it |

## 10. As built (stage 2b)

Change view, the remembered pick and their telemetry are built. The classic hub is still the default at `/`, and Bento and the hub are offered at their own addresses, `/views/bento/` and `/views/classic/`.

| Part | Where |
|---|---|
| The router | [`homeRoute.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/scripts/homeRoute.ts): the script PageShell runs in a home page's head, before the first paint, from the page's `data-home-*` attributes (§3's order; its decisions are unit-tested) |
| The choices | [`ViewChoices.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/components/compounds/ViewChoices.astro), in the site's Dialog; [`homeViews.ts`](https://github.com/prabinpebam/atiya/blob/main/src/site/scripts/homeViews.ts) keeps a choice, writes the status line and tells telemetry |
| The pages | [`index.astro`](https://github.com/prabinpebam/atiya/blob/main/src/pages/index.astro) shows the default view and [`views/[view].astro`](https://github.com/prabinpebam/atiya/blob/main/src/pages/views/%5Bview%5D.astro) every offered, built view, the hub too; both draw [`Hub.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/content/Hub.astro) or [`HomeView.astro`](https://github.com/prabinpebam/atiya/blob/main/src/site/content/HomeView.astro) |

Where the build differs from the design above:
- **Where Change view is.** In Bento it's a quiet button in the lead, beside Explore the planet, and again at the foot after the sections index; on the hub's own address it's among the opening's actions and again after the sections. It isn't in the phone's menu: the foot's button is there on a phone.
- **`/` offers no Change view while the hub is the default.** This protects the live home page: its markup is unchanged but for the router and the `data-home-*` attributes on `<html>`, and the hub's script, which is now a file rather than inline. The one part that must run before the first paint, choosing which way in is the primary button (the way the visitor went last), stays inline: a small script right after the buttons ([`HUB_WAYS`](https://github.com/prabinpebam/atiya/blob/main/src/site/scripts/hub.ts)), so the buttons never change colour in view. Since one page renders whichever view is the default, `/` also loads the dialog's and the choices' styles: two small stylesheets, 3.7 KB gzip, while its HTML is about the same size (0.6 KB smaller; 0.2 KB more gzipped). Showing Change view on `/` is one prop once the owner wants it.
- **The panel is the site's Dialog,** a modal dialog in the middle of the screen, rather than a panel under the button and a sheet on a phone. The current card takes the focus through `autofocus`, and the dialog gives it back to the button that opened it. The button has `aria-haspopup="dialog"` but no `aria-expanded`, since a modal dialog covers it while it's open.
- **No stills yet.** Each card has its name and line. The stills wait until there are views worth telling apart at a glance (stage 4).
- **No view transitions yet** (§4). They wait for a second view beside the hub to move between (stage 4).
- **`/views/classic/`** is the hub at its own address, so choosing the hub works like choosing any view. There, `?mode=` doesn't move the visitor, and its canonical address is `/`.
- **`/?view=<id>`** is sent on by the router, with `location.replace`, rather than by a server, since the site is static. The rest of the query and the fragment are kept. `?mode=` skips the router, so the hub's ways in work as before.
- **Two more keys, for the visit only.** `sessionStorage['site.homeArrival']` and `['site.homeChanged']` carry how the visitor came and what they changed to the next page, for the status line and telemetry. Both are read once and removed.
- **The role lens (`?for=`) comes in stage 2c,** and the short page for a view that isn't offered comes in stage 4. Until then, such an address isn't found.
- **Telemetry** sends §8's events with view and lens IDs and the source only. They aren't on the protected pages' allowlist, because a home page is never protected.
