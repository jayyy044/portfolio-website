// The asteroid. Once the name has landed, a comet's nucleus falls in from the top of the screen, burning: a
// round cratered rock drawn in ASCII on the GPU, lit by the hole (comet.js), wrapped in the flames, sparks and
// dust trail drawn here, in the hole's own glyphs. It smashes the name line, which shatters (name.js) letter by
// letter as its fire reaches each one. Then the hole's gravity bends it round and captures it: it spirals in over
// a loop and a bit, slowly, stretched along its orbit by the tide and torn into streams of glyphs that spiral into
// the hole ahead of it, until nothing is left. Its orbit is tipped toward us, near side up: the near half of each
// loop passes over the hole in front of it, the far half behind the shadow and the disk. Its fire, tail and trail
// follow the way it is going. Everything is a pure function of the scroll, so scrolling back plays it backwards
// and puts the line together again; the clock only tumbles the rock and flickers the fire and the torn glyphs.
// Without WebGL2 there is no rock: the fire burns round a soft hot head, and the rest is the same.
import { POOLS, smooth } from './blackhole'
import { colorOf } from './ascii'
import { valueNoise } from './nebula'
import { hash, SCRAMBLE, GHOST, GHOST_GAP } from './name'
import { drawComet, outline } from './comet'

// ---------- the story, in screens of scroll (the name has landed by 2.1, name.js) ----------
export const ENTER = 2.4 // it comes in at the top of the screen
const HIT = 2.68 // its centre is HIT_DEPTH short of the name line (its fire has reached the line just before)
const CAPTURE = 3.6 // from the hit to here its speed eases from its speed in to its speed round the loops
const TEAR = 3.4 // the hole's tide starts to stretch it and tear glyphs off it
export const GONE = 5.9 // the last of the rock goes into the shadow
const END = GONE + 0.12 // and the last glyphs torn off it
export const STORY_END = END + 0.1 // the page's scroll room ends, on a still frame of the hole
const FADE_IN = 0.06 // screens of scroll over which its glow fades in as it comes on screen
// ---------- the line in: straight, through the name ----------
const CROSS_AT = 0.56 // where its centre crosses the name line: 0 = the first letter, 1 = the last
const STOP_X = 0.36, STOP_Y = 0.5 // which way it comes in: it aims at this point, in screen widths from the left and heights from the top
const STOP_X_PHONE = 0.42, STOP_Y_PHONE = 0.6 // the same on phones (under 700 px wide)
const HIT_DEPTH = 0.45 // how far short of the line its centre is at HIT, in nucleus radii (the rock's half-thickness)
const START = 0.8 // how far above the top of the screen its centre starts, in nucleus radii (about its half-thickness: it is on screen at once)
// ---------- the capture: round the hole in a tightening spiral ----------
const ORBIT_TILT = 0.55 // how open its loops look: their height on screen against their width (0 = edge-on, like the disk; 1 = round)
const LOOPS = 1 // whole loops before the last part loop in (it always goes in on the near side, over the top of the hole)
const LOOP_MIN = 1.6, LOOP_MAX = 2.6 // how far out its first loop is, in shadow radii: where its line in passes closest to the hole, kept between these
const SINK = 1.6 // how the loops tighten: 1 = evenly all the way in, higher = slowly at first, then quickly at the end
const END_R = 1 // where it goes in, in shadow radii from the hole's centre (1 = the shadow's edge)
const BEND_END = 0.35 // radians round the hole past where its line in comes closest by which gravity has fully taken it over (it starts bending at the hit)
const SLOW_FROM = 0.55 // how far through the loops (0..1) it starts to slow as it nears the shadow
const SLOW_TO = 0.2 // and its speed as it goes in, against its speed round the loops
const DEPTH_SOFT = 0.3 // how gradually it goes behind the hole as it crosses the disk's plane: higher = a longer crossfade (0..2)
const HIDDEN_RUSH = 2.5 // how much faster it goes round while it is behind the hole (out of sight), so the scroll is spent on what shows
// ---------- the tearing ----------
const STRETCH = 2.6 // how much longer than round it is by the end, along its orbit, in its own lengths (0 = it never stretches)
const SHRINK = 1.5 // how its mass goes: 1 = evenly from TEAR to GONE, higher = slowly at first, then quickly
const STREAMS = 900, STREAMS_PHONE = 420 // glyphs torn off it, all told
const STREAM_LIFE = 0.5 // screens of scroll a torn glyph takes to spiral into the shadow
const STREAM_LEADING = 0.65 // the share torn off its leading tip (the rest come off its back)
const STREAM_LEAD = 0.9 // how much faster than the rock the glyphs off its leading tip run on round the hole: 0 = as fast
const STREAM_RATE = 14 // how often each torn glyph changes, a second
const STREAM_GLYPH = 1.6 // how big the torn glyphs are, against the hole's own letters
// ---------- the rock ----------
const SIZE = 0.16 // the nucleus' radius, in screen heights
const SIZE_PHONE = 0.18 // and on phones, in screen widths
const FIRE = 1 // the fire hugs the rock's outline, scaled by this: 1 = right at its edge, more = standing off it
// the fire is shaped like a comet's head round the way it is going: sizes in rock radii past its edge
const FRONT = 0.2 // how far the fire stands off its leading face: thin and white hot, the face it is pushing through
const RING = 0.7 // how far it reaches off its sides
const STREAM = 3.6 // how far the flames stream back behind it (the same whether it is moving or stopped)
const TAIL_NARROW = 3 // how narrow the streaming flames are: higher = a slimmer tail
const SEE = 0.75 // how much of the rock itself the flames cover: 0 = none (it shows clear), 1 = all of it
const SEE_HEAT = 0.9 // how hot the flames over the rock burn against the ones round it: lower = redder and dimmer, so the rock reads through
const HEAT = 0.95 // how hot the fire burns at the rock's edge: 1 = white hot there, lower = more orange and red all through
const BLAZE = 1.5 // how intense the flames are: brighter, denser glyphs (1 = as they were)
const TONGUES = 3 // how many tongues of flame round it: more = finer, more of them
const FLICKER = 3.5 // how fast the tongues run back along it
const TRAIL = 11 // how long its dust trail is, in nucleus radii (it shortens as the rock is torn away)
const TRAIL_WIDTH = 0.8 // how wide it is where it starts, in nucleus radii (it widens as it goes)
const TRAIL_GLOW = 1.8 // how intense the trail is: brighter, denser glyphs (1 = as it was)
const TRAIL_HOT = 0.35 // how far back it stays hot before cooling to red dust, in trail lengths
const SPARKS = 110 // glyph sparks it sheds on the way in
const SPARKS_UNTIL = HIT + 0.3 // screens of scroll: it stops shedding them here
const BLUE_FIRE = true // experiment: blue flames, trail and sparks instead of the hole's orange (false = back to orange)
export const BLUE = [[18, 36, 130], [36, 84, 215], [64, 145, 255], [145, 205, 255], [225, 244, 255]] // their colours, coolest to hottest: deep, blue, azure, ice, white hot
const GLOWS = [[4, 1.2, 1], [8, 2.6, 0.8]] // the fire's glow: [shrink factor, blur px, strength], like the hole's (ascii.js)

