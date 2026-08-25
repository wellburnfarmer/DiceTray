/* ui.js — small UI-state functions for the picker row, group-count chips,
   and roll total: adding/removing dice from the pool, and enabling/disabling
   controls while a roll animation is in progress. Depends on state.js
   (order, dice, rolling, totalCount, rebuildField), colour-schemes.js
   (COLOUR_SCHEMES, currentScheme), and the `pickerEl`/`clearBtn` elements
   looked up in main.js. */

function updateCountLabel() {
  document.getElementById('count-label').textContent = `${totalCount()} / 20 in the Tray`;
}

function updateGroupList() {
  const el = document.getElementById('group-list');
  el.innerHTML = '';
  const counts = poolCounts();
  DIE_TYPES.filter((s) => counts[s] > 0).forEach((sides) => {
    const chip = document.createElement('div');
    chip.className = 'group-chip';
    chip.innerHTML = `<span class="tag">d${sides}</span><span>×${counts[sides]}</span>`;
    const minus = document.createElement('button');
    minus.textContent = '−';
    minus.setAttribute('aria-label', `Remove one d${sides}`);
    minus.onclick = () => removeOne(sides);
    minus.disabled = rolling;
    const plus = document.createElement('button');
    plus.textContent = '+';
    plus.setAttribute('aria-label', `Add one d${sides}`);
    plus.onclick = () => addOne(sides);
    plus.disabled = rolling;
    chip.appendChild(minus);
    chip.appendChild(plus);
    el.appendChild(chip);
  });
}

function setGroupChipsDisabled(disabled) {
  document.querySelectorAll('.group-chip button').forEach((b) => { b.disabled = disabled; });
}

const TOTAL_PLACEHOLDER = '<span class="total-number is-placeholder">&mdash;</span><span class="total-caption">total appears here after rolling</span>';

function resetTotal() {
  document.getElementById('roll-total').innerHTML = TOTAL_PLACEHOLDER;
}

function addOne(sides) {
  if (rolling) return;
  if (sides === 100) {
    if (totalCount() + 2 > 20) return;
    order.push(100, 10);
  } else {
    if (totalCount() >= 20) return;
    order.push(sides);
  }
  rebuildField();
  resetTotal();
}
function removeOne(sides) {
  if (rolling) return;
  const idx = order.lastIndexOf(sides);
  if (idx === -1) return;
  order.splice(idx, 1);
  if (sides === 100) {
    const tenIdx = order.lastIndexOf(10);
    if (tenIdx !== -1) order.splice(tenIdx, 1);
  }
  rebuildField();
  resetTotal();
}
function clearAll() {
  if (rolling) return;
  order = [];
  advCreamRole = 'original';
  rebuildField();
  resetTotal();
  updatePickerIconColors();
}

function refreshPickerDisabled() {
  const atMax = totalCount() >= 20;
  const noRoomForPair = totalCount() >= 19;
  pickerEl.querySelectorAll('.picker-btn').forEach((b) => {
    const needsPair = b.dataset.sides === '100';
    b.disabled = rolling || (needsPair ? noRoomForPair : atMax);
  });
  clearBtn.disabled = totalCount() === 0 || rolling;
}

function refreshAdvantageButtons() {
  const show = dice.length > 0;
  const advBtn = document.getElementById('advantage-btn');
  const disadvBtn = document.getElementById('disadvantage-btn');
  advBtn.disabled = rolling || !show;
  disadvBtn.disabled = rolling || !show;
}

// Sync the picker button SVG icon colours to the current dice colour scheme.
// Uses the primary (light) die's body and stroke normally, but switches to the
// alternate (dark) die's colours when a dark die is currently in the tray.
// Reads colorScheme directly from the dice array so it stays in sync across
// multiple advantage/disadvantage rolls.
function updatePickerIconColors() {
  const scheme = COLOUR_SCHEMES[currentScheme] || COLOUR_SCHEMES.ivory;
  const root = document.documentElement;
  const firstNonUnit = dice.find((d) => !d.isPercentileUnit);
  const altIsWinning = firstNonUnit ? firstNonUnit.colorScheme === 'dark' : false;
  root.style.setProperty('--color-picker-icon', altIsWinning ? scheme.bodyDark  : scheme.body);
  root.style.setProperty('--color-die-stroke',  altIsWinning ? scheme.strokeDark : scheme.stroke);
}
