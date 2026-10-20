# The capability spine

Every home view reads one curated piece of content, the **capability spine**: the owner's six capabilities, each with a line that says it, the evidence that proves it, a colleague's voice and a picture, plus the highlights, facts and positioning the views share. This page defines the spine, the three levels of information every view shows, the coverage rule that guards against the failure case, the role lens, and what's on screen in every view. It's written for the owner's site; [Home views for every site](for-every-site.md) turns it into a model any site fills with its own 3 to 6 strengths, and [Curating the home page](curation.md) says how the proof is found. It's part of [Home page views](README.md).

> **TL;DR.**
> - **Three levels, in every view.** L1, the map: all six capabilities, seen in about 10 seconds with no action. L2, the signal: one capability's proof line, picture and voice. L3, the detail: its evidence, opened in place. The full pages are one step beyond (§1).
> - **The spine is content** (`content/showcase.json`), written once and read by every view. Every capability must have proof, and every proof must resolve to a published open page, a résumé line or a recommendation, never a private page (§2).
> - **Six capabilities:** design leadership, product strategy, AI transformation, hands-on making, craft and storytelling, and systems and operating models (§3).
> - **The evidence is uneven.** Making is proved by eight things he built; AI transformation and product strategy rest mostly on résumé lines. Short proof pages for those two would lift every view (§4).
> - **The coverage rule:** every capability is on the first screen of every view, at 1280 and 360 px, before any action, and a test holds it (§5).
> - **The role lens** (`?for=leader`, `ai`, `strategy`, `maker`) reorders the capabilities for a role and never hides one (§6).

