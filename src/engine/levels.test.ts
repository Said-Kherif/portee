import { describe, expect, it } from 'vitest'
import { isReading, levelById, LEVELS, levelTitle, pianoRange, REVIEW_ID, REVIEW_MIN_CARDS, reviewedToday, reviewLevel } from './levels'
import { makeCard } from './notes'
import { defaultProgress } from './progress'
import { EAR_PASS_RT, SESSION_LENGTH, sessionLengthOf, updateStat } from './scheduler'

function seen(count: number) {
  const p = defaultProgress()
  for (let d = 0; d < count; d++) p.cards[makeCard('treble', d, null).id] = updateStat(undefined, true, 900)
  return p
}

describe('review level', () => {
  it('waits for enough notes seen', () => {
    expect(reviewLevel(defaultProgress())).toBeNull()
    expect(reviewLevel(seen(REVIEW_MIN_CARDS - 1))).toBeNull()
  })

  it('draws from every note seen, in sessions of the default length', () => {
    const level = reviewLevel(seen(REVIEW_MIN_CARDS + 2))
    if (!level) throw new Error('review should exist')
    expect(level.id).toBe(REVIEW_ID)
    expect(level.cards.length).toBe(REVIEW_MIN_CARDS + 2)
    expect(sessionLengthOf(level)).toBe(SESSION_LENGTH)
    expect(level.ear).toBeFalsy()
  })

  it('ignores unknown ids and unseen notes', () => {
    const p = seen(REVIEW_MIN_CARDS)
    p.cards['nimporte:quoi'] = updateStat(undefined, true, 900)
    p.cards[makeCard('bass', -4, null).id] = { n: 0, errors: 0, err: 1, rt: 2000, last: 0 }
    expect(reviewLevel(p)?.cards.length).toBe(REVIEW_MIN_CARDS)
  })

  it('knows whether it was done today', () => {
    const p = seen(REVIEW_MIN_CARDS)
    expect(reviewedToday(p)).toBe(false)
    p.sessions.push({ date: Date.now() - 2 * 86400000, level: REVIEW_ID, accuracy: 1, medianRt: 900 })
    expect(reviewedToday(p)).toBe(false)
    p.sessions.push({ date: Date.now(), level: REVIEW_ID, accuracy: 1, medianRt: 900 })
    expect(reviewedToday(p)).toBe(true)
  })
})

describe('level helpers', () => {
  it('title and classify sessions', () => {
    expect(levelTitle(REVIEW_ID)).toBe('Révision du jour')
    expect(levelTitle('p2')).toBe('Clé de sol')
    expect(levelTitle('inconnu')).toBe('inconnu')
    expect(isReading(REVIEW_ID)).toBe(true)
    expect(isReading('p2')).toBe(true)
    expect(isReading('r1')).toBe(false)
    expect(isReading('f0')).toBe(false)
    expect(isReading('e1')).toBe(false)
  })

  it('fit both five-finger positions on the two-hand keyboards', () => {
    for (const id of ['f3', 'f4']) {
      const level = levelById(id)
      if (level?.kind !== 'phrase' || !level.hands) throw new Error(`${id} must be a two-hand phrase`)
      expect(pianoRange(level)).toEqual([48, 67])
    }
  })

  it('mark the ear levels and relax their time limit', () => {
    const ear = LEVELS.filter((l) => l.kind === 'pitch' && l.ear)
    expect(ear.map((l) => l.id)).toEqual(['e1', 'e2'])
    for (const l of ear) {
      if (l.kind !== 'pitch') continue
      expect(l.passRt).toBe(EAR_PASS_RT)
      expect(pianoRange(l)).toEqual([60, 72])
      for (const c of l.cards) expect(c.shown).toBeNull()
    }
  })
})
