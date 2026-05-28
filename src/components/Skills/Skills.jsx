import { useEffect, useRef, useState } from 'react'
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
  gravity: 0.2, // drop physics — accel per frame (from the falling-ball demo)
  bounce: 0.4, // drop physics — restitution on ground contact
  dropMs: 650, // time the skill takes to slide down + fade in, THEN it drops
  fallSpeed: 0.8, // time-scale on the fall (higher = falls faster)
}

// a SIMULATED poke on the bar: the parting + spray fire here on their own, and
// one (smaller) skill slides down + fades in out of that point.
const SKILL = TECH.find((t) => t.label === 'Python')
// full-colour logo (devicon two-tone), not the monochrome simple-icons glyph
const SKILL_LOGO =
  'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/python/python-original.svg'
const SKILL_W = 54 // hexagon width (px) — height derived pointy-top
const SKILL_H = SKILL_W * 1.15
const POKE_DX = 0 // fine-tune: shift the bar disturbance left/right (px)
const SKILL_DX = 0 // fine-tune: shift the skill under the visible disturbance (px)
const FORM_START_DY = 24 // skill starts this far under the bar centre
const FORM_END_DY = 70 // …slides down to here while fading in, then drops

export default function Skills() {
  const sectionRef = useRef(null)
  const stripRef = useRef(null)
  const sprayRef = useRef(null)
  const canvasRef = useRef(null)
  const readyRef = useRef(false) // true once the bar has revealed + start delay
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
    // The webfont may load AFTER the first build → the fallback glyph is ~9%
    // narrower, so charW (and every column→pixel mapping) comes out wrong and
    // the disturbance renders offset from where the skill drops. Re-measure
    // once fonts are ready so the bar + skill line up.
    let alive = true
    if (document.fonts?.ready) document.fonts.ready.then(() => alive && build())

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
      alive = false
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  // reveal the card + bar, then (after the start delay) ARM the physics drop
  useEffect(() => {
    let startCall = null
    const ctx = gsap.context(() => {
      const card = sectionRef.current.querySelector('.skills-card')
      let armed = false
      const arm = () => {
        if (armed) return
        armed = true
        // wait `startMs` after the bar has fully revealed before drops begin
        startCall = gsap.delayedCall(cfgRef.current.startMs / 1000, () => {
          readyRef.current = true
        })
      }
      const reveal = gsap.timeline({
        scrollTrigger: {
          trigger: '.skills-card',
          start: 'top 75%',
          toggleActions: 'restart none none reset',
        },
        onComplete: arm,
      })
      reveal
        .from('.skills-card', { y: 70, duration: 0.9, ease: 'power3.out' })
        .fromTo(
          '.distortion',
          { clipPath: 'inset(0% 50% 0% 50%)', opacity: 0 },
          { clipPath: 'inset(0% 0% 0% 0%)', opacity: 1, duration: 0.8, ease: 'power2.out' },
          '-=0.4'
        )
      // robustness: already in view on (re)build (HMR / loaded scrolled here)
      requestAnimationFrame(() => {
        if (card.getBoundingClientRect().top < window.innerHeight * 0.75) {
          reveal.progress(1)
          arm()
        }
      })
    }, sectionRef)
    return () => {
      startCall?.kill()
      ctx.revert()
    }
  }, [])

  // the drop — the skill forms under the bar, then (50ms later) FALLS with
  // gravity + bounce (falling-ball demo). Only the straight speed lines are
  // kept (no trail / swirls / shockwave); a small screen-shake on impact stays.
  useEffect(() => {
    const canvas = canvasRef.current
    const card = sectionRef.current.querySelector('.skills-card')
    const band = card.querySelector('.distortion')
    const c = canvas.getContext('2d')

    const logo = new Image()
    logo.src = SKILL_LOGO

    let W = 0
    let H = 0
    let barY = 0
    let groundY = 0
    const size = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      W = card.clientWidth
      H = card.clientHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      canvas.style.width = `${W}px`
      canvas.style.height = `${H}px`
      c.setTransform(dpr, 0, 0, dpr, 0, 0)
      barY = band.offsetTop + band.offsetHeight / 2
      groundY = H - 56
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(card)

    const R = SKILL_H / 2
    let ball = null
    let lines = [] // straight speed lines beside the ball as it falls
    let shake = 0
    let phase = 'idle'
    let formA = 0
    let formT = 0
    let restT = 0
    let idleT = 0
    let raf = 0

    const spawn = () => {
      const frac = 0.2 + Math.random() * 0.6
      const x = frac * W // disturbance spawn point on the bar
      const startY = barY + FORM_START_DY
      ball = { x: x + SKILL_DX, y: startY, startY, restY: barY + FORM_END_DY, vy: 0, r: R }
      phase = 'form'
      formA = 0
      formT = 0
      restT = 0
      lines = []
      shake = 0
      // disturbance on the bar at this column while the skill slides down
      const { padL, charW } = metaRef.current
      simRef.current = {
        col: (x + POKE_DX - padL) / charW,
        row: (ROWS - 1) / 2,
        active: true,
      }
    }

    const spawnLines = () => {
      if (ball.vy < 3.5) return
      if (Math.random() < ball.vy / 14) {
        const side = Math.random() < 0.5 ? -1 : 1
        lines.push({
          // hug the hexagon: just outside its edge (~ball.r), small spread
          x: ball.x + side * (ball.r + 2 + Math.random() * 12),
          y: ball.y - 10 + Math.random() * 30,
          len: 20 + Math.random() * 32 + ball.vy * 0.6,
          life: 18,
          max: 18,
        })
      }
    }
    const loop = () => {
      const dt = 1 // frame tick for render/hold/rest (real-time)
      const ts = cfgRef.current.fallSpeed // time-scale applied to the FALL only
      const GRAV = cfgRef.current.gravity
      const REST = cfgRef.current.bounce
      c.clearRect(0, 0, W, H)
      c.save()
      if (shake > 0.2) {
        c.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake)
        shake *= Math.pow(0.84, dt)
      }

      if (!ball) {
        if (readyRef.current) {
          idleT += dt
          if (idleT > 42) {
            idleT = 0
            spawn()
          }
        }
      } else if (phase === 'form') {
        // slide down from under the bar + fade in over `dropMs`, then drop
        formT += dt
        const dur = Math.max(1, cfgRef.current.dropMs / (1000 / 60))
        const p = Math.min(1, formT / dur)
        formA = p
        const e = 1 - Math.pow(1 - p, 3) // easeOut slide
        ball.y = ball.startY + (ball.restY - ball.startY) * e
        if (p >= 1) {
          phase = 'fall'
          ball.vy = 0
          simRef.current.active = false // release the disturbance; now it drops
        }
      } else if (phase === 'fall') {
        ball.vy += GRAV * ts
        ball.y += ball.vy * ts
        if (ball.y + ball.r >= groundY && ball.vy > 0) {
          const hv = ball.vy
          ball.y = groundY - ball.r
          if (hv < 1.3) {
            ball.vy = 0
            phase = 'settle'
          } else {
            ball.vy = -hv * REST
            shake = Math.min(20, hv * 0.7)
          }
        }
        if (ball.vy > 2) spawnLines()
      } else if (phase === 'settle') {
        restT += dt
        if (restT > 80) {
          ball = null
          phase = 'idle'
          idleT = 0
        }
      }

      lines = lines.filter((l) => l.life > 0)
      lines.forEach((l) => {
        l.life -= dt
      })

      lines.forEach((l) => {
        const a = (l.life / l.max) * 0.5
        c.beginPath()
        c.moveTo(l.x, l.y)
        c.lineTo(l.x, l.y + l.len)
        c.strokeStyle = `rgba(255,220,170,${a})`
        c.lineWidth = 1.4
        c.lineCap = 'round'
        c.stroke()
      })
      if (ball) {
        c.globalAlpha = formA
        // the hexagon cell (pointy-top)
        c.beginPath()
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 3) * i - Math.PI / 2
          const px = ball.x + ball.r * Math.cos(ang)
          const py = ball.y + ball.r * Math.sin(ang)
          if (i) c.lineTo(px, py)
          else c.moveTo(px, py)
        }
        c.closePath()
        c.fillStyle = 'rgba(255,111,26,0.05)'
        c.fill()
        c.strokeStyle = 'rgba(255,111,26,0.5)'
        c.lineWidth = 1.4
        c.stroke()
        // the full-colour logo
        if (logo.complete && logo.naturalWidth) {
          const s = ball.r * 1.05
          c.drawImage(logo, ball.x - s / 2, ball.y - s / 2, s, s)
        }
        c.globalAlpha = 1
      }

      c.restore()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
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

        {/* the skill forms under the bar then drops with physics (canvas) */}
        <canvas ref={canvasRef} className="drop-canvas" aria-hidden="true" />

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
  ['gravity', 'gravity', 0.05, 1.4, 0.05, ''],
  ['bounce', 'bounce', 0, 0.85, 0.05, ''],
  ['dropMs', 'drop delay', 0, 1000, 10, 'ms'],
  ['fallSpeed', 'fall speed', 0.3, 2, 0.05, ''],
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
