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
export const REVEAL_END = 2.1 // and where the line has landed
const FONT_MIN = 18, FONT_MAX = 64 // the line's font size, px; in between it follows the screen's width and height
const BIG_W = 1920, BIG_H = 1080 // on screens bigger than this both ways the top sizes of the text (FONT_MAX here and in about.js) grow with
// the screen, so they look like this one scaled up
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
// the asteroid hitting the landed line (asteroid.js says when its fire first reaches each letter): each letter breaks as
// the fire reaches it, or sooner as the crack running out along the line from the first one does
const SHARDS = 4, SHARDS_PHONE = 3 // hot glyph chips (* + ' .) each letter throws off as it bursts, besides its own pieces
const CHIP_SIZE = 0.3 // how big the chips are, in font sizes
const BLAST_NEAR = 300 // how far the pieces of the letters the rock goes through are flung, px (they coast to a stop)
const BLAST_FAR = 36 // and the farthest letters' pieces: these mostly crack and fall
const BLAST_REACH = 3.5 // how far along the line from where the rock goes through the blast stays strong, in font sizes
const SHOCK = 0.14 // screens of scroll the crack takes to run from the first letter the fire touches to the far ends of the line
const DRAG = 0.09 // screens of scroll for the pieces to lose most of their speed: higher = they coast longer
const SAG = 700 // how fast the pieces sag as they slow, px per screen of scroll squared (the gently cracked ones most)
const TUMBLE = 1.6 // how many turns the nearest pieces spin through
const SHARD_LIFE = 0.6 // screens of scroll from a letter breaking to its pieces faded out
const CRACK = 0.025 // screens of scroll a letter glows hot and shivers before it breaks
const PIECES_NEAR = [2, 3], PIECES_MID = [2, 2], PIECES_FAR = [1, 2] // what each letter is cut into, columns x rows: the ones the rock goes through, the ones near them, the rest
const ALONG = 1.1 // how much of a hit letter's push is along the way the rock was going (the rest is away from where it went through)
const BURST = 0.6 // how hard a hit letter's pieces fly apart from each other
const COOL = 0.12 // screens of scroll for a piece to cool from white hot most of the way to an ember
const WHITE_RGB = [255, 246, 232], EMBER_RGB = [235, 92, 34] // a piece at its hottest, and cooled to an ember (the farther letters cool back to their own colour)
const WAKE = 0.3 // the share of a hit letter's pieces caught in the rock's wake and dragged after it a little way
const WAKE_PULL = 0.7 // how far they are dragged: 1 = as far as the rock goes
const WAKE_DRAG = 0.18 // screens of scroll for them to fall out of its wake
const IMPACT_FLASH = 0.05 // screens of scroll the flash where the fire first touches the line lasts
const IMPACT_FLASH_SIZE = 5 // how far it spreads, in font sizes
const IMPACT_FLASH_RGB = [214, 232, 255] // its outer colour (white at its heart)

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

