// The whole sky as one image: a 360° panorama (equirectangular, 2:1) of faint
// coloured dust and ~13,000 stars spread evenly over the sphere. Painted once;
// lensing.js bends it around the black hole. Ported from the black hole page (starSphere).
import { rng } from './stars'
import { valueNoise } from './nebula'

// ---------- knobs ----------
const STAR_COUNT = 12900 // the same stars at every texture size
const DUST = 0.2 // how strong the dust is: 0 = none
// dust colours: a blue sky with separate clouds of violet, teal and a little rose laid over it,
// and some silver left in places (separate noise fields, so no rainbow bands)
const BLUE = [70, 120, 240], VIOLET = [150, 95, 235], TEAL = [50, 180, 205], ROSE = [225, 95, 160], GREY = [170, 180, 200]
const TEMPS = [[160, 190, 255], [205, 220, 255], [255, 255, 255], [255, 238, 210], [255, 205, 160]] // stars, blue-white to warm
const STAR_SEED = 2027 // change for different stars

const TAU = Math.PI * 2
const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)
const blob = (q, lo, hi) => { const f = clamp01((q - lo) / (hi - lo)); return f * f * (3 - 2 * f) }
const mix3 = (a, b, f) => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a.toFixed(3)})`

function canvas(w, h) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return [c, c.getContext('2d')]
}

export function paintStarSphere(w, h) {
  const [c, x] = canvas(w, h)
  x.fillStyle = '#000'
  x.fillRect(0, 0, w, h)

  // The dust, worked out on a small 512 x 256 map. Each pixel is a point on the
  // sphere (so there's no seam), and the map carries a margin past its edges that
  // keeps going round the sphere, so blurring it doesn't fade the edges.
  const bw = 512, bh = 256, pad = 8, pw = bw + 2 * pad, ph = bh + 2 * pad
  const [bc, bx] = canvas(pw, ph), img = bx.createImageData(pw, ph)
  const nz = valueNoise(808), nz2 = valueNoise(919), nzA = valueNoise(1213), nzB = valueNoise(1717), nzC = valueNoise(2029), nzD = valueNoise(3131)
  for (let y = 0; y < ph; y++) {
    for (let xx = 0; xx < pw; xx++) {
      const lat = (0.5 - (y - pad + 0.5) / bh) * Math.PI, lon = ((xx - pad + 0.5) / bw) * TAU
      const X = Math.cos(lat) * Math.cos(lon), Y = Math.cos(lat) * Math.sin(lon), Z = Math.sin(lat)
      const n = nz(2.2 * X + 1.4 * Z + 5, 2.2 * Y - 0.9 * Z + 3, 5), m = nz2(4.5 * X - 2 * Z + 1, 4.5 * Y + 2.6 * Z + 7, 4)
      const v = 0.28 + 0.72 * Math.pow(clamp01((n - 0.25) / 0.55), 1.6) * (0.7 + 0.3 * m)
      let col = mix3(BLUE, GREY, 0.75 * blob(nzD(1.3 * X + 0.5 * Z + 3, 1.3 * Y - 0.8 * Z + 5, 3), 0.48, 0.64))
      col = mix3(col, VIOLET, 0.9 * blob(nzA(1.5 * X - Z + 9, 1.5 * Y + 1.2 * Z + 2, 3), 0.46, 0.62))
      col = mix3(col, TEAL, 0.85 * blob(nzB(1.8 * X + 0.7 * Z + 4, 1.8 * Y - 1.5 * Z + 6, 3), 0.5, 0.66))
      col = mix3(col, ROSE, 0.8 * blob(nzC(2.2 * X - 0.4 * Z + 1, 2.2 * Y + 0.8 * Z + 8, 3), 0.56, 0.72))
      const k = 4 * (y * pw + xx), core = 0.25 * clamp01((v - 0.6) * 2.5) // the thickest dust lifts toward white
      img.data[k] = col[0] + (235 - col[0]) * core
      img.data[k + 1] = col[1] + (240 - col[1]) * core
      img.data[k + 2] = col[2] + (250 - col[2]) * core
      img.data[k + 3] = Math.min(255, v * DUST * 255)
    }
  }
  bx.putImageData(img, 0, 0)
  const [sc, sx] = canvas(pw, ph) // blur at the small size (cheap), then crop the margin away while stretching it over the whole
  sx.filter = 'blur(0.9px)'
  sx.drawImage(bc, 0, 0)
  sx.filter = 'none'
  x.imageSmoothingQuality = 'high'
  x.drawImage(sc, pad, pad, bw, bh, 0, 0, w, h)

  // The stars, spread evenly over the sphere. Near the poles the panorama
  // squeezes everything sideways, so each star is drawn wider there to come out round.
  const R = rng(STAR_SEED), k2 = w / 4096
  for (let i = 0; i < STAR_COUNT; i++) {
    const z = 2 * R() - 1, lat = Math.asin(z), lon = TAU * R(), b = Math.pow(R(), 4.4), col = TEMPS[Math.floor(R() * TEMPS.length)]
    const X = (lon / TAU) * w, Y = (0.5 - lat / Math.PI) * h, stretch = 1 / Math.max(0.12, Math.cos(lat)), sz = (1 + 1.2 * b) * Math.max(0.6, k2)
    const span = 10 * stretch * Math.max(0.6, k2), wraps = X < span ? [0, w] : X > w - span ? [0, -w] : [0] // stars on the seam show on both sides
    for (const ox of wraps) {
      x.fillStyle = rgba(col, 0.25 + 0.75 * b)
      x.fillRect(X + ox, Y, sz * stretch, sz)
      if (b > 0.88) {
        // the brightest get a soft glow
        const r = (2.5 + 3 * b) * Math.max(0.6, k2), g = x.createRadialGradient(0, 0, 0, 0, 0, r)
        g.addColorStop(0, rgba(col, 0.3 * b))
        g.addColorStop(1, rgba(col, 0))
        x.save()
        x.translate(X + ox + (sz * stretch) / 2, Y + sz / 2)
        x.scale(stretch, 1)
        x.fillStyle = g
        x.fillRect(-r, -r, 2 * r, 2 * r)
        x.restore()
      }
    }
  }
  return c
}
