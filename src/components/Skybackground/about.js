// The about-me, written by the falling asteroid, and the camera that films it. Right after the asteroid smashes the
// name, time slows (it keeps falling, slowly) and the camera pushes in on the rock and glides it onto a track down the
// screen, the way it is falling; nothing is scaled as a picture: the rock and its fire are drawn bigger on the same letter
// grid. A few of the name's pieces whip across, streaked, and wait, small and dim and upright, beside the places their
// letters will take; the rest fade away. Then the rock writes the about-me as it falls: as it passes each line, the line
// types itself left to right, each letter scrambling briefly in its own place and locking white hot, then cooling to its
// colour; a waiting piece slides into its letter as it locks. Wide screens have the text in a block beside the rock's
// path; tall ones (asteroid.js TALL) hold the rock up in the screen and have the text in a column below it, typing in a
// wave down from it (TALL_*). It holds, still and readable, while the rock comes to rest near the hole
// (which sinks out of the text's way), the asteroid's glyph field parting round the type; then, as the rock moves on, the
// letters break up into the tail's own glyphs and are drawn into its tail, streaming away down it (never toward the
// hole), and the rock is released: time speeds back up, the rock gets going from rest round the hole and into it
// (asteroid.js setInfall), and the camera hands over to one that follows it in, keeping it and the hole in frame
// (asteroid.js followAt). All a pure function of the scroll. Reduced motion: no camera; the rock fades out while the
// text fades in, line by line, and back.
import { smooth, POOLS } from './blackhole'
import { hash, piecesOf, bigger } from './name'
import { pathAt, setInfall, followAt, INFALL, BLUE, DUST, stroke, FRAME_PAD, tallOf } from './asteroid'

// ---------- the copy: type your own here ----------
export const ABOUT = {
  kicker: 'about',
  text: 'A short paragraph about you. Where you study, what pulls you in, and what you want to work on next. Two or three sentences is plenty.',
}

