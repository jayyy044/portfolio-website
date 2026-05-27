import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import './Skills.css'

gsap.registerPlugin(ScrollTrigger)

// the same ramp the source uses for the MAANAS glitch (dark → bright)
const RAMP = ' .,-:;!=*#@'
const ROWS = 6 // height of the band, in character rows
const FPS = 20 // glitch refresh rate (choppy = glitchy)
const CHURN = 0.4 // fraction of cells re-randomised each frame
const BIAS = 1.5 // >1 leans toward the sparse end of the ramp (distortion, not static)

export default function Skills() {
  const sectionRef = useRef(null)
  const stripRef = useRef(null)

  // the isolated distortion band
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
      const fontSize = parseFloat(cs.fontSize) || 11
      const charW = fontSize * 0.6 // monospace advance ≈ 0.6em
      cols = Math.max(1, Math.floor((el.clientWidth - padX) / charW))
      grid = Array.from({ length: ROWS }, () =>
        Array.from({ length: cols }, randIdx)
      )
    }
    build()
    const ro = new ResizeObserver(build)
    ro.observe(el)

    const tick = (t) => {
      if (t - last >= frameMs) {
        last = t
        let out = ''
        for (let y = 0; y < ROWS; y++) {
          const row = grid[y]
          let line = ''
          for (let x = 0; x < cols; x++) {
            if (Math.random() < CHURN) row[x] = randIdx()
            line += RAMP[row[x]]
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

  // reveal: a ONE-SHOT (not scrub-tied) that fires when the card reaches a set
  // scroll point and resets when scrolled back above, so it replays each pass.
  useEffect(() => {
    const ctx = gsap.context(() => {
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

        <span className="skills-label">— SKILLS</span>
      </article>
    </section>
  )
}
