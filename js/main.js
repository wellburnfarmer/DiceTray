/* main.js — the only file that runs code at page load. Every other file in
   this project just declares functions/data; this one looks up the DOM
   elements those functions reference as globals (pickerEl, clearBtn,
   colourSchemeSelect, modifierInput, modifierSignBtn), wires every event
   listener, and runs the startup calls. Loaded last so every global it
   touches is already defined. Keeping all of this in one place, in one
   file, is what makes the <script src> load order in index.html safe: no
   other file has top-level code that could run before its dependencies
   have loaded. */

/* =========================================================================
   PICKER BUTTONS
   ========================================================================= */
const pickerEl = document.getElementById('picker');
DIE_TYPES.forEach((sides) => {
  const btn = document.createElement('button');
  btn.className = 'picker-btn';
  btn.innerHTML = `${dieIconSvg(sides)}<span>+ d${sides}</span>`;
  btn.dataset.sides = String(sides);
  btn.onclick = () => addOne(sides);
  pickerEl.appendChild(btn);
});
const clearBtn = document.getElementById('clear-btn');
clearBtn.onclick = clearAll;

/* =========================================================================
   COLOUR SCHEME PICKER
   ========================================================================= */
const colourSchemeSelect = document.getElementById('colour-scheme-select');

// Build the dropdown from COLOUR_SCHEMES, grouped into an <optgroup> per
// tray (using that tray's own display label) so the tray pairing is visible.
// Must run before applyTrayTheme('green-felt') below, which restyles these
// option/optgroup elements to match the active tray.
const schemesByTray = {};
Object.keys(COLOUR_SCHEMES).forEach((key) => {
  const scheme = COLOUR_SCHEMES[key];
  (schemesByTray[scheme.tray] = schemesByTray[scheme.tray] || []).push(key);
});
Object.keys(TRAY_THEMES).forEach((trayKey) => {
  const keys = schemesByTray[trayKey];
  if (!keys) return;
  const group = document.createElement('optgroup');
  group.label = TRAY_THEMES[trayKey].label;
  keys.forEach((key) => {
    const opt = document.createElement('option');
    opt.value = key;
    opt.textContent = COLOUR_SCHEMES[key].label;
    group.appendChild(opt);
  });
  colourSchemeSelect.appendChild(group);
});
colourSchemeSelect.value = currentScheme;

// Track the selected scheme separately from the native select value.
colourSchemeSelect.addEventListener('change', () => {
  const val = colourSchemeSelect.value;
  if (COLOUR_SCHEMES[val]) {
    currentScheme = val;
    schemeCustomised = true;
    updatePickerIconColors();
    renderDiceCanvas();
  }
});

/* =========================================================================
   ROLL / ADVANTAGE / DISADVANTAGE BUTTONS
   ========================================================================= */
document.getElementById('roll-btn').onclick = roll;
document.getElementById('advantage-btn').onclick = () => rollAdvantage(true);
document.getElementById('disadvantage-btn').onclick = () => rollAdvantage(false);

/* =========================================================================
   MODIFIER INPUT
   ========================================================================= */
const modifierInput = document.getElementById('modifier-input');

modifierInput.addEventListener('input', () => {
  const sanitized = sanitizeModifierText(modifierInput.value);
  if (sanitized !== modifierInput.value) modifierInput.value = sanitized;
  updateModifierSignBtn();
});

const modifierSignBtn = document.getElementById('modifier-sign-btn');

modifierSignBtn.addEventListener('click', () => {
  const current = getModifierValue();
  if (current !== 0) {
    modifierInput.value = sanitizeModifierText(String(-current));
  } else {
    modifierInput.value = modifierInput.value === '-' ? '+' : '-';
  }
  updateModifierSignBtn();
  modifierInput.focus();
});

updateModifierSignBtn();

/* =========================================================================
   WINDOW RESIZE
   ========================================================================= */
window.addEventListener('resize', handleWindowResize);

/* =========================================================================
   TAP/CLICK TO REROLL A SINGLE DIE
   ========================================================================= */
document.getElementById('dice-canvas').addEventListener('mousemove', handleCanvasMouseMove);
document.getElementById('dice-canvas').addEventListener('mouseleave', handleCanvasMouseLeave);
document.getElementById('dice-canvas').addEventListener('click', handleCanvasClick);

/* =========================================================================
   TRAY THEME PICKER
   ========================================================================= */
document.getElementById('tray-theme-select').addEventListener('change', (e) => {
  const trayKey = e.target.value;
  applyTrayTheme(trayKey);

  // Auto-pair dice colours when the user hasn't manually customised them
  if (!schemeCustomised) {
    const paired = TRAY_DEFAULT_SCHEME[trayKey];
    if (paired && COLOUR_SCHEMES[paired]) {
      currentScheme = paired;
      colourSchemeSelect.value = paired;
    }
  }

  updatePickerIconColors();

  renderDiceCanvas();
});

/* =========================================================================
   DOWNLOAD OFFLINE COPY
   ========================================================================= */
const downloadBtn = document.getElementById('download-btn');
// Bundling needs fetch() of the app's own source files, which is rejected
// outright on a file:// origin — and if this page is itself a bundled copy
// (EMBEDDED_TEXTURES set) there's nothing left to fetch anyway. css/controls.css
// already hides the button via html[data-bundled]; this covers the plain
// "downloaded/cloned the folder and opened index.html directly" case, which
// carries no data-bundled marker.
if (EMBEDDED_TEXTURES || location.protocol === 'file:') {
  downloadBtn.remove();
} else {
  downloadBtn.onclick = () => handleOfflineDownload(downloadBtn);
}

/* =========================================================================
   IMAGE PRELOAD
   ========================================================================= */
preloadTrayImages();

/* =========================================================================
   INIT
   ========================================================================= */
rebuildField();
applyTrayTheme('green-felt');
updatePickerIconColors();

// Canvas text (js/render.js) does not trigger webfont loading and does not
// repaint when a font arrives later, so the very first render of the die
// numerals can land in the fallback serif before Almendra has loaded.
// renderDiceCanvas() is cheap and idempotent, so an unconditional redraw
// once fonts are ready is free insurance.
if (document.fonts && document.fonts.ready) {
  document.fonts.ready.then(renderDiceCanvas);
}
