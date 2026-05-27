import { useEffect, useLayoutEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { TECH } from './techIcons'
import './Skills.css'

gsap.registerPlugin(ScrollTrigger)

// the same ramp the source uses for the MAANAS glitch (dark → bright)
const RAMP = ' .,-:;!=*#@'
const ROWS = 6 // height of the band, in character rows
const FPS = 20 // glitch refresh rate (choppy = glitchy)
const CHURN = 0.4 // fraction of cells re-randomised each frame
const BIAS = 1.5 // >1 leans toward the sparse end of the ramp (distortion, not static)

// ── honeycomb layout knobs ──────────────────────────────────────────────
const HEX_RATIO = 1.15 // pointy-top hex height / width
const COL_TARGET = 110 // ~px per column; smaller = more, tinier hexes (→3 rows)
const ROW_OVERLAP = 0.75 // vertical step as a fraction of hex height (interlock)

// ── drip / physics knobs ────────────────────────────────────────────────
const DRIP_EACH = 0.07 // stagger between hexes dripping out (s)
const DRIP_LEAD = 0.14 // how long the bloom builds before the hex emerges (s)
const BLOOM_R = 7.5 // radial bloom radius on the bar, in band columns
const BLOOM_MS = 560 // how long each bloom lives (ms)
const FALL_DUR = 1.15 // fall + bounce duration (s)

export default function Skills() {
  const sectionRef = useRef(null)
  const stripRef = useRef(null)
  const gridRef = useRef(null)
  // shared between effects: live blooms on the bar, band metrics, hex slots
  const dripsRef = useRef([])
  const metaRef = useRef({ cols: 0 })
  const slotsRef = useRef([])

  // the isolated distortion band (now with radial blooms where hexes drip out)
  useEffect(() => {
    const el = stripRef.current
    let cols = 0
    let grid = []
    let raf = 0
    let last = 0
    const frameMs = 1000 / FPS
    const randIdx = () => Math.floor(Math.pow(Math.random(), BIAS) * RAMP.length)

    const build = () => {
      const cs = getComputedStyle(el)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      // MEASURE the real glyph advance instead of assuming 0.6em — Geist Mono is
      // narrower than that, which under-counted columns and left a gap on the
      // right. Render a known run of chars in the band's own font and divide.
      const meas = document.createElement('span')
      meas.textContent = '0'.repeat(200)
      meas.style.cssText =
        `position:absolute;visibility:hidden;white-space:pre;` +
        `font-family:${cs.fontFamily};font-size:${cs.fontSize};` +
        `letter-spacing:${cs.letterSpacing}`
      el.appendChild(meas)
      const charW = meas.getBoundingClientRect().width / 200 || 6.6
      el.removeChild(meas)
      // Overshoot by a few columns so the line ALWAYS runs past the right edge,
      // then overflow:hidden clips it flush. This can't come up short the way an
      // exact column count can if the measured advance is off by a hair.
      cols = Math.max(1, Math.ceil((el.clientWidth - padX) / charW) + 6)
      metaRef.current.cols = cols
      grid = Array.from({ length: ROWS }, () =>
        Array.from({ length: cols }, randIdx)
      )
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(el)

    const centerRow = (ROWS - 1) / 2
    const tick = (t) => {
      if (t - last >= frameMs) {
        last = t
        const tnow = performance.now()
        // prune dead blooms
        const drips = dripsRef.current
        if (drips.length)
          dripsRef.current = drips.filter((d) => tnow - d.t0 <= BLOOM_MS)
        const live = dripsRef.current

        let out = ''
        for (let y = 0; y < ROWS; y++) {
          const row = grid[y]
          let line = ''
          for (let x = 0; x < cols; x++) {
            if (Math.random() < CHURN) row[x] = randIdx()
            let chIdx = row[x]
            // radial bloom: brighten + radiate outward at each active drip point
            for (let k = 0; k < live.length; k++) {
              const d = live[k]
              const age = (tnow - d.t0) / BLOOM_MS // 0..1
              const r = BLOOM_R * (1 - Math.pow(1 - age, 3)) // easeOut growth
              const dx = x - d.col
              const dyl = (y - centerRow) * 2.2 // char cells are tall → scale Y
              const dist = Math.sqrt(dx * dx + dyl * dyl)
              if (dist < r) {
                const intensity = (1 - dist / r) * (1 - age * 0.4)
                const bright = RAMP.length - 1 - Math.floor((1 - intensity) * 5)
                if (bright > chIdx) chIdx = Math.max(0, Math.min(RAMP.length - 1, bright))
              }
            }
            line += RAMP[chIdx]
          }
          out += line + '\n'
        }
        el.textContent = out
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [])

  // honeycomb positioning — compute each hexagon's slot, plus the y-offset that
  // places it up at the bar (its drip origin) and the bar column it drips from.
  useLayoutEffect(() => {
    const grid = gridRef.current
    const card = grid.closest('.skills-card')
    const band = card.querySelector('.distortion')
    const hexes = Array.from(grid.querySelectorAll('.hex'))

    const layout = () => {
      const W = grid.clientWidth
      if (!W) return
      const cols = Math.max(5, Math.round(W / COL_TARGET))
      const hStep = W / (cols + 0.5) // half-col spare for the odd-row offset
      const hexW = hStep * 0.96
      const hexH = hexW * HEX_RATIO
      const vStep = hexH * ROW_OVERLAP

      // bar centre + grid origin in CARD coordinates (for the drip start)
      const bandCenterY = band.offsetTop + band.offsetHeight / 2
      const gridTop = grid.offsetTop
      const gridLeft = grid.offsetLeft
      const cardW = card.clientWidth

      const rows = Math.ceil(hexes.length / cols)
      const base = Math.floor(hexes.length / rows)
      const extra = hexes.length % rows
      const counts = Array.from({ length: rows }, (_, r) =>
        r < extra ? base + 1 : base
      )

      const slots = []
      let idx = 0
      let bottom = 0
      for (let r = 0; r < rows; r++) {
        const count = counts[r]
        const rowW = (count - 1) * hStep + hexW
        // keep the interlocked block centered: phase alternate rows ±¼ step
        const phase = (r % 2 ? 1 : -1) * (hStep / 4)
        const x0 = (W - rowW) / 2 + phase
        const y = r * vStep
        for (let c = 0; c < count; c++, idx++) {
          const left = x0 + c * hStep
          const el = hexes[idx]
          el.style.width = `${hexW}px`
          el.style.height = `${hexH}px`
          el.style.left = `${left}px`
          el.style.top = `${y}px`
          // drip start: lift the hex up so it begins at the bar, falls to slot
          const slotCenterY = gridTop + y + hexH / 2
          const centerXfrac = (gridLeft + left + hexW / 2) / cardW
          slots[idx] = { startY: bandCenterY - slotCenterY, frac: centerXfrac }
        }
        bottom = y + hexH
      }
      grid.style.height = `${bottom}px`
      slotsRef.current = slots
    }

    layout()
    const ro = new ResizeObserver(layout)
    ro.observe(grid)
    return () => ro.disconnect()
  }, [])

  // reveal + drip: card slides up, the band blooms in, then each hexagon blooms
  // a radial distortion on the bar and drips out of it, falling with weight.
  useEffect(() => {
    const ctx = gsap.context(() => {
      const hexes = gsap.utils.toArray('.hex')
      const order = gsap.utils.shuffle(hexes.map((_, i) => i)) // organic order

      const pushBloom = (i) => {
        const s = slotsRef.current[i]
        if (!s) return
        dripsRef.current.push({
          col: Math.round(s.frac * metaRef.current.cols),
          t0: performance.now(),
        })
      }

      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.skills-card',
          start: 'top 75%',
          toggleActions: 'restart none none reset',
        },
      })
      // the card slides up into place (no grow-from-centre, no fade)
      tl.from('.skills-card', { y: 70, duration: 0.9, ease: 'power3.out' })
        // the distortion band fades in from the centre outwards
        .fromTo(
          '.distortion',
          { clipPath: 'inset(0% 50% 0% 50%)', opacity: 0 },
          {
            clipPath: 'inset(0% 0% 0% 0%)',
            opacity: 1,
            duration: 0.8,
            ease: 'power2.out',
          },
          '-=0.4'
        )

      // each hexagon: a bloom forms on the bar, then it drips out and falls with
      // a real bounce + a roll that settles (weight).
      const dripStart = tl.duration() - 0.1
      order.forEach((hi, k) => {
        const hex = hexes[hi]
        const s = slotsRef.current[hi] || { startY: -140 }
        const at = dripStart + k * DRIP_EACH
        // 1) bloom on the bar at this hex's column
        tl.call(pushBloom, [hi], at)
        // 2) drip + fall + bounce (starts after the bloom has begun radiating)
        tl.fromTo(
          hex,
          { y: s.startY },
          { y: 0, duration: FALL_DUR, ease: 'bounce.out' },
          at + DRIP_LEAD
        )
        // 3) materialise as it comes down
        tl.fromTo(
          hex,
          { opacity: 0, scale: 0.45 },
          { opacity: 1, scale: 1, duration: 0.45, ease: 'power2.out' },
          at + DRIP_LEAD
        )
        // 4) roll/tumble that settles upright (weight on landing)
        tl.fromTo(
          hex,
          { rotation: gsap.utils.random(-40, 40) },
          { rotation: 0, duration: FALL_DUR * 0.85, ease: 'back.out(2)' },
          at + DRIP_LEAD
        )
      })
    }, sectionRef)
    return () => ctx.revert()
  }, [])

  return (
    <section className="skills-section" ref={sectionRef}>
      <article className="skills-card">
        {/* heading on top, like the About / Gallery tiles */}
        <div className="skills-head">
          <div className="skills-top">
            <span>~/skills</span>
          </div>
          <h3>Skills &amp; Technologies</h3>
        </div>

        {/* isolated glitch/distortion band, below the heading, full width */}
        <pre ref={stripRef} className="distortion" aria-hidden="true" />

        {/* the honeycomb of tech hexagons that drip out of the distortion */}
        <div ref={gridRef} className="hexgrid">
          {TECH.map((t) => (
            <div className="hex" key={t.label} data-label={t.label}>
              <svg className="hex-svg" viewBox="0 0 100 115" aria-hidden="true">
                <polygon
                  className="hex-cell"
                  points="50,1.5 98,29.5 98,85.5 50,113.5 2,85.5 2,29.5"
                />
                {t.path ? (
                  <g
                    className="hex-glyph"
                    transform="translate(29.5,36) scale(1.71)"
                  >
                    <path d={t.path} />
                  </g>
                ) : (
                  <text
                    className="hex-text"
                    x="50"
                    y="61"
                    textAnchor="middle"
                    dominantBaseline="middle"
                  >
                    {t.text}
                  </text>
                )}
              </svg>
              <span className="hex-name">{t.label}</span>
            </div>
          ))}
        </div>

        <span className="skills-label">— SKILLS</span>
      </article>
    </section>
  )
}
