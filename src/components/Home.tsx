import { percent, seconds } from '../engine/format'
import type { Level } from '../engine/levels'
import { LEVELS } from '../engine/levels'
import type { IProgress } from '../engine/progress'
import { isStreakAlive } from '../engine/progress'
import type { ILevelState } from '../engine/scheduler'
import { EXERCISES_TO_PASS, exerciseLevelState, pitchLevelState, SESSION_LENGTH } from '../engine/scheduler'
import { IconChart, IconCheck, IconFlame, IconSliders } from './Icons'

interface IHomeProps {
  progress: IProgress
  onSelect: (level: Level) => void
  onLesson: (level: Level) => void
  onStats: () => void
  onSettings: () => void
}

export function levelState(level: Level, progress: IProgress): ILevelState {
  return level.kind === 'pitch' ? pitchLevelState(progress.history[level.id] ?? []) : exerciseLevelState(progress.scores[level.id] ?? [])
}

function statusText(level: Level, state: ILevelState): string {
  if (state.status === 'done') return 'Validé'
  if (state.status === 'new') return ''
  if (level.kind === 'pitch') {
    return `${state.count}/${SESSION_LENGTH} · ${percent(state.accuracy)} · ${seconds(state.medianRt)}`
  }
  return `${state.count}/${EXERCISES_TO_PASS} · ${percent(state.accuracy)}`
}

export function Home({ progress, onSelect, onLesson, onStats, onSettings }: IHomeProps) {
  const groups = [
    { title: 'Lecture', levels: LEVELS.filter((l) => l.kind === 'pitch') },
    { title: 'Rythme', levels: LEVELS.filter((l) => l.kind === 'rhythm') },
    { title: 'Phrases', levels: LEVELS.filter((l) => l.kind === 'phrase') },
  ]
  const streak = isStreakAlive(progress.streak) ? progress.streak.count : 0

  return (
    <div className="screen home">
      <header className="bar">
        <div className="brand-block">
          <div className="brand">Portée</div>
          <p className="streak">
            {streak > 0 && <IconFlame />}
            <span>{streak > 0 ? `${streak} jour${streak > 1 ? 's' : ''} d’affilée` : 'Une série par jour suffit.'}</span>
          </p>
        </div>
        <div className="bar-actions">
          <button className="icon-button" aria-label="Stats" onClick={onStats}>
            <IconChart />
          </button>
          <button className="icon-button" aria-label="Réglages" onClick={onSettings}>
            <IconSliders />
          </button>
        </div>
      </header>
      <main className="scroll">
        {groups.map((g) => {
          let recommended = false
          return (
            <section key={g.title}>
              <h2>{g.title}</h2>
              {g.levels.map((level, idx) => {
                const state = levelState(level, progress)
                const isRecommended = !recommended && state.status !== 'done'
                if (isRecommended) recommended = true
                return (
                  <div key={level.id} className={`level ${state.status} ${isRecommended ? 'recommended' : ''}`}>
                    <button className="level-main" onClick={() => onSelect(level)}>
                      <span className="level-num">{state.status === 'done' ? <IconCheck /> : idx + 1}</span>
                      <span className="level-body">
                        <span className="level-title">{level.title}</span>
                        <span className="level-sub">{level.subtitle}</span>
                        {statusText(level, state) && <span className="level-status">{statusText(level, state)}</span>}
                      </span>
                    </button>
                    <button className="level-lesson" onClick={() => onLesson(level)}>
                      Leçon
                    </button>
                  </div>
                )
              })}
            </section>
          )
        })}
      </main>
    </div>
  )
}
