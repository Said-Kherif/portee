import type { Level } from './levels'
import { CHRONO_ID, levelById, LEVELS, REVIEW_ID, WORLDS } from './levels'
import type { IProgress } from './progress'
import type { IOnsetResult } from './rhythm'
import { exerciseLevelState, historyKey, levelStateOf, PASS_RT, pitchLevelState, sessionLengthOf } from './scheduler'

export type Judgement = 'perfect' | 'good' | 'ok'
export type Stars = 0 | 1 | 2 | 3

export const COMBO_STEP = 5
export const MAX_MULTIPLIER = 4

const BONUS: Record<Judgement, number> = { perfect: 10, good: 5, ok: 0 }
const GRADE_POINTS = { perfect: 30, good: 20, late: 10, miss: 0 }

export function multiplier(streak: number): number {
  return Math.min(MAX_MULTIPLIER, 1 + Math.floor(streak / COMBO_STEP))
}

export function judge(rt: number, passRt = PASS_RT): Judgement {
  if (rt < (passRt * 2) / 3) return 'perfect'
  if (rt < passRt) return 'good'
  return 'ok'
}

export function notePoints(rt: number, streak: number, passRt = PASS_RT): { points: number; judgement: Judgement; multiplier: number } {
  const judgement = judge(rt, passRt)
  const m = multiplier(streak)
  return { points: (10 + BONUS[judgement]) * m, judgement, multiplier: m }
}

export function exercisePoints(results: IOnsetResult[]): { points: number; bestCombo: number; correct: number } {
  let streak = 0
  let bestCombo = 0
  let points = 0
  let correct = 0
  for (const r of results) {
    if (r.grade === 'miss' || r.pitchOk === false) {
      streak = 0
      continue
    }
    points += GRADE_POINTS[r.grade] * multiplier(streak)
    streak++
    correct++
    bestCombo = Math.max(bestCombo, streak)
  }
  return { points, bestCombo, correct }
}

export function sessionStars(level: Level, accuracy: number): Stars {
  const [one, two] = level.kind === 'pitch' ? [0.75, 0.9] : [0.6, 0.8]
  return accuracy >= two ? 2 : accuracy >= one ? 1 : 0
}

function bestAccuracy(level: Level, progress: IProgress): number | null {
  if (level.kind !== 'pitch') {
    const s = exerciseLevelState(progress.scores[level.id] ?? [])
    return s.status === 'new' ? null : s.accuracy
  }
  let best: number | null = null
  for (const key of level.keys ?? [null]) {
    const s = pitchLevelState(progress.history[historyKey(level.id, key)] ?? [], key ? undefined : sessionLengthOf(level), level.passRt)
    if (s.status !== 'new') best = Math.max(best ?? 0, s.accuracy)
  }
  return best
}

export function starsOf(level: Level, progress: IProgress): Stars {
  if (levelStateOf(level, progress).status === 'done') return 3
  const accuracy = bestAccuracy(level, progress)
  const derived = accuracy === null ? 0 : sessionStars(level, accuracy)
  return Math.max(progress.stars[level.id] ?? 0, derived) as Stars
}

export function worldOf(level: Level) {
  return WORLDS.find((w) => w.levels.some((l) => l.id === level.id))
}

export function hasPlayed(level: Level, progress: IProgress): boolean {
  if ((progress.stars[level.id] ?? 0) > 0 || (progress.records[level.id] ?? 0) > 0) return true
  return levelStateOf(level, progress).status !== 'new'
}

export function isUnlocked(level: Level, progress: IProgress): boolean {
  const world = worldOf(level)
  if (!world) return true
  const i = world.levels.findIndex((l) => l.id === level.id)
  if (i <= 0 || hasPlayed(level, progress)) return true
  return starsOf(world.levels[i - 1], progress) >= 1
}

export function nextLevel(level: Level, progress: IProgress): Level | null {
  const world = worldOf(level)
  if (!world) return null
  const next = world.levels[world.levels.findIndex((l) => l.id === level.id) + 1]
  return next && isUnlocked(next, progress) ? next : null
}

export function levelFromXp(xp: number): { level: number; into: number; need: number } {
  let level = 1
  let rest = Math.max(0, Math.floor(xp))
  while (rest >= 100 * level) {
    rest -= 100 * level
    level++
  }
  return { level, into: rest, need: 100 * level }
}

