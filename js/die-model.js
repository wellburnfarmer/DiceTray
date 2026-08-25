/* die-model.js — builds a fresh runtime die object from DICE_GEOMETRY
   (dice-geometry.js): face labels, D4's per-vertex labelling scheme, and
   the derived per-face "up" vector used to keep numerals upright. */

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

    return {
      label: sides === 2 ? (idx < 2 ? labels[idx] : '') : labels[idx % labels.length],
      d4VertexLabels: sides === 4 ? D4_VERTEX_LABELS[idx] : null,
      normal,
      up,
      upLocal2d,
      local2d: face.local2d,
      centroid,
      verts3d,
      _rotNormal: [0, 0, 0],
      _rotCentroid: [0, 0, 0],
      _rotUp: [0, 0, 0],
      _rotVerts: verts3d.map(() => [0, 0, 0]),
      _projVerts: verts3d.map(() => [0, 0]),
    };
  });

  const faceByLabel = {};
  faces.forEach((f) => { faceByLabel[f.label] = f; });

  return { sides, faces, faceByLabel, value: null, settled: false, rolledLabel: null, currentQuat: [0, 0, 0, 1], drawOpacity: 1, colorScheme: 'cream' };
}
