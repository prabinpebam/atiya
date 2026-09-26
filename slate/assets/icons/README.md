# Icons

The viewer uses **Material Symbols** (Outlined), self-hosted at
`shell/vendor/material-symbols-outlined.ttf`. This avoids CDN failures in embedded browsers and keeps the
viewer offline-capable. There is no SVG icon set to maintain and **no emoji** anywhere in content or nav.

## How it's loaded

Each shell host (`shell/index.html`, `demo/index.html`, and a project's content-root `index.html`)
loads `slate.css`, which declares the local font:

```html
<link rel="stylesheet" href="shell/slate.css">
```

Icons are rendered as ligature spans:

```html
<span class="material-symbols-outlined">description</span>
```

`slate.css` sizes them by context (`font-size`), and `slate.js` injects them for nav items, folder
chevrons, the copy button, and collapsible-section toggles.

## Icons in use

| Where | Material Symbol |
| --- | --- |
| Menu (mobile) | `menu` |
| Search | `search` |
| Theme (light / dark) | `light_mode` / `dark_mode` |
| Expand all / Collapse all | `unfold_more` / `unfold_less` |
| Nav file (default) | `description` |
| Nav folder | `folder` |
| Nav folder chevron | `chevron_right` (rotates) |
| Section collapse toggle | `chevron_right` (rotates) |
| Copy code / copied | `content_copy` / `done` |

## Manifest `icon` key

A manifest entry's optional `icon` is a **Material Symbol name**. It overrides the default file icon
for that nav item:

```jsonc
{ "path": "strategy/vision.html", "title": "Vision", "icon": "flag" }
```

Browse names at <https://fonts.google.com/icons>.

## Offline note

Icons load from the local font declared by `@font-face` in `shell/slate.css`. When copying the shell,
keep `shell/vendor/material-symbols-outlined.ttf` with it.
