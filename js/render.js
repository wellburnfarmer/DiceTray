/* render.js — draws every die onto the 2D canvas each frame: 3D-to-2D
   projection, back-face culling and depth sorting, per-face lighting, face
   fills/strokes, and numerals — which are projected into the plane of their
   own face rather than stamped flat on top of it, using the placements
   built by die-model.js (that includes the D4's three per-vertex numerals).
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
  dice.forEach((die) => { drawDie(ctx, die); });
}

const visibleFacesScratch = Array.from({ length: 20 }, () => ({ face: null, rotCentroid: null, rotVerts: null }));

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
    applyMatrixToVectorInto(face._rotAxisU, rotMat, face.axisU);
    applyMatrixToVectorInto(face._rotAxisV, rotMat, face.axisV);
    for (let i = 0; i < face.verts3d.length; i++) {
      applyMatrixToVectorInto(face._rotVerts[i], rotMat, face.verts3d[i]);
    }
    const slot = visibleFacesScratch[visibleCount++];
    slot.face = face;
    slot.rotCentroid = face._rotCentroid;
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
    const { face, rotCentroid } = visibleFacesScratch[i];
    drawFaceNumeral(ctx, die, face, rotCentroid, cx, cy, scale, dieOpacity, colors);
  }
}

/* =========================================================================
   LIGHTING
   One fixed key light, used for two things: shading each face so the solid
   reads as a solid, and working out which way the walls of an engraved
   numeral face — which is what stops the numerals looking like decals.
   The light is given in view space (x right, y up, z towards the viewer)
   and points from the die towards the lamp.
   ========================================================================= */
const LIGHT_DIR = (function () {
  const v = [-0.42, 0.68, 0.60];
  const len = Math.hypot(v[0], v[1], v[2]);
  return [v[0] / len, v[1] / len, v[2] / len];
})();
const LIGHT_AMBIENT = 0.76;
const LIGHT_DIFFUSE = 0.30;
/* A little of the key light is added rather than multiplied, so that dark
   dice — where multiplying a near-black body by anything stays near-black —
   still show which way each face is turned. */
const LIGHT_SHEEN = 26;

function faceLambert(rotNormal) {
  const d = rotNormal[0] * LIGHT_DIR[0] + rotNormal[1] * LIGHT_DIR[1] + rotNormal[2] * LIGHT_DIR[2];
  return Math.max(0, d);
}
function faceShade(rotNormal) {
  return LIGHT_AMBIENT + LIGHT_DIFFUSE * faceLambert(rotNormal);
}
function faceSheen(rotNormal) {
  return LIGHT_SHEEN * faceLambert(rotNormal);
}

/* Light a #rgb/#rrggbb(aa) colour: scale it by `factor` and add `sheen`
   (0-255) on top, keeping any alpha. Cached, since a die only ever uses a
   handful of colours at a small set of quantised shades. */
const shadeCache = new Map();
function shadeColor(color, factor, sheen) {
  const key = color + '@' + factor.toFixed(3) + '+' + sheen.toFixed(1);
  const cached = shadeCache.get(key);
  if (cached) return cached;

  let out = color;
  const hex = color.charAt(0) === '#' ? color.slice(1) : null;
  if (hex && (hex.length === 3 || hex.length === 6 || hex.length === 8)) {
    const step = hex.length === 3 ? 1 : 2;
    const chan = (i) => {
      const part = hex.substr(i * step, step);
      const value = parseInt(step === 1 ? part + part : part, 16);
      return Math.max(0, Math.min(255, Math.round(value * factor + sheen)));
    };
    const r = chan(0), g = chan(1), b = chan(2);
    const alpha = hex.length === 8 ? parseInt(hex.substr(6, 2), 16) / 255 : 1;
    out = alpha >= 1
      ? 'rgb(' + r + ', ' + g + ', ' + b + ')'
      : 'rgba(' + r + ', ' + g + ', ' + b + ', ' + alpha.toFixed(3) + ')';
  }
  if (shadeCache.size > 512) shadeCache.clear();
  shadeCache.set(key, out);
  return out;
}

