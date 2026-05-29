import Gallery from '../Gallery/Gallery'
import './Bento.css'

export default function Bento() {
  return (
    <div className="bento">
      {/* LEFT — About Me */}
      <article className="tile left">
        <div className="tile-content">
          <div className="tile-top">
            <span>~/about.md</span>
          </div>
          <h3>About Me</h3>
          <p>
            Placeholder bio. Software engineer who likes building strange,
            tactile things for the web — shaders, 3D, and tools that feel like
            native apps. Real copy goes here later.
          </p>
        </div>
        <span className="tile-label">— ABOUT ME</span>
      </article>

      {/* RIGHT — Picture Gallery */}
      <article className="tile right">
        <div className="tile-content">
          <div className="tile-top">
            <span>~/gallery</span>
          </div>
          <h3>Picture Gallery</h3>
          <p className="tile-cap">
            shot on <span>Sony Cybershot DSC-T100</span>
          </p>
          <Gallery />
        </div>
        <span className="tile-label">— PICTURE GALLERY</span>
      </article>
    </div>
  )
}