export interface IBadge {
  id: string
  title: string
  hint: string
}

export const BADGES: IBadge[] = [
  { id: 'first', title: 'Premier pas', hint: 'Terminer une première série' },
  { id: 'perfect', title: 'Sans faute', hint: 'Une série de lecture à 100 %' },
  { id: 'lightning', title: 'Éclair', hint: 'Un temps médian sous 1 seconde' },
  { id: 'combo', title: 'Combo ×4', hint: 'Quinze notes justes d’affilée' },
  { id: 'week', title: 'Une semaine', hint: 'Sept jours d’affilée' },
  { id: 'clefs', title: 'Deux clés', hint: 'Valider la clé de sol et la clé de fa' },
  { id: 'hands', title: 'Deux mains', hint: 'Valider les deux mains ensemble' },
  { id: 'ear', title: 'Oreille fine', hint: 'Valider l’accord de do à l’oreille' },
]

export interface IGameInput {
  level: Level
  points: number
  accuracy: number
  medianRt: number
  bestCombo: number
  correct: number
}

export interface IReward {
  points: number
  correct: number
  recordValue: number
  previousRecord: number
  newRecord: boolean
  starsBefore: Stars
  starsAfter: Stars
  xpGained: number
  levelBefore: number
  levelAfter: number
  xpInto: number
  xpNeed: number
  badges: string[]
}

function validated(progress: IProgress, id: string): boolean {
  const level = levelById(id)
  return !!level && levelStateOf(level, progress).status === 'done'
}

function earnedBadges(progress: IProgress, input: IGameInput): string[] {
  const { level } = input
  const reading = level.kind === 'pitch' && !level.ear
  const timed = level.kind === 'pitch' && !!level.timed
  const out: string[] = []
  if (progress.sessions.length >= 1) out.push('first')
  if (reading && !timed && input.accuracy === 1) out.push('perfect')
  if (reading && input.accuracy >= 0.9 && input.medianRt > 0 && input.medianRt < 1000) out.push('lightning')
  if (input.bestCombo >= COMBO_STEP * (MAX_MULTIPLIER - 1)) out.push('combo')
  if (progress.streak.count >= 7) out.push('week')
  if (validated(progress, 'p2') && validated(progress, 'p3')) out.push('clefs')
  if (validated(progress, 'f4')) out.push('hands')
  if (validated(progress, 'e1')) out.push('ear')
  return out.filter((id) => !(id in progress.badges))
}

export function settle(before: IProgress, input: IGameInput, record: (p: IProgress) => IProgress): { progress: IProgress; reward: IReward } {
  const { level } = input
  const palier = LEVELS.some((l) => l.id === level.id)
  const chrono = level.id === CHRONO_ID
  const starsBefore: Stars = palier ? starsOf(level, before) : 0
  let progress = record(before)
  const recordValue = chrono ? input.correct : input.points
  const previousRecord = before.records[level.id] ?? 0
  const newRecord = (palier || chrono) && level.id !== REVIEW_ID && recordValue > previousRecord && recordValue > 0
  let starsAfter = starsBefore
  if (palier) {
    const done = levelStateOf(level, progress).status === 'done'
    starsAfter = Math.max(starsBefore, sessionStars(level, input.accuracy), done ? 3 : 0) as Stars
  }
  const xpGained = Math.round(input.points / 10) + 25 * (starsAfter - starsBefore) + (newRecord ? 50 : 0)
  const levelBefore = levelFromXp(progress.xp).level
  const xp = progress.xp + xpGained
  const after = levelFromXp(xp)
  progress = {
    ...progress,
    xp,
    records: newRecord ? { ...progress.records, [level.id]: recordValue } : progress.records,
    stars: palier && starsAfter > (progress.stars[level.id] ?? 0) ? { ...progress.stars, [level.id]: starsAfter } : progress.stars,
  }
  const badges = earnedBadges(progress, input)
  if (badges.length > 0) {
    const now = Date.now()
    progress = { ...progress, badges: { ...progress.badges, ...Object.fromEntries(badges.map((id) => [id, now])) } }
  }
  return {
    progress,
    reward: {
      points: input.points,
      correct: input.correct,
      recordValue,
      previousRecord,
      newRecord,
      starsBefore,
      starsAfter,
      xpGained,
      levelBefore,
      levelAfter: after.level,
      xpInto: after.into,
      xpNeed: after.need,
      badges,
    },
  }
}
