// The about-me, typeset by the debris, and the camera that films it. Right after the asteroid smashes the name, time
// slows to a crawl (bullet time: the rock, its sparks and the name's pieces all but stop) and the camera pushes in on
// the rock, then glides it over to one side. Near things grow a lot, the far hole and sky only a little, drifting
// off-centre; nothing is scaled as a picture: the rock and its fire are drawn bigger on the same letter grid, so its
// craters resolve into more glyphs. The embers its fire sheds write the kicker, and the name's pieces fly to the letters
// of the paragraph beside it, line by line, scrambling as they go, each piece splitting on the way into two letters;
// each locks to its letter as it lands and cools from the fire's blue-white to the text's colour. It holds, readable,
// while the rock tumbles beside it. Then the text cools and drifts apart into embers (away from the hole, never into
// it), and the camera pulls back to a wide shot that frames the hole and the loops the rock is about to go round, while
// time runs on: the capture plays as before, later in the scroll. All a pure function of the scroll; the clock only
// flickers the glyphs in flight. Reduced motion: no camera; the rock fades out as the text fades in where it lands, and back.
import { smooth } from './blackhole'
import { hash, SCRAMBLE, GHOST, GHOST_GAP, piecesOf, pieceAt } from './name'
import { posAt, STORY_END, GONE } from './asteroid'

// ---------- the copy: type your own here ----------
export const ABOUT = {
  kicker: 'about',
  text: 'A short paragraph about you. Where you study, what pulls you in, and what you want to work on next. Two or three sentences is plenty.',
}

// ---------- the beats, in screens of scroll (the asteroid hits the name at 2.68, asteroid.js) ----------
const ZOOM_AT = 2.78 // time starts to slow and the camera to push in (the line has all broken by about here)
const SLOW_IN = 0.18 // screens of scroll for time to slow to CRAWL
const ZOOM_IN = 0.4 // screens of scroll the push in takes (it closes in round the rock where it is)
const PAN_AT = 2.94 // once time has all but stopped, the camera glides the rock over to where it holds it
const PAN = 0.4 // screens of scroll that glide takes
const CRAWL = 0.04 // how fast the story runs while the camera is in, against normal (0.04 = a twenty-fifth)
const BUILD_FROM = 2.98 // the first fragment leaves for its letter (the kicker's)
const BUILD_TO = 3.9 // and the last one lands; the lines in between are spread evenly
const DISPERSE_AT = 4.4 // the text starts to cool and drift apart
const DISPERSE = 0.3 // screens of scroll each letter takes to burn out
const DISPERSE_SPREAD = 0.15 // and how far apart, in screens of scroll, the letters start to go
const PULL_AT = 4.5 // the camera starts to pull back and time to speed up again
const PULL = 0.5 // screens of scroll that takes; then the story runs on as before, later by the time it was held
// ---------- the camera ----------
const ROCK_SIZE = 0.34, ROCK_SIZE_PHONE = 0.42 // the rock close up: its diameter, in screen heights (phones: in screen widths)
const ROCK_AT = [0.72, 0.46], ROCK_AT_PHONE = [0.6, 0.22] // where the camera holds it, in screen widths and heights
const CREEP = [-0.02, 0.02] // how far it still creeps on while held, in screen widths and heights per screen of scroll
const FAR_ZOOM = 1.12 // how much bigger the hole and the sky get at the closest (far away: a little)
const PARALLAX = 0.2 // how much of the camera's pan the hole and the sky follow: 0 = none, 1 = as much as the rock
// the wide shot it pulls back to, for the capture: the hole and the loops round it framed, moved only as far as that needs
const FRAME_MARGIN = 0.05, FRAME_MARGIN_X = 0.03 // room kept clear round the loops and the arch over the hole: screen heights, widths
const FRAME_ZOOM_MAX = 1.2 // the most it moves in on the hole when there is room (it never moves out)
// ---------- the text ----------
const TEXT_BOX = [0.07, 0.25, 0.44], TEXT_BOX_PHONE = [0.08, 0.5, 0.84] // its left edge, top and width: screen widths, heights, widths
const FONT_MIN = 14, FONT_MAX = 24 // its size, px; in between it follows the screen (a 64th of its width or a 40th of its height, the smaller)
const MAX_COLS = 48 // the longest a line gets, in characters
const LINE_GAP = 1.65 // line height, in font sizes
const KICKER_GAP = 0.5 // extra room under the kicker, in lines
const TEXT_RGB = [236, 232, 240], KICKER_RGB = [255, 177, 90] // the paragraph and the kicker, as the name's line and name
const HOT_RGB = [235, 248, 255], ICE_RGB = [110, 180, 255] // a fragment in flight, white hot as it leaves, cooling to blue
const EMBER_RGB = [235, 92, 34] // a letter burning out
const FLIGHT = 0.2 // screens of scroll a fragment takes to reach its letter
const LINE_SPREAD = 0.1 // screens of scroll over which a line's fragments leave, left to right
const SPLIT = 2 // how many letters each piece of the name splits into on the way (when they run out, the fire sheds embers for the rest)
const KICKER_BY_FIRE = true // the kicker is written by embers the rock's fire sheds, the paragraph by the name's pieces
const SPLIT_AT = 0.4 // how far into its flight a piece splits
const SPLIT_SPREAD = 0.12 // how far its halves fork apart, in flight lengths
const ARC = 0.22 // how far a flight bows to one side, in flight lengths
const FLIGHT_RATE = 16 // how often a glyph in flight changes, a second
const LAND_COOL = 0.1 // screens of scroll a landed letter takes to cool to its colour
const DRIFT = 0.1 // how far the burning-out letters drift, in screen heights (up, and away from the hole)
const BACKDROP = 0.6 // how much the gas and stars behind the text dim while it is up: 0 = not at all, 1 = black
const GLOW = 0.3 // the bloom round the text

