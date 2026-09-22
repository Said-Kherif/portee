import { describe, expect, it } from 'vitest'
import { makeCard } from './notes'
import { EXERCISES_TO_PASS, exerciseLevelState, median, PASS_RT, pickCard, pitchLevelState, SESSION_LENGTH, updateStat } from './scheduler'

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
