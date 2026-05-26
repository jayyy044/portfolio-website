import { useEffect, useRef } from 'react'
import './AsciiName.css'

/* The ORIGINAL ramp ASCII name:
   Sample MAANAS into a grid, map brightness -> a ramp glyph, settle in left->right,
   scramble under the cursor. Lighter weight, bigger (font-size in CSS), higher
   resolution (more columns). */
export default function AsciiName() {
  const preRef = useRef(null)

  useEffect(() => {
    const TEXT = 'MAANAS'
    const SAMPLE_WEIGHT = 400 // less bold (was 900)
    const RAMP = ' .,-:;!=*#@' // dark -> bright
    const pre = preRef.current

    function buildNameAscii() {
      const tmp = document.createElement('canvas')
      const ctx = tmp.getContext('2d')
      const cellW = 7,
        cellH = 12 // sampling resolution
      const FONT = 150 // letter size
      const GAP = FONT * 0.06 // gap between letters' INK (tight, even)
      const PAD = FONT * 0.08
      const chars = TEXT.split('')

      // measure each letter's real ink width and pack them with a fixed small gap,
      // so spacing follows the visible ink — not the font's built-in side bearing
      ctx.font = `${SAMPLE_WEIGHT} ${FONT}px 'Geist Mono', monospace`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      let cursor = PAD
      const place = []
      for (const ch of chars) {
        const m = ctx.measureText(ch)
        place.push({ ch, x: cursor + m.actualBoundingBoxLeft })
        cursor += m.actualBoundingBoxLeft + m.actualBoundingBoxRight + GAP
      }
      const W = Math.ceil(cursor - GAP + PAD)
      const H = Math.ceil(FONT * 1.12)

      tmp.width = W
      tmp.height = H
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, W, H)
      ctx.fillStyle = '#fff'
      ctx.font = `${SAMPLE_WEIGHT} ${FONT}px 'Geist Mono', monospace`
      ctx.textBaseline = 'middle'
      ctx.textAlign = 'left'
      for (const p of place) ctx.fillText(p.ch, p.x, H / 2)

      const gridW = Math.floor(W / cellW),
        gridH = Math.floor(H / cellH)
      const data = ctx.getImageData(0, 0, W, H).data
      const cells = []
      for (let gy = 0; gy < gridH; gy++) {
        const row = []
        for (let gx = 0; gx < gridW; gx++) {
          const px = Math.floor(gx * cellW + cellW / 2)
          const py = Math.floor(gy * cellH + cellH / 2)
          const brightness = data[(py * W + px) * 4] / 255
          row.push(Math.min(RAMP.length - 1, Math.floor(brightness * RAMP.length)))
        }
        cells.push(row)
      }
      return { cells, gridW, gridH }
    }

    let raf
    let onMove, onLeave
    let cancelled = false

    document.fonts.ready.then(() => {
      if (cancelled) return
      const { cells, gridW, gridH } = buildNameAscii()
      const state = []
      for (let y = 0; y < gridH; y++) {
        const row = []
        for (let x = 0; x < gridW; x++)
          row.push({ target: cells[y][x], settle: 0, delay: (x / gridW) * 1.4 })
        state.push(row)
      }

      let gx = -1,
        gy = -1
      onMove = (e) => {
        const r = pre.getBoundingClientRect()
        const inside =
          e.clientX >= r.left - 80 &&
          e.clientX <= r.right + 80 &&
          e.clientY >= r.top - 50 &&
          e.clientY <= r.bottom + 50
        if (inside) {
          gx = ((e.clientX - r.left) / r.width) * gridW
          gy = ((e.clientY - r.top) / r.height) * gridH
        } else {
          gx = -1
          gy = -1
        }
      }
      onLeave = () => {
        gx = -1
        gy = -1
      }
      window.addEventListener('mousemove', onMove)
      window.addEventListener('mouseleave', onLeave)

      const startT = performance.now()
      const render = () => {
        const now = (performance.now() - startT) / 1000
        let out = ''
        for (let y = 0; y < gridH; y++) {
          let line = ''
          for (let x = 0; x < gridW; x++) {
            const c = state[y][x]
            if (c.settle < 1 && now > c.delay) c.settle = Math.min(1, c.settle + 0.04)
            let glitch = false
            if (gx >= 0) {
              const dx = x - gx,
                dy = y - gy
              if (dx * dx + dy * dy < 9) glitch = true
            } // smaller radius
            let ch
            if (glitch) {
              // gentle hover scramble — most cells hold their letter, only ~30% flicker
              ch =
                Math.random() < 0.3
                  ? RAMP[(Math.random() * RAMP.length) | 0]
                  : RAMP[c.target]
            } else if (c.settle < 1) {
              ch =
                Math.random() < c.settle
                  ? RAMP[c.target]
                  : RAMP[(Math.random() * RAMP.length) | 0]
            } else {
              ch = RAMP[c.target] // settled -> locked, stable
            }
            line += ch
          }
          out += line + '\n'
        }
        pre.textContent = out
        raf = requestAnimationFrame(render)
      }
      render()
    })

    return () => {
      cancelled = true
      cancelAnimationFrame(raf)
      if (onMove) window.removeEventListener('mousemove', onMove)
      if (onLeave) window.removeEventListener('mouseleave', onLeave)
    }
  }, [])

  return (
    <pre ref={preRef} className="ascii-name" aria-label="MAANAS">
      // loading…
    </pre>
  )
}
