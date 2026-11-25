// The comet's nucleus and its gas, on the GPU (WebGL2). Ported from the comet page (comet.html, demos/comet.js).
// The rock: a lumpy ball with terraces, pits and boulders, ray-marched and lit from the hole, sampled
// 4 x 6 times in every letter cell. Each cell's six regions are matched against every glyph's own shape, so
// ridges, edges and pit rims draw as the glyphs that look like them and flat ground as a density ramp. The gas:
// the coma, jets from the sunlit vents, the curved warm dust tail and the straight blue ion tail, one smooth field
// at reduced resolution, with fine gas glyphs over it. drawComet() puts the rock (opaque) on the 2D canvas, the
// light over it, and a soft bloom. outline() gives the rock's rough outline, for the fire drawn round it. One WebGL2 context for the page, made the first time the comet is drawn.
import { smooth } from './blackhole'

// ---------- knobs ----------
const CELL = 4.6, CELL_PHONE = 4.2 // the rock's letter cells, css px wide (each 1.667 times as tall); phones: under PHONE px wide
const PHONE = 700
const LIGHT_RAKE = 0.16 // how far round toward us the hole's light comes from: low = it rakes across the rock, long shadows
const BALL = 0.6 // the rock's radius, in nucleus radii (asteroid.js SIZE): it is a ball
const LUMPS = 0.06 // how lumpy the ball is: 0 = a perfect sphere (pits and boulders still on it)
const ROLL = 0.075 // how fast it tumbles, radians a second on the page's clock (Skybackground's SPEED runs that clock)
const SCROLL_ROLL = 0.42 // and how far the scroll turns it, radians a screen of scroll
// grid.js's small rocks (drawRocks): the same rock, light and glyphs, but
const SMALL_CELL = 3.0, SMALL_CELL_PHONE = 3.0 // finer letter cells, css px wide (each 1.667 times as tall): more of them across a small rock
const SMALL_RAKE = 1.4 // the hole's light this far round toward us (low: it rakes across them, a lit side and a dark side)
const SMALL_CONTRAST = 1.2 // and how fast their light falls off from there into shadow (the story's: 1.05; higher: a bright lit edge, a dark body, as the comet's rock)
const SMALL_EXPOSE = 0.7 // how bright their lit faces are before they turn to glyphs (the story's: 1.15; higher saturates them to a blob of @)
const SMALL_FILL = 0.25 // and a faint blue light from the sheet under them, strongest on their undersides, so their dark side shows as rock in shadow, not a hole (0 = none)
const SMALL_AMBIENT = 0.55 // how much of that fill reaches the faces turned away from the sheet too
const SMALL_GAIN = 1.3 // how bright their glyphs are against the story's (fine glyphs are thin: they need a little)
const SMALL_SHADOW_EDGE = 12 // how sharp the shadows it casts on itself are (the story's: 22; softer: light spills into its craters, so they don't read as holes)
const SMALL_LIT = [0.88, 0.91, 0.97] // their colour where the hole's light falls full on them (grey rock, warmed by that light)
const SMALL_SHADE = [0.5, 0.47, 0.45] // and where it barely reaches (cool grey: real asteroids are grey to charcoal, a little warm at most)
const SMALL_MOTTLE = 0.45 // how patchy their surface is, lighter and darker ground (the story's: 0.18)
const SMALL_ROUGH = 0.06 // rough ground all over them, bumps at two scales (0 = smooth)
const SMALL_CREASE = 0.05 // and creases between the bumps
const SMALL_KNOBS = 0.9 // smaller lumps on their big ones (against ROCK_LUMPS, grid.js), so their outline is a potato's, not a loaf's
// their craters: few and big bowls, so they read in glyphs (none of the story rock's small pits, fine ridges or boulders)
const SMALL_CRATERS = 1.6 // how many: craters are scattered this densely over it (lower = fewer and further apart)
const SMALL_CRATER_SIZE = 0.36 // how big each is, against the space it has (0..0.5; each varies 40% either way, so no two match)
const SMALL_CRATER_SHARE = 0.5 // the share of the places a crater could be that have one
const SMALL_CRATER_DEPTH = 0.5 // how deep its bowl is, against its radius (shallow: the far wall catches the light)
const SMALL_CRATER_RIM = 0.4 // how high its rim stands, against its depth (it catches the light: a crater, not a hole)
// sunk in its dent: what of it is under the sheet (seen past its dent's near rim) is hidden; just above the sheet it is
// shaded to this much of its light (contact)
const SMALL_CONTACT = 0.7
const SMALL_EMBED_ROUGH = 0.12 // how rough the dent's rim is round it (its units: 0 = smooth, the line it sinks under is clean)
// the rock's letters
const EXPOSURE = 0.98 // how bright the surface is before it is turned into glyphs: higher = denser, brighter glyphs
const SHAPE_GAMMA = 1.6 // how hard a cell's glyph is matched to its bright side: higher = crisper edges
const SHAPE_CONTRAST = 1.4 // how much each region of a cell is stretched against the region next to it before matching
const FLOOR = 0.3 // how much colour the dimmest gas glyphs keep, 0..1
const GAIN = 1.15 // how bright the glyphs off the rock (the gas round it) are
const EDGE = 0.6 // how much the light must change across a cell off the rock for it to draw as a shape, not a density step
const EDGE_ROCK = 0.24 // the same, on the rock (lower = more ridges and rims drawn as shapes)
// the gas
const COMA = 1 // the glow round the rock: 0 = none
const DUST_TAIL = 0 // the broad, curved, warm tail (off)
const ION_TAIL = 0 // the narrow, straight, blue tail (off)
const JETS = 0 // the jets from its sunlit vents (off)
const JET_BEND = 0.2 // how much the hole's light bends the jets back, in nucleus radii
const GAS_GLYPHS = 1.6 // how bright the fine glyphs drawn over the gas are
const BLOOM = 0.3 // the soft glow over the rock and the gas: 0 = none

const MONO = '"JetBrains Mono", Menlo, Consolas, monospace'
const GLYPHS = " .,:;'`\"^-_~=+*<>!|/\\()#%@$o·"
const RAMP_G = [' ', '.', '·', ':', ';', '+', '*', '%', '#', '$', '@'] // sorted by ink in build(); no - or = (they tile into scanlines)

// ---------------- the shaders ----------------
const VS = `#version 300 es
in vec2 a; void main(){ gl_Position = vec4(a, 0., 1.); }`
const NOISE = `
float h31(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.x+p.y)*p.z); }
vec3 h33(vec3 p){ p = fract(p*vec3(.1031,.1030,.0973)); p += dot(p, p.yxz+33.33); return fract((p.xxy+p.yxx)*p.zyx); }
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031); q += dot(q, q.yzx+33.33); return fract((q.x+q.y)*q.z); }
float n3(vec3 x){ vec3 i = floor(x), f = fract(x); f = f*f*(3.-2.*f);
  return mix(mix(mix(h31(i), h31(i+vec3(1,0,0)), f.x), mix(h31(i+vec3(0,1,0)), h31(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(h31(i+vec3(0,0,1)), h31(i+vec3(1,0,1)), f.x), mix(h31(i+vec3(0,1,1)), h31(i+vec3(1,1,1)), f.x), f.y), f.z); }
`
// pass 1: the rock, 4 x 6 samples a cell; rgb its light, a how much of it is there (its silhouette). small: grid.js's
// rocks, each its own shape (a stretched ball cut by a few flat faces, lumps on it) and seed (where its craters
// fall), from uniforms, with a few big craters (SMALL_CRATER*) in place of the story rock's many small pits, fine
// ridges and boulders (smaller than their letter cells), and lit also by a faint blue fill from the sheet (uFill, uAmb);
// drawn every frame, so cheaper: marched more coarsely, shorter shadow rays; else the story's ball
const rockFS = (small) => `#version 300 es
precision highp float;
uniform vec2 uOrigin, uStep, uC;
uniform float uR;
uniform mat3 uRot;
uniform mat2 uAniso; // the stretch undone: screen (y up, in rock radii) -> the round rock's own frame
uniform vec3 uL;
uniform vec3 uClip; // a circle (centre, radius, css px) it is not drawn inside: the hole's shadow eating it (radius 0: none)${small ? `
uniform vec4 uShape, uCut[4]; // its semi-axes and lumps; its flat faces (normal, how far out)
uniform vec3 uSeed;
uniform float uDom; // the sphere it fits in, squared, in its radii
uniform vec4 uFill; // a faint blue light from below (the sheet's): where from, how strong
uniform float uAmb; // how much of it reaches every face
uniform vec4 uSink, uSink2; // the sheet round it: (the way up: its y, z), its centre's height above its dent's bottom, the dent's depth; the well's slope (x, y, z), the dent's width` : ''}
out vec4 o;
${NOISE}
float sdEll(vec3 p, vec3 r){ float k0 = length(p/r), k1 = length(p/(r*r)); return k0*(k0-1.)/k1; }
float smin(float a, float b, float k){ float h = clamp(.5+.5*(b-a)/k, 0., 1.); return mix(b, a, h) - k*h*(1.-h); }
float smax(float a, float b, float k){ return -smin(-a, -b, k); }
float cut(vec3 q, vec3 n, float o){ return dot(q, normalize(n)) - o; }
// a ball, a little lumpy (its pits, terraces and boulders are added on top)
float base(vec3 p){ ${small ? `float a = sdEll(p, uShape.xyz);
  for (int i = 0; i < 4; i++) a = smax(a, cut(p, uCut[i].xyz, uCut[i].w), 0.06);
  return a + uShape.w*(n3((p + uSeed)*1.6 + 4.) - 0.5 + ${SMALL_KNOBS.toFixed(3)}*(n3((p + uSeed)*3.7 + 1.) - 0.5));` : `return length(p) - ${BALL.toFixed(3)} + ${LUMPS.toFixed(3)}*(n3(p*1.6 + 4.) - 0.5);`} }
