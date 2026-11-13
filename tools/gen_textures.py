"""
Generates the seamless world textures used by the game:

  assets/textures/ground_albedo.png   ground_normal.png   ground_emissive.png   (cracked lava crust)
  assets/textures/bricks_albedo.png   bricks_normal.png
  assets/textures/concrete_albedo.png concrete_normal.png

Everything is procedural (no third-party art, no licensing questions).
Noise is built in the frequency domain, so every texture tiles perfectly.

Usage (from the project root):
    pip install numpy pillow
    python tools/gen_textures.py              # everything
    python tools/gen_textures.py lava         # only some: lava, bricks, concrete
"""
from pathlib import Path

import numpy as np
from PIL import Image

SIZE = 512
OUT = Path(__file__).resolve().parent.parent / "assets" / "textures"
rng = np.random.default_rng(1993)


# ---------- noise ----------

def tileable_noise(size, freq, falloff=2.0):
    """Band-limited noise around `freq` cycles per tile. Tiles seamlessly because it lives on an FFT grid."""
    f = np.fft.fftfreq(size) * size
    fx, fy = np.meshgrid(f, f)
    r = np.sqrt(fx ** 2 + fy ** 2)
    r[0, 0] = 1
    amp = 1.0 / (1.0 + (r / freq) ** falloff)
    amp[0, 0] = 0
    phase = rng.uniform(0, 2 * np.pi, (size, size))
    spec = amp * np.exp(1j * phase)
    n = np.real(np.fft.ifft2(spec))
    return (n - n.mean()) / (n.std() + 1e-9)


def fbm(size, base=4, octaves=6, gain=0.55):
    total, a, norm = np.zeros((size, size)), 1.0, 0.0
    for o in range(octaves):
        total += a * tileable_noise(size, base * 2 ** o, falloff=6)
        norm += a
        a *= gain
    total /= norm
    return (total - total.min()) / (total.max() - total.min())


def normal_map(height, strength):
    """Tangent-space normal map (OpenGL convention, +Y up) from a wrapping height field."""
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * 0.5
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * 0.5
    nx, ny, nz = -dx * strength, dy * strength, np.ones_like(height)
    l = np.sqrt(nx ** 2 + ny ** 2 + nz ** 2)
    n = np.stack([nx / l, ny / l, nz / l], -1)
    return ((n * 0.5 + 0.5) * 255).clip(0, 255).astype(np.uint8)


def lerp(a, b, t):
    return a + (b - a) * t[..., None]


def save(name, arr):
    OUT.mkdir(parents=True, exist_ok=True)
    Image.fromarray(arr).save(OUT / name, optimize=True)
    print("wrote", OUT / name)


# ---------- ground: dusty rock and packed earth ----------

def ground():
    big = fbm(SIZE, base=3, octaves=5)
    detail = fbm(SIZE, base=24, octaves=4)
    # pebbles: thresholded high-frequency noise
    pebbles = np.clip((tileable_noise(SIZE, 40, 8) - 1.6) * 1.5, 0, 1)
    # cracks: thin valleys where mid-frequency noise crosses zero
    crack_src = tileable_noise(SIZE, 7, 6)
    cracks = np.clip(1 - np.abs(crack_src) * 16, 0, 1) * np.clip((big - 0.5) * 4, 0, 1)

    height = big * 0.6 + detail * 0.35 + pebbles * 0.5 - cracks * 0.35

    dirt = np.array([112, 74, 52], float)
    dust = np.array([164, 120, 86], float)
    rock = np.array([92, 78, 70], float)
    col = lerp(dirt, dust, np.clip(detail * 1.3 - 0.15, 0, 1))
    col = lerp(col, rock, np.clip((big - 0.55) * 3, 0, 1))
    col = lerp(col, np.array([140, 128, 116], float), pebbles * 0.8)
    col *= (0.82 + 0.3 * detail)[..., None]
    col *= (1 - cracks * 0.35)[..., None]
    save("ground_albedo.png", col.clip(0, 255).astype(np.uint8))
    save("ground_normal.png", normal_map(height, 6.0))


# ---------- bricks: weathered stone blocks, 8 rows x 4 bricks, running bond ----------

