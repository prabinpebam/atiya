# Curating the home page

A home page is only as good as what it picks: the best proof for each strength, the right highlights, the order. This page is how those picks are made **without AI**: by rules, from the site's own content, the same way for every site, every build. The person makes a few decisions; the rules do the rest, and keep doing it as pages are added. [Curating with AI](ai-curation.md) adds a helper on top, never underneath. It's part of [Home page views](README.md) and fills the model in [Home views for every site](for-every-site.md).

> **TL;DR.**
> - **Store decisions, compute the rest.** `content/showcase.json` holds only what the person decided: the goal, strengths, lines, pins, hides, voices, lenses. Which proof appears where is computed at each build and live in edit mode, so a new page finds its place without anyone editing the home page.
> - **Machines choose, people say.** The rules pick and order; every word shown is the person's own: a page's title and summary, a strength's line, a quote they chose.
> - **Three states for every item:** Auto (the rules decide), Pinned (always shown, first) and Hidden (never shown). Every pick says why it was picked.
> - **The rules:**
>   - an **evidence index** of every open, published page, résumé line and recommendation, with its signals: section, topics, kind, dates, depth, picture, links;
>   - **matching** by topic, section and words;
>   - a **score**;
>   - **slot filling** that puts coverage first and never shows one page as two strengths' best proof.
> - **Reproducible:** no clock, no randomness, ties broken by date then ID, so the same content always gives the same home page (and `build-parity` holds).
> - **A health report** in edit mode lists what's blocking, warnings and opportunities, each with its fix. Visitors never see it.
> - **Topics need a vocabulary:** today they're free-form, and 7 of the owner's 17 articles have none. A small `content/topics.json` with synonyms, and suggested topics on save, fix that for every site.

