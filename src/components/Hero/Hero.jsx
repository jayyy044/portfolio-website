import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Stage from '../Stage/Stage'
import Bento from '../Bento/Bento'
import Blob from '../Blob/Blob'
import './Hero.css'

gsap.registerPlugin(ScrollTrigger)

/* ── Flip this to false to disable the blob shader background (to A/B it). ── */
const SHOW_BLOB = false

export default function Hero() {
  const pinRef = useRef(null)

  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.hero-pin',
          start: 'top top',
          // the scrub finishes the expansion partway through the pin; the CSS
          // sticky keeps the bento centered for the REST of the pin, so it sits
          // fully expanded (the "dwell") before it scrolls off.
          end: '+=75%',
          // rigidly tied to scroll position (no catch-up lag) so the bento is
          // never still "growing" after its scroll point — Lenis smooths scroll
          scrub: true,
        },
      })
      // globe + name fade/scale out first (quick), content already rendered
      tl.to('.hero-globe', { opacity: 0, scale: 0.9, duration: 0.3 }, 0)
      // the blob shader background fades in together with the bento
      if (SHOW_BLOB) tl.to('.blob-layer', { opacity: 1, duration: 1 }, 0)
      // the two tiles grow from the middle and fade in (done by the scrub end)
      tl.to('.bento', { gap: '32px', duration: 1 }, 0)
        .to(
          '.tile.left',
          { width: '46%', xPercent: 0, opacity: 1, borderRadius: 16, duration: 1 },
          0
        )
        .to(
          '.tile.right',
          { width: '46%', xPercent: 0, opacity: 1, borderRadius: 16, duration: 1 },
          0
        )
    }, pinRef)

    return () => ctx.revert()
  }, [])

  return (
    <section className="hero-pin" ref={pinRef}>
      <div className="hero-sticky">
        {SHOW_BLOB && <Blob />}
        <div className="hero-globe">
          <Stage />
        </div>
        <Bento />
      </div>
    </section>
  )
}