const PHONE = 700
const MONO = '"JetBrains Mono", Menlo, Consolas, monospace'
const RAMP = ['.', ':', '+', '*', '#'] // the ticks a letter steps through just before it lands, as the name's do
const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoother = (x) => { x = c01(x); return x * x * x * (x * (6 * x - 15) + 10) }
const ease = (x) => 1 - (1 - x) * (1 - x)
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k))
const NO_CAM = { k: 1, ox: 0, oy: 0, a: 1, kf: 1, fox: 0, foy: 0 }

// ---------------- time and the camera ----------------
const I = (u) => u * u * u * (1 - u / 2) // the area under smooth() from 0 to u
// Where the asteroid's story (asteroid.js, and the name's shatter) has got to at scroll s: s itself up to ZOOM_AT; then
// it slows to CRAWL while the camera is in, and runs at full speed again once it has pulled back, DELAY behind
export function storyOf(s) {
  if (s <= ZOOM_AT) return s
  const u1 = c01((s - ZOOM_AT) / SLOW_IN), u3 = c01((s - PULL_AT) / PULL)
  const held = SLOW_IN * I(u1) + Math.max(0, Math.min(s, PULL_AT) - ZOOM_AT - SLOW_IN) + PULL * (u3 - I(u3))
  return s - (1 - CRAWL) * held
}
const DELAY = (1 - CRAWL) * (SLOW_IN / 2 + PULL_AT - ZOOM_AT - SLOW_IN + PULL / 2)
export const ROOM_END = STORY_END + DELAY // the page's scroll room, in screens
// how close the camera is, and how far over it has glided, 0..1; both go back as it pulls back
const pulled = (s) => smoother((s - PULL_AT) / PULL)
const closeness = (s) => smoother((s - ZOOM_AT) / ZOOM_IN) * (1 - pulled(s))
const panned = (s) => smoother((s - PAN_AT) / PAN) * (1 - pulled(s))

