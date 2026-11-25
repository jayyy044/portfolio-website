// EXPERIENCE: the gravity grid. The rock has gone into the hole, and its last ripple runs out across space: where it
// passes, space itself shows, a lattice of glyphs (a sheet in perspective, + where its major lines cross, a dot at each
// point between), bending down from far out into a well round the hole (its depth as 1/r), where it turns to rings round
// the hole and spokes down into it; the hole rides above the well's bottom, so its lowest loops show beneath it. The camera
// pulls back to see the whole well, then swings round and glides out along the sheet's line through the hole, a timeline:
// each role arrives as a small asteroid (drawn as the story's rock is, comet.js drawRocks: ray-marched on the GPU, lumpy
// and cratered, lit from the hole's side, its fine glyphs matched to its ridges and rims; each its own shape, and rolling
// slowly) falling from above onto that line behind a short tongue of blue fire, newest nearest the hole. It lands in its
// own dimple (the sheet gives and settles) with a puff of dust, sends a soft ring across the lattice, and a faint stem stays
// from it up to its role, which types out just above it (as the about-me does: each letter scrambles, locks white hot, cools). At
// each role the camera turns back toward the hole just enough to keep it in view, so the line of rocks always leads into
// its well. As the camera moves on, the role folds into a small label by its mass (its date and title), so the line reads
// as a career. The hole shrinks as the camera pulls back only down to HOLE_MIN of its resting size, so its letters stay
// crisp: past that it is drawn bigger than the camera alone would see it, and the framing comes from moving it instead.
// The sheet's colour is its depth: ice blue on the flat, white hot deep in a well. All glyphs, drawn behind the hole's
// gas; the sky turns with the camera (lensing.js SKY_VIEW). A pure function of the scroll but for the rocks' slow tumble on
// the clock (when the scroll stops, all else holds still), so scrolling back rewinds it. Reduced motion: the same camera (it
// moves only with the scroll), but no ripples, no falls and no tumble: the sheet, the masses and the text fade in.
import { smooth, hole, INTRO_END, POOLS } from './blackhole'
import { hash, bigger } from './name'
import { put, render, canvas, glowsOf, stroke, DUST as MOTES } from './asteroid'
import { ROOM_END, farOf } from './about'
import { SKY_VIEW } from './lensing'
import { drawRocks, surfaceOf, SURFACE_SLACK } from './comet'
import { valueNoise } from './nebula'
import { ROLES } from './roles'

// ---------- the beats, in screens of scroll after the story's end (about.js ROOM_END) ----------
const PULL = 0.9 // the camera pulls back from where the story left the hole, and the ripple shows the sheet, over this
const OVER_HOLD = 0.25 // then holds on the whole well this long
const GLIDE = 0.7 // it glides from the well to the first role, and from each role to the next, over this
const DWELL = 0.6 // and holds at each role this long
const FALL = 0.2 // a role's mass falls onto the sheet over this
const LAND_LEAD = 0.1 // landing this long before the camera arrives
const TYPE = 0.3 // its role types over this, from when it lands
const LEAVE = 0.25 // as the camera moves on, the role's text and its stem fade out over this
const GROW = 0.2, PAST_ROCK = 0.5 // and once they have, its rock (held small while its text showed, if that was long) settles over this at this much of its full size
const END_HOLD = 0.6 // after the last role arrives the camera holds this long, and the page's scroll room ends
export const ROOM = PULL + OVER_HOLD + ROLES.length * GLIDE + (ROLES.length - 1) * DWELL + END_HOLD // screens of scroll this section adds
// ---------- the camera (a real perspective one: the hole and the sky are placed where it sees them) ----------
const PITCH = 0.45 // how far it looks down onto the sheet, radians (0 = straight across it); at each role it tips as far as puts the hole at HOLE_READ_Y, within PITCH_MIN..PITCH_MAX
const PITCH_MIN = 0.3, PITCH_MAX = 0.75
const PITCH_LOW = 0.22 // and as little as this, to put the hole just where it goes (as where it goes lower to give a role's text room: HOLE_DIP)
// screens narrower than TALL_FROM (width against height) ease from the wide layout toward the tall one (phones, upright
// tablets), all the way by TALL_AT: every *_TALL value below blends in, and the camera swings round with it, the timeline
// running off to the right of the hole (wide), then toward us, then off to its left (tall). No size snaps from one to the other
const TALL_FROM = 1.2, TALL_AT = 0.65
// half way between the two, where the camera looks down the timeline at the hole and the text sits over it, the hole is
// drawn smaller: this much of its least size, easing back toward either end
const MID_HOLE = 0.65
// where the text would meet the hole's light the hole goes lower, at most this far (screen heights): it does that first, over
// this much of the blend from wide (DIP_FIRST), before anything else moves
const HOLE_DIP = 0.16, DIP_FIRST = 0.15
const FOCAL = 1.3 // its lens: the focal length, in half the screen's diagonals (higher = narrower, flatter)
const OVER_X = 0.5, OVER_Y = 0.42 // the hole in the overview, in screen widths and heights from the top left
const OVER_R = 0.075, OVER_R_TALL = 0.1 // and its shadow's radius then, in sky units (wide screens, tall ones)
const READ_X = 0.58, READ_X_TALL = 0.18 // where each role's mass sits while its role reads, screen widths
const READ_Y = 0.75, READ_Y_TALL = 0.8 // and screen heights
const READ_R = 0.11, READ_R_TALL = 0.16 // the size of a shadow radius there, in sky units (how near the camera comes)
const CARD_LIFT = 1.6 // its role's text sits this far above its mass (the bottom of the text to the top of the mass), in lines
const TOP_MIN = 0.06 // but no higher than this, screen heights (it goes higher only to keep clear of the hole's light)
const HOLE_READ_X = 0.11, HOLE_READ_X_TALL = 0.75 // and at each role the camera turns back toward the hole until it is this far across the screen (screen widths; keep the hole's shadow and ring, about 1.4 of its radii, on screen)
const HOLE_READ_Y = 0.35, HOLE_READ_Y_TALL = 0.6 // and tips until it is this far down (screen heights)
// the smallest the hole gets as the camera pulls back, against its resting size (blackhole.js rest()), wide screens and
// tall ones: past this it stops shrinking (easing into it over HOLE_EASE either side), so its letters stay crisp; the
// sheet goes on shrinking round it. 1 = the hole never gets smaller than at rest; 0 = it shrinks as far as the camera goes
const HOLE_MIN = 0.45, HOLE_MIN_TALL = 0.65, HOLE_EASE = 0.12
// ---------- the sheet ----------
const LATTICE = 0.6 // the lattice's spacing, in the hole's shadow radii
// the hole's well, a smooth funnel: how deep its bottom is below the flat sheet, and how far out the sheet bends (it has
// sunk one shadow radius this far from the hole; twice as far, half as much: as 1/r), both in shadow radii
const WELL = 8.5, REACH = 20
const HOLE_LIFT = 5.5 // the hole's centre above the well's bottom, shadow radii: it rides above it, so the well's lowest loops show beneath it
// inside the well the lattice turns to rings round the hole (evenly spaced across, so they crowd together where the well
// steepens toward its bottom) and spokes down into it: out to this far from the hole, shadow radii (the square lattice
// takes over beyond, the two blending over its outer 40%), how many rings, how many spokes, the most chords that draw a
// ring (the outermost; smaller ones fewer, for the same length each), and how bright the rings and the spokes are against
// the square lattice
const POLAR_R = 12, RINGS = 6, SPOKES = 8, RING_SEGS = 48, RING_LUM = 1.7, SPOKE_LUM = 0.8
const FOG = [1.3, 2.4] // the sheet fades out from this far to this far away, in the camera's distances to what it looks at
const SPOT = 1.1 // and fades to the sides, half gone this far from what the camera looks at, in the same distances
const STEP = 1.1, RING_STEP = 1.4 // glyphs along a line: one every this many letter cells (the well's rings and spokes: RING_STEP)
const LOD_PX = 20 // lines closer together on screen than about twice this, in px, thin out (every other one fades)
const MAJOR = 4 // every this many lattice points is a major line, drawn in strokes (- | / and back slash); between them a dot marks each point
const MAJOR_LUM = 0.5, MINOR_LUM = 0.42, CROSS_LUM = 0.8 // how bright the major lines are, the dots, and the + where majors cross
const MINOR = '.' // the dots' glyph
const AXIS = 1.5 // the line through the hole and the masses (the timeline) is this much brighter
const HEAT_FLAT = 0.6, HEAT_DEEP = 0.95 // their colour: on the flat sheet (ice blue), and deep in a well (white hot)
const DEEP_LUM = 1.6 // and how much brighter they get deep in a well
// ---------- the rock's last ripple (it shows the sheet as it passes) ----------
const RING_SPEED = 28 // how fast it runs out, in shadow radii a screen of scroll
const RING_W = 2 // its width, shadow radii
const RING_H = 0.8 // how high it lifts the sheet, shadow radii (less, further out)
const RING_GLOW = 1.4 // how much brighter the lattice is under it
const RING_FADE = 30 // it dies away over about this many shadow radii
// ---------- the masses ----------
const MASS_X0 = 10, MASS_DX = 6.5, MASS_DX_TALL = 10 // the newest lands this far from the hole along the sheet, each older one this much further (tall screens: MASS_DX_TALL, where the camera looks more nearly along the line, so they crowd), shadow radii (to its right; tall screens, its left)
const DIMPLE = 2.2, DIMPLE_CORE = 2.6 // its dimple: how deep, how wide, shadow radii
const BOUNCE = 0.06, BOUNCE_FREQ = 9 // the sheet gives and settles as it lands: over about this many screens of scroll, this fast
const RIPPLE_SPEED = 20, RIPPLE_W = 1.0, RIPPLE_H = 0.25, RIPPLE_GLOW = 0.9, RIPPLE_FADE = 14 // the ring it sends out, as the rock's
const STEM_LUM = 0.3 // and the stem that stays, from it up to its role's text
// ---------- each mass is a small asteroid, drawn as the story's rock is (comet.js drawRocks: its look, light and glyphs are
// set there), each its own shape from its hash ----------
const ROCK_R = 0.9 // its radius, in shadow radii as the camera sees it there, but at least ROCK_MIN and at most ROCK_MAX letter cells (tall screens: at least ROCK_MIN_TALL)
const ROCK_MIN = 5.5, ROCK_MAX = 13, ROCK_MIN_TALL = 2.5
const ELONGATE = 0.12 // how much longer than round it may be (each rock its own, from its hash)
const FACETS = 0.15 // how deep its four flat faces cut into it, in its radii (0 = none: a smooth potato)
const ROCK_LUMPS = 0.3 // how lumpy it is (the story's ball: 0.06)
const ROCK_SCALE = 0.42 // its size against its craters (the story's ball: 0.6): lower = bigger craters on it
const TILT = 0.1 // its long axis leans up to this far off level, radians (each its own, from its hash)
const SPIN = 0.06 // it rolls about its long axis, always, this fast: radians a second on the page's clock (reduced motion: it holds still)
const TUMBLE = 2.6 // and turns this many radians more as it falls, with the scroll
const SIT = 0.15 // its centre sits this far above the bottom of its dent, in its radii (lower: deeper in it; the sheet hides what of it is below: about the bottom 20-30% at 0.15)
const EMBED_SLACK = 0.08 // how much lower than its dent's near rim it may show, its radii (the rim is rough: comet.js SMALL_EMBED_ROUGH)
// ---------- its fall and landing ----------
const FIRE = 2.6, FIRE_RIM = 0.22, FIRE_LUM = 0.85 // the story's blue fire round it as it falls, in small (gone as it lands): how far back its tongue reaches and how far its rim stands off it, in its radii from its centre and its edge; how bright
const FLICKER = 25 // how fast its flames run back along it, as it falls
const DUST = 36, DUST_REACH = 2.2, DUST_TIME = 0.28, DUST_LUM = 1.2 // the puff it throws out across the sheet as it lands: how many motes, how far they go (shadow radii), screens of scroll they last, how bright
const ROCK_CLEAR = 1.4 // its text keeps this far from it, in its radii past its edge (and the roles' labels give way to other rocks)
// ---------- the text ----------
const FONT_MIN = 15, FONT_MAX = 26 // its size, px (the about-me's): as big as fits, up to a 55th of the screen's width (tall: a 26th) or a 34th of its height (tall: a 56th)
const TITLE = 1.2 // the title's size, against the rest
const MAX_COLS = 34 // the longest a line gets, in characters
const TEXT_GAP = 1.5 // from the stem to the text's left edge, in letter cells
const TEXT_RIGHT = 0.05 // the right margin, in screen widths
const LINE_GAP = 1.5 // line height, in font sizes
const DESC_GAP = 0.45 // extra room above the one-line description, in lines
const POINT = '- ', POINT_GAP = 0.25, POINT_SIZE = 0.6, POINT_COLS = 64, POINT_MIN = 9, POINT_SMALL = 55 // a role with several points (line: [...]): each starts with this, its wrapped lines indented under it, this much extra room (in lines) between them, its size against the text's; and where the text is held narrower than the room it has (MAX_COLS), off wide screens (TALL_FROM), its lines may run on across that room, up to this many of its characters; and on small screens no bigger than the square root of the screen's area over POINT_SMALL, down to POINT_MIN px
const LABEL = 0.55, LABEL_MIN = 11, LABEL_COLS = 26 // a past role's label (LABEL_ROWS, beside its mass): its size against the text's, px at least, and its widest line in characters
const LABEL_ROWS = ['title', 'org'] // what it shows, top to bottom: any of 'when' (its dates), 'title', 'org' (its company)
const LABEL_KEEP = 2, LABEL_KEEP_TALL = 1 // how many of the latest past roles stay (tall screens: LABEL_KEEP_TALL, where the line crowds toward the hole; between, the one more shows part way): an older one's label and rock fade out as the camera moves on (its dent stays: the sheet's shape never changes; scrolling back brings them back)
const LABEL_GAP = 0.5 // from as far as its rock reaches (however it rolls) to its label, in letter cells
const LABEL_NEARER = 1.5 // and it stays at least this many letter cells nearer its own rock than any other (a tethered one: this far from any other)
const LABEL_REACH = 6 // it looks for a clear place beside its rock out to this many cells further than LABEL_GAP; none clear: further out, tethered
const LABEL_LEFT = true // wide screens: it sits out to the left of its rock, level with it, wherever that is clear (out to LABEL_REACH), before trying any other side
const LABEL_DROP = 8 // and it may sit up to this many letter cells lower than level with it there, to keep clear of the hole's light
const LABEL_UNDER = 3 // or it hangs just under it (slid along it), when that is this many letter cells nearer its rock as it shows than the nearest clear place on its left
const LEADER_MAX = 150 // how far out (cells) a tethered label may go, at most
const LEADER_AWAY = 8 // how much further (cells) it will go to sit on the side of its rock away from the hole
const LEADER_CROSS = 12 // and how much further to keep its leader off the hole's light, other rocks and other leaders
const LEADER_MIN = 2 // a label further than this from its rock (cells) is tied to it by a leader; nearer, none
const LEADER_LUM = 0.7 // the leader: a dotted line (the stems' glyph and spacing) from the rock's edge to its label, this bright
const LABEL_GIVE = 0.6 // a label fades out as a later role's text or label comes over it, over this much overlap, in font sizes
const KNOCK_PAD = 1.2 // the lattice clears round the text this far, in font sizes, fading over the same again
const LABEL_KNOCK = 0.25 // and round a past role's small label this far (small: the lattice runs on up to it, between the rocks)
const EDGE_FADE = 0.05 // text fades out over this much of the screen's edges, in screen heights
const WHEN_RGB = [255, 177, 90], TITLE_RGB = [244, 240, 248], ORG_RGB = [150, 200, 255], LINE_RGB = [196, 192, 204] // the date (the about-me's kicker colour), title, company, description
const HOT_RGB = [255, 250, 242] // a letter as it locks, white hot
const SCRAMBLE = 0.025, SWAPS = 3, SCRAMBLE_ALPHA = 0.4, SCRAMBLE_SET = 'acemnorsuvxz' // before a letter locks it scrambles in its place: screens of scroll, glyphs, brightness
const COOL = 0.1 // screens of scroll a locked letter takes to cool to its colour
const GLOW = 0.25 // the bloom round the text
const SHEET_GLOW = 0.6 // and round the sheet's glyphs
const HOLE_CLEAR = 0.6 // text never shows within this many shadow radii of the hole's light (it fades out there)
const TIP_EASE = 1.5 // a role's text keeps above the hole's disk, less and less past its tips, free of it this many radii further out
const LABEL_CLEAR = 0.15 // a past role's small label: this many

