// Skills/technologies parsed from the resume, mapped to simple-icons glyph paths.
// Named imports tree-shake to just these icons (not the whole 3k-icon set).
// AWS + Azure were removed from simple-icons (brand requests) → mono text chips.
import {
  siPython,
  siTypescript,
  siJavascript,
  siPostgresql,
  siGnubash,
  siHtml5,
  siCss,
  siPytorch,
  siFlask,
  siFastapi,
  siReact,
  siNodedotjs,
  siExpress,
  siDjango,
  siFirebase,
  siMongodb,
  siSupabase,
  siScikitlearn,
  siOpencv,
  siMediapipe,
  siLangchain,
  siDocker,
  siOnnx,
  siGit,
  siPostman,
  siLinux,
  siFigma,
  siKubernetes,
  siGooglegemini,
  siSpotify,
} from 'simple-icons'

const p = (icon) => icon.path

// Order roughly follows the resume's Technical Skills grouping.
export const TECH = [
  // Languages
  { label: 'Python', path: p(siPython) },
  { label: 'TypeScript', path: p(siTypescript) },
  { label: 'JavaScript', path: p(siJavascript) },
  { label: 'PostgreSQL', path: p(siPostgresql) },
  { label: 'Bash', path: p(siGnubash) },
  { label: 'HTML5', path: p(siHtml5) },
  { label: 'CSS', path: p(siCss) },
  // Frameworks & Libraries
  { label: 'PyTorch', path: p(siPytorch) },
  { label: 'Flask', path: p(siFlask) },
  { label: 'FastAPI', path: p(siFastapi) },
  { label: 'React', path: p(siReact) },
  { label: 'Node.js', path: p(siNodedotjs) },
  { label: 'Express', path: p(siExpress) },
  { label: 'Django', path: p(siDjango) },
  { label: 'Firebase', path: p(siFirebase) },
  { label: 'MongoDB', path: p(siMongodb) },
  { label: 'Supabase', path: p(siSupabase) },
  // ML / Data
  { label: 'scikit-learn', path: p(siScikitlearn) },
  { label: 'OpenCV', path: p(siOpencv) },
  { label: 'MediaPipe', path: p(siMediapipe) },
  { label: 'LangChain', path: p(siLangchain) },
  // Tools & Platforms
  { label: 'Docker', path: p(siDocker) },
  { label: 'AWS', text: 'aws' },
  { label: 'Azure', text: 'Azure' },
  { label: 'ONNX', path: p(siOnnx) },
  { label: 'Git', path: p(siGit) },
  { label: 'Postman', path: p(siPostman) },
  { label: 'Linux', path: p(siLinux) },
  { label: 'Figma', path: p(siFigma) },
  { label: 'Kubernetes', path: p(siKubernetes) },
  // Notable from projects
  { label: 'Gemini', path: p(siGooglegemini) },
  { label: 'Spotify', path: p(siSpotify) },
]