const PHONE = 700, DEEP = 0, RED = 1, ORANGE = 2, AMBER = 3, HOT = 4, TAU = 2 * Math.PI, TORN = 4096, BACK = 8192 // bucket keys: + TORN for the torn glyphs, + BACK for the layer behind the hole
const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const sst = (a, b, x) => { const u = c01((x - a) / (b - a)); return u * u * (3 - 2 * u) }
const smoother = (x) => { x = c01(x); return x * x * x * (x * (6 * x - 15) + 10) } // no jump in the curvature at either end
const NZ = valueNoise(9137)
// The camera (about.js cameraAt): everything here is worked out where it is in the scene, then seen through it, css px
// on screen = k * scene + ox, oy (k: how much nearer it has come). Sizes grow by k, the glyphs don't: closer in, the
// rock and its fire are drawn bigger on the same letter grid, so they show more detail. a: how much of it shows
const NO_CAM = { k: 1, ox: 0, oy: 0, a: 1 }
function view(T, o) {
  const c = T.cam
  o.x = o.x * c.k + c.ox
  o.y = o.y * c.k + c.oy
  return o
}

// ---------------- layout ----------------
// W, H: the screen in css px; dpr: device px per css px; B: the hole's resting place (rest()); N: the name's
// layout (name.js createName); A: the hole's letter grid (ascii.js createArt)
export function createAsteroid(W, H, dpr, B, N, A) {
  const phone = W < PHONE
  const T = { W, H, dpr, A, rr: phone ? SIZE_PHONE * W : SIZE * H, F: { s: NaN }, tmp: {}, q: new Float64Array(5), cam: NO_CAM }
  T.tornFont = `500 ${((A.CW * 12) / 7 * STREAM_GLYPH).toFixed(1)}px "JetBrains Mono", Menlo, Consolas, monospace`
  T.fr = FIRE * T.rr
  T.out = new Float32Array(72) // the rock's outline this frame (comet.js outline)
  T.ball = Math.max(...outline(0, 0, T.out)) // its radius, in nucleus radii
  // the line in: from above the screen, its centre through the name at CROSS_AT, toward STOP
  const Mx = N.x0 + CROSS_AT * N.wTot, My = N.ty
  const dx0 = (phone ? STOP_X_PHONE : STOP_X) * W - Mx, dy0 = (phone ? STOP_Y_PHONE : STOP_Y) * H - My
  const stop = Math.hypot(dx0, dy0) || 1, dy1 = Math.max(0.2 * stop, dy0), dl = Math.hypot(dx0, dy1) // it always falls (it starts above the screen)
  T.M = [Mx, My]
  T.dir = [dx0 / dl, dy1 / dl]
  // distance along the line from the name: where it starts and where it is at the hit; it comes in at a steady speed
  T.u0 = -(My + START * T.rr) / T.dir[1]
  T.uH = -HIT_DEPTH * T.rr
  T.v = (T.uH - T.u0) / (HIT - ENTER)
  buildPath(T, B)
  const [cv, x] = canvas(Math.round(W * dpr), Math.round(H * dpr))
  T.cv = cv
  T.x = x
  T.glows = glowsOf(W, H)
  T.best = new Float32Array(A.cols * A.rows).fill(1e9)
  T.ta = new Float32Array(A.cols * A.rows)
  T.td = new Float32Array(A.cols * A.rows)
  T.touched = new Int32Array(A.cols * A.rows)
  T.buckets = new Map()
  T.torn = tornGlyphs(T, phone ? STREAMS_PHONE : STREAMS)
  const hits = contacts(T, N)
  T.impact = { x: Mx, y: My, dx: T.dir[0], dy: T.dir[1], hits, s: Math.min(HIT, ...hits), rock: (s) => { const F = stateAt(T, s, {}); return [F.x, F.y] } }
  return T
}
function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}
const glowsOf = (W, H) => GLOWS.map(([k, blur, amt]) => { const [c, cx] = canvas(Math.max(1, Math.round(W / k)), Math.max(1, Math.round(H / k))); return { c, cx, blur, amt } })

