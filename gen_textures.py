#!/usr/bin/env python3
"""
gen_textures.py — Generate DiceTray texture images as static PNG files.

Run once from the same directory as index.html:
    python gen_textures.py

Outputs (into ./textures/ by default, configurable via OUTPUT_DIR):
    textures/tray_<theme>.png      — 768×768 tray surface overlays (RGBA)
    textures/bg_<theme>.jpg        — 1920×1080 background images (RGB, JPEG)

Themes: green-felt, midnight-velvet, parchment,
        slate-stone, deep-ocean, ember-forge, ivory-marble
"""

import math
import os
import random

import numpy as np
from PIL import Image

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
OUTPUT_DIR = "textures"
TRAY_W, TRAY_H = 768, 768          # tray texture size (PNG, RGBA)
BG_W,   BG_H   = 1920, 1080        # background size  (JPEG, RGB)
JPEG_QUALITY    = 90

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ---------------------------------------------------------------------------
# Shared maths helpers (match JS exactly)
# ---------------------------------------------------------------------------

def hex_to_rgb(h: str) -> tuple[float, float, float]:
    h = h.lstrip('#')
    if len(h) == 3:
        h = ''.join(c*2 for c in h)
    return tuple(int(h[i:i+2], 16) for i in (0, 2, 4))


def _hash2(x: float, y: float) -> float:
    n = math.sin(x * 127.1 + y * 311.7) * 43758.5453
    return n - math.floor(n)


def _value_noise(x: float, y: float) -> float:
    ix, iy = math.floor(x), math.floor(y)
    fx, fy = x - ix, y - iy
    ux = fx * fx * (3 - 2 * fx)
    uy = fy * fy * (3 - 2 * fy)
    return (
        _hash2(ix,   iy)   * (1-ux) * (1-uy) +
        _hash2(ix+1, iy)   * ux     * (1-uy) +
        _hash2(ix,   iy+1) * (1-ux) * uy     +
        _hash2(ix+1, iy+1) * ux     * uy
    )


def _fbm(x: float, y: float, oct: int) -> float:
    v, a, f, t = 0.0, 1.0, 1.0, 0.0
    for _ in range(oct):
        v += _value_noise(x * f, y * f) * a
        t += a
        a *= 0.5
        f *= 2.1
    return v / t


# Vectorised versions operating on numpy arrays (xs, ys are 2-D float arrays)
def _vn_arr(xs: np.ndarray, ys: np.ndarray) -> np.ndarray:
    ix, iy = np.floor(xs).astype(np.int64), np.floor(ys).astype(np.int64)
    fx, fy = xs - ix.astype(float), ys - iy.astype(float)
    ux = fx * fx * (3 - 2 * fx)
    uy = fy * fy * (3 - 2 * fy)
    def h(a, b):
        n = np.sin(a * 127.1 + b * 311.7) * 43758.5453
        return n - np.floor(n)
    return (
        h(ix,   iy)   * (1-ux) * (1-uy) +
        h(ix+1, iy)   * ux     * (1-uy) +
        h(ix,   iy+1) * (1-ux) * uy     +
        h(ix+1, iy+1) * ux     * uy
    )


def fbm_arr(xs: np.ndarray, ys: np.ndarray, oct: int) -> np.ndarray:
    v = np.zeros_like(xs, dtype=float)
    t = 0.0
    a, f = 1.0, 1.0
    for _ in range(oct):
        v += _vn_arr(xs * f, ys * f) * a
        t += a
        a *= 0.5
        f *= 2.1
    return v / t


def make_coords(w: int, h: int):
    ys_1d = np.arange(h, dtype=float)
    xs_1d = np.arange(w, dtype=float)
    xs, ys = np.meshgrid(xs_1d, ys_1d)   # shape (h, w)
    return xs, ys


def clamp_u8(a: np.ndarray) -> np.ndarray:
    return np.clip(a, 0, 255).astype(np.uint8)


def save_png(arr: np.ndarray, name: str):
    """arr shape: (H, W, 4) uint8 RGBA"""
    img = Image.fromarray(arr, 'RGBA')
    path = os.path.join(OUTPUT_DIR, name)
    img.save(path, 'PNG')
    print(f"  saved {path}")


def save_jpg(arr: np.ndarray, name: str):
    """arr shape: (H, W, 3) uint8 RGB"""
    img = Image.fromarray(arr, 'RGB')
    path = os.path.join(OUTPUT_DIR, name)
    img.save(path, 'JPEG', quality=JPEG_QUALITY, optimize=True)
    print(f"  saved {path}")


# ---------------------------------------------------------------------------
# TRAY TEXTURES  (768×768, RGBA, transparent background)
# ---------------------------------------------------------------------------