def bricks():
    rows, cols, mortar = 8, 4, 0.045  # mortar width in brick-heights
    y, x = np.mgrid[0:SIZE, 0:SIZE] / SIZE
    row = np.floor(y * rows).astype(int)
    fy = y * rows - row
    xs = x * cols + (row % 2) * 0.5
    col_i = np.floor(xs).astype(int) % cols
    fx = xs - np.floor(xs)

    # distance to the brick edge in brick-height units (bricks are 2x wider than tall here)
    aspect = (SIZE / cols) / (SIZE / rows)
    edge = np.minimum(np.minimum(fy, 1 - fy), np.minimum(fx, 1 - fx) * aspect)
    edge_jitter = tileable_noise(SIZE, 30, 6) * 0.012
    inside = np.clip((edge - mortar + edge_jitter) / 0.06, 0, 1)  # soft bevel

    brick_id = row * cols + col_i
    per_brick = rng.uniform(0, 1, rows * cols)[brick_id]
    per_brick2 = rng.uniform(0, 1, rows * cols)[brick_id]

    grain = fbm(SIZE, base=16, octaves=5)
    pits = np.clip((tileable_noise(SIZE, 60, 8) - 1.8), 0, 1)
    chips = np.clip((fbm(SIZE, base=6, octaves=4) - 0.72) * 6, 0, 1)

    height = inside * (0.8 + per_brick * 0.25) + grain * 0.25 * inside - pits * 0.4 - chips * 0.35 * inside

    stone_a = np.array([118, 108, 96], float)
    stone_b = np.array([92, 80, 72], float)
    mortar_c = np.array([52, 44, 40], float)
    stone = lerp(stone_a, stone_b, np.clip(per_brick + (grain - 0.5) * 0.8, 0, 1))
    stone = lerp(stone, np.array([128, 92, 70], float), per_brick2 * 0.35)  # warm hue variation
    stone *= (0.85 + 0.3 * grain)[..., None]
    stone *= (1 - chips * 0.25)[..., None]
    col = lerp(mortar_c, stone, inside)

    # grime and old blood running down from mortar lines, heavier near the bottom of the tile
    # vertical streaks: smear high-frequency noise downwards
    src = tileable_noise(SIZE, 50, 6)
    streak = sum(np.roll(src, k, 0) for k in range(0, 48, 3)) / 16
    streak = np.clip((streak - 0.35) * 2.5, 0, 1) * np.clip(tileable_noise(SIZE, 4, 6) * 0.5 + 0.5, 0, 1)
    grime = streak * np.clip(fy * 1.4, 0, 1) * 0.6
    col = lerp(col, np.array([70, 26, 18], float), grime * 0.7)
    # ambient occlusion in the mortar gaps
    col *= (0.55 + 0.45 * inside)[..., None]

    save("bricks_albedo.png", col.clip(0, 255).astype(np.uint8))
    save("bricks_normal.png", normal_map(height, 9.0))


# ---------- concrete: cast slabs for bridges and ramps, 2 x 2 panels per tile ----------

def concrete():
    y, x = np.mgrid[0:SIZE, 0:SIZE] / SIZE
    panels = 2
    fx = (x * panels) % 1.0
    fy = (y * panels) % 1.0
    edge = np.minimum(np.minimum(fx, 1 - fx), np.minimum(fy, 1 - fy))
    seam = np.clip(1 - edge / 0.008, 0, 1)                      # thin recessed joint between slabs
    near_seam = np.clip(1 - edge / 0.08, 0, 1)                  # grime collects along the joints

    blotch = fbm(SIZE, base=3, octaves=5)
    grain = fbm(SIZE, base=32, octaves=4)
    pores = np.clip((tileable_noise(SIZE, 90, 8) - 2.0) * 1.5, 0, 1)
    pid = (np.floor(x * panels) + np.floor(y * panels) * panels).astype(int)
    per_panel = rng.uniform(-0.06, 0.06, panels * panels)[pid]  # each slab poured slightly differently
    # faint horizontal formwork lines
    form = (np.sin(y * 2 * np.pi * 24) * 0.5 + 0.5) ** 8 * 0.06

    height = 0.6 + grain * 0.15 - pores * 0.5 - seam * 0.6 - form

    light = np.array([150, 138, 124], float)
    dark = np.array([96, 84, 74], float)
    col = lerp(dark, light, np.clip(blotch * 1.2 - 0.1 + per_panel, 0, 1))
    col *= (0.9 + 0.2 * grain)[..., None]
    col = lerp(col, np.array([70, 40, 30], float), near_seam * 0.35 * blotch)   # rusty-red dirt in the joints
    col *= (1 - pores * 0.35 - seam * 0.45 - form)[..., None]

    save("concrete_albedo.png", col.clip(0, 255).astype(np.uint8))
    save("concrete_normal.png", normal_map(height, 5.0))