<figure class="slate-figure" data-diagram="home-levels">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 510" role="img" aria-labelledby="hv-levels__title hv-levels__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="hv-levels__title">Three levels of information, the same in every view</title>
<desc id="hv-levels__desc">Level 1, the map, is seen in under ten seconds without any action: all six capabilities. Level 2, the signal, gives one capability a proof line, a picture and a voice, enough to decide whether to dig deeper. Level 3, the detail, opens in place on request: the evidence behind the capability, each item a page, a résumé line or a recommendation, or an offer to ask about work that has no public page.</desc>
<g id="hv-levels__l1" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="hv-levels__body-1" x="40" y="40" width="280" height="400" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-levels__body-1" data-slate-fit-padding="16">L1 The map</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-levels__body-1" data-slate-fit-padding="16">10 seconds, no action</text>
<rect id="hv-levels__body-2" x="56" y="116" width="248" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="141" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-levels__body-2" data-slate-fit-padding="16">Design leadership</text>
<rect id="hv-levels__body-3" x="56" y="166" width="248" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="191" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-levels__body-3" data-slate-fit-padding="16">Product strategy</text>
<rect id="hv-levels__body-4" x="56" y="216" width="248" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="241" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-levels__body-4" data-slate-fit-padding="16">AI transformation</text>
<rect id="hv-levels__body-5" x="56" y="266" width="248" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="291" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-levels__body-5" data-slate-fit-padding="16">Hands-on making</text>
<rect id="hv-levels__body-6" x="56" y="316" width="248" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="341" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-levels__body-6" data-slate-fit-padding="16">Craft and storytelling</text>
<rect id="hv-levels__body-7" x="56" y="366" width="248" height="40" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="391" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-levels__body-7" data-slate-fit-padding="16">Systems and operating models</text>
</g>
<g id="hv-levels__l2" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="hv-levels__body-8" x="360" y="40" width="280" height="400" rx="18" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="380" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-levels__body-8" data-slate-fit-padding="16">L2 The signal</text>
<text x="380" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-levels__body-8" data-slate-fit-padding="16">10 to 60 seconds, a glance</text>
<rect id="hv-levels__body-9" x="376" y="116" width="248" height="300" rx="14" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="hv-levels__body-10" x="392" y="132" width="216" height="96" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="408" y="186" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="hv-levels__body-10" data-slate-fit-padding="16">picture</text>
<text x="392" y="258" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-levels__body-9" data-slate-fit-padding="16">AI transformation</text>
<text x="392" y="280" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-levels__body-9" data-slate-fit-padding="16">Handoff is now code</text>
<text x="392" y="316" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-levels__body-9" data-slate-fit-padding="16">“He stays at the cutting</text>
<text x="392" y="334" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-levels__body-9" data-slate-fit-padding="16">edge of AI.” Diego Baca</text>
<text x="392" y="388" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-levels__body-9" data-slate-fit-padding="16">Show the details</text>
</g>
<g id="hv-levels__l3" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="hv-levels__body-11" x="680" y="40" width="280" height="400" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="700" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-levels__body-11" data-slate-fit-padding="16">L3 The detail</text>
<text x="700" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="hv-levels__body-11" data-slate-fit-padding="16">on request, in place</text>
<rect id="hv-levels__body-12" x="696" y="116" width="248" height="52" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="712" y="138" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-levels__body-12" data-slate-fit-padding="16">The AI program</text>
<text x="712" y="158" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-levels__body-12" data-slate-fit-padding="16">résumé · ask me about it</text>
<rect id="hv-levels__body-13" x="696" y="176" width="248" height="52" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="712" y="198" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-levels__body-13" data-slate-fit-padding="16">Cloner Pro</text>
<text x="712" y="218" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-levels__body-13" data-slate-fit-padding="16">article · 3,530 people</text>
<rect id="hv-levels__body-14" x="696" y="236" width="248" height="52" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="712" y="258" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-levels__body-14" data-slate-fit-padding="16">The best learning loop</text>
<text x="712" y="278" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-levels__body-14" data-slate-fit-padding="16">essay</text>
<rect id="hv-levels__body-15" x="696" y="296" width="248" height="52" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="712" y="318" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="hv-levels__body-15" data-slate-fit-padding="16">Diego Baca</text>
<text x="712" y="338" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-levels__body-15" data-slate-fit-padding="16">recommendation</text>
<text x="700" y="404" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-levels__body-11" data-slate-fit-padding="16">Read the page, or ask me</text>
</g>
<text x="40" y="480" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Beyond level 3 is the full page: every capability links to the pages that prove it.</text>
<g id="hv-levels__flow-1" data-slate-svg-step="4" data-slate-svg-effect="draw">
<path d="M320 240 L350 240" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="359,240 350,245 350,235" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-levels__flow-2" data-slate-svg-step="5" data-slate-svg-effect="draw">
<path d="M640 240 L670 240" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="679,240 670,245 670,235" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>The three levels, the same in every view: the map, the signal, and the detail on request.</figcaption>
</figure>

## 1. Three levels of information

| Level | The visitor's question | Time | What it shows | How it's revealed |
|---|---|---|---|---|
| **L1, the map** | What can this person do? Is my need here at all? | Up to 10 seconds | The name, the role, the positioning line, and all six capabilities by name | Nothing to do: it's on the first screen |
| **L2, the signal** | Is this capability strong enough to dig into? | 10 to 60 seconds | For one capability: its proof line, a picture, an evidence count, and a colleague's words where there are some | A glance: it sits beside or under the L1 name, or appears on hover and focus where space is short |
| **L3, the detail** | What exactly is behind it? | 1 to 5 minutes | Three to five evidence items: a page, a résumé line, a recommendation, each with its kind; "Ask me about it" for work with no public page | Opened in place by the visitor (a drawer, a panel, a sheet), never a new page |
| **Beyond** | Let me read the whole thing | As long as it takes | The full article, the résumé, the section | A link from L3 |

Rules:
- **L1 is never behind an action.** Not a click, a hover, a scroll on a phone's first screen, a carousel slide or a chapter that hasn't played.
- **L2 is one glance away,** at most one action (a hover, a focus, or the tile itself).
- **L3 opens in place** and closes back to the same scroll position, so the visitor never loses the map.
- **Every level carries the way to the next:** a tile has Show the details, a detail item has its page.

## 2. The spine

