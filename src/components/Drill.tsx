import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getContext, noteOff as audioOff, noteOn as audioOn, playNote, unlockAudio } from '../audio/piano'
import { percent, seconds } from '../engine/format'
import type { IReward, Judgement } from '../engine/game'
import { COMBO_STEP, MAX_MULTIPLIER, multiplier, nextLevel, notePoints, settle } from '../engine/game'
import { lessonFor } from '../engine/lessons'
import type { IPitchLevel, Level } from '../engine/levels'
import { CHRONO_ID, LEVELS, pianoRange, REVIEW_ID } from '../engine/levels'
import type { ICard, KeyId, Notation } from '../engine/notes'
import { cardName, KEYS } from '../engine/notes'
import type { IProgress } from '../engine/progress'
import { recordSession } from '../engine/progress'
import type { IAnswer } from '../engine/scheduler'
import { historyKey, levelStateOf, median, nextKey, PASS_ACCURACY, PASS_RT, pickCard, pitchLevelState, sessionLengthOf, updateStat } from '../engine/scheduler'
import { setMidiHandlers } from '../midi/bus'
import { useComputerKeys } from '../midi/computerKeys'
import type { IScore } from '../score/layout'
import { IconClose, IconCrown, IconSpeaker, IconTrophy } from './Icons'
import { Piano } from './Piano'
import { BadgeList, formatScore, Stars, XpCard } from './Reward'
import { Staff } from './Staff'

type Status = 'waiting' | 'wrong' | 'right'

interface IDrillProps {
  level: IPitchLevel
  progress: IProgress
  update: (fn: (p: IProgress) => IProgress) => void
  onExit: () => void
  onLesson: () => void
  onSelect: (level: Level) => void
}

interface IResult {
  card: ICard
  ok: boolean
  rt: number
}

interface IPop {
  id: number
  points: number
  judgement: Judgement | 'miss'
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
  heard: boolean
  score: number
  streak: number
  bestCombo: number
  pop: IPop | null
  startedAt: number | null
}

const NEXT_DELAY = 380
const REFERENCE = 60
const PROMPT_GAP = 750
const LABEL: Record<IPop['judgement'], string> = { perfect: 'Parfait !', good: 'Bien !', ok: 'Juste', miss: 'Raté' }

function scoreFor(card: ICard, system: IPitchLevel['system'], hidden: boolean): IScore {
  return {
    system,
    key: card.key,
    timeSig: null,
    barlines: false,
    measures: [
      {
        elements: hidden
          ? []
          : [{ kind: 'note', value: 'q', dots: 0, beats: 1, start: 0, clef: card.clef, diatonic: card.diatonic, shown: card.shown, midi: card.midi }],
      },
    ],
  }
}

function cardsFor(level: IPitchLevel, key: KeyId): ICard[] {
  return level.keys ? level.cards.filter((c) => c.key === key) : level.cards
}

function freshState(level: IPitchLevel, progress: IProgress): IState {
  const sessionKey = nextKey(level, progress) ?? 'C'
  return {
    i: 0,
    card: pickCard(cardsFor(level, sessionKey), level.ear ? {} : progress.cards, level.focus, null),
    shownAt: performance.now(),
    status: 'waiting',
    wrongKey: null,
    results: [],
    finished: false,
    sessionKey,
    heard: !level.ear,
    score: 0,
    streak: 0,
    bestCombo: 0,
    pop: null,
    startedAt: level.timed ? null : performance.now(),
  }
}

