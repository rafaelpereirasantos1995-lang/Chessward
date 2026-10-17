// Sons sintetizados (sem arquivos de áudio).
let ctx: AudioContext | null = null

function beep(freq: number, duration: number, gain = 0.08) {
  try {
    ctx ??= new AudioContext()
    const osc = ctx.createOscillator()
    const g = ctx.createGain()
    osc.type = 'triangle'
    osc.frequency.value = freq
    g.gain.setValueAtTime(gain, ctx.currentTime)
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration)
    osc.connect(g).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + duration)
  } catch {
    // Áudio indisponível.
  }
}

export function playMoveSound(kind: 'move' | 'capture' | 'check' | 'end') {
  if (kind === 'move') beep(520, 0.08)
  else if (kind === 'capture') beep(320, 0.12, 0.12)
  else if (kind === 'check') beep(880, 0.15)
  else {
    beep(660, 0.15)
    setTimeout(() => beep(440, 0.3), 150)
  }
}
