/* state.js — the picker's die-type icons, and the mutable pool of dice
   currently in the tray (order/dice/rolling/history/advCreamRole) plus the
   functions that build and rebuild that pool. Depends on die-model.js
   (buildDieModel) and math.js (rollFloat, quatFromAxisAngle); rebuildField()
   also calls layoutDiceGrid(), renderDiceCanvas(), and the UI refresh
   functions defined in layout.js, render.js, and ui.js. */

const DIE_TYPES = [2, 4, 6, 8, 10, 12, 20, 100];

const DIE_ICON_PATHS = {
  2: ["M 27.72 18.16 L 28.73 15.87 L 29.0 13.64 L 28.46 11.62 L 27.08 9.97 L 24.91 8.84 L 22.07 8.36 L 18.76 8.59 L 15.24 9.55 L 11.83 11.17 L 8.82 13.31 L 6.47 15.78 L 4.95 18.35 L 4.34 20.81 L 4.63 22.99 L 5.75 24.75 L 7.55 26.0 L 9.89 26.69 L 12.6 26.82 L 15.51 26.41 L 18.46 25.5 L 21.3 24.14 L 23.88 22.4 L 26.06 20.38 Z", "M 28.46 11.62 L 27.08 9.97 L 25.17 6.88 L 26.56 8.56 Z", "M 27.08 9.97 L 24.91 8.84 L 23.02 5.71 L 25.17 6.88 Z", "M 24.91 8.84 L 22.07 8.36 L 20.22 5.18 L 23.02 5.71 Z", "M 22.07 8.36 L 18.76 8.59 L 16.97 5.36 L 20.22 5.18 Z", "M 18.76 8.59 L 15.24 9.55 L 13.54 6.27 L 16.97 5.36 Z", "M 15.24 9.55 L 11.83 11.17 L 10.21 7.85 L 13.54 6.27 Z", "M 11.83 11.17 L 8.82 13.31 L 7.29 9.95 L 10.21 7.85 Z", "M 8.82 13.31 L 6.47 15.78 L 5.02 12.39 L 7.29 9.95 Z", "M 6.47 15.78 L 4.95 18.35 L 3.56 14.96 L 5.02 12.39 Z", "M 4.95 18.35 L 4.34 20.81 L 3.0 17.43 L 3.56 14.96 Z", "M 4.34 20.81 L 4.63 22.99 L 3.32 19.63 L 3.0 17.43 Z"],
  4: ["M 3.9 13.89 L 25.25 29.0 L 18.78 18.9 Z", "M 18.78 18.9 L 28.1 3.0 L 3.9 13.89 Z", "M 18.78 18.9 L 25.25 29.0 L 28.1 3.0 Z"],
  6: ["M 14.76 22.07 L 11.24 4.82 L 3.0 11.59 L 5.79 27.18 Z", "M 5.79 27.18 L 19.25 26.36 L 29.0 21.58 L 14.76 22.07 Z", "M 14.76 22.07 L 29.0 21.58 L 25.2 5.77 L 11.24 4.82 Z"],
  8: ["M 14.85 29.0 L 25.06 20.21 L 4.93 16.34 Z", "M 4.93 16.34 L 25.06 20.21 L 18.84 3.0 Z", "M 25.06 20.21 L 27.07 16.34 L 18.84 3.0 Z"],
  10: ["M 5.92 24.35 L 20.94 18.29 L 6.41 8.28 L 3.0 15.99 Z", "M 5.92 24.35 L 11.56 28.24 L 20.05 28.64 L 20.94 18.29 Z", "M 20.94 18.29 L 21.27 3.74 L 12.51 3.36 L 6.41 8.28 Z", "M 20.05 28.64 L 25.26 23.31 L 29.0 16.38 L 20.94 18.29 Z", "M 20.94 18.29 L 29.0 16.38 L 26.08 8.57 L 21.27 3.74 Z"],
  12: ["M 4.23 20.53 L 11.15 25.54 L 16.59 18.68 L 12.31 9.22 L 4.78 10.92 Z", "M 6.52 21.33 L 13.9 26.16 L 17.19 29.0 L 11.15 25.54 L 4.23 20.53 Z", "M 12.31 9.22 L 19.27 3.98 L 15.66 3.0 L 7.4 6.97 L 4.78 10.92 Z", "M 11.15 25.54 L 17.19 29.0 L 25.88 25.0 L 26.14 18.57 L 16.59 18.68 Z", "M 16.59 18.68 L 26.14 18.57 L 27.4 9.59 L 19.27 3.98 L 12.31 9.22 Z", "M 25.88 25.0 L 26.89 20.13 L 27.77 11.33 L 27.4 9.59 L 26.14 18.57 Z"],
  20: ["M 7.0 17.54 L 3.0 15.02 L 8.51 27.36 Z", "M 7.0 17.54 L 9.77 4.64 L 3.0 15.02 Z", "M 8.51 27.36 L 19.79 25.83 L 7.0 17.54 Z", "M 7.0 17.54 L 20.9 10.72 L 9.77 4.64 Z", "M 19.79 25.83 L 20.9 10.72 L 7.0 17.54 Z", "M 8.51 27.36 L 21.22 26.83 L 19.79 25.83 Z", "M 20.9 10.72 L 22.86 5.2 L 9.77 4.64 Z", "M 19.79 25.83 L 29.0 17.43 L 20.9 10.72 Z", "M 21.22 26.83 L 29.0 17.43 L 19.79 25.83 Z", "M 20.9 10.72 L 29.0 17.43 L 22.86 5.2 Z"],
  100: ["M 5.92 24.35 L 20.94 18.29 L 6.41 8.28 L 3.0 15.99 Z", "M 5.92 24.35 L 11.56 28.24 L 20.05 28.64 L 20.94 18.29 Z", "M 20.94 18.29 L 21.27 3.74 L 12.51 3.36 L 6.41 8.28 Z", "M 20.05 28.64 L 25.26 23.31 L 29.0 16.38 L 20.94 18.29 Z", "M 20.94 18.29 L 29.0 16.38 L 26.08 8.57 L 21.27 3.74 Z"],
};

