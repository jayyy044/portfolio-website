import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TECH } from './techIcons'
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
  flow: 25, // ascii particles sprayed from the cursor per frame
  speed: 30, // how fast they fly outward (cols/sec, visual)
  startMs: 200, // delay AFTER the bar finishes revealing before skills begin
}

// a SIMULATED poke on the bar: the parting + spray fire here on their own, and
// one (smaller) skill slides down + fades in out of that point.
const SKILL = TECH.find((t) => t.label === 'Python')
const SIM_FRAC = 0.5 // where on the bar the simulated cursor sits (fraction)
const SKILL_W = 54 // smaller than the honeycomb's full 96
const SKILL_H = SKILL_W * 1.15
const SLIDE = 64 // how far the skill slides down from the bar point
const POKE_DX = 0 // fine-tune: shift the poke left/right relative to the hex (px)

export default function Skills() {
  const sectionRef = useRef(null)
  const stripRef = useRef(null)
  const sprayRef = useRef(null)
  const simRef = useRef({ col: 0, row: 0, active: false }) // code-driven poke
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
        cols, // needed by the sim poke to map a bar fraction → column
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

        const sim = simRef.current
        const src = sim.active ? sim : null // fully code-driven (no cursor)
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
        // spawn fresh ascii at the source tip, flying radially outward
        if (src) {
          for (let s = 0; s < flow; s++) {
            // bias the spray HORIZONTALLY (left/right) — the stream splits in
            // two around the source and travels far across the thin band.
            const dir = Math.random() < 0.5 ? 0 : Math.PI
            const spread = (Math.random() - 0.5) * 0.9 // ±~0.45 rad vertical fan
            const ang = dir + spread
            const spd = speed * (0.5 + Math.random())
            particles.push({
              x: src.col + Math.cos(ang) * 0.8,
              y: src.row + (Math.sin(ang) * 0.8) / aspect,
              vx: Math.cos(ang) * spd,
              vy: (Math.sin(ang) * spd) / aspect,
              age: 0,
              life: 0.28 + Math.random() * 0.4, // short → stays a tight cluster
            })
          }
        }

        // build the warped field into a render grid (idx per cell)
        const render = []
        for (let y = 0; y < ROWS; y++) {
          const r = new Array(cols)
          for (let x = 0; x < cols; x++) {
            let idx = grid[y][x]
            if (src) {
              const vdx = x - src.col
              const vdy = (y - src.row) * aspect // circular on screen
              const dist = Math.sqrt(vdx * vdx + vdy * vdy)
              if (dist < R) {
                // pull the SOURCE inward → content appears shoved outward (void)
                const srcDist = dist - strength * (1 - dist / R)
                if (srcDist <= 0.6) {
                  idx = 0 // the parted void
                } else {
                  const nx = vdx / dist
                  const ny = vdy / dist
                  let sx = Math.round(src.col + nx * srcDist)
                  let sy = Math.round(src.row + (ny * srcDist) / aspect)
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

  // position the (small) skill at the sim point — its rest spot below the bar
  useLayoutEffect(() => {
    const card = sectionRef.current.querySelector('.skills-card')
    const band = card.querySelector('.distortion')
    const drop = card.querySelector('.skill-drop')

    const layout = () => {
      const cardW = card.clientWidth
      const barY = band.offsetTop + band.offsetHeight / 2
      drop.style.width = `${SKILL_W}px`
      drop.style.height = `${SKILL_H}px`
      drop.style.left = `${SIM_FRAC * cardW - SKILL_W / 2}px`
      drop.style.top = `${barY + SLIDE - SKILL_H / 2}px`
    }
    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(card)
    return () => ro.disconnect()
  }, [])

  // reveal the card + bar, THEN run the looping poke/drop. The loop must NOT
  // start until the distortion bar has finished rendering in.
  useEffect(() => {
    let startCall = null // delayed call that kicks off the loop after the reveal
    const ctx = gsap.context(() => {
      const card = sectionRef.current.querySelector('.skills-card')
      const drop = card.querySelector('.skill-drop')

      // pick a fresh random spot; derive the poke COLUMN from the skill's exact
      // centre pixel (band padding + glyph width) so the x's centre on the hex.
      const pickSpot = () => {
        const frac = 0.2 + Math.random() * 0.6
        const cx = frac * card.clientWidth // skill centre, in card px
        const { padL, charW } = metaRef.current
        simRef.current = {
          col: (cx + POKE_DX - padL) / charW,
          row: (ROWS - 1) / 2,
          active: true,
        }
        drop.style.left = `${cx - SKILL_W / 2}px`
      }
      const release = () => {
        simRef.current.active = false
      }

      // the looping poke + drop — built PAUSED, started only after the reveal
      const loop = gsap.timeline({ repeat: -1, repeatDelay: 0.7, paused: true })
      loop
        .call(pickSpot, null, 0)
        // 0.0–0.55s: the disturbance + x's generate ALONE at the spot
        // 0.55s: the skill fades in + slides down UNDER the x's
        .fromTo(
          '.skill-drop',
          { y: -SLIDE, opacity: 0 },
          { y: 0, opacity: 1, duration: 1.0, ease: 'power2.out' },
          0.55
        )
        // x's keep spraying above the skill through the hold, then release + fade
        .call(release, null, 2.8)
        .to('.skill-drop', { opacity: 0, duration: 0.5 }, 2.8)

      let started = false
      const startLoop = () => {
        if (started) return
        started = true
        // wait `startMs` after the bar has fully revealed before the first skill
        startCall = gsap.delayedCall(cfgRef.current.startMs / 1000, () => loop.play(0))
      }

      // reveal: card slides up, band wipes in — the loop starts on its completion
      const reveal = gsap.timeline({
        scrollTrigger: {
          trigger: '.skills-card',
          start: 'top 75%',
          toggleActions: 'restart none none reset',
        },
        onComplete: startLoop,
      })
      reveal
        .from('.skills-card', { y: 70, duration: 0.9, ease: 'power3.out' })
        .fromTo(
          '.distortion',
          { clipPath: 'inset(0% 50% 0% 50%)', opacity: 0 },
          { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, duration: 0.8, ease: 'power2.out' },
          '-=0.4'
        )

      // robustness: if already in view on (re)build (HMR / loaded scrolled here),
      // jump the reveal to the end and start the loop — nothing gets stranded.
      requestAnimationFrame(() => {
        if (card.getBoundingClientRect().top < window.innerHeight * 0.75) {
          reveal.progress(1)
          startLoop()
        }
      })
    }, sectionRef)
    return () => {
      startCall?.kill()
      ctx.revert()
    }
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

        {/* one small skill that slides down + fades in from the sim poke */}
        <div className="skill-drop" data-label={SKILL.label}>
          <svg className="hex-svg" viewBox="0 0 100 115" aria-hidden="true">
            <polygon
              className="hex-cell"
              points="50,1.5 98,29.5 98,85.5 50,113.5 2,85.5 2,29.5"
            />
            <g className="hex-glyph" transform="translate(29.5,36) scale(1.71)">
              <path d={SKILL.path} />
            </g>
          </svg>
        </div>

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
  ['startMs', 'start delay', 0, 3000, 100, 'ms'],
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
