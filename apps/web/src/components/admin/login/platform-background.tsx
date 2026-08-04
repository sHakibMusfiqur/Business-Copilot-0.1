'use client';

import { motion } from 'framer-motion';

/* Approximate continent clusters — rendered as a faint node + line network so it
   reads as a subtle world map without heavy illustration. */
const CONTINENTS: [number, number][][] = [
  [
    [170, 150],
    [205, 160],
    [230, 170],
    [255, 185],
    [270, 195],
    [245, 205],
    [215, 200],
    [190, 185],
    [175, 168],
    [180, 150],
  ],
  [
    [302, 300],
    [292, 330],
    [296, 360],
    [308, 385],
    [322, 400],
    [336, 412],
    [328, 428],
    [305, 420],
    [300, 398],
    [298, 370],
    [296, 340],
    [305, 312],
  ],
  [
    [515, 148],
    [528, 158],
    [545, 168],
    [562, 175],
    [576, 182],
    [568, 196],
    [552, 204],
    [536, 196],
    [524, 182],
    [516, 168],
  ],
  [
    [544, 250],
    [562, 258],
    [574, 278],
    [580, 305],
    [578, 335],
    [570, 358],
    [554, 372],
    [540, 358],
    [532, 335],
    [533, 305],
    [536, 278],
  ],
  [
    [648, 168],
    [685, 163],
    [722, 170],
    [758, 176],
    [792, 182],
    [826, 188],
    [858, 194],
    [888, 200],
    [918, 205],
    [900, 222],
    [868, 214],
    [834, 208],
    [800, 204],
    [766, 204],
    [732, 202],
    [700, 198],
    [672, 190],
  ],
  [
    [945, 380],
    [968, 384],
    [982, 398],
    [974, 412],
    [954, 418],
    [942, 408],
    [940, 392],
  ],
  [
    [490, 160],
    [502, 170],
  ],
];

const LINKS: [number, number, number, number][] = [
  [200, 160, 520, 168],
  [265, 200, 295, 310],
  [560, 200, 545, 255],
  [300, 420, 540, 360],
  [576, 200, 650, 175],
  [560, 370, 920, 208],
  [650, 180, 940, 400],
];

/** Ambient enterprise background: dark navy gradient, faint world-map network,
    grid overlay, network dots, soft blue radial lighting and a hint of grain. */
export function PlatformBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Base dark navy gradient */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0B1120_0%,#0F172A_55%,#0B1120_100%)]" />

      {/* Soft blue radial lighting */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(37,99,235,0.16),transparent_52%),radial-gradient(ellipse_at_bottom_right,rgba(14,165,233,0.10),transparent_55%)]" />

      {/* Faint grid overlay */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(148,163,184,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(148,163,184,0.04)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_80%)]" />

      {/* World-map network */}
      <div className="absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_center,black_35%,transparent_75%)]">
        <svg
          viewBox="0 0 1000 600"
          preserveAspectRatio="xMidYMid slice"
          className="absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2"
        >
          {LINKS.map(([x1, y1, x2, y2], i) => (
            <line
              key={`link-${i}`}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="rgba(56,130,246,0.10)"
              strokeWidth="0.6"
              strokeDasharray="2 3"
            />
          ))}
          {CONTINENTS.map((points, ci) => (
            <g key={`continent-${ci}`}>
              {points.slice(0, -1).map((p, i) => (
                <line
                  key={`line-${ci}-${i}`}
                  x1={p[0]}
                  y1={p[1]}
                  x2={points[i + 1][0]}
                  y2={points[i + 1][1]}
                  stroke="rgba(148,163,184,0.16)"
                  strokeWidth="0.8"
                />
              ))}
              {points.map((p, i) => (
                <circle
                  key={`dot-${ci}-${i}`}
                  cx={p[0]}
                  cy={p[1]}
                  r="1.5"
                  fill="rgba(148,163,184,0.45)"
                />
              ))}
            </g>
          ))}
        </svg>
      </div>

      {/* Tiny network dots */}
      <div className="absolute inset-0 bg-[radial-gradient(rgba(148,163,184,0.18)_1px,transparent_1px)] bg-[size:26px_26px] opacity-40 [mask-image:radial-gradient(ellipse_at_55%_35%,black_15%,transparent_70%)]" />

      {/* Floating blurred orbs */}
      <motion.div
        className="absolute -left-48 -top-48 h-[560px] w-[560px] rounded-full bg-[#2563EB]/[0.14] blur-[140px]"
        animate={{ x: [0, 48, 0], y: [0, 32, 0] }}
        transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-52 -right-40 h-[600px] w-[600px] rounded-full bg-[#0EA5E9]/[0.10] blur-[150px]"
        animate={{ x: [0, -44, 0], y: [0, -36, 0] }}
        transition={{ duration: 26, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Grain */}
      <div
        className="absolute inset-0 opacity-[0.03] mix-blend-overlay"
        style={{
          backgroundImage:
            'url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%27160%27 height=%27160%27%3E%3Cfilter id=%27n%27%3E%3CfeTurbulence type=%27fractalNoise%27 baseFrequency=%270.85%27 numOctaves=%274%27 stitchTiles=%27stitch%27/%3E%3C/filter%3E%3Crect width=%27100%25%27 height=%27100%25%27 filter=%27url(%23n)%27/%3E%3C/svg%3E")',
        }}
      />

      {/* Vignette + bottom fade */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_60%,rgba(2,6,23,0.5)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#0B1120] to-transparent" />
    </div>
  );
}
