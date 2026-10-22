# The gallery: albums

The Gallery section becomes a place to look: a scroll of albums, each shown by a few pictures the owner chose, set in a bento grid he arranges himself, with its title above and a few words below. Every album has its own page with everything in it, and pressing any picture, drawing or video opens the site's lightbox, now with the whole album in its filmstrip and each item's words beside it. This page is the spec: the model, the media, the views, the lightbox, edit mode, and the rules and decisions behind them. The [plan](plan.md) splits it into phases with its Definition of Done.

> **TL;DR.**
> - **An album is a page** of kind Gallery (shown as Album) with an `album` field: its items in their order, each a picture, a drawing, an animated picture, a video file or a YouTube or Vimeo video, with a caption and a short rich-text description. It keeps the page's address, status, access and editor.
> - **The Gallery section shows albums, not cards.** A new section view, Albums, sets each album as a band: its title and counts, a bento grid of the items the owner put up front, the album's short description and "See all 21", then a quiet break before the next.
> - **The bento grid** is 12 columns of square cells. A tile spans whole columns and whole rows (2 to 12 of each), so every edge snaps. On a phone the same arrangement is redrawn on 6 columns by a fixed rule, unless the owner arranges the phone's band himself.
> - **Up front is curated:** which items have a tile, where and how big. Until the owner arranges it, the band shows the album's first items in a preset that suits their number; the arranger in edit mode moves and resizes tiles by dragging or with the keyboard, swapping or pushing tiles down, never overlapping.
> - **Automatic first, override anywhere.** Every choice has an answer worked out from the content: the band, each picture's focus point, the phone's layout, the date each picture was taken, an embed's poster and details, and alt text suggested by the owner's AI service. He overrides any of them where he wants, and Back to automatic removes the override ([§18](#18-automatic-and-where-to-override-it)).
> - **The album page** has the album's introduction, then every item in a justified grid (or, as Story, one after another with their words), each with its own address (`#item-<id>`). An album can also be shown inside any page, as an album block.
> - **The lightbox** keeps its smoke scrim and gains: the whole album in the filmstrip (even when opened from the section page), videos and YouTube or Vimeo on the stage, an info panel with the caption, description, date and place, zoom where there's more to see, Copy link, downloads where the owner allows them, and Back to close.
> - **Edit mode:** an album's editor gains two views, Items (add, order, caption and describe) and Up front (the arranger). Every change saves, shows at once and can be undone.
> - **SVG stays a drawing** when the owner asks: sanitized, sharp at any size, with an optional dark version.

<details>
<summary>What was asked, and where it's answered</summary>

| # | The owner's request | Where | Phase |
|---|---|---|---|
| U1 | A gallery made of collections or albums | [§3](#3-the-model) | G1 |
| U2 | The gallery's main view lists them in a visually rich way | [§5](#5-the-albums-view) | G2 |
| U3 | Each shown by its title, a bento grid of its media, and an optional short description | [§5](#5-the-albums-view), [§6](#6-the-bento-grid) | G2 |
| U4 | A visual break, then the next album, scrolling to explore | [§5](#5-the-albums-view) | G2 |
| U5 | Every type of media: images of every format, videos, SVG, YouTube, Vimeo | [§4](#4-media) | G1, G4 |
| U6 | A caption for each item and for the album | [§3.4](#34-where-the-words-come-from) | G1 |
| U7 | An optional, more detailed description for each item, with simple rich text | [§3.5](#35-rich-text), [§8.3](#83-words-the-caption-and-the-info-panel) | G1, G4 |
| U8 | The same for the whole album | [§3.4](#34-where-the-words-come-from), [§7](#7-the-album-page) | G3 |
| U9 | Choose the items of each album by hand | [§9.2](#92-items) | G5 |
| U10 | Choose which items are shown up front; the album holds more | [§3.2](#32-the-album-field), [§9.3](#93-up-front-the-arranger) | G6 |
| U11 | Rearrange their order | [§9.2](#92-items), [§9.3](#93-up-front-the-arranger) | G5, G6 |
| U12 | Adjust the bento layout, snapping to a column grid | [§6](#6-the-bento-grid), [§9.3](#93-up-front-the-arranger) | G6 |
| U13 | Snapping to multiples of the row height | [§6.1](#61-the-grid) | G6 |
| U14 | Pressing an item opens the lightbox with the smoke scrim, with a filmstrip of the whole album | [§8](#8-the-lightbox) | G4 |

</details>

## 1. Where things stand

- **The section.** Gallery is one of the first sections (its node ID is still `talks`, renamed on 13 October 2026; [sections spec §3.6](../sections/spec.md#36-the-first-sections)), at `/gallery/`, in the list view, with no pages yet. The Amphitheater on the planet shows it.
- **The page kind.** A page can already be of kind `gallery` ([sections spec §3.3](../sections/spec.md#33-pages-one-resource-several-kinds-u7)): its opening shows the number of pictures instead of a reading time, and its body is the usual blocks, usually galleries and carousels. Nothing in it says which pictures lead, and a gallery block's items can't carry more than a plain caption.
- **The gallery block** lays out two or more pictures or video files as a justified grid, a mosaic or a row ([media §9.2](../content/media.md#92-justified-galleries)), each item with an optional plain caption. A video file plays in its cell.
- **The lightbox** is one per page: a modal dialog with the smoke scrim (paper-white in light mode, black in dark), Previous and Next, a counter, the caption and a filmstrip of the group it was opened from. A group is every link on the page with the same `data-lightbox` value, so a block's filmstrip shows that block only, and every thumbnail in it is its own Tab stop. It shows pictures only, warms the whole group when it opens, and has no address or history of its own.
- **Media.** Pictures are kept as WebP masters (lossless when they have transparency); GIFs are kept byte for byte and animated WebPs keep their frames, each with a still poster ([media §5](../content/media.md#5-the-pipeline)). An SVG upload is turned into a picture: the "Vector diagram" row of [media §4](../content/media.md#4-formats-and-budgets) was never built. Video files are MP4 or WebM under 100 MB ([media §12](../content/media.md#12-video-files)); YouTube and Vimeo come in through the video block's `embed`, with a poster of the site's own and a player made only on a press.
- **The old model.** The content model's Gallery resource ([model](../content/model.md#gallery)) was never built: structures refuse it, and "a gallery" has meant a page of kind Gallery since the sections spec.

What's missing is everything between a page of pictures and an album: a chosen few up front, a layout the owner shapes, words for each item, video and embeds in the same set, and a lightbox that knows the whole album.

### 1.1 What this spec adds to the request

The request covers what a reader sees and what the owner curates. A complete feature also needs these, so the spec decides them:

| Gap | Decided in |
|---|---|
| A name that doesn't clash with the site's existing "collection" block | [D-G1](#17-decisions) |
| Where an album lives (a page, a section, an address) and how it's private | [§3.1](#31-an-album-is-a-page), [§12](#12-private-albums) |
| A stable address for every item, so it can be linked and shared | [§3.3](#33-fields), [§8.6](#86-addresses-back-and-sharing) |
| Alt text for every item, and names for videos | [§3.4](#34-where-the-words-come-from), [§10](#10-accessibility) |
| A layout before the owner arranges one, and presets to start from | [§6.4](#64-presets-and-the-default) |
| What the bento does on a phone | [§6.3](#63-on-a-phone) |
| Which order wins: the album's or the band's | [§6.2](#62-tiles), [D-G14](#17-decisions) |
| What moves on its own (GIFs, videos) and what never does | [§4.3](#43-motion) |
| SVG safety, and drawings in dark mode | [§4.1](#41-drawings-svg-kept-as-a-vector) |
| Formats that can't be kept, and what to tell the owner | [§4](#4-media) |
| Large albums: the filmstrip, warming and page weight | [§8.7](#87-loading), [§11](#11-performance-and-budgets) |
| Back closing the lightbox, and sharing one item | [§8.6](#86-addresses-back-and-sharing) |
| The keyboard and screen readers in the band, the lightbox and the arranger | [§10](#10-accessibility) |
| Private albums, the planet, telemetry and search | [§12](#12-private-albums) to [§14](#14-telemetry-search-and-sharing) |
| Keeping the owner's upkeep small: what's worked out, and where he can override it | [§18](#18-automatic-and-where-to-override-it) |
| Dates, places, zoom and downloads | [§3.4](#34-where-the-words-come-from), [§8.3](#83-words-the-caption-and-the-info-panel), [§8.8](#88-zoom) |
| An album shown inside another page | [§7.2](#72-an-album-inside-another-page) |
| Alt text for many pictures at once | [§9.6](#96-suggested-alt-text) |
| The site's 1 GB limit on GitHub Pages | [§11](#11-performance-and-budgets) |

### 1.2 Benchmark

| Product | What it does | What we take |
|---|---|---|
| Flickr albums | An album has a cover, a title, a description and its count of photos and videos; the album page shows them all | The counts, the album's own words, the album page with everything |
| Behance projects | A project is a long scroll of media with words between them; its owner chooses its cover | A curated way in, and the full set behind it |
| Squarespace gallery sections | One set of images, shown as a grid, a masonry wall, a slideshow or a strip, with an optional lightbox | One list of items, many arrangements of it |
| Apple's product pages and bento-style profile sites | A mosaic of tiles in a few fixed sizes on a strict grid | Tiles in whole cells, a strict grid, no free placement |
| Lightbox libraries (Fancybox, PhotoSwipe) | Pictures, video files and YouTube or Vimeo in one viewer; a thumbnail strip; an address for each slide; Back closes | Mixed media on one stage, the strip, item addresses, Back |

## 2. Terms

| Term | Means |
|---|---|
| **Album** | A page of kind Gallery with an `album` field: a set of items in an order, with words. Stored as `kind: "gallery"` and shown as Album in edit mode |
| **Item** | One thing in an album: a picture, a drawing, an animated picture, a video file or an embed, with its own caption and description |
| **Drawing** | An SVG kept as a vector ([§4.1](#41-drawings-svg-kept-as-a-vector)) |
| **Embed** | A YouTube or Vimeo video, played by the provider's player after a press |
| **Up front** | The items an album shows in its band: those with a tile |
| **Tile** | An up-front item's place in the bento grid: a column, a row, a width and a height, in cells |
| **Cell** | One square of the grid. Every tile is a whole number of cells |
| **Band** | One album as the Albums view shows it: title, counts, the bento grid, the short description and "See all" |
| **The Albums view** | The section view that sets a section's albums as bands, one after another ([§5](#5-the-albums-view)) |
| **The album page** | The album's own page, at its address, with every item ([§7](#7-the-album-page)) |
| **The arranger** | Edit mode's Up front view, where the owner places and sizes tiles ([§9.3](#93-up-front-the-arranger)) |
| **Automatic** | An answer worked out from the album's content each time, never saved ([§18](#18-automatic-and-where-to-override-it)) |
| **Override** | The owner's own answer, stored where it applies, and removed by Back to automatic (or the name its place gives it) |
| **The album block** | A block that shows an album's band inside another page ([§7.2](#72-an-album-inside-another-page)) |

## 3. The model

### 3.1 An album is a page

An album is a page (`content/articles/<id>.json`) of kind `gallery` with an `album` field. Being a page gives it, unchanged:
- **an address** in its section (`/gallery/<slug>/`), and the three levels (V22);
- **its status** (draft, published), its date, its summary, its access (open or private), its topics and its place in Ways to explore;
- **its card** wherever the site lists pages: a related story, a home view, another section. There it's a `StoryCard` whose meta line is the album's counts ("18 pictures, 2 videos"), and whose picture is its `thumbnail`, else its first raster picture up front, else its first raster item;
- **the article editor,** its save queue, its undo history and its checks.

Its masters live in `content/media/articles/<id>/` like any page's, and an album may use media from anywhere in the library: a picture can be in an article and an album at once, with one alt text.

An album can sit in any section; the Gallery section shows albums best because its view is Albums ([§5](#5-the-albums-view)). The `album` field belongs only to kind `gallery`, and every page of kind `gallery` has one (V43): an existing gallery page gains an empty one on its first save, and its body blocks are kept.

### 3.2 The album field

```json
{
  "id": "summer-sketches",
  "type": "article",
  "kind": "gallery",
  "slug": "summer-sketches",
  "title": "Summer sketches",
  "summary": "Pen and wash studies from a summer of drawing outdoors.",
  "album": {
    "description": "Drawn over **eight weeks**, mostly in the early morning.\n\nThe last few are digital.",
    "items": [
      { "id": "harbour", "media": "articles/summer-sketches/harbour", "caption": "The harbour at low tide" },
      { "id": "market-walk", "media": "articles/summer-sketches/market-walk", "autoplay": true, "loop": true },
      { "id": "talk", "embed": { "provider": "youtube", "id": "abc123", "width": 1920, "height": 1080 }, "title": "A talk about drawing outdoors", "poster": "articles/summer-sketches/talk-poster" },
      { "id": "map", "media": "articles/summer-sketches/map", "description": "A map of the walks, redrawn from notes:\n\n- the harbour\n- the market" }
    ],
    "showcase": {
      "tiles": [
        { "item": "harbour", "x": 0, "y": 0, "w": 6, "h": 4 },
        { "item": "talk", "x": 6, "y": 0, "w": 6, "h": 2, "focus": "50% 30%" },
        { "item": "map", "x": 6, "y": 2, "w": 6, "h": 2, "display": "fit" }
      ]
    }
  },
  "body": []
}
```

- **`items`** is the album: every item, in the album's order. That order is the album page's and the lightbox's.
- **`showcase.tiles`** is the band: which items are up front, and where. An item with no tile is in the album but not in the band. Without a `showcase`, the band uses the default arrangement ([§6.4](#64-presets-and-the-default)). The `talk` tile above has its own focus point, so its wide, short crop keeps the speaker's head in view.
- **`showcase.phone`**, rarely there, is the owner's own arrangement of the band for phones; without it, the phone's is worked out from the tiles ([§6.3](#63-on-a-phone)).
- **The album's settings** (`layout`, `captions`, `dates`, `download`) are left out while they're the defaults, so an album that's never been told otherwise follows every default.
- **`body`** is the page's usual blocks, shown after the items on the album page. Most albums leave it empty.

### 3.3 Fields

| Field | Rule |
|---|---|
| `album.description` | Optional. The album's introduction on its page: the rich-text subset ([§3.5](#35-rich-text)), at most 6 paragraphs or lists and 1,500 characters |
| `album.items` | 1 to 200 items when published; a draft may have none (V38) |
| `album.showcase.tiles` | Optional. 1 to 12 tiles, each naming a different item, inside the grid, never overlapping, at most 12 rows tall (V39) |
| `album.showcase.phone.tiles` | Optional, and only with `tiles`: the owner's phone arrangement on 6 columns, naming exactly the tiles shown on phones (V47) |
| `album.layout` | Optional: `grid` (the default: the justified grid) or `story` (one item after another with its words, [§7.1](#71-story)) |
| `album.captions` | Optional: `true` shows each item's caption under its cell in the grid (left out: none, [§7](#7-the-album-page)) |
| `album.dates` | Optional: `false` hides the dates the pictures were taken (left out: shown where known) |
| `album.download` | Optional: `true` lets readers download the album's items from the lightbox (left out: no downloads, [§8.3](#83-words-the-caption-and-the-info-panel)) |
| Item `id` | Lowercase letters, digits and hyphens, at most 64 characters, unique in the album. Made from the file's name when added, and never changed: it's the item's address (`#item-<id>`) |
| Item `media` | A media ID: a picture, an animated picture, a drawing or a video file. Exactly one of `media` and `embed` |
| Item `embed` | `{ provider: "youtube" or "vimeo", id, width?, height? }`, as the video block's: the shape from the provider's oEmbed when it's added; left out, 16:9 |
| Item `title` | An embed's name, required for one (it's the player's and the link's name); for a video file, left out, the file's own title |
| Item `poster` | A raster picture's media ID shown before an embed plays; required for an embed. A video file uses its own poster frame |
| Item `duration` | An embed's length in seconds, optional (Vimeo's oEmbed gives it; YouTube's doesn't) |
| Item `caption` | Optional plain text, at most 200 characters. Overrides the media's own caption for this album only |
| Item `description` | Optional rich text ([§3.5](#35-rich-text)), at most 4 paragraphs or lists and 1,000 characters |
| Item `place` | Optional plain text, at most 80 characters: where it was made, typed by the owner, never read from the file |
| Item `download` | Optional `true` or `false`, overriding the album's `download` for this item; never on an embed |
| Item `autoplay`, `loop` | A video file only, as in the video block: plays muted while in view on the album page, never under reduced motion |
| Tile `item` | An item's `id` |
| Tile `x`, `y` | Its first column (0 to 11) and first row (0 or more), in cells |
| Tile `w`, `h` | Its width and height in cells, 2 to 12 each, with `x + w` at most 12 and `y + h` at most 12 |
| Tile `display` | Optional: `fill` (the default for pictures, videos and embeds) or `fit` (the default for drawings) |
| Tile `focus` | Optional, for a filled tile: its own focus point (`"30% 60%"`), used instead of the picture's ([§6.5](#65-how-a-tile-shows-its-item)) |
| Tile `play` | Optional `true`, for a video file or an animated picture at most 10 MB: it plays in the band, muted ([§4.3](#43-motion)); at most 2 tiles in a band (V48) |
| Tile `onPhones` | Optional `false`: the tile isn't shown on phones ([§6.3](#63-on-a-phone)) |
| Phone tile | `item`, `x` (0 to 5), `y`, `w` (2 to 6), `h` (2 to 8), on 6 columns; it takes its `display`, `focus` and `play` from the item's wide tile |

Two facts about a picture are added to its sidecar ([media §3](../content/media.md#3-the-metadata-sidecar)), so every use of the picture shares them:

| Sidecar field | Rule |
|---|---|
| `taken` | The date it was taken (`2026-03-12`), read from the file's EXIF when it's uploaded ([§4](#4-media)); the owner can change or clear it (as built, no screen changes it yet: [§20](#20-as-built)) |
| `large` | `true` when the owner chose Keep it large: its master is kept at up to 3840 px instead of 2560 ([§4](#4-media)) |

### 3.4 Where the words come from

| Words | Kept in | Shown |
|---|---|---|
| The album's title | The page's `title` | The band's heading, the album page's H1, the lightbox's top bar |
| The album's short description | The page's `summary` (one plain sentence or two, within the summary's limit) | Below the band, the album page's standfirst, its cards and search results |
| The album's introduction | `album.description` (rich text) | The album page, above the items |
| An item's alt text | The picture's sidecar (`alt`), shared by every use of the picture | The tile's and the cell's link name, the stage's alt, the filmstrip's names |
| An item's caption | The item's `caption`, else the media's `caption` | Under the stage in the lightbox, and in the info panel |
| An item's description | The item's `description` (rich text) | The lightbox's info panel ([§8.3](#83-words-the-caption-and-the-info-panel)) |
| An item's credit and licence | The media's sidecar | The info panel |
| The date it was taken | The picture's sidecar (`taken`), read from the file when it's uploaded | The info panel ("Taken 12 March 2026"); the album page's opening as a span ("March to May 2026"); hidden by the album's `dates: false` |
| Where it was made | The item's `place`, typed by the owner | The info panel, after the date |
| A video's name | A file's `title`, an embed's `title` | The tile's link name ("Video: …"), the player's name |
| A poster's alt text | The poster picture's sidecar | Not shown: the poster sits inside a link named by the video |

- **Every item needs alt text.** A picture in an album is never decorative: it's the content. An item whose picture is marked decorative or has no alt text is refused (V38), and edit mode asks for it on upload, with a suggestion when the owner has an AI service set up ([§9.6](#96-suggested-alt-text)).
- **Alt text and captions differ.** Alt text describes what's in the picture for someone who can't see it; the caption says something about it for everyone. Edit mode keeps them in separate fields with their own hints.
- **A place is never read from the file.** Location data stays stripped ([media §4](../content/media.md#4-formats-and-budgets)); a place is only what the owner types, so a picture taken at home never says where home is.

### 3.5 Rich text

Descriptions use the site's Markdown subset, the one an item's words already use (`itemWords`, `src/site/content/markdown.ts`):
- paragraphs, and bulleted or numbered lists nested up to 3 levels;
- strong, emphasis, strikethrough, inline code, links and line breaks;
- no headings, pictures, tables, quotes or HTML (HTML is escaped).

Links follow the site's rules: to the site's own pages as `ref:` links, which survive a page moving, and elsewhere only to `https`, `http` or `mailto` addresses. A description is meant to be read in the info panel beside a picture, so it stays short: the limits above (V41) are the line where it's become a story of its own, which belongs on a page.

Edit mode writes it with `RichField`, the kit's rich-text field (bold, italic, strikethrough, code, links and lists), so the owner never types Markdown.

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
| A YouTube or Vimeo address | An embed with a poster of the site's own | Its poster, with the Play badge | Its poster | A facade, then the provider's player after a press |
| JPEG XL, camera RAW, PSD, MKV, AVI, WMV, 3GP | Refused, saying what to do ("Export it as JPEG or PNG", "Save it as MP4") | | | |
| Any other video site | Refused: "Only YouTube and Vimeo can be embedded." | | | |

- **APNG** is read by the image library as its first frame. The upload form says so before saving: "This animated PNG will be kept as a still picture. To keep it moving, save it as a GIF or an animated WebP."
- **Read at upload,** so the owner types less:
  - **the date taken:** the file's EXIF date (`DateTimeOriginal`, else `DateTime`) is kept as the sidecar's `taken` before the master is written without its metadata, as every master is. A HEIC the browser turns into PNG first has its date read in the browser and sent with it. A file with no date has none; nothing guesses one from the file's own times;
  - **the focus point:** the image library's attention measure (the region with the most detail, saturated colour and skin tones) finds where the picture's interest is, and it's kept as the sidecar's `focus`, the point the owner would otherwise set by hand. A picture already in the library keeps its own focus point (the centre if it has none): measuring it would move its crops on other pages, so its preview offers Find the focus instead ([§9.2](#92-items));
  - **its size and shape** (the sidecar's `facts`), as today.
- **Keep it large.** A raster picture bigger than 2560 px can be kept at up to 3840 px: a choice in the upload form, for a picture worth looking into closely (a detailed drawing, a panorama). It adds a 3840 px size to the lightbox's stage and to zoom ([§8.8](#88-zoom)), and nothing to the band or the album page, which never need it. It can't be chosen later for a file already saved smaller: Replace with the original instead. Make it standard saves it again at 2560 px.
- **Budgets** are [media §4](../content/media.md#4-formats-and-budgets)'s: a picture at most 2560 px (3840 px kept large); a video file or a GIF under 100 MB (longer videos are better on YouTube or Vimeo); a sealed video at most 10 MB (V27). The upload form shows the album's total weight as it grows.
- **Cropping:** a picture can be cropped as anywhere else ([editor spec §6](../editor/spec.md#6-media)); a GIF, an animated picture and a drawing can't, so the owner sets their focus point instead. A tile never needs a crop: it fills round the focus point ([§6.5](#65-how-a-tile-shows-its-item)).
- **Dark mode versions** work as everywhere ([media §10](../content/media.md#10-dark-mode-versions)): an item shows the version that matches the page, in the band, on the album page, in the filmstrip and on the stage.

### 4.1 Drawings: SVG kept as a vector

When the owner adds an SVG, the upload form asks how to keep it:
- **Keep it as a drawing** (the default for an SVG at most 200 KB): it stays an SVG, sharp at every size, and is drawn with `<img>` (so its own scripts could never run, even if one got through).
- **Turn it into a picture:** rasterized to a WebP master as today. The only choice for an SVG over 200 KB.

A drawing is cleaned before it's saved, and refused if it can't be:
- **removed:** scripts, event-handler attributes, `foreignObject`, comments and metadata;
- **refused:** a reference to anything outside the file (an `href` or `xlink:href` that isn't a `#` fragment, a `url()` that isn't a fragment, a style `@import`), a `javascript:` address, embedded raster pictures over 200 KB in total;
- **required:** a `viewBox`, or a `width` and a `height` to make one from.

Its sidecar is an image's, with `file` ending `.svg`, and its `facts` (size and background) measured from the viewBox and the drawing's own background, if it has one. A dark version is a second drawing, `<name>.dark.svg`, cleaned the same way. A drawing without one is shown on a paper panel in dark mode (`--c-album-drawing-paper`), so dark lines on a transparent background never vanish into a dark page. A drawing is never a page's social image (V46): a card on another site needs a raster picture.

### 4.2 Videos and embeds

- **Names.** A video is named by its title everywhere: the tile and the cell are links named "Video: title" (with its length when known), and the player carries the title.
- **Captions.** A video file with speech needs caption tracks ([media §3](../content/media.md#3-the-metadata-sidecar)'s `captions`, WebVTT beside the master). The contract doesn't hold them yet; phase G1 adds them, and the album page and the lightbox pass them to the player. The content check warns about a video without them (V40).
- **Posters.** An embed's poster is a picture of the site's own, never the provider's thumbnail address: the site's Content Security Policy allows pictures only from itself, and a reader's browser shouldn't call the provider before they press Play. Edit mode can take the provider's thumbnail once, when the owner adds the video, and keep it as the site's own picture ([§9.2](#92-items)).
- **Privacy.** Embeds play from `youtube-nocookie.com` and with Vimeo's do-not-track option, as the video block does; the iframe is made only after a press and sends only the site's origin as its referrer.
- **Providers are one list.** YouTube and Vimeo are all this version embeds. Today each reader of an embed (the video block's component, edit mode's shape and inspector, the Content Security Policy's `VIDEO_HOSTS`) knows the two by itself; G1 gathers them into one list in code (`src/site/content/providers.ts`): each provider's address patterns, its ID's shape, its player's and its page's addresses, its oEmbed endpoint and its hosts for the policy. Adding a provider is then one entry and its tests. A video from anywhere else goes in as a file the owner uploads.

### 4.3 Motion

| Where | Animated pictures | Video files | Embeds |
|---|---|---|---|
| The band | Still poster, with the Animated badge; playing when its tile is set to Play in the band | Poster, with the Play badge; playing muted when its tile is set to Play in the band | Poster, with the Play badge, always |
| The album page | Play, lazily, as in an article; the poster under reduced motion | Poster; with `autoplay`, muted while in view, never under reduced motion | Poster |
| The lightbox | Play, with a Pause button; paused at first under reduced motion | Plays when opened with a press; paused when reached by moving | A facade; the player after a press |

The band is still by default: a section of albums shows many items at once, and many moving things at once are heavy to load and hard to read past (WCAG 2.2.2). The site's interface never moves on its own ([visual language §6](../site-ui/visual-language.md#6-motion)); a moving picture is content the owner chose, as a video block's `autoplay` is ([media §12](../content/media.md#12-video-files)). So the owner can set a tile to **Play in the band** (`play`), within limits:
- **only a video file or an animated picture,** at most 10 MB; never an embed, whose player would call the provider before the reader asked;
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
<figcaption>One album's band in the Albums view: the title and its counts, the bento grid of the items up front, the short description and the way into the album, then a quiet break before the next. On a phone the same tiles are redrawn on 6 columns.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The band, as a table</summary>

| Part | What it is | Rule |
|---|---|---|
| Title | The album's title as an H2, a link to the album page | Set in the section's heading style |
| Counts | "18 pictures, 2 videos, 1 drawing" | Pictures include animated pictures; videos include embeds; only the kinds it has |
| Bento grid | The items up front, as tiles of whole cells | 12 columns wide; 6 on a phone |
| Lead tile | A picture across 6 columns and 4 rows | Any tile can be any size from 2 by 2 to 12 by 12 |
| Video and embed tiles | Their posters, with the Play badge and length | A video file set to Play in the band plays muted while in view; an embed never plays here |
| Animated tile | Its still poster, with the Animated badge | Plays in the album and the lightbox, and in the band when set to |
| Drawing tile | The drawing, whole on its own background | Fit by default |
| Pause | A button beside the counts | Only in a band with a tile that plays |
| Short description | The page's summary | One or two sentences |
| See all 21 | A link to the album page | "Open the album" when every item is up front |
| The break | The divider's dinkus and space | Between albums, never after the last |

</details>

Each band is an `<article>` labelled by its heading:
1. **The heading:** the album's title, an H2 that links to the album page, with the counts beside it (below it on a phone). In a band where a tile plays, a **Pause** button follows the counts ([§4.3](#43-motion)).
2. **The bento grid** ([§6](#6-the-bento-grid)): a list of tiles, each one link. A tile opens the lightbox at its item; without scripts, or with a modifier key, it goes to the album page at the item (`/gallery/<slug>/#item-<id>`).
3. **The short description:** the page's `summary`, set as a standfirst.
4. **"See all 21":** a link to the album page, named "See all 21 in Summer sketches". When every item is up front it reads "Open the album".
5. **The break:** the divider's dinkus with the section's space above and below (`c.album.band-space`), so each album reads as its own thing.

- **Order.** Albums are shown in the section's order of pages. A page of another kind in the same section is shown between them as a feature card (`StoryCard` `feature`), so nothing in a section is ever hidden by its view.
- **The first band loads first:** its pictures are eager and its largest tile has a high fetch priority; every later band's pictures are lazy ([§11](#11-performance-and-budgets)).
- **The section's words.** The section's heading and summary open the page as in every view; its recommendations, if it has them, keep their places ([recommendations](../sections/recommendations.md)).
- **Empty.** A section with no albums shows the empty state of [sections spec §3.4](../sections/spec.md#34-the-section-view-u6); an album with no items is a draft and never shown.
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
- **Two orders, kept apart.** The band's order is the owner's layout; the album's order (`items`) is the album's story. Moving a tile never reorders the album, and reordering the album never moves a tile. The lightbox and the counter follow the album's order, so a tile in the band's first place can be "15 of 21" ([D-G14](#17-decisions)).
- **Placement.** Each tile carries its place as local custom properties on its element (`--x`, `--y`, `--w`, `--h`, and the phone's four), read by the band's stylesheet as `grid-column` and `grid-row`. The page's Content Security Policy allows inline styles, and nothing else about a tile is set inline.
- **Badges.** A video or embed tile shows the Play badge and its length; an animated picture the Animated badge. Badges come from the icon set, on the image shade the video block already uses for its length, and their words are part of the link's name.
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

**Arranged by hand.** When the rule's answer isn't right for a band, the owner arranges the phone's band himself in the arranger's phone view ([§9.3](#93-up-front-the-arranger)); it's kept as `showcase.phone.tiles`, on the same 6 columns, the same square cells and the same snapping (2 to 6 columns wide, 2 to 8 rows tall, never overlapping), and it names exactly the tiles shown on phones (V47). Edit mode warns past 24 rows. It keeps up with the wide band without being redone:
- **a tile taken out of the band** leaves the phone's band too;
- **a tile added to the band** joins the phone's band at its end, placed by the rule, and the arranger notes it ("1 new tile added at the end on phones");
- **a tile moved or resized on the wide band** stays where the owner put it on the phone;
- **Back to automatic** removes `showcase.phone`, and the rule draws the phone's band again.

### 6.4 Presets and the default

A preset places the items that are up front, in their current band order. It never changes which items are up front: a preset with fewer slots than tiles places the first ones and leaves the rest where they fit below.

| Preset | Arrangement | Best for |
|---|---|---|
| **Single** | One tile, 12 by 6 | One picture that carries the album |
| **Lead and two** | A lead 8 by 6, two tiles 4 by 3 stacked beside it | Three items with a clear lead |
| **Lead and four** | A lead 6 by 4, four tiles 3 by 2 beside it, two by two | Five items with a clear lead |
| **Pairs** | Rows of two tiles 6 by 4; a lone last one 12 by 6 | Equals |
| **Even rows** | Rows of three tiles 4 by 3; the last row's tiles share its width | Many equals |
| **Fit to pictures** | Rows 3 or 4 cells tall, each tile as wide as its picture's shape asks, rounded to whole columns, the last in a row taking what's left so every row ends at 12 | Pictures whose shapes matter (panoramas, portraits) |

Without a `showcase`, the band uses the **default**: the album's first items, in album order, in the preset that fits their number:

| Items in the album | Up front by default |
|---|---|
| 5 or more | Lead and four, the first 5 |
| 4 | Pairs |
| 3 | Lead and two |
| 2 | Pairs |
| 1 | Single |

The default is worked out, not saved: an album keeps it until the owner arranges the band, and adding items to an unarranged album changes it. To have different items up front, he arranges the band; there's no separate list of them to keep. **Use the default** in the arranger removes `showcase` (and with it any phone arrangement), so the band follows the album's order again.

### 6.5 How a tile shows its item

- **Fill** (the default for pictures, videos and embeds): the tile is covered, cropped round the picture's focus point (its sidecar's `focus`, measured when it's uploaded and changed in edit mode's preview, [§4](#4-media)). No crop file is made: the same master serves every tile shape.
- **A tile's own focus.** When one tile's shape cuts the picture badly round its focus (a tall tile of a wide group photo), the owner drags the focus for that tile alone (`focus`, [§9.3](#93-up-front-the-arranger)); the picture's own focus, used on every other page, is untouched. Use the picture's focus removes it. The phone's tile uses the same point.
- **Fit** (the default for drawings): the whole item, on its own background colour, taken from its edges (the picture's `bg`, as [media §9](../content/media.md#9-shapes-thumbnails-and-crops) does), so a fitted picture never sits on an unrelated colour.
- **Sizes.** A tile asks for the widths a slot of its size needs: its share of the wide width on a wide screen and of the screen on a phone, from the site's `sizes()` helper, never a rem literal.

## 7. The album page

The album's own page, at its address (`/gallery/summer-sketches/`), in the site's article layout with the album's opening:

1. **The opening:** the crumbs, the title (H1), the standfirst (`summary`), the counts and the date. The date is the span of the dates the items were taken ("12 to 20 March 2026", "March to May 2026", "2019 to 2024"), or the page's date when none are known or the album's `dates` is `false`. No lead picture unless the owner sets one (`hero`): the items are the pictures.
2. **The introduction:** `album.description`, set as prose at the text width.
3. **The items:** every item, in album order, laid out as the album's `layout` says: the **Grid** (the default), the gallery's justified grid ([media §9.2](../content/media.md#92-justified-galleries)) at the wide width, with no item cropped by more than a quarter to fit its row, or the **Story** ([§7.1](#71-story)). Each item is a link:
   - its address is the item's (`id="item-<id>"`), so `#item-harbour` scrolls to it;
   - it's in the lightbox group `album`, and opens the lightbox at its item;
   - a video or an embed shows its poster with the Play badge; an animated picture plays (the poster under reduced motion); a video with `autoplay` plays muted while in view;
   - its words for the lightbox (caption, description, credit) are in a `<template>` beside it, so they're in the page without being read out twice.
4. **The body:** the page's own blocks, if it has any, at their usual widths.
5. **The page's end:** what to read next and Back to top, as on every page ([sections spec §3.7](../sections/spec.md#37-the-end-of-a-page-what-to-read-next-and-back-to-top)).

- **No captions under the cells,** by default: the grid is for looking, and the words are a press away. An album whose pictures need their words in view (a sequence of sketches with notes) sets **Captions under pictures** (`captions: true`): each cell then shows its caption under it, at most two lines, cut with an ellipsis, the whole caption still in the lightbox. A row keeps its cells level, and an item with no caption leaves the space empty.
- **Without scripts,** a picture's cell links to its full-size picture, a video's to its file, and an embed's to the provider's page. Descriptions need scripts to be seen in the Grid: a stated limit of this version (the Story shows them without).
- **Opening at an item.** Loading the page with `#item-<id>` scrolls to the item and opens the lightbox at it ([§8.6](#86-addresses-back-and-sharing)).

### 7.1 Story

An album whose items are better read in turn (a trip, a project's stages, a set of drawings with notes) sets its layout to **Story** (`layout: "story"`). The items then follow one another down the page:
- **each item at the wide width,** whole, never cropped; a portrait picture narrower, so it's never taller than the screen below the header;
- **its words under it, at the text width:** the caption as a figure's caption, then the description as prose, then the date and the place in the meta style; the credit as on a figure;
- **the same links:** each picture opens the lightbox at its item, its address is the item's (`#item-<id>`), and videos and embeds behave as in the Grid;
- **loading:** the first item eager, every later one lazy, with its space kept from its shape, so nothing jumps.

Nothing else changes: the band, the lightbox and the album's order are the same, and `captions` has no use (every item's words are shown). The album's introduction comes first and its body last, as in the Grid.

### 7.2 An album inside another page

An **album block** shows an album inside any page of the site: an article about a project can carry the project's album without copying a picture.

- **What it holds:** the album's page ID, and optionally its width (`wide`, the default, or `full`): `{ "type": "album", "album": "<page ID>" }`.
- **What it shows:** the album's band as the owner arranged it (its phone arrangement too), with its title as a heading one level below the heading it follows, its counts and See all, and no break. The band's tiles open the lightbox on the whole album, in its order, with the filmstrip; Back closes it, and Copy link gives the item's address on the album's own page.
- **Its words are the album's,** never copied: a change to the album shows wherever it's placed.
- **It's refused** (V51) for a private album (its band would carry its words outside its seal; [§12](#12-private-albums)), for an album that's not published when the page it's in is, and inside the album's own page.
- **Changing the album later:** making it private, setting it back to draft or deleting it while a published page shows it is refused by the same check, which names the pages that show it, so a block never points at nothing.
- **In edit mode** it's in the block inserter as Album, chosen from a list of the site's albums, with the band shown as it is; the album is changed only in its own editor ([§9.5](#95-the-other-screens)).

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
| Stage | The item: a picture, a drawing, an animated picture, a video or an embed | Fitted to the space; never enlarged past its own size, except by zooming |
| Previous and Next | Buttons beside the stage | On a phone, swiping instead |
| Info panel | The caption, the description, the date and the place, the credit, the album and its link, Copy a link, and Download when allowed | A side column when wide; a sheet from the bottom on a phone |
| Filmstrip | A thumbnail for every item in the album, in album order | One Tab stop; the arrow keys move; the current one marked |

</details>

### 8.1 Opening, and the group

- **The group is the whole album,** in album order, wherever it's opened from.
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
| Embed | Its poster as a facade with Play focused; the provider's player after a press, removed when the reader moves on |

- **Never enlarged:** a raster item smaller than the stage is shown at its own size, centred. Looking closer is zooming ([§8.8](#88-zoom)).
- **A slow picture** shows its thumbnail, stretched and softened, until the full size arrives, then fades to it (instantly under reduced motion).

### 8.3 Words: the caption and the info panel

- **The caption** sits under the stage, as today. When the item has a description, a "More" button follows the caption and opens the info panel.
- **The info panel** holds, in order: the caption, the description (rich text), the date taken and the place ("Taken 12 March 2026, Shillong"; each when known, the date hidden by the album's `dates: false`), the credit and licence, a video's length, an embed's "Watch on YouTube" (or Vimeo) link, Download when it's allowed, then "From the album: Summer sketches" with "Open the album" (left out on the album page) and "Copy a link to this".
- **Download** is offered only where the owner allows it: the album's **Allow downloads** (`download: true`), and for one item its own `download`, which overrides the album's either way. It's never offered for an embed (the provider's video isn't the owner's to hand out). The button names the file's kind and weight ("Download picture, 2.1 MB"), and the file is named `<album title's slug>-<item id>.<ext>` (from the title, never the address: a private album's is its secret token):
  - **a picture:** its largest published size, as WebP (3840 px when it's kept large);
  - **a drawing:** its cleaned SVG;
  - **an animated picture or a video file:** the file as published.

  In a private album, the file downloaded is the decrypted one, made in the browser. Downloads send no telemetry event. The file as it was uploaded isn't kept (edit mode makes the master from it) and masters aren't published, so a reader gets the largest published size, never the original: a stated limit ([§19](#19-not-in-this-version)).
- **Where it opens:** beside the stage on a wide screen (`c.lightbox.info-width`, about 22 rem, the stage narrowing to make room); as a sheet over the bottom of the stage on a phone, above the filmstrip, scrolling within itself.
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
- **In an embed's iframe,** Escape goes to the provider's player and can't close the lightbox: the browser keeps the iframe's keys to itself. Close stays one Tab away. A known limit.
- **No swipe down to close:** a vertical drag pans a zoomed item, and on an item that can't be zoomed the stage leaves the browser's own pinch zoom alone, which readers with low vision need. Close, Escape and Back close it.

### 8.6 Addresses, Back and sharing

- **On the album page,** opening the lightbox adds `#item-<id>` to the address (a new history entry), and moving replaces it, so Back closes the lightbox and leaves the reader where they were. Closing it removes the entry. Loading the page with `#item-<id>` opens the lightbox at that item; closing it then leaves the reader at its cell.
- **Elsewhere** (the section page, an article), opening the lightbox adds a history entry without changing the address, so Back closes it there too.
- **In the planet's frame,** the lightbox adds nothing to history: the frame keeps its own ([§13](#13-on-the-planet)).
- **Copy link** copies the item's canonical address: the album page's address on the site plus `#item-<id>`, whatever page the lightbox is on, and announces "Link copied". Where the clipboard can't be written, it shows the address selected in a field to copy by hand.

### 8.7 Loading

- **Warming:** a group of 24 items or fewer is warmed whole when the lightbox opens, nearest first, two at a time (as today). A larger group warms the 4 items on either side of the current one, again after every move.
- **Sealed media** (a private album's) aren't warmed: each is decrypted when it's shown ([§12](#12-private-albums)).
- **Video files** load their metadata only when shown, and nothing more until they play; an embed loads nothing until Play.
- **The album page fetched from a band** is fetched once and kept for the visit; the reader's next step is usually that page, which then comes from the cache.
- **Zoom's large size** loads only when zooming starts, never with the item ([§8.8](#88-zoom)).

### 8.8 Zoom

A picture worth looking into (a detailed drawing, a sketch's lines, a panorama) can be zoomed on the stage.

- **Where it's offered:** a picture or a drawing whose largest size is at least one and a half times the size it's shown at on the stage; a drawing always (it's sharp at any size). Never an animated picture, a video or an embed. Where it's not offered, the zoom buttons aren't shown, and pinching is the browser's own zoom.
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

### 9.1 Making an album

- **New album,** beside New article and New page, asks for the same things (the title, the summary, the section and who can see it) and creates a draft of kind `gallery` with an empty album. The editor opens on its Items view.
- **The editor's views:** an album's editor has three views, chosen by three links in the top bar's tools (so Atiya Studio's title bar shows them too): **Page** (the usual canvas, outline and inspector, for the opening, the introduction and any body blocks), **Items** and **Up front**. The view is in the address (`?view=items`), and all three share one save queue and one undo history.
- **The album's settings** are in the Page view's inspector, in an Album group, each showing its default until it's changed: Layout (Grid or Story, [§7.1](#71-story)), Captions under pictures (Grid only), Show dates taken, and Allow downloads ([§8.3](#83-words-the-caption-and-the-info-panel)). Setting one back to its default removes it from the file.

### 9.2 Items

A grid of the album's items, in album order, beside the chosen item's details (a split view, as the Sections and Access screens are).

- **Each card:** the item's thumbnail with its kind's badge, its caption (or its alt text, dimmed, when it has none), and an Up front marker.
- **Adding:**
  - **From the library:** the media picker, choosing several at once ("Use 3 pictures and 1 video"); they're added in the order chosen.
  - **By dropping files** on the grid, or with Upload: a batch form lists each file with its alt text (required: an album's pictures are never decorative), its caption, the date it was taken (read from the file, [§4](#4-media)), Keep it large for a picture bigger than 2560 px, and, for an SVG, how to keep it ([§4.1](#41-drawings-svg-kept-as-a-vector)). With an AI service set up, each picture's alt text comes with a suggestion, and **Use all suggestions** takes them for every field still empty ([§9.6](#96-suggested-alt-text)). Files are saved to the album's folder as each is ready; one that's refused says why and leaves the others.
  - **A YouTube or Vimeo video:** paste its address. Edit mode asks the provider (oEmbed, through the dev server, as the video block does for its shape) for its title, shape, length (Vimeo) and thumbnail, and fills them in. The poster is taken once from the provider's thumbnail and kept as the site's own picture in the album's folder, with the alt text "Still from: <title>", so pasting the address is all it needs; the owner can choose another poster from the library or upload one. Tests never reach the providers: they use a stand-in fetch, as the recommendations' photos do.
  - New items go at the end, or after the chosen one.
- **Ordering:** drag a card; or, with a card focused, Alt with an arrow key moves it one place, and Move to start and Move to end are in its menu. Several cards can be chosen (Shift + click for a range, Ctrl or Cmd + click for one more, as in the outline) and moved together. **Sort by date taken** orders the whole album by its pictures' dates, oldest first; items without a date keep their order after them. It's one change, so Undo puts the order back.
- **The details:**
  - the preview, and what belongs to the picture itself (its alt text, the date it was taken and its focus point), shown here with a link to its details in Media, since they serve every use of the picture; the alt text and the focus point are changed there, and no screen changes the date taken yet. A picture with no focus point (one from the library made before focus points were measured) links to **Find the focus in Media**, which measures it as an upload does and shows it before saving; an empty alt text gets its suggestion there too (as built in G5: the spec first had these fields edited in the Items view);
  - the caption (this album only), with the media's own caption shown as its placeholder;
  - the description, in `RichField`, with its limits counted as the owner types;
  - the place (this album only);
  - Up front, a switch: on adds a tile where it fits first ([§9.3](#93-up-front-the-arranger)), off removes its tile;
  - Download, shown when it applies: Follow the album (the default), Allow or Don't allow;
  - for a video file: Play by itself and Loop; for an embed: its title, poster, length and shape (16:9, 9:16, 4:3 or 1:1, when the provider didn't say);
  - for a picture bigger than 2560 px that's kept large: Make it standard;
  - Remove from the album, which keeps the file in the library (Media deletes files).
- **The album's weight** is shown under the grid: its items' total size, with the sealed budget for a private album.

### 9.3 Up front: the arranger

<figure class="slate-figure" data-diagram="gallery-arranger">
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 680" role="img" aria-labelledby="ga-arranger__title ga-arranger__desc" preserveAspectRatio="xMidYMid meet" data-slate-svg-motion="viewport" data-slate-safe-margin="24">
<title id="ga-arranger__title">Edit mode's Arranger: the band, tile by tile</title>
<desc id="ga-arranger__desc">The Arranger shows the album's band at its real width over a faint grid of square cells. A toolbar holds the presets, Close gaps, Use the default, the Wide and Phone views (the phone's worked out until Arrange for phones) and Undo. The selected tile has handles that resize it by whole cells. Dropping a tile on one of the same size swaps them; otherwise the tiles below are pushed down. A hole is hatched and warned about, not refused. A live region reads each move aloud as columns and rows. Beside the canvas, a tray holds the album's items that aren't up front: drag one in to show it, or a tile out to hide it. Below, the inspector holds the selected tile's keys and buttons, and its overrides: how it's shown, its own focus, Play in the band and Hide on phones.</desc>
<g id="ga-arranger__frame" data-slate-svg-step="1" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-1" x="40" y="40" width="920" height="600" rx="16" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-2" x="56" y="56" width="888" height="44" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ga-arranger__body-2" data-slate-fit-padding="16">Arranger</text>
<text x="500" y="84" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-2" data-slate-fit-padding="16">Presets · Close gaps · Use the default · Wide | Phone · Undo</text>
</g>
<g id="ga-arranger__canvas" data-slate-svg-step="2" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-3" x="56" y="112" width="612" height="420" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<rect id="ga-arranger__body-4" x="72" y="128" width="584" height="344" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" stroke-dasharray="6 5" />
</g>
<g id="ga-arranger__lead" data-slate-svg-step="3" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-5" x="76" y="132" width="284" height="188" rx="10" fill="var(--color-brand-bg)" />
<text x="92" y="164" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="17" font-weight="600" data-slate-fit-target="ga-arranger__body-5" data-slate-fit-padding="16">Lead</text>
<text x="92" y="186" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-on-brand)" font-size="13" data-slate-fit-target="ga-arranger__body-5" data-slate-fit-padding="16">6 × 4 cells</text>
</g>
<g id="ga-arranger__selected" data-slate-svg-step="4" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-6" x="364" y="132" width="284" height="92" rx="10" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="380" y="160" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ga-arranger__body-6" data-slate-fit-padding="16">Selected</text>
<text x="380" y="184" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-6" data-slate-fit-padding="16">Handles resize by whole cells</text>
</g>
<g id="ga-arranger__moves" data-slate-svg-step="5" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-7" x="364" y="228" width="140" height="92" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="380" y="256" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-7" data-slate-fit-padding="16">Same size: swaps</text>
<rect id="ga-arranger__body-8" x="508" y="228" width="140" height="92" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="524" y="256" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-8" data-slate-fit-padding="16">Picture</text>
<rect id="ga-arranger__body-9" x="76" y="324" width="188" height="92" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="92" y="352" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-9" data-slate-fit-padding="16">Pushed down, not lost</text>
<rect id="ga-arranger__body-10" x="460" y="324" width="188" height="92" rx="10" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="476" y="352" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-10" data-slate-fit-padding="16">Picture</text>
</g>
<g id="ga-arranger__hole" data-slate-svg-step="6" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-11" x="268" y="324" width="188" height="92" rx="10" fill="var(--color-status-warning-bg)" stroke="var(--color-status-warning-stroke)" stroke-width="1.5" />
<text x="284" y="352" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ga-arranger__body-11" data-slate-fit-padding="16">A hole is warned,</text>
<text x="284" y="372" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-status-warning-fg)" font-size="13" data-slate-fit-target="ga-arranger__body-11" data-slate-fit-padding="16">not refused</text>
</g>
<g id="ga-arranger__live" data-slate-svg-step="7" data-slate-svg-effect="fade-rise">
<text x="72" y="500" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-3" data-slate-fit-padding="16">Read aloud: columns 7 to 12, rows 1 to 2</text>
</g>
<g id="ga-arranger__tray" data-slate-svg-step="8" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-12" x="680" y="112" width="264" height="420" rx="14" fill="var(--color-neutral-bg-2)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="696" y="144" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="17" font-weight="600" data-slate-fit-target="ga-arranger__body-12" data-slate-fit-padding="16">Not up front</text>
<rect id="ga-arranger__body-13" x="696" y="164" width="108" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-14" x="820" y="164" width="108" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-15" x="696" y="248" width="108" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-16" x="820" y="248" width="108" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-17" x="696" y="332" width="108" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<rect id="ga-arranger__body-18" x="820" y="332" width="108" height="72" rx="8" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-1)" stroke-width="1.5" />
<text x="696" y="444" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-12" data-slate-fit-padding="16">Drag in to show, out to hide</text>
</g>
<g id="ga-arranger__inspector" data-slate-svg-step="9" data-slate-svg-effect="fade-rise">
<rect id="ga-arranger__body-19" x="56" y="544" width="888" height="80" rx="12" fill="var(--color-neutral-bg-1)" stroke="var(--color-neutral-stroke-2)" stroke-width="1.5" />
<text x="72" y="572" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-1)" font-size="15" font-weight="600" data-slate-fit-target="ga-arranger__body-19" data-slate-fit-padding="16">Selected tile</text>
<text x="72" y="600" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="13" data-slate-fit-target="ga-arranger__body-19" data-slate-fit-padding="16">Arrows move · Shift+arrows resize · Move and Size buttons · Fill or Fit · Remove from the band</text>
</g>
<text x="40" y="664" text-anchor="start" font-family="Segoe UI, system-ui, -apple-system, sans-serif" fill="var(--color-neutral-fg-2)" font-size="12">Every change saves, shows at once and can be undone.</text>
</svg>
<figcaption>The arranger: the band at its real width over the grid; tiles moved and resized by whole cells, swapped with a tile of the same size or pushing the others down; a hole warned about but allowed; the items not up front in the tray; the chosen tile's keys in the inspector.</figcaption>
</figure>

<details class="slate-figure-data">
<summary>The arranger, as a table</summary>

| Part | What it does | Rule |
|---|---|---|
| Toolbar | Presets, Close gaps, Wide or Phone preview, Undo | Every action can be undone |
| Canvas | The band at its real width over a faint 12-column grid | Tiles snap to whole cells |
| Chosen tile | Handles on its edges and corners resize it | By whole cells, 2 to 12 each way |
| Dropped on a tile of the same size | The two swap places | Nothing else moves |
| Dropped anywhere else | The tiles below are pushed down to make room | Never overlapping; refused past 12 rows, saying why |
| A hole | Shown hatched, with a warning | Allowed |
| Live region | Reads the chosen tile's place: "columns 7 to 12, rows 1 to 2" | After every move and resize |
| Tray | The items not up front | Drag in to show, out to hide |
| Inspector | The chosen tile's buttons and keys, Fill or Fit, Remove from the band | Every drag has a button and a key |

</details>

- **The canvas** is the band as it will look, at the page's wide width (scaled down to fit a narrow editor), over a faint grid of its cells. Pictures show as they will: filled round their focus or fitted.
- **Moving:** drag a tile; it snaps to cells as it moves, with its new place outlined. Dropped on a tile of the same size, the two swap. Dropped anywhere else, it takes its place and the tiles it would overlap are pushed down, in reading order, until nothing overlaps. A move that would push anything past 12 rows is refused, with the reason in the status line.
- **Resizing:** the chosen tile has handles on its edges and corners; they resize by whole cells, pushing tiles below down the same way.
- **The keyboard:** Tab goes from tile to tile in reading order. With a tile chosen, the arrow keys move it a cell, Shift with the arrow keys resizes it a cell, and Delete takes it out of the band. The inspector has a button for each, so every drag has a single-pointer alternative (WCAG 2.5.7). The live region reads each new place.
- **Close gaps** moves every tile up as far as it goes, in reading order, keeping its column. **Presets** ([§6.4](#64-presets-and-the-default)) replace the arrangement of the tiles up front. **Use the default** removes the owner's arrangement (and the phone's), so the band is worked out from the album again; it's shown only once the band has been arranged.
- **The tray** holds the items not up front. Dragging one onto the canvas puts it up front at 3 by 2 where it's dropped; dragging a tile to the tray (or Remove from the band) takes it out. A band can't take more than 12 tiles: the tray says so when it's full.
- **Phone** shows the phone's band, worked out by the rule ([§6.3](#63-on-a-phone)) and read only, with **Arrange for phones**, which copies it into an arrangement the owner can change with the same moves, handles and keys on 6 columns. Once arranged, the view says so, notes tiles added since, and offers **Back to automatic**, which removes it. Both views share the one undo history.
- **Per tile,** in the inspector:
  - how it shows its item: By kind (the default: Fill, or Fit for a drawing), Fill or Fit;
  - for a filled tile, **Its own focus here:** dragging the point on the tile's preview sets the tile's `focus`; **Use the picture's focus** removes it;
  - for a video file or an animated picture at most 10 MB, **Play in the band** ([§4.3](#43-motion)), refused with the reason for a third tile;
  - **Hide on phones** (`onPhones: false`), refused for the band's last tile on phones;
  - Remove from the band.
- **Warnings** stay beside the canvas while they apply: a hole, more than 8 rows (24 on the phone's own arrangement), a wide panorama in a small tile, a picture without a focus point filling a tile much narrower than it, and a tile playing in the band that weighs more than 4 MB.

### 9.4 Saving, undo and checks

- **Every change saves at once,** through the store, and shows at once ([editor spec §3.6](../editor/spec.md#36-optimistic-edits)): a move or a resize is drawn before the save returns. The status line follows the save ([editor spec §2.1](../editor/spec.md#21-saved-and-live)).
- **Undo and redo** (Ctrl or Cmd + Z, Shift + Ctrl or Cmd + Z) step through every change to the album in its three views, in one history: items added, moved, sorted or removed, their captions, descriptions, places and settings, the album's settings, every tile and its overrides, the phone's arrangement, and Use the default or Back to automatic. A picture's own details (alt text, focus point, date taken) belong to the picture, not the album, and aren't in its history, as in an article.
- **Live:** a change saved in another tab, or in the same album's other view, is taken in; an unsaved drag isn't lost.
- **Checks:** the content check runs before anything is written, so a layout that breaks a rule (V38 to V51) is refused with the reason, never saved. A warning (V40) saves and stays shown.
- **Publishing** an album needs at least one item, alt text on every picture and a title on every video; Publish says what's missing. A suggested alt text that hasn't been accepted doesn't count.
- **The arranger's logic is pure,** in edit mode's model (`album.ts`): moving, swapping, pushing down, closing gaps, resizing, the presets, and keeping the phone's arrangement in step, unit-tested, with no framework. The page's script only turns gestures into those calls.

### 9.5 The other screens

| Screen | Gains |
|---|---|
| Pages | Album as a kind; New album (as built, the list shows no counts: the album page's opening and its card carry them) |
| Sections | Albums, a choice in a section's View (as built, a choice in the Select, with no still) |
| Media | Used in lists albums; an SVG's "Keep it as a drawing" on upload, with what cleaning it removed; a picture's date taken, Find the focus, Keep it large on upload and Make it standard |
| The article editor | Album in the block inserter ([§7.2](#72-an-album-inside-another-page)) |
| AI | The switch "Suggest alt text for new pictures" ([§9.6](#96-suggested-alt-text)) |
| Access | A private album is shared like any private page |
| The action center | Finds albums by title, as it finds pages |

### 9.6 Suggested alt text

An album can bring in dozens of pictures at once, and each needs alt text. When the owner has an AI service set up in edit mode ([AI services](../editor/ai-services.md)), it suggests a first draft for each, so he reviews rather than writes:

- **Which service:** the writer he chose on the AI screen ([AI services §8](../editor/ai-services.md#8-the-ai-screen)), when its model accepts pictures (its Test finds out, [AI services §7.7](../editor/ai-services.md#77-testing-changing-and-removing)); none is added, and no other key. Without one, or with this switch off, nothing is suggested and the fields are as they were.
- **The switch:** "Suggest alt text for new pictures" on the AI screen, on when the writer accepts pictures.
- **When:** for each picture uploaded with an empty alt text, and on asking (Suggest, beside an empty alt text field in the details). Never for a picture that has alt text.
- **What's sent:** the picture at 960 px wide, without its file name, its metadata or the page's words. A private album's pictures are sent only when the service may get private pages ([AI services §6.2](../editor/ai-services.md#62-where-your-words-go)).
- **What's asked:** a description of what's visible, at most 250 characters; never "image of" or "picture of"; never who a person is, nor their age, ethnicity or anything else about them that can't be seen; text in the picture read out when it matters.
- **How it's shown:** in the field, marked **Suggested**, in the muted style, with Accept and Edit beside it. It's saved only when the owner accepts or edits it; until then the picture has no alt text, and publishing says so. **Use all suggestions** in the batch form accepts every one still showing.
- **Failure** is quiet: a picture whose suggestion fails or takes more than 20 seconds keeps an empty field, and the status line says how many weren't suggested.

The request and its words live with the other AI tasks in edit mode's server ([AI services](../editor/ai-services.md)); the rules for the answer (its length, the words it mustn't start with) are pure and tested.

## 10. Accessibility

The site's rules apply ([design system §7](../site-ui/design-system.md#7-accessibility), [editor spec §12](../editor/spec.md#12-accessibility)); for albums, specifically:

- **The band** is an `<article>` labelled by its heading, and its tiles a list of links in reading order. Each tile's name is its item's alt text (", animated" added for an animated picture; "Video: title" and its length for a video or an embed). "See all 21 in Summer sketches" names its album. Tiles are at least 44 px in both directions at every width.
- **The album page's cells** are links named the same way, in album order, each with a visible focus ring.
- **The lightbox** is a modal dialog: focus moves into it and back to the tile or cell it was opened from; the page behind is inert; the counter is a polite live region; Info is a toggle button with its state; the filmstrip is one named group with one Tab stop ([§8.4](#84-the-filmstrip)); a video keeps its native controls and caption tracks; an embed's iframe carries the video's title.
- **Motion:** the band is still unless the owner sets a tile to Play in the band, and then a Pause button pauses the band ([§4.3](#43-motion)); under reduced motion nothing in an album moves on its own, and transitions are instant. Anything animated can be paused where it plays.
- **Zoom** has a way in for every reader: buttons, keys and a double-click as well as pinching, and the arrow keys pan ([§8.8](#88-zoom)). Where an item can't be zoomed by the lightbox, the browser's own pinch zoom is left alone.
- **The Story layout** puts every item's words in the page, with its picture, so it needs no script to be read.
- **Contrast:** badges and the counts meet AA in light and dark mode, on the image shade; drawings without a dark version sit on paper in dark mode.
- **Reflow:** at 320 px wide and at 400% zoom the band is the phone arrangement, the lightbox's info panel a sheet, and nothing scrolls sideways.
- **Forced colours:** tiles, the current thumbnail and the arranger's chosen tile keep visible outlines in system colours.
- **The arranger** can be used without a pointer and without dragging, and says every change in its live region ([§9.3](#93-up-front-the-arranger)).

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

- **A still band by default** keeps a section of albums light: a GIF in a tile is its still poster, a video its poster, an embed its poster. A tile set to play costs its file only once it nears the screen.
- **Tiles ask for their own sizes:** a 2 by 2 tile never downloads a lead tile's picture.
- **Kept large** adds one 3840 px size per picture (about twice the 2560 px size's weight), fetched only for zoom or a very large screen.
- **Build time:** every picture is drawn once per size and kept by the build's picture cache, so 200 items don't cost 200 times every slot.
- **The site's weight** is measured on every build (`scripts/build-site.mjs`), because albums are the first feature likely to fill a site: 200 pictures at 2560 px and their sizes approach 200 MB.

## 12. Private albums

A private album is a private page ([access spec §2.1](../access/spec.md#21-in-their-sections-a10-a12)), with nothing new to learn:
- **Its page** is sealed whole: the opening, the introduction, every cell and its words ([access spec §5.4](../access/spec.md#54-sealing-a-page)). Its media are sealed and decrypted when shown ([§5.5](../access/spec.md#55-pictures-and-videos-a3)); its video files are at most 10 MB (V27). A download from it is the decrypted file, made in the browser.
- **Its band** in the Albums view is sealed as a private page's card is: kept in the section's order, decrypted in place for a reader whose access covers it, and invisible to anyone else. It can't be placed in another page as an album block (V51).
- **The lightbox** reads a private album's rest from its fetched page, which the sealed runtime decrypts with the key the reader already holds. If that can't be done, it falls back to the band's tiles ([§8.1](#81-opening-and-the-group)).
- **Never** on the planet, in a menu or in a redirect (V25, V28), and never named in telemetry.
- **The sealer** learns the lightbox's new attributes: every address in a sealed album's cells and tiles (the full size, the widths for the stage, the thumbnails, video sources and posters, a playing tile's file) is rewritten to its sealed copy, and the leak check covers them.

## 13. On the planet

- **The Amphitheater** shows the Gallery section, so its reading frame shows the Albums view, framed over the planet.
- **Inside the frame,** "See all" and a band's title open the album page in the same frame, staying inside the building, as every move does.
- **The lightbox** works in the frame as on the site, but adds nothing to history: the frame replaces its own entries, and Back belongs to the planet.
- **Copy link** copies the site's address for the item, never a `/play/` address, so a shared link opens the album on the site.

## 14. Telemetry, search and sharing

- **Telemetry:** one new event, `lightbox_opened`, with `place` (`album`, `section`, `article` or `block`) and `kind` (`picture`, `animated`, `drawing`, `video` or `embed`), added to both allowlists. `video_played` gains the place `lightbox`. No event carries an album's or an item's ID or title, and zooming and downloading send nothing.
- **Search:** an album page has its canonical address, its title, its summary as its description, and a raster social image (its `seo.image`, else its card picture; never a drawing, V46). The `#item-` addresses are parts of that page, not pages.
- **Sharing:** Copy link ([§8.6](#86-addresses-back-and-sharing)). A shared item's link shows the album's card on a social site and opens the item in the lightbox.

## 15. Components, tokens and code

| Piece | Tier | Change |
|---|---|---|
| `AlbumBand` | Compound (new) | One album's band: heading, counts, the bento grid of tiles, the short description, See all, and Pause when a tile plays. A container, with its own query size. Also drawn by the album block |
| `AlbumGrid` | Compound (new) | The album page's items: every item, justified, each cell with the item's address, its kind's badge, its caption when the album shows them, and its words' template; and the Story layout. As built in G3, a compound of its own rather than a mode of `Gallery` ([§20](#20-as-built)) |
| `Lightbox` | Compound | The album group, the stage's kinds, the info panel (with the date, the place and Download), Copy link, zoom, the filmstrip's single Tab stop, history. Its script moves to `scripts/lightbox.ts`, keeping the component under its line limit |
| `Image` | Fundamental | Takes a drawing (`.svg`): drawn whole at its own shape, with no set of widths |
| `IndexLayout` | Layout | Gains the `albums` view |
| `ArticleLayout` | Layout | The album page's opening (with its span of dates) and items for kind `gallery`, and the `album` block |
| `StoryCard` | Compound | Unchanged: its meta line carries the counts |
| `src/site/content/album.ts` | Pure | The rules (V38 to V51), the default and the presets, `phoneTiles` and keeping a phone arrangement in step, reading order, the counts and the span of dates |
| `src/site/content/providers.ts` | Pure (new) | YouTube and Vimeo in one list: address patterns, IDs, player and page addresses, oEmbed, the policy's hosts. The video block, edit mode and `csp.ts` read it |
| `src/site/scripts/lightboxRules.ts` | Pure | Building a group, the warming window, the history rules, the names, what may be downloaded and its file name |
| `src/site/scripts/zoomRules.ts` | Pure (new) | Where zoom is offered, its steps and limits, the pan's bounds |
| Edit mode: `AlbumItems`, `AlbumItemDetails`, `AlbumArranger`, `AlbumSettings` | Editor parts | The Items and Up front views and the album's settings, each within the editor's part limits |
| `src/site/editor/model/album.ts` | Pure | The Items view's operations (adding, removing, moving, Sort by date taken, an item's fields, the album's settings, Up front's switch); the arranger's operations and the phone's arrangement join it with G6 |
| `src/site/editor/server/albumItems.ts`, `server/albumEmbed.ts` | Server (new) | The Items view's cards, counts and weight; a YouTube or Vimeo address's details and its poster, kept as the site's own picture |
| Media: the SVG sanitizer | Server | Cleaning and checking drawings, with tests of hostile SVGs (`src/site/editor/model/svgSanitize.ts`) |
| Media: reading at upload | Server | The date from the file's EXIF, read directly by the project's own small reader (`src/site/editor/model/exif.ts`, no dependency), the focus from the image library's attention measure, Keep it large |
| Edit mode: suggested alt text | Server | The request to the writer, with the AI services' other tasks; its answer's rules pure in edit mode's model |

- **Tokens:**
  - `c.album` (owned by `AlbumBand`): the gap, the compose query size (marked as a container size), the band's space, the drawing's paper;
  - `c.lightbox`: the info panel's width, beside its existing thumbnail size;
  - `c.editor-arranger` (owned by `AlbumArranger`): the grid's line, the hole's hatching, the chosen tile's outline and the drop outline.
- **Icons:** the Play badge reuses the video block's; new ones for Animated, Info, Copy link, Pause, Zoom in, Zoom out and Download, imported one at a time into the icon set.
- **Stories:** `AlbumBand` (still and playing), the Gallery's album mode (with captions, and as a Story), the Lightbox's album states (the info panel with a date and Download, zoomed), the album block and the editor parts each get their stories, so they appear in the design library and its screenshots.

## 16. Rules

New rules, checked by the content check for every site, continue the numbering of the [sections spec](../sections/spec.md#8-rules) and the [access spec](../access/spec.md#10-content-rules):

| Rule | Says |
|---|---|
| V38 | An album's items are 1 to 200 when it's published (0 to 200 as a draft; a published Gallery page from before albums, whose body still shows its pictures, may have none); each `id` is well formed and unique in the album; each has exactly one of `media` and `embed`; its media is a picture, an animated picture, a drawing or a video file; every picture has alt text and isn't decorative |
| V39 | A showcase has 1 to 12 tiles, each naming an item of the album once; each tile is 2 to 12 cells each way, inside the 12 columns and 12 rows; no two overlap |
| V40 | Warnings, not refusals: a hole in the band; a band more than 8 rows tall; a phone arrangement more than 24 rows tall; a tile playing in the band that weighs more than 4 MB; a video file without captions (the check can't hear speech, so it warns for every video file without a caption track) |
| V41 | Words: an item's caption at most 200 characters; its description at most 4 paragraphs or lists and 1,000 characters; the album's description at most 6 and 1,500; both of the rich-text subset |
| V42 | A drawing is an SVG at most 200 KB, cleaned ([§4.1](#41-drawings-svg-kept-as-a-vector)), with a viewBox or a size; its dark version follows the same rules |
| V43 | `album` is only on a page of kind `gallery`, and every such page has one. The section views (V18) gain `albums` |
| V44 | A private album follows the private page's rules: its media sealed, its videos at most 10 MB, never on the planet, in a menu or in a redirect (V25, V27, V28) |
| V45 | An embed is from a provider in the list (YouTube or Vimeo), with an ID of the provider's shape, a title and a raster poster |
| V46 | A page's social image is a raster picture, never a drawing |
| V47 | A phone arrangement needs the wide one (`showcase.tiles`) and names each tile of it shown on phones exactly once; its tiles are 2 to 6 columns wide and 2 to 8 rows tall, inside the 6 columns, never overlapping. At least one tile is shown on phones |
| V48 | A tile's `focus` is two percentages and only on a filled tile; `play` only on a video file or an animated picture at most 10 MB, and on at most 2 tiles of a band |
| V49 | An album's `layout` is `grid` or `story`; `captions` only with `grid`; `download` (the album's or an item's) never on an embed |
| V50 | An item's `place` is plain text of at most 80 characters. A picture's `taken` is a real date, no later than the day it was saved; `large` only on a raster still picture whose master is wider or taller than 2560 px and at most 3840 px |
| V51 | An `album` block names an existing page of kind `gallery`; never a private one, never the page it's in, and never an unpublished one from a published page |

## 17. Decisions

| # | Decision | Why |
|---|---|---|
| D-G1 | **"Album"** is the word in the model, the code and edit mode; the stored kind stays `gallery`, and "Gallery" stays the section's name | "Collection" is already a block (`collection`) and a component; an album is what people call a set of pictures with a title |
| D-G2 | **An album is a page** of kind `gallery` with an `album` field, not a new resource | It inherits addresses, status, access, cards, the editor and every check; a new resource would need all of them again |
| D-G3 | **A new section view, Albums,** not a block on a page | The request is for the gallery's main view; a view keeps every album its own page and lets any section use it |
| D-G4 | **Items and tiles are kept apart:** `items` is the album, `showcase.tiles` the band | Curation up front never changes the album, and an item can leave the band without leaving the album |
| D-G5 | **Twelve columns of square cells,** tiles of whole cells from 2 to 12 | The snapping asked for; square cells keep a tile's shape at every width; 12 divides into halves, thirds, quarters and sixths |
| D-G6 | **A phone layout worked out** on 6 columns by a fixed rule, **which the owner can arrange himself** when it's wrong | The owner arranges once; a second layout to keep in step is upkeep he didn't ask for, so it's there only where he wants it, and it keeps up with the wide band by itself |
| D-G7 | **SVG kept as a drawing** on request, sanitized, drawn with `<img>` | Drawings and diagrams stay sharp; `<img>` never runs a script, and sanitizing guards the file itself |
| D-G8 | **Formats that can't be kept are refused** with what to do, never silently changed | The owner should know when a file can't be what he uploaded (APNG, JPEG XL, RAW, MKV) |
| D-G9 | **The band is still by default;** the owner can set up to 2 tiles to play, muted, with a Pause | Weight, calm and WCAG 2.2.2; a moving picture is content he chooses, as a video block's `autoplay` is, and the interface itself never moves on its own |
| D-G10 | **The album page shows every item in the justified grid** by default, with words in the lightbox; Story is the owner's choice for an album that's read in turn | The grid is for looking; the words are a press away; one item has one address |
| D-G11 | **The lightbox's group is the whole album,** fetched from the album page when opened from a band | The filmstrip asked for; fetching keeps the section page light, and the reader's next page is cached |
| D-G12 | **Back closes the lightbox,** everywhere but the planet's frame | What phone readers expect of anything that fills the screen; the frame's history belongs to the planet |
| D-G13 | **An album's editor gains two views** (Items, Up front) beside Page, in one undo history | Ordering many items and arranging a grid don't fit the block canvas, but they're the same page |
| D-G14 | **The lightbox follows the album's order,** not the band's | The album's order is its story; the counter and the filmstrip mean the same thing wherever it's opened |
| D-G15 | **Automatic first, override anywhere:** every choice has an answer worked out from the content; an override is stored only where the owner makes one, and Back to automatic removes it ([§18](#18-automatic-and-where-to-override-it)) | The owner wants the least upkeep with control where he wants it; a worked-out answer that's never saved keeps up with the album by itself |
| D-G16 | **The focus point is measured at upload,** and a tile can have its own | Most pictures then need no focus set by hand; one tile's crop never moves the picture's other uses. Pictures already in the library aren't measured, so nothing on other pages moves |
| D-G17 | **The date taken comes from the file** and is kept in the picture's sidecar; **the place is typed,** never read from GPS; the camera isn't shown | The date costs the owner nothing and is the most useful fact about a picture; a location read from a file can say where someone lives |
| D-G18 | **Zoom is built,** for pictures with more to see, with buttons and keys as well as gestures | Drawings, sketches and panoramas lose their detail at the stage's size; the browser's pinch zooms the whole page, not the picture, and has no way in without touch |
| D-G19 | **Downloads are off unless the owner allows them,** for an album or an item; never for an embed | His work is his to hand out; a reader can still look as closely as zoom allows |
| D-G20 | **Providers are one list in code,** YouTube and Vimeo for now | Three readers knew them apart; one list makes the next provider one entry, and a file covers any other video today |
| D-G21 | **An album can be shown in another page** as a block, as arranged, its words never copied | A project's article can carry its pictures without a second copy to keep up |
| D-G22 | **Alt text is suggested** by the owner's own AI service and saved only when he accepts it | Writing alt text for dozens of pictures is the upkeep most likely to be skipped; a suggestion he reviews keeps every picture described without taking the decision from him |
| D-G23 | **No "up front first" button:** the default band follows the album's order until he arranges it | The band and the album keep their own orders (D-G4); Use the default gives the album's order back without a second list |

## 18. Automatic, and where to override it

Every choice in an album has an answer worked out from its content, so an album the owner only fills with pictures is complete; he overrides any answer where he wants to, and only there ([D-G15](#17-decisions)). An automatic answer is worked out every time, never saved, so it keeps up with the album by itself. An override is stored where it applies, and **Back to automatic** (under the name each place gives it) removes what it stored.

| What | Automatically | Override, and where | Stored | Back to automatic |
|---|---|---|---|---|
| Which items are up front, and how they're arranged | The album's first items in the preset that suits their number ([§6.4](#64-presets-and-the-default)) | Arranging the band, in Up front ([§9.3](#93-up-front-the-arranger)) | `showcase.tiles` | Use the default |
| The phone's band | Worked out from the wide band by the rule ([§6.3](#63-on-a-phone)) | Arrange for phones, in Up front's Phone view | `showcase.phone.tiles` | Back to automatic |
| A tile on phones | Shown | Hide on phones, in the tile's inspector | the tile's `onPhones` | Show on phones |
| How a tile shows its item | Fill for pictures, videos and embeds; Fit for drawings | Fill or Fit, in the tile's inspector | the tile's `display` | By kind |
| Where a picture is cropped | Its focus point, measured when it's uploaded ([§4](#4-media)) | Dragging the point in the picture's preview (every use), or on one tile (that tile only) | the sidecar's `focus`; the tile's `focus` | Find the focus (the picture); Use the picture's focus (the tile) |
| A tile that plays in the band | Still | Play in the band, in the tile's inspector, within its limits ([§4.3](#43-motion)) | the tile's `play` | Turning it off |
| An item's caption | The picture's own caption | Its caption in this album, in its details | the item's `caption` | Clearing it |
| The date taken | Read from the file at upload | Changing or clearing it, in the details | the sidecar's `taken` | Clearing it hides it |
| Dates on the album | Shown where known; the album's opening shows their span | Show dates taken, in the album's settings | the album's `dates` | Turning it back on |
| The place | None: never read from the file | Typing it, in the details | the item's `place` | Clearing it |
| A picture's largest size | 2560 px | Keep it large, when it's uploaded | the sidecar's `large` | Make it standard |
| The album page's layout | Grid | Layout: Story, in the album's settings ([§7.1](#71-story)) | the album's `layout` | Layout: Grid |
| Captions under the cells | None | Captions under pictures, in the album's settings | the album's `captions` | Turning it off |
| Downloads | None | Allow downloads, for the album; Allow or Don't allow, for an item | the album's and the item's `download` | Follow the album; turning it off |
| An embed's title, shape, length and poster | From the provider when the address is pasted; the poster its thumbnail, kept as the site's own picture | Changing any of them, in the details | the item's `title`, `embed`, `duration` and `poster` | Pasting the address again |
| Alt text | Suggested by the owner's AI service when he has one ([§9.6](#96-suggested-alt-text)) | Accepting, editing or writing it | the sidecar's `alt` | None: alt text is never removed automatically |
| The album's card and social picture | Its thumbnail, else its first picture up front, else its first picture | Choosing a thumbnail or a social image, in the page's settings | the page's `thumbnail`, `seo.image` | Clearing it |
| The counts | Worked out from the items | None | Nothing | Nothing |
| The info panel | Closed; then as the reader left it, for the visit | The reader's own choice | The reader's session | Not the owner's |

## 19. Not in this version

- A slideshow that moves on its own.
- Downloading the files as they were uploaded (they aren't kept); readers download the largest published size where it's allowed ([§8.3](#83-words-the-caption-and-the-info-panel)).
- Structured data for galleries (JSON-LD).
- A private album inside another page (its words would leave its seal).
- Comments, likes or counts of views on items.
- Sorting or filtering an album by readers; the owner can sort by date taken ([§9.2](#92-items)).
- Albums inside albums (the site keeps its three levels).
- Video providers beyond YouTube and Vimeo; a video from elsewhere is uploaded as a file.
- A video tile's preview playing on hover.
- The camera and its settings, and a place read from the file's location.
- Captions or descriptions written by AI; only alt text is suggested.

## 20. As built

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
- **The stage ([§8.2](#82-the-stage-by-kind)):** a picture and its dark version; an animated picture playing, with Pause and Play over its corner, starting paused on its still (`data-still`, `data-still-dark`) under reduced motion; a drawing measured to fill the stage, on the paper panel (`c.lightbox.drawing-paper`) in the dark when it has no dark version; a video file's player (`controls`, `playsinline`, `preload="metadata"`, its `data-loop`) with every caption track from `data-tracks`, playing only when it was pressed open; an embed's poster with Play focused, its player made only after the press and removed on moving on.
- **Words ([§8.3](#83-words-the-caption-and-the-info-panel)):** the caption under the stage, with More when there's a description; the info panel (Info, or I) beside the stage past the 56 rem breakpoint at `c.lightbox.info-width`, over the stage's foot on a phone, kept open or closed for the visit (`sessionStorage`), the caption moving into it; the date taken and the place, the credit, a video's length (`data-duration`), an embed's Watch on YouTube or Vimeo, Download with its kind and weight where `data-download` allows it, and From the album with Open the album (left out on the album page).
- **The filmstrip ([§8.4](#84-the-filmstrip)):** every item with its kind's badge and its name ("Show 7: …"), one Tab stop with a roving tab index, the arrows, Home and End moving the stage with the focus.
- **Addresses ([§8.6](#86-addresses-back-and-sharing)):** `#item-<id>` pushed on the album page and replaced as it moves, a state entry elsewhere, nothing in the planet's frame (`html[data-frame="planet"]`); Back closes, closing unwinds the entry, and a page loaded at `#item-<id>` opens there and closes to its cell. Copy link gives the album's address on the site plus `#item-<id>`, announced, or the address selected in a field where the clipboard can't be written.
- **Warming ([§8.7](#87-loading)):** a group of 24 or fewer whole, nearest first; a larger one 4 either side, again after every move; never a sealed file.

The cells and tiles gained the attributes the stage needs: `AlbumGrid`'s links `data-stage` (a large picture's stage size), `data-still`, `data-still-dark`, `data-duration`, `data-tracks` and `data-loop`; `AlbumBand`'s tiles `data-lightbox="band"`, `data-index` and `data-count`, and its root `data-album-site`, the album's address on the site, which Copy link reads so that a band inside the planet's frame still gives the site's address (Open the album and See all keep the address in the frame, so the reader stays in the building). Opening dispatches `site:lightbox` on the document with `{ place: 'band' | 'album' | 'page', kind }`, nothing else, for telemetry to listen to (G7). The tokens added: `c.lightbox.info-width` and `c.lightbox.drawing-paper`; the icons Info, Download, Copy and Link were already in the set. Differs from the spec:
- **The stage shows one size,** the 2560 px picture (a large picture's `data-stage`), as the article lightbox did, rather than a width chosen from 960, 1600 and 2560 for the stage; and a slow picture isn't shown as its softened thumbnail first: items cross-fade as before, and warming has the neighbours ready.
- **Download's file name** is `<album title's slug>-<item id>.<ext>` (`fileSlug`, "album" when there's no title), never from the address, which for a private album is its secret token; §8.3 says so.

Evidence (passed, 22 October 2026): `tests/unit/lightboxRules.test.ts`; the E2E group "gallery: lightbox" (`tests/e2e/gallery.spec.ts`, 11 tests: from a band with the album page's fetch held back, the fallback when it fails, one test per kind including reduced motion, the keyboard, addresses and Back with Copy link, downloads, and the story `Lightbox`'s "An album"); "gallery": "an album in another page: a tile opens the lightbox on the whole album" (`tests/e2e/gallery-block.spec.ts`); "planet": "reading on the planet: albums…" and "…a band's Copy link in the frame gives the site's address" (`tests/e2e/planet.spec.ts`); the article lightbox's "site design system" test in `tests/e2e/site.spec.ts`, unchanged and passing.

**The Items view (G5).** Pages has **New album** beside New page and New article (the same form, with the kind Gallery), which opens the new album on its Items view; the list shows an album's kind as Album. In the page's settings an album's kind is locked, other pages can't choose Gallery, and an **Album settings** group holds the layout (Grid or Story), Captions under pictures (Grid only), Show dates taken, Allow downloads and the album's introduction; a default removes the field (`AlbumSettings`). An album's editor has three views, links in the top bar's tools (`data-album-view`, `?view=items` and `?view=front`), sharing one undo history. **Items** (`AlbumItems`, `AlbumItemDetails`, `AlbumAddForms`, the script `src/site/editor/scripts/album.ts`) is the cards in album order beside the chosen card's details, as §9.2 says: Add from the library, Upload (a batch, each file with its alt text, caption and the date read from the file, and Use all suggestions), Add a video link ("Add a YouTube or Vimeo video": `src/site/editor/server/albumEmbed.ts` asks the provider for the title, shape and Vimeo's length, and keeps its thumbnail as the site's own picture, alt text "Still from: <title>"), Sort by date taken, the album's weight under the grid; Shift and Ctrl choose several, a drag or Alt with an arrow moves them (Alt+Home and Alt+End to the ends), Delete removes, and every change saves at once and can be undone. The operations are pure in `src/site/editor/model/album.ts`; the cards, counts and weight come from `src/site/editor/server/albumItems.ts`. Media's Used in lists the albums a picture is in. Differs from the spec: a picture's own alt text, date taken and focus point are shown in the details with a link to Media, where the alt text and the focus point are changed; no screen changes the date taken yet: it's read from the file on upload, and Replace fills it when the sidecar has none ([§9.2](#92-items)); Pages shows no counts; until G6 the Up front view says the arranger comes next, and the Up front switch in Items puts an item in the band's next free place. Evidence: `tests/unit/editorAlbum.test.ts` (adding, removing, ordering, Sort by date taken, up front, the settings, every override back to automatic, the cards and the weight); the E2E group "editor: albums" (`tests/e2e/editor-albums.spec.ts`); the stories `AlbumItems`, `AlbumItemDetails`, `AlbumAddForms` and `AlbumSettings`.

**The arranger (G6).** Up front (`?view=front`, `&show=phone` for the phone's band, `&tile=` for the chosen tile) is the part `AlbumArranger` (`src/site/editor/components/AlbumArranger.astro`, its script `scripts/arranger.ts`, its story), drawn from `albumArrangerView` (`src/site/editor/server/albumArranger.ts`). Its rules are pure in `src/site/editor/model/arranger.ts`: whole cells on the 12 columns (6 on phones), a tile 2 to 12 cells each way (at most 8 rows on phones), never overlapping; a tile dropped on one of its size swaps with it, anywhere else it pushes what it covers down in reading order, and a change that would pass 12 rows is refused with its reason. Arrows move the chosen tile a cell, Shift with them resizes it; the inspector's buttons do the same; each move is said in a live line outside the redrawn region (its columns and rows), and each refusal is said there and in the status line ("Not saved: …"), changing nothing. The pointer drags a tile to a cell, its right, bottom or corner handle to a size, a tray item into the band and a tile out to the tray, with a dashed outline marked `data-refused` while the drop would be refused; the handles and the drag are the pointer's alone (`aria-hidden`). Every change is saved through the article's own save (`PUT articles/<id>`, its version checked, a conflict opens the conflict dialog), shown at once, kept in the article editor's history (Undo and Redo in the part), and the region drawn again when saved. The phone's band is worked out (nothing moves) until **Arrange for phones** copies it as the owner's; **Back to automatic** drops it. While it's the owner's, a tile put up front wide joins its end and one taken out leaves it, and the live line says so. **Use the default** removes the whole arrangement, the phone's too. Every way back leaves the file as it was before the override, except where §6.3 says otherwise (Show on phones with a phone arrangement puts the tile back at its end) and Use the default (which removes the arrangement); a band that comes back to the default's tiles with no phone arrangement left is dropped from the file. No new tokens: the phone's canvas is `--c-editor-inspector` wide. Data attributes for tests: `data-album-arranger`, `data-arranger-canvas`, `data-arranger-place` and `data-arranger-tile` (a tile), `data-arranger-handle`, `data-arranger-outline`, `data-arranger-tray-item`, `data-arranger-show`, `data-arranger-preset`, `data-arranger-phone-arrange`, `data-arranger-phone-back`, `data-arranger-default`, `data-arranger-close`, `data-arranger-live`, and the inspector's `data-arranger-move`, `-size`, `-display`, `-focus`, `-focus-reset`, `-play`, `-phones`, `-remove`. Evidence: `tests/unit/editorArranger.test.ts` (every §18 row the arranger owns, on an arranged band and the default one, the file compared after its way back); E2E "editor: albums": "the arranger by drag…", "the arranger by keyboard…", "arranging for phones…" (all three passed).

**Private albums, the planet and telemetry (G7).** What was built, by the spec's sections:
- **A private album's band ([§12](#12-private-albums)):** in the Albums view, `IndexLayout` draws a private album's band (its `div.album` holding the `AlbumBand`) inside the section's sealed cards, a `template[data-sealed]` that names no album, placed after the node it follows so it opens in the section's order. `Page.astro` lists only open albums in the public HTML and hands each sealed page its band (`privateBands`). The sealed runtime (`src/site/scripts/sealed.ts`) decrypts it in place for a covered reader, as it does a card, then dispatches `astro:page-load` so the band's and the lightbox's scripts set it up.
- **Its album page** is sealed whole (`<!--sealed:main-->`), cells, words and links included, like any private page ([access spec §5.4](../access/spec.md#54-sealing-a-page)).
- **Its files:** the sealer (`integrations/seal.mjs`) swaps every private file's address in a sealed region for its sealed copy, wherever it sits: a `srcset`, a tile's `data-src` and `data-srcset`, a link's `href`, `data-full`, `data-thumb`, their dark versions, a poster, a still, the stage size, `data-download` and `data-tracks`; a `src`, `srcset` or `poster` becomes `data-sealed-*`, so the browser never fetches a sealed file as a picture or a video. The runtime decrypts each file once (a cache in `decryptMedia`). A press on a sealed lightbox link decrypts its group's attributes first (a band's own tiles, or every link of the group on the page; of a `srcset`, only the width the screen needs), then presses it again. A band's tiles that play wait without `data-plays` until their files are decrypted (`unsealMotion`), so a tile never asks for a sealed file.
- **The leak check (`scripts/verify-sealed.mjs`)** gained a private album's words (its introduction, and each item's caption, title, place, credit and description), the cue text of a private video's caption tracks (`.vtt`, never its timings), and a structural check: no private file's address may be readable anywhere in the build, in a page's HTML, a link or a band.
- **The fixture:** a made-up private album in `tests/fixtures/private-pages/` (`fx-private-album`, in the section `talks` with the public fixture albums: a picture with its dark version, a video with its poster and an English caption track, and a second picture). One existing test code covers it and another doesn't, for the negative case.
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