// The path after the hit, as a table. The orbit's plane: x along the screen from the hole's centre, y toward us, which
// shows on screen as up, foreshortened by ORBIT_TILT. In it the line in is still a straight line; from the hit it bends
// round into a spiral, angle psi (round the way it goes, 0 where the line comes closest to the hole) and radius
// r(psi), blended from the line's into the spiral's so the hit has no kink. The spiral ends on the near side.
function buildPath(T, B) {
  const cx = T.W / 2, cy = B.cy, R = B.R, k = ORBIT_TILT, [dx, dy] = T.dir
  const px = T.M[0] + dx * T.uH - cx, py = (cy - T.M[1] - dy * T.uH) / k // the hit point in the plane
  const vl = Math.hypot(dx, dy / k), vx = dx / vl, vy = -dy / k / vl
  const Lm = px * vy - py * vx, sg = Lm < 0 ? -1 : 1, rh = Math.hypot(px, py), b = Math.max(1e-3 * R, Math.abs(Lm)) // b: how close the line comes
  const psiH = (px * vx + py * vy < 0 ? -1 : 1) * Math.acos(Math.min(1, b / rh)), phC = Math.atan2(py, px) - sg * psiH
  const rj = Math.min(LOOP_MAX * R, Math.max(LOOP_MIN * R, b)), re = END_R * R, bend = Math.max(BEND_END, psiH + 0.3)
  const Psi = ((((sg * (Math.PI / 2 - phC)) % TAU) + TAU) % TAU) + TAU * LOOPS // it ends straight above the hole
  const n = 4096, P = { cx, cy, k, sg, phC, re, R, n }
  for (const q of ['x', 'y', 'd', 'a', 'e', 'tx', 'ty', 'kx', 'ky', 'psi', 'r']) P[q] = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const psi = psiH + ((Psi - psiH) * i) / (n - 1), w = smoother((psi - psiH) / (bend - psiH))
    const rs = re + (rj - re) * (1 - Math.pow(Math.max(0, psi) / Psi, SINK))
    const r = w >= 1 ? rs : (1 - w) * (b / Math.cos(psi)) + w * rs, ph = phC + sg * psi
    P.x[i] = cx + r * Math.cos(ph)
    P.y[i] = cy - k * r * Math.sin(ph)
    P.d[i] = Math.sin(ph) // how near: 1 straight in front of the hole, -1 straight behind it
    P.psi[i] = psi
    P.r[i] = r
    const da = i ? Math.hypot(P.x[i] - P.x[i - 1], P.y[i] - P.y[i - 1]) : 0
    P.a[i] = i ? P.a[i - 1] + da : 0
    P.e[i] = i ? P.e[i - 1] + da / (1 + (HIDDEN_RUSH - 1) * smooth(0.3 - P.d[i])) : 0 // the pace's own length: the hidden parts count for less (eased in well before and after them)
  }
  for (let i = 0; i < n; i++) { // the way it is going, and how that turns, per px along it
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), ex = P.x[i1] - P.x[i0], ey = P.y[i1] - P.y[i0], el = Math.hypot(ex, ey) || 1
    P.tx[i] = ex / el
    P.ty[i] = ey / el
  }
  for (let i = 0; i < n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(n - 1, i + 1), da = P.a[i1] - P.a[i0] || 1
    P.kx[i] = (P.tx[i1] - P.tx[i0]) / da
    P.ky[i] = (P.ty[i1] - P.ty[i0]) / da
  }
  // its pace, along P.e: steady to the hit; then its speed changes evenly to v1 by CAPTURE (no jump at the hit: it is in
  // front of the hole there, so P.e runs with the path); then v1 round the loops, slowing to SLOW_TO of that as it goes
  // in at GONE. v1 is whatever gets it there exactly then
  const Ae = P.e[n - 1], D1 = CAPTURE - HIT, D2 = GONE - CAPTURE, I2 = 1 - ((1 - SLOW_TO) * (1 - SLOW_FROM)) / 2
  P.v0 = T.v
  P.D1 = D1
  P.D2 = D2
  P.v1 = Math.max(0.05 * T.v, (Ae - (D1 * T.v) / 2) / (D2 * I2 + D1 / 2))
  P.a1 = (D1 * (T.v + P.v1)) / 2
  T.P = P
}
// how far along its pace it is at scroll s (P.e, px from the hit; negative before it, where it is the path's own length)
function paceOf(T, s) {
  const P = T.P
  if (s <= HIT) return T.v * (s - HIT)
  if (s <= CAPTURE) { const u = (s - HIT) / P.D1; return P.D1 * u * (P.v0 + ((P.v1 - P.v0) * u) / 2) }
  const u = Math.min(1, (s - CAPTURE) / P.D2), z = c01((u - SLOW_FROM) / (1 - SLOW_FROM))
  return P.a1 + P.v1 * P.D2 * (u - (1 - SLOW_TO) * (1 - SLOW_FROM) * z * z * z * (1 - z / 2))
}
// how far along the path it is at scroll s, px from the hit
function arcOf(T, s) {
  const e = paceOf(T, s), P = T.P, E = P.e
  if (e <= 0) return e
  if (e >= E[P.n - 1]) return P.a[P.n - 1]
  let i = 0, hi = P.n - 1
  while (hi - i > 1) { const m = (i + hi) >> 1; if (E[m] <= e) i = m; else hi = m }
  return P.a[i] + ((P.a[i + 1] - P.a[i]) * (e - E[i])) / (E[i + 1] - E[i] || 1)
}
// the point a px along the path: o.x, o.y (css px), o.tx, o.ty (the way it goes), o.kx, o.ky (how that turns, per px),
// o.d (how near: > 0 in front of the hole), o.psi, o.r (where it is round the hole, in the orbit's plane)
function pointAt(T, a, o) {
  const P = T.P
  if (a <= 0) { // still on the line in
    const u = T.uH + a
    o.x = T.M[0] + T.dir[0] * u
    o.y = T.M[1] + T.dir[1] * u
    o.tx = T.dir[0]
    o.ty = T.dir[1]
    o.kx = o.ky = 0
    o.d = P.d[0]
    o.psi = P.psi[0]
    o.r = P.r[0]
    return o
  }
  const A = P.a
  let i = 0, f = 1
  if (a < A[P.n - 1]) {
    let hi = P.n - 1
    while (hi - i > 1) { const m = (i + hi) >> 1; if (A[m] <= a) i = m; else hi = m }
    f = (a - A[i]) / (A[i + 1] - A[i] || 1)
  } else i = P.n - 2
  const L = (q) => q[i] + (q[i + 1] - q[i]) * f
  o.x = L(P.x)
  o.y = L(P.y)
  o.d = L(P.d)
  o.kx = L(P.kx)
  o.ky = L(P.ky)
  o.psi = L(P.psi)
  o.r = L(P.r)
  const tx = L(P.tx), ty = L(P.ty), tl = Math.hypot(tx, ty) || 1
  o.tx = tx / tl
  o.ty = ty / tl
  return o
}
// everything about it at scroll s, into F: pointAt's, plus a (px along), m (how much of it is left, 0..1), sz (its
// size against whole), lam (how stretched along its way), wb (how far behind the hole: 0 in front, 1 behind)
function stateAt(T, s, F) {
  F.s = s
  F.a = arcOf(T, s)
  pointAt(T, F.a, F)
  const e = c01((s - TEAR) / (GONE - TEAR))
  F.m = 1 - Math.pow(e, SHRINK)
  F.sz = Math.sqrt(F.m)
  F.lam = 1 + STRETCH * Math.pow(e, 1.2)
  F.wb = wbOf(F.d)
  return F
}
const wbOf = (d) => smooth(0.5 - d / DEPTH_SOFT)

