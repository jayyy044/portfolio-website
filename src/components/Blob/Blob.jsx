import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import './Blob.css'

const fragment = `
  precision highp float;
  uniform float uPhase;
  uniform vec2 uResolution;
  uniform vec3 uAccent;
  uniform vec3 uGold;
  uniform float uScroll;
  uniform vec2 uMouse;

  float blob(vec2 p, vec2 c, float r) { return r / length(p - c); }

  void main() {
    vec2 uv = gl_FragCoord.xy / uResolution.xy;
    float ar = uResolution.x / uResolution.y;
    uv.x *= ar;
    vec2 p = (uv - vec2(ar * 0.5, 0.5)) * 2.6;

    float t = uPhase;
    float spread = 1.1 + uScroll * 0.5;

    float v = 0.0;
    v += blob(p, vec2(cos(t)       * 1.0 * spread, sin(t * 1.3) * 0.7 * spread), 0.62);
    v += blob(p, vec2(sin(t * 0.8) * 1.2 * spread, cos(t * 0.7) * 0.9 * spread), 0.55);
    v += blob(p, vec2(cos(t * 1.4) * 0.7 * spread, sin(t * 0.6) * 1.1 * spread), 0.5);
    v += blob(p, vec2(sin(t * 1.1) * 0.9 * spread, cos(t * 1.5) * 0.6 * spread), 0.45);
    v += blob(p, vec2(cos(t * 0.6) * 0.5 * spread, sin(t * 0.9) * 0.8 * spread), 0.38);

    vec2 mp = (uMouse - 0.5) * vec2(ar, 1.0) * 2.2;
    v += blob(p, mp, 0.38);

    float mask = smoothstep(0.95, 1.55, v);
    vec3 base = vec3(0.020, 0.014, 0.011);                            // warm near-black (≈ --bg)
    vec3 col = mix(base, uAccent * 0.5, mask);                        // orange body (accent)
    col += uAccent * smoothstep(1.7, 2.5, v) * 0.32;                  // hotter orange
    col += uGold  * smoothstep(2.45, 3.35, v) * 0.42;                 // gold inner glow (the MAANAS gold)
    col += vec3(1.0, 0.93, 0.82) * smoothstep(3.4, 4.2, v) * 0.26;    // warm-white hottest core
    col *= 0.74;
    gl_FragColor = vec4(col, 1.0);
  }
`

export default function Blob() {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5))
    const scene = new THREE.Scene()
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)

    const uniforms = {
      uPhase: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uAccent: { value: new THREE.Color('#ff6f1a') }, // --accent
      uGold: { value: new THREE.Color('#ffcd78') }, // --gold (rgb 255,205,120)
      uScroll: { value: 0 },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
    }
    const material = new THREE.ShaderMaterial({
      vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }',
      fragmentShader: fragment,
      uniforms,
    })
    const geometry = new THREE.PlaneGeometry(2, 2)
    const mesh = new THREE.Mesh(geometry, material)
    scene.add(mesh)

    const resize = () => {
      renderer.setSize(window.innerWidth, window.innerHeight, false)
      uniforms.uResolution.value.set(window.innerWidth, window.innerHeight)
    }
    resize()
    window.addEventListener('resize', resize)

    const mouse = { tx: 0.5, ty: 0.5, x: 0.5, y: 0.5 }
    const onMove = (e) => {
      mouse.tx = e.clientX / window.innerWidth
      mouse.ty = 1 - e.clientY / window.innerHeight
    }
    window.addEventListener('mousemove', onMove)

    let scrollTarget = 0,
      scrollValue = 0
    const maxScroll = () => Math.max(1, document.body.scrollHeight - window.innerHeight)
    const onScroll = () => {
      scrollTarget = window.scrollY / maxScroll()
    }
    window.addEventListener('scroll', onScroll, { passive: true })

    const clock = new THREE.Clock()
    let phase = 0,
      lastT = 0,
      raf = 0
    const tick = () => {
      const t = clock.getElapsedTime()
      const dt = Math.min(t - lastT, 0.05)
      lastT = t
      scrollValue += (scrollTarget - scrollValue) * 0.07
      uniforms.uScroll.value = scrollValue
      phase += dt * (0.28 + scrollValue * 0.8)
      uniforms.uPhase.value = phase
      mouse.x += (mouse.tx - mouse.x) * 0.04
      mouse.y += (mouse.ty - mouse.y) * 0.04
      uniforms.uMouse.value.set(mouse.x, mouse.y)
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('scroll', onScroll)
      geometry.dispose()
      material.dispose()
      renderer.dispose()
    }
  }, [])

  return (
    <div className="blob-layer">
      <canvas ref={canvasRef} className="blob-canvas" />
      <div className="blob-darken" />
    </div>
  )
}
