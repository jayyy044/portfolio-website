import { useEffect, useRef } from 'react'
import './Globe.css'

export default function Globe() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const CHARS = '░▒▓█▀▄▌▐│─┤├┴┬╭╮╰╯'

    function resize() {
      const dpr = Math.min(devicePixelRatio || 1, 2)
      const r = canvas.getBoundingClientRect()
      canvas.width = r.width * dpr
      canvas.height = r.height * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    addEventListener('resize', resize)

    let time = 0
    const m = { tx: 0, ty: 0, x: 0, y: 0 }
    const onMove = (e) => {
      m.tx = (e.clientX / innerWidth) * 2 - 1
      m.ty = -((e.clientY / innerHeight) * 2 - 1)
    }
    addEventListener('mousemove', onMove)

    let raf
    const loop = () => {
      m.x += (m.tx - m.x) * 0.06
      m.y += (m.ty - m.y) * 0.06
      const dpr = devicePixelRatio || 1
      const w = canvas.width / dpr
      const h = canvas.height / dpr
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) * 0.42
      // glyph size scales with the canvas so the sphere keeps the same density
      // at any size (12px when the box is the HTML's ~880px → w / 73.3)
      const glyph = w / 73.3
      ctx.clearRect(0, 0, w, h)
      ctx.font = `${glyph}px "Geist Mono", monospace`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(255,111,26,0.6)'
      ctx.shadowBlur = glyph * 0.9
      const ry = time * 0.3 + m.x * 0.8
      const rx = time * 0.18 + m.y * 0.6
      const cY = Math.cos(ry)
      const sY = Math.sin(ry)
      const cX = Math.cos(rx)
      const sX = Math.sin(rx)
      const pts = []
      for (let phi = 0; phi < 6.283; phi += 0.15) {
        for (let th = 0; th < 3.1415; th += 0.15) {
          let x = Math.sin(th) * Math.cos(phi)
          let y = Math.sin(th) * Math.sin(phi)
          let z = Math.cos(th)
          let x1 = x * cY - z * sY
          let z1 = x * sY + z * cY
          x = x1
          z = z1
          let y1 = y * cX - z * sX
          let z2 = y * sX + z * cX
          y = y1
          z = z2
          pts.push({ x, y, z })
        }
      }
      pts.sort((a, b) => a.z - b.z)
      for (const p of pts) {
        const d = (p.z + 1) * 0.5
        const i = Math.min(CHARS.length - 1, (d * CHARS.length) | 0)
        const b = 0.32 + d * 0.6
        ctx.fillStyle = `rgb(${(255 * b) | 0}, ${(50 + d * 130) | 0}, ${(20 + d * 30) | 0})`
        ctx.fillText(CHARS[i], cx + p.x * R, cy + p.y * R)
      }
      ctx.shadowBlur = 0
      time += 0.012
      raf = requestAnimationFrame(loop)
    }
    loop()

    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      removeEventListener('mousemove', onMove)
    }
  }, [])

  return <canvas ref={canvasRef} className="globe" />
}
