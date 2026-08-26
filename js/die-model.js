/* die-model.js — builds a fresh runtime die object from DICE_GEOMETRY
   (dice-geometry.js): face labels, D4's per-vertex labelling scheme, the
   derived per-face "up" vector used to keep numerals upright, and the
   per-face numeral *placements* (position, up direction and size, all in
   the face's own 2D plane) that render.js projects onto the screen. */

/* =========================================================================
   LABELS
   ========================================================================= */
function faceLabels(sides, isPercentileUnit) {
  if (sides === 2) return ['1', '2'];
  if (sides === 4) return ['1', '2', '3', '4'];
  if (sides === 6) return ['1', '2', '3', '4', '5', '6'];
  if (sides === 8) return ['1', '2', '3', '4', '5', '6', '7', '8'];
  if (sides === 10) return isPercentileUnit
    ? ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0']
    : ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
  if (sides === 12) return ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'];
  if (sides === 20) return Array.from({ length: 20 }, (_, i) => String(i + 1));
  if (sides === 100) return ['00', '10', '20', '30', '40', '50', '60', '70', '80', '90'];
  return [];
}

/* =========================================================================
   D4 VERTEX LABELS
   ========================================================================= */
const D4_VERTEX_LABELS = (function() {
  const d4Faces = DICE_GEOMETRY['4'].faces;
  const d4Labels = ['1','2','3','4'];
  const allVerts = [0,1,2,3];
  const vertOppLabel = {};
  allVerts.forEach(v => {
    const oppIdx = d4Faces.findIndex(f => !f.vertexIndices.includes(v));
    vertOppLabel[v] = d4Labels[oppIdx];
  });
  return d4Faces.map(face =>
    face.vertexIndices.map(v => vertOppLabel[v])
  );
})();

/* =========================================================================
   NUMERAL PLACEMENTS
   Everything about where a numeral sits is decided once, here, in the
   face's own 2D coordinate system (the same space as `local2d`, origin at
   the face centroid). render.js never re-derives position, orientation or
   size from screen-space geometry, so a numeral stays painted on its face
   at a fixed size and angle no matter how the die tumbles.
     pos:  centre of the numeral's ink box, in face-local units
     up:   unit vector the numeral reads "up" towards, in face-local units
     fit:  how much of the room available at `pos` the numeral fills
   The size itself is not stored: render.js solves it against `edges` once
   the font's real glyph metrics are known (see resolveNumeralSize), which
   is what lets a triangular D20 face, a square D6 face and a two-digit
   label all end up correctly proportioned without per-die fudge factors.
   ========================================================================= */

/* Outward unit normal and offset for each edge of a (convex) face, in
   face-local coordinates: the face's interior is every point x with
   n·x <= d for all edges. Used to fit numerals inside the face. */
function faceEdgePlanes(local2d) {
  const n = local2d.length;
  const planes = [];
  for (let i = 0; i < n; i++) {
    const [ax, ay] = local2d[i];
    const [bx, by] = local2d[(i + 1) % n];
    const ex = bx - ax, ey = by - ay;
    const len = Math.hypot(ex, ey);
    if (len < 1e-9) continue;
    let nx = ey / len, ny = -ex / len;
    if (nx * ax + ny * ay < 0) { nx = -nx; ny = -ny; }
    planes.push([nx, ny, nx * ax + ny * ay]);
  }
  return planes;
}

/* The D4 reads from three numerals crowded towards its corners. */
const D4_CORNER_OFFSET = 0.46;
const D4_CORNER_FIT = 0.85;

/* How boldly each die type cuts its numerals, as a share of the room the
   face geometry actually leaves (see resolveNumeralSize in render.js).
   These differ because real dice differ: a D20's numerals crowd their
   little triangle, while a D6's sit well inside its square. */
const NUMERAL_FIT = { 2: 0.72, 4: D4_CORNER_FIT, 6: 0.60, 8: 0.86, 10: 0.74, 12: 0.72, 20: 0.86, 100: 0.74 };

