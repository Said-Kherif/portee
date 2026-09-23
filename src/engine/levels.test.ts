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

describe('review key signature', () => {
  const both = () => {
    const p = seen(REVIEW_MIN_CARDS + 2)
    for (let d = 2; d < 2 + REVIEW_MIN_CARDS + 2; d++) p.cards[makeCard('treble', d, null, 'G').id] = updateStat(undefined, true, 900)
    p.cards[makeCard('treble', 3, 0, 'G').id] = updateStat(undefined, false, 1800)
    return p
  }

  it('keeps one key signature per review and names it', () => {
    const keysSeen = new Set<string>()
    for (let day = 1; day <= 60; day++) {
      const level = reviewLevel(both(), `2026-10-${String(day).padStart(2, '0')}`)
      if (!level) throw new Error('review should exist')
      const keys = new Set(level.cards.map((c) => c.key))
      expect(keys.size).toBe(1)
      const [key] = [...keys]
      keysSeen.add(key)
      if (key === 'C') expect(level.keys).toBeUndefined()
      else expect(level.keys).toEqual([key])
    }
    expect(keysSeen).toEqual(new Set(['C', 'G']))
  })

  it('stays the same all day long', () => {
    const a = reviewLevel(both(), '2026-10-05')
    const b = reviewLevel(both(), '2026-10-05')
    expect(a?.keys).toEqual(b?.keys)
  })

  it('keeps naturals of key signatures at half weight', () => {
    for (let day = 1; day <= 30; day++) {
      const level = reviewLevel(both(), `2026-11-${String(day).padStart(2, '0')}`)
      if (!level?.keys) continue
      const natural = level.cards.find((c) => c.shown === 0)
      expect(natural?.weight).toBe(0.5)
      return
    }
    throw new Error('no G review drawn in a month')
  })

  it('ignores a key with too few notes seen', () => {
    const p = seen(REVIEW_MIN_CARDS)
    p.cards[makeCard('treble', 4, null, 'D').id] = updateStat(undefined, true, 900)
    for (let day = 1; day <= 30; day++) expect(reviewLevel(p, `2026-12-${String(day).padStart(2, '0')}`)?.keys).toBeUndefined()
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