<figure class="slate-figure" data-diagram="home-curation">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 590" role="img" aria-labelledby="hv-curation__title hv-curation__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="hv-curation__title">Curating the home page: store decisions, compute the rest</title>
<desc id="hv-curation__desc">The site's content (published open pages, the résumé, recommendations, topics and sections) is read into an evidence index, one row per piece of proof with its signals. For each strength, the rules match and score that evidence, pins first. The slots of each view are then filled: coverage first, one page per strength, hides always respected. The result is the picks for every view, at three levels, computed at each build and live in edit mode, never stored. What is stored is the owner's decisions, in content/showcase.json: the goal, the strengths and their lines, pins, hides, voices and links. An optional AI helper reads a digest of the evidence index and proposes decisions, each word cited, which the owner accepts or rejects. A health report lists what's blocking, warnings and opportunities, each with its fix.</desc>
<g id="hv-curation__ai" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="hv-curation__body-1" x="40" y="40" width="440" height="120" rx="18" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="60" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-curation__body-1" data-slate-fit-padding="16">AI helper</text>
<text x="60" y="94" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-curation__body-1" data-slate-fit-padding="16">optional, at authoring time only</text>
<text x="60" y="122" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-1" data-slate-fit-padding="16">Suggests strengths, lines and places</text>
<text x="60" y="146" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-1" data-slate-fit-padding="16">Every word cited; you accept it or not</text>
</g>
<g id="hv-curation__decisions" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="hv-curation__body-2" x="520" y="40" width="440" height="120" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="540" y="72" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-curation__body-2" data-slate-fit-padding="16">Your decisions</text>
<text x="540" y="94" text-anchor="start" font-family="ui-monospace, Cascadia Code, Consolas, monospace" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="hv-curation__body-2" data-slate-fit-padding="16">content/showcase.json</text>
<text x="540" y="122" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-2" data-slate-fit-padding="16">Goal, strengths and their lines</text>
<text x="540" y="146" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-2" data-slate-fit-padding="16">Pins, hides, voices, links</text>
</g>
<text x="40" y="206" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Computed at each build, and live in edit mode</text>
<g id="hv-curation__content" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="hv-curation__body-3" x="40" y="220" width="200" height="160" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="56" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-curation__body-3" data-slate-fit-padding="16">content/</text>
<text x="56" y="274" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-curation__body-3" data-slate-fit-padding="16">what the site holds</text>
<text x="56" y="306" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-3" data-slate-fit-padding="16">Open, published pages</text>
<text x="56" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-3" data-slate-fit-padding="16">Résumé, voices</text>
<text x="56" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-3" data-slate-fit-padding="16">Topics, sections</text>
</g>
<g id="hv-curation__index" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="hv-curation__body-4" x="280" y="220" width="200" height="160" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="296" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-curation__body-4" data-slate-fit-padding="16">Evidence index</text>
<text x="296" y="274" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-curation__body-4" data-slate-fit-padding="16">one row per proof</text>
<text x="296" y="306" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-4" data-slate-fit-padding="16">Section, topics, kind</text>
<text x="296" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-4" data-slate-fit-padding="16">Your part, dates</text>
<text x="296" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-4" data-slate-fit-padding="16">Depth, pictures, links</text>
</g>
<g id="hv-curation__match" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="hv-curation__body-5" x="520" y="220" width="200" height="160" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="536" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-curation__body-5" data-slate-fit-padding="16">Match and score</text>
<text x="536" y="274" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-curation__body-5" data-slate-fit-padding="16">per strength</text>
<text x="536" y="306" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-5" data-slate-fit-padding="16">Pins first</text>
<text x="536" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-5" data-slate-fit-padding="16">Topics, sections, words</text>
<text x="536" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-5" data-slate-fit-padding="16">Kind, depth, recency</text>
</g>
<g id="hv-curation__fill" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="hv-curation__body-6" x="760" y="220" width="200" height="160" rx="16" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="776" y="252" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-curation__body-6" data-slate-fit-padding="16">Fill the slots</text>
<text x="776" y="274" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="hv-curation__body-6" data-slate-fit-padding="16">per view</text>
<text x="776" y="306" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-6" data-slate-fit-padding="16">Coverage first</text>
<text x="776" y="330" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-6" data-slate-fit-padding="16">One page, one strength</text>
<text x="776" y="354" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-6" data-slate-fit-padding="16">Hides always win</text>
</g>
<g id="hv-curation__health" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<rect id="hv-curation__body-7" x="40" y="440" width="440" height="120" rx="18" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="60" y="472" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="hv-curation__body-7" data-slate-fit-padding="16">Health report</text>
<text x="60" y="494" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="hv-curation__body-7" data-slate-fit-padding="16">in edit mode, never shown to visitors</text>
<text x="60" y="522" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-7" data-slate-fit-padding="16">Blocking, warnings, opportunities</text>
<text x="60" y="546" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="hv-curation__body-7" data-slate-fit-padding="16">Each with the fix beside it</text>
</g>
<g id="hv-curation__picks" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="hv-curation__body-8" x="520" y="440" width="440" height="120" rx="18" fill="var(--color-brand-bg)" />
<text x="540" y="472" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="hv-curation__body-8" data-slate-fit-padding="16">The picks, for every view</text>
<text x="540" y="494" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-curation__body-8" data-slate-fit-padding="16">computed, never stored</text>
<text x="540" y="522" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-curation__body-8" data-slate-fit-padding="16">L1 every strength, L2 its best proof</text>
<text x="540" y="546" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="hv-curation__body-8" data-slate-fit-padding="16">L3 the rest, ranked, within its budget</text>
</g>
<g id="hv-curation__flow-1" data-slate-svg-step="9" data-slate-svg-effect="draw">
<path d="M240 300 L270 300" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="279,300 270,305 270,295" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-curation__flow-2" data-slate-svg-step="10" data-slate-svg-effect="draw">
<path d="M480 300 L510 300" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="519,300 510,305 510,295" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-curation__flow-3" data-slate-svg-step="11" data-slate-svg-effect="draw">
<path d="M720 300 L750 300" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="759,300 750,305 750,295" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-curation__flow-4" data-slate-svg-step="12" data-slate-svg-effect="draw">
<path d="M620 160 L620 210" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="620,219 625,210 615,210" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-curation__flow-5" data-slate-svg-step="13" data-slate-svg-effect="draw">
<path d="M860 160 L860 210" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="860,219 865,210 855,210" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-curation__flow-6" data-slate-svg-step="14" data-slate-svg-effect="draw">
<path d="M480 100 L510 100" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="519,100 510,105 510,95" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-curation__flow-7" data-slate-svg-step="15" data-slate-svg-effect="draw">
<path d="M380 220 L380 170" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" stroke-dasharray="6 5" />
<polygon points="380,161 385,170 375,170" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-curation__flow-8" data-slate-svg-step="16" data-slate-svg-effect="draw">
<path d="M860 380 L860 430" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="860,439 865,430 855,430" fill="var(--color-neutral-fg-2)" />
</g>
<g id="hv-curation__flow-9" data-slate-svg-step="17" data-slate-svg-effect="draw">
<path d="M780 380 L780 410 L260 410 L260 430" fill="none" stroke="var(--color-neutral-fg-2)" stroke-width="2" />
<polygon points="260,439 265,430 255,430" fill="var(--color-neutral-fg-2)" />
</g>
</svg>
<figcaption>Stored decisions, computed picks: the person's decisions and the site's content go in; the picks for every view and a health report come out.</figcaption>
</figure>

