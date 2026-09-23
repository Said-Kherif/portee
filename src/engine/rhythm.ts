import type { Accidental, Clef } from './notes'
import { MIDDLE_LINE, midiAt } from './notes'

export type NoteValue = 'w' | 'h' | 'q' | 'e'
export type CellKind = 'q' | 'h' | 'w' | 'h.' | 'ee' | 'q.e' | 'rq' | 'rh' | 'rw'
export type Grade = 'perfect' | 'good' | 'late' | 'miss'

export interface IElement {
  kind: 'note' | 'rest'
  value: NoteValue
  dots: 0 | 1
  beats: number
  start: number
  beam?: number
  clef?: Clef
  diatonic?: number
  shown?: Accidental | null
  midi?: number
}

export interface IMeasure {
  elements: IElement[]
}

export interface IOnset {
  index: number
  beat: number
  midi: number | null
}

export interface ITimedOnset {
  index: number
  time: number
  midi: number | null
}

export interface ITap {
  t: number
  midi: number | null
}

export interface IOnsetResult {
  index: number
  delta: number | null
  grade: Grade
  pitchOk: boolean | null
}

export interface IScoreResult {
  results: IOnsetResult[]
  extra: number
  score: number
}

export const BEATS_PER_MEASURE = 4
export const PERFECT_MS = 60
export const GOOD_MS = 120
export const WINDOW_MS = 200

const CELL_BEATS: Record<CellKind, number> = { q: 1, h: 2, w: 4, 'h.': 3, ee: 1, 'q.e': 2, rq: 1, rh: 2, rw: 4 }

function allowed(cell: CellKind, start: number, remaining: number, prevWasRest: boolean, silentOk: boolean): boolean {
  if (CELL_BEATS[cell] > remaining) return false
  if ((cell === 'h' || cell === 'rh' || cell === 'q.e') && start % 2 !== 0) return false
  if ((cell === 'w' || cell === 'h.') && start !== 0) return false
  if (cell === 'rw' && (start !== 0 || !silentOk)) return false
  if ((cell === 'rq' || cell === 'rh' || cell === 'rw') && prevWasRest) return false
  return true
}

function isPause(elements: IElement[]): boolean {
  return elements.length === 1 && elements[0].kind === 'rest' && elements[0].value === 'w'
}

