import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { noteOff as audioOff, noteOn as audioOn, playNote } from '../audio/piano'
import type { ILesson } from '../engine/lessons'
import type { Level } from '../engine/levels'
import { keyAlteration, letterAt, midiAt, noteName } from '../engine/notes'
import type { IProgress } from '../engine/progress'
import type { IElement } from '../engine/rhythm'
import type { IScore } from '../score/layout'
import { IconClose } from './Icons'
import { Piano } from './Piano'
import { Staff } from './Staff'

interface ILessonProps {
  level: Level
  lesson: ILesson
  progress: IProgress
  update: (fn: (p: IProgress) => IProgress) => void
  onStart: () => void
  onExit: () => void
}

interface IQuiz {
  target: number
  answered: number[]
  wrong: number | null
}

const WRONG_FLASH = 500

function midiOf(el: IElement | undefined, score: IScore | undefined): number | null {
  if (!el || el.kind !== 'note' || el.diatonic === undefined) return null
  return midiAt(el.diatonic, el.shown ?? keyAlteration(score?.key ?? 'C', letterAt(el.diatonic)))
}

function pickTarget(answered: number[], candidates: number[]): number {
  const rest = candidates.filter((i) => !answered.includes(i))
  return rest.length > 0 ? rest[Math.floor(Math.random() * rest.length)] : -1
}

export function Lesson({ level, lesson, progress, update, onStart, onExit }: ILessonProps) {
  const [index, setIndex] = useState(0)
  const [pressed, setPressed] = useState<Set<number>>(() => new Set())
  const [quiz, setQuiz] = useState<IQuiz>({ target: -1, answered: [], wrong: null })
  const scrollRef = useRef<HTMLElement>(null)
  const flash = useRef<number | null>(null)
  const step = lesson.steps[index]
  const last = index === lesson.steps.length - 1
  const notation = progress.settings.notation
  const elements = useMemo(() => step.score?.measures.flatMap((m) => m.elements) ?? [], [step])
  const candidates = useMemo(() => elements.map((el, i) => (midiOf(el, step.score) === null ? -1 : i)).filter((i) => i >= 0), [elements, step.score])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [index])

  useEffect(() => {
    setQuiz({ target: step.quiz ? pickTarget([], candidates) : -1, answered: [], wrong: null })
  }, [step, candidates])

  useEffect(
    () => () => {
      if (flash.current) window.clearTimeout(flash.current)
    },
    [],
  )

  useEffect(() => {
    if (!last || progress.lessonsSeen.includes(level.id)) return
    update((p) => ({ ...p, lessonsSeen: [...p.lessonsSeen, level.id] }))
  }, [last, level.id, progress.lessonsSeen, update])

  const labels = useMemo(() => {
    if (step.labels) return step.labels
    const out: Record<number, string> = {}
    if (!step.score) return out
    const name = (i: number): string | null => {
      const el = elements[i]
      if (!el || el.kind !== 'note' || el.diatonic === undefined) return null
      const effective = el.shown ?? keyAlteration(step.score?.key ?? 'C', letterAt(el.diatonic))
      return noteName(el.diatonic, effective, notation)
    }
    const shown = step.quiz ? quiz.answered : step.names ? elements.map((_, i) => i) : []
    for (const i of shown) {
      const n = name(i)
      if (n) out[i] = n
    }
    return out
  }, [elements, notation, step, quiz.answered])

  const states = useMemo(() => {
    const out: Record<number, string> = {}
    for (const i of step.accent ?? []) out[i] = 'current'
    if (step.quiz) {
      for (const i of quiz.answered) out[i] = 'ok'
      if (quiz.wrong !== null) out[quiz.wrong] = 'bad'
    }
    return out
  }, [step, quiz])

  const tapNote = useCallback(
    (i: number) => {
      const midi = midiOf(elements[i], step.score)
      if (midi === null) return
      playNote(midi)
      if (!step.quiz || quiz.target < 0) return
      if (i === quiz.target) {
        const answered = [...quiz.answered, i]
        setQuiz({ target: pickTarget(answered, candidates), answered, wrong: null })
        return
      }
      setQuiz((q) => ({ ...q, wrong: i }))
      if (flash.current) window.clearTimeout(flash.current)
      flash.current = window.setTimeout(() => setQuiz((q) => ({ ...q, wrong: null })), WRONG_FLASH)
    },
    [candidates, elements, step, quiz],
  )

  const handleOn = useCallback((midi: number) => {
    audioOn(midi)
    setPressed((prev) => new Set(prev).add(midi))
  }, [])

  const handleOff = useCallback((midi: number) => {
    audioOff(midi)
    setPressed((prev) => {
      if (!prev.has(midi)) return prev
      const n = new Set(prev)
      n.delete(midi)
      return n
    })
  }, [])

  const targetMidi = step.quiz && quiz.target >= 0 ? midiOf(elements[quiz.target], step.score) : null
  const quizDone = !!step.quiz && quiz.target < 0 && candidates.length > 0
  const marks = targetMidi !== null ? [targetMidi] : (step.piano?.marks ?? [])
  const hint = step.quiz
    ? quizDone
      ? 'Bien joué, toutes les notes sont trouvées.'
      : `Trouve sur la portée la note de la touche allumée. ${quiz.answered.length}/${candidates.length}`
    : 'Touche une note pour l’entendre.'

  return (
    <div className="screen lesson">
      <header className="bar">
        <button className="link" onClick={onExit}>
          <IconClose />
          Quitter
        </button>
        <div className="bar-title">{level.title}</div>
        <div className="bar-meta">
          {index + 1} / {lesson.steps.length}
        </div>
      </header>
      <main className="scroll" ref={scrollRef}>
        <h2 className="lesson-title">{step.title}</h2>
        {step.score && (
          <div className={`lesson-figure ${step.score.measures.length >= 3 ? 'wide' : ''}`}>
            <Staff score={step.score} sp={12} states={states} labels={labels} onTap={tapNote} />
            {elements.some((el) => el.kind === 'note') && <p className={`muted small figure-hint ${quizDone ? 'done' : ''}`}>{hint}</p>}
          </div>
        )}
        {step.text.map((t, i) => (
          <p key={i} className="lesson-text">
            {t}
          </p>
        ))}
        {step.piano && (
          <div className="lesson-piano">
            <Piano
              low={step.piano.low}
              high={step.piano.high}
              pressed={pressed}
              marks={marks}
              labels
              notation={notation}
              onNoteOn={handleOn}
              onNoteOff={handleOff}
            />
          </div>
        )}
        <div className="actions lesson-actions">
          {index > 0 && <button onClick={() => setIndex(index - 1)}>Précédent</button>}
          {!last && (
            <button className="primary" onClick={() => setIndex(index + 1)}>
              Suivant
            </button>
          )}
          {last && (
            <button className="primary" onClick={onStart}>
              Commencer l’entraînement
            </button>
          )}
        </div>
      </main>
    </div>
  )
}
