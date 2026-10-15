let ctx

// Browsers keep audio muted until the person taps the page once. Kitchen
// screens call unlockAudio() from a tap so the new-order chime can play later.
function getContext() {
  ctx = ctx || new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

export function isAudioUnlocked() {
  return Boolean(ctx && ctx.state === 'running')
}

export async function unlockAudio() {
  try {
    const c = getContext()
    if (c.state !== 'running') await c.resume()
    return c.state === 'running'
  } catch {
    return false
  }
}

// Two-tone chime for new-order alerts, synthesized via Web Audio so no audio
// asset needs to be bundled. Fails silently if audio is blocked; the visual
// highlight still shows.
export function playChime() {
  try {
    const c = getContext()
    const now = c.currentTime
    ;[880, 1175].forEach((freq, i) => {
      const start = now + i * 0.15
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, start)
      gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.3)
      osc.connect(gain).connect(c.destination)
      osc.start(start)
      osc.stop(start + 0.35)
    })
  } catch {
    // Web Audio unsupported or blocked.
  }
}
