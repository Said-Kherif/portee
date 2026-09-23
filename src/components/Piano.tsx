import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import type { Notation } from '../engine/notes'
import { isBlackKey, whiteKeyLabel } from '../engine/notes'

interface IPianoProps {
  low: number
  high: number
  pressed: Set<number>
  hint?: number | null
  wrong?: number | null
  marks?: number[]
  labels: boolean
  notation: Notation
  onNoteOn: (midi: number, at?: number) => void
  onNoteOff: (midi: number) => void
}

const TOUCH_DELAY = 150
const TAP_HOLD = 100
const SLOP = 8

export function Piano({ low, high, pressed, hint = null, wrong = null, marks = [], labels, notation, onNoteOn, onNoteOff }: IPianoProps) {
  const ref = useRef<HTMLDivElement>(null)
  const pending = useRef<Map<number, { timer: number; at: number; x: number; y: number }>>(new Map())
  const [keyW, setKeyW] = useState(40)
  const [edges, setEdges] = useState({ left: false, right: false })
  const updateEdges = useCallback(() => {
    const el = ref.current
    if (!el) return
    const left = el.scrollLeft > 4
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 4
    setEdges((prev) => (prev.left === left && prev.right === right ? prev : { left, right }))
  }, [])
  const keys = useMemo(() => {
    const whites: number[] = []
    const blacks: { midi: number; i: number }[] = []
    for (let m = low; m <= high; m++) {
      if (isBlackKey(m)) blacks.push({ midi: m, i: whites.length })
      else whites.push(m)
    }
    return { whites, blacks }
  }, [low, high])
  const count = keys.whites.length

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = (): void => {
      const cs = getComputedStyle(el)
      const inner = el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      const widest = el.clientWidth >= 700 ? 62 : 46
      const fitW = Math.floor(inner / count)
      setKeyW(Math.min(widest, fitW >= 28 ? fitW : 30))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [count])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.scrollLeft = Math.max(0, (count * keyW - el.clientWidth) / 2)
    updateEdges()
  }, [count, keyW, updateEdges])

  useEffect(() => {
    const el = ref.current
    if (!el || hint === null) return
    const key = el.querySelector<HTMLElement>(`[data-midi="${hint}"]`)
    if (!key) return
    const target = key.offsetLeft + key.offsetWidth / 2 - el.clientWidth / 2
    const visible = key.offsetLeft >= el.scrollLeft + 8 && key.offsetLeft + key.offsetWidth <= el.scrollLeft + el.clientWidth - 8
    if (!visible) el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' })
  }, [hint])

  useEffect(() => {
    const map = pending.current
    return () => {
      for (const p of map.values()) window.clearTimeout(p.timer)
      map.clear()
    }
  }, [])

  const fire = (midi: number, at: number): void => {
    pending.current.delete(midi)
    onNoteOn(midi, at)
  }

  const down = (midi: number) => (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    e.preventDefault()
    const el = ref.current
    const scrollable = !!el && el.scrollWidth > el.clientWidth + 1
    if (e.pointerType !== 'touch' || !scrollable) {
      onNoteOn(midi, performance.now())
      return
    }
    const at = performance.now()
    const timer = window.setTimeout(() => fire(midi, at), TOUCH_DELAY)
    pending.current.set(midi, { timer, at, x: e.clientX, y: e.clientY })
  }

  const move = (midi: number) => (e: PointerEvent<HTMLDivElement>) => {
    const p = pending.current.get(midi)
    if (!p) return
    if (Math.abs(e.clientX - p.x) < SLOP && Math.abs(e.clientY - p.y) < SLOP) return
    window.clearTimeout(p.timer)
    pending.current.delete(midi)
  }

  const release = (midi: number) => () => {
    const p = pending.current.get(midi)
    if (!p) {
      onNoteOff(midi)
      return
    }
    window.clearTimeout(p.timer)
    fire(midi, p.at)
    window.setTimeout(() => onNoteOff(midi), TAP_HOLD)
  }

  const cancel = (midi: number) => () => {
    const p = pending.current.get(midi)
    if (!p) {
      onNoteOff(midi)
      return
    }
    window.clearTimeout(p.timer)
    pending.current.delete(midi)
  }
  const cls = (midi: number, base: string): string =>
    ['key', base, pressed.has(midi) ? 'pressed' : '', hint === midi ? 'hint' : '', wrong === midi ? 'wrong' : '', marks.includes(midi) ? 'mark' : '', midi === 60 ? 'middle-c' : '']
      .filter(Boolean)
      .join(' ')

  return (
    <div className="piano-wrap">
      <div className="piano" ref={ref} onScroll={updateEdges}>
        <div className="piano-inner" style={{ '--kw': `${keyW}px`, '--n': count } as CSSProperties}>
        {keys.whites.map((midi, i) => (
          <div
            key={midi}
            className={cls(midi, 'white')}
            data-midi={midi}
            style={{ '--i': i } as CSSProperties}
            onPointerDown={down(midi)}
            onPointerMove={move(midi)}
            onPointerUp={release(midi)}
            onPointerLeave={cancel(midi)}
            onPointerCancel={cancel(midi)}
          >
            {labels && <span className="key-label">{whiteKeyLabel(midi, notation)}</span>}
          </div>
        ))}
        {keys.blacks.map((b) => (
          <div
            key={b.midi}
            className={cls(b.midi, 'black')}
            data-midi={b.midi}
            style={{ '--i': b.i } as CSSProperties}
            onPointerDown={down(b.midi)}
            onPointerMove={move(b.midi)}
            onPointerUp={release(b.midi)}
            onPointerLeave={cancel(b.midi)}
            onPointerCancel={cancel(b.midi)}
          />
        ))}
        </div>
      </div>
      {edges.left && <div className="piano-fade left" />}
      {edges.right && <div className="piano-fade right" />}
    </div>
  )
}
