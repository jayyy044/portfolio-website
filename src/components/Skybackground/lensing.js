// Gravitational lensing. Every pixel of the sky is a ray of light traced back
// around the black hole into the star sphere: stars near the hole bend into arcs,
// a second image of the sky wraps the ring, and the shadow is real. WebGL;
// Skybackground falls back to the flat 2D sky if it isn't available.
// Ported from the black hole page (RAY / rayTable / chooseD).
import { R0, INTRO_END } from './blackhole'
import { paintStarSphere } from './starSphere'

// ---------- knobs ----------
const RES = 1.5 // render scale cap (x css px): higher is sharper and heavier
const YAW = 0.4 // which way the camera faces into the sky when the intro ends, in radians
const PITCH = 0.18 // how far it looks up
const PITCH_FROM_TILT = 0.35 // the camera tips further as the disk tilts toward us at the end of the intro
const SPIN = 0.006 // how fast the sky turns, radians a second; near the hole the lensing makes it a lot of motion
const DISTANCE = 14 // camera distance from the hole, in its masses: closer bends more (backs off on very tall screens)
const TABLE = 1024 // rays in the bend table

// the shadow's angular radius seen from distance D (in masses)
const shadowAngle = (D) => Math.asin((Math.sqrt(27) * Math.sqrt(1 - 2 / D)) / D)

// The camera distance: DISTANCE, unless the screen is so tall that the view would
// fold past 180°; then step back until the corners sit at 2.4 rad.
function chooseDistance(W, H, S) {
  const rs = 0.98 * R0 * 1.28 * S, corner = Math.hypot(W / 2, H / 2 + 0.02 * S), want = (rs * 2.4) / corner
  if (shadowAngle(DISTANCE) <= want) return DISTANCE
  let lo = DISTANCE, hi = 400
  for (let i = 0; i < 50; i++) {
    const m = (lo + hi) / 2
    if (shadowAngle(m) > want) lo = m
    else hi = m
  }
  return hi
}

// How far round the hole each ray swings, by its angle from the hole, all the way
// round to straight behind the camera. Integrates a light ray's orbit,
// u'' = -u + 3u² (u = M / r), with RK4. Stored as 16-bit values in an N x 1 RGBA texture.
function bendTable(D, N) {
  const thSh = shadowAngle(D), data = new Uint8Array(N * 4), acc = (u) => -u + 3 * u * u
  for (let i = 0; i < N; i++) {
    // stop just short of straight behind, where the ray isn't bent: right at PI the first step overshoots and the
    // ray reads as fallen in (bend 20 rad). Only matters once the hole has moved and the screen reaches past PI from it
    const s = i / (N - 1), th = Math.min(thSh + s * s * (Math.PI - thSh), Math.PI - 1e-3)
    let u = 1 / D, v = Math.sqrt(1 - 2 / D) / Math.tan(th) / D, phi = 0, dphi = 30
    const h = 0.01
    for (let k = 0; k < 20000; k++) {
      const k1u = v, k1v = acc(u), k2u = v + 0.5 * h * k1v, k2v = acc(u + 0.5 * h * k1u)
      const k3u = v + 0.5 * h * k2v, k3v = acc(u + 0.5 * h * k2u), k4u = v + h * k3v, k4v = acc(u + h * k3u)
      const un = u + (h / 6) * (k1u + 2 * k2u + 2 * k3u + k4u), vn = v + (h / 6) * (k1v + 2 * k2v + 2 * k3v + k4v)
      if (un <= 0) { // escaped to infinity
        dphi = phi + (h * u) / (u - un)
        break
      }
      if (un > 0.5) break // fell in
      u = un
      v = vn
      phi += h
    }
    const e = Math.min(Math.max(dphi - (Math.PI - th), 0), 19.999), q = Math.round((e / 20) * 65535)
    data[4 * i] = q >> 8
    data[4 * i + 1] = q & 255
    data[4 * i + 3] = 255
  }
  return { data, thSh }
}

