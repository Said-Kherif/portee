import { isReading } from './levels'
import type { IProgress } from './progress'
import { median } from './scheduler'

export interface IWeek {
  start: number
  sessions: number
  accuracy: number | null
  time: number | null
}

export const WEEKS = 8

export function weekStart(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return d.getTime()
}

export function readingWeeks(progress: IProgress, now = Date.now(), count = WEEKS): IWeek[] {
  const current = new Date(weekStart(now))
  const weeks: IWeek[] = []
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(current)
    d.setDate(d.getDate() - 7 * i)
    weeks.push({ start: d.getTime(), sessions: 0, accuracy: null, time: null })
  }
  const buckets = new Map<number, { accuracy: number[]; time: number[] }>()
  for (const s of progress.sessions) {
    if (!isReading(s.level)) continue
    const key = weekStart(s.date)
    const bucket = buckets.get(key) ?? { accuracy: [], time: [] }
    bucket.accuracy.push(s.accuracy)
    if (s.medianRt > 0) bucket.time.push(s.medianRt)
    buckets.set(key, bucket)
  }
  for (const w of weeks) {
    const bucket = buckets.get(w.start)
    if (!bucket) continue
    w.sessions = bucket.accuracy.length
    w.accuracy = bucket.accuracy.reduce((a, b) => a + b, 0) / bucket.accuracy.length
    w.time = bucket.time.length > 0 ? median(bucket.time) : null
  }
  return weeks
}
