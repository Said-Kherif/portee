export interface IClick {
  time: number
  accent: boolean
}

export function scheduleClicks(ctx: AudioContext, clicks: IClick[]): () => void {
  const oscillators: OscillatorNode[] = []
  for (const click of clicks) {
    const osc = ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.value = click.accent ? 1760 : 1175
    const gain = ctx.createGain()
    gain.gain.setValueAtTime(0.0001, click.time)
    gain.gain.exponentialRampToValueAtTime(click.accent ? 0.7 : 0.45, click.time + 0.002)
    gain.gain.exponentialRampToValueAtTime(0.0001, click.time + 0.07)
    osc.connect(gain).connect(ctx.destination)
    osc.start(click.time)
    osc.stop(click.time + 0.09)
    oscillators.push(osc)
  }
  return () => {
    for (const osc of oscillators) {
      try {
        osc.stop()
      } catch {
        continue
      }
    }
  }
}
