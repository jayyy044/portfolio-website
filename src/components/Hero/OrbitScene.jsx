import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'

/* Composition for this variant — the asteroid sits low, viewed from orbit. */
const CONFIG = {
  radius: 3.8,
  pos: [0, -3.5, 0],
  look: [0, 0.2, 0],
  camZ: 5.6,
  exposure: 0.92,
  camParallax: 0.3,
}

// Nebula intensity at scroll-top (dark, minimal haze) → 1.0 once scrolled in.
const HAZE_MIN = 0.4
// Haze reaches full over this fraction of a viewport of scroll.
const HAZE_SCROLL_SPAN = 0.7

/* ── value-noise helpers used to sculpt the asteroid surface (CPU side) ── */
function hash3(x, y, z) {
  const n = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453
  return n - Math.floor(n)
}
function vnoise(x, y, z) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const u = xf * xf * (3 - 2 * xf)
  const v = yf * yf * (3 - 2 * yf)
  const w = zf * zf * (3 - 2 * zf)
  const L = (a, b, t) => a + (b - a) * t
  const c = (X, Y, Z) => hash3(xi + X, yi + Y, zi + Z)
  return L(
    L(L(c(0, 0, 0), c(1, 0, 0), u), L(c(0, 1, 0), c(1, 1, 0), u), v),
    L(L(c(0, 0, 1), c(1, 0, 1), u), L(c(0, 1, 1), c(1, 1, 1), u), v),
    w
  )
}
function fbm3(x, y, z) {
  let s = 0
  let a = 0.5
  let f = 1
  for (let i = 0; i < 4; i++) {
    s += a * vnoise(x * f, y * f, z * f)
    f *= 2
    a *= 0.5
  }
  return s
}