def gen_felt_texture(light_hex: str, w=768, h=768) -> np.ndarray:
    """Green felt — multi-angle fibre fuzz (RGBA)."""
    lr, lg, lb = hex_to_rgb(light_hex)
    xs, ys = make_coords(w, h)

    density = fbm_arr(xs * 0.06, ys * 0.06, 4)

    a1, a2, a3 = math.pi * 0.15, math.pi * 0.55, math.pi * 0.82

    def rotated_fbm(angle, freq_u, freq_v, oct):
        c, s = math.cos(angle), math.sin(angle)
        rx = xs * c + ys * s
        ry = -xs * s + ys * c
        return fbm_arr(rx * freq_u, ry * freq_v, oct)

    dir1 = rotated_fbm(a1, 0.5, 0.12, 3)
    dir2 = rotated_fbm(a2, 0.5, 0.12, 3)
    dir3 = rotated_fbm(a3, 0.5, 0.12, 3)
    fuzz = (dir1 * 0.4 + dir2 * 0.35 + dir3 * 0.25) * density

    sheen = np.power(fbm_arr(xs * 1.8, ys * 1.8, 2), 6) * 0.5
    zone  = fbm_arr(xs * 0.008, ys * 0.008, 3) * 0.25 + 0.85
    bright = (fuzz * 0.75 + sheen) * zone

    above = bright - 0.5
    r_arr = np.where(above > 0, lr + (255-lr)*above*0.35, 0.0)
    g_arr = np.where(above > 0, lg + (255-lg)*above*0.35, 0.0)
    b_arr = np.where(above > 0, lb + (255-lb)*above*0.35, 0.0)
    a_arr = np.where(above > 0, above * 200, -above * 120)

    out = np.stack([r_arr, g_arr, b_arr, a_arr], axis=-1)
    return clamp_u8(out)


def gen_marble_texture(vein1_hex: str, vein2_hex: str, w=768, h=768) -> np.ndarray:
    """Ivory marble — pixel-level vein marbling (RGBA)."""
    v1r, v1g, v1b = hex_to_rgb(vein1_hex)
    v2r, v2g, v2b = hex_to_rgb(vein2_hex)
    xs, ys = make_coords(w, h)

    def fbm_marble(x2d, y2d):
        v = np.zeros_like(x2d, dtype=float)
        amp, freq = 1.0, 1.0
        for _ in range(5):
            v += np.sin((x2d*freq*0.012 + y2d*freq*0.008) + amp) * amp
            v += np.cos((y2d*freq*0.014 - x2d*freq*0.006) + amp*1.3) * amp * 0.5
            amp *= 0.55; freq *= 2.1
        return v

    n = fbm_marble(xs, ys)
    m = np.abs(np.sin(xs*0.025 + ys*0.01 + n))
    v = np.abs(np.sin(xs*0.008 - ys*0.02 + n*1.5))
    t1 = np.power(np.maximum(0, 1 - m*3.5), 2)
    t2 = np.power(np.maximum(0, 1 - v*5.0), 3)
    alpha = np.minimum(255, (t1*0.7 + t2*0.5) * 255)
    r_arr = np.minimum(255, np.maximum(0, v1r*t1 + v2r*t2))
    g_arr = np.minimum(255, np.maximum(0, v1g*t1 + v2g*t2))
    b_arr = np.minimum(255, np.maximum(0, v1b*t1 + v2b*t2))
    return clamp_u8(np.stack([r_arr, g_arr, b_arr, alpha], axis=-1))


def gen_velvet_texture(sheen_hex: str, w=768, h=768) -> np.ndarray:
    """Midnight-velvet — anisotropic microfibre with sheen falloff (RGBA)."""
    sr, sg, sb = hex_to_rgb(sheen_hex)
    xs, ys = make_coords(w, h)

    nap_base = fbm_arr(xs*0.008, ys*0.008, 3)
    nap_angle = (nap_base - 0.5) * math.pi * 0.6 + math.pi * 0.25
    grain = fbm_arr(xs*0.4, ys*0.4, 4)
    fibre_wiggle = (grain - 0.5) * 0.3
    perp_angle = nap_angle + math.pi*0.5 + fibre_wiggle
    lx, ly = 0.577, -0.577
    dot_l = lx * np.cos(perp_angle) + ly * np.sin(perp_angle)
    sheen = np.power(np.maximum(0, dot_l*0.5 + 0.5), 2.5)
    nap_dx = np.cos(nap_angle)
    nap_dy = np.sin(nap_angle)
    shadow = fbm_arr(xs*0.25 + nap_dx*0.5, ys*0.25 + nap_dy*0.5, 3)
    self_shadow = np.power(shadow, 0.7) * 0.5 + 0.5
    zone = fbm_arr(xs*0.004, ys*0.004, 2) * 0.4 + 0.8
    brightness = sheen*0.7 + self_shadow*0.3
    final = brightness * zone
    alpha = np.minimum(255, final * 180)
    r_arr = np.minimum(255, sr * final * 1.2)
    g_arr = np.minimum(255, sg * final * 1.2)
    b_arr = np.minimum(255, sb * final * 1.2)
    return clamp_u8(np.stack([r_arr, g_arr, b_arr, alpha], axis=-1))


