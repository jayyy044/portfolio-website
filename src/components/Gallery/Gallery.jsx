import { useCallback, useEffect, useRef, useState } from 'react'
import './Gallery.css'

const COUNT = 12
const DELAY = 5000 // autoplay: ms per photo
const STEP_DEG = 26 // degrees of dial turn per photo

// 12 placeholder slides — distinct warm gradients. Swap `bg` for an <img> later.
const SLIDES = Array.from({ length: COUNT }, (_, i) => {
  const px = ((i * 29) % 80) + 10
  const py = ((i * 53) % 70) + 10
  return {
    n: String(i + 1).padStart(2, '0'),
    bg:
      `radial-gradient(120% 120% at ${px}% ${py}%, rgba(255,150,60,0.55), transparent 60%),` +
      `linear-gradient(135deg, #3a281a, #120d0a)`,
  }
})
// first two slides show real photos; the rest stay placeholders for now
SLIDES[0] = { n: '01', src: '/demo-cool.jpg' }
SLIDES[1] = { n: '02', src: '/demopic.jpg' }

export default function Gallery() {
  const [index, setIndex] = useState(0)
  const wheelRef = useRef(null)
  const pausedRef = useRef(false)
  const draggingRef = useRef(false)
  const timerRef = useRef(null)
  const accRef = useRef(0)
  const lastAngleRef = useRef(0)

  // autoplay; restart the countdown after any manual move
  const startAuto = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (pausedRef.current || draggingRef.current) return
      setIndex((i) => (i + 1) % COUNT) // wraps 12 -> 1
    }, DELAY)
  }, [])

  useEffect(() => {
    startAuto()
    return () => clearInterval(timerRef.current)
  }, [startAuto])

  const go = useCallback((delta) => {
    setIndex((i) => Math.max(0, Math.min(COUNT - 1, i + delta)))
  }, [])

  const jump = (i) => {
    setIndex(i)
    startAuto()
  }

  // ---- drag the hidden wheel in a circle to scrub ----
  const angleAt = (e) => {
    const r = wheelRef.current.getBoundingClientRect()
    return (
      (Math.atan2(
        e.clientY - (r.top + r.height / 2),
        e.clientX - (r.left + r.width / 2)
      ) * 180) /
      Math.PI
    )
  }
  const onPointerDown = (e) => {
    draggingRef.current = true
    accRef.current = 0
    lastAngleRef.current = angleAt(e)
    wheelRef.current.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e) => {
    if (!draggingRef.current) return
    const a = angleAt(e)
    let d = a - lastAngleRef.current
    if (d > 180) d -= 360
    if (d < -180) d += 360
    accRef.current += d
    lastAngleRef.current = a
    while (accRef.current >= STEP_DEG) {
      go(1)
      accRef.current -= STEP_DEG
    }
    while (accRef.current <= -STEP_DEG) {
      go(-1)
      accRef.current += STEP_DEG
    }
  }
  const onPointerUp = (e) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    try {
      wheelRef.current.releasePointerCapture(e.pointerId)
    } catch {}
    startAuto()
  }

  const pause = () => {
    pausedRef.current = true
  }
  const resume = () => {
    pausedRef.current = false
  }

  return (
    <div className="gallery">
      <div className="cam-stage">
        <img className="cam-img" src="/camera.png" alt="" draggable="false" />

        <div className="cam-screen" onPointerEnter={pause} onPointerLeave={resume}>
          <div
            className="cam-track"
            style={{ transform: `translateX(${-index * 100}%)` }}
          >
            {SLIDES.map((s) => (
              <div
                className="cam-slide"
                key={s.n}
                style={s.bg ? { background: s.bg } : undefined}
              >
                {s.src ? (
                  <img className="cam-photo" src={s.src} alt="" draggable="false" />
                ) : (
                  <span>{s.n}</span>
                )}
              </div>
            ))}
          </div>

          <div className="cam-glass" aria-hidden="true" />

          <div className="cam-dots">
            {SLIDES.map((s, i) => (
              <button
                type="button"
                key={s.n}
                className={'cam-dot' + (i === index ? ' on' : '')}
                onClick={() => jump(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === index || undefined}
              />
            ))}
          </div>
        </div>

        <div
          ref={wheelRef}
          className="cam-wheel"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerEnter={pause}
          onPointerLeave={resume}
          aria-hidden="true"
        />
      </div>
    </div>
  )
}
