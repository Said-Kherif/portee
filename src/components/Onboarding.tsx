import { useCallback, useMemo, useState } from 'react'
import { noteOff as audioOff, noteOn as audioOn } from '../audio/piano'
import type { Notation } from '../engine/notes'
import { noteName } from '../engine/notes'
import type { IScore } from '../score/layout'
import { Piano } from './Piano'
import { Staff } from './Staff'

interface IOnboardingProps {
  notation: Notation
  onDone: () => void
}

const NOTES = [0, 2, 4, 7]

const STAFF: IScore = {
  system: 'treble',
  key: 'C',
  timeSig: null,
  barlines: false,
  beatWidth: 3.4,
  measures: [{ elements: NOTES.map((d, i) => ({ kind: 'note', value: 'w', dots: 0, beats: 1, start: i, clef: 'treble', diatonic: d, shown: null })) }],
}

const STEPS = [
  {
    title: 'Lire une note, trouver la touche',
    text: 'Portée t’apprend à lire les notes sur la portée et à jouer la bonne touche, d’abord juste, puis de plus en plus vite.',
  },
  {
    title: 'Un clavier sous les doigts',
    text: 'Joue sur le clavier de l’écran : touche une note pour l’entendre. Avec un piano numérique branché en USB, active le clavier MIDI dans les réglages.',
  },
  {
    title: 'Joue, gagne des étoiles',
    text: 'Chaque niveau commence par une courte leçon, puis une série de notes à jouer. Enchaîne les notes justes pour le combo, gagne des étoiles pour ouvrir la suite et monte de niveau.',
  },
]

const GROUPS = [
  { name: 'Monde 1 · Lecture', about: 'les notes sur la portée' },
  { name: 'Monde 2 · Rythme', about: 'les durées et la pulsation' },
  { name: 'Monde 3 · Phrases', about: 'les deux, puis à deux mains' },
  { name: 'Monde 4 · Oreille', about: 'une note entendue' },
]

export function Onboarding({ notation, onDone }: IOnboardingProps) {
  const [step, setStep] = useState(0)
  const [pressed, setPressed] = useState<Set<number>>(() => new Set())
  const last = step === STEPS.length - 1
  const labels = useMemo(() => Object.fromEntries(NOTES.map((d, i) => [i, noteName(d, 0, notation)])), [notation])

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
    <div className="screen onboarding">
      <header className="bar">
        <div className="brand">Portée</div>
        <button className="link skip" onClick={onDone}>
          Passer
        </button>
      </header>
      <main className="scroll">
        {step === 0 && (
          <div className="lesson-figure">
            <Staff score={STAFF} sp={12} labels={labels} />
          </div>
        )}
        {step === 1 && (
          <div className="lesson-piano">
            <Piano low={60} high={72} pressed={pressed} labels notation={notation} onNoteOn={handleOn} onNoteOff={handleOff} />
          </div>
        )}
        {step === 2 && (
          <ul className="lesson-figure onboarding-list">
            {GROUPS.map((g) => (
              <li key={g.name}>
                <span>{g.name}</span>
                <span className="muted">{g.about}</span>
              </li>
            ))}
          </ul>
        )}
        <h2 className="lesson-title">{STEPS[step].title}</h2>
        <p className="lesson-text">{STEPS[step].text}</p>
        <div className="onboarding-dots" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.title} className={i === step ? 'on' : ''} />
          ))}
        </div>
        <div className="actions">
          {step > 0 && <button onClick={() => setStep(step - 1)}>Précédent</button>}
          <button className="primary next" onClick={() => (last ? onDone() : setStep(step + 1))}>
            {last ? 'Commencer' : 'Suivant'}
          </button>
        </div>
      </main>
    </div>
  )
}