def gen_slate_texture(mid_hex: str, light_hex: str, w=768, h=768) -> np.ndarray:
    """Slate-stone — diagonal shear planes + mineral veins (RGBA)."""
    mr, mg, mb = hex_to_rgb(mid_hex)
    lr2, lg2, lb2 = hex_to_rgb(light_hex)
    xs, ys = make_coords(w, h)

    cos_a = math.cos(math.pi * 0.72)
    sin_a = math.sin(math.pi * 0.72)
    lx2, ly2, lz2 = 0.5, -0.7, 0.51

    su = xs*cos_a + ys*sin_a
    sv = -xs*sin_a + ys*cos_a

    warp   = fbm_arr(su*0.003, sv*0.003, 3) * 60
    band1  = fbm_arr((sv+warp)*0.012, su*0.002, 4)
    band2  = fbm_arr((sv+warp*0.6)*0.007 + 10.3, su*0.001 + 5.1, 4)
    band_v = band1*0.6 + band2*0.4
    grain  = fbm_arr(xs*0.22, ys*0.22, 4)

    vein_warp  = fbm_arr(su*0.008 + 2.1, sv*0.008, 3) * 40
    vein_phase = (sv + vein_warp) * 0.028
    vein1 = np.power(np.maximum(0, np.sin(vein_phase*1.0 + 0.3)), 8)
    vein2 = np.power(np.maximum(0, np.sin(vein_phase*2.3 + 1.7)), 12)
    vein3 = np.power(np.maximum(0, np.sin(vein_phase*0.5 + 4.1)), 6) * 0.5
    vein_mod = fbm_arr(su*0.006, sv*0.002+20, 3) * 0.7 + 0.3
    vein = (vein1*0.5 + vein2*0.35 + vein3*0.15) * vein_mod

    eps = 1.5
    bx = fbm_arr((sv+warp+eps)*0.012, su*0.002, 4) - fbm_arr((sv+warp-eps)*0.012, su*0.002, 4)
    by = fbm_arr((sv+warp)*0.012, (su+eps)*0.002, 4) - fbm_arr((sv+warp)*0.012, (su-eps)*0.002, 4)
    nlen = np.sqrt(bx*bx + by*by + 0.08)
    nx = -bx/nlen*1.5; ny = by/nlen*1.5; nz = 0.28/nlen
    diffuse = np.maximum(0.15, nx*lx2 + ny*ly2 + nz*lz2)
    spec    = np.power(np.maximum(0, diffuse), 22) * 0.4
    shadow  = np.power(1 - band_v, 2.5) * 0.35

    t      = band_v*0.6 + grain*0.25 + vein*0.15
    base_r = mr + (lr2-mr) * t
    base_g = mg + (lg2-mg) * t
    base_b = mb + (lb2-mb) * t
    lit    = diffuse * (1 - shadow)

    vein_r = np.minimum(255, base_r*(1-vein*0.7) + 230*vein*0.7 + spec*180)
    vein_g = np.minimum(255, base_g*(1-vein*0.7) + 228*vein*0.7 + spec*185)
    vein_b = np.minimum(255, base_b*(1-vein*0.7) + 235*vein*0.7 + spec*200)

    ir = np.minimum(255, np.maximum(0, vein_r * lit))
    ig = np.minimum(255, np.maximum(0, vein_g * lit))
    ib = np.minimum(255, np.maximum(0, vein_b * lit))
    alpha = np.minimum(255, (t*0.7 + vein*0.5 + grain*0.2) * 255)
    return clamp_u8(np.stack([ir, ig, ib, alpha], axis=-1))


def gen_parchment_texture(dark_hex: str, w=768, h=768) -> np.ndarray:
    """Parchment — smooth aged paper with fibre flow (RGBA)."""
    dr, dg, db = hex_to_rgb(dark_hex)
    xs, ys = make_coords(w, h)

    tone = fbm_arr(xs*0.005, ys*0.005, 3)
    flow_warp = fbm_arr(xs*0.015, ys*0.015, 3) * 30
    fibre_u = xs*0.7 + flow_warp
    fibre_v = ys*0.08
    fibre = fbm_arr(fibre_u*0.04, fibre_v*0.4, 4)
    tooth  = fbm_arr(xs*0.45, ys*0.45, 3) * 0.15
    surface = tone*0.5 + fibre*0.35 + tooth

    ex = (xs/w - 0.5)*2
    ey = (ys/h - 0.5)*2
    edge_dist = np.maximum(0, ex*ex + ey*ey - 0.2)
    vignette = edge_dist * 0.35
    bright = surface - vignette

    above = bright - 0.5
    alpha = np.minimum(255, np.abs(above) * 180)
    pos = above > 0
    r_arr = np.where(pos, 255.0, float(dr))
    g_arr = np.where(pos, 245.0, float(dg))
    b_arr = np.where(pos, 220.0, float(db))
    return clamp_u8(np.stack([r_arr, g_arr, b_arr, alpha], axis=-1))


def gen_ocean_texture(caustic_hex: str, w=768, h=768) -> np.ndarray:
    """Deep-ocean — double-warped caustic light patterns (RGBA)."""
    cr, cg, cb = hex_to_rgb(caustic_hex)
    xs, ys = make_coords(w, h)

    def h2(x2d, y2d):
        n = np.sin(x2d*127.1 + y2d*311.7) * 43758.5453
        return n - np.floor(n)

    wx1 = fbm_arr(xs*0.008,       ys*0.008,       4) * 45
    wy1 = fbm_arr(xs*0.008 + 3.7, ys*0.008 + 5.2, 4) * 45
    wx2 = fbm_arr((xs+wx1)*0.006,       (ys+wy1)*0.006,       3) * 35
    wy2 = fbm_arr((xs+wx1)*0.006 + 8.1, (ys+wy1)*0.006 + 2.4, 3) * 35
    wx = xs + wx1 + wx2
    wy = ys + wy1 + wy2

    c1 = np.sin(wx*0.032 + wy*0.024)*0.5 + 0.5
    c2 = np.sin(wx*0.051 - wy*0.038 + 2.1)*0.5 + 0.5
    c3 = np.sin(-wx*0.027 + wy*0.059 + 4.6)*0.5 + 0.5
    c4 = np.sin(wx*0.019 + wy*0.071 + 1.3)*0.5 + 0.5
    caustic = np.power(c1*c2*c3*c4, 0.55)

    depth   = fbm_arr(xs*0.004, ys*0.006, 3) * 0.35 + 0.65
    scatter = np.power(np.maximum(0, caustic - 0.6), 2) * 4.0

    rng = np.random.default_rng(42)
    spark_seed = rng.random((h, w))
    spark = np.where(spark_seed > 0.994, (spark_seed - 0.994)/0.006*2.0, 0.0)

    total = caustic*depth + scatter*0.5 + spark*0.6
    rr = np.minimum(255, (cr*caustic*0.8 + 200*scatter*0.15 + 255*spark*0.4)*depth)
    rg = np.minimum(255, (cg*caustic*0.8 + 230*scatter*0.35 + 255*spark*0.6)*depth)
    rb = np.minimum(255, (cb*caustic*0.8 + 255*scatter*0.55 + 255*spark)*depth)
    alpha = np.minimum(255, total * 220)
    return clamp_u8(np.stack([rr, rg, rb, alpha], axis=-1))