// ---------- the beats, in screens of scroll (the asteroid hits the name at 2.68, asteroid.js) ----------
const ZOOM_AT = 2.78 // time starts to slow and the camera to push in (the line has all broken by about here)
const SLOW_IN = 0.18 // screens of scroll for time to slow to WRITE_RATE
const WRITE_RATE = 0.3 // how fast the story runs while the rock writes, against normal: it keeps falling, slowly
const WHIP_FROM = 2.8, WHIP_TO = 2.98 // the wanted pieces of the name whip across between these; the rest fade away
const WRITE_FROM = 3 // the camera is in and the rock on its track: it starts writing (the top line)
const WRITE_TO = 3.85 // and the last letter has locked; then the text holds while the rock comes to rest near the hole
const CLEAR_AT = 4.4 // the rock is released: it moves on, and the letters start to dissolve into its tail, those nearest it first
const DISSOLVE = 0.35 // screens of scroll each takes, from breaking up to gone down the tail
const CLEAR_SPREAD = 0.15 // from the first letter going to the last
const PULL = 0.5 // screens of scroll time takes to get back to full speed after the release (the rock's tumble; its fall keeps its own pace)
// ---------- the camera ----------
const WRITE_ZOOM = 1.3 // how much nearer the camera is while the rock writes (it pushes in from ZOOM_AT to WRITE_FROM)
const V_MIN = 0.12 // the slowest the rock falls down the screen while it writes, in screen heights per screen of scroll
const HOLD_EASE = 0.2 // after the last letter the rock slows and comes to rest near the hole, in about three times this, screens of scroll
const EDGE_SOFT = 0.5 // the rock keeps inside the frame (asteroid.js FRAME_PAD, its whole radius in), the camera bending its track or panning
// after it as it nears an edge: this many of its radii before it gets there (0 = a sharp turn)
const EDGE_EASE = 0.3 // screens of scroll after the release over which the camera following it comes to do that too
const DRIFT_MAX = 0.3 // the most the hole drifts on against the rock after the release (the hold's parallax, carried on), in its radii, so
// the rock goes round it the way its orbit was planned (it only reaches this on tall screens, where the hole is small)
const FAR_IN = 0.5 // screens of scroll the hole and the sky take to come nearer and sink, from ZOOM_AT (slower than the push in)
const FAR_ZOOM = 1.08 // how much bigger the hole and the sky get at the closest (far away: a little)
const PARALLAX = 0.2 // how much of the camera's pan the hole and the sky follow: 0 = none, 1 = as much as the rock
// ---------- the name's pieces ----------
const PIECES = 28, PIECES_TALL = 18 // how many of them become letters (wide screens, tall ones); the others fade away
const WHIP = 0.16 // screens of scroll a piece takes to whip across to where it waits
const WAIT_CELLS = 2.5 // where it waits: level with its letter, this many character cells to its right
const WAIT_SIZE = 0.6, WAIT_ALPHA = 0 // how big and how bright it is while it waits, against itself (0 = it streaks over and dies out as it arrives)
const SLIDE = 0.05 // screens of scroll it takes to slide into its letter's place, shrinking and fading, as the letter locks
const STREAK = 0.012 // screens of scroll between a moving piece and each fading copy behind it (its streak)
// ---------- the text ----------
const TEXT_RIGHT = 0.06 // wide screens (the text beside the rock's path): its right margin, in screen widths
const TEXT_MAX_W = 0.5 // and the most of the screen's width it takes
const TEXT_SIDE_TALL = 0.07 // tall screens: the least margin either side, in screen widths
const TEXT_BOTTOM = 0.06 // how far above the bottom edge the text stops, in screen heights (wide screens: it starts level with the rock)
const FIRE_CLEAR = 2.3 // how far the text keeps from the rock's centre, in its radii (its fire reaches about 1.7, its glow a little more)
const HOLE_CLEAR = 0.03 // how far it keeps above the hole's light, in screen heights (the hole sinks out of its way while the camera is in)
const ROCK_CLEAR = 0.9 // and how far the rock's edge keeps from the hole's centre while it writes and rests, in the hole's radii (it sinks
// further if need be: tall screens, where the hole is small against the rock). 1 = its edge at the shadow's; 1.7 clears the arch's bright
// core too, but then the rock has further to go round once it is released, and on phones goes about 7% faster and turns 17% quicker
const FONT_MIN = 15, FONT_MAX = 28 // its size, px: as big as fits, up to a 56th of the screen's width (tall screens: a 26th) or a 34th of its height
// (tall screens: TALL_FONT_H) (FONT_MAX grows on screens past 1080p: name.js BIG_W, BIG_H)
const MAX_COLS = 46 // the longest a line gets, in characters
const LINE_GAP = 1.6 // line height, in font sizes
const LINE_GAP_MIN = 1.35 // the tightest it gets, when the text is too long to fit otherwise
const KICKER_GAP = 0.8 // extra room under the kicker, in lines
const TEXT_RGB = [236, 232, 240], KICKER_RGB = [255, 177, 90] // the paragraph and the kicker, as the name's line and name
const HOT_RGB = [255, 250, 242] // a letter as it locks, white hot
const LINE_SWEEP = 0.08 // screens of scroll a line takes to type, left to right, once the rock has passed it
const SCRAMBLE = 0.03 // screens of scroll a letter scrambles in its place before it locks
const SWAPS = 3 // how many glyphs it shows in that time
const SCRAMBLE_ALPHA = 0.4 // how bright, against the locked text
const SCRAMBLE_SET = 'acemnorsuvxz' // what it shows: lowercase, the text's own weight
const COOL = 0.1 // screens of scroll a locked letter takes to cool from white hot to its colour
const KNOCKOUT = 0.6 // under each written line the asteroid's glyph field parts: the share of its cells left out (0 = off, 1 = all)
const FRAY = 1.5 // and over how many of the hole's cells past the type that thins out to none
// the dissolve: each letter breaks into the tail's own glyphs, which are drawn into the tail and stream away down it
const MOTES = 2 // how many glyphs each letter breaks into
const BREAK = 0.15 // how far into its dissolve the type has gone, its glyphs in its place
const JOIN = [0.12, 0.45] // when they are drawn into the tail: from, and over, as shares of the dissolve; then they stream down it
const FLOW = 0.6 // how far down the tail they have streamed by the end, in screen heights (speeding up)
const IN_TAIL = 0.3 // how far off the tail's middle they stream, at most, in rock radii
const HOLE_KEEP = 2.5 // they only join the tail where it, and all of it further back, is this far from the hole's centre, in its radii
const PATH_KEEP = 1.8 // and only where the way there keeps this far from it, in its radii (else they fade where they are)
const LIGHT_FADE = 0.05 // any that still get into the room kept over the hole's light (holeTop: 0.15 of its radii) fade out over this much of it
const SMEAR = 0.006 // screens of scroll between a streaming glyph and the faint copy of it behind
const GLOW = 0.25 // the bloom round the text (the name's, name.js GLOW)
// ---------- tall screens (asteroid.js TALL: phones, upright tablets): the rock rests in the upper part of the screen, its
// tail trailing up off the top; the text is a column below it, between it and the hole, typing in a wave spreading down
// from the rock; at the release the rock dives down through it into its orbit ----------
const TALL_ROCK_X = 0.5, TALL_ROCK_Y = 0.28 // where the rock is held as it starts writing: its centre, in screen widths from the left and heights from the top
const TALL_FALL = 0.04 // how far it keeps falling the way it was going while it writes, in screen heights per screen of scroll (then it comes to rest)
const TALL_FONT_H = 54 // the text's size: a 54th of the screen's height (a phone's), no more than a 26th of its width, FONT_MIN to FONT_MAX
const TALL_COLS = 36 // the longest a line gets, in characters (the column is centred on the screen)
const TALL_WAVE = 0.5 // the shape of the wave the letters lock in: 0 = straight across, a line at a time from the top; 1 = rings round the rock

