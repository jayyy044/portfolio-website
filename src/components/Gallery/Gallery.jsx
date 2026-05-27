import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import './Gallery.css'

const PER_PAGE = 6
// placeholder "images" — each gets a varied warm highlight position so they
// look distinct. Swap the gradient for an <img> when real images exist.
const IMAGES = Array.from({ length: 12 }, (_, i) => ({
  id: i + 1,
  px: `${((i * 29) % 80) + 10}%`,
  py: `${((i * 53) % 70) + 10}%`,
}))

export default function Gallery() {
  const [page, setPage] = useState(0)
  const [open, setOpen] = useState(null) // global index or null

  const pages = Math.ceil(IMAGES.length / PER_PAGE)
  const start = page * PER_PAGE
  const visible = IMAGES.slice(start, start + PER_PAGE)

  // keep the page in sync when paging through the lightbox
  useEffect(() => {
    if (open !== null) setPage(Math.floor(open / PER_PAGE))
  }, [open])

  // keyboard: Esc to close, arrows to navigate the lightbox
  useEffect(() => {
    if (open === null) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(null)
      else if (e.key === 'ArrowRight') setOpen((o) => (o + 1) % IMAGES.length)
      else if (e.key === 'ArrowLeft')
        setOpen((o) => (o - 1 + IMAGES.length) % IMAGES.length)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const tint = (i) => ({ '--px': IMAGES[i].px, '--py': IMAGES[i].py })
  const num = (i) => String(IMAGES[i].id).padStart(2, '0')

  return (
    <div className="gallery">
      <div className="gallery-grid" key={page}>
        {visible.map((img, li) => {
          const gi = start + li
          return (
            <button
              type="button"
              className="shot"
              key={img.id}
              style={tint(gi)}
              onClick={() => setOpen(gi)}
              aria-label={`Open image ${img.id}`}
            >
              <span>{num(gi)}</span>
            </button>
          )
        })}
      </div>

      {pages > 1 && (
        <div className="gallery-pager">
          <button
            type="button"
            className="pager-btn"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={page === 0}
            aria-label="Previous images"
          >
            ‹
          </button>
          <span className="pager-count">
            {page + 1} / {pages}
          </span>
          <button
            type="button"
            className="pager-btn"
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={page === pages - 1}
            aria-label="Next images"
          >
            ›
          </button>
        </div>
      )}

      {open !== null &&
        createPortal(
          <div className="lightbox" onClick={() => setOpen(null)}>
            <button
              className="lb-close"
              onClick={() => setOpen(null)}
              aria-label="Close"
            >
              ✕
            </button>
            <button
              className="lb-nav prev"
              onClick={(e) => {
                e.stopPropagation()
                setOpen((o) => (o - 1 + IMAGES.length) % IMAGES.length)
              }}
              aria-label="Previous image"
            >
              ‹
            </button>
            <figure className="lb-frame" onClick={(e) => e.stopPropagation()}>
              <div className="lb-img" style={tint(open)}>
                <span>{num(open)}</span>
              </div>
              <figcaption>
                Image {num(open)} / {IMAGES.length}
              </figcaption>
            </figure>
            <button
              className="lb-nav next"
              onClick={(e) => {
                e.stopPropagation()
                setOpen((o) => (o + 1) % IMAGES.length)
              }}
              aria-label="Next image"
            >
              ›
            </button>
          </div>,
          document.body
        )}
    </div>
  )
}
