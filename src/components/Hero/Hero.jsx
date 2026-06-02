import OrbitScene from './OrbitScene'
import HeroNav from './HeroNav'
import HeroHud from './HeroHud'
import './Hero.css'

export default function Hero() {
  return (
    <>
      <div className="hero">
        <OrbitScene />
        <div className="grain" />
        <div className="reticle" />
        <HeroNav />
        <HeroHud />
      </div>
      {/* in-flow spacer gives the fixed hero room to scroll, which drives the
          haze bloom (the hero itself stays pinned to the viewport) */}
      <div className="hero-scroll-space" aria-hidden="true" />
    </>
  )
}
