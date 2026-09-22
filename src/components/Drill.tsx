import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { noteOff as audioOff, noteOn as audioOn } from '../audio/piano'
import { percent, seconds } from '../engine/format'
import type { IPitchLevel } from '../engine/levels'
import { pianoRange } from '../engine/levels'
import type { ICard, KeyId, Notation } from '../engine/notes'
import { cardName, KEYS } from '../engine/notes'
import type { IProgress } from '../engine/progress'
import { recordSession } from '../engine/progress'
import type { IAnswer } from '../engine/scheduler'
import { historyKey, levelStateOf, median, nextKey, PASS_ACCURACY, PASS_RT, pickCard, pitchLevelState, sessionLengthOf, updateStat } from '../engine/scheduler'
import { setMidiHandlers } from '../midi/bus'
import { useComputerKeys } from '../midi/computerKeys'
import type { IScore } from '../score/layout'
import { IconBack, IconClose } from './Icons'
import { Piano } from './Piano'
import { Staff } from './Staff'

type Status = 'waiting' | 'wrong' | 'right'

interface IDrillProps {
  level: IPitchLevel
  progress: IProgress
  update: (fn: (p: IProgress) => IProgress) => void
  onExit: () => void
  onLesson: () => void
}

interface IResult {
  card: ICard
  ok: boolean
  rt: number
}

interface IState {
  i: number
  card: ICard
  shownAt: number
  status: Status
  wrongKey: number | null
  results: IResult[]
  finished: boolean
  sessionKey: KeyId
}

const NEXT_DELAY = 380

function scoreFor(card: ICard, system: IPitchLevel['system']): IScore {
  return {
    system,
    key: card.key,
    timeSig: null,
    barlines: false,
    measures: [
      {
        elements: [
          { kind: 'note', value: 'q', dots: 0, beats: 1, start: 0, clef: card.clef, diatonic: card.diatonic, shown: card.shown, midi: card.midi },
        ],
      },
    ],
  }
}

function pickKey(level: IPitchLevel, progress: IProgress): KeyId {
  return nextKey(level, progress) ?? 'C'
}

function cardsFor(level: IPitchLevel, key: KeyId): ICard[] {
  return level.keys ? level.cards.filter((c) => c.key === key) : level.cards
}

function freshState(level: IPitchLevel, progress: IProgress): IState {
  const sessionKey = pickKey(level, progress)
  return {
    i: 0,
    card: pickCard(cardsFor(level, sessionKey), progress.cards, level.focus, null),
    shownAt: performance.now(),
    status: 'waiting',
    wrongKey: null,
    results: [],
    finished: false,
    sessionKey,
  }
}

