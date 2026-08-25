/* render.js — draws every die onto the 2D canvas each frame: 3D-to-2D
   projection, back-face culling and depth sorting, face fills/strokes, and
   numeral placement (including the D4's special per-vertex labelling).
   Depends on math.js (quatToMatrix, applyMatrixToVectorInto),
   colour-schemes.js (getDieColors), and state.js/layout.js for the `dice`
   array and each die's screenX/screenY/drawScale. */

const PROJECTION_FOCAL = 900;
const PROJECTION_CAMERA_DIST = 900;

function projectPoint(point3d, centerX, centerY, scale) {
  const [x, y, z] = point3d;
  const denom = PROJECTION_CAMERA_DIST - z * scale;
  const factor = PROJECTION_FOCAL / denom;
  return [centerX + x * scale * factor, centerY - y * scale * factor];
}

const DIE_SCALE = 42;
const DIE_TYPE_SCALE = {
  2: 0.59,
  4: 1.19,
  6: 1.00,
  8: 1.19,
  10: 1.19,
  12: 1.18,
  20: 1.19,
  100: 1.19,
};
function dieTypeScale(sides) { return DIE_TYPE_SCALE[sides] || 1; }

function renderDiceCanvas() {
  const canvas = document.getElementById('dice-canvas');
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  dice.forEach((die) => { drawDie(ctx, die); });
  ctx.textBaseline = 'middle';
}

const visibleFacesScratch = Array.from({ length: 20 }, () => ({ face: null, rotCentroid: null, rotUp: null, rotVerts: null }));

function drawDie(ctx, die) {
  const rotMat = quatToMatrix(die.currentQuat);
  const scale = DIE_SCALE * dieTypeScale(die.sides) * (die.drawScale || 1);
  const cx = die.screenX, cy = die.screenY;
  const dieOpacity = die.drawOpacity === undefined ? 1 : die.drawOpacity;
  if (dieOpacity <= 0.01) return;

  let visibleCount = 0;
  die.faces.forEach((face) => {
    applyMatrixToVectorInto(face._rotNormal, rotMat, face.normal);
    if (face._rotNormal[2] <= 0.02) return;
    applyMatrixToVectorInto(face._rotCentroid, rotMat, face.centroid);
    applyMatrixToVectorInto(face._rotUp, rotMat, face.up);
    for (let i = 0; i < face.verts3d.length; i++) {
      applyMatrixToVectorInto(face._rotVerts[i], rotMat, face.verts3d[i]);
    }
    const slot = visibleFacesScratch[visibleCount++];
    slot.face = face;
    slot.rotCentroid = face._rotCentroid;
    slot.rotUp = face._rotUp;
    slot.rotVerts = face._rotVerts;
  });

  for (let i = 1; i < visibleCount; i++) {
    const cur = visibleFacesScratch[i];
    const curZ = cur.rotCentroid[2];
    let j = i - 1;
    while (j >= 0 && visibleFacesScratch[j].rotCentroid[2] > curZ) {
      visibleFacesScratch[j + 1] = visibleFacesScratch[j];
      j--;
    }
    visibleFacesScratch[j + 1] = cur;
  }

  const colors = getDieColors(die);

  for (let i = 0; i < visibleCount; i++) {
    const { face, rotVerts } = visibleFacesScratch[i];
    drawFaceFill(ctx, die, face, rotVerts, cx, cy, scale, dieOpacity, colors);
  }
  for (let i = 0; i < visibleCount; i++) {
    const { face, rotVerts } = visibleFacesScratch[i];
    drawFaceStroke(ctx, die, face, rotVerts, cx, cy, scale, dieOpacity, colors);
  }
  for (let i = 0; i < visibleCount; i++) {
    const { face, rotCentroid, rotUp, rotVerts } = visibleFacesScratch[i];
    drawFaceNumeral(ctx, die, face, rotCentroid, rotUp, rotVerts, cx, cy, scale, dieOpacity, colors);
  }
}

function pointToSegmentDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax, aby = by - ay;
  const apx = px - ax, apy = py - ay;
  const abLenSq = abx * abx + aby * aby;
  let t = abLenSq > 0 ? (apx * abx + apy * aby) / abLenSq : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * abx, cy = ay + t * aby;
  return Math.hypot(px - cx, py - cy);
}

