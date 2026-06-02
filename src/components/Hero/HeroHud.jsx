import { useEffect, useRef } from 'react'

export default function HeroHud() {
  const hudRef = useRef(null)

  // staggered rise-in, matching the original `load` reveal. Runs once on mount
  // (the load event has usually already fired by the time React hydrates).
  useEffect(() => {
    const root = hudRef.current
    if (!root) return
    const els = root.querySelectorAll('.title .k,.title h1,.title .cap,.read')
    const anims = []
    els.forEach((el, i) => {
      el.style.opacity = 0
      const isRead = el.classList.contains('read')
      anims.push(
        el.animate(
          [
            { opacity: 0, transform: 'translateY(14px)' },
            { opacity: isRead ? 0.9 : 1, transform: 'translateY(0)' },
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

      <div className="read tl">
        CAM <b>ORBITAL</b>
        <br />
        ALT <b className="acc">412.0 KM</b>
        <br />
        LOCK <b>OBJECT-001</b>
      </div>
      <div className="read tr">
        SYS <b>NOMINAL</b>
        <br />
        REFRACTION <b className="acc">ACTIVE</b>
        <br />
        FoV <b>34.0°</b>
      </div>
      <div className="read bl">— DRAG-FREE / CURSOR PARALLAX —</div>
      <div className="read br">
        MMXXVI
        <br />
        <b>maanas@saxena.studio</b>
      </div>
    </div>
  )
}
