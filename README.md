# 🎲 DiceTray

A lightweight, browser-based dice roller for tabletop RPGs.

## Features

- Roll any combination of standard dice (d4, d6, d8, d10, d12, d20, d100)
- No install, no account, no dependencies — just open and play
- Works on desktop and mobile

## Usage

Open the link and tap or click a die to roll it. That's it.

## Hosting

The app is a static site (`index.html` plus `css/`, `js/`, and `textures/`) with no build step and no external dependencies except Google Fonts, which fall back to system fonts when offline. You can:

- Download or clone the whole folder and open `index.html` — it works fully offline (Google Fonts excepted)
- Host the whole folder anywhere that serves static files
- Click **Download offline copy** in the app itself to save a single self-contained HTML file with every theme, texture, and font baked in — reopen it from anywhere with no folder and no network at all. This only works while the app is loaded over http(s) (it needs to fetch its own source files), so the button doesn't appear when running from a `file://`-opened copy or from an already-bundled download.
