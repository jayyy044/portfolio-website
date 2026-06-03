import OrbitScene from './OrbitScene'
import HeroNav from './HeroNav'
import HeroHud from './HeroHud'
import './Hero.css'

export default function Hero() {
  return (
    <div className="hero">
      <OrbitScene />
      <div className="grain" />
      <div className="reticle" />
      <HeroNav />
      <HeroHud />
    </div>
  )
}