const MONO = '"JetBrains Mono", Menlo, Consolas, monospace'
const HOLE_Y = -WELL + HOLE_LIFT // the hole's centre above the flat sheet, in its shadow radii (negative: down in its well)
const well = (r2) => -REACH / Math.sqrt(r2 + (REACH / WELL) ** 2) // the sheet's height r² from the hole
// how big the hole is drawn (against its resting size) when the camera would see it k big: k, but easing into X.kMin
const holeK = (X, k) => { const m = X.kMin, w = HOLE_EASE; return k >= m + w ? k : k <= m - w ? m : m + (k - m + w) ** 2 / (4 * w) }
const c01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const smoother = (x) => { x = c01(x); return x * x * x * (x * (6 * x - 15) + 10) }
const lerp = (a, b, k) => a + (b - a) * k
const mix = (a, b, k) => a.map((v, i) => Math.round(v + (b[i] - v) * k))
// how far above the hole's centre its light reaches, dx from it across, both in its radii (about.js holeTop)
const holeTop = (dx) => { const a = Math.abs(dx); return a < 2.6 ? 1.95 * Math.sqrt(1 - (a / 2.6) ** 2) + 0.15 : a < 5.1 ? 0.5 : 0 }
// how far (x, y) is outside the hole's light, in its radii: past its disk's tips, or above or below its arch and disk
// (below its centre, HOLE_BELOW of that: its lower ring is thinner than the arch over it)
const HOLE_BELOW = 0.6 // measured at the end hold (1440x900, 1366x768, 390x844): its light reaches about 1.2 radii under its middle, 0.7-0.9 a radius to either side, 0.25-0.4 past that
const lightGap = (h, x, y) => { const ax = Math.abs(x - h.cx) / h.R; return Math.max(ax - 5.1, Math.abs(y - h.cy) / h.R - (y > h.cy ? HOLE_BELOW : 1) * holeTop(ax)) }
const NZ = valueNoise(9137) // the fire's flames (asteroid.js's)
const level = (k) => (k === 0 ? 30 : 31 - Math.clz32(k & -k)) // how many times k halves evenly: a line's rank in the lattice

