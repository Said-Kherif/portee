import { BADGES } from '../engine/game'
import type { IReward } from '../engine/game'
import { IconBolt, IconCheck, IconCrown, IconFlag, IconFlame, IconKeys, IconSpeaker, IconStar } from './Icons'

export function formatScore(n: number): string {
  return new Intl.NumberFormat('fr-FR').format(n)
}

interface IStarsProps {
  n: number
  from?: number
  size?: number
  className?: string
}

export function Stars({ n, from = n, size = 16, className = '' }: IStarsProps) {
  return (
    <span className={`stars ${className}`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`star ${i < n ? 'on' : ''} ${i >= from && i < n ? 'new' : ''}`}>
          <IconStar size={size} filled={i < n} />
        </span>
      ))}
      <span className="sr-only">{`${n} étoile${n > 1 ? 's' : ''} sur 3`}</span>
    </span>
  )
}

export function BadgeIcon({ id, size = 22 }: { id: string; size?: number }) {
  if (id === 'first') return <IconFlag size={size} />
  if (id === 'perfect') return <IconCheck size={size} />
  if (id === 'lightning') return <IconBolt size={size} />
  if (id === 'combo') return <IconCrown size={size} />
  if (id === 'week') return <IconFlame size={size} />
  if (id === 'hands') return <IconKeys size={size} />
  if (id === 'ear') return <IconSpeaker size={size} />
  return <span className="badge-glyph">{''}</span>
}

export function BadgeList({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null
  return (
    <ul className="badge-list">
      {ids.map((id) => {
        const badge = BADGES.find((b) => b.id === id)
        if (!badge) return null
        return (
          <li key={id} className="badge-card">
            <span className="badge-icon">
              <BadgeIcon id={id} />
            </span>
            <span className="badge-body">
              <span className="badge-kicker">Nouveau badge</span>
              <span className="badge-title">{badge.title}</span>
              <span className="badge-hint">{badge.hint}</span>
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export function XpCard({ reward }: { reward: IReward }) {
  const up = reward.levelAfter > reward.levelBefore
  return (
    <div className="xp-card">
      <div className="xp-head">
        <span className="xp-gain">+{formatScore(reward.xpGained)} XP</span>
        {up ? <span className="xp-up">Niveau {reward.levelAfter} !</span> : <span className="xp-level">Niveau {reward.levelAfter}</span>}
      </div>
      <progress className="xp-bar" value={reward.xpInto} max={reward.xpNeed} aria-label={`Expérience vers le niveau ${reward.levelAfter + 1}`} />
      <span className="xp-text">
        {formatScore(reward.xpInto)} / {formatScore(reward.xpNeed)} XP vers le niveau {reward.levelAfter + 1}
      </span>
    </div>
  )
}
