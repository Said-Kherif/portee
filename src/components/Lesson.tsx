import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { noteOff as audioOff, noteOn as audioOn, playNote } from '../audio/piano'
import type { ILesson } from '../engine/lessons'
import type { Level } from '../engine/levels'
import { keyAlteration, letterAt, midiAt, noteName } from '../engine/notes'
import type { IProgress } from '../engine/progress'
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

export function Lesson({ level, lesson, progress, update, onStart, onExit }: ILessonProps) {
  const [index, setIndex] = useState(0)
  const [pressed, setPressed] = useState<Set<number>>(() => new Set())
  const scrollRef = useRef<HTMLElement>(null)
  const step = lesson.steps[index]
  const last = index === lesson.steps.length - 1
  const notation = progress.settings.notation

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: 0 })
  }, [index])

  useEffect(() => {
    if (!last || progress.lessonsSeen.includes(level.id)) return
    update((p) => ({ ...p, lessonsSeen: [...p.lessonsSeen, level.id] }))
  }, [last, level.id, progress.lessonsSeen, update])

  const elements = useMemo(() => step.score?.measures.flatMap((m) => m.elements) ?? [], [step])

  const labels = useMemo(() => {
    if (step.labels) return step.labels
    const out: Record<number, string> = {}
    if (!step.names || !step.score) return out
    elements.forEach((el, i) => {
      if (el.kind !== 'note' || el.diatonic === undefined) return
      const effective = el.shown ?? keyAlteration(step.score?.key ?? 'C', letterAt(el.diatonic))
      out[i] = noteName(el.diatonic, effective, notation)
    })
    return out
  }, [elements, notation, step])

  const states = useMemo(() => {
    const out: Record<number, string> = {}
    for (const i of step.accent ?? []) out[i] = 'current'
    return out
  }, [step])

  const tapNote = useCallback(
    (i: number) => {
      const el = elements[i]
      if (!el || el.kind !== 'note' || el.diatonic === undefined) return
      const effective = el.shown ?? keyAlteration(step.score?.key ?? 'C', letterAt(el.diatonic))
      playNote(midiAt(el.diatonic, effective))
    },
    [elements, step],
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
            {elements.some((el) => el.kind === 'note') && <p className="muted small figure-hint">Touche une note pour l’entendre.</p>}
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
              marks={step.piano.marks}
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