const MONO = '"JetBrains Mono", Menlo, Consolas, monospace'
const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoother = (x) => { x = c01(x); return x * x * x * (x * (6 * x - 15) + 10) }
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k))
const NO_CAM = { k: 1, ox: 0, oy: 0, a: 1, kf: 1, fox: 0, foy: 0 }

// ---------------- time and the camera ----------------
const I = (u) => u * u * u * (1 - u / 2) // the area under smooth() from 0 to u
// Where the asteroid's story (asteroid.js, and the name's shatter) has got to at scroll s: s itself up to ZOOM_AT; then
// it slows to WRITE_RATE while the camera is in, and runs at full speed again once the rock is released
export function storyOf(s) {
  if (s <= ZOOM_AT) return s
  const u1 = c01((s - ZOOM_AT) / SLOW_IN), u3 = c01((s - CLEAR_AT) / PULL)
  const held = SLOW_IN * I(u1) + Math.max(0, Math.min(s, CLEAR_AT) - ZOOM_AT - SLOW_IN) + PULL * (u3 - I(u3))
  return s - (1 - WRITE_RATE) * held
}
export const ROOM_END = CLEAR_AT + INFALL // the page's scroll room, in screens: the release, then the rock's fall (asteroid.js INFALL)
// how close the camera is, and how far onto the rock's track it has glided, 0..1; both go back as time speeds up
const pulled = (s) => smoother((s - CLEAR_AT) / PULL)
const closeness = (s) => smoother((s - ZOOM_AT) / (WRITE_FROM - ZOOM_AT)) * (1 - pulled(s))
const farness = (s) => smoother((s - ZOOM_AT) / FAR_IN) * (1 - pulled(s)) // the same for the far things
// how far the hole has sunk out of the text's way: it only comes back up once the last letter has gone
const sunk = (s) => smoother((s - ZOOM_AT) / FAR_IN) * (1 - smoother((s - CLEAR_AT - CLEAR_SPREAD - 1.1 * DISSOLVE) / PULL))
// where the camera holds the rock on screen at scroll s: down its track at the writing's pace, then slowing to rest
function trackAt(X, s) {
  const u = X.r0 + (s <= WRITE_TO ? X.v * (s - WRITE_FROM) : X.v * (WRITE_TO - WRITE_FROM + HOLD_EASE * (1 - Math.exp(-(s - WRITE_TO) / HOLD_EASE))))
  return [inside(X.start[0] + X.dir[0] * u, X.W, X.rock), inside(X.start[1] + X.dir[1] * u, X.H, X.rock)]
}
// a rock of radius r centred at v kept in frame across a screen L wide (FRAME_PAD, then r), easing in over EDGE_SOFT radii
// (no kink where it starts)
function inside(v, L, r) {
  const lo = FRAME_PAD * L + r, k = Math.max(1e-6, EDGE_SOFT * r)
  if (v < lo + k) return lo + k * Math.exp((v - lo) / k - 1)
  if (v > L - lo - k) return L - lo - k * Math.exp((L - lo - v) / k - 1)
  return v
}