def gen_forge_texture(glow_hex: str, w=768, h=768) -> np.ndarray:
    """Ember-forge — cracked rock with glowing fissures (RGBA).

    Voronoi cells are placed in normalised UV space [0,1]² so the crack
    width and ambient-glow falloff are resolution-independent.  This
    removes the coarse, pixelated look that appeared when distances were
    measured in raw pixel units.
    """
    gr, gg, gb = hex_to_rgb(glow_hex)
    xs, ys = make_coords(w, h)

    # --- normalised UV coordinates [0,1] ---
    us = xs / w
    vs = ys / h

    # Warp UVs slightly before Voronoi so cracks aren't perfectly straight
    warp_scale = 0.08   # fraction of texture width
    wu = fbm_arr(us*6.0,       vs*6.0,       3) * warp_scale
    wv = fbm_arr(us*6.0 + 3.7, vs*6.0 + 5.2, 3) * warp_scale
    uw = us + wu
    vw = vs + wv

    # Voronoi in UV space: ~120 cells gives fine crack detail
    NC = 120
    rng = np.random.default_rng(99)
    cx_arr = rng.random(NC)          # in [0,1]
    cy_arr = rng.random(NC)
    heat_arr = np.power(rng.random(NC), 2.5)

    px = uw[:, :, np.newaxis]        # (h, w, 1)
    py = vw[:, :, np.newaxis]
    d2 = (px - cx_arr)**2 + (py - cy_arr)**2   # (h, w, NC)

    idx1 = np.argsort(d2, axis=2)[:, :, :2]
    d_sorted = np.take_along_axis(d2, idx1, axis=2)
    d1   = d_sorted[:, :, 0]
    d2_v = d_sorted[:, :, 1]
    c1i  = idx1[:, :, 0]

    edge = np.sqrt(d2_v) - np.sqrt(d1)   # 0 at crack centreline, UV units

    # Crack width ~1.5 % of texture, modulated by FBM
    crack_w = 0.008 + fbm_arr(us*8.0, vs*8.0, 2) * 0.012
    crack_t = np.where(edge < crack_w, 1.0 - (edge / crack_w), 0.0)

    # Rock surface detail — FBM frequencies in UV space
    rg2 = fbm_arr(us*40.0, vs*40.0, 4)
    rs  = fbm_arr(us*12.0, vs*12.0, 3)

    # Normal-map from FBM for specular shading
    eps_uv = 1.0 / w
    dfdx = (fbm_arr((us+eps_uv)*12.0, vs*12.0, 3)
            - fbm_arr((us-eps_uv)*12.0, vs*12.0, 3))
    dfdy = (fbm_arr(us*12.0, (vs+eps_uv)*12.0, 3)
            - fbm_arr(us*12.0, (vs-eps_uv)*12.0, 3))
    nl   = np.sqrt(dfdx*dfdx + dfdy*dfdy + 0.01)
    nx2  = -dfdx / nl
    ny2  = -dfdy / nl
    nz2  =  0.1  / nl
    diff = np.maximum(0, nx2*0.5 + ny2*(-0.6) + nz2*0.62)
    spec = np.power(diff, 12) * rg2

    heat   = heat_arr[c1i]
    glow_i = crack_t * (0.3 + heat*1.4)
    # Ambient glow decays with UV-space edge distance
    amb_g  = np.exp(-edge * (1.0 / 0.025)) * heat * 0.5
    rock_b = (rs*0.4 + rg2*0.3) * (0.3 + diff*0.7)

    rock_r  = 20 + rock_b*35 + spec*60
    rock_g2 = 18 + rock_b*30 + spec*55
    rock_bl = 22 + rock_b*40 + spec*70
    glow_r  = np.minimum(255, gr*1.4*glow_i + amb_g*gr*0.6)
    glow_g2 = np.minimum(255, gg*0.7*glow_i + amb_g*gg*0.3)
    glow_bl = np.minimum(255, gb*0.2*glow_i)

    g_t = np.power(glow_i + amb_g*0.5, 0.7)
    ir = np.minimum(255, np.maximum(0, rock_r*(1-g_t) + glow_r*g_t))
    ig = np.minimum(255, np.maximum(0, rock_g2*(1-g_t) + glow_g2*g_t))
    ib = np.minimum(255, np.maximum(0, rock_bl*(1-g_t) + glow_bl*g_t))
    alpha = np.minimum(255, (rock_b*0.6 + glow_i*1.2 + amb_g*0.8) * 255)
    return clamp_u8(np.stack([ir, ig, ib, alpha], axis=-1))