The spine is a content file, `content/showcase.json`, edited like any other content (through edit mode's store, with the content check), and read through the repository like everything else ([content spec](../content/spec.md)). The views never read the articles directly: they read the spine, which points at them.

```json
{
  "facts": [
    { "id": "years", "text": "18 years", "source": "ref:article/resume" }
  ],
  "capabilities": [
    {
      "id": "ai",
      "name": "AI transformation",
      "short": "AI",
      "line": "Handoff is now code",
      "keywords": ["Agentic AI", "Coded prototypes", "Adoption"],
      "proof": [
        { "kind": "led", "resume": "AI transformation program", "ask": true },
        { "kind": "built", "ref": "ref:article/cloner-pro" },
        { "kind": "wrote", "ref": "ref:article/the-best-learning-loop-will-win" },
        { "kind": "said", "recommendation": "diego-baca" }
      ],
      "voice": { "recommendation": "diego-baca", "quote": "He stays at the cutting edge of AI" },
      "media": "ref:media/…",
      "lens": ["ai", "maker"]
    }
  ],
  "highlights": [
    { "id": "family", "ref": "ref:article/defining-microsoft-family", "capability": "strategy" }
  ]
}
```

| Field | What it is |
|---|---|
| `positioning` | The one line under the name: the site setting `positioning` (`content/site.json`), which already exists, not a field of the spine. Today the résumé's summary says it |
| `facts` | Short verified facts (years, team size, people reached), each with its source |
| `capabilities[].line` | The proof line: a fact, not an adjective, in about five words |
| `capabilities[].proof` | The evidence: `kind` is one of `shipped`, `led`, `built`, `wrote`, `said`; it points at a page (`ref`), a résumé line (`resume`, a fragment the check finds in the résumé's text) or a recommendation |
| `capabilities[].voice` | The quote shown at L2: a fragment that must appear word for word in that recommendation |
| `capabilities[].keywords` | What the Keywords view shows, and what a recruiter's search matches |
| `capabilities[].lens` | The roles this capability leads for (§6) |
| `highlights` | The ordered items the Spotlight and the Showreel share, each tagged with a capability |

**The content check** holds:
- every capability has at least one proof, and at least one that isn't a résumé line, or it's flagged (not refused) in edit mode;
- every `ref` resolves to a published, open page; a private page or a draft is refused (the same rule as modes, V25 and V13 in [navigation modes](../desktop/modes.md));
- every `resume` fragment and every `quote` appears word for word in its source, so an edit there can't leave the home page saying something its source no longer does;
- every highlight's capability exists.

**As built** (stage 1 of the [plan](plan.md)): a capability's `media` is a media ID (`<owner>/<id>`, like a page's lead picture), not a ref; a fact's `text` is found word for word in its source page; a question may name no strengths (a general answer). The schema is `src/site/home/schema.ts`.

**On every site, most of this is found, not written.** The `proof` list above is the owner's hand-picked one; in the general model a `proof` list holds only **pins**, and the rules find the rest in the site's published pages each time it's built. The decisions the curation adds (the goal, what each strength matches, hides, the curation settings) and what's computed instead of stored are in [curation §2](curation.md).

## 3. The six capabilities

The proposed taxonomy, built from the résumé, the articles and the recommendations. The owner confirms it (open decision H1).

| Capability | Short name | What it covers | Proof line |
|---|---|---|---|
| **Design leadership** | Leadership | Building orgs and teams, hiring, developing people, culture | Built Belong's design org |
| **Product strategy** | Strategy | Shaping what gets built and why, with product and engineering | Family Safety to Family |
| **AI transformation** | AI | Changing how design works with AI, and designing agentic experiences | Handoff is now code |
| **Hands-on making** | Making | Building real tools, plugins, apps and sites himself | Cloner Pro: 3,530 people |
| **Craft and storytelling** | Craft | Quality, visual and motion craft, telling the story of the work | Led Craft in Windows |
| **Systems and operating models** | Systems | Design systems, ways of working, the machinery of a design org | Belong Design System |

The default order follows the positioning line (leader, strategy, AI) and then the depth of evidence.

These six are the owner's. Another site has its own 3 to 6, named by the person (in edit mode, **strengths**), suggested from their pages or picked from a list of common ones ([for every site §3](for-every-site.md)), and every view adapts its layout to the count ([for every site §4](for-every-site.md)).

## 4. The evidence, and where it's thin

What the site holds today for each capability. "On the site" means a published page or a recommendation; "résumé only" means a résumé line with no page behind it.

| Capability | On the site | Résumé only | Gap |
|---|---|---|---|
| **Leadership** | Do what makes you proud; Defining Microsoft Family (from designer to leading the team and the product); My journey with DesignUp; Diego Baca ("a great manager who stays deeply involved in the work"); March Roger ("builds strong teams, develops people") | Teams of 5 to 9 designers; built and transitioned the India-based Family Safety design capability to full ownership; built Belong's design org from scratch; the Task Relevant Maturity framework; reported to the CEO in the Core Leadership Team | No page on building Belong's org |
| **Strategy** | Defining Microsoft Family; March Roger ("where product strategy, design and technology meet"); Prabu Ambravaneswaran ("can challenge the strongest product thinkers on their own turf") | The Family Safety to Microsoft Family strategy; Windows cross-device; Windows Resume and Live Notifications; People in Windows; influence into pricing, sales and the org at Belong | One case study; the Windows work has no page |
| **AI** | Cloner Pro (built with AI's help); Watai; Khonjel; The best AI model won't win; Diego Baca ("stays at the cutting edge of AI"); March Roger ("how agentic experiences can change both what we build and how we build it") | The AI transformation program for Design; the shift to coded prototypes as the main handoff to engineering; designers in production codebases; AI champions extended to Windows Design in Seattle; Copilot on Windows; agentic personalization of Windows themes | **The strongest gap:** the program, the handoff shift and the agentic work have no page |
| **Making** | Cloner Pro, Liquid Glass Pro, Liquid glass for the web, Atiya, Slate, Watai, Khonjel, Generative explorations (eight built and published; Story is a draft) | Building Figma plugins with AI in early 2023 (Who am I?) | None: the deepest evidence |
| **Craft** | You don't have a storytelling problem; My journey with DesignUp (photos, motion design, 3D); Generative explorations; March Roger ("pairs this thinking with real craft") | Led Craft in Windows; core founding team member of DesignUp since 2016 | No page on Craft in Windows; Gallery is empty |
| **Systems** | Slate; Atiya's publishing system; Liquid glass for the web's design library | Belong Design System from scratch; the design and product-development operating system at Belong | No page on the Belong Design System |

The finding: **the two capabilities the positioning line leads with after leadership, strategy and AI, are the two proved least on the site.** A hiring manager who reads only pages will see a maker first. The recommended content work, alongside phase 1 (open decision H7):
1. **"The AI program for Design"**: what changed, how handoff moved to coded prototypes, what designers do in production code now, and what it did to throughput and quality, within what can be said publicly.
2. **"Windows, across devices"**: a short strategy page covering the cross-device work, as far as it's public.
3. **"Building Belong's design org"**: the org, the Task Relevant Maturity framework and the design system, as one leadership-and-systems story.
4. **Gallery**: a few pieces of craft, so Craft has pictures as well as words.

Where something can't be public, the spine shows the résumé line with **Ask me about it**, which opens the contact form with the topic filled in. That answers question 8 ("What can be discussed publicly?") honestly instead of leaving a hole.

## 5. The coverage rule

**Every capability is visible on the first screen of every view, at 1280 by 800 and at 360 by 740, with no action.** "Visible" means its name is in the viewport, at a readable size, not covered and not inside a closed or off-screen part (a carousel slide, a later chapter, a collapsed panel).

How each view meets it:

| View | How all six are on the first screen |
|---|---|
| Bento | Six tiles on a wide screen; on a phone, the index tile under the lead |
| Cover | Six numbered cover lines beside the cover; on a phone, under a cover kept about square so they still fit |
| Spotlight | The capability row above the stage |
| Showreel | The chapter bar names them under the stage, before it plays; on a phone, a still line under the controls |
| Keywords | The field's six group labels (on a phone, its six group rows); with nothing picked, the results show all six too |
| Proof grid | The rows |
| Questions | Question 1 is open at rest, and its answer is the six capabilities |

How it's tested: each capability's L1 element carries `data-capability="<id>"` in the page's first HTML (not added by a script later). An E2E test opens each offered view at both sizes and checks that all six are in the viewport and visible. A new view can't be offered until it passes. On any site, the test runs at that site's own count of strengths, 3 to 6, so the rule holds for everyone, not only at six.

## 6. The role lens

A recruiter often knows the role. The lens lets a link say it: `/?for=ai` opens the home page with the capabilities ordered for an AI-focused role. It reorders; it never hides.

| Lens | Order | Lead voice |
|---|---|---|
| None (default) | Leadership, Strategy, AI, Making, Craft, Systems | Diego Baca |
| `leader` (a design leader role) | Leadership, Strategy, Systems, AI, Craft, Making | March Roger |
| `ai` (an AI design role) | AI, Making, Strategy, Leadership, Systems, Craft | Diego Baca |
| `strategy` (a product design or strategy role) | Strategy, Leadership, AI, Systems, Craft, Making | Prabu Ambravaneswaran |
| `maker` (a hands-on or prototyping role) | Making, AI, Craft, Systems, Strategy, Leadership | Diego Baca |

- **It's shown:** a chip under the identity strip, "Showing: for an AI design role · Change", whose menu lists the lenses and "No lens".
- **It's kept only for the visit** (session storage), not remembered across visits: the next visit starts neutral.
- **It travels:** the view's own Copy link keeps it, so a recruiter can send a hiring manager the same first screen.
- **It changes order and the lead voice only:** the same capabilities, proof and evidence, so the coverage rule holds under every lens.

**On every site,** the lenses are the goal's presets (by role for Get hired, by service or industry for Win clients, by theme for Share my work) plus any the person makes, and a person can make a link for one job: the same lens behind a generated code, with who it's for kept privately ([owner flows §5](owner-flows.md)).

### As built (stage 2c)

The lens is built over Bento, Cover and Proof grid. Each lens has its own page for each view, `/views/<view>/for/<lens>/`, made at build time from the site's lenses; the views' unit tests and the E2E group "home views: role lens" hold it.

- **The address.** `/?for=<lens>` is read by the router before the first paint, kept in `sessionStorage['site.homeLens']` for the visit, and sent on to the default view's lens page; when the default is the classic hub, which has no order to change, to the first offered view that isn't. While a lens is kept, a view's own address moves to its lens page, and `?for=` with no value clears it. A lens the site doesn't have is ignored. Each lens page's canonical address is `/`, like every view's.
- **The note, not a chip with its own menu.** Under the lead's actions, a quiet line says "Ordered for", the lens's name as a tag, and "Use usual order", which clears it. Choosing another lens is in Change view, under "Order by role" (the goal's own word for its lenses): each lens with what it puts first, the one showing marked, and "Use the usual order". One place to change how the home page shows, rather than two menus.
- **On a phone the note gives way** (below the small breakpoint): every strength must stay in the first screen, and the line would push the last of them below it. Change view still names the lens and offers the usual order there.
- **What changes:** Bento's large first tile, the Cover's story and the Proof grid's first row (the one open on a phone) go to the lens's first strength, and In their words starts with the lens's voice. Nothing else moves: every strength and every piece of evidence stays, so the coverage rule holds under every lens (the E2E checks it on a phone).
- **Not built yet:** the views' Copy link; until there is one, the link to send is `/?for=<lens>` or the lens page's own address. The lens in Spotlight, Showreel, Keywords and Questions comes as each is built.

## 7. Always on screen

In every view, at every width:

| What | Wide screen | Phone |
|---|---|---|
| The name | The identity strip, top left | The strip |
| The positioning line | Under the name, or in the lead | In the first screen's lead |
| **Read résumé** (page, with Download PDF on it) | The strip | The first screen, and the menu |
| **Contact me** | The strip | The first screen, and the menu |
| **Change view** | The strip | The menu, and the end of the page |
| The site's sections | The header's navigation, and an index at the foot of the view | The menu, and the index at the foot |

The identity strip is the site's header in a home-specific arrangement, not a second header: it keeps the header's theme switch, its menu and its tucking behaviour on a phone ([mobile audit](../site-ui/mobile-audit.md)).

## 8. Copy rules

- **A proof line is a fact,** in about five words: "Handoff is now code", not "Passionate about AI".
- **Numbers carry their source** in L3 ("3,530 people use it", from the Cloner Pro page).
- **Quotes are word for word** from a recommendation, and short: under 12 words at L2.
- **No line on the first screen is longer than about 12 words,** and the first screen has at most about 80 words in all.
- **The visitor is "you"; the owner is "he" or his name** in the views, matching the recommendations and the résumé's tone. (The articles stay in his own first person.)
- Sentence case; labels start with a verb and are three words or fewer (Read résumé, Contact me, Change view, Show the details).
- **Never invent:** no claim on the home page that its source doesn't make.

## 9. Visual language

The views use the site's own system: paper and ink, one indigo spot, Fraunces for display, Newsreader for reading, Figtree for interface ([visual language](../site-ui/visual-language.md)), the site's tokens and components ([design system](../site-ui/design-system.md)), and the owner's ink sketch illustrations where a capability has no picture of its own. A view may add its own composition, never its own colours, type or raw values. Each capability gets a picture: the article's lead picture where there is one, or an ink sketch drawn for it, with a dark version, as every picture on the site has.

## 10. Shared budgets

| Budget | Limit |
|---|---|
| First screen readable (LCP) on a mid-range phone | Under 2.5 seconds |
| A view's own JavaScript | Under 15 KB gzip, except the Showreel's player (under 40 KB) |
| Pictures on the first screen | Sized by `sizes()`, at most about 300 KB in all on a phone |
| Layout shift | Under 0.05; the L3 drawer pushes content down only after the visitor asks |
| Smallest width | 320 px, no sideways scroll; targets at least 44 px |

## 11. Telemetry

All events go through the site's allowlist ([access spec](../access/spec.md), telemetry); none carries text a visitor typed.

| Event | Properties | Answers |
|---|---|---|
| `home_view` | `view`, `lens`, `source` (default, stored, link) | Which views are seen, and how they're reached |
| `capability_l1_seen` | `id` | Did each capability reach the viewport? |
| `capability_l2_open` | `id`, `view` | Which capabilities draw a second look |
| `capability_l3_open` | `id`, `view` | Which are dug into |
| `view_switch` | `from`, `to` | Which views visitors prefer |
| `resume_open`, `resume_download`, `contact_open` | `view`, `from` (the capability or the strip) | Conversion, and what led to it |

Each view adds its own (the highlights seen, the reel's chapters, the keyword picks), listed on its page.

## 12. Open decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| F1 | Six capabilities, or fewer | Six; four (Leadership, Strategy, AI, Making) | Six: Craft and Systems are where the "complete design leader" shows, and they're cheap at L1 |
| F2 | The lens values | `leader`, `ai`, `strategy`, `maker`; free text matched against keywords | The four fixed values for the owner; on every site, the goal's presets and the person's own lenses ([owner flows §5](owner-flows.md)) |
| F3 | A capability with only résumé lines | Show it with Ask me about it; hide it until it has a page | Show it: hiding it is the failure case. A capability with no proof at all is hidden ([curation §10](curation.md), CU7) |
| F4 | Where `showcase.json` is edited | A new edit mode screen; inside the home hub's settings | Resolved: the Home screen, with the real home page as its preview and the coverage meter over it ([owner flows §1](owner-flows.md)) |
