// The asteroid. Once the name has landed, a comet's nucleus falls in from the top of the screen, burning: a
// round cratered rock drawn in ASCII on the GPU, lit by the hole (comet.js), wrapped in the flames, sparks and
// dust trail drawn here, in the hole's own glyphs. It smashes the name line, which shatters (name.js) letter by
// letter as its fire reaches each one. Then the hole's gravity bends it round, and it writes the about-me (about.js).
// Once that has gone it is released and goes round the hole on a tightening, tilted orbit (its near half above the hole,
// in front of it; its far half behind it), the way it was already going, while a camera follows it in (followAt). As it
// nears, the tide grows: it stretches along its way and sheds itself into its stream, which runs on ahead of it along
// its orbit (the inner part, spiralling in) and lags behind it (the outer part), until the hole is wrapped in a thin arc
// of it; then it comes onto the ring over the top and goes on round it, sinking into the shadow, and the rest of the
// stream pours in after it, cooling into the hole's own colours. Then the hole is still.
// Every glyph of its fire, trail and stream is in front of or behind the hole as its own part of the orbit is.
// Everything is a pure function of the scroll, so scrolling back plays it backwards and puts the line together again;
// the clock only tumbles the rock and flickers its fire.
// Without WebGL2 there is no rock: the fire burns round a soft hot head, and the rest is the same.
import { POOLS, smooth } from './blackhole'
import { colorOf } from './ascii'
import { valueNoise } from './nebula'
import { hash } from './name'
import { drawComet, outline } from './comet'

// ---------- the story, in screens of scroll (the name has landed by 2.1, name.js) ----------
export const ENTER = 2.4 // it comes in at the top of the screen
const HIT = 2.68 // its centre is HIT_DEPTH short of the name line (its fire has reached the line just before)
const FADE_IN = 0.06 // screens of scroll over which its glow fades in as it comes on screen
// ---------- the line in: straight, through the name ----------
const CROSS_AT = 0.56 // where its centre crosses the name line: 0 = the first letter, 1 = the last
const STOP_X = 0.36, STOP_Y = 0.5 // which way it comes in: it aims at this point, in screen widths from the left and heights from the top
const STOP_X_PHONE = 0.42, STOP_Y_PHONE = 0.6 // the same on tall screens (TALL)
const HIT_DEPTH = 0.45 // how far short of the line its centre is at HIT, in nucleus radii (the rock's half-thickness)
const START = 0.8 // how far above the top of the screen its centre starts, in nucleus radii (about its half-thickness: it is on screen at once)
// ---------- the bend: from the hit it is on a tilted spiral round the hole while it writes the about-me; it leaves it
// when it is released (setInfall), so only the start of it ever shows. These keep that start as it has always been ----------
const CAPTURE = 3.6 // from the hit to here its speed eases from its speed in to its speed round the spiral
const SPIRAL_END = 5.9 // when the spiral would reach the shadow: this sets how fast it goes round it
const ORBIT_TILT = 0.55 // how open the spiral looks: its height on screen against its width (0 = edge-on, like the disk; 1 = round)
const LOOPS = 1 // whole loops the spiral makes before its last part loop
const LOOP_MIN = 1.6, LOOP_MAX = 2.6 // how far out its first loop is, in shadow radii: where its line in passes closest to the hole, kept between these
const SINK = 1.6 // how the spiral tightens: 1 = evenly all the way in, higher = slowly at first, then quickly at the end
const END_R = 1 // where the spiral ends, in shadow radii from the hole's centre
const BEND_END = 0.35 // radians round the hole past where its line in comes closest by which gravity has fully taken it over (it starts bending at the hit)
const SLOW_FROM = 0.55, SLOW_TO = 0.2 // how far round the spiral it would start to slow, and to what share of its speed
const DEPTH_SOFT = 0.3 // how gradually it goes behind the hole as it crosses the disk's plane: higher = a longer crossfade (0..2)
const HIDDEN_RUSH = 2.5 // how much faster it goes round while it is behind the hole, so the scroll is spent on what shows
// ---------- the infall: once the about-me has gone it is released (about.js CLEAR_AT), goes round the hole and falls
// in. In screens of scroll from the release ----------
const IN_TIME = 2.8 // until its head is on the ring: it goes as fast as that takes, at one steady speed as the camera sees it
const EASE = 0.5 // how long it takes to get up to that speed, from rest
const EVEN_TURN = 0.15 // how much it slows where its way bends hardest, so its fire turns evenly: 0 = never (its speed alone is even)
const TURNS = 1.25 // about how many times it goes round the hole first (it comes onto the ring over the top, in front)
const INFALL_TILT = 0.85 // how open its orbit looks: its height on screen against its width; the half above the hole is the near one
const BLEND = 0.15 // how much of its first turn it takes to come round from the way it was going onto its orbit
const DIVE_TALL = 1 // tall screens (TALL), where it is released high above the hole (about.js TALL_*): how steeply it dives in at first,
// down through the text: 0 = only as fast as it was falling in, 1 = as fast as still tightens all the way
const HOLE_TO_ROCK = 2.4 // the hole's shadow grows, if need be, to at least this many times the rock's radius as the camera takes over
const RING_R = 1.03 // it comes onto the ring this far out, in shadow radii, along it
const WRAP = 1.4 // then its head goes on round the ring this far, radians, sinking into the shadow
const SINK_IN = 0.2 // how steeply it sinks in as it does, radians off the ring
const FADE = 0.9 // over how much of that it fades out, against the whole of it
// ---------- the tide: it grows as the cube of how near it is, from nothing where it is released to all at the ring ----------
const STRETCH = 1.2 // how much longer than round the rock is by the time it is on the ring, along its way (0 = never)
const SHED = 0.7 // how much of its size has gone into its stream by then (0 = none)
const RIBBON = 1.2 // how much brighter its dust trail burns by then, the rock poured into it; it narrows as the rock does
const LEAD = 0.45 // how far round ahead of it its stream runs by then, in turns: the inner part, spiralling in ahead of it
const LAG = 0.2 // and how much further back its trail reaches, in turns: the outer part, lagging
const DRAIN = 0.6 // screens of scroll the rest of the stream takes to pour in after its head is on the ring
const DRAIN_TALL = 0.3 // the same on tall screens (TALL): it has further to go round there (DIVE_TALL), so the time this saves goes to that
const COOL = 0.5 // how much of the way on round the ring what has gone in takes to cool from the fire's blue into the hole's colours
// ---------- the camera that follows it in (about.js cameraAt asks followAt) ----------
const FOLLOW = 0.35 // what it centres on: this far from the hole's centre toward the rock
export const FRAME_PAD = 0.08 // room it keeps round the rock and the hole, as shares of the screen (the close up keeps the rock in it too, about.js)
const AIM_SMOOTH = 1 // how much of a turn of its way it averages its aim and zoom over: steadier, with no lag
const HANDOFF = 2 // screens of scroll it takes to take over from the close up, smoothly, from the release
const ZOOM_FIRST = 0.6 // it zooms out in this share of that, making room round the rock before it moves its aim
const ZOOM_MIN = 0.35, ZOOM_MAX = 2.5 // how far it zooms out and in, against the close up
// ---------- the end ----------
const STILL = 0.15 // then a still frame of the hole, and the page's scroll room ends
export const INFALL = IN_TIME + DRAIN + STILL // screens of scroll from the release to the end
// ---------- the rock ----------
const SIZE = 0.16 // the nucleus' radius, in screen heights
const SIZE_ASPECT = 1.6 // but on screens narrower than this, width against height, as though they were only this wide: a narrowing
// window shrinks it with its width (16:10 and wider are sized by their height alone, as they always were)
const SIZE_PHONE = 0.18 // on tall screens (TALL): no more than this, in screen widths (it is what sizes it on phones and upright tablets)
const TALL = 0.76 // screens narrower than this, width against height, are tall (phones; upright tablets, 3:4 = 0.75): the rock comes in
// toward STOP_X_PHONE, STOP_Y_PHONE at SIZE_PHONE and the about-me goes across its path (about.js). Wider ones, square and a little
// upright too (half a laptop screen), are the wide screen scaled down; that stops fitting below about 0.72 on a 710 px tall window
export const tallOf = (W, H) => W < TALL * H
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
const TRAIL = 11 // how long its dust trail is, in nucleus radii (it lengthens into its stream as the tide grows)
const TRAIL_WIDTH = 0.8 // how wide it is where it starts, in nucleus radii (it widens as it goes)
const TRAIL_GLOW = 1.8 // how intense the trail is: brighter, denser glyphs (1 = as it was)
const TRAIL_HOT = 0.35 // how far back it stays hot before cooling to red dust, in trail lengths
const SPARKS = 110 // glyph sparks it sheds on the way in
const SPARKS_UNTIL = HIT + 0.3 // screens of scroll: it stops shedding them here
const BLUE_FIRE = true // experiment: blue flames, trail and sparks instead of the hole's orange (false = back to orange)
export const BLUE = [[18, 36, 130], [36, 84, 215], [64, 145, 255], [145, 205, 255], [225, 244, 255]] // their colours, coolest to hottest: deep, blue, azure, ice, white hot
const GLOWS = [[4, 1.2, 1], [8, 2.6, 0.8]] // the fire's glow: [shrink factor, blur px, strength], like the hole's (ascii.js)

