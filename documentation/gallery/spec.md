# The gallery: albums

The Gallery section becomes a place to look: a scroll of albums, each shown by a cover of a few pictures set in a bento grid, with its title above and a few words below. An album is its own kind of thing, made and kept the way people already keep albums in Google Photos and Apple Photos: you make one, drop pictures and videos into it, they sort themselves by the day they were taken, you write what you want about each picture, and you choose its cover. Every album has its own page with everything in it, and pressing any picture, drawing or video opens the site's lightbox, with the whole album in its filmstrip and each item's words beside it. This page is the spec: the model, the media, the views, the lightbox, edit mode, and the rules and decisions behind them. The [plan](plan.md) splits it into phases with its Definition of Done.

> **TL;DR.**
> - **An album is its own resource,** not a page: `content/albums/<id>.json`, with a title, a short description, an introduction, its items and its cover. It has an address in a section, a status and an access like a page, through the platform, but no blocks, no kind and no article editor ([§3.1](#31-an-album-is-its-own-resource)).
> - **Items are pictures from the library,** in any format the site keeps (pictures, animated pictures, drawings, video files and YouTube or Vimeo links), and text cards between them. Removing one from an album never deletes it.
> - **The words belong to the picture:** its caption, description, alt text, date taken and place are kept with it, so a picture in two albums and an article says the same thing everywhere ([§3.4](#34-where-the-words-come-from)).
> - **Sorted by date by default:** an album shows its items oldest first by the day they were taken, so pictures dropped in from a trip fall into place. Newest first is a setting; dragging one item makes it the owner's own order.
> - **The Gallery section shows albums, not cards.** Its view, Albums, sets each album as a band: its title and counts, its cover in a bento grid, its short description and "See all 21", then a quiet break before the next. Albums come newest first, by their latest picture.
> - **The cover** is the album's few pictures up front, in a bento grid of 12 columns of square cells, every tile whole cells from 2 to 12 each way. Until the owner arranges it, it's the album's first items in a preset that suits their number; Edit cover arranges it tile by tile. On a phone it's redrawn on 6 columns by a fixed rule, unless he arranges that too.
> - **Edit mode gains an Albums screen and an album editor** shaped like a photo app's album: a grid of every album; inside one, the album as a reader sees it, a grid of its items to select, drag, open and describe, files dropped anywhere uploading in the background, and the cover arranged in place ([§9](#9-edit-mode)).
> - **Automatic first, override anywhere.** The order, the cover, its phone layout, each picture's focus point and date, a linked video's poster and details, and alt text suggested by the owner's AI service are all worked out; he overrides any of them where he wants, and Back to automatic removes the override ([§18](#18-automatic-and-where-to-override-it)).
> - **The album page** has the introduction, then every item in a justified grid (or, as Story, one after another with their words), each with its own address (`#item-<id>`). An album can also be shown inside any page, as an album block.
> - **The lightbox** keeps its smoke scrim and gains the whole album in the filmstrip, videos and YouTube or Vimeo on the stage, an info panel with the words, zoom, Copy link, downloads where allowed, and Back to close.

<details>
<summary>What was asked, and where it's answered</summary>

| # | The owner's request | Where | Phase |
|---|---|---|---|
| U1 | A gallery made of collections or albums | [§3](#3-the-model) | G1, A1 |
| U2 | The gallery's main view lists them in a visually rich way | [§5](#5-the-albums-view) | G2 |
| U3 | Each shown by its title, a bento grid of its media, and an optional short description | [§5](#5-the-albums-view), [§6](#6-the-bento-grid) | G2 |
| U4 | A visual break, then the next album, scrolling to explore | [§5](#5-the-albums-view) | G2 |
| U5 | Every type of media: images of every format, videos, SVG, YouTube, Vimeo | [§4](#4-media) | G1, G4, A1 |
| U6 | A caption for each item and for the album | [§3.4](#34-where-the-words-come-from) | A1 |
| U7 | An optional, more detailed description for each item, with simple rich text | [§3.5](#35-rich-text), [§8.3](#83-words-the-caption-and-the-info-panel) | A1, A3 |
| U8 | The same for the whole album | [§3.4](#34-where-the-words-come-from), [§7](#7-the-album-page) | A1 |
| U9 | Choose the items of each album by hand | [§9.4](#94-adding) | A2 |
| U10 | Choose which items are shown up front; the album holds more | [§3.6](#36-the-cover), [§9.6](#96-the-cover) | A4 |
| U11 | Rearrange their order | [§3.3](#33-order), [§9.3](#93-selecting-and-ordering), [§9.6](#96-the-cover) | A2, A4 |
| U12 | Adjust the bento layout, snapping to a column grid | [§6](#6-the-bento-grid), [§9.6](#96-the-cover) | G6, A4 |
| U13 | Snapping to multiples of the row height | [§6.1](#61-the-grid) | G6, A4 |
| U14 | Pressing an item opens the lightbox with the smoke scrim, with a filmstrip of the whole album | [§8](#8-the-lightbox) | G4 |
| U15 | An album is an album, made, organised, edited and kept the way Google Photos and Apple Photos do it, not an article adapted to hold pictures (22 October 2026) | [§3.1](#31-an-album-is-its-own-resource), [§9](#9-edit-mode), [§21](#21-from-the-first-build) | A1 to A6 |

</details>

## 1. Where things stand

- **The section.** Gallery is one of the first sections (its node ID is still `talks`, renamed on 13 October 2026; [sections spec §3.6](../sections/spec.md#36-the-first-sections)), at `/gallery/`, in the Albums view since G2, with no albums yet. The Amphitheater on the planet shows it.
- **The first build** (G1 to G10, 22 October 2026) made an album a page of kind Gallery with an `album` field, edited in the article editor's Items and Up front views. Its site side works: the band, the album page, the lightbox, zoom, the album block, private albums. Its model and its editing don't: the owner found that an article adapted to hold pictures is the wrong shape for them, and asked for albums made the way photo apps make them. This spec keeps what works and replaces the rest ([§21](#21-from-the-first-build)).
- **The lightbox** is one per page: a modal dialog with the smoke scrim (paper-white in light mode, black in dark), Previous and Next, a counter, the caption and a filmstrip. Since G4 it knows albums: the whole album as its group, every kind of item on the stage, the info panel, zoom, Copy link, downloads and Back.
- **Media.** Pictures are kept as WebP masters (lossless when they have transparency); GIFs are kept byte for byte and animated WebPs keep their frames, each with a still poster ([media §5](../content/media.md#5-the-pipeline)); an SVG can stay a drawing (G1). Video files are MP4 or WebM under 100 MB ([media §12](../content/media.md#12-video-files)). YouTube and Vimeo videos come in through the video block's `embed`, and since G1 as an album item's `embed`, with a poster of the site's own: they aren't in the library.
- **The old model.** The content model's Gallery resource ([model](../content/model.md#gallery)) was never built. This spec builds its successor, the album.

What's missing is an album that behaves like one: made in a moment, filled by dropping files in, sorted by itself, its words kept with its pictures, its cover chosen with one press, and edited on a screen of its own.

### 1.1 Why an album isn't a page

The first build made an album a page so it would inherit a page's address, status, access, cards and editor. It inherited the wrong things too:

| A page | An album |
|---|---|
| Words first: blocks of text, with pictures among them | Pictures first: a set of items, with words about each |
| Ten to fifty blocks, edited one at a time in an outline and a canvas | Tens to hundreds of items, chosen, sorted and moved many at a time |
| Its order is its argument, written by hand | Its order is usually time, worked out from the pictures |
| A kind, a hero, a reading time, a table of contents, body blocks | None of them; a cover and counts instead |
| Made by writing; saved as a draft for days | Made by dropping files in; used at once |
| Edited in the article editor, three panes wide | Edited like a photo app: a grid to select from, a viewer to describe in |

So an album is its own resource, with its own file, screen and editor. It still shares everything that isn't about its content with pages, through the platform rather than by being one: its address in a section, its status, its access, its card in lists, search, the planet and Save to remote ([§3.1](#31-an-album-is-its-own-resource)).

### 1.2 What this spec adds to the request

The request covers what a reader sees and what the owner curates. A complete feature also needs these, so the spec decides them:

| Gap | Decided in |
|---|---|
| A name that doesn't clash with the site's existing "collection" block | [D-G1](#17-decisions) |
| What an album is, where it lives and how it's private | [§3.1](#31-an-album-is-its-own-resource), [§12](#12-private-albums) |
| Which order an album is in until the owner says otherwise | [§3.3](#33-order) |
| Where an item's words live when one picture is in several albums | [§3.4](#34-where-the-words-come-from) |
| A stable address for every item, so it can be linked and shared | [§3.2](#32-the-album-file), [§8.6](#86-addresses-back-and-sharing) |
| Alt text for every item, without making uploading slow | [§9.5](#95-the-viewer-and-the-words), [§9.8](#98-suggested-alt-text) |
| Words between pictures | [§3.2](#32-the-album-file) (text cards) |
| A cover before the owner arranges one, and presets to start from | [§3.6](#36-the-cover), [§6.4](#64-presets-and-the-default) |
| What the bento does on a phone | [§6.3](#63-on-a-phone) |
| Which order wins: the album's or the cover's | [§6.2](#62-tiles), [D-G14](#17-decisions) |
| The order of albums in the gallery | [§5](#5-the-albums-view) |
| What removing, deleting and duplicates do to files | [§9.9](#99-the-library) |
| What moves on its own (GIFs, videos) and what never does | [§4.3](#43-motion) |
| SVG safety, and drawings in dark mode | [§4.1](#41-drawings-svg-kept-as-a-vector) |
| Formats that can't be kept, and what to tell the owner | [§4](#4-media) |
| Large albums: the filmstrip, warming and page weight | [§8.7](#87-loading), [§11](#11-performance-and-budgets) |
| Back closing the lightbox, and sharing one item | [§8.6](#86-addresses-back-and-sharing) |
| The keyboard and screen readers in the band, the lightbox and edit mode | [§10](#10-accessibility) |
| Private albums, the planet, telemetry and search | [§12](#12-private-albums) to [§14](#14-telemetry-search-and-sharing) |
| Keeping the owner's upkeep small: what's worked out, and where he can override it | [§18](#18-automatic-and-where-to-override-it) |
| Dates, places, zoom and downloads | [§3.4](#34-where-the-words-come-from), [§8.3](#83-words-the-caption-and-the-info-panel), [§8.8](#88-zoom) |
| An album shown inside another page | [§7.2](#72-an-album-inside-another-page) |
| The site's 1 GB limit on GitHub Pages | [§11](#11-performance-and-budgets) |

### 1.3 Benchmark

| Product | What it does | What we take |
|---|---|---|
| Google Photos albums | An album is made in a moment and filled from the library or by uploading; its photos sort Oldest first, Newest first or Recently added, or into the owner's order by dragging; text can be added between photos; any photo can be made the album's cover; removing a photo from an album leaves it in the library ([Google Photos Help](https://support.google.com/photos/answer/6128849)) | Albums as their own thing; sorted by date by default, the owner's order on drag; text cards; Set as cover; remove is never delete |
| Apple Photos albums | Albums sort in a custom order, oldest first or newest first; Make Key Photo sets the album's cover; deleting a photo from an album keeps it in the library ([iPhone User Guide](https://support.apple.com/guide/iphone/iph9463b0c24/ios)) | The same three orders; the cover chosen from inside the album; the library as the one home of a picture |
| Both apps' editing | A grid to select from (a check on each picture, ranges, select all), a bar of actions for the selection, a viewer to describe one picture, its info beside it | Selection and a bar of actions; the viewer with an info panel to write in |
| Flickr albums | An album has a cover, a title, a description and its count of photos and videos; the album page shows them all | The counts, the album's own words, the album page with everything |
| Behance projects | A project is a long scroll of media with words between them; its owner chooses its cover | A curated way in, and the full set behind it |
| Apple's product pages and bento-style profile sites | A mosaic of tiles in a few fixed sizes on a strict grid | Tiles in whole cells, a strict grid, no free placement |
| Lightbox libraries (Fancybox, PhotoSwipe) | Pictures, video files and YouTube or Vimeo in one viewer; a thumbnail strip; an address for each slide; Back closes | Mixed media on one stage, the strip, item addresses, Back |

What we leave out of the photo apps, for this version: shared and collaborative albums, albums that fill themselves from a search (live albums), folders of albums, a map and memories ([§19](#19-not-in-this-version)). The site is one person's, published; an album is something he chooses to show.

## 2. Terms

| Term | Means |
|---|---|
| **Album** | A set of items in an order, with a title, words and a cover: its own resource, `content/albums/<id>.json` ([§3.1](#31-an-album-is-its-own-resource)). Stored with the type `album` |
| **The library** | Every picture, drawing, video file and linked video the site keeps (`content/media/`): edit mode's Media screen. An album holds references to library items, never copies |
| **Item** | One entry in an album: a library item (a picture, a drawing, an animated picture, a video file or a linked video), or a text card |
| **Text card** | Words between an album's pictures, in its own order ([§3.2](#32-the-album-file)) |
| **Drawing** | An SVG kept as a vector ([§4.1](#41-drawings-svg-kept-as-a-vector)) |
| **Linked video** | A YouTube or Vimeo video kept in the library as a sidecar with a poster, played by the provider's player after a press ([§4.2](#42-videos-and-linked-videos)) |
| **Order** | How an album's items follow one another: oldest first or newest first by the date taken (worked out), or the owner's own ([§3.3](#33-order)) |
| **Cover** | The items an album shows in its band, and how they're arranged; its lead is the **cover picture**, the album's picture everywhere else ([§3.6](#36-the-cover)) |
| **Tile** | A cover item's place in the bento grid: a column, a row, a width and a height, in cells |
| **Cell** | One square of the grid. Every tile is a whole number of cells |
| **Band** | One album as the Albums view shows it: title, counts, the cover's bento grid, the short description and "See all" |
| **The Albums view** | The section view that sets a section's albums as bands, one after another ([§5](#5-the-albums-view)) |
| **The album page** | The album's own page, at its address, with every item ([§7](#7-the-album-page)) |
| **The Albums screen** | Edit mode's list of every album ([§9.1](#91-the-albums-screen)) |
| **The album editor** | Edit mode's screen for one album ([§9.2](#92-the-album-editor)) |
| **The viewer** | The album editor's large view of one item, with its words to edit beside it ([§9.5](#95-the-viewer-and-the-words)) |
| **Automatic** | An answer worked out from the album's content each time, never saved ([§18](#18-automatic-and-where-to-override-it)) |
| **Override** | The owner's own answer, stored where it applies, and removed by Back to automatic (or the name its place gives it) |
| **The album block** | A block that shows an album's band inside a page ([§7.2](#72-an-album-inside-another-page)) |

## 3. The model

### 3.1 An album is its own resource

An album is a file of its own, `content/albums/<id>.json` (a private one `private-pages/albums/<id>.json`, [§12](#12-private-albums)), with the type `album`. It isn't an article: it has no kind, no blocks, no hero, no reading time and no table of contents, and the article editor never opens it.

What it shares with pages comes from the platform, which learns a second type of item:
- **its place:** the site structure places it as an item node, `{ "id": "<node>", "kind": "item", "item": { "type": "album", "id": "<album ID>" } }`, in any section; normally the one whose view is Albums. Its address is its section's and its slug (`/gallery/summer-sketches/`). The site keeps its three levels (V22), every node ID is unique (V21), an album's ID never changes, and a moved album just gets its new address, with no redirect (sections spec D11);
- **its status:** draft or published. A draft is listed only in edit mode; publishing it puts it on the site ([§9.2](#92-the-album-editor));
- **its access:** open, or private by living in `private-pages/` ([§12](#12-private-albums)), shared by the same grants as a private page;
- **its card,** wherever the site lists things: another section's view, a page's Related, a home view, search. There it's a `StoryCard` with the album's cover picture, its title, its short description and its counts ("18 pictures, 2 videos") as its meta line;
- **its words in the platform's places:** the title and the short description as the page title, the description for search and social cards, and its topics for the home views;
- **saving:** through the store, with versions, the content check before anything is written, and Save to remote.

Its pictures are library items. An album refers to them, never copies them: a picture can be in several albums and an article at once, with one master, one alt text and one set of words ([§3.4](#34-where-the-words-come-from)).

### 3.2 The album file

```json
{
  "id": "summer-sketches",
  "type": "album",
  "slug": "summer-sketches",
  "title": "Summer sketches",
  "summary": "Pen and wash studies from a summer of drawing outdoors.",
  "description": "Drawn over **eight weeks**, mostly in the early morning.\n\nThe last few are digital.",
  "status": "published",
  "createdAt": "2026-10-22",
  "updatedAt": "2026-10-24",
  "publishedAt": "2026-10-24",
  "order": "custom",
  "items": [
    { "id": "harbour", "media": "albums/summer-sketches/harbour" },
    { "id": "market-walk", "media": "albums/summer-sketches/market-walk", "autoplay": true, "loop": true },
    { "id": "walks-note", "text": "The next few were drawn on the **same walk**, an hour apart." },
    { "id": "talk", "media": "albums/summer-sketches/talk" },
    { "id": "map", "media": "shared/walks-map" }
  ],
  "cover": {
    "tiles": [
      { "item": "harbour", "x": 0, "y": 0, "w": 6, "h": 4 },
      { "item": "talk", "x": 6, "y": 0, "w": 6, "h": 2, "focus": "50% 30%" },
      { "item": "map", "x": 6, "y": 2, "w": 6, "h": 2, "display": "fit" }
    ]
  }
}
```

- **`items`** is the album: every item, each a library item (`media`) or a text card (`text`). In the owner's own order (`order: "custom"`) it's the order shown; in a sorted order it's kept as items were added, and the order shown is worked out ([§3.3](#33-order)).
- **`talk`** is a linked video: a library item like any other, whose sidecar names its provider and ID ([§4.2](#42-videos-and-linked-videos)). An album item never holds a video's address itself.
- **`walks-note`** is a text card. Text cards need the owner's own order, since they sit between particular pictures ([§3.3](#33-order)).
- **`cover`** is left out until the owner touches the cover; then it holds only what he chose ([§3.6](#36-the-cover)).
- **The album's settings** (`layout`, `captions`, `dates`, `download`, `large`) and `order` are left out while they're the defaults, so an album that's never been told otherwise follows every default.

| Field | Rule |
|---|---|
| `id` | Lowercase letters, digits and hyphens, at most 64 characters, unique among albums and articles (so a reference names one thing). Made from the title when the album is created, and never changed |
| `type` | `album` |
| `slug` | The last part of its address; made from the title, changed in its settings |
| `title` | Plain text, at most 120 characters. A new album is "Untitled album" until it's named; publishing needs a name of its own |
| `summary` | Optional while a draft: the album's short description, one plain sentence or two, within the site's summary limit. Shown below its band, as its page's standfirst and on its cards. Publishing needs one, or uses the first sentence of `description` when there's one (automatic, [§18](#18-automatic-and-where-to-override-it)) |
| `description` | Optional: the album's introduction on its page, the rich-text subset ([§3.5](#35-rich-text)), at most 6 paragraphs or lists and 1,500 characters |
| `status` | `draft` or `published`. An album has no review stages |
| `createdAt`, `updatedAt`, `publishedAt` | Days, `YYYY-MM-DD`: when it was made, last saved, first published |
| `topics` | Optional: the site's topics, as a page's are, for the home views and related reading |
| `order` | Optional: `oldest` (the default, left out), `newest` or `custom` ([§3.3](#33-order)) |
| `items` | 1 to 200 library items when published, and at most 50 text cards; a draft may have none (V38) |
| Item `id` | Lowercase letters, digits and hyphens, at most 64 characters, unique in the album. Made from the file's name (or `text-1`, `text-2` for a text card) when it's added, and never changed: it's the item's address (`#item-<id>`) |
| Item `media` | A library item's ID: a picture, an animated picture, a drawing, a video file or a linked video. Exactly one of `media` and `text`. Each library item at most once in an album |
| Item `text` | A text card: the rich-text subset, at most 4 paragraphs or lists and 1,000 characters (V41) |
| Item `download` | Optional `true` or `false`, overriding the album's `download` for this item; never on a linked video or a text card |
| Item `autoplay`, `loop` | A video file only, as in the video block: plays muted while in view on the album page, never under reduced motion |
| `cover` | Optional: `lead`, or `tiles` (and `phone`), never both ([§3.6](#36-the-cover)) |
| `layout` | Optional: `grid` (the default: the justified grid) or `story` (one item after another with its words, [§7.1](#71-story)) |
| `captions` | Optional: `true` shows each item's caption under it in the grid (left out: none) |
| `dates` | Optional: `false` hides the dates the pictures were taken (left out: shown where known) |
| `download` | Optional: `true` lets readers download the album's items from the lightbox (left out: no downloads, [§8.3](#83-words-the-caption-and-the-info-panel)) |
| `large` | Optional: `true` keeps pictures uploaded into this album at up to 3840 px instead of 2560 ([§4](#4-media)) |

### 3.3 Order

An album is in one of three orders, as in Google Photos and Apple Photos:

| Order | Shown | Stored |
|---|---|---|
| **Oldest first** (the default) | Items by the day they were taken, oldest first; items taken the same day in the order they were added | Nothing: `order` left out |
| **Newest first** | The same, newest first | `order: "newest"` |
| **Your order** | Exactly as `items` lists them | `order: "custom"` |

- **The date taken** is the picture's `taken` ([§3.4](#34-where-the-words-come-from)): read from the file at upload, changed by the owner in the viewer. An item with no date (a drawing, a screenshot, a linked video) keeps its place in the order added, after the dated ones. A video file's date is read from its file when it has one (`creation_time`).
- **Sorted orders are worked out,** by the pure `albumOrder` ([§15](#15-components-tokens-and-code)), for the album page, the lightbox and the default cover. A picture added later, or a date corrected, finds its place by itself.
- **Dragging switches to Your order.** Moving any item by hand (by drag, by keys or by Move to start) writes the order on screen into `items` with the moved item in its new place and sets `order: "custom"`. The status line says so ("Now in your own order"), and Undo puts the sorted order back. Choosing Oldest first or Newest first again sorts it, without forgetting `items`' order, which stays as it was until the next drag.
- **Text cards need Your order:** adding one to a sorted album switches it, saying so, so the card stays where it was put. In a sorted order there's nowhere stable for words between pictures. Choosing a sorted order for an album with text cards asks first ("Sorting moves your 2 text cards to the end. Sort anyway?").
- **The cover keeps its own order** ([§6.2](#62-tiles)): sorting or dragging the album never moves a tile.

### 3.4 Where the words come from

A picture's words belong to the picture, as they do in a photo app: written once, they follow it into every album and article. The sidecar gains `description` and `place` beside its existing `alt`, `caption`, `credit` and `taken` ([media §3](../content/media.md#3-the-metadata-sidecar)).

| Words | Kept in | Shown |
|---|---|---|
| The album's title | The album's `title` | The band's heading, the album page's H1, the lightbox's top bar, its cards |
| The album's short description | The album's `summary` | Below the band, the album page's standfirst, its cards and search results |
| The album's introduction | The album's `description` (rich text) | The album page, above the items |
| Words between pictures | A text card's `text` (rich text) | Between the items on the album page; never in the band or the lightbox |
| An item's alt text | The picture's sidecar (`alt`) | The tile's and the cell's link name, the stage's alt, the filmstrip's names |
| An item's caption | The picture's sidecar (`caption`), plain text, at most 200 characters | Under the stage in the lightbox, the info panel, under the cell when the album shows captions |
| An item's description | The picture's sidecar (`description`, new): rich text, at most 4 paragraphs or lists and 1,000 characters | The lightbox's info panel ([§8.3](#83-words-the-caption-and-the-info-panel)), the Story layout |
| Where it was made | The picture's sidecar (`place`, new): plain text, at most 80 characters, typed by the owner | The info panel, after the date |
| The date it was taken | The picture's sidecar (`taken`), read from the file when it's uploaded | The info panel ("Taken 12 March 2026"); the album page's opening as a span ("March to May 2026"); the sorted orders; hidden by the album's `dates: false` |
| Its credit and licence | The picture's sidecar | The info panel |
| A video's name | The video's sidecar (`title`): a file's own, a linked video's from its provider | The tile's link name ("Video: …"), the player's name |
| A poster's alt text | The poster's own sidecar | Not shown: the poster sits inside a link named by the video |

- **One set of words per picture.** A picture in two albums has one caption. In an article, a figure block's own `caption` still overrides the picture's for that figure, as it always has; an album has no such override ([D-G24](#17-decisions)). The viewer says where else a picture is used ("Also in Monsoon walks and an article") beside its words, so a change is never a surprise.
- **Every item should have alt text when it's published.** A picture in an album is the content, so it's described rather than marked decorative. Alt text is never required: uploading never waits for it ([§9.4](#94-adding)), a picture without it is marked Needs alt text, and the content check warns of a published album or article that shows one, but saves and publishes it (V54; the owner's decision, 27 October 2026). Edit mode gathers them for review, with suggestions when the owner has an AI service set up ([§9.8](#98-suggested-alt-text)).
- **Alt text and captions differ.** Alt text describes what's in the picture for someone who can't see it; the caption says something about it for everyone. Edit mode keeps them in separate fields with their own hints.
- **A place is never read from the file.** Location data stays stripped ([media §4](../content/media.md#4-formats-and-budgets)); a place is only what the owner types, so a picture taken at home never says where home is.

### 3.5 Rich text

Descriptions and text cards use the site's Markdown subset, the one an item's words already use (`itemWords`, `src/site/content/markdown.ts`):
- paragraphs, and bulleted or numbered lists nested up to 3 levels;
- strong, emphasis, strikethrough, inline code, links and line breaks;
- no headings, pictures, tables, quotes or HTML (HTML is escaped).

Links follow the site's rules: to the site's own pages and albums as `ref:` links, which survive a move, and elsewhere only to `https`, `http` or `mailto` addresses. A description is meant to be read in the info panel beside a picture, so it stays short: the limits (V41) are the line where it's become a story of its own, which belongs on a page.

Edit mode writes them with `RichField`, the kit's rich-text field (bold, italic, strikethrough, code, links and lists), so the owner never types Markdown.

### 3.6 The cover

The cover is the few items an album shows up front: in its band, in an album block, and, through its lead, on its cards. It's automatic until the owner touches it, and he can touch as little as he likes:

| The owner | Stored | The cover |
|---|---|---|
| Does nothing | Nothing | The album's first items in the order shown, in the preset that suits their number ([§6.4](#64-presets-and-the-default)) |
| Arranges it in **Edit cover** | `cover.tiles` (and `cover.phone` if he arranges the phone's) | Exactly his tiles, until he chooses Use automatic cover |

- **`cover.lead`** names an item that leads the automatic cover; it's dropped when the cover is arranged, and the content check refuses it on a text card. Edit mode no longer sets it (Set as cover was removed on 27 October 2026, the owner's review: within an album, Edit cover is the one way to change the cover); an album that has one keeps it until its cover is arranged.
- **`cover.tiles`** is the arranged cover: which items, where and how big, each tile as [§3.7](#37-tiles) says. An item with no tile is in the album but not in the cover.
- **`cover.phone.tiles`**, rarely there, is the owner's own arrangement for phones; without it, the phone's is worked out from the tiles ([§6.3](#63-on-a-phone)).
- **The cover picture** is the item in the lead tile. It's the album's picture on its cards, the planet's previews and social cards. A video or linked video gives its poster; a drawing can't be a social picture (V46), so the first raster picture in the cover stands in there.
- **Text cards** never have a tile: the cover is pictures.

### 3.7 Tiles

| Field | Rule |
|---|---|
| `cover.tiles` | 1 to 12 tiles, each naming a different item, inside the grid, never overlapping, at most 12 rows tall (V39) |
| `cover.phone.tiles` | Only with `tiles`: the owner's phone arrangement on 6 columns, naming exactly the tiles shown on phones (V47) |
| Tile `item` | An item's `id`, never a text card's |
| Tile `x`, `y` | Its first column (0 to 11) and first row (0 or more), in cells |
| Tile `w`, `h` | Its width and height in cells, 2 to 12 each, with `x + w` at most 12 and `y + h` at most 12 |
| Tile `display` | Optional: `fill` (the default for pictures, videos and linked videos) or `fit` (the default for drawings) |
| Tile `focus` | Optional, for a filled tile: its own focus point (`"30% 60%"`), used instead of the picture's ([§6.5](#65-how-a-tile-shows-its-item)) |
| Tile `bg` | Optional: the colour behind the tile's picture, a lowercase hex (`#1f2a44`), the same in both themes; without it, the picture's own edge colour ([§6.5](#65-how-a-tile-shows-its-item)) |
| Tile `play` | Optional `true`, for a video file or an animated picture at most 10 MB: it plays in the band, muted ([§4.3](#43-motion)); at most 2 tiles in a cover (V48) |
| Tile `onPhones` | Optional `false`: the tile isn't shown on phones ([§6.3](#63-on-a-phone)) |
| Phone tile | `item`, `x` (0 to 5), `y`, `w` (2 to 6), `h` (2 to 8), on 6 columns; it takes its `display`, `focus` and `play` from the item's wide tile |

### 3.8 The picture's sidecar

An album adds these to the sidecars of the library ([media §3](../content/media.md#3-the-metadata-sidecar)), so every use of a picture shares them:

| Sidecar field | Rule |
|---|---|
| `alt` | As today, but may wait: a picture uploaded without it is marked Needs alt text, allowed everywhere, and warned of in anything published (V54) |
| `caption` | As today: plain text, at most 200 characters |
| `description` | New, optional: rich text ([§3.5](#35-rich-text)), at most 4 paragraphs or lists and 1,000 characters |
| `place` | New, optional: plain text, at most 80 characters, typed by the owner |
| `taken` | The date it was taken (`2026-03-12`), read from the file's EXIF when it's uploaded ([§4](#4-media)); changed or cleared in the viewer. Now also on a video file's sidecar |
| `large` | `true` when it was kept at up to 3840 px instead of 2560 ([§4](#4-media)) |
| `fingerprint` | New: the SHA-256 of the file as it was uploaded, so the same file dropped in again is found ([§9.4](#94-adding)). Pictures made before it have none, and are never matched |

A linked video's sidecar is its own kind ([§4.2](#42-videos-and-linked-videos)).

## 4. Media

| Uploaded | Kept as | In the band | On the album page | In the lightbox |
|---|---|---|---|---|
| JPEG, PNG, WebP, AVIF, TIFF | A WebP master (lossless with transparency), at most 2560 px, or 3840 px when kept large | Its picture, sized for the tile | A cell of the justified grid | Full size, from a set of widths |
| BMP, ICO, HEIC and HEIF the browser can open | Turned into PNG by the browser, then as above (as today) | As above | As above | As above |
| HEIC or HEIF the browser can't open | Refused: "This browser can't open HEIC. Export it as JPEG, then add it." | | | |
| GIF | Kept byte for byte, with a still poster | Its still poster, with the Animated badge | Animated, lazily; the poster under reduced motion | Animated, with Pause; paused at first under reduced motion |
| Animated WebP | Kept with its frames, with a still poster | As a GIF | As a GIF | As a GIF |
| APNG | Kept as a still: only its first frame survives | A picture | A picture | A picture |
| SVG, kept as a drawing | The sanitized SVG ([§4.1](#41-drawings-svg-kept-as-a-vector)) | The drawing, whole on its own background | A cell, whole | The drawing, sharp at any size |
| SVG, turned into a picture | A WebP master rasterized at up to 2560 px (as today) | A picture | A picture | A picture |
| MP4, M4V, WebM | Kept as uploaded, under 100 MB, with a poster frame | Its poster, with the Play badge and its length | Its poster, or playing muted in view when `autoplay` is set | The player, with its controls and caption tracks |
| MOV | Saved as MP4 (as today) | As above | As above | As above |
| A YouTube or Vimeo address | A linked video in the library, with a poster of the site's own ([§4.2](#42-videos-and-linked-videos)) | Its poster, with the Play badge | Its poster | A facade, then the provider's player after a press |
| JPEG XL, camera RAW, PSD, MKV, AVI, WMV, 3GP | Refused, saying what to do ("Export it as JPEG or PNG", "Save it as MP4") | | | |
| Any other video site | Refused: "Only YouTube and Vimeo videos can be linked. Upload the file instead." | | | |

- **Nothing is asked at upload** ([D-G28](#17-decisions)): what a file becomes is worked out, and changed afterwards in the viewer where it can be.
- **APNG** is read by the image library as its first frame. Its thumbnail says so once it's saved: "Kept as a still picture. To keep it moving, save it as a GIF or an animated WebP and replace it."
- **Read at upload,** so the owner types less:
  - **the date taken:** the file's EXIF date (`DateTimeOriginal`, else `DateTime`) is kept as the sidecar's `taken` before the master is written without its metadata, as every master is. A HEIC the browser turns into PNG first has its date read in the browser and sent with it. A file with no date has none; nothing guesses one from the file's own times;
  - **the focus point:** the image library's attention measure (the region with the most detail, saturated colour and skin tones) finds where the picture's interest is, and it's kept as the sidecar's `focus`, the point the owner would otherwise set by hand. A picture already in the library keeps its own focus point (the centre if it has none): measuring it would move its crops on other pages,   so the viewer offers Find the focus instead ([§9.5](#95-the-viewer-and-the-words));
    - **a video file's date,** from its `creation_time` when it has one;
    - **its fingerprint** (the sidecar's `fingerprint`), so the same file isn't kept twice ([§9.4](#94-adding));
    - **its size and shape** (the sidecar's `facts`), as today.
  - **Large pictures.** A raster picture bigger than 2560 px can be kept at up to 3840 px, for a picture worth looking into closely (a detailed drawing, a panorama). It's the album's setting, **Upload large pictures at full detail** ([§9.2.1](#921-settings)), applied to every picture uploaded into it while it's on, so it's chosen once per album rather than per file. It adds a 3840 px size to the lightbox's stage and to zoom ([§8.8](#88-zoom)), and nothing to the band or the album page, which never need it. It can't be applied later to a file already saved smaller: Replace with the original instead. **Make it standard,** in the viewer, saves one picture again at 2560 px.
  - **Budgets** are [media §4](../content/media.md#4-formats-and-budgets)'s: a picture at most 2560 px (3840 px kept large); a video file or a GIF under 100 MB (longer videos are better on YouTube or Vimeo); a sealed video at most 10 MB (V27). The album editor's facts show the album's total weight as it grows.
- **Cropping:** a picture can be cropped as anywhere else ([editor spec §6](../editor/spec.md#6-media)); a GIF, an animated picture and a drawing can't, so the owner sets their focus point instead. A tile never needs a crop: it fills round the focus point ([§6.5](#65-how-a-tile-shows-its-item)).
- **Dark mode versions** work as everywhere ([media §10](../content/media.md#10-dark-mode-versions)): an item shows the version that matches the page, in the band, on the album page, in the filmstrip and on the stage.

### 4.1 Drawings: SVG kept as a vector

An SVG is kept without asking ([D-G28](#17-decisions)):
- **as a drawing,** when it's at most 200 KB and can be cleaned: it stays an SVG, sharp at every size, and is drawn with `<img>` (so its own scripts could never run, even if one got through);
- **as a picture,** rasterized to a WebP master as today, when it's over 200 KB or can't be cleaned, its thumbnail saying why.

The viewer's **Turn into a picture** rasterizes a drawing the owner would rather keep as a picture.

A drawing is cleaned before it's saved; an SVG that can't be cleaned is kept as a picture instead:
- **removed:** scripts, event-handler attributes, `foreignObject`, comments and metadata;
- **refused:** a reference to anything outside the file (an `href` or `xlink:href` that isn't a `#` fragment, a `url()` that isn't a fragment, a style `@import`), a `javascript:` address, embedded raster pictures over 200 KB in total;
- **required:** a `viewBox`, or a `width` and a `height` to make one from.

Its sidecar is an image's, with `file` ending `.svg`, and its `facts` (size and background) measured from the viewBox and the drawing's own background, if it has one. A dark version is a second drawing, `<name>.dark.svg`, cleaned the same way. A drawing without one is shown on a paper panel in dark mode (`--c-album-drawing-paper`), so dark lines on a transparent background never vanish into a dark page. A drawing is never a page's social image (V46): a card on another site needs a raster picture.

### 4.2 Videos and linked videos

A video is either a file the owner uploads or a **linked video**: a YouTube or Vimeo video, kept in the library as an item of its own, so it's added to albums, described and chosen like any picture ([D-G25](#17-decisions)).

- **A linked video's sidecar** is its own kind (`kind: "embed"`; edit mode calls it a linked video): its `provider` and `id`, its `title`, its `shape` (the width to height of its player), its `duration` in seconds when the provider gives it, and its `poster`, a WebP beside it (`<name>.poster.webp`), with the words every library item has (`caption`, `description`, `place`, `taken` when the owner sets one, `alt` for the poster). It's made by pasting the address ([§9.4](#94-adding)), and the same address pasted again finds it.
- **Names.** A video is named by its title everywhere: the tile and the cell are links named "Video: title" (with its length when known), and the player carries the title.
- **Captions.** A video file with speech needs caption tracks ([media §3](../content/media.md#3-the-metadata-sidecar)'s `captions`, WebVTT beside the master), passed to the player on the album page and in the lightbox. The content check warns about a video file without them (V40). A linked video's captions are the provider's.
- **Posters.** A linked video's poster is a picture of the site's own, never the provider's thumbnail address: the site's Content Security Policy allows pictures only from itself, and a reader's browser shouldn't call the provider before they press Play. Edit mode takes the provider's thumbnail once, when the address is pasted, and keeps it; the viewer's Change poster replaces it.
- **Privacy.** Linked videos play from `youtube-nocookie.com` and with Vimeo's do-not-track option, as the video block does; the iframe is made only after a press and sends only the site's origin as its referrer.
- **Providers are one list** in code (`src/site/content/providers.ts`, built in G1): each provider's address patterns, its ID's shape, its player's and its page's addresses, its oEmbed endpoint and its hosts for the policy, read by the video block, edit mode and the Content Security Policy. Adding a provider is one entry and its tests. A video from anywhere else goes in as a file the owner uploads.

### 4.3 Motion

| Where | Animated pictures | Video files | Linked videos |
|---|---|---|---|
| The band | Still poster, with the Animated badge; playing when its tile is set to Play in the band | Poster, with the Play badge; playing muted when its tile is set to Play in the band | Poster, with the Play badge, always |
| The album page | Play, lazily, as in an article; the poster under reduced motion | Poster; with `autoplay`, muted while in view, never under reduced motion | Poster |
| The lightbox | Play, with a Pause button; paused at first under reduced motion | Plays when opened with a press; paused when reached by moving | A facade; the player after a press |

The band is still by default: a section of albums shows many items at once, and many moving things at once are heavy to load and hard to read past (WCAG 2.2.2). The site's interface never moves on its own ([visual language §6](../site-ui/visual-language.md#6-motion)); a moving picture is content the owner chose, as a video block's `autoplay` is ([media §12](../content/media.md#12-video-files)). So the owner can set a tile to **Play in the band** (`play`), within limits:
- **only a video file or an animated picture,** at most 10 MB; never a linked video, whose player would call the provider before the reader asked;
- **at most 2 tiles in a band** (V48);
- **muted and looping,** only while at least half of the tile is in view, and loaded only when it first comes near the screen (its poster until then);
- **never under reduced motion,** and never when the reader's browser asks to save data: the poster stays;
- **a Pause button for the band,** beside its counts, pausing every playing tile in it; the choice is kept for the visit. It's a button of its own, never inside a tile's link.

Anything that moves for more than five seconds can be paused where it plays.

## 5. The Albums view

A new section view, **Albums**, sets a section's albums one after another, each as a band. The Gallery section switches to it.

<figure class="slate-figure" data-diagram="gallery-band">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" role="img" aria-labelledby="ga-band__title ga-band__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ga-band__title">The Albums view: one band per album</title>
<desc id="ga-band__desc">On a wide screen, an album's band has its title and counts, then its bento on a 12-column grid of square cells: a lead picture six columns wide and four rows tall, two smaller pictures beside it, one an animated picture shown as a still poster, a wide video below them shown as its poster with a badge, and a row of a picture, a YouTube video and a drawing kept whole. Below the bento are the short description and a See all link, then a quiet break before the next album. On a phone, the same tiles follow in reading order on a 6-column grid worked out from the wide one, unless the owner arranged it: wide tiles become full width, the others pair up in halves, and the last one, left alone, widens to full width.</desc>
<text x="40" y="40" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Wide screen, 1280 px</text>
<text x="740" y="40" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Phone, 360 px</text>
<g id="ga-band__wide" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ga-band__body-1" x="40" y="56" width="660" height="580" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="64" y="92" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-band__body-1" data-slate-fit-padding="16">Album title</text>
<text x="64" y="114" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-1" data-slate-fit-padding="16">18 pictures · 2 videos · 1 drawing</text>
</g>
<g id="ga-band__lead" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ga-band__body-2" x="64" y="132" width="302" height="200" rx="12" fill="var(--color-brand-bg)" />
<text x="80" y="164" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ga-band__body-2" data-slate-fit-padding="16">Lead picture</text>
<text x="80" y="186" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-band__body-2" data-slate-fit-padding="16">6 × 4 cells, filled round its focus</text>
</g>
<g id="ga-band__tiles" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ga-band__body-3" x="370" y="132" width="149" height="98" rx="12" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="384" y="156" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-3" data-slate-fit-padding="16">Picture, 3 × 2</text>
<rect id="ga-band__body-4" x="523" y="132" width="149" height="98" rx="12" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="537" y="156" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-4" data-slate-fit-padding="16">Animated: poster</text>
<rect id="ga-band__body-5" x="370" y="234" width="302" height="98" rx="12" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="384" y="258" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-5" data-slate-fit-padding="16">Video: still poster and a Play badge</text>
<rect id="ga-band__body-6" x="64" y="336" width="200" height="98" rx="12" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="78" y="360" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-6" data-slate-fit-padding="16">Picture, 4 × 2</text>
<rect id="ga-band__body-7" x="268" y="336" width="200" height="98" rx="12" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="282" y="360" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-7" data-slate-fit-padding="16">YouTube: poster, badge</text>
<rect id="ga-band__body-8" x="472" y="336" width="200" height="98" rx="12" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="486" y="360" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-8" data-slate-fit-padding="16">Drawing, fitted whole</text>
</g>
<g id="ga-band__words" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<text x="64" y="466" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-1" data-slate-fit-padding="16">The short description: the album's summary, a line or two.</text>
<rect id="ga-band__body-9" x="64" y="484" width="120" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="80" y="507" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ga-band__body-9" data-slate-fit-padding="16">See all 21</text>
</g>
<g id="ga-band__break" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<text x="300" y="560" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-band__body-1" data-slate-fit-padding="16">A quiet break between albums</text>
<rect id="ga-band__body-10" x="64" y="580" width="612" height="40" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="80" y="606" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-band__body-10" data-slate-fit-padding="16">The next album</text>
</g>
<g id="ga-band__phone" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="ga-band__body-11" x="740" y="56" width="220" height="580" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="754" y="86" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-band__body-11" data-slate-fit-padding="16">Album title</text>
<text x="754" y="106" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-11" data-slate-fit-padding="16">18 pictures · 2 videos</text>
<text x="754" y="122" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-band__body-11" data-slate-fit-padding="16">1 drawing</text>
<rect id="ga-band__body-12" x="754" y="128" width="188" height="124" rx="10" fill="var(--color-brand-bg)" />
<text x="766" y="154" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-band__body-12" data-slate-fit-padding="16">Lead, 6 × 4</text>
<rect id="ga-band__body-13" x="754" y="256" width="92" height="60" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="764" y="278" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-band__body-13" data-slate-fit-padding="16">Picture</text>
<rect id="ga-band__body-14" x="850" y="256" width="92" height="60" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="860" y="278" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-band__body-14" data-slate-fit-padding="16">Animated</text>
<rect id="ga-band__body-15" x="754" y="320" width="188" height="60" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="764" y="342" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-band__body-15" data-slate-fit-padding="16">Video, full width</text>
<rect id="ga-band__body-16" x="754" y="384" width="92" height="60" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="764" y="406" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-band__body-16" data-slate-fit-padding="16">Picture</text>
<rect id="ga-band__body-17" x="850" y="384" width="92" height="60" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="860" y="406" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-band__body-17" data-slate-fit-padding="16">YouTube</text>
<rect id="ga-band__body-18" x="754" y="448" width="188" height="124" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="764" y="470" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-band__body-18" data-slate-fit-padding="16">Drawing, alone: widened</text>
<text x="754" y="604" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ga-band__body-11" data-slate-fit-padding="16">See all 21</text>
</g>
<text x="40" y="668" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Square cells: 12 columns wide, 6 on a phone (worked out, or arranged by hand). Still, unless a tile is set to play.</text>
</svg>
<figcaption>One album's band in the Albums view: the title and its counts, the cover's bento grid, the short description and the way into the album, then a quiet break before the next. On a phone the same tiles are redrawn on 6 columns.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The band, as a table</summary>

| Part | What it is | Rule |
|---|---|---|
| Title | The album's title as an H2, a link to the album page | Set in the section's heading style |
| Counts | "18 pictures, 2 videos, 1 drawing" | Pictures include animated pictures; videos include linked videos; only the kinds it has |
| Bento grid | The album's cover, as tiles of whole cells | 12 columns wide; 6 on a phone |
| Lead tile | A picture across 6 columns and 4 rows | Any tile can be any size from 2 by 2 to 12 by 12 |
| Video and linked video tiles | Their posters, with the Play badge and length | A video file set to Play in the band plays muted while in view; a linked video never plays here |
| Animated tile | Its still poster, with the Animated badge | Plays in the album and the lightbox, and in the band when set to |
| Drawing tile | The drawing, whole on its own background | Fit by default |
| Pause | A button beside the counts | Only in a band with a tile that plays |
| Short description | The album's summary | One or two sentences |
| See all 21 | A link to the album page | "Open the album" when every item is in the cover |
| The break | The divider's dinkus and space | Between albums, never after the last |

</details>

Each band is an `<article>` labelled by its heading:
1. **The heading:** the album's title, an H2 that links to the album page, with the counts beside it (below it on a phone). In a band where a tile plays, a **Pause** button follows the counts ([§4.3](#43-motion)).
2. **The bento grid** ([§6](#6-the-bento-grid)): the album's cover ([§3.6](#36-the-cover)), a list of tiles, each one link. A tile opens the lightbox at its item; without scripts, or with a modifier key, it goes to the album page at the item (`/gallery/<slug>/#item-<id>`).
3. **The short description:** the album's `summary`, set as a standfirst.
4. **"See all 21":** a link to the album page, named "See all 21 in Summer sketches". When every item is in the cover it reads "Open the album".
5. **The break:** the divider's dinkus with the section's space above and below (`c.album.band-space`), so each album reads as its own thing.

- **Order: newest first.** A gallery stays current by itself: albums are shown newest first, by the latest day any of their items was taken, else the day the album was made ([D-G30](#17-decisions)). The section's `albumOrder` changes it: `oldest` turns it round, and `custom` follows the section's order in the structure, which the owner sets by dragging on the Albums screen ([§9.1](#91-the-albums-screen)) or in Sections. Left out, it's newest first. Worked out by the pure `albumsOrder`, at build time.
- **Other things in the section.** An article in the same section follows the albums, as feature cards (`StoryCard` `feature`), so nothing in a section is ever hidden by its view; in Your order it keeps its place in the structure.
- **The first band loads first:** its pictures are eager and its largest tile has a high fetch priority; every later band's pictures are lazy ([§11](#11-performance-and-budgets)).
- **The section's words.** The section's heading and summary open the page as in every view; its recommendations, if it has them, keep their places ([recommendations](../sections/recommendations.md)).
- **Empty.** A section with no albums shows the empty state of [sections spec §3.4](../sections/spec.md#34-the-section-view-u6); a draft album is never shown.
- **Private albums** take their places in the order, sealed ([§12](#12-private-albums)).

## 6. The bento grid

### 6.1 The grid

- **Twelve columns of square cells.** The band is a CSS grid on a container: 12 equal columns with the gap `c.album.gap` between them, and rows exactly as tall as a column is wide (`grid-auto-rows` is one column's width, worked out from the container's inline size). So a cell is square at every width, and a tile's shape (6 by 4 is always 3:2) is the same on every screen.
- **Snapping.** A tile's edges are on cell lines: its width is a whole number of columns and its height a whole number of rows. Nothing is placed or sized between them, in the data or in the arranger. This is the snapping the owner asked for: columns on a 12-column grid, heights in multiples of the row height.
- **Sizes.** A tile is 2 to 12 cells wide and 2 to 12 cells tall. Two cells is the smallest that stays a 44 px target at the narrowest width the 12-column grid is used ([§6.3](#63-on-a-phone)).
- **Height.** The band is at most 12 rows tall (V39), and edit mode warns past 8 (V40): about a screen's height at the page's wide width.
- **Width.** The band takes the page's wide width, the same as a wide figure, so it lines up with the rest of the site's pictures.
- **Holes.** A cell no tile covers is allowed, so the owner can leave air on purpose. Edit mode shows it hatched and warns (V40) without refusing it.
- **Overlaps are refused,** and so is a tile outside the grid (V39).

### 6.2 Tiles

- **Order.** The band's reading order is its tiles sorted by row, then column: top to bottom, left to right. That's also their order in the page, so focus and a screen reader follow what a sighted reader sees (WCAG 1.3.2 and 2.4.3).
- **Two orders, kept apart.** The band's order is the cover's layout; the album's order ([§3.3](#33-order)) is the album's story. Moving a tile never reorders the album, and sorting or reordering the album never moves an arranged tile. The lightbox and the counter follow the album's order, so a tile in the band's first place can be "15 of 21" ([D-G14](#17-decisions)).
- **Placement.** Each tile carries its place as local custom properties on its element (`--x`, `--y`, `--w`, `--h`, and the phone's four), read by the band's stylesheet as `grid-column` and `grid-row`. The page's Content Security Policy allows inline styles, and nothing else about a tile is set inline.
- **Badges.** A video or linked video tile shows the Play badge and its length; an animated picture the Animated badge. Badges come from the icon set, on the image shade the video block already uses for its length, and their words are part of the link's name.
- **Look.** Tiles have the site's picture corners and no shadow; the band's grid is their only frame.

### 6.3 On a phone

Below the band's own compose width (`c.album.query-compose`, about 40 rem of container), the band is redrawn on **6 columns** by a fixed rule, so the owner arranges once:

1. **Width.** A tile 6 or more columns wide becomes full width (6); every other tile becomes half (3).
2. **Height.** Its shape is kept as well as cells allow: the new height is its new width times its old height over its old width, rounded, at least 2 and at most 8.
3. **Pairs.** Halves are paired in reading order, side by side; a pair takes the taller of its two heights, and each fills it round its focus point.
4. **A lone half** (no half next to it in reading order) widens to full, its height doubled, at most 8.
5. **Placement.** Rows follow reading order, so the phone shows the band top to bottom in the order a wide screen reads it.

The rule is the pure `phoneTiles` ([§15](#15-components-tokens-and-code)), worked out at build time; each tile carries both places, so the switch is a container query, with no script. The 6 columns use the same square cells and gap, so a half tile on a 360 px screen is about 160 px wide.

**Hidden on phones.** A tile set to Hide on phones (`onPhones: false`) is left out of the phone's band, and the rule runs over the tiles that remain: a wide band can carry a detail a phone has no room for. At least one tile stays (V47). The hidden item is still in the album, the album page and the lightbox's filmstrip.

**Arranged by hand.** When the rule's answer isn't right for a band, the owner arranges the phone's band himself in Edit cover's Phone view ([§9.6](#96-the-cover)); it's kept as `cover.phone.tiles`, on the same 6 columns, the same square cells and the same snapping (2 to 6 columns wide, 2 to 8 rows tall, never overlapping), and it names exactly the tiles shown on phones (V47). Edit mode warns past 24 rows. It keeps up with the wide band without being redone:
- **a tile taken out of the cover** leaves the phone's band too;
- **a tile added to the cover** joins the phone's band at its end, placed by the rule, and Edit cover notes it ("1 new tile added at the end on phones");
- **a tile moved or resized on the wide band** stays where the owner put it on the phone;
- **Back to automatic** removes `cover.phone`, and the rule draws the phone's band again.

### 6.4 Presets and the default

A preset places the items in the cover, in their current band order. It never changes which items are in the cover: a preset with fewer slots than tiles places the first ones and leaves the rest where they fit below.

| Preset | Arrangement | Best for |
|---|---|---|
| **Single** | One tile, 12 by 6 | One picture that carries the album |
| **Lead and two** | A lead 8 by 6, two tiles 4 by 3 stacked beside it | Three items with a clear lead |
| **Lead and four** | A lead 6 by 4, four tiles 3 by 2 beside it, two by two | Five items with a clear lead |
| **Pairs** | Rows of two tiles 6 by 4; a lone last one 12 by 6 | Equals |
| **Even rows** | Rows of three tiles 4 by 3; the last row's tiles share its width | Many equals |
| **Fit to pictures** | Rows 3 or 4 cells tall, each tile as wide as its picture's shape asks, rounded to whole columns, the last in a row taking what's left so every row ends at 12 | Pictures whose shapes matter (panoramas, portraits) |

Without `cover.tiles`, the band uses the **automatic cover**: the album's first items in the order shown ([§3.3](#33-order)), with `cover.lead` moved first when it's set, in the preset that fits their number. Text cards are skipped:

| Library items in the album | In the automatic cover |
|---|---|
| 5 or more | Lead and four, the first 5 |
| 4 | Pairs |
| 3 | Lead and two |
| 2 | Pairs |
| 1 | Single |

The automatic cover is worked out, not saved: adding items, sorting the album or setting a cover picture changes it by itself. To choose which items are in it, the owner arranges it in Edit cover; there's no separate list of them to keep. **Use automatic cover** removes `cover` (and with it any phone arrangement), so the band follows the album again.

### 6.5 How a tile shows its item

- **Fill** (the default for pictures, videos and linked videos): the tile is covered, cropped round the picture's focus point (its sidecar's `focus`, measured when it's uploaded and changed in the viewer, [§4](#4-media)). No crop file is made: the same master serves every tile shape.
- **A tile's own focus.** When one tile's shape cuts the picture badly round its focus (a tall tile of a wide group photo), the owner drags the focus for that tile alone (`focus`, [§9.6](#96-the-cover)); the picture's own focus, used on every other page, is untouched. Use its focus removes it. The phone's tile uses the same point.
- **Fit** (the default for drawings): the whole item, on its own background colour, taken from its edges (the picture's `bg`, as [media §9](../content/media.md#9-shapes-thumbnails-and-crops) does), so a fitted picture never sits on an unrelated colour.
- **Sizes.** A tile asks for the widths a slot of its size needs: its share of the wide width on a wide screen and of the screen on a phone, from the site's `sizes()` helper, never a rem literal.

## 7. The album page

The album's own page, at its address (`/gallery/summer-sketches/`), drawn by its own layout, `AlbumLayout`, made of the site's compounds (the crumbs, the page header, prose, `AlbumGrid`, the page's end):

1. **The opening:** the crumbs, the title (H1), the standfirst (`summary`), the counts and the date. The date is the span of the dates the items were taken ("12 to 20 March 2026", "March to May 2026", "2019 to 2024"), or the day it was published when none are known or the album's `dates` is `false`. No lead picture: the items are the pictures.
2. **The introduction:** `description`, set as prose at the text width.
3. **The items:** every item, in the order shown ([§3.3](#33-order)), laid out as the album's `layout` says: the **Grid** (the default), the gallery's justified grid ([media §9.2](../content/media.md#92-justified-galleries)) at the wide width, with no item cropped by more than a quarter to fit its row, or the **Story** ([§7.1](#71-story)). Each library item is a link:
   - its address is the item's (`id="item-<id>"`), so `#item-harbour` scrolls to it;
   - it's in the lightbox group `album`, and opens the lightbox at its item;
   - a video or a linked video shows its poster with the Play badge; an animated picture plays (the poster under reduced motion); a video with `autoplay` plays muted while in view;
   - its words for the lightbox (caption, description, credit, date and place) are in a `<template>` beside it, so they're in the page without being read out twice.
4. **Text cards** break the grid: the grid's rows end before one, the card is set as prose at the text width, and the grid starts again after it. Its address is the item's too.
5. **The page's end:** what to read next and Back to top, as on every page ([sections spec §3.7](../sections/spec.md#37-the-end-of-a-page-what-to-read-next-and-back-to-top)).

- **No captions under the cells,** by default: the grid is for looking, and the words are a press away. An album whose pictures need their words in view (a sequence of sketches with notes) sets **Captions under pictures** (`captions: true`): each cell then shows its caption under it, at most two lines, cut with an ellipsis, the whole caption still in the lightbox. A row keeps its cells level, and an item with no caption leaves the space empty.
- **Without scripts,** a picture's cell links to its full-size picture, a video's to its file, and a linked video's to the provider's page. Descriptions need scripts to be seen in the Grid: a stated limit of this version (the Story shows them without).
- **Opening at an item.** Loading the page with `#item-<id>` scrolls to the item and opens the lightbox at it ([§8.6](#86-addresses-back-and-sharing)).
- **Drafts** have no page on the site. Edit mode previews one on the dev server at its address, as it previews a draft page.

### 7.1 Story

An album whose items are better read in turn (a trip, a project's stages, a set of drawings with notes) sets its layout to **Story** (`layout: "story"`). The items then follow one another down the page:
- **each item at the wide width,** whole, never cropped; a portrait picture narrower, so it's never taller than the screen below the header;
- **its words under it, at the text width:** the caption as a figure's caption, then the description as prose, then the date and the place in the meta style; the credit as on a figure;
- **text cards** between them, as prose at the text width, as in the Grid;
- **the same links:** each picture opens the lightbox at its item, its address is the item's (`#item-<id>`), and videos and linked videos behave as in the Grid;
- **loading:** the first item eager, every later one lazy, with its space kept from its shape, so nothing jumps.

Nothing else changes: the band, the lightbox and the album's order are the same, and `captions` has no use (every item's words are shown). The album's introduction comes first, as in the Grid.

### 7.2 An album inside another page

An **album block** shows an album inside any page of the site: an article about a project can carry the project's album without copying a picture.

- **What it holds:** the album's ID, and optionally its width (`wide`, the default, or `full`): `{ "type": "album", "album": "<album ID>" }`.
- **What it shows:** the album's cover as its band, as the owner arranged it (its phone arrangement too), with its title as a heading one level below the heading it follows, its counts and See all, and no break. The band's tiles open the lightbox on the whole album, in its order, with the filmstrip; Back closes it, and Copy link gives the item's address on the album's own page.
- **Its words are the album's,** never copied: a change to the album shows wherever it's placed.
- **It's refused** (V51) for a private album (its band would carry its words outside its seal; [§12](#12-private-albums)), and for an album that's not published when the page it's in is.
- **Changing the album later:** making it private, setting it back to draft or deleting it while a published page shows it is refused by the same check, which names the pages that show it, so a block never shows an album it can't.
- **In edit mode** it's in the block inserter as Album, chosen from a list of the site's albums with their cover pictures, with the band shown as it is; the album is changed only in its own editor ([§9.10](#910-the-other-screens)).

## 8. The lightbox

The page's one lightbox keeps its look (the smoke scrim, the stage, Previous and Next, the counter, the filmstrip) and grows into an album viewer.

<figure class="slate-figure" data-diagram="gallery-lightbox">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 640" role="img" aria-labelledby="ga-lightbox__title ga-lightbox__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ga-lightbox__title">The lightbox, opened from an album</title>
<desc id="ga-lightbox__desc">Over the smoke, a top bar names the album, counts the item shown as 7 of 21, and holds Info, Copy link and Close. The stage shows the item whole, whatever its kind, between Previous and Next. Beside it, the info panel holds the item's caption, its short rich description and its credit, then a link to the album and a Copy a link button. Along the bottom, the filmstrip holds the whole album in its order, with the current item marked.</desc>
<g id="ga-lightbox__frame" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ga-lightbox__body-1" x="40" y="40" width="920" height="560" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
</g>
<g id="ga-lightbox__bar" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ga-lightbox__body-2" x="56" y="56" width="888" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ga-lightbox__body-2" data-slate-fit-padding="16">Album title</text>
<text x="440" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-lightbox__body-2" data-slate-fit-padding="16">7 of 21</text>
<text x="776" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-lightbox__body-2" data-slate-fit-padding="16">Info · Copy link · Close</text>
</g>
<g id="ga-lightbox__stage" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ga-lightbox__body-3" x="56" y="112" width="600" height="360" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="68" y="296" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-lightbox__body-3" data-slate-fit-padding="16">Previous</text>
<rect id="ga-lightbox__body-4" x="136" y="136" width="440" height="312" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="152" y="280" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-lightbox__body-4" data-slate-fit-padding="16">Picture, drawing, video or player</text>
<text x="152" y="304" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-lightbox__body-4" data-slate-fit-padding="16">Shown whole on the smoke; a player starts as its poster</text>
<text x="596" y="296" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-lightbox__body-3" data-slate-fit-padding="16">Next</text>
</g>
<g id="ga-lightbox__info" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ga-lightbox__body-5" x="668" y="112" width="276" height="360" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="684" y="144" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-lightbox__body-5" data-slate-fit-padding="16">Caption</text>
<text x="684" y="170" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-lightbox__body-5" data-slate-fit-padding="16">A short rich description:</text>
<text x="684" y="188" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-lightbox__body-5" data-slate-fit-padding="16">a few paragraphs, with links,</text>
<text x="684" y="206" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-lightbox__body-5" data-slate-fit-padding="16">emphasis and lists.</text>
<text x="684" y="236" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-lightbox__body-5" data-slate-fit-padding="16">Credit and licence</text>
<text x="684" y="384" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-lightbox__body-5" data-slate-fit-padding="16">From the album</text>
<text x="684" y="408" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ga-lightbox__body-5" data-slate-fit-padding="16">Open the album</text>
<text x="684" y="432" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="14" data-slate-fit-target="ga-lightbox__body-5" data-slate-fit-padding="16">Copy a link</text>
</g>
<g id="ga-lightbox__strip" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ga-lightbox__body-6" x="56" y="484" width="888" height="100" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="508" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12" data-slate-fit-target="ga-lightbox__body-6" data-slate-fit-padding="16">Filmstrip: the whole album, in its order</text>
<rect id="ga-lightbox__body-7" x="72" y="524" width="64" height="44" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-lightbox__body-8" x="158" y="524" width="64" height="44" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-lightbox__body-9" x="244" y="524" width="64" height="44" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-lightbox__body-10" x="330" y="524" width="64" height="44" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-lightbox__body-11" x="416" y="524" width="64" height="44" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-lightbox__body-12" x="502" y="524" width="64" height="44" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-lightbox__body-13" x="588" y="524" width="64" height="44" rx="6" fill="var(--color-brand-bg)" />
<text x="604" y="552" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-lightbox__body-13" data-slate-fit-padding="16">7</text>
<rect id="ga-lightbox__body-14" x="674" y="524" width="64" height="44" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-lightbox__body-15" x="760" y="524" width="64" height="44" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-lightbox__body-16" x="846" y="524" width="64" height="44" rx="6" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
</g>
<text x="40" y="624" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Wide: the info panel is a side column. On a phone it's a sheet over the stage, and the filmstrip scrolls.</text>
</svg>
<figcaption>The lightbox for an album: the top bar with the album's title, the counter and its three buttons; the item on the stage between Previous and Next; the info panel with the caption, the description and the album; and the filmstrip of the whole album, the current item marked.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The lightbox, as a table</summary>

| Part | What it is | Rule |
|---|---|---|
| Top bar | The album's title, "7 of 21", Info, Copy link and Close; Zoom in and Zoom out when the item can be zoomed | The counter is announced politely |
| Stage | The item: a picture, a drawing, an animated picture, a video or a linked video | Fitted to the space; never enlarged past its own size, except by zooming |
| Previous and Next | Buttons beside the stage | On a phone, swiping instead |
| Info panel | The caption, the description, the date and the place, the credit, the album and its link, Copy a link, and Download when allowed | A side column when wide; a sheet from the bottom on a phone |
| Filmstrip | A thumbnail for every item in the album, in album order | One Tab stop; the arrow keys move; the current one marked |

</details>

### 8.1 Opening, and the group

- **The group is the whole album,** in the order shown ([§3.3](#33-order)), wherever it's opened from. Text cards aren't in it: the counter, the filmstrip and Previous and Next count library items only ("7 of 21").
  - On the album page, the group is its cells.
  - In a band, the tiles carry their item's place in the album (`data-index`) and the band the album's size (`data-count`), so the counter reads "7 of 21" at once. Pressing, focusing or hovering a tile fetches the album page (same origin, once per album), and the lightbox reads the rest of the album from its cells and templates. It opens at once, with placeholders in the filmstrip, and fills them as the page arrives.
  - If the fetch fails, the group is the band's tiles in album order, and the filmstrip ends with "See all 21 in the album", a link to the album page.
- **Groups that aren't albums** (an article's figures, galleries and carousels) work as they do today, and gain what applies to them: Back closes, the filmstrip's single Tab stop, and video items from a gallery block.
- **Its name** is the album's title ("Summer sketches, album viewer"); for any other group it stays "Image viewer".

### 8.2 The stage, by kind

| Kind | On the stage |
|---|---|
| Picture | The picture at the size the stage needs, from its widths (960, 1600, 2560, and 3840 when it's kept large) and its dark version when the page is dark |
| Animated picture | Plays, with a Pause and Play button over its corner; paused at first under reduced motion |
| Drawing | The drawing, as large as the stage allows (it's sharp at any size), on the paper panel in dark mode when it has no dark version |
| Video file | The player (`controls`, `playsinline`, metadata only until it plays) with its caption tracks. It plays when the lightbox was opened by pressing it, and waits paused when reached by moving. It honours `loop`, and it's unloaded when the reader moves on |
| Linked video | Its poster as a facade with Play focused: a round button in the middle of the poster, the classic triangle in a circle (`c.lightbox.play`). After a press, the provider's player takes the poster's place, in the video's own shape (16:9 when it isn't known), as large as the stage allows, with nothing over it. It's removed when the reader moves on |

- **Never enlarged:** a raster item smaller than the stage is shown at its own size, centred. Looking closer is zooming ([§8.8](#88-zoom)).
- **A slow picture** shows its thumbnail, stretched and softened, until the full size arrives, then fades to it (instantly under reduced motion).

### 8.3 Words: the caption and the info panel

- **The caption** sits under the stage, as today. When the item has a description, a "More" button follows the caption and opens the info panel.
- **The info panel** holds, in order: the caption, the description (rich text), the date taken and the place ("Taken 12 March 2026, Shillong"; each when known, the date hidden by the album's `dates: false`), the credit and licence, a video's length, a linked video's "Watch on YouTube" (or Vimeo) link, Download when it's allowed, then "From the album: Summer sketches" with "Open the album" (left out on the album page) and "Copy item link".
- **Download** is offered only where the owner allows it: the album's **Allow downloads** (`download: true`), and for one item its own `download` (set in the viewer, or for a selection), which overrides the album's either way. It's never offered for a linked video (the provider's video isn't the owner's to hand out). The button names the file's kind and weight ("Download picture, 2.1 MB"), and the file is named `<album title's slug>-<item id>.<ext>` (from the title, never the address: a private album's is its secret token):
  - **a picture:** its largest published size, as WebP (3840 px when it's kept large);
  - **a drawing:** its cleaned SVG;
  - **an animated picture or a video file:** the file as published.

  In a private album, the file downloaded is the decrypted one, made in the browser. Downloads send no telemetry event. The file as it was uploaded isn't kept (edit mode makes the master from it) and masters aren't published, so a reader gets the largest published size, never the original: a stated limit ([§19](#19-not-in-this-version)).
- **Where it opens:** beside the stage on a wide screen (`c.lightbox.info-width`, about 22 rem, the stage narrowing to make room), a plain column set off by a hairline rule rather than a card; as a sheet over the bottom of the stage on a phone, above the filmstrip, ruled at its top and scrolling within itself.
- **The media as large as the screen allows:** the lightbox takes the viewport's whole width and height, with no max width; only the top bar, the filmstrip and the page's padding are taken from it.
- **Info** (the button, or the I key) opens and closes it. It stays open as the reader moves between items, and the choice is kept for the visit (session storage). When it's open, the caption moves into it rather than showing twice.

### 8.4 The filmstrip

- **Every item in the album,** in album order, as a thumbnail with its kind's badge; the current one marked (`aria-current`) and scrolled into view.
- **One Tab stop.** The strip is one stop in the tab order (a roving tab index): Left and Right, Home and End move between thumbnails and show the item, so the stage follows the focus. A 200-item album no longer costs 200 presses of Tab to get past.
- **Names:** "Show 7: The harbour at low tide", with "(video)" or "(animated)" when it's one.
- **Thumbnails load lazily,** as they scroll into the strip, at the card sizes (240 and 480 px).

### 8.5 Moving, keys and gestures

| Input | Does |
|---|---|
| Left and Right | Previous and next item (wraps at the ends, as today); while zoomed, they pan instead |
| Up and Down | While zoomed, pan; otherwise nothing |
| Home and End | First and last item |
| I | Opens or closes the info panel |
| + (or =) and − | Zoom in and out, where the item can be zoomed ([§8.8](#88-zoom)) |
| 0 | Back to the whole item |
| Escape | Back to the whole item when zoomed; otherwise closes, as today |
| Swipe left or right (touch) | Previous and next item, as today, when not zoomed; while zoomed, a drag pans |
| Pinch (touch), Ctrl and the wheel, a trackpad's pinch | Zoom, where the item can be zoomed; elsewhere, the browser's own zoom, kept |
| Double-tap or double-click on the stage | Zoom to its full size there, or back to the whole item |

- **In a player,** the arrow keys belong to the player (seeking, volume); the lightbox ignores them while the focus is in it. Tab gets out.
- **In a linked video's iframe,** Escape goes to the provider's player and can't close the lightbox: the browser keeps the iframe's keys to itself. Close stays one Tab away. A known limit.
- **No swipe down to close:** a vertical drag pans a zoomed item, and on an item that can't be zoomed the stage leaves the browser's own pinch zoom alone, which readers with low vision need. Close, Escape and Back close it.

### 8.6 Addresses, Back and sharing

- **On the album page,** opening the lightbox adds `#item-<id>` to the address (a new history entry), and moving replaces it, so Back closes the lightbox and leaves the reader where they were. Closing it removes the entry. Loading the page with `#item-<id>` opens the lightbox at that item; closing it then leaves the reader at its cell.
- **Elsewhere** (the section page, an article), opening the lightbox adds a history entry without changing the address, so Back closes it there too.
- **In the planet's frame,** the lightbox adds nothing to history: the frame keeps its own ([§13](#13-on-the-planet)).
- **Copy link** copies the item's canonical address: the album page's address on the site plus `#item-<id>`, whatever page the lightbox is on, and announces "Link copied". Where the clipboard can't be written, it shows the address selected in a field to copy by hand.

### 8.7 Loading

- **Warming:** a group of 24 items or fewer is warmed whole when the lightbox opens, nearest first, two at a time (as today). A larger group warms the 4 items on either side of the current one, again after every move.
- **Sealed media** (a private album's) aren't warmed: each is decrypted when it's shown ([§12](#12-private-albums)).
- **Video files** load their metadata only when shown, and nothing more until they play; a linked video loads nothing until Play.
- **The album page fetched from a band** is fetched once and kept for the visit; the reader's next step is usually that page, which then comes from the cache.
- **Zoom's large size** loads only when zooming starts, never with the item ([§8.8](#88-zoom)).

### 8.8 Zoom

A picture worth looking into (a detailed drawing, a sketch's lines, a panorama) can be zoomed on the stage.

- **Where it's offered:** a picture or a drawing whose largest size is at least one and a half times the size it's shown at on the stage; a drawing always (it's sharp at any size). Never an animated picture, a video or a linked video. Where it's not offered, the zoom buttons aren't shown, and pinching is the browser's own zoom.
- **How far:** up to the picture's full size (its largest published width: 2560 px, or 3840 px when kept large), and up to 4 times for a drawing.
- **How:**
  - pinching on the stage, or Ctrl and the wheel, or a trackpad's pinch, zooms round the point under the fingers or the pointer (the wheel alone does nothing, so scrolling never zooms by accident);
  - a double-tap or a double-click zooms to full size round that point, and back to the whole item;
  - the Zoom in and Zoom out buttons in the top bar, and + (or =) and −, step by half again; 0 goes back to the whole item;
  - while zoomed, a drag, or the arrow keys, pans, and the item can't be panned off the stage.
- **Moving on** to another item, by any means, starts it at its whole size. Swiping moves between items only when not zoomed, so a zoomed picture's pan never turns into a move.
- **Escape** goes back to the whole item first; a second Escape closes.
- **Loading:** the largest size is fetched only when zooming starts; until it arrives, the size on the stage is enlarged, then sharpened by the larger one.
- **Words:** the zoom buttons announce the level ("Zoomed to 200%"); the buttons are disabled at their ends. Under reduced motion, zooming jumps rather than easing.

The rules (where it's offered, the steps, the limits of a pan) are pure, in `src/site/scripts/zoomRules.ts`, and tested apart from the lightbox.

## 9. Edit mode

Albums are made and kept the way a photo app keeps them: a screen of every album, and inside one, the album itself, to fill, sort, describe and cover. Inside an album, the editor is laid out as the article editor's studio is (a list docked on the left, the album in the middle, an inspector docked on the right), so the two editors are learned once; but there are no blocks: the middle is the album's cover and its grid of items.

### 9.1 The Albums screen

`/_edit/albums/`, a screen of its own in edit mode's side navigation (an entry in `SCREENS`, found by the action center as "Albums", "Gallery" and "Photos").

- **A grid of album cards,** in the gallery's order ([§5](#5-the-albums-view)), drafts first: each its cover picture, its title, its count ("21 items"), its span of dates, and its tags (Draft, Private, and its section when it isn't the gallery's). Pressing a card opens its album.
- **Add album** creates an untitled draft at once, in the section whose view is Albums (with none, in the first section, saying so), and opens it with its title selected to type over. There's no form to fill first: as in a photo app, the album exists, then it's filled.
- **Drop files on the screen** and a new album is made from them, titled from the span of their dates ("March 2026") for the owner to rename, and they upload into it ([§9.4](#94-adding)).
- **Find and filter:** a search by title, and filters for Drafts, Private and a section.
- **Each card's menu:** Open, Open on the site (published only), Copy its address, and Delete. Delete asks first and says what it keeps: "Delete Summer sketches? Its 21 pictures stay in your library." It removes the album's file and its node, never a picture ([§9.9](#99-the-library)); it's refused, with the pages named, while a published page shows it in an album block (V51).
- **The gallery's order:** a Sort control, Newest first (the default), Oldest first, or Your order; dragging a card (or Alt with an arrow key) switches to Your order, as an album's items do. It's the section's `albumOrder` ([§5](#5-the-albums-view)), so the screen sorts the section's albums; with the section filter set to another section, it sorts that one's.
- **Tiles or a list.** The screen shows its albums as tiles (the default) or as a list beside the gallery's setup, as Sections and Recommendations do; Show as list and Show as tiles switch between them, and the screen remembers the last choice. In the list, the first entry is the gallery itself, whose setup is its title, its description, the order of its albums and whether the covers' pictures have rounded corners (the default) or square ones (the section's `albumCorners: "square"`, applied to every band of its albums, album blocks included); below it, the gallery's albums in its order, each with a handle to drag (or Alt with an arrow key), which switches the order to Your order; then the albums not in the gallery.

### 9.2 The album editor

`/_edit/albums/<id>/`: the album as a reader will see it, in the site's own look, in a studio of three columns (`Studio flow`, the article editor's, 28 October 2026, the owner's request):
- **the list of albums** ([§9.1](#91-the-albums-screen)), docked on the left, so the owner can move from one album to the next, or reorder them, without going back (hidden below the widest breakpoint, where Albums in the header leads back to it);
- **the album** in the middle, scrolling in place: its Cover section, the album's band exactly as the gallery will draw it, from what's saved (what the owner sees there is what visitors see), then its items;
- **the inspector,** docked on the right and resized by its edge as the article editor's is, with two tabs: **Selection**, every detail of what's selected in the grid ([§9.5](#95-the-viewer-and-the-words)), and **Album**, the album's own words and settings ([§9.2.1](#921-settings)). Selecting something opens Selection; with nothing selected, Album is open. Everything in it saves as it's typed or changed.

<figure class="slate-figure" data-diagram="gallery-editor">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 700" role="img" aria-labelledby="ga-editor__title ga-editor__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ga-editor__title">The album editor</title>
<desc id="ga-editor__desc">The album editor, a studio in three columns under its header. The header holds the album's title and its actions: Undo, Redo, Add, View on the site and Publish. On the left, the list of albums, docked: the gallery and its albums, the open one marked. In the middle, the album: the Cover section, its heading marked Automatic with Edit cover at its end, and the cover as its band will look; then the Pictures and videos section, its heading with the album's order at the end, and every item in a grid of thumbnails in that order, some selected, with a text card across the grid between two rows and an Add tile at the end. A selection bar shows under the grid while items are selected: one row of icon buttons to move them, remove them and clear the selection. On the right, the inspector, with two tabs. The Selection tab shows what's selected: for one picture, its preview with View large, then its caption, description, alt text, date taken, place, downloads and the other albums it's in; for several, the date and place set on all of them at once, and their downloads. The Album tab holds the album's facts with Review, its title and words, where it is and how it shows, and Delete album.</desc>
<g id="ga-editor__frame" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ga-editor__body-1" x="40" y="40" width="920" height="620" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-editor__body-2" x="56" y="56" width="888" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ga-editor__body-2" data-slate-fit-padding="16">Albums / Summer sketches</text>
<text x="560" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-2" data-slate-fit-padding="16">Undo · Redo · Add · View on the site · Publish</text>
</g>
<g id="ga-editor__list" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ga-editor__body-3" x="56" y="112" width="176" height="536" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-editor__body-3" data-slate-fit-padding="16">Albums</text>
<rect id="ga-editor__body-4" x="68" y="156" width="152" height="40" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="80" y="181" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-4" data-slate-fit-padding="16">Gallery</text>
<rect id="ga-editor__body-5" x="68" y="204" width="152" height="40" rx="8" fill="var(--color-brand-bg)" />
<text x="80" y="229" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-editor__body-5" data-slate-fit-padding="16">Summer sketches</text>
<rect id="ga-editor__body-6" x="68" y="252" width="152" height="40" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="80" y="277" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-6" data-slate-fit-padding="16">Monsoon walks</text>
<rect id="ga-editor__body-7" x="68" y="300" width="152" height="40" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="80" y="325" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-7" data-slate-fit-padding="16">Project notes</text>
</g>
<g id="ga-editor__cover" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ga-editor__body-8" x="244" y="112" width="440" height="160" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="260" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-editor__body-8" data-slate-fit-padding="16">Cover · Automatic</text>
<text x="590" y="140" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-8" data-slate-fit-padding="16">Edit cover</text>
<rect id="ga-editor__body-9" x="260" y="156" width="200" height="100" rx="10" fill="var(--color-brand-bg)" />
<text x="276" y="190" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ga-editor__body-9" data-slate-fit-padding="16">Lead</text>
<text x="276" y="212" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-editor__body-9" data-slate-fit-padding="16">The cover picture</text>
<rect id="ga-editor__body-10" x="468" y="156" width="96" height="46" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-editor__body-11" x="572" y="156" width="96" height="46" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-editor__body-12" x="468" y="210" width="96" height="46" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-editor__body-13" x="572" y="210" width="96" height="46" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
</g>
<g id="ga-editor__grid" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ga-editor__body-14" x="244" y="284" width="440" height="316" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="260" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-editor__body-14" data-slate-fit-padding="16">Pictures and videos</text>
<text x="580" y="312" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-14" data-slate-fit-padding="16">Oldest first</text>
<rect id="ga-editor__body-15" x="260" y="328" width="96" height="72" rx="8" fill="var(--color-brand-bg)" />
<rect id="ga-editor__body-16" x="364" y="328" width="96" height="72" rx="8" fill="var(--color-brand-bg)" />
<rect id="ga-editor__body-17" x="468" y="328" width="96" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-editor__body-18" x="572" y="328" width="96" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-editor__body-19" x="260" y="408" width="408" height="40" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="276" y="433" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-19" data-slate-fit-padding="16">Text card: words between pictures</text>
<rect id="ga-editor__body-20" x="260" y="456" width="96" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-editor__body-21" x="364" y="456" width="96" height="72" rx="8" fill="var(--color-brand-bg)" />
<rect id="ga-editor__body-22" x="468" y="456" width="96" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-editor__body-23" x="572" y="456" width="96" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
<text x="608" y="497" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-23" data-slate-fit-padding="16">Add</text>
<text x="260" y="580" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-14" data-slate-fit-padding="16">Click selects · Ctrl adds · Enter opens</text>
</g>
<g id="ga-editor__selection" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ga-editor__body-24" x="244" y="612" width="440" height="36" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="260" y="636" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ga-editor__body-24" data-slate-fit-padding="16">3 selected</text>
<text x="360" y="636" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-24" data-slate-fit-padding="16">Move · Remove · Clear</text>
</g>
<g id="ga-editor__inspector" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="ga-editor__body-25" x="696" y="112" width="248" height="536" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="ga-editor__body-26" x="708" y="124" width="112" height="36" rx="8" fill="var(--color-brand-bg)" />
<text x="722" y="147" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-editor__body-26" data-slate-fit-padding="16">Selection</text>
<rect id="ga-editor__body-27" x="824" y="124" width="108" height="36" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="840" y="147" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-27" data-slate-fit-padding="16">Album</text>
<text x="712" y="190" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">Picture · 2 of 21</text>
<rect id="ga-editor__body-28" x="712" y="202" width="216" height="96" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="712" y="322" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">View large</text>
<text x="712" y="358" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">Caption · Description</text>
<text x="712" y="384" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">Alt text · Suggest</text>
<text x="712" y="410" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">Date taken · Place</text>
<text x="712" y="436" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">Downloads · Find the focus</text>
<text x="712" y="462" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">Also in Monsoon walks</text>
<text x="712" y="510" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">Several: date, place and</text>
<text x="712" y="532" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">downloads set at once</text>
<text x="712" y="580" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">Album tab: facts, words,</text>
<text x="712" y="602" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-editor__body-25" data-slate-fit-padding="16">where it is, how it shows</text>
</g>
<text x="40" y="684" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Select in the grid, edit in the inspector; every change saves at once and can be undone.</text>
</svg>
<figcaption>The album editor: the header with the album's actions; the title, short description and introduction typed in place; the cover as its band, automatic or arranged; then every item in a grid to select, drag and open, with a bar of actions for the selection; the viewer opens an item large, with its words beside it.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The album editor, as a table</summary>

| Part | What it is | Rule |
|---|---|---|
| Header | Albums, the album's title; Undo and Redo; Add; View on the site; Publish or Unpublish | In Atiya Studio, the app's title bar draws it |
| The list | The gallery and its albums, the open one marked | Docked on the left, at the widest width |
| The cover | A section headed Cover, marked Automatic or Arranged, with Edit cover; the band as it will look | Edit cover arranges it in place |
| The items | A section headed Pictures and videos, with the album's order; every item in that order, as a grid of thumbnails | Select, drag, open; text cards at full width |
| Selection bar | Move, remove and clear what's selected | Under the grid, kept in view, while anything is selected; takes no room otherwise |
| Inspector: Selection | Every detail of what's selected: one item's words and settings, or what several share | Opens when something's selected; saves as it's typed |
| Inspector: Album | The facts with Review; the title and words; where it is; how it shows; Delete album | Open when nothing's selected; saves as it's changed |
| The viewer | One item large, with its words to edit | Opened by a double-click, Enter or View large |

</details>

From top to bottom:
- **The header** (its slots, so Atiya Studio's title bar shows them, editor spec §2): **Albums** (back to the Albums screen), the album's title, **Undo** and **Redo**, then **Add** ([§9.4](#94-adding)), **View on the site** (once it's published) and **Publish** (or **Unpublish** once it's published). The status line follows every save. The order and Edit cover belong to the sections they change (below), and the album's words and settings to the inspector's Album tab, so none of them is in the header (the owner's review, 27 October 2026: the header ran out of room, and Edit cover was there twice).
- **The cover,** a section headed **Cover**, marked **Automatic** or **Arranged**, with **Edit cover** ([§9.6](#96-the-cover)) at the heading's end; under it the band as it will look at the page's wide width, and a line on how it's made.
- **The items,** a section headed **Pictures and videos**, with the album's order at the heading's end (Oldest first, Newest first, Your order). Sorted by date, the grid is grouped under the days taken, with undated items under **Date not set**; when no item has a date, there are no day headings at all. Every item in the order shown, as a grid of square thumbnails (whole, not cropped, on the picture's own edge colour) with their kind's badge, and a Needs alt text mark where it applies. Text cards are full rows with their words. The grid ends in an **Add** tile, a dashed square the size of a thumbnail, which opens Add as the header's button does; it's a pointer's shortcut, so it takes no focus and assistive technology goes by the header's Add (a listbox holds only its items). An empty album shows one large drop target instead, which opens Add too: "Drop pictures and videos here, or add from your library".
- **The selection bar,** under the grid and kept in view at the bottom of the window, while anything is selected; it takes no room otherwise.
- **The inspector's Selection tab** ([§9.5](#95-the-viewer-and-the-words)) and **Album tab** ([§9.2.1](#921-settings)).
- **Publish** puts the album on the site. It needs a title of its own, at least one item, alt text on every picture and a title on every video; when something's missing, it says what, and offers Review for the alt text ([§9.7](#97-saving-undo-and-checks)). **Unpublish** makes it a draft again, refused while a published page shows it (V51).

#### 9.2.1 Settings

The inspector's **Album** tab (`AlbumForm`), the album's own words and settings, open whenever nothing is selected. Each saves as it's typed or changed, each setting showing its default until it's changed, and setting one back to its default removes it from the file. As the article editor's Page tab does, it lists its sections beside the chosen one when the inspector is wide, and stacks them when it's narrow:
- **The facts,** on top, worked out: Draft or Published, the counts, the span of dates, and, when any picture needs it, **"7 need alt text"** with **Review** ([§9.5](#95-the-viewer-and-the-words)).
- **Title and words:** the title (a single line), the short description (plain, with its limit counted as it's typed) and the introduction (short Markdown).
- **Where it is:** **Section**, any open section (the album's node moves, with no redirect), and the address that gives it once it's published; and **Who can see it**, Everyone or Private. Changing who can see it moves the album's file and its own pictures (those under `albums/<id>/`) between `content/` and `private-pages/` in one transaction ([§12](#12-private-albums)). Making it private is refused while a published page shows it (V51); making it open is refused while it holds a picture another private page or album owns (V52), naming it.
- **How it shows:** **Layout**, Grid or Story ([§7.1](#71-story)); **Captions under pictures** (Grid only); **Show dates taken**; **Allow downloads** ([§8.3](#83-words-the-caption-and-the-info-panel)); **Upload large pictures at full detail** (`large`): pictures added to this album later are kept at up to 3840 px ([§4](#4-media)).
- **Delete album,** in its foot, as on the Albums screen.

### 9.3 Selecting and ordering

The grid works as a photo app's does:
- **Selecting:** pressing a thumbnail selects it alone, and the inspector's Selection tab shows it; Ctrl or Cmd and a press adds or removes one, Shift and a press selects the range to it, Ctrl or Cmd and A selects every item, and Escape clears the selection. A check circle shows on a thumbnail under the pointer or the focus, to add it as Ctrl does. With the keyboard, the arrow keys move the focus through the grid, Space selects or deselects, and Shift with the arrows extends the selection. The selection is kept in the address (`?selected=`), so a reload or a change made elsewhere keeps it.
- **Opening:** a double-click on a thumbnail, Enter on it, or View large in the inspector opens the viewer at it ([§9.5](#95-the-viewer-and-the-words)).
- **The selection bar,** under the grid and held in view at the window's bottom while anything is selected, says how many ("4 selected") and holds what moves them (the kit's `SelectionBar`, shared with the Media library: a group named Selected items, its count a polite status). In the album editor it's one row of icon buttons, each named by its tooltip (27 October 2026, the owner's review). It takes no room while hidden, and since it's under the grid, showing it never moves a thumbnail:
  - **Move to start** and **Move to end**;
  - **Remove from album**, which keeps them in the library, saying so ("Removed 4. They're still in your library."), with Undo;
  - **Clear selection**, at the bar's end.

  What the selected items are and say is edited in the inspector, not the bar: their words, the date and place set on all of them at once, and their downloads (28 October 2026). Within an album there's no Set as cover (the cover is changed in Edit cover) and no Add to album (an album's pictures aren't where another album starts: that's the Media library's Add to album, [§9.9](#99-the-library)).
- **Ordering:** drag a thumbnail, or the selection, to a new place; Alt with an arrow key moves the focused item (or the selection) one place, and **Move to start** and **Move to end** are in a thumbnail's menu, so every drag has a single-pointer and a keyboard alternative (WCAG 2.5.7). In a sorted order, the first move switches the album to Your order ([§3.3](#33-order)).
- **Sort** in the header sorts the album as a whole: one change, so Undo puts the order back.

### 9.4 Adding

Adding is fast and never asks a question it can answer itself. Words come after, in the viewer ([D-G28](#17-decisions)):

- **Drop files anywhere** on the editor (or **Add → Upload files**, or the grid's Add tile). Each file shows at once as a thumbnail in its place, with its progress, and the album can be used while they upload: two at a time, in the background, each saved when it's ready. The status line counts them ("Uploading 12 of 40").
  - **Where they land:** dropped on an item, before it (after it, past its middle), marked while dragging as a move is; several files keep the order they were dropped in, whichever finishes first. In a sorted album that switches it to Your order, as a move does, and the status line says so. Dropped anywhere else (the cover, the Add tile, between items), or chosen with Upload, they go in their places: by date in a sorted album, at the end in Your order. A drop into an open dialog, or into a field that takes files itself, isn't an upload to the album.
  - **Pasting** (Ctrl+V or Cmd+V) a screenshot, a copied picture or copied picture and video files adds them the same way, in their places, each its own uploading thumbnail; a screenshot with no name of its own is named by the day it was pasted. A paste that carries text is the text's (an office app copies a picture of its text along with it), and a paste into a field or an open dialog stays there: the picker's upload form takes its own.
  - **What's worked out for each:** its date taken and its focus point ([§4](#4-media)); a drawing for an SVG at most 200 KB, a picture for a bigger one ([§4.1](#41-drawings-svg-kept-as-a-vector)); its size, standard or large by the album's setting; and, with the owner's AI service, a suggested alt text ([§9.8](#98-suggested-alt-text)).
  - **Duplicates:** a file whose fingerprint matches a picture already in the library isn't uploaded again: that picture is added instead; one already in this album is skipped. The status line says so once ("3 were in your library: added from there. 1 was already here.").
  - **A refused file** (a format the site can't keep, a video over 100 MB) leaves its thumbnail with the reason and what to do, and Dismiss; the others carry on.
  - **An animated PNG** is kept as a still, and its thumbnail says so, with the way to keep it moving ([§4](#4-media)).
- **Add → Add from library** opens the library picker full screen: the library's timeline grouped by month taken, with the same selection as the album's grid, a search, and the filters of the Media screen (Not in any album first among them). Pictures already in the album are marked and can't be added twice. **Add 12** adds them, in their places.
- **Add → YouTube or Vimeo link,** or pasting such an address anywhere on the editor: edit mode asks the provider (oEmbed, through the dev server) for its title, shape, length (Vimeo) and thumbnail, makes a linked video in the library with that thumbnail kept as its poster, the site's own picture ([§4.2](#42-videos-and-linked-videos)), and adds it. Pasting the address is all it needs. An address the library already has adds that one. Tests never reach the providers: they use a stand-in fetch.
- **Add → Text** adds a text card after the focused item (or at the end), switching a sorted album to Your order, and opens it to type.
- **Upload into the album's folder:** new files go to `content/media/albums/<id>/` (a private album's to `private-pages/media/albums/<id>/`). They're library items like any other, and the folder is only where they were made: they can be used anywhere, and they stay when the album is deleted.

### 9.5 The viewer and the words

An item's words are edited in two places that are one part (`MediaInfo`) and save the same way: the inspector's **Selection** tab (`AlbumSelection`), beside the grid, and the **viewer**, the item large in the lightbox's look, for writing a photo's words while looking at it.

- **The Selection tab,** drawn for what's selected (the address's `?selected=`):
  - **nothing:** how to select;
  - **one picture or video:** its kind and its place in the album ("Picture, 2 of 21"), its preview with **View large** (the viewer), then its info panel (below), its groups as the inspector's sections;
  - **one text card:** its words, saved as they're typed;
  - **several:** how many and what they are ("3 pictures, 1 text card"), their thumbnails, then what they can share: **Their words**, the **date taken** and the **place** (each picture's own, set on all of them at once; a value they don't share says "Mixed" and leaves each its own until one is set), and **In this album**, their **downloads**.
- **The viewer** opens with a double-click, Enter or View large; its parts are these.
- **The stage:** the item fitted, between Previous and Next (and the arrow keys, which never leave a field being typed in); a video plays, a linked video shows its poster. Escape, or Close, goes back to the grid at the item.
- **The info panel** (`MediaInfo`, the same part the Media screen shows: [§9.9](#99-the-library)), in the viewer and in the Selection tab, each field saving as it's typed:
  - **Caption** (plain, its limit counted), **Description** (`RichField`), **Alt text** (with its hint, and Suggest when the field's empty and the owner has an AI service), **Date taken** (a date field; Clear), **Place**;
  - for a video file: its **title**, **Play by itself** and **Loop** (this album's), and its caption tracks;
  - for a linked video: its **title**, its **shape** (when the provider didn't say), its **length**, and **Change poster** (from the library or a file);
  - for a picture: **Find the focus** and dragging its focus point on the stage; **Make it standard** when it's kept large;
  - for a drawing: **Turn into a picture**;
  - **Downloads:** Follow the album, Allow or Don't allow (this album's);
  - **Where it's used:** "Also in Monsoon walks and Project notes", each a link. A picture's words are the picture's, so changing them here changes them there ([§3.4](#34-where-the-words-come-from));
  - its credit and licence, folded under **More**.
- **The item's actions,** in the viewer's top bar: Open in the library, and Remove from album (Delete card for a text card). What's on the cover is chosen in Edit cover ([§9.6](#96-the-cover)).
- **Reviewing alt text:** "Review" (from the facts line or Publish) opens the viewer on only the pictures that need alt text, with the field focused. A suggestion is in the field marked **Suggested**; **Accept** (or Enter) saves it and moves to the next, and typing makes it the owner's. **Accept all 7 suggestions** is offered once every remaining picture has one, after he's seen them in the strip below the stage. The review ends by itself when none are left.
- **A text card** opens in the viewer as its words, in a `RichField`, with Delete.

### 9.6 The cover

The cover band at the top of the editor is the cover as readers will see it. It can be changed two ways:
- **Do nothing:** it's automatic, and follows the album.
- **Edit cover** arranges it tile by tile, in place: which pictures, which leads, where and how big. The band becomes the arranger, and the items grid below becomes its tray.

<figure class="slate-figure" data-diagram="gallery-arranger">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 680" role="img" aria-labelledby="ga-arranger__title ga-arranger__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ga-arranger__title">Edit cover: the band, tile by tile</title>
<desc id="ga-arranger__desc">Edit cover turns the album editor's cover band into the arranger, in place. A toolbar holds the presets, Close gaps, the Wide and Phone views (the phone's worked out until Arrange for phones), Use automatic cover and Done. The band shows at its real width over a faint grid of square cells. The chosen tile has handles that resize it by whole cells. Dropping a tile on one of the same size swaps them; otherwise the tiles below are pushed down. A hole is hatched and warned about, not refused. A live region reads each move aloud as columns and rows. Below the band, the tile bar holds the chosen tile's keys and options: how it's shown, its own focus, Play in the band, Hide on phones and Remove from cover. Below that, the album's items stay in their grid as the tray: those in the cover are marked, an item dragged up joins the cover, and a tile dragged down leaves it.</desc>
<g id="ga-arranger__frame" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-1" x="40" y="40" width="920" height="600" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-2" x="56" y="56" width="888" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ga-arranger__body-2" data-slate-fit-padding="16">Edit cover</text>
<text x="300" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-2" data-slate-fit-padding="16">Presets · Close gaps · Wide | Phone · Use automatic cover · Done</text>
</g>
<g id="ga-arranger__canvas" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-3" x="56" y="112" width="888" height="300" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="ga-arranger__body-4" x="72" y="128" width="856" height="236" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
</g>
<g id="ga-arranger__lead" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-5" x="76" y="132" width="420" height="150" rx="10" fill="var(--color-brand-bg)" />
<text x="92" y="164" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ga-arranger__body-5" data-slate-fit-padding="16">Lead</text>
<text x="92" y="186" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-arranger__body-5" data-slate-fit-padding="16">6 × 4 cells</text>
</g>
<g id="ga-arranger__selected" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-6" x="500" y="132" width="424" height="72" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="516" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ga-arranger__body-6" data-slate-fit-padding="16">Chosen</text>
<text x="516" y="184" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-6" data-slate-fit-padding="16">Handles resize by whole cells</text>
</g>
<g id="ga-arranger__moves" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-7" x="500" y="208" width="208" height="74" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="516" y="236" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-7" data-slate-fit-padding="16">Same size: swaps</text>
<rect id="ga-arranger__body-8" x="716" y="208" width="208" height="74" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="732" y="236" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-8" data-slate-fit-padding="16">Picture</text>
<rect id="ga-arranger__body-9" x="76" y="286" width="208" height="74" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="92" y="314" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-9" data-slate-fit-padding="16">Pushed down, not lost</text>
<rect id="ga-arranger__body-10" x="500" y="286" width="424" height="74" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="516" y="314" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-10" data-slate-fit-padding="16">Picture</text>
</g>
<g id="ga-arranger__hole" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-11" x="288" y="286" width="208" height="74" rx="10" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="304" y="314" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ga-arranger__body-11" data-slate-fit-padding="16">A hole is warned,</text>
<text x="304" y="334" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ga-arranger__body-11" data-slate-fit-padding="16">not refused</text>
</g>
<g id="ga-arranger__live" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<text x="72" y="396" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-3" data-slate-fit-padding="16">Read aloud: columns 7 to 12, rows 1 to 2</text>
</g>
<g id="ga-arranger__tilebar" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-12" x="56" y="424" width="888" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="452" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ga-arranger__body-12" data-slate-fit-padding="16">Tile bar</text>
<text x="200" y="452" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-12" data-slate-fit-padding="16">Arrows move · Shift+arrows resize · Fill or Fit · Own focus · Play · Hide on phones · Remove</text>
</g>
<g id="ga-arranger__items" data-slate-svg-step="9" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-13" x="56" y="480" width="888" height="148" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="508" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-arranger__body-13" data-slate-fit-padding="16">The album's items</text>
<rect id="ga-arranger__body-14" x="72" y="520" width="96" height="64" rx="8" fill="var(--color-brand-bg)" />
<text x="84" y="558" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-arranger__body-14" data-slate-fit-padding="16">Cover</text>
<rect id="ga-arranger__body-15" x="180" y="520" width="96" height="64" rx="8" fill="var(--color-brand-bg)" />
<text x="192" y="558" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-arranger__body-15" data-slate-fit-padding="16">Cover</text>
<rect id="ga-arranger__body-16" x="288" y="520" width="96" height="64" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-17" x="396" y="520" width="96" height="64" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-18" x="504" y="520" width="96" height="64" rx="8" fill="var(--color-brand-bg)" />
<text x="516" y="558" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-arranger__body-18" data-slate-fit-padding="16">Cover</text>
<rect id="ga-arranger__body-19" x="612" y="520" width="96" height="64" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-20" x="720" y="520" width="96" height="64" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-21" x="828" y="520" width="96" height="64" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="72" y="612" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-13" data-slate-fit-padding="16">Drag an item up to add it to the cover, a tile down to take it out</text>
</g>
<text x="40" y="664" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Every change saves, shows at once and can be undone.</text>
</svg>
<figcaption>Edit cover: the band at its real width over the grid; tiles moved and resized by whole cells, swapped with a tile of the same size or pushing the others down; a hole warned about but allowed; the album's items below, those in the cover marked, dragged up to add and down to remove; the chosen tile's keys in its bar.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>Edit cover, as a table</summary>

| Part | What it does | Rule |
|---|---|---|
| Toolbar | One row: Wide, Phone and Preview (icon buttons), Presets, Close gaps, Auto (the automatic cover), Cancel (an icon button), Done | Every action can be undone |
| Background | The chosen tile's colour behind its picture: Auto (the picture's edge colour), a few colours picked out of the picture, a colour picker, and an eyedropper that picks from anywhere on screen (only where the browser has one: Chromium and Atiya Studio) | Saved as the tile's `bg`, the same in both themes |
| Canvas | The band at its real width, with its gap and the gallery's corners, over a faint 12-column grid; each tile is just its picture | Tiles snap to whole cells |
| Chosen tile | A ring just inside its edge | Chosen by a click, Tab or the album's grid |
| Any tile's edges and corners | All four edges and all four corners resize it, the opposite side staying put; no handles are drawn, the cursor changes over them | By whole cells, 2 to 12 each way, inside the grid's columns |
| Dropped on a tile of the same size | The two swap places | Nothing else moves |
| Dropped anywhere else | The tiles below are pushed down to make room | Never overlapping; refused past 12 rows, saying why |
| A hole | Shown hatched, with a warning | Allowed |
| Live region | Reads the chosen tile's place: "columns 7 to 12, rows 1 to 2" | After every move and resize |
| The album's grid | The editor's own grid of the album's items (no second grid in Edit cover): those in the cover marked In cover; Add to cover and Remove from cover in its selection bar | Drag up to add (several at once), a tile down to remove |
| Tile bar | The chosen tile's name, place and Remove from cover, then labelled rows: Place (Move, Width and Height as button groups), Show it (By kind, Fill or Fit), Background, Options (Play, Hide on phones) | A button for every drag |

</details>

- **The canvas** is the band as it will look, at the page's wide width (scaled down to fit a narrow window), over a faint grid of its cells. Pictures show as they will: filled round their focus or fitted.
- **Starting:** Edit cover on an automatic cover copies what's shown into tiles, so arranging starts from what the owner sees.
- **Moving:** drag a tile; it snaps to cells as it moves, with its new place outlined. Dropped on a tile of the same size, the two swap. Dropped anywhere else, it takes its place and the tiles it would overlap are pushed down, in reading order, until nothing overlaps. A move that would push anything past 12 rows is refused, with the reason in the status line.
- **Resizing:** any tile's four edges and four corners resize it (no handles are drawn: the cursor changes over them), by whole cells, the opposite edge staying where it was: dragging the left edge left widens it leftwards, the top-left corner moves its top and left together. It stops at the grid's sides and at 2 cells, and pushes the tiles it meets down the same way; past 12 rows it's refused, saying why.
- **Preview** (the eye) hides the grid, the ring, the tile bar, the warnings and the items below, so the band shows exactly as the gallery will, wide or on a phone; pressed again, it goes back to arranging.
- **The keyboard:** Tab goes from tile to tile in reading order. With a tile chosen, the arrow keys move it a cell, Shift with the arrow keys resizes it a cell, and Delete takes it out of the cover. The tile bar has a button for each, so every drag has a single-pointer alternative (WCAG 2.5.7). The live region reads each new place.
- **Adding and removing:** the album's grid is the cover's source; Edit cover draws no grid or strip of its own. While Edit cover is open, the grid marks the items in the cover **In cover** (instead of the lead picture's Cover tag), and its selection bar adds **Add to cover** and **Remove from cover** for the selected items (each shown only when it applies). Dragging items up from the grid onto the canvas (the wide band) puts them in the cover at 3 by 2: the first where it's dropped, the rest where they fit first, passing over text cards and items already in; dragging a tile down onto the grid (or Remove from cover) takes it out. Add to cover places tiles where they fit first. A cover can't take more than 12 tiles: when it fills, what went in stays and the status line says how many didn't and why. The cover's last tile is never taken out.
- **Close gaps** moves every tile up as far as it goes, in reading order, keeping its column. **Presets** ([§6.4](#64-presets-and-the-default)) rearrange the tiles in the cover. **Use automatic cover** removes the arrangement (and the phone's), so the cover is worked out from the album again.
- **Phone** shows the phone's band, worked out by the rule ([§6.3](#63-on-a-phone)) and read only, with **Arrange for phones**, which copies it into an arrangement the owner can change with the same moves, handles and keys on 6 columns. Once arranged, the view says so, notes tiles added since, and offers **Back to automatic**, which removes it.
- **Per tile,** in the tile bar:
  - how it shows its item: By kind (the default: Fill, or Fit for a drawing), Fill or Fit;
  - for a filled tile, **Its own focus here:** dragging the point on the tile sets the tile's `focus`; **Use its focus** removes it;
  - for a video file or an animated picture at most 10 MB, **Play in the band** ([§4.3](#43-motion)), refused with the reason for a third tile;
  - **Hide on phones** (`onPhones: false`), refused for the cover's last tile on phones;
  - Remove from cover.
- **Warnings** stay beside the canvas while they apply: a hole, more than 8 rows (24 on the phone's own arrangement), a wide panorama in a small tile, a picture without a focus point filling a tile much narrower than it, and a tile playing in the band that weighs more than 4 MB.
- **Done** (or Escape) ends Edit cover. Every change was already saved.

### 9.7 Saving, undo and checks

- **Every change saves at once,** through the store, and shows at once ([editor spec §3.6](../editor/spec.md#36-optimistic-edits)): a move, a selection's removal or a tile's resize is drawn before the save returns. The status line follows the save ([editor spec §2.1](../editor/spec.md#21-saved-and-live)). The store learns albums: `createAlbum`, `saveAlbum` (with its version: 409 on a conflict), `deleteAlbum` and `setAlbumAccess`, each running the content check before a byte is written.
- **Two histories, as in a photo app:**
  - **The album's** (Ctrl or Cmd + Z, Shift + Ctrl or Cmd + Z, and the header's Undo while Edit cover is open): items added, removed and moved, the order, text cards, the cover and its tiles, the phone's arrangement, the album's words and settings, and Use automatic cover or Back to automatic;
  - **a picture's words** belong to the picture, not the album: each field has its own undo while it's being typed in, and a saved change is shown in the status line with Undo for a few seconds. They're never in the album's history, since they change the picture wherever it's used.
- **Uploads aren't undone by Undo:** undoing an add removes the item from the album and leaves the file in the library, as Remove from album does.
- **Live:** a change saved in another tab, or by the Media screen, is taken in; an unsaved drag or a field being typed in isn't lost.
- **Checks:** the content check runs before anything is written, so a change that breaks a rule (V38 to V55) is refused with the reason, never saved. A warning (V40, V54) saves and stays shown.
- **The logic is pure,** in edit mode's model: the album's operations (`album.ts`: adding, removing, moving, the orders, text cards, selection's actions, the cover's lead) and the arranger's (moving, swapping, pushing down, closing gaps, resizing, the presets, keeping the phone's arrangement in step), unit-tested, with no framework. The page's scripts only turn gestures into those calls.

### 9.8 Suggested alt text

An album can bring in dozens of pictures at once, and each needs alt text. When the owner has an AI service set up in edit mode ([AI services](../editor/ai-services.md)), it suggests a first draft for each, so he reviews rather than writes:

- **Which service:** the writer he chose on the AI screen ([AI services §8](../editor/ai-services.md#8-the-ai-screen)), when its model accepts pictures (its Test finds out, [AI services §7.7](../editor/ai-services.md#77-testing-changing-and-removing)); none is added, and no other key. Without one, or with this switch off, nothing is suggested and the fields are as they were.
- **The switch:** "Suggest alt text for new pictures" on the AI screen, on when the writer accepts pictures.
- **When:** for each picture uploaded without alt text, in the background after it's saved; and on asking (Suggest, beside an empty alt text field). Never for a picture that has alt text.
- **What's sent:** the picture at 960 px wide, without its file name, its metadata or the album's words. A private album's pictures are sent only when the service may get private pages ([AI services §6.2](../editor/ai-services.md#62-where-your-words-go)).
- **What's asked:** a description of what's visible, at most 250 characters; never "image of" or "picture of"; never who a person is, nor their age, ethnicity or anything else about them that can't be seen; text in the picture read out when it matters.
- **How it's shown:** in the field, marked **Suggested**, in the muted style, with Accept beside it. It's kept as a suggestion, not alt text, until the owner accepts or edits it; until then the picture still needs alt text, and publishing says so. The review accepts them one by one, or all at once once he's seen them ([§9.5](#95-the-viewer-and-the-words)).
- **Failure** is quiet: a picture whose suggestion fails or takes more than 20 seconds keeps an empty field, and the status line says how many weren't suggested.
- **Publishing an album with pictures that need alt text** isn't held back (V54 is a warning): Publish publishes, and says how many pictures have no alt text yet, with Review to add it, where Suggest and Accept do the writing. Nothing writes alt text on its own: the words are the owner's.

The request and its words live with the other AI tasks in edit mode's server; the rules for the answer (its length, the words it mustn't start with) are pure and tested.

#### 9.8.1 Suggested captions

A caption is the line a reader sees under a picture, and it's optional. When the owner wants one but has no words yet, the writer can offer a first draft. Unlike alt text, it's never suggested on its own: a caption is a matter of voice, so it's only ever asked for.

- **Where:** beside the Caption field, in a picture's details (Media) and in the album viewer's info panel. **Suggest caption** shows only while the field is empty and a suggestion is possible: the writer is chosen, its model sees pictures, and, for a private picture, it may get private pages. Otherwise the button isn't there.
- **The flow:** press Suggest caption. The button shows it's working and the status line says "Suggesting a caption". The draft then appears in the field, marked **Suggested**, in the muted style, with **Accept** and **Edit** beside it, and the status line reads it out. Accept keeps it as the caption; Edit keeps it and puts the cursor in the field; typing in the field dismisses the suggestion. Nothing is saved until one of those, and the picture's own Save saves it as any caption.
- **What's sent:** alt text's, the picture alone at 960 px wide, never its file name, metadata or any page's words.
- **What's asked:** at most 120 characters, about what's happening or notable rather than a description (alt text describes it); sentence case; no "image of", hashtags, emoji or quotation marks; never who a person is or anything about them that can't be seen; never a place, date, event or name unless it's written in the picture.
- **A miss** says what happened and what to do: it took too long (try again or write it), nothing met the rules, the picture couldn't be read, no writer is chosen, the model can't see pictures, or the writer isn't allowed to see private pages' pictures.
- **Use all suggestions** in the alt text review accepts alt text only, never a caption.

How it meets the usability heuristics (agentic-craft's H1 to H10):

| Heuristic | How |
|---|---|
| H1 Visibility of system status | The button's busy sign through the task tracker, "Suggesting a caption" in the status line, and the result read out |
| H2 Match with the real world | "Suggest caption", "Suggested", "Accept", "Edit": the owner's words, no model or prompt jargon |
| H3 User control and freedom | Only on asking; nothing saved until Accept or Edit; typing dismisses it; Save stays the owner's |
| H4 Consistency and standards | The same kit part, marks and keys as suggested alt text |
| H5 Error prevention | Offered only while the field is empty and a suggestion is possible; length capped; people and invented facts refused before showing |
| H6 Recognition rather than recall | The draft appears in the field it's for, with its choices beside it |
| H7 Flexibility and efficiency | One press to suggest, one to accept; the field stays free to type in |
| H8 Aesthetic and minimalist design | A quiet text button, gone when it can't help |
| H9 Help with errors | Each miss names its cause and the fix, and where (the AI screen) |
| H10 Help and documentation | This section and [AI services](../editor/ai-services.md) S12 |

As built: `model/captionText.ts` (the rules), `server/aiAlt.ts` (`suggestCaption`, the `caption` route), the `AltSuggestion` kit part with `words="caption"` (its story "A suggested caption"), in `MediaDetails` and `MediaInfo`. It's checked by `tests/unit/captionText.test.ts`, `aiAlt.test.ts` ("suggested captions") and the editor E2E "a caption (§9.8.1)" in `editor-alt-text.spec.ts`.

#### 9.8.2 Suggested words: every field, and several pictures at once

A picture has five words the reader can see: its caption, its description, its alt text, the day it was taken and the place. Captions alone weren't enough. Wherever the owner can write one of these words, he can ask for a draft, and he can ask for a whole selection at once. The date and the place's coordinates come from the file itself, not from the AI writer.

**Jobs** (what the owner is trying to get done):

| ID | When | He wants to | So that |
|---|---|---|---|
| J1 | He's just added a batch of pictures to an album | Get drafts of the words they're missing, all at once | The album is ready to publish without writing forty captions by hand |
| J2 | He's looking at one picture and a field is empty | Get a draft for that field, where it is | He reviews rather than writes |
| J3 | The camera or phone recorded when and where | Have the date and the place taken from the file | The facts are right, not guessed |
| J4 | Any of these | Keep nothing he hasn't seen | The words on his site are his |

**User-can statements:**

- U1: Next to every empty caption, description, alt text or place field for a picture, he can ask for a draft, and accept, edit or ignore it.
- U2: Next to an empty Date taken, he can fill it with the date the file recorded, when it recorded one.
- U3: With several items selected (in the album editor or on the Media screen), he can choose which words to suggest, see how many lack each, run it, watch it go, stop it, and review every draft before saving them together.
- U4: Whatever he does, a field that has words is never overwritten, and nothing is saved until he saves.

**Where it appears:**

- **One picture, every field (J2, J3):** the info panel (`MediaInfo`: the album inspector with one item, the album viewer, and the Media screen's timeline) has Suggest caption, Suggest description, Suggest alt text and Suggest place beside their fields, and **Use the file's date** beside an empty Date taken. A picture's details on the Media screen's list (`MediaDetails`) have its alt text, caption and Use the file's date. Each Suggest shows only while its field is empty and the writer can see this picture (§9.8.1's rules); Use the file's date shows only while the date is empty and the file had one.
- **Several (J1):** with two or more items selected, the album inspector's "Their words" has **Suggest words with AI…**, and the Media screen's selection bar **Suggest words**. Both open the same dialog.

**The batch's flow:**

1. **Choose.** The dialog opens on "What to suggest": Caption, Description, Alt text, Place and Date taken (from the file), with Caption, Alt text and the date ticked. Beside each, how many of the selection lack it ("7 of 12 need one", "All have one"). When the writer can't be asked at all, its four kinds can't be ticked, and the line above says why and what to do (choose a writer, one that sees pictures, or allow private pages), and that the dates can still come from the files. The run button counts the items it will ask about, those lacking a ticked kind: "Suggest for 9 pictures" (none: it can't be pressed).
2. **Run.** It asks the writer one picture at a time, only for the ticked words each one lacks. A progress bar and the status line say "Suggested 3 of 9". Each picture's drafts appear as they come, under its thumbnail and name, as ordinary fields he can already edit; a picture where a kind missed says why under it, in the words of §9.8.1's misses. **Stop** ends it and keeps what came. Closing the dialog stops it too and keeps the drafts: opening it again on the same selection returns to them.
3. **Review and save.** At the end the status line says how many are ready and that nothing is saved yet. **Save these words** saves every draft left in one change (emptying a field leaves it out), through the same save as Set the date and place (§9.3), with the status line's Saving and Saved; the grid and inspector redraw. **Discard** drops them all.

**What's sent and kept (privacy):**

- Each picture goes as in §9.8: 960 px wide, without its file name or its metadata. Videos and linked videos are never sent; they get only their file's date.
- Masters are written without their metadata (§4). On upload, the date taken and the coordinates the file held are kept on this computer only, in the gitignored `.atiya/picture-meta.json`, never in `content/` or a commit. Pictures uploaded before this have no such record, so they get no file date and no coordinates.
- The coordinates go to the writer only when a place is asked for, and only rounded to two decimals (about a kilometre). From them, the place it may answer is a town or city and its region or country, never a street or a house number. Without coordinates, it answers only when the place is written in the picture or it's a landmark nobody could mistake. A guess, a street or "unknown" is refused.
- A private album's pictures go only when the writer may see private pages.

**What's asked:** one question per picture, for the kinds wanted: the caption as §9.8.1, the alt text as §9.8, the description in two to four plain sentences about what it shows and what's interesting in it (at most 400 characters), and the place as above. Never who a person is, and never an invented date, event or name.

How it meets the usability heuristics:

| Heuristic | How |
|---|---|
| H1 Visibility of system status | The counts before it starts, a progress bar and "Suggested 3 of 9" while it runs, each picture's drafts as they come, and a closing line on what's ready and that nothing is saved |
| H2 Match with the real world | Caption, Description, Alt text, Place and Date taken: the fields' own names, and "Use the file's date" |
| H3 User control and freedom | Stop, Discard, and closing keeps the drafts; any draft can be edited or emptied before saving |
| H4 Consistency and standards | The same Suggest, Suggested, Accept and Edit beside every field, and one dialog from both screens |
| H5 Error prevention | Only empty fields are asked for and filled; nothing is saved before the review; places and people refused before they're shown |
| H6 Recognition rather than recall | Each draft sits under its picture's thumbnail and name, in the field it'll fill |
| H7 Flexibility and efficiency | One field at a time, or a whole selection with a choice of kinds |
| H8 Aesthetic and minimalist design | Suggest shows only where it can help; the dialog has two stages, each with its own actions |
| H9 Help with errors | Each picture's miss names its cause and the fix; the off line says why the writer can't help and what still can come |
| H10 Help and documentation | This section and [AI services](../editor/ai-services.md) S13 |

As built: the rules in `model/pictureWords.ts` (the question, the answer's rules, the batch's counts, lines and changes), the file's date and place in `model/exif.ts` (`locationOf`) and `server/pictureMeta.ts`, the routes `ai/words` (GET what can come for one item, POST the drafts) and `ai/words/needs` (what each of a selection lacks) in `server/aiAlt.ts`, the batch's save `media-words` (`model/albumViewer.ts` `batchProblem`). The parts: `AltSuggestion` with `words="description"` and `"place"`, `MediaInfo`, `MediaDetails`, and `SuggestWords` (its story) run by `scripts/suggestWords.ts`, opened from `AlbumSelection` and `MediaLibrary`. Checked by `tests/unit/pictureWords.test.ts`, `aiAlt.test.ts` ("suggested words") and the editor E2E "suggested words (§9.8.2)" in `editor-alt-text.spec.ts`.

### 9.9 The library

The Media screen becomes the library every album is made from, as a photo app's library is:
- **A timeline:** the library's pictures and videos grouped by the month they were taken ("March 2026"), newest first, with those without a date in "Date not set" by the month they were added. The existing list stays as a view.
- **The same grid** as an album's (the kit's `PhotoGrid`): thumbnails, selection, ranges, select all, the keyboard.
- **For a selection:** **Add to album** (an album, or New album… made from them), Set the date, Set the place, Delete.
- **Filters:** Not in any album, In albums, Needs alt text, and the kinds, beside the existing ones (Private, the owner folders).
- **Add link:** a YouTube or Vimeo address makes a linked video in the library ([§4.2](#42-videos-and-linked-videos)).
- **A picture's details** are `MediaInfo`, the viewer's panel, with its existing tools (Replace, Crop, the dark version, Keep it large, Find the focus) and **Used in**, listing every album and page.
- **Removing and deleting,** as in Google Photos and Apple Photos:
  - **Remove from album** (in an album) takes it out of that album only; the file stays in the library;
  - **Deleting an album** removes the album, never its pictures;
  - **Deleting a picture** (in the library only) removes it from every album that holds it, saying which first ("It's in 2 albums. Delete it from your library and both albums?"), and dropping their tiles; it's refused while an article uses it (as today), naming the pages. There's no trash: Save to remote hasn't sent it until the owner does, and git keeps the past ([§19](#19-not-in-this-version)).

### 9.10 The other screens

| Screen | Gains |
|---|---|
| Pages | Nothing for albums: no Album kind and no New album. The Gallery section's pages are its albums, listed on the Albums screen |
| Sections | Albums in a section's pages, tagged Album, moved like any page; the Albums view in a section's View; the gallery's order ([§5](#5-the-albums-view)) in the section's Settings |
| Media | The library ([§9.9](#99-the-library)) |
| The article editor | Album in the block inserter, chosen from the site's albums ([§7.2](#72-an-album-inside-another-page)); a figure can use any library picture, an album's included |
| AI | The switch "Suggest alt text for new pictures" ([§9.8](#98-suggested-alt-text)) |
| Access | A grant's scope can name an album, as it names a page; a section's grant covers its albums |
| The action center | Finds albums by title and opens the album editor; finds "Add album" |
| Save to remote | Albums and their files saved with the rest, private first, as pages are. From the album editor, the top bar's Save to remote opens the article editor's dialog over the album, with the album's own changes ticked |

## 10. Accessibility

The site's rules apply ([design system §7](../site-ui/design-system.md#7-accessibility), [editor spec §12](../editor/spec.md#12-accessibility)); for albums, specifically:

- **The band** is an `<article>` labelled by its heading, and its tiles a list of links in reading order. Each tile's name is its item's alt text (", animated" added for an animated picture; "Video: title" and its length for a video or a linked video). "See all 21 in Summer sketches" names its album. Tiles are at least 44 px in both directions at every width.
- **The album page's cells** are links named the same way, in album order, each with a visible focus ring.
- **The lightbox** is a modal dialog: focus moves into it and back to the tile or cell it was opened from; the page behind is inert; the counter is a polite live region; Info is a toggle button with its state; the filmstrip is one named group with one Tab stop ([§8.4](#84-the-filmstrip)); a video keeps its native controls and caption tracks; a linked video's iframe carries the video's title.
- **Motion:** the band is still unless the owner sets a tile to Play in the band, and then a Pause button pauses the band ([§4.3](#43-motion)); under reduced motion nothing in an album moves on its own, and transitions are instant. Anything animated can be paused where it plays.
- **Zoom** has a way in for every reader: buttons, keys and a double-click as well as pinching, and the arrow keys pan ([§8.8](#88-zoom)). Where an item can't be zoomed by the lightbox, the browser's own pinch zoom is left alone.
- **The Story layout** puts every item's words in the page, with its picture, so it needs no script to be read.
- **Contrast:** badges and the counts meet AA in light and dark mode, on the image shade; drawings without a dark version sit on paper in dark mode.
- **Reflow:** at 320 px wide and at 400% zoom the band is the phone arrangement, the lightbox's info panel a sheet, and nothing scrolls sideways.
- **Forced colours:** tiles, the current thumbnail and the arranger's chosen tile keep visible outlines in system colours.
- **Edit mode's album editor** can be used without a pointer and without dragging: the grid's selection and moves by keys ([§9.3](#93-selecting-and-ordering)), and Edit cover's tile bar and keys, which say every change in its live region ([§9.6](#96-the-cover)). The check circles and thumbnails are 44 px targets.

## 11. Performance and budgets

| Measure | Budget |
|---|---|
| The Gallery section's HTML (10 albums, 60 tiles) | About 100 KB gzip, to confirm in G2 |
| An album page's HTML (200 items, with their words) | About 40 KB gzip, to confirm in G3 |
| Pictures before the first band is complete | The first band's tiles only, at the sizes their tiles need |
| A tile that plays in the band | At most 10 MB, and at most 2 in a band; loaded only as it nears the screen, never with Save-Data |
| Scripts on the section page | The lightbox's, fetched on the first press, focus or hover of a tile; a band that plays fetches its small play-and-pause script with the page |
| The lightbox's script | Within the site's script budgets ([design system §9](../site-ui/design-system.md#9-performance)), zoom included |
| The whole published site | The build warns past 750 MB and fails past 950 MB (GitHub Pages' limit is 1 GB) |

- **A still band by default** keeps a section of albums light: a GIF in a tile is its still poster, a video its poster, a linked video its poster. A tile set to play costs its file only once it nears the screen.
- **Tiles ask for their own sizes:** a 2 by 2 tile never downloads a lead tile's picture.
- **Kept large** adds one 3840 px size per picture (about twice the 2560 px size's weight), fetched only for zoom or a very large screen.
- **Build time:** every picture is drawn once per size and kept by the build's picture cache, so 200 items don't cost 200 times every slot.
- **The site's weight** is measured on every build (`scripts/build-site.mjs`), because albums are the first feature likely to fill a site: 200 pictures at 2560 px and their sizes approach 200 MB.

## 12. Private albums

A private album is shared the way a private page is ([access spec §2.1](../access/spec.md#21-in-their-sections-a10-a12)), with nothing new to learn:
- **Where it lives:** its file in `private-pages/albums/<id>.json`, the pictures made for it in `private-pages/media/albums/<id>/`. Its node sits in an open section, at an opaque address (`/<section>/<token>/`), as a private page's does (V23 to V32 apply to it as to a private page).
- **Changing who can see it** (Settings, [§9.2.1](#921-settings)) moves the album's file and its own folder of pictures between `content/` and `private-pages/` in one transaction, as `setPageAccess` moves a page. A library picture it uses from elsewhere stays where it is, so:
  - **a private album may use an open picture** (it's public already);
  - **an open album may never use a private picture** (V52): making an album open is refused while it holds one, naming it, with **Move them into this album's folder** when the picture is used nowhere else, and adding a private picture to an open album is refused at the add.
- **Its page** is sealed whole: the opening, the introduction, every cell and its words ([access spec §5.4](../access/spec.md#54-sealing-a-page)). Its media are sealed and decrypted when shown ([§5.5](../access/spec.md#55-pictures-and-videos-a3)); its video files are at most 10 MB (V27). A download from it is the decrypted file, made in the browser.
- **Its band** in the Albums view is sealed as a private page's card is: kept in the section's order, decrypted in place for a reader whose access covers it, and invisible to anyone else. It can't be placed in another page as an album block (V51).
- **Grants:** a grant's scope names an album as it names a page, and a section's grant covers the albums in it (V26).
- **The lightbox** reads a private album's rest from its fetched page, which the sealed runtime decrypts with the key the reader already holds. If that can't be done, it falls back to the band's tiles ([§8.1](#81-opening-and-the-group)).
- **Never** on the planet, in a menu or in a redirect (V25, V28), and never named in telemetry.
- **The sealer** knows the lightbox's attributes: every address in a sealed album's cells and tiles (the full size, the widths for the stage, the thumbnails, video sources and posters, a playing tile's file) is rewritten to its sealed copy, and the leak check covers them.

## 13. On the planet

- **The Amphitheater** shows the Gallery section, so its reading frame shows the Albums view, framed over the planet.
- **Inside the frame,** "See all" and a band's title open the album page in the same frame, staying inside the building, as every move does.
- **The lightbox** works in the frame as on the site, but adds nothing to history: the frame replaces its own entries, and Back belongs to the planet.
- **Copy link** copies the site's address for the item, never a `/play/` address, so a shared link opens the album on the site.

## 14. Telemetry, search and sharing

- **Telemetry:** one new event, `lightbox_opened`, with `place` (`album`, `section`, `article` or `block`) and `kind` (`picture`, `animated`, `drawing`, `video` or `embed`), added to both allowlists. `video_played` gains the place `lightbox`. No event carries an album's or an item's ID or title, and zooming and downloading send nothing.
- **Search:** an album page has its canonical address, its title, its summary as its description, and a raster social image (its cover picture, [§3.6](#36-the-cover); never a drawing, V46). The `#item-` addresses are parts of that page, not pages.
- **Sharing:** Copy link ([§8.6](#86-addresses-back-and-sharing)). A shared item's link shows the album's card on a social site and opens the item in the lightbox.

## 15. Components, tokens and code

| Piece | Tier | Change |
|---|---|---|
| `AlbumBand` | Compound | One album's band: heading, counts, the bento grid of the cover's tiles, the short description, See all, and Pause when a tile plays. A container, with its own query size. Also drawn by the album block |
| `AlbumGrid` | Compound | The album page's items: every item in the order shown, justified, each cell with the item's address, its kind's badge, its caption when the album shows them, and its words' template; text cards breaking the grid; and the Story layout |
| `Lightbox` | Compound | The album group, the stage's kinds, the info panel (with the date, the place and Download), Copy link, zoom, the filmstrip's single Tab stop, history. Its script is `scripts/lightbox.ts`. Text cards are never in its group |
| `Image` | Fundamental | Takes a drawing (`.svg`): drawn whole at its own shape, with no set of widths |
| `IndexLayout` | Layout | The `albums` view, its bands from album files, ordered by the section's `albumOrder` |
| `AlbumLayout` | Layout (new) | The album page: its opening, introduction, `AlbumGrid` and the page's end ([§7](#7-the-album-page)) |
| `ArticleLayout` | Layout | Loses the album branch the first build gave it ([§21](#21-from-the-first-build)); keeps the album block |
| `StoryCard` | Compound | Unchanged: an album's card is a `StoryCard` with its cover picture and counts |
| `src/site/content/schema.ts` | Contract | The `album` resource and its items, the cover, the sidecar's new fields (`description`, `place`, `fingerprint`, a video's `taken`), the linked video's sidecar kind, `item.type: "album"` in the structure, the section's `albumOrder`; the article's `album` field and kind `gallery` refused |
| `src/site/content/album.ts` | Pure | The rules (V38 to V55), `albumOrder` and the gallery's `albumsOrder`, the cover (the default and its lead, the presets, `phoneTiles`, keeping a phone arrangement in step, the cover picture), reading order, the counts and the span of dates |
| `src/site/content/providers.ts` | Pure | YouTube and Vimeo in one list: address patterns, IDs, player and page addresses, oEmbed, the policy's hosts. The video block, edit mode and `csp.ts` read it |
| The repository and the loader | Content | Read `albums/` (and `private-pages/albums/`), resolve album nodes, give albums to every reader of items (cards, Related, the home views, search, the planet's frame), and check them |
| `src/site/scripts/lightboxRules.ts` | Pure | Building a group, the warming window, the history rules, the names, what may be downloaded and its file name |
| `src/site/scripts/zoomRules.ts` | Pure | Where zoom is offered, its steps and limits, the pan's bounds |
| Edit mode: `PhotoGrid`, `MediaInfo` | Kit (new) | The grid of thumbnails with selection, ranges, the keyboard and drag to reorder; a library item's words and facts to edit. The album editor, the library picker and the Media screen share them |
| Edit mode: `AlbumCards`, `AlbumList`, `AlbumItems`, `AlbumAdd`, `AlbumViewer`, `AlbumCover`, `AlbumCoverEditor`, `AlbumInspector`, `AlbumSelection`, `AlbumForm` | Editor parts | The Albums screen and the album editor's parts, each within the editor's part limits ([§9](#9-edit-mode)) |
| `src/site/editor/model/album.ts` | Pure | The album's operations (create, add, remove, move, sort, text cards, the selection's actions, the cover's lead, settings), the arranger's operations and the phone's arrangement, the alt review's queue |
| `src/site/editor/server/albums.ts` | Server (new) | The Albums screen's cards, an album's thumbnails, counts and weight, uploads into an album, duplicates by fingerprint, the store's album operations |
| `src/site/editor/server/albumEmbed.ts` | Server | A YouTube or Vimeo address's details and its poster, kept as the site's own picture, made a linked video in the library |
| Media: the SVG sanitizer | Server | Cleaning and checking drawings, with tests of hostile SVGs (`src/site/editor/model/svgSanitize.ts`) |
| Media: reading at upload | Server | The date from the file's EXIF (`src/site/editor/model/exif.ts`, no dependency) or a video's `creation_time`, the focus from the image library's attention measure, the fingerprint, the album's `large` |
| Edit mode: suggested alt text | Server | The request to the writer, with the AI services' other tasks; its answer's rules pure in edit mode's model |

- **Tokens:**
  - `c.album` (owned by `AlbumBand`): the gap, the compose query size (marked as a container size), the band's space, the drawing's paper;
  - `c.album-grid` (owned by `AlbumGrid`): its gaps, the caption's lines, a text card's space;
  - `c.lightbox`: the info panel's width, beside its existing thumbnail size;
  - `c.editor-photo-grid` (owned by `PhotoGrid`): the thumbnail's size, the check circle, the selection's outline, the drop marker;
  - `c.editor-arranger` (owned by `AlbumCover`): the grid's line, the hole's hatching, the chosen tile's outline and the drop outline.
- **Icons:** the Play badge reuses the video block's; Animated, Info, Copy link, Pause, Zoom in, Zoom out and Download as built; new ones for the check circle, Cover, Set as cover, Text and Linked video, imported one at a time into the icon set.
- **Stories:** `AlbumBand` (still and playing), `AlbumGrid` (with captions, with text cards, and as a Story), the Lightbox's album states, the album block, and the editor's `PhotoGrid`, `MediaInfo` and album parts each get their stories, so they appear in the design library, the parts library and their screenshots.

## 16. Rules

The content check holds these for every site, continuing the numbering of the [sections spec](../sections/spec.md#8-rules) and the [access spec](../access/spec.md#10-content-rules). V38 to V51 were first written for the page-based build and are restated here for the album resource; V52 to V55 are new.

| Rule | Says |
|---|---|
| V38 | An album has 1 to 200 library items when it's published (none to 200 as a draft) and at most 50 text cards; each item's `id` is well formed and unique in the album; each has exactly one of `media` and `text`; its media is an existing picture, animated picture, drawing, video file or linked video, at most once in the album |
| V39 | A cover has either `lead` or `tiles`, never both. `lead` names an item that isn't a text card. `tiles` are 1 to 12, each naming a different item, never a text card; each tile is 2 to 12 cells each way, inside the 12 columns and 12 rows; no two overlap |
| V40 | Warnings, not refusals: a hole in the band; a band more than 8 rows tall; a phone arrangement more than 24 rows tall; a tile playing in the band that weighs more than 4 MB; a video file without captions (the check can't hear speech, so it warns for every video file without a caption track) |
| V41 | Words: a caption at most 200 characters; a picture's description and a text card at most 4 paragraphs or lists and 1,000 characters; the album's description at most 6 and 1,500; the album's title at most 120; all rich text of the subset ([§3.5](#35-rich-text)) |
| V42 | A drawing is an SVG at most 200 KB, cleaned ([§4.1](#41-drawings-svg-kept-as-a-vector)), with a viewBox or a size; its dark version follows the same rules |
| V43 | An album is placed by a structure node whose item is `{type: "album", id}`, once, in an open section; its ID is unique among albums and articles. An article never has an `album` field or the kind `gallery` (they were the first build's). The section views (V18) include `albums` |
| V44 | A private album follows the private page's rules: its media sealed, its videos at most 10 MB, never on the planet, in a menu or in a redirect (V25, V27, V28) |
| V45 | A linked video's sidecar names a provider in the list (YouTube or Vimeo), an ID of the provider's shape, a title and a raster poster beside it; its `duration`, when known, is a whole number of seconds |
| V46 | A social image is a raster picture, never a drawing |
| V47 | A phone arrangement needs the wide one (`cover.tiles`) and names each tile of it shown on phones exactly once; its tiles are 2 to 6 columns wide and 2 to 8 rows tall, inside the 6 columns, never overlapping. At least one tile is shown on phones |
| V48 | A tile's `focus` is two percentages and only on a filled tile; `play` only on a video file or an animated picture at most 10 MB, and on at most 2 tiles of a cover |
| V49 | An album's `layout` is `grid` or `story`; `captions` only with `grid`; an item's `download` never on a linked video or a text card; `autoplay` and `loop` only on a video file |
| V50 | A sidecar's `place` is plain text of at most 80 characters. A `taken` is a real date, no later than the day it was saved; `large` only on a raster still picture whose master is wider or taller than 2560 px and at most 3840 px |
| V51 | An `album` block names an existing album; never a private one, and never an unpublished one from a published page. A change that would break this (making the album private or a draft, deleting it) is refused, naming the pages |
| V52 | An open album never uses a private library item |
| V53 | A section's `albumOrder` is `newest`, `oldest` or `custom`, and only on a section whose view is `albums`, as is `albumCorners` (`square`, or left out for rounded). An album's `order` is `oldest`, `newest` or `custom`, and is `custom` whenever it has a text card |
| V54 | A warning, never a refusal: anything published that shows a picture without alt text (an album, an article, a cover) is warned of, and in an album a decorative picture is warned of too; the library and drafts are never warned |
| V55 | A sidecar's `fingerprint` is a SHA-256 in hex; no two library items have the same one |

## 17. Decisions

| # | Decision | Why |
|---|---|---|
| D-G1 | **"Album"** is the word everywhere: in the model, the stored type (`album`), the code and edit mode; "Gallery" stays the section's name | "Collection" is already a block (`collection`) and a component; an album is what people call a set of pictures with a title, and the owner asked for the word |
| D-G2 | **An album is its own resource,** `albums/<id>.json`, placed by the structure as an album item; not an article (superseding the first build's "an album is a page of kind `gallery`") | Its content is a set of library items, not a sequence of blocks; force-fitting it into the article made the editor an article editor with album views bolted on, and would keep costing as albums grow. The platform's shared parts (structure, status, access, cards, the store) take a second item type ([§1.1](#11-why-an-album-isnt-a-page)) |
| D-G3 | **A section view, Albums,** not a block on a page | The request is for the gallery's main view; a view keeps every album its own page and lets any section use it |
| D-G4 | **Items and the cover are kept apart:** `items` is the album, `cover` its band | Choosing the cover never changes the album, and an item can leave the band without leaving the album |
| D-G5 | **Twelve columns of square cells,** tiles of whole cells from 2 to 12 | The snapping asked for; square cells keep a tile's shape at every width; 12 divides into halves, thirds, quarters and sixths |
| D-G6 | **A phone layout worked out** on 6 columns by a fixed rule, **which the owner can arrange himself** when it's wrong | The owner arranges once; a second layout to keep in step is upkeep he didn't ask for, so it's there only where he wants it, and it keeps up with the wide band by itself |
| D-G7 | **SVG kept as a drawing** by default up to 200 KB, sanitized, drawn with `<img>` | Drawings and diagrams stay sharp; `<img>` never runs a script, and sanitizing guards the file itself |
| D-G8 | **Formats that can't be kept are refused** with what to do, never silently changed | The owner should know when a file can't be what he uploaded (APNG, JPEG XL, RAW, MKV) |
| D-G9 | **The band is still by default;** the owner can set up to 2 tiles to play, muted, with a Pause | Weight, calm and WCAG 2.2.2; a moving picture is content he chooses, as a video block's `autoplay` is, and the interface itself never moves on its own |
| D-G10 | **The album page shows every item in the justified grid** by default, with words in the lightbox; Story is the alternative | The grid is for looking; words are a press away, and the Story is there for albums that are read |
| D-G11 | **The lightbox's group is the whole album,** fetched from the album page when opened from a band | The filmstrip asked for; fetching keeps the section page light, and the reader's next page is cached |
| D-G12 | **Back closes the lightbox,** everywhere but the planet's frame | What phone readers expect of anything that fills the screen; the frame's history belongs to the planet |
| D-G13 | **Albums have their own screen and editor,** modelled on Google Photos and Apple Photos: a grid of albums, and an album as its words, its cover and a grid of items to select, drag and open (superseding "an album's editor gains two views beside Page") | Albums are made by adding many pictures, then sorting, choosing and describing them; that's a photo app's work, not a page's, and photo apps have settled how it's done |
| D-G14 | **The lightbox follows the album's order,** not the cover's | The album's order is its story; the counter and the filmstrip mean the same thing wherever it's opened |
| D-G15 | **Automatic first, override anywhere:** every choice has an answer worked out from the content; an override is stored only where the owner makes one, and Back to automatic removes it ([§18](#18-automatic-and-where-to-override-it)) | The owner wants the least upkeep with control where he wants it; a worked-out answer that's never saved keeps up with the album by itself |
| D-G16 | **The focus point is measured at upload,** and a tile can have its own | Most pictures then need no focus set by hand; one tile's crop never moves the picture's other uses. Pictures already in the library aren't measured, so nothing on other pages moves |
| D-G17 | **The date taken comes from the file** and is kept in the picture's sidecar; **the place is typed,** never read from GPS; the camera isn't shown | The date costs the owner nothing and is the most useful fact about a picture; a location read from a file can say where someone lives |
| D-G18 | **Zoom is built,** for pictures with more to see, with buttons and keys as well as gestures | Drawings, sketches and panoramas lose their detail at the stage's size; the browser's pinch zooms the whole page, not the picture, and has no way in without touch |
| D-G19 | **Downloads are off unless the owner allows them,** for an album or an item; never for a linked video | His work is his to hand out; a reader can still look as closely as zoom allows |
| D-G20 | **Providers are one list in code,** YouTube and Vimeo for now | Three readers knew them apart; one list makes the next provider one entry, and a file covers any other video today |
| D-G21 | **An album can be shown in another page** as a block, as arranged, its words never copied | A project's article can carry its pictures without a second copy to keep up |
| D-G22 | **Alt text is suggested** by the owner's own AI service and saved only when he accepts it | Writing alt text for dozens of pictures is the upkeep most likely to be skipped; a suggestion he reviews keeps every picture described without taking the decision from him |
| D-G23 | **No "cover first" button:** the automatic cover follows the album's order until he arranges it | The cover and the album keep their own orders (D-G4); Edit cover and Use automatic cover cover what such a button would |
| D-G24 | **A picture's words are the picture's,** kept in its sidecar and shown wherever it's used; an album has no caption of its own for an item | As in a photo app: written once, a picture's words follow it. Per-album words would make the owner describe the same picture twice and keep both. An article figure keeps its own caption, since a figure's caption is part of the article's prose |
| D-G25 | **Linked videos are library items,** with their own sidecar and a poster kept as the site's own picture | They then work like any picture: in several albums, chosen in the picker, described once; an album item never carries a provider's address |
| D-G26 | **Albums are sorted by date taken, oldest first, by default;** dragging switches to the owner's own order, which Sort can undo | How Google Photos and Apple Photos keep albums: no upkeep as pictures are added, and full control the moment he wants it |
| D-G27 | **Text cards** put words between pictures, and need the owner's own order | Google Photos' text in albums; it tells a story through a set of pictures without making the album a page |
| D-G28 | **Upload first, describe after:** adding never asks a question, and alt text is needed only to publish | Adding 40 pictures should take one drop; the words are better written looking at each picture, and the review with suggestions makes it quick |
| D-G29 | **The cover** replaces "up front", changed only in Edit cover (Set as cover, the first build's smallest override, was removed on 27 October 2026) | Photo apps' word; the owner's review: a second way to change the cover, from the grid, didn't fit the dedicated cover workflow |
| D-G30 | **The gallery lists albums newest first** by their latest date taken (else when they were made), with the owner's own order one drag away | A gallery that stays current by itself as albums are added; the section's `albumOrder` keeps his order where he sets it |
| D-G31 | **Removing never deletes, deleting an album never deletes its pictures,** and deleting a picture is done in the library, saying which albums lose it | What Google Photos and Apple Photos do, so nothing is lost by tidying an album; git and Save to remote stand in for a trash |
| D-G32 | **Duplicates are found by the file's fingerprint** and added from the library instead of uploaded again | Dropping a folder twice, or a picture already used elsewhere, mustn't make copies to describe twice |
| D-G33 | **The kind `gallery` and the article's `album` field are retired** | One way to make an album; the fixtures are the only albums made the first way ([§21](#21-from-the-first-build)) |

## 18. Automatic, and where to override it

Every choice in an album has an answer worked out from its content, so an album the owner only fills with pictures is complete; he overrides any answer where he wants to, and only there ([D-G15](#17-decisions)). An automatic answer is worked out every time, never saved, so it keeps up with the album by itself. An override is stored where it applies, and **Back to automatic** (under the name each place gives it) removes what it stored.

| What | Automatically | Override, and where | Stored | Back to automatic |
|---|---|---|---|---|
| The album's order | By date taken, oldest first ([§3.3](#33-order)) | Sort: Newest first; or dragging, which makes it Your order | the album's `order` (and `items`' order) | Sort: Oldest first |
| The cover picture | The album's first item in its order | Edit cover: the picture in the lead tile | `cover.tiles` | Use automatic cover |
| Which items are in the cover, and how they're arranged | The album's first items in the preset that suits their number, its lead first ([§6.4](#64-presets-and-the-default)) | Edit cover ([§9.6](#96-the-cover)) | `cover.tiles` | Use automatic cover |
| The phone's band | Worked out from the wide band by the rule ([§6.3](#63-on-a-phone)) | Arrange for phones, in Edit cover's Phone view | `cover.phone.tiles` | Back to automatic |
| A tile on phones | Shown | Hide on phones, in the tile bar | the tile's `onPhones` | Show on phones |
| How a tile shows its item | Fill for pictures, videos and linked videos; Fit for drawings | Fill or Fit, in the tile bar | the tile's `display` | By kind |
| Where a picture is cropped | Its focus point, measured when it's uploaded ([§4](#4-media)) | Dragging the point in the viewer (every use), or on one tile (that tile only) | the sidecar's `focus`; the tile's `focus` | Find the focus (the picture); Use its focus (the tile) |
| A tile that plays in the band | Still | Play in the band, in the tile bar, within its limits ([§4.3](#43-motion)) | the tile's `play` | Turning it off |
| The album's short description | The first sentence of its introduction | Typing one, under the title | the album's `summary` | Clearing it |
| The date taken | Read from the file at upload | Changing or clearing it, in the viewer; Set the date, for a selection | the sidecar's `taken` | Clearing it hides it |
| Dates on the album | Shown where known; the album's opening shows their span | Show dates taken, in Settings | the album's `dates` | Turning it back on |
| The place | None: never read from the file | Typing it, in the viewer; Set the place, for a selection | the sidecar's `place` | Clearing it |
| An SVG | A drawing, up to 200 KB; a picture past that | Turn into a picture, in the viewer | the sidecar's `file` | None: upload it again |
| A picture's largest size | 2560 px | Upload large pictures at full detail, in the album's Settings | the album's `large`; the sidecar's `large` | Make it standard (the picture); turning it off (the album) |
| The album page's layout | Grid | Layout: Story, in Settings ([§7.1](#71-story)) | the album's `layout` | Layout: Grid |
| Captions under the cells | None | Captions under pictures, in Settings | the album's `captions` | Turning it off |
| Downloads | None | Allow downloads, for the album; Allow or Don't allow, for an item | the album's and the item's `download` | Follow the album; turning it off |
| A linked video's title, shape, length and poster | From the provider when the address is pasted; the poster its thumbnail, kept as the site's own picture | Changing any of them, in the viewer | the linked video's sidecar | Pasting the address again |
| Alt text | Suggested by the owner's AI service when he has one ([§9.8](#98-suggested-alt-text)) | Accepting, editing or writing it | the sidecar's `alt` | None: alt text is never removed automatically |
| The album's card and social picture | The cover picture ([§3.6](#36-the-cover)) | Edit cover | The lead tile (or an existing `cover.lead`) | Use automatic cover |
| The order of albums in the gallery | Newest first, by each album's latest date taken, else when it was made ([§5](#5-the-albums-view)) | Sort on the Albums screen; dragging an album | the section's `albumOrder` (and the structure's order) | Sort: Newest first |
| The album's section | The section whose view is Albums | Section, in Settings | the album's node | None |
| The counts | Worked out from the items | None | Nothing | Nothing |
| The info panel | Closed; then as the reader left it, for the visit | The reader's own choice | The reader's session | Not the owner's |

## 19. Not in this version

- A slideshow that moves on its own.
- Downloading the files as they were uploaded (they aren't kept); readers download the largest published size where it's allowed ([§8.3](#83-words-the-caption-and-the-info-panel)).
- Structured data for galleries (JSON-LD).
- A private album inside another page (its words would leave its seal).
- Comments, likes or counts of views on items.
- Sorting or filtering an album by readers.
- Albums inside albums, or folders of albums (the site keeps its three levels; a section is the folder).
- Shared or collaborative albums: another person adding to the owner's album. Sharing a private album to read is a grant ([§12](#12-private-albums)).
- Live albums that fill themselves from a rule (a person, a place, a date), and memories made from the library.
- A map of where pictures were taken (the place is typed text, never coordinates).
- Words of an item's own in one album (D-G24); an article figure keeps its own caption.
- A trash for deleted pictures and albums: git and Save to remote stand in for it (D-G31).
- A "Recently added" order: the order added is kept in `items` and used for undated items, but isn't offered as a sort.
- Video providers beyond YouTube and Vimeo; a video from elsewhere is uploaded as a file.
- A video tile's preview playing on hover.
- The camera and its settings, and a place read from the file's location.
- Captions or descriptions written by AI; only alt text is suggested.

## 20. As built

This section records the first build, which made an album a page of kind `gallery`. That model is superseded by this spec ([§21](#21-from-the-first-build)); what follows is kept as the record of what was built and the evidence for it, and the album phases (A1 to A6 of the [plan](plan.md)) add their own notes after it.

Each phase of the [plan](plan.md) records here what it built, where it differs from this spec, and its evidence. Built, all ten phases: G1 (the model and the media), G2 (the Albums view), G3 (the album page), G4 (the lightbox and its filmstrip), G5 (edit mode's Items view), G6 (the Up front arranger), G7 (private albums, the planet and telemetry), G8 (zoom in the lightbox), G9 (the album block) and G10 (suggested alt text).

**The contract and the checks (G1).** An article has an optional `album` (`src/site/content/schema.ts`: its items, each with `media` or an `embed`, the `showcase` and its tiles, a phone arrangement, the layout and settings), the block `{ "type": "album", "album": <page ID>, "width": "wide" | "full" }`, and the section view `albums`. The limits are named constants there (`ALBUM_MAX_ITEMS` 200, `CAPTION_MAX` 200, `PLACE_MAX` 80, `DRAWING_MAX_BYTES` 200 KB, `STANDARD_PX` 2560, `LARGE_PX` 3840, `PLAY_MAX_TILES` 2, `PLAY_MAX_BYTES` 10 MB, `PLAY_WARN` 4 MB). The rules are pure, in `src/site/content/album.ts`: the kinds and how each is shown, reading order, the checks (`albumProblems`, `albumWarnings`), the counts and the span of dates in words, the presets, the default, `phoneTiles` and `keepPhoneInStep`, the card picture (`cardPicture`) and `resolveAlbum` for the layouts. The loader (`src/site/content/load.ts`) runs them with the rest of V38 to V51: a Gallery page without an album reads as an empty one; a private page's problems are reported without its names; an album's words may link only to its own items (`#item-<id>`, V41). YouTube and Vimeo are one list, `src/site/content/providers.ts`, read by the video block, edit mode and the Content Security Policy. Differs from the spec: a published Gallery page from before albums, whose body still shows its pictures, may have an empty album (V38), and V40 warns for every video file without a caption track, since the check can't hear speech. Evidence: `tests/unit/content.test.ts` ("albums: the content check", a test for each of V38 to V51), `tests/unit/album.test.ts`, `tests/unit/providers.test.ts`.

**The media (G1).** A picture's sidecar can name a drawing (its `file`, and its dark version's, ending `.svg`), the day it was `taken` (a real date, not in the future) and `large` (a still raster picture whose master is over 2560 px and at most 3840 px); a video's sidecar names its caption tracks (`captions`: `<name>.<language>.vtt` beside it, published beside the video by `integrations/content-files.mjs`). A drawing is shown as its file at every size, fitted and never cropped (`Image`'s `drawing`); a GIF is kept as it is. Uploading:
- **An SVG** is kept as a drawing or turned into a picture (`svgAs`). A drawing is cleaned by `src/site/editor/model/svgSanitize.ts`, an allow-list that removes scripts, handlers, `foreignObject`, comments, metadata and editors' data, refuses outside links, entities, embedded pictures over 200 KB together and a drawing over 200 KB, needs a viewBox (or a size to make one) and says what it removed.
- **The date taken** is read by the project's own small EXIF reader (`src/site/editor/model/exif.ts`, no dependency): `DateTimeOriginal`, else `DateTime`, from a JPEG, PNG, WebP, TIFF or (by its header) HEIC or AVIF; a HEIC is read in the browser before it's turned into a PNG. Nothing is guessed from the file's own times.
- **The formats the site can't keep** (JPEG XL, camera RAW, PSD, and MKV, AVI, WMV and 3GP videos) are refused with what to do (`refusedFormat`, `src/site/editor/model/upload.ts`); an animated PNG says before saving that it will be kept still (`isApng`, `APNG_NOTE`).
- **Keep it large** is offered only for a still raster picture over 2560 px; Media's **Make it standard** saves it again at 2560. **Find the focus** measures a picture's focus point on asking, without saving.

The site's weight check, planned for G7, was built here: `scripts/lib/siteWeight.mjs`, a step of `scripts/build-site.mjs`, warns past 750 MB (a `::warning::` in CI) and fails past 950 MB. Evidence: `tests/unit/svgSanitize.test.ts`, `tests/unit/editorUpload.test.ts`, `tests/unit/editorServer.test.ts` ("gallery uploads"), `tests/unit/siteWeight.test.ts`; the E2E group "editor: gallery uploads" (`tests/e2e/editor-media-gallery.spec.ts`).

**The fixture album (G1, item 9).** A made-up album lives in `tests/fixtures/gallery/content/` (article `fixture-album`, its media under `media/articles/fixture-album/`), never in the real content. A `--mode test` build reads it as public content beside the real content: `overlayRootFor` in `integrations/roots.mjs` names the folder only for `astro build --mode test`, the editor integration passes it to the content reader (`__SITE_OVERLAY_ROOT__`, honoured only in test mode) and to the pictures' glob, and the reader adds the overlay's `articles/` and `media/` and appends the pages in its `structures/site.json` to the real section with the same ID (the Gallery section, `talks`), so the album is at `/gallery/fixture-album/` (the rules are in `src/site/content/overlay.ts`; a file whose key the real content already has is refused). Dev and every other build never read it. Edit mode's test server copies the same files into its copy of the content and merges the structure the same way (`addGalleryFixture`). `node scripts/make-gallery-fixture.mjs` makes the album's media deterministically (`--check` checks them): pictures with dates in their EXIF, one large picture, an animated GIF, a drawing and its dark version, a video with a caption track, and posters. It writes the facts in the sidecars, and makes the pictures the upload tests use (`tests/fixtures/gallery/uploads/`: dated, dated only by modification, undated, large). Caption tracks are master files the reader keeps and the build publishes beside their video, at `<base>/media/<owner>/<name>.<language>.vtt`; the reader passes each master's size to the content check (V42, V44, V48). Evidence: `tests/unit/galleryFixture.test.ts`, `tests/unit/album.test.ts`.


**The Albums view (G2).** `IndexLayout` gains the view `albums` and an `albums` prop of bands by node, made by `bandsOf` (`src/site/content/bands.ts`) from each album page; an album page with nothing to show has no band and is left out, and a page that isn't an album shows as a feature card. The Gallery section (`talks`) switched to it in `content/structures/site.json`. Each band is the compound `AlbumBand` (`src/site/components/compounds/AlbumBand.astro`, the `c.album` tokens): an `<article>` named by its title link (its heading level a prop, 2 to 5), its counts and span of dates, Pause where a tile can play, a list of tiles on 12 columns of square cells (6 on a phone), each a link into the lightbox group `band` (`data-tile`, `data-item-id`, `data-kind`, `data-play`, `data-on-phones`), the album's summary, See all ("See all 21 in …") and a quiet break before the next. A drawing without a dark version sits on paper in dark mode. The first band's pictures load first. A tile that plays fetches its file only as it nears the screen and plays muted and looping while at least half of it is in view; Pause is kept for the visit; nothing plays under reduced motion or Save-Data, and without scripts the posters show (`src/site/scripts/albumBand.ts`, its rules pure in `albumBandRules.ts`). Edit mode's Sections offers "Albums" in a section's View. Differs from the spec: the view is a choice in the View select, with no still. Evidence: `tests/unit/albumBandRules.test.ts`, `tests/unit/album.test.ts` ("the band on a phone"); the E2E group "gallery" (`tests/e2e/gallery-pages.spec.ts`: the albums view, the band's keyboard order, names, 44 px tiles and axe in both modes, the phone arrangement with no sideways scroll, tiles that play); the story `AlbumBand`.

**The album page (G3).** The page's items are a compound of their own, `AlbumGrid` (`src/site/components/compounds/AlbumGrid.astro`, the `c.album-grid` tokens), not a mode of `Gallery`: Gallery is close to its line limit, and an album's cells (kinds, badges, words for the lightbox, level rows) share little with a body gallery's. The name isn't `AlbumItems`, which §15 keeps for edit mode's part. It draws the Grid (the justified rows of `justifyGallery`; with captions under the cells, no picture spans two rows and every row keeps room for two lines, so rows stay level: `levelRows`) and the Story (each item whole at the wide width, a portrait no taller than the screen below the header, its caption, credit, description, date and place at the text width). Each cell is `li#item-<id>[data-album-cell][data-kind]` with a link into the lightbox group `album` (`data-lightbox="album"`, `data-kind`, `data-item-id`, `data-album-title`, `data-caption`, `data-alt`, `data-thumb`, `data-full-dark`, `data-thumb-dark`; a video's or an embed's `data-poster`, `data-poster-dark`; a video's `data-video-type`; an embed's `data-embed-src`; `data-download` when the album or item allows it), and its words for the lightbox wait in a `template[data-album-words]` beside it (`data-words="caption|description|credit|taken|place"`). Without scripts every link works: a picture to its largest size, a video to its file, an embed to its page at the provider. The cells' data is made by the pure `albumCells` (`src/site/content/albumPage.ts`), their names, badges and links by `src/site/scripts/albumGrid.ts`; `albumOf` (`opening.ts`) wires them for `Page.astro` and `PlanetPage.astro`, and `ArticleLayout` draws the album's introduction and its items after the opening and before the page's own blocks. The opening shows the counts in words (`measureOf`: also every card's measure for an album page) and the span of dates in place of the date (`ArticleHeader`'s `dates`); an album page's card picture falls back to its first raster item up front (`cardPicture`). Differs from the spec: a video set to autoplay shows its poster in the Grid (the Video fundamental always has its controls; a silent preview waits on a fundamental option), and until G4 teaches the lightbox the kinds, a video or an embed opens there as its poster. Evidence: `tests/unit/albumPage.test.ts`; the story `AlbumGrid` (the grid, captions, every kind, the Story) and ArticleHeader's "An album"; the E2E groups "gallery" (every item in album order at its own address, the span of dates in the opening) and "gallery: without scripts" (every item a working link), in `tests/e2e/gallery-pages.spec.ts`.

**The lightbox (G4).** `Lightbox` (`src/site/components/compounds/Lightbox.astro`) keeps the markup, the styles and a small loader: the script is imported only when a lightbox link is first pointed at, focused or pressed (its click listener runs in the capture phase, so the design library's router never follows the link first), and a link still works as a link if the script can't start. The script is split by concern, each part under its line limit: `src/site/scripts/lightbox.ts` (the group, the counter, the caption, the filmstrip, the keys, warming, following the theme and history), `lightboxAlbum.ts` (reading an item from its link and its cell's `template[data-album-words]`, and fetching a band's album page once per visit), `lightboxStage.ts` (the stage by kind), `lightboxInfo.ts` (the info panel, Download and Copy link) and `lightboxZoom.ts` (G8). Their rules are pure in `lightboxRules.ts` (an item from its link, the band's group with placeholders, the fallback, the warming order, the history mode, every name and word, the download's label and file name) and `zoomRules.ts`. What was built, by the spec's sections:
- **The group ([§8.1](#81-opening-and-the-group)):** the album page's cells (`data-lightbox="album"`); from a band (`data-lightbox="band"`, each tile's `data-index`, the band's `data-count`), the album's places at once, the tiles at theirs and placeholders between, so the counter reads "2 of 21" before the album page arrives; the page is then fetched (`fetchAlbum`) and read from its cells in album order, and the item on the stage stays put. When the fetch fails, the band's own tiles in album order, with "See all 21 in the album" at the strip's end. An album block's band (G9) opens the same way. Other groups are unchanged, with Back and the single Tab stop added.
- **The stage ([§8.2](#82-the-stage-by-kind)):** a picture and its dark version; an animated picture playing, with Pause and Play over its corner, starting paused on its still (`data-still`, `data-still-dark`) under reduced motion; a drawing measured to fill the stage, on the paper panel (`c.lightbox.drawing-paper`) in the dark when it has no dark version; a video file's player (`controls`, `playsinline`, `preload="metadata"`, its `data-loop`) with every caption track from `data-tracks`, playing only when it was pressed open; an embed's poster with a round Play in its middle, focused, its player made only after the press (fitted to the stage in the video's own shape by `fit`, like a drawing) and removed on moving on. The poster is hidden while a player shows (`.stage-image[hidden]`: base.css's `img { display: block }` beat `[hidden]`, and the poster's zoom transform painted it over the playing video, fixed 27 October 2026); the dialog clips rather than hides its overflow, so the filmstrip scrolling an item into view never scrolls the dialog sideways past the smoke.
- **Words ([§8.3](#83-words-the-caption-and-the-info-panel)):** the caption under the stage, with More when there's a description; the info panel (Info, or I) beside the stage past the 56 rem breakpoint at `c.lightbox.info-width`, a column behind a hairline rule (no card: 27 October 2026, when the lightbox also dropped its `--size-max` width to give the media the whole viewport, its single grid column `minmax(0, 1fr)` so a phone's top bar shortens the title instead of pushing Close and the stage off screen), over the stage's foot on a phone, kept open or closed for the visit (`sessionStorage`), the caption moving into it; the date taken and the place, the credit, a video's length (`data-duration`), an embed's Watch on YouTube or Vimeo, Download with its kind and weight where `data-download` allows it, and From the album with Open the album (left out on the album page).
- **The filmstrip ([§8.4](#84-the-filmstrip)):** every item with its kind's badge and its name ("Show 7: …"), one Tab stop with a roving tab index, the arrows, Home and End moving the stage with the focus.
- **Addresses ([§8.6](#86-addresses-back-and-sharing)):** `#item-<id>` pushed on the album page and replaced as it moves, a state entry elsewhere, nothing in the planet's frame (`html[data-frame="planet"]`); Back closes, closing unwinds the entry, and a page loaded at `#item-<id>` opens there and closes to its cell. Copy link gives the album's address on the site plus `#item-<id>`, announced, or the address selected in a field where the clipboard can't be written.
- **Warming ([§8.7](#87-loading)):** a group of 24 or fewer whole, nearest first; a larger one 4 either side, again after every move; never a sealed file.

The cells and tiles gained the attributes the stage needs: `AlbumGrid`'s links `data-stage` (a large picture's stage size), `data-still`, `data-still-dark`, `data-duration`, `data-tracks` and `data-loop`; `AlbumBand`'s tiles `data-lightbox="band"`, `data-index` and `data-count`, and its root `data-album-site`, the album's address on the site, which Copy link reads so that a band inside the planet's frame still gives the site's address (Open the album and See all keep the address in the frame, so the reader stays in the building). Opening dispatches `site:lightbox` on the document with `{ place: 'band' | 'album' | 'page', kind }`, nothing else, for telemetry to listen to (G7). The tokens added: `c.lightbox.info-width` and `c.lightbox.drawing-paper`; the icons Info, Download, Copy and Link were already in the set. Differs from the spec:
- **The stage shows one size,** the 2560 px picture (a large picture's `data-stage`), as the article lightbox did, rather than a width chosen from 960, 1600 and 2560 for the stage; and a slow picture isn't shown as its softened thumbnail first: items cross-fade as before, and warming has the neighbours ready.
- **Download's file name** is `<album title's slug>-<item id>.<ext>` (`fileSlug`, "album" when there's no title), never from the address, which for a private album is its secret token; §8.3 says so.

Evidence (passed, 22 October 2026): `tests/unit/lightboxRules.test.ts`; the E2E group "gallery: lightbox" (`tests/e2e/gallery.spec.ts`, 11 tests: from a band with the album page's fetch held back, the fallback when it fails, one test per kind including reduced motion, the keyboard, addresses and Back with Copy link, downloads, and the story `Lightbox`'s "An album"); "gallery": "an album in another page: a tile opens the lightbox on the whole album" (`tests/e2e/gallery-block.spec.ts`); "planet": "reading on the planet: albums…" and "…a band's Copy link in the frame gives the site's address" (`tests/e2e/planet.spec.ts`); the article lightbox's "site design system" test in `tests/e2e/site.spec.ts`, unchanged and passing.

**The Items view (G5).** Pages has **New album** beside New page and New article (the same form, with the kind Gallery), which opens the new album on its Items view; the list shows an album's kind as Album. In the page's settings an album's kind is locked, other pages can't choose Gallery, and an **Album settings** group holds the layout (Grid or Story), Captions under pictures (Grid only), Show dates taken, Allow downloads and the album's introduction; a default removes the field (`AlbumSettings`). An album's editor has three views, links in the top bar's tools (`data-album-view`, `?view=items` and `?view=front`), sharing one undo history. **Items** (`AlbumItems`, `AlbumItemDetails`, `AlbumAddForms`, the script `src/site/editor/scripts/album.ts`) is the cards in album order beside the chosen card's details, as §9.2 says: Add from the library, Upload (a batch, each file with its alt text, caption and the date read from the file, and Use all suggestions), Add a video link ("Add a YouTube or Vimeo video": `src/site/editor/server/albumEmbed.ts` asks the provider for the title, shape and Vimeo's length, and keeps its thumbnail as the site's own picture, alt text "Still from: <title>"), Sort by date taken, the album's weight under the grid; Shift and Ctrl choose several, a drag or Alt with an arrow moves them (Alt+Home and Alt+End to the ends), Delete removes, and every change saves at once and can be undone. The operations are pure in `src/site/editor/model/album.ts`; the cards, counts and weight come from `src/site/editor/server/albumItems.ts`. Media's Used in lists the albums a picture is in. Differs from the spec: a picture's own alt text, date taken and focus point are shown in the details with a link to Media, where the alt text and the focus point are changed; no screen changes the date taken yet: it's read from the file on upload, and Replace fills it when the sidecar has none (the first spec's §9.2, Items); Pages shows no counts; until G6 the Up front view says the arranger comes next, and the Up front switch in Items puts an item in the band's next free place. Evidence: `tests/unit/editorAlbum.test.ts` (adding, removing, ordering, Sort by date taken, up front, the settings, every override back to automatic, the cards and the weight); the E2E group "editor: albums" (`tests/e2e/editor-albums.spec.ts`); the stories `AlbumItems`, `AlbumItemDetails`, `AlbumAddForms` and `AlbumSettings`.

**The arranger (G6).** Up front (`?view=front`, `&show=phone` for the phone's band, `&tile=` for the chosen tile) is the part `AlbumArranger` (`src/site/editor/components/AlbumArranger.astro`, its script `scripts/arranger.ts`, its story), drawn from `albumArrangerView` (`src/site/editor/server/albumArranger.ts`). Its rules are pure in `src/site/editor/model/arranger.ts`: whole cells on the 12 columns (6 on phones), a tile 2 to 12 cells each way (at most 8 rows on phones), never overlapping; a tile dropped on one of its size swaps with it, anywhere else it pushes what it covers down in reading order, and a change that would pass 12 rows is refused with its reason. Arrows move the chosen tile a cell, Shift with them resizes it; the inspector's buttons do the same; each move is said in a live line outside the redrawn region (its columns and rows), and each refusal is said there and in the status line ("Not saved: …"), changing nothing. The pointer drags a tile to a cell, its right, bottom or corner handle to a size, a tray item into the band and a tile out to the tray, with a dashed outline marked `data-refused` while the drop would be refused; the handles and the drag are the pointer's alone (`aria-hidden`). Every change is saved through the article's own save (`PUT articles/<id>`, its version checked, a conflict opens the conflict dialog), shown at once, kept in the article editor's history (Undo and Redo in the part), and the region drawn again when saved. The phone's band is worked out (nothing moves) until **Arrange for phones** copies it as the owner's; **Back to automatic** drops it. While it's the owner's, a tile put up front wide joins its end and one taken out leaves it, and the live line says so. **Use the default** removes the whole arrangement, the phone's too. Every way back leaves the file as it was before the override, except where §6.3 says otherwise (Show on phones with a phone arrangement puts the tile back at its end) and Use the default (which removes the arrangement); a band that comes back to the default's tiles with no phone arrangement left is dropped from the file. No new tokens: the phone's canvas is `--c-editor-inspector` wide. Data attributes for tests: `data-album-arranger`, `data-arranger-canvas`, `data-arranger-place` and `data-arranger-tile` (a tile), `data-arranger-handle`, `data-arranger-outline`, `data-arranger-tray-item`, `data-arranger-show`, `data-arranger-preset`, `data-arranger-phone-arrange`, `data-arranger-phone-back`, `data-arranger-default`, `data-arranger-close`, `data-arranger-live`, and the inspector's `data-arranger-move`, `-size`, `-display`, `-focus`, `-focus-reset`, `-play`, `-phones`, `-remove`. Evidence: `tests/unit/editorArranger.test.ts` (every §18 row the arranger owns, on an arranged band and the default one, the file compared after its way back); E2E "editor: albums": "the arranger by drag…", "the arranger by keyboard…", "arranging for phones…" (all three passed).

**Private albums, the planet and telemetry (G7).** What was built, by the spec's sections:
- **A private album's band ([§12](#12-private-albums)):** in the Albums view, `IndexLayout` draws a private album's band (its `div.album` holding the `AlbumBand`) inside the section's sealed cards, a `template[data-sealed]` that names no album, placed after the node it follows so it opens in the section's order. `Page.astro` lists only open albums in the public HTML and hands each sealed page its band (`privateBands`). The sealed runtime (`src/site/scripts/sealed.ts`) decrypts it in place for a covered reader, as it does a card, then dispatches `astro:page-load` so the band's and the lightbox's scripts set it up.
- **Its album page** is sealed whole (`<!--sealed:main-->`), cells, words and links included, like any private page ([access spec §5.4](../access/spec.md#54-sealing-a-page)).
- **Its files:** the sealer (`integrations/seal.mjs`) swaps every private file's address in a sealed region for its sealed copy, wherever it sits: a `srcset`, a tile's `data-src` and `data-srcset`, a link's `href`, `data-full`, `data-thumb`, their dark versions, a poster, a still, the stage size, `data-download` and `data-tracks`; a `src`, `srcset` or `poster` becomes `data-sealed-*`, so the browser never fetches a sealed file as a picture or a video. The runtime decrypts each file once (a cache in `decryptMedia`). A press on a sealed lightbox link decrypts its group's attributes first (a band's own tiles, or every link of the group on the page; of a `srcset`, only the width the screen needs), then presses it again. A band's tiles that play wait without `data-plays` until their files are decrypted (`unsealMotion`), so a tile never asks for a sealed file.
- **The leak check (`scripts/verify-sealed.mjs`)** gained a private album's words (its introduction, and each item's caption, title, place, credit and description), the cue text of a private video's caption tracks (`.vtt`, never its timings), and a structural check: no private file's address may be readable anywhere in the build, in a page's HTML, a link or a band.
- **The fixture:** a made-up private album in `tests/fixtures/private-pages/` (in the section `talks` with the public fixture albums: a picture with its dark version, a video with its poster and an English caption track, and a second picture). One existing test code covers it and another doesn't, for the negative case.
- **The planet ([§13](#13-on-the-planet)):** `PlanetPage.astro` shows an albums-view section as bands (`bandsOf`), open albums only, never a private one, sealed or not (V28). Each band's links are its address in the building (`/play/<building>/<album>/`), so Open the album and See all stay inside the building through the frame's link rules. `AlbumBand` gained `site`, written as `data-album-site`, the album's address on the site, which the lightbox's Copy link reads. In the frame (`html[data-frame="planet"]`) the lightbox adds no history.
- **Telemetry ([§14](#14-telemetry-search-and-sharing)):** `lightbox_opened` carries `place` and `kind` only. The always-on part listens for the lightbox's `site:lightbox` on the document; `lightboxProps` (`telemetrySanitize.ts`) turns a band into `section` on a section's page or `block` in an album block, `page` into `article`, and keeps `album`; the kinds are picture, animated, drawing, video and embed. `video_played` says `place: 'lightbox'` for a video in the lightbox's player, and nothing for a band's tile playing on its own (`videoProps`); zooming and downloading send nothing. The event is in both allowlists (`telemetrySanitize.ts` and the E2E's), and `maskTokens` replaces a private page's token in every string, so a private album's page view and `access_opened` say `private`. The access spec's event table lists it ([access §9.2](../access/spec.md#92-whats-recorded)).

Differs from the spec:
- **A private band's lightbox shows the band's own tiles,** the fallback [§8.1](#81-opening-and-the-group) gives when the album page can't be read: the page it would fetch is sealed. See all opens the album page, which shows every item.
- **Download's file name** is the album title's slug and the item's ID (G4's `fileSlug`), never the address: for a private album the address is its secret token. The E2E checks no part of the token is in the file name.
- **A private video's playing** isn't asserted in the E2E (the test browser's codecs vary): it checks that the tile's file, the player's source and its caption track are decrypted copies (`blob:` addresses), and that no lightbox link still points at a sealed file once its group has opened.

Evidence (passed, 22 October 2026): the E2E group "protected content: a private album" (`tests/e2e/protected.spec.ts`): "signed out or uncovered: its band stays sealed in the Albums view, its page is gated, and nothing of it is readable", "a covered reader: the band opens in its place with its pictures, its playing tile and the lightbox; the page opens with every item, its video and downloads", and "telemetry: the lightbox says where it opened and what kind, never which; nothing for a band playing or a download; no ID, title or token leaves"; in "planet" (`tests/e2e/planet.spec.ts`): "reading on the planet: albums show as bands in the Amphitheater, an album page opens in the building, its lightbox adds no history, and Copy link gives the site's address" and "reading on the planet: albums, a band's Copy link in the frame gives the site's address"; `verify-sealed.mjs` on the test build. Unit: `tests/unit/sealed.test.ts` (the leak check's new cases), `telemetry.test.ts` (`lightbox_opened`, `video_played`'s place, the tokens), `content.test.ts` and `editorAccess.test.ts` (the private fixture), `galleryFixture.test.ts`, `protected.test.ts`.

**Zoom (G8).** `src/site/scripts/lightboxZoom.ts` zooms the stage, its rules pure in `src/site/scripts/zoomRules.ts`: offered for a picture whose largest width is at least 1.5 times the width shown (`OFFER_AT`), up to that width (2560 px, 3840 px when kept large: `largestWidth`), and for a drawing always, up to 4 times (`DRAWING_MAX`); never an animated picture, a video or an embed, where the buttons are hidden and the stage leaves the browser's own pinch zoom alone (`touchAction`). Zoom in and Zoom out sit in the top bar (`data-lightbox-zoom`, the icons imported as `zoom-in` and `zoom-out`), stepping by half again (`ZOOM_STEP`) and disabled at their ends; + (or =), − and 0 do the same; Ctrl and the wheel, or a trackpad's pinch, zoom round the pointer (the wheel alone never zooms: `wheelFactor`); a double-click or double-tap goes to full size round that point and back (`toggleScale`); a two-finger pinch zooms round its centre (`pinchScale`); while zoomed a drag or the arrow keys pan (`dragPan`, `panBy`), never past the stage's edge (`clampPan`), and a swipe moves between items only at the whole item (`swipeAllowed`). Escape fits first and a second closes (the dialog's `cancel` is refused once after an Escape that fitted); moving on, by any means, starts the next item whole. The item moves by one transform the stylesheet reads (`--zoom-scale`, `--zoom-x`, `--zoom-y`), easing at `--duration-base`, jumping under reduced motion (`base.css`'s rule for every transition) and during a gesture; the level is said in a polite live region ("Zoomed to 200%", `zoomAnnouncement`), at once for a button or key and after a pause for a pinch or the wheel. The largest size is asked for only when zooming starts, and only when it's larger than what the stage holds; until it arrives the stage's size is enlarged. Differs from the spec: a drawing is zoomed by the same transform rather than drawn again at each level; the browser redraws the vector when the transform settles. Evidence (passed, 22 October 2026): `tests/unit/zoomRules.test.ts`; the E2E group "gallery: zoom" (`tests/e2e/gallery.spec.ts`): "the buttons and + − 0, the level announced, Escape fits then closes; the largest size fetched only when zooming starts", "Ctrl and the wheel, a double-click, a drag to pan; the wheel alone never zooms, and moving on starts whole", and "on a touch screen": "a pinch zooms, a drag then pans without moving, and a swipe moves only at the whole item", with real touch events (CDP `Input.dispatchTouchEvent`).

**The album block (G9).** The block palette has **Album** ("One of the site's albums, as its band, with See all"); its chooser lists every album by title and disables one the page can't show, with the reason (`src/site/editor/model/albumBlock.ts`, V51), and the inspector sets its width (wide or full). `Blocks.astro` draws the album's `AlbumBand` at that width, its heading one level below the heading it follows, or a heading 2 (`albumHeadingLevel`, `src/site/content/albumBlock.ts`). In edit mode's canvas an empty album says it has nothing to show yet. An album a page shows can't be made private or deleted, nor taken back to draft while a published page shows it; edit mode refuses, naming the pages. The whole album in the lightbox, from the block, waits on G4. Evidence: `tests/unit/albumBlock.test.ts`; the E2E groups "editor: albums: the album block" (`tests/e2e/editor-album-block.spec.ts`) and "gallery" (`tests/e2e/gallery-block.spec.ts`: the band at the block's width under the page's heading, See all to the album, no sideways scroll on a phone).

**Suggested alt text (G10).** As §9.6 says, built in `src/site/editor/server/aiAlt.ts` (the request) and `src/site/editor/model/altText.ts` (the answer's rules, at most 250 characters), shown by the kit's `AltSuggestion` in Media's upload and details and the album's batch upload. What it sends, the switch and the AI screen's picture Test are recorded in [AI services](../editor/ai-services.md). Evidence: `tests/unit/altText.test.ts`, `tests/unit/aiAlt.test.ts`; the E2E group "editor: suggested alt text" (`tests/e2e/editor-alt-text.spec.ts`).

### 20.1 The album phases (A1 to A6)

Built 23 and 24 October 2026, waiting on the owner's review of the whole experience. Until he has reviewed it, the evidence is the type check, the unit tests and `npm run verify:prod`; the E2E groups "gallery" and "editor: albums", the axe runs and the screenshots are made after his review, so a change he asks for isn't tested twice.

- **The contract (A1).** An album is `content/albums/<id>.json` (a private one `private-pages/albums/<id>.json`), placed by `{type: "album", id}`, in `src/site/content/schema.ts`; the rules V38 to V55, `albumOrder`, `albumsOrder` and the cover's default with its lead are pure in `src/site/content/album.ts`. The site draws an album with `AlbumLayout`; `IndexLayout`'s albums view, the album block, cards, the head and the planet's frame read the album files. `ArticleLayout` lost its album branch. Words are read from the pictures' sidecars.
- **The library (A1, A3).** Every upload gets a fingerprint, and a file already in the library is added from there and said so (V55). `scripts/fingerprint-library.mjs` added fingerprints to the existing library; two byte-identical pictures were left for the owner. A video file's date is read from the file. A YouTube or Vimeo address becomes a linked video, a library item with its own poster (`server/albumEmbed.ts`); one already in the library is reused. `server/libraryIndex.ts` answers what uses an item, and finds an item by fingerprint or address.
- **The Albums screen and the album editor (A2).** `/_edit/albums/` (`AlbumCards`) and `/_edit/albums/<id>/`: the words typed in place (`AlbumWords`), the cover drawn as its band, the items on the kit's `PhotoGrid`. The grid groups items by day while the order is by date, and days flow side by side as in Google Photos; the arrow keys move by the cells' positions. Add album makes an untitled draft at once, with no dialog. Every change saves through the store with undo. A long title in the top bar is kept to one line and cut with an ellipsis (the recipe `data-title-line`, the token `c.editor.title-min`).
- **The viewer and the words (A3).** `AlbumViewer` (`?item=` in the address) and `MediaInfo` beside it: every field is the picture's, saved to its sidecar (`PUT media-words`), with Also in. The selection's actions are `AlbumBulk`: Set the date, Set the place, downloads (and, on the Media screen, Add to album). Review alt text (`?review=1`) steps through the pictures without it.
- **The cover (A4).** Edit cover (`AlbumCoverEditor`, its rules in `model/cover.ts`) arranges the band by drag and by keys, for the phone too, and Use automatic cover removes the arrangement. At rest the Cover section draws the album's real `AlbumBand` at the column's full width, from what's saved (27 October 2026, the owner's review: what I see is what I get); it's inert, since its links lead nowhere in edit mode, and shows stills only (with their play badges), since nothing may play where its Pause can't be reached. The compact preview's token `c.editor-album-cover.preview` is deprecated.
- **The library screen (A5).** Media is the library on `PhotoGrid` and `MediaInfo` (`MediaLibrary`, `server/mediaLibrary.ts`, `model/library.ts`): the timeline by month taken, the Show filter (Not in any album, In albums, Needs alt text, the kinds), Used in, Add link, and a selection's Add to album, Set the date, Set the place and Delete. Delete names the albums the pictures leave, and is refused while an article uses one. Sections lists a section's albums tagged Album, with the gallery's order in its Settings; the action center finds albums and Add album. The selection is shared by the album editor and the library (`scripts/photoSelection.ts`).
- **Private albums (A6).** Settings' "Who can see it" moves the album file and its own folder between `content/` and `private-pages/` in one store transaction (`server/access.ts`, the code behind `setPageAccess`). A private picture also used elsewhere stops it, naming the page (V52); one used nowhere else is moved into the album's folder after asking. A grant's scope lists private albums. An open album's page carries its canonical address. The first build's leftovers are gone, and `content.test.ts` searches `src/` for them (DoD row 49).
- **Two columns and the gallery's setup (24 October 2026, the owner's review).** The album editor opens in two columns: `AlbumList` (the gallery's entry, Add album, Show as tiles, the gallery's albums with a drag handle each, then "Not in the gallery") beside the album, in a `SplitView`. The Albums screen switches between tiles and that list (`?view=list|tiles`, remembered in the cookie `editor.albums.view`; `?new=1` always shows tiles); the list's first entry opens `GallerySetup` (title, description, order of albums, and the section when there's more than one gallery). Dragging an album, or Alt with an arrow key, saves the gallery's order as Your order (`PUT gallery/<section>/order`); the setup saves with `PUT gallery/<section>`. The rules are pure in `src/site/editor/model/gallery.ts`, the writes in `server/gallery.ts`. The album editor's Preview in the gallery dialog was removed on 27 October 2026: the Cover section now draws the same band at rest.
- **Cover backgrounds and corners (25 October 2026, the owner's review).** Edit cover's toolbar is one row (the part's own `data-cover-toolbar`, not an `ActionBar`, which wraps). The chosen tile's bar has a Background row (`scripts/coverBackground.ts`): Auto, up to five colours extracted from the picture (`extractColors`), a `ColorField` and the browser's `EyeDropper`, hidden where there's none; `setBackground` in `model/cover.ts` writes the tile's `bg`, which `AlbumBand` draws behind the picture. The gallery's setup has a Rounded corners switch, saved as the section's `albumCorners: "square"` when off; `albumSquare` (the repository) makes every band of that section's albums square.
- **A simpler canvas (25 October 2026, the owner's review).** A tile is the `bare` `TileButton`: just its picture, edge to edge, with the band's gap and the gallery's corners (`data-square`); chosen, a ring inside its edge. The resize handles are invisible hit zones with their cursors. Preview (`data-cover-preview`) hides the arranger's chrome and makes the canvas inert.
- **The tile bar's groups (25 October 2026, the owner's review).** Related buttons are joined in the new `ButtonGroup` fundamental (Wide and Phone; Move; Width; Height; By kind, Fill or Fit; Auto) rather than separate pills. The bar is a header (the tile's name, its place, Remove from cover) over a two-column form of labelled rows. A swatch is the colour itself, edge to edge (a `bare` `TileButton` in a cell of that colour, ringed when chosen), and the picker and eyedropper sit apart from the picture's colours.
- **The studio and its inspector (28 October 2026, the owner's request).** The album editor is the article editor's `Studio`, in its `flow` form (the canvas holds the screen's own markup and scrolls in place): `AlbumList` docked as the outline (`ListPane docked`, hidden below the widest breakpoint), the cover and the items as the canvas, and `AlbumInspector` (the article editor's `Inspector` shell, now the recipe `[data-inspector-shell]` in `editor-recipes.css`, which both share) with its **Selection** (`AlbumSelection`) and **Album** (`AlbumForm`) tabs. `AlbumWords` and the Settings sheet are gone; the header lost Preview and Settings. A press selects one item and shows it in the inspector (Ctrl or Cmd adds, Shift a range), a double-click or Enter opens the viewer, and the selection is kept in the address (`?selected=`, read by the server, which draws the tab: `model/albumInspector.ts`, pure, decides what one or several items share). One picture's `MediaInfo` takes `scope="inspector"`, which sets its groups as the inspector's sections; several share their date taken and place (saved to each sidecar through `PUT media-words`) and their downloads; a text card's words save as they're typed. The selection bar keeps Move to start, Move to end, Remove from album and Clear selection. `scripts/albumInspector.ts` draws the tab again when the selection or the album changes, but never under a field being typed in. Evidence: `tests/unit/editorAlbumInspector.test.ts`; the E2E group "editor: albums: the inspector" (`tests/e2e/editor-albums.spec.ts`: the studio and axe, click and Ctrl, the address across a reload, a place set on several pictures saved to each sidecar, a text card's words); the stories `AlbumInspector`, `AlbumSelection`, `AlbumForm`, `Studio` (Flowing) and `MediaInfo` (In the album's inspector), with their screenshots.
Differs from the spec, or not built yet:
- **The list's reorder has no single-pointer alternative yet** besides the keys (WCAG 2.5.7), and the gallery's setup shows no preview of its bands.
- **Edit cover's tray** is a strip of the album's items inside the panel, not the album's grid below it ([§9.6](#96-the-cover)).
- **Not built yet:** in the viewer, Add to cover and Remove from cover, dragging the focus point, caption tracks, Change poster and Turn into a picture (a description's link is typed in the browser's own prompt); in Edit cover, dragging the focus point and the phone view's tile controls; dropping files on the Albums screen and on the library's timeline (the library's list view, `?view=list`, uploads); Related and the RSS feed leave albums out.

Evidence so far: `tests/unit/album.test.ts`, `albumPage.test.ts`, `albumBlock.test.ts`, `content.test.ts` (V38 to V55, the leftovers search), `editorAlbum.test.ts`, `editorAlbumViewer.test.ts`, `editorGallery.test.ts` (the list and the gallery's setup), `editorArranger.test.ts` (the cover), `editorLibrary.test.ts`, `editorAccess.test.ts` and `protected.test.ts` (private albums and grants), `editorDesignSystem.test.ts`; `npm run check`; `npm run verify:prod` (the leak check on the test build and the bundle budgets).

## 21. From the first build

The first build (G1 to G10, [§20](#20-as-built)) made an album a page of kind `gallery` with an `album` field, edited by the article editor's Items and Up front views. This spec replaces that model ([D-G2](#17-decisions), [D-G13](#17-decisions)). Most of what was built is the reader's side and stays; the model and edit mode change.

| Built in G1 to G10 | Becomes |
|---|---|
| The band (`AlbumBand`), the bento grid, its presets, the phone rule and arrangement, tiles that play | Kept. It reads `cover` instead of `showcase`, and its default takes `cover.lead` into account |
| The album page's items (`AlbumGrid`), the Grid and the Story | Kept, drawn by the new `AlbumLayout`, in the order `albumOrder` works out, with text cards |
| The lightbox, the filmstrip, zoom, Copy link, downloads, history | Kept. Its group skips text cards |
| Drawings, the SVG sanitizer, EXIF dates, the focus point, refused formats, Keep it large | Kept. An SVG becomes a drawing without asking; Keep it large becomes the album's setting and the viewer's Make it standard |
| Providers and the video's details from oEmbed | Kept, made into the linked video sidecar in the library |
| The pure rules (`album.ts`: presets, default, `phoneTiles`, reading order, counts, span of dates) and the arranger's operations | Kept, renamed from showcase to cover, with `albumOrder` and the cover's lead added |
| Sealing, the leak check, telemetry, the planet's frame | Kept, for the album resource |
| Suggested alt text | Kept, with the review queue added |
| An album as an article of kind `gallery`, its `album` field | Retired: an album file of its own (V43) |
| An item's `embed`, `title`, `poster` and `duration` | Retired: a linked video is a library item |
| An item's `caption`, `description`, `place` and `taken` overrides | Retired: the words are the picture's (D-G24) |
| `showcase` and Use the default | Renamed: `cover`, Use automatic cover |
| The article editor's Items and Up front views, `AlbumItems`, `AlbumItemDetails`, `AlbumArranger`, `AlbumSettings` as built | Replaced by the Albums screen and the album editor ([§9](#9-edit-mode)); the arranger's canvas moves into Edit cover |
| New article → Album, and Pages' Album filter | Retired: Add album on the Albums screen |
| The album block naming a page | Names an album ID |
| `ArticleLayout`'s album branch | Retired: `AlbumLayout` |

- **No real content to move.** The site's real content has no album yet. The made-up ones (`fixture-album`, `fixture-captions`, `fixture-story` and the private one) are rewritten as album files, their items' words moved into their pictures' sidecars, so the tests keep their subjects.
- **The rules keep their numbers.** V38 to V51 are restated for the album resource ([§16](#16-rules)); their tests are rewritten to match, and V52 to V55 are added.
- **Pictures don't move.** Media IDs never change, so the fixtures' pictures stay where they were made (`media/articles/fixture-album/` and the like), as any library item may: the folder is only where a picture was made ([§9.4](#94-adding)). New albums make theirs in `media/albums/<id>/`.
