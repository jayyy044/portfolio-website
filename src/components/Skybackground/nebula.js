// The nebula: big soft blue clouds plus finer teal dust that gathers along a
// band through the middle. Ported from the black hole page (cloudAt). Each
// layer is painted once per resize, then drifts on its own slow path every
// frame, so where they overlap the shapes seem to shift.
import { rng } from './stars'
import { TILT, smooth } from './blackhole' // the dust band follows the disk's tilt

// ---------- knobs ----------
const OPACITY = 0.42 // overall strength
const CLOUD_THRESHOLD = 0.39 // big clouds: lower = more of the sky covered
const DUST_THRESHOLD = 0.44 // fine dust: lower = more of the sky covered
const CLOUD_SCALE = 1.6 // higher = smaller, busier clouds
const DUST_SCALE = 2.6 // higher = smaller, busier dust
const SWIRL = 0.35 // how twisted and wispy the shapes are
const LANE_WIDTH = 0.38 // how tightly the dust hugs the band
const LANE_PULL = 0.65 // 0 = dust spread everywhere, 1 = dust only in the band
const CLOUD_COLOR = [30, 48, 124] // deep blue
const DUST_COLOR = [36, 112, 150] // teal
const SOFTNESS = 1 // blur multiplier: higher = softer edges
const BOTTOM_FADE = 0.85 // 0 = even top to bottom, 1 = gone at the bottom
const SEED = 11 // change for differently shaped clouds

// ---------- motion ----------
const DRIFT = 40 // how far each layer wanders, in px
const DRIFT_SPEED = 2 // multiplier on how fast the layers wander
const BREATHE = 0.2 // how much each layer dims and brightens, 0 = steady

// each layer's slow loop: frequencies, direction, phase; dust runs quicker, the other way
const PATHS = [
  { fx: 0.07, fy: 0.05, ax: 1, ay: 0.6, phase: 0, breathe: 0.2 }, // clouds
  { fx: 0.11, fy: 0.09, ax: -1, ay: 0.5, phase: 2, breathe: 0.27 }, // dust
]

const still = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

// smooth random noise, layered at finer and finer detail (value noise + fbm)
export function valueNoise(seed) {
  const R = rng(seed), perm = new Uint8Array(512), val = new Float32Array(256)
  for (let i = 0; i < 256; i++) { perm[i] = i; val[i] = R() }
  for (let i = 255; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]] }
  for (let i = 0; i < 256; i++) perm[i + 256] = perm[i]
  const fade = (x) => x * x * (3 - 2 * x)
  const v = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y), u = fade(x - xi), w = fade(y - yi)
    const a = val[perm[(xi & 255) + perm[yi & 255]]], b = val[perm[((xi + 1) & 255) + perm[yi & 255]]]
    const c = val[perm[(xi & 255) + perm[(yi + 1) & 255]]], d = val[perm[((xi + 1) & 255) + perm[(yi + 1) & 255]]]
    return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w
  }
  return (x, y, octaves = 5) => {
    let s = 0, amp = 0.5, f = 1
    for (let o = 0; o < octaves; o++) { s += amp * v(x * f, y * f); f *= 2.03; amp *= 0.5 }
    return s
  }
}

const cloudNoise = valueNoise(SEED), dustNoise = valueNoise(SEED + 18), swirlNoise = valueNoise(SEED + 36)
const sT = Math.sin(TILT), cT = Math.cos(TILT)

// cloud and dust density, each 0..1, at a point; x, y are centred, in units of S
function cloudAt(x, y) {
  const wx = x + SWIRL * swirlNoise(x * 1.3 + 9, y * 1.3, 3)
  const wy = y + SWIRL * swirlNoise(x * 1.3, y * 1.3 + 4, 3)
  const cloud = Math.max(0, cloudNoise(wx * CLOUD_SCALE + 3, wy * CLOUD_SCALE + 1) - CLOUD_THRESHOLD) * 2.5
  const grain = Math.max(0, dustNoise(wx * DUST_SCALE + 7, wy * DUST_SCALE + 5) - DUST_THRESHOLD) * 3.3
  const lane = Math.exp(-(((-x * sT + y * cT - 0.02) / LANE_WIDTH) ** 2))
  const dust = grain * (1 - LANE_PULL + LANE_PULL * lane)
  return [Math.min(1, cloud * 0.8), Math.min(1, dust)]
}

// a tiny image blurred up to full size: soft clouds for a fraction of the work
function blurUp(img, w, h, blur) {
  const small = document.createElement('canvas')
  small.width = img.width
  small.height = img.height
  small.getContext('2d').putImageData(img, 0, 0)
  const big = document.createElement('canvas')
  big.width = w
  big.height = h
  const bctx = big.getContext('2d')
  bctx.imageSmoothingEnabled = true
  bctx.imageSmoothingQuality = 'high'
  bctx.filter = `blur(${blur}px)`
  bctx.drawImage(small, 0, 0, w, h)
  return big
}

// S: one unit of the black hole's maths, in px
export function createNebula(W, H, S) {
  // layers overhang the screen so drifting and the sky's sway never show an edge
  const M = Math.round(DRIFT + 0.05 * Math.max(W, H)), LW = W + 2 * M, LH = H + 2 * M
  const nw = 220, nh = Math.max(40, Math.round((nw * LH) / LW))
  const imgs = [new ImageData(nw, nh), new ImageData(nw, nh)]
  for (let j = 0; j < nh; j++) {
    for (let i = 0; i < nw; i++) {
      const sx = ((i + 0.5) / nw) * LW - M, sy = ((j + 0.5) / nh) * LH - M // screen px
      const fall = 1 - BOTTOM_FADE * smooth((sy / H - 0.35) / 0.55)
      const densities = cloudAt((sx - W / 2) / S, (sy - H / 2) / S)
      const k = 4 * (j * nw + i)
      for (const [n, color] of [CLOUD_COLOR, DUST_COLOR].entries()) {
        const data = imgs[n].data
        data[k] = color[0]
        data[k + 1] = color[1]
        data[k + 2] = color[2]
        data[k + 3] = densities[n] ** 1.5 * OPACITY * fall * 255
      }
    }
  }
  const blur = Math.max(4, W / 160) * SOFTNESS
  return { M, layers: imgs.map((img) => blurUp(img, LW, LH, blur)) }
}

// ox, oy: the sky's sway this frame
export function drawNebula(ctx, { M, layers }, t, ox, oy) {
  const s = still ? 0 : t * DRIFT_SPEED
  ctx.globalCompositeOperation = 'lighter'
  layers.forEach((layer, i) => {
    const p = PATHS[i]
    ctx.globalAlpha = 1 - BREATHE * (0.5 + 0.5 * Math.sin(s * p.breathe + p.phase))
    const x = ox - M + DRIFT * p.ax * Math.sin(s * p.fx + p.phase)
    const y = oy - M + DRIFT * p.ay * Math.sin(s * p.fy + p.phase + 1)
    ctx.drawImage(layer, x, y)
  })
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
