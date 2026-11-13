// The black hole's letter grid. Each update draws the letters onto an offscreen
// canvas over a fading copy of the last ones (the trail), makes two blurred
// copies for the glow, a soft black copy (the backing), and a mask of how much
// each cell hides the sky behind it. Ported from the black hole page.
import { CHARS, TAG_COLOR, FLASH, frame, smooth } from './blackhole'
import { rng } from './stars'

const TRAIL = 0.4 // how much of the previous letters survives each 1/30 s
const MOVING_TRAIL = 0.1 // how much survives each update while the hole is moving, so it doesn't smear
const GLOWS = [[4, 1.2, 0.85], [8, 2.6, 0.6]] // [shrink factor, blur px, strength]: a tight glow and a wide faint one
const BACKING = 0.7 // how much the gas darkens the sky around and behind it, so the disk sits in front: 0 = not at all
const BACKING_BLUR = 3 // how far that dark halo spreads past the letters (blur px on a 1/6-size copy)

export function createArt(W, H, dpr, S) {
  // one cell, in px; it stops growing past S = 900, so big screens get a finer disk instead of bigger letters
  const CW = Math.max(4, Math.min(S, 900) / 137), CH = (CW * 11) / 7
  const cols = Math.ceil(W / CW), rows = Math.ceil(H / CH), n = cols * rows
  const fontPx = Math.round(((CW * 12) / 7) * dpr) / dpr // a whole number of device px renders cleaner
  const font = `500 ${fontPx.toFixed(3)}px "JetBrains Mono", Menlo, Consolas, monospace`

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
  const bk = document.createElement('canvas') // the backing: blurred, so small is plenty
  bk.width = Math.max(1, Math.round(W / 6))
  bk.height = Math.max(1, Math.round(H / 6))

  // every cell's centre in the maths' units (centred, 1 = S px), and where its
  // letter is drawn: the same spot snapped to a whole device pixel, so it's sharp
  const R = rng(7)
  const G = { n, X: new Float64Array(n), Y: new Float64Array(n), rnd: new Float64Array(n), hsh: new Int32Array(n), px: new Float32Array(n), py: new Float32Array(n) }
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i, px = (i + 0.5) * CW, py = (j + 0.5) * CH
      G.px[k] = Math.round(px * dpr) / dpr
      G.py[k] = Math.round(py * dpr) / dpr
      G.X[k] = (px - W / 2) / S
      G.Y[k] = (py - H / 2) / S
      G.rnd[k] = R()
      G.hsh[k] = Math.floor(R() * 12)
    }
  }
  const out = { char: new Uint8Array(n), tag: new Uint8Array(n), lum: new Float32Array(n), occ: new Float32Array(n) }

  return { W, H, dpr, S, CW, CH, cols, rows, font, G, out, art, actx: art.getContext('2d'), glows, mask, mctx, maskImg: mctx.createImageData(cols, rows), bk, bkx: bk.getContext('2d') }
}


// one colour per (tag, brightness step); key = tag * 512 + step
const colorCache = new Map()
function colorOf(key) {
  let s = colorCache.get(key)
  if (!s) {
    const c = TAG_COLOR[key >> 9], f = (key & 511) / 300
    s = `rgb(${Math.min(255, c[0] * f) | 0},${Math.min(255, c[1] * f) | 0},${Math.min(255, c[2] * f) | 0})`
    colorCache.set(key, s)
  }
  return s
}

const buckets = new Map() // colour key -> the cells drawn in that colour this update

// h: the hole now (blackhole.js's hole()); moved: it has moved since the last update
export function drawArt(A, t, dt, h, moved = false) {
  const { G, out, actx } = A
  frame(t, G, out, h.dive, 0, (h.cy - A.H / 2) / A.S + 0.02 * h.cam, h.inc, h.tilt) // the maths, centred on the hole

  for (let k = 0; k < G.n; k++) A.maskImg.data[4 * k + 3] = out.occ[k] * 255
  A.mctx.putImageData(A.maskImg, 0, 0)

  actx.setTransform(A.dpr, 0, 0, A.dpr, 0, 0)
  actx.globalCompositeOperation = 'destination-out' // fade what is already there
  actx.fillStyle = `rgba(0,0,0,${moved ? 1 - MOVING_TRAIL : (1 - Math.pow(TRAIL, dt * 30)).toFixed(4)})`
  actx.fillRect(0, 0, A.W, A.H)
  actx.globalCompositeOperation = 'lighten'
  actx.font = A.font
  actx.textAlign = 'center'
  actx.textBaseline = 'middle'
  // Group the letters by colour so each colour is set once, not per letter.
  // 'lighten' keeps whichever is brighter, so the drawing order doesn't matter.
  for (let k = 0; k < G.n; k++) {
    if (out.char[k] === 0 || out.tag[k] >= 5) continue // skip the maths' own + * . stars and , : dust: the sky has its own
    const key = out.tag[k] * 512 + Math.min(511, Math.round(out.lum[k] * 300))
    let b = buckets.get(key)
    if (!b) buckets.set(key, (b = { ks: [], n: 0 }))
    b.ks[b.n++] = k
  }
  for (const [key, b] of buckets) {
    if (!b.n) continue
    actx.fillStyle = colorOf(key)
    for (let i = 0; i < b.n; i++) {
      const k = b.ks[i]
      actx.fillText(CHARS[out.char[k]], G.px[k], G.py[k])
    }
    b.n = 0
  }
  actx.globalCompositeOperation = 'source-over'

  for (const g of A.glows) {
    g.cx.clearRect(0, 0, g.c.width, g.c.height)
    g.cx.filter = `blur(${g.blur}px)`
    g.cx.drawImage(A.art, 0, 0, g.c.width, g.c.height)
    g.cx.filter = 'none'
  }

  // the backing: the letters' shape, blurred and filled black
  const { bk, bkx } = A
  bkx.globalCompositeOperation = 'source-over'
  bkx.clearRect(0, 0, bk.width, bk.height)
  bkx.filter = `blur(${BACKING_BLUR}px)`
  bkx.drawImage(A.art, 0, 0, bk.width, bk.height)
  bkx.filter = 'none'
  bkx.globalCompositeOperation = 'source-in'
  bkx.fillStyle = '#000'
  bkx.fillRect(0, 0, bk.width, bk.height)
}

// On top of the sky: the mask hides what the hole covers, the backing dims the
// sky around the gas (fading in after the flash, as the sky appears), then the
// letters and glow add light. lensed: the sky is the ray-traced one, which draws
// its own shadow, so the mask fades out once that sky is in.
export function composeArt(ctx, A, t, lensed) {
  ctx.imageSmoothingEnabled = true
  ctx.globalAlpha = lensed ? 1 - smooth((t - FLASH - 1) / 3) : 1
  if (ctx.globalAlpha > 0.001) ctx.drawImage(A.mask, 0, 0, A.cols * A.CW, A.rows * A.CH)
  ctx.globalAlpha = BACKING * smooth((t - FLASH - 0.5) / 2)
  if (ctx.globalAlpha > 0.001) ctx.drawImage(A.bk, 0, 0, A.W, A.H)
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
