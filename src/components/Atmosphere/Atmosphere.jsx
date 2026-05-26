import { useEffect, useRef } from 'react'
import './Atmosphere.css'

export default function Atmosphere() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const c = canvasRef.current
    const x = c.getContext('2d')
    let W, H

    const resize = () => {
      W = c.width = innerWidth
      H = c.height = innerHeight
    }
    resize()
    addEventListener('resize', resize)

    const blobs = Array.from({ length: 4 }, (_, i) => ({
      a: Math.random() * 6.28,
      s: 0.035 + Math.random() * 0.04,
      r: 280 + i * 80,
      p: Math.random() * 6.28,
    }))

    let t = 0
    let raf

    const loop = () => {
      x.clearRect(0, 0, W, H)
      x.globalCompositeOperation = 'lighter'
      for (const b of blobs) {
        const cx = W / 2 + Math.cos(b.a + t * b.s) * (W * 0.2)
        const cy = H / 2 + Math.sin(b.p + t * b.s * 1.3) * (H * 0.2)
        const g = x.createRadialGradient(cx, cy, 0, cx, cy, b.r)
        g.addColorStop(0, 'rgba(255,111,26,0.09)')
        g.addColorStop(1, 'rgba(255,111,26,0)')
        x.fillStyle = g
        x.fillRect(0, 0, W, H)
      }
      x.globalCompositeOperation = 'source-over'
      t += 0.016
      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
    }
  }, [])

  return <canvas ref={canvasRef} className="atmos" />
}
