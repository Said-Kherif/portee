import type { IPitchLevel, Level } from './levels'
import type { ICard, KeyId } from './notes'
import type { IProgress } from './progress'

export interface ICardStat {
  n: number
  errors: number
  err: number
  rt: number
  last: number
}

export interface IAnswer {
  ok: boolean
  rt: number
}

export interface ILevelState {
  status: 'new' | 'progress' | 'done'
  accuracy: number
  medianRt: number
  count: number
}

export const SESSION_LENGTH = 30
export const PASS_ACCURACY = 0.95
export const PASS_RT = 1500
export const EAR_PASS_RT = 3000
export const EXERCISES_TO_PASS = 5
export const PASS_SCORE = 85

export const EMPTY_STAT: ICardStat = { n: 0, errors: 0, err: 1, rt: 2000, last: 0 }

export function weightOf(stat: ICardStat | undefined, focused: boolean, now: number): number {
  const s = stat ?? EMPTY_STAT
  const slowness = Math.min(1.5, Math.max(0, (s.rt - 700) / 1500))
  const stale = s.n === 0 ? 0 : Math.min(1, (now - s.last) / 86400000)
  let w = 0.3 + 3 * s.err + slowness + stale
  if (focused && s.n < 12) w *= 1.6
  return w
}

export function pickCard(cards: ICard[], stats: Record<string, ICardStat>, focus: Set<string>, previousId: string | null): ICard {
  const pool = cards.length > 1 ? cards.filter((c) => c.id !== previousId) : cards
  const now = Date.now()
  const weights = pool.map((c) => weightOf(stats[c.id], focus.has(c.id), now) * (c.weight ?? 1))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = Math.random() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

export function updateStat(stat: ICardStat | undefined, ok: boolean, rt: number): ICardStat {
  const s = stat ?? EMPTY_STAT
  const clamped = Math.min(6000, rt)
  return {
    n: s.n + 1,
    errors: s.errors + (ok ? 0 : 1),
    err: 0.7 * s.err + 0.3 * (ok ? 0 : 1),
    rt: s.n === 0 ? clamped : 0.7 * s.rt + 0.3 * clamped,
    last: Date.now(),
  }
}

export function median(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

export function sessionLengthOf(level: IPitchLevel): number {
  if (level.length) return level.length
  return level.keys ? SESSION_LENGTH : Math.max(SESSION_LENGTH, level.cards.length)
}

export function pitchLevelState(history: IAnswer[], length = SESSION_LENGTH, passRt = PASS_RT): ILevelState {
  const recent = history.slice(-length)
  if (recent.length === 0) return { status: 'new', accuracy: 0, medianRt: 0, count: 0 }
  const accuracy = recent.filter((a) => a.ok).length / recent.length
  const medianRt = median(recent.map((a) => a.rt))
  const done = recent.length >= length && accuracy >= PASS_ACCURACY && medianRt <= passRt
  return { status: done ? 'done' : 'progress', accuracy, medianRt, count: recent.length }
}

export function exerciseLevelState(scores: number[]): ILevelState {
  const recent = scores.slice(-EXERCISES_TO_PASS)
  if (recent.length === 0) return { status: 'new', accuracy: 0, medianRt: 0, count: 0 }
  const accuracy = recent.reduce((a, b) => a + b, 0) / recent.length / 100
  const done = recent.length >= EXERCISES_TO_PASS && accuracy * 100 >= PASS_SCORE
  return { status: done ? 'done' : 'progress', accuracy, medianRt: 0, count: recent.length }
}

export function historyKey(levelId: string, key: KeyId | null): string {
  return key ? `${levelId}:${key}` : levelId
}

export function nextKey(level: IPitchLevel, progress: IProgress): KeyId | null {
  if (!level.keys) return null
  const pending = level.keys.filter((k) => pitchLevelState(progress.history[historyKey(level.id, k)] ?? []).status !== 'done')
  if (pending.length > 0) return pending[0]
  return level.keys[Math.floor(Math.random() * level.keys.length)]
}

export function levelStateOf(level: Level, progress: IProgress): ILevelState {
  if (level.kind !== 'pitch') return exerciseLevelState(progress.scores[level.id] ?? [])
  if (!level.keys) return pitchLevelState(progress.history[level.id] ?? [], sessionLengthOf(level), level.passRt)
  const states = level.keys.map((k) => pitchLevelState(progress.history[historyKey(level.id, k)] ?? []))
  const done = states.filter((s) => s.status === 'done').length
  if (done === level.keys.length) return { status: 'done', accuracy: 1, medianRt: 0, count: done }
  const started = states.some((s) => s.status !== 'new')
  return { status: started ? 'progress' : 'new', accuracy: 0, medianRt: 0, count: done }
}