// pits with steep walls and raised lips, and boulders: nearest feature point of a jittered 2x2x2 neighbourhood
vec2 vor(vec3 q){ vec3 i = floor(q - 0.5); float best = 9.; vec3 id = i;
  for (int z = 0; z <= 1; z++) for (int y = 0; y <= 1; y++) for (int x = 0; x <= 1; x++){
    vec3 c = i + vec3(x, y, z); float dd = length(q - c - h33(c)); if (dd < best){ best = dd; id = c; } }
  return vec2(best, h31(id + 7.7)); }
float detail(vec3 p){
${small ? `  float d = 0.05*(n3(p*2.4)*0.65 + n3(p*4.7 + 3.)*0.35 - 0.5);
  float rb = n3(p*5.5 + 7.)*0.6 + n3(p*11. + 2.)*0.4, rg = 1. - abs(2.*n3(p*6.3 + 5.) - 1.);
  d += ${SMALL_ROUGH.toFixed(3)}*(rb - 0.5) - ${SMALL_CREASE.toFixed(3)}*rg*rg;
  vec2 v = vor(p*${SMALL_CRATERS.toFixed(3)});
  float pr = ${SMALL_CRATER_SIZE.toFixed(3)}*(0.6 + 0.8*fract(v.y*13.1)), x = v.x/pr, dp = ${SMALL_CRATER_DEPTH.toFixed(3)}*pr/${SMALL_CRATERS.toFixed(3)};
  if (v.y < ${SMALL_CRATER_SHARE.toFixed(3)}) d += dp*(max(0., 1. - x*x) - ${SMALL_CRATER_RIM.toFixed(3)}*exp(-(x - 1.)*(x - 1.)*9.));
` : `  float rough = smoothstep(0.38, 0.62, n3(p*1.7 + 9.));
  vec3 ax = normalize(vec3(0.22, 1., 0.18));
  float s = dot(p, ax)*7.5 + 2.6*n3(p*1.9 + 5.) + 0.8*n3(p*4.3 + 1.);
  float terr = floor(s) + smoothstep(0.6, 1., fract(s)) - s;
  float rg = 1. - abs(2.*n3(p*5.2 + 2.) - 1.), rg2 = 1. - abs(2.*n3(p*11.3 + 4.) - 1.);
  float big = n3(p*2.4)*0.65 + n3(p*4.7 + 3.)*0.35;
  float d = 0.04*terr*(0.25 + 0.75*rough) - (0.03*rg*rg + 0.016*rg2*rg2)*(0.3 + 0.7*rough) + 0.05*(big - 0.5);
  vec2 v = vor(p*2.3);
  float pr = 0.17 + 0.16*fract(v.y*13.1), x = v.x/pr;
  if (v.y < 0.36) d += 0.055*smoothstep(1.0, 0.72, x) - 0.012*exp(-(x - 1.05)*(x - 1.05)*28.);
  vec2 bo = vor(p*10.5 + 3.3);
  float bx = bo.x/0.36; if (bo.y < 0.3) d -= 0.011*pow(max(0., 1. - bx*bx), 1.5);
`}  return d;
}
float sdf(vec3 w){
  vec3 p = uRot*w; float d0 = base(p);
  if (d0 > ${small ? '0.22' : '0.12'}) return d0 - ${small ? '0.18' : '0.08'};
  return d0 + detail(p${small ? ' + uSeed' : ''});
}
${small ? `// how far P is above the sheet round it (its dent, a bowl, on the well's slope): below it, negative
float above(vec3 P){ vec3 W = vec3(0., uSink.x, uSink.y); float h = dot(P, W); vec3 ph = P - h*W;
  return h + uSink.z - uSink.w*(1. - uSink2.w*inversesqrt(dot(ph, ph) + uSink2.w*uSink2.w)) - dot(ph, uSink2.xyz); }
` : ''}vec3 nrmAt(vec3 p){ const vec2 k = vec2(1,-1); float e = 0.0035;
  return normalize(k.xyy*sdf(p+k.xyy*e) + k.yyx*sdf(p+k.yyx*e) + k.yxy*sdf(p+k.yxy*e) + k.xxx*sdf(p+k.xxx*e)); }
float shadow(vec3 ro, vec3 rd){ float res = 1., t = 0.02;
  for (int i = 0; i < ${small ? 12 : 28}; i++){ float h = sdf(ro + rd*t); res = min(res, ${small ? SMALL_SHADOW_EDGE.toFixed(1) : '22.'}*h/t); t += clamp(h*0.8, 0.012, 0.12); if (res < 0.002 || t > 2.0) break; }
  return smoothstep(0., 1., clamp(res, 0., 1.)); }
float ao(vec3 p, vec3 n){ float oc = 0., sc = 1.;
  for (int i = 0; i < 4; i++){ float h = 0.02 + 0.06*float(i); float d = sdf(p + n*h); oc += (h - d)*sc; sc *= 0.75; }
  return clamp(1. - 2.5*oc, 0., 1.); }