export function Drill({ level, progress, update, onExit, onLesson }: IDrillProps) {
  const [range] = useState(() => pianoRange(level))
  const length = sessionLengthOf(level)
  const [pressed, setPressed] = useState<Set<number>>(() => new Set())
  const statsRef = useRef(progress.cards)
  statsRef.current = progress.cards
  const progressRef = useRef(progress)
  progressRef.current = progress
  const [state, setState] = useState<IState>(() => freshState(level, progress))
  const stateRef = useRef(state)
  const timer = useRef<number | null>(null)

  const commit = useCallback((next: IState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const finish = useCallback(
    (results: IResult[]) => {
      const answers: IAnswer[] = results.map((r) => ({ ok: r.ok, rt: r.rt }))
      const accuracy = answers.filter((a) => a.ok).length / answers.length
      const medianRt = median(answers.map((a) => a.rt))
      const key = historyKey(level.id, level.keys ? stateRef.current.sessionKey : null)
      update((p) =>
        recordSession(
          { ...p, history: { ...p.history, [key]: [...(p.history[key] ?? []), ...answers].slice(-length) } },
          { date: Date.now(), level: level.id, accuracy, medianRt },
        ),
      )
    },
    [length, level, update],
  )

  const next = useCallback(() => {
    const s = stateRef.current
    if (s.i + 1 >= length) {
      finish(s.results)
      commit({ ...s, finished: true })
      return
    }
    const card = pickCard(cardsFor(level, s.sessionKey), statsRef.current, level.focus, s.card.id)
    commit({ ...s, i: s.i + 1, card, shownAt: performance.now(), status: 'waiting', wrongKey: null })
  }, [commit, finish, length, level])

  const handleOn = useCallback(
    (midi: number, at?: number) => {
      audioOn(midi)
      setPressed((prev) => {
        const n = new Set(prev)
        n.add(midi)
        return n
      })
      const s = stateRef.current
      if (s.finished || s.status === 'right') return
      const card = s.card
      if (midi === card.midi) {
        if (s.status === 'waiting') {
          const rt = (at ?? performance.now()) - s.shownAt
          update((p) => ({ ...p, cards: { ...p.cards, [card.id]: updateStat(p.cards[card.id], true, rt) } }))
          commit({ ...s, status: 'right', results: [...s.results, { card, ok: true, rt }] })
        } else {
          commit({ ...s, status: 'right', wrongKey: null })
        }
        timer.current = window.setTimeout(next, NEXT_DELAY)
        return
      }
      if (s.status === 'waiting') {
        const rt = performance.now() - s.shownAt
        update((p) => ({ ...p, cards: { ...p.cards, [card.id]: updateStat(p.cards[card.id], false, rt) } }))
        commit({ ...s, status: 'wrong', wrongKey: midi, results: [...s.results, { card, ok: false, rt }] })
      } else {
        commit({ ...s, wrongKey: midi })
      }
    },
    [commit, next, update],
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

  useEffect(() => {
    setMidiHandlers(handleOn, handleOff)
    return () => setMidiHandlers(null, null)
  }, [handleOn, handleOff])

  useComputerKeys({ enabled: true, onNoteOn: handleOn, onNoteOff: handleOff })

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
    },
    [],
  )

  const restart = (): void => commit(freshState(level, progressRef.current))

  const { card, status, i, results, finished, sessionKey } = state
  const notation = progress.settings.notation
  const labels = progress.settings.keyLabels === 'on' || (progress.settings.keyLabels === 'auto' && level.id === 'p1')
  const score = useMemo(() => scoreFor(card, level.system), [card, level.system])

  if (finished) {
    return <Summary level={level} sessionKey={sessionKey} results={results} notation={notation} progress={progress} onAgain={restart} onExit={onExit} onLesson={onLesson} />
  }

  return (
    <div className="screen drill">
      <header className="bar">
        <button className="link" onClick={onExit}>
          <IconClose />
          Quitter
        </button>
        <div className="bar-title">
          {level.title}
          {level.keys ? ` · ${KEYS[sessionKey].label}` : ''}
        </div>
        <div className="bar-meta">
          {i + 1} / {length}
        </div>
      </header>
      <main className="stage">
        <Staff score={score} sp={16} states={{ 0: status }} className={level.system} />
        <div className={`hint ${status}`}>
          {status === 'wrong' ? `C’était ${cardName(card, notation)}` : status === 'right' ? cardName(card, notation) : ' '}
        </div>
      </main>
      <Piano
        low={range[0]}
        high={range[1]}
        pressed={pressed}
        hint={status === 'wrong' ? card.midi : null}
        wrong={state.wrongKey}
        labels={labels}
        notation={notation}
        onNoteOn={handleOn}
        onNoteOff={handleOff}
      />
    </div>
  )
}

interface ISummaryProps {
  level: IPitchLevel
  sessionKey: KeyId
  results: IResult[]
  notation: Notation
  progress: IProgress
  onAgain: () => void
  onExit: () => void
  onLesson: () => void
}

function Summary({ level, sessionKey, results, notation, progress, onAgain, onExit, onLesson }: ISummaryProps) {
  const accuracy = results.filter((r) => r.ok).length / Math.max(1, results.length)
  const medianRt = median(results.map((r) => r.rt))
  const keyed = !!level.keys
  const length = sessionLengthOf(level)
  const state = pitchLevelState(progress.history[historyKey(level.id, keyed ? sessionKey : null)] ?? [], length)
  const whole = levelStateOf(level, progress)
  const next = keyed ? nextKey(level, progress) : null
  let verdict = `Objectif : ${percent(PASS_ACCURACY)} de justesse et un temps médian sous ${seconds(PASS_RT)} sur les ${length} dernières notes.`
  if (whole.status === 'done') verdict = 'Palier validé.'
  else if (state.status === 'done') verdict = keyed ? `${KEYS[sessionKey].label} validé${next ? `, prochaine tonalité : ${KEYS[next].label}` : ''}.` : 'Palier validé.'
  const perCard = new Map<string, { card: ICard; n: number; errors: number; rt: number }>()
  for (const r of results) {
    const a = perCard.get(r.card.id) ?? { card: r.card, n: 0, errors: 0, rt: 0 }
    a.n += 1
    a.errors += r.ok ? 0 : 1
    a.rt += r.rt
    perCard.set(r.card.id, a)
  }
  const weak = [...perCard.values()]
    .map((a) => ({ ...a, avg: a.rt / a.n }))
    .filter((a) => a.errors > 0 || a.avg > PASS_RT)
    .sort((a, b) => b.errors - a.errors || b.avg - a.avg)
    .slice(0, 5)

  return (
    <div className="screen summary">
      <header className="bar">
        <button className="link" onClick={onExit}>
          <IconBack />
          Retour
        </button>
        <div className="bar-title">{level.title}</div>
        <div className="bar-meta" />
      </header>
      <main className="scroll centered">
        <h2>Série terminée</h2>
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{percent(accuracy)}</div>
            <div className="stat-label">justesse</div>
          </div>
          <div className="stat">
            <div className="stat-value">{seconds(medianRt, 2)}</div>
            <div className="stat-label">temps médian</div>
          </div>
        </div>
        <p className="muted">{verdict}</p>
        {weak.length > 0 && (
          <div className="weak">
            <h3>À travailler</h3>
            <ul>
              {weak.map((a) => (
                <li key={a.card.id}>
                  <span>
                    {cardName(a.card, notation)}
                    <span className="muted small"> · {a.card.clef === 'treble' ? 'clé de sol' : 'clé de fa'}</span>
                  </span>
                  <span className="muted">
                    {a.errors > 0 ? `${a.errors} erreur${a.errors > 1 ? 's' : ''} · ` : ''}
                    {seconds(a.avg)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div className="actions">
          <button className="primary" onClick={onAgain}>
            Encore une série
          </button>
          <button onClick={onExit}>Terminer</button>
        </div>
        <button className="link" onClick={onLesson}>
          Revoir la leçon
        </button>
      </main>
    </div>
  )
}
