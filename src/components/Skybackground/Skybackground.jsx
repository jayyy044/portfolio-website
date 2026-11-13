import { useEffect, useRef } from 'react'
import { createStars, drawStars } from './stars'
import { createNebula, drawNebula } from './nebula'
import { reveal, hole, rest, smooth, INTRO_END } from './blackhole'
import { createLensing } from './lensing'
import { createArt, drawArt, composeArt } from './ascii'
import './Skybackground.css'

const FPS = 30 // redraws a second: the letters and the sky's motion are both slow enough; scrolling and the shock front redraw every frame
const SPEED = 1.75 // how fast the clock runs: 2 = twice as fast, 0.5 = half
const SWAY_X = 14, SWAY_Y = 9 // how far the whole sky sways, in px
const MOVE_ROOM = 1 // screens of scroll, after the intro, that take the hole down to its resting place; also the page's scroll room
const SCROLL_EASE = 8 // how quickly the hole catches up with the scroll, per second: higher follows tighter, lower glides more
const SKIP_INTRO = true // TEMPORARY, for tuning: start at the end of the intro, hole already where the scroll puts it. Set false to get the intro back

// dev only: the sky is set up once, in an effect that hot updates don't re-run, so a knob edit
// would change nothing on screen. Reload instead (the scroll position survives it)
import.meta.hot?.on('vite:beforeUpdate', () => location.reload())