const DEEP = 0, RED = 1, ORANGE = 2, AMBER = 3, HOT = 4, TAU = 2 * Math.PI, WARM = 4096, BACK = 8192 // bucket keys: + WARM for the hole's own colours, + BACK for the layer behind the hole
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
  const tall = tallOf(W, H)
  const T = { W, H, dpr, A, rr: tall ? Math.min(SIZE * H, SIZE_PHONE * W) : SIZE * Math.min(H, W / SIZE_ASPECT), F: { s: NaN }, tmp: {}, q: new Float64Array(5), cam: NO_CAM, end: Infinity }
  T.fr = FIRE * T.rr
  T.out = new Float32Array(72) // the rock's outline this frame (comet.js outline)
  T.ball = Math.max(...outline(0, 0, T.out)) // its radius, in nucleus radii
  // the line in: from above the screen, its centre through the name at CROSS_AT, toward STOP
  const Mx = N.x0 + CROSS_AT * N.wTot, My = N.ty
  const dx0 = (tall ? STOP_X_PHONE : STOP_X) * W - Mx, dy0 = (tall ? STOP_Y_PHONE : STOP_Y) * H - My
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
// r(psi), blended from the line's into the spiral's so the hit has no kink. It leaves the spiral at the release (setInfall)
function buildPath(T, B) {
  const cx = T.W / 2, cy = B.cy, R = B.R, k = ORBIT_TILT, [dx, dy] = T.dir
  const px = T.M[0] + dx * T.uH - cx, py = (cy - T.M[1] - dy * T.uH) / k // the hit point in the plane
  const vl = Math.hypot(dx, dy / k), vx = dx / vl, vy = -dy / k / vl
  const Lm = px * vy - py * vx, sg = Lm < 0 ? -1 : 1, rh = Math.hypot(px, py), b = Math.max(1e-3 * R, Math.abs(Lm)) // b: how close the line comes
  const psiH = (px * vx + py * vy < 0 ? -1 : 1) * Math.acos(Math.min(1, b / rh)), phC = Math.atan2(py, px) - sg * psiH
  const rj = Math.min(LOOP_MAX * R, Math.max(LOOP_MIN * R, b)), re = END_R * R, bend = Math.max(BEND_END, psiH + 0.3)
  const Psi = ((((sg * (Math.PI / 2 - phC)) % TAU) + TAU) % TAU) + TAU * LOOPS // it ends straight above the hole
  const n = 4096, P = { cx, cy, R, n }
  for (const q of ['x', 'y', 'd', 'a', 'e', 'tx', 'ty']) P[q] = new Float64Array(n)
  for (let i = 0; i < n; i++) {
    const psi = psiH + ((Psi - psiH) * i) / (n - 1), w = smoother((psi - psiH) / (bend - psiH))
    const rs = re + (rj - re) * (1 - Math.pow(Math.max(0, psi) / Psi, SINK))
    const r = w >= 1 ? rs : (1 - w) * (b / Math.cos(psi)) + w * rs, ph = phC + sg * psi
    P.x[i] = cx + r * Math.cos(ph)
    P.y[i] = cy - k * r * Math.sin(ph)
    P.d[i] = Math.sin(ph) // how near: 1 straight in front of the hole, -1 straight behind it
    const da = i ? Math.hypot(P.x[i] - P.x[i - 1], P.y[i] - P.y[i - 1]) : 0
    P.a[i] = i ? P.a[i - 1] + da : 0
    P.e[i] = i ? P.e[i - 1] + da / (1 + (HIDDEN_RUSH - 1) * smooth(0.3 - P.d[i])) : 0 // the pace's own length: the hidden parts count for less (eased in well before and after them)
  }
  tangents(P)
  // its pace, along P.e: steady to the hit; then its speed changes evenly to v1 by CAPTURE (no jump at the hit: it is in
  // front of the hole there, so P.e runs with the path); then v1 round the spiral, slowing to SLOW_TO of that as it
  // would reach the shadow at SPIRAL_END. v1 is whatever would get it there exactly then
  const Ae = P.e[n - 1], D1 = CAPTURE - HIT, D2 = SPIRAL_END - CAPTURE, I2 = 1 - ((1 - SLOW_TO) * (1 - SLOW_FROM)) / 2
  P.v0 = T.v
  P.D1 = D1
  P.D2 = D2
  P.v1 = Math.max(0.05 * T.v, (Ae - (D1 * T.v) / 2) / (D2 * I2 + D1 / 2))
  P.a1 = (D1 * (T.v + P.v1)) / 2
  T.P = P
}
// the way a table's path goes at each point (P.tx, P.ty), from its points either side
function tangents(P) {
  for (let i = 0; i < P.n; i++) {
    const i0 = Math.max(0, i - 1), i1 = Math.min(P.n - 1, i + 1), ex = P.x[i1] - P.x[i0], ey = P.y[i1] - P.y[i0], el = Math.hypot(ex, ey) || 1
    P.tx[i] = ex / el
    P.ty[i] = ey / el
  }
}
// how far along its pace it is at scroll s (P.e, px from the hit; negative before it, where it is the path's own length)
function paceOf(T, s) {
  const P = T.P
  if (s <= HIT) return T.v * (s - HIT)
  if (s <= CAPTURE) { const u = (s - HIT) / P.D1; return P.D1 * u * (P.v0 + ((P.v1 - P.v0) * u) / 2) }
  const u = Math.min(1, (s - CAPTURE) / P.D2), z = c01((u - SLOW_FROM) / (1 - SLOW_FROM))
  return P.a1 + P.v1 * P.D2 * (u - (1 - SLOW_TO) * (1 - SLOW_FROM) * z * z * z * (1 - z / 2))
}
// how far along the path it is at scroll s, px from the hit; after the release, along its infall (setInfall), as far as
// takes it as far as it should have gone on screen by then
function arcOf(T, s) {
  const Q = T.Q
  if (Q && s > Q.s0) return Q.a0 + along(Q, Q.lam, paceOf2(Q.v, sinceOf(Q, s)), Q.a)
  const e = paceOf(T, s), P = T.P, E = P.e
  if (e <= 0) return e
  if (e >= E[P.n - 1]) return P.a[P.n - 1]
  let i = 0, hi = P.n - 1
  while (hi - i > 1) { const m = (i + hi) >> 1; if (E[m] <= e) i = m; else hi = m }
  return P.a[i] + ((P.a[i + 1] - P.a[i]) * (e - E[i])) / (E[i + 1] - E[i] || 1)
}
// the point a px along the path: o.x, o.y (css px), o.tx, o.ty (the way it goes), o.d (how near: > 0 in front of the
// hole), o.w (how far the tide has worked on it there, 0..1)
function pointAt(T, a, o) {
  const P = T.P, Q = T.Q
  if (Q && a > Q.a0) return look(Q, a - Q.a0, o) // on its infall
  o.w = 0
  if (a <= 0) { // still on the line in
    const u = T.uH + a
    o.x = T.M[0] + T.dir[0] * u
    o.y = T.M[1] + T.dir[1] * u
    o.tx = T.dir[0]
    o.ty = T.dir[1]
    o.d = P.d[0]
    return o
  }
  return look(P, a, o)
}
// where a falls in the rising table A: its index and the share of the way to the next (i, f), into ix
function find(A, n, a, ix) {
  let i = 0, f = 1
  if (a < A[n - 1]) {
    let hi = n - 1
    while (hi - i > 1) { const m = (i + hi) >> 1; if (A[m] <= a) i = m; else hi = m }
    f = (a - A[i]) / (A[i + 1] - A[i] || 1)
  } else i = n - 2
  ix[0] = i
  ix[1] = Math.max(0, f)
  return ix
}
const IX = [0, 0]
// what table B has where table A (rising) has a
const along = (P, A, a, B) => { const [i, f] = find(A, P.n, a, IX); return B[i] + (B[i + 1] - B[i]) * f }
// the point a px along a table's path (buildPath, setInfall), into o
function look(P, a, o) {
  const [i, f] = find(P.a, P.n, a, IX), L = (q) => q[i] + (q[i + 1] - q[i]) * f
  o.x = L(P.x)
  o.y = L(P.y)
  o.d = L(P.d)
  if (P.w) o.w = L(P.w)
  const tx = L(P.tx), ty = L(P.ty), tl = Math.hypot(tx, ty) || 1
  o.tx = tx / tl
  o.ty = ty / tl
  return o
}
// everything about it at scroll s, into F: pointAt's, plus a (px along), tide (how far the tide has worked on it, 0..1),
// sz (its size against whole), lam (how stretched along its way), wb (how far behind the hole: 0 in front, 1 behind).
// The tide stretches it and sheds it into its stream as it goes round; once its head is on the ring, what is left of it
// shrinks away into the shadow
function stateAt(T, s, F) {
  F.s = s
  F.a = arcOf(T, s)
  pointAt(T, F.a, F)
  const Q = T.Q, past = Q ? F.a - Q.a0 - Q.ring : -1 // how far its head has gone on round the ring
  F.tide = F.w
  F.lam = 1 + STRETCH * F.tide
  F.sz = (1 - SHED * F.tide) * (past > 0 ? 1 - smooth(past / (0.4 * Q.fade)) : 1)
  F.wb = wbOf(F.d)
  return F
}
const wbOf = (d) => smooth(0.5 - d / DEPTH_SOFT)