# ---------------------------------------------------------------------------
# BACKGROUND TEXTURES  (1920×1080, RGB)
# Background images are fully opaque: we composite the texture onto the
# gradient base here in Python, matching what buildBgCanvas does in JS.
# ---------------------------------------------------------------------------

def make_bg_gradient(theme: dict, w: int, h: int) -> np.ndarray:
    """Diagonal linear gradient from felt-1 to felt-2, matching JS."""
    f1r, f1g, f1b = hex_to_rgb(theme['felt-1'])
    f2r, f2g, f2b = hex_to_rgb(theme['felt-2'])
    xs, ys = make_coords(w, h)
    # JS: createLinearGradient(0,0, w*0.7, h) → t = (x/w*0.7 + y/h) / 2 roughly
    # Simplified: t = clamp((x/(w*0.7)*0.5 + y/h*0.5), 0, 1)
    t = np.clip(xs/(w*0.7)*0.5 + ys/h*0.5, 0, 1)
    r = f1r + (f2r - f1r) * t
    g = f1g + (f2g - f1g) * t
    b = f1b + (f2b - f1b) * t
    base = np.stack([r, g, b], axis=-1)

    # Subtle radial highlight from JS (0.04 white at top-centre)
    cx, cy = w * 0.5, 0.0
    dist = np.sqrt((xs - cx)**2 + (ys - cy)**2) / (w * 0.7)
    highlight = np.maximum(0, 0.04 * (1 - dist))[:, :, np.newaxis]
    base = np.clip(base + highlight * 255, 0, 255)
    return base.astype(float)


def composite_rgba_over(base_rgb: np.ndarray, overlay_rgba: np.ndarray, alpha_scale=0.45) -> np.ndarray:
    """Alpha-composite overlay_rgba onto base_rgb at given opacity (matching JS globalAlpha)."""
    alpha = overlay_rgba[:, :, 3:4].astype(float) / 255.0 * alpha_scale
    fg = overlay_rgba[:, :, :3].astype(float)
    result = base_rgb * (1 - alpha) + fg * alpha
    return np.clip(result, 0, 255).astype(np.uint8)


def scale_to(arr: np.ndarray, w: int, h: int) -> np.ndarray:
    """Tile/scale a texture to fill w×h."""
    src_h, src_w = arr.shape[:2]
    img = Image.fromarray(arr if arr.shape[2] == 4 else arr, 'RGBA' if arr.shape[2] == 4 else 'RGB')
    # Tile to cover
    tiles_x = math.ceil(w / src_w)
    tiles_y = math.ceil(h / src_h)
    big = Image.new('RGBA' if arr.shape[2]==4 else 'RGB', (src_w*tiles_x, src_h*tiles_y))
    for ty in range(tiles_y):
        for tx in range(tiles_x):
            big.paste(img, (tx*src_w, ty*src_h))
    return np.array(big.crop((0, 0, w, h)))


def gen_bg_felt(col1_hex: str, col2_hex: str, w: int, h: int) -> np.ndarray:
    """Coarse felt — lower spatial frequency (background scale)."""
    lr, lg, lb = hex_to_rgb(col1_hex)
    xs, ys = make_coords(w, h)

    density = fbm_arr(xs*0.03, ys*0.03, 4)
    a1, a2, a3 = math.pi*0.15, math.pi*0.55, math.pi*0.82

    def rf(angle, fu, fv, oct):
        c, s = math.cos(angle), math.sin(angle)
        rx = xs*c + ys*s; ry = -xs*s + ys*c
        return fbm_arr(rx*fu, ry*fv, oct)

    d1 = rf(a1, 0.25, 0.06, 3)
    d2 = rf(a2, 0.25, 0.06, 3)
    d3 = rf(a3, 0.25, 0.06, 3)
    fuzz  = (d1*0.4 + d2*0.35 + d3*0.25) * density
    sheen = np.power(fbm_arr(xs*0.9, ys*0.9, 2), 6) * 0.4
    zone  = fbm_arr(xs*0.004, ys*0.004, 3) * 0.25 + 0.85
    bright = (fuzz*0.75 + sheen) * zone

    above = bright - 0.5
    r_arr = np.where(above > 0, lr + (255-lr)*above*0.35, 0.0)
    g_arr = np.where(above > 0, lg + (255-lg)*above*0.35, 0.0)
    b_arr = np.where(above > 0, lb + (255-lb)*above*0.35, 0.0)
    a_arr = np.where(above > 0, above*180, -above*100)
    return clamp_u8(np.stack([r_arr, g_arr, b_arr, a_arr], axis=-1))


