import { useEffect, useRef } from 'react'

export default function HeroHud() {
  const hudRef = useRef(null)

  // staggered rise-in, matching the original `load` reveal. Runs once on mount
  // (the load event has usually already fired by the time React hydrates).
  useEffect(() => {
    const root = hudRef.current
    if (!root) return
    const els = root.querySelectorAll('.title .k,.title h1,.title .cap')
    const anims = []
    els.forEach((el, i) => {
      el.style.opacity = 0
      anims.push(
        el.animate(
          [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: 1, transform: 'translateY(0)' },
          ],
          {
            duration: 1100,
            delay: 250 + i * 120,
            easing: 'cubic-bezier(.16,1,.3,1)',
            fill: 'forwards',
          }
        )
      )
    })
    return () => anims.forEach((a) => a.cancel())
  }, [])

  return (
    <div className="hud" ref={hudRef}>
      <div className="title">
        <div className="k">Object 001 — viewed from orbit</div>
        <h1 className="corm">
          Maanas <em>Saxena</em>
        </h1>
        <div className="cap corm">
          Software engineer in the seam between code and the image.
        </div>
      </div>
    </div>
  )
}
