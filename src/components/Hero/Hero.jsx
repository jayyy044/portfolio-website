import './Hero.css'
import OrbitScene from '../OrbitScene/OrbitScene'
import HeroNav from '../HeroNav/HeroNav'
import HeroHud from '../HeroHud/HeroHud'

export default function Hero() {
  return (
    <div className="hero">
      <OrbitScene />
      <div className="grain" />
      <HeroNav />
      <HeroHud />
    </div>
  )
}
