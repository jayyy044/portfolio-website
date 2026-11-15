// The line "hi my name is maanas", poured out of the hole as the page scrolls on past the hole's
// resting place. Each half streams out of one edge of the hole as scrambled ASCII, outer ends
// first, hot near the hole; each stream runs into its letter, and the letter is lit the way a
// light echo lights it: a few dim ticks of . : + * #, then the real glyph arrives hot and cools.
// It ends exactly on the plain line. Drawn into its own canvas, which composeArt puts under the
// gas (over the sky), with a soft bloom. Ported from the v4 page's echoascii reveal.
// Once landed, a wave sweeps across it every few seconds, left to right: each letter it passes
// scrambles, then is lit again the way it landed (from the sections page's flare demo).
import { smooth } from './blackhole'

// ---------- knobs ----------
const LINE = ['hi my name', 'is maanas'] // the two halves: the first pours out of the hole's left edge, the second out of its right
const NAME = 'maanas' // the part of the line drawn in NAME_RGB
export const REVEAL_START = 0.85 // screens of scroll where the streams start (the hole has nearly settled by then)
export const REVEAL_END = 2.1 // and where the line has landed; the page's scroll room ends here too
const FONT_MIN = 18, FONT_MAX = 64 // the line's font size, px; in between it follows the screen's width and height
const TEXT_RGB = [236, 232, 240] // the line
const NAME_RGB = [255, 177, 90] // the name
const HOT_RGB = [255, 212, 154] // a letter as it lands, before it cools to its own colour
const STREAM_HOT_RGB = [255, 236, 200] // the streams near the hole, before they cool to their letter's colour
const TICK_RGB = [255, 214, 170], TICK_NAME_RGB = [255, 190, 110] // the dim . : + * # ticks before a letter lands (the line's, the name's)
const HALO_RGB = [255, 200, 140] // the brief warmth around a landing letter
const GLOW = 0.25 // the bloom around the line: 0 = none
const GLOW_SWELL = 0.25 // how much more bloom there is mid-reveal
const PARTICLES = 26, PARTICLES_PHONE = 14 // glyphs streaming into each letter; phones are screens under PHONE px wide
const PHONE = 700
const LAG = 0.68 // how far into the reveal the innermost letters start (the outer ends start first): 0 = all at once
const SCRAMBLE = ':;+=!xzcv*rtaeo0&%{}#@8B$QM' // what the streams are made of
const SCRAMBLE_RATE = 14 // how often each stream glyph changes, a second
// the sweep over the landed line; times are on the intro clock, so SPEED scales them (at 1.75, 4.2 is about 2.4 s)
const SWEEP_EVERY = 4.2 // from one sweep to the next
const SWEEP_CROSS = 1.1 // how long the wave takes to get from the first letter to the last
const SWEEP_SCRAMBLE = 0.2 // how long each letter stays scrambled
const SWEEP_SETTLE = 0.75 // then how long it takes to be lit again and cool
const SWEEP_FROM = 0.42 // where in the landing it restarts: 0 = from the first dim tick, 0.5 = straight to the hot glyph
const SWEEP_RATE = 22 // how often a scrambled letter changes, a second
const SWEEP_RGB = [255, 222, 186], SWEEP_NAME_RGB = [255, 196, 120] // a scrambled letter (the line's, the name's)

const MONO = '"JetBrains Mono", Menlo, Consolas, monospace'
const RAMP = ['.', ':', '+', '*', '#'] // the ticks a letter steps through before it lands
const GHOST = [1, 0.5, 0.27, 0.12], GHOST_GAP = 0.026 // a stream glyph's trail: how bright each copy is, and how far behind
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const ease = (x) => 1 - (1 - x) * (1 - x)
const rgb = (c) => `rgb(${c})`
const progress = (s) => clamp01((s - REVEAL_START) / (REVEAL_END - REVEAL_START))

// mid-reveal the line changes on its own (the streams, the scramble), so it needs a redraw every frame
export function nameMoving(s) {
  const p = progress(s)
  return p > 0.0005 && p < 0.9995 // the same ends drawName uses
}

function hash(a, b) {
  let q = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263)
  q = Math.imul(q ^ (q >>> 13), 1274126177)
  return ((q ^ (q >>> 16)) >>> 0) / 4294967296
}

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