// The camera at scroll s. Near things (the rock, its fire, the name's pieces): on screen = k * scene + ox, oy; a: how
// much of the rock shows. Far things (the hole, the sky): kf * scene + fox, foy. X: the layout (createAbout); T: the asteroid's.
// Two moves, one on the other: the wide shot (the page as it was, easing into X.frame as the camera pulls back), and the
// push in on the rock from it, with parallax
export function cameraAt(X, T, s) {
  const c = closeness(s), g = X.reduced ? 0 : pulled(s)
  if (c <= 0 && g <= 0) return NO_CAM
  if (X.reduced) return { ...NO_CAM, a: 1 - c }
  const kb = 1 + (X.frame.k - 1) * g, bx = X.frame.x * g, by = X.frame.y * g // the wide shot: on screen = kb * scene + bx, by
  if (c <= 0) return { k: kb, ox: bx, oy: by, a: 1, kf: kb, fox: bx, foy: by }
  const [wx, wy] = posAt(T, storyOf(s)), fx = wx * kb + bx, fy = wy * kb + by // the rock, in the wide shot
  const k = 1 + (X.k - 1) * c, kf = 1 + (FAR_ZOOM - 1) * c, held = s - ZOOM_AT, m = panned(s)
  const px = fx + (X.at[0] + X.creep[0] * held - fx) * m, py = fy + (X.at[1] + X.creep[1] * held - fy) * m // and on screen
  return { k: k * kb, ox: k * (bx - fx) + px, oy: k * (by - fy) + py, a: 1,
    kf: kf * kb, fox: kf * (bx - fx) + fx + (px - fx) * PARALLAX, foy: kf * (by - fy) + fy + (py - fy) * PARALLAX }
}
// the hole h (blackhole.js hole()) seen through the camera
export function farOf(h, cam) {
  if (cam.kf === 1 && !cam.fox && !cam.foy) return h
  return { ...h, cx: h.cx * cam.kf + cam.fox, cy: h.cy * cam.kf + cam.foy, R: h.R * cam.kf, dive: h.dive * cam.kf }
}

// ---------------- layout ----------------
function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}
// greedy word wrap to cols characters
function wrap(text, cols) {
  const out = []
  let line = ''
  for (const w of text.split(/\s+/)) {
    if (line && line.length + 1 + w.length > cols) {
      out.push(line)
      line = w
    } else line = line ? `${line} ${w}` : w
  }
  if (line) out.push(line)
  return out
}
const bez = (a, b, c, d, u) => { const v = 1 - u; return v * v * v * a + 3 * v * v * u * b + 3 * v * u * u * c + u * u * u * d }

