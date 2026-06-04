import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js'
import './OrbitScene.css'

/* Composition for this variant — the asteroid sits low, viewed from orbit. */
const CONFIG = {
  radius: 3.55,
  pos: [0, -3.5, 0],
  look: [0, 0.2, 0],
  camZ: 5.6,
  exposure: 0.92,
  camParallax: 0.3,
}

// Nebula haze intensity — fixed. 0 = dark/empty field, 1 = full clouds.
// Change this one value to taste.
const HAZE = 0.8

/* ── Quality tiers ───────────────────────────────────────────────────────────
   The scene is fill-rate bound (full-screen procedural nebula + a heavy displaced
   sphere), so the cost is dominated by how many pixels × how much per-pixel work
   we do. Rather than ship one setting that either looks great OR runs everywhere,
   we pick a starting tier from a cheap device probe and then let a runtime
   adaptive-DPR controller (see the frame loop) walk the resolution up/down to hit
   a smooth frame rate on whatever GPU we actually landed on.

   HIGH is intentionally identical to the hand-tuned look (detail 96, 6 nebula
   octaves, 7000/2100 stars, physical material, MSAA, DPR up to 2). MEDIUM/LOW
   trade fidelity for headroom on integrated GPUs and phones. The adaptive
   controller is the real safety net — tiering just sets a sane starting point. */
const TIERS = {
  high: {
    detail: 128, octaves: 6, stars: [7000, 2100],
    physical: true, antialias: true, dprCap: 2.0, dprFloor: 0.75,
  },
  medium: {
    detail: 104, octaves: 5, stars: [5000, 1500],
    physical: true, antialias: true, dprCap: 1.5, dprFloor: 0.66,
  },
  low: {
    detail: 48, octaves: 4, stars: [3000, 900],
    physical: false, antialias: false, dprCap: 1.0, dprFloor: 0.5,
  },
}

// One-time, cheap capability probe. Heuristic on purpose — misclassification is
// fine because the adaptive-DPR loop corrects smoothness at runtime regardless.
function detectTier() {
  if (typeof navigator === 'undefined') return 'high'
  const ua = navigator.userAgent || ''
  const mobile = /Android|iPhone|iPad|iPod|Mobile|Silk|Kindle/i.test(ua)
  const cores = navigator.hardwareConcurrency || 4
  const mem = navigator.deviceMemory || 4

  let gpu = ''
  try {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl') || c.getContext('experimental-webgl')
    if (gl) {
      const ext = gl.getExtension('WEBGL_debug_renderer_info')
      if (ext) gpu = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '').toLowerCase()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  } catch {
    /* probe failed — fall back to UA/core heuristics below */
  }

  const software = /swiftshader|llvmpipe|basic render|software/i.test(gpu)
  const strong = /(rtx|gtx|geforce|radeon rx|radeon pro|\bnvidia\b|apple m[1-9]|arc a[0-9])/i.test(gpu)
  const weak = /(intel|hd graphics|uhd graphics|iris|mali|adreno [1-5]\d{2}|powervr|apple a[0-9])/i.test(gpu)

  if (mobile || software || cores <= 4 || mem <= 4) return 'low'
  if (strong || (cores >= 8 && mem >= 8 && !weak)) return 'high'
  if (weak) return 'medium'
  return 'medium' // unknown desktop GPU — start safe, let adaptive scale up
}

