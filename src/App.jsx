import { useEffect } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'

import Atmosphere from './components/Atmosphere/Atmosphere'
import Background from './components/Background/Background'
import Navbar from './components/Navbar/Navbar'
import Hero from './components/Hero/Hero'

gsap.registerPlugin(ScrollTrigger)

export default function App() {
  useEffect(() => {
    // smooth-scroll (inertia on the wheel) + drive ScrollTrigger from it
    const lenis = new Lenis({ duration: 1.2, smoothWheel: true })
    lenis.on('scroll', ScrollTrigger.update)
    const add = (time) => lenis.raf(time * 1000)
    gsap.ticker.add(add)
    gsap.ticker.lagSmoothing(0)
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
    </>
  )
}