// The camera at scroll s. Near things (the rock, its fire, the name's pieces): on screen = k * scene + ox, oy; a: how
// much of it shows. Far things (the hole, the sky): kf * scene + fox, foy. X: the layout (createAbout); T: the
// asteroid's. Until the release: the page as it was, and the push in from it onto the rock's track, with parallax, the
// hole sinking X.sink px. From the release, the camera that follows the rock in (asteroid.js followAt), which takes the
// screen as it was then (X.rel) and moves it: on screen = centre + z * (that - aim), the hole grown about the rock by g;
// the hold's own slow drift (X.drift) carries on, dying away as it takes over (the hole's, against the rock, to no more
// than DRIFT_MAX); and it pans after the rock if it nears an edge (EDGE_SOFT)
export function cameraAt(X, T, s) {
  const F = X.rel && s > CLEAR_AT && !X.reduced ? followAt(T, storyOf(s)) : null
  if (F) {
    const R = X.rel, D = X.drift, x = s - CLEAR_AT, u = x * (1 - F.h), cap = DRIFT_MAX * T.P.R * R.kf * F.z * F.g
    const dd = Math.hypot(D.fox - D.x + T.P.cx * D.kf, D.foy - D.y + T.P.cy * D.kf) * u, w = u / Math.pow(1 + (dd / Math.max(1e-6, cap)) ** 4, 0.25)
    const mx = X.W / 2 - F.z * F.x, my = X.H / 2 - F.z * F.y, k = F.z * R.k, ox = F.z * R.ox + mx + D.x * u, oy = F.z * R.oy + my + D.y * u
    const P = pathAt(T, storyOf(s), 0), r = T.ball * T.rr * k, e = smoother(x / EDGE_EASE), rx = P.x * k + ox, ry = P.y * k + oy
    const dx = (inside(rx, X.W, r) - rx) * e, dy = (inside(ry, X.H, r) - ry) * e
    return { k, ox: ox + dx, oy: oy + dy, a: 1, kf: F.z * F.g * R.kf + D.kf * w,
      fox: F.z * (F.g * R.fox + (1 - F.g) * F.px) + mx + D.x * u + (D.fox - D.x) * w + dx, foy: F.z * (F.g * R.foy + (1 - F.g) * F.py) + my + D.y * u + (D.foy - D.y) * w + dy }
  }
  const c = closeness(s)
  if (c <= 0 && sunk(s) <= 0) return NO_CAM
  if (X.reduced) return { ...NO_CAM, a: 1 - c, foy: X.sink * sunk(s) } // no zoom: the rock fades out, the hole only sinks out of the text's way
  if (c <= 0) return { ...NO_CAM, foy: X.sink * sunk(s) }
  const W0 = pathAt(T, storyOf(s), 0), [tx, ty] = trackAt(X, s) // the rock as the page has it; its track
  const k = 1 + (X.k - 1) * c, cf = farness(s), kf = 1 + (FAR_ZOOM - 1) * cf, px = W0.x + (tx - W0.x) * c, py = W0.y + (ty - W0.y) * c // and on screen
  return { k, ox: px - k * W0.x, oy: py - k * W0.y, a: 1,
    kf, fox: (1 - kf) * W0.x + (px - W0.x) * PARALLAX * cf, foy: (1 - kf) * W0.y + (py - W0.y) * PARALLAX * cf + X.sink * sunk(s) }
}
// the hole h (blackhole.js hole()) seen through the camera
export function farOf(h, cam) {
  if (cam.kf === 1 && !cam.fox && !cam.foy) return h
  return { ...h, cx: h.cx * cam.kf + cam.fox, cy: h.cy * cam.kf + cam.foy, R: h.R * cam.kf, dive: h.dive * cam.kf }
}
// how far above the hole's centre its light reaches, dx from it across, both in its radii: the arch over the shadow,
// then the disk out to its tips (blackhole.js REST_TOP, REST_HALF_WIDTH, with a little to spare)
const holeTop = (dx) => { const a = Math.abs(dx); return a < 2.6 ? 1.95 * Math.sqrt(1 - (a / 2.6) ** 2) + 0.15 : a < 5.1 ? 0.5 : 0 }

// ---------------- layout ----------------
function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