/* ── value-noise helpers used to sculpt the asteroid surface (CPU side) ── */
// Fast integer hash -> [0,1). Replaces Math.sin-based hashing so the heavy CPU
// displacement build (lots of Worley/fbm per vertex) doesn't block the main thread
// for seconds on mount — that stall is what made the first load jitter/flash dark.
function hash3(x, y, z) {
  let h = Math.imul(x | 0, 374761393) ^ Math.imul(y | 0, 668265263) ^ Math.imul(z | 0, 1274126177)
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967296
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
  // inlined lerps (no per-call closures -> no GC churn during the build)
  const c000 = hash3(xi, yi, zi)
  const c100 = hash3(xi + 1, yi, zi)
  const c010 = hash3(xi, yi + 1, zi)
  const c110 = hash3(xi + 1, yi + 1, zi)
  const c001 = hash3(xi, yi, zi + 1)
  const c101 = hash3(xi + 1, yi, zi + 1)
  const c011 = hash3(xi, yi + 1, zi + 1)
  const c111 = hash3(xi + 1, yi + 1, zi + 1)
  const x00 = c000 + (c100 - c000) * u
  const x10 = c010 + (c110 - c010) * u
  const x01 = c001 + (c101 - c001) * u
  const x11 = c011 + (c111 - c011) * u
  const y0 = x00 + (x10 - x00) * v
  const y1 = x01 + (x11 - x01) * v
  return y0 + (y1 - y0) * w
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

/* ── 3D cellular (Worley) noise — F1 distance to the nearest feature point.
   Drives the densely-packed crater field that gives Hyperion its sponge look:
   the cell centres become crater floors, the cell walls become shared rims. ── */
function worley3(x, y, z) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const fx = x - xi
  const fy = y - yi
  const fz = z - zi
  let f1 = 9
  for (let k = -1; k <= 1; k++) {
    for (let j = -1; j <= 1; j++) {
      for (let i = -1; i <= 1; i++) {
        const cx = xi + i
        const cy = yi + j
        const cz = zi + k
        // feature-point offset, inlined (no array alloc -> no GC churn in the build)
        const dx = i + hash3(cx, cy, cz) - fx
        const dy = j + hash3(cx + 113, cy + 271, cz + 59) - fy
        const dz = k + hash3(cx + 977, cy + 433, cz + 757) - fz
        const d = dx * dx + dy * dy + dz * dz
        if (d < f1) f1 = d
      }
    }
  }
  return Math.sqrt(f1)
}
// Turn a Worley F1 distance into a crater height profile: a flattish bowl that
// fills most of the cell, ringed by a sharp raised rim. Returns ~[-1, +0.45].
function craterShape(w) {
  // broad flat dark floor (stays low until w≈0.12) then a smooth rise to a soft rim,
  // so massive craters get a wide deep bottom rather than a single low point
  const t = Math.min(Math.max((w - 0.12) / 0.3, 0), 1)
  const ss = t * t * (3 - 2 * t)
  const floor = -(1 - ss)
  const rim = Math.exp(-Math.pow((w - 0.46) / 0.13, 2)) * 0.26 // soft, weathered rim
  return floor + rim
}
// rounded bump near a Worley cell centre — fine popcorn-ceiling / stucco stipple
function blobBump(w) {
  const t = Math.min(w / 0.4, 1)
  return (1 - t) * (1 - t)
}

// Weld a non-indexed geometry into an indexed one. Same job as addons'
// mergeVertices, but keys vertices by a packed numeric grid hash instead of a
// string — ~6x faster, which is what kept the mount-time build from stalling.
function fastIndex(geo) {
  const src = geo.attributes.position.array
  const n = geo.attributes.position.count
  const map = new Map()
  const index = new Uint32Array(n)
  const positions = new Float32Array(n * 3) // upper bound; sliced to the unique count
  let m = 0
  const Q = 1e4 // grid resolution (0.1mm at this scale) — merges duplicate corners only
  const B = 32768
  const OFF = 16384
  for (let i = 0; i < n; i++) {
    const x = src[i * 3]
    const y = src[i * 3 + 1]
    const z = src[i * 3 + 2]
    const key =
      ((Math.round(x * Q) + OFF) * B + (Math.round(y * Q) + OFF)) * B + (Math.round(z * Q) + OFF)
    let idx = map.get(key)
    if (idx === undefined) {
      idx = m
      positions[m * 3] = x
      positions[m * 3 + 1] = y
      positions[m * 3 + 2] = z
      m++
      map.set(key, idx)
    }
    index[i] = idx
  }
  const out = new THREE.BufferGeometry()
  out.setAttribute('position', new THREE.BufferAttribute(positions.subarray(0, m * 3), 3))
  out.setIndex(new THREE.BufferAttribute(index, 1))
  return out
}

// Cache the heavy rock build (its typed arrays) per detail level so StrictMode's
// double-mount and any remount reuse it instead of recomputing the whole thing.
const rockCache = new Map()

