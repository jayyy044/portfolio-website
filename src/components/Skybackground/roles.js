// The experience section's roles, newest first: type your own here (line: one string, or a list of points)
export const ROLES = [
  {
    title: 'Incoming Machine Learning Intern', org: 'Shopify', when: 'Jan – May 2027',
    line: ['Developing production ML and LLM-powered systems that improve merchant and buyer experiences across Shopify’s platform'],
  },
  {
    title: 'Machine Learning Engineer Intern', org: 'Tandem', when: 'May – Aug 2026',
    line: [
      'Solo developed an automated drafting pipeline turning 3D CAD into ASME-compliant drawings, freeing a 5-person team 100 hours/month (~$48K/year)',
      'Cut engineering change review from 6 hours to 25 minutes by shipping two production AI agents that trace a change through the requirement dependency graph and flag every invalidated downstream test and verification gap',
      'Designed an evaluation harness via a VLM using Set-of-Mark visual grounding and entity-ID-constrained outputs backed by automated tests across reference parts benchmarking pipeline outputs at 85% drawing quality',
    ],
  },
  {
    title: 'Machine Learning Engineer Intern', org: 'SolidWorks', when: 'May – Aug 2025',
    line: [
      'Engineered a synthetic data pipeline generating labelled 3D CAD/BRep geometry, cutting model production time by 75% and enabling reuse across future detection models through configurable features and randomized parameters',
      'Boosted Graph Neural Network fillet-detection accuracy from 75% to 98% through targeted data augmentation and loss function redesign',
      'Shipped the ONNX-converted model into xDesign, putting automated fillet detection in front of 12,000+ users',
    ],
  },
  {
    title: 'Backend Engineering Intern', org: 'CIBC', when: 'Jan – Apr 2025',
    line: [
      'Provisioned and managed Azure cloud infrastructure for internal microservices, maintaining 99% uptime across 10,000+ daily API requests routed through Kong API Gateway',
      'Deployed and configured Kong API Gateway on Azure Kubernetes Service, reducing deployment time by 30% and improving service reliability for internal banking workflows',
      'Developed REST APIs for core banking workflows, accelerating development for 100+ interns at CIBC’s hackathon',
      'Implemented OAuth 2.0 and mTLS to secure internal APIs, ensuring compliance for 10,000+ daily transactions',
    ],
  },
  {
    title: 'Machine Learning Engineer', org: 'SpeechDojo', when: 'Jul 2024 – Aug 2025',
    line: [
      'Built a RAG pipeline to extract job details and create practice questions, enhancing interview prep for 100+ users',
      'Deployed Llama 8B for CPU inference using llama.cpp with GGUF quantized weights and Flask, reducing response latency by 70% (60s to sub-20s) on GPU-free hardware',
      'Engineered a multi-stage audio pipeline that extracted audio features from interview recordings using disvoice, and fed acoustic features into an LLM to generate personalized communication feedback for 30+ users',
      'Integrated Web Speech API to enable real-time voice interview simulation, boosting user engagement by 40%',
    ],
  },
]