// Fixed full-screen canvas behind the page: the sky (ray-traced around the hole,
// or a flat 2D one if WebGL isn't there), the black hole, and later the comet.
// Owns sizing, the intro clock and the frame loop; each layer lives in its own module.
export default function Skybackground() {
  const canvasRef = useRef(null)
  const probeRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const probe = probeRef.current // 100svh: the short viewport, a phone's toolbar showing
    const ctx = canvas.getContext('2d')
    const bg = document.createElement('canvas') // the flat sky's still parts
    const bctx = bg.getContext('2d')
    const lens = createLensing()
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let t = reduced || SKIP_INTRO ? INTRO_END : 0 // the intro clock, in seconds; reduced motion skips the intro
    // no scrolling until the intro is over (index.css: html.locked)
    const root = document.documentElement
    let locked = t < INTRO_END
    root.classList.toggle('locked', locked)
    let W = 0, H = 0, dpr = 1, S, nebula, stars, art, raf, dprQuery, buildTimer
    let last = 0, acc = 0, lastScroll = 0, flatReady = false
    let B, sS = 0 // the hole's resting place (rest()); the scroll it follows, eased, in screens

    // the hole at clock ti, as far toward its resting place as the eased scroll has taken it
    const holeAt = (ti) => hole(ti, W, H, S, smooth(sS / MOVE_ROOM), B)

    // w, h: the canvas in css px; pw, ph: in device px
    function resize(w, h, pw, ph) {
      const first = !W
      W = w
      H = h
      dpr = pw / w // the real scale, so whole device pixels really are whole
      S = Math.min(H, W / 1.35) // one unit of the black hole's maths, in px
      B = rest(W, Math.min(H, probe.clientHeight || H), S) // it rests inside the short viewport, so a toolbar never hides it
      if (first && t >= INTRO_END) sS = Math.min(Math.max(window.scrollY / H, 0), MOVE_ROOM) // no intro: start where the scroll is, no glide
      canvas.width = pw
      canvas.height = ph
      flatReady = false // the fallback sky is only built if it's needed
      art = createArt(W, H, dpr, S)
      lens.fit(W, H, S, dpr)
      // updates up front so the letters' trail is already there; one is enough mid-resize
      for (let i = first ? 0 : 3; i < 4; i++) {
        const ti = t - (3 - i) / FPS
        drawArt(art, ti, 1 / FPS, holeAt(ti))
      }
      acc = 1 / FPS // redraw on the very next frame
    }

    // the fallback sky (no WebGL): built the first time it's needed at this size
    function buildFlatSky() {
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
      flatReady = true
    }

    // h: the hole now
    function draw(rv, scroll, h) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = 'source-over' // start clean, whatever a layer left behind
      ctx.globalAlpha = 1
      ctx.filter = 'none'
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      // the sky stays dark until the flash's shock front sweeps out and uncovers it
      let lensed = false
      if (rv) {
        if (!lens.tried) lens.init() // normally built already, while the ring was drawing
        // reduced motion: the sky holds still (near the hole the lensing turns a slow spin into a lot of motion)
        lensed = lens.draw(h, hole(t, W, H, S), reduced ? INTRO_END : t)
        if (lensed) ctx.drawImage(lens.canvas, 0, 0, W, H)
        else drawFlatSky(scroll)
        if (!rv.full) {
          const soft = Math.max(24, 0.1 * S)
          const g = ctx.createRadialGradient(rv.cx, rv.cy, Math.max(0, rv.r - soft), rv.cx, rv.cy, rv.r)
          g.addColorStop(0, 'rgba(0,0,0,0)')
          g.addColorStop(1, 'rgba(0,0,0,1)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, W, H)
        }
      }
      composeArt(ctx, art, t, lensed)
    }

    // the fallback sky: gradient, faint stars, nebula and twinkling stars, swaying slowly
    function drawFlatSky(scroll) {
      if (!flatReady) buildFlatSky()
      const ox = Math.sin(t * 0.6 * 0.031) * SWAY_X, oy = Math.cos(t * 0.6 * 0.023) * SWAY_Y
      const snap = (v) => Math.round(v * dpr) / dpr
      ctx.drawImage(bg, snap(ox - SWAY_X), snap(oy - SWAY_Y), bg.width / dpr, bg.height / dpr)
      drawNebula(ctx, nebula, t, ox, oy)
      drawStars(ctx, stars, t, ox, oy, scroll)
    }

    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.1) // capped, so a hidden tab doesn't jump ahead
      last = now
      t += dt * SPEED
      if (locked && t >= INTRO_END) {
        locked = false
        root.classList.remove('locked')
      }
      acc += dt // real time: FPS redraws a real second whatever the speed
      const scroll = window.scrollY
      // after the intro the hole follows the scroll, eased (at the same pace whatever the frame rate) so it glides
      const target = t >= INTRO_END ? Math.min(Math.max(scroll / H, 0), MOVE_ROOM) : 0
      const moving = sS !== target
      if (moving) sS = Math.abs(target - sS) < 2e-4 ? target : sS + (target - sS) * (1 - Math.exp(-dt * SCROLL_EASE))
      const h = holeAt(t), rv = reveal(t, W, H, S)
      // the letters update FPS times a second, and on every frame while the hole is moving
      const update = moving || acc >= 1 / FPS - 0.004
      if (update) {
        drawArt(art, t, acc, h, moving)
        acc = 0
      }
      // the shock front is the other fast thing: while it's crossing the screen, redraw every frame
      if (update || scroll !== lastScroll || (rv && !rv.full)) {
        lastScroll = scroll
        draw(rv, scroll, h)
      }
      raf = requestAnimationFrame(loop)
    }

    // Size the canvas to exactly the device pixels it covers, or the browser
    // rescales it and everything goes soft. Past 2x costs a lot for little, so cap there.
    function fit(w, h, box) {
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
      // Rebuild for the new size straight away, on every frame the window is being
      // resized, so the black hole follows it smoothly. No timer: browsers can hold
      // timers back during a drag, which made it wait until the drag was let go.
      rebuild(w, h, pw, ph)
    }

    // resize, then draw at once: setting the canvas size clears it, and this can run
    // just before the browser paints, so it must never be left blank
    function rebuild(w, h, pw, ph) {
      resize(w, h, pw, ph)
      lastScroll = window.scrollY
      const now = holeAt(t)
      draw(reveal(t, W, H, S), lastScroll, now)
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
    buildTimer = setTimeout(() => lens.init(), 500) // build the lensed sky while only the ring is drawing
    return () => {
      clearTimeout(buildTimer)
      root.classList.remove('locked')
      lens.dispose()
      cancelAnimationFrame(raf)
      ro.disconnect()
      dprQuery?.removeEventListener('change', onDpr)
    }
  }, [])

  return (
    <>
      <canvas ref={canvasRef} className="sky" aria-hidden="true" />
      <div ref={probeRef} className="sky-probe" />
      {/* room to scroll the hole down into place; the content sections will take this over */}
      <div style={{ height: `${(1 + MOVE_ROOM) * 100}lvh` }} aria-hidden="true" />
    </>
  )
}