void main(){
  vec2 p = uOrigin + gl_FragCoord.xy*uStep;
  vec2 d = p - uC;
  vec3 col = vec3(0.); float occ = 0., hit = 0.;
  vec2 q = uAniso*(vec2(d.x, -d.y)/uR); float qq = dot(q, q);
  if (qq < ${small ? 'uDom' : '1.25'} && length(p - uClip.xy) >= uClip.z){
    float zs = sqrt(${small ? 'uDom' : '1.25'} - qq), tt = 0.; vec3 ro = vec3(q, zs);
    for (int i = 0; i < 80; i++){ float dd = sdf(ro - vec3(0, 0, tt)); if (dd < ${small ? '0.005' : '0.0012'}){ hit = 1.; break; } tt += dd*${small ? '0.85' : '0.56'}; if (tt > 2.*zs) break; }
    if (hit > 0.){
      vec3 pw = ro - vec3(0, 0, tt), n = nrmAt(pw), pb = uRot*pw;
      float ci = dot(n, uL), lamb = max(ci, 0.), ce = max(n.z, 0.);
      float diff = mix(lamb, 2.*lamb/(lamb + ce + 0.1), 0.25);
      float sh = ci > 0. ? shadow(pw + n*0.01, uL) : 0., a = ao(pw, n);
      float alb = 1. + ${small ? SMALL_MOTTLE.toFixed(3) : '0.18'}*(n3(${small ? '(pb + uSeed)' : 'pb'}*3.1 + 11.) - 0.5${small ? ' + 0.5*(n3((pb + uSeed)*7.3 + 2.) - 0.5)' : ''});
      float I = clamp(diff*sh*alb*mix(0.45, 1., a)*${small ? SMALL_EXPOSE.toFixed(3) : '1.15'}, 0., 1.);
      float v = pow(I, ${small ? SMALL_CONTRAST.toFixed(3) : '1.05'}); v = mix(v, v*v*(3. - 2.*v), 0.55);
${small ? `      vec3 hue = mix(vec3(${SMALL_SHADE.map((c) => c.toFixed(3))}), vec3(${SMALL_LIT.map((c) => c.toFixed(3))}), smoothstep(0., 0.8, v));
` : `      vec3 hue = v < 0.3 ? mix(vec3(1.0, 0.4, 0.13), vec3(1.0, 0.58, 0.27), v/0.3)
               : v < 0.7 ? mix(vec3(1.0, 0.58, 0.27), vec3(1.0, 0.8, 0.58), (v - 0.3)/0.4)
               : mix(vec3(1.0, 0.8, 0.58), vec3(1.0, 0.93, 0.82), (v - 0.7)/0.3);
`}      vec3 lit = hue*(v/(dot(hue, vec3(0.3, 0.52, 0.18))*0.55 + 0.45));
      float limb = smoothstep(0.6, 0.04, n.z), dark = smoothstep(0.15, -0.2, ci)*(1. - sh*step(0., ci));
      col = lit + vec3(0.42, 0.6, 1.0)*0.55*limb*dark*(0.5 + 0.5*a) + vec3(0.02, 0.025, 0.04)*a;${small ? ` col += vec3(0.42, 0.6, 1.0)*uFill.w*mix(uAmb, 1., max(dot(n, uFill.xyz), 0.))*mix(0.45, 1., a);
      float rim = ${SMALL_EMBED_ROUGH.toFixed(3)}*(n3(pw*4.5 + uSeed) - 0.5), sunk = 1e9; for (int i = 0; i < 8; i++) sunk = min(sunk, above(ro + vec3(0., 0., 3. - (3. + tt)*float(i)/7.)) + rim);
      col *= sunk < 0. ? 0. : mix(${SMALL_CONTACT.toFixed(3)}, 1., smoothstep(0., 0.1, above(pw) + rim));` : ''}
      occ = ${small ? 'sunk < 0. ? 0. : 1.' : '1.'};
    }
  }
  o = vec4(min(col, vec3(1.)), occ);
}`
const FS1 = rockFS(false)
// pass 2: per cell, six region values -> contrast -> the nearest glyph by shape (or a density step where it's flat)
const FS2 = `#version 300 es
precision highp float;
uniform sampler2D uS; uniform highp sampler2D uG; uniform vec2 uSRes; uniform int uNG;
uniform float uExp, uGam, uDirG, uB0, uB1, uEdge, uEdgeI;
uniform int uRamp[16]; uniform int uNR;
out vec4 o;
float lumi(vec3 c){ return dot(c, vec3(0.3, 0.52, 0.18))*0.55 + max(c.r, max(c.g, c.b))*0.45; }
float cur(float x){ return min(1., x*uExp); }
void main(){
  vec2 cc = floor(gl_FragCoord.xy);
  float v[6], e[6]; vec3 cs = vec3(0.); float cov = 0.;
  for (int b = 0; b < 3; b++) for (int a = 0; a < 2; a++){
    int i = b*2 + a;
    vec2 tc = vec2(cc.x*4. + float(a)*2. + 1., cc.y*6. + float(b)*2. + 1.);
    vec4 s4 = texture(uS, tc/uSRes); vec3 s = s4.rgb; cs += s; cov += s4.a/6.; v[i] = cur(lumi(s));
    vec2 ex = vec2(a == 0 ? -2. : 2., b == 0 ? -2. : (b == 2 ? 2. : 0.));
    e[i] = cur(lumi(texture(uS, (tc + ex)/uSRes).rgb));
  }
  float mx = 0., mn = 1., mean = 0.;
  for (int i = 0; i < 6; i++){ mx = max(mx, v[i]); mn = min(mn, v[i]); mean += v[i]/6.; }
  if (mx < 0.1){ o = vec4(0.); return; }
  int bi = 0;
  bool edge = (cov > 0.04 && cov < 0.96) || (cov < 0.04 && mx - mn > uEdge*mx && mx > 0.2)
    || (cov >= 0.96 && mx - mn > uEdgeI*mx && mx > 0.2);
  if (!edge){
    float dth = fract(sin(dot(cc, vec2(12.9898, 78.233)))*43758.5453) - 0.5;
    int ri = int(clamp(floor(pow(mean, 0.95)*float(uNR - 1) + 0.5 + dth*0.6), 0., float(uNR - 1)));
    for (int k = 0; k < 16; k++) if (k == ri) bi = uRamp[k];
  } else {
  float m2 = 0.;
  for (int i = 0; i < 6; i++){ float m = max(v[i], e[i]); if (m > 1e-4) v[i] = pow(v[i]/m, uDirG)*m; m2 = max(m2, v[i]); }
  for (int i = 0; i < 6; i++) v[i] = pow(v[i]/max(m2, 1e-4), uGam)*m2;
  float best = 1e9, vm = (v[0] + v[1] + v[2] + v[3] + v[4] + v[5])/6.;
  bool inner = cov >= 0.96;
  for (int k = 0; k < 128; k++){ if (k >= uNG) break;
    vec4 g0 = texelFetch(uG, ivec2(k, 0), 0); vec2 g1 = texelFetch(uG, ivec2(k, 1), 0).xy;
    float gm = (g0.x + g0.y + g0.z + g0.w + g1.x + g1.y)/6., o = inner ? gm - vm : 0.;
    vec4 d0 = g0 - vec4(v[0], v[1], v[2], v[3]) - o; vec2 d1 = g1 - vec2(v[4], v[5]) - o;
    float dd = dot(d0, d0) + dot(d1, d1) + (inner ? 2.4*o*o : 0.);
    if (dd < best){ best = dd; bi = k; } }
  }
  vec3 avg = cs/6.; float am = max(avg.r, max(avg.g, avg.b));
  vec3 hue = avg/max(am, 1e-4);
  vec3 rk = hue*min(1., pow(am, 0.62)*1.1);
  o = vec4(mix(max(min(avg*uB1, vec3(1.)), hue*uB0), rk, smoothstep(0.3, 0.7, cov)), float(bi)/255.);
}`
// pass 3: the glyphs at device resolution; black wherever the rock is (it hides what is behind it)
const FS3 = `#version 300 es
precision highp float;
uniform sampler2D uCells, uAtlas, uS;
uniform vec2 uOrigin, uCell, uSRes, uACell, uARes, uPad, uGrid;
uniform float uDpr, uHd; uniform int uACols;
out vec4 o;
void main(){
  vec2 ps = vec2(gl_FragCoord.x, uHd - gl_FragCoord.y)/uDpr;
  vec2 g = (ps - uOrigin)/uCell;
  if (g.x < 0. || g.y < 0. || g.x >= uGrid.x || g.y >= uGrid.y){ o = vec4(0.); return; }
  ivec2 ci = ivec2(floor(g)); vec2 f = fract(g);
  vec4 c = texelFetch(uCells, ci, 0);
  int gi = int(c.a*255. + 0.5);
  float cov = 0.;
  if (gi > 0){
    vec2 inner = uACell - 2.*uPad;
    vec2 base = vec2(float(gi % uACols), float(gi / uACols))*uACell + uPad;
    vec2 auv = (base + f*inner)/uARes;
    vec2 dx = vec2(inner.x/(uCell.x*uDpr)/uARes.x, 0.), dy = vec2(0., inner.y/(uCell.y*uDpr)/uARes.y);
    cov = textureGrad(uAtlas, auv, dx, dy).a;
  }
  float occ = smoothstep(0.3, 0.8, texture(uS, g*vec2(4., 6.)/uSRes).a);
  o = vec4(c.rgb*cov, max(cov, occ));
}`
// the gas: coma, jets, dust tail and ion tail, one emission field at reduced resolution (css px, y down). rgb: the
// light (what is behind the rock hidden by it, a little coma and the near jets in front); a: how much fine structure
// there is, flowing outward (it decides the gas glyphs drawn over the smooth light)
const NJ = 36
const FS_GAS = `#version 300 es
precision highp float;
uniform vec2 uC, uA, uN, uSOrigin, uSCell, uSRes;
uniform float uR, uT, uVis, uGS;
uniform vec4 uComa, uDust, uDustK, uIon;
uniform vec3 uHole;
uniform vec4 uJ0[${NJ}], uJ1[${NJ}], uJ2[${NJ}];
uniform int uNJ;
uniform sampler2D uS;
out vec4 o;
${NOISE}
void main(){
  vec2 p = (gl_FragCoord.xy)*uGS;
  vec2 sg = (p - uSOrigin)/uSCell;
  float occ = smoothstep(0.25, 0.75, texture(uS, sg*vec2(4., 6.)/uSRes).a);
  vec2 d = p - uC; float dl = length(d); vec2 dn = d/max(dl, 1e-3);
  float u = dot(d, uA), v = dot(d, uN), cs = u/max(dl, 1e-3), sunw = max(0., -cs);
  float px = uGS;
  float rho = dl/uR, rr = sqrt(rho*rho + 0.35);
  float lrr = log(rr);
  float st = 0.55*n3(vec3(dn*7., lrr*1.4 - uT*0.16)) + 0.45*n3(vec3(dn*16. + 3., lrr*2.4 - uT*0.27));
  float stK = smoothstep(4., 30., uR);
  float env = exp(-dl/(uComa.y*(1. + 0.12*sunw)));
  float stc = stK*smoothstep(1.1, 2.6, rho);
  float coma0 = uComa.x/rr*(1. + 0.8*sunw*exp(-rho*0.3))*env, coma = coma0*(1. + stc*0.7*(st - 0.5));
  float pt = uComa.z*exp(-dl*dl/(2.*uComa.w*uComa.w));
  vec3 jf = vec3(0.), jb = vec3(0.); float gJ = 0.;
  for (int i = 0; i < ${NJ}; i++){ if (i >= uNJ) break;
    vec4 a = uJ0[i], b = uJ1[i], c = uJ2[i];
    vec2 q = p - a.xy; float D2 = dot(a.zw, a.zw);
    float s = max(0., dot(q, a.zw)/max(D2, 1e-4));
    if (s > c.w*3.5) continue;
    for (int k = 0; k < 2; k++){ vec2 cp = a.zw*s + b.xy*s*s, tg = a.zw + 2.*b.xy*s; s = max(0., s + dot(q - cp, tg)/max(dot(tg, tg), 1e-4)); }
    vec2 cp = a.zw*s + b.xy*s*s, tg = normalize(a.zw + 2.*b.xy*s);
    vec2 e = q - cp; float off = e.x*(-tg.y) + e.y*tg.x, al = dot(e, tg);
    float wp = uR*(0.014 + 0.075*s), wq = max(wp, 0.75*px);
    float x = off/wq; if (abs(x) > 3.5) continue;
    float cap = exp(-max(-al, 0.)*max(-al, 0.)/(wq*wq)*3.);
    float seed = b.w, tE = uT - s*0.55;
    float pulse = 0.5 + 0.5*sin(tE*(0.55 + 0.5*fract(seed*7.31)) + seed*6.283)*(0.7 + 0.3*sin(tE*0.21 + seed*17.));
    float fil = n3(vec3(x*1.4 + seed*13., s*1.3 - uT*0.75, seed*5.));
    float fall = pow(0.014/(0.014 + 0.075*s), 1.3)*(wp/wq)*exp(-s/c.w);
    float fil2 = n3(vec3(x*3.1 + seed*7., s*2.4 - uT*1.1, seed*3. + 1.));
    float I = 3.4*b.z*fall*exp(-x*x*1.5)*cap*(0.2 + 1.2*fil*fil)*(0.55 + 0.7*fil2)*pulse;
    float zf = c.x + c.y*s + c.z*s*s, fr = smoothstep(-0.12, 0.18, zf);
    vec3 jc = mix(vec3(1., 0.95, 0.86), vec3(1., 0.9, 0.78), smoothstep(0., 2., s));
    jf += jc*I*fr; jb += jc*I*(1. - fr);
    float gn = n3(vec3(off/(px*2.2) + seed*3., (s*uR - uT*uR*0.5)/(px*5.), seed*9. + 2.));
    gJ = max(gJ, smoothstep(0.6, 0.9, gn)*smoothstep(0.01, 0.12, I)*smoothstep(0.08, 0.5, s));
  }
  float Ld = uDust.x, uu = max(u, 0.), vc = uDust.w*uu*uu, w = uDust.y + uDust.z*uu, tc = (v - vc)/w;
  float lead = smoothstep(-0.95, -0.5, tc), trail = exp(-pow(max(tc + 0.42, 0.)/0.85, 1.5));
  float head = exp(-min(u, 0.)*min(u, 0.)/(uDust.y*uDust.y*0.6));
  float along = head*(0.3 + 0.7*smoothstep(0., 2.5*uR, uu))*exp(-uu/Ld*1.15)/(1. + uu/(0.22*Ld))*mix(1., uDust.y/w, 0.3);
  float sx = uu/Ld;
  float stri = n3(vec3((tc + sx*0.9)*4.2, sx*1.3 - uT*0.006, 3.1));
  float dust = uDustK.x*lead*trail*along*(1. + uDustK.y*(stri - 0.5)*smoothstep(0.08, 0.4, sx));
  float lam = max(uDustK.z, px*1.2);
  float gd = n3(vec3((uu - uT*lam*2.2)/(lam*2.6), (v - vc)/(lam*0.9), 7.));
  float gD = smoothstep(0.7, 0.95, gd)*smoothstep(0.004, 0.05, dust)*smoothstep(3., 9., w/lam);
  vec3 dcol = mix(vec3(1., 0.86, 0.66), vec3(1., 0.74, 0.46), smoothstep(0., 0.5, sx));
  float Li = uIon.x, wi = uIon.y + uIon.z*uu, si = uu/Li;
  float kink = (sin(si*11. - uT*0.9)*0.6 + sin(si*5.3 - uT*0.5 + 1.3)*0.4)*si*si*0.9;
  float ti = (v - kink*wi)/wi;
  float ray = n3(vec3(ti*2.2, (si - uT*0.035)*7., 11.)), ray2 = n3(vec3(ti*5.1, (si - uT*0.05)*12., 4.));
  float rays = 0.15 + 2.2*pow(ray, 3.) + 0.5*ray2*ray2;
  float bph = fract(uT*0.035 + 0.35), ub = bph*1.15;
  float knot = exp(-pow((si - ub)/0.045, 2.))*smoothstep(0., 0.12, bph)*(1. - smoothstep(0.75, 1., bph));
  float ihead = exp(-min(u, 0.)*min(u, 0.)/(uIon.y*uIon.y*4.));
  float ion = uIon.w*ihead*exp(-ti*ti*0.9)*rays*(1. + 1.4*knot)*exp(-si*1.6)*(uIon.y/(uIon.y + 0.35*uIon.z*uu));
  float gI = smoothstep(0.64, 0.9, n3(vec3((v - kink*wi)/(lam*0.9), (uu - uT*lam*5.)/(lam*3.5), 5.)))*smoothstep(0.004, 0.05, ion)*smoothstep(2., 6., wi/lam);
  vec3 icol = vec3(0.42, 0.64, 1.0);
  vec3 ccol = vec3(1., 0.9, 0.78);
  vec3 back = ccol*coma*0.88 + dcol*dust + icol*ion + jb;
  vec3 front = ccol*coma0*0.12 + jf*(1. - 0.55*occ) + vec3(1., 0.95, 0.88)*pt;
  vec3 E = back*(1. - occ) + front;
  E *= 1. - 0.8*smoothstep(1.45, 0.95, length(p - uHole.xy)/uHole.z);
  vec3 col = 1. - exp(-E*1.15);
  float gsum = max(gJ, max(gD, gI))*(1. - occ);
  o = vec4(col*uVis, clamp(gsum, 0., 1.)*uVis);
}`
// full resolution: the smooth light upsampled (bicubic), and fine gas glyphs on the rock's grid whose density follows the field
const FS_OUT = `#version 300 es
precision highp float;
uniform sampler2D uGas, uAtlas, uS;
uniform vec2 uGRes, uOrigin, uCell, uSRes, uACell, uARes, uPad, uGrid, uC, uA, uN;
uniform float uGS, uDpr, uHd, uGlyphA, uR, uCurv; uniform int uACols;
uniform int uGI[10];
out vec4 o;
float h21(vec2 p){ vec3 q = fract(vec3(p.xyx)*.1031); q += dot(q, q.yzx+33.33); return fract((q.x+q.y)*q.z); }
vec4 cubic(float v){ vec4 n = vec4(1., 2., 3., 4.) - v; vec4 s = n*n*n; float x = s.x, y = s.y - 4.*s.x, z = s.z - 4.*s.y + 6.*s.x; return vec4(x, y, z, 6. - x - y - z)/6.; }
vec4 bicubic(vec2 tc){
  tc -= 0.5; vec2 f = fract(tc); tc -= f;
  vec4 xc = cubic(f.x), yc = cubic(f.y), c = tc.xxyy + vec2(-0.5, 1.5).xyxy;
  vec4 s = vec4(xc.xz + xc.yw, yc.xz + yc.yw), of = (c + vec4(xc.yw, yc.yw)/s)/uGRes.xxyy;
  vec4 s0 = texture(uGas, of.xz), s1 = texture(uGas, of.yz), s2 = texture(uGas, of.xw), s3 = texture(uGas, of.yw);
  float sx = s.x/(s.x + s.y), sy = s.z/(s.z + s.w);
  return mix(mix(s3, s2, sx), mix(s1, s0, sx), sy);
}
float glyph(int gi, vec2 f){
  vec2 inner = uACell - 2.*uPad, base = vec2(float(gi % uACols), float(gi / uACols))*uACell + uPad;
  vec2 dx = vec2(inner.x/(uCell.x*uDpr)/uARes.x, 0.), dy = vec2(0., inner.y/(uCell.y*uDpr)/uARes.y);
  return textureGrad(uAtlas, (base + f*inner)/uARes, dx, dy).a;
}
int pick(int lv, float hh, vec2 fd){
  if (lv <= 0) return hh < 0.5 ? uGI[0] : uGI[1];
  if (lv == 1) return hh < 0.5 ? uGI[2] : uGI[3];
  if (lv == 2) return hh < 0.5 ? uGI[4] : uGI[5];
  float a = mod(atan(-fd.y, fd.x), 3.14159265);
  int k = int(floor(a/0.785398 + 0.5)) % 4;
  return uGI[6 + k];
}
void main(){
  vec2 ps = vec2(gl_FragCoord.x, uHd - gl_FragCoord.y)/uDpr;
  vec3 col = max(bicubic(ps/uGS).rgb, 0.);
  vec2 g = (ps - uOrigin)/uCell;
  if (g.x >= 0. && g.y >= 0. && g.x < uGrid.x && g.y < uGrid.y){
    vec2 ci = floor(g), f = fract(g), cc = uOrigin + (ci + 0.5)*uCell;
    vec4 gs = texture(uGas, (cc/uGS)/uGRes);
    float occ = smoothstep(0.2, 0.6, texture(uS, (ci + 0.5)*vec2(4., 6.)/uSRes).a);
    float dn = gs.a*(1. - occ);
    float hh = h21(ci + 17.3);
    if (dn > 0.02){
      vec2 d = cc - uC; float dl = length(d), u = dot(d, uA);
      vec2 td = normalize(uA + 2.*uCurv*max(u, 0.)*uN);
      vec2 fd = normalize(mix(d/max(dl, 1e-3), td, smoothstep(1.3*uR, 4.*uR + 20., dl)));
      float lvf = clamp(dn*3.2, 0., 3.); int l0 = int(floor(lvf)); float lw = smoothstep(0.3, 0.7, fract(lvf));
      float cov = glyph(pick(l0, hh, fd), f)*(1. - lw) + (l0 < 3 ? glyph(pick(l0 + 1, hh, fd), f)*lw : 0.);
      col += gs.rgb*cov*smoothstep(0.02, 0.25, dn)*uGlyphA;
    }
  }
  col = clamp(col + (h21(gl_FragCoord.xy) - 0.5)/255., 0., 1.);
  o = vec4(col, max(col.r, max(col.g, col.b)));
}`

// ---------------- the body: a slow tumble and the vents its jets blow from ----------------
const hash1 = (i) => { const v = Math.sin(i * 127.1 + 311.7) * 43758.5453; return v - Math.floor(v) }
const LOBES = [0, 1].map(() => ({ c: [0, 0, 0], r: [BALL, BALL, BALL] })) // the ball, twice: vents and outline read it as two lobes
const VENTS = Array.from({ length: 30 }, (_, i) => { // spread evenly over both lobes (a Fibonacci sphere on each)
  const lb = i % 3 === 2 ? 1 : 0, j = lb ? (i - 2) / 3 : i - Math.floor(i / 3), nn = lb ? 10 : 20, y = 1 - (2 * (j + 0.5)) / nn, rr = Math.sqrt(1 - y * y), ph = j * 2.39996 + lb * 1.3
  const u = [Math.cos(ph) * rr, y, Math.sin(ph) * rr], L = LOBES[lb], p = u.map((v, k) => L.c[k] + L.r[k] * v * 0.96), n = u.map((v, k) => v / L.r[k]), nl = Math.hypot(...n)
  return { p, n: n.map((v) => v / nl), i, w: 0.08 + 0.4 * Math.pow(hash1(i), 2.2), len: 0.7 + 0.9 * hash1(i + 40) }
}).concat(Array.from({ length: 7 }, (_, j) => { // a ring of the strongest jets
  const ph = j * 0.9 + 0.4, n = [0.28, Math.cos(ph), Math.sin(ph)], nl = Math.hypot(...n)
  return { p: n.map((v) => (v / nl) * BALL * 0.96), n: n.map((v) => v / nl), i: 30 + j, w: 0.25 + 0.4 * hash1(j + 70), len: 0.8 + 0.8 * hash1(j + 90) }
}))
// a slow roll about the long axis (so the two lobes always read), with a little precession: body -> world, row major
function rotOf(s, t) {
  const a = 2.2 + ROLL * t + SCROLL_ROLL * s, b = 0.12 * Math.sin(0.05 * t + 0.3 * s + 0.6), c = -0.42 + 0.06 * Math.sin(0.031 * t + 2.0)
  const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b), cc = Math.cos(c), sc = Math.sin(c)
  const Rx = [1, 0, 0, 0, ca, -sa, 0, sa, ca], Ry = [cb, 0, sb, 0, 1, 0, -sb, 0, cb], Rz = [cc, -sc, 0, sc, cc, 0, 0, 0, 1]
  const mul = (A, B) => { const R = new Array(9); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) R[i * 3 + j] = A[i * 3] * B[j] + A[i * 3 + 1] * B[3 + j] + A[i * 3 + 2] * B[6 + j]; return R }
  return mul(Rz, mul(Ry, Rx))
}
// The rock's outline on screen, roughly (its two lobes as plain ellipsoids, before the flat faces cut them):
// out[k] = how far its edge is from its centre at screen angle 2 PI k / out.length (y down), in nucleus radii
export function outline(s, t, out) {
  const R = rotOf(s, t), L = LOBES.map(({ c, r }) => {
    const a = [R[0] * r[0], R[1] * r[1], R[2] * r[2]], b = [R[3] * r[0], R[4] * r[1], R[5] * r[2]] // the lobe's axes on screen (y up)
    const e00 = a[0] * a[0] + a[1] * a[1] + a[2] * a[2], e01 = a[0] * b[0] + a[1] * b[1] + a[2] * b[2], e11 = b[0] * b[0] + b[1] * b[1] + b[2] * b[2], det = e00 * e11 - e01 * e01
    return { qa: e11 / det, qb: -e01 / det, qc: e00 / det, px: R[0] * c[0] + R[1] * c[1] + R[2] * c[2], py: R[3] * c[0] + R[4] * c[1] + R[5] * c[2] }
  })
  for (let k = 0; k < out.length; k++) {
    const th = (2 * Math.PI * k) / out.length, dx = Math.cos(th), dy = -Math.sin(th)
    let best = 0
    for (const { qa, qb, qc, px, py } of L) { // the far crossing of the ray from the centre with this lobe's projected ellipse
      const dd = qa * dx * dx + 2 * qb * dx * dy + qc * dy * dy, dp = qa * dx * px + qb * (dx * py + dy * px) + qc * dy * py
      const disc = dp * dp - dd * (qa * px * px + 2 * qb * px * py + qc * py * py - 1)
      if (disc >= 0) best = Math.max(best, (dp + Math.sqrt(disc)) / dd)
    }
    out[k] = best
  }
  return out
}
// each sunlit vent's filament on screen: it leaves along the surface normal and the light bends it back
const J = { j0: new Float32Array(NJ * 4), j1: new Float32Array(NJ * 4), j2: new Float32Array(NJ * 4), n: 0 }
function jetsOf(x, y, r, R, L3, t) {
  const w = (v) => [R[0] * v[0] + R[1] * v[1] + R[2] * v[2], R[3] * v[0] + R[4] * v[1] + R[5] * v[2], R[6] * v[0] + R[7] * v[1] + R[8] * v[2]]
  const aw = [-L3[0], -L3[1], -L3[2]]
  let n = 0
  for (const V of VENTS) {
    if (n >= NJ) break
    const pw = w(V.p), nw = w(V.n), sun = nw[0] * L3[0] + nw[1] * L3[1] + nw[2] * L3[2], i = V.i
    const flick = 0.75 + 0.25 * Math.sin(t * (0.21 + 0.07 * (i % 5)) + i * 2.1) * Math.sin(t * 0.13 + i * 0.7)
    const A = V.w * smooth((sun + 0.22) / 0.5) * flick * smooth((Math.hypot(nw[0], nw[1]) - 0.12) / 0.3) // only the sunlit vents blow; head-on ones hide in the coma
    if (A < 0.01) continue
    const o = n * 4
    J.j0.set([x + r * pw[0], y - r * pw[1], r * nw[0], -r * nw[1]], o)
    J.j1.set([r * JET_BEND * aw[0], -r * JET_BEND * aw[1], A * JETS, hash1(i * 3.7 + 1)], o)
    J.j2.set([pw[2], nw[2], JET_BEND * aw[2], V.len], o)
    n++
  }
  J.n = n
  return J
}

// ---------------- WebGL ----------------
let G = null // null: not tried yet; false: no WebGL2 here (or it failed); else the context and its targets

function init() {
  const cv = document.createElement('canvas')
  const gl = cv.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
  if (!gl) return false
  const sh = (type, src) => {
    const s = gl.createShader(type)
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s))
    return s
  }
  const prog = (fs) => {
    const p = gl.createProgram()
    gl.attachShader(p, sh(gl.VERTEX_SHADER, VS))
    gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs))
    gl.bindAttribLocation(p, 0, 'a')
    gl.linkProgram(p)
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p))
    const u = {}, n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS)
    for (let i = 0; i < n; i++) { const a = gl.getActiveUniform(p, i); u[a.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, a.name) }
    return { p, u }
  }
  const g = { gl, cv, p1: prog(FS1), p2: prog(FS2), p3: prog(FS3), p4: prog(FS_GAS), p5: prog(FS_OUT), key: '' }
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW) // one triangle over the whole target
  gl.enableVertexAttribArray(0)
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)
  const tex = (filter) => {
    const t = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter === gl.LINEAR_MIPMAP_LINEAR ? gl.LINEAR : filter)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    return t
  }
  Object.assign(g, { tS: tex(gl.LINEAR), tC: tex(gl.NEAREST), tA: tex(gl.LINEAR_MIPMAP_LINEAR), tG: tex(gl.NEAREST), tGas: tex(gl.LINEAR) })
  Object.assign(g, { fS: gl.createFramebuffer(), fC: gl.createFramebuffer(), fGas: gl.createFramebuffer() })
  g.half = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float')
  // the browser can take the GPU away: draw the fallback until it gives it back, then start over
  cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); g.lost = true })
  cv.addEventListener('webglcontextrestored', () => { if (G === g) G = null })
  g.glow = document.createElement('canvas')
  g.gx = g.glow.getContext('2d')
  g.prog = prog // drawRocks compiles its own pass 1 the first time it is used
  return g
}

// for this screen: the glyph atlas and each glyph's 6-D shape vector (2 columns x 3 rows of coverage), and the targets
function build(W, H, dpr, cw) {
  const { gl } = G
  G.cv.width = Math.round(W * dpr)
  G.cv.height = Math.round(H * dpr)
  G.glow.width = Math.max(1, Math.round(W / 3))
  G.glow.height = Math.max(1, Math.round(H / 3))
  const IW = 30, IH = 50, PAD = 3, AW = IW + 2 * PAD, AH = IH + 2 * PAD, COLS = 16, ROWS = Math.ceil(GLYPHS.length / COLS)
  const ac = document.createElement('canvas')
  ac.width = AW * COLS
  ac.height = AH * ROWS
  const ax = ac.getContext('2d', { willReadFrequently: true })
  ax.fillStyle = '#fff'
  ax.font = `600 44px ${MONO}`
  ax.textAlign = 'center'
  ax.textBaseline = 'middle'
  ;[...GLYPHS].forEach((ch, i) => ax.fillText(ch, (i % COLS) * AW + PAD + IW / 2, Math.floor(i / COLS) * AH + PAD + IH / 2 + 1))
  const img = ax.getImageData(0, 0, ac.width, ac.height).data, NG = GLYPHS.length, vec = new Float32Array(NG * 6), mx = new Float32Array(6)
  for (let i = 0; i < NG; i++) {
    const ox = (i % COLS) * AW + PAD, oy = Math.floor(i / COLS) * AH + PAD
    for (let b = 0; b < 3; b++) for (let a = 0; a < 2; a++) {
      let sum = 0, n = 0
      const x0 = ox + (a * IW) / 2, y0 = oy + (b * IH) / 3
      for (let y = 0; y < IH / 3; y++) for (let x = 0; x < IW / 2; x++) { sum += img[4 * ((Math.floor(y0) + y) * ac.width + Math.floor(x0) + x) + 3]; n++ }
      const v = sum / n / 255
      vec[i * 6 + b * 2 + a] = v
      mx[b * 2 + a] = Math.max(mx[b * 2 + a], v)
    }
  }
  const gd = new Float32Array(NG * 2 * 4)
  for (let i = 0; i < NG; i++) for (let k = 0; k < 6; k++) gd[((k < 4 ? 0 : 1) * NG + i) * 4 + (k < 4 ? k : k - 4)] = vec[i * 6 + k] / (mx[k] || 1)
  gl.bindTexture(gl.TEXTURE_2D, G.tG)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, NG, 2, 0, gl.RGBA, gl.FLOAT, gd)
  gl.bindTexture(gl.TEXTURE_2D, G.tA)
  gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, false)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ac)
  gl.generateMipmap(gl.TEXTURE_2D)
  const ink = (c) => { const i = GLYPHS.indexOf(c); let v = 0; for (let k = 0; k < 6; k++) v += vec[i * 6 + k]; return v }
  Object.assign(G, { RAMP: new Int32Array([...RAMP_G].sort((a, b) => ink(a) - ink(b)).map((c) => GLYPHS.indexOf(c))), NG, ACOLS: COLS, ACELL: [AW, AH], ARES: [ac.width, ac.height], APAD: PAD })
  G.GI = new Int32Array(['.', '·', ',', '`', ':', "'", '-', '/', '|', '\\'].map((c) => GLYPHS.indexOf(c)))
  // the rock's targets, for a grid over the whole screen
  G.maxCols = Math.ceil(W / cw) + 3
  G.maxRows = Math.ceil(H / (cw * 1.667)) + 3
  G.sw = G.maxCols * 4
  G.sh = G.maxRows * 6
  const target = (t, f, fmt, w, h, type) => {
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.texImage2D(gl.TEXTURE_2D, 0, fmt, w, h, 0, gl.RGBA, type, null)
    gl.bindFramebuffer(gl.FRAMEBUFFER, f)
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, t, 0)
    return gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE
  }
  target(G.tS, G.fS, gl.RGBA8, G.sw, G.sh, gl.UNSIGNED_BYTE)
  target(G.tC, G.fC, gl.RGBA8, G.maxCols, G.maxRows, gl.UNSIGNED_BYTE)
  // the gas, at a reduced resolution (css px per texel), half float where it can render to it (no banding in the faint glow)
  G.GS = Math.max(2, Math.max(W, H) / 760)
  G.gw = Math.ceil(W / G.GS) + 2
  G.gh = Math.ceil(H / G.GS) + 2
  if (!(G.half && target(G.tGas, G.fGas, gl.RGBA16F, G.gw, G.gh, gl.HALF_FLOAT))) target(G.tGas, G.fGas, gl.RGBA8, G.gw, G.gh, gl.UNSIGNED_BYTE)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
}

