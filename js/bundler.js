/* bundler.js — buildOfflineBundle() fetches the app's own source (index.html,
   css/*.css, js/*.js, textures/*, favicon.png, Google Fonts) and assembles it
   into one self-contained HTML string a user can save and reopen with no
   server, no folder, and no network. main.js wires the download button to
   this; nothing here runs at load time.

   This only works when the page is served over http(s) — fetch() of a
   relative URL is rejected outright on a file:// origin, and there is
   nothing to fetch anyway once the app is *itself* the bundled copy. main.js
   hides the button in both cases.

   Depends on: assets.js (TRAY_THEME_KEYS). Nothing else — deliberately reads
   index.html/css/js fresh over the network rather than reading the live DOM
   or in-memory state, so the bundle reflects the pristine app, not whatever
   the current session has mutated (generated picker buttons, the currently
   selected theme's inline styles, etc). */

const OFFLINE_FILENAME = 'DiceTray-offline.html';

// Extension -> MIME, used to force a correct data: URI header. Trusting a
// static host's Content-Type is not safe (a misconfigured server can send
// application/octet-stream for a .woff2, which browsers refuse to load as
// a font), so every binary asset's type is derived from its own filename.
const ASSET_MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  woff2: 'font/woff2',
};

async function fetchText(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetching ${url} failed: HTTP ${res.status}`);
  return res.text();
}

function blobToDataUri(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    // readAsDataURL, not btoa(String.fromCharCode(...bytes)): spreading a
    // ~900KB byte array into String.fromCharCode blows the call-stack limit.
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error('FileReader failed'));
    reader.readAsDataURL(blob);
  });
}

async function fetchAsDataUri(url) {
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Fetching ${url} failed: HTTP ${res.status}`);
  const buf = await res.arrayBuffer();
  const ext = url.split('?')[0].split('.').pop().toLowerCase();
  const blob = new Blob([buf], { type: ASSET_MIME[ext] || res.headers.get('content-type') || 'application/octet-stream' });
  return blobToDataUri(blob);
}

// The HTML tokenizer, once inside a <script>, looks for the literal
// "</script" case-insensitively regardless of JS syntax, so that sequence
// inside any inlined source (a string, a comment, wherever) would truncate
// the element when the result is written out. No file contains it today,
// but this must not become a landmine for future code, so guard
// unconditionally rather than trust that grep.
function escapeScriptClose(js) {
  return js.replace(/<\/(script)/gi, '<\\/$1');
}

/* =========================================================================
   GOOGLE FONTS
   ========================================================================= */

// Fetches the Google Fonts CSS the page already links to, keeps only the
// Latin/Latin-extended @font-face blocks (Google emits one block per family
// per weight per unicode-range subset; without filtering, 8 families pull
// Greek/Cyrillic/Vietnamese subsets nobody needs and roughly triples the
// font payload), inlines each referenced woff2 as a data: URI, and returns
// the resulting CSS text. Both fonts.googleapis.com and fonts.gstatic.com
// send Access-Control-Allow-Origin: *, so fetch() from the page is allowed.
async function buildEmbeddedFontsCss(googleFontsHref) {
  const css = await fetchText(googleFontsHref);

  const blocks = css.match(/@font-face\s*\{[^}]*\}/g) || [];
  const latinBlocks = blocks.filter((b) => {
    const m = b.match(/unicode-range\s*:\s*([^;]+);/i);
    if (!m) return true; // single-subset families have no unicode-range at all
    return /U\+0000-00FF/i.test(m[1]) || /U\+0100-024F/i.test(m[1]);
  });
  if (latinBlocks.length === 0) {
    throw new Error('No @font-face blocks parsed from Google Fonts CSS — format may have changed');
  }

  let kept = latinBlocks.join('\n');
  const woff2Urls = [...new Set(
    [...kept.matchAll(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/g)].map((m) => m[1])
  )];
  const dataUris = await Promise.all(woff2Urls.map(fetchAsDataUri));
  woff2Urls.forEach((url, i) => { kept = kept.split(url).join(dataUris[i]); });

  const attribution = [
    '/* Embedded web fonts, each licensed under the SIL Open Font License 1.1.',
    '   OFL FAQ 1.12/1.10: a font (in full or subset) embedded in a document,',
    '   not intended for use outside it, may be redistributed without the',
    '   licence text attached. Attributed here anyway: */',
    '/* Almendra — (c) 2011-2012 Ana Sanfelippo, RFN "Almendra" */',
    '/* JetBrains Mono — (c) 2020 JetBrains s.r.o. and contributors */',
    '/* IM Fell English — (c) 2007 Igino Marini, RFN "IM FELL English" */',
    '/* Rajdhani — (c) 2009-2018 Indian Type Foundry, RFN "Rajdhani" */',
    '/* Uncial Antiqua — (c) 2011 Brian J. Bonislawsky (Astigmatic/AOETI), RFN "Uncial Antiqua" */',
    '/* Share Tech Mono — (c) 2012 Carrois Type Design, RFN "Share Tech Mono" */',
    '/* Playfair Display — (c) 2018 Claus Eggers Sorensen, RFN "Playfair Display" */',
    '/* Courier Prime — (c) 2013 Alan Dague-Greene, RFN "Courier Prime" */',
  ].join('\n');

  return attribution + '\n' + kept;
}

