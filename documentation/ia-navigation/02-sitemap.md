# Sitemap

## Canonical sitemap

```text
/
├── work/
│   ├── [case-study-slug]/
│   └── archive/                         optional, after enough work exists
├── expertise/
│   ├── product-experience/
│   ├── systems-and-technology/
│   ├── motion-and-spatial/
│   └── strategy-and-leadership/
├── leadership/
│   ├── operating-principles/
│   ├── hiring-and-team-building/
│   ├── culture-and-capability/
│   └── [leadership-case-slug]/          only when the story merits a deep page
├── about/
├── notes/                               later phase
│   ├── [note-slug]/
│   └── topics/[topic-slug]/             only when topic volume warrants it
├── now/                                 later phase
├── colophon/                            later phase
├── resume/                              HTML page; downloadable file is secondary
├── contact/
├── privacy/                             if analytics, forms, or tracking require it
└── 404/
```

## Level-one pages

| Page | Job to be done | Primary content |
|---|---|---|
| Home | Establish positioning and route visitors quickly | Positioning, featured outcomes, selected work, four practice areas, leadership signal |
| Work | Provide the strongest evidence of impact | Curated case-study cards, optional filters, archive link |
| Expertise | Explain the range as a coherent practice | Four practice areas and their relationships |
| Leadership | Show how teams, culture, and design influence are built | Operating principles, leadership evidence, team-building topics |
| About | Establish credibility and personal context | Short biography, career arc, values, current focus, selected credentials |

## Relationship between Expertise and Leadership

`Strategy & Leadership` under Expertise explains the capability and its relationship to the broader practice. The primary `Leadership` page provides deeper evidence about how leadership is exercised.

To avoid duplication:

- Expertise answers **"What can this person do and how does it connect?"**
- Leadership answers **"How does this person lead, at what scale, and with what effects?"**
- Work answers **"Where is the proof?"**

## Work index behavior

Default ordering should be editorial, not chronological. Lead with the strongest combination of:

- measurable or clearly stated outcome;
- senior-level responsibility;
- interesting constraints and trade-offs;
- complementary coverage across practice areas;
- material that can be shared publicly.

Filters are optional and should not appear until there are at least eight meaningful entries. Before then, use a small curated collection and descriptive metadata.

Recommended future filters:

- Practice area
- Contribution: Led, Directed, Designed, Built, Facilitated
- Outcome type: Product, System, Organization, Capability

Do not filter primarily by software or generic deliverable type.

## URL rules

- Use short, readable, lowercase URLs with hyphens.
- Use durable project or outcome names, not employer-confidential codenames.
- Keep case studies under `/work/` even when leadership is the main subject.
- Keep skill labels out of case-study URLs so taxonomy can evolve.
- Redirect renamed pages; do not silently break old links.

## Breadcrumb rules

Breadcrumbs are useful on case studies, notes, and nested leadership pages:

`Home / Work / Case study title`

Do not show breadcrumbs on top-level pages. Related practice areas should appear as contextual links, not as additional breadcrumb parents, because a case study can have more than one.