export function Drill({ level, progress, update, onExit, onLesson, onSelect }: IDrillProps) {
  const [range] = useState(() => pianoRange(level))
  const length = sessionLengthOf(level)
  const ear = !!level.ear
  const timed = level.timed ?? 0
  const passRt = level.passRt ?? PASS_RT
  const [pressed, setPressed] = useState<Set<number>>(() => new Set())
  const statsRef = useRef(progress.cards)
  statsRef.current = progress.cards
  const progressRef = useRef(progress)
  progressRef.current = progress
  const [state, setState] = useState<IState>(() => freshState(level, progress))
  const [reward, setReward] = useState<IReward | null>(null)
  const [now, setNow] = useState(() => performance.now())
  const stateRef = useRef(state)
  const timer = useRef<number | null>(null)
  const promptTimer = useRef<number | null>(null)
  const popId = useRef(0)

  const commit = useCallback((next: IState) => {
    stateRef.current = next
    setState(next)
  }, [])

  const finish = useCallback(
    (s: IState) => {
      const answers: IAnswer[] = s.results.map((r) => ({ ok: r.ok, rt: r.rt }))
      const correct = answers.filter((a) => a.ok).length
      const accuracy = answers.length > 0 ? correct / answers.length : 0
      const medianRt = median(answers.map((a) => a.rt))
      const key = historyKey(level.id, level.keys ? s.sessionKey : null)
      const record = (p: IProgress): IProgress => {
        const withHistory = timed ? p : { ...p, history: { ...p.history, [key]: [...(p.history[key] ?? []), ...answers].slice(-length) } }
        return recordSession(withHistory, { date: Date.now(), level: level.id, accuracy, medianRt })
      }
      const input = { level, points: s.score, accuracy, medianRt, bestCombo: s.bestCombo, correct }
      setReward(settle(progressRef.current, input, record).reward)
      update((p) => settle(p, input, record).progress)
    },
    [length, level, timed, update],
  )

  const next = useCallback(() => {
    const s = stateRef.current
    if (!timed && s.i + 1 >= length) {
      finish(s)
      commit({ ...s, finished: true })
      return
    }
    const card = pickCard(cardsFor(level, s.sessionKey), ear ? {} : statsRef.current, level.focus, s.card.id)
    commit({ ...s, i: s.i + 1, card, shownAt: performance.now(), status: 'waiting', wrongKey: null, heard: !ear })
  }, [commit, ear, finish, length, level, timed])

  const prompt = useCallback(() => {
    if (!ear) return
    unlockAudio()
    if (promptTimer.current) window.clearTimeout(promptTimer.current)
    playNote(REFERENCE, 600)
    promptTimer.current = window.setTimeout(() => {
      promptTimer.current = null
      const s = stateRef.current
      if (s.finished) return
      playNote(s.card.midi, 900)
      if (!s.heard) commit({ ...s, heard: true, shownAt: performance.now() })
    }, PROMPT_GAP)
  }, [commit, ear])

  const start = useCallback(() => {
    unlockAudio()
    const t = performance.now()
    setNow(t)
    commit({ ...stateRef.current, startedAt: t, shownAt: t })
  }, [commit])

  const handleOn = useCallback(
    (midi: number, at?: number) => {
      audioOn(midi)
      setPressed((prev) => {
        const n = new Set(prev)
        n.add(midi)
        return n
      })
      const s = stateRef.current
      if (s.finished || s.status === 'right' || !s.heard || s.startedAt === null) return
      const card = s.card
      const rt = Math.max(0, (at ?? performance.now()) - s.shownAt)
      if (midi === card.midi) {
        if (s.status === 'waiting') {
          if (!ear) update((p) => ({ ...p, cards: { ...p.cards, [card.id]: updateStat(p.cards[card.id], true, rt) } }))
          const gain = notePoints(rt, s.streak, passRt)
          const streak = s.streak + 1
          popId.current += 1
          commit({
            ...s,
            status: 'right',
            results: [...s.results, { card, ok: true, rt }],
            score: s.score + gain.points,
            streak,
            bestCombo: Math.max(s.bestCombo, streak),
            pop: { id: popId.current, points: gain.points, judgement: gain.judgement },
          })
        } else {
          commit({ ...s, status: 'right', wrongKey: null })
        }
        timer.current = window.setTimeout(next, NEXT_DELAY)
        return
      }
      if (s.status === 'waiting') {
        if (!ear) update((p) => ({ ...p, cards: { ...p.cards, [card.id]: updateStat(p.cards[card.id], false, rt) } }))
        popId.current += 1
        commit({ ...s, status: 'wrong', wrongKey: midi, results: [...s.results, { card, ok: false, rt }], streak: 0, pop: { id: popId.current, points: 0, judgement: 'miss' } })
      } else {
        commit({ ...s, wrongKey: midi })
      }
    },
    [commit, ear, next, passRt, update],
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

  useEffect(() => {
    if (!ear || state.finished) return
    if (getContext().state === 'running') prompt()
  }, [ear, prompt, state.finished, state.i])

  useEffect(() => {
    if (!timed || state.startedAt === null || state.finished) return
    const end = state.startedAt + timed * 1000
    const tick = window.setInterval(() => {
      const t = performance.now()
      setNow(t)
      if (t < end) return
      window.clearInterval(tick)
      const s = stateRef.current
      if (s.finished) return
      if (timer.current) window.clearTimeout(timer.current)
      finish(s)
      commit({ ...s, finished: true })
    }, 200)
    return () => window.clearInterval(tick)
  }, [commit, finish, state.finished, state.startedAt, timed])

  useEffect(
    () => () => {
      if (timer.current) window.clearTimeout(timer.current)
      if (promptTimer.current) window.clearTimeout(promptTimer.current)
    },
    [],
  )

  const restart = (): void => {
    setReward(null)
    commit(freshState(level, progressRef.current))
  }

  const { card, status, i, results, finished, sessionKey, heard, score, streak, pop, startedAt } = state
  const notation = progress.settings.notation
  const keyLabels = progress.settings.keyLabels
  const labels = keyLabels === 'on' || (keyLabels === 'auto' && (level.id === 'p1' || ear))
  const hidden = ear && status === 'waiting'
  const scoreView = useMemo(() => scoreFor(card, level.system, hidden), [card, level.system, hidden])

  if (finished && reward) {
    return (
      <Summary
        level={level}
        sessionKey={sessionKey}
        results={results}
        bestCombo={state.bestCombo}
        reward={reward}
        notation={notation}
        progress={progress}
        onAgain={restart}
        onExit={onExit}
        onLesson={onLesson}
        onSelect={onSelect}
      />
    )
  }

  const mult = multiplier(streak)
  const steps = mult >= MAX_MULTIPLIER ? COMBO_STEP : streak % COMBO_STEP
  const record = progress.records[level.id] ?? 0
  const remaining = timed && startedAt !== null ? Math.max(0, Math.ceil((startedAt + timed * 1000 - now) / 1000)) : timed
  const last = results[results.length - 1]
  const answer = status === 'wrong' ? `C’était ${cardName(card, notation)}` : status === 'right' ? (last && last.ok && last.card.id === card.id ? `${cardName(card, notation)} · ${seconds(last.rt)}` : cardName(card, notation)) : ' '

  return (
    <div className="screen drill">
      <header className="game-bar">
        <button className="icon-button" aria-label="Quitter" onClick={onExit}>
          <IconClose />
        </button>
        <div className="score">
          <span className="score-label">Score</span>
          <span className="score-num">{formatScore(score)}</span>
        </div>
        <div className="game-side">
          <span className={`progress-count ${timed ? 'timer' : ''} ${timed && remaining <= 10 && startedAt !== null ? 'urgent' : ''}`}>{timed ? `${remaining} s` : `${i + 1} / ${length}`}</span>
          {record > 0 && (
            <span className="best">
              <IconTrophy size={12} />
              {timed ? `${record} notes` : formatScore(record)}
            </span>
          )}
        </div>
      </header>
      <div className="combo-row">
        <span className={`combo ${mult > 1 ? 'on' : ''}`}>Combo ×{mult}</span>
        <span className="combo-steps" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((k) => (
            <span key={k} className={k < steps ? 'on' : ''} />
          ))}
        </span>
      </div>
      <p className="game-title">
        {level.title}
        {level.keys ? ` · ${KEYS[sessionKey].label}` : ''}
      </p>
      <main className="stage">
        {timed && startedAt === null ? (
          <div className="chrono-start">
            <span className="chrono-title">Prêt ?</span>
            <p>{`${timed} secondes pour jouer un maximum de notes justes. Une erreur casse le combo.`}</p>
            {record > 0 && <p className="muted">Ton record : {record} notes</p>}
            <button className="primary" onClick={start}>
              Démarrer
            </button>
          </div>
        ) : (
          <>
            <div className="pop-slot" aria-live="polite">
              {pop && (
                <span key={pop.id} className={`pop ${pop.judgement}`}>
                  <span className="pop-label">{LABEL[pop.judgement]}</span>
                  {pop.points > 0 && <span className="pop-points">+{pop.points}</span>}
                </span>
              )}
            </div>
            <Staff score={scoreView} sp={16} states={{ 0: status }} className={level.system} />
            <div className={`answer ${status}`}>{answer}</div>
            {hidden && (
              <div className="ear-controls">
                <button className={heard ? '' : 'primary'} onClick={prompt}>
                  <IconSpeaker />
                  {heard ? 'Réécouter' : 'Écouter'}
                </button>
              </div>
            )}
          </>
        )}
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
  bestCombo: number
  reward: IReward
  notation: Notation
  progress: IProgress
  onAgain: () => void
  onExit: () => void
  onLesson: () => void
  onSelect: (level: Level) => void
}

function Summary({ level, sessionKey, results, bestCombo, reward, notation, progress, onAgain, onExit, onLesson, onSelect }: ISummaryProps) {
  const accuracy = results.filter((r) => r.ok).length / Math.max(1, results.length)
  const medianRt = median(results.map((r) => r.rt))
  const keyed = !!level.keys
  const chrono = level.id === CHRONO_ID
  const review = level.id === REVIEW_ID
  const palier = LEVELS.some((l) => l.id === level.id)
  const length = sessionLengthOf(level)
  const passRt = level.passRt ?? PASS_RT
  const keyState = pitchLevelState(progress.history[historyKey(level.id, keyed ? sessionKey : null)] ?? [], length, passRt)
  const whole = levelStateOf(level, progress)
  const following = keyed ? nextKey(level, progress) : null
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
    .filter((a) => a.errors > 0 || a.avg > passRt)
    .sort((a, b) => b.errors - a.errors || b.avg - a.avg)
    .slice(0, 5)
  let verdict = `Troisième étoile : ${percent(PASS_ACCURACY)} de justesse et un temps médian sous ${seconds(passRt)} sur ${length} notes.`
  if (whole.status === 'done') verdict = 'Palier validé.'
  else if (keyed && keyState.status === 'done') verdict = `${KEYS[sessionKey].label} validé${following ? `, prochaine tonalité : ${KEYS[following].label}` : ''}.`
  if (review) verdict = weak.length > 0 ? 'Révision faite. Les notes ci-dessous reviendront plus souvent.' : 'Révision faite, aucune note fragile aujourd’hui.'
  if (chrono) verdict = reward.previousRecord > 0 && !reward.newRecord ? `Ton record reste à ${reward.previousRecord} notes.` : 'Reviens battre ce score demain.'
  const upcoming = palier ? nextLevel(level, progress) : null
  const nextKeyReady = keyed && keyState.status === 'done' && !!following && whole.status !== 'done'

  return (
    <div className="screen reward">
      <main className="scroll centered">
        <span className="eyebrow">{chrono ? 'Temps écoulé' : 'Série terminée'} · {level.title}</span>
        {reward.newRecord && (
          <span className="record-flag">
            <IconCrown size={24} />
            Nouveau record
          </span>
        )}
        <span className="big-score">{chrono ? reward.correct : formatScore(reward.points)}</span>
        <span className="score-delta">
          {chrono
            ? `notes justes · ${formatScore(reward.points)} points`
            : reward.newRecord && reward.previousRecord > 0
              ? `+${formatScore(reward.points - reward.previousRecord)} sur ton ancien record`
              : reward.previousRecord > 0
                ? `Record : ${formatScore(reward.previousRecord)}`
                : 'points'}
        </span>
        {palier && <Stars n={reward.starsAfter} from={reward.starsBefore} size={44} className="big" />}
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{percent(accuracy)}</div>
            <div className="stat-label">justesse</div>
          </div>
          <div className="stat">
            <div className="stat-value">{seconds(medianRt)}</div>
            <div className="stat-label">temps médian</div>
          </div>
          <div className="stat">
            <div className="stat-value">×{multiplier(bestCombo)}</div>
            <div className="stat-label">{`meilleur combo, ${bestCombo} d’affilée`}</div>
          </div>
        </div>
        <p className="verdict">{verdict}</p>
        <XpCard reward={reward} />
        <BadgeList ids={reward.badges} />
        {weak.length > 0 && (
          <div className="weak">
            <h3>À revoir</h3>
            <ul>
              {weak.map((a) => (
                <li key={a.card.id}>
                  <span>
                    {cardName(a.card, notation)}
                    {!level.ear && <span className="muted small"> · {a.card.clef === 'treble' ? 'clé de sol' : 'clé de fa'}</span>}
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
          <button className="replay" onClick={onAgain}>
            {nextKeyReady ? 'Tonalité suivante' : 'Rejouer'}
          </button>
          {upcoming ? (
            <button className="primary next" onClick={() => onSelect(upcoming)}>
              Suivant
            </button>
          ) : (
            <button className="primary next" onClick={onExit}>
              Terminer
            </button>
          )}
        </div>
        {lessonFor(level.id) && (
          <button className="link" onClick={onLesson}>
            Revoir la leçon
          </button>
        )}
      </main>
    </div>
  )
}
