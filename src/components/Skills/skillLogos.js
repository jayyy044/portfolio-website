// Full-colour devicon logos for every résumé skill that HAS a real logo.
// (Concepts like RAG / MCP / Quantization and logo-less libs are omitted — see
// the note in Skills.jsx / the chat for the list without logos.)
const BASE = 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons'
const dv = (name, ver = 'original') => `${BASE}/${name}/${name}-${ver}.svg`

export const SKILLS = [
  // Languages
  { label: 'Python', url: dv('python') },
  { label: 'TypeScript', url: dv('typescript') },
  { label: 'JavaScript', url: dv('javascript') },
  { label: 'Bash', url: dv('bash') },
  // Frameworks & Libraries
  { label: 'PyTorch', url: dv('pytorch') },
  { label: 'Flask', url: dv('flask') },
  { label: 'FastAPI', url: dv('fastapi') },
  { label: 'React', url: dv('react') },
  { label: 'Node.js', url: dv('nodejs') },
  { label: 'Express', url: dv('express') },
  { label: 'Django', url: dv('django', 'plain') },
  { label: 'Firebase', url: dv('firebase') },
  { label: 'MongoDB', url: dv('mongodb') },
  { label: 'PostgreSQL', url: dv('postgresql') },
  { label: 'Supabase', url: dv('supabase') },
  // ML / Data
  { label: 'scikit-learn', url: dv('scikitlearn') },
  { label: 'OpenCV', url: dv('opencv') },
  // Tools & Platforms
  { label: 'Docker', url: dv('docker') },
  { label: 'AWS', url: dv('amazonwebservices', 'original-wordmark') },
  { label: 'Azure', url: dv('azure') },
  { label: 'Git', url: dv('git') },
  { label: 'Postman', url: dv('postman') },
  { label: 'Linux', url: dv('linux') },
]