def gen_bg_marble(vein1_hex: str, vein2_hex: str, w: int, h: int) -> np.ndarray:
    """Coarse marble — lower frequency veins (background scale)."""
    v1r, v1g, v1b = hex_to_rgb(vein1_hex)
    v2r, v2g, v2b = hex_to_rgb(vein2_hex)
    xs, ys = make_coords(w, h)

    def fbm_bg(x2d, y2d):
        v = np.zeros_like(x2d, dtype=float)
        amp, freq = 1.0, 1.0
        for _ in range(4):
            v += np.sin((x2d*freq*0.006 + y2d*freq*0.004) + amp) * amp
            v += np.cos((y2d*freq*0.007 - x2d*freq*0.003) + amp*1.3) * amp * 0.5
            amp *= 0.6; freq *= 2.0
        return v

    n = fbm_bg(xs, ys)
    m = np.abs(np.sin(xs*0.012 + ys*0.005 + n))
    v = np.abs(np.sin(xs*0.004 - ys*0.01  + n*1.5))
    t1 = np.power(np.maximum(0, 1 - m*3.5), 2)
    t2 = np.power(np.maximum(0, 1 - v*5.0), 3)
    alpha = np.minimum(200, (t1*0.65 + t2*0.45) * 255)
    r_arr = np.minimum(255, np.maximum(0, v1r*t1 + v2r*t2))
    g_arr = np.minimum(255, np.maximum(0, v1g*t1 + v2g*t2))
    b_arr = np.minimum(255, np.maximum(0, v1b*t1 + v2b*t2))
    return clamp_u8(np.stack([r_arr, g_arr, b_arr, alpha], axis=-1))


def gen_bg_velvet(sheen_hex: str, w: int, h: int) -> np.ndarray:
    """Coarse velvet — larger scale anisotropic nap (background scale)."""
    sr, sg, sb = hex_to_rgb(sheen_hex)
    xs, ys = make_coords(w, h)
    nap_angle = (fbm_arr(xs*0.004, ys*0.004, 3) - 0.5)*math.pi*0.5 + math.pi*0.3
    lx2, ly2 = 0.577, -0.577
    grain = fbm_arr(xs*0.2, ys*0.2, 3)
    fw = (grain - 0.5) * 0.25
    pa = nap_angle + math.pi*0.5 + fw
    dot_l = lx2*np.cos(pa) + ly2*np.sin(pa)
    sheen = np.power(np.maximum(0, dot_l*0.5+0.5), 2.2)
    shadow = fbm_arr(xs*0.15, ys*0.15, 3)
    ss = np.power(shadow, 0.7)*0.5 + 0.5
    zone = fbm_arr(xs*0.002, ys*0.002, 2)*0.4 + 0.8
    b = (sheen*0.7 + ss*0.3) * zone
    alpha = np.minimum(255, b * 160)
    r_arr = np.minimum(255, sr*b*1.2)
    g_arr = np.minimum(255, sg*b*1.2)
    b_arr = np.minimum(255, sb*b*1.2)
    return clamp_u8(np.stack([r_arr, g_arr, b_arr, alpha], axis=-1))


def gen_bg_slate(mid_hex: str, light_hex: str, w: int, h: int) -> np.ndarray:
    """Coarse slate — wider shear bands (background scale)."""
    mr, mg, mb = hex_to_rgb(mid_hex)
    lr2, lg2, lb2 = hex_to_rgb(light_hex)
    xs, ys = make_coords(w, h)

    cos_a = math.cos(math.pi*0.72); sin_a = math.sin(math.pi*0.72)
    lx2, ly2, lz2 = 0.5, -0.7, 0.51
    su = xs*cos_a + ys*sin_a; sv = -xs*sin_a + ys*cos_a

    warp  = fbm_arr(su*0.0015, sv*0.0015, 3) * 80
    band1 = fbm_arr((sv+warp)*0.006, su*0.001, 4)
    band2 = fbm_arr((sv+warp*0.6)*0.0035 + 10.3, su*0.0005 + 5.1, 3)
    band_v = band1*0.6 + band2*0.4
    grain  = fbm_arr(xs*0.11, ys*0.11, 3)

    vw = fbm_arr(su*0.004+2.1, sv*0.004, 3)*55
    vp = (sv+vw)*0.014
    v1 = np.power(np.maximum(0, np.sin(vp+0.3)), 8)
    v2 = np.power(np.maximum(0, np.sin(vp*2.3+1.7)), 12)
    v3 = np.power(np.maximum(0, np.sin(vp*0.5+4.1)), 6)*0.5
    vm = fbm_arr(su*0.003, sv*0.001+20, 3)*0.7+0.3
    vein = (v1*0.5+v2*0.35+v3*0.15)*vm

    eps = 2.0
    bx = fbm_arr((sv+warp+eps)*0.006, su*0.001, 3) - fbm_arr((sv+warp-eps)*0.006, su*0.001, 3)
    by = fbm_arr((sv+warp)*0.006, (su+eps)*0.001, 3) - fbm_arr((sv+warp)*0.006, (su-eps)*0.001, 3)
    nl = np.sqrt(bx*bx + by*by + 0.08)
    nx = -bx/nl*1.5; ny = by/nl*1.5; nz = 0.28/nl
    diffuse = np.maximum(0.15, nx*lx2 + ny*ly2 + nz*lz2)
    spec    = np.power(np.maximum(0, diffuse), 22)*0.4
    shadow  = np.power(1 - band_v, 2.5)*0.35

    t      = band_v*0.6 + grain*0.25 + vein*0.15
    base_r = mr + (lr2-mr)*t; base_g = mg + (lg2-mg)*t; base_b = mb + (lb2-mb)*t
    lit    = diffuse*(1-shadow)
    vein_r = np.minimum(255, base_r*(1-vein*0.7)+230*vein*0.7+spec*180)
    vein_g = np.minimum(255, base_g*(1-vein*0.7)+228*vein*0.7+spec*185)
    vein_b = np.minimum(255, base_b*(1-vein*0.7)+235*vein*0.7+spec*200)
    ir = np.minimum(255, np.maximum(0, vein_r*lit))
    ig = np.minimum(255, np.maximum(0, vein_g*lit))
    ib = np.minimum(255, np.maximum(0, vein_b*lit))
    alpha = np.minimum(255, (t*0.7 + vein*0.5 + grain*0.2)*255)
    return clamp_u8(np.stack([ir, ig, ib, alpha], axis=-1))