// Draws the comet onto ctx. o: { W, H, dpr (the screen), x, y, r (the nucleus' centre and radius, css px), h (the hole:
// the light comes from it, and its shadow stays dark), s (scroll, screens), t (the clock), vis (0..1: the gas fades in),
// aniso (optional: the rock stretched, as the column-major 2x2 matrix taking screen offsets, y up, back to the round rock),
// clip (optional: { cx, cy, R }, css px: a circle it is not drawn inside, the hole's shadow) }.
// False if it can't (no WebGL2, or the GPU has gone away): the caller draws something else
export function drawComet(ctx, o) {
  try {
    const cw = ready(o.W, o.H, o.dpr)
    if (!cw) return false
    draw(ctx, o, cw)
    return true
  } catch (e) {
    console.warn('comet: WebGL2 failed, drawing without it', e)
    G = false
    return false
  }
}
// the context and its targets for this screen: the rock's cell width, or 0 if there is no WebGL2 (or the GPU has gone)
function ready(W, H, dpr) {
  if (G === null) G = init()
  if (!G || G.lost) return 0
  // rebuilt for a new screen, and once more when the font arrives (the atlas is drawn in it)
  const cw = W < PHONE ? CELL_PHONE : CELL, key = [W, H, dpr, cw, !!document.fonts?.check(`500 44px ${MONO}`)].join()
  if (G.key !== key) {
    build(W, H, dpr, cw)
    G.key = key
  }
  return cw
}

