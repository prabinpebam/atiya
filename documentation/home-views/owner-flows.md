# Making your home page

What a person does to make their home page and keep it right, and the edit mode screen they do it on. The model is [Home views for every site](for-every-site.md), the picks are [Curating the home page](curation.md), the AI help is [Curating with AI](ai-curation.md), and every setting is in [Controls](controls.md). It's part of [Home page views](README.md).

> **TL;DR.**
> - **One screen, Home** (`/_edit/home/`):
>   - tabs on the left (Strengths, Highlights, Views, Links, Health);
>   - on the right, the home page as a visitor will see it, in any view, at either size and under any lens;
>   - select something in the preview to edit it on the left.
> - **A first run that ends in a home page:** the goal, 3 to 6 strengths, a check of their proof, a view. About 10 minutes, or under 5 with AI. It saves as it goes, and the home page changes only when the person says so.
> - **Mostly, nothing to do:** a new page finds its place by itself, and the person is told where it went.
> - **Curation also happens where the person already is:** the article's settings (On your home, Your part), the note after Publish, a quoted sentence's marker, the list of site changes, the action center.
> - **A link for one role or one job:** a lens behind a generated code, with the label ("Contoso, via Jane") kept privately.
> - **Eleven scenarios,** each with its flow (§3).

<figure class="slate-figure" data-diagram="home-editor">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640" role="img" aria-labelledby="hv-editor__title hv-editor__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="hv-editor__title">The Home screen in edit mode</title>
<desc id="hv-editor__desc">Edit mode's Home screen is a split view. On the left, five tabs: Strengths, Highlights, Views, Links and Health. The Strengths tab lists the site's strengths, each with its state; the chosen one opens to its short name, its line and its proof, best first, each item Auto, Pinned or Hidden, with Suggest to ask for more. On the right, a live preview of the home page as a visitor sees it, with the view, the width and the lens chosen above it and a coverage meter that says how many strengths are on the first screen. Selecting a tile in the preview selects that strength on the left.</desc>
<g id="hv-editor__bar" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="hv-editor__body-1" x="40" y="40" width="920" height="56" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="56" y="74" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-1" data-slate-fit-padding="16">Home</text>
<rect id="hv-editor__body-2" x="470" y="50" width="130" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="486" y="73" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-2" data-slate-fit-padding="16">View: Bento</text>
<rect id="hv-editor__body-3" x="610" y="50" width="120" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="626" y="73" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-3" data-slate-fit-padding="16">Wide · Phone</text>
<rect id="hv-editor__body-4" x="740" y="50" width="110" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="756" y="73" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-4" data-slate-fit-padding="16">Lens: none</text>
<rect id="hv-editor__body-5" x="860" y="50" width="84" height="36" rx="10" fill="var(--color-brand-bg)" />
<text x="876" y="73" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-editor__body-5" data-slate-fit-padding="16">Suggest</text>
</g>
<g id="hv-editor__tabs" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="hv-editor__body-6" x="40" y="112" width="420" height="488" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="hv-editor__body-7" x="56" y="128" width="86" height="32" rx="10" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="72" y="149" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="12" data-slate-fit-target="hv-editor__body-7" data-slate-fit-padding="16">Strengths</text>
<rect id="hv-editor__body-8" x="147" y="128" width="92" height="32" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="163" y="149" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-8" data-slate-fit-padding="16">Highlights</text>
<rect id="hv-editor__body-9" x="244" y="128" width="61" height="32" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="260" y="149" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-9" data-slate-fit-padding="16">Views</text>
<rect id="hv-editor__body-10" x="310" y="128" width="61" height="32" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="326" y="149" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-10" data-slate-fit-padding="16">Links</text>
<rect id="hv-editor__body-11" x="376" y="128" width="68" height="32" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="392" y="149" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-11" data-slate-fit-padding="16">Health</text>
</g>
<g id="hv-editor__strengths" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="hv-editor__body-12" x="56" y="176" width="388" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="202" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-12" data-slate-fit-padding="16">Leadership</text>
<text x="394" y="202" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-editor__body-12" data-slate-fit-padding="16">Ready</text>
<rect id="hv-editor__body-13" x="56" y="222" width="388" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="248" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-13" data-slate-fit-padding="16">Strategy</text>
<text x="366.8" y="248" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-editor__body-13" data-slate-fit-padding="16">1 warning</text>
<rect id="hv-editor__body-14" x="56" y="268" width="388" height="226" rx="10" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="72" y="294" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-14" data-slate-fit-padding="16">AI</text>
<text x="340" y="294" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="hv-editor__body-14" data-slate-fit-padding="16">Ready</text>
<text x="72" y="320" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="hv-editor__body-14" data-slate-fit-padding="16">Line</text>
<rect id="hv-editor__body-15" x="72" y="330" width="356" height="32" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="88" y="351" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-editor__body-15" data-slate-fit-padding="16">Handoff is now code</text>
<text x="72" y="384" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="hv-editor__body-14" data-slate-fit-padding="16">Proof, best first</text>
<rect id="hv-editor__body-16" x="72" y="394" width="356" height="30" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="86" y="414" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-16" data-slate-fit-padding="16">Pinned</text>
<text x="160" y="414" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-editor__body-16" data-slate-fit-padding="16">The AI program (résumé)</text>
<rect id="hv-editor__body-17" x="72" y="428" width="356" height="30" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="86" y="448" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-17" data-slate-fit-padding="16">Auto</text>
<text x="160" y="448" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-editor__body-17" data-slate-fit-padding="16">Cloner Pro</text>
<rect id="hv-editor__body-18" x="72" y="462" width="356" height="30" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="86" y="482" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-editor__body-18" data-slate-fit-padding="16">Hidden</text>
<text x="160" y="482" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-editor__body-18" data-slate-fit-padding="16">An older note</text>
<rect id="hv-editor__body-19" x="56" y="502" width="388" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="528" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-19" data-slate-fit-padding="16">Making</text>
<text x="394" y="528" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-editor__body-19" data-slate-fit-padding="16">Ready</text>
<rect id="hv-editor__body-20" x="56" y="548" width="388" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="574" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-20" data-slate-fit-padding="16">Craft, Systems</text>
<text x="387.2" y="574" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-editor__body-20" data-slate-fit-padding="16">2 more</text>
</g>
<g id="hv-editor__preview" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="hv-editor__body-21" x="476" y="112" width="484" height="488" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="492" y="144" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-editor__body-21" data-slate-fit-padding="16">Preview</text>
<text x="572" y="144" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-editor__body-21" data-slate-fit-padding="16">as a visitor sees it</text>
<rect id="hv-editor__body-22" x="752" y="124" width="192" height="32" rx="10" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="768" y="145" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="12" data-slate-fit-target="hv-editor__body-22" data-slate-fit-padding="16">6 of 6 on the first screen</text>
<rect id="hv-editor__body-23" x="492" y="168" width="452" height="380" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="hv-editor__body-24" x="508" y="184" width="240" height="110" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="524" y="244" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-24" data-slate-fit-padding="16">Lead: who you are</text>
<rect id="hv-editor__body-25" x="756" y="184" width="172" height="110" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="772" y="244" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-25" data-slate-fit-padding="16">In their words</text>
<rect id="hv-editor__body-26" x="508" y="302" width="134" height="100" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="524" y="357" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-26" data-slate-fit-padding="16">Leadership</text>
<rect id="hv-editor__body-27" x="651" y="302" width="134" height="100" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="667" y="357" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-27" data-slate-fit-padding="16">Strategy</text>
<rect id="hv-editor__body-28" x="794" y="302" width="134" height="100" rx="10" fill="var(--color-brand-bg)" />
<text x="810" y="344" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="hv-editor__body-28" data-slate-fit-padding="16">AI</text>
<text x="810" y="368" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-editor__body-28" data-slate-fit-padding="16">Selected</text>
<rect id="hv-editor__body-29" x="508" y="410" width="134" height="100" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="524" y="465" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-29" data-slate-fit-padding="16">Making</text>
<rect id="hv-editor__body-30" x="651" y="410" width="134" height="100" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="667" y="465" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-30" data-slate-fit-padding="16">Craft</text>
<rect id="hv-editor__body-31" x="794" y="410" width="134" height="100" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="810" y="465" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-editor__body-31" data-slate-fit-padding="16">Systems</text>
<text x="492" y="576" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-editor__body-21" data-slate-fit-padding="16">Select a tile to edit that strength on the left</text>
</g>
<g id="hv-editor__flow-1" data-slate-svg-step="5" data-slate-svg-effect="draw">
<path d="M794 352 L700 352 L700 340 L454 340" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="445,340 454,345 454,335" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>The Home screen: strengths on the left, one open with its proof in three states; the home page on the right, as a visitor sees it, with the selected strength marked.</figcaption>
</figure>

