import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { SKILLS } from './skillLogos'
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
const SKILL_W = 100 // hexagon width (px) — height derived pointy-top
const SKILL_H = SKILL_W * 1.15
const POKE_DX = 0 // fine-tune: shift the bar disturbance left/right (px)
const SKILL_DX = 0 // fine-tune: shift the skill under the visible disturbance (px)
const FORM_START_DY = 24 // skill starts this far under the bar centre
const FORM_END_DY = 70 // …slides down to here while fading in, then drops
const CONTAINER_FRAC = 0.9 // width of the (centred) container the skills pile in
const SPAWN_EVERY = 22 // frames between drops (low → more falling at once)
const COLLIDE_ITERS = 4 // collision-resolution passes per frame (stable stacking)
const ZONES = [0.2, 0.8, 0.5] // left / right / middle — cycled so drops spread out
const FLOOR_GAP = 15 // skills stop this many px above the "— SKILLS" label
const MUTED = false // TEST: flat ember-monochrome logos (like the main branch)
const EMBER = '#ff6f1a'

export default function Skills() {
  const sectionRef = useRef(null)
  const stripRef = useRef(null)
  const sprayRef = useRef(null)
  const canvasRef = useRef(null)
  const tipRef = useRef(null) // hover tooltip showing the skill's name
  const readyRef = useRef(false) // true once the bar has revealed + start delay
  const pokesRef = useRef([]) // active bar disturbances — one per skill forming
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

        const pokes = pokesRef.current // 0+ active disturbances (one per forming skill)
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
        // spawn ascii at EACH active disturbance, flying out horizontally
        for (let k = 0; k < pokes.length; k++) {
          const pk = pokes[k]
          for (let s = 0; s < flow; s++) {
            const dir = Math.random() < 0.5 ? 0 : Math.PI
            const spread = (Math.random() - 0.5) * 0.9 // ±~0.45 rad vertical fan
            const ang = dir + spread
            const spd = speed * (0.5 + Math.random())
            particles.push({
              x: pk.col + Math.cos(ang) * 0.8,
              y: pk.row + (Math.sin(ang) * 0.8) / aspect,
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
            for (let k = 0; k < pokes.length; k++) {
              const pk = pokes[k]
              const vdx = x - pk.col
              const vdy = (y - pk.row) * aspect // circular on screen
              const dist = Math.sqrt(vdx * vdx + vdy * vdy)
              if (dist < R) {
                // pull the SOURCE inward → content appears shoved outward (void)
                const srcDist = dist - strength * (1 - dist / R)
                if (srcDist <= 0.6) {
                  idx = 0 // the parted void
                } else {
                  const nx = vdx / dist
                  const ny = vdy / dist
                  let sx = Math.round(pk.col + nx * srcDist)
                  let sy = Math.round(pk.row + (ny * srcDist) / aspect)
                  sx = sx < 0 ? 0 : sx >= cols ? cols - 1 : sx
                  sy = sy < 0 ? 0 : sy >= ROWS ? ROWS - 1 : sy
                  idx = grid[sy][sx]
                }
                break // first disturbance covering this cell wins
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
          once: true, // play ONCE per page load — refresh to replay (no re-trigger)
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

    // pre-render an ember-monochrome silhouette of a logo (matches main branch)
    const makeTint = (img) => {
      const S = 128
      const oc = document.createElement('canvas')
      oc.width = S
      oc.height = S
      const octx = oc.getContext('2d')
      const ar = img.naturalWidth / img.naturalHeight || 1
      const dw = ar >= 1 ? S : S * ar
      const dh = ar >= 1 ? S / ar : S
      octx.drawImage(img, (S - dw) / 2, (S - dh) / 2, dw, dh)
      octx.globalCompositeOperation = 'source-atop' // recolour the logo's pixels
      octx.fillStyle = EMBER
      octx.fillRect(0, 0, S, S)
      return oc
    }
    // preload every skill logo once; each drop picks one
    const logos = SKILLS.map((s) => {
      const img = new Image()
      img.onload = () => {
        if (MUTED) img._tint = makeTint(img)
      }
      img.src = s.url
      return img
    })

    let W = 0
    let H = 0
    let barY = 0
    let groundY = 0
    let wallL = 0
    let wallR = 0
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
      // floor = 15px above the "— SKILLS" label, so the pile rests just over it
      const label = card.querySelector('.skills-label')
      groundY = (label ? label.offsetTop : H - 30) - FLOOR_GAP
      const cw = W * CONTAINER_FRAC
      wallL = (W - cw) / 2 // centred container walls
      wallR = (W + cw) / 2
    }
    size()
    const ro = new ResizeObserver(size)
    ro.observe(card)

    const R = SKILL_H / 2
    const balls = [] // every skill, persists once dropped (they pile up + stay)
    let lines = []
    const order = (() => {
      const a = SKILLS.map((_, i) => i)
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    })()
    let spawnIdx = 0
    let spawnT = 0
    let raf = 0
    const mouse = { x: 0, y: 0, on: false } // re-evaluated each frame for hover

    const spawn = () => {
      const cw = wallR - wallL
      // cycle left → right → middle (with jitter) so the drops spread across
      const z = ZONES[spawnIdx % ZONES.length]
      const jitter = (Math.random() - 0.5) * cw * 0.24
      let x = wallL + z * cw + jitter
      x = Math.max(wallL + R, Math.min(wallR - R, x)) // keep inside the walls
      const { padL, charW } = metaRef.current
      const poke = { col: (x + POKE_DX - padL) / charW, row: (ROWS - 1) / 2 }
      pokesRef.current.push(poke)
      const si = order[spawnIdx % order.length]
      balls.push({
        x: x + SKILL_DX,
        y: barY + FORM_START_DY,
        startY: barY + FORM_START_DY,
        restY: barY + FORM_END_DY,
        vx: 0,
        vy: 0,
        r: R,
        logo: logos[si],
        label: SKILLS[si].label,
        phase: 'form',
        formA: 0,
        formT: 0,
        poke,
      })
      spawnIdx++
    }

    const loop = () => {
      const dt = 1
      const ts = cfgRef.current.fallSpeed
      const GRAV = cfgRef.current.gravity
      const REST = cfgRef.current.bounce
      c.clearRect(0, 0, W, H)

      // keep dropping at random spots until every skill has fallen — then they stay
      if (readyRef.current && spawnIdx < order.length) {
        spawnT += dt
        if (spawnT >= SPAWN_EVERY) {
          spawnT = 0
          spawn()
        }
      }

      // form: each skill slides down from the bar + fades in, then becomes a body
      for (const b of balls) {
        if (b.phase !== 'form') continue
        b.formT += dt
        const dur = Math.max(1, cfgRef.current.dropMs / (1000 / 60))
        const p = Math.min(1, b.formT / dur)
        b.formA = p
        const e = 1 - Math.pow(1 - p, 3)
        b.y = b.startY + (b.restY - b.startY) * e
        if (p >= 1) {
          b.phase = 'fall'
          b.vy = 0
          const i = pokesRef.current.indexOf(b.poke) // release its disturbance
          if (i >= 0) pokesRef.current.splice(i, 1)
        }
      }

      // physics for the dropping/settled skills
      const active = balls.filter((b) => b.phase !== 'form')
      for (const b of active) {
        b.vy += GRAV * ts
        b.x += b.vx * ts
        b.y += b.vy * ts
        if (b.x - b.r < wallL) {
          b.x = wallL + b.r
          b.vx = -b.vx * REST
        }
        if (b.x + b.r > wallR) {
          b.x = wallR - b.r
          b.vx = -b.vx * REST
        }
        if (b.y + b.r > groundY) {
          b.y = groundY - b.r
          if (b.vy > 0) b.vy = -b.vy * REST
          b.vx *= 0.9 // floor friction → they settle instead of sliding forever
        }
      }
      // ball-to-ball collisions — separate + impulse so they stack and stumble
      for (let it = 0; it < COLLIDE_ITERS; it++) {
        for (let i = 0; i < active.length; i++) {
          for (let j = i + 1; j < active.length; j++) {
            const a = active[i]
            const b = active[j]
            let dx = b.x - a.x
            let dy = b.y - a.y
            let d = Math.hypot(dx, dy)
            const min = a.r + b.r
            if (d === 0) {
              d = 0.01
              dx = 0.01
              dy = 0
            }
            if (d < min) {
              const nx = dx / d
              const ny = dy / d
              const overlap = (min - d) / 2
              a.x -= nx * overlap
              a.y -= ny * overlap
              b.x += nx * overlap
              b.y += ny * overlap
              const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny
              if (vn < 0) {
                const jimp = (-(1 + REST) * vn) / 2
                a.vx -= jimp * nx
                a.vy -= jimp * ny
                b.vx += jimp * nx
                b.vy += jimp * ny
              }
            }
          }
        }
        for (const b of active) {
          if (b.x - b.r < wallL) b.x = wallL + b.r
          if (b.x + b.r > wallR) b.x = wallR - b.r
          if (b.y + b.r > groundY) b.y = groundY - b.r
        }
      }
      for (const b of active) {
        b.vx *= 0.99
        b.vy *= 0.999
      }

      // straight speed lines on the fast-falling ones
      lines = lines.filter((l) => l.life > 0)
      lines.forEach((l) => {
        l.life -= dt
      })
      for (const b of active) {
        if (b.vy > 4 && Math.random() < b.vy / 16) {
          const side = Math.random() < 0.5 ? -1 : 1
          lines.push({
            x: b.x + side * (b.r + 2 + Math.random() * 10),
            y: b.y - 8 + Math.random() * 24,
            len: 16 + Math.random() * 22 + b.vy * 0.5,
            life: 14,
            max: 14,
          })
        }
      }
      lines.forEach((l) => {
        const a = (l.life / l.max) * 0.45
        c.beginPath()
        c.moveTo(l.x, l.y)
        c.lineTo(l.x, l.y + l.len)
        c.strokeStyle = `rgba(255,220,170,${a})`
        c.lineWidth = 1.3
        c.lineCap = 'round'
        c.stroke()
      })

      // draw every skill (hexagon + full-colour logo)
      for (const b of balls) {
        c.globalAlpha = b.formA
        c.beginPath()
        for (let i = 0; i < 6; i++) {
          const ang = (Math.PI / 3) * i - Math.PI / 2
          const px = b.x + b.r * Math.cos(ang)
          const py = b.y + b.r * Math.sin(ang)
          if (i) c.lineTo(px, py)
          else c.moveTo(px, py)
        }
        c.closePath()
        c.fillStyle = 'rgba(255,111,26,0.05)'
        c.fill()
        c.strokeStyle = 'rgba(255,111,26,0.5)'
        c.lineWidth = 1.4
        c.stroke()
        const lg = b.logo
        const box = b.r * 1.1
        if (MUTED && lg && lg._tint) {
          c.drawImage(lg._tint, b.x - box / 2, b.y - box / 2, box, box)
        } else if (lg && lg.complete && lg.naturalWidth) {
          const ar = lg.naturalWidth / lg.naturalHeight
          const dw = ar >= 1 ? box : box * ar
          const dh = ar >= 1 ? box / ar : box
          c.drawImage(lg, b.x - dw / 2, b.y - dh / 2, dw, dh)
        }
        c.globalAlpha = 1
      }

      // hover → name tooltip. Re-checked EVERY frame against live positions, so
      // the label follows / clears as skills move (never frozen mid-air), and we
      // only label SETTLED skills (skip ones still falling).
      const tip = tipRef.current
      if (tip) {
        let hit = null
        if (mouse.on) {
          for (let i = balls.length - 1; i >= 0; i--) {
            const b = balls[i] // topmost (last-drawn) first
            if (b.formA < 0.6) continue
            if (Math.abs(b.vx) + Math.abs(b.vy) > 0.8) continue // still moving → skip
            if ((mouse.x - b.x) ** 2 + (mouse.y - b.y) ** 2 <= b.r * b.r) {
              hit = b
              break
            }
          }
        }
        if (hit) {
          tip.textContent = hit.label
          tip.style.left = `${hit.x}px`
          tip.style.top = `${hit.y - hit.r - 6}px`
          tip.style.opacity = '1'
          canvas.style.cursor = 'pointer'
        } else {
          tip.style.opacity = '0'
          canvas.style.cursor = 'default'
        }
      }

      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)

    // the handlers only record the cursor; the loop does the hit-test
    const onMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left
      mouse.y = e.clientY - rect.top
      mouse.on = true
    }
    const onLeave = () => {
      mouse.on = false
    }
    canvas.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
      pokesRef.current = []
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
        {/* hover tooltip — shows the skill's name (canvas hit-test fills it) */}
        <div ref={tipRef} className="skill-tip" aria-hidden="true" />

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
