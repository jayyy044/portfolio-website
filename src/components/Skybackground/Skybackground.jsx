import { useEffect, useRef } from 'react'
import { createStars, drawStars } from './stars'
import { createNebula, drawNebula } from './nebula'
import { reveal } from './blackhole'
import { createArt, drawArt, composeArt } from './ascii'
import './Skybackground.css'

const FPS = 30 // redraws a second: the letters, twinkle and drift are all slow enough; scrolling redraws at once
const INTRO_END = 13 // seconds: by then the black hole has finished drawing itself
const SPEED = 1.5 // how fast the clock runs: 2 = twice as fast, 0.5 = half
const SWAY_X = 14, SWAY_Y = 9 // how far the whole sky sways, in px

// Fixed full-screen canvas behind the page: the sky, the black hole, and later
// the comet. Owns sizing, the intro clock and the frame loop; each layer lives
// in its own module.
export default function Skybackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const bg = document.createElement('canvas') // the still parts, painted once per resize
    const bctx = bg.getContext('2d')
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let t = reduced ? INTRO_END : 0 // the intro clock, in seconds; reduced motion skips the intro
    let W = 0, H = 0, dpr = 1, S, nebula, stars, art, raf, resizeTimer, dprQuery
    let last = 0, acc = 0, lastScroll = 0

    // w, h: the canvas in css px; pw, ph: in device px
    function resize(w, h, pw, ph) {
      W = w
      H = h
      dpr = pw / w // the real scale, so whole device pixels really are whole
      S = Math.min(H, W / 1.35) // one unit of the black hole's maths, in px
      canvas.width = pw
      canvas.height = ph
      // the background overhangs the screen by the sway, and is drawn 1:1 so the faint stars stay sharp
      const bw = W + 2 * SWAY_X, bh = H + 2 * SWAY_Y
      bg.width = Math.round(bw * dpr)
      bg.height = Math.round(bh * dpr)
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const grad = bctx.createRadialGradient(bw / 2, bh / 2, 0, bw / 2, bh / 2, Math.hypot(bw, bh) / 2)
      grad.addColorStop(0, '#04060c')
      grad.addColorStop(1, '#000000')
      bctx.fillStyle = grad
      bctx.fillRect(0, 0, bw, bh)
      stars = createStars(bctx, W, H, dpr, SWAY_X, SWAY_Y)
      nebula = createNebula(W, H, S)
      art = createArt(W, H, dpr, S)
      // a few updates up front, so the letters' trail is already there
      for (let i = 0; i < 4; i++) {
        const ti = t - (3 - i) / FPS
        drawArt(art, ti, 1 / FPS)
      }
      acc = 1 / FPS // redraw on the very next frame
    }

    function draw(rv, scroll) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = 'source-over' // start clean, whatever a layer left behind
      ctx.globalAlpha = 1
      ctx.filter = 'none'
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      // the sky stays dark until the flash's shock front sweeps out and uncovers it
      if (rv) {
        const ox = Math.sin(t * 0.6 * 0.031) * SWAY_X, oy = Math.cos(t * 0.6 * 0.023) * SWAY_Y // a slow sway
        const snap = (v) => Math.round(v * dpr) / dpr
        ctx.drawImage(bg, snap(ox - SWAY_X), snap(oy - SWAY_Y), bg.width / dpr, bg.height / dpr)
        drawNebula(ctx, nebula, t, ox, oy)
        drawStars(ctx, stars, t, ox, oy, scroll)
        if (!rv.full) {
          const soft = Math.max(24, 0.1 * S)
          const g = ctx.createRadialGradient(rv.cx, rv.cy, Math.max(0, rv.r - soft), rv.cx, rv.cy, rv.r)
          g.addColorStop(0, 'rgba(0,0,0,0)')
          g.addColorStop(1, 'rgba(0,0,0,1)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, W, H)
        }
      }
      composeArt(ctx, art, t)
    }

    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.1) // capped, so a hidden tab doesn't jump ahead
      last = now
      t += dt * SPEED
      acc += dt // real time: FPS redraws a real second whatever the speed
      const tick = acc >= 1 / FPS - 0.004, scroll = window.scrollY
      const rv = reveal(t, W, H, S)
      if (tick) {
        drawArt(art, t, acc)
        acc = 0
      }
      if (tick || scroll !== lastScroll) {
        lastScroll = scroll
        draw(rv, scroll)
      }
      raf = requestAnimationFrame(loop)
    }

    // Size the canvas to exactly the device pixels it covers, or the browser
    // rescales it and everything goes soft. Past 2x costs a lot for little, so cap there.
    function fit(w, h, box) {
      clearTimeout(resizeTimer) // the latest size wins, including going back to the current one
      if (!w || !h) return // hidden or not laid out yet; the observer reports again once it is
      const real = window.devicePixelRatio || 1, d = Math.min(real, 2)
      // trust the exact size only when it agrees with css size x density (DevTools emulation reports the real screen's)
      const exact = d === real && box && Math.abs(box.inlineSize - w * d) < 2 && Math.abs(box.blockSize - h * d) < 2
      const pw = exact ? box.inlineSize : Math.round(w * d), ph = exact ? box.blockSize : Math.round(h * d)
      if (w === W && h === H && pw === canvas.width && ph === canvas.height) return
      if (!W) {
        resize(w, h, pw, ph)
        raf = requestAnimationFrame((now) => {
          last = now
          loop(now)
        })
        return
      }
      // rebuilding takes a moment (the nebula most), so wait until resizing settles
      resizeTimer = setTimeout(() => resize(w, h, pw, ph), 120)
    }

    // Chrome and Firefox report the exact device-pixel size too. A change of pixel
    // density alone (another monitor, browser zoom) doesn't always resize anything,
    // so listen for it and re-observe, which makes the observer report afresh.
    const exactBox = 'devicePixelContentBoxSize' in ResizeObserverEntry.prototype
    const ro = new ResizeObserver(([e]) => fit(e.contentRect.width, e.contentRect.height, e.devicePixelContentBoxSize?.[0]))
    const observe = () => (exactBox ? ro.observe(canvas, { box: 'device-pixel-content-box' }) : ro.observe(canvas))
    function watchDpr() {
      dprQuery?.removeEventListener('change', onDpr)
      dprQuery = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`)
      dprQuery.addEventListener('change', onDpr)
    }
    function onDpr() {
      ro.unobserve(canvas)
      observe()
      watchDpr()
    }

    document.fonts?.load('500 12px "JetBrains Mono"') // the letters use it; nothing else on the page asks for it yet
    observe()
    watchDpr()
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      ro.disconnect()
      dprQuery?.removeEventListener('change', onDpr)
    }
  }, [])

  return <canvas ref={canvasRef} className="sky" aria-hidden="true" />
}
