import { describe, expect, it } from 'vitest'
import { REVIEW_ID } from './levels'
import { defaultProgress } from './progress'
import { readingWeeks, WEEKS, weekStart } from './trend'

const DAY = 86400000
const wednesday = new Date(2026, 8, 23, 15, 30).getTime()

describe('weekStart', () => {
  it('snaps to Monday midnight', () => {
    const start = new Date(weekStart(wednesday))
    expect(start.getDay()).toBe(1)
    expect(start.getHours()).toBe(0)
    expect(start.getDate()).toBe(21)
    expect(weekStart(weekStart(wednesday))).toBe(weekStart(wednesday))
  })
})

describe('readingWeeks', () => {
  it('returns the last weeks, oldest first, with gaps left empty', () => {
    const weeks = readingWeeks(defaultProgress(), wednesday)
    expect(weeks.length).toBe(WEEKS)
    expect(weeks[WEEKS - 1].start).toBe(weekStart(wednesday))
    for (let i = 1; i < WEEKS; i++) expect(weeks[i].start).toBeGreaterThan(weeks[i - 1].start)
    for (const w of weeks) expect(w.accuracy).toBeNull()
  })

  it('averages accuracy and takes the median time of reading sessions only', () => {
    const p = defaultProgress()
    p.sessions.push(
      { date: wednesday, level: 'p2', accuracy: 0.9, medianRt: 1200 },
      { date: wednesday - DAY, level: REVIEW_ID, accuracy: 1, medianRt: 1000 },
      { date: wednesday - 2 * DAY, level: 'p3', accuracy: 0.8, medianRt: 2000 },
      { date: wednesday, level: 'r1', accuracy: 0.1, medianRt: 0 },
      { date: wednesday, level: 'e1', accuracy: 0.1, medianRt: 5000 },
      { date: wednesday - 7 * DAY, level: 'p2', accuracy: 0.7, medianRt: 2500 },
    )
    const weeks = readingWeeks(p, wednesday)
    const current = weeks[WEEKS - 1]
    expect(current.sessions).toBe(3)
    expect(current.accuracy).toBeCloseTo(0.9)
    expect(current.time).toBe(1200)
    expect(weeks[WEEKS - 2]).toMatchObject({ sessions: 1, accuracy: 0.7, time: 2500 })
    expect(weeks[WEEKS - 3].accuracy).toBeNull()
  })
})