// how far along its infall it has gone on screen x screens of scroll after the release, going at v once it has got up to
// speed from rest over EASE
const paceOf2 = (v, x) => { const u = x / EASE; return v * (u < 1 ? EASE * u * u * u * (1 - u / 2) : x - EASE / 2) }
// how many screens of scroll after the release it has gone l (paceOf2's at v = 1), the other way round
function easeBack(l) {
  if (l >= EASE / 2) return EASE / 2 + l
  const y = l / EASE
  let u = Math.cbrt(y)
  for (let i = 0; i < 5; i++) u -= (u * u * u * (1 - u / 2) - y) / Math.max(1e-6, 3 * u * u - 2 * u * u * u)
  return EASE * u
}
// how many screens of real scroll after the release the story's scroll s is (about.js slows the story while the camera is in)
function sinceOf(Q, s) {
  const x = s - Q.s0, xs = Q.xs, n = xs.length - 1
  if (x >= xs[n]) return INFALL + x - xs[n]
  let i = 0, hi = n
  while (hi - i > 1) { const m = (i + hi) >> 1; if (xs[m] <= x) i = m; else hi = m }
  return ((i + (x - xs[i]) / (xs[i + 1] - xs[i] || 1)) * INFALL) / n
}
// The infall, worked out once about.js knows its camera as the rock is released. sr: the scroll then; story: about.js
// storyOf; cam: the camera then (about.js cameraAt: near k, ox, oy, far kf, fox, foy); W, H: the screen; follow: whether
// a camera follows it (not under reduced motion). It is worked out on the screen as it was then (the release frame),
// where the hole is where the far camera had it, grown about the rock to HOLE_TO_ROCK times the rock (as the camera
// takes over), and its path in the scene is that seen back through the near camera. The orbit: tilted by INFALL_TILT
// (its near half above the hole), going round the way it was already going, it tightens from where it is onto the ring
// (RING_R) over about TURNS turns, its radius easing in from how fast it was falling in, coming onto the ring over the
// top as its orbit opens into the ring's circle; it comes round from the way it was going over its first BLEND of a
// turn; then on round the ring, sinking in (WRAP). The camera's aim and zoom are worked out along it too (followAt), and
// its pace: even as the camera sees it (EVEN_TURN aside), getting its head onto the ring IN_TIME after the release (tall
// screens: and what DRAIN_TALL saves)
export function setInfall(T, sr, story, cam, W, H, follow) {
  T.Q = null
  const tall = tallOf(W, H), s0 = story(sr), xs = new Float64Array(257) // the story's scroll after the release, at even steps of the scroll through the infall
  for (let i = 0; i <= 256; i++) xs[i] = story(sr + (i * INFALL) / 256) - s0
  const a0 = arcOf(T, s0), S = pointAt(T, a0, {}), kr = cam.k, px = S.x * kr + cam.ox, py = S.y * kr + cam.oy
  const rock = T.ball * T.rr * kr, R0 = T.P.R * cam.kf, grow = follow ? Math.max(1, (HOLE_TO_ROCK * rock) / R0) : 1
  const hx = px + grow * (T.P.cx * cam.kf + cam.fox - px), hy = py + grow * (T.P.cy * cam.kf + cam.foy - py), R = grow * R0
  // where it is in the orbit's plane (shadow radii), and how it is moving there
  const th0 = Math.atan2(S.ty, S.tx), xp = (px - hx) / R, yp = (hy - py) / R / INFALL_TILT, r0 = Math.hypot(xp, yp), ph0 = Math.atan2(yp, xp)
  const vx = Math.cos(th0), vy = -Math.sin(th0) / INFALL_TILT, vl = Math.hypot(vx, vy), sense = xp * vy - yp * vx >= 0 ? 1 : -1
  let Psi = (((sense * (Math.PI / 2 - ph0)) % TAU) + TAU) % TAU // ending straight over the top, about TURNS round
  Psi += TAU * Math.max(0, Math.round((TURNS * TAU - Psi) / TAU))
  const L0 = Math.log(r0), L1 = Math.log(RING_R), dL = Math.abs(L1 - L0) // its radius, log, eased in from how fast it was falling in (no further than keeps it tightening all the way)
  const m0 = Math.max(-3 * dL, Math.min(tall ? -3 * DIVE_TALL * dL : 0, Math.tan(Math.max(-1.2, Math.min(1.2, Math.asin((xp * vx + yp * vy) / (r0 * vl))))) * Psi)), open = Math.min(0.9, (0.4 * TAU) / Psi) // the last of it opens into the ring
  const orbit = (t, o) => {
    const t2 = t * t, t3 = t2 * t, r = Math.exp((2 * t3 - 3 * t2 + 1) * L0 + (t3 - 2 * t2 + t) * m0 + (3 * t2 - 2 * t3) * L1)
    const ph = ph0 + sense * Psi * t, c = smooth((t - 1 + open) / open), k = INFALL_TILT + (1 - INFALL_TILT) * c
    o[0] = hx + R * r * Math.cos(ph)
    o[1] = hy - R * k * r * Math.sin(ph)
    o[2] = Math.sin(ph) + (1 - Math.sin(ph)) * c // how near; on the ring, in front
    o[3] = r
    return o
  }
  const NA = 960, NW = 160, n = NA + NW + 1, o = [0, 0, 0, 0], o2 = [0, 0, 0, 0]
  orbit(1e-4, o2)
  orbit(0, o)
  const ex = o2[0] - o[0], ey = o2[1] - o[1], el = Math.hypot(ex, ey), c0 = el / 1e-4, tb = (BLEND * TAU) / Psi
  const bx = c0 * (Math.cos(th0) - ex / el), by = c0 * (Math.sin(th0) - ey / el) // it sets off the way it was going, coming round onto its orbit
  const Q = { s0, a0, xs, n, in: IN_TIME + (tall ? DRAIN - DRAIN_TALL : 0), drain: tall ? DRAIN_TALL : DRAIN }, pf = { x: new Float64Array(n), y: new Float64Array(n) }, rf = { x: new Float64Array(n), y: new Float64Array(n) }
  for (const q of ['x', 'y', 'd', 'a', 'w', 'tx', 'ty']) Q[q] = new Float64Array(n)
  const wOf = (r) => c01((Math.pow(r0 / r, 3) - 1) / (Math.pow(r0 / RING_R, 3) - 1))
  let i = 0
  const add = (x, y, d, w) => {
    pf.x[i] = x
    pf.y[i] = y
    Q.d[i] = d
    Q.w[i] = w
    i++
  }
  for (let j = 0; j <= NA; j++) {
    const t = j / NA, b = t < tb ? t * Math.pow(1 - t / tb, 3) : 0 // (no kink where it ends)
    orbit(t, o)
    add(o[0] + bx * b, o[1] + by * b, S.d + (o[2] - S.d) * smooth(t / tb), wOf(o[3]))
  }
  for (let j = 1; j <= NW; j++) { // on round the ring, sinking in
    const u = j / NW, ph = Math.PI / 2 + sense * WRAP * u, r = RING_R * Math.exp(-Math.tan(SINK_IN) * WRAP * u * u)
    add(hx + R * r * Math.cos(ph), hy - R * r * Math.sin(ph), 1, 1)
  }
  Q.turn = (TAU * RING_R * R) / kr // a turn round the ring, in the scene
  Q.lt = TRAIL * T.rr + LAG * Q.turn // the longest its trail gets: the stream's tail end starts that far back as it pours in
  Q.soft = 2 * T.ball * T.rr
  // That is its way round the hole grown all the way (pf); but the hole only grows (about the rock, where it is released)
  // as the camera takes over (followAt: g), so each point goes where it is against the hole as drawn when the rock gets
  // there (hs: when that is, screens of scroll after the release): its way out from the release, shrunk by g / grow.
  // And the camera, at each point of the way: aiming between the rock and the hole, zoomed to keep both on screen, averaged
  // over AIM_SMOOTH of a turn; taking over from the close up over HANDOFF; at the end settling on the hole
  const C = { z: new Float64Array(n), x: new Float64Array(n), y: new Float64Array(n) }, G = new Float64Array(n)
  const ax = W / 2 - W * FRAME_PAD, ay = H / 2 - H * FRAME_PAD, mr = 1.6 * rock, end = (j) => smooth((j - NA) / (0.5 * NW)) // past the ring it settles on the hole
  const span = Math.max(1, Math.round((AIM_SMOOTH * NA * TAU) / Psi)), H0x = T.P.cx * cam.kf + cam.fox, H0y = T.P.cy * cam.kf + cam.foy
  const box = (v) => { // averaged over a stretch of the way centred on each point (no lag; shorter at the ends, so they stay put)
    const sum = new Float64Array(n + 1)
    for (let j = 0; j < n; j++) sum[j + 1] = sum[j] + v[j]
    const u = Float64Array.from(v)
    for (let j = 0; j < n; j++) { const w = Math.min(span, j, n - 1 - j); u[j] = (sum[j + w + 1] - sum[j - w]) / (2 * w + 1) }
    return u
  }
  const hxOf = (j) => px + G[j] * (H0x - px), hyOf = (j) => py + G[j] * (H0y - py) // the hole as drawn there
  const lay = (hs) => {
    for (let j = 0; j < n; j++) {
      G[j] = follow ? 1 + (grow - 1) * handoff(hs[j])[0] : 1
      const f = G[j] / grow
      rf.x[j] = px + f * (pf.x[j] - px)
      rf.y[j] = py + f * (pf.y[j] - py)
      Q.x[j] = (rf.x[j] - cam.ox) / kr
      Q.y[j] = (rf.y[j] - cam.oy) / kr
      Q.a[j] = j ? Q.a[j - 1] + Math.hypot(Q.x[j] - Q.x[j - 1], Q.y[j] - Q.y[j - 1]) : 0
    }
    tangents(Q)
    Q.tx[0] = S.tx
    Q.ty[0] = S.ty
    Q.ring = Q.a[NA] // where its head is on the ring
    Q.fade = Math.max(1, FADE * (Q.a[n - 1] - Q.ring))
    for (let j = 0; j < n; j++) {
      C.x[j] = hxOf(j) + FOLLOW * (1 - end(j)) * (rf.x[j] - hxOf(j))
      C.y[j] = hyOf(j) + FOLLOW * (1 - end(j)) * (rf.y[j] - hyOf(j))
    }
    C.x = box(C.x)
    C.y = box(C.y)
    for (let j = 0; j < n; j++) { // as near as keeps the rock and the hole in frame round that aim
      const tx = C.x[j], ty = C.y[j], e = end(j), m = mr * (1 - e), hx = hxOf(j), hy = hyOf(j), R = G[j] * R0
      const sx = Math.max(Math.abs(rf.x[j] - tx) + m, Math.abs(hx - tx) + (1.25 + 0.9 * e) * R) // the shadow and the arch over it (more of the disk at the end)
      const sy = Math.max(Math.abs(rf.y[j] - ty) + m, ty - hy + 1.95 * R, hy - ty + (1.2 + 0.3 * e) * R)
      C.z[j] = Math.log(Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, ax / sx, ay / sy)))
    }
    const zm = Float64Array.from(C.z) // no nearer than any point near it allows, then averaged
    for (let j = 0; j < n; j++) for (let i = Math.max(0, j - span); i <= Math.min(n - 1, j + span); i++) zm[j] = Math.min(zm[j], C.z[i])
    C.z = box(zm)
    for (let j = 0; j < n; j++) C.z[j] = Math.exp(C.z[j])
  }
  // its pace: even, as the camera sees it, with a little time added where its way bends hardest (EVEN_TURN, as much as its
  // average bend would take). When the camera takes over from the close up depends on the pace, and the pace on what the
  // camera does (and so, as the hole grows, on where its way goes), so a few tries, each halfway to the last
  const lam = new Float64Array(n), hs = new Float64Array(n).fill(9), bend = new Float64Array(n) // hs: when it gets to each point (first: long after the handoff)
  for (let pass = 0; pass < 10; pass++) {
    if (!pass || grow > 1) lay(hs)
    let qx = 0, qy = 0, turned = 0
    for (let j = 1; j < n; j++) { const d = Math.atan2(Q.ty[j], Q.tx[j]) - Math.atan2(Q.ty[j - 1], Q.tx[j - 1]); bend[j] = Math.abs(Math.atan2(Math.sin(d), Math.cos(d))); if (j <= NA) turned += bend[j] }
    for (let j = 0; j < n; j++) {
      const [h, hz] = follow ? handoff(hs[j]) : [0, 0], z = 1 + (C.z[j] - 1) * hz // the rock on screen
      const sx = W / 2 + z * (rf.x[j] - W / 2 - (C.x[j] - W / 2) * h), sy = H / 2 + z * (rf.y[j] - H / 2 - (C.y[j] - H / 2) * h)
      lam[j] = j ? lam[j - 1] + Math.hypot(sx - qx, sy - qy) : 0
      qx = sx
      qy = sy
    }
    const per = (EVEN_TURN * lam[NA]) / Math.max(1e-6, turned) // screen px a radian of its bend is worth
    for (let j = 1, add = 0; j < n; j++) { add += per * bend[j]; lam[j] += add }
    const v = along(Q, Q.a, Q.ring, lam) / (Q.in - EASE / 2)
    for (let j = 0; j < n; j++) hs[j] = (hs[j] + easeBack(lam[j] / v)) / 2 // when it gets here, screens of scroll after the release
  }
  Q.lam = lam
  Q.cam = follow ? C : null
  Q.px = px
  Q.py = py
  Q.grow = grow
  Q.W = W
  Q.H = H
  Q.v = along(Q, Q.a, Q.ring, lam) / (Q.in - EASE / 2)
  T.Q = Q
  T.end = s0 + xs[256]
}
// The camera following it at the story's scroll s, for about.js cameraAt, in the release frame: on screen = centre +
// z * (point - aim); its aim x, y; g: how much the hole has grown about the rock (px, py); h: how far it has taken over
// from the close up (over HANDOFF). null: no camera follows (reduced motion)
export function followAt(T, s) {
  const Q = T.Q, C = Q && Q.cam
  if (!C) return null
  const a = arcOf(T, s) - Q.a0, L = (q) => along(Q, Q.a, a, q), [h, hz] = handoff(sinceOf(Q, s))
  return { z: 1 + (L(C.z) - 1) * hz, x: Q.W / 2 + (L(C.x) - Q.W / 2) * h, y: Q.H / 2 + (L(C.y) - Q.H / 2) * h, g: 1 + (Q.grow - 1) * h, h, px: Q.px, py: Q.py }
}
// how far the camera following it has taken over from the close up x screens of scroll after the release: where it aims,
// and (sooner, to make room round the rock) how far out it has zoomed
const handoff = (x) => [smoother(x / HANDOFF), smoother(x / (ZOOM_FIRST * HANDOFF))]
// how much of what is a px along its path, at x, y on screen, is still there: past its head's place on the ring it fades
// as it goes on round, and whatever of that is in the shadow (T.clip) goes out; once its head is in, the stream's tail end
// follows it in (T.tail, from prep)
function keep(T, a, x, y) {
  const Q = T.Q
  if (!Q) return 1
  const past = a - Q.a0 - Q.ring
  let k = (1 - smooth(past / Q.fade)) * smooth((a - T.tail) / Q.soft + 1)
  if (past > 0 && T.clip) { const c = T.clip, d = Math.hypot(x - c.cx, y - c.cy) - c.R; if (d < 0) k *= smooth(1 + d / (0.12 * c.R)) }
  return k
}
// how far what is a px along its path has cooled into the hole's own colours, 0..1, once it has gone on round the ring
const warmOf = (T, a) => (T.Q ? smooth((a - T.Q.a0 - T.Q.ring) / (COOL * T.Q.fade)) : 0)