export default function OrbitScene() {
  const containerRef = useRef(null)

  useEffect(() => {
    const container = containerRef.current

    const q = TIERS[detectTier()]

    // Let three own the <canvas>: a fresh element every mount. (Reusing a ref'd
    // canvas breaks under StrictMode/HMR — cleanup's forceContextLoss() kills
    // it, then the re-mount can't get a new context on the dead canvas.)
    const renderer = new THREE.WebGLRenderer({
      antialias: q.antialias,
      // Steer dual-GPU laptops toward the discrete GPU; skip the unused buffers.
      powerPreference: 'high-performance',
      stencil: false,
      alpha: false,
    })
    renderer.domElement.className = 'hero-scene'
    // Hide the canvas until the first frame actually renders. The geometry build +
    // shader/IBL compile block the main thread for a beat, during which an unpainted
    // canvas shows black; revealing only after the first render hides that gap behind
    // the page's matching dark background (no black flash, just a soft fade-in). This
    // also covers React StrictMode's dev-only mount→unmount→mount double build.
    renderer.domElement.style.opacity = '0'
    renderer.domElement.style.transition = 'opacity 0.5s ease'
    container.appendChild(renderer.domElement)
    // Start at the tier's DPR cap; the adaptive loop tunes it from here.
    let curPR = Math.min(devicePixelRatio, q.dprCap)
    renderer.setPixelRatio(curPR)
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
    scene.environmentIntensity = 0.3

    scene.add(new THREE.AmbientLight(0x1b2336, 1.1))
    const key = new THREE.DirectionalLight(0xcdd6ff, 0.75)
    key.position.set(3, 4, 5)
    scene.add(key)
    // dialled down from 9/9/5 — a pale cratered moon overexposes under the original
    // intensities (which were tuned for a near-black rock). The blue *limb* glow is
    // the atmosphere shader, not these, so it survives the cut.
    const rim = new THREE.PointLight(0x6f86ff, 3, 40)
    rim.position.set(-5, -1, -3)
    scene.add(rim)
    const rim2 = new THREE.PointLight(0x6f86ff, 3, 40)
    rim2.position.set(5, -1, -3)
    scene.add(rim2)
    const warm = new THREE.PointLight(0xe8945b, 2, 40)
    warm.position.set(5, 3, 2)
    scene.add(warm)
    // white sun on the FRONT of the rock (dimmed for the pale moon)
    const front = new THREE.DirectionalLight(0xffffff, 1.4)
    front.position.set(1.2, 2.2, 8)
    scene.add(front)
    // rakes the TOP ridge so it isn't a dark band (dimmed for the pale moon)
    const top = new THREE.DirectionalLight(0xe6eeff, 1.15)
    top.position.set(-0.6, 7, 4.5)
    scene.add(top)

    /* ===== cursor-reactive nebula (deep space, warm + cool, drifting) ===== */
    const neb = {
      uTime: { value: 0 },
      uRes: { value: new THREE.Vector2() },
      uMouse: { value: new THREE.Vector2(0.5, 0.5) },
      uHaze: { value: HAZE },
    }
    // fbm octave count is the dominant per-pixel cost of this full-screen plane;
    // inject the tier's count straight into the (constant) loop bound.
    const nebFrag = `
precision highp float; uniform float uTime; uniform vec2 uRes,uMouse; uniform float uHaze; varying vec2 vUv;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);float a=hash(i),b=hash(i+vec2(1,0)),c=hash(i+vec2(0,1)),d=hash(i+vec2(1,1));
 vec2 u=f*f*(3.-2.*f);return mix(mix(a,b,u.x),mix(c,d,u.x),u.y);}
float fbm(vec2 p){float s=0.,a=.5;for(int i=0;i<${q.octaves};i++){s+=a*noise(p);p*=2.02;a*=.5;}return s;}
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
    const starsFar = makeStars(q.stars[0], 46, -24, -9, 0.3, 0.85) // distant
    const starsNear = makeStars(q.stars[1], 34, -11, -4, 0.5, 1.3) // closer (more parallax)
    scene.add(starsFar)
    scene.add(starsNear)

    /* ===== Hyperion — pale, densely-cratered "sponge" moon =====
       Worley (cellular) noise carves a field of overlapping craters at three
       scales (cell centres = floors, shared walls = rims); a gentle fbm gives the
       body its irregular battered shape. Per-vertex colours darken the crater
       floors and lighten the rims — that high-contrast pitting is what reads as
       Hyperion. Smooth-shaded (its surface is smooth, not faceted). */
    const BR = 1.35
    // The displacement build (Worley/fbm over ~110k verts + normals) costs a few
    // hundred ms and blocks the main thread, so cache its arrays per detail level —
    // StrictMode's second mount and any remount reuse them instead of recomputing.
    let geo
    let maxR
    const cached = rockCache.get(q.detail)
    if (cached) {
      geo = new THREE.BufferGeometry()
      geo.setIndex(new THREE.BufferAttribute(cached.index, 1))
      geo.setAttribute('position', new THREE.BufferAttribute(cached.position, 3))
      geo.setAttribute('normal', new THREE.BufferAttribute(cached.normal, 3))
      geo.setAttribute('color', new THREE.BufferAttribute(cached.color, 3))
      maxR = cached.maxR
    } else {
      geo = new THREE.IcosahedronGeometry(BR, q.detail)
      geo.deleteAttribute('uv')
      geo.deleteAttribute('normal')
      geo = fastIndex(geo)
      const posAttr = geo.attributes.position
      const colAttr = new Float32Array(posAttr.count * 3)
      const tmp = new THREE.Vector3()
      maxR = 0 // tallest peak — sizes the atmosphere shell so the rock can't pierce it
      const floorCol = [0.002, 0.002, 0.003] // near-pure-black material in crater floors
      const paleCol = [0.11, 0.11, 0.108] // dark neutral grey high ground
      for (let i = 0; i < posAttr.count; i++) {
        tmp.fromBufferAttribute(posAttr, i).normalize()
        const x = tmp.x
        const y = tmp.y
        const z = tmp.z
        // irregular overall body — gentle, a weathered rounded asteroid
        const shape = (fbm3(x * 1.0 + 5, y * 1.0 + 5, z * 1.0 + 5) - 0.5) * 0.13
        // three scales — big, deep "massive" craters dominate; no spiky high layer
        const craters =
          craterShape(worley3(x * 3.2 + 11, y * 3.2 + 11, z * 3.2 + 11)) * 0.11 +
          craterShape(worley3(x * 6.5 + 23, y * 6.5 + 23, z * 6.5 + 23)) * 0.052 +
          craterShape(worley3(x * 12.0 + 41, y * 12.0 + 41, z * 12.0 + 41)) * 0.024
        // fine micro-relief — surface grit, low amplitude so it never spikes
        const grain = (vnoise(x * 16.0 + 91, y * 16.0 + 91, z * 16.0 + 91) - 0.5) * 0.008
        // popcorn-ceiling stipple — clustered rounded blobs at two fine scales
        const popcorn =
          blobBump(worley3(x * 15.0 + 7, y * 15.0 + 7, z * 15.0 + 7)) * 0.022 +
          blobBump(worley3(x * 24.0 + 19, y * 24.0 + 19, z * 24.0 + 19)) * 0.014
        const r = BR * (1 + shape + craters + grain + popcorn)
        if (r > maxR) maxR = r
        posAttr.setXYZ(i, x * r, y * r, z * r)
        // albedo sells crater DEPTH through value: deep floors near-black, rims grey,
        // with large-scale light/dark patches + fine speckle so the tone is never flat
        let shade = THREE.MathUtils.clamp(0.46 + craters * 9.0, 0, 1)
        const patches = 0.34 + 0.66 * fbm3(x * 1.7 + 70, y * 1.7 + 70, z * 1.7 + 70)
        // two scales of albedo grain so the surface reads dusty/textured, not plastic
        const tex =
          (0.78 + 0.22 * fbm3(x * 9.0 + 33, y * 9.0 + 33, z * 9.0 + 33)) *
          (0.88 + 0.12 * vnoise(x * 22.0 + 88, y * 22.0 + 88, z * 22.0 + 88))
        // popcorn stipple in the albedo: crevices between the blobs read a touch darker
        const stipple = 0.78 + 0.22 * Math.min(popcorn / 0.03, 1)
        shade = THREE.MathUtils.clamp(shade * patches * tex * stipple, 0, 1)
        colAttr[i * 3] = floorCol[0] + (paleCol[0] - floorCol[0]) * shade
        colAttr[i * 3 + 1] = floorCol[1] + (paleCol[1] - floorCol[1]) * shade
        colAttr[i * 3 + 2] = floorCol[2] + (paleCol[2] - floorCol[2]) * shade
      }
      geo.setAttribute('color', new THREE.BufferAttribute(colAttr, 3))
      geo.computeVertexNormals() // smooth shading — Hyperion's surface is smooth
      rockCache.set(q.detail, {
        position: geo.attributes.position.array,
        index: geo.index.array,
        normal: geo.attributes.normal.array,
        color: colAttr,
        maxR,
      })
    }
    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true, // albedo comes from the per-vertex crater shading
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.96, // very matte regolith
      envMapIntensity: 0.25,
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

    /* thin atmospheric limb — the prototype's rim-glow shader. The shell is a
       SMOOTH sphere; if it's smaller than the rock's peaks they poke through and
       chop the fresnel ring into broken arcs (the "blue film breaking" artifact).
       Size it just past the tallest peak so the rock can never pierce it — keeps
       the limb clean while still hugging the silhouette. */
    const atmGeo = new THREE.SphereGeometry(maxR * 1.02, 64, 64)
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
      requestRender() // repaint the new size if the loop was parked (tab hidden)
    }

    const m = { x: 0, y: 0, tx: 0, ty: 0 }
    const onMove = (e) => {
      m.tx = e.clientX / innerWidth - 0.5
      m.ty = e.clientY / innerHeight - 0.5
    }

    /* ── frame loop ───────────────────────────────────────────────────────────
       requestRender() schedules at most one rAF; the frame re-arms itself, so the
       loop runs continuously while the tab is visible. visibilitychange parks it
       when hidden (and the gate stops a double-schedule on resume). */
    let last = performance.now()
    let elapsed = 0
    let fpsEMA = 0
    let lastAdjust = 0
    let raf = 0
    let paused = false
    let revealed = false

    function requestRender() {
      if (!raf && !paused) raf = requestAnimationFrame(frame)
    }

    function frame() {
      raf = 0
      // clamp dt so a tab-switch / GC pause doesn't lurch the animation or poison
      // the FPS estimate.
      const now = performance.now()
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      elapsed += dt
      const t = elapsed

      m.x += (m.tx - m.x) * 0.05
      m.y += (m.ty - m.y) * 0.05
      neb.uTime.value = t
      neb.uMouse.value.set(0.5 + m.x, 0.5 - m.y) // nebula follows the SMOOTHED cursor, like the rock
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
      if (!revealed) {
        revealed = true
        renderer.domElement.style.opacity = '1' // fade in once we have real pixels
      }

      // Adaptive DPR: skip frames whose dt was clamped (post-pause spikes), then
      // EMA the frame rate and nudge the resolution toward a smooth ~55-60fps.
      if (dt < 0.045) {
        const fps = 1 / Math.max(dt, 1e-3)
        fpsEMA = fpsEMA ? fpsEMA * 0.9 + fps * 0.1 : fps
        if (t - lastAdjust > 1) {
          const cap = Math.min(devicePixelRatio, q.dprCap)
          let next = curPR
          if (fpsEMA < 52 && curPR > q.dprFloor) next = Math.max(q.dprFloor, curPR * 0.85)
          else if (fpsEMA > 58 && curPR < cap) next = Math.min(cap, curPR * 1.07)
          if (next !== curPR) {
            curPR = next
            renderer.setPixelRatio(curPR)
            // setPixelRatio reallocates AND clears the drawing buffer; refill it this
            // frame so the browser never composites one black frame. (That black flash
            // is the "screenshot jitter": a screenshot's frame-time spike makes the
            // adaptive loop step the resolution, and each step cleared the buffer.)
            renderer.render(scene, camera)
            lastAdjust = t
          }
        }
      }
      requestRender()
    }

    resize()
    addEventListener('resize', resize)
    addEventListener('mousemove', onMove, { passive: true })

    const onVisibility = () => {
      if (document.hidden) {
        paused = true
        if (raf) {
          cancelAnimationFrame(raf)
          raf = 0
        }
      } else {
        paused = false
        last = performance.now() // discard the long hidden gap
        requestRender()
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    requestRender()

    return () => {
      paused = true
      if (raf) cancelAnimationFrame(raf)
      removeEventListener('resize', resize)
      removeEventListener('mousemove', onMove)
      document.removeEventListener('visibilitychange', onVisibility)
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
