# Gallery: plan and Definition of Done

How the [spec](spec.md) is built: ten phases, each leaving the site, edit mode and the planet working and deployable, each ending with its checks passing and a merge. The order follows what the owner can use soonest: albums he can see on the site first, with the content written by hand if need be, then the lightbox, then the screens to make them in edit mode, then zoom, the album block and suggested alt text.

Throughout, every choice is automatic first and his to override ([spec §18](spec.md#18-automatic-and-where-to-override-it)): each phase builds the automatic answer with the feature, and its override and Back to automatic with the screen that edits it.

> **TL;DR.**
> - **Status:** specified (22 October 2026), with every choice settled as automatic first, override anywhere. Built: G1, G2, G3, G5, G9 and G10 (recorded in the [spec's As built](spec.md#20-as-built)); in progress: G4, G6, G7 and G8.
> - **G1: the model and the media.** The `album` field and V38 to V50, drawings (SVG kept as a vector, sanitized), video caption tracks, the refused formats and the APNG note, the date and the focus point read at upload, Keep it large, one list of video providers, the pure `album.ts` (presets, the default, `phoneTiles`, counts).
> - **G2: the Albums view.** `AlbumBand`, the bento grid on square cells, the phone arrangement (worked out or the owner's, tiles hidden on phones), tiles that play with the band's Pause, the section view `albums`, and the Gallery section switched to it.
> - **G3: the album page.** The opening with its span of dates, the introduction, every item in the justified grid (captions under it when asked) or as a Story, with its address and its words, without scripts too.
> - **G4: the lightbox.** The whole album as the group (fetched from a band), every kind on the stage, the info panel with the date, the place and Download, the filmstrip's single Tab stop, Copy link, Back closes, windowed warming; its script moved out of the component.
> - **G5: edit mode, Items.** New album, the editor's three views and the album's settings, adding (library, files, YouTube and Vimeo with their poster taken automatically), ordering and Sort by date taken, the details pane.
> - **G6: edit mode, Up front.** The arranger: drag, resize, swap, push down, Close gaps, presets, Use the default, the tray, the keyboard, the phone's view with Arrange for phones, and each tile's focus, Play in the band and Hide on phones.
> - **G7: private albums, the planet and the rest.** Sealed bands and albums, the sealer's new attributes, the planet frame, telemetry, the site's weight check, the docs.
> - **G8: zoom** in the lightbox, with buttons and keys as well as gestures.
> - **G9: the album block,** an album's band inside any page.
> - **G10: suggested alt text,** from the owner's own AI service.

## 1. Phases

### G1: the model and the media (U1, U5, U6, U7)

1. **The contract** (`schema.ts`):
   - the `album` field on kind `gallery` only, and required there (V43): `description`, `items`, `showcase.tiles`, `showcase.phone.tiles`, and the settings `layout`, `captions`, `dates` and `download`, as [spec §3.3](spec.md#33-fields) (V47, V49);
   - an item: `id`, exactly one of `media` and `embed`, `title`, `poster`, `duration`, `caption`, `description`, `place`, `download`, `autoplay`, `loop` (V38, V41, V45, V49, V50);
   - a tile: `item`, `x`, `y`, `w`, `h`, `display`, `focus`, `play`, `onPhones` (V39, V48);
   - an image's sidecar gains `taken` and `large` (V50);
   - the section views gain `albums` (V18);
   - an image's `file` and `dark.file` may end `.svg` (V42);
   - a video's `captions` tracks ([media §3](../content/media.md#3-the-metadata-sidecar));
   - a page's social image is raster (V46).
2. **`src/site/content/album.ts`** (pure, unit-tested): V39, V40, V47 and V48 (bounds, overlaps, holes, rows, the phone arrangement, tiles that play), reading order, the counts and their words, the span of dates, the six presets, the default, `phoneTiles` (over the tiles shown on phones) and keeping a phone arrangement in step with the wide band, and the card picture's fallback.
3. **The loader:** an existing page of kind `gallery` reads as an album with no items; the content check runs V38 to V50 for every site, with warnings shown as warnings.
4. **Drawings:**
   - the SVG sanitizer on the server (cleaning, refusing, measuring the viewBox), with a test file of hostile SVGs (scripts, handlers, `foreignObject`, outside references, `javascript:`, `@import`, oversized embedded pictures);
   - the upload form's choice, Keep it as a drawing or Turn it into a picture;
   - `Image` draws an `.svg` whole with its own shape, and a dark `.dark.svg`;
   - the build copies drawings as they are (no sizes), with content-hashed names.
5. **Formats:** the APNG note; JPEG XL, RAW, PSD, MKV, AVI, WMV and 3GP refused with what to do; HEIC the browser can't read, as today.
6. **Reading at upload** ([spec §4](spec.md#4-media)):
   - the date taken from the file's EXIF (`DateTimeOriginal`, else `DateTime`) into the sidecar's `taken`, with a small pinned reader or the few bytes it needs read directly (nothing in the site reads EXIF today); for a HEIC, read in the browser before it's turned into PNG, and sent with it;
   - the focus point from the image library's attention measure into the sidecar's `focus`, for new uploads only; Find the focus runs the same measure on asking;
   - Keep it large: a master up to 3840 px, and its 3840 px size for the lightbox; Make it standard saves it again at 2560 px.
7. **One list of video providers** (`src/site/content/providers.ts`, pure, unit-tested): YouTube's and Vimeo's address patterns, IDs, player and page addresses, oEmbed endpoints and policy hosts; the video block's component, edit mode's shape and inspector, and `csp.ts`'s `VIDEO_HOSTS` read it, each unchanged in what it does.
8. **Video caption tracks** reach `Video` from the sidecar.
9. **A fixture album** in the test content: 21 items of every kind (pictures, an animated GIF, a drawing with a dark version, a video file with captions, a YouTube and a Vimeo embed), with a showcase, dates and places on some items, a picture kept large, and a fixture picture with EXIF dates for the upload tests.

### G2: the Albums view (U2, U3, U4, U12, U13)

1. **`AlbumBand`** (compound, with its story): the heading and counts, the tiles as a list of links, the short description, See all, the badges, Pause when a tile plays; a container with `c.album.query-compose`.
2. **The grid:** 12 columns of square cells, places from the tiles' custom properties, the phone's from the owner's arrangement or else `phoneTiles`, tiles hidden on phones left out there; Fill round the tile's own focus or else the picture's, and Fit on the picture's own colour; each tile's sizes from `sizes()`.
3. **Tiles that play** ([spec §4.3](spec.md#43-motion)): a small script of its own, loaded only by a band with a playing tile; at most 2 per band, muted and looping, only while at least half is in view, the file loaded when near; never under reduced motion or Save-Data; the band's Pause, remembered for the visit.
4. **`IndexLayout`'s `albums` view:** bands in the section's order, other pages as feature cards, the dinkus between bands, the first band eager.
5. **Tokens:** `c.album` (gap, query size, band space, drawing paper), built with `build-site-tokens.mjs`; the Animated and Pause icons imported.
6. **The Gallery section** switches to the Albums view (content).
7. **Edit mode's Sections** offers Albums in the view chooser, with its still.

### G3: the album page (U8)

1. **`ArticleLayout`** for kind `gallery` with an album: the opening (crumbs, title, standfirst, counts, the span of dates taken or else the page's date; the lead picture only when set), the introduction, the items, the body, the page's end.
2. **`Gallery`'s album mode:** every item in the justified grid at the wide width, each cell `id="item-<id>"` in the group `album`, posters with badges for videos and embeds, the words in templates, captions under the cells when the album asks (two lines at most), and the links that work without scripts.
3. **Story** ([spec §7.1](spec.md#71-story)): the album's `layout: "story"`, each item at the wide width, whole, with its caption, description, date and place under it at the text width, in the same group and addresses.
4. **Album cards elsewhere:** the counts in the meta line, the card picture's fallback.

### G4: the lightbox (U14)

1. **The script moves** to `src/site/scripts/lightbox.ts`, with its rules pure in `lightboxRules.ts` (building a group, the warming window, the history rules, the names), unit-tested. `Lightbox.astro` keeps the markup and styles, under its line limit.
2. **The group:** the album's cells; from a band, `data-index` and `data-count` at once, then the album page fetched (on press, focus or hover; once per album) and read; the fallback to the band's tiles with "See all" at the strip's end.
3. **The stage, by kind:** pictures from their widths with their dark version; animated pictures with Pause; drawings, on paper in dark mode without a dark version; video files with their controls and caption tracks, playing only when opened by a press; embeds as a facade, then the player, removed on leaving.
4. **The info panel** (side column or sheet), More, Info and the I key, kept for the visit; `c.lightbox.info-width`; the date taken when the album shows dates, the place, and Download when the album or the item allows it (named `<album title's slug>-<item id>.<ext>`, the decrypted file for a private album; the Download icon imported).
5. **The filmstrip:** every item, one Tab stop, the arrow keys, lazy thumbnails, badges, names.
6. **History:** `#item-<id>` on the album page (opening at a loaded address), a state elsewhere, nothing in the planet frame; Back closes everywhere else.
7. **Copy link,** with its announcement and its fallback field.
8. **Warming:** whole for 24 items or fewer, a window of 4 either side above that.
9. **Article lightboxes** keep working and gain Back, the single Tab stop and video items from gallery blocks.

### G5: edit mode, Items (U9, U11)

1. **New album** beside New article and New page; Pages shows Album and its counts.
2. **The editor's views:** Page, Items and Up front, as links in the top bar's tools (shown in Atiya Studio's title bar), `?view=`, one save queue and one undo history; the Page view's Album group (part `AlbumSettings`: Layout, Captions under pictures, Show dates taken, Allow downloads), each removed from the file when set back to its default.
3. **Items** (parts `AlbumItems` and `AlbumItemDetails`, with stories on the parts library): the cards, the split view, the details pane (focus point with Find the focus, alt text, caption, description in `RichField`, the date taken with Clear, the place, Download, Make it standard, Up front, Play by itself and Loop, an embed's title, poster, length and shape, Remove from the album), the album's weight.
4. **Adding:** the picker (several at once), dropped files with the batch form (the date taken, Keep it large), and a YouTube or Vimeo address (oEmbed through the dev server for its title, shape, length and thumbnail; the thumbnail kept once as the site's own picture and set as the poster, alt "Still from: <title>"). A stand-in fetch for tests.
5. **Ordering:** drag, Alt with the arrow keys, Move to start and Move to end, several at once, and Sort by date taken (undoable, undated items last in their order); every change at once (optimistic) and in the history.
6. **The pure model** (`src/site/editor/model/album.ts`): adding, removing, moving, choosing several, sorting by date; unit-tested.

### G6: edit mode, Up front (U10, U11, U12, U13)

1. **The arranger** (part `AlbumArranger`, with its story): the canvas at the band's real width over its grid, tiles snapping to cells, handles, the drop outline, holes hatched.
2. **Its operations** in the pure model: move, swap, push down, resize, Close gaps, presets, Use the default (removing the showcase and the phone's arrangement), putting up front from the tray and taking out, refusing past 12 rows or 12 tiles, each with its reason.
3. **The keyboard:** Tab between tiles, the arrow keys to move, Shift with the arrow keys to resize, Delete to take out; the inspector's buttons for each; the live region.
4. **The tray, the Phone view,** Fill or Fit, and the warnings (past 8 rows wide or 24 on the phone, a playing tile over 4 MB).
5. **The phone's arrangement** ([spec §6.3](spec.md#63-on-a-phone)): Arrange for phones starts from the worked-out one; the same moves on a 6-column grid (2 to 6 columns wide, 2 to 8 rows tall); kept in step when tiles are added or removed wide, with a note; Back to automatic removes it.
6. **The tile inspector's overrides:** By kind, Fill or Fit; Its own focus here with Use the picture's focus; Play in the band (a video file or an animated picture of 10 MB or less, at most 2 per band); Hide on phones; Remove.
7. **Tokens:** `c.editor-arranger`.

### G7: private albums, the planet and the rest

1. **Private albums:** a sealed band in the Albums view, placed in order and decrypted in place; a sealed album page; the sealer rewriting the new attributes (the stage's widths, the thumbnails, video sources and posters, a playing tile's file) and the leak check covering them; the lightbox decrypting a fetched private album page through the sealed runtime, or falling back.
2. **The planet:** the Amphitheater's frame shows the Albums view; album pages stay inside the building; no lightbox history in the frame; Copy link gives the site's address.
3. **Telemetry:** `lightbox_opened` (place and kind) in both allowlists; `video_played`'s place `lightbox`; nothing for playing in the band, zooming or downloading.
4. **The site's weight:** `build-site.mjs` warns past 750 MB and fails past 950 MB. Built in G1 (`scripts/lib/siteWeight.mjs`).
5. **The docs:** the spec's As built, and the related pages ([sections](../sections/spec.md), [media](../content/media.md) with the sidecar's `taken` and `large`, [the content model](../content/model.md), [the site's UI](../site-ui/spec.md), [edit mode](../editor/spec.md)) brought in step; AGENTS.md's content and edit mode notes.

### G8: zoom in the lightbox

Zoom on the stage, as [spec §8.8](spec.md#88-zoom) says:

1. **The rules** in `src/site/scripts/zoomRules.ts` (pure, unit-tested): when zoom is offered (the largest size at least 1.5 times what's shown, and always for drawings, up to 4 times), the steps (half again each), the limits, panning bounds, and what each key and gesture does when zoomed and when not.
2. **The stage:** Zoom in and Zoom out in the top bar when offered; + (or =), −, 0; pinch, Ctrl with the wheel and a trackpad's pinch; double-tap or double-click; dragging and the arrow keys pan when zoomed; the swipe between items only when not zoomed; Escape goes back to fit before it closes.
3. **Loading:** the largest size (3840 px when kept large) is asked for only when zooming starts; a drawing is redrawn sharp at each level.
4. **Words and motion:** the level announced; moving to another item resets it; under reduced motion it jumps.
5. **Icons:** Zoom in and Zoom out imported.

### G9: the album block

An album's band inside any page ([spec §7.2](spec.md#72-an-album-inside-another-page)):

1. **The contract:** the block `{ type: "album", album: "<page ID>", width? }` and V51 (never a private album, an unpublished album in a published page, or the album's own page), in the content check for every site; making a placed album private, a draft or deleted is refused with the pages that show it.
2. **The site:** `ArticleLayout` draws the band through `AlbumBand` at the block's width (wide or full), with See all to the album and the lightbox on the whole album; telemetry's place `block`.
3. **Edit mode:** Album in the block inserter, with a chooser of the site's albums; the inspector's width; the refusals said with their reasons.

### G10: suggested alt text

[Spec §9.6](spec.md#96-suggested-alt-text), on the owner's own AI service ([AI services](../editor/ai-services.md)):

1. **The server:** a dev-only endpoint sends the picture at 960 px, with no file name, to the writer chosen on the AI screen when its model accepts pictures; private pages follow that service's setting; it gives up quietly after 20 seconds.
2. **The rules** (pure, unit-tested): at most 250 characters, never "image of" or "picture of", never naming or identifying a person; what's sent and what's kept.
3. **Edit mode:** the AI screen's switch, Suggest alt text for new pictures; in the batch form and the details pane, the suggestion marked Suggested with Accept and Edit, and Use all suggestions; an unaccepted suggestion is never saved and doesn't count as alt text.
4. **Tests** never reach a real service: a stand-in writer.

## 2. Definition of Done

Each phase is done when every row for it is true and evidenced.

| # | Phase | Criterion | Evidence |
|---|---|---|---|
| 1 | G1 | The contract holds V38 to V50: every rule refuses its bad case with a reason, and every warning warns without refusing | `content.test.ts`, "albums: the content check": a test for each of V38 to V51 (V40's warnings load without refusing); `album.test.ts`, "the checks" |
| 2 | G1 | A drawing stays an SVG, sharp at any size, and every hostile SVG in the test set is cleaned or refused | `svgSanitize.test.ts` (what cleaning removes, what it refuses, cleaning twice changes nothing); `editorServer.test.ts`, "gallery uploads": "keeps an SVG as a drawing when asked…", "refuses a drawing it can't make safe…"; E2E "editor: gallery uploads": "an SVG kept as a drawing is cleaned… and is shown whole". The screenshot at 400%: not yet taken |
| 3 | G1 | Every format in [spec §4](spec.md#4-media) is kept, converted or refused as its row says, with the words it gives | `editorUpload.test.ts`, "formats the site refuses, with what to do" (JPEG XL, RAW, PSD; MKV, AVI, WMV, 3GP; "keeps what it can…"; the animated PNG) and "an SVG: a drawing or a picture"; `editorServer.test.ts`: "refuses JPEG XL, camera RAW and Photoshop files by name or by their own bytes…"; E2E "editor: gallery uploads": the SVG's two ways, "the formats the site can't keep are refused with what to do", "an animated PNG says before saving…". No single E2E uploads every kind yet |
| 4 | G1 | The presets, the default and `phoneTiles` give the spec's arrangements, never overlap, and stay within 12 rows | `album.test.ts`: "presets and the default" (every preset within 12 rows, no overlap or hole, for 1 to 12 tiles) and "the band on a phone" (300 random bands) |
| 5 | G1 | An uploaded picture gets its date taken (a HEIC's too) and its focus point from the file; a picture already in the library keeps its focus; Keep it large adds the 3840 px size, and Make it standard takes it away | `editorUpload.test.ts`, "the date taken, read at upload" (a JPEG, PNG, WebP, TIFF and, by its header, a HEIC) and "the focus point from an attention crop"; `editorServer.test.ts`, "gallery uploads": the EXIF day, "finds the focus point of a new upload… and again on asking without saving", "keeps a picture large when asked… Make it standard saves it again at 2560"; E2E "editor: gallery uploads": "Keep it large…", "Find the focus…"; the upload fixtures in `tests/fixtures/gallery/uploads/` |
| 6 | G1 | The video block, edit mode's video inspector and the Content Security Policy read the one list of providers and behave as before | `providers.test.ts` ("build the players, pages and pasted links the site has always used", "frame their players from exactly the hosts the policy allows"); `csp.test.ts`'s framing test, which now reads the list and expects the same hosts |
| 7 | G2 | The Gallery section shows each album as a band: heading, counts, tiles, short description, See all, then the break | E2E "gallery": "the albums view: each album a band with its heading, counts, tiles, description and See all, in square cells"; the story `AlbumBand`. Screenshots of the band: not yet committed |
| 8 | G2 | Cells are square at every width, tiles keep their shapes, and the phone arrangement follows the rule (or the owner's), with tiles hidden on phones left out and no sideways scroll from 320 px | E2E "gallery": "the albums view… in square cells", "on a phone the band follows the phone arrangement, leaves out tiles hidden on phones and never scrolls sideways"; `album.test.ts`, "the band on a phone" |
| 9 | G2 | Focus order is reading order; every tile is a named link at least 44 px each way; axe passes in both modes | E2E "gallery": "band keyboard: focus order is reading order, every tile a named link of 44 px or more, and axe passes in both modes" |
| 10 | G2 | A tile set to play plays muted, only while at least half is in view, at most 2 in a band, never under reduced motion or Save-Data, and the band's Pause stops it for the visit | E2E "gallery": "tiles that play: at most 2 at once, only in view, and Pause stops them for the visit; nothing plays under reduced motion"; `albumBandRules.test.ts` (Save-Data, half in view, fetched only when near, Pause kept for the visit). The script's budget: not yet its own line in `verify:prod` |
| 11 | G3 | The album page shows every item in album order, each at its own address, and works without scripts | E2E "gallery": "the album page shows every item in album order, each at its own address, with the span of dates in its opening"; "gallery: without scripts": "without scripts every album item is a working link…"; `albumPage.test.ts` |
| 12 | G3 | The opening shows the span of dates; captions show under the grid's cells when asked; a Story shows every item whole with its words | The span of dates: E2E "gallery": "the album page shows every item…" and `albumPage.test.ts`, "the opening". Captions and the Story: `albumPage.test.ts`, "level rows", and the story `AlbumGrid`; no E2E or screenshots of them yet |
| 13 | G4 | From a band or the album page, the lightbox shows the whole album in album order, with the counter right before the fetch returns | E2E "gallery": "the lightbox from a band…" (fetch delayed by the test) |
| 14 | G4 | Every kind plays or shows on the stage as the spec says, including under reduced motion | E2E "gallery": one test per kind; `lightboxRules.test.ts` |
| 15 | G4 | The filmstrip is one Tab stop; the arrow keys, Home and End move; the info panel opens with Info and I, and shows the date and the place | E2E "gallery": "lightbox keyboard…" |
| 16 | G4 | Back closes the lightbox; `#item-<id>` opens it at the item; Copy link copies the canonical address | E2E "gallery": "addresses and Back…" |
| 17 | G4 | Download is offered only where the album or the item allows it, never for an embed, and gives the file named as the spec says | E2E "gallery": "downloads…"; `lightboxRules.test.ts` (the names) |
| 18 | G4 | Article lightboxes still work as before, plus Back and the single Tab stop | The existing "site design system" lightbox tests, updated |
| 19 | G5 | An album is made, filled (library, files, YouTube or Vimeo, the poster taken by itself) and ordered (by hand or by date taken) in edit mode, every change saved at once and undoable | E2E "editor: albums" on the fixture server: "the Items view…", "adding from the library…", "adding from files…", "a YouTube link: its title and poster are taken…", "moving by keyboard is shown at once and saved; Undo puts it back", "Sort by date taken… and undoable", "an item's caption is this album's, saved as it changes…", "removing an item keeps its file in the library…"; `editorAlbum.test.ts` (adding, an embed from what its provider said, removing, ordering, Sort by date taken as one change) |
| 20 | G6 | The band is arranged by drag and by keyboard alone, never overlapping, with each refusal's reason shown and said | E2E "editor: albums": "the arranger by drag…" (a drop on a twin swaps, a handle resizes snapped, a drop past 12 rows refused with its reason in the status and the live line), "the arranger by keyboard…" (arrows, Shift with them, each said in the live line; a refusal said; Undo), passed (22 October 2026); `editorArranger.test.ts` (swaps, pushing down in reading order, the 12-row and size limits with their reasons, arrows and Shift, Close gaps, the tray, presets, play and focus refusals) |
| 21 | G6 | A phone arrangement made by hand is what a phone shows, kept in step when tiles are added or removed wide | `album.test.ts`; `editorArranger.test.ts` ("the phone's moves need its own arrangement, on 6 columns", "a tile put up front wide joins the end of the phone's own arrangement, and one taken out leaves it", "a hidden tile shown again on phones… rejoins at its end"); E2E "editor: albums": "arranging for phones…" (passed, 22 October 2026); E2E "gallery" at 360 px |
| 22 | G5, G6 | Every override in [spec §18](spec.md#18-automatic-and-where-to-override-it) is made where its row says, stored only there, and its Back to automatic leaves the file as it was before the override | G5's rows: `editorAlbum.test.ts`, "every override is stored only where it applies, and Back to automatic leaves the file as it was (§18)" (an item's caption, place and description, the album's dates, layout, captions and downloads, an item's download, an embed's details, a video's Play by itself and Loop). G6's rows: `editorArranger.test.ts`, "§18: each override the arranger owns…", each row on an arranged band and on the default one, the file compared after Back to automatic (which items are up front, the phone's band, a tile on phones, how a tile shows its item, where a tile is cropped, a tile that plays). Use the default goes further than the file was, by design: it removes the arrangement |
| 23 | G5, G6 | The new parts pass the editor's design-system tests and axe, in both modes | G5's parts: `editorDesignSystem.test.ts`, which reads every part, and their stories (`AlbumItems`, `AlbumItemDetails`, `AlbumAddForms`, `AlbumSettings`). Axe on the album views: not yet run. G6's part: `AlbumArranger` and its story, read by `editorDesignSystem.test.ts`; axe on Up front: not yet run |
| 24 | G7 | A private album's band, page, media, playing tiles, downloads and lightbox open only for a covered reader, and the leak check passes | E2E "protected content": "a private album…"; `verify-sealed.mjs` |
| 25 | G7 | On the planet, the Amphitheater shows the albums and stays inside the building; the lightbox adds no history there | E2E "planet": "reading on the planet: albums…" |
| 26 | G7 | Telemetry sends only `lightbox_opened`'s place and kind, never an ID or a title, and nothing for playing, zooming or downloading | E2E "protected content" telemetry tests, extended |
| 27 | G8 | Zoom is offered only where the spec says, by buttons, keys and gestures; a pan stays on the stage; Escape and moving on go back to the whole item; under reduced motion it jumps | `zoomRules.test.ts`; E2E "gallery": "zoom…", with real touch events |
| 28 | G9 | An album block shows the album's band in another page and opens the lightbox on the whole album, and V51 refuses its three cases | `content.test.ts`: "V51: an album block shows an open gallery page, not its own, published wherever its page is"; `albumBlock.test.ts` (the chooser's three cases, each said; a placed album's lifecycle refused with the pages that show it); E2E "gallery": "an album in another page: its band at the block width, its heading under the page heading, See all to the album", "…no sideways scroll on a phone"; E2E "editor: albums: the album block" (added from the palette, an album it can't show said why, its width; a shown album refused private or a draft). The lightbox on the whole album: waits on G4 |
| 29 | G10 | Alt text is suggested only by the chosen writer with the switch on, keeps to its rules, is saved only when accepted or edited, and fails quietly; a private album's pictures go only to a service that may get private pages | `altText.test.ts` (the answer's rules, what's sent and asked, when it's offered, a private page's picture only to a service that may get private pages, never saved unaccepted); `aiAlt.test.ts` with a stand-in service (gives up quietly after its time, none when the service fails, the switch, the Test of picture input); E2E "editor: suggested alt text" (`editor-alt-text.spec.ts`: shown and never saved until accepted, Edit, Suggest in the details, the album's batch upload with Use all suggestions, nothing when turned off) |
| 30 | All | The section and album pages meet their budgets ([spec §11](spec.md#11-performance-and-budgets)) | `perf:bench` on the fixture; `verify:prod` |
| 31 | All | Screenshots of every new story and view are reviewed and committed | `npm run visual` |
| 32 | All | The spec's As built and the related docs match the build | The docs changes in each phase's commit |

## 3. Validation per phase

Following the tiers in [AGENTS.md](https://github.com/prabinpebam/atiya/blob/main/AGENTS.md):

| Phase | Runs |
|---|---|
| G1 | Unit (content, album, upload with its EXIF fixtures, sanitizer, providers, and the video block's and `csp`'s existing tests), E2E "editor: gallery uploads", `npm run check`, and `verify:prod` (the build copies drawings) |
| G2 | Unit (album, the site's design system), the new E2E group "gallery" (the albums view, tiles that play), "site design system", "site on a phone", the visual project for `AlbumBand`, and `verify:prod` (the play script's budget) |
| G3 | Unit, E2E "gallery" (the album page, both layouts), and the visual project for the Gallery's album mode and Story |
| G4 | Unit (`lightboxRules`), E2E "gallery" (the lightbox, downloads), the "site design system" lightbox tests, `verify:prod` (script budgets) |
| G5 | Unit (the editor's model and design system), E2E "editor: albums" (items, the album's settings) |
| G6 | Unit (the editor's model, every override and its way back), E2E "editor: albums" (the arranger, the phone), the visual project for the editor's parts |
| G7 | E2E "protected content", "planet" (reading), `verify:prod`, `build-parity.mjs` |
| G8 | Unit (`zoomRules`), E2E "gallery" (zoom, with real touch events), the "site design system" lightbox tests, `verify:prod` (script budgets) |
| G9 | Unit (content, V51), E2E "gallery" (the album block), E2E "editor: albums: the album block" (the inserter), the visual project for the block's story |
| G10 | Unit (the answer's rules, the server with a stand-in writer), E2E "editor: suggested alt text" |
| End | The full `npm test`, `npm run check`, `npm run verify:prod`, `npm run visual`, and every E2E group this work touched |

## 4. Risks

| Risk | Mitigation |
|---|---|
| The lightbox's component is near its 500-line limit | G4 moves its script out first, with its rules pure, before adding anything |
| History in the planet's frame: a pushed state would make Back leave the building | No history in the frame; a test for Back on the planet with the lightbox open |
| The section page grows heavy with many albums | Tiles ask for their own sizes, later bands are lazy, nothing moves; measured against the budget in G2 |
| Decrypting a fetched private album page | The sealed runtime already decrypts sealed regions by key; if it can't take a fetched page, the lightbox falls back to the band's tiles, which the spec allows |
| A hostile SVG | Drawn only with `<img>` (no scripts run), and sanitized before it's saved; the test set grows with every case found |
| GitHub Pages' 1 GB limit | The build's weight check, warning at 750 MB; the album's weight shown in edit mode |
| APNG loses its frames | The upload form says so before saving, with what to do |
| The sealer misses a new attribute and leaks a media address | The leak check covers the new attributes, and a private fixture album is in the "protected content" tests |
| Square cells make very tall bands on very wide screens | The band takes the wide width, not the screen's, and edit mode warns past 8 rows |
| Two orders (the album's and the band's) confuse | The arranger and Items say which order they change; the counter always follows the album's |
| Tiles that play make the section heavy or restless | Still unless the owner sets a tile to play; at most 2 in a band, 10 MB each, loaded only when near and played only in view; a warning past 4 MB; never under reduced motion or Save-Data; the band's Pause |
| A camera's clock was wrong, so dates and Sort by date taken are wrong | The date is shown in the details and can be changed or cleared; Sort is one change, undone with Undo; dates are shown to readers only when the album asks |
| Measuring the focus point moves crops already in use | Only new uploads are measured; a picture already in the library keeps its own until the owner asks Find the focus |
| Suggested alt text sends a picture away, or says who someone is | Only to the service the owner chose, at 960 px without its name; a private album's pictures only to a service that may get private pages; the rules ask for what's visible, never who; nothing is saved until he accepts or edits it |
| Zoom fights the swipe between items and the browser's own pinch | Swiping moves only when not zoomed; zoom is offered only where it's worth it, and the browser's pinch works elsewhere; tested with real touch events |
| A phone arrangement drifts from the wide band | Kept in step on every tile added or removed wide, with a note; Back to automatic is always there |
| An album placed in another page is later made private, set back to draft or deleted | V51 runs over the whole site before every save, so the change is refused with the pages that show it; the block never points at nothing |