## 1. Principles

1. **Store decisions, compute the rest.** What's stored is only what a person chose. Everything else is recomputed, so it can't go stale.
2. **Machines choose, people say.** No rule writes a word a visitor reads. Rules choose among the person's words.
3. **Every pick has a reason** a person can read: "Matches the topic AI · a case study · updated this year".
4. **The person always wins.** A pin beats any score; a hide is absolute; Hold automatic changes freezes everything.
5. **Coverage before quality.** Every strength gets its proof before any strength gets its second.
6. **Same input, same home.** No clock, no random choice, no visitor data.
7. **Quiet by default, loud when it matters.** A new page enters without a question; a broken quote stops a save.

## 2. What's stored

`content/showcase.json` grows from [foundation §2](foundation.md) by the decisions below. Everything there stays valid: a hand-written `proof` list is read as pins.

```json
{
  "goal": "hired",
  "capabilities": [
    {
      "id": "ai",
      "name": "AI transformation",
      "short": "AI",
      "line": "Handoff is now code",
      "keywords": ["Agentic AI", "Coded prototypes", "Adoption"],
      "match": { "topics": ["ai"], "sections": [] },
      "proof": [
        { "kind": "led", "resume": "AI transformation program", "ask": true }
      ],
      "hide": ["ref:article/…"],
      "voice": { "recommendation": "diego-baca", "quote": "He stays at the cutting edge of AI" }
    }
  ],
  "highlights": [ { "ref": "ref:article/defining-microsoft-family", "capability": "strategy" } ],
  "hideHighlights": [],
  "actions": { "primary": "Read résumé" },
  "curation": { "recent": "some", "detail": 5, "hold": false, "strict": "balanced", "leaveOut": [] }
}
```

| Field | Decision it records |
|---|---|
| `goal` | `hired`, `clients` or `share` ([for every site §2](for-every-site.md)) |
| `capabilities[].match` | Which topics and sections prove this strength. `keywords` match too, and are what the Keywords view shows |
| `capabilities[].proof` | **Pins**, in order: shown first, whatever their score. A résumé line or a fact can only be pinned |
| `capabilities[].hide` | Never shown for this strength (it can still prove another) |
| `highlights`, `hideHighlights` | Pinned and hidden highlights |
| `curation.recent` | Prefer recent work: `off`, `some` or `strong` (§5) |
| `curation.detail` | How many proof items L3 shows before Show all: 3 to 8, 5 by default |
| `curation.hold` | Hold automatic changes (§7) |
| `curation.strict` | How strict: `loose`, `balanced` or `strict`, a candidate's match of at least 0.3, 0.4 or 0.7 (§4) |
| `curation.leaveOut` | Sections, topics and kinds of page never used as proof |
| `actions` | The two always-on actions' labels, where the person renamed the goal's ([for every site §2](for-every-site.md)) |