// the point back px behind it along its path at scroll s (the way its tail goes): { x, y, tx, ty (the way it goes) }, css px
export const pathAt = (T, s, back = 0) => pointAt(T, arcOf(T, s) - back, {})
// where it is at scroll s: [x, y] of its centre in css px
export function posAt(T, s) {
  const F = stateAt(T, s, {})
  return [F.x, F.y]
}
// something of the asteroid's is on screen and moving on its own (the fire, the tumbling rock, the torn glyphs)
export const asteroidBusy = (s) => s > ENTER - 0.02 && s < END
// the name's impact (name.js drawName shatters the line), once its fire is about to reach it
export const impactOf = (T, s) => (T && s >= T.impact.s - 0.04 ? T.impact : null)

// ---------------- the fire's shape ----------------
// the path behind it, len px back from its centre on screen, as a polyline relative to its centre (F.tl: x, y, px back, ...)
const TAIL_N = 16
function tailOf(T, F, len) {
  const P = F.tl || (F.tl = new Float64Array(3 * (TAIL_N + 1))), o = T.tmp
  for (let k = 0; k <= TAIL_N; k++) {
    const b = (k * len) / TAIL_N
    view(T, pointAt(T, F.a - b / T.cam.k, o))
    P[3 * k] = o.x - F.x
    P[3 * k + 1] = o.y - F.y
    P[3 * k + 2] = b
  }
}
// A point (rx, ry) css px from the rock's centre, in a frame where the path behind it runs straight back: q[0] how far
// ahead along its way (behind it: minus how far back along its path), q[1] how far off to one side
function pathFrame(F, rx, ry, q) {
  const al = rx * F.tx + ry * F.ty
  q[0] = al
  q[1] = ry * F.tx - rx * F.ty
  if (al >= 0) return
  const P = F.tl
  let best = Infinity
  for (let k = 0; k < TAIL_N; k++) {
    const x0 = P[3 * k], y0 = P[3 * k + 1], ex = P[3 * k + 3] - x0, ey = P[3 * k + 4] - y0, el = ex * ex + ey * ey
    if (!el) continue
    const f = Math.min(k + 1 < TAIL_N ? 1 : Infinity, Math.max(0, ((rx - x0) * ex + (ry - y0) * ey) / el)), px = rx - x0 - ex * f, py = ry - y0 - ey * f, d2 = px * px + py * py
    if (d2 >= best) continue
    best = d2
    q[0] = -(P[3 * k + 2] + (P[3 * k + 5] - P[3 * k + 2]) * f)
    q[1] = (ey * px - ex * py) / Math.sqrt(el)
  }
}
// How deep in the fire a point is, from its place in pathFrame (a ahead, c to the side): < 0 on the rock, 0 at its edge,
// 1 at the fire's outer edge. The rock's stretch along its way is undone (the fire ahead of and behind it keeps its own
// length), so the fire is worked out round, the way it was drawn before it stretched. q[0], q[1]: the point in that
// round frame (css px, screen axes); q[2]: 1 straight ahead. O: the rock's outline (comet.js), fr: the fire's scale,
// big: its biggest radius, px
function inFire(F, O, fr, big, a, c, q) {
  const fx = F.tx, fy = F.ty, lam = F.lam
  if (lam !== 1) {
    const hs = big * lam
    a = a >= hs ? big + a - hs : a <= -hs ? a + hs - big : a / lam
    c *= Math.sqrt(lam)
  }
  const rx = a * fx - c * fy, ry = a * fy + c * fx
  const n = O.length, d = Math.hypot(rx, ry), w = ((Math.atan2(ry, rx) / TAU) * n + n) % n, k0 = Math.floor(w) % n
  const rs = fr * (O[k0] + (O[(k0 + 1) % n] - O[k0]) * (w - Math.floor(w))) // the rock's outline this way, px
  const ahead = d ? a / d : 0, back = Math.max(0, -ahead), front = Math.max(0, ahead) // 1 straight ahead / straight behind
  const Ro = big * (1 + RING + (FRONT - RING) * front * front + (STREAM - RING) * Math.pow(back, TAIL_NARROW)) // the fire's edge this way, px
  q[0] = rx
  q[1] = ry
  q[2] = front
  return (d - rs) / Math.max(1, Ro - rs)
}