function expand(cell: CellKind, start: number, nextBeam: () => number): IElement[] {
  switch (cell) {
    case 'q':
      return [{ kind: 'note', value: 'q', dots: 0, beats: 1, start }]
    case 'h':
      return [{ kind: 'note', value: 'h', dots: 0, beats: 2, start }]
    case 'w':
      return [{ kind: 'note', value: 'w', dots: 0, beats: 4, start }]
    case 'h.':
      return [{ kind: 'note', value: 'h', dots: 1, beats: 3, start }]
    case 'ee': {
      const beam = nextBeam()
      return [
        { kind: 'note', value: 'e', dots: 0, beats: 0.5, start, beam },
        { kind: 'note', value: 'e', dots: 0, beats: 0.5, start: start + 0.5, beam },
      ]
    }
    case 'q.e':
      return [
        { kind: 'note', value: 'q', dots: 1, beats: 1.5, start },
        { kind: 'note', value: 'e', dots: 0, beats: 0.5, start: start + 1.5 },
      ]
    case 'rq':
      return [{ kind: 'rest', value: 'q', dots: 0, beats: 1, start }]
    case 'rh':
      return [{ kind: 'rest', value: 'h', dots: 0, beats: 2, start }]
    case 'rw':
      return [{ kind: 'rest', value: 'w', dots: 0, beats: 4, start }]
  }
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

export function generateMeasures(vocab: CellKind[], count: number): IMeasure[] {
  const cells: CellKind[] = vocab.includes('q') ? vocab : ['q', ...vocab]
  let beam = 0
  const nextBeam = () => ++beam
  const minOnsets = count + 1
  let measures = buildMeasures(cells, count, nextBeam)
  for (let attempt = 0; attempt < 20 && onsetsOf(measures).length < minOnsets; attempt++) measures = buildMeasures(cells, count, nextBeam)
  return measures
}

function buildMeasures(cells: CellKind[], count: number, nextBeam: () => number): IMeasure[] {
  const measures: IMeasure[] = []
  for (let m = 0; m < count; m++) {
    const previous = m > 0 ? measures[m - 1].elements : []
    const endsWithRest = previous.length > 0 && previous[previous.length - 1].kind === 'rest'
    const silentOk = m > 0 && !endsWithRest
    let elements: IElement[] = []
    let guard = 0
    do {
      elements = []
      let start = 0
      let prevRest = endsWithRest
      while (start < BEATS_PER_MEASURE) {
        const options = cells.filter((c) => allowed(c, start, BEATS_PER_MEASURE - start, prevRest, silentOk))
        const cell: CellKind = options.length > 0 ? pick(options) : 'q'
        elements.push(...expand(cell, start, nextBeam))
        start += CELL_BEATS[cell]
        prevRest = cell.startsWith('r')
      }
      guard++
    } while (elements.every((e) => e.kind === 'rest') && !(silentOk && isPause(elements)) && guard < 10)
    measures.push({ elements })
  }
  return measures
}

export function assignLine(measures: IMeasure[]): IMeasure[] {
  for (const m of measures) {
    for (const e of m.elements) {
      e.clef = 'treble'
      e.diatonic = MIDDLE_LINE.treble
      e.shown = null
    }
  }
  return measures
}

export function assignMelody(measures: IMeasure[], clef: Clef, low: number, high: number): IMeasure[] {
  const steps = [-2, -1, -1, 0, 1, 1, 2, 3, -3]
  let d = low + Math.floor(Math.random() * (high - low + 1))
  for (const m of measures) {
    for (const e of m.elements) {
      if (e.kind !== 'note') continue
      e.clef = clef
      e.diatonic = d
      e.shown = null
      e.midi = midiAt(d, 0)
      let next = d + pick(steps)
      if (next < low || next > high) next = d - (next - d)
      d = Math.min(high, Math.max(low, next))
    }
  }
  return measures
}

export type HandsMode = 'alternate' | 'together'

const CHORD_STEPS = [0, 2, 4]
const CONSONANT = [0, 3, 4, 7, 8, 9]

export function assignHands(measures: IMeasure[], mode: HandsMode, treble: [number, number], bass: [number, number]): IMeasure[] {
  if (mode === 'together') {
    assignMelody(measures, 'treble', treble[0], treble[1])
    const roots: number[] = []
    for (let d = bass[0]; d <= bass[1]; d++) if (CHORD_STEPS.includes(((d % 7) + 7) % 7)) roots.push(d)
    const dominant = roots.find((d) => ((d % 7) + 7) % 7 === 4) ?? roots[0] ?? bass[0]
    return measures.map((m) => {
      const top = m.elements.find((e) => e.kind === 'note' && e.start === 0)?.midi
      const fits = top === undefined ? roots : roots.filter((d) => CONSONANT.includes((((top - midiAt(d, 0)) % 12) + 12) % 12))
      const d = fits.length > 0 ? pick(fits) : dominant
      const left: IElement = { kind: 'note', value: 'w', dots: 0, beats: 4, start: 0, clef: 'bass', diatonic: d, shown: null, midi: midiAt(d, 0) }
      return { elements: [left, ...m.elements] }
    })
  }
  const startTreble = Math.random() < 0.5
  return measures.map((m, i) => {
    const clef: Clef = (i % 2 === 0) === startTreble ? 'treble' : 'bass'
    const [low, high] = clef === 'treble' ? treble : bass
    assignMelody([m], clef, low, high)
    const rest: IElement = { kind: 'rest', value: 'w', dots: 0, beats: 4, start: 0, clef: clef === 'treble' ? 'bass' : 'treble' }
    return { elements: [rest, ...m.elements] }
  })
}

export function onsetsOf(measures: IMeasure[]): IOnset[] {
  const out: IOnset[] = []
  let index = 0
  measures.forEach((m, mi) => {
    for (const e of m.elements) {
      if (e.kind === 'note') out.push({ index, beat: mi * BEATS_PER_MEASURE + e.start, midi: e.midi ?? null })
      index++
    }
  })
  return out
}

export function startsOf(measures: IMeasure[]): { index: number; beat: number }[] {
  const out: { index: number; beat: number }[] = []
  let index = 0
  measures.forEach((m, mi) => {
    for (const e of m.elements) {
      out.push({ index, beat: mi * BEATS_PER_MEASURE + e.start })
      index++
    }
  })
  return out
}

export function scoreTaps(onsets: ITimedOnset[], taps: ITap[], pitched: boolean): IScoreResult {
  const used = new Set<number>()
  const chosen = new Map<number, number>()
  const closest = (o: ITimedOnset, accept: (tap: ITap) => boolean): number => {
    let best = -1
    let bestAbs = Infinity
    taps.forEach((tap, i) => {
      if (used.has(i) || !accept(tap)) return
      const d = Math.abs(tap.t - o.time)
      if (d <= WINDOW_MS && d < bestAbs) {
        best = i
        bestAbs = d
      }
    })
    return best
  }
  const claim = (matchPitch: boolean): void => {
    onsets.forEach((o, k) => {
      if (chosen.has(k)) return
      const best = closest(o, (tap) => !matchPitch || tap.midi === o.midi)
      if (best < 0) return
      used.add(best)
      chosen.set(k, best)
    })
  }
  if (pitched) claim(true)
  claim(false)
  const results: IOnsetResult[] = onsets.map((o, k) => {
    const best = chosen.get(k)
    if (best === undefined) return { index: o.index, delta: null, grade: 'miss', pitchOk: null }
    const delta = taps[best].t - o.time
    const a = Math.abs(delta)
    const grade: Grade = a <= PERFECT_MS ? 'perfect' : a <= GOOD_MS ? 'good' : 'late'
    return { index: o.index, delta, grade, pitchOk: pitched ? taps[best].midi === o.midi : null }
  })
  const extra = taps.length - used.size
  let points = 0
  for (const r of results) {
    if (r.pitchOk === false) continue
    if (r.grade === 'perfect' || r.grade === 'good') points += 1
    else if (r.grade === 'late') points += 0.5
  }
  const score = onsets.length > 0 ? Math.max(0, Math.round(((points - extra * 0.5) / onsets.length) * 100)) : 0
  return { results, extra, score }
}
