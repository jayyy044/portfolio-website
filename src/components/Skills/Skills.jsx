import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './Skills.css'

gsap.registerPlugin(ScrollTrigger)

// the MAANAS-glitch ramp (dark → bright)
const RAMP = ' .,-:;!=*#@'
// the spray uses DIFFERENT glyphs (none of which are in RAMP) + a hot colour,
// so the ascii flung from the cursor reads as distinct ejecta, not the field
const SPRAY_RAMP = ' ~+xX'
const ROWS = 6 // height of the band, in character rows
const FPS = 30
const CHURN = 0.3 // base fraction of cells re-randomised each frame
const BIAS = 1.4 // >1 leans toward the sparse end of the ramp

// the cursor "pushes" the ascii away — like a hand parting a stream of water,
// and sprays a stream of ascii out of its tip (the thing doing the pushing)
const DEFAULTS = {
  radius: 12, // how far the push reaches (band columns)
  strength: 12, // how hard cells are shoved outward (→ void size)
  flow: 10, // ascii particles sprayed from the cursor per frame
  speed: 24, // how fast they fly outward (cols/sec, visual)
}

export default function Skills() {
  const sectionRef = useRef(null)
  const stripRef = useRef(null)
  const sprayRef = useRef(null)
  const mouseRef = useRef({ col: 0, row: 0, active: false })
  const metaRef = useRef({ charW: 6.6, rowH: 11, padL: 4 })

  const [cfg, setCfg] = useState(DEFAULTS)
  const cfgRef = useRef(cfg)
  useEffect(() => {
    cfgRef.current = cfg
  }, [cfg])

  // the band: a churning ascii field that PARTS around the cursor
  useEffect(() => {
    const el = stripRef.current
    let cols = 0
    let grid = []
    let particles = [] // ascii spraying out of the cursor tip
    let raf = 0
    let last = 0
    const frameMs = 1000 / FPS
    const randIdx = () => Math.floor(Math.pow(Math.random(), BIAS) * RAMP.length)

    const build = () => {
      const cs = getComputedStyle(el)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const meas = document.createElement('span')
      meas.textContent = '0'.repeat(200)
      meas.style.cssText =
        `position:absolute;visibility:hidden;white-space:pre;` +
        `font-family:${cs.fontFamily};font-size:${cs.fontSize};` +
        `letter-spacing:${cs.letterSpacing}`
      el.appendChild(meas)
      const charW = meas.getBoundingClientRect().width / 200 || 6.6
      el.removeChild(meas)
      cols = Math.max(1, Math.ceil((el.clientWidth - padX) / charW) + 6)
      metaRef.current = {
        charW,
        rowH: el.clientHeight / ROWS,
        padL: parseFloat(cs.paddingLeft),
      }
      grid = Array.from({ length: ROWS }, () =>
        Array.from({ length: cols }, randIdx)
      )
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(el)

    const tick = (t) => {
      if (t - last >= frameMs) {
        const dt = last ? Math.min(0.05, (t - last) / 1000) : frameMs / 1000
        last = t
        // churn the underlying field
        for (let y = 0; y < ROWS; y++)
          for (let x = 0; x < cols; x++)
            if (Math.random() < CHURN) grid[y][x] = randIdx()

        const m = mouseRef.current
        const R = cfgRef.current.radius
        const strength = cfgRef.current.strength
        const flow = cfgRef.current.flow
        const speed = cfgRef.current.speed
        const aspect = metaRef.current.rowH / metaRef.current.charW // ≈1.8

        // advance the stream sprayed from the cursor; cull the dead
        for (let p = 0; p < particles.length; p++) {
          const pt = particles[p]
          pt.x += pt.vx * dt
          pt.y += pt.vy * dt
          pt.age += dt
        }
        if (particles.length) particles = particles.filter((p) => p.age < p.life)
        // spawn fresh ascii at the cursor tip, flying radially outward
        if (m.active) {
          for (let s = 0; s < flow; s++) {
            // bias the spray HORIZONTALLY (left/right) — the stream splits in
            // two around the cursor and travels far across the thin band.
            const dir = Math.random() < 0.5 ? 0 : Math.PI
            const spread = (Math.random() - 0.5) * 0.9 // ±~0.45 rad vertical fan
            const ang = dir + spread
            const spd = speed * (0.5 + Math.random())
            particles.push({
              x: m.col + Math.cos(ang) * 0.8,
              y: m.row + (Math.sin(ang) * 0.8) / aspect,
              vx: Math.cos(ang) * spd,
              vy: (Math.sin(ang) * spd) / aspect,
              age: 0,
              life: 0.4 + Math.random() * 0.6,
            })
          }
        }

        // build the warped field into a render grid (idx per cell)
        const render = []
        for (let y = 0; y < ROWS; y++) {
          const r = new Array(cols)
          for (let x = 0; x < cols; x++) {
            let idx = grid[y][x]
            if (m.active) {
              const vdx = x - m.col
              const vdy = (y - m.row) * aspect // circular on screen
              const dist = Math.sqrt(vdx * vdx + vdy * vdy)
              if (dist < R) {
                // pull the SOURCE inward → content appears shoved outward (void)
                const srcDist = dist - strength * (1 - dist / R)
                if (srcDist <= 0.6) {
                  idx = 0 // the parted void
                } else {
                  const nx = vdx / dist
                  const ny = vdy / dist
                  let sx = Math.round(m.col + nx * srcDist)
                  let sy = Math.round(m.row + (ny * srcDist) / aspect)
                  sx = sx < 0 ? 0 : sx >= cols ? cols - 1 : sx
                  sy = sy < 0 ? 0 : sy >= ROWS ? ROWS - 1 : sy
                  idx = grid[sy][sx]
                }
              }
            }
            r[x] = idx
          }
          render[y] = r
        }

        // base warped field → the band (ember orange)
        let out = ''
        for (let y = 0; y < ROWS; y++) {
          const r = render[y]
          let line = ''
          for (let x = 0; x < cols; x++) line += RAMP[r[x]]
          out += line + '\n'
        }
        el.textContent = out

        // sprayed ascii → a SEPARATE overlay layer, hot gold + different glyphs,
        // so it reads clearly against the field and marks the cursor tip
        const sprayEl = sprayRef.current
        if (sprayEl) {
          const sgi = Array.from({ length: ROWS }, () => new Array(cols).fill(0))
          for (let p = 0; p < particles.length; p++) {
            const pt = particles[p]
            const px = Math.round(pt.x)
            const py = Math.round(pt.y)
            if (px >= 0 && px < cols && py >= 0 && py < ROWS) {
              const lifeFrac = 1 - pt.age / pt.life
              const si = Math.max(1, Math.round(lifeFrac * (SPRAY_RAMP.length - 1)))
              if (si > sgi[py][px]) sgi[py][px] = si // brighter spark wins
            }
          }
          let sout = ''
          for (let y = 0; y < ROWS; y++) {
            const r = sgi[y]
            let line = ''
            for (let x = 0; x < cols; x++) line += SPRAY_RAMP[r[x]]
            sout += line + '\n'
          }
          sprayEl.textContent = sout
        }
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  // track the cursor in band-grid coordinates
  useEffect(() => {
    const el = stripRef.current
    const onMove = (e) => {
      const rect = el.getBoundingClientRect()
      const margin = 28
      if (
        e.clientX >= rect.left - margin &&
        e.clientX <= rect.right + margin &&
        e.clientY >= rect.top - margin &&
        e.clientY <= rect.bottom + margin
      ) {
        const { charW, rowH, padL } = metaRef.current
        mouseRef.current = {
          col: (e.clientX - rect.left - padL) / charW,
          row: (e.clientY - rect.top) / rowH,
          active: true,
        }
      } else {
        mouseRef.current.active = false
      }
    }
    window.addEventListener('mousemove', onMove)
    return () => window.removeEventListener('mousemove', onMove)
  }, [])

  // reveal: card slides up, band wipes in from the centre
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.skills-card',
          start: 'top 75%',
          toggleActions: 'restart none none reset',
        },
      })
      tl.from('.skills-card', { y: 70, duration: 0.9, ease: 'power3.out' }).fromTo(
        '.distortion',
        { clipPath: 'inset(0% 50% 0% 50%)', opacity: 0 },
        { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, duration: 0.8, ease: 'power2.out' },
        '-=0.4'
      )
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section className="skills-section" ref={sectionRef}>
      {import.meta.env.DEV && <Knobs cfg={cfg} setCfg={setCfg} />}

      <article className="skills-card">
        <div className="skills-head">
          <div className="skills-top">
            <span>~/skills</span>
          </div>
          <h3>Skills &amp; Technologies</h3>
        </div>

        <pre ref={stripRef} className="distortion" aria-hidden="true" />
        <pre ref={sprayRef} className="spray" aria-hidden="true" />

        <span className="skills-label">— SKILLS</span>
      </article>
    </section>
  )
}

/* ── dev-only control panel ───────────────────────────────────────────── */
const SLIDERS = [
  ['radius', 'reach', 4, 40, 1, ''],
  ['strength', 'push', 2, 40, 1, ''],
  ['flow', 'flow', 0, 40, 1, ''],
  ['speed', 'speed', 2, 80, 1, ''],
]

function Knobs({ cfg, setCfg }) {
  const set = (k) => (v) => setCfg((c) => ({ ...c, [k]: v }))
  return (
    <div className="knobs">
      <div className="knobs-title">◆ push knobs</div>
      {SLIDERS.map(([key, label, min, max, step, unit]) => (
        <label className="knob" key={key}>
          <span>{label}</span>
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={cfg[key]}
            onChange={(e) => set(key)(parseFloat(e.target.value))}
          />
          <b>
            {cfg[key]}
            {unit}
          </b>
        </label>
      ))}
    </div>
  )
}
