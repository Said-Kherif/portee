import { percent, seconds } from '../engine/format'
import type { Level } from '../engine/levels'
import { LEVELS, reviewedToday, reviewLevel } from '../engine/levels'
import { KEYS } from '../engine/notes'
import type { IProgress } from '../engine/progress'
import { isStreakAlive } from '../engine/progress'
import type { ILevelState } from '../engine/scheduler'
import { EXERCISES_TO_PASS, historyKey, levelStateOf, nextKey, pitchLevelState, SESSION_LENGTH, sessionLengthOf } from '../engine/scheduler'
import { IconChart, IconCheck, IconFlame, IconRepeat, IconSliders } from './Icons'

interface IHomeProps {
  progress: IProgress
  onSelect: (level: Level) => void
  onLesson: (level: Level) => void
  onStats: () => void
  onSettings: () => void
}

function statusText(level: Level, state: ILevelState, progress: IProgress): string {
  if (state.status === 'done') return 'Validé'
  if (state.status === 'new') return ''
  if (level.kind === 'pitch' && level.keys) {
    const key = nextKey(level, progress)
    const current = key ? pitchLevelState(progress.history[historyKey(level.id, key)] ?? []) : null
    const detail = current && current.status === 'progress' ? ` · ${current.count}/${SESSION_LENGTH} · ${percent(current.accuracy)}` : ''
    return `${state.count}/${level.keys.length} tonalités${key ? ` · ${KEYS[key].label}` : ''}${detail}`
  }
  if (level.kind === 'pitch') {
    return `${state.count}/${sessionLengthOf(level)} · ${percent(state.accuracy)} · ${seconds(state.medianRt)}`
  }
  return `${state.count}/${EXERCISES_TO_PASS} · ${percent(state.accuracy)}`
}

export function Home({ progress, onSelect, onLesson, onStats, onSettings }: IHomeProps) {
  const groups = [
    { title: 'Lecture', levels: LEVELS.filter((l) => l.kind === 'pitch' && !l.ear) },
    { title: 'Rythme', levels: LEVELS.filter((l) => l.kind === 'rhythm') },
    { title: 'Phrases', levels: LEVELS.filter((l) => l.kind === 'phrase') },
    { title: 'Oreille', levels: LEVELS.filter((l) => l.kind === 'pitch' && !!l.ear) },
  ]
  const streak = isStreakAlive(progress.streak) ? progress.streak.count : 0
  const review = reviewLevel(progress)
  const reviewDone = reviewedToday(progress)

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
        {review && (
          <section>
            <h2>Aujourd’hui</h2>
            <div className={`level review ${reviewDone ? 'done' : 'recommended'}`}>
              <button className="level-main" onClick={() => onSelect(review)}>
                <span className="level-num">{reviewDone ? <IconCheck /> : <IconRepeat />}</span>
                <span className="level-body">
                  <span className="level-title">{review.title}</span>
                  <span className="level-sub">{`${review.cards.length} notes déjà vues${review.keys ? ` en ${KEYS[review.keys[0]].label.toLowerCase()}` : ''}, les plus fragiles plus souvent`}</span>
                  {reviewDone ? <span className="level-status">Faite aujourd’hui</span> : <span className="level-tag">À faire</span>}
                </span>
              </button>
            </div>
          </section>
        )}
        {groups.map((g) => {
          let recommended = false
          return (
            <section key={g.title}>
              <h2>{g.title}</h2>
              {g.levels.map((level, idx) => {
                const state = levelStateOf(level, progress)
                const status = statusText(level, state, progress)
                const isRecommended = !recommended && state.status !== 'done'
                if (isRecommended) recommended = true
                return (
                  <div key={level.id} className={`level ${state.status} ${isRecommended ? 'recommended' : ''}`}>
                    <button className="level-main" onClick={() => onSelect(level)}>
                      <span className="level-num">{state.status === 'done' ? <IconCheck /> : idx + 1}</span>
                      <span className="level-body">
                        <span className="level-title">{level.title}</span>
                        <span className="level-sub">{level.subtitle}</span>
                        {status && <span className="level-status">{status}</span>}
                        {isRecommended && !status && <span className="level-tag">À suivre</span>}
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