const ROUND = new Float32Array([1, 0, 0, 1])
function draw(ctx, { W, H, dpr, x, y, r, h, s, t, vis, aniso, clip }, cw) {
  const { gl } = G, ch = cw * 1.667, big = Math.max(W, H), sc = big / 1440
  // the light comes from the hole; the tails stream away from it, the dust lagging to the right
  let lx = h.cx - x, ly = h.cy - y
  const ll = Math.hypot(lx, ly) || 1
  lx /= ll
  ly /= ll
  const anti = [-lx, -ly], nrm = ly >= 0 ? [ly, -lx] : [-ly, lx]
  const L3n = [lx, -ly, LIGHT_RAKE], l3 = Math.hypot(...L3n), L3 = L3n.map((v) => v / l3), R = rotOf(s, t), jets = jetsOf(x, y, r, R, L3, t)
  const dust = [1.25 * big, 0.5 * r, 0.36, 0.42 / (1.25 * big)] // length, width at the head, widening, curve
  // the rock's grid, anchored to its centre so its glyphs move with it
  const ox = Math.round((x - cw * Math.ceil(x / cw)) * dpr) / dpr, oy = Math.round((y - ch * Math.ceil(y / ch)) * dpr) / dpr
  const cols = Math.min(G.maxCols, Math.ceil((W - ox) / cw) + 1), rows = Math.min(G.maxRows, Math.ceil((H - oy) / ch) + 1)
  const atlas = (u) => {
    gl.uniform2f(u.uACell, G.ACELL[0], G.ACELL[1])
    gl.uniform2f(u.uARes, G.ARES[0], G.ARES[1])
    gl.uniform2f(u.uPad, G.APAD, G.APAD)
    gl.uniform1i(u.uACols, G.ACOLS)
    gl.uniform2f(u.uOrigin, ox, oy)
    gl.uniform2f(u.uCell, cw, ch)
    gl.uniform2f(u.uSRes, G.sw, G.sh)
    gl.uniform2f(u.uGrid, cols, rows)
    gl.uniform1f(u.uDpr, dpr)
    gl.uniform1f(u.uHd, G.cv.height)
  }
  const bind = (unit, t, loc) => {
    gl.activeTexture(gl.TEXTURE0 + unit)
    gl.bindTexture(gl.TEXTURE_2D, t)
    gl.uniform1i(loc, unit)
  }
  gl.disable(gl.BLEND)
  // pass 1: the scene, 4 x 6 samples a cell
  let u = G.p1.u
  gl.useProgram(G.p1.p)
  gl.bindFramebuffer(gl.FRAMEBUFFER, G.fS)
  gl.viewport(0, 0, cols * 4, rows * 6)
  gl.uniform2f(u.uOrigin, ox, oy)
  gl.uniform2f(u.uStep, cw / 4, ch / 6)
  gl.uniform2f(u.uC, x, y)
  gl.uniform1f(u.uR, r)
  gl.uniformMatrix3fv(u.uRot, false, new Float32Array(R))
  gl.uniformMatrix2fv(u.uAniso, false, aniso || ROUND)
  gl.uniform3f(u.uL, L3[0], L3[1], L3[2])
  gl.uniform3f(u.uClip, clip ? clip.cx : 0, clip ? clip.cy : 0, clip ? clip.R : 0)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  // pass 2: a glyph per cell
  u = G.p2.u
  gl.useProgram(G.p2.p)
  gl.bindFramebuffer(gl.FRAMEBUFFER, G.fC)
  gl.viewport(0, 0, cols, rows)
  cells(u)
  // the gas, at reduced resolution (it reads the rock's silhouette from the scene)
  u = G.p4.u
  gl.useProgram(G.p4.p)
  gl.bindFramebuffer(gl.FRAMEBUFFER, G.fGas)
  gl.viewport(0, 0, G.gw, G.gh)
  bind(0, G.tS, u.uS)
  gl.uniform2f(u.uC, x, y)
  gl.uniform2f(u.uA, anti[0], anti[1])
  gl.uniform2f(u.uN, nrm[0], nrm[1])
  gl.uniform2f(u.uSOrigin, ox, oy)
  gl.uniform2f(u.uSCell, cw, ch)
  gl.uniform2f(u.uSRes, G.sw, G.sh)
  gl.uniform1f(u.uR, r)
  gl.uniform1f(u.uT, t)
  gl.uniform1f(u.uVis, vis)
  gl.uniform1f(u.uGS, G.GS)
  gl.uniform4f(u.uComa, 0.26 * COMA, 1.25 * r, 0, Math.max(0.6 * r, 2.2 * sc))
  gl.uniform4fv(u.uDust, dust)
  gl.uniform4f(u.uDustK, 0.8 * DUST_TAIL, 0.55, cw * 1.1, 0)
  gl.uniform4f(u.uIon, 1.6 * big, 0.05 * r, 0.04, 0.32 * ION_TAIL)
  gl.uniform3f(u.uHole, h.cx, h.cy, h.R)
  gl.uniform4fv(u.uJ0, jets.j0)
  gl.uniform4fv(u.uJ1, jets.j1)
  gl.uniform4fv(u.uJ2, jets.j2)
  gl.uniform1i(u.uNJ, jets.n)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  // pass 3: the rock's glyphs at device resolution, onto the page (opaque: it hides what is behind it)
  u = G.p3.u
  gl.useProgram(G.p3.p)
  gl.bindFramebuffer(gl.FRAMEBUFFER, null)
  gl.viewport(0, 0, G.cv.width, G.cv.height)
  gl.clearColor(0, 0, 0, 0)
  gl.clear(gl.COLOR_BUFFER_BIT)
  bind(0, G.tC, u.uCells)
  bind(1, G.tA, u.uAtlas)
  bind(2, G.tS, u.uS)
  atlas(u)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = vis
  ctx.drawImage(G.cv, 0, 0)
  const { glow, gx } = G
  gx.setTransform(1, 0, 0, 1, 0, 0)
  gx.globalCompositeOperation = 'source-over'
  gx.clearRect(0, 0, glow.width, glow.height)
  gx.filter = 'blur(3px)'
  gx.drawImage(G.cv, 0, 0, glow.width, glow.height)
  // then the light and the gas glyphs, in the same canvas, over it
  u = G.p5.u
  gl.useProgram(G.p5.p)
  gl.clear(gl.COLOR_BUFFER_BIT)
  bind(0, G.tGas, u.uGas)
  bind(1, G.tA, u.uAtlas)
  bind(2, G.tS, u.uS)
  atlas(u)
  gl.uniform2f(u.uGRes, G.gw, G.gh)
  gl.uniform1f(u.uGS, G.GS)
  gl.uniform2f(u.uC, x, y)
  gl.uniform2f(u.uA, anti[0], anti[1])
  gl.uniform2f(u.uN, nrm[0], nrm[1])
  gl.uniform1f(u.uR, r)
  gl.uniform1f(u.uCurv, dust[3])
  gl.uniform1f(u.uGlyphA, GAS_GLYPHS)
  gl.uniform1iv(u.uGI, G.GI)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
  gl.activeTexture(gl.TEXTURE0)
  ctx.drawImage(G.cv, 0, 0)
  gx.globalCompositeOperation = 'lighter'
  gx.drawImage(G.cv, 0, 0, glow.width, glow.height)
  gx.filter = 'none'
  // the bloom over both
  if (BLOOM > 0) {
    ctx.globalCompositeOperation = 'lighter'
    ctx.globalAlpha = Math.min(1, BLOOM) * vis
    ctx.drawImage(glow, 0, 0, ctx.canvas.width, ctx.canvas.height)
    ctx.globalCompositeOperation = 'source-over'
  }
  ctx.globalAlpha = 1
}