def gen_bg_parchment(dark_hex: str, w: int, h: int) -> np.ndarray:
    """Coarse parchment — lower frequency fibre flow (background scale)."""
    dr, dg, db = hex_to_rgb(dark_hex)
    xs, ys = make_coords(w, h)
    tone = fbm_arr(xs*0.0025, ys*0.0025, 3)
    fw = fbm_arr(xs*0.0075, ys*0.0075, 3)*40
    fu = xs*0.7+fw; fv = ys*0.08
    fibre = fbm_arr(fu*0.02, fv*0.2, 4)
    tooth = fbm_arr(xs*0.22, ys*0.22, 3)*0.12
    surface = tone*0.5 + fibre*0.35 + tooth
    ex = (xs/w - 0.5)*2; ey = (ys/h - 0.5)*2
    vignette = np.maximum(0, ex*ex+ey*ey-0.2)*0.3
    bright = surface - vignette
    above = bright - 0.5
    alpha = np.minimum(255, np.abs(above)*160)
    pos = above > 0
    r_arr = np.where(pos, 255.0, float(dr))
    g_arr = np.where(pos, 245.0, float(dg))
    b_arr = np.where(pos, 220.0, float(db))
    return clamp_u8(np.stack([r_arr, g_arr, b_arr, alpha], axis=-1))


def gen_bg_ocean(caustic_hex: str, w: int, h: int) -> np.ndarray:
    """Coarse ocean — larger caustic blobs (background scale)."""
    cr, cg, cb = hex_to_rgb(caustic_hex)
    xs, ys = make_coords(w, h)
    wx1 = fbm_arr(xs*0.004, ys*0.004, 4)*55
    wy1 = fbm_arr(xs*0.004+3.7, ys*0.004+5.2, 4)*55
    wx2 = fbm_arr((xs+wx1)*0.003, (ys+wy1)*0.003, 3)*40
    wy2 = fbm_arr((xs+wx1)*0.003+8.1, (ys+wy1)*0.003+2.4, 3)*40
    wx = xs+wx1+wx2; wy = ys+wy1+wy2
    c1 = np.sin(wx*0.016+wy*0.012)*0.5+0.5
    c2 = np.sin(wx*0.025-wy*0.019+2.1)*0.5+0.5
    c3 = np.sin(-wx*0.013+wy*0.030+4.6)*0.5+0.5
    c4 = np.sin(wx*0.009+wy*0.036+1.3)*0.5+0.5
    caustic = np.power(c1*c2*c3*c4, 0.55)
    depth   = fbm_arr(xs*0.002, ys*0.003, 3)*0.35+0.65
    scatter = np.power(np.maximum(0, caustic-0.6), 2)*4.0
    rng2 = np.random.default_rng(55)
    spark_seed = rng2.random((h, w))
    spark = np.where(spark_seed > 0.994, (spark_seed-0.994)/0.006*2.0, 0.0)
    total = caustic*depth + scatter*0.5 + spark*0.6
    rr = np.minimum(255, (cr*caustic*0.8+220*scatter*0.15+255*spark*0.4)*depth)
    rg = np.minimum(255, (cg*caustic*0.8+240*scatter*0.35+255*spark*0.6)*depth)
    rb = np.minimum(255, (cb*caustic*0.8+255*scatter*0.55+255*spark)*depth)
    alpha = np.minimum(255, total*200)
    return clamp_u8(np.stack([rr, rg, rb, alpha], axis=-1))


