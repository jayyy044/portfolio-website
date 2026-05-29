import { useEffect, useRef } from 'react'
import { onLenisScroll } from '../../lib/scroll'
import './ScrollBar.css'

// how long after the last scroll tick before the bar fades back to invisible
const IDLE_MS = 800
// shortest the thumb is allowed to get on very long pages (px)
const MIN_THUMB = 36

export default function ScrollBar() {
  const trackRef = useRef(null)
  const thumbRef = useRef(null)
  const idle = useRef(null)

  useEffect(() => {
    const unsub = onLenisScroll((lenis) => {
      const track = trackRef.current
      const thumb = thumbRef.current
      if (!track || !thumb) return

      const winH = window.innerHeight
      const limit = lenis.limit || 0 // max scroll distance
      const thumbH = Math.max((winH / (limit + winH)) * winH, MIN_THUMB)
      const top = limit > 0 ? (lenis.scroll / limit) * (winH - thumbH) : 0

      thumb.style.height = `${thumbH}px`
      thumb.style.transform = `translateY(${top}px)`

      // reveal while scrolling, then fade out once motion settles
      track.classList.add('on')
      clearTimeout(idle.current)
      idle.current = setTimeout(() => track.classList.remove('on'), IDLE_MS)
    })

    return () => {
      unsub()
      clearTimeout(idle.current)
    }
  }, [])

  return (
    <div className="scrollbar" ref={trackRef} aria-hidden="true">
      <div className="scrollbar-thumb" ref={thumbRef} />
    </div>
  )
}
