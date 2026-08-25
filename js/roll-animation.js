/* roll-animation.js — the quaternion tumble/settle animation played when
   dice roll, the post-roll "face the viewer" re-alignment, and the
   advantage/disadvantage collapse animation that shrinks losing dice away.
   Depends on math.js (quaternion helpers, rollFloat) and render.js
   (renderDiceCanvas); roll.js drives these functions with the actual
   rolled values. */

function buildTumbleWaypoints(startQuat, sides, finalSolver) {
  const waypointCount = sides === 2 ? 14 : 7;
  const quats = [startQuat];
  let current = startQuat;

  const FLIP_BIAS = 0.18;

  for (let i = 0; i < waypointCount; i++) {
    const axis = [rollFloat(-1, 1), rollFloat(-1, 1), rollFloat(-1, 1) * FLIP_BIAS];
    const len = Math.hypot(...axis) || 1;
    const axisN = axis.map((v) => v / len);
    const angle = rollFloat(140, 260);
    const step = quatFromAxisAngle(axisN, angle);
    current = quatMultiply(step, current);
    quats.push(current);
  }
  const finalQuat = finalSolver(current);
  quats.push(finalQuat);
  return quats;
}

// azimuthDeg: optional random horizontal rotation applied after settling so the
// die doesn't always face the viewer perfectly. 0/undefined = old behaviour.
function solveSettleFromQuat(currentQuat, faceNormal, faceUp, faceDown, azimuthDeg) {
  const currentMat = quatToMatrix(currentQuat);
  const target = faceDown ? [0, 0, -1] : [0, 0, 1];
  // Rotate the canonical up reference by azimuthDeg around the vertical axis.
  const azRad = ((azimuthDeg || 0) * Math.PI) / 180;
  const targetUp = [Math.sin(azRad), Math.cos(azRad), 0];

  const curNormal = applyMatrixToVector(currentMat, faceNormal);
  const curUp = applyMatrixToVector(currentMat, faceUp);

  const settleMat = rotationToAlign(curNormal, target);
  const settleQuat = matrixToQuaternion(settleMat);
  const settledUp = applyMatrixToVector(settleMat, curUp);

  const axisRef = faceDown ? [0, 0, -1] : [0, 0, 1];
  const dotST = settledUp[0]*axisRef[0] + settledUp[1]*axisRef[1] + settledUp[2]*axisRef[2];
  const proj = settledUp.map((v, idx) => v - dotST * axisRef[idx]);
  const projLen = Math.hypot(...proj) || 1;
  const projN = proj.map((v) => v / projLen);
  const twistMat = rotationAroundAxis(axisRef, projN, targetUp);
  const twistQuat = matrixToQuaternion(twistMat);

  return quatMultiply(twistQuat, quatMultiply(settleQuat, currentQuat));
}

function quatAngleBetween(a, b) {
  let dot = a[0]*b[0] + a[1]*b[1] + a[2]*b[2] + a[3]*b[3];
  dot = Math.min(1, Math.abs(dot));
  return 2 * Math.acos(dot);
}

