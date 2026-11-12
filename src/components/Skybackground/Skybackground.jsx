import { useEffect, useRef } from 'react'
import { createStars, drawStars } from './stars'
import { createNebula, drawNebula } from './nebula'
import './Skybackground.css'

// Fixed full-screen canvas behind the page: the sky, and later the black hole
// and comet. Owns sizing and the frame loop; each layer lives in its own module.
export default function Skybackground() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const bg = document.createElement('canvas') // the still parts, painted once per resize
    const bctx = bg.getContext('2d')
    let W, H, dpr, nebula, stars, raf, resizeTimer

    function resize() {
      W = window.innerWidth
      H = window.innerHeight
      dpr = Math.min(window.devicePixelRatio || 1, 2)
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
      nebula = createNebula(W, H)
    }

    function loop(now) {
      const t = now / 1000
      // the whole sky sways a few pixels, slowly
      const ox = Math.sin(t * 0.6 * 0.031) * 14, oy = Math.cos(t * 0.6 * 0.023) * 9
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.drawImage(bg, ox - 14, oy - 9, W + 28, H + 18)
      drawNebula(ctx, nebula, t, ox, oy)
      drawStars(ctx, stars, t, ox, oy, window.scrollY)
      raf = requestAnimationFrame(loop)
    }

    // the nebula takes a moment to paint, so wait until resizing settles
    function onResize() {
      clearTimeout(resizeTimer)
      resizeTimer = setTimeout(resize, 120)
    }

    resize()
    window.addEventListener('resize', onResize)
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(resizeTimer)
      window.removeEventListener('resize', onResize)
    }
  }, [])

  return <canvas ref={canvasRef} className="sky" aria-hidden="true" />
}
