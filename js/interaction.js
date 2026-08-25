/* interaction.js — window resize handling and tap/click-to-reroll hit
   testing on the dice canvas. Depends on layout.js (layoutDiceGrid),
   render.js (renderDiceCanvas), state.js (dice, rolling), and roll.js
   (rerollDie). The handlers here are named so main.js can wire them to
   their listeners in one place. */

let resizeRaf = null;
function handleWindowResize() {
  if (resizeRaf) return;
  resizeRaf = requestAnimationFrame(() => {
    resizeRaf = null;
    layoutDiceGrid();
    renderDiceCanvas();
  });
}

/* =========================================================================
   TAP/CLICK TO REROLL A SINGLE DIE
   ========================================================================= */
const DIE_HIT_RADIUS = 52;
const DIE_HIT_RADIUS_PERCENTILE = 34;

function handleCanvasMouseMove(e) {
  if (rolling) { e.currentTarget.style.cursor = 'default'; return; }
  const rect = e.currentTarget.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const overDie = dice.some((die) => {
    const radius = die.pairId !== undefined ? DIE_HIT_RADIUS_PERCENTILE : DIE_HIT_RADIUS;
    const dx = die.screenX - x, dy = die.screenY - y;
    return dx * dx + dy * dy <= radius * radius;
  });
  e.currentTarget.style.cursor = overDie ? 'pointer' : 'default';
}

function handleCanvasMouseLeave(e) {
  e.currentTarget.style.cursor = 'default';
}

function handleCanvasClick(e) {
  if (rolling) return;
  const canvas = document.getElementById('dice-canvas');
  const rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  let closestDie = null;
  let closestDistSq = DIE_HIT_RADIUS * DIE_HIT_RADIUS;
  dice.forEach((die) => {
    const radius = die.pairId !== undefined ? DIE_HIT_RADIUS_PERCENTILE : DIE_HIT_RADIUS;
    const dx = die.screenX - x, dy = die.screenY - y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= radius * radius && distSq <= closestDistSq) {
      closestDistSq = distSq;
      closestDie = die;
    }
  });

  if (closestDie) rerollDie(closestDie);
}