// Lay the text out for this screen, and work out every flight: which piece of the name (or which ember off the rock)
// goes to which letter, when it leaves and lands. W, H, dpr: the screen; N: the name (name.js createName); T: the
// asteroid (asteroid.js createAsteroid); reduced: prefers reduced motion
export function createAbout(W, H, dpr, N, T, reduced) {
  const phone = W < PHONE, snap = (v) => Math.round(v * dpr) / dpr
  const [cv, x] = canvas(Math.round(W * dpr), Math.round(H * dpr))
  const [glow, gx] = canvas(Math.max(1, Math.round(W / 3)), Math.max(1, Math.round(H / 3)))
  const fs = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX, W / 64, H / 40))), font = `500 ${fs}px ${MONO}`
  x.font = font
  const cw = x.measureText('M').width, lh = fs * LINE_GAP, [bl, bt, bw] = phone ? TEXT_BOX_PHONE : TEXT_BOX
  const left = bl * W, top = bt * H, cols = Math.max(12, Math.min(MAX_COLS, Math.floor((bw * W) / cw)))
  const lines = [[ABOUT.kicker, true], ...wrap(ABOUT.text, cols).map((l) => [l, false])]
  const slots = []
  let y = top + lh / 2
  lines.forEach(([str, kick], L) => {
    ;[...str].forEach((ch, col) => {
      if (ch !== ' ') slots.push({ ch, kick, L, col, x: snap(left + (col + 0.5) * cw), y: snap(y), j: slots.length })
    })
    y += lh * (kick ? 1 + KICKER_GAP : 1)
  })
  // the dimmed patch behind it: a soft black box, drawn once, small
  const [back, bx] = canvas(Math.max(1, Math.round(W / 4)), Math.max(1, Math.round(H / 4)))
  bx.filter = 'blur(8px)'
  bx.fillStyle = '#000'
  bx.fillRect((left - 2 * cw) / 4, (top - lh) / 4, (cols * cw + 4 * cw) / 4, (y - top + lh) / 4)
  bx.filter = 'none'

  const X = { W, H, dpr, reduced, cv, x, glow, gx, back, font, fs, slots, groups: [], depOf: null,
    k: (phone ? ROCK_SIZE_PHONE * W : ROCK_SIZE * H) / (2 * T.ball * T.rr), at: phone ? [ROCK_AT_PHONE[0] * W, ROCK_AT_PHONE[1] * H] : [ROCK_AT[0] * W, ROCK_AT[1] * H],
    creep: [CREEP[0] * W, CREEP[1] * H], hole: [T.P.cx, T.P.cy], frame: frameOf(T, W, H) }

  // when each letter's fragment leaves: line by line, each line left to right
  const step = lines.length > 1 ? (BUILD_TO - BUILD_FROM - LINE_SPREAD - 1.15 * FLIGHT) / (lines.length - 1) : 0
  for (const q of slots) q.dep = BUILD_FROM + q.L * step + (q.col / cols) * LINE_SPREAD + 0.012 * hash(q.j, 41)
  // the name's pieces still there when the text is building, nearest the text first
  const im = T.impact, mid = [left + (cols * cw) / 2, (top + y) / 2], c0 = cameraAt(X, T, BUILD_FROM), s0 = storyOf(BUILD_FROM), all = piecesOf(N, im)
  const pieces = all.map((f) => {
    const q = pieceAt(N, im, f, s0)
    return { f, d: Math.hypot(q.x * c0.k + c0.ox - mid[0], q.y * c0.k + c0.oy - mid[1]), ok: pieceAt(N, im, f, storyOf(BUILD_TO)).left > 0.2 }
  }).filter((p) => p.ok).sort((a, b) => a.d - b.d)
  X.depOf = new Float64Array(all.length).fill(Infinity) // ids run 0 .. all.length - 1
  // each piece takes the next SPLIT letters of a line; the kicker's letters, and any left once they run out, are embers off the rock, one each
  let pi = 0
  for (let j = 0; j < slots.length;) {
    const q = slots[j], f = (KICKER_BY_FIRE && q.kick) || pi >= pieces.length ? null : pieces[pi++].f, kids = [q]
    while (f && kids.length < SPLIT && j + kids.length < slots.length && slots[j + kids.length].L === q.L) kids.push(slots[j + kids.length])
    j += kids.length
    const g = { f, kids, dep: q.dep }, cam = cameraAt(X, T, g.dep), sa = storyOf(g.dep)
    if (f) {
      const p = pieceAt(N, im, f, sa)
      g.sx = p.x * cam.k + cam.ox
      g.sy = p.y * cam.k + cam.oy
      X.depOf[f.id] = g.dep
    } else { // an ember off the edge of the rock's fire, on the side facing its letter
      const [rx, ry] = posAt(T, sa), RX = rx * cam.k + cam.ox, RY = ry * cam.k + cam.oy, dx = q.x - RX, dy = q.y - RY, dl = Math.hypot(dx, dy) || 1
      const rim = T.ball * T.rr * cam.k * (1.15 + 0.5 * hash(q.j, 43))
      g.sx = RX + (dx / dl) * rim
      g.sy = RY + (dy / dl) * rim
    }
    // the flight: a cubic to each letter, bowed to one side; the halves of a split piece fork apart after SPLIT_AT
    const ex = q.x - g.sx, ey = q.y - g.sy, el = Math.hypot(ex, ey) || 1, nx = -ey / el, ny = ex / el, bow = ARC * el * (hash(q.j, 44) < 0.5 ? -1 : 1) * (0.6 + 0.4 * hash(q.j, 45))
    g.c1 = [g.sx + ex * 0.3 + nx * bow, g.sy + ey * 0.3 + ny * bow]
    kids.forEach((kq, ci) => {
      const fork = (ci - (kids.length - 1) / 2) * SPLIT_SPREAD * el
      kq.c2 = [kq.x - ex * 0.3 + nx * (bow * 0.4 + fork), kq.y - ey * 0.3 + ny * (bow * 0.4 + fork)]
      kq.land = g.dep + FLIGHT * (0.85 + 0.3 * hash(kq.j, 42))
      kq.gone = DISPERSE_AT + DISPERSE_SPREAD * hash(kq.j, 51)
      const hx = kq.x - X.hole[0], hy = kq.y - X.hole[1], hl = Math.hypot(hx, hy) || 1, sp = (hash(kq.j, 52) - 0.5) * 1.2
      const ux = (0.6 * hx) / hl + sp, uy = (0.6 * hy) / hl - 0.8, ul = Math.hypot(ux, uy) || 1 // up, and away from the hole
      kq.drift = [(ux / ul) * DRIFT * H * (0.5 + hash(kq.j, 53)), (uy / ul) * DRIFT * H * (0.5 + hash(kq.j, 53))]
    })
    X.groups.push(g)
  }
  return X
}

