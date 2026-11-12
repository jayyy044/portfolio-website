// The black hole's letter grid. Each update draws the letters onto an offscreen
// canvas over a fading copy of the last ones (the trail), makes two blurred
// copies for the glow, and a mask of how much each cell hides the sky behind it.
// Ported from the black hole page (resize / drawArt / compose).
import { CHARS, TAG_COLOR, frame } from './blackhole'
import { rng } from './stars'

const TRAIL = 0.4 // how much of the previous letters survives each 1/30 s
const GLOWS = [[4, 1.2, 0.75], [8, 2.6, 0.45]] // [shrink factor, blur px, strength]: a tight glow and a wide faint one

export function createArt(W, H, dpr, S) {
  const CW = Math.max(4, S / 137), CH = (CW * 11) / 7 // one cell, in px
  const cols = Math.ceil(W / CW), rows = Math.ceil(H / CH), n = cols * rows
  const font = `500 ${((CW * 12) / 7).toFixed(2)}px "JetBrains Mono", Menlo, Consolas, monospace`

  const art = document.createElement('canvas')
  art.width = Math.round(W * dpr)
  art.height = Math.round(H * dpr)
  const glows = GLOWS.map(([shrink, blur, amt]) => {
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(W / shrink))
    c.height = Math.max(1, Math.round(H / shrink))
    return { c, cx: c.getContext('2d'), blur, amt }
  })
  const mask = document.createElement('canvas') // one pixel per cell, black, alpha = how much it hides
  mask.width = cols
  mask.height = rows
  const mctx = mask.getContext('2d')

  // every cell's centre, in px and in the maths' units (centred, 1 = S px)
  const R = rng(7)
  const G = { n, X: new Float64Array(n), Y: new Float64Array(n), rnd: new Float64Array(n), hsh: new Int32Array(n), px: new Float32Array(n), py: new Float32Array(n) }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i, px = (i + 0.5) * CW, py = (j + 0.5) * CH
      G.px[k] = px
      G.py[k] = py
      G.X[k] = (px - W / 2) / S
      G.Y[k] = (py - H / 2) / S
      G.rnd[k] = R()
      G.hsh[k] = Math.floor(R() * 12)
    }
  }
  const out = { char: new Uint8Array(n), tag: new Uint8Array(n), lum: new Float32Array(n), occ: new Float32Array(n) }

  return { W, H, dpr, CW, CH, cols, rows, font, G, out, art, actx: art.getContext('2d'), glows, mask, mctx, maskImg: mctx.createImageData(cols, rows) }
}

const colorCache = new Map()
function colorOf(tag, lum) {
  const l = Math.min(511, Math.round(lum * 300)), key = tag * 512 + l
  let s = colorCache.get(key)
  if (!s) {
    const c = TAG_COLOR[tag], f = l / 300
    s = `rgb(${Math.min(255, c[0] * f) | 0},${Math.min(255, c[1] * f) | 0},${Math.min(255, c[2] * f) | 0})`
    colorCache.set(key, s)
  }
  return s
}

// rv: the shock front from reveal(); the letter stars and dust only show inside it
export function drawArt(A, t, dt, rv) {
  const { G, out, actx } = A
  frame(t, G, out)

  for (let k = 0; k < G.n; k++) A.maskImg.data[4 * k + 3] = out.occ[k] * 255
  A.mctx.putImageData(A.maskImg, 0, 0)

  actx.setTransform(A.dpr, 0, 0, A.dpr, 0, 0)
  actx.globalCompositeOperation = 'destination-out' // fade what is already there
  actx.fillStyle = `rgba(0,0,0,${(1 - Math.pow(TRAIL, dt * 30)).toFixed(4)})`
  actx.fillRect(0, 0, A.W, A.H)
  actx.globalCompositeOperation = 'lighten'
  actx.font = A.font
  actx.textAlign = 'center'
  actx.textBaseline = 'middle'
  let last = ''
  const r2 = rv ? (rv.full ? Infinity : rv.r * rv.r) : -1
  for (let k = 0; k < G.n; k++) {
    const ch = out.char[k]
    if (ch === 0) continue
    if (out.tag[k] >= 5 && (r2 < 0 || (G.px[k] - rv.cx) ** 2 + (G.py[k] - rv.cy) ** 2 > r2)) continue
    const col = colorOf(out.tag[k], out.lum[k])
    if (col !== last) {
      actx.fillStyle = col
      last = col
    }
    actx.fillText(CHARS[ch], G.px[k], G.py[k])
  }
  actx.globalCompositeOperation = 'source-over'

  for (const g of A.glows) {
    g.cx.clearRect(0, 0, g.c.width, g.c.height)
    g.cx.filter = `blur(${g.blur}px)`
    g.cx.drawImage(A.art, 0, 0, g.c.width, g.c.height)
    g.cx.filter = 'none'
  }
}

// on top of the sky: the mask darkens what the hole hides, then letters and glow add light
export function composeArt(ctx, A) {
  ctx.imageSmoothingEnabled = true
  ctx.drawImage(A.mask, 0, 0, A.cols * A.CW, A.rows * A.CH)
  ctx.globalCompositeOperation = 'lighter'
  ctx.globalAlpha = 1
  ctx.drawImage(A.art, 0, 0, A.W, A.H)
  for (const g of A.glows) {
    ctx.globalAlpha = g.amt
    ctx.drawImage(g.c, 0, 0, A.W, A.H)
  }
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
}
