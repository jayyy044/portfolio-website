import Globe from '../Globe/Globe'
import AsciiName from '../AsciiName/AsciiName'
import './Stage.css'

export default function Stage() {
  return (
    <div className="stage">
      <div className="composition">
        <div className="globe-wrap">
          <Globe />
        </div>
        <div className="orbit" />
        <div className="card">
          <div className="greet">Hi, my name is</div>
          <AsciiName />
        </div>
      </div>
    </div>
  )
}
