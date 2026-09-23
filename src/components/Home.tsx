import { isUnlocked, levelFromXp, starsOf } from '../engine/game'
import type { Level } from '../engine/levels'
import { CHRONO_ID, chronoLevel, reviewedToday, reviewLevel, WORLDS } from '../engine/levels'
import { KEYS } from '../engine/notes'
import type { IProgress } from '../engine/progress'
import { isStreakAlive } from '../engine/progress'
import { IconBolt, IconBook, IconChart, IconCheck, IconFlame, IconLock, IconRepeat, IconSliders, IconStar, IconTrophy } from './Icons'
import { formatScore, Stars } from './Reward'

interface IHomeProps {
  progress: IProgress
  onSelect: (level: Level) => void
  onLesson: (level: Level) => void
  onStats: () => void
  onSettings: () => void
}

export function Home({ progress, onSelect, onLesson, onStats, onSettings }: IHomeProps) {
  const streak = isStreakAlive(progress.streak) ? progress.streak.count : 0
  const xp = levelFromXp(progress.xp)
  const review = reviewLevel(progress)
  const reviewDone = reviewedToday(progress)
  const chronoRecord = progress.records[CHRONO_ID] ?? 0

  return (
    <div className="screen home">
      <header className="player">
        <span className="player-badge" aria-hidden="true">
          {xp.level}
        </span>
        <div className="player-body">
          <span className="player-level">Niveau {xp.level}</span>
          <progress className="xp-bar" value={xp.into} max={xp.need} aria-label={`Expérience vers le niveau ${xp.level + 1}`} />
          <span className="xp-text">
            {formatScore(xp.into)} / {formatScore(xp.need)} XP
          </span>
        </div>
        <span className="pill streak" aria-label={`${streak} jour${streak > 1 ? 's' : ''} d’affilée`}>
          <IconFlame />
          {streak}
        </span>
        <button className="icon-button" aria-label="Stats" onClick={onStats}>
          <IconChart size={20} />
        </button>
        <button className="icon-button" aria-label="Réglages" onClick={onSettings}>
          <IconSliders size={20} />
        </button>
      </header>
      <main className="scroll">
        <button className="banner chrono" onClick={() => onSelect(chronoLevel(progress))}>
          <span className="banner-icon">
            <IconBolt size={22} />
          </span>
          <span className="banner-body">
            <span className="banner-title">Défi chrono</span>
            <span className="banner-sub">60 secondes, un maximum de notes</span>
          </span>
          <span className="banner-side">
            <span className="banner-kicker">Record</span>
            <span className="banner-value">{chronoRecord > 0 ? chronoRecord : '—'}</span>
          </span>
        </button>
        {review && (
          <button className={`banner review ${reviewDone ? 'done' : ''}`} onClick={() => onSelect(review)}>
            <span className="banner-icon">{reviewDone ? <IconCheck size={20} /> : <IconRepeat size={20} />}</span>
            <span className="banner-body">
              <span className="banner-title">Révision du jour</span>
              <span className="banner-sub">{`${review.cards.length} notes déjà vues${review.keys ? ` en ${KEYS[review.keys[0]].label.toLowerCase()}` : ''}, les plus fragiles plus souvent`}</span>
            </span>
            <span className="banner-side">
              <span className="banner-kicker">{reviewDone ? 'Faite' : 'À faire'}</span>
            </span>
          </button>
        )}
        {WORLDS.map((world, wi) => {
          const earned = world.levels.reduce((a, l) => a + starsOf(l, progress), 0)
          let current = false
          return (
            <section key={world.id} className="world">
              <div className="world-head">
                <h2>
                  Monde {wi + 1} · {world.title}
                </h2>
                <span className="world-stars">
                  <IconStar size={14} />
                  {earned} / {world.levels.length * 3}
                </span>
              </div>
              <div className="tiles">
                {world.levels.map((level, li) => {
                  const unlocked = isUnlocked(level, progress)
                  const stars = starsOf(level, progress)
                  const record = progress.records[level.id] ?? 0
                  const isCurrent = !current && unlocked && stars < 3
                  if (isCurrent) current = true
                  const state = !unlocked ? 'locked' : isCurrent ? 'current' : stars === 3 ? 'done' : 'open'
                  return (
                    <div key={level.id} className={`tile ${state}`}>
                      <button className="tile-main" disabled={!unlocked} onClick={() => onSelect(level)}>
                        <span className="tile-top">
                          <span className="tile-num">
                            {wi + 1}-{li + 1}
                          </span>
                          {unlocked ? (
                            <Stars n={stars} size={15} />
                          ) : (
                            <span className="tile-lock">
                              <IconLock size={15} />
                            </span>
                          )}
                        </span>
                        <span className="tile-title">{level.title}</span>
                        <span className="tile-info">
                          {!unlocked ? (
                            'Une étoile au niveau d’avant'
                          ) : record > 0 ? (
                            <>
                              <IconTrophy size={13} />
                              Record {formatScore(record)}
                            </>
                          ) : (
                            <span className="tile-new">Nouveau</span>
                          )}
                        </span>
                        {isCurrent && <span className="tile-play">Jouer</span>}
                      </button>
                      {unlocked && (
                        <button className="tile-lesson" aria-label={`Leçon : ${level.title}`} onClick={() => onLesson(level)}>
                          <IconBook size={17} />
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}
      </main>
    </div>
  )
}