// ---------------- layout ----------------
// W, H, dpr: the screen; B: the hole's resting place (blackhole.js rest()); art: its letter grid (ascii.js createArt);
// S: the sky's unit; reduced: prefers reduced motion
export function create(W, H, dpr, B, art, S, reduced) {
  const t0 = smoother((TALL_FROM - W / H) / (TALL_FROM - TALL_AT)), dip = smoother(t0 / DIP_FIRST), tw = smoother((t0 - DIP_FIRST) / (1 - DIP_FIRST)), tall = tw > 0.5, { CW, CH } = art, snap = (v) => Math.round(v * dpr) / dpr
  const [cv, x] = canvas(Math.round(W * dpr), Math.round(H * dpr))
  const X = { W, H, dpr, B, S, A: art, reduced, tall, tw, Y0: -Math.PI * tw, F: { s: NaN }, o: {} }
  const midway = 4 * tw * (1 - tw) // 1 half way between, 0 at either end
  X.kMin = X.kMin0 = lerp(HOLE_MIN, HOLE_MIN_TALL, tw) * (1 - (1 - MID_HOLE) * midway) // camera() lowers it if the story leaves the hole smaller than this
  X.T = { A: art, buckets: new Map(), cv, x, glows: glowsOf(W, H), dpr, W, H, knock: null } // the glyph layers (asteroid.js put, render)
  X.f = (FOCAL * Math.hypot(W, H)) / 2
  X.rmin = lerp(ROCK_MIN, ROCK_MIN_TALL, tw) * CW
  X.keep = lerp(LABEL_KEEP, LABEL_KEEP_TALL, tw)
  const [tc, tx] = canvas(Math.round(W * dpr), Math.round(H * dpr)), [gc, gx] = canvas(Math.max(1, Math.round(W / 3)), Math.max(1, Math.round(H / 3)))
  Object.assign(X, { tc, tx, gc, gx, key: '' })

  // the beats: when the camera arrives at each role, and when its mass lands
  X.at = ROLES.map((r, i) => PULL + OVER_HOLD + GLIDE + i * (GLIDE + DWELL))
  // the timeline runs off to the right of the hole (+x); the camera turns round the hole by Y0 (tall screens: half a turn,
  // so it runs off to the left, the hole on the right)
  X.mass = ROLES.map((r, i) => ({ x: MASS_X0 + i * lerp(MASS_DX, MASS_DX_TALL, tw), z: 0, land: X.at[i] - LAND_LEAD, K: rockOf(i) }))

  // where each mass comes to rest on the sheet (in the hole's well, in its own dimple)
  // (its own dent, and those of the rocks that landed before it, which reach it: they are wide)
  X.rest = X.mass.map((m, i) => X.mass.slice(0, i + 1).reduce((y, n) => y - (DIMPLE * DIMPLE_CORE) / Math.hypot(m.x - n.x, m.z - n.z, DIMPLE_CORE), well(m.x * m.x + m.z * m.z)))

  // the camera's poses: what it looks at (tx, ty, tz), which way it faces (yaw: 0 = straight across the sheet, the
  // timeline running off to the right; negative = turned back toward the hole), where what it looks at is on screen (px,
  // py, screen fractions), and how far away it is (as a log, so zooming eases evenly). It holds at each, gliding between
  const readR = lerp(READ_R, READ_R_TALL, tw) * S, overR = lerp(OVER_R, OVER_R_TALL, tw) * S, rx = lerp(READ_X, READ_X_TALL, tw), ry = lerp(READ_Y, READ_Y_TALL, tw), Y0 = X.Y0
  X.keys = []
  const key = (u, tx, ty, tz, yaw, px, py, R, pitch = PITCH) => X.keys.push({ u, tx, ty, tz, yaw, pitch, px, py, ld: Math.log(X.f / R) })
  key(0, 0, HOLE_Y, 0, Y0, 0.5, B.cy / H, B.R) // the hole where the story left it (camera() puts in where that really is)
  key(PULL, 0, HOLE_Y, 0, Y0, OVER_X, OVER_Y, overR)
  key(PULL + OVER_HOLD, 0, HOLE_Y, 0, Y0, OVER_X, OVER_Y, overR)
  const hx = lerp(HOLE_READ_X, HOLE_READ_X_TALL, tw) * W, hy0 = lerp(HOLE_READ_Y, HOLE_READ_Y_TALL, tw) * H, o = X.o, d = X.f / readR
  // role i's camera: turned back toward the hole, and tipped, just enough to keep it in view, at HOLE_READ_X and hy: the
  // nearest of a grid of turns and tips (fresh: tipped PITCH_MIN..PITCH_MAX), then exactly there (Newton steps from where it
  // was, tipped no less than PITCH_LOW), so it moves smoothly with the screen
  const aim = (m, i, hy, fresh) => {
    const at = (yaw, pitch) => proj(camOf(X, m.x, X.rest[i], m.z, yaw, pitch, rx * W, ry * H, d), 0, HOLE_Y, 0, o)
    m.hy = hy
    if (fresh) {
      let err = Infinity
      for (let k = 0; k <= 120; k++) for (let j = 0; j <= 30; j++) {
        const yaw = Y0 + lerp(-1.45, -0.3, tw) + (1.75 * k) / 120, pitch = lerp(PITCH_MIN, PITCH_MAX, j / 30), e = at(yaw, pitch).z > 0 ? Math.hypot(o.x - hx, o.y - hy) : Infinity
        if (e < err) Object.assign(m, { yaw, pitch, err: (err = e) })
      }
    }
    const lo = PITCH_LOW, q = 1e-4, step = (v) => Math.max(-0.05, Math.min(0.05, v)), was = { yaw: m.yaw, pitch: m.pitch, e: at(m.yaw, m.pitch).z > 0 ? Math.hypot(o.x - hx, o.y - hy) : Infinity }
    for (let n = 0; n < 8; n++) {
      at(m.yaw, m.pitch)
      const ex = o.x - hx, ey = o.y - hy
      if (Math.hypot(ex, ey) < 0.05) break
      at(m.yaw + q, m.pitch)
      const xy = (o.x - hx - ex) / q, yy = (o.y - hy - ey) / q
      at(m.yaw, m.pitch + q)
      const xp = (o.x - hx - ex) / q, yp = (o.y - hy - ey) / q, det = xy * yp - xp * yy
      if (!det) break
      const dp = step((yy * ex - xy * ey) / det)
      let dy = step((xp * ey - yp * ex) / det)
      const p = Math.max(lo, Math.min(PITCH_MAX, m.pitch + dp))
      if (p !== m.pitch + dp) { dy = xy || yy ? step(-(ex * xy + ey * yy) / (xy * xy + yy * yy)) : 0 } // (held at its limit: the turn alone brings it as near as it can)
      m.yaw += dy
      m.pitch = p
    }
    m.err = at(m.yaw, m.pitch).z > 0 ? Math.hypot(o.x - hx, o.y - hy) : Infinity
    if (m.err > was.e) Object.assign(m, { yaw: was.yaw, pitch: was.pitch, err: was.e }) // (never worse than it started)
  }
  X.mass.forEach((m, i) => aim(m, i, hy0, true))
  // how high the hole's light reaches (px down the screen) under block b's text (its stem at the reading place), seen from
  // role i's camera, the hole as big as it is drawn there; and the same were its disk's streak to run on past its tips
  const light = (i, b) => {
    const m = X.mass[i], C = camOf(X, m.x, X.rest[i], m.z, m.yaw, m.pitch, rx * W, ry * H, d), hp = proj(C, 0, HOLE_Y, 0, {}), hr = B.R * holeK(X, C.f / hp.z / B.R)
    // (it reaches highest nearest the hole: so where the text comes nearest it, across, in its radii)
    const ax = Math.max(0, rx * W + b.x0 - hp.x, hp.x - rx * W - b.x1) / hr, top = hp.y - (Math.max(ax < 2.6 ? holeTop(ax) : 0, 0.5) + 1.2 * HOLE_CLEAR) * hr // (its arch running into its disk)
    return [top + (H - top) * smoother((ax - 5.1) / TIP_EASE), top]
  }

  // the text: each role a block hanging to the right of the top of its stem, its date first (fonts: the text, its title,
  // a label)
  // (wide screens' size easing into tall ones', never below that: so it only ever shrinks as the screen narrows)
  const fw = Math.min(W / 55, H / 34), ft = Math.min(W / 26, H / 56), fs = Math.round(Math.max(FONT_MIN, Math.min(FONT_MAX * bigger(W, H), Math.max(fw * (1 - tw) + ft * tw, ft))))
  const lh = fs * LINE_GAP
  // a role's points: POINT_SIZE of the text, but at least LABEL_MIN, or on small screens a POINT_SMALL-th of their size (to
  // POINT_MIN): so the longest roles still fit over the hole there, and their size never flickers as the screen changes
  const pt = Math.max(Math.round(fs * POINT_SIZE), POINT_MIN, Math.min(LABEL_MIN, Math.round(Math.sqrt(W * H) / POINT_SMALL)))
  const px = [fs, Math.round(fs * TITLE), Math.max(LABEL_MIN, Math.round(fs * LABEL)), pt]
  X.fonts = px.map((p) => `500 ${p}px ${MONO}`)
  X.px = px
  X.fs = fs
  const cw = X.fonts.map((f) => { tx.font = f; return tx.measureText('M').width }), gap = TEXT_GAP * CW
  const room = Math.floor((W - Math.max(TEXT_RIGHT * W, EDGE_FADE * H) - rx * W - gap) / cw[0]) // (clear of the screen edge's fade)
  const wide = dip * Math.min(room * cw[0], POINT_COLS * cw[3]) // as wide as a role's points may run (POINT_COLS; wide screens keep to MAX_COLS, easing over DIP_FIRST)
  const wrap = (str, cols) => {
    const out = [], words = String(str || '').split(/\s+/).filter(Boolean)
    let i = 0
    while (i < words.length) {
      let l = words[i++]
      while (i < words.length && l.length + 1 + words[i].length <= cols) l += ' ' + words[i++]
      while (l.length > cols) { out.push(l.slice(0, cols)); l = l.slice(cols) } // a word longer than a line breaks
      out.push(l)
    }
    return out
  }
  // rows of text: [font, colour, string, extra room above in lines] each, laid out down from 0 (the first row's middle)
  const lay = (parts, cols) => {
    const rows = []
    let y = 0
    for (let [fi, rgb, str, extra, lead = ''] of parts) for (const [n, l] of wrap(str, Math.max(8, Math.floor(Math.max(cols * cw[0], fi === 3 ? wide : 0) / cw[fi])) - lead.length).entries()) {
      const prev = rows.at(-1)
      if (prev) y += ((px[prev.fi] + px[fi]) / 2) * LINE_GAP + (extra || 0) * lh
      rows.push({ fi, rgb, str: (n ? ' '.repeat(lead.length) : lead) + l, dy: y })
      extra = 0
    }
    return rows
  }
  const box = (rows) => ({ w: Math.max(...rows.map((r) => r.str.length * cw[r.fi])), y0: rows[0].dy - 0.7 * px[rows[0].fi], y1: rows.at(-1).dy + 0.7 * px[rows.at(-1).fi] })
  X.blocks = ROLES.map((r, i) => {
    const cols = Math.max(12, Math.min(MAX_COLS, room))
    const rows = lay([[0, WHEN_RGB, r.when], [1, TITLE_RGB, r.title], [0, ORG_RGB, r.org], ...[r.line].flat().map((l, j, L) => (L.length > 1 ? [3, LINE_RGB, l, j ? POINT_GAP : DESC_GAP, POINT] : [0, LINE_RGB, l, DESC_GAP]))], cols)
    const chars = []
    rows.forEach((row) => [...row.str].forEach((ch, col) => ch !== ' ' && chars.push({ ch, rgb: row.rgb, fi: row.fi, dx: gap + (col + 0.5) * cw[row.fi], dy: row.dy })))
    const from = X.mass[i].land + 0.02
    chars.forEach((q, k) => { q.k = k / Math.max(1, chars.length - 1); q.at = from + TYPE * q.k })
    const b = box(rows)
    // its label once the camera moves on: its title over its company (LABEL_ROWS), hugging its rock (prep puts it: beside it, under it, on
    // its other side or over it, whichever is clear). Laid out from its left edge, level with its middle
    const lab = lay(LABEL_ROWS.map((k) => [2, { when: WHEN_RGB, title: TITLE_RGB, org: ORG_RGB }[k], r[k]]), (LABEL_COLS * cw[2]) / cw[0]), lb = box(lab), mid = (lab[0].dy + lab.at(-1).dy) / 2, glyphs = []
    lab.forEach((row) => [...row.str].forEach((ch, col) => ch !== ' ' && glyphs.push({ ch, rgb: row.rgb, fi: 2, dx: (col + 0.5) * cw[2], dy: row.dy - mid })))
    return { chars, lab: { glyphs, w: lb.w, y0: lb.y0 - mid, y1: lb.y1 - mid }, i, from, x0: gap - 0.2 * fs, x1: gap + b.w + 0.2 * fs, y0: b.y0, y1: b.y1, leave: i < ROLES.length - 1 ? X.at[i] + DWELL : Infinity }
  })
  // a role whose text the hole's light would reach, were its disk's streak to run on (as it comes under the text as the screen
  // narrows), has the hole lower on the screen instead, as far as gives its text room above it, up to HOLE_DIP screen heights
  // (easing in over DIP_FIRST)
  X.mass.forEach((m, i) => {
    for (let n = 0; n < 3; n++) {
      const b = X.blocks[i], need = dip * (TOP_MIN * H - (light(i, b)[1] - b.y1))
      if (need < 0.5) break
      aim(m, i, Math.min(hy0 + HOLE_DIP * H, m.hy + need))
    }
  })
  X.mass.forEach((m, i) => {
    key(X.at[i], m.x, X.rest[i], m.z, m.yaw, rx, ry, readR, m.pitch)
    key(X.at[i] + DWELL, m.x, X.rest[i], m.z, m.yaw, rx, ry, readR, m.pitch)
    // it falls from above the top of the screen (at its reading place); its stem reaches up to its role's text there, its
    // glyphs about a letter cell apart
    m.up = (dy) => (dy * d) / (X.f * Math.cos(m.pitch) + dy * Math.sin(m.pitch)) // how high above it shows dy px higher
    m.dropH = m.up(ry * H + 0.1 * H)
    m.step = CH / (readR * Math.cos(m.pitch))
  })
  const rTop = (SIT + Math.max(1, ...X.mass.map((m) => m.K.ext)) + 0.5 * ROCK_CLEAR) * Math.min(ROCK_MAX * CW, Math.max(X.rmin, ROCK_R * readR)) // the top of a rock there, and room above it
  // each stem reaches up to its role's text, CARD_LIFT lines above its rock, or as far above that as keeps the text clear
  // of the hole's light (as big as it is drawn there: a long role, tall screens), seen from the camera's place at that role
  X.stemH = X.blocks.map((b, i) => {
    // (between wide screens and tall ones it rises toward the top first, as the hole goes lower: so its disk coming under
    // it, as the screen narrows, has no more to move it)
    const m = X.mass[i], y = Math.max(TOP_MIN * H, Math.min(lerp(ry * H - rTop - CARD_LIFT * lh, TOP_MIN * H + b.y1, dip * (1 - tw)), light(i, b)[0]) - b.y1)
    // a long role's text that can't go that high comes down nearer its rock: then its rock is drawn no bigger than keeps
    // all of it (however it turns) clear of the text (rcap, px)
    m.rcap = (ry * H - y - b.y1) / (SIT + m.K.ext + 0.5 * ROCK_CLEAR)
    return m.up(ry * H - y)
  })
  X.held = X.mass.map((m, i) => { const p = proj(camOf(X, m.x, X.rest[i], m.z, m.yaw, m.pitch, rx * W, ry * H, d), m.x, X.rest[i] + X.stemH[i], m.z, {}); return { x: p.x, y: p.y } })
  X.snap = snap
  return X
}