// how deep in the fire (inFire) a flame can still be drawn, at its brightest flicker: front 1 = straight ahead (drawFlames)
const reachOf = (front) => 1 - Math.pow(0.1 / (BLAZE * 1.15 * (0.8 + 0.6 * front)), 1 / 1.3) // 1.15: the flame noise's top (2 octaves reach 0.75)
// When the rock or its fire first covers each letter of the name (its box, grown by half a fire glyph), scanning the
// scroll from ENTER: Infinity for a letter it never reaches. name.js breaks each letter then, or sooner by the shock
function contacts(T, N) {
  const F = {}, q = T.q, O = outline(HIT, 0, T.out).slice(), hw = T.A.CW / 2, hh = T.A.CH / 2
  let big = 0
  for (const v of O) big = Math.max(big, v * T.fr)
  const reach = big * (1 + Math.max(RING, STREAM)) + hw + hh
  const at = (F, fr, bg, x, y) => { pathFrame(F, x - F.x, y - F.y, q); return inFire(F, O, fr, bg, q[0], q[1], q) < reachOf(q[2]) }
  const touches = (s, b) => {
    stateAt(T, s, F)
    const fr = T.fr * F.sz, bg = big * F.sz, nx = Math.min(b[2], Math.max(b[0], F.x)), ny = Math.min(b[3], Math.max(b[1], F.y))
    if (Math.hypot(nx - F.x, ny - F.y) > reach * F.lam) return false
    tailOf(T, F, bg * (F.lam + STREAM))
    if (at(F, fr, bg, nx, ny)) return true
    for (let a = 0; a <= 6; a++) for (let c = 0; c <= 6; c++) if (at(F, fr, bg, b[0] + ((b[2] - b[0]) * a) / 6, b[1] + ((b[3] - b[1]) * c) / 6)) return true
    return false
  }
  return N.cells.map((c) => {
    const b = [c.l.x - hw, c.l.y - 0.46 * N.fs - hh, c.l.x + c.l.w + hw, c.l.y + 0.42 * N.fs + hh] // its ink, about
    for (let s = ENTER, prev = ENTER; s <= HIT + 0.6; prev = s, s += 0.004) {
      if (!touches(s, b)) continue
      let lo = prev, hi = s
      for (let k = 0; k < 14; k++) { const m = (lo + hi) / 2; if (touches(m, b)) hi = m; else lo = m }
      return hi
    }
    return Infinity
  })
}

// ---------------- the glyphs ----------------
// one glyph into its colour's bucket: heat picks the palette step the way the hole's maths does (deep red ..
// hot white), lum its brightness; ch is a character; back: the layer behind the hole. Under the about-me's text some
// cells are left out (T.knock: about.js knockOf), cell by cell on the hole's grid, so the field parts round the type
function put(T, ch, x, y, heat, lum, back, torn = 0) {
  if (T.knock) {
    const k = T.knock(x, y)
    if (k > 0 && hash(Math.floor(x / T.A.CW) + 7919, Math.floor(y / T.A.CH) + 104729) < k) return
  }
  const tag = heat < 0.1 ? DEEP : heat < 0.2 ? RED : heat < 0.45 ? ORANGE : heat < 0.75 ? AMBER : HOT
  const key = back * BACK + torn * TORN + tag * 512 + Math.max(0, Math.min(511, Math.round(lum * 300)))
  let b = T.buckets.get(key)
  if (!b) T.buckets.set(key, (b = { a: [], n: 0 }))
  b.a[b.n++] = ch
  b.a[b.n++] = x
  b.a[b.n++] = y
}
// split between the front layer and the one behind the hole: wb 0 = all in front, 1 = all behind
function putD(T, ch, x, y, heat, lum, wb, torn = 0) {
  if (wb < 0.999) put(T, ch, x, y, heat, lum * (1 - wb), 0, torn)
  if (wb > 0.001) put(T, ch, x, y, heat, lum * wb, 1, torn)
}
const poolOf = (v) => (v < 0.14 ? 0 : v < 0.34 ? 1 : v < 0.58 ? 2 : 3) // brighter = denser glyph, the hole's pools
export const DUST = ".,:'`"
// a stroke along direction (dx, dy): - / | \
export function stroke(dx, dy) {
  const a = ((Math.atan2(-dy, dx) * 180) / Math.PI + 360) % 180
  return a < 22.5 || a >= 157.5 ? '-' : a < 67.5 ? '/' : a < 112.5 ? '|' : '\\'
}