# ---------- lava crust: black cooled plates split by glowing red cracks ----------

def worley_edges(size, n, rand, warp=None):
    """Tileable Voronoi: distance to the border between the two nearest cells (F2 - F1), in tile units."""
    y, x = np.mgrid[0:size, 0:size] / size
    if warp is not None:
        x = (x + warp[0]) % 1.0
        y = (y + warp[1]) % 1.0
    pts = rand.uniform(0, 1, (n, 2))
    f1 = np.full((size, size), 9.0)
    f2 = np.full((size, size), 9.0)
    for px, py in pts:
        dx = np.abs(x - px); dx = np.minimum(dx, 1 - dx)
        dy = np.abs(y - py); dy = np.minimum(dy, 1 - dy)
        d = np.sqrt(dx * dx + dy * dy)
        f2 = np.where(d < f1, f1, np.minimum(f2, d))
        f1 = np.minimum(f1, d)
    return f2 - f1


def lava_ground():
    rand = np.random.default_rng(666)
    # wobble the cell borders so cracks are jagged, not straight Voronoi lines
    warp = (tileable_noise(SIZE, 6, 4) * 0.012 + tileable_noise(SIZE, 24, 6) * 0.004,
            tileable_noise(SIZE, 6, 4) * 0.012 + tileable_noise(SIZE, 24, 6) * 0.004)
    big = worley_edges(SIZE, 22, rand, warp)          # main plates, ~1 m across in game
    small = worley_edges(SIZE, 150, rand, warp)       # secondary cracks splitting the plates
    width = 0.0045 + 0.004 * (tileable_noise(SIZE, 10, 6) * 0.5 + 0.5).clip(0, 1)

    main = np.clip(1 - big / width, 0, 1)                                   # wide glowing cracks
    halo = np.exp(-big / 0.012) * 0.35                                      # heat bleeding into the crust
    patch = np.clip(tileable_noise(SIZE, 5, 6) * 0.6 + 0.35, 0, 1)          # secondary cracks only in places
    second = np.clip(1 - small / 0.0022, 0, 1) * patch * 0.75
    hair_src = tileable_noise(SIZE, 70, 6)                                  # hairline crazing inside plates
    hair = np.clip(1 - np.abs(hair_src) / 0.06, 0, 1) * np.clip(tileable_noise(SIZE, 14, 6) - 0.2, 0, 1) * 0.35

    glow = np.clip(main + second + hair, 0, 1)
    heat = np.clip(main * 1.0 + halo, 0, 1)

    # crust: near-black basalt with slight brown variation, darker right at the edges
    blot = fbm(SIZE, base=4, octaves=5)
    crust = lerp(np.array([16, 12, 11], float), np.array([42, 30, 26], float), blot)
    crust *= (0.85 + 0.3 * fbm(SIZE, base=40, octaves=3))[..., None]
    col = lerp(crust, np.array([60, 10, 6], float), np.clip(glow + halo * 0.5, 0, 1))

    # emissive: deep red, the widest cracks run hotter toward orange
    emit = lerp(np.array([0, 0, 0], float), np.array([235, 22, 8], float), glow)
    emit = lerp(emit, np.array([255, 120, 40], float), np.clip(main - 0.6, 0, 1) * 0.8)
    emit += np.array([90, 8, 2], float) * halo[..., None]

    # relief: plates are raised slabs that round off toward the cracks
    plate = np.clip(big / 0.03, 0, 1) ** 0.5
    height = plate * 0.8 - second * 0.3 - hair * 0.15 + fbm(SIZE, base=24, octaves=4) * 0.12

    save("ground_albedo.png", col.clip(0, 255).astype(np.uint8))
    save("ground_emissive.png", emit.clip(0, 255).astype(np.uint8))
    save("ground_normal.png", normal_map(height, 6.0))


if __name__ == "__main__":
    import sys
    jobs = {"lava": lava_ground, "bricks": bricks, "concrete": concrete}
    for name in (sys.argv[1:] or list(jobs)):
        jobs[name]()
