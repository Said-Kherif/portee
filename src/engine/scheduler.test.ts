import { describe, expect, it } from 'vitest'
import { levelById, LEVELS } from './levels'
import { makeCard } from './notes'
import { defaultProgress } from './progress'
import { EXERCISES_TO_PASS, exerciseLevelState, historyKey, levelStateOf, median, nextKey, PASS_RT, pickCard, pitchLevelState, SESSION_LENGTH, sessionLengthOf, updateStat } from './scheduler'

const answers = (n: number, ok = true, rt = 1000) => Array.from({ length: n }, () => ({ ok, rt }))

describe('median', () => {
  it('handles odd and even lengths', () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([])).toBe(0)
  })
})

describe('pitchLevelState', () => {
  it('is new without history', () => {
    expect(pitchLevelState([]).status).toBe('new')
  })

  it('needs a full session to be done', () => {
    expect(pitchLevelState(answers(SESSION_LENGTH - 1)).status).toBe('progress')
    expect(pitchLevelState(answers(SESSION_LENGTH)).status).toBe('done')
  })

  it('fails on accuracy or on median time', () => {
    expect(pitchLevelState([...answers(SESSION_LENGTH - 2), ...answers(2, false)]).status).toBe('progress')
    expect(pitchLevelState(answers(SESSION_LENGTH, true, PASS_RT + 1)).status).toBe('progress')
    expect(pitchLevelState(answers(SESSION_LENGTH, true, PASS_RT)).status).toBe('done')
  })

  it('only looks at the last session', () => {
    expect(pitchLevelState([...answers(50, false), ...answers(SESSION_LENGTH)]).status).toBe('done')
  })
})

describe('exerciseLevelState', () => {
  it('averages the last scores', () => {
    expect(exerciseLevelState([]).status).toBe('new')
    expect(exerciseLevelState(Array(EXERCISES_TO_PASS).fill(85)).status).toBe('done')
    expect(exerciseLevelState(Array(EXERCISES_TO_PASS).fill(84)).status).toBe('progress')
    expect(exerciseLevelState(Array(EXERCISES_TO_PASS - 1).fill(100)).status).toBe('progress')
  })
})

describe('pickCard', () => {
  const cards = [makeCard('treble', 2, null), makeCard('treble', 4, null), makeCard('treble', 6, null)]

  it('never repeats the previous card', () => {
    for (let i = 0; i < 200; i++) expect(pickCard(cards, {}, new Set(), cards[0].id).id).not.toBe(cards[0].id)
  })

  it('returns the only card even if it was the previous one', () => {
    expect(pickCard([cards[0]], {}, new Set(), cards[0].id).id).toBe(cards[0].id)
  })
})

describe('updateStat', () => {
  it('tracks errors and smooths reaction time', () => {
    const first = updateStat(undefined, false, 3000)
    expect(first.n).toBe(1)
    expect(first.errors).toBe(1)
    expect(first.rt).toBe(3000)
    const second = updateStat(first, true, 1000)
    expect(second.n).toBe(2)
    expect(second.errors).toBe(1)
    expect(second.err).toBeLessThan(first.err)
    expect(second.rt).toBeLessThan(first.rt)
  })

  it('clamps very slow answers', () => {
    expect(updateStat(undefined, true, 60000).rt).toBe(6000)
  })
})

describe('keyed levels', () => {
  const p7 = levelById('p7')
  if (p7?.kind !== 'pitch' || !p7.keys) throw new Error('p7 must be a keyed pitch level')
  const keys = p7.keys
  const done = answers(SESSION_LENGTH)

  it('start with the first key and stay new', () => {
    const p = defaultProgress()
    expect(nextKey(p7, p)).toBe(keys[0])
    expect(levelStateOf(p7, p).status).toBe('new')
  })

  it('advance key by key and count the validated ones', () => {
    const p = defaultProgress()
    p.history[historyKey(p7.id, keys[0])] = done
    expect(nextKey(p7, p)).toBe(keys[1])
    const state = levelStateOf(p7, p)
    expect(state.status).toBe('progress')
    expect(state.count).toBe(1)
  })

  it('are done once every key is done', () => {
    const p = defaultProgress()
    for (const k of keys) p.history[historyKey(p7.id, k)] = done
    expect(levelStateOf(p7, p).status).toBe('done')
    expect(keys).toContain(nextKey(p7, p))
  })

  it('ignore the legacy unkeyed history', () => {
    const p = defaultProgress()
    p.history[p7.id] = done
    expect(levelStateOf(p7, p).status).toBe('new')
  })
})

describe('sessionLengthOf', () => {
  it('covers every card of an unkeyed level and stays at the default otherwise', () => {
    for (const l of LEVELS) {
      if (l.kind !== 'pitch') continue
      if (l.keys) expect(sessionLengthOf(l)).toBe(SESSION_LENGTH)
      else expect(sessionLengthOf(l)).toBeGreaterThanOrEqual(l.cards.length)
    }
    const p1 = levelById('p1')
    if (p1?.kind !== 'pitch') throw new Error('p1 must be a pitch level')
    expect(sessionLengthOf(p1)).toBe(SESSION_LENGTH)
  })

  it('needs the whole longer session to validate a large level', () => {
    const p5 = levelById('p5')
    if (p5?.kind !== 'pitch') throw new Error('p5 must be a pitch level')
    const length = sessionLengthOf(p5)
    expect(length).toBeGreaterThan(SESSION_LENGTH)
    expect(pitchLevelState(answers(SESSION_LENGTH), length).status).toBe('progress')
    expect(pitchLevelState(answers(length), length).status).toBe('done')
  })
})

describe('card weight', () => {
  it('never picks a zero-weight card', () => {
    const a = makeCard('treble', 2, null)
    const b = { ...makeCard('treble', 4, null), weight: 0 }
    for (let i = 0; i < 200; i++) expect(pickCard([b, a], {}, new Set(), null).id).toBe(a.id)
  })

  it('halves the naturals of keyed levels only', () => {
    const p7 = levelById('p7')
    if (p7?.kind !== 'pitch') throw new Error('p7 must be a pitch level')
    for (const c of p7.cards) expect(c.weight ?? 1).toBe(c.shown === 0 ? 0.5 : 1)
    expect(p7.cards.some((c) => c.shown === 0)).toBe(true)
  })
})