// the point back px behind it along its path at scroll s (the way its tail goes): { x, y, tx, ty (the way it goes) }, css px
export const pathAt = (T, s, back = 0) => pointAt(T, arcOf(T, s) - back, {})
// where it is at scroll s: [x, y] of its centre in css px
export function posAt(T, s) {
  const F = stateAt(T, s, {})
  return [F.x, F.y]
}
// something of the asteroid's is on screen and moving on its own (the fire, the tumbling rock) at scroll s
export const asteroidBusy = (T, s) => s > ENTER - 0.02 && s < T.end
// the name's impact (name.js drawName shatters the line), once its fire is about to reach it
export const impactOf = (T, s) => (T && s >= T.impact.s - 0.04 ? T.impact : null)

// ---------------- the fire's shape ----------------
// the path behind it, len px back from its centre on screen, as a polyline relative to its centre (F.tl: x, y, px back,
// how near, ...)
const TAIL_N = 16
function tailOf(T, F, len) {
  const P = F.tl || (F.tl = new Float64Array(4 * (TAIL_N + 1))), o = T.tmp
  for (let k = 0; k <= TAIL_N; k++) {
    const b = (k * len) / TAIL_N
    view(T, pointAt(T, F.a - b / T.cam.k, o))
    P[4 * k] = o.x - F.x
    P[4 * k + 1] = o.y - F.y
    P[4 * k + 2] = b
    P[4 * k + 3] = o.d
  }
}
// A point (rx, ry) css px from the rock's centre, in a frame where the path behind it runs straight back: q[0] how far
// ahead along its way (behind it: minus how far back along its path), q[1] how far off to one side, q[3] how near the
// path is there (> 0 in front of the hole)
function pathFrame(F, rx, ry, q) {
  const al = rx * F.tx + ry * F.ty
  q[0] = al
  q[1] = ry * F.tx - rx * F.ty
  q[3] = F.d
  if (al >= 0) return
  const P = F.tl
  let best = Infinity
  for (let k = 0; k < TAIL_N; k++) {
    const x0 = P[4 * k], y0 = P[4 * k + 1], ex = P[4 * k + 4] - x0, ey = P[4 * k + 5] - y0, el = ex * ex + ey * ey
    if (!el) continue
    const f = Math.min(k + 1 < TAIL_N ? 1 : Infinity, Math.max(0, ((rx - x0) * ex + (ry - y0) * ey) / el)), px = rx - x0 - ex * f, py = ry - y0 - ey * f, d2 = px * px + py * py
    if (d2 >= best) continue
    best = d2
    q[0] = -(P[4 * k + 2] + (P[4 * k + 6] - P[4 * k + 2]) * f)
    q[1] = (ey * px - ex * py) / Math.sqrt(el)
    q[3] = P[4 * k + 3] + (P[4 * k + 7] - P[4 * k + 3]) * Math.min(1, f)
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
// hot white), lum its brightness; ch is a character; back: the layer behind the hole; warm: in the hole's own colours,
// not the fire's. Under the about-me's text some cells are left out (T.knock: about.js knockOf), cell by cell on the
// hole's grid, so the field parts round the type
function put(T, ch, x, y, heat, lum, back, warm = 0) {
  if (T.knock) {
    const k = T.knock(x, y)
    if (k > 0 && hash(Math.floor(x / T.A.CW) + 7919, Math.floor(y / T.A.CH) + 104729) < k) return
  }
  const tag = heat < 0.1 ? DEEP : heat < 0.2 ? RED : heat < 0.45 ? ORANGE : heat < 0.75 ? AMBER : HOT
  const key = back * BACK + warm * WARM + tag * 512 + Math.max(0, Math.min(511, Math.round(lum * 300)))
  let b = T.buckets.get(key)
  if (!b) T.buckets.set(key, (b = { a: [], n: 0 }))
  b.a[b.n++] = ch
  b.a[b.n++] = x
  b.a[b.n++] = y
}
// split between the front layer and the one behind the hole (wb 0 = all in front, 1 = all behind), and between the
// fire's colours and the hole's (wm 0 = all the fire's, 1 = all the hole's)
function putD(T, ch, x, y, heat, lum, wb, wm = 0) {
  for (let back = 0; back < 2; back++) {
    const l = lum * (back ? wb : 1 - wb)
    if (l < 0.002) continue
    if (wm < 0.999) put(T, ch, x, y, heat, l * (1 - wm), back)
    if (wm > 0.001) put(T, ch, x, y, heat, l * wm, back, 1)
  }
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
    const at = F.a + q[0] / T.cam.k, dn = q[3], depth = inFire(F, O, fr, big, q[0], q[1], q) // at, dn: how far along its path this is, and how near
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
    fl *= BLAZE * keep(T, at, X, Y)
    if (fl < 0.1) continue
    const ch = fl < 0.45 && hash(i + 4096, j + 4096) < 0.6 ? stroke(X - x0, Y - y0) : POOLS[poolOf(fl * 0.95)][Math.floor(hash(i, j + Math.floor(t * 9)) * 6)]
    putD(T, ch, X, Y, heat, 0.25 + 0.95 * fl, wbOf(dn), warmOf(T, at)) // in front of or behind the hole as its own part of the path is
  }
}

// The dust trail, on the hole's own letter grid: back along the way it came, cooling from flame to dim red dust,
// widening as it goes. As the tide pours the rock into it, it narrows with it and burns brighter and hotter, reaches
// further back (LAG) and runs on ahead of it along its way (LEAD), thin and tapering: its stream, spiralling in. Each of
// its glyphs is in front of or behind the hole as its own part of the path is
function drawTrail(T, F, t) {
  // lengths along it (a, Lmax, rs, wOf) are in the scene; across it, on screen, they are K times that. a < 0: ahead of it
  const { A, Q } = T, K = T.cam.k, cols = A.cols, rows = A.rows, cw = A.CW, chh = A.CH, rs = TRAIL_WIDTH * T.rr * (1 - 0.5 * SHED * F.tide)
  const ahead = Q ? LEAD * F.tide * Q.turn : 0, Lmax = TRAIL * T.rr + (Q ? LAG * F.tide * Q.turn : 0), NH = F.tide > 0 ? 56 : 28
  const glow = TRAIL_GLOW * (1 + RIBBON * F.tide), P = [], o = T.tmp
  if (glow < 0.01 || rs * K < 0.5) return
  for (let k = 0; k < NH; k++) { const a = -ahead + (k * (Lmax + ahead)) / (NH - 1); view(T, pointAt(T, F.a - a, o)); P.push({ x: o.x, y: o.y, a, d: o.d }) }
  const a0 = rs * 0.7 * F.lam // it starts under the flames
  const best = T.best, ta = T.ta, td = T.td, touched = T.touched
  let nt = 0
  const wOf = (a) => (a < 0 ? rs * (0.45 - 0.3 * Math.min(1, -a / ahead)) : rs * (0.45 + (1 - 0.7 * F.tide) * Math.pow(Math.min(1, a / Lmax), 0.7)))
  for (let k = 0; k + 1 < P.length; k++) {
    const p = P[k], q = P[k + 1], w = (1.6 * Math.max(wOf(p.a), wOf(q.a)) + cw / K) * K
    if (p.a > w / K - a0 && q.a < a0 - w / K) continue // under the flames: nothing to draw
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
    const id = touched[n], d2 = best[id], a = ta[id], b = Math.abs(a)
    best[id] = 1e9
    const w = wOf(a) * K, px = A.G.px[id], py = A.G.py[id]
    const nzv = NZ(a / (1.8 * rs) - t * 0.6, (Math.sqrt(d2) / (rs * K)) * 0.7 + 3, 2)
    const fall = a < 0 ? F.tide * Math.exp(-b / (0.5 * ahead + 1)) : Math.exp(-a / (0.55 * Lmax)) // ahead: only as much as the tide has pulled on
    const I = Math.exp(-d2 / (w * w)) * fall * sst(a0, a0 + 1.2 * rs, b) * (0.3 + 1.1 * nzv) * glow * keep(T, F.a - a, px, py)
    const hc = hash(id, 77)
    if (I < 0.05 || hc > 0.25 + 1.2 * I) continue // dust: sparse where it is thin
    const heat = 0.14 + 0.85 * Math.exp(-b / (TRAIL_HOT * Lmax * (1 + 2 * F.tide)))
    const ch = I < 0.35 ? DUST[Math.floor(hash(id, 78) * 5)] : POOLS[poolOf(I * 0.6)][Math.floor(hash(id, 79) * 6)]
    putD(T, ch, px, py, heat, 0.15 + 0.7 * I, wbOf(td[id]), warmOf(T, F.a - a))
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
// trail, sparks) drawn into the front layer and the one behind the hole, each with its glow. h: the hole on screen
function prep(T, s, t, cam, knock, h) {
  const F = T.F, Q = T.Q
  if (F.s === s && F.t === t && F.cam === cam && F.knock === knock && F.h === h) return F
  T.cam = cam
  T.knock = knock
  const x = Q && s > Q.s0 ? sinceOf(Q, s) - Q.in : -Infinity // screens of scroll since its head came onto the ring
  T.clip = Q && s > Q.s0 ? h : null // the shadow, for keep: what has gone in goes out in it
  // once its head is in, the ribbon's tail end follows it in: from the far end of its longest trail to past the edge
  T.tail = x > 0 ? Q.a0 + Q.ring + Q.soft - (Q.lt + Q.soft) * (1 - smoother(x / Q.drain)) : -Infinity
  F.knock = knock
  F.h = h
  view(T, stateAt(T, s, F))
  F.t = t
  F.cam = cam
  for (const b of T.buckets.values()) b.n = 0
  drawTrail(T, F, t)
  if (s < SPARKS_UNTIL + 0.3) drawSparks(T, s)
  drawFlames(T, F, t)
  F.front = render(T, 0)
  F.back = render(T, 1)
  T.cam = NO_CAM // the rest of the time (contacts, the impact) it works in the scene
  T.knock = T.clip = null
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
  x.font = T.A.font
  for (const [key, b] of T.buckets) {
    if (!b.n || (key >= BACK) !== !!back) continue
    x.fillStyle = BLUE_FIRE && !(key & WARM) ? blueOf(key % WARM) : colorOf(key % WARM)
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
// the rock onto c (the screen, or the layer behind the hole), stretched and shrunk; vis: 0..1. Once its head is on the
// ring the shadow eats whatever of it crosses its edge (no WebGL2: the soft head just shrinks away)
function drawRock(c, T, F, h, s, t, vis) {
  if (F.sz < 0.02 || vis < 0.002) return
  // the stretch undone, for the shader: screen offsets (y up) back to the round rock, column major
  const cs = F.tx, sn = -F.ty, p = 1 / F.lam, w = Math.sqrt(F.lam), m01 = cs * sn * (p - w)
  const aniso = new Float32Array([cs * cs * p + sn * sn * w, m01, m01, sn * sn * p + cs * cs * w]), R = T.rr * F.sz * F.cam.k
  const clip = T.Q && F.a > T.Q.a0 + T.Q.ring ? h : null // once its head is on the ring
  if (drawComet(c, { W: T.W, H: T.H, dpr: T.dpr, x: F.x, y: F.y, r: R, h, s, t, vis, aniso, clip })) return
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
  if (!(s > ENTER && s < T.end) || cam.a <= 0) return
  const F = prep(T, s, t, cam, knock, h)
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
  if (!(s > ENTER && s < T.end) || cam.a <= 0) return
  const F = prep(T, s, t, cam, knock, h), vis = smooth((s - ENTER) / FADE_IN) * cam.a
  drawRock(ctx, T, F, h, s, t, vis * (1 - F.wb))
  if (F.front) addLayer(ctx, T, T.cv, T.glows, vis)
  ctx.setTransform(T.dpr, 0, 0, T.dpr, 0, 0)
}
