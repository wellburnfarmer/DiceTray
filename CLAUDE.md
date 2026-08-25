# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

DiceTray is a lightweight, browser-based dice roller for tabletop RPGs (d4/d6/d8/d10/d12/d20/d100). It's a static site with no install, no account, and no build tooling.

## Commands

There is no build step, no package manager, no linter, and no test suite in this repo. Development is:

- **Run it locally**: open `index.html` directly from disk (`file://`), or serve the folder with any static file server (e.g. `python -m http.server`) — both work since there's nothing to compile. Use a server, not `file://`, when testing the offline-bundle download feature (see below), since it depends on `fetch()` of the app's own source, which `file://` rejects.
- **Regenerate textures**: `pip install -r requirements.txt` then `python gen_textures.py`, run from the repo root. This regenerates every `textures/tray_<theme>.png` and `textures/bg_<theme>.jpg` from scratch (five themes: green-felt, midnight-velvet, parchment, weathered-slate, ivory-marble). It's a dev-time asset generator, not something the app runs itself.

## Architecture

**Classic scripts, no modules, strict load order.** `index.html` loads `js/*.js` as plain `<script src>` tags (not `type="module"`), in the dependency order listed in `index.html`. This is deliberate: it's what lets the page work opened straight from disk with no server and no build step. The load order matters and is documented at both ends — in the comment above the `<script>` block in `index.html`, and restated in each file's own header comment (which also states that file's dependencies).

**`js/main.js` is the only file that runs code at load time.** Every other JS file just declares functions/data at the top level. `main.js` is loaded last, looks up all the DOM elements other functions reference as globals, wires every event listener, and makes the startup calls (`rebuildField()`, `applyTrayTheme('green-felt')`, `preloadTrayImages()`, etc). This one-file-runs-everything convention is what makes the `<script src>` order safe without a module system — no file can execute before its dependencies exist. When adding a new file, follow this: declare only, and wire it up from `main.js`.

**Rendering is canvas-based, not DOM/SVG.** Dice are drawn each frame onto `#dice-canvas` (`js/render.js`) using pre-computed static 3D geometry (`js/dice-geometry.js` — vertices/faces/rotation matrices per die type, generated offline and embedded verbatim) combined with quaternion rotation math (`js/math.js`, `js/roll-animation.js`) for the tumble/settle roll animation and the advantage/disadvantage collapse animation.

**Theming is CSS custom properties, swapped by JS.** `applyTrayTheme()` (`js/tray-themes.js`) writes tray-theme CSS variables (colours, `--tray-texture`, etc.) onto the document root and swaps the background/tray-overlay images; `css/theme.css` defines the defaults these override. Dice colour palettes are separate from tray themes (`js/colour-schemes.js`), with a default pairing table so switching tray theme auto-picks a matching dice colour unless the user has manually customised dice colours.

**Texture/asset indirection (`js/assets.js`) is what makes offline bundling possible.** `textureUrl(filename)` is the single place that resolves a texture name to a URL. Normally it returns a relative path under `textures/`; `js/bundler.js` can produce a self-contained copy of the whole app by rewriting `assets.js`'s `EMBEDDED_TEXTURES` line into a `filename -> data: URI` map, after which `textureUrl()` starts returning inline data with no other file needing to know the difference. `js/preload.js` and `js/tray-themes.js` both go through `textureUrl()` for this reason — never hardcode a `textures/...` path elsewhere.

**"Download offline copy" (`js/bundler.js`)** fetches the app's own live source (`index.html`, `css/*.css`, `js/*.js`, `textures/*`, `favicon.png`, Google Fonts) over `fetch()` and assembles it into one self-contained HTML file, wired to the download button by `main.js`. It deliberately re-fetches fresh files rather than reading the live DOM/in-memory state, so the bundle reflects the pristine app rather than the current session's mutations. This only works when the page is served over http(s) — `fetch()` of a relative URL is rejected on a `file://` origin — so the button is removed when `location.protocol === 'file:'` or when the page is itself already a bundled copy (`EMBEDDED_TEXTURES` truthy, also marked via `html[data-bundled]` so `css/results.css` can hide it before `main.js` even runs). Google Fonts are embedded only after filtering to Latin/Latin-extended `@font-face` blocks (the unfiltered response pulls unused Greek/Cyrillic/Vietnamese subsets for every family); embedded fonts are OFL-licensed and get an attribution comment in the bundle per OFL FAQ 1.10/1.12.

**Google Fonts is the app's only network dependency.** Everything else works fully offline once the page/files are loaded; fonts fall back to the generic families named in `css/theme.css` when offline.

## Hosting

The app is pure static files (`index.html`, `css/`, `js/`, `textures/`) with no external dependencies besides Google Fonts, so it deploys as-is to GitHub Pages or any static host — no hardcoded origins or absolute paths to worry about. Users can also just download/clone the folder and open `index.html`, or use the in-app "Download offline copy" button to get a single portable HTML file.
