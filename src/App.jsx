import Hero from './components/Hero/Hero'

// Everything else (Atmosphere, Background, Navbar, ScrollBar, Skills, the old
// Stage/Bento/Blob hero + Lenis/GSAP scroll wiring) is intentionally
// disconnected — the page shows only the orbital hero for now.
export default function App() {
  return <Hero />
}
