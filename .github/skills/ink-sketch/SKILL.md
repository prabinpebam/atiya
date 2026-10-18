---
name: ink-sketch
description: "Use when: illustrating an article or page of this site in the \"ink sketch\" style (quirky big-eyed creatures in loose pen and ink, a light and a redrawn dark version, both transparent ink only), or when asked for illustrations \"like the storytelling article\". Plans the set, generates with GPT Image 2.5, extracts the ink, publishes and places the pictures."
---

# Ink sketch: the site's article illustration style

The house style for essay illustrations, approved in "You don't have a storytelling problem" (2026-10-18).

- **Look:** quirky cartoon creatures with huge, slightly mismatched round eyes, simple asymmetrical bodies and spindly limbs, drawn in fast, loose pen and ink with expressive hatching.
- **Light:** black ink on white paper.
- **Dark:** white highlight ink on charcoal paper, **redrawn** from the light version: the white lines draw the highlights, and the dark paper is the shadow. Never invert.
- **Published:** both versions are transparent, ink-only WebP pairs (the paper is removed), so the pictures sit on the page with no edge or crop.

Everything specific to the style lives in [style.json](../../../assets-src/illustrations/styles/ink-sketch/style.json): its anchors (the storytelling hero, light and dark), the owner's local drawing references, the prompt blocks, the sizes, the paper colours, the extraction and the publishing options. Change the style there, never in a manifest.

## Rules

- **The references are for style only.** Each article gets its own theme and its own recurring cast. Never reuse the storytelling explorer, or another article's cast or metaphors, unless the owner asks.
- **Propose before generating:** the theme, the cast, and each image's name, placement, format and gag. Wait for the owner's go-ahead.
- **One picture every scroll or two,** each a visual metaphor for the point beside it. Fun, quirky and humorous beats literal; never visually boring. A three-panel comic (`comic`) or a long strip (`strip`) is welcome where a point is a sequence.
- **Alt text is at most 250 characters** (the content schema enforces it), and describes the scene, not the metaphor's lesson.
- The local references (`assets-src/illustrations/storytelling/style/ref-*.png`) are gitignored, and their rights are unknown: never commit or publish them. If they're missing, the anchors alone still hold the style.

## Workflow

1. **Manifest:** write `assets-src/illustrations/<article-folder>/illustrations.json`. For example:
   ```json
   {
     "style": "ink-sketch",
     "article": "<article id>",
     "theme": "…",
     "cast": "THE HERO: … THE OTHERS: …",
     "castAnchor": "<the hero image's name>",
     "images": [
       { "name": "…", "use": "hero", "format": "hero", "subject": "…", "alt": "…" },
       { "name": "…", "use": "figure", "format": "figure|strip|comic", "width": "popout|wide",
         "after": "<the start of the block it follows>", "subject": "…", "alt": "…" }
     ]
   }
   ```
   `after` matches the start of a body block's text (or `## heading`); pick a prefix that matches exactly one block.
2. **Cast anchor first:** `python scripts/illustrate.py gen <manifest> --only <castAnchor> --mode light`. View it. Every other image is drawn against it, so iterate (`--force`) until the cast is right.
3. **The rest:** `python scripts/illustrate.py gen <manifest> --mode both --jobs 2`. It skips what exists. More than 2 jobs hits the service's rate limit (429), and a rerun resumes. Set `PYTHONIOENCODING=utf-8` on Windows. Each call takes 1–3 minutes.
4. **Review** every light and dark version (a contact sheet is quickest). Regenerate any failure with `--force --only <name>` (`--mode dark` to redo only the dark).
5. **Ink and check:** run `ink`, then `preview` (composited on the site's page colours in `.preview/`, gitignored). View the previews.
6. **Publish and place:** `publish` writes the alpha WebPs and sidecars into `content/media/articles/<article>/` (checking the alt length and the 1.5 MB budget). `place` sets the hero and replaces the article's own figures with the manifest's. Delete media the article no longer uses, and diff the article JSON.
7. **Validate:** `npx vitest run content.test`, the article's E2E if it has one, and `npm run verify:prod` (new assets).
8. **Credit:** add an entry to `assets-src/CREDITS.md`. Commit the sources (the PNGs, the ink and the prompts) with the manifest, push, and run `node scripts/watch-push.mjs`.