// ---------------- the camera ----------------
// a camera looking at (tx, ty, tz) from d away, turned by yaw, tipped down by pitch, that point at (px, py) on screen
function camOf(X, tx, ty, tz, yaw, pitch, px, py, d) {
  const sp = Math.sin(pitch), cp = Math.cos(pitch), sy = Math.sin(yaw), cy = Math.cos(yaw)
  const fx = sy * cp, fy = -sp, fz = cy * cp // forward
  return { cx: tx - fx * d, cy: ty - fy * d, cz: tz - fz * d, fx, fy, fz, rx: cy, rz: -sy, ux: sy * sp, uy: cp, uz: cy * sp, f: X.f, px, py, d, sp, yaw, pitch }
}
// the camera at u (screens of scroll after ROOM_END): held at each pose, glided between them
function poseAt(X, u) {
  const K = X.keys
  let i = 1
  while (i < K.length - 1 && u > K[i].u) i++
  const a = K[i - 1], b = K[i], e = smoother((u - a.u) / (b.u - a.u)), m = (k) => lerp(a[k], b[k], e)
  return camOf(X, m('tx'), m('ty'), m('tz'), m('yaw'), m('pitch'), m('px') * X.W, m('py') * X.H, Math.exp(m('ld')))
}
// a point of the scene, x across, y up, z away (in the hole's shadow radii), onto the screen: o.x, o.y px, o.z its depth
function proj(C, x, y, z, o) {
  const dx = x - C.cx, dy = y - C.cy, dz = z - C.cz
  const depth = dx * C.fx + dy * C.fy + dz * C.fz, k = C.f / depth
  o.x = C.px + (dx * C.rx + dz * C.rz) * k
  o.y = C.py - (dx * C.ux + dy * C.uy + dz * C.uz) * k
  o.z = depth
  return o
}

// The camera: the story's until it ends; then the perspective camera's, which places the hole (and the sky with it: the
// far camera, kf, fox, foy as about.js farOf uses them) where it sees it, drawn no smaller than HOLE_MIN (holeK). The sky
// stays where the story left it and turns with the camera (lensing.js SKY_VIEW). Near things are left as they were
export function camera(X, s, cam) {
  if (!X || s <= ROOM_END) {
    SKY_VIEW.on = false
    return cam
  }
  const K = X.keys[0], id = cam.kf + ' ' + cam.fox + ' ' + cam.foy
  if (K.cam !== id) { // start from where the story's camera (constant once it ends) left the hole
    K.cam = id
    K.px = ((X.W / 2) * cam.kf + cam.fox) / X.W
    K.py = (X.B.cy * cam.kf + cam.foy) / X.H
    K.ld = Math.log(X.f / (X.B.R * cam.kf))
    X.kMin = Math.min(X.kMin0, cam.kf - HOLE_EASE) // so the hole doesn't jump as the camera takes over
    X.sky = farOf(hole(INTRO_END, X.W, X.H, X.S), cam) // the sky as the story left it (lensing.js pins it to the hole before it moved)
    X.skyR = X.B.R * cam.kf
  }
  const C = poseAt(X, s - ROOM_END), o = proj(C, 0, HOLE_Y, 0, X.o), kf = holeK(X, C.f / o.z / X.B.R)
  SKY_VIEW.on = true
  SKY_VIEW.sky = X.sky
  SKY_VIEW.hR = X.skyR
  SKY_VIEW.yaw = C.yaw - X.Y0 // (the sky as the story left it at the start, whichever way the camera came round)
  SKY_VIEW.pitch = C.pitch - PITCH
  return { ...cam, kf, fox: o.x - (X.W / 2) * kf, foy: o.y - X.B.cy * kf }
}

// it redraws with the scroll and the camera, and on the page's own FPS tick
export const busy = () => false

// ---------------- the sheet ----------------
// the sheet at (x, z): its height (F.y), how much of it the ripple has shown (F.v), how much brighter a ripple makes it
// (F.g), and how deep in a well it is, 0..1 (F.d)
function field(F, x, z) {
  const r2 = x * x + z * z
  let y = well(r2), g = 0, v = F.fade
  const deep = -y / WELL
  if (F.ring >= 0) {
    const r = Math.sqrt(r2), q = (r - F.ring) / RING_W + 0.8
    if (q > -3.5) { // (well behind it, it has gone: nothing to add)
      const e = Math.exp(-q * q), dim = Math.exp(-r / RING_FADE)
      v *= smooth((F.ring - r) / RING_W) // nothing ahead of its front (and nothing at all as it starts out from the hole)
      y += RING_H * e * dim
      g += RING_GLOW * e * dim
    }
  }
  let dd = 0
  for (let i = 0; i < F.nm; i++) {
    const m = F.ms[i], dx = x - m.x, dz = z - m.z, q2 = dx * dx + dz * dz, w = (m.depth * DIMPLE_CORE) / Math.sqrt(q2 + DIMPLE_CORE * DIMPLE_CORE)
    y -= w
    dd = Math.max(dd, w / DIMPLE)
    if (m.rip >= 0) {
      const q = (Math.sqrt(q2) - m.rip) / RIPPLE_W, e = Math.exp(-q * q) * m.ripA
      y += RIPPLE_H * e
      g += RIPPLE_GLOW * e
    }
  }
  F.y = y
  F.v = v
  F.g = g
  F.d = Math.max(deep, dd)
}

// how much the lattice clears for the text at (x, y), 0..1
// (strong: as much once the text is a third in, as for a rock's fire and dust, which must never cross it)
function knockAt(F, x, y, strong) {
  let k = 0
  for (let i = 0; i < F.nb; i++) {
    const b = F.boxes[i], p = b.pad
    const dx = Math.max(b.x0 - x, x - b.x1, 0), dy = Math.max(b.y0 - y, y - b.y1, 0)
    k = Math.max(k, (strong ? smooth(b.a / 0.3) : b.a) * (1 - smooth(Math.hypot(dx, dy) / p)))
  }
  return k
}

// one glyph of the sheet, z deep: in the layer behind the rocks, or (where it is nearer than a rock) the one over them
function mark(X, F, ch, x, y, lum, z) {
  if (lum < 0.02 || x < -20 || x > X.W + 20 || y < -20 || y > X.H + 20) return
  if (F.nb) lum *= 1 - knockAt(F, x, y)
  if (lum < 0.02) return
  put(X.T, ch, X.snap(x), X.snap(y), F.heat, lum, inFront(F, x, y, z) ? 0 : 1)
}
// whether something on the sheet at (x, y) on screen, z deep, is nearer than a rock's surface there (the near rim of its
// dent, crossing in front of it); each rock taken as a ball of its radius
function inFront(F, x, y, z) {
  for (const p of F.rk) {
    if (!p) continue
    const d2 = (x - p.x) ** 2 + (y - p.y) ** 2
    if (d2 > p.e * p.e) continue
    const w = (Math.sqrt(d2) * p.zc) / F.C.f // how far off its centre, in the scene's units
    if (z < p.zc - Math.sqrt(Math.max(0, p.Rw * p.Rw - w * w))) return true
  }
  return false
}

