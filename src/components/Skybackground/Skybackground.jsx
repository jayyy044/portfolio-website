import { useEffect, useRef } from 'react'
import { createStars, drawStars } from './stars'
import { createNebula, drawNebula } from './nebula'
import { reveal } from './blackhole'
import { createArt, drawArt, composeArt } from './ascii'
import './Skybackground.css'

const FPS = 30 // the black hole's letters update this often; everything else every frame
const INTRO_END = 13 // seconds: by then the black hole has finished drawing itself
const SPEED = 1.5 // how fast the clock runs: 2 = twice as fast, 0.5 = half

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
    let W, H, dpr, S, nebula, stars, art, raf, resizeTimer
    let last = 0, acc = 0

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      S = Math.min(H, W / 1.35) // one unit of the black hole's maths, in px
      for (const c of [canvas, bg]) {
        c.width = Math.round(W * dpr)
        c.height = Math.round(H * dpr)
      }
      bctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const grad = bctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2)
      grad.addColorStop(0, '#04060c')
      grad.addColorStop(1, '#000000')
      bctx.fillStyle = grad
      bctx.fillRect(0, 0, W, H)
      stars = createStars(bctx, W, H)
      nebula = createNebula(W, H, S)
      art = createArt(W, H, dpr, S)
      // a few updates up front, so the letters' trail is already there
      for (let i = 0; i < 4; i++) {
        const ti = t - (3 - i) / FPS
        drawArt(art, ti, 1 / FPS, reveal(ti, W, H, S))
      }
    }

    function loop(now) {
      const dt = Math.min((now - last) / 1000, 0.1) // capped, so a hidden tab doesn't jump ahead
      last = now
      t += dt * SPEED
      acc += dt // real time: the letters update 30 times a real second whatever the speed
      const rv = reveal(t, W, H, S)
      if (acc >= 1 / FPS - 0.004) {
        drawArt(art, t, acc, rv)
        acc = 0
      }

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.globalCompositeOperation = 'source-over' // start clean, whatever a layer left behind
      ctx.globalAlpha = 1
      ctx.filter = 'none'
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      // the sky stays dark until the flash's shock front sweeps out and uncovers it
      if (rv) {
        const ox = Math.sin(t * 0.6 * 0.031) * 14, oy = Math.cos(t * 0.6 * 0.023) * 9 // a slow sway
        ctx.drawImage(bg, ox - 14, oy - 9, W + 28, H + 18)
        drawNebula(ctx, nebula, t, ox, oy)
        drawStars(ctx, stars, t, ox, oy, window.scrollY)
        if (!rv.full) {
          const soft = Math.max(24, 0.1 * S)
          const g = ctx.createRadialGradient(rv.cx, rv.cy, Math.max(0, rv.r - soft), rv.cx, rv.cy, rv.r)
          g.addColorStop(0, 'rgba(0,0,0,0)')
          g.addColorStop(1, 'rgba(0,0,0,1)')
          ctx.fillStyle = g
          ctx.fillRect(0, 0, W, H)
        }
      }
      composeArt(ctx, art)
      raf = requestAnimationFrame(loop)
    }

    // the nebula takes a moment to paint, so wait until resizing settles
    function onResize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(resize, 120)
    }

    document.fonts?.load('500 12px "JetBrains Mono"') // the letters use it; nothing else on the page asks for it yet
    resize()
    window.addEventListener('resize', onResize)
    raf = requestAnimationFrame((now) => {
      last = now
      loop(now)
    })
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="sky" aria-hidden="true" />
}