// ---------------- grid.js's rocks ----------------
// Small rocks, several a frame: each the story's rock (the same ray march, glyph matching and light from the hole, on
// finer cells) with its own shape, seed and turn, and no gas or bloom, drawn afresh every frame (drawSmall), onto ctx where
// it is, in the order given (back to front). o: { W, H, dpr, h (the hole: the light comes from it), rocks: [{ x, y (its
// centre, css px), r (css px a unit of its shape), rot (its turn, 3 x 3), shape ([ax, ay, az] semi-axes, in units, and how
// lumpy), cuts (its 4 flat faces: [nx, ny, nz, how far out] each, flat), seed ([3]), ext (the sphere it fits in, units),
// vis (0..1), sink (the sheet round it, in its units: [cos, sin of the camera's pitch, its centre's height above its dent's
// bottom, the dent's depth, the well's slope x, y, z, the dent's width]) }] }.
// False if it can't (no WebGL2, or the GPU has gone away): the caller draws something else
export function drawRocks(ctx, o) {
  try {
    const cw = ready(o.W, o.H, o.dpr)
    if (!cw) return false
    if (!G.p6) G.p6 = G.prog(rockFS(true))
    drawSmall(ctx, o, o.W < PHONE ? SMALL_CELL_PHONE : SMALL_CELL)
    return true
  } catch (e) {
    console.warn('comet: WebGL2 failed, drawing without it', e)
    G = false
    return false
  }
}