export default function OrbitScene() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current

    // Let three own the <canvas>: a fresh element every mount. (Reusing a ref'd
    // canvas breaks under StrictMode/HMR — cleanup's forceContextLoss() kills
    // it, then the re-mount can't get a new context on the dead canvas.)
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.domElement.className = 'hero-scene'
    container.appendChild(renderer.domElement)
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setSize(innerWidth, innerHeight)
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = CONFIG.exposure

    const scene = new THREE.Scene()
    scene.background = new THREE.Color('#04050A')
    const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 100)
    camera.position.set(0, 0, CONFIG.camZ)

    const pmrem = new THREE.PMREMGenerator(renderer)
    // three >=0.167 RoomEnvironment takes no renderer arg
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture
    // 0.184's RoomEnvironment is brighter than 0.160's; dial the IBL back down
    // so the matte rock reads dark again (matches the prototype look).
    scene.environmentIntensity = 0.25

    scene.add(new THREE.AmbientLight(0x1b2336, 1.35))
    const key = new THREE.DirectionalLight(0xcdd6ff, 1.1)
    key.position.set(3, 4, 5)
    scene.add(key)
    const rim = new THREE.PointLight(0x6f86ff, 9, 40)
    rim.position.set(-5, -1, -3)
    scene.add(rim)
    const warm = new THREE.PointLight(0xe8945b, 5, 40)
    warm.position.set(5, 3, 2)
    scene.add(warm)
    // white sun on the FRONT of the rock
    const front = new THREE.DirectionalLight(0xffffff, 2.1)
    front.position.set(1.2, 2.2, 8)
    scene.add(front)
    // rakes the TOP ridge so it isn't a dark band — brighter + more over the crest
    const top = new THREE.DirectionalLight(0xe6eeff, 2.9)
    top.position.set(-0.4, 8, 5.5)
    scene.add(top)

    /* ===== cursor-reactive nebula (deep space, warm + cool, drifting) ===== */
    const neb = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2() },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uHaze: { value: HAZE_MIN },
    }
    const nebFrag = `
precision highp float; uniform float uTime; uniform vec2 uRes,uMouse; uniform float uHaze; varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
 vec2 u=f*f*(3.-2.*f);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<6;i++){s+=a*noise(p);p*=2.02;a*=.5;}return s;}
void main(){
  vec2 uv=vUv; vec2 p=uv; p.x*=uRes.x/uRes.y;
  vec2 mo=(uMouse-0.5);
  vec2 flow=vec2(uTime*0.010,uTime*0.014) + mo*0.95;     // nebula drifts toward the cursor (more pronounced)
  float n =fbm(p*3.0+flow);                              // higher freq -> more cloud structure on big screens
  float n2=fbm(p*5.4-flow*1.3+11.0);
  float n3=fbm(p*4.0+flow*1.8+5.0);
  vec3 base=vec3(0.009,0.012,0.028);                     // base deepened a touch for more depth (orig 0.012,0.016,0.034)
  vec3 blue=vec3(0.09,0.15,0.40);                        // palette below is the prototype's, unchanged
  vec3 teal=vec3(0.05,0.26,0.28);
  vec3 ember=vec3(0.50,0.18,0.07);                       // rust red
  vec3 col=mix(base,blue,smoothstep(0.24,0.70,n));       // wider range -> colour fills more of the field
  col=mix(col,teal,smoothstep(0.44,0.84,n2)*0.7);
  float e=smoothstep(0.46,0.86,n3);                      // ember mask: wider -> larger, diffuse blooms
  col=mix(col,ember,e*0.85);                             // rust blooms PUNCH THROUGH the blue (visible red spots)
  col+=ember*e*0.30;                                     // extra additive glow on the hottest cores
  // soft glow that follows the cursor
  col+=vec3(0.12,0.16,0.34)*smoothstep(0.58,0.0,distance(uv,uMouse))*0.65;
  // fade the whole cloud field toward the dark base — minimal at scroll-top,
  // blooms to full as you scroll (uHaze 0..1)
  col=mix(base,col,uHaze);
  float grain=hash(uv*uRes+uTime)-0.5; col+=grain*0.025;
  gl_FragColor=vec4(col,1.0);
}`
    const nebMat = new THREE.ShaderMaterial({
      uniforms: neb,
      depthWrite: false,
      vertexShader: `varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: nebFrag,
    })
    const nebPlane = new THREE.Mesh(new THREE.PlaneGeometry(40, 24), nebMat)
    nebPlane.position.z = -9
    scene.add(nebPlane)

    /* ===== twinkling starfield (2 layers for depth + cursor parallax) ===== */
    const starVert = `
attribute float aSize; attribute float aPhase; uniform float uTime; varying float vT;
void main(){ vec4 mv=modelViewMatrix*vec4(position,1.0);
  float tw=0.5+0.5*sin(uTime*2.3+aPhase); vT=0.16+0.84*tw*tw;
  gl_PointSize=aSize*(135.0/-mv.z)*(0.7+0.6*vT); gl_Position=projectionMatrix*mv; }`
    const starFrag = `
precision highp float; varying float vT;
void main(){ vec2 uv=gl_PointCoord-0.5; float d=length(uv);
  float core=pow(smoothstep(0.5,0.0,d),2.2);
  float fx=smoothstep(0.5,0.0,abs(uv.x))*smoothstep(0.08,0.0,abs(uv.y));
  float fy=smoothstep(0.5,0.0,abs(uv.y))*smoothstep(0.08,0.0,abs(uv.x));
  float a=(core*0.9+max(fx,fy)*0.6)*vT; if(a<0.01) discard;
  gl_FragColor=vec4(vec3(0.92,0.95,1.0),a); }`
    const starMaterials = []
    function makeStars(count, spreadXY, zMin, zMax, sizeMin, sizeMax) {
      const g = new THREE.BufferGeometry()
      const positions = new Float32Array(count * 3)
      const sz = new Float32Array(count)
      const ph = new Float32Array(count)
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * spreadXY
        positions[i * 3 + 1] = (Math.random() - 0.5) * spreadXY * 0.65
        positions[i * 3 + 2] = zMin + Math.random() * (zMax - zMin)
        sz[i] = sizeMin + Math.random() * (sizeMax - sizeMin)
        ph[i] = Math.random() * 6.28
      }
      g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      g.setAttribute('aSize', new THREE.BufferAttribute(sz, 1))
      g.setAttribute('aPhase', new THREE.BufferAttribute(ph, 1))
      const m = new THREE.ShaderMaterial({
        uniforms: { uTime: neb.uTime },
        vertexShader: starVert,
        fragmentShader: starFrag,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      })
      starMaterials.push(m)
      return new THREE.Points(g, m)
    }
    const starsFar = makeStars(5000, 46, -24, -9, 0.3, 0.85) // distant
    const starsNear = makeStars(1500, 34, -11, -4, 0.5, 1.3) // closer (more parallax)
    scene.add(starsFar)
    scene.add(starsNear)

    /* ===== the dark rocky asteroid (organic carved sphere) ===== */
    const BR = 1.35
    const geo = new THREE.IcosahedronGeometry(BR, 128) // high subdivision for fine rocky surface
    const posAttr = geo.attributes.position
    const tmp = new THREE.Vector3()
    for (let i = 0; i < posAttr.count; i++) {
      tmp.fromBufferAttribute(posAttr, i).normalize()
      const d = fbm3(tmp.x * 1.1 + 5, tmp.y * 1.1 + 5, tmp.z * 1.1 + 5)
      const d2 = fbm3(tmp.x * 3.4 + 20, tmp.y * 3.4 + 20, tmp.z * 3.4 + 20)
      const d3 = fbm3(tmp.x * 7.5 + 50, tmp.y * 7.5 + 50, tmp.z * 7.5 + 50)
      // big lumps + craters + grit = asteroid
      const r = BR * (1 + (d - 0.5) * 0.46 + (d2 - 0.5) * 0.15 + (d3 - 0.5) * 0.055)
      posAttr.setXYZ(i, tmp.x * r, tmp.y * r, tmp.z * r)
    }
    geo.computeVertexNormals()
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x100f0d,
      metalness: 0.0,
      roughness: 0.82, // dark rocky asteroid — matte
      clearcoat: 0.22,
      clearcoatRoughness: 0.4, // occasional faint mineral glint
      iridescence: 0.0,
      envMapIntensity: 0.4, // faint reflections — stays dark
    })
    const orb = new THREE.Mesh(geo, mat)
    const BASE_SCALE = CONFIG.radius / BR
    orb.position.set(...CONFIG.pos)
    orb.scale.setScalar(BASE_SCALE)
    scene.add(orb)
    // gentle whole-mesh pulse (no per-vertex churn, so we can afford the high subdivision)
    function breathe(t) {
      orb.scale.setScalar(BASE_SCALE * (1 + Math.sin(t * 0.5) * 0.008))
    }

    /* thin atmospheric limb — a band that hugs the ball's edge and fades out */
    const atmGeo = new THREE.SphereGeometry(BR * 1.05, 64, 64)
    const atmMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(0x3f6cff) } },
      vertexShader: `varying vec3 vN;varying vec3 vV;void main(){vN=normalize(normalMatrix*normal);vec4 mv=modelViewMatrix*vec4(position,1.);vV=normalize(-mv.xyz);gl_Position=projectionMatrix*mv;}`,
      fragmentShader: `varying vec3 vN;varying vec3 vV;uniform vec3 uColor;void main(){float rim=1.0-max(dot(normalize(vN),normalize(vV)),0.0);float band=pow(rim,2.6)*(1.0-smoothstep(0.5,1.0,rim));gl_FragColor=vec4(uColor*band,band*1.25);}`,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.FrontSide,
      depthWrite: false,
    })
    orb.add(new THREE.Mesh(atmGeo, atmMat))

    function resize() {
      camera.aspect = innerWidth / innerHeight
      camera.updateProjectionMatrix()
      renderer.setSize(innerWidth, innerHeight)
      neb.uRes.value.set(innerWidth, innerHeight)
    }
    resize()
    addEventListener('resize', resize)

    const m = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMove = (e) => {
      m.tx = e.clientX / innerWidth - 0.5
      m.ty = e.clientY / innerHeight - 0.5
    }
    addEventListener('mousemove', onMove)

    // scroll-driven haze: dark/minimal at the top, blooms in as you scroll down
    const hz = { cur: HAZE_MIN, target: HAZE_MIN }
    const onScroll = () => {
      const p = Math.min(scrollY / (innerHeight * HAZE_SCROLL_SPAN), 1)
      hz.target = HAZE_MIN + (1 - HAZE_MIN) * p
    }
    addEventListener('scroll', onScroll, { passive: true })
    onScroll()

    const clock = new THREE.Clock()
    let raf
    function tick() {
      const t = clock.getElapsedTime()
      neb.uTime.value = t
      m.x += (m.tx - m.x) * 0.05
      m.y += (m.ty - m.y) * 0.05
      neb.uMouse.value.set(0.5 + m.x, 0.5 - m.y) // nebula follows the SMOOTHED cursor, like the rock
      hz.cur += (hz.target - hz.cur) * 0.08 // ease the haze toward its scroll target
      neb.uHaze.value = hz.cur
      orb.rotation.y = t * 0.04 + m.x * 0.4
      orb.rotation.x = Math.sin(t * 0.15) * 0.05 - m.y * 0.25
      breathe(t)
      starsFar.position.set(-m.x * 0.95, -m.y * 0.62, 0)
      starsNear.position.set(-m.x * 2.5, -m.y * 1.6, 0)
      starsNear.rotation.z = t * 0.005
      camera.position.x = m.x * CONFIG.camParallax
      camera.position.y = -m.y * CONFIG.camParallax * 0.7
      camera.lookAt(CONFIG.look[0], CONFIG.look[1], CONFIG.look[2])
      renderer.render(scene, camera)
      raf = requestAnimationFrame(tick)
    }
    tick()

    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      removeEventListener('mousemove', onMove)
      removeEventListener('scroll', onScroll)
      geo.dispose()
      mat.dispose()
      nebPlane.geometry.dispose()
      nebMat.dispose()
      atmGeo.dispose()
      atmMat.dispose()
      starsFar.geometry.dispose()
      starsNear.geometry.dispose()
      starMaterials.forEach((sm) => sm.dispose())
      pmrem.dispose()
      scene.environment?.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      renderer.domElement.remove()
    }
  }, [])

  return <div ref={containerRef} className="hero-scene-mount" />
}