Lenses, tailored links and view settings are decisions too, specified in [Making your home page](owner-flows.md) and [Controls](controls.md).

**One new article field, `contribution`** (optional): the person's part in the work, one of `shipped`, `led`, `built`, `wrote`, `spoke`, `recognised`. Without it, a page's kind decides: a note counts as `wrote`, a talk as `spoke`, a gallery as `built`, a plain page as nothing. It's set in the article's settings as **Your part** ([owner flows §4](owner-flows.md)), because "wrote about it" and "shipped it" are very different proof, and only the person knows which it was.

## 3. The evidence index

One row per piece of possible proof: every published, open page, every résumé line the person pinned, every recommendation. It's built from the content index edit mode already keeps for the action center ([action center](../desktop/action-center.md)), not by drawing pages.

| Signal | From | Used for |
|---|---|---|
| **Open** | `status: published` and `visibility: public` | Entry: nothing else is ever indexed. A private page, a draft or a redacted page never enters |
| **Section** | The site structure | Matching (§4) |
| **Topics** | The article's `topics`, through the vocabulary (§4.1) | Matching |
| **Words** | Title, summary, headings, then the body | Matching, weighted by where they appear |
| **Kind of proof** | `contribution`, else the page's kind | The score's first term, the Proof grid, kind balance in L3 |
| **Dates** | `publishedAt`, `updatedAt` | Recency |
| **Depth** | Words, figures and galleries, numbers in the text (a "3,530 people" is a result) | Depth |
| **Picture** | `hero` or `thumbnail` | L2, highlights, view minimums |
| **Links in** | Other pages' `related` and links to it | A page others point at is usually a key page |
| **Freshness** | `status: stale`, or `reviewedAt` long past | Ranked lower, and listed in the health report |