// A small rock's outline, as rockFS(true)'s sdf() draws it (its stretched ball, flat faces, lumps and craters), sampled:
// for points all over its surface, in its own frame (x along its long axis), each one's [x, distance from that axis], flat.
// grid.js rolls it about that axis, so how far it reaches any way on screen, however it rolls, follows from these alone
// (to within SURFACE_SLACK, its units). shape, cuts, seed: as drawRocks takes them. Keep in step with base() and detail()
export const SURFACE_SLACK = 0.012
export function surfaceOf(shape, cuts, seed, n = 500) {
  const fr = (v) => v - Math.floor(v), mix = (a, b, k) => a + (b - a) * k
  const hp = (x, y, z) => { x = fr(x * 0.1031); y = fr(y * 0.103); z = fr(z * 0.0973); const d = x * (y + 33.33) + y * (x + 33.33) + z * (z + 33.33); return [x + d, y + d, z + d] }
  const h31 = (x, y, z) => { const [a, b, c] = hp(x, y, z); return fr((a + b) * c) }
  const n3 = (x, y, z) => {
    const ix = Math.floor(x), iy = Math.floor(y), iz = Math.floor(z), s = (v) => v * v * (3 - 2 * v), fx = s(x - ix), fy = s(y - iy), fz = s(z - iz), c = (a, b, e) => h31(ix + a, iy + b, iz + e)
    return mix(mix(mix(c(0, 0, 0), c(1, 0, 0), fx), mix(c(0, 1, 0), c(1, 1, 0), fx), fy), mix(mix(c(0, 0, 1), c(1, 0, 1), fx), mix(c(0, 1, 1), c(1, 1, 1), fx), fy), fz)
  }
  const vor = (x, y, z) => { // the nearest jittered point: its distance, and its cell's hash
    const ix = Math.floor(x - 0.5), iy = Math.floor(y - 0.5), iz = Math.floor(z - 0.5)
    let best = 9, id = null
    for (let c = 0; c < 8; c++) {
      const cx = ix + (c & 1), cy = iy + ((c >> 1) & 1), cz = iz + (c >> 2), [a, b, e] = hp(cx, cy, cz)
      const dd = Math.hypot(x - cx - fr((a + b) * e), y - cy - fr((a + a) * b), z - cz - fr((b + a) * a))
      if (dd < best) { best = dd; id = [cx, cy, cz] }
    }
    return [best, h31(id[0] + 7.7, id[1] + 7.7, id[2] + 7.7)]
  }
  const [rx, ry, rz, lumps] = shape, CR = SMALL_CRATERS
  const sdf = (x, y, z) => {
    const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz))
    let a = (k0 * (k0 - 1)) / k1
    for (let i = 0; i < 4; i++) { // smax with each flat face
      const nx = cuts[4 * i], ny = cuts[4 * i + 1], nz = cuts[4 * i + 2], b = (x * nx + y * ny + z * nz) / Math.hypot(nx, ny, nz) - cuts[4 * i + 3]
      const h = Math.min(1, Math.max(0, 0.5 + (0.5 * (a - b)) / 0.06))
      a = -(mix(-b, -a, h) - 0.06 * h * (1 - h))
    }
    const px = x + seed[0], py = y + seed[1], pz = z + seed[2]
    a += lumps * (n3(px * 1.6 + 4, py * 1.6 + 4, pz * 1.6 + 4) - 0.5 + SMALL_KNOBS * (n3(px * 3.7 + 1, py * 3.7 + 1, pz * 3.7 + 1) - 0.5))
    if (a > 0.22) return a - 0.18 // (as rockFS(true): its detail reaches up to 0.18 out)
    let d = 0.05 * (n3(px * 2.4, py * 2.4, pz * 2.4) * 0.65 + n3(px * 4.7 + 3, py * 4.7 + 3, pz * 4.7 + 3) * 0.35 - 0.5)
    const rb = n3(px * 5.5 + 7, py * 5.5 + 7, pz * 5.5 + 7) * 0.6 + n3(px * 11 + 2, py * 11 + 2, pz * 11 + 2) * 0.4, rg = 1 - Math.abs(2 * n3(px * 6.3 + 5, py * 6.3 + 5, pz * 6.3 + 5) - 1)
    d += SMALL_ROUGH * (rb - 0.5) - SMALL_CREASE * rg * rg
    const [vx, vy] = vor(px * CR, py * CR, pz * CR), pr = SMALL_CRATER_SIZE * (0.6 + 0.8 * fr(vy * 13.1)), q = vx / pr, dp = (SMALL_CRATER_DEPTH * pr) / CR
    if (vy < SMALL_CRATER_SHARE) d += dp * (Math.max(0, 1 - q * q) - SMALL_CRATER_RIM * Math.exp(-(q - 1) * (q - 1) * 9))
    return a + d
  }
  const out = new Float32Array(2 * n), far = Math.max(rx, ry, rz) + lumps + 0.2
  for (let k = 0; k < n; k++) { // a Fibonacci sphere of directions; along each, in from far out to the outermost surface
    const dy = 1 - (2 * (k + 0.5)) / n, q = Math.sqrt(1 - dy * dy), ph = k * 2.39996, dx = q * Math.cos(ph), dz = q * Math.sin(ph)
    let t = far
    while (t > 0.02 && sdf(dx * t, dy * t, dz * t) > 0) t -= 0.015
    let lo = t, hi = t + 0.015
    for (let j = 0; j < 7; j++) { const mid = (lo + hi) / 2; if (sdf(dx * mid, dy * mid, dz * mid) > 0) hi = mid; else lo = mid }
    out[2 * k] = dx * hi
    out[2 * k + 1] = Math.hypot(dy, dz) * hi
  }
  return out
}

