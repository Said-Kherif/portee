import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { scheduleClicks } from '../audio/metronome'
import { getContext, noteOff as audioOff, noteOn as audioOn, unlockAudio } from '../audio/piano'
import type { IPhraseLevel, IRhythmLevel } from '../engine/levels'
import { pianoRange } from '../engine/levels'
import type { IProgress } from '../engine/progress'
import { recordScore, recordSession } from '../engine/progress'
import type { IMeasure, IOnsetResult, IScoreResult, ITap, ITimedOnset } from '../engine/rhythm'
import { assignHands, assignLine, assignMelody, BEATS_PER_MEASURE, generateMeasures, onsetsOf, scoreTaps, startsOf } from '../engine/rhythm'
import { setMidiHandlers } from '../midi/bus'
import { useComputerKeys } from '../midi/computerKeys'
import type { IScore } from '../score/layout'
import { IconClose } from './Icons'
import { Piano } from './Piano'
import { Staff } from './Staff'

type Phase = 'idle' | 'countin' | 'playing' | 'done'

interface IExerciseProps {
  level: IRhythmLevel | IPhraseLevel
  progress: IProgress
  update: (fn: (p: IProgress) => IProgress) => void
  onExit: () => void
  onLesson: () => void
}

interface ITiming {
  perfStart: number
  beatMs: number
  onsets: ITimedOnset[]
  end: number
}

const COUNT_IN = 4
const MEASURES = 2
const LEAD_S = 0.2
const TAIL_MS = 250

function build(level: IRhythmLevel | IPhraseLevel): IMeasure[] {
  const measures = generateMeasures(level.vocab, MEASURES)
  if (level.kind !== 'phrase') return assignLine(measures)
  if (level.hands) return assignHands(measures, level.hands.mode, level.range, level.hands.bass)
  return assignMelody(measures, level.clef, level.range[0], level.range[1])
}

function rank(r: IOnsetResult): number {
  if (r.pitchOk === false) return 3
  if (r.delta === null) return 2
  return Math.abs(r.delta) / 1000
}

function labelOf(r: IOnsetResult): string {
  if (r.pitchOk === false) return '✗'
  if (r.delta === null) return '—'
  return `${r.delta > 0 ? '+' : '−'}${Math.abs(Math.round(r.delta))}`
}

function summarize(result: IScoreResult, pitched: boolean): string {
  let right = 0
  let late = 0
  let miss = 0
  let wrongPitch = 0
  for (const r of result.results) {
    if (r.pitchOk === false) {
      wrongPitch++
      continue
    }
    if (r.grade === 'miss') miss++
    else if (r.grade === 'late') late++
    else right++
  }
  const parts = [`${right} en place`]
  if (late > 0) parts.push(`${late} approximative${late > 1 ? 's' : ''}`)
  if (miss > 0) parts.push(`${miss} manquée${miss > 1 ? 's' : ''}`)
  if (pitched && wrongPitch > 0) parts.push(`${wrongPitch} fausse${wrongPitch > 1 ? 's' : ''} note${wrongPitch > 1 ? 's' : ''}`)
  if (result.extra > 0) parts.push(`${result.extra} en trop`)
  return parts.join(', ')
}

