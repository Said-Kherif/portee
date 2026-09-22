import { useEffect, useRef } from 'react'

const MAP: Record<string, number> = {
  KeyA: 0,
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12,
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
}

interface IOptions {
  enabled: boolean
  onNoteOn: (midi: number) => void
  onNoteOff: (midi: number) => void
  onSpace?: () => void
}

export function useComputerKeys({ enabled, onNoteOn, onNoteOff, onSpace }: IOptions): void {
  const ref = useRef({ onNoteOn, onNoteOff, onSpace })
  ref.current = { onNoteOn, onNoteOff, onSpace }
  const octave = useRef(4)

  useEffect(() => {
    if (!enabled) return
    const isTyping = (e: KeyboardEvent): boolean => {
      const t = e.target as HTMLElement | null
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT')
    }
    const down = (e: KeyboardEvent): void => {
      if (e.repeat || isTyping(e) || e.metaKey || e.ctrlKey || e.altKey) return
      if (e.code === 'Space') {
        e.preventDefault()
        ref.current.onSpace?.()
        return
      }
      if (e.code === 'KeyZ') {
        octave.current = Math.max(1, octave.current - 1)
        return
      }
      if (e.code === 'KeyX') {
        octave.current = Math.min(7, octave.current + 1)
        return
      }
      const offset = MAP[e.code]
      if (offset === undefined) return
      e.preventDefault()
      ref.current.onNoteOn((octave.current + 1) * 12 + offset)
    }
    const up = (e: KeyboardEvent): void => {
      const offset = MAP[e.code]
      if (offset === undefined) return
      ref.current.onNoteOff((octave.current + 1) * 12 + offset)
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [enabled])
}