// Lay the text out for this screen and work out the writing: where the rock's track runs, when each line types and
// each letter locks, and which of the name's pieces wait for which letters. W, H, dpr: the screen; N: the name (name.js
// createName); T: the asteroid (asteroid.js createAsteroid); reduced: prefers reduced motion; copy: the text
export function createAbout(W, H, dpr, N, T, reduced, copy = ABOUT) {
  const tall = tallOf(W, H), snap = (v) => Math.round(v * dpr) / dpr
  const [cv, x] = canvas(Math.round(W * dpr), Math.round(H * dpr))
  const [glow, gx] = canvas(Math.max(1, Math.round(W / 3)), Math.max(1, Math.round(H / 3)))
  const X = { W, H, dpr, reduced, cv, x, glow, gx, slots: [], sink: 0, pieces: [], k: WRITE_ZOOM }
  const R = (X.rock = T.ball * T.rr * X.k), clear = FIRE_CLEAR * R // the rock close up, its radius; how far the text keeps from its centre
  // the rock as the writing starts (the camera has pushed in round it there) and the way it falls: its track's start and way.
  // Tall screens: held up in the screen (TALL_ROCK_*), falling on slowly (TALL_FALL)
  const P0 = pathAt(T, storyOf(WRITE_FROM), 0), dl = Math.hypot(P0.tx, Math.max(0.3, P0.ty))
  X.start = tall ? [TALL_ROCK_X * W, TALL_ROCK_Y * H] : [P0.x, P0.y]
  X.dir = [P0.tx / dl, Math.max(0.3, P0.ty) / dl]
  X.r0 = 0
  X.v = TALL_FALL * H

  // the copy laid out at font size fs between left and right from top: its rows, and where it ends
  const lay = (fs, top, left, right, gap = LINE_GAP) => {
    x.font = `500 ${fs}px ${MONO}`
    const cw = x.measureText('M').width, lh = fs * gap, cols = Math.max(12, Math.min(tall ? TALL_COLS : MAX_COLS, Math.floor((right - left) / cw)))
    const rows = [{ y: top, kick: true, str: copy.kicker }], words = copy.text.split(/\s+/).filter(Boolean)
    let y = top + lh * (1 + KICKER_GAP), i = 0
    while (i < words.length) {
      let str = words[i++]
      while (i < words.length && str.length + 1 + words[i].length <= cols) str += ' ' + words[i++]
      rows.push({ y, kick: false, str })
      y += lh
    }
    return { fs, cw, lh, rows, left, top, bottom: rows.at(-1).y + lh / 2 }
  }
  const fs0 = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX * bigger(W, H), W / (tall ? 26 : 56), H / (tall ? TALL_FONT_H : 34)))), floor = H * (1 - TEXT_BOTTOM)
  const right = tall ? W * (1 - TEXT_SIDE_TALL) : W * (1 - TEXT_RIGHT)
  // wide screens: a block beside the rock's path, its left edge clear of the rock where it passes the top line (it falls away left from there)
  const left = tall ? W * TEXT_SIDE_TALL : Math.min(right - 12 * fs0 * 0.6, Math.max(right - TEXT_MAX_W * W, X.start[0] + clear))
  // tall screens: the top line clear below the rock where it comes to rest (its fire faces the text: it falls toward it)
  const top = tall ? trackAt(X, Infinity)[1] + clear : X.start[1]
  let L
  for (let fs = fs0; fs >= FONT_MIN; fs--) { // as big as fits above the floor
    L = lay(fs, top, left, right)
    if (L.bottom <= floor) break
  }
  if (L.bottom > floor) L = lay(L.fs, top, left, right, LINE_GAP_MIN) // still too long: tighter lines
  if (L.bottom > floor) L = lay(L.fs, Math.max(0.05 * H + L.lh / 2, top - (L.bottom - floor)), left, right, LINE_GAP_MIN) // and then it starts higher
  if (tall) L.left = (W - Math.max(...L.rows.map((r) => r.str.length)) * L.cw) / 2 // a column, centred
  X.font = `500 ${L.fs}px ${MONO}`
  X.fs = L.fs
  L.rows.forEach((r, li) => [...r.str].forEach((ch, col) => {
    if (ch !== ' ') X.slots.push({ ch, kick: r.kick, L: li, col, x: snap(L.left + (col + 0.5) * L.cw), y: snap(r.y), j: X.slots.length })
  }))
  X.cw = L.cw
  X.lh = L.lh
  X.cell = [T.A.CW, T.A.CH] // the hole's letter grid, which the asteroid's fire and trail are drawn on
  X.tailFont = T.A.font

  // the writing (wide screens): each line types itself, left to right over LINE_SWEEP, the lines spread down the writing
  // by their height; the rock goes down its track so that it has passed each line as the line starts, and never slower
  // than V_MIN. Tall screens: the rock is above the text, and the letters lock in a wave spreading down from it (TALL_WAVE)
  const y0 = L.rows[0].y, yn = L.rows.at(-1).y, T1 = WRITE_TO - LINE_SWEEP, [, dy] = X.dir
  for (const r of L.rows) r.t = WRITE_FROM + (yn > y0 ? (r.y - y0) / (yn - y0) : 0) * (T1 - WRITE_FROM)
  if (!tall) {
    X.r0 = Math.max(0, (y0 - X.start[1]) / dy)
    X.v = Math.max(V_MIN * H, ((yn - X.start[1]) / dy - X.r0) / (T1 - WRITE_FROM))
  }
  // it dissolves nearest the rock first (the tail takes those first, and they are the ones nearest the hole as it rises)
  const [kx, ky] = trackAt(X, CLEAR_AT), dist = X.slots.map((q) => Math.hypot(q.x - kx, q.y - ky)), d0 = Math.min(...dist), d1 = Math.max(...dist)
  const wave = X.slots.map((q) => Math.hypot(TALL_WAVE * (q.x - kx), q.y - ky)), w0 = Math.min(...wave), w1 = Math.max(...wave)
  X.slots.forEach((q, i) => {
    const r = L.rows[q.L]
    q.at = tall ? WRITE_FROM + ((WRITE_TO - WRITE_FROM) * (wave[i] - w0)) / Math.max(1, w1 - w0) : r.t + (LINE_SWEEP * q.col) / Math.max(1, r.str.length - 1) // it locks
    q.gone = CLEAR_AT + (CLEAR_SPREAD * (dist[i] - d0)) / Math.max(1, d1 - d0)
  })
  if (tall) L.rows.forEach((r, i) => (r.t = Math.min(...X.slots.filter((q) => q.L === i).map((q) => q.at)))) // a line starts with its first letter
  // each line's box for the knockout (the kicker's runs down to the paragraph), and when it parts and closes again
  X.rows = L.rows.map((r, i) => ({ t: r.t, gone: Math.min(...X.slots.filter((q) => q.L === i).map((q) => q.gone)),
    x0: L.left - 0.5 * L.cw, x1: L.left + (r.str.length + 0.5) * L.cw, y0: r.y - L.lh / 2, y1: i + 1 < L.rows.length && r.kick ? L.rows[i + 1].y - L.lh / 2 : r.y + L.lh / 2 }))
  const fx = FRAY * X.cell[0], fy = FRAY * X.cell[1]
  X.bbox = [Math.min(...X.rows.map((r) => r.x0)) - fx, X.rows[0].y0 - fy, Math.max(...X.rows.map((r) => r.x1)) + fx, X.rows.at(-1).y1 + fy]

  // the hole sinks while the camera is in, as far as keeps the written text above its light, and the rock ROCK_CLEAR
  // from it (worked out with it unsunk)
  let sink = 0
  for (let s = WRITE_FROM; s <= CLEAR_AT + 0.02; s += 0.02) {
    const c = cameraAt(X, T, s), hx = T.P.cx * c.kf + c.fox, hy = T.P.cy * c.kf + c.foy, hr = T.P.R * c.kf, f = Math.max(0.05, sunk(s))
    for (const q of X.slots) if (q.at - SCRAMBLE <= s) sink = Math.max(sink, (q.y + 0.6 * L.fs + HOLE_CLEAR * H - (hy - holeTop((q.x - hx) / hr) * hr)) / f)
    const P = pathAt(T, storyOf(s), 0), rx = P.x * c.k + c.ox, ry = P.y * c.k + c.oy, g = ROCK_CLEAR * hr + T.ball * T.rr * c.k
    if (Math.abs(rx - hx) < g) sink = Math.max(sink, (ry + Math.sqrt(g * g - (rx - hx) ** 2) - hy) / f)
  }
  X.sink = sink

  // the release: the camera then; the rock's way round the hole and in, and the camera following it, are worked out from
  // it (reduced motion: no camera, and the hole as it rests)
  const rel = (X.rel = cameraAt(X, T, CLEAR_AT)), e = 0.005, was = cameraAt(X, T, CLEAR_AT - e), Wr = pathAt(T, storyOf(CLEAR_AT)), Ww = pathAt(T, storyOf(CLEAR_AT - e))
  X.drift = { x: (Wr.x * rel.k + rel.ox - Ww.x * was.k - was.ox) / e, y: (Wr.y * rel.k + rel.oy - Ww.y * was.k - was.oy) / e, // how the hold was drifting, per screen
    kf: (rel.kf - was.kf) / e, fox: (rel.fox - was.fox) / e, foy: (rel.foy - was.foy) / e }
  setInfall(T, CLEAR_AT, storyOf, reduced ? NO_CAM : rel, W, H, !reduced)
  if (reduced) return X

  // a few of the name's pieces, spread through the text in the order it is written, each waiting for one letter
  const order = X.slots.slice().sort((a, b) => a.at - b.at), all = piecesOf(N, T.impact)
  const n = Math.min(tall ? PIECES_TALL : PIECES, all.length, order.length)
  all.sort((a, b) => hash(a.id, 81) - hash(b.id, 81))
  for (let i = 0; i < n; i++) {
    const q = order[Math.floor(((i + 0.5) * order.length) / n)], f = all[i]
    X.pieces[f.id] = { q, cs: WHIP_FROM + (WHIP_TO - WHIP_FROM) * (0.8 * (i / n) + 0.2 * hash(f.id, 82)), wx: q.x + WAIT_CELLS * L.cw }
  }
  return X
}

