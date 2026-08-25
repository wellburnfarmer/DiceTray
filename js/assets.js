/* assets.js — resolves a texture filename to a URL. Normally that's just the
   file under textures/, loaded as a plain relative path; js/bundler.js can
   produce a self-contained copy of the whole app by rewriting the
   EMBEDDED_TEXTURES line below into a filename -> data: URI map, which makes
   this function start returning inline data instead, with no other file
   needing to know the difference. Loaded first since preload.js and
   tray-themes.js both call textureUrl(). */

const EMBEDDED_TEXTURES = null; /* BUNDLER:EMBEDDED_TEXTURES */

// Shared so preload.js and js/bundler.js agree on which themes/files exist,
// and so there is exactly one place that lists them.
const TRAY_THEME_KEYS = [
  'green-felt',       // default — kept first, preload.js loads it eagerly
  'midnight-velvet',
  'parchment',
  'weathered-slate',
  'ivory-marble',
];

// Converted-blob-URL cache, keyed by filename, so a 1MB base64 payload gets
// decoded to a Blob once rather than living as a giant string inside a CSS
// custom property (--tray-texture) that gets re-resolved on every theme swap.
const _textureUrlCache = Object.create(null);

function textureUrl(filename) {
  const cached = _textureUrlCache[filename];
  if (cached) return cached;

  let url;
  const dataUri = EMBEDDED_TEXTURES && EMBEDDED_TEXTURES[filename];
  if (dataUri) {
    url = URL.createObjectURL(dataUriToBlob(dataUri));
  } else {
    // Absolute, because css/tray.css consumes this through var(--tray-texture)
    // and a relative url() inside a custom property resolves against the
    // *consuming* stylesheet (css/), not this script or index.html.
    url = new URL('textures/' + filename, document.baseURI).href;
  }
  _textureUrlCache[filename] = url;
  return url;
}

function dataUriToBlob(dataUri) {
  const comma = dataUri.indexOf(',');
  const meta = dataUri.slice(5, comma); // strip "data:"
  const mime = meta.split(';')[0] || 'application/octet-stream';
  const bytes = atob(dataUri.slice(comma + 1));
  const arr = new Uint8Array(bytes.length);
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
  return new Blob([arr], { type: mime });
}
