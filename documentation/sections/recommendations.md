# Recommendations: what people say about working with you

A section can show recommendations: short testimonials from people the site's owner has worked with, each with the person's name, their title and a link to their profile. The About section is where they belong first, but any section can carry them. This page is the spec: the benchmark, the design, the model and its Definition of Done.

> **TL;DR.**
> - **One list of recommendations** for the site (`content/recommendations.json`): each is a person's name, their title, a link (LinkedIn or their own site), the words, and optionally their photo, how they know you and when. Any one can be hidden without deleting it; their order is the list's.
> - **Their photo:** uploaded in edit mode, or, without one, taken once from their LinkedIn profile when it's public and kept as the site's own picture. Without either, their initials.
> - **A section shows them when it's turned on,** where its settings say: before its pages, after them, or after a chosen page. Off by default.
> - **Four layouts:** tiles (an even grid, every tile the same height with its parts level across the tiles), rows (one under another), wall (columns of cards of their own heights) and spotlight (one large, the others as tiles).
> - **Long words don't need pages:** each card shows the start, and "Read in full" opens the whole recommendation in a dialog; rows and the wall can expand in place instead ("Show it all"). Tiles always use the dialog, so the grid never breaks.
> - **Edit mode's Recommendations screen** adds, edits, hides, orders and deletes them, and sets where and how a section shows them.

## 1. Benchmark

| Product | How it shows testimonials | What we take |
|---|---|---|
| LinkedIn profile | Recommendations as rows: photo, name, headline, the relationship ("managed Prabin directly") and the date, the words cut after a few lines with "…see more" expanding in place | The fields (name, title, relationship, date) and the expanding row |
| Squarespace and Wix testimonial sections | A grid, a carousel or a single large quote; a "read more" link to a page or a lightbox | Several layouts from one list; a dialog rather than a page |
| Webflow and Framer templates | Masonry walls of quotes for many testimonials, a featured quote above smaller ones | The wall (cards keep their own height, so expanding one moves only its column) and the spotlight |
| Senja, Testimonial.to (embeds) | Wall of love, carousel, list; avatars with initials when there's no photo; a link to the source | Initials when there's no photo; the link to the person's profile |
| Material and Apple guidance on cards | A clamped excerpt must say it continues and offer the rest | A clamped card always has its control, and one that isn't clamped has none |

Expanding in place in an even grid makes one card taller than its row (the rest of the row grows or misaligns), so tiles and spotlight's tiles use the dialog only; rows and the wall can expand in place.

## 2. The model

### 2.1 The recommendations

`content/recommendations.json` (checked by the content contract):

```json
{
  "items": [
    {
      "id": "ada-lovelace",
      "name": "Ada Lovelace",
      "title": "Principal Engineer, Analytical Engines",
      "link": "https://www.linkedin.com/in/example/",
      "relationship": "Worked with Prabin on the same team",
      "date": "2025-03",
      "text": "First paragraph.\n\nSecond paragraph."
    }
  ]
}
```

| Field | Rule |
|---|---|
| `id` | Lowercase words with hyphens, unique, never changes (made from the name when added) |
| `name` | Required, at most 80 characters |
| `title` | Required: their role and where, as they'd write it, at most 120 characters |
| `link` | Optional: an `https` address (their LinkedIn profile or their own site). The card names it: "LinkedIn profile" for `linkedin.com`, else the site's name |
| `relationship` | Optional, at most 120 characters ("Managed me at Microsoft") |
| `date` | Optional: the month it was written, `YYYY-MM` |
| `text` | Required: plain words, paragraphs separated by a blank line, at most 3,000 characters |
| `photo` | Optional: their photo, a picture in `content/media/` (`shared/<id>-photo`, described by their name): uploaded, or taken from their LinkedIn profile (§4.1) |
| `noPhoto` | Optional: true shows their initials and never takes a photo from their profile |
| `hidden` | Optional: true keeps it out of the site without deleting it |

### 2.2 Where a section shows them

A section (a hub node in `content/structures/site.json`) carries its own settings:

```json
"recommendations": { "show": true, "at": "after", "after": "career", "layout": "wall", "open": "inline", "heading": "What people say", "intro": "From people I've worked with." }
```

