import { SplendidGrandPiano, type StopFn } from 'smplr'

let ctx: AudioContext | null = null
let sampled: ReturnType<typeof SplendidGrandPiano> | null = null
let sampledReady = false
const active = new Map<number, StopFn>()

interface IAudioSessionNavigator {
  audioSession?: { type: string }
}

function preferPlayback(): void {
  const session = (navigator as unknown as IAudioSessionNavigator).audioSession
  if (!session) return
  try {
    session.type = 'playback'
  } catch {
    return
  }
}

export function getContext(): AudioContext {
  if (!ctx) {
    preferPlayback()
    ctx = new AudioContext()
  }
  return ctx
}

export function unlockAudio(): void {
  preloadAudio()
  const c = getContext()
  if (c.state !== 'running') void c.resume()
}

export function preloadAudio(): void {
  const c = getContext()
  if (!sampled) {
    try {
      sampled = SplendidGrandPiano(c, { volume: 110, decayTime: 0.4 })
      sampled.ready
        .then(() => {
          sampledReady = true
        })
        .catch(() => {
          sampled = null
        })
    } catch {
      sampled = null
    }
  }
}

export function isSampledReady(): boolean {
  return sampledReady
}

function synth(midi: number): StopFn {
  const c = getContext()
  const t = c.currentTime
  const freq = 440 * Math.pow(2, (midi - 69) / 12)
  const osc = c.createOscillator()
  osc.type = 'triangle'
  osc.frequency.value = freq
  const gain = c.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.35, t + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.6)
  osc.connect(gain).connect(c.destination)
  osc.start(t)
  osc.stop(t + 1.7)
  return () => {
    const now = c.currentTime
    gain.gain.cancelScheduledValues(now)
    gain.gain.setValueAtTime(Math.max(0.0001, gain.gain.value), now)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15)
    osc.stop(now + 0.2)
  }
}

export function noteOn(midi: number): void {
  const c = getContext()
  if (c.state !== 'running') void c.resume()
  noteOff(midi)
  let stop: StopFn
  if (sampledReady && sampled) stop = sampled.start({ note: midi, velocity: 90 })
  else stop = synth(midi)
  active.set(midi, stop)
}

export function noteOff(midi: number): void {
  const stop = active.get(midi)
  if (!stop) return
  active.delete(midi)
  try {
    stop()
  } catch {
    return
  }
}

export function playNote(midi: number, durationMs = 900): void {
  noteOn(midi)
  window.setTimeout(() => noteOff(midi), durationMs)
}
