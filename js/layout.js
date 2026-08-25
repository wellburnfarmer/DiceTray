/* layout.js — positions dice in the tray's CSS grid and sizes the canvas to
   match. Depends on state.js (dice, DIE_TYPES-adjacent constants) for the
   pool being laid out; render.js and interaction.js read the screenX/
   screenY/drawScale it assigns. */

const DIE_PIXEL_SIZE = 90;
const DIE_GAP = 22;

function diceSlots() {
  const slots = [];
  dice.forEach((die) => {
    if (die.isPercentileUnit) return;
    slots.push(die);
  });
  return slots;
}

const PERCENTILE_SUB_SCALE = 0.53;
const PERCENTILE_SUB_OFFSET = 26;

function cellCenter(index, cols, cellSpan) {
  const col = index % cols;
  const row = Math.floor(index / cols);
  return {
    x: col * cellSpan + cellSpan / 2,
    y: row * cellSpan + cellSpan / 2 - DIE_GAP / 2 + 10,
    row,
  };
}

function gridColsForWidth(fieldWidth, cellSpan) {
  return Math.max(1, Math.floor((fieldWidth + DIE_GAP) / cellSpan));
}

function layoutDiceGrid() {
  const field = document.getElementById('dice-field');
  const canvas = document.getElementById('dice-canvas');
  const fieldWidth = field.clientWidth || 600;
  const baseCellSpan = DIE_PIXEL_SIZE + DIE_GAP;
  const slots = diceSlots();
  const cols = gridColsForWidth(fieldWidth, baseCellSpan);
  const rows = Math.max(1, Math.ceil(slots.length / cols));
  const cellSpan = fieldWidth / cols;

  slots.forEach((die, i) => {
    const { x: slotX, y: slotY } = cellCenter(i, cols, cellSpan);
    if (die.sides === 100) {
      die.screenX = slotX - PERCENTILE_SUB_OFFSET;
      die.screenY = slotY;
      die.drawScale = PERCENTILE_SUB_SCALE;
      die.unitDie.screenX = slotX + PERCENTILE_SUB_OFFSET;
      die.unitDie.screenY = slotY;
      die.unitDie.drawScale = PERCENTILE_SUB_SCALE;
    } else {
      die.screenX = slotX;
      die.screenY = slotY;
      die.drawScale = 1;
    }
  });

  const totalHeight = slots.length === 0 ? 120 : rows * cellSpan + 20;
  field.style.minHeight = totalHeight + 'px';

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = fieldWidth * dpr;
  canvas.height = totalHeight * dpr;
  canvas.style.height = totalHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

const ADV_PAIR_SCALE = 0.78;

function layoutDoubledGrid(groups) {
  const field = document.getElementById('dice-field');
  const canvas = document.getElementById('dice-canvas');
  const fieldWidth = field.clientWidth || 600;
  const baseCellSpan = DIE_PIXEL_SIZE + DIE_GAP;
  const cols = gridColsForWidth(fieldWidth, baseCellSpan);
  const doubledCellCount = groups.length * 2;
  const rows = Math.max(1, Math.ceil(doubledCellCount / cols));
  const cellSpan = fieldWidth / cols;

  const finalCols = gridColsForWidth(fieldWidth, baseCellSpan);
  const finalCellSpan = fieldWidth / finalCols;

  function placeDieAt(die, cellIndex, colsForThisGrid, span) {
    const { x, y } = cellCenter(cellIndex, colsForThisGrid, span);
    return { x, y };
  }

  groups.forEach((group, groupIndex) => {
    const doubledIndexA = groupIndex * 2;
    const doubledIndexB = groupIndex * 2 + 1;
    const finalIndex = groupIndex;

    if (group.kind === 'percentile') {
      const { tens: origTens, units: origUnits } = group.original;
      const { tens: dupTens, units: dupUnits } = group.duplicate;
      const a = placeDieAt(origTens, doubledIndexA, cols, cellSpan);
      const b = placeDieAt(dupTens, doubledIndexB, cols, cellSpan);
      const final = placeDieAt(origTens, finalIndex, finalCols, finalCellSpan);

      origTens.screenX = a.x - PERCENTILE_SUB_OFFSET; origTens.screenY = a.y; origTens.drawScale = PERCENTILE_SUB_SCALE;
      origUnits.screenX = a.x + PERCENTILE_SUB_OFFSET; origUnits.screenY = a.y; origUnits.drawScale = PERCENTILE_SUB_SCALE;
      dupTens.screenX = b.x - PERCENTILE_SUB_OFFSET; dupTens.screenY = b.y; dupTens.drawScale = PERCENTILE_SUB_SCALE;
      dupUnits.screenX = b.x + PERCENTILE_SUB_OFFSET; dupUnits.screenY = b.y; dupUnits.drawScale = PERCENTILE_SUB_SCALE;

      [origTens, dupTens].forEach((d) => { d._collapseFinalX = final.x - PERCENTILE_SUB_OFFSET; d._collapseFinalY = final.y; d._collapseFinalScale = PERCENTILE_SUB_SCALE; });
      [origUnits, dupUnits].forEach((d) => { d._collapseFinalX = final.x + PERCENTILE_SUB_OFFSET; d._collapseFinalY = final.y; d._collapseFinalScale = PERCENTILE_SUB_SCALE; });
    } else {
      const { original, duplicate } = group;
      const a = placeDieAt(original, doubledIndexA, cols, cellSpan);
      const b = placeDieAt(duplicate, doubledIndexB, cols, cellSpan);
      const final = placeDieAt(original, finalIndex, finalCols, finalCellSpan);

      original.screenX = a.x; original.screenY = a.y; original.drawScale = ADV_PAIR_SCALE;
      duplicate.screenX = b.x; duplicate.screenY = b.y; duplicate.drawScale = ADV_PAIR_SCALE;

      original._collapseFinalX = final.x; original._collapseFinalY = final.y; original._collapseFinalScale = 1;
      duplicate._collapseFinalX = final.x; duplicate._collapseFinalY = final.y; duplicate._collapseFinalScale = 1;
    }
  });

  const totalHeight = doubledCellCount === 0 ? 120 : rows * cellSpan + 20;
  field.style.minHeight = totalHeight + 'px';

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = fieldWidth * dpr;
  canvas.height = totalHeight * dpr;
  canvas.style.height = totalHeight + 'px';
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