// The lattice: every crossing in view projected once, then each line drawn between them, one glyph every STEP cells
// along it (more of them where it comes nearer, fading in by halves, so a mark stays put on the sheet), and a + at each
// crossing. Lines that crowd together on screen thin out by halves too, far away
function drawSheet(X, F, C) {
  const { W, H } = X, { CW, CH } = X.A, L = LATTICE, d = C.d, far = FOG[1] * d
  // the patch of sheet in view: where rays through the screen's corners (and straight ahead) meet it, no further than the
  // fog reaches; a little more for the wells, which pull the sheet down into view
  const mg = 0.1 * Math.max(W, H)
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity
  for (const [sx, sy] of [[-mg, -mg], [W + mg, -mg], [-mg, H + mg], [W + mg, H + mg], [C.px, -mg]]) {
    const a = (sx - C.px) / C.f, b = (sy - C.py) / C.f
    const dx = C.fx + a * C.rx - b * C.ux, dy = C.fy - b * C.uy, dz = C.fz + a * C.rz - b * C.uz, hl = Math.hypot(dx, dz)
    let t = dy < 0 ? -C.cy / dy : Infinity
    t = Math.min(t, (far * 1.2) / Math.max(1e-6, hl))
    const px = C.cx + dx * t, pz = C.cz + dz * t
    x0 = Math.min(x0, px); x1 = Math.max(x1, px); z0 = Math.min(z0, pz); z1 = Math.max(z1, pz)
  }
  x0 = Math.min(x0, C.cx); x1 = Math.max(x1, C.cx); z0 = Math.min(z0, C.cz); z1 = Math.max(z1, C.cz)
  const kx0 = Math.floor(x0 / L) - 2, kx1 = Math.ceil(x1 / L) + 2, kz0 = Math.floor(z0 / L) - 2, kz1 = Math.ceil(z1 / L) + 2
  const nx = kx1 - kx0 + 1, nz = kz1 - kz0 + 1, n = nx * nz
  if (!X.P || X.P.n < n) X.P = { n, x: new Float32Array(n), y: new Float32Array(n), z: new Float32Array(n), a: new Float32Array(n), h: new Float32Array(n) }
  const P = X.P, o = X.o, f0 = FOG[0] * d, fw = (FOG[1] - FOG[0]) * d, tx = C.cx + C.fx * d, tz = C.cz + C.fz * d, sr = 1 / (SPOT * d) ** 2
  const spot = (x, z) => 1 / (1 + ((x - tx) ** 2 + (z - tz) ** 2) * sr)
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const id = j * nx + i, x = (kx0 + i) * L, z = (kz0 + j) * L
    field(F, x, z)
    proj(C, x, F.y, z, o)
    P.x[id] = o.x
    P.y[id] = o.y
    P.z[id] = o.z
    P.a[id] = o.z > 0.05 * d ? F.v * (1 - smooth((o.z - f0) / fw)) * (1 + F.g) * spot(x, z) : 0
    P.h[id] = F.d + 0.25 * F.g
  }
  const fade = (k, sp) => smooth((sp * 2 ** Math.min(level(k), 10)) / LOD_PX - 1) // a line's lod
  // how far apart on screen the line through id (on to id + a) and the next one over (id + b) are, square to it
  const gapOf = (id, a, b) => {
    const ex = P.x[id + a] - P.x[id], ey = P.y[id + a] - P.y[id], vx = P.x[id + b] - P.x[id], vy = P.y[id + b] - P.y[id]
    return Math.abs(ex * vy - ey * vx) / (Math.hypot(ex, ey) || 1)
  }
  // how much of the square lattice shows at (x, z): none deep in the well, where the rings and spokes are, all past POLAR_R
  const sq = (x, z) => smooth((Math.hypot(x, z) - 0.6 * POLAR_R) / (0.4 * POLAR_R))
  // glyphs along the sheet from (xa, za) to (xb, zb), at (x0, y0) and (x1, y1) on screen, a this strong; each glyph's world
  // point lerped and projected afresh. polar: a ring or spoke (else the square lattice)
  const run = (a, xa, za, xb, zb, x0, y0, x1, y1, polar) => {
    const sx = x1 - x0, sy = y1 - y0, len = Math.hypot(sx, sy)
    if (len < 1) return
    if (Math.max(x0, x1) < -20 || Math.min(x0, x1) > W + 20 || Math.max(y0, y1) < -20 || Math.min(y0, y1) > H + 20) return
    const step = (polar ? RING_STEP : STEP) * (Math.abs(sx / len) * CW + Math.abs(sy / len) * CH), m = len / step
    if (m < 1) return
    const N = 2 ** Math.min(6, Math.floor(Math.log2(m))), fine = smooth(m / N - 1) // N glyphs at full, the next N fading in between them
    const ch = stroke(sx, sy), lum = MAJOR_LUM
    for (let k = 1; k < 2 * N; k++) {
      const odd = k & 1
      if (odd && fine < 0.02) continue
      const t = k / (2 * N), x = lerp(xa, xb, t), z = lerp(za, zb, t), b = polar ? 1 - sq(x, z) : sq(x, z)
      if (b < 0.01) continue
      field(F, x, z)
      proj(C, x, F.y, z, o)
      if (o.z <= 0.05 * d) continue
      const dp = Math.min(1, F.d + 0.25 * F.g)
      F.heat = HEAT_FLAT + (HEAT_DEEP - HEAT_FLAT) * dp
      const al = F.v * (1 - smooth((o.z - f0) / fw)) * (1 + F.g) * (1 + DEEP_LUM * dp * dp) * spot(x, z)
      mark(X, F, ch, o.x, o.y, lum * a * al * b * (odd ? fine : 1), o.z)
    }
  }
  // a line of the square lattice from crossing p to q (ids), its rank fade a
  const line = (p, q, a, xa, za, xb, zb) => {
    if (P.a[p] > 0.01 || P.a[q] > 0.01) run(a, xa, za, xb, zb, P.x[p], P.y[p], P.x[q], P.y[q], false)
  }
  // a stretch of a ring or spoke, a this bright
  const seg = (a, xa, za, xb, zb) => {
    field(F, xa, za)
    proj(C, xa, F.y, za, o)
    const x0 = o.x, y0 = o.y, z0 = o.z
    field(F, xb, zb)
    proj(C, xb, F.y, zb, o)
    if (z0 > 0.05 * d && o.z > 0.05 * d) run(a, xa, za, xb, zb, x0, y0, o.x, o.y, true)
  }
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const id = j * nx + i, kx = kx0 + i, kz = kz0 + j, x = kx * L, z = kz * L
    // across (x): its lod by how far the next line back is on screen; and away (z): by how far the next one across is
    const ax = fade(kz, gapOf(id, i + 1 < nx ? 1 : -1, j + 1 < nz ? nx : -nx)), az = fade(kx, gapOf(id, j + 1 < nz ? nx : -nx, i + 1 < nx ? 1 : -1))
    const mx = kx % MAJOR === 0, mz = kz % MAJOR === 0
    if (mz && i + 1 < nx && ax > 0.01) line(id, id + 1, ax * (kz === 0 ? AXIS : 1), x, z, x + L, z)
    if (mx && j + 1 < nz && az > 0.01) line(id, id + nx, az, x, z, x, z + L)
    // where two majors cross a +; a minor crossing a major ticks it (a fainter +); two minors, a dot
    const a = Math.min(ax, az) * P.a[id] * (mx && mz ? CROSS_LUM : mx || mz ? 0.55 * CROSS_LUM : MINOR_LUM) * sq(x, z)
    if (a > 0.01) {
      const dp = Math.min(1, P.h[id])
      F.heat = HEAT_FLAT + (HEAT_DEEP - HEAT_FLAT) * dp
      mark(X, F, mx || mz ? '+' : MINOR, P.x[id], P.y[id], a * (1 + DEEP_LUM * dp * dp), P.z[id])
    }
  }
  // the well: its rings (from where the square lattice is mostly gone, in toward the bottom), and the spokes between them, a
  // + where they cross
  const rs = []
  for (let k = 0; k < RINGS; k++) rs.push(0.85 * POLAR_R * (1 - k / RINGS))
  for (const r of rs) {
    const n = Math.max(8, Math.round((RING_SEGS * r) / POLAR_R)), q = (2 * Math.PI) / n
    for (let j = 0; j < n; j++) seg(RING_LUM, r * Math.cos(j * q), r * Math.sin(j * q), r * Math.cos(j * q + q), r * Math.sin(j * q + q))
  }
  for (let j = 0; j < SPOKES; j++) for (let k = 0; k < RINGS; k++) {
    const c = Math.cos((2 * Math.PI * j) / SPOKES), sj = Math.sin((2 * Math.PI * j) / SPOKES), r = rs[k], x = r * c, z = r * sj
    if (k + 1 < RINGS) seg(SPOKE_LUM, x, z, rs[k + 1] * c, rs[k + 1] * sj)
    field(F, x, z)
    proj(C, x, F.y, z, o)
    const b = 1 - sq(x, z), dp = Math.min(1, F.d + 0.25 * F.g)
    if (o.z <= 0.05 * d || b < 0.01) continue
    F.heat = HEAT_FLAT + (HEAT_DEEP - HEAT_FLAT) * dp
    mark(X, F, '+', o.x, o.y, CROSS_LUM * b * F.v * (1 - smooth((o.z - f0) / fw)) * (1 + F.g) * (1 + DEEP_LUM * dp * dp) * spot(x, z), o.z)
  }
}

// rock i's radius on screen, px, at depth z from the camera C, at u: held small enough to keep clear of its text while that
// shows (rcap), then (over GROW) PAST_ROCK of its full size once the camera has moved on and its text has faded
const rockR = (X, C, z, i, u) => {
  const r = Math.min(ROCK_MAX * X.A.CW, Math.max(X.rmin, (ROCK_R * C.f) / z)), held = Math.min(r, Math.max(0, X.mass[i].rcap))
  return held + (PAST_ROCK * r - held) * smooth((u - X.blocks[i].leave - LEAVE) / GROW)
}

// the masses: each, a small rock, falls from above the screen straight down onto its place on the sheet, a short tongue
// of fire behind it; it lands in its dimple with a puff of dust, and a faint line stays from it up to its
// role's text (a pin, its text at the top)
// where each rock is this frame (F.rk), falling or at rest: its centre, radius and reach (e) on screen, its depth (z: of
// the sheet under it; zc: of its centre), its turn from the fall (psi; drawUnder adds its tumble on the clock), and how it
// sits in its dent: its radius in the scene's units (Rw), its centre's height above the bottom of the dent (lift), how deep
// the dent is now (dent) and the well's slope there (gx, gz)
function placeRocks(X, F, C, u) {
  const o = X.o
  F.rk = F.rk || []
  for (let i = 0; i < X.mass.length; i++) {
    const m = X.mass[i], tau = u - (m.land - FALL)
    F.rk[i] = null
    if (tau <= 0) continue
    field(F, m.x, m.z)
    const vis = (X.reduced ? smooth((u - m.land) / 0.1) : 1) * keptA(X, i, u)
    if (vis < 0.01) continue
    const fell = X.reduced ? 1 : c01(tau / FALL), ym = F.y + m.dropH * (1 - fell * fell) // it falls as things do: faster and faster
    const q = u - m.land, landed = X.reduced ? 1 : smooth(q / 0.03)
    proj(C, m.x, ym, m.z, o)
    if (o.z <= 0) continue
    const r = rockR(X, C, o.z, i, u), Rw = (r * o.z) / C.f, lift = ym - F.y + (SIT * Rw) / Math.cos(C.pitch) // it sits in its dent
    const k = REACH / Math.pow(m.x * m.x + m.z * m.z + (REACH / WELL) ** 2, 1.5) // the well's slope there: d(height)/d(x, z) = k (x, z)
    const p = F.rk[i] = { x: o.x, y: o.y - SIT * r, r, e: m.K.ext * r, z: o.z, zc: o.z - lift * Math.sin(C.pitch), Rw, lift, dent: m.dent, gx: k * m.x, gz: k * m.z, ym, vis, q, tau, fell, landed, psi: m.K.psi + TUMBLE * (1 - fell), K: m.K }
    const rh = reachOf(C, p) // the box it shows in, however it rolls, and its fire above it as it falls
    p.box = [p.x - rh.l, p.y - rh.t - FIRE * r * (1 - landed), p.x + rh.r, p.y + rh.b]
    p.top = rh.t
  }
}

function drawMasses(X, F, C, u) {
  const o = X.o, { CW, CH } = X.A
  for (let i = 0; i < X.mass.length; i++) {
    const m = X.mass[i], p = F.rk[i], step = m.step
    if (!p) continue
    const { x: x0, y: y0, r, top, vis, q, landed } = p, rest = X.rest[i]
    // the stem, from just above it up to its text (it comes in once it has landed, and goes as the camera moves on)
    const sh = X.stemH[i], stem = STEM_LUM * (X.reduced ? vis : smooth(q / 0.15)) * (1 - smooth((u - X.blocks[i].leave) / LEAVE))
    if (stem > 0.02) for (let k = 1, yk = rest + step; yk <= rest + sh; k++, yk = rest + k * step) {
      proj(C, m.x, yk, m.z, o)
      if (o.z > 0 && y0 - o.y > top + 0.5 * ROCK_CLEAR * r) rockPut(X, F, ':', o.x, o.y, 0.8, stem, 0)
    }
    // the fire round it as it falls: the story's blue flame in small (asteroid.js drawFlames), a thin rim hugging the rock
    // that streams back behind it into a short tongue, white hot at the rock and cooling to deep blue, its flames running
    // back; gone as it lands. Its glyphs keep to a grid anchored to the rock, so they move with it (the rock, drawn after,
    // hides those over it)
    const fl = FIRE_LUM * (1 - landed) * vis
    if (fl > 0.02) {
      const r0 = 0.9 * r, side = (1 + FIRE_RIM) * r, ni = Math.ceil(side / CW), j0 = Math.ceil(side / CH), j1 = Math.ceil((FIRE * r) / CH), run = p.tau * FLICKER
      for (let j = -j0; j <= j1; j++) for (let c = -ni; c <= ni; c++) {
        const dx = c * CW, b = j * CH, d = Math.hypot(dx, b), back = Math.max(0, b / (d || 1)) // b: back along its way (up)
        const t = (d - r0) / (r * (1 + FIRE_RIM + (FIRE - 1 - FIRE_RIM) * back ** 6) - r0) // 0 at the rock's edge, 1 at the flame's tip
        if (t < 0 || t >= 1) continue
        const nz = NZ(Math.atan2(dx, b) * 2.5 + 7.7 * i, (d / r) * 1.3 - run, 2)
        const I = fl * (1 - t) ** 1.2 * (0.5 + 1.1 * Math.max(0, nz - 0.3))
        if (I < 0.12) continue
        const ch = I < 0.3 ? MOTES[Math.floor(hash(c + 4096, j + 99) * 5)] : POOLS[I < 0.55 ? 1 : I < 0.8 ? 2 : 3][Math.floor(hash(c + 4096, j + 4096 + Math.floor(run * 3)) * 6)]
        rockPut(X, F, ch, x0 + dx, y0 - b, 0.98 * (1 - t) ** 1.4, 0.3 + 0.9 * I, 0)
      }
    }
    // the puff as it lands: motes thrown out across the sheet round it, a little hop, sparks first then dust
    if (!X.reduced && q > 0 && q < DUST_TIME) {
      const f = q / DUST_TIME, go = 1 - Math.exp(-f * 5), fade = 1 - smooth(f)
      for (let j = 0; j < DUST; j++) {
        const th = (2 * Math.PI * (j + hash(i * 131 + j, 7))) / DUST, sp = 0.35 + 0.65 * hash(i * 131 + j, 19), d = DUST_REACH * sp * go
        const wx = m.x + d * Math.cos(th), wz = m.z + d * Math.sin(th)
        field(F, wx, wz)
        proj(C, wx, F.y + 0.5 * sp * Math.sin(Math.PI * Math.min(1, f * 1.6)), wz, o)
        if (o.z <= 0) continue
        const hot = 1 - smooth(f * 2.5)
        rockPut(X, F, hot > 0.5 ? (j & 1 ? '*' : "'") : j % 3 ? '.' : ',', o.x, o.y, 0.35 + 0.55 * hot, DUST_LUM * fade * (0.5 + 0.5 * sp), 1, o.z)
      }
    }
  }
  // the leaders: a tethered label's dotted line from its rock's edge to it (the stems' glyph and spacing), coming and going
  // with it, never over text
  const m = 0.3 * X.fs
  for (let i = 0; i < X.mass.length; i++) {
    const M = F.marks[i], p = F.rk[i], lum = LEADER_LUM * F.la[i] * smooth((M.own - LEADER_MIN * CW) / CW), g = p && M.lead && lum > 0.02 ? leaderOf(X, p.box, M.gb) : null
    if (!g) continue
    const dx = g[2] - g[0], dy = g[3] - g[1], len = Math.hypot(dx, dy), nn = Math.max(1, Math.round(len / (STEP * ((Math.abs(dx) * CW + Math.abs(dy) * CH) / len))))
    for (let k = 0; k <= nn; k++) {
      const x = g[0] + (dx * k) / nn, y = g[1] + (dy * k) / nn
      if (!F.tb.some((b) => x > b[0] - m && x < b[2] + m && y > b[1] - m && y < b[3] + m)) put(X.T, ':', X.snap(x), X.snap(y), 0.8, lum, 1)
    }
  }
}