// The fire round the rock, on a letter grid anchored to it (so nothing snaps as it moves): one round fireball the rock
// sits in, white hot close in and cooling outward in flickering tongues, streaming back behind it along its path.
// Over the rock itself only thinner, cooler flames lick back across it in patches, so the rock shows through under
// them. It shrinks and stretches with the rock
function drawFlames(T, F, t) {
  const { A, W, H, q } = T, cw = A.CW, chh = A.CH, fx = F.tx, fy = F.ty, x0 = F.x, y0 = F.y, O = outline(F.s, t, T.out), n = O.length, fr = T.fr * F.sz * T.cam.k
  let big = 0
  for (let k = 0; k < n; k++) big = Math.max(big, O[k] * fr)
  if (big < 0.5) return
  const reach = big * (F.lam + Math.max(RING, STREAM)), ni = Math.ceil(reach / cw), nj = Math.ceil(reach / chh)
  tailOf(T, F, big * (F.lam + STREAM))
  for (let j = -nj; j <= nj; j++) for (let i = -ni; i <= ni; i++) {
    const X = x0 + i * cw, Y = y0 + j * chh
    if (X < -cw || X > W + cw || Y < -chh || Y > H + chh) continue
    pathFrame(F, X - x0, Y - y0, q)
    const depth = inFire(F, O, fr, big, q[0], q[1], q)
    if (depth >= 1) continue
    const rx = q[0], ry = q[1], front = q[2]
    let fl, heat
    if (depth < 0) { // over the rock: patches of flame running back across it
      const nz = NZ((rx / big) * 2.5 + t * FLICKER * 0.5 * fx, (ry / big) * 2.5 + t * FLICKER * 0.5 * fy + 3.3, 2), e = (nz - 1 + SEE) / SEE
      if (e <= 0) continue
      fl = 0.15 + 0.55 * e
      heat = HEAT * SEE_HEAT * (0.8 + 0.4 * e)
    } else {
      // streaks along the way it is going (slow along it, fine across it), running back along it
      const nzv = NZ(((rx * fx + ry * fy) / big) * 1.1 + t * FLICKER * 0.35, ((ry * fx - rx * fy) / big) * TONGUES + 7.7, 2)
      fl = Math.pow(1 - depth, 1.3) * (0.45 + 1.4 * Math.max(0, nzv - 0.25)) * (0.8 + 0.6 * front)
      heat = HEAT * Math.pow(1 - depth, 2) * (0.85 + 0.3 * nzv)
    }
    fl *= BLAZE
    if (fl < 0.1) continue
    const ch = fl < 0.45 && hash(i + 4096, j + 4096) < 0.6 ? stroke(X - x0, Y - y0) : POOLS[poolOf(fl * 0.95)][Math.floor(hash(i, j + Math.floor(t * 9)) * 6)]
    putD(T, ch, X, Y, heat, 0.25 + 0.95 * fl, F.wb)
  }
}

// The dust trail, on the hole's own letter grid: back along the way it came, cooling from flame to dim red dust,
// widening as it goes; it thins and shortens as the rock is torn away
function drawTrail(T, F, t) {
  // lengths along it (a, Lmax, rs, wOf) are in the scene; across it, on screen, they are K times that
  const { A } = T, K = T.cam.k, cols = A.cols, rows = A.rows, cw = A.CW, chh = A.CH, NH = 28, rs = TRAIL_WIDTH * T.rr * Math.pow(F.sz, 0.6)
  const Lmax = TRAIL * T.rr * (0.3 + 0.7 * F.m), glow = TRAIL_GLOW * smooth(F.m / 0.1), P = [], o = T.tmp
  if (glow < 0.01 || rs * K < 0.5) return
  for (let k = 0; k < NH; k++) { const a = (k * Lmax) / (NH - 1); view(T, pointAt(T, F.a - a, o)); P.push({ x: o.x, y: o.y, a, d: o.d }) }
  const a0 = rs * 0.7 * F.lam // it starts under the flames
  const best = T.best, ta = T.ta, td = T.td, touched = T.touched
  let nt = 0
  const wOf = (a) => rs * (0.45 + 1.0 * Math.pow(Math.min(1, a / Lmax), 0.7))
  for (let k = 0; k + 1 < P.length; k++) {
    const p = P[k], q = P[k + 1], w = (1.6 * wOf(q.a) + cw / K) * K
    if (q.a < a0 - w / K) continue // under the flames: nothing to draw
    const i0 = Math.max(0, Math.floor((Math.min(p.x, q.x) - w) / cw)), i1 = Math.min(cols - 1, Math.floor((Math.max(p.x, q.x) + w) / cw))
    const j0 = Math.max(0, Math.floor((Math.min(p.y, q.y) - w) / chh)), j1 = Math.min(rows - 1, Math.floor((Math.max(p.y, q.y) + w) / chh))
    const ex = q.x - p.x, ey = q.y - p.y, el = ex * ex + ey * ey || 1
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const id = j * cols + i, px = A.G.px[id], py = A.G.py[id], f = c01(((px - p.x) * ex + (py - p.y) * ey) / el)
      const dx = px - p.x - ex * f, dy = py - p.y - ey * f, d2 = dx * dx + dy * dy
      if (d2 >= best[id]) continue
      if (best[id] >= 1e9) touched[nt++] = id
      best[id] = d2
      ta[id] = p.a + (q.a - p.a) * f
      td[id] = p.d + (q.d - p.d) * f
    }
  }
  for (let n = 0; n < nt; n++) {
    const id = touched[n], d2 = best[id], a = ta[id]
    best[id] = 1e9
    const w = wOf(a) * K, px = A.G.px[id], py = A.G.py[id]
    const nzv = NZ(a / (1.8 * rs) - t * 0.6, (Math.sqrt(d2) / (rs * K)) * 0.7 + 3, 2)
    const I = Math.exp(-d2 / (w * w)) * Math.exp(-a / (0.55 * Lmax)) * sst(a0, a0 + 1.2 * rs, a) * (0.3 + 1.1 * nzv) * glow
    const hc = hash(id, 77)
    if (I < 0.05 || hc > 0.25 + 1.2 * I) continue // dust: sparse where it is thin
    const heat = 0.14 + 0.85 * Math.exp(-a / (TRAIL_HOT * Lmax))
    const ch = I < 0.35 ? DUST[Math.floor(hash(id, 78) * 5)] : POOLS[poolOf(I * 0.6)][Math.floor(hash(id, 79) * 6)]
    putD(T, ch, px, py, heat, 0.15 + 0.7 * I, wbOf(td[id]))
  }
}