/* =========================================================================
   MAIN ROUTINE
   ========================================================================= */

// report(message) is called with short progress strings as the bundle is
// assembled, so the caller can show live feedback on the download button.
async function buildOfflineBundle(report) {
  report('Fetching page…');
  let html = await fetchText('index.html');

  report('Fetching textures…');
  const textureNames = [];
  TRAY_THEME_KEYS.forEach((key) => { textureNames.push(`bg_${key}.jpg`, `tray_${key}.png`); });
  const textureDataUris = await Promise.all(
    textureNames.map((name) => fetchAsDataUri('textures/' + name))
  );
  const embeddedTextures = {};
  textureNames.forEach((name, i) => { embeddedTextures[name] = textureDataUris[i]; });

  report('Embedding fonts…');
  const fontsMatch = html.match(/<link rel="preconnect"[^>]*fonts\.googleapis\.com[^>]*>\s*\n?<link rel="preconnect"[^>]*fonts\.gstatic\.com[^>]*>\s*\n?<link rel="stylesheet" href="(https:\/\/fonts\.googleapis\.com[^"]+)">/);
  let fontsCss = '';
  if (fontsMatch) {
    try {
      fontsCss = await buildEmbeddedFontsCss(fontsMatch[1]);
    } catch (err) {
      // A bundle with fallback system fonts beats no bundle at all.
      console.warn('[DiceTray] embedding Google Fonts failed, bundling without them:', err);
      fontsCss = '';
    }
    const fontsStyleTag = fontsCss ? `<style>\n${fontsCss}\n</style>` : '<!-- Google Fonts unavailable at bundle time; using fallback fonts -->';
    html = html.slice(0, fontsMatch.index) + fontsStyleTag + html.slice(fontsMatch.index + fontsMatch[0].length);
  }

  report('Embedding favicon…');
  const faviconDataUri = await fetchAsDataUri('favicon.png');
  html = html.replace('href="favicon.png"', `href="${faviconDataUri}"`);

  report('Inlining styles…');
  html = await replaceAllAsync(html, /<link rel="stylesheet" href="(css\/[^"]+)">/g, async (m, href) => {
    const css = await fetchText(href);
    return `<style data-src="${href}">\n${css}\n</style>`;
  });

  report('Inlining scripts…');
  html = await replaceAllAsync(html, /<script src="(js\/[^"]+)"><\/script>/g, async (m, src) => {
    let js = await fetchText(src);
    if (src === 'js/assets.js') {
      // Replace the marker line, not a naive string search-and-replace —
      // this is the one substitution the bundler makes inside a script body.
      js = js.replace(
        /const EMBEDDED_TEXTURES = null; \/\* BUNDLER:EMBEDDED_TEXTURES \*\//,
        `const EMBEDDED_TEXTURES = ${JSON.stringify(embeddedTextures)};`
      );
    }
    return `<script data-src="${src}">\n${escapeScriptClose(js)}\n</script>`;
  });

  // Mark the artefact so css/actions.css can hide the download button before
  // main.js even runs (no flash-of-button), and main.js can confirm it too.
  html = html.replace('<html lang="en">', '<html lang="en" data-bundled="true">');

  return html;
}

// Like String.replace with an async replacer: awaits each replacement in
// order (not parallel — these are already-fetched-in-parallel-elsewhere
// texture/font work; the CSS/JS files are small and few, so sequential
// keeps this simple).
async function replaceAllAsync(str, regex, asyncFn) {
  const matches = [...str.matchAll(regex)];
  let result = str;
  for (const m of matches) {
    const replacement = await asyncFn(m[0], m[1]);
    result = result.replace(m[0], replacement);
  }
  return result;
}

function downloadBundle(html) {
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = OFFLINE_FILENAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke on a delay, not synchronously: some browsers have been known to
  // abort a download if its object URL is revoked in the same tick.
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

async function handleOfflineDownload(btn) {
  const restLabel = btn.textContent;
  btn.disabled = true;
  btn.classList.remove('is-error');
  try {
    const html = await buildOfflineBundle((msg) => { btn.textContent = msg; });
    btn.textContent = 'Saving…';
    downloadBundle(html);
    btn.textContent = 'Saved ✓';
  } catch (err) {
    console.error('[DiceTray] building the offline bundle failed:', err);
    btn.classList.add('is-error');
    btn.textContent = 'Download failed';
  } finally {
    setTimeout(() => {
      btn.classList.remove('is-error');
      btn.textContent = restLabel;
      btn.disabled = false;
    }, btn.classList.contains('is-error') ? 4000 : 2500);
  }
}
