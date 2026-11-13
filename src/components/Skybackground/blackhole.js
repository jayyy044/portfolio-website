// blackhole.js: port of black_hole.py by JIN2 (@jin_22ee), 2026 (free for personal projects).
// Same math, one character cell at a time. Taken from the black hole page's BH module.
const TAU = Math.PI * 2
const POOLS = ['1il!;:', 'rtfjcvxz=+', 'aeoun0{}[]<>', '08B$#&%Q'] // dark -> bright
export const CHARS = ' .,:~+*^01|/\\-_#()x' + POOLS.join('')
const AT = {}
for (let i = 0; i < CHARS.length; i++) AT[CHARS[i]] = i // later duplicates win, like the dict
const FILL = POOLS.map((p) => Array.from({ length: 12 }, (_, k) => AT[p[k % p.length]]))

// deep red .. hot white for the disk, then stars, then dust (the page's blue override)
export const TAG_COLOR = [[190, 38, 12], [242, 78, 20], [255, 124, 34], [255, 172, 78], [255, 222, 168], [220, 228, 255], [72, 112, 150]]
const DEEP = 0, RED = 1, ORANGE = 2, AMBER = 3, HOT = 4, STAR = 5, DUST = 6

export const R0 = 0.11
export const TILT = (17 * Math.PI) / 180
const INC = 0.12
const R_IN = 1.55 * R0, R_OUT = 5.4 * R0
export const FLASH = 7.8
const cT = Math.cos(TILT), sT = Math.sin(TILT)
const PULSES = [[1.8, 0.0, 0.95], [2.4, 2.1, 0.8], [3.2, 4.2, 0.65]].map(([rr, st, sp]) => [Math.log(rr), st, sp])

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
export const smooth = (x) => { x = clamp01(x); return x * x * (3 - 2 * x) }
const pmod = (a, n) => ((a % n) + n) % n

function spin(t) {
  const s = Math.max(t - FLASH, 0)
  return 0.06 * t + 0.28 * (s - 0.8 * (1 - Math.exp(-s / 0.8)))
}

function ripple(a, b, t) {
  return Math.sin(a + 0.9 * Math.sin(b + 1.3 * t)) * 0.5
    + Math.sin(2.3 * a - b + 0.7 * t) * 0.3
    + Math.sin(4.1 * a + 1.7 * b - 1.1 * t) * 0.2
}

// thin rings of gas on circular orbits; the inner ones turn faster
function gas(phi, rho, t, w, pulseK) {
  const x = rho / R_IN
  const phase = phi - w / (x * Math.sqrt(x)) // (rho / R_IN) ** -1.5, cheaper
  const lr = Math.log(rho / R0)
  const a = 46 * lr + 0.9 * Math.sin(phase + 3 * lr)
  let streak = 0.55 + 0.3 * Math.sin(a) + 0.15 * Math.sin(2.3 * a + 2 * phase) + 0.12 * Math.sin(3 * phase - 7 * lr + 0.3 * t)
  if (pulseK > 0) {
    // sparks of light ride the orbits after the flash
    let pulses = 0
    for (const [lrr, start, speed] of PULSES) {
      const dl = lr - lrr
      if (dl > 0.25 || dl < -0.25) continue // off this spark's orbit: its falloff is under 1e-5 out here
      const d = pmod(phi - start - speed * t + Math.PI, TAU) - Math.PI
      const comet = d > 0 ? Math.exp(-((d / 0.18) ** 2)) : Math.exp(d / 0.9)
      pulses += comet * Math.exp(-((dl / 0.07) ** 2))
    }
    streak += 0.9 * pulseK * pulses
  }
  return streak
}

function tangentLetter(dx, dy) {
  const s = pmod((Math.atan2(-dy, dx) * 180) / Math.PI, 180)
  if (s < 22.5 || s >= 157.5) return AT['-']
  if (s < 67.5) return AT['/']
  if (s < 112.5) return AT['|']
  return AT['\\']
}