const VS = 'attribute vec2 a; void main() { gl_Position = vec4(a, 0.0, 1.0); }'
const FS = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
uniform sampler2D sky; uniform sampler2D tab; uniform vec2 res; uniform vec2 c; uniform float rs; uniform float thSh; uniform float f; uniform vec2 cb; uniform float f0; uniform vec3 hd; uniform mat3 M; uniform float N;
const float PI = 3.14159265;
float bend(float th) {
  float s = sqrt(clamp((th - thSh) / (PI - thSh), 0.0, 1.0));
  vec4 t = texture2D(tab, vec2((s * (N - 1.0) + 0.5) / N, 0.5));
  return (t.r * 255.0 * 256.0 + t.g * 255.0) / 65535.0 * 20.0;
}
vec3 shade(vec2 p) {
  float dl = length(p - c), th = dl / f;                        // how hard a ray bends depends on its angle from the hole (equal-angle lens)
  if (th <= thSh) return vec3(0.0);                             // the ray falls in: the shadow
  vec2 db = p - cb; float lb = length(db), a = lb / f0; vec2 eb = db / max(lb, 1e-4);
  vec3 v = vec3(sin(a) * eb.x, -sin(a) * eb.y, -cos(a));        // the unbent ray, in the sky's own frame (pinned where the intro left it)
  float tv = acos(clamp(dot(v, hd), -1.0, 1.0));
  vec3 e = v - cos(tv) * hd; float le = length(e); e = le > 1e-5 ? e / le : vec3(1.0, 0.0, 0.0);
  float k = tv - bend(th) * f / f0;                             // swung round toward the hole (past it, for the ring images), as hard
                                                                // for its size as before it moved: f / f0 is how much it has grown
  vec3 s = M * (cos(k) * hd + sin(k) * e);
  float lon = atan(s.x, -s.z), lat = asin(clamp(s.y, -1.0, 1.0));
  return texture2D(sky, vec2(lon / (2.0 * PI) + 0.5, 0.5 - lat / PI)).rgb;
}
void main() {
  vec2 p = vec2(gl_FragCoord.x, res.y - gl_FragCoord.y);
  float dl = length(p - c);
  vec3 col;
  if (dl < rs * 1.3) col = 0.25 * (shade(p + vec2(-0.3, -0.1)) + shade(p + vec2(0.1, -0.3)) + shade(p + vec2(-0.1, 0.3)) + shade(p + vec2(0.3, 0.1)));
  else col = shade(p);                                          // near the ring the sky is squeezed hard, so take four samples there
  gl_FragColor = vec4(col, 1.0);
}`

export function createLensing() {
  const cv = document.createElement('canvas')
  let gl = null, tried = false, u = null, tab = null, D = 0, thSh = 0
  let W = 0, H = 0, S = 1, dpr = 1

  // the browser can take the GPU away (sleep, driver reset): fall back until it gives it back
  cv.addEventListener('webglcontextlost', (e) => {
    e.preventDefault()
    gl = null
  })
  cv.addEventListener('webglcontextrestored', () => {
    tried = false
  })

  // rebuild the bend table only when the camera distance has to change
  function fitDistance() {
    const d = chooseDistance(W, H, S)
    if (!gl || Math.abs(d - D) < 0.05) return
    const T = bendTable(d, TABLE)
    D = d
    thSh = T.thSh
    gl.activeTexture(gl.TEXTURE1)
    gl.bindTexture(gl.TEXTURE_2D, tab)
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, TABLE, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, T.data)
  }

  // the slow part (painting the star sphere, tracing the table): run once, ideally before the flash
  function init() {
    if (tried || !W) return
    tried = true
    try {
      const g = cv.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true })
      if (!g) return
      const shader = (type, src) => {
        const s = g.createShader(type)
        g.shaderSource(s, src)
        g.compileShader(s)
        if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s))
        return s
      }
      const pr = g.createProgram()
      g.attachShader(pr, shader(g.VERTEX_SHADER, VS))
      g.attachShader(pr, shader(g.FRAGMENT_SHADER, FS))
      g.linkProgram(pr)
      if (!g.getProgramParameter(pr, g.LINK_STATUS)) throw new Error('link')
      g.useProgram(pr)
      g.bindBuffer(g.ARRAY_BUFFER, g.createBuffer())
      g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW) // one triangle covering the screen
      const loc = g.getAttribLocation(pr, 'a')
      g.enableVertexAttribArray(loc)
      g.vertexAttribPointer(loc, 2, g.FLOAT, false, 0, 0)

      // the sky texture: 4096 wide when the screen can show that much detail, else 2048
      const sc = window.screen || { width: W, height: H }
      const Smax = Math.max(Math.min(sc.height, sc.width / 1.35), Math.min(sc.width, sc.height / 1.35))
      const sw = g.getParameter(g.MAX_TEXTURE_SIZE) >= 4096 && 2.5 * Smax * Math.min(dpr, RES) > 2600 ? 4096 : 2048
      const sky = paintStarSphere(sw, sw / 2)
      g.activeTexture(g.TEXTURE0)
      g.bindTexture(g.TEXTURE_2D, g.createTexture())
      g.texImage2D(g.TEXTURE_2D, 0, g.RGBA, g.RGBA, g.UNSIGNED_BYTE, sky)
      sky.width = sky.height = 0 // the GPU has its copy now
      g.generateMipmap(g.TEXTURE_2D) // shrunken stars dim smoothly instead of sparkling
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR_MIPMAP_LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.REPEAT)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
      const an = g.getExtension('EXT_texture_filter_anisotropic') || g.getExtension('WEBKIT_EXT_texture_filter_anisotropic')
      if (an) g.texParameterf(g.TEXTURE_2D, an.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(8, g.getParameter(an.MAX_TEXTURE_MAX_ANISOTROPY_EXT)))

      tab = g.createTexture()
      g.activeTexture(g.TEXTURE1)
      g.bindTexture(g.TEXTURE_2D, tab)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.NEAREST)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.NEAREST)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE)
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE)
      u = Object.fromEntries(['sky', 'tab', 'res', 'c', 'rs', 'thSh', 'f', 'cb', 'f0', 'hd', 'M', 'N'].map((n) => [n, g.getUniformLocation(pr, n)]))
      g.uniform1i(u.sky, 0)
      g.uniform1i(u.tab, 1)
      g.uniform1f(u.N, TABLE)
      gl = g
      D = 0
      fitDistance()
    } catch {
      gl = null
    }
  }

  return {
    canvas: cv,
    get tried() {
      return tried
    },
    init,
    // the screen changed: w, h css px; s the black hole's scale; d device pixels per css px
    fit(w, h, s, d) {
      W = w
      H = h
      S = s
      dpr = d
      fitDistance()
    },
    // draws the lensed sky for hole h (from blackhole.js's hole()) at clock t; false if it can't.
    // sky: the hole as it was before it moved (hole() with m = 0). The sky stays pinned
    // to that, so only the hole and its bending move across it as it settles
    draw(h, sky, t) {
      if (!gl) return false
      const scale = Math.min(dpr, RES), cw = Math.round(W * scale), ch = Math.round(H * scale)
      if (cv.width !== cw || cv.height !== ch) {
        cv.width = cw
        cv.height = ch
      }
      gl.viewport(0, 0, cw, ch)
      const yaw = YAW + SPIN * (t - INTRO_END), pitch = PITCH + PITCH_FROM_TILT * sky.inc // the sky's pose, so it doesn't tip as the disk levels
      const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch)
      gl.uniformMatrix3fv(u.M, false, new Float32Array([cy, sp * sy, -cp * sy, 0, cp, sp, sy, -sp * cy, cp * cy]))
      const rs = h.R * 0.98 * scale
      gl.uniform2f(u.res, cw, ch)
      gl.uniform2f(u.c, h.cx * scale, h.cy * scale)
      gl.uniform1f(u.rs, rs)
      gl.uniform1f(u.thSh, thSh)
      gl.uniform1f(u.f, rs / thSh)
      const f0 = (sky.R * 0.98 * scale) / thSh, dx = (h.cx - sky.cx) * scale, dy = (h.cy - sky.cy) * scale, l = Math.hypot(dx, dy), a = l / f0
      gl.uniform2f(u.cb, sky.cx * scale, sky.cy * scale)
      gl.uniform1f(u.f0, f0)
      gl.uniform3f(u.hd, l > 1e-4 ? (Math.sin(a) * dx) / l : 0, l > 1e-4 ? (-Math.sin(a) * dy) / l : 0, -Math.cos(a)) // the hole's direction in the sky's frame
      gl.drawArrays(gl.TRIANGLES, 0, 3)
      return true
    },
    // free the GPU now rather than whenever the page gets collected
    dispose() {
      tried = true
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
      gl = null
    },
  }
}