// Lay the line out for this screen: centred, sized from the width and height, halfway between the
// top of the screen and the top of the arch over the resting hole (B, from rest()). The measured
// widths change once the font arrives, so Skybackground runs this again then.
export function createName(W, H, dpr, B) {
  const [cv, x] = canvas(Math.round(W * dpr), Math.round(H * dpr)) // the layer, redrawn on every frame it shows
  const [glow, gx] = canvas(Math.max(1, Math.round(W / 3)), Math.max(1, Math.round(H / 3)))
  const text = LINE.join(' ')
  const fs = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX, (0.84 * W) / (text.length * 0.6), 0.07 * H + 8)))
  const font = `500 ${fs}px ${MONO}`
  x.font = font
  const wTot = x.measureText(text).width, x0 = Math.round((W / 2 - wTot / 2) * dpr) / dpr
  const top = B.cy - 2.05 * B.R // the top of the arch over the hole
  const ty = Math.round(Math.max(fs * 1.4, top * 0.5) * dpr) / dpr
  const at = text.indexOf(NAME), nameAt = at < 0 ? text.length : at, split = LINE[0].length
  // x is the letter's left edge, y its centre line
  const letters = [...text].map((c, i) => ({ x: x0 + x.measureText(text.slice(0, i)).width, w: x.measureText(c).width, y: ty,
    half: i < split ? 0 : i === split ? -1 : 1, name: i >= nameAt, space: c === ' ' }))

  // the finished line, drawn once at device resolution; line.x, line.y: where it goes, in device px
  const pad = 4, bh = Math.ceil(fs * 1.45), [lc, lx] = canvas(Math.ceil((wTot + 2 * pad) * dpr), Math.ceil(bh * dpr))
  lx.scale(dpr, dpr)
  lx.font = font
  lx.textBaseline = 'middle'
  lx.fillStyle = rgb(TEXT_RGB)
  lx.fillText(text.slice(0, nameAt), pad, bh / 2)
  lx.fillStyle = rgb(NAME_RGB)
  lx.fillText(text.slice(nameAt), pad + x.measureText(text.slice(0, nameAt)).width, bh / 2)
  const line = { cv: lc, x: Math.round((x0 - pad) * dpr), y: Math.round((ty - bh / 2) * dpr) }

  // the finished line cut into one cell per letter, plain and hot, so a lit letter is pixel-identical to it
  const L = letters.filter((l) => !l.space)
  const lefts = L.filter((l) => l.half === 0), rights = L.filter((l) => l.half === 1)
  const minL = lefts[0]?.x, maxL = lefts.at(-1)?.x, minR = rights[0]?.x, maxR = rights.at(-1)?.x
  const ch = Math.round((ty + bh / 2) * dpr) - line.y
  const cells = L.map((l) => {
    const cx0 = Math.round((l.x - 0.15 * l.w) * dpr), w = Math.round((l.x + 1.15 * l.w) * dpr) - cx0
    const [cool, cc] = canvas(w, ch)
    cc.drawImage(lc, line.x - cx0, 0)
    const [hot, hc] = canvas(w, ch)
    hc.drawImage(cool, 0, 0)
    hc.globalCompositeOperation = 'source-in'
    hc.fillStyle = rgb(HOT_RGB)
    hc.fillRect(0, 0, w, ch)
    const a = l.half === 0 ? (l.x - minL) / Math.max(1, maxL - minL) : (maxR - l.x) / Math.max(1, maxR - minR) // 0 at the outer ends
    const bx = Math.round(l.x * dpr), bw = Math.round((l.x + l.w) * dpr) - bx // the letter's own slot in the line, device px
    return { l, x0: cx0, y0: line.y, cool, hot, a, side: l.half === 0 ? -1 : 1, cxp: l.x + l.w / 2, bx, bw }
  })

  // the glyph particles: a handful per letter, each homed somewhere inside it, launching
  // spread out along the path so it reads as a stream, not clumps
  const K = W < PHONE ? PARTICLES_PHONE : PARTICLES, n = cells.length * K
  const G = { n, ci: new Uint16Array(n), hx: new Float32Array(n), hy: new Float32Array(n), a: new Float32Array(n), lum: new Float32Array(n) }
  let g = 0
  cells.forEach((c, i) => {
    for (let k = 0; k < K; k++, g++) {
      G.ci[g] = i
      G.hx[g] = c.cxp + (hash(i, k) - 0.5) * 0.7 * c.l.w
      G.hy[g] = c.l.y + (hash(k, i + 99) - 0.5) * 0.75 * fs
      G.a[g] = clamp01(c.a - 0.11 * Math.pow(hash(i * 7, k * 3), 1.4) + 0.015)
      G.lum[g] = 0.7 + 0.3 * hash(k * 5, i * 11)
    }
  })
  return { W, H, dpr, fs, font, cv, x, glow, gx, line, cells, G, fsG: Math.max(8, fs * 0.36), x0, wTot }
}