function dieIconSvg(sides) {
  const paths = DIE_ICON_PATHS[sides] || [];
  const faces = paths.map((d) => `<path d="${d}" />`).join('');
  return `<svg class="picker-icon" viewBox="0 0 32 32" aria-hidden="true" focusable="false">${faces}</svg>`;
}
let order = [20];
let dice = [];
let rolling = false;
let history = [];
let advCreamRole = 'original';

function poolCounts() {
  const counts = {};
  for (let i = 0; i < order.length; i++) {
    const sides = order[i];
    counts[sides] = (counts[sides] || 0) + 1;
    if (sides === 100 && order[i + 1] === 10) i++;
  }
  return counts;
}

function totalCount() {
  return order.length;
}

function buildFreshDie(sides, isPercentileUnit) {
  const die = buildDieModel(sides, isPercentileUnit);
  // Pick a random face to show face-up, then settle it flat with a random
  // horizontal rotation — no vertical tilt, so the die looks naturally at rest.
  const faces = die.faces.filter(f => f.label !== '');
  const face = faces[Math.floor(rollFloat(0, faces.length))];
  const isD4 = sides === 4;
  const azimuth = rollFloat(0, 360);
  // Use a random seed orientation so solveSettle doesn't degenerate
  const seedQuat = quatFromAxisAngle([0, 1, 0], rollFloat(0, 360));
  die.currentQuat = solveSettleFromQuat(seedQuat, face.normal, face.up, isD4, azimuth);
  return die;
}

function rebuildField() {
  // Capture existing non-percentile dice in slot order so we can carry their
  // state (orientation, value, colour scheme) forward.  Only genuinely new
  // slots get a fresh die; everything else keeps its current quaternion, value,
  // rolledLabel, and settled flag so adding/removing one die doesn't disturb
  // the others.
  const prevDice = dice.filter((d) => !d.isPercentileUnit);
  const darkCount = prevDice.filter((d) => d.colorScheme === 'dark').length;
  const newDieScheme = darkCount > prevDice.length - darkCount ? 'dark' : 'cream';

  dice = [];
  let pairCounter = 0;
  let prevSlot = 0;   // index into prevDice

  for (let i = 0; i < order.length; i++) {
    const sides = order[i];
    let die;
    const prev = prevDice[prevSlot];

    if (prev && prev.sides === sides) {
      // Reuse the existing die — carry all state forward.
      die = prev;
    } else {
      // New die or type changed — build fresh.
      die = buildFreshDie(sides);
      die.colorScheme = prev ? prev.colorScheme : newDieScheme;
    }
    prevSlot++;

    if (sides === 100) {
      const pairId = pairCounter++;
      die.pairId = pairId;
      // Carry or create the paired unit die.
      const prevUnit = prevDice[prevSlot] && prevDice[prevSlot].isPercentileUnit
        ? prevDice[prevSlot] : null;
      let unitDie;
      if (prevUnit && prev && prev.sides === 100) {
        unitDie = prevUnit;
      } else {
        unitDie = buildDieModel(10, true);
        unitDie.currentQuat = die.currentQuat;
        unitDie.colorScheme = die.colorScheme;
      }
      unitDie.pairId = pairId;
      unitDie.isPercentileUnit = true;
      die.unitDie = unitDie;
      dice.push(die, unitDie);
      i++;           // skip the paired '10' entry in order
      prevSlot++;    // skip the old unit slot in prevDice too
    } else {
      dice.push(die);
    }
  }

  layoutDiceGrid();
  updateCountLabel();
  updateGroupList();
  refreshPickerDisabled();
  refreshAdvantageButtons();
  renderDiceCanvas();

  document.getElementById('tray-empty').style.display = dice.length === 0 ? 'flex' : 'none';
}
