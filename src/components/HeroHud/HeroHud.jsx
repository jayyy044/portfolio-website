import { useEffect, useRef } from 'react'
import './HeroHud.css'

/* The name is rasterised to a hidden canvas, pixel-sampled into a character
   grid, then revealed with a left-to-right scramble + a cursor "glitch" zone.
   (Ported from the standalone ASCII hero so it can live over the moon scene.) */
const LINES = ['MAANAS SAXENA']
const TARGET_COLS = 128
const WEIGHT = 600
const RAMP = ' .,-:;!=*#@'

export default function HeroHud() {
  const hudRef = useRef(null)
  const nameRef = useRef(null)

  useEffect(() => {
    let cancelled = false
    let rafName = 0
    const nameEl = nameRef.current

    /* ── name → ASCII grid (needs Inter loaded, else it samples a fallback) ── */
    function buildNameAscii() {
      const tmp = document.createElement('canvas')
      const ctx = tmp.getContext('2d')
      const cellW = 6
      const cellH = 6
      const W = TARGET_COLS * cellW
      const targetFontSize = 220
      ctx.font = `${WEIGHT} ${targetFontSize}px Inter, sans-serif`
      let maxW = 0
      for (const l of LINES) maxW = Math.max(maxW, ctx.measureText(l).width)
      const padding = 18
      const scale = (W - padding * 2) / maxW
      const finalFontSize = targetFontSize * scale
      const lineH = finalFontSize
      const H = Math.ceil(lineH * LINES.length)
      tmp.width = W
      tmp.height = H
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#fff'
      ctx.font = `${WEIGHT} ${finalFontSize}px Inter, sans-serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      for (let li = 0; li < LINES.length; li++) {
        ctx.fillText(LINES[li], W / 2, (li + 0.5) * lineH)
      }
      const gw = Math.floor(W / cellW)
      const gh = Math.floor(H / cellH)
      const data = ctx.getImageData(0, 0, W, H).data
      const cells = []
      for (let gy = 0; gy < gh; gy++) {
        const row = []
        for (let gx = 0; gx < gw; gx++) {
          const px = Math.floor(gx * cellW + cellW / 2)
          const py = Math.floor(gy * cellH + cellH / 2)
          const i = (py * W + px) * 4
          const brightness = data[i] / 255
          row.push(Math.min(RAMP.length - 1, Math.floor(brightness * RAMP.length)))
        }
        cells.push(row)
      }
      return { cells, gw, gh }
    }

    let state = null
    let gridW = 0
    let gridH = 0
    let mouseGX = -1
    let mouseGY = -1
    let allSettled = false
    const startT = performance.now()

    const onMouseMove = (e) => {
      if (!nameEl) return
      const rect = nameEl.getBoundingClientRect()
      if (
        e.clientX >= rect.left - 80 &&
        e.clientX <= rect.right + 80 &&
        e.clientY >= rect.top - 50 &&
        e.clientY <= rect.bottom + 50
      ) {
        mouseGX = ((e.clientX - rect.left) / rect.width) * gridW
        mouseGY = ((e.clientY - rect.top) / rect.height) * gridH
      } else {
        mouseGX = -1
        mouseGY = -1
      }
    }
    const onMouseLeave = () => {
      mouseGX = -1
      mouseGY = -1
    }

    function renderName() {
      if (cancelled) return
      rafName = requestAnimationFrame(renderName)
      if (!state || !nameEl) return
      const now = (performance.now() - startT) / 1000
      let out = ''
      let stillRevealing = false
      for (let y = 0; y < gridH; y++) {
        let line = ''
        for (let x = 0; x < gridW; x++) {
          const c = state[y][x]
          if (c.settle < 1) {
            if (now > c.delay) {
              c.settle += 0.04
              if (c.settle > 1) c.settle = 1
            }
            if (c.settle < 1) stillRevealing = true
          }
          let glitch = false
          if (mouseGX >= 0) {
            const dx = x - mouseGX
            const dy = y - mouseGY
            if (Math.sqrt(dx * dx + dy * dy) < 4) glitch = true
          }
          let char
          if (c.settle < 1 || glitch) {
            if (Math.random() < c.settle && !glitch) char = RAMP[c.target]
            else char = RAMP[Math.floor(Math.random() * RAMP.length)]
          } else if (Math.random() < 0.998) {
            char = RAMP[c.target]
          } else {
            char = RAMP[Math.floor(Math.random() * RAMP.length)]
          }
          line += char
        }
        out += line + '\n'
      }
      nameEl.textContent = out
      if (!stillRevealing && !allSettled) {
        allSettled = true
        nameEl.classList.add('settled')
      }
    }

    // build the grid once the font is ready so the canvas samples Inter, not a fallback
    const fontReady =
      document.fonts && document.fonts.load
        ? document.fonts.load(`${WEIGHT} 220px "Inter"`).catch(() => {})
        : Promise.resolve()
    fontReady.then(() => {
      if (cancelled) return
      const built = buildNameAscii()
      gridW = built.gw
      gridH = built.gh
      state = []
      for (let y = 0; y < gridH; y++) {
        const row = []
        for (let x = 0; x < gridW; x++) {
          row.push({
            target: built.cells[y][x],
            settle: 0,
            delay: (x / gridW) * 1.4,
          })
        }
        state.push(row)
      }
    })
    renderName()

    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseleave', onMouseLeave)

    // kicker rise-in (the ASCII name reveals itself via the scramble)
    const root = hudRef.current
    const kicker = root ? root.querySelector('.title .k') : null
    let kAnim = null
    if (kicker) {
      kicker.style.opacity = 0
      kAnim = kicker.animate(
        [
          { opacity: 0, transform: 'translateY(14px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 1100, delay: 250, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'forwards' }
      )
    }

    return () => {
      cancelled = true
      cancelAnimationFrame(rafName)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseleave', onMouseLeave)
      if (kAnim) kAnim.cancel()
    }
  }, [])

  return (
    <div className="hud" ref={hudRef}>
      <div className="title">
        <div className="k">Hi, My Name Is</div>
        <pre className="name-ascii" ref={nameRef}>
          {'// loading…'}
        </pre>
      </div>
    </div>
  )
}
