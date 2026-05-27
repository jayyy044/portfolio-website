import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

import Atmosphere from './components/Atmosphere/Atmosphere'
import Background from './components/Background/Background'
import Navbar from './components/Navbar/Navbar'
import Hero from './components/Hero/Hero'
import Skills from './components/Skills/Skills'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  useEffect(() => {
    // smooth-scroll (inertia on the wheel) + drive ScrollTrigger from it
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const add = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(add)
    gsap.ticker.lagSmoothing(0)

    // Layout shifts strand ScrollTrigger start/end positions (the trigger keeps
    // firing at where an element *used to be*), which silently hides reveals.
    // Recompute after the mono font loads (it changes element heights)...
    document.fonts?.ready.then(() => ScrollTrigger.refresh())
    // ...and after every Vite HMR update — a CSS-only edit doesn't re-run the
    // GSAP effects, so without this a padding/timing tweak leaves triggers stale.
    if (import.meta.hot) {
      import.meta.hot.on('vite:afterUpdate', () => ScrollTrigger.refresh())
    }

    return () => {
      gsap.ticker.remove(add)
      lenis.destroy()
    }
  }, [])

  return (
    <>
      <Atmosphere />
      <Background />

      <Navbar />

      <Hero />
      <Skills />
    </>
  )
}