// one letter, lit the way the echo lights it, u 0..1: a few dim ticks of . : + * then #, each
// crossfading into the next (# the only bright one), then the real glyph arrives hot and cools.
// slot: draw only the letter's own slot of its cell (the cells overlap their neighbours a little)
function lightLetter(x, N, c, u, slot = false) {
  const { dpr } = N, cx = c.cxp, cy = c.l.y
  const r = u / 0.62 // 0..1 over the ticks, then the glyph takes over
  if (r < 1) {
    const f = r * RAMP.length, i0 = Math.min(RAMP.length - 1, Math.floor(f)), wv = smooth((f - i0 - 0.7) / 0.3)
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    x.globalCompositeOperation = 'lighter'
    x.font = N.font
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    const out = 1 - smooth((u - 0.5) / 0.12) // the last tick hands over to the glyph
    const tint = c.l.name ? TICK_NAME_RGB : TICK_RGB
    const A = (i) => (RAMP[i] === '#' ? 0.62 : 0.4) * out
    x.fillStyle = `rgba(${tint},${(A(i0) * (1 - wv)).toFixed(3)})`
    x.fillText(RAMP[i0], cx, cy)
    if (i0 + 1 < RAMP.length && wv > 0) {
      x.fillStyle = `rgba(${tint},${(A(i0 + 1) * wv).toFixed(3)})`
      x.fillText(RAMP[i0 + 1], cx, cy)
    }
  }
  const ga = smooth((u - 0.5) / 0.14)
  if (ga <= 0) return
  const hot = 1 - smooth((u - 0.62) / 0.38)
  const sx = slot ? c.bx - c.x0 : 0, sw = slot ? c.bw : c.cool.width, sh = c.cool.height
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalCompositeOperation = 'lighter'
  if (hot < 1) {
    x.globalAlpha = ga * (1 - hot)
    x.drawImage(c.cool, sx, 0, sw, sh, c.x0 + sx, c.y0, sw, sh)
  }
  if (hot > 0) {
    x.globalAlpha = ga * hot
    x.drawImage(c.hot, sx, 0, sw, sh, c.x0 + sx, c.y0, sw, sh)
  }
  x.globalAlpha = 1
  const halo = 0.18 * ga * hot // a small, brief warmth around the arriving letter
  if (halo > 0.01) {
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    const R = N.fs * 0.6, gr = x.createRadialGradient(cx, cy, 0, cx, cy, R)
    gr.addColorStop(0, `rgba(${HALO_RGB},${halo.toFixed(3)})`)
    gr.addColorStop(1, `rgba(${HALO_RGB},0)`)
    x.fillStyle = gr
    x.fillRect(cx - R, cy - R, 2 * R, 2 * R)
  }
}

// how far the sweep is past a letter at clock t: null when it isn't on it
function sweepAt(N, c, t) {
  const d = (t % SWEEP_EVERY) - ((c.cxp - N.x0) / N.wTot) * SWEEP_CROSS
  return d < 0 || d > SWEEP_SCRAMBLE + SWEEP_SETTLE ? null : d
}