**Not a signal: visitor counts.** The build can't read the person's counting tool (it's their own account, promise P3), counts make the home page differ between builds, and popularity isn't strength: a hiring manager's view of a niche case study matters more than a hundred readers of a popular note.

## 4. Matching

A page proves a strength when it matches it. **Pins come first, hides come out**, then a page's match `m` (0 to 1) is the strongest of:

| Match | Weight |
|---|---|
| One of the strength's `match.topics` is one of the page's topics | 1.0 |
| The page is in one of the strength's `match.sections` | 0.8 |
| A keyword (or a topic's synonym) in the title | 0.7 |
| In the summary | 0.5 |
| In a heading | 0.4 |
| In the body, three times or more | 0.3 |

Word matches add up to at most 1. A page with `m` of at least 0.4 is a candidate (Advanced: **How strict**, 0.3 to 0.7). One page can prove several strengths; slot filling decides where it shows (§6).

### 4.1 A topic vocabulary

Today `topics` are free-form IDs, used unevenly: 7 of the owner's 17 articles have none, and the same idea can carry two IDs. For matching to work on every site, topics get a small vocabulary:

```json
{ "topics": [ { "id": "ai", "label": "AI", "synonyms": ["machine learning", "LLM", "agentic"] } ] }
```

- **`content/topics.json`**, edited on edit mode's Home screen (Advanced) and offered wherever topics are chosen.
- **The first time,** it's made from the topics already in use, each labelled from its ID, for the person to tidy.
- **Suggested topics on save:** when a page has no topics, the save suggests up to three whose label or synonym appears in its title, summary or headings. One click accepts them; ignoring them changes nothing.
- **A strength's keywords and a topic's synonyms are the same idea in two places,** so matching reads both.

## 5. The score

Among a strength's candidates, each gets a score from 0 to 1:

`score = m × (0.30 × kind + 0.25 × depth + 0.20 × recency + 0.15 × links + 0.10 × picture)`

| Term | 1.0 when | Notes |
|---|---|---|
| `kind` | Its kind is one the goal counts most ([for every site §2](for-every-site.md)) | 0.6 for any other kind |
| `depth` | About 1,500 words, or 6 figures and numbers | Scaled linearly below that |
| `recency` | It's the newest | `0.5 ^ (age / half-life)`; half-life: Off, none (always 1); Some, 3 years; Strong, 1 year |
| `links` | 3 or more pages link to it | Scaled below that |
| `picture` | It has a lead picture | 0 otherwise |

- **"Now" is the newest date in the content,** not today: the same content gives the same score on any day, so a rebuild changes nothing and `build-parity` holds.
- **A stale page's score is halved.** It stays eligible: excluding it would let a strength's only proof vanish silently.
- **Ties** break by score, then the newest date, then the ID.
- **The weights are a starting point.** They're engine constants, tuned with the first sites' health reports; a person never sees them, only their effect and the reason line.

## 6. Filling the slots

The views share one set of picks.

| Slot | How it's filled |
|---|---|
| **L1** | Every strength, in the person's order (or a lens's) |
| **L2 proof** | The pin, else the best candidate that isn't already another strength's L2 proof, preferring a page over a résumé line. One page is never two strengths' headline |
| **L2 picture** | The strength's own picture, else its L2 proof's lead picture, else none: the tile is type only, never a stock picture |
| **L2 voice** | The person's chosen quote only. A rule never picks someone's words for them; unused recommendations are listed as an opportunity (§8) |
| **L3** | Pins in order, then by score, up to `detail` (5), with **kind balance**: at most 2 of one kind while other kinds are waiting. Then Show all |
| **Highlights** (at most 8) | Pins, then one per strength in order, the best candidate with a picture, round after round until 8 or none left. No page twice |
| **Showreel** | The highlights, at most 2 per strength |
| **Keywords** | Each strength's keywords, then its proof's most frequent topic labels, 6 per group by default (Per group, 4 to 8); a strength's own keywords are kept for it, and a singular and its plural are one keyword |
| **Questions** | The person's answers; each answer's evidence is the picks of the strengths it names |
| **Facts** | The person's only |

Each pick carries its reason, shown in edit mode as one line: "Auto: topic AI, a case study, 2026, 2 pages link here".

## 7. When the content changes

| What happens | What the rules do | What the person sees |
|---|---|---|
| **A page is published** | It's indexed and scored; it may enter L3, L2 or the highlights | A card after Publish: "Now on your home: AI, in the details" with Pin, Hide, Open Home ([owner flows §4](owner-flows.md)). Save to remote lists home changes with the rest |
| **A page is edited** | It's re-scored | Nothing, unless its place on the home changes; then the same card |
| **A quoted sentence is edited** (a voice, a résumé line, a quoted block) | The quote would no longer be word for word | The editor marks quoted blocks. Saving a change to one asks: **Update the quote too**, **Remove the quote** or Cancel, in one transaction |
| **A pinned page is made private, unpublished or deleted** | A pin to it would fail the check | The dialog that does it says so, and the same transaction removes the pin |
| **A page moves or is renamed** | Nothing: proof points at IDs, which never change | Nothing |
| **A strength is renamed** | Its ID stays, so lenses and tailored links keep working | Nothing |
| **Hold automatic changes is on** | The picks are frozen as they are, written to `showcase.json` as a snapshot | New pages wait. The Home screen lists what would change, with Release |

The home page never shows a sentence its source no longer says: the content check refuses a quote or a résumé fragment it can't find, as [foundation §2](foundation.md) requires.

## 8. The health report

In edit mode only, on the Home screen's Health tab, with a count beside Home in the side navigation. Agents read the same report from `atiya home check` ([AI curation §8](ai-curation.md)).

| Level | Item | The fix offered |
|---|---|---|
| **Blocking** | A pin, a quote or a résumé fragment that no longer resolves | Remove pin; Update quote |
| **Blocking** | A strength with no proof at all | Pin a résumé line, add a topic to a page, or remove the strength. Until then, visitors don't see it |
| Warning | A strength proved only by résumé lines | Write a proof page; with AI, Outline a page ([AI curation §5](ai-curation.md)) |
| Warning | A strength with one proof, or no picture | Show candidates that nearly matched; choose a picture |
| Warning | All of a strength's proof is older than 5 years (with Prefer recent work on) | Review it, or turn the setting off |
| Warning | The default view, or an offered one, is below its minimum ([for every site §5](for-every-site.md)) | What it needs, with a link to add it |
| Warning | Proof that's stale | Open the page |
| Opportunity | Published pages that prove no strength | Add a topic, map their section, or leave them |
| Opportunity | Recommendations not used as a voice | Pick a sentence |
| Opportunity | Pages with no topics | Accept the suggested ones |
| Opportunity | A view that just reached its minimum | Offer it |

A blocking item never blocks Save to remote for anything else; it only stops the home page from showing what's broken.

## 9. Scale

| Pages | What the rules face | What changes |
|---|---|---|
| **1 to 5** | Few candidates; some strengths have one proof | Short L3s; several views below their minimums; the health report suggests what to write next |
| **6 to 40** | Enough for every view | Pins are rarely needed |
| **40 to 200** | Many candidates per strength | The topic vocabulary matters most; Show all appears; pinned highlights help |
| **200 and more** | Hundreds per strength | Body words are matched only for the 30 best candidates per strength by title, summary and topics; the index is cached by content generation |

**Built as** a pure module, `src/site/home/curate.ts`, with unit tests on made-up sites of 3, 40 and 500 pages. It reads the content index, never the pictures. In edit mode the picks for a 500-page site come back within about 150 ms, timed with `timed` like other server work ([performance](../engineering/performance.md)); the build runs it once.

## 10. Decisions

| # | Decision | Options | Recommendation |
|---|---|---|---|
| CU1 | Stored picks or computed picks | Store every pick; compute and store only decisions | Compute: a stored pick goes stale the day a better page is published |
| CU2 | Visitor counts as a signal | Yes; no | No: not readable by the build, not reproducible, and popularity isn't strength |
| CU3 | The `contribution` field | Add it, set as Your part; infer from the kind only | Add it, defaulted by the kind, so nobody has to set it |
| CU4 | A topic vocabulary | `content/topics.json` with synonyms; keep free-form topics | The vocabulary, made from the topics in use |
| CU5 | Stale pages | Rank lower; exclude | Rank lower, and list them in the health report |
| CU6 | Automatic voices | Never; suggest only | Never chosen by a rule; suggested in the health report |
| CU7 | A strength with no proof | Hide it from visitors; show it with Ask me about it | Hide it: a claim with nothing behind it hurts more than a gap |

## 11. As built

Stage 1 of the [plan](plan.md) built the rules as specified above, in `src/site/home/` (`evidence.ts`, `curate.ts`, `health.ts`, `check.ts`), with these differences and details:

- **`curation.leaveOut` is an object:** `{ "sections": [], "topics": [], "kinds": [] }`, so each list is checked against its own IDs.
- **Not proof:** the résumé, contact and privacy pages never enter the evidence index as pages. The résumé proves through pinned résumé lines instead.
- **A page's date** is `publishedAt`, else `updatedAt`.
- **Held picks** (`held`, written when Hold automatic changes is turned on) keep each strength's pages and the highlights as `{ ref, capability }` pairs.
- **Headlines follow the person's order whatever the lens:** a lens reorders the strengths and swaps the lead voice, but never moves a proof from one strength to another.
- **Cost:** a made-up site of 500 pages curates in well under 150 ms in the unit tests; the owner's 17 pages take about 33 ms cold and under 2 ms warm.
