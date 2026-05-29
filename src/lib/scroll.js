// Shared Lenis access: the App owns the single Lenis instance and registers it
// here so the Navbar can drive smooth section jumps and the custom ScrollBar can
// follow scroll progress, without prop-drilling the instance everywhere.

let lenis = null
const listeners = new Set()

export function registerLenis(instance) {
  lenis = instance
  if (!instance) return
  instance.on('scroll', () => {
    for (const fn of listeners) fn(instance)
  })
}

// subscribe to scroll ticks (the custom scrollbar uses this); returns an unsub
export function onLenisScroll(fn) {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

// ── KNOBS: how a nav click glides to a section ────────────────────────────────
export const SCROLL = {
  duration: 3.4, // seconds the glide takes (bigger = slower, more luxurious)
  easing: 'easeOutCubic', // motion curve — pick any key from EASINGS below
  // About lives in the pinned hero and only finishes expanding near the end of
  // the pin; land this many vh shy of where the hero unpins so the bento is
  // fully open + dead-center on arrival (raise it to settle a touch earlier).
  aboutSettleVh: 0.03,
}

// motion curves, t in [0,1] -> eased [0,1]. swap SCROLL.easing to one of these.
const EASINGS = {
  linear: (t) => t,
  easeOutCubic: (t) => 1 - Math.pow(1 - t, 3),
  easeOutQuint: (t) => 1 - Math.pow(1 - t, 5),
  easeOutExpo: (t) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
}

export function scrollToSection(name) {
  if (!lenis) return
  const easing = EASINGS[SCROLL.easing] ?? EASINGS.easeOutCubic
  const opts = { duration: SCROLL.duration, easing }

  if (name === 'about') {
    const pin = document.querySelector('.hero-pin')
    if (!pin) return
    // the sticky hero unpins at (pin bottom − one viewport); settle just before
    // that so the bento has finished its width animation and is centered.
    const release = pin.offsetTop + pin.offsetHeight - window.innerHeight
    lenis.scrollTo(release - window.innerHeight * SCROLL.aboutSettleVh, opts)
    return
  }

  // any other section: scroll to an element with that id (none wired yet)
  const el = document.getElementById(name)
  if (el) lenis.scrollTo(el, opts)
}