// How the name's pieces are whipped across at scroll s, for name.js drawShatter (see there); null before they are
export function steerOf(X, T, s) {
  if (!X || s <= WHIP_FROM) return null
  const gone = 1 - smooth((s - WHIP_FROM) / WHIP) // the pieces not wanted fade away
  if (X.reduced) { // the pieces fade out as the text fades in
    const left = 1 - smooth((s - WRITE_FROM) / 0.2)
    return (id, copy) => (copy ? -1 : left)
  }
  return (id, copy, o) => {
    const P = X.pieces[id]
    if (!P) return copy ? -1 : gone
    const sg = s - copy * STREAK, u = (sg - P.cs) / WHIP
    if (u <= 0) return -1
    // where it is on screen: waiting level with its letter, a few cells right of it, then sliding into it as it locks
    const cap = smoother(u), w = smoother((sg - P.q.at + SLIDE) / SLIDE), sx = P.wx + (P.q.x - P.wx) * w, c = cameraAt(X, T, sg)
    o[0] += ((sx - c.ox) / c.k - o[0]) * cap // back into the scene, as the camera then saw it
    o[1] += ((P.q.y - c.oy) / c.k - o[1]) * cap
    o[2] = cap
    o[3] = 1 - cap // upright as it waits
    o[4] = 1 - (1 - WAIT_SIZE) * cap - 0.6 * WAIT_SIZE * w // small as it waits, smaller as it lands
    return (1 - (1 - WAIT_ALPHA) * cap) * (1 - smooth(w)) // dim as it waits, gone as its letter locks
  }
}

