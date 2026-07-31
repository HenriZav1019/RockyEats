function WaveDivider({ className = 'text-sand-50', flip = false }) {
  return (
    <svg
      viewBox="0 0 1440 80"
      preserveAspectRatio="none"
      className={`h-10 w-full sm:h-16 ${flip ? 'rotate-180' : ''} ${className}`}
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M0,32 C240,80 480,0 720,24 C960,48 1200,88 1440,40 L1440,80 L0,80 Z"
      />
    </svg>
  )
}

export default WaveDivider