// the scene at u (screens past ROOM_END), with the hole drawn as h: the camera, lined up with the hole as drawn (the story's
// camera hands over to it over PULL), at its own scale (where the hole is drawn bigger than it sees it, holeK, the sheet goes
// on shrinking round it); the rock's ripple; the masses that have landed, their dimples and rings; where each rock is
// (placeRocks); and the tops of their stems (once the camera moves on, a role's text holds where it was read while it
// fades, so it is never carried toward the hole). Returns the camera
function stage(X, F, u, h) {
  const C = poseAt(X, u), o = proj(C, 0, HOLE_Y, 0, X.o), kp = C.f / o.z / X.B.R, sc = (h.R * kp) / holeK(X, kp) / (C.f / o.z)
  C.f *= sc
  C.px = h.cx + (C.px - o.x) * sc
  C.py = h.cy + (C.py - o.y) * sc
  F.C = C
  F.fade = X.reduced ? smooth(u / PULL) : 1
  F.ring = X.reduced ? -1 : RING_SPEED * u
  F.ms = F.ms || []
  F.nm = 0
  for (const m of X.mass) {
    const q = u - m.land
    m.dent = 0
    if (q <= 0) continue
    const depth = X.reduced ? DIMPLE * smooth(q / 0.1) : DIMPLE * (1 - Math.exp(-q / BOUNCE) * Math.cos(BOUNCE_FREQ * 2 * Math.PI * q) * (1 - q / (q + 0.5)))
    const rip = X.reduced ? -1 : RIPPLE_SPEED * q, ripA = Math.exp(-rip / RIPPLE_FADE)
    F.ms[F.nm++] = { x: m.x, z: m.z, depth, rip: ripA > 0.02 ? rip : -1, ripA }
    m.dent = depth
  }
  placeRocks(X, F, C, u)
  F.anchors = X.mass.map((m, i) => u > X.blocks[i].leave ? X.held[i] : (proj(C, m.x, X.rest[i] + X.stemH[i], m.z, o), { x: o.x, y: o.y }))
  return C
}
const sep = (b, c) => Math.max(b[0] - c[2], c[0] - b[2], b[1] - c[3], c[1] - b[3]) // how far apart two boxes are (< 0: they overlap)
// how far box b is from the rock in box c, taken as the ellipse in it (its corners are empty)
const nearOf = (b, c) => {
  const cx = (c[0] + c[2]) / 2, cy = (c[1] + c[3]) / 2, ax = (c[2] - c[0]) / 2, ay = (c[3] - c[1]) / 2, dx = Math.max(b[0], Math.min(b[2], cx)) - cx, dy = Math.max(b[1], Math.min(b[3], cy)) - cy, d = Math.hypot(dx, dy)
  return d === 0 ? -1 : d - 1 / Math.hypot(dx / d / ax, dy / d / ay)
}
// how far a label's box b (its middle at y) is outside the hole's light, in its radii (as drawText's vis sees its letters)
const lightOf = (X, h, b, y) => {
  let g = Infinity
  for (const x of [b[0], (b[0] + b[2]) / 2, b[2]]) for (const yy of [b[1], y, b[3]]) g = Math.min(g, lightGap(h, x, yy))
  return g - (0.5 * X.px[2]) / h.R
}
// a leader from the rock in box c to the label's letters gb: from just off the rock's edge toward the label's nearest
// point to it, to just short of that point ([x0, y0, x1, y1], or null if they are too close for one)
const leaderOf = (X, c, gb) => {
  const cx = (c[0] + c[2]) / 2, cy = (c[1] + c[3]) / 2, ax = (c[2] - c[0]) / 2, ay = (c[3] - c[1]) / 2
  const qx = Math.max(gb[0], Math.min(gb[2], cx)), qy = Math.max(gb[1], Math.min(gb[3], cy)), d = Math.hypot(qx - cx, qy - cy)
  if (d === 0) return null
  const ux = (qx - cx) / d, uy = (qy - cy) / d, r = 1 / Math.hypot(ux / ax, uy / ay) + 0.5 * X.A.CW
  return d - 0.5 * X.A.CW > r ? [cx + ux * r, cy + uy * r, qx - ux * 0.5 * X.A.CW, qy - uy * 0.5 * X.A.CW] : null
}
// how far box b is outside the ellipse that fills box e (a rock as it shows, round in its box), px; inside it: negative
const outOf = (b, e) => {
  const cx = (e[0] + e[2]) / 2, cy = (e[1] + e[3]) / 2, qx = Math.max(b[0], Math.min(cx, b[2])) - cx, qy = Math.max(b[1], Math.min(cy, b[3])) - cy, L = Math.hypot(qx, qy)
  return L ? L - L / Math.hypot((2 * qx) / (e[2] - e[0]), (2 * qy) / (e[3] - e[1])) : -1
}
// how near the segment g comes to (x, y)
const segDist = (g, x, y) => { const vx = g[2] - g[0], vy = g[3] - g[1], t = c01(((x - g[0]) * vx + (y - g[1]) * vy) / (vx * vx + vy * vy || 1)); return Math.hypot(g[0] + vx * t - x, g[1] + vy * t - y) }
// whether segments a and b cross
const crosses = (a, b) => { const o = (p, q, r) => Math.sign((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])); const A = [a[0], a[1]], B = [a[2], a[3]], P = [b[0], b[1]], Q = [b[2], b[3]]; return o(A, B, P) !== o(A, B, Q) && o(P, Q, A) !== o(P, Q, B) }

// The rest poses (the camera at role k, from its arrival through its dwell; the last one, the end hold) and, at each, where
// each past role's label sits against its rock ({ dx, dy }: its letters' left edge and middle, from the rock's middle), all
// worked out once (each a function of its pose alone: the scroll then rewinds it). poses[k][j]
function posesOf(X) {
  if (X.poses && X.posesK === X.kMin) return X.poses
  X.posesK = X.kMin // (camera() sets it once the story has left the hole)
  return (X.poses = X.mass.map((m, k) => {
    const u = X.at[k] + 0.5 * (k < X.mass.length - 1 ? DWELL : END_HOLD), C = poseAt(X, u), o = proj(C, 0, HOLE_Y, 0, {})
    const h = { cx: o.x, cy: o.y, R: X.B.R * holeK(X, C.f / o.z / X.B.R) }, F = { s: NaN } // the hole as camera() draws it there
    stage(X, F, u, h)
    return place(X, F, u, h, k)
  }))
}
// At a rest pose (u, the hole as drawn h, the camera at role k): each past role's label (the newest first: nearest the
// hole, they have the fewest places to go) at the nearest place to its rock that is clear: of the hole's light, of every rock (nearer its own
// than any other by LABEL_NEARER cells), of the text on screen and the labels already placed, and of the screen's top and
// bottom (it slides along its sides). First beside it, LABEL_GAP cells off as far as it reaches, then a cell further each
// time out to LABEL_REACH: level with its middle (tall screens: under it first), under it, on its other side, over it,
// then under and over flush with either side. Nothing clear there: further out round it, out to LEADER_MAX, preferring
// the side away from the hole and a leader that keeps off the hole's light, other rocks and other leaders (and never goes
// into its shadow); tied to it by that leader. Nowhere clear at all: beside it (it gives way)
function place(X, F, u, h, k) {
  const { W, H } = X, CW = X.A.CW, edge = EDGE_FADE * H, gap = LABEL_GAP * CW, pd = 0.2 * X.fs, pd2 = 0.2 * X.px[2]
  const cards = X.blocks.filter((B) => c01((u - B.from + 0.05) / 0.1) * (1 - smooth((u - B.leave) / LEAVE)) > 0.01).map((B) => { const A = F.anchors[B.i]; return [A.x + B.x0, A.y + B.y0, A.x + B.x1, A.y + B.y1] })
  const sides = X.tall ? [1, 0, 2, 3, 4, 5, 6, 7] : [0, 1, 2, 3, 4, 5, 6, 7], placed = [], leads = [], offs = []
  const js = []
  for (let j = Math.max(0, k - Math.ceil(X.keep)); j < k; j++) js.push(j)
  for (const j of js.sort((a, b) => keptA(X, b, u) - keptA(X, a, u))) { // (only those still shown) nearest the hole first: they have the fewest places to go (but one only part shown, last)
    const p = F.rk[j]
    if (!p) continue
    const L = X.blocks[j].lab, w = L.w, g0 = L.y0 + pd2, g1 = L.y1 - pd2, [x0, y0, x1, y1] = p.box
    const test = (x, y) => { // its letters' left edge and middle: clear there? (then how far from its rock, and its leader)
      x = Math.max(edge + pd, Math.min(W - edge - pd - w, x))
      const b = [x - pd, y + L.y0, x + w + pd, y + L.y1], gb = [x, y + g0, x + w, y + g1]
      if (b[1] < edge || b[3] > H - edge || sep(gb, p.box) < 0.1 * X.fs || lightOf(X, h, b, y) < 1.6 * LABEL_CLEAR) return null
      if (cards.some((c) => sep(b, c) < pd) || placed.some((c) => sep(b, c) < pd)) return null // (with a little to spare: the rocks settle a touch further)
      const own = nearOf(gb, p.box), lead = own > LEADER_MIN * CW ? leaderOf(X, p.box, gb) : null
      for (let i = 0; i < X.mass.length; i++) if (i !== j && F.rk[i] && sep(b, F.rk[i].box) < (lead ? 0 : Math.max(0, own)) + (LABEL_NEARER + 0.5) * CW) return null
      if (lead && segDist(lead, h.cx, h.cy) < Math.min(1.05 * h.R, Math.hypot(lead[0] - h.cx, lead[1] - h.cy) - 1)) return null // (never into the hole's shadow; from a rock over it, only away from it)
      return { x, y, b, lead }
    }
    let best = null
    const at = (s0, g) => { // its letters' left edge and its middle, g off its rock: right, under, left, over; under and over flush with each side
      const c = p.x - w / 2, dn = y1 + g - g0, up = y0 - g - g1
      return [[x1 + g, p.y], [c, dn], [x0 - g - w, p.y], [c, up], [x0, dn], [x1 - w, dn], [x0, up], [x1 - w, up]][s0]
    }
    if (LABEL_LEFT && !X.tall) { // out to its left (level with it, or lower), or hanging under it (slid along it): the nearest its rock as it shows first, the left by LABEL_UNDER cells
      const tries = []
      for (let n = 0; n <= LABEL_REACH; n++) {
        const g = gap + n * CW
        for (let d = 0; d <= LABEL_DROP; d += 0.5) tries.push([x0 - g - w, p.y + d * X.A.CH, 0])
        for (let x = p.x - w + CW; x <= p.x - CW; x += CW / 2) tries.push([x, y1 + g - g0, LABEL_UNDER * CW + 0.05 * Math.abs(x + w / 2 - p.x)]) // (centred under it, the nearer the better)
      }
      for (const q of tries) q[2] += outOf([q[0], q[1] + g0, q[0] + w, q[1] + g1], p.box)
      tries.sort((A, B) => A[2] - B[2])
      for (const [x, y] of tries) if ((best = test(x, y))) break
    }
    for (let n = 0; n <= LABEL_REACH && !best; n++) for (const s0 of sides) if ((best = test(...at(s0, gap + n * CW)))) break
    if (!best) { // further out, round it
      const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, ax = (x1 - x0) / 2, ay = (y1 - y0) / 2, hl = Math.hypot(cx - h.cx, cy - h.cy) || 1
      const hw = w / 2 + pd, hh = (L.y1 - L.y0) / 2, cands = []
      for (let a = 0; a < 32; a++) {
        const ux = Math.cos((a * Math.PI) / 16), uy = Math.sin((a * Math.PI) / 16), toward = (1 - (ux * (cx - h.cx) + uy * (cy - h.cy)) / hl) / 2
        for (let d = (LABEL_REACH + 1) * CW; d <= LEADER_MAX * CW; d += CW) {
          const r = 1 / Math.hypot(ux / ax, uy / ay) + d + Math.abs(ux) * hw + Math.abs(uy) * hh // its middle that far out that way
          cands.push([d + LEADER_AWAY * CW * toward, cx + ux * r - w / 2, cy + uy * r - (L.y0 + L.y1) / 2])
        }
      }
      cands.sort((A, B) => A[0] - B[0])
      let bestCost = Infinity
      for (const [cost, x, y] of cands) {
        if (cost >= bestCost) break
        const t = test(x, y)
        if (!t) continue
        let c = cost // its leader: over the hole's light, another rock, another leader?
        if (t.lead) {
          const g = t.lead
          for (let f = 0; f <= 1; f += 0.1) { const lx = lerp(g[0], g[2], f), ly = lerp(g[1], g[3], f); if (lightGap(h, lx, ly) < 0) { c += LEADER_CROSS * CW; break } }
          for (let i = 0; i < X.mass.length; i++) if (i !== j && F.rk[i] && segDist(g, (F.rk[i].box[0] + F.rk[i].box[2]) / 2, (F.rk[i].box[1] + F.rk[i].box[3]) / 2) < Math.max(F.rk[i].box[2] - F.rk[i].box[0], F.rk[i].box[3] - F.rk[i].box[1]) / 2) c += LEADER_CROSS * CW
          if (leads.some((q) => crosses(q, g))) c += LEADER_CROSS * CW
          for (let f = 0.1; f < 1; f += 0.1) { const lx = lerp(g[0], g[2], f), ly = lerp(g[1], g[3], f); if (cards.concat(placed).some((q) => lx > q[0] && lx < q[2] && ly > q[1] && ly < q[3])) { c += LEADER_CROSS * CW; break } } // (under text it doesn't show)
        }
        if (c < bestCost) { bestCost = c; best = t }
      }
    }
    if (!best) { const [x, y] = at(sides[0], gap); best = { x, y, b: [x - pd, y + L.y0, x + w + pd, y + L.y1], lead: null } } // nowhere clear
    offs[j] = { dx: best.x - p.x, dy: best.y - p.y }
    placed.push(best.b)
    if (best.lead) leads.push(best.lead)
  }
  return offs
}