/* =========================================================================
   FACE FILL AND EDGES
   ========================================================================= */
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
  ctx.fillStyle = shadeColor(colors.body, faceShade(face._rotNormal), faceSheen(face._rotNormal));
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
  ctx.strokeStyle = shadeColor(colors.stroke, faceShade(face._rotNormal), 0);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.restore();
}

/* =========================================================================
   NUMERALS
   A numeral is drawn *in the plane of its face*: the face's own 2D axes are
   projected to screen and used directly as the canvas transform, so the
   glyph picks up the same rotation, shear and foreshortening as the polygon
   it sits on. Position, angle and size all come from the fixed placements
   baked into the die model (die-model.js), never from screen-space
   measurements, so numerals stay painted on the die rather than sliding
   about and resizing as it tumbles.
   ========================================================================= */
const NUMERAL_FONT_STACK = "'Almendra', serif";
const NUMERAL_FONT_WEIGHT = 700;

/* Glyph metrics, measured once per label at a reference size and reused as
   ratios. Lets us centre a numeral on its true ink box (canvas' "middle"
   baseline centres the em box, which sits noticeably low for digits) and
   size it by cap height rather than by nominal font size. */
const METRIC_REF_PX = 100;
const numeralMetricsCache = new Map();
let numeralMetricsGeneration = 0;
function numeralMetrics(ctx, label) {
  let m = numeralMetricsCache.get(label);
  if (m) return m;
  const prevFont = ctx.font;
  const prevBaseline = ctx.textBaseline;
  ctx.font = NUMERAL_FONT_WEIGHT + ' ' + METRIC_REF_PX + 'px ' + NUMERAL_FONT_STACK;
  ctx.textBaseline = 'alphabetic';
  const tm = ctx.measureText(label);
  m = {
    ascent: (tm.actualBoundingBoxAscent || METRIC_REF_PX * 0.7) / METRIC_REF_PX,
    descent: (tm.actualBoundingBoxDescent || 0) / METRIC_REF_PX,
    width: (tm.width || METRIC_REF_PX * 0.5) / METRIC_REF_PX,
  };
  ctx.font = prevFont;
  ctx.textBaseline = prevBaseline;
  numeralMetricsCache.set(label, m);
  return m;
}
/* The web font can land after the first frames have been drawn; drop the
   cached metrics so the next frame re-measures against the real face. */
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(function () {
    numeralMetricsCache.clear();
    numeralMetricsGeneration++;
  });
}

/* Baseline share of the room available on a face that a numeral fills; 1
   would have the ink box touching the face's edges. Each placement's own
   `fit` (die-model.js) scales this per die type, which real dice genuinely
   differ on — a D20's numerals nearly fill their triangle, a D6's sit
   comfortably inside their square. */
const NUMERAL_FILL = 0.95;
/* The engraved bevel: how deep the recess reads, as a fraction of the
   numeral's on-screen cap height, and how strongly its two walls take the
   light. Offsetting a dark copy towards the lamp and a light copy away
   from it leaves a shadowed near wall and a lit far wall — the way a
   real cut numeral catches the light. */
const NUMERAL_BEVEL = 0.022;
const NUMERAL_BEVEL_SHADOW_ALPHA = 0.5;
const NUMERAL_BEVEL_LIGHT_ALPHA = 0.45;
/* Below this on-screen cap height a numeral has stopped being legible and
   is faded out rather than left as aliased mush. */
const NUMERAL_FADE_LOW = 2, NUMERAL_FADE_HIGH = 5.5;

/* Screen-space derivative of the projection at `point3d` along `dir3d`:
   how far one unit of `dir3d` moves on the canvas. Includes the perspective
   term, so the basis is exact rather than a parallel-projection guess. */
function projectDerivativeInto(out, point3d, dir3d, scale) {
  const denom = PROJECTION_CAMERA_DIST - point3d[2] * scale;
  const f = PROJECTION_FOCAL / denom;
  const dF = (f * f * scale * dir3d[2]) / PROJECTION_FOCAL;
  out[0] = scale * (dir3d[0] * f + point3d[0] * dF);
  out[1] = -scale * (dir3d[1] * f + point3d[1] * dF);
  return out;
}

