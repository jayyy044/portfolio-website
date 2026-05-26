import { useState } from 'react'
import './Navbar.css'

const LINKS = [
  { label: 'Experience', href: '#' },
  { label: 'About', href: '#' },
  { label: 'Projects', href: '#' },
]

export default function Navbar() {
  const [open, setOpen] = useState(false)

  return (
    <nav>
      <div className="brand">
        <span className="dot" />
        Maanas Saxena
      </div>

      {/* inline links — shown above 900px */}
      <ul className="links">
        {LINKS.map((l) => (
          <li key={l.label}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>

      {/* hamburger — shown at/below 900px */}
      <button
        type="button"
        className={`burger${open ? ' is-open' : ''}`}
        aria-label="Menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span />
        <span />
        <span />
      </button>

      {/* dropdown panel */}
      <ul className={`menu${open ? ' is-open' : ''}`}>
        {LINKS.map((l) => (
          <li key={l.label}>
            <a href={l.href} onClick={() => setOpen(false)}>
              {l.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}