// The wide shot for the capture, { k, x, y }: on screen = k * scene + x, y. The loops the rock goes round from the end
// of the pull back until it is gone (its centre, padded by the rock and its fire) and the arch over the hole, kept
// FRAME_MARGIN clear of the edges, as near as can be to where the page left them; the hole stays centred across
function frameOf(T, W, H) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity
  for (let sa = storyOf(PULL_AT + PULL); sa <= GONE; sa += 0.005) {
    const [x, y] = posAt(T, sa)
    x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y)
  }
  const pad = 1.3 * T.ball * T.rr, cx = T.P.cx, cy = T.P.cy, mx = FRAME_MARGIN_X * W, my = FRAME_MARGIN * H
  const top = Math.min(y0 - pad, cy - 1.85 * T.P.R), bot = y1 + pad, half = Math.max(cx - x0, x1 - cx) + pad // 1.85: blackhole.js REST_TOP
  const k = Math.max(1, Math.min(FRAME_ZOOM_MAX, (H - 2 * my) / (bot - top), (W / 2 - mx) / half))
  const lo = my - k * top, hi = H - my - k * bot // the room it has to move up or down in
  return { k, x: W / 2 - k * cx, y: lo <= hi ? Math.min(hi, Math.max(lo, cy * (1 - k))) : (H - k * (top + bot)) / 2 }
}

// How much of each of the name's pieces is still the name's at scroll s (0: it has gone to its letter), for name.js
// drawName; null before any has gone
export function awayOf(X, s) {
  if (s < BUILD_FROM || !X) return null
  const fade = X.reduced ? FLIGHT : 0.02
  return (id) => (id < X.depOf.length ? 1 - smooth((s - X.depOf[id]) / fade) : 1)
}