/* The largest font size (in face-local units) whose ink box still fits
   inside the face at this placement. The face is convex, so for each edge
   plane n·x <= d the box of half-extents (hw, hh) centred at `pos` and
   oriented along the numeral's own axes fits while
     n·pos + f*(|n·X|*hw + |n·Y|*hh) <= d,
   and the binding edge gives the answer outright — no search, and no
   per-die-type size fudging: a wide "20" on a narrow triangle simply hits
   its edge sooner than a "7" does. Solved once per placement and cached,
   since none of it changes as the die moves. */
function resolveNumeralSize(ctx, face, placement) {
  if (placement._fontLocal !== undefined && placement._fontGen === numeralMetricsGeneration) {
    return placement._fontLocal;
  }
  const m = numeralMetrics(ctx, placement.label);
  const hw = m.width / 2;
  const hh = (m.ascent + m.descent) / 2;
  const ux = placement.up[0], uy = placement.up[1];
  const [px, py] = placement.pos;

  let best = Infinity;
  for (let i = 0; i < face.edges.length; i++) {
    const [nx, ny, d] = face.edges[i];
    const room = d - (nx * px + ny * py);
    if (room <= 0) { best = 0; break; }
    /* X reads rightwards (up rotated -90°), Y is the up axis itself. */
    const reach = Math.abs(nx * uy - ny * ux) * hw + Math.abs(nx * ux + ny * uy) * hh;
    if (reach > 1e-9) best = Math.min(best, room / reach);
  }
  if (!isFinite(best)) best = 0;

  placement._fontLocal = best * (placement.fit || 1) * NUMERAL_FILL;
  placement._capLocal = placement._fontLocal * m.ascent;
  placement._baselineRatio = (m.ascent - m.descent) / 2;
  placement._fontGen = numeralMetricsGeneration;
  return placement._fontLocal;
}

const numeralOrigin3d = [0, 0, 0];
const numeralAxisX3d = [0, 0, 0];
const numeralAxisY3d = [0, 0, 0];
const numeralScreenX = [0, 0];
const numeralScreenY = [0, 0];
const numeralLight3d = [0, 0, 0];
const numeralLightScreen = [0, 0];

function drawFaceNumeral(ctx, die, face, rotCentroid, cx, cy, scale, dieOpacity, colors) {
  const placements = face.numerals;
  if (!placements || placements.length === 0) return;

  const projected = face._projVerts;

  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < projected.length; i++) {
    if (i === 0) ctx.moveTo(projected[i][0], projected[i][1]);
    else ctx.lineTo(projected[i][0], projected[i][1]);
  }
  ctx.closePath();
  ctx.clip();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';

  for (let i = 0; i < placements.length; i++) {
    drawNumeralPlacement(ctx, placements[i], face, rotCentroid, cx, cy, scale, dieOpacity, colors);
  }

  ctx.restore();
  ctx.globalAlpha = 1;
}