// how much of role i is still kept (its rock and label): gone as the camera leaves the role X.keep after it (between whole
// counts, part gone then: the rest as it leaves the next)
const keptA = (X, i, u) => {
  const n = Math.floor(X.keep), gone = (j) => 1 - smooth((u - (X.blocks[i + j]?.leave ?? Infinity)) / LEAVE)
  return lerp(gone(n), gone(n + 1), smoother(X.keep - n))
}
// how much of a role's label shows: it comes in as its text goes (and goes with keptA)
const labelA = (X, B, u) => smooth((u - B.leave - 0.4 * LEAVE) / LEAVE) * keptA(X, B.i, u)

// this frame, worked out once for drawUnder and drawOver
function prep(X, h, s) {
  // the sheet changes only with the scroll and the hole's place, so a frame without either moving is the last one again (the
  // cut-out of the hole's gas, render's hide, is then a frame or so old: its shape barely changes)
  const F = X.F
  if (F.s === s && F.cx === h.cx && F.cy === h.cy && F.R === h.R) return F
  F.s = s
  F.cx = h.cx
  F.cy = h.cy
  F.R = h.R
  for (const b of X.T.buckets.values()) b.n = 0
  const u = s - ROOM_END, poses = posesOf(X)
  const C = stage(X, F, u, h)
  // where the text is, so the lattice clears round it
  F.boxes = F.boxes || []
  F.nb = 0
  // each past role's label, by its rock: where it sits against it at each rest pose (posesOf), eased from one to the next
  // as the camera glides (as the camera is), so it never jumps; it follows its rock, but not its roll
  const pd = 0.2 * X.fs, give = LABEL_GIVE * X.fs, CW = X.A.CW, n = X.mass.length
  const ca = X.blocks.map((B) => c01((u - B.from + 0.05) / 0.1) * (1 - smooth((u - B.leave) / LEAVE))) // how much of each role's text shows
  const cards = X.blocks.map((B) => { const A = F.anchors[B.i]; return [A.x + B.x0, A.y + B.y0, A.x + B.x1, A.y + B.y1] })
  let k = n - 1
  while (k >= 0 && u < X.at[k]) k--
  const eg = k < 0 || k === n - 1 ? 1 : smoother((u - X.at[k] - DWELL) / (X.at[k + 1] - X.at[k] - DWELL)) // gliding on from pose k (eg > 0)
  F.marks = X.mass.map((m, j) => {
    const p = F.rk[j], a = k >= 0 ? poses[k][j] : null, b = k >= 0 && k + 1 < n ? poses[k + 1][j] : null, q = eg <= 0 ? a || b : eg >= 1 ? b || a : a && b ? null : a || b
    const o = q || (a && b && { dx: lerp(a.dx, b.dx, eg), dy: lerp(a.dy, b.dy, eg) })
    if (!p || !o) return { x: -1e4, y: -1e4, light: Infinity, own: 0 } // not here (nor is its label)
    const L = X.blocks[j].lab, x = p.x + o.dx, y = p.y + o.dy, gb = [x, y + L.y0 + 0.2 * X.px[2], x + L.w, y + L.y1 - 0.2 * X.px[2]], own = nearOf(gb, p.box)
    return { x, y, light: lightOf(X, h, [x - pd, y + L.y0, x + L.w + pd, y + L.y1], y), own, lead: own > LEADER_MIN * CW, gb }
  })
  // each role's text (a) and label (l), where they are on screen; a label gives way (fades) where a later role's text or
  // label, nearer the camera, covers it (many roles bunch up toward the hole), and fades out, as one, before it comes
  // near the hole's light (where it can't go anywhere by its rock that is clear of it)
  const T = X.blocks.map((B) => {
    const M = F.marks[B.i], L = B.lab
    return { a: ca[B.i], l: labelA(X, B, u) * smooth((M.light - 1.2 * LABEL_CLEAR) / (0.3 * LABEL_CLEAR)), card: cards[B.i], lab: [M.x - pd, M.y + L.y0, M.x + L.w + pd, M.y + L.y1] }
  })
  for (let i = 0; i < T.length; i++) {
    const g = (w, b) => { if (w > 0.01) T[i].l *= 1 - w * (1 - smooth(1 + sep(T[i].lab, b) / give)) }
    for (let j = i + 1; j < T.length && T[i].l > 0.01; j++) {
      g(T[j].a, T[j].card)
      g(T[j].l, T[j].lab)
    }
    const M = F.marks[i], e = (M.lead ? 0 : Math.max(0, M.own)) + LABEL_NEARER * CW // and to any other rock (falling, and its fire, or at rest) not clearly further than its own
    for (let j = 0; j < T.length && T[i].l > 0.01; j++) if (j !== i && F.rk[j]) { const c = F.rk[j].box; g(1, [c[0] - e, c[1] - e, c[2] + e, c[3] + e]) }
    if (F.rk[i] && M.gb) T[i].l *= smooth(sep(M.gb, F.rk[i].box) / (0.1 * X.fs)) // and its own, should it come over it as the camera glides (gone as it touches)
  }
  F.la = T.map((t) => t.l)
  F.tb = T.flatMap((t) => [t.a > 0.01 && t.card, t.l > 0.01 && t.lab]).filter(Boolean) // the text on screen (leaders keep off it)
  const pad = (b, a, p) => (F.boxes[F.nb++] = { x0: b[0] - p, y0: b[1] - p, x1: b[2] + p, y1: b[3] + p, pad: p, a })
  for (const t of T) {
    if (t.a > 0.01) pad(t.card, t.a, KNOCK_PAD * X.fs)
    if (t.l > 0.01) pad(t.lab, t.l, LABEL_KNOCK * X.fs)
  }
  if (F.fade > 0) drawSheet(X, F, C)
  drawMasses(X, F, C, u)
  F.back = render(X.T, 1)
  F.front = render(X.T, 0) // what of the sheet is nearer than a rock: drawn over the rocks
  return F
}