function buildNumeralPlacements(sides, label, d4VertexLabels, local2d, upLocal2d) {
  if (sides === 4 && d4VertexLabels) {
    return local2d.map(([vx, vy], i) => {
      const len = Math.hypot(vx, vy) || 1;
      return {
        label: d4VertexLabels[i] || '',
        pos: [vx * D4_CORNER_OFFSET, vy * D4_CORNER_OFFSET],
        up: [vx / len, vy / len],
        fit: NUMERAL_FIT[4],
      };
    }).filter((p) => p.label !== '');
  }
  if (!label) return [];
  return [{ label, pos: [0, 0], up: [upLocal2d[0], upLocal2d[1]], fit: NUMERAL_FIT[sides] || 0.7 }];
}

function buildDieModel(sides, isPercentileUnit) {
  const geomKey = String(sides);
  const geom = DICE_GEOMETRY[geomKey];
  const labels = faceLabels(sides, isPercentileUnit);

  const faces = geom.faces.map((face, idx) => {
    const r = face.rotation;
    const u = [r[0][0], r[1][0], r[2][0]];
    const rawUp = [r[0][1], r[1][1], r[2][1]];
    const normal = face.normal;
    const centroid = face.centroid;

    const verts3d = face.local2d.map(([lx, ly]) => [
      centroid[0] + lx * u[0] + ly * rawUp[0],
      centroid[1] + lx * u[1] + ly * rawUp[1],
      centroid[2] + lx * u[2] + ly * rawUp[2],
    ]);

    let up = rawUp;
    let upLocal2d = [0, 1];
    if (sides !== 2 && face.local2d.length >= 3) {
      let bestDot = -2, bestUp = rawUp, bestLocal = [0, 1];
      const nv = face.local2d.length;
      for (let i = 0; i < nv; i++) {
        const [ax, ay] = face.local2d[i];
        const [bx, by] = face.local2d[(i + 1) % nv];
        const elx = bx - ax, ely = by - ay;
        const el = Math.hypot(elx, ely) || 1;
        for (const [px, py] of [[-ely / el, elx / el], [ely / el, -elx / el]]) {
          const p3 = [
            px * u[0] + py * rawUp[0],
            px * u[1] + py * rawUp[1],
            px * u[2] + py * rawUp[2],
          ];
          const d = p3[0] * rawUp[0] + p3[1] * rawUp[1] + p3[2] * rawUp[2];
          if (d > bestDot) { bestDot = d; bestUp = p3; bestLocal = [px, py]; }
        }
      }
      up = bestUp;
      upLocal2d = bestLocal;
    }

    const label = sides === 2 ? (idx < 2 ? labels[idx] : '') : labels[idx % labels.length];
    const d4VertexLabels = sides === 4 ? D4_VERTEX_LABELS[idx] : null;

    return {
      label,
      d4VertexLabels,
      normal,
      up,
      upLocal2d,
      local2d: face.local2d,
      centroid,
      verts3d,
      /* The face plane's own 2D axes, as 3D vectors: a local2d point
         (lx, ly) is centroid + lx*axisU + ly*axisV. render.js rotates just
         these two per frame and derives every numeral's on-screen basis
         from them, so numerals are genuinely painted into the face plane
         rather than pasted on top of it. */
      axisU: u,
      axisV: rawUp,
      edges: faceEdgePlanes(face.local2d),
      numerals: buildNumeralPlacements(sides, label, d4VertexLabels, face.local2d, upLocal2d),
      _rotNormal: [0, 0, 0],
      _rotCentroid: [0, 0, 0],
      _rotAxisU: [0, 0, 0],
      _rotAxisV: [0, 0, 0],
      _rotVerts: verts3d.map(() => [0, 0, 0]),
      _projVerts: verts3d.map(() => [0, 0]),
    };
  });

  const faceByLabel = {};
  faces.forEach((f) => { faceByLabel[f.label] = f; });

  return { sides, faces, faceByLabel, value: null, settled: false, rolledLabel: null, currentQuat: [0, 0, 0, 1], drawOpacity: 1, colorRole: 'primary' };
}