export function hash(a, b) {
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

// how much the top text sizes grow on this screen (BIG_W, BIG_H)
export const bigger = (W, H) => Math.max(1, Math.min(W / BIG_W, H / BIG_H))

// Lay the line out for this screen: centred, sized from the width and height, halfway between the
// top of the screen and the top of the arch over the resting hole (B, from rest()). The measured
// widths change once the font arrives, so Skybackground runs this again then.
export function createName(W, H, dpr, B) {
  const [cv, x] = canvas(Math.round(W * dpr), Math.round(H * dpr)) // the layer, redrawn on every frame it shows
  const [glow, gx] = canvas(Math.max(1, Math.round(W / 3)), Math.max(1, Math.round(H / 3)))
  const text = LINE.join(' ')
  const fs = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX * bigger(W, H), (0.84 * W) / (text.length * 0.6), 0.07 * H + 8)))
  const font = `500 ${fs}px ${MONO}`
  x.font = font
  const wTot = x.measureText(text).width, x0 = Math.round((W / 2 - wTot / 2) * dpr) / dpr
  const top = B.cy - 2.05 * B.R // the top of the arch over the hole
  const ty = Math.round(Math.max(fs * 1.4, top * 0.5) * dpr) / dpr
  const at = text.indexOf(NAME), nameAt = at < 0 ? text.length : at, split = LINE[0].length
  // x is the letter's left edge, y its centre line
  const letters = [...text].map((c, i) => ({ c, x: x0 + x.measureText(text.slice(0, i)).width, w: x.measureText(c).width, y: ty,
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
  return { W, H, dpr, fs, font, cv, x, glow, gx, line, cells, G, fsG: Math.max(8, fs * 0.36), x0, wTot, ty }
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

// the stream glyphs gathered in buckets (key: name, heat 0..5, alpha 0..9 -> x, y, glyph, ...), drawn in one go
function drawGlyphs(x, N, buckets) {
  x.setTransform(N.dpr, 0, 0, N.dpr, 0, 0)
  x.globalCompositeOperation = 'lighter'
  x.font = `500 ${N.fsG.toFixed(1)}px ${MONO}`
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  for (const [key, arr] of buckets) {
    const ai = key % 10, k = (Math.floor(key / 10) % 6) / 5, base = Math.floor(key / 60) ? NAME_RGB : TEXT_RGB
    x.fillStyle = `rgba(${base.map((v, i) => Math.round(v + (STREAM_HOT_RGB[i] - v) * k))},${(ai / 10).toFixed(2)})`
    for (let i = 0; i < arr.length; i += 3) x.fillText(SCRAMBLE[arr[i + 2]], arr[i], arr[i + 1])
  }
}

// The landed line shattered by the asteroid. impact: { x, y (css px: where the rock's centre crosses the line), dx, dy
// (the way it was going), hits (when its fire first reaches each letter, Infinity if never), s (the first of those),
// rock(s) (where the rock is at scroll s) }. Each letter heats up and shivers for a moment, then bursts into pieces of
// itself, white hot where the rock went through: those fly mostly the way the rock was going, apart from each other,
// tumbling, some caught in its wake, cooling to embers and fading; the farther letters crack into a couple of pieces
// that are pushed away and sag. Hot glyph chips fly off, and a flash marks the first contact. Nothing falls into the
// hole. A pure function of the scroll: scrolling back puts the line together again.
function tint(src, c) {
  const [cv, cx] = canvas(src.width, src.height)
  cx.drawImage(src, 0, 0)
  cx.globalCompositeOperation = 'source-in'
  cx.fillStyle = rgb(c)
  cx.fillRect(0, 0, src.width, src.height)
  return cv
}
// n + 1 cut positions from lo to hi, the inner ones jittered
const cuts = (n, seed, lo, hi) => Array.from({ length: n + 1 }, (_, j) => lo + ((hi - lo) * (j && j < n ? j + (hash(seed, j) - 0.5) * 0.5 : j)) / n)
// when each letter breaks, how hard it was hit, and its pieces and chips; worked out once per layout and impact.
// Every piece gets an id (0, 1, ...), so the about-me (about.js) can take it over
export function shatterAt(N, im) {
  if (N.sh?.im === im) return N.sh
  const { cells, fs, dpr } = N, nChips = N.W < PHONE ? SHARDS_PHONE : SHARDS
  let first = Infinity, fi = -1
  im.hits.forEach((v, i) => { if (v < first) { first = v; fi = i } })
  if (fi < 0) first = im.s
  const ox = fi < 0 ? im.x : cells[fi].cxp, oy = fi < 0 ? im.y : cells[fi].l.y // the first contact
  const d = cells.map((c) => Math.abs(c.cxp - ox)), dMax = Math.max(1, ...d)
  const at = cells.map((c, i) => Math.min(im.hits[i], first + SHOCK * Math.pow(d[i] / dMax, 0.85)))
  // a push from (hx, hy): away from where the rock went through, along its way, and out from the letter's middle
  const push = (c, k, hx, hy, g, spread) => {
    let ax = hx - im.x, ay = hy - im.y
    const al = Math.hypot(ax, ay) || 1, bx = hx - c.cxp, by = hy - c.l.y, bl = Math.hypot(bx, by) || 1
    ax = ax / al + ALONG * k * im.dx + (BURST * k * bx) / bl
    ay = ay / al + ALONG * k * im.dy + (BURST * k * by) / bl
    const sp = (hash(g, 11) - 0.5) * spread, ca = Math.cos(sp), sa = Math.sin(sp), ux = ax * ca - ay * sa, uy = ax * sa + ay * ca, ul = Math.hypot(ux, uy) || 1
    return [ux / ul, uy / ul]
  }
  let ids = 0
  const L = cells.map((c, i) => {
    c.white ??= tint(c.cool, WHITE_RGB)
    c.ember ??= tint(c.cool, EMBER_RGB)
    const k = Math.exp(-(((c.cxp - im.x) / (BLAST_REACH * fs)) ** 2)), [nc, nr] = k > 0.55 ? PIECES_NEAR : k > 0.2 ? PIECES_MID : PIECES_FAR
    const sx0 = c.bx - c.x0, ch = c.cool.height, xs = cuts(nc, i * 13 + 1, 0, 1), ys = cuts(nr, i * 13 + 2, 0.08, 0.94), pieces = [], chips = []
    for (let a = 0; a < nc; a++) for (let b = 0; b < nr; b++) {
      const sx = Math.round(sx0 + xs[a] * c.bw), sw = Math.round(sx0 + xs[a + 1] * c.bw) - sx, sy = Math.round(ys[b] * ch), sh = Math.round(ys[b + 1] * ch) - sy
      if (sw < 1 || sh < 1) continue
      const g = i * 16 + a * 4 + b, hx = (c.x0 + sx + sw / 2) / dpr, hy = (c.y0 + sy + sh / 2) / dpr, [ux, uy] = push(c, k, hx, hy, g, 0.9)
      const wake = k > 0.5 && hash(g, 23) < WAKE
      pieces.push({ id: ids++, sx, sy, sw, sh, hx, hy, ux, uy, wake, D: (BLAST_FAR + (BLAST_NEAR - BLAST_FAR) * k) * (0.5 + 0.9 * hash(g, 13)),
        spin: (hash(g, 19) - 0.5) * 2 * TUMBLE * 2 * Math.PI * (0.15 + k), life: SHARD_LIFE * (0.6 + 0.4 * hash(g, 3) + 0.2 * k) * (wake ? 0.7 : 1) })
    }
    for (let j = 0; j < nChips; j++) {
      const g = i * 16 + 12 + j, hx = c.cxp + (hash(g, 5) - 0.5) * 0.8 * c.l.w, hy = c.l.y + (hash(g, 7) - 0.5) * 0.7 * fs, [ux, uy] = push(c, k, hx, hy, g, 1.6)
      chips.push({ hx, hy, ux, uy, D: (BLAST_FAR + (BLAST_NEAR - BLAST_FAR) * k) * (0.8 + hash(g, 13)), life: SHARD_LIFE * 0.5 * (0.6 + 0.4 * hash(g, 3)) })
    }
    const [rx, ry] = im.rock(at[i]) // the rock as this letter breaks, for its wake
    return { k, near: k > 0.35, h0: Math.min(1, 0.3 + 0.75 * k), pieces, chips, rx, ry }
  })
  N.sh = { im, at, L, first, ox, oy, last: Math.max(...at), n: ids }
  return N.sh
}
// where piece p of letter i is, ag screens of scroll after the letter broke, into o: [x, y] css px, before the camera
function pieceXY(sh, im, i, p, ag, o) {
  const L = sh.L[i], sag = 0.5 * SAG * (1 - 0.7 * L.k), e = 1 - Math.exp(-ag / DRAG)
  o[0] = p.hx + p.ux * p.D * e
  o[1] = p.hy + p.uy * p.D * e + sag * ag * ag
  if (p.wake) { // dragged after the rock, a slowing fraction of the way it has gone since
    const [wx, wy] = im.rock(sh.at[i] + WAKE_DRAG * (1 - Math.exp(-ag / WAKE_DRAG)))
    o[0] = p.hx + (wx - L.rx) * WAKE_PULL + p.ux * p.D * e * 0.35
    o[1] = p.hy + (wy - L.ry) * WAKE_PULL + p.uy * p.D * e * 0.35 + 0.3 * sag * ag * ag
  }
  return o
}
// The pieces of the shattered line, for about.js: [{ id, i (its letter), p }]
export const piecesOf = (N, im) => shatterAt(N, im).L.flatMap((L, i) => L.pieces.map((p) => ({ id: p.id, i, p })))
// a piece of letter c (the device-px rect sx, sy, sw, sh of its cell) at heat h (0 = cooled, 1 = white hot), alpha a,
// centred at X, Y (css px), turned by rot, scaled by sc; near: it cools to an ember, else back to its own colour
function drawPiece(x, N, c, near, h, a, sx, sy, sw, sh, X, Y, rot, sc = 1) {
  if (a < 0.01) return
  h = clamp01(h)
  const hi = h >= 0.5, lo = hi ? c.hot : near ? c.ember : c.cool, up = hi ? c.white : c.hot, w = hi ? (h - 0.5) / 0.5 : h / 0.5
  const cr = Math.cos(rot) * sc, sr = Math.sin(rot) * sc
  x.setTransform(cr, sr, -sr, cr, X * N.dpr, Y * N.dpr)
  if (w < 0.99) {
    x.globalAlpha = a * (1 - w)
    x.drawImage(lo, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh)
  }
  if (w > 0.01) {
    x.globalAlpha = a * w
    x.drawImage(up, sx, sy, sw, sh, -sw / 2, -sh / 2, sw, sh)
  }
}
// cam: the camera (about.js cameraAt: css px on screen = k * these + ox, oy). steer(id, copy, o): once piece id is
// whipped away to the about-me (about.js steerOf), it moves o (the piece, or the copy-th fading copy behind it: [x, y]
// css px before the camera) to where it is going, sets o[2] to how far it has been taken (that lights it up again,
// however faded it was), o[3] to how much of its tumble it keeps and o[4] to its size, and returns how much of it is
// left (0..1); < 0 while it isn't taken. null: none is
function drawShatter(x, N, im, s, cam, steer) {
  const { dpr, cells, fs } = N, sh = shatterAt(N, im), GH = [1, 0.32, 0.12], o = [0, 0, 0, 1, 1], K = cam.k
  const chipsLeft = steer ? Math.max(0, steer(-1, 0, o)) : 1 // the chips go as the pieces about.js doesn't want do
  const vx = (v) => v * K + cam.ox, vy = (v) => v * K + cam.oy, lined = K === 1 && !cam.ox && !cam.oy // lined: the line is drawn under these
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  cells.forEach((c, i) => {
    const age = s - sh.at[i], L = sh.L[i], k = L.k, ch = c.cool.height
    const whole = (h, j = 0) => drawPiece(x, N, c, false, h, 1, c.bx - c.x0, 0, c.bw, ch, vx((c.bx + c.bw / 2) / dpr) + j, vy((c.y0 + ch / 2) / dpr), 0)
    if (age < -CRACK) { // not broken yet: it is in the line, unless the camera has moved off it
      if (!lined) whole(0)
      return
    }
    x.setTransform(1, 0, 0, 1, 0, 0)
    x.globalCompositeOperation = 'source-over'
    if (lined) x.clearRect(c.bx, c.y0, c.bw, ch)
    x.globalCompositeOperation = 'lighter'
    if (age < 0) { // heating up: it shivers, and goes from its own colour toward white hot
      whole(L.h0 * smooth(1 + age / CRACK), (hash(i, Math.floor(s * 400)) - 0.5) * 2 * k)
      return
    }
    for (const p of L.pieces) {
      const a = age > p.life ? 0 : 1 - smooth(age / p.life), h = L.h0 * Math.exp(-age / COOL)
      for (let gh = 0; gh < 3; gh++) { // the piece, and while it flies fast (or is whipped away) two fading copies behind it
        const ag = age - gh * 0.008
        pieceXY(sh, im, i, p, Math.max(0, ag), o)
        o[2] = 0
        o[3] = o[4] = 1
        const left = steer ? steer(p.id, gh, o) : -1
        if (gh && left < 0 && (ag <= 0 || age > 2.5 * DRAG)) break
        const aa = left < 0 ? a : Math.max(a, 0.85 * o[2]) * left
        if (aa <= 0) {
          if (left < 0) break // burnt out and not caught: nor are its copies
          continue
        }
        drawPiece(x, N, c, L.near, h, aa * GH[gh], p.sx, p.sy, p.sw, p.sh, vx(o[0]), vy(o[1]), p.spin * (1 - Math.exp(-Math.max(0, ag) / DRAG)) * o[3], o[4])
      }
    }
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    x.font = `500 ${(fs * CHIP_SIZE).toFixed(1)}px ${MONO}`
    for (const q of L.chips) {
      if (age > q.life) continue
      const e = 1 - Math.exp(-age / (0.6 * DRAG)), h = clamp01(1.1 * L.h0 * Math.exp(-age / (0.7 * COOL))), a = 1 - smooth(age / q.life)
      x.globalAlpha = 0.8 * a * chipsLeft
      x.fillStyle = rgb(EMBER_RGB.map((v, n) => Math.round(v + (WHITE_RGB[n] - v) * h)))
      x.fillText(h > 0.75 ? '*' : h > 0.45 ? '+' : h > 0.2 ? "'" : '.', vx(q.hx + q.ux * q.D * e), vy(q.hy + q.uy * q.D * e + 0.5 * SAG * age * age))
    }
  })
  const u = (s - sh.first) / IMPACT_FLASH // the flash where the fire first touched the line
  if (u >= 0 && u < 1) {
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    x.globalCompositeOperation = 'lighter'
    x.globalAlpha = 1
    const R = fs * (0.6 + IMPACT_FLASH_SIZE * Math.sqrt(u)), A = (0.85 * (1 - u) * (1 - u)).toFixed(3), fx = vx(sh.ox), fy = vy(sh.oy)
    const g = x.createRadialGradient(fx, fy, 0, fx, fy, R)
    g.addColorStop(0, `rgba(${WHITE_RGB},${A})`)
    g.addColorStop(0.3, `rgba(${IMPACT_FLASH_RGB},${(A * 0.45).toFixed(3)})`)
    g.addColorStop(1, `rgba(${IMPACT_FLASH_RGB},0)`)
    x.fillStyle = g
    x.fillRect(fx - R, fy - R, 2 * R, 2 * R)
  }
  x.globalAlpha = 1
  x.globalCompositeOperation = 'source-over'
  x.setTransform(1, 0, 0, 1, 0, 0)
}

// Draw the line as far as the scroll s (in screens) has brought it, onto ctx (scaled to css px),
// plus its bloom. h: the hole now (hole() in blackhole.js); t: the clock, for the sweep (null: no sweep).
// impact: the asteroid hitting it (asteroid.js impactOf), or null; the sweep stops once that comes. Once it has
// shattered: cam, the camera the pieces are seen through (about.js cameraAt), and steer, how they are whipped away to
// the about-me (drawShatter; about.js steerOf), or null
const NO_CAM = { k: 1, ox: 0, oy: 0 }
export function drawName(ctx, N, h, s, t, impact = null, cam = NO_CAM, steer = null) {
  const p = progress(s)
  if (p <= 0.0005 || (impact && s > shatterAt(N, impact).last + SHARD_LIFE * 1.2)) return
  const { x, dpr, W, cells, G } = N
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalCompositeOperation = 'source-over'
  x.globalAlpha = 1
  x.clearRect(0, 0, N.cv.width, N.cv.height)
  if (p >= 0.9995) {
    // landed: the finished line, crisp, at native size (once the camera moves off it, its letters are drawn one by one)
    if (!impact || (cam.k === 1 && !cam.ox && !cam.oy)) x.drawImage(N.line.cv, N.line.x, N.line.y)
    if (impact) drawShatter(x, N, impact, s, cam, steer)
    // the sweep: each letter it is on has its slot of the line cleared, then scrambles, then lands again
    else if (t != null) cells.forEach((c, i) => {
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
    drawGlyphs(x, N, buckets)

    // 2. each letter, lit as its stream arrives
    for (const c of cells) {
      const u = clamp01((clamp01((p - LAG * c.a) / (1 - LAG)) - 0.8) / 0.2)
      if (u > 0) lightLetter(x, N, c, u)
    }
  }
  ctx.drawImage(N.cv, 0, 0, N.W, N.H)

  // the bloom: a blurred copy at a third of the size, added on; it swells mid-reveal and while torn apart
  const amt = Math.min(1, GLOW + GLOW_SWELL * (impact ? smooth((s - impact.s) / SHOCK) : Math.sin(Math.PI * p)))
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
