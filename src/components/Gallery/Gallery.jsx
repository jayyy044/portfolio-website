import { useCallback, useEffect, useRef, useState } from 'react'
import './Gallery.css'

const DELAY = 5000 // autoplay: ms per photo
const STEP_DEG = 26 // degrees of dial turn per photo

// real photos shown on the camera screen, in order
const PHOTOS = [
  '/demo-cool.jpg',
  '/demopic.jpg',
  '/dsc03132.jpg',
  '/dsc02991.jpg',
  '/dsc03005.jpg',
  '/dsc03054.jpg',
]
const COUNT = PHOTOS.length
const SLIDES = PHOTOS.map((src, i) => ({ n: String(i + 1).padStart(2, '0'), src }))

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
              <div className="cam-slide" key={s.n}>
                <img className="cam-photo" src={s.src} alt="" draggable="false" />
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
