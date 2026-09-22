type Handler = (midi: number) => void

let onHandler: Handler | null = null
let offHandler: Handler | null = null

export function setMidiHandlers(on: Handler | null, off: Handler | null): void {
  onHandler = on
  offHandler = off
}

export function emitNoteOn(midi: number): void {
  onHandler?.(midi)
}

export function emitNoteOff(midi: number): void {
  offHandler?.(midi)
}