// G: { n, X, Y (Float64Array, frame-height units), rnd (Float64Array), hsh (Int32Array) }
// out: { char (Uint8Array), tag (Uint8Array), lum (Float32Array), occ? (Float32Array) }; also gets heatMax, count, spin
export function frame(t, G, out, dive = 1, ox = 0, oy = 0) { // dive > 1 moves in; ox, oy move the hole on screen
  const cam = smooth(smooth((t - FLASH + 0.3) / 2.6))
  const zoom = (1 + 0.28 * cam) * dive, inc = INC + 0.09 * cam
  const w = spin(t)
  const flash = Math.exp(-(((t - FLASH) / 0.22) ** 2))
  const pulseK = smooth((t - FLASH) / 1.0)
  const ringK = smooth((t - 0.3) / 2.2)
  const diskOn = smooth((t - 5.0) / 2.8)
  const auraK = smooth((t - 2.2) / 1.8) * (1 - 0.65 * diskOn)
  const span = R0 + diskOn * (R_OUT * 1.1 - R0)
  const diskK = smooth((t - 5.0) / 0.8) * (0.55 + 0.45 * smooth((t - FLASH + 0.3) / 0.4))
  const haloK = smooth((t - 5.0) / 2.2)
  const ringBoost = 0.9 + 0.3 * smooth((t - 5) / 2)
  const front = R0 + (t - FLASH) * 0.55, shockK = t > FLASH ? Math.exp(-(t - FLASH) / 0.5) * 0.9 : 0
  const dustK = 0.3 * smooth((t - 4.0) / 3.0)
  let heatMax = 0, count = 0

  for (let k = 0; k < G.n; k++) {
    const X = (G.X[k] - ox) / zoom, Y = (G.Y[k] - oy + 0.02 * cam) / zoom
    const r = Math.sqrt(X * X + Y * Y)
    const ang = r < 4.0 * R0 ? Math.atan2(Y, X) : 0 // ring, glow and halo all sit inside 4 R0; past that it's unused

    // 1. the circle draws itself
    const dr = r - 1.02 * R0
    const ring = Math.abs(dr) < 0.3 * R0
      ? Math.exp(-((dr / (0.045 * R0)) ** 2)) * smooth((ringK * 1.08 - pmod(ang + Math.PI / 2, TAU) / TAU) / 0.08) : 0

    // 2. a soft glow breathing around it, which settles into the disk's own rings
    //    (skipped where it is far below one brightness step)
    let aura = 0
    if (auraK > 0 && r - R0 < 1.6 * R0) {
      let puff = 0.5 + 0.5 * ripple(2 * ang, 5 * r - 0.45 * t, 0.35 * t)
      if (diskOn > 0) puff = puff * (1 - diskOn) + gas(ang - TILT, R_IN + Math.max(r - 1.0 * R0, 0) * 2.6, t, w, pulseK) * diskOn
      const reach = 0.32 * R0 * (0.7 + 0.6 * puff)
      aura = auraK * Math.exp(-Math.pow(Math.max(r - R0, 0) / reach, 1.6)) * (0.6 + 0.4 * puff)
    }

    // 3. the disk spreads out sideways, then lights up
    const u = X * cT + Y * sT
    const v = -X * sT + Y * cT
    const vi = v / inc
    const rho = Math.sqrt(u * u + vi * vi)
    let phi // the angle round the disk; only worked out where it gets used
    let disk = 0
    const spanK = diskK > 0 ? smooth((span - Math.abs(u)) / (0.6 * R0)) : 0
    if (spanK > 0 && rho > R_IN - 0.25 * R0 && rho < R_OUT) {
      phi = Math.atan2(vi, u)
      const edge = smooth((rho - R_IN) / (0.25 * R0)) * smooth((R_OUT - rho) / (2.2 * R0))
      disk = 1.5 * edge * gas(phi, rho, t, w, pulseK) * (R_IN / rho)
      disk *= 1 - (0.25 * u) / Math.max(rho, 1e-6) // the side coming toward us is brighter
      disk *= diskK * spanK
    }

    // the far side of the disk, bent up and over the shadow
    let halo = 0
    if (haloK > 0 && r < 4.0 * R0) {
      const top = 0.5 - 0.5 * Math.sin(ang - TILT)
      const side = Math.pow(Math.abs(Math.cos(ang - TILT)), 10)
      const outR = Math.max(r - 1.1 * R0, 0)
      const band = Math.exp(-((outR / (0.2 * R0 + 0.24 * R0 * top + 0.45 * R0 * side)) ** 2))
        * Math.exp(-((Math.min(r - 1.1 * R0, 0) / (0.2 * R0)) ** 2))
      const hrho = (1 - side) * (R_IN + Math.max(r - 1.0 * R0, 0) * 2.6) + side * Math.max(r, R_IN)
      halo = 1.2 * band * gas(ang - TILT, hrho, t, w, pulseK) * (0.5 + 0.8 * top) * (1 - 0.25 * Math.cos(ang - TILT)) * haloK
    }

    // the shock is a thin ring: five widths away it is under 1e-10, so skip the exp
    const shock = shockK > 0 && Math.abs(r - front) < 0.1 ? Math.exp(-(((r - front) / 0.02) ** 2)) * shockK : 0

    // screen blend instead of max, so glow, halo and disk melt into each other
    let soft = 1 - (1 - clamp01(aura * 0.55)) * (1 - clamp01(halo)) * (1 - clamp01(disk))
    soft = Math.max(soft, Math.max(disk, halo))
    let heat = Math.max(ring * ringBoost, soft, shock) * (1 + 1.4 * flash)

    const inside = r < R0 * 0.97, frontSide = v > 0
    if (inside) heat = frontSide ? (disk > 0.2 ? disk : 0) : 0 // the shadow hides what is behind it
    if (heat > heatMax) heatMax = heat

    const on = heat > 0.07
    let ch = 0
    if (on) {
      phi ??= Math.atan2(vi, u)
      const level = Math.min(Math.max(Math.floor(heat * 3.6), 0), 3)
      const x = rho / R_IN
      const phase = phi - w / (x * Math.sqrt(x)), lr = Math.log(rho / R0)
      ch = FILL[level][pmod(G.hsh[k] + Math.trunc(phase * 2 + lr * 6), 12)]
    }
    if (on && ring > aura * 0.8 && ring > disk && ring > halo && ring > 0.25) ch = tangentLetter(-Math.sin(ang), Math.cos(ang))

    let tag = heat < 0.1 ? DEEP : heat < 0.2 ? RED : heat < 0.45 ? ORANGE : heat < 0.75 ? AMBER : HOT
    let lum = on ? Math.min(Math.max(0.42 + 0.85 * heat, 0), 1.3) * (0.35 + 0.65 * smooth((heat - 0.07) / 0.15)) : 0

    // a few stars and some dust behind everything
    const rnd = G.rnd[k]
    const star = !on && !inside && rnd < 0.0025
    if (star) {
      ch = rnd < 0.0005 ? AT['+'] : rnd < 0.0012 ? AT['*'] : AT['.']
      tag = STAR
      lum = 0.75 + 0.2 * Math.sin(0.8 * t + rnd * 9000)
    }
    if (!on && !star && !inside && t > 4.0 && rnd > 0.965) {
      const lane = Math.exp(-((((-X * sT + Y * cT) - 0.02) / 0.09) ** 2))
      if (rnd > 1 - 0.035 * lane) {
        ch = rnd > 1 - 0.01 * lane ? AT[':'] : AT[',']
        tag = DUST
        lum = dustK
      }
    }

    out.char[k] = ch
    out.tag[k] = tag
    out.lum[k] = lum
    if (out.occ) out.occ[k] = inside ? 1 : Math.min(1, heat * 2.5) // how much this cell hides what is behind it
    if (ch !== 0) count++
  }
  out.heatMax = heatMax
  out.count = count
  out.spin = w
}

export const INTRO_END = 13 // seconds: by then the black hole has finished drawing itself

// where the hole is on screen at time t: centre and shadow radius in px, how far
// the maths' camera has eased in (it does just after the flash), and the disk's tilt
export function hole(t, W, H, S) {
  const cam = smooth(smooth((t - FLASH + 0.3) / 2.6)), zoom = 1 + 0.28 * cam
  return { cx: W / 2, cy: H / 2 - 0.02 * cam * S, R: R0 * zoom * S, cam, inc: INC + 0.09 * cam }
}

// the flash's shock front, in screen px: the sky inside it is uncovered
export function reveal(t, W, H, S) {
  if (t <= FLASH) return null
  const h = hole(t, W, H, S), r = (R0 + (t - FLASH) * 0.55) * (1 + 0.28 * h.cam) * S
  const far = Math.hypot(Math.max(h.cx, W - h.cx), Math.max(h.cy, H - h.cy))
  return { cx: h.cx, cy: h.cy, r, full: r > far + 0.2 * S }
}
