let ctx

// Two-tone chime for new-order alerts, synthesized via Web Audio so no
// audio asset needs to be bundled/hosted. Browsers block audio before any
// user gesture on the page; dashboard staff will have already clicked
// around, so this fails silently rather than throwing in that edge case.
export function playChime() {
  try {
    ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
    const now = ctx.currentTime

    ;[880, 1175].forEach((freq, i) => {
      const start = now + i * 0.15
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
      osc.connect(gain).connect(ctx.destination)
      osc.start(start)
      osc.stop(start + 0.35)
    })
  } catch {
    // Web Audio unsupported or blocked — new-order highlight still shows.
  }
}