// Each rock, every frame: shaded only over its own box, into its own patch of the GL canvas (packed in rows from the top
// left, device px), then all are drawn onto ctx where they are, in the order given (back to front)
function drawSmall(ctx, { dpr, h, rocks }, cw) {
  const { gl, cv } = G, ch = cw * 1.667, snap = (v) => Math.round(v * dpr) / dpr, done = []
  let px = 0, py = 0, rowH = 0
  gl.disable(gl.BLEND)
  gl.enable(gl.SCISSOR_TEST)
  gl.clearColor(0, 0, 0, 0)
  for (const k of rocks) {
    if (k.vis < 0.002) continue
    let lx = h.cx - k.x, ly = h.cy - k.y
    const ll = Math.hypot(lx, ly) || 1
    k.lx = lx / ll
    k.ly = ly / ll
    // its box: as far as its stretched ball, turned, reaches across and up the screen, and the room its lumps take
    const R = k.rot, A = k.shape, m = k.ext - Math.max(A[0], A[1], A[2])
    const nx = Math.ceil(((Math.hypot(R[0] * A[0], R[1] * A[1], R[2] * A[2]) + m) * k.r) / cw) + 1, ny = Math.ceil(((Math.hypot(R[3] * A[0], R[4] * A[1], R[5] * A[2]) + m) * k.r) / ch) + 1
    const cols = 2 * nx, rows = 2 * ny
    const wd = Math.ceil(cols * cw * dpr), hd = Math.ceil(rows * ch * dpr)
    if (px + wd > cv.width) { px = 0; py += rowH; rowH = 0 }
    if (cols > G.maxCols || rows > G.maxRows || wd > cv.width || py + hd > cv.height) continue
    // its grid, anchored to its centre so its glyphs move with it
    const ox = snap(k.x - nx * cw), oy = snap(k.y - ny * ch), l3 = Math.hypot(k.lx, k.ly, SMALL_RAKE)
    // pass 1: it, 4 x 6 samples a cell
    let u = G.p6.u
    gl.useProgram(G.p6.p)
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.fS)
    gl.scissor(0, 0, Math.min(G.sw, cols * 4 + 4), Math.min(G.sh, rows * 6 + 6)) // a cell's border emptied first: passes 2 and 3 read a little past its edge
    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.viewport(0, 0, cols * 4, rows * 6)
    gl.scissor(0, 0, cols * 4, rows * 6)
    gl.uniform2f(u.uOrigin, ox, oy)
    gl.uniform2f(u.uStep, cw / 4, ch / 6)
    gl.uniform2f(u.uC, k.x, k.y)
    gl.uniform1f(u.uR, k.r)
    gl.uniformMatrix3fv(u.uRot, false, new Float32Array(k.rot))
    gl.uniformMatrix2fv(u.uAniso, false, ROUND)
    gl.uniform3f(u.uL, k.lx / l3, -k.ly / l3, SMALL_RAKE / l3)
    gl.uniform3f(u.uClip, 0, 0, 0)
    gl.uniform4fv(u.uShape, new Float32Array(k.shape))
    gl.uniform4fv(u.uCut, new Float32Array(k.cuts))
    gl.uniform3fv(u.uSeed, new Float32Array(k.seed))
    gl.uniform1f(u.uDom, k.ext * k.ext)
    gl.uniform4f(u.uFill, 0, -0.5, 0.866, SMALL_FILL) // from below and in front: the sheet, under it and toward us
    gl.uniform1f(u.uAmb, SMALL_AMBIENT)
    gl.uniform4f(u.uSink, k.sink[0], k.sink[1], k.sink[2], k.sink[3])
    gl.uniform4f(u.uSink2, k.sink[4], k.sink[5], k.sink[6], k.sink[7])
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    // pass 2: a glyph per cell
    gl.useProgram(G.p2.p)
    gl.bindFramebuffer(gl.FRAMEBUFFER, G.fC)
    gl.viewport(0, 0, cols, rows)
    gl.scissor(0, 0, cols, rows)
    cells(G.p2.u)
    // pass 3: its glyphs at device resolution, into its patch
    u = G.p3.u
    gl.useProgram(G.p3.p)
    gl.bindFramebuffer(gl.FRAMEBUFFER, null)
    gl.viewport(0, 0, cv.width, cv.height)
    gl.scissor(px, cv.height - py - hd, wd, hd)
    gl.clear(gl.COLOR_BUFFER_BIT)
    bindTex(0, G.tC, u.uCells)
    bindTex(1, G.tA, u.uAtlas)
    bindTex(2, G.tS, u.uS)
    gl.uniform2f(u.uACell, G.ACELL[0], G.ACELL[1])
    gl.uniform2f(u.uARes, G.ARES[0], G.ARES[1])
    gl.uniform2f(u.uPad, G.APAD, G.APAD)
    gl.uniform1i(u.uACols, G.ACOLS)
    gl.uniform2f(u.uOrigin, px / dpr, py / dpr)
    gl.uniform2f(u.uCell, cw, ch)
    gl.uniform2f(u.uSRes, G.sw, G.sh)
    gl.uniform2f(u.uGrid, cols, rows)
    gl.uniform1f(u.uDpr, dpr)
    gl.uniform1f(u.uHd, cv.height)
    gl.drawArrays(gl.TRIANGLES, 0, 3)
    done.push([px, py, wd, hd, Math.round(ox * dpr), Math.round(oy * dpr), k.vis])
    px += wd
    rowH = Math.max(rowH, hd)
  }
  gl.disable(gl.SCISSOR_TEST)
  gl.activeTexture(gl.TEXTURE0)
  // then each onto the page where it is (opaque: it hides what is behind it), and its light again over it (SMALL_GAIN)
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  for (const [sx, sy, w, hh, dx, dy, a] of done) {
    ctx.globalCompositeOperation = 'source-over'
    ctx.globalAlpha = a
    ctx.drawImage(cv, sx, sy, w, hh, dx, dy, w, hh)
    if (SMALL_GAIN > 1) {
      ctx.globalCompositeOperation = 'lighter'
      ctx.globalAlpha = a * (SMALL_GAIN - 1)
      ctx.drawImage(cv, sx, sy, w, hh, dx, dy, w, hh)
    }
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.globalAlpha = 1
}
function bindTex(unit, t, loc) {
  const { gl } = G
  gl.activeTexture(gl.TEXTURE0 + unit)
  gl.bindTexture(gl.TEXTURE_2D, t)
  gl.uniform1i(loc, unit)
}
// pass 2's settings (its program in use): the scene in, the glyphs' shapes, how they are matched
function cells(u) {
  const { gl } = G
  bindTex(0, G.tS, u.uS)
  bindTex(1, G.tG, u.uG)
  gl.uniform2f(u.uSRes, G.sw, G.sh)
  gl.uniform1i(u.uNG, G.NG)
  gl.uniform1f(u.uExp, EXPOSURE)
  gl.uniform1f(u.uGam, SHAPE_GAMMA)
  gl.uniform1f(u.uDirG, SHAPE_CONTRAST)
  gl.uniform1f(u.uB0, FLOOR)
  gl.uniform1f(u.uB1, GAIN)
  gl.uniform1f(u.uEdge, EDGE)
  gl.uniform1f(u.uEdgeI, EDGE_ROCK)
  gl.uniform1iv(u.uRamp, G.RAMP)
  gl.uniform1i(u.uNR, G.RAMP.length)
  gl.drawArrays(gl.TRIANGLES, 0, 3)
}
