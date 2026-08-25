/* math.js — general-purpose helpers with no DiceTray-specific state:
   cryptographically secure die rolls, and the rotation-matrix/quaternion
   maths used to orient and animate dice in 3D. Depends on nothing. */

/* =========================================================================
   RANDOMNESS
   ========================================================================= */
function rollDie(sides) {
  const max = 256 - (256 % sides);
  const buf = new Uint8Array(1);
  let x;
  do { crypto.getRandomValues(buf); x = buf[0]; } while (x >= max);
  return (x % sides) + 1;
}
function rollFloat(min, max) {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return min + (buf[0] / (0xffffffff + 1)) * (max - min);
}

/* =========================================================================
   ROTATION HELPERS
   ========================================================================= */
function axisAngleMatrix(axis, angleDeg) {
  const m = new DOMMatrix();
  m.rotateAxisAngleSelf(axis[0], axis[1], axis[2], angleDeg);
  return m;
}

function rotationToAlign(fromVec, toVec) {
  const dot = fromVec[0]*toVec[0] + fromVec[1]*toVec[1] + fromVec[2]*toVec[2];
  if (dot > 0.99999) return new DOMMatrix();
  if (dot < -0.99999) {
    let axis = Math.abs(fromVec[0]) < 0.9 ? [1,0,0] : [0,1,0];
    const cross = [
      fromVec[1]*axis[2] - fromVec[2]*axis[1],
      fromVec[2]*axis[0] - fromVec[0]*axis[2],
      fromVec[0]*axis[1] - fromVec[1]*axis[0],
    ];
    const len = Math.hypot(...cross) || 1;
    return axisAngleMatrix(cross.map(c => c/len), 180);
  }
  const cross = [
    fromVec[1]*toVec[2] - fromVec[2]*toVec[1],
    fromVec[2]*toVec[0] - fromVec[0]*toVec[2],
    fromVec[0]*toVec[1] - fromVec[1]*toVec[0],
  ];
  const len = Math.hypot(...cross);
  const angleRad = Math.atan2(len, dot);
  const axis = len > 1e-6 ? cross.map(c => c/len) : [1,0,0];
  return axisAngleMatrix(axis, angleRad * 180 / Math.PI);
}

function applyMatrixToVectorInto(out, m, v) {
  const x = v[0], y = v[1], z = v[2];
  out[0] = m[0] * x + m[3] * y + m[6] * z;
  out[1] = m[1] * x + m[4] * y + m[7] * z;
  out[2] = m[2] * x + m[5] * y + m[8] * z;
  return out;
}

function applyMatrixToVector(m, v) {
  if (Array.isArray(m)) {
    return [
      m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
      m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
      m[2] * v[0] + m[5] * v[1] + m[8] * v[2],
    ];
  }
  return [
    m.m11 * v[0] + m.m21 * v[1] + m.m31 * v[2],
    m.m12 * v[0] + m.m22 * v[1] + m.m32 * v[2],
    m.m13 * v[0] + m.m23 * v[1] + m.m33 * v[2],
  ];
}

function rotationAroundAxis(axis, fromVec, toVec) {
  const crossFT = [
    fromVec[1]*toVec[2] - fromVec[2]*toVec[1],
    fromVec[2]*toVec[0] - fromVec[0]*toVec[2],
    fromVec[0]*toVec[1] - fromVec[1]*toVec[0],
  ];
  const sinComp = crossFT[0]*axis[0] + crossFT[1]*axis[1] + crossFT[2]*axis[2];
  const cosComp = fromVec[0]*toVec[0] + fromVec[1]*toVec[1] + fromVec[2]*toVec[2];
  const angle = Math.atan2(sinComp, cosComp);
  return axisAngleMatrix(axis, angle * 180 / Math.PI);
}

/* =========================================================================
   QUATERNION HELPERS
   ========================================================================= */
function matrixToQuaternion(m) {
  const m00=m.m11, m10=m.m12, m20=m.m13;
  const m01=m.m21, m11=m.m22, m21=m.m23;
  const m02=m.m31, m12=m.m32, m22=m.m33;
  const trace = m00+m11+m22;
  let qw,qx,qy,qz;
  if (trace > 0) {
    const s = 0.5/Math.sqrt(trace+1);
    qw = 0.25/s; qx = (m21-m12)*s; qy = (m02-m20)*s; qz = (m10-m01)*s;
  } else if (m00 > m11 && m00 > m22) {
    const s = 2*Math.sqrt(1+m00-m11-m22);
    qw = (m21-m12)/s; qx = 0.25*s; qy = (m01+m10)/s; qz = (m02+m20)/s;
  } else if (m11 > m22) {
    const s = 2*Math.sqrt(1+m11-m00-m22);
    qw = (m02-m20)/s; qx = (m01+m10)/s; qy = 0.25*s; qz = (m12+m21)/s;
  } else {
    const s = 2*Math.sqrt(1+m22-m00-m11);
    qw = (m10-m01)/s; qx = (m02+m20)/s; qy = (m12+m21)/s; qz = 0.25*s;
  }
  return [qx,qy,qz,qw];
}

function quatToMatrix(q) {
  const [x,y,z,w] = q;
  const xx=x*x, yy=y*y, zz=z*z, xy=x*y, xz=x*z, yz=y*z, wx=w*x, wy=w*y, wz=w*z;
  return [
    1-2*(yy+zz), 2*(xy+wz),   2*(xz-wy),
    2*(xy-wz),   1-2*(xx+zz), 2*(yz+wx),
    2*(xz+wy),   2*(yz-wx),   1-2*(xx+yy),
  ];
}

function quatFromAxisAngle(axis, angleDeg) {
  const rad = angleDeg * Math.PI / 180;
  const s = Math.sin(rad / 2);
  return [axis[0]*s, axis[1]*s, axis[2]*s, Math.cos(rad / 2)];
}

function quatMultiply(a, b) {
  const [ax,ay,az,aw] = a, [bx,by,bz,bw] = b;
  return [
    aw*bx + ax*bw + ay*bz - az*by,
    aw*by - ax*bz + ay*bw + az*bx,
    aw*bz + ax*by - ay*bx + az*bw,
    aw*bw - ax*bx - ay*by - az*bz,
  ];
}

function quatSlerp(a, b, t) {
  let [ax,ay,az,aw] = a, [bx,by,bz,bw] = b;
  let dot = ax*bx + ay*by + az*bz + aw*bw;
  if (dot < 0) { bx=-bx; by=-by; bz=-bz; bw=-bw; dot=-dot; }
  if (dot > 0.9995) {
    const x=ax+(bx-ax)*t, y=ay+(by-ay)*t, z=az+(bz-az)*t, w=aw+(bw-aw)*t;
    const len = Math.hypot(x,y,z,w) || 1;
    return [x/len, y/len, z/len, w/len];
  }
  const theta0 = Math.acos(dot);
  const theta = theta0 * t;
  const sinTheta0 = Math.sin(theta0);
  const s0 = Math.cos(theta) - dot * Math.sin(theta) / sinTheta0;
  const s1 = Math.sin(theta) / sinTheta0;
  return [ax*s0+bx*s1, ay*s0+by*s1, az*s0+bz*s1, aw*s0+bw*s1];
}