// Sparks: glyphs shed off its rim on the way in, flung out sideways and back, slowing, cooling
function drawSparks(T, s) {
  const span = SPARKS_UNTIL - ENTER, S = T.tmp
  for (let k = 0; k < SPARKS; k++) {
    const sk = ENTER + ((k + hash(k, 1)) * span) / SPARKS, life = 0.1 + 0.16 * hash(k, 2), age = s - sk
    if (age <= 0 || age > life) continue
    stateAt(T, sk, S)
    const x0 = S.x, y0 = S.y, dx = S.tx, dy = S.ty
    const side = (hash(k, 3) - 0.5) * 2, v = T.fr * (5 + 9 * hash(k, 4)), tau = 0.05, bk = 0.4 + 0.6 * hash(k, 5)
    const ux = -dx * bk - dy * side * 1.2, uy = -dy * bk + dx * side * 1.2, ul = Math.hypot(ux, uy) || 1
    const e = tau * (1 - Math.exp(-age / tau)), rim = T.rr * (0.6 + 0.3 * hash(k, 6)) // it leaves from the rock's edge
    const x = x0 + (ux / ul) * rim + ux * v * e, y = y0 + (uy / ul) * rim + uy * v * e
    const f = age / life, heat = 1.05 * Math.pow(1 - f, 1.1), c = T.cam
    putD(T, heat > 0.75 ? '*' : heat > 0.45 ? '+' : heat > 0.2 ? "'" : '.', x * c.k + c.ox, y * c.k + c.oy, heat, 0.3 + 0.9 * (1 - f), S.wb)
  }
}

// The glyphs the tide tears off it, worked out once: each leaves the rock at its tip, at the moment that much of its
// mass has gone, going round the hole as fast as the rock is; then it runs on round, faster (off the leading tip) or
// a little slower (off the back), and falls inward until it reaches the shadow at the end of its life
function tornGlyphs(T, n) {
  const G = [], F = {}, F2 = {}
  for (let i = 0; i < n; i++) {
    const s0 = TEAR + Math.pow((i + hash(i, 31)) / n, 1 / SHRINK) * (GONE - TEAR)
    const life = Math.min(STREAM_LIFE * (0.7 + 0.6 * hash(i, 33)), END - s0)
    if (life < 0.02) continue
    stateAt(T, s0, F)
    const om = (stateAt(T, s0 + 0.002, F2).psi - F.psi) / 0.002, lead = hash(i, 32) < STREAM_LEADING ? 1 : -1
    const hl = T.ball * T.rr * F.sz * F.lam, wd = (T.ball * T.rr * F.sz) / Math.sqrt(F.lam) // its half length and half width, px
    const r0 = Math.max(T.P.re * 1.02, F.r - lead * 0.25 * wd + (hash(i, 35) - 0.5) * wd)
    const fac = lead > 0 ? 1 + STREAM_LEAD * (0.5 + hash(i, 36)) : 0.7 + 0.3 * hash(i, 36)
    G.push({ s0, life, psi0: F.psi + (lead * 0.8 * hl) / Math.max(1, F.r), r0, om, th: om * life * fac, g: i })
  }
  return G
}
function drawTorn(T, s, t) {
  const P = T.P, step = Math.floor(t * STREAM_RATE)
  for (const g of T.torn) {
    if (s <= g.s0 || s >= g.s0 + g.life) continue
    const f = (s - g.s0) / g.life
    for (let k = 0; k < GHOST.length; k++) { // the glyph, and its fading copies behind it
      const fk = f - k * GHOST_GAP
      if (fk <= 0) break
      const psi = g.psi0 + g.om * g.life * fk + (g.th - g.om * g.life) * fk * fk, r = P.re + (g.r0 - P.re) * (1 - Math.pow(fk, 1.6))
      const ph = P.phC + P.sg * psi, X = P.cx + r * Math.cos(ph), Y = P.cy - P.k * r * Math.sin(ph)
      const al = smooth(f / 0.06) * smooth((r - P.re) / (0.12 * P.R)) * GHOST[k]
      if (al < 0.04) continue
      const heat = 0.45 + 0.6 * (1 - c01((r - P.re) / Math.max(1, g.r0 - P.re))) // hotter as it falls in
      putD(T, SCRAMBLE[Math.floor(hash(g.g * 4 + k, step) * SCRAMBLE.length)], X * T.cam.k + T.cam.ox, Y * T.cam.k + T.cam.oy, heat, 0.45 + al, wbOf(Math.sin(ph)), 1)
    }
  }
}

// a glyph colour like ascii.js colorOf (key = tag * 512 + brightness step), from BLUE
const blueCache = new Map()
function blueOf(key) {
  let c = blueCache.get(key)
  if (!c) {
    const b = BLUE[key >> 9], f = (key & 511) / 300
    blueCache.set(key, (c = `rgb(${Math.min(255, b[0] * f) | 0},${Math.min(255, b[1] * f) | 0},${Math.min(255, b[2] * f) | 0})`))
  }
  return c
}

