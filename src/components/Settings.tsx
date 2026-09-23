import { useRef, useState, type ChangeEvent } from 'react'
import { isSampledReady } from '../audio/piano'
import type { IProgress, ISettings } from '../engine/progress'
import { dayKey, defaultProgress, exportProgress, importProgress } from '../engine/progress'
import type { IMidi } from '../midi/webmidi'
import { IconBack } from './Icons'

interface ISettingsProps {
  progress: IProgress
  update: (fn: (p: IProgress) => IProgress) => void
  midi: IMidi
  onExit: () => void
}

export function Settings({ progress, update, midi, onExit }: ISettingsProps) {
  const s = progress.settings
  const [confirmReset, setConfirmReset] = useState(false)
  const [midiHelp, setMidiHelp] = useState(false)
  const [message, setMessage] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const set = (patch: Partial<ISettings>): void => update((p) => ({ ...p, settings: { ...p.settings, ...patch } }))

  const doExport = (): void => {
    const blob = new Blob([exportProgress(progress)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `portee-${dayKey()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const doImport = (e: ChangeEvent<HTMLInputElement>): void => {
    const file = e.target.files?.[0]
    if (!file) return
    file
      .text()
      .then((text) => {
        const parsed = importProgress(text)
        if (parsed) {
          update(() => parsed)
          setMessage('Progression importée.')
        } else {
          setMessage('Fichier invalide.')
        }
      })
      .catch(() => setMessage('Lecture impossible.'))
    e.target.value = ''
  }

  const doReset = (): void => {
    if (!confirmReset) {
      setConfirmReset(true)
      return
    }
    update(() => defaultProgress())
    setConfirmReset(false)
    setMessage('Progression remise à zéro.')
  }

  return (
    <div className="screen settings">
      <header className="bar">
        <button className="icon-button" aria-label="Retour" onClick={onExit}>
          <IconBack />
        </button>
        <div className="bar-title">Réglages</div>
        <div className="bar-meta" />
      </header>
      <main className="scroll">
        <div className="row">
          <span>Noms des notes</span>
          <span className="seg">
            <button className={s.notation === 'fr' ? 'active' : ''} onClick={() => set({ notation: 'fr' })}>
              do ré mi
            </button>
            <button className={s.notation === 'en' ? 'active' : ''} onClick={() => set({ notation: 'en' })}>
              C D E
            </button>
          </span>
        </div>
        <div className="row">
          <span>Noms sur les touches</span>
          <span className="seg">
            <button className={s.keyLabels === 'auto' ? 'active' : ''} onClick={() => set({ keyLabels: 'auto' })}>
              Repères
            </button>
            <button className={s.keyLabels === 'on' ? 'active' : ''} onClick={() => set({ keyLabels: 'on' })}>
              Toujours
            </button>
            <button className={s.keyLabels === 'off' ? 'active' : ''} onClick={() => set({ keyLabels: 'off' })}>
              Jamais
            </button>
          </span>
        </div>
        <div className="row">
          <span>Tempo</span>
          <span className="range">
            <input type="range" min={50} max={110} step={5} value={s.bpm} onChange={(e) => set({ bpm: Number(e.target.value) })} />
            <span className="range-value">{s.bpm} bpm</span>
          </span>
        </div>
        <div className="row">
          <span>Clavier MIDI</span>
          {midi.status === 'unsupported' && <span className="muted">Non supporté par ce navigateur</span>}
          {midi.status === 'off' && <button onClick={midi.connect}>Connecter</button>}
          {midi.status === 'requesting' && <span className="muted">Demande en cours</span>}
          {midi.status === 'denied' && <span className="muted">Accès refusé par le navigateur</span>}
          {midi.status === 'on' && <span className="muted">{midi.inputs.length > 0 ? midi.inputs.join(', ') : 'Aucun clavier branché'}</span>}
        </div>
        <div className="row help-row">
          <button className="link" onClick={() => setMidiHelp(!midiHelp)}>
            {midiHelp ? 'Masquer la marche à suivre' : 'Comment brancher un clavier MIDI'}
          </button>
          {midiHelp && (
            <div className="help">
              <ol>
                <li>
                  Branche le piano numérique à l’ordinateur ou au téléphone Android avec un câble USB. Côté piano la prise est le plus souvent en USB-B, la même que sur une imprimante. Allume le piano avant d’ouvrir la page.
                </li>
                <li>
                  Utilise Chrome, Edge ou Brave. Safari ne propose pas Web MIDI, ni sur Mac ni sur iPhone et iPad, où aucun navigateur ne le permet. Sur ces appareils, reste sur le clavier virtuel.
                </li>
                <li>
                  Touche «&nbsp;Connecter&nbsp;» et accepte la demande d’accès du navigateur. Le nom du clavier s’affiche au-dessus et l’autorisation est retenue pour les prochaines visites.
                </li>
                <li>
                  Si rien ne s’affiche, vérifie le câble, éteins puis rallume le piano et recharge la page. En Bluetooth MIDI sur Mac, appaire d’abord le piano dans l’application Configuration audio et MIDI, onglet Bluetooth.
                </li>
              </ol>
              <p className="muted small">
                Une fois branché, chaque touche du piano vaut une touche du clavier virtuel, dans les leçons, la lecture, le rythme et les phrases. Le clavier à l’écran reste disponible.
              </p>
            </div>
          )}
        </div>
        <div className="row">
          <span>Son</span>
          <span className="muted">{isSampledReady() ? 'Piano échantillonné' : 'Synthé en attendant le piano'}</span>
        </div>
        <div className="row">
          <span>Clavier d’ordinateur</span>
          <span className="muted small">La rangée du milieu, de Q à K (A à K en QWERTY), joue do4 à do5. La touche en bas à gauche et X changent d’octave, espace pour démarrer</span>
        </div>
        <h2>Données</h2>
        <div className="actions wrap">
          <button onClick={doExport}>Exporter</button>
          <button onClick={() => fileRef.current?.click()}>Importer</button>
          <button className={confirmReset ? 'danger' : ''} onClick={doReset}>
            {confirmReset ? 'Confirmer la remise à zéro' : 'Remettre à zéro'}
          </button>
          <input ref={fileRef} type="file" accept="application/json" onChange={doImport} hidden />
        </div>
        {message && <p className="muted">{message}</p>}
      </main>
    </div>
  )
}