export function Exercise({ level, progress, update, onExit, onLesson }: IExerciseProps) {
  const pitched = level.kind === 'phrase'
  const [measures, setMeasures] = useState<IMeasure[]>(() => build(level))
  const [phase, setPhase] = useState<Phase>('idle')
  const [count, setCount] = useState(0)
  const [current, setCurrent] = useState(-1)
  const [result, setResult] = useState<IScoreResult | null>(null)
  const [pressed, setPressed] = useState<Set<number>>(() => new Set())
  const [pulse, setPulse] = useState(-1)
  const [range] = useState(() => pianoRange(level))
  const phaseRef = useRef<Phase>('idle')
  const tapsRef = useRef<ITap[]>([])
  const timingRef = useRef<ITiming | null>(null)
  const rafRef = useRef<number | null>(null)
  const stopClicksRef = useRef<(() => void) | null>(null)
  const starts = useMemo(() => startsOf(measures), [measures])
  const bpm = progress.settings.bpm

  const score = useMemo<IScore>(
    () => ({ system: level.kind === 'phrase' ? (level.hands ? 'grand' : level.clef) : 'rhythm', key: 'C', timeSig: [4, 4], barlines: true, measures }),
    [level, measures],
  )

  const setPhaseBoth = useCallback((p: Phase) => {
    phaseRef.current = p
    setPhase(p)
  }, [])

  const finish = useCallback(() => {
    const t = timingRef.current
    if (!t) return
    const r = scoreTaps(t.onsets, tapsRef.current, pitched)
    setResult(r)
    setCurrent(-1)
    setPulse(-1)
    setPhaseBoth('done')
    update((p) => recordSession(recordScore(p, level.id, r.score), { date: Date.now(), level: level.id, accuracy: r.score / 100, medianRt: 0 }))
  }, [level.id, pitched, setPhaseBoth, update])

  const loop = useCallback(() => {
    const t = timingRef.current
    if (!t) return
    const now = performance.now()
    const beat = (now - t.perfStart) / t.beatMs
    setPulse(beat < 0 ? -1 : Math.floor(beat % BEATS_PER_MEASURE))
    if (beat < COUNT_IN) {
      setCount(Math.min(COUNT_IN, Math.max(1, Math.floor(beat) + 1)))
    } else {
      if (phaseRef.current !== 'playing') setPhaseBoth('playing')
      const b = beat - COUNT_IN + 0.08
      let latest = -1
      for (const s of starts) if (s.beat <= b && s.beat > latest) latest = s.beat
      setCurrent(latest)
    }
    if (now > t.end + TAIL_MS) {
      finish()
      return
    }
    rafRef.current = requestAnimationFrame(loop)
  }, [finish, setPhaseBoth, starts])

  const start = useCallback(async () => {
    unlockAudio()
    const ctx = getContext()
    try {
      await ctx.resume()
    } catch {
      return
    }
    const beatMs = 60000 / bpm
    const t0 = ctx.currentTime + LEAD_S
    const totalBeats = COUNT_IN + measures.length * BEATS_PER_MEASURE
    stopClicksRef.current?.()
    stopClicksRef.current = scheduleClicks(
      ctx,
      Array.from({ length: totalBeats }, (_, b) => ({ time: t0 + (b * beatMs) / 1000, accent: b % BEATS_PER_MEASURE === 0 })),
    )
    const perfStart = performance.now() + (t0 - ctx.currentTime) * 1000
    const onsets = onsetsOf(measures).map((o) => ({ index: o.index, time: perfStart + (COUNT_IN + o.beat) * beatMs, midi: o.midi }))
    timingRef.current = { perfStart, beatMs, onsets, end: perfStart + totalBeats * beatMs }
    tapsRef.current = []
    setResult(null)
    setCurrent(-1)
    setCount(1)
    setPhaseBoth('countin')
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    rafRef.current = requestAnimationFrame(loop)
  }, [bpm, loop, measures, setPhaseBoth])

  const tap = useCallback((midi: number | null, at?: number) => {
    const ph = phaseRef.current
    if (ph === 'countin' || ph === 'playing') tapsRef.current.push({ t: at ?? performance.now(), midi })
  }, [])

  const handleOn = useCallback(
    (midi: number, at?: number) => {
      audioOn(midi)
      setPressed((prev) => {
        const n = new Set(prev)
        n.add(midi)
        return n
      })
      tap(midi, at)
    },
    [tap],
  )

  const handleOff = useCallback((midi: number) => {
    audioOff(midi)
    setPressed((prev) => {
      if (!prev.has(midi)) return prev
      const n = new Set(prev)
      n.delete(midi)
      return n
    })
  }, [])

  const onSpace = useCallback(() => {
    const ph = phaseRef.current
    if (ph === 'idle' || ph === 'done') void start()
    else if (!pitched) tap(null)
  }, [pitched, start, tap])

  useEffect(() => {
    setMidiHandlers(handleOn, handleOff)
    return () => setMidiHandlers(null, null)
  }, [handleOn, handleOff])

  useComputerKeys({ enabled: true, onNoteOn: handleOn, onNoteOff: handleOff, onSpace })

  useEffect(
    () => () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      stopClicksRef.current?.()
    },
    [],
  )

  const regenerate = (): void => {
    setMeasures(build(level))
    setResult(null)
    setCurrent(-1)
    setPhaseBoth('idle')
  }

  const replay = (): void => {
    setResult(null)
    setCurrent(-1)
    setPhaseBoth('idle')
  }

  const states = useMemo(() => {
    const out: Record<number, string> = {}
    if (phase === 'playing' && current >= 0) {
      for (const s of starts) if (s.beat === current) out[s.index] = 'current'
    }
    if (result) {
      for (const r of result.results) {
        out[r.index] = r.pitchOk === false || r.grade === 'miss' ? 'bad' : r.grade === 'late' ? 'meh' : 'ok'
      }
    }
    return out
  }, [phase, current, result, starts])

  const labels = useMemo(() => {
    const out: Record<number, string> = {}
    if (!result) return out
    const beatOf = new Map(starts.map((s) => [s.index, s.beat]))
    const columns = new Map<number, IOnsetResult[]>()
    for (const r of result.results) {
      const b = beatOf.get(r.index) ?? r.index
      columns.set(b, [...(columns.get(b) ?? []), r])
    }
    for (const group of columns.values()) {
      const worst = group.reduce((a, r) => (rank(r) > rank(a) ? r : a))
      out[Math.min(...group.map((r) => r.index))] = labelOf(worst)
    }
    return out
  }, [result, starts])

  const notation = progress.settings.notation
  const keyLabels = pitched && progress.settings.keyLabels === 'on'

  return (
    <div className="screen exercise">
      <header className="bar">
        <button className="link" onClick={onExit}>
          <IconClose />
          Quitter
        </button>
        <div className="bar-title">{level.title}</div>
        <div className="bar-meta">{bpm} bpm</div>
      </header>
      <main className="stage">
        <Staff score={score} sp={12} states={states} labels={labels} className="wide" />
        <div className="exercise-status">
          {phase === 'idle' && (
            <p className="muted">
              {pitched
                ? 'Joue chaque note sur le clavier en suivant le métronome. Une mesure de décompte avant de commencer.'
                : 'Tape chaque note sur une touche en suivant le métronome. Une mesure de décompte avant de commencer.'}
            </p>
          )}
          {phase === 'countin' && <div className="count">{count}</div>}
          {phase === 'playing' && (
            <div className="beats" aria-hidden="true">
              {[0, 1, 2, 3].map((i) => (
                <span key={i} className={`beat ${i === pulse ? 'on' : ''}`} />
              ))}
            </div>
          )}
          {phase === 'done' && result && (
            <div className="result">
              <div className="score-value">{result.score}&nbsp;%</div>
              <div className="muted">{summarize(result, pitched)}</div>
            </div>
          )}
        </div>
        <div className="actions">
          {phase === 'idle' && (
            <>
              <button className="primary" onClick={() => void start()}>
                Démarrer
              </button>
              <button onClick={regenerate}>Autre exercice</button>
            </>
          )}
        </div>
        <div className="actions secondary">
          {phase === 'idle' && (
            <button className="link" onClick={onLesson}>
              Revoir la leçon
            </button>
          )}
          {phase === 'done' && (
            <>
              <button className="primary" onClick={regenerate}>
                Suivant
              </button>
              <button onClick={replay}>Rejouer</button>
            </>
          )}
        </div>
      </main>
      <Piano
        low={range[0]}
        high={range[1]}
        pressed={pressed}
        labels={keyLabels}
        notation={notation}
        onNoteOn={handleOn}
        onNoteOff={handleOff}
      />
    </div>
  )
}
