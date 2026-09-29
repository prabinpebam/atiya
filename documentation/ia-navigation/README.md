# Portfolio information architecture and navigation

## Purpose

This package defines how the portfolio's content should be organized, named, connected, and navigated. It deliberately does not prescribe visual design, animation, framework, or implementation.

The central IA problem is not a lack of work. It is how to communicate a broad, senior practice without presenting visitors with a long list of disconnected skills.

## Recommended model

Use two complementary ways to explore the portfolio:

1. **Work is the evidence.** Case studies show outcomes, decisions, craft, and influence.
2. **Expertise explains the range.** Four practice areas give the work a memorable structure.

Leadership is also a primary navigation destination because it is central to the target positioning, not a secondary skill.

### Four practice areas

| Practice area | Promise | Includes |
|---|---|---|
| Product Experience | Turning ambiguous product problems into useful, usable experiences | UI design, UX design, end-to-end design, design sprints, design workshops |
| Systems & Technology | Making ideas scalable, testable, and real | Design systems, frontend engineering, functional prototypes, production-ready frontend, AI in design workflows |
| Motion & Spatial | Using time, space, and story as design materials | Motion design, motion graphics, animation, After Effects, 3D/Cinema 4D, cinematography, video editing |
| Strategy & Leadership | Expanding design's influence and building conditions for teams to succeed | Design strategy, defining design's frontier, design-led initiatives, leadership, hiring, team culture, leadership training |

These areas are lenses, not content containers. One case study can belong to several practice areas.

## Primary navigation

`Work` · `Expertise` · `Leadership` · `About`

Recommended utilities:

- `Notes`, once there is a sustainable body of writing
- `Now`, once it can be maintained
- Search, only after content volume makes it useful
- Resume and contact as visible actions, not equal-weight primary sections

## Decision summary

- Do not create a primary navigation item for every skill.
- Do not separate design, code, AI, and leadership into isolated portfolios.
- Do not organize the main experience by software names such as After Effects or Cinema 4D.
- Do use curated case studies as the main proof of capability.
- Do expose skills and methods as contextual metadata and links.
- Do provide a conventional navigation path even when an experimental or 3D interface is available.

## Documents

1. [Goals, audiences, and journeys](./01-goals-audiences-and-journeys.md)
2. [Sitemap](./02-sitemap.md)
3. [Taxonomy and content model](./03-taxonomy-and-content-model.md)
4. [Navigation specification](./04-navigation-specification.md)
5. [Page and content templates](./05-page-and-content-templates.md)
6. [Content inventory and mapping](./06-content-inventory-and-mapping.md)
7. [Editorial and governance rules](./07-editorial-and-governance.md)
8. [Validation plan](./08-validation-plan.md)

## Implementation

The [content platform](../content/spec.md) implements this package as data: the [content model](../content/model.md) encodes its content types, vocabularies and lifecycle, and [IA, routes and navigation](../content/ia.md) derives the sitemap, menus and navigation rules from content.

## Recommended sequence

1. Inventory candidate projects using the worksheet in the content inventory.
2. Select three to five case studies with complementary evidence.
3. Draft case-study summaries before long-form narratives.
4. Test labels and findability with representative visitors.
5. Only then decide how the interactive presentation layer expresses this structure.
