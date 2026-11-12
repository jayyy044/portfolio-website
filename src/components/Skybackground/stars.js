// The starfield: faint stars painted into the sky's still background once per
// resize, plus brighter ones redrawn every frame so they twinkle and drift
// with scroll. Ported from the black hole page (paintSky / drawStars).

// ---------- knobs ----------
const BRIGHTNESS = 0.5 // overall star brightness, 1 = as designed
const TWINKLE = 0.4 // 0 = steady, 1 = fades fully out and back in
const TWINKLE_SPEED = 1 // multiplier on every star's twinkle rate
const DENSITY = 1 // multiplier on how many stars there are
const CROSS = 0 // the thin cross on the brightest stars: 0 = none (just the soft glow), 1 = the original's

// blue-white through to warm, picked at random per star
const TEMPS = [[170, 196, 255], [214, 226, 255], [255, 255, 255], [255, 240, 214], [255, 214, 170]]

// seeded, so the same sky comes back on every load (mulberry32)
export function rng(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${Math.min(1, a).toFixed(3)})`

// 0..1 brightness factor for a star at time t
const twinkle = (s, t) => 1 - TWINKLE + TWINKLE * (0.5 + 0.5 * Math.sin(6.283 * s.f * t * 0.25 * TWINKLE_SPEED + s.p))

// the brightest stars' soft glow and cross, at b = 0.9 (the middle of the glint range)
const GLINT_R = 6.1, GLINT_L = 8.9

// One glint drawn once per colour at full strength, pixel-aligned so the cross
// is a crisp line; drawStars stamps it with globalAlpha instead of building a
// gradient for every glint every frame.
function glintSprite(c, dpr) {
  const half = Math.ceil(GLINT_L * dpr) + 1, size = 2 * half + 1 // odd: the centre is a whole pixel
  const cv = document.createElement('canvas')
  cv.width = cv.height = size
  const g = cv.getContext('2d')
  const grad = g.createRadialGradient(half + 0.5, half + 0.5, 0, half + 0.5, half + 0.5, GLINT_R * dpr)
  grad.addColorStop(0, rgba(c, 0.22 * BRIGHTNESS))
  grad.addColorStop(1, rgba(c, 0))
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  if (CROSS > 0) {
    // the cross was a 0.6 px line; as whole device pixels it's w wide, so scale its alpha to give the same light
    const L = Math.round(GLINT_L * dpr), w = Math.max(1, Math.round(0.6 * dpr))
    g.fillStyle = rgba(c, (0.32 * BRIGHTNESS * CROSS * 0.6 * dpr) / w)
    g.fillRect(half - L, half, 2 * L + 1, w) // across
    g.fillRect(half, half - L, w, L) // up, then down, skipping the middle so it isn't doubled
    g.fillRect(half, half + w, w, L + 1 - w)
  }
  return { cv, half }
}

// Paints the faint stars into ctx and returns the bright ones for drawStars.
// ctx is the sky's still background, mx / my px bigger than the screen on each
// side so the sway never shows an edge; faint stars spread across all of it.
// Everything lands on whole device pixels so the little squares stay sharp.
export function createStars(ctx, W, H, dpr, mx, my) {
  const R = rng(17)
  const n = Math.round((W * H) / 820 * DENSITY)
  const bright = []
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H, b = R() ** 2.6, ci = Math.floor(R() * TEMPS.length)
    const size = b > 0.6 ? 1.9 : b > 0.3 ? 1.3 : 0.9
    const sd = Math.max(1, Math.round(size * dpr)) // size in whole device px
    const k = ((size * dpr) / sd) ** 2 // snapping changed the square's area: scale alpha so it gives the same light
    if (b > 0.22) {
      // f: twinkle rate, p: phase, par: how far it drifts per pixel scrolled
      bright.push({ x, y, b, ci, sd, k, f: 0.3 + 1.5 * R(), p: R() * 6.283, par: 0.02 + 0.05 * b, glint: b > 0.8 })
      continue
    }
    ctx.fillStyle = rgba(TEMPS[ci], (0.16 + b) * BRIGHTNESS * k)
    ctx.fillRect(Math.round((x * (W + 2 * mx)) / W * dpr) / dpr, Math.round((y * (H + 2 * my)) / H * dpr) / dpr, sd / dpr, sd / dpr)
  }
  bright.sort((a, b) => a.ci - b.ci) // grouped by colour, so drawStars sets each colour once
  return { H, dpr, bright, glints: TEMPS.map((c) => glintSprite(c, dpr)) }
}

// ox, oy: the sky's sway this frame
export function drawStars(ctx, { H, dpr, bright, glints }, t, ox, oy, scroll) {
  const wrap = (y) => ((y % (H + 20)) + H + 20) % (H + 20) - 10

  let ci = -1
  for (const s of bright) {
    if (s.ci !== ci) {
      ci = s.ci
      ctx.fillStyle = `rgb(${TEMPS[ci]})`
    }
    s.L = Math.round((s.x + ox) * dpr) // where it lands this frame, in device px
    s.T = Math.round(wrap(s.y + oy - scroll * s.par) * dpr)
    ctx.globalAlpha = Math.min(1, (0.2 + 0.85 * s.b) * twinkle(s, t) * BRIGHTNESS * s.k)
    ctx.fillRect(s.L / dpr, s.T / dpr, s.sd / dpr, s.sd / dpr)
  }

  // the brightest few get a soft glow and a little cross
  for (const s of bright) {
    if (!s.glint) continue
    const { cv, half } = glints[s.ci]
    ctx.globalAlpha = s.b * twinkle(s, t)
    ctx.drawImage(cv, (s.L + (s.sd >> 1) - half) / dpr, (s.T + (s.sd >> 1) - half) / dpr, cv.width / dpr, cv.height / dpr)
  }
  ctx.globalAlpha = 1
}