// Draw the line as far as the scroll s (in screens) has brought it, onto ctx (scaled to css px),
// plus its bloom. h: the hole now (hole() in blackhole.js); t: the clock, for the sweep (null: no sweep)
export function drawName(ctx, N, h, s, t) {
  const p = progress(s)
  if (p <= 0.0005) return
  const { x, dpr, W, cells, G } = N
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalCompositeOperation = 'source-over'
  x.globalAlpha = 1
  x.clearRect(0, 0, N.cv.width, N.cv.height)
  if (p >= 0.9995) {
    x.drawImage(N.line.cv, N.line.x, N.line.y) // landed: the finished line, crisp, at native size
    // the sweep: each letter it is on has its slot of the line cleared, then scrambles, then lands again
    if (t != null) cells.forEach((c, i) => {
      const d = sweepAt(N, c, t)
      if (d == null) return
      x.setTransform(1, 0, 0, 1, 0, 0)
      x.clearRect(c.bx, c.y0, c.bw, c.cool.height)
      if (d < SWEEP_SCRAMBLE) {
        x.setTransform(dpr, 0, 0, dpr, 0, 0)
        x.globalCompositeOperation = 'lighter'
        x.font = N.font
        x.textAlign = 'center'
        x.textBaseline = 'middle'
        x.fillStyle = `rgba(${c.l.name ? SWEEP_NAME_RGB : SWEEP_RGB},0.9)`
        x.fillText(SCRAMBLE[Math.floor(hash(i * 31, Math.floor(t * SWEEP_RATE)) * SCRAMBLE.length)], c.cxp, c.l.y)
      } else lightLetter(x, N, c, SWEEP_FROM + (1 - SWEEP_FROM) * smooth((d - SWEEP_SCRAMBLE) / SWEEP_SETTLE), true)
    })
  } else {
    // 1. the streams: cubic curves from the hole's edge to each particle's home, fading inside the shadow
    const rs = h.R * 0.98, step = Math.floor((performance.now() / 1000) * SCRAMBLE_RATE)
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    x.globalCompositeOperation = 'lighter'
    x.font = `500 ${N.fsG.toFixed(1)}px ${MONO}`
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    const buckets = new Map() // colour and alpha -> the glyphs drawn in it
    for (let g = 0; g < G.n; g++) {
      const c = cells[G.ci[g]], s0 = clamp01((p - LAG * G.a[g]) / (1 - LAG))
      if (s0 <= 0) continue
      const lu = clamp01((clamp01((p - LAG * c.a) / (1 - LAG)) - 0.8) / 0.2) // the letter's own lighting
      const fade = 1 - smooth(lu / 0.55) // the stream gives itself up to the letter
      if (fade <= 0.01) continue
      const side = c.side, Ex = h.cx + side * 0.9 * h.R, Ey = h.cy, Fx = G.hx[g], Fy = G.hy[g], dy = h.cy - Fy
      const P1x = h.cx + side * Math.min(2.4 * h.R, W / 2 - 14), P1y = h.cy - 0.25 * dy
      const P2x = Fx + side * Math.min(0.3 * dy, Math.max(0, side < 0 ? Fx - 12 : W - 12 - Fx)), P2y = Fy + 0.3 * dy
      const trail = Math.pow(1 - ease(s0), 0.6)
      for (let k = 0; k < GHOST.length; k++) {
        const sk = s0 - k * GHOST_GAP
        if (sk <= 0) break
        const q = ease(sk), u = 1 - q, b0 = u * u * u, b1 = 3 * u * u * q, b2 = 3 * u * q * q, b3 = q * q * q
        const X = b0 * Ex + b1 * P1x + b2 * P2x + b3 * Fx, Y = b0 * Ey + b1 * P1y + b2 * P2y + b3 * Fy
        let al = smooth((Math.hypot(X - h.cx, Y - h.cy) - rs * 0.98) / (rs * 0.16)) * smooth(q / 0.04) * G.lum[g] * GHOST[k] * fade
        if (k > 0) al *= trail
        if (al < 0.04) continue
        const hot = Math.round(Math.pow(1 - q, 0.7) * 5), name = c.l.name ? 1 : 0, ai = Math.min(9, Math.round(al * 10))
        const key = (name * 6 + hot) * 10 + ai
        let bk = buckets.get(key)
        if (!bk) buckets.set(key, (bk = []))
        bk.push(X, Y, Math.floor(hash(g * 4 + k, step) * SCRAMBLE.length))
      }
    }
    for (const [key, arr] of buckets) {
      const ai = key % 10, k = (Math.floor(key / 10) % 6) / 5, base = Math.floor(key / 60) ? NAME_RGB : TEXT_RGB
      x.fillStyle = `rgba(${base.map((v, i) => Math.round(v + (STREAM_HOT_RGB[i] - v) * k))},${(ai / 10).toFixed(2)})`
      for (let i = 0; i < arr.length; i += 3) x.fillText(SCRAMBLE[arr[i + 2]], arr[i], arr[i + 1])
    }

    // 2. each letter, lit as its stream arrives
    for (const c of cells) {
      const u = clamp01((clamp01((p - LAG * c.a) / (1 - LAG)) - 0.8) / 0.2)
      if (u > 0) lightLetter(x, N, c, u)
    }
  }
  ctx.drawImage(N.cv, 0, 0, N.W, N.H)

  // the bloom: a blurred copy at a third of the size, added on; it swells mid-reveal
  const amt = Math.min(1, GLOW + GLOW_SWELL * Math.sin(Math.PI * p))
  if (amt <= 0) return
  const { glow, gx } = N
  gx.clearRect(0, 0, glow.width, glow.height)
  gx.filter = 'blur(3px)'
  gx.drawImage(N.cv, 0, 0, glow.width, glow.height)
  gx.filter = 'none'
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = amt
  ctx.drawImage(glow, 0, 0, N.W, N.H)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