// ---------------- drawing ----------------
// This frame, worked out once for drawAsteroidUnder and drawAsteroidOver: where it is (T.F), and all its glyphs (fire,
// trail, sparks, torn glyphs) drawn into the front layer and the one behind the hole, each with its glow
function prep(T, s, t, cam, knock) {
  const F = T.F
  if (F.s === s && F.t === t && F.cam === cam && F.knock === knock) return F
  T.cam = cam
  T.knock = knock
  F.knock = knock
  view(T, stateAt(T, s, F))
  F.t = t
  F.cam = cam
  for (const b of T.buckets.values()) b.n = 0
  drawTrail(T, F, t)
  if (s < SPARKS_UNTIL + 0.3) drawSparks(T, s)
  if (s > TEAR) drawTorn(T, s, t)
  drawFlames(T, F, t)
  F.front = render(T, 0)
  F.back = render(T, 1)
  T.cam = NO_CAM // the rest of the time (contacts, the impact) it works in the scene
  T.knock = null
  return F
}
// one layer's glyphs onto its canvas, then its glow; the one behind has what the hole hides cut out of it first
function render(T, back) {
  let any = false
  for (const [key, b] of T.buckets) if (b.n && (key >= BACK) === !!back) { any = true; break }
  if (!any) return false
  if (back && !T.cvB) {
    ;[T.cvB, T.xB] = canvas(T.cv.width, T.cv.height)
    T.glowsB = glowsOf(T.W, T.H)
  }
  const cv = back ? T.cvB : T.cv, x = back ? T.xB : T.x
  x.setTransform(1, 0, 0, 1, 0, 0)
  x.globalCompositeOperation = 'source-over'
  x.globalAlpha = 1
  x.clearRect(0, 0, cv.width, cv.height)
  x.setTransform(T.dpr, 0, 0, T.dpr, 0, 0)
  x.globalCompositeOperation = 'lighter'
  x.textAlign = 'center'
  x.textBaseline = 'middle'
  for (const [key, b] of T.buckets) {
    if (!b.n || (key >= BACK) !== !!back) continue
    x.font = key & TORN ? T.tornFont : T.A.font
    x.fillStyle = BLUE_FIRE ? blueOf(key % TORN) : colorOf(key % TORN)
    for (let i = 0; i < b.n; i += 3) x.fillText(b.a[i], b.a[i + 1], b.a[i + 2])
  }
  if (back) hide(x, T)
  x.globalCompositeOperation = 'source-over'
  for (const g of back ? T.glowsB : T.glows) { // the glow: blurred copies, added on like the hole's
    g.cx.clearRect(0, 0, g.c.width, g.c.height)
    g.cx.filter = `blur(${g.blur}px)`
    g.cx.drawImage(cv, 0, 0, g.c.width, g.c.height)
    g.cx.filter = 'none'
  }
  return true
}
// cut out of x what the hole hides: its shadow and its gas, as much as each cell of it hides the sky (ascii.js mask)
function hide(x, T) {
  const A = T.A
  x.setTransform(T.dpr, 0, 0, T.dpr, 0, 0)
  x.globalCompositeOperation = 'destination-out'
  x.globalAlpha = 1
  x.imageSmoothingEnabled = true
  x.drawImage(A.mask, 0, 0, A.cols * A.CW, A.rows * A.CH)
  x.globalCompositeOperation = 'source-over'
}
// a layer's glyphs and glow added onto ctx
function addLayer(ctx, T, cv, glows, a) {
  ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = a
  ctx.drawImage(cv, 0, 0, T.W, T.H)
  for (const g of glows) {
    ctx.globalAlpha = g.amt * a
    ctx.drawImage(g.c, 0, 0, T.W, T.H)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
// the rock onto c (the screen, or the layer behind the hole), stretched and shrunk; vis: 0..1
function drawRock(c, T, F, h, s, t, vis) {
  if (F.sz < 0.02 || vis < 0.002) return
  // the stretch undone, for the shader: screen offsets (y up) back to the round rock, column major
  const cs = F.tx, sn = -F.ty, p = 1 / F.lam, w = Math.sqrt(F.lam), m01 = cs * sn * (p - w)
  const aniso = new Float32Array([cs * cs * p + sn * sn * w, m01, m01, sn * sn * p + cs * cs * w]), R = T.rr * F.sz * F.cam.k
  if (drawComet(c, { W: T.W, H: T.H, dpr: T.dpr, x: F.x, y: F.y, r: R, h, s, t, vis, aniso })) return
  // no WebGL2: a soft hot head where the rock would be
  c.setTransform(T.dpr, 0, 0, T.dpr, 0, 0)
  c.translate(F.x, F.y)
  c.rotate(Math.atan2(F.ty, F.tx))
  c.scale(F.lam, 1 / Math.sqrt(F.lam))
  c.globalCompositeOperation = 'lighter'
  const g = c.createRadialGradient(0, 0, 0, 0, 0, R)
  g.addColorStop(0, `rgba(255,236,210,${(0.85 * vis).toFixed(3)})`)
  g.addColorStop(0.35, `rgba(255,172,78,${(0.45 * vis).toFixed(3)})`)
  g.addColorStop(1, 'rgba(255,124,34,0)')
  c.fillStyle = g
  c.fillRect(-R, -R, 2 * R, 2 * R)
  c.globalCompositeOperation = 'source-over'
  c.setTransform(T.dpr, 0, 0, T.dpr, 0, 0)
}

// Under the gas (after the name): whatever of it is behind the hole, with what the hole hides cut out, so the shadow
// and the disk's gas are in front of it. h: the hole on screen; s: the story's scroll in screens (about.js storyOf);
// t: the clock (fixed under reduced motion); cam: the camera it is seen through (about.js cameraAt); knock: which cells
// to leave out under the about-me's text (about.js knockOf), or null
export function drawAsteroidUnder(ctx, T, h, s, t, cam = NO_CAM, knock = null) {
  if (!(s > ENTER && s < END) || cam.a <= 0) return
  const F = prep(T, s, t, cam, knock)
  if (F.wb > 0.002 && F.sz >= 0.02) {
    if (!T.rk) T.rk = canvas(T.cv.width, T.cv.height)
    const [rk, x] = T.rk
    x.setTransform(1, 0, 0, 1, 0, 0)
    x.globalCompositeOperation = 'source-over'
    x.globalAlpha = 1
    x.clearRect(0, 0, rk.width, rk.height)
    drawRock(x, T, F, h, s, t, 1)
    hide(x, T)
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalAlpha = F.wb * cam.a
    ctx.drawImage(rk, 0, 0)
    ctx.globalAlpha = 1
  }
  if (F.back) addLayer(ctx, T, T.cvB, T.glowsB, cam.a)
  ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0)
}
// Over the gas: whatever of it is in front of the hole; the rock hides what is behind it, its fire's light goes over
export function drawAsteroidOver(ctx, T, h, s, t, cam = NO_CAM, knock = null) {
  if (!(s > ENTER && s < END) || cam.a <= 0) return
  const F = prep(T, s, t, cam, knock), vis = smooth((s - ENTER) / FADE_IN) * cam.a
  drawRock(ctx, T, F, h, s, t, vis * (1 - F.wb))
  if (F.front) addLayer(ctx, T, T.cv, T.glows, vis)
  ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0)
}