function drawNumeralPlacement(ctx, placement, face, rotCentroid, cx, cy, scale, dieOpacity, colors) {
  const axisU = face._rotAxisU, axisV = face._rotAxisV;
  const px = placement.pos[0], py = placement.pos[1];
  const ux = placement.up[0], uy = placement.up[1];

  /* Numeral origin in 3D, plus the numeral's own in-plane axes: X reads
     rightwards and Y downwards (matching canvas' y-down text space), both
     expressed through the face's rotated plane axes. */
  for (let k = 0; k < 3; k++) {
    numeralOrigin3d[k] = rotCentroid[k] + px * axisU[k] + py * axisV[k];
    numeralAxisX3d[k] = uy * axisU[k] - ux * axisV[k];
    numeralAxisY3d[k] = -(ux * axisU[k] + uy * axisV[k]);
  }

  const origin = projectPoint(numeralOrigin3d, cx, cy, scale);
  projectDerivativeInto(numeralScreenX, numeralOrigin3d, numeralAxisX3d, scale);
  projectDerivativeInto(numeralScreenY, numeralOrigin3d, numeralAxisY3d, scale);

  const lenX = Math.hypot(numeralScreenX[0], numeralScreenX[1]);
  const lenY = Math.hypot(numeralScreenY[0], numeralScreenY[1]);
  const unit = Math.max(lenX, lenY);
  if (unit < 0.0001) return;

  const fontLocal = resolveNumeralSize(ctx, face, placement);
  if (fontLocal <= 0) return;

  /* Fade by how tall the numeral actually lands on screen. A face turned
     almost edge-on squashes its numeral to a sliver, exactly as a real die
     does; we only step in once that sliver stops being legible. */
  const screenCap = placement._capLocal * lenY;
  const fadeT = screenCap <= NUMERAL_FADE_LOW ? 0
    : screenCap >= NUMERAL_FADE_HIGH ? 1
    : (screenCap - NUMERAL_FADE_LOW) / (NUMERAL_FADE_HIGH - NUMERAL_FADE_LOW);
  const opacity = fadeT * dieOpacity;
  if (opacity <= 0.01) return;

  /* Rasterise the glyph at roughly its true on-screen size and leave only
     the remaining distortion (mostly foreshortening) to the transform, so
     the text rasteriser always works at a sane font size. */
  const fontPx = fontLocal * unit;
  if (fontPx < 0.5) return;
  ctx.font = NUMERAL_FONT_WEIGHT + ' ' + fontPx + 'px ' + NUMERAL_FONT_STACK;

  const a = numeralScreenX[0] / unit, b = numeralScreenX[1] / unit;
  const c = numeralScreenY[0] / unit, d = numeralScreenY[1] / unit;
  const baselineY = placement._baselineRatio * fontPx;

  /* Where the walls of the recess face, for this face's orientation: the
     key light flattened into the face plane, then carried to the screen
     through the same basis as the glyph itself. A face turned square-on to
     the lamp has almost no in-plane component, and its numeral correctly
     shows almost no wall shading at all. */
  const normal = face._rotNormal;
  const lightAlongNormal = normal[0] * LIGHT_DIR[0] + normal[1] * LIGHT_DIR[1] + normal[2] * LIGHT_DIR[2];
  for (let k = 0; k < 3; k++) {
    numeralLight3d[k] = LIGHT_DIR[k] - lightAlongNormal * normal[k];
  }
  const inPlaneLight = Math.hypot(numeralLight3d[0], numeralLight3d[1], numeralLight3d[2]);
  projectDerivativeInto(numeralLightScreen, numeralOrigin3d, numeralLight3d, scale);
  const lightScreenLen = Math.hypot(numeralLightScreen[0], numeralLightScreen[1]);
  const bevel = Math.max(0.3, screenCap * NUMERAL_BEVEL) * (0.35 + 0.65 * inPlaneLight);
  const bevelX = lightScreenLen > 1e-6 ? (numeralLightScreen[0] / lightScreenLen) * bevel : 0;
  const bevelY = lightScreenLen > 1e-6 ? (numeralLightScreen[1] / lightScreenLen) * bevel : 0;

  /* The near wall falls into shadow, the far wall catches the light, and
     the ink — shaded like the face it is cut into — sits on top. The
     transform is applied with ctx.transform (not setTransform) so it
     composes with the canvas' device-pixel-ratio scale. */
  const shade = faceShade(normal);
  const sheen = faceSheen(normal);
  paintNumeral(ctx, placement.label, a, b, c, d, origin[0] + bevelX, origin[1] + bevelY, baselineY,
    '#000000', opacity * NUMERAL_BEVEL_SHADOW_ALPHA);
  paintNumeral(ctx, placement.label, a, b, c, d, origin[0] - bevelX, origin[1] - bevelY, baselineY,
    '#ffffff', opacity * NUMERAL_BEVEL_LIGHT_ALPHA * shade);
  paintNumeral(ctx, placement.label, a, b, c, d, origin[0], origin[1], baselineY,
    shadeColor(colors.numeral, shade, sheen), opacity);

  ctx.globalAlpha = 1;
}

function paintNumeral(ctx, label, a, b, c, d, e, f, baselineY, fillStyle, alpha) {
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.transform(a, b, c, d, e, f);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fillStyle;
  ctx.fillText(label, 0, baselineY);
  ctx.restore();
}