// Which of the asteroid's glyph cells to leave out under the text at scroll s, for asteroid.js put(): (x, y) css px ->
// 0..1, the chance a cell there is left out: KNOCKOUT under each line once it is being written, thinning to none over
// FRAY of the hole's cells past it, and closing again as the line dissolves. null when nothing is (KNOCKOUT 0: never)
export function knockOf(X, s) {
  if (!X || KNOCKOUT <= 0 || s < WRITE_FROM - SCRAMBLE || s > CLEAR_AT + CLEAR_SPREAD + DISSOLVE) return null
  const live = X.rows.map((r) => KNOCKOUT * smooth((s - r.t + SCRAMBLE) / LINE_SWEEP) * (1 - smooth((s - r.gone) / (0.5 * DISSOLVE))))
  if (!live.some((m) => m > 0)) return null
  const [cw, ch] = X.cell, [bx0, by0, bx1, by1] = X.bbox
  return (x, y) => {
    if (x < bx0 || x > bx1 || y < by0 || y > by1) return 0
    let k = 0
    for (let i = 0; i < live.length; i++) {
      const r = X.rows[i], d = Math.max(Math.max(r.x0 - x, x - r.x1, 0) / cw, Math.max(r.y0 - y, y - r.y1, 0) / ch)
      if (live[i] > 0 && d < FRAY) k = Math.max(k, live[i] * (1 - d / FRAY))
    }
    return k
  }
}

// The tail on screen at scroll s: the rock's own path back from it (where its trail is), TAIL_N points every TAIL_STEP
// screen heights, [x0, y0, x1, y1, ...], back the way the rock came; pts.safe: the first point from which all of it is
// HOLE_KEEP clear of the hole (near the rock it can be close to it, once the rock is falling in)
const TAIL_N = 64, TAIL_STEP = 0.033
function tailAt(X, T, s, cam) {
  const sa = storyOf(s), step = TAIL_STEP * X.H, pts = new Float64Array(2 * (TAIL_N + 1))
  const hx = T.P.cx * cam.kf + cam.fox, hy = T.P.cy * cam.kf + cam.foy, keep = HOLE_KEEP * T.P.R * cam.kf
  pts.safe = TAIL_N + 1
  pts.hole = [hx, hy, T.P.R * cam.kf]
  for (let i = TAIL_N; i >= 0; i--) {
    const P = pathAt(T, sa, (i * step) / cam.k), x = P.x * cam.k + cam.ox, y = P.y * cam.k + cam.oy
    pts[2 * i] = x
    pts[2 * i + 1] = y
    if (pts.safe === i + 1 && Math.hypot(x - hx, y - hy) > keep) pts.safe = i
  }
  return pts
}
// Letter q's glyphs, r into its dissolve, with the tail where tail (tailAt) has it: each starts in the letter's place, is
// drawn into the tail where it passes nearest, and streams away down it, hot and blue as it joins, cooling and fading.
// cb(x, y, glyph, rgb, alpha)
function motes(X, q, r, tail, cb) {
  const base = q.kick ? KICKER_RGB : TEXT_RGB, step = TAIL_STEP * X.H
  for (let m = 0; m < MOTES; m++) {
    const g = q.j * MOTES + m, rm = r - 0.08 * hash(g, 93) // a little apart
    if (rm <= 0 || rm >= 1) continue
    const sx = q.x + (hash(g, 94) - 0.5) * 0.6 * X.cw, sy = q.y + (hash(g, 95) - 0.5) * 0.5 * X.lh
    const off = (hash(g, 97) - 0.5) * 2 * IN_TAIL * X.rock // how far off the tail's middle it streams
    let near = -1, best = Infinity // where the tail passes nearest it, clear of the hole and by a way clear of it too (off it, as it will be), then on down the tail
    const [cx, cy, cr] = tail.hole, keep = PATH_KEEP * cr + Math.abs(off)
    for (let i = Math.max(tail.safe, Math.ceil((1.2 * X.rock) / step)); i <= TAIL_N; i++) { // behind the rock's edge
      const ax = tail[2 * i] - sx, ay = tail[2 * i + 1] - sy, d = ax * ax + ay * ay
      if (d >= best) continue
      const u = Math.min(1, Math.max(0, ((cx - sx) * ax + (cy - sy) * ay) / (d || 1)))
      if (Math.hypot(sx + ax * u - cx, sy + ay * u - cy) < keep) continue
      best = d
      near = i
    }
    const stay = near < 0 // nowhere it can get to clear of the hole: it fades where it is
    if (stay) near = 0
    const flow = Math.max(0, (rm - JOIN[0] - JOIN[1]) / (1 - JOIN[0] - JOIN[1])) // first to the tail, by the way checked above; only then down it
    const b = Math.min(TAIL_N - 1e-6, near + (FLOW * X.H * flow * flow) / step), i = Math.floor(b), f = b - i
    const x0 = tail[2 * i], y0 = tail[2 * i + 1], dx = tail[2 * i + 2] - x0, dy = tail[2 * i + 3] - y0, dl = Math.hypot(dx, dy) || 1
    const j = stay ? 0 : smoother((rm - JOIN[0]) / JOIN[1]), tx = x0 + dx * f - (dy / dl) * off, ty = y0 + dy * f + (dx / dl) * off, ux = dx / dl, uy = dy / dl
    const stage = rm < 0.35 ? 0 : rm < 0.65 ? 1 : 2, pick = hash(g, 96 + stage) // the glyph: dense, then strokes, then dust
    const glyph = stage === 0 ? POOLS[3][Math.floor(pick * POOLS[3].length)] : stage === 1 ? (pick < 0.5 ? stroke(ux, uy) : POOLS[1][Math.floor(pick * 2 * POOLS[1].length) % POOLS[1].length]) : DUST[Math.floor(pick * DUST.length)]
    const cool = smooth((rm - 0.2) / 0.8), c = rm < 0.2 ? mix(base, BLUE[4], smooth(rm / 0.2)) : mix(BLUE[4], BLUE[2], cool)
    const end = 1 - smooth((b - TAIL_N + 6) / 5) // never piling up where the sampled tail stops
    const px = sx + (tx - sx) * j, py = sy + (ty - sy) * j, lit = Math.abs(py - cy) - holeTop((px - cx) / cr) * cr // how far it is off the hole's light (above it, or below it as far)
    // and never over that light: if the hole comes up under it (tall screens, as the camera following the rock takes over), it goes out first
    cb(px, py, glyph, c, smooth(rm / 0.06) * (0.75 + 0.35 * j) * (1 - smooth((rm - 0.55) / 0.45)) * end * smooth(1 + lit / (LIGHT_FADE * cr)))
  }
}
// every glyph the dissolving text is in at scroll s that is drawn: [[x, y], ...] (css px), for a check that none goes near the hole
export function motesAt(X, T, s, cam) {
  const out = []
  if (X.reduced || s <= CLEAR_AT) return out
  const tail = tailAt(X, T, s, cam)
  for (const q of X.slots) motes(X, q, (s - q.gone) / DISSOLVE, tail, (px, py, g, c, a) => a >= 0.02 && out.push([px, py]))
  return out
}