function easeOutSettle(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutTumble(t) {
  const smooth = t * t * (3 - 2 * t);
  const blend = 0.25;
  return (1 - blend) * t + blend * smooth;
}

function buildRollAnimState(die, waypoints, totalDurationMs) {
  const legCount = waypoints.length - 1;
  const tumbleLegCount = legCount - 1;

  const finalLegShare = 0.32;
  const tumbleTotalMs = totalDurationMs * (1 - finalLegShare);
  const finalLegDuration = totalDurationMs * finalLegShare;

  const tumbleAngles = [];
  let angleSum = 0;
  for (let i = 0; i < tumbleLegCount; i++) {
    const a = quatAngleBetween(waypoints[i], waypoints[i + 1]);
    tumbleAngles.push(a);
    angleSum += a;
  }
  const legDurations = tumbleAngles.map((a) =>
    angleSum > 0 ? (a / angleSum) * tumbleTotalMs : tumbleTotalMs / tumbleLegCount
  );
  legDurations.push(finalLegDuration);

  return {
    die,
    waypoints,
    legDurations,
    legCount,
    legIndex: 0,
    legStart: 0,
    done: false,
  };
}

function stepRollAnim(state, now) {
  if (state.done) return;
  const { die, waypoints, legDurations, legCount } = state;
  const elapsed = now - state.legStart;
  const dur = legDurations[state.legIndex];
  const t = Math.min(1, elapsed / dur);
  const isFinalLeg = state.legIndex === legCount - 1;
  const easedT = isFinalLeg ? easeOutSettle(t) : easeInOutTumble(t);
  const q = quatSlerp(waypoints[state.legIndex], waypoints[state.legIndex + 1], easedT);
  die.currentQuat = q;

  if (t >= 1) {
    state.legIndex++;
    state.legStart = now;
    if (state.legIndex >= legCount) {
      die.currentQuat = waypoints[waypoints.length - 1];
      state.done = true;
    }
  }
}

function runRollAnimations(states, onAllDone) {
  const now0 = performance.now();
  states.forEach((s) => { s.legStart = now0; });

  function frame(now) {
    let anyRunning = false;
    states.forEach((s) => {
      if (!s.done) {
        stepRollAnim(s, now);
        if (!s.done) anyRunning = true;
      }
    });
    renderDiceCanvas();
    if (anyRunning) {
      requestAnimationFrame(frame);
    } else {
      onAllDone();
    }
  }
  requestAnimationFrame(frame);
}

// Smoothly rotate every settled die so its top face is neatly aligned toward
// the viewer (azimuth 0).  Called after a short delay once a roll finishes.
function alignDiceToViewer(diceToAlign, durationMs, onDone) {
  // Build from/to pairs.  Dice with no rolled label (e.g. percentile units
  // whose label is driven by their owner) are handled via their owner, so we
  // skip them to avoid double-rotating.
  const pairs = diceToAlign
    .filter((d) => d.rolledLabel !== null && d.rolledLabel !== undefined)
    .map((d) => {
      const face = d.faceByLabel[d.rolledLabel];
      if (!face) return null;
      const isD4 = d.sides === 4;
      const toQuat = solveSettleFromQuat(d.currentQuat, face.normal, face.up, isD4, 0);
      return { die: d, fromQuat: d.currentQuat.slice(), toQuat };
    })
    .filter(Boolean);

  // Also align percentile unit dice. Each unit die must settle onto its own
  // rolled face - it has its own currentQuat and faceNormal/up, independent
  // of the owner die - so we compute its toQuat the same way as any other
  // die. We just use azimuth 0 (same as the owner) so it ends up facing the
  // viewer in step with its owner rather than at some unrelated rotation.
  diceToAlign.forEach((d) => {
    if (!d.isPercentileUnit) return;
    if (d.rolledLabel === null || d.rolledLabel === undefined) return;
    if (pairs.some((p) => p.die === d)) return; // already handled above
    const face = d.faceByLabel[d.rolledLabel];
    if (!face) return;
    const toQuat = solveSettleFromQuat(d.currentQuat, face.normal, face.up, false, 0);
    pairs.push({ die: d, fromQuat: d.currentQuat.slice(), toQuat });
  });

  if (pairs.length === 0) { if (onDone) onDone(); return; }

  const startTime = performance.now();

  function frame(now) {
    const raw = (now - startTime) / durationMs;
    const t = easeOutSettle(Math.min(raw, 1));
    pairs.forEach(({ die, fromQuat, toQuat }) => {
      die.currentQuat = quatSlerp(fromQuat, toQuat, t);
    });
    renderDiceCanvas();
    if (raw < 1) {
      requestAnimationFrame(frame);
    } else {
      pairs.forEach(({ die, toQuat }) => { die.currentQuat = toQuat; });
      renderDiceCanvas();
      if (onDone) onDone();
    }
  }
  requestAnimationFrame(frame);
}

function animateTumbleAndSettle(diceToRoll, onAllSettled) {
  const results = diceToRoll.map((d) => {
    d.settled = false;
    const value = rollDie(d.sides === 100 ? 10 : d.sides);
    let label, displayValue;
    if (d.sides === 100) {
      displayValue = value === 10 ? 0 : value * 10;
      label = value === 10 ? '00' : String(value * 10);
    } else if (d.sides === 10 && !d.isPercentileUnit) {
      displayValue = value === 10 ? 10 : value;
      label = value === 10 ? '10' : String(value);
    } else if (d.sides === 10 && d.isPercentileUnit) {
      displayValue = value === 10 ? 0 : value;
      label = value === 10 ? '0' : String(value);
    } else {
      displayValue = value;
      label = String(value);
    }
    return { value: displayValue, label };
  });

  const animStates = diceToRoll.map((d, i) => {
    const face = d.faceByLabel[results[i].label];
    const isD4 = d.sides === 4;
    const azimuth = rollFloat(0, 360);
    const waypoints = buildTumbleWaypoints(d.currentQuat, d.sides, (fromQuat) =>
      solveSettleFromQuat(fromQuat, face.normal, face.up, isD4, azimuth)
    );
    const rollDurationMs = rollFloat(2000, 3000);
    return buildRollAnimState(d, waypoints, rollDurationMs);
  });

  runRollAnimations(animStates, () => {
    diceToRoll.forEach((d, i) => {
      d.value = results[i].value;
      d.settled = true;
      d.rolledLabel = results[i].label;
    });
    onAllSettled();
  });
}

function runCollapseAnimation(winners, losers, durationMs, onDone) {
  const COLLAPSE_DURATION_MS = durationMs;
  const startPositions = new Map();
  winners.forEach((d) => startPositions.set(d, { x: d.screenX, y: d.screenY, scale: d.drawScale }));
  losers.forEach((d) => startPositions.set(d, { x: d.screenX, y: d.screenY, scale: d.drawScale }));

  const startTime = performance.now();

  function frame(now) {
    const t = Math.min(1, (now - startTime) / COLLAPSE_DURATION_MS);
    const eased = easeOutSettle(t);

    winners.forEach((d) => {
      const start = startPositions.get(d);
      d.screenX = start.x + (d._collapseFinalX - start.x) * eased;
      d.screenY = start.y + (d._collapseFinalY - start.y) * eased;
      d.drawScale = start.scale + (d._collapseFinalScale - start.scale) * eased;
    });
    losers.forEach((d) => {
      d.drawOpacity = 1 - eased;
    });

    renderDiceCanvas();
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      onDone();
    }
  }
  requestAnimationFrame(frame);
}