// Under the gas: the sheet, the rocks' fire and dust, with what the hole hides cut out (asteroid.js render), and their glow
export function drawUnder(ctx, X, h, s) {
  if (!X || s <= ROOM_END) return
  const F = prep(X, h, s), T = X.T
  ctx.setTransform(X.dpr, 0, 0, X.dpr, 0, 0)
  if (F.back) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(T.cvB, 0, 0, X.W, X.H)
    for (const g of T.glowsB) {
      ctx.globalAlpha = g.amt * SHEET_GLOW
      ctx.drawImage(g.c, 0, 0, X.W, X.H)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
}

// ---------------- the rocks ----------------
// rock i's shape, from its hash: a ball stretched along one axis and cut by four flat faces, lumpy (comet.js puts its
// craters on it, where its seed says); the turn it starts at; the frame it rolls in (its long axis, a, leaning up to TILT
// off level, and two axes square to it: it rolls about a, so its outline on screen barely changes as it turns); and its
// surface, sampled (comet.js surfaceOf): reach(u) is how far it reaches along the unit u (screen x right, y up, z toward
// us), however it rolls, in its radii; ext, how far any way; dom, comet.js's bounding sphere, in its units
const ROCKS = [] // each rock's shape, worked out once (it depends on its index alone)
function rockOf(i) {
  if (ROCKS[i]) return ROCKS[i]
  const hh = (k) => hash(i * 977 + 13, k)
  const dir = (k) => { const z = 2 * hh(k) - 1, a = 2 * Math.PI * hh(k + 1), q = Math.sqrt(1 - z * z); return [q * Math.cos(a), q * Math.sin(a), z] }
  const e = 1 + ELONGATE * (0.4 + 0.6 * hh(1)), w = 0.9 + 0.2 * hh(2), ax = [e, w / Math.sqrt(e), 1 / (w * Math.sqrt(e))].map((v) => v * ROCK_SCALE)
  const cuts = []
  for (let k = 0; k < 4; k++) {
    const n = dir(10 + 2 * k), reach = Math.hypot(ax[0] * n[0], ax[1] * n[1], ax[2] * n[2]) // how far out it reaches that way
    cuts.push(...n, reach - FACETS * ROCK_SCALE * (0.5 + hh(20 + k)))
  }
  const th = TILT * (2 * hh(6) - 1), ph = 0.6 * TILT * (2 * hh(7) - 1), a = [Math.cos(ph) * Math.cos(th), Math.cos(ph) * Math.sin(th), Math.sin(ph)]
  const bl = Math.hypot(a[0] * a[1], 1 - a[1] * a[1], a[2] * a[1]), b = [-a[0] * a[1] / bl, (1 - a[1] * a[1]) / bl, -a[2] * a[1] / bl] // up, square to a
  const c = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]]
  const shape = [...ax, ROCK_LUMPS], seed = [37 * hh(30), 37 * hh(31), 37 * hh(32)], pts = surfaceOf(shape, cuts, seed)
  const reach = (ux, uy, uz) => { // each surface point at its x along a, its distance d from a turned toward u: x (a.u) + d |u off a|
    const al = a[0] * ux + a[1] * uy + a[2] * uz, be = Math.sqrt(Math.max(0, 1 - al * al))
    let m = -Infinity
    for (let k = 0; k < pts.length; k += 2) m = Math.max(m, pts[k] * al + pts[k + 1] * be)
    return (m + SURFACE_SLACK) / ROCK_SCALE
  }
  let far = 0
  for (let k = 0; k < pts.length; k += 2) far = Math.max(far, Math.hypot(pts[k], pts[k + 1]))
  return (ROCKS[i] = { shape, cuts, seed, dom: far + 0.1, ext: (far + SURFACE_SLACK) / ROCK_SCALE, reach, xr: reach(1, 0, 0), xl: reach(-1, 0, 0), yt: reach(0, 1, 0), yb: reach(0, -1, 0), a, b, c, psi: 2 * Math.PI * hh(4) })
}
// its turn, rolled psi about its long axis: body to screen, row major (comet.js reads it as screen to body)
function rollOf(K, psi) {
  const cs = Math.cos(psi), sn = Math.sin(psi), { a, b, c } = K
  return [0, 1, 2].flatMap((k) => [a[k], b[k] * cs + c[k] * sn, c[k] * cs - b[k] * sn])
}
// how far rock p (placeRocks) reaches on screen, px, however it rolls: right (r), left (l), up (t), and down (b: once it
// sits in its dent, to where the sheet in front of it hides it, as comet.js draws that (sinkOf: a bowl on a slope, seen
// along the camera's pitch), as far toward the camera as it reaches; else its underside)
function reachOf(C, p) {
  const K = p.K, r = p.r, cp = Math.cos(C.pitch), sp = Math.sin(C.pitch)
  let b = K.yb * r
  if (p.landed > 0.99) {
    const k = sinkOf(C, p), s = K.reach(0, -sp, cp) * ROCK_SCALE // the sheet's height in front of it, that far toward the camera
    const h = k[3] * (1 - k[7] / Math.hypot(s, k[7])) - s * (k[5] * sp - k[6] * cp) - k[2]
    b = Math.min(b, ((s * sp - h * cp) * r) / ROCK_SCALE + EMBED_SLACK * r)
  }
  return { r: K.xr * r, l: K.xl * r, t: K.yt * r, b }
}
// the sheet round rock p, in its units (comet.js drawRocks: its centre at 0, x right, y up, z toward us): the way up, its
// centre's height above the bottom of its dent, the dent's depth and width, and the well's slope there
function sinkOf(C, p) {
  const u = p.Rw / ROCK_SCALE, cp = Math.cos(C.pitch), sp = Math.sin(C.pitch), cy = Math.cos(C.yaw), sy = Math.sin(C.yaw)
  const ax = [cy, sp * sy, -cp * sy], az = [-sy, sp * cy, -cp * cy] // the scene's x and z axes, in those units' directions
  return [cp, sp, p.lift / u, p.dent / u, p.gx * ax[0] + p.gz * az[0], p.gx * ax[1] + p.gz * az[1], p.gx * ax[2] + p.gz * az[2], DIMPLE_CORE / u]
}
// the rocks where placeRocks put them, the furthest first, on the GPU as the story's rock is, each tumbling on the clock
// t. No WebGL2: a soft hot head where each would be, as the story's rock does then
function drawBodies(ctx, X, F, rk, h, t) {
  const list = rk.map((p) => ({ x: p.x, y: p.y, r: p.r / ROCK_SCALE, rot: rollOf(p.K, p.psi + SPIN * t), shape: p.K.shape, cuts: p.K.cuts, seed: p.K.seed, ext: p.K.dom, vis: p.vis, sink: sinkOf(F.C, p) }))
  if (drawRocks(ctx, { W: X.W, H: X.H, dpr: X.dpr, h, rocks: list })) return
  ctx.setTransform(X.dpr, 0, 0, X.dpr, 0, 0)
  ctx.globalCompositeOperation = 'lighter'
  for (const { x, y, r: rs, vis } of list) {
    const r = (rs * ROCK_SCALE) / 0.6 // as big against the rock as the story's head is against its ball
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    g.addColorStop(0, `rgba(255,236,210,${(0.85 * vis).toFixed(3)})`)
    g.addColorStop(0.35, `rgba(255,172,78,${(0.45 * vis).toFixed(3)})`)
    g.addColorStop(1, 'rgba(255,124,34,0)')
    ctx.fillStyle = g
    ctx.fillRect(x - r, y - r, 2 * r, 2 * r)
  }
  ctx.globalCompositeOperation = 'source-over'
}
// a glyph of a rock's fire, its dust or its stem, on the sheet's layer (z: how deep, if it is on the sheet: then, where it
// is nearer than a rock, over it): never over text (it clears round it as the lattice does, knock)
function rockPut(X, F, ch, x, y, heat, lum, warm, z) {
  if (F.nb) lum *= 1 - knockAt(F, x, y, true)
  if (lum < 0.02 || x < -20 || x > X.W + 20 || y < -20 || y > X.H + 20) return
  put(X.T, ch, X.snap(x), X.snap(y), heat, lum, z !== undefined && inFront(F, x, y, z) ? 0 : 1, warm)
}
// Over everything: the rocks (all nearer than the hole, so in front of it: the camera always looks back toward it along
// their line), what of the sheet is nearer than them (the near rims of their dents), then the roles' text. t: the clock (fixed under reduced motion)
export function drawOver(ctx, X, h, s, t) {
  if (!X || s <= ROOM_END) return
  const F = prep(X, h, s), rk = (F.rk || []).filter(Boolean).sort((a, b) => b.z - a.z) // the furthest first
  if (rk.length) drawBodies(ctx, X, F, rk, h, X.reduced ? 0 : t)
  ctx.setTransform(X.dpr, 0, 0, X.dpr, 0, 0)
  if (F.front) { // the near rims of their dents, over them: the same glyphs and glow as the rest of the sheet
    ctx.globalCompositeOperation = 'lighter'
    ctx.drawImage(X.T.cv, 0, 0, X.W, X.H)
    for (const g of X.T.glows) {
      ctx.globalAlpha = g.amt * SHEET_GLOW
      ctx.drawImage(g.c, 0, 0, X.W, X.H)
    }
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
  }
  drawText(ctx, X, F, h, s - ROOM_END)
}

// ---------------- the text ----------------
// each role beside its mass, typed as it lands; once the camera moves on it folds into a small label by its mass (its date
// and title). It fades at the screen's edges and anywhere near the hole's light
function drawText(ctx, X, F, h, u) {
  if (!X.blocks.length || u < X.blocks[0].from - SCRAMBLE) return
  const { tx: x, tc, dpr, W, H } = X, A = F.anchors, M = F.marks
  const key = `${u.toFixed(5)} ${A.map((a, i) => `${a.x.toFixed(2)},${a.y.toFixed(2)},${M[i].x.toFixed(2)},${M[i].y.toFixed(2)}`).join(' ')} ${h.cx.toFixed(2)} ${h.cy.toFixed(2)} ${h.R.toFixed(3)}`
  if (key !== X.key) { // the text only changes with the scroll and the camera, so it is redrawn only then
    X.key = key
    x.setTransform(1, 0, 0, 1, 0, 0)
    x.globalCompositeOperation = 'source-over'
    x.globalAlpha = 1
    x.clearRect(0, 0, tc.width, tc.height)
    x.setTransform(dpr, 0, 0, dpr, 0, 0)
    x.globalCompositeOperation = 'lighter'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    const band = EDGE_FADE * H, snap = X.snap
    // never near the hole's light (as far as the glyph's edge, in font fi), and soft at the screen's edges
    const vis = (qx, y, fi, clear = HOLE_CLEAR) => {
      const w = 0.3 * X.px[fi], g = Math.min(lightGap(h, qx - w, y), lightGap(h, qx, y), lightGap(h, qx + w, y)) - (0.5 * X.px[fi]) / h.R
      return smooth(g / clear - 0.2) * smooth(y / band) * smooth((H - y) / band) * smooth(qx / band) * smooth((W - qx) / band)
    }
    let font = -1
    const glyph = (fi, ch, qx, y, c, al) => {
      if (al < 0.02) return
      if (fi !== font) x.font = X.fonts[(font = fi)]
      x.fillStyle = `rgba(${c},${Math.min(1, al).toFixed(3)})`
      x.fillText(ch, qx, y)
    }
    for (const B of X.blocks) {
      if (u < B.from - SCRAMBLE) continue
      const lv = 1 - smooth((u - B.leave) / LEAVE), a0 = A[B.i]
      if (lv > 0.01) for (const q of B.chars) {
        const a = u - q.at
        if (a < -SCRAMBLE) continue
        const qx = snap(a0.x + q.dx), y = snap(a0.y + q.dy)
        let al = vis(qx, y, q.fi) * lv
        if (al < 0.01) continue
        let ch = q.ch, c = q.rgb
        if (X.reduced) al *= smooth((u - B.from) / 0.15) // the whole role fades in as its mass appears
        else if (a < 0) { // scrambling in its place, dim, then it locks
          ch = SCRAMBLE_SET[Math.floor(hash(B.i * 977 + Math.round(q.k * 1e4), Math.min(SWAPS - 1, Math.floor(((a + SCRAMBLE) / SCRAMBLE) * SWAPS))) * SCRAMBLE_SET.length)]
          al *= SCRAMBLE_ALPHA * smooth((a + SCRAMBLE) / (0.3 * SCRAMBLE))
        } else c = mix(q.rgb, HOT_RGB, 1 - smooth(a / COOL)) // white hot, cooling
        glyph(q.fi, ch, qx, y, c, al)
      }
      const la = F.la[B.i], m = M[B.i], gs = B.lab.glyphs
      if (la > 0.01) {
        let lv = 1 // a label fades as one (by its glyph nearest the hole's light or an edge), never in part
        for (const q of gs) lv = Math.min(lv, vis(snap(m.x + q.dx), snap(m.y + q.dy), q.fi, LABEL_CLEAR))
        if (lv * la > 0.01) for (const q of gs) glyph(q.fi, q.ch, snap(m.x + q.dx), snap(m.y + q.dy), q.rgb, la * lv)
      }
    }
    const { gc, gx } = X
    gx.clearRect(0, 0, gc.width, gc.height)
    gx.filter = 'blur(3px)'
    gx.drawImage(tc, 0, 0, gc.width, gc.height)
    gx.filter = 'none'
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.drawImage(tc, 0, 0, W, H)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = GLOW
  ctx.drawImage(X.gc, 0, 0, W, H)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