## 1. The Home screen

`/_edit/home/`, in the side navigation after Sections, with a count beside it when the health report has something blocking or a warning. Its route goes in `integrations/editor.mjs` and its entry in `SCREENS` (`model/find.ts`), found by "home page", "strengths", "capabilities", "showcase", "highlights", "lens" and "link". It's a SplitView ([editor spec §2](../editor/spec.md#2-the-screens)), like Sections and Access.

**The top bar** (its `title` and `tools` slots, so in Atiya Studio they move to the app's title bar):

| Control | What it does |
|---|---|
| **View** | A Select of every built view; the default is marked, and views below their minimum are listed but disabled, with why |
| **Wide · Phone** | The preview at 1280 by 800 or 360 by 740 |
| **Lens** | No lens, the goal's presets, the person's lenses and links: the preview takes that order and lead voice |
| **Suggest** | The AI jobs for what's selected ([AI curation §4](ai-curation.md)); with no AI service set up, their rule-based twins under the same names |

**The left pane:**
- **Its head** says the goal ("Get hired · Change") and the status ("Live", "Changes waiting to be published", or "Not your home page yet").
- **Its tabs:**

| Tab | What's in it |
|---|---|
| **Strengths** | First, **Who you are**: the positioning line (the site setting), facts with their sources, and the two always-on actions' labels. Then a row per strength, in order: its short name and its state (Ready, 1 warning, Hidden: no proof). A row opens in place: Name, Short name, Line (with a count of words), Voice, Picture, What it matches (topics, sections, keywords), and **Proof, best first**: each item's state (Pinned, Auto, Hidden), kind and reason ("Auto: topic AI, a case study, 2026"). Add strength is disabled at 6, saying why |
| **Highlights** | The highlights in the order the views use them, each Pinned or Auto with its strength; hidden ones folded at the end; a line saying how many each view shows |
| **Views** | Every built view: Offer (a switch), Default (one of the offered), its minimum met or not, its settings ([controls §3](controls.md)), Preview in a new tab. The same `home` key Ways to explore wrote ([switcher §5](switcher.md)); Ways to explore now shows one line linking here |
| **Links** | Lenses (the goal's presets and the person's own) and links made for a role or a job (§5) |
| **Health** | The health report ([curation §8](curation.md)): blocking, warnings, opportunities, each with its fix as a button |

- **Its foot** has **More options**, the advanced settings ([controls §2](controls.md)), closed by default.

**The preview** is the real home page, drawn by the views' own components in a frame from the dev server, with the screen's decisions applied, including ones not yet published.
- **Over it:** the coverage meter, "6 of 6 on the first screen", measured the way the E2E test measures it (each strength's `data-capability` element in the viewport, [foundation §5](foundation.md)), and turning to a warning ("Craft is below the first screen on a phone") when one falls out.
- **Selecting:** pointing at a strength's tile outlines it; selecting it opens that strength on the left. Selecting a proof item in an open detail opens that item's row. Every one has a keyboard twin in the left pane.
- **What it shows:** what the next build will show, so a page that isn't published is never in it. A line under it says so when the decisions differ from the live site: "Showing your unpublished changes · Show the live home".

**Saving:** every field saves as it's typed (about once a second), through the store and the content check, reported by the save status ([editor spec §2.1](../editor/spec.md#21-saved-and-live)). A refused save names the field and the fix: "Not saved: these words aren't in Diego Baca's recommendation. Select the sentence again."

## 2. The first run

When `content/showcase.json` has no strengths, the Home screen is the first run. It's reached from the **Make your home page** card on the Dashboard and the Pages screen (once the site has 3 published pages, [for every site §8](for-every-site.md)), from the action center, or by `atiya home init`.

It's four steps inside the screen, not a dialog, with the preview filling in on the right as they're answered. Each step saves as it goes, has Back, and can be left and resumed.

1. **Your goal.** Three cards: Get hired ("For recruiters and hiring managers"), Win clients ("For people with a project"), Share my work ("For readers and peers"). With Get hired: **Which page is your résumé?** (a Select of the site's pages, or "None yet"), which sets `resumePage`. The positioning line from the site's settings is shown with Edit.
2. **Your strengths.** Three ways in, side by side:
   - **Suggest from my pages:** candidate strengths as cards, each with an editable name, the number of pages behind it and its three best titles, and Keep or Drop.
   - **Common strengths:** the engine's list for a field, each a name to edit ([for every site §3.1](for-every-site.md)).
   - **Write my own.**

   A line counts what's kept: "4 strengths: a good number". Continue needs 3; a 7th is refused with the reason.
3. **Their proof.** Per strength: the line (offered from its best proof's title, to shorten), and its three best proof items with a verdict:
   - **Ready:** at least one page;
   - **Thin:** résumé lines only (pin one with **Ask me about it**);
   - **None:** hidden from visitors until it has proof ([curation §10](curation.md), CU7).

   Fixing can wait: this step never blocks.
4. **How it opens.** The views that meet their minimum, as cards with stills of *this* site, the goal's default selected:
   - **Make it my home page** sets the default and the offered views;
   - **Keep the hub for now** keeps the decisions, and the home page stays Classic's hub.

The end says what happens next: "Your home page is ready. It goes live when you publish your site changes." (Save to remote today; Publish site changes once [drafts move](../editor/drafts-and-publishing.md).)

**Below 3 published pages,** the screen still opens, with: "A home page shows a range. Publish a few more pages and it can choose from them." Write my own still works, and the views wait for their minimums.

## 3. Scenarios and flows

| # | Scenario | Who | Starts from | Ends with |
|---|---|---|---|---|
| H-S1 | A first home page, without AI | O1, O3 | Make your home page | A published home in a chosen view |
| H-S2 | A first home page, with AI | O2, O4 | The same, with Suggest | The same, in half the time |
| H-S3 | A new page is published | Everyone | Publish | The page in its place, or pinned or hidden |
| H-S4 | A link for one job | O2, O3 | A job description | A link to send, and a list of what the site doesn't show |
| H-S5 | Choosing views | Everyone | Views | The offered views and the default |
| H-S6 | Fixing what Health reports | Everyone | The count beside Home | Nothing blocking |
| H-S7 | Editing a sentence the home page quotes | O2, O5 | The résumé or a recommendation | The edit saved, the quote updated or removed |
| H-S8 | A change of direction | O2, O3 | A new role or market | A new goal, order and strengths |
| H-S9 | The monthly look at a big site | O4 | Health | Fresh highlights, nothing stale at L2 |
| H-S10 | An agent curates | O6 | A request to the agent | A proposal reviewed and accepted |
| H-S11 | Seeing it as a hiring manager would | O2 | The preview | Confidence that nothing strong is missed |

**H-S1. A first home page, without AI**
1. Dashboard: Make your home page.
2. Goal: Get hired; résumé page: Résumé.
3. Strengths: Common strengths, field Design; keeps Visual design, Prototyping, Research; renames one; writes a fourth.
4. Proof: two are Ready, Research is Thin; pins the résumé line "Ran 20 interviews for the checkout study" with Ask me about it.
5. How it opens: Bento (Cover is offered; Spotlight isn't, needing 4 highlights with pictures).
6. Make it my home page; then publishes site changes.

**H-S2. A first home page, with AI**
1. Steps 1 and 2 as above, choosing Suggest from my pages.
2. AI proposes five strengths with lines, each line cited ([AI curation §3](ai-curation.md)); the review shows them in the preview as they're accepted.
3. The person keeps four, rewrites one line, drops one strength.
4. Proof: one strength is Thin, and Health offers Outline a page ([AI curation §5](ai-curation.md)), left for later.
5. How it opens, then publish, as above.

**H-S3. A new page is published**
1. In the article editor, the person publishes a case study.
2. A note in the publish result: "Now on your home: Making's headline; Prototyping, in the details" with **Pin**, **Hide** and **Open Home** (§4).
3. Usually nothing more. If it's in the wrong place: Hide for that strength, or open the article's settings, On your home, and set Your part to Shipped.

**H-S4. A link for one job**
1. Links: New link, From a job description; paste it.
2. The match report ([AI curation §6](ai-curation.md)): Covered, Thin, Not shown per requirement. Without AI, the words are matched in the browser and the report has Covered and Not shown.
3. The proposed lens: the strengths' order (drag, or Move up and Move down), the lead voice, up to 6 keywords brought forward. The preview takes it.
4. The label, for the person only: "Contoso, Principal Designer, via Jane". The visitor's line, public and optional: "For a principal design role".
5. Make link: the address is copied. It works once the site changes are published; until then the link says "Waiting to be published".
6. The Not shown rows stay as a list on the link, each with Outline a page.

**H-S5. Choosing views**
1. Views: each view with Offer, Default and its state ("Ready", "Needs 2 more highlights with pictures").
2. Turning on Showreel: its settings open beside it ([controls §3](controls.md)); the preview switches to it.
3. Choosing Cover as the default: the check refuses a view that isn't offered or fails the coverage rule, and says which.

**H-S6. Fixing what Health reports**
1. The count beside Home says 2; Health lists them, blocking first.
2. "A quote that no longer resolves: Diego Baca's" offers **Select the sentence again**: the recommendation opens beside it, the person selects the new words, and it's fixed.
3. "Strategy rests on résumé lines only" offers **Outline a page** or **Remind me later** (hidden for 30 days, then back).

**H-S7. Editing a sentence the home page quotes**
1. In the résumé, the person edits a sentence pinned as proof. The block carries a marker: "Quoted on your home".
2. Saving asks: **Update the quote too** (the pin takes the new words), **Remove the quote**, or Cancel ([curation §7](curation.md)). Both change the page and the home together, in one transaction.
3. The same happens on the Recommendations screen for a voice.

**H-S8. A change of direction**
1. Goal: Change, Win clients. A summary before anything changes: "These change: the actions (Start a project), the questions, the lens presets, the default view's suggestion. These stay: your strengths, pins, voices and links."
2. Strengths: reorders them; removes one (its decisions are kept in the versions, so Undo or a restore brings it back); adds Workshops, from Common strengths.
3. Health shows what the new order lacks; the existing links keep working, without the removed strength.

**H-S9. The monthly look at a big site**
1. The Home screen opens on **Since you last looked:** "9 new pages placed · 2 highlights changed · 3 pages stale".
2. Highlights: unpins two older pieces; the newest rise.
3. Health: three opportunities ("12 pages with no topics": Accept the suggested ones, in one step).
4. More options: Prefer recent work set to Strong, because the site's best work is recent.

**H-S10. An agent curates**
1. The person asks their agent to check the home page.
2. The agent runs `atiya home check` and reads `get_evidence_index` ([AI curation §8](ai-curation.md)).
3. It sends `propose_showcase`. The Home screen shows a banner: "Your agent proposed 5 changes · Review".
4. The person reviews them in the same review as any AI proposal, and accepts four.

**H-S11. Seeing it as a hiring manager would**
1. Preview: Phone, Lens: the leadership role.
2. The coverage meter says 6 of 6; the person opens two tiles' details to read what a manager reads at L2 and L3.
3. **Open as a visitor** opens the home page in a private window of the browser, with no edit marks, at the lens's address.

## 4. Where the person already is

The Home screen is for decisions; most of the time the curation comes to the person.

| Where | What it adds |
|---|---|
| **The note after Publish** (article editor) | Only when the home page changes: where the page went ("Now on your home: AI's headline"), what it moved ("Cloner Pro moved to AI's details"), or why it went nowhere ("It proves no strength yet: Add a topic"). Pin, Hide, Open Home. Never a dialog |
| **The article's settings: On your home** | Where the page is now, per strength (headline, details, a highlight, nowhere), each with Pin and Hide; and **Your part** (`contribution`): Shipped, Led, Built, Wrote, Spoke, Recognised, or "From its kind: Wrote" |
| **Quoted blocks** (article editor) and **quoted recommendations** | A marker on what the home page quotes, and the choice on save (H-S7). On the Recommendations screen, selecting a sentence offers **Use as a voice for…** |
| **A section's Settings** (Sections) | Proves: which strengths this section's pages count for (the strength's `match.sections`), a Select of the strengths |
| **The list of site changes** (Save to remote; Publish site changes later) | One row, "Home page", for the decisions changed, and a line for what visitors will see change: "New on your home: Cloner Pro in AI's details" |
| **The Dashboard** | Make your home page (once); afterwards, Home's health count when it isn't zero |
| **The action center** | The Home screen, and setting cards ([action center §4.3](../desktop/action-center.md#43-settings-and-their-cards)) for the default view, Hold automatic changes and Prefer recent work, written through the store as the screen writes them (`findSettings`, `setFindSetting`) |

## 5. Links for a role or a job

A lens reorders the strengths and changes the lead voice; it never hides one ([foundation §6](foundation.md)). There are three kinds:

| Kind | Address | Who makes it |
|---|---|---|
| **Presets** | `/?for=<lens>` | The goal (by role, by service, by theme), named by the person |
| **The person's own lenses** | `/?for=<lens>` | The person, in Links |
| **A link for one job** | `/for/<code>/` | The person, from a lens or a job description (H-S4) |

**A link for one job:**
- **The code is generated,** 8 characters from an alphabet without look-alikes, never chosen and never reused. It opens nothing private: it only orders what's already public.
- **What's public** (in `content/showcase.json`'s `links`): the code, its order, its lead voice, its keywords, the visitor's line and an optional end date. No name, company or role unless the person writes one in the visitor's line, which edit mode marks "Visitors see this".
- **What's private:** the label, any notes and the job description if kept, in the private repository when private pages are set up, otherwise on this computer only. On another computer without them, the link shows its code and "Label kept elsewhere".
- **Its own page:** `/for/<code>/` is built as the home page with the lens applied, marked `noindex` and left out of the sitemap. Counting tools report a page's path only, never its query ([site services](../desktop/site-services.md)), so a code in the path is what lets the person's own count say the link was opened. That's safe here, unlike an access code, because this code opens nothing.
- **The visitor sees** the lens chip: "Made for: a principal design role · Change", or "Made for this role" without a visitor's line.
- **Ending a link** (on its end date, or End now) leaves its address showing the plain home page, never a missing page: it may sit in an email the person can't take back.

## 6. Waits, conflicts and errors

- **Never a silent wait** ([editor spec §2.2](../editor/spec.md#22-never-a-silent-wait-progress-where-it-happens)):
  - a typed line shows in the preview at once, as the article canvas does;
  - a change of order or of what's shown redraws the preview behind the old one, which stays until the new one is ready, with the preview's busy sign after 300 ms (the task tracker, `data-busy`);
  - an AI request shows its size first, and its progress and Stop in the status line.
- **Changes made elsewhere** (another tab, an agent, a page published) reach the screen through `onContentChange`. Typing in progress is kept; the screen says it's behind and catches up once it's saved.
- **Every refusal names what and how to fix it**, in the field and the status line (the copy rules of the [design system](../site-ui/design-system.md)).
- **Empty tabs** say what fills them: Highlights, "Highlights come from your pages with pictures. 2 so far: Spotlight needs 4." Links, "No links yet. Make one for a role or a job."

## 7. Accessibility and performance

- **Tabs** are a tablist; the strength rows are a list of groups, each named by its strength; reordering has Move up and Move down beside the drag (WCAG 2.5.7).
- **The preview** is a titled frame ("Preview of your home page: Bento, wide, no lens"). Selecting in it has a keyboard twin in the left pane, and the coverage meter is text, announced politely when it changes.
- **Narrow windows:** below the 56 rem breakpoint, the preview goes behind an Edit · Preview switch.
- **Budgets:**

  | Wait | Target |
  |---|---|
  | The picks for a 500-page site | About 150 ms ([curation §9](curation.md)) |
  | A typed line in the preview | Under 100 ms |
  | The preview redrawn after a change | Under 300 ms, else the busy sign |

  Each is named with `performance.measure('editor:home-…')`, a benchmark step and a target in `perf/budgets.json` ([performance](../engineering/performance.md)).

## 8. Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| OF1 | Where views are chosen | The Home screen's Views tab; Ways to explore | The Home screen, with a line on Ways to explore linking to it: views belong with what they show |
| OF2 | The first run | Steps in the screen; a dialog; a separate page | Steps in the screen, saved as they go, with the preview filling in |
| OF3 | The preview | The real views in a frame; a diagram of the slots | The real views: the person judges what a visitor will see |
| OF4 | A job link's address | `/for/<code>/`; `/?for=<code>` | `/for/<code>/`: counted by path, and its own page |
| OF5 | Where a link's label lives | Privately (the private repository, else this computer); in `content/` | Privately: a public file must never say who the person is applying to |
| OF6 | The note after Publish | When the home page changes; after every publish; never | Only when it changes |
| OF7 | An ended link | Shows the plain home; a missing page | The plain home |
