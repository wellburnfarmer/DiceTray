/* modifier.js — parses and formats the +/- modifier value typed next to the
   Roll button. Depends on the `modifierInput`/`modifierSignBtn` elements
   looked up in main.js; roll.js calls getModifierValue()/formatModifier()
   when scoring a roll. */

function sanitizeModifierText(raw) {
  let s = raw.replace(/[^0-9-]/g, '');
  const negative = s.startsWith('-');
  s = s.replace(/-/g, '');
  const core = (negative ? '-' : '') + s;
  if (!negative && s !== '' && /[1-9]/.test(s)) return '+' + s;
  if (core === '') return '+';
  return core;
}

function updateModifierSignBtn() {
  const value = modifierInput.value.trim();
  modifierSignBtn.classList.toggle('is-negative', value.startsWith('-'));
  modifierSignBtn.classList.toggle('is-positive', value.startsWith('+'));
}

function setModifierDisabled(disabled) {
  modifierInput.disabled = disabled;
  modifierSignBtn.disabled = disabled;
}

function getModifierValue() {
  const raw = modifierInput.value;
  if (raw === '' || raw === '-' || raw === '+') return 0;
  const n = parseInt(raw, 10);
  return Number.isFinite(n) ? n : 0;
}

function formatModifier(n) {
  return n > 0 ? `+${n}` : String(n);
}