| Field | Values |
|---|---|
| `show` | On or off; without the settings, off |
| `at` | `start` (before the section's pages), `end` (after them), `after` (after the page `after` names, which must be a page of this section) |
| `layout` | `tiles`, `rows`, `wall`, `spotlight` |
| `open` | `dialog` (Read in full) or `inline` (Show it all); tiles and spotlight always use the dialog |
| `heading` | Optional, at most 60 characters; default "Recommendations" |
| `intro` | Optional, one line under the heading, at most 160 characters |

The settings belong to the section, so moving or renaming the section keeps them (structure operations keep every field they don't change). A page that `after` names moving out of the section makes the content check say so (the screen asks for another place). On a page, an `after` page that isn't shown there (a draft in a build, a private page) puts the band after the pages.

## 3. On the page

- **A band of the section's page,** with its own heading (h2) and intro, in the section's column, between the section's intro and its pages (`start`), after its pages (`end`), or right after the chosen page, across the whole width of the section's list (`after`), whatever the section's view.
- **A card:** the words (an opening quote mark in the highlight colour, the text in the reading face), then the person: their photo in a circle (their initials without one), their name, their title, the relationship and date in muted small type, and their link ("LinkedIn profile, opens in a new tab").
- **Long words:** each layout shows a set number of lines (tiles 7, rows 5, wall 9, the spotlight's lead in full). The control appears only when the words are longer than that:
  - **Dialog** (Read in full): the site's dialog, titled with the person's name, with the whole recommendation and the person; Esc, the close button or a press outside closes it, and focus goes back to the button.
  - **Inline** (Show it all, then Show less): the card grows in place; the button says whether it's expanded (`aria-expanded`).
  - Without scripts, every card shows all its words.
- **Layouts:**
  - **Tiles:** an even grid, cards at least 18 rem wide, as many columns as fit. Every tile is the same height and its parts line up across the tiles: the quote mark, the words (each keeps its lines' room), the control's row (kept where there's nothing to open) and the person section, the same height in every tile. Each card spans four rows of the band's grid through `subgrid`; the person rows are the only flexible ones, and flexible rows in a grid of no set height all take the tallest's size.
  - **Rows:** one card under another in the reading measure, the words and then the person.
  - **Wall:** columns of cards that keep their own heights (CSS columns), about 18 rem each.
  - **Spotlight:** the first recommendation large (the words in the display face, a size up, in the reading measure), the rest as tiles under it, lined up as tiles are (the lead's rows are its own).
- **On the planet:** a building that shows the section shows its recommendations in the same place, in its frame.

## 4. Edit mode: Recommendations

`/_edit/recommendations/` (Content group in the navigation, after Media; the action center finds it by "testimonials", "references", "endorsements" too):

The screen is laid out as the other managers are (Sections, Access): a list on the left, beside the chosen item's details on the right (`?rec=<id>`, `?rec=new`, `?rec=place`). Choosing in the list draws the screen again without a reload; leaving unsaved changes asks first, and a redraw that arrives once typing has started is dropped, never landed over the typing.

- **The list:** Where they show (a line saying where: "About, after the pages, as a wall") above its rule; under it, Add recommendation, then every recommendation in order, with its photo (or initials), name and title ("Hidden" before the title when it's hidden).
- **Where they show:** the section (a select; About first if there is one), Show on this section (a switch), Where (Before the pages, After the pages, After a page with a select of the section's pages), Layout (four tiles in a row, each with a line saying what it is), Long recommendations (Open in a dialog, Expand in place: the second disabled for tiles and spotlight, with why), Heading, Intro, and Save where they show.
- **A recommendation:** its photo large, its name and title, Move up and Move down; then the form in three parts (Who: Name, Title, Profile link, How you know each other, Month written; Photo: an upload, Show their initials only; Their words: Recommendation, Hide from the site), Save recommendation and Delete (asks once: Delete for good, then the next one is chosen). Add recommendation is the same form, empty. A refused save says what to fix in the form.
- Every write goes through the store, at the version it was read at.
### 4.1 The photo

- **Uploaded:** saved after the recommendation, as a picture of the site's (`content/media/shared/`), described by the person's name; uploading another replaces it.
- **From LinkedIn:** with no photo, no Show their initials only, and a `linkedin.com/in/…` link, saving asks LinkedIn once for the profile's public page and takes the photo it shows to visitors who aren't signed in (its `og:image`, only from LinkedIn's media host `media.licdn.com`). The photo is downloaded and kept like an upload: LinkedIn's photo addresses expire, so the site never links to them, and visitors' browsers never contact LinkedIn. A profile that isn't public, has no photo or asks to sign in gives nothing: the status says why, and the card keeps the initials. Saving again tries again.
- **Initials only:** Show their initials only removes the photo from the card (the picture stays in Media) and stops the profile being asked.
- The editor's tests never reach LinkedIn: the fixture server turns it off (`SITE_EDITOR_PROFILE_PHOTOS=off`) and the unit tests read made-up pages.
- Taking a photo from a profile is the site owner's choice for each person; LinkedIn's terms limit automated access, so it's one request per person, made only when the owner saves.
- Every write goes through the store, at the version it was read at.

## 5. Accessibility

- The band is a section with a heading; each card is an `article` with the person's name as its label (`aria-labelledby`); the words are a `blockquote`.
- The quote mark is decorative (hidden from assistive tech).
- The dialog is the site's Dialog compound (native `dialog`, focus trapped and returned).
- Targets at least 44 px; no sideways scroll from 320 px; axe passes in light and dark.

## 6. Definition of Done

| # | Done when | Evidence |
|---|---|---|
| R1 | The contract checks the recommendations (fields, lengths, unique IDs, `https` links, `YYYY-MM` dates) and a section's settings (an `after` page of that section) | Unit `recommendations.test.ts` |
| R2 | A section with recommendations on shows the visible ones in order where its settings say (start, end, after a page) and in its layout; off, or hidden ones, nothing; a building on the planet the same | Editor E2E "editor: recommendations" (the fixture site) |
| R3 | Tiles, rows, wall and spotlight lay out as §3 says, with no sideways scroll at 320 px, in light and dark | Editor E2E (a phone width; axe) |
| R4 | Long words: the control shows only when clamped; Read in full opens the dialog (name, words, person; Esc and focus back); Show it all expands in place and says so; without scripts all words show | Editor E2E; unit (clamp lines per layout) |
| R5 | A card names the person, their title, the relationship and date when given, and links their profile in a new tab, labelled LinkedIn profile or the site's name | Unit (link label); editor E2E |
| R6 | Edit mode adds, edits, hides, reorders and deletes recommendations, and sets where and how a section shows them; refusals say what to fix | Editor E2E; unit (store operations) |
| R7 | The design system's rules hold (tokens only, a story, a doc comment, no raw values) and the docs are updated | Unit `siteDesignSystem.test.ts`; this page |
| R8 | Tiles are the same height, their words, controls and person sections level, the person sections the same height | Editor E2E (the tiles' anatomy, measured) |
| R9 | A photo can be uploaded; without one, a public LinkedIn profile's photo is taken once and kept; a refusal says why and keeps the initials; initials only stops it | Unit `editorRecommendations.test.ts` (the profile's page read offline); editor E2E (an upload) |

## 7. As built

- **Content:** `src/site/content/recommendations.ts` (pure: the rules, the band, the link's label, the photo rules), the contract in `schema.ts` (`recommendationsFile`, a hub's `recommendations`), the checks in `load.ts` (unique IDs, a photo that exists, an `after` page of the section). Pages build the band with `recommendationBand` and turn photos into pictures with `withPhotos` (`recommendationsBand.ts`), in `Page.astro` and `PlanetPage.astro`.
- **Site:** the `Recommendations` compound (its story in the design library), its script `scripts/recommendations.ts` (the clamp, Read in full, Show it all), the `c.recommendation` tokens. `IndexLayout` places the band (`start`, `end`, or a full-width `.band` after a page's card inside `[data-cards]`, so private cards still find their places) and one `#recommendation-dialog`; the bento's pattern counts only its cells (`:nth-child(… of .cell)`).
- **Edit mode:** `RecommendationsManager.astro`, `scripts/recommendations.ts`, `model/recommendations.ts`, `server/recommendations.ts` (the list, a section's settings, the photo), `PUT recommendations`, `PUT recommendations/section`, `POST recommendations/photo`. The status says Saved only once the redrawn screen is in, so nothing opened meanwhile is redrawn away.
- **Evidence:** unit `recommendations.test.ts`, `editorRecommendations.test.ts`, `siteDesignSystem.test.ts`; editor E2E `editor-recommendations.spec.ts` (4 tests: the screen, About's tiles with their anatomy, the dialog and axe in light and dark, the building on the planet, rows in place, after a page, a phone).

## 8. Later

- Choosing a photo from the media library (today: an upload or LinkedIn).
- A carousel layout.
- Showing the same recommendations in more than one section with a different selection each.
