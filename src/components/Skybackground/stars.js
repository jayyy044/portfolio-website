// The starfield: faint stars painted into the sky's still background once per
// resize, plus brighter ones redrawn every frame so they twinkle and drift
// with scroll. Ported from the black hole page (paintSky / drawStars).

// ---------- knobs ----------
const BRIGHTNESS = 1 // overall star brightness, 1 = as designed
const TWINKLE = 0.7 // 0 = steady, 1 = fades fully out and back in
const TWINKLE_SPEED = 1 // multiplier on every star's twinkle rate
const DENSITY = 1 // multiplier on how many stars there are

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

// paints the faint stars into ctx; returns the bright ones for drawStars
export function createStars(ctx, W, H) {
  const R = rng(17)
  const n = Math.round((W * H) / 820 * DENSITY)
  const bright = []
  for (let i = 0; i < n; i++) {
    const x = R() * W, y = R() * H, b = R() ** 2.6, c = TEMPS[Math.floor(R() * TEMPS.length)]
    const size = b > 0.6 ? 1.9 : b > 0.3 ? 1.3 : 0.9
    if (b > 0.22) {
      // f: twinkle rate, p: phase, par: how far it drifts per pixel scrolled
      bright.push({ x, y, b, c, size, f: 0.3 + 1.5 * R(), p: R() * 6.283, par: 0.02 + 0.05 * b, glint: b > 0.8 })
      continue
    }
    ctx.fillStyle = rgba(c, (0.16 + b) * BRIGHTNESS)
    ctx.fillRect(x, y, size, size)
  }
  return { H, bright }
}

// ox, oy: the sky's sway this frame
export function drawStars(ctx, { H, bright }, t, ox, oy, scroll) {
  const wrap = (y) => ((y % (H + 20)) + H + 20) % (H + 20) - 10

  for (const s of bright) {
    ctx.fillStyle = rgba(s.c, (0.2 + 0.85 * s.b) * twinkle(s, t) * BRIGHTNESS)
    ctx.fillRect(s.x + ox, wrap(s.y + oy - scroll * s.par), s.size, s.size)
  }

  // the brightest few get a soft glow and a little cross
  ctx.lineWidth = 0.6
  for (const s of bright) {
    if (!s.glint) continue
    const tw = twinkle(s, t), R = 2.5 + 4 * s.b, L = 3.5 + 6 * s.b
    const x = s.x + ox + s.size / 2, y = wrap(s.y + oy - scroll * s.par) + s.size / 2
    const g = ctx.createRadialGradient(x, y, 0, x, y, R)
    g.addColorStop(0, rgba(s.c, 0.22 * s.b * tw * BRIGHTNESS))
    g.addColorStop(1, rgba(s.c, 0))
    ctx.fillStyle = g
    ctx.fillRect(x - R, y - R, 2 * R, 2 * R)
    ctx.strokeStyle = rgba(s.c, 0.32 * s.b * tw * BRIGHTNESS)
    ctx.beginPath()
    ctx.moveTo(x - L, y); ctx.lineTo(x + L, y)
    ctx.moveTo(x, y - L); ctx.lineTo(x, y + L)
    ctx.stroke()
  }
}
