// Retro striped sun sinking into the Sea of Cortez. Pure SVG, no assets.
// The sun drops into place once on load (respects reduced motion via CSS).
function Sunset({ className = '' }) {
  const stripes = [
    { y: 52, h: 2.5 },
    { y: 60, h: 4 },
    { y: 68, h: 5.5 },
  ]
  return (
    <svg viewBox="0 0 240 132" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="sunfill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffb627" />
          <stop offset="0.55" stopColor="#ff6a2b" />
          <stop offset="1" stopColor="#d7263d" />
        </linearGradient>
        <clipPath id="sky">
          <rect x="0" y="0" width="240" height="80" />
        </clipPath>
        <mask id="sunstripes">
          <rect x="0" y="0" width="240" height="132" fill="white" />
          {stripes.map((s) => (
            <rect key={s.y} x="0" y={s.y} width="240" height={s.h} fill="black" />
          ))}
        </mask>
      </defs>

      <g clipPath="url(#sky)">
        <g className="animate-sun-set" style={{ transformOrigin: 'center', transformBox: 'fill-box' }}>
          <circle cx="150" cy="80" r="58" fill="url(#sunfill)" mask="url(#sunstripes)" />
        </g>
      </g>

      {/* sea: reflection dashes that shorten toward the shore */}
      <g stroke="#ff6a2b" strokeLinecap="round" opacity="0.9">
        <line x1="104" y1="88" x2="196" y2="88" strokeWidth="3.5" />
        <line x1="116" y1="97" x2="184" y2="97" strokeWidth="3" opacity="0.75" />
        <line x1="128" y1="106" x2="172" y2="106" strokeWidth="2.5" opacity="0.55" />
        <line x1="140" y1="114" x2="160" y2="114" strokeWidth="2" opacity="0.4" />
      </g>
      <g stroke="#0fa394" strokeLinecap="round" fill="none" opacity="0.7">
        <path d="M20 92 q10 -5 20 0 t20 0" strokeWidth="2.5" />
        <path d="M44 108 q8 -4 16 0 t16 0" strokeWidth="2" opacity="0.7" />
        <path d="M200 102 q8 -4 16 0 t16 0" strokeWidth="2" opacity="0.7" />
      </g>
      <line x1="0" y1="80.5" x2="240" y2="80.5" stroke="#ffffff" strokeOpacity="0.18" strokeWidth="1" />
    </svg>
  )
}

export default Sunset