// ---------------- drawing ----------------
// Over everything: the text, as far as the rock has written it at scroll s, and as it dissolves into the tail. T: the
// asteroid's layout; cam: the camera now (cameraAt)
export function drawAbout(ctx, X, T, s, cam) {
  if (s < WRITE_FROM - SCRAMBLE || s > CLEAR_AT + CLEAR_SPREAD + 1.1 * DISSOLVE) return
  const { x, dpr, W } = X
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
  const tail = !X.reduced && s > CLEAR_AT ? tailAt(X, T, s, cam) : null, bits = []
  for (const q of X.slots) {
    const base = q.kick ? KICKER_RGB : TEXT_RGB, a = s - q.at, r = (s - q.gone) / DISSOLVE
    if (X.reduced) { // it fades in where it lands, line by line, and out where it was
      put(q.ch, q.x, q.y, base, smooth((a + 0.1) / 0.1) * (1 - smooth(r)))
      continue
    }
    if (a < -SCRAMBLE || r >= 1.1) continue // (its glyphs leave up to 0.08 apart)
    if (a < 0) { // scrambling in its place, dim: a few glyphs, then it locks
      const k = Math.min(SWAPS - 1, Math.floor(((a + SCRAMBLE) / SCRAMBLE) * SWAPS))
      put(SCRAMBLE_SET[Math.floor(hash(q.j * 7 + k, 91) * SCRAMBLE_SET.length)], q.x, q.y, base, SCRAMBLE_ALPHA * smooth((a + SCRAMBLE) / (0.3 * SCRAMBLE)))
      continue
    }
    const c = mix(base, HOT_RGB, 1 - smooth(a / COOL)) // locked: white hot, cooling to its colour
    if (r <= 0) {
      put(q.ch, q.x, q.y, c, 1)
      continue
    }
    if (r < BREAK) put(q.ch, q.x, q.y, c, 1 - smooth(r / BREAK)) // the type breaking up
    motes(X, q, r, tail, (px, py, g, rgb, al) => bits.push(px, py, g, rgb, al)) // into the tail's glyphs
    motes(X, q, r - SMEAR / DISSOLVE, tail, (px, py, g, rgb, al) => bits.push(px, py, g, rgb, 0.3 * al)) // a faint copy behind each
  }
  if (bits.length) {
    x.font = X.tailFont
    for (let i = 0; i < bits.length; i += 5) put(bits[i + 2], bits[i], bits[i + 1], bits[i + 3], bits[i + 4])
  }
  // the text, then its bloom
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(X.cv, 0, 0, W, X.H)
  const { glow, gx } = X
  gx.clearRect(0, 0, glow.width, glow.height)
  gx.filter = 'blur(3px)'
  gx.drawImage(X.cv, 0, 0, glow.width, glow.height)
  gx.filter = 'none'
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = GLOW
  ctx.drawImage(glow, 0, 0, W, X.H)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