def gen_bg_forge(glow_hex: str, w: int, h: int) -> np.ndarray:
    """Coarse forge — wider Voronoi cells (background scale)."""
    gr, gg, gb = hex_to_rgb(glow_hex)
    xs, ys = make_coords(w, h)
    NC = 45
    rng3 = np.random.default_rng(13)
    cx_arr = rng3.random(NC) * w
    cy_arr = rng3.random(NC) * h
    heat_a = np.power(rng3.random(NC), 2.5)

    px = xs[:, :, np.newaxis]
    py = ys[:, :, np.newaxis]
    d2_all = (px - cx_arr)**2 + (py - cy_arr)**2
    idx2 = np.argsort(d2_all, axis=2)[:, :, :2]
    d_s = np.take_along_axis(d2_all, idx2, axis=2)
    d1 = d_s[:, :, 0]; d2_v = d_s[:, :, 1]; c1i = idx2[:, :, 0]
    edge = np.sqrt(d2_v) - np.sqrt(d1)
    cw = 4 + fbm_arr(xs*0.01, ys*0.01, 2)*5
    ct = np.where(edge < cw, 1-(edge/cw), 0.0)
    rg2 = fbm_arr(xs*0.08, ys*0.08, 4)
    rs  = fbm_arr(xs*0.02, ys*0.02, 3)
    eps2 = 1.0
    dfdx = fbm_arr((xs+eps2)*0.02, ys*0.02, 3) - fbm_arr((xs-eps2)*0.02, ys*0.02, 3)
    dfdy = fbm_arr(xs*0.02, (ys+eps2)*0.02, 3) - fbm_arr(xs*0.02, (ys-eps2)*0.02, 3)
    nl = np.sqrt(dfdx*dfdx+dfdy*dfdy+0.01)
    nx2=-dfdx/nl; ny2=-dfdy/nl; nz2=0.1/nl
    diff=np.maximum(0,nx2*0.5+ny2*(-0.6)+nz2*0.62)
    spec=np.power(diff,12)*rg2
    heat=heat_a[c1i]
    gi=ct*(0.3+heat*1.4)
    ag=np.exp(-edge*0.04)*heat*0.5
    rb=( rs*0.4+rg2*0.3)*(0.3+diff*0.7)
    rr=20+rb*35+spec*60; rg2b=18+rb*30+spec*55; rbl=22+rb*40+spec*70
    gr2=np.minimum(255,gr*1.4*gi+ag*gr*0.6)
    gg2=np.minimum(255,gg*0.7*gi+ag*gg*0.3)
    gb2=np.minimum(255,gb*0.2*gi)
    gt=np.power(gi+ag*0.5,0.7)
    ir=np.minimum(255,np.maximum(0,rr*(1-gt)+gr2*gt))
    ig=np.minimum(255,np.maximum(0,rg2b*(1-gt)+gg2*gt))
    ib=np.minimum(255,np.maximum(0,rbl*(1-gt)+gb2*gt))
    alpha=np.minimum(255,(rb*0.6+gi*1.2+ag*0.8)*255)
    return clamp_u8(np.stack([ir,ig,ib,alpha],axis=-1))


# ---------------------------------------------------------------------------
# Theme definitions (matching TRAY_THEMES in JS)
# ---------------------------------------------------------------------------

THEMES = {
    'green-felt': {
        'felt-1': '#1f4d3a', 'felt-2': '#16382b',
        'tray_fn':  lambda: gen_felt_texture('#2a6b50'),
        'bg_fn':    lambda: gen_bg_felt('#2a6b50', '#1a4a30', BG_W, BG_H),
    },
    'midnight-velvet': {
        'felt-1': '#1a1030', 'felt-2': '#100820',
        'tray_fn':  lambda: gen_velvet_texture('#c0a8ff'),
        'bg_fn':    lambda: gen_bg_velvet('#c0a8ff', BG_W, BG_H),
    },
    'parchment': {
        'felt-1': '#c8b888', 'felt-2': '#b0a070',
        'tray_fn':  lambda: gen_parchment_texture('#6a3010'),
        'bg_fn':    lambda: gen_bg_parchment('#6a3010', BG_W, BG_H),
    },
    'slate-stone': {
        'felt-1': '#3a4550', 'felt-2': '#2a3540',
        'tray_fn':  lambda: gen_slate_texture('#4a5a68', '#8aa0b0'),
        'bg_fn':    lambda: gen_bg_slate('#4a5a68', '#8aa0b0', BG_W, BG_H),
    },
    'deep-ocean': {
        'felt-1': '#0a1828', 'felt-2': '#060f1a',
        'tray_fn':  lambda: gen_ocean_texture('#40b8e0'),
        'bg_fn':    lambda: gen_bg_ocean('#30a8c8', BG_W, BG_H),
    },
    'ember-forge': {
        'felt-1': '#200800', 'felt-2': '#120400',
        'tray_fn':  lambda: gen_forge_texture('#ff6020'),
        'bg_fn':    lambda: gen_bg_forge('#ff5818', BG_W, BG_H),
    },
    'ivory-marble': {
        'felt-1': '#e8e0d4', 'felt-2': '#d4c8b8',
        'tray_fn':  lambda: gen_marble_texture('#8090b8', '#4a5080'),
        'bg_fn':    lambda: gen_bg_marble('#7080a8', '#404870', BG_W, BG_H),
    },
}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    for theme_key, cfg in THEMES.items():
        print(f"\n{theme_key}:")

        # --- Tray texture (768×768, RGBA PNG) ---
        print("  generating tray texture…")
        tray_rgba = cfg['tray_fn']()
        # wood tray texture is 768×256 — pad to square for consistency
        if tray_rgba.shape[0] != TRAY_H:
            padded = np.zeros((TRAY_H, TRAY_W, 4), dtype=np.uint8)
            src_h = tray_rgba.shape[0]
            for ty in range(0, TRAY_H, src_h):
                padded[ty:ty+src_h, :, :] = tray_rgba[:TRAY_H-ty, :, :]
            tray_rgba = padded
        save_png(tray_rgba, f"tray_{theme_key}.png")

        # --- Background (1920×1080, RGB JPEG) ---
        print("  generating background…")
        base_rgb = make_bg_gradient(cfg, BG_W, BG_H)
        tex_rgba = cfg['bg_fn']()
        # Scale/tile texture to bg size if needed
        if tex_rgba.shape[:2] != (BG_H, BG_W):
            tex_rgba = scale_to(tex_rgba, BG_W, BG_H)
        composited = composite_rgba_over(base_rgb, tex_rgba, alpha_scale=0.45)
        save_jpg(composited, f"bg_{theme_key}.jpg")

    print("\nDone! All textures written to:", os.path.abspath(OUTPUT_DIR))


if __name__ == '__main__':
    main()