// ---------------- drawing ----------------
// Over everything: the text, as far as the scroll s has built it, and the glyphs on their way to it. t: the clock
export function drawAbout(ctx, X, s, t) {
  if (s < BUILD_FROM || s > DISPERSE_AT + DISPERSE_SPREAD + DISPERSE) return
  const { x, dpr, W, H } = X, step = Math.floor(t * FLIGHT_RATE), red = X.reduced
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalCompositeOperation = 'source-over'
  x.globalAlpha = 1
  x.clearRect(0, 0, X.cv.width, X.cv.height)
  x.setTransform(dpr, 0, 0, dpr, 0, 0)
  x.globalCompositeOperation = 'lighter'
  x.font = X.font
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  const put = (ch, px, py, c, a) => {
    if (a < 0.02) return
    x.fillStyle = `rgba(${c},${Math.min(1, a).toFixed(3)})`
    x.fillText(ch, px, py)
  }
  for (const g of X.groups) {
    if (s < g.dep) continue
    g.kids.forEach((q, ci) => {
      const base = q.kick ? KICKER_RGB : TEXT_RGB, f = (s - g.dep) / (q.land - g.dep)
      if (red) { // reduced motion: it fades in where it lands, and out where it was
        put(q.ch, q.x, q.y, base, smooth(f) * (1 - smooth((s - q.gone) / DISPERSE)))
        return
      }
      if (f < 1) { // in flight: scrambling, then ticking up to its letter as it arrives, a fading trail behind it
        for (let k = 0; k < GHOST.length; k++) {
          const fk = f - k * GHOST_GAP * 1.5
          if (fk <= 0 || (ci && fk < SPLIT_AT)) break // a split piece's other half rides with the first until it splits
          const u = ease(fk), px = bez(g.sx, g.c1[0], q.c2[0], q.x, u), py = bez(g.sy, g.c1[1], q.c2[1], q.y, u)
          const ch = fk < 0.8 ? SCRAMBLE[Math.floor(hash(q.j * 4 + k, step) * SCRAMBLE.length)] : RAMP[Math.min(4, Math.floor(((fk - 0.8) / 0.2) * 5))]
          put(ch, px, py, mix(HOT_RGB, ICE_RGB, smooth(fk / 0.7)), GHOST[k] * smooth(fk / 0.04) * (k ? 0.8 : 1.15))
        }
        if (ci === 1 && f > SPLIT_AT && f < SPLIT_AT + 0.1) { // the spark where it splits
          const u = ease(SPLIT_AT)
          put('*', bez(g.sx, g.c1[0], q.c2[0], q.x, u), bez(g.sy, g.c1[1], q.c2[1], q.y, u), HOT_RGB, 1 - (f - SPLIT_AT) / 0.1)
        }
        return
      }
      // landed: locked to its letter, cooling from white hot to its own colour; then it burns out and drifts off
      const hot = Math.exp(-(s - q.land) / (0.35 * LAND_COOL)) * (1 - smooth((s - q.land) / LAND_COOL))
      const r = c01((s - q.gone) / DISPERSE)
      if (r <= 0) {
        put(q.ch, q.x, q.y, mix(base, HOT_RGB, hot), 1 + 0.4 * hot)
        return
      }
      const e = 1 - Math.exp(-3 * r), ch = r < 0.3 ? q.ch : r < 0.5 ? '*' : r < 0.7 ? '+' : r < 0.85 ? "'" : '.'
      put(ch, q.x + q.drift[0] * e, q.y + q.drift[1] * e, mix(base, EMBER_RGB, smooth(r / 0.4)), 1 - smooth(r))
    })
  }
  // the dimmed patch behind the text, then the text, then its bloom
  const up = smooth((s - BUILD_FROM) / 0.3) * (1 - smooth((s - DISPERSE_AT) / (DISPERSE_SPREAD + DISPERSE)))
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = BACKDROP * up
  if (ctx.globalAlpha > 0.005) ctx.drawImage(X.back, 0, 0, W, H)
  ctx.globalAlpha = 1
  ctx.drawImage(X.cv, 0, 0, W, H)
  const { glow, gx } = X
  gx.clearRect(0, 0, glow.width, glow.height)
  gx.filter = 'blur(3px)'
  gx.drawImage(X.cv, 0, 0, glow.width, glow.height)
  gx.filter = 'none'
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = GLOW
  ctx.drawImage(glow, 0, 0, W, H)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