function polygonInradiusFromPoint(px, py, points) {
  let minDist = Infinity;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const [ax, ay] = points[i];
    const [bx, by] = points[(i + 1) % n];
    minDist = Math.min(minDist, pointToSegmentDist(px, py, ax, ay, bx, by));
  }
  return minDist;
}

function drawFaceFill(ctx, die, face, rotVerts, cx, cy, scale, dieOpacity, colors) {
  const projected = face._projVerts;
  for (let i = 0; i < rotVerts.length; i++) {
    const p = projectPoint(rotVerts[i], cx, cy, scale);
    projected[i][0] = p[0];
    projected[i][1] = p[1];
  }

  ctx.beginPath();
  for (let i = 0; i < projected.length; i++) {
    if (i === 0) ctx.moveTo(projected[i][0], projected[i][1]);
    else ctx.lineTo(projected[i][0], projected[i][1]);
  }
  ctx.closePath();
  ctx.globalAlpha = dieOpacity;
  ctx.fillStyle = colors.body;
  ctx.fill();
  ctx.globalAlpha = 1;
}

function drawFaceStroke(ctx, die, face, rotVerts, cx, cy, scale, dieOpacity, colors) {
  const projected = face._projVerts;

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < projected.length; i++) {
    if (i === 0) ctx.moveTo(projected[i][0], projected[i][1]);
    else ctx.lineTo(projected[i][0], projected[i][1]);
  }
  ctx.closePath();
  ctx.clip();

  ctx.beginPath();
  for (let i = 0; i < projected.length; i++) {
    if (i === 0) ctx.moveTo(projected[i][0], projected[i][1]);
    else ctx.lineTo(projected[i][0], projected[i][1]);
  }
  ctx.closePath();
  ctx.globalAlpha = dieOpacity;
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = colors.stroke;
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawFaceNumeral(ctx, die, face, rotCentroid, rotUp, rotVerts, cx, cy, scale, dieOpacity, colors) {
  const projected = face._projVerts;

  if (die.sides === 4 && face.d4VertexLabels) {
    drawD4FaceNumerals(ctx, die, face, rotVerts, cx, cy, scale, dieOpacity, colors);
    return;
  }

  const np = projected.length;
  let centerX = 0, centerY = 0;
  for (const [vx, vy] of projected) { centerX += vx; centerY += vy; }
  centerX /= np; centerY /= np;

  const nv = rotVerts.length;
  const cX = [], cY = [];
  for (let i = 0; i < nv; i++) {
    const j = (i + 1) % nv;
    let dx, dy, dl;
    dx = rotVerts[i][0] - rotCentroid[0];
    dy = -(rotVerts[i][1] - rotCentroid[1]);
    dl = Math.hypot(dx, dy);
    if (dl > 0.001) { cX.push(dx / dl); cY.push(dy / dl); }
    dx = (rotVerts[i][0] + rotVerts[j][0]) * 0.5 - rotCentroid[0];
    dy = -((rotVerts[i][1] + rotVerts[j][1]) * 0.5 - rotCentroid[1]);
    dl = Math.hypot(dx, dy);
    if (dl > 0.001) { cX.push(dx / dl); cY.push(dy / dl); }
  }
  if (cX.length === 0) return;
  const refLen = Math.hypot(rotUp[0], rotUp[1]);
  if (refLen < 0.02) return;
  const refX = rotUp[0] / refLen, refY = -rotUp[1] / refLen;
  let bestK = 0, bestDot = -Infinity;
  for (let k = 0; k < cX.length; k++) {
    const d = cX[k] * refX + cY[k] * refY;
    if (d > bestDot) { bestDot = d; bestK = k; }
  }
  let snapK = (face._snapK != null && face._snapK < cX.length) ? face._snapK : bestK;
  if (bestDot > cX[snapK] * refX + cY[snapK] * refY + 0.15) snapK = bestK;
  face._snapK = snapK;
  const upDirX = cX[snapK], upDirY = cY[snapK];
  const angle = Math.atan2(upDirX, -upDirY);

  let rawInradius = Infinity;
  for (let i = 0; i < np; i++) {
    const [ax, ay] = projected[i], [bx, by] = projected[(i + 1) % np];
    const abx = bx-ax, aby = by-ay, apx = centerX-ax, apy = centerY-ay;
    const l2 = abx*abx + aby*aby;
    const t = l2 > 0 ? Math.max(0, Math.min(1, (apx*abx + apy*aby) / l2)) : 0;
    rawInradius = Math.min(rawInradius, Math.hypot(centerX-ax-t*abx, centerY-ay-t*aby));
  }
  const crossDirX = -upDirY;
  const crossDirY = upDirX;
  const spanDots = projected.map(([vx, vy]) =>
    (vx - centerX) * upDirX + (vy - centerY) * upDirY
  );
  const upSpan = Math.max(...spanDots) - Math.min(...spanDots);
  const crossDots = projected.map(([vx, vy]) =>
    (vx - centerX) * crossDirX + (vy - centerY) * crossDirY
  );
  const crossSpan = Math.max(...crossDots) - Math.min(...crossDots);
  const foreshortening = upSpan > 0.5 ? Math.max(0.1, Math.min(1.0, crossSpan / upSpan)) : 1.0;
  const inradius = Math.sqrt(rawInradius * upSpan) * 0.67;
  const fontSize = inradius;

  const FADE_LOW = 2.5, FADE_HIGH = 6, MIN_OPACITY = 0;
  const fadeT = inradius <= FADE_LOW ? 0 : inradius >= FADE_HIGH ? 1 : (inradius - FADE_LOW) / (FADE_HIGH - FADE_LOW);
  const opacity = (MIN_OPACITY + fadeT * (1 - MIN_OPACITY)) * dieOpacity;
  if (opacity <= 0.01) return;
  ctx.font = `700 ${fontSize}px 'Almendra', serif`;
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < projected.length; i++) {
    if (i === 0) ctx.moveTo(projected[i][0], projected[i][1]);
    else ctx.lineTo(projected[i][0], projected[i][1]);
  }
  ctx.closePath();
  ctx.clip();
  ctx.translate(centerX, centerY);
  ctx.rotate(angle);
  ctx.scale(foreshortening, 1);
  ctx.globalAlpha = opacity;
  ctx.fillStyle = colors.numeral;
  ctx.fillText(face.label, 0, 1);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawD4FaceNumerals(ctx, die, face, rotVerts, cx, cy, scale, dieOpacity, colors) {
  const projected = face._projVerts;

  const projCx = (projected[0][0] + projected[1][0] + projected[2][0]) / 3;
  const projCy = (projected[0][1] + projected[1][1] + projected[2][1]) / 3;

  const inradius = polygonInradiusFromPoint(projCx, projCy, projected);

  const FADE_LOW = 1.5, FADE_HIGH = 4, MIN_OPACITY = 0.9;
  const fadeT = inradius <= FADE_LOW ? 0 : inradius >= FADE_HIGH ? 1 : (inradius - FADE_LOW) / (FADE_HIGH - FADE_LOW);
  const opacity = (MIN_OPACITY + fadeT * (1 - MIN_OPACITY)) * dieOpacity;
  if (opacity <= 0.01) return;

  const circumradius = (
    Math.hypot(projected[0][0] - projCx, projected[0][1] - projCy) +
    Math.hypot(projected[1][0] - projCx, projected[1][1] - projCy) +
    Math.hypot(projected[2][0] - projCx, projected[2][1] - projCy)
  ) / 3;
  const fontSize = Math.min(scale * 0.40, circumradius * 0.55);
  ctx.font = `700 ${fontSize}px 'Almendra', serif`;
  ctx.globalAlpha = opacity;
  ctx.fillStyle = colors.numeral;

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(projected[0][0], projected[0][1]);
  ctx.lineTo(projected[1][0], projected[1][1]);
  ctx.lineTo(projected[2][0], projected[2][1]);
  ctx.closePath();
  ctx.clip();

  for (let i = 0; i < 3; i++) {
    const label = face.d4VertexLabels[i];
    if (!label) continue;
    const [vx, vy] = projected[i];
    const dvx = vx - projCx;
    const dvy = vy - projCy;
    const dist = Math.hypot(dvx, dvy) || 1;
    const t = 0.42;
    const tx = projCx + dvx * t;
    const ty = projCy + dvy * t;
    const angle = Math.atan2(dvy, dvx) - Math.PI / 2;
    ctx.save();
    ctx.translate(tx, ty);
    ctx.rotate(angle);
    ctx.fillText(label, 0, 0);
    ctx.restore();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}
