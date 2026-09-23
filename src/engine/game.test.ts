import { describe, expect, it } from 'vitest'
import type { IGameInput } from './game'
import { BADGES, exercisePoints, isUnlocked, judge, levelFromXp, multiplier, nextLevel, notePoints, sessionStars, settle, starsOf } from './game'
import type { Level } from './levels'
import { CHRONO_ID, CHRONO_SECONDS, chronoLevel, levelById, REVIEW_ID, REVIEW_MIN_CARDS, WORLDS } from './levels'
import { makeCard } from './notes'
import type { IProgress } from './progress'
import { dayKey, defaultProgress, exportProgress, importProgress, recordScore, recordSession, XP_PER_PAST_SESSION } from './progress'
import type { IAnswer } from './scheduler'
import { EAR_PASS_RT, SESSION_LENGTH, updateStat } from './scheduler'
import type { IOnsetResult } from './rhythm'

function level(id: string): Level {
  const l = levelById(id)
  if (!l) throw new Error(`unknown level ${id}`)
  return l
}

function answers(n: number, ok: (i: number) => boolean, rt = 900): IAnswer[] {
  return Array.from({ length: n }, (_, i) => ({ ok: ok(i), rt }))
}

function played(p: IProgress, id: string, list: IAnswer[]): IProgress {
  return { ...p, history: { ...p.history, [id]: [...(p.history[id] ?? []), ...list] } }
}

function drill(id: string, list: IAnswer[], points: number, bestCombo = 0) {
  const correct = list.filter((a) => a.ok).length
  const accuracy = correct / list.length
  const medianRt = list[0]?.rt ?? 0
  const input: IGameInput = { level: level(id), points, accuracy, medianRt, bestCombo, correct }
  const record = (p: IProgress): IProgress => recordSession(played(p, id, list), { date: Date.now(), level: id, accuracy, medianRt })
  return { input, record }
}

function onset(grade: IOnsetResult['grade'], pitchOk: boolean | null = null): IOnsetResult {
  return { index: 0, delta: 0, grade, pitchOk }
}

describe('combo multiplier', () => {
  it('climbs every five notes and stops at ×4', () => {
    expect([0, 4, 5, 9, 10, 14, 15, 40].map(multiplier)).toEqual([1, 1, 2, 2, 3, 3, 4, 4])
  })
})

describe('note points', () => {
  it('judges against the level time limit', () => {
    expect(judge(999)).toBe('perfect')
    expect(judge(1000)).toBe('good')
    expect(judge(1499)).toBe('good')
    expect(judge(1500)).toBe('ok')
    expect(judge(1999, EAR_PASS_RT)).toBe('perfect')
    expect(judge(2999, EAR_PASS_RT)).toBe('good')
  })

  it('adds the speed bonus, then applies the combo', () => {
    expect(notePoints(800, 0).points).toBe(20)
    expect(notePoints(1200, 5).points).toBe(30)
    expect(notePoints(2000, 15)).toEqual({ points: 40, judgement: 'ok', multiplier: 4 })
  })
})

describe('exercise points', () => {
  it('scores each onset by precision and resets the combo on a miss', () => {
    const r = exercisePoints([onset('perfect'), onset('good'), onset('late'), onset('miss'), onset('perfect')])
    expect(r).toEqual({ points: 90, bestCombo: 3, correct: 4 })
  })

  it('treats a wrong pitch as a miss', () => {
    expect(exercisePoints([onset('perfect', false), onset('perfect', true)])).toEqual({ points: 30, bestCombo: 1, correct: 1 })
  })

  it('doubles from the sixth onset in a row', () => {
    expect(exercisePoints(Array.from({ length: 6 }, () => onset('perfect'))).points).toBe(30 * 5 + 60)
  })
})

describe('stars', () => {
  it('uses the reading thresholds for pitch levels and the rhythm ones otherwise', () => {
    expect([0.74, 0.75, 0.89, 0.9, 1].map((a) => sessionStars(level('p2'), a))).toEqual([0, 1, 1, 2, 2])
    expect([0.59, 0.6, 0.79, 0.8].map((a) => sessionStars(level('r1'), a))).toEqual([0, 1, 1, 2])
  })

  it('gives three stars to a validated level', () => {
    const p = played(defaultProgress(), 'p2', answers(SESSION_LENGTH, () => true))
    expect(starsOf(level('p2'), p)).toBe(3)
  })

  it('derives stars from the history of players who started before the stars existed', () => {
    const p = played(defaultProgress(), 'p2', answers(SESSION_LENGTH, (i) => i % 5 !== 0))
    expect(starsOf(level('p2'), p)).toBe(1)
    expect(starsOf(level('r1'), recordScore(defaultProgress(), 'r1', 70))).toBe(1)
  })

  it('keeps the best stars ever earned', () => {
    const p = played(defaultProgress(), 'p2', answers(SESSION_LENGTH, (i) => i % 5 !== 0))
    expect(starsOf(level('p2'), { ...p, stars: { p2: 2 } })).toBe(2)
    expect(starsOf(level('p3'), defaultProgress())).toBe(0)
  })
})

describe('unlocking', () => {
  it('opens the first level of every world', () => {
    for (const world of WORLDS) expect(isUnlocked(world.levels[0], defaultProgress())).toBe(true)
    expect(isUnlocked(level('p2'), defaultProgress())).toBe(false)
  })

  it('opens a level with one star on the one before', () => {
    expect(isUnlocked(level('p2'), { ...defaultProgress(), stars: { p1: 1 } })).toBe(true)
    expect(isUnlocked(level('p3'), { ...defaultProgress(), stars: { p1: 1 } })).toBe(false)
  })

  it('never locks a level that was already played', () => {
    const p = played(defaultProgress(), 'p4', answers(5, () => false))
    expect(isUnlocked(level('p4'), p)).toBe(true)
    expect(isUnlocked(level('f2'), recordScore(defaultProgress(), 'f2', 40))).toBe(true)
  })

  it('points to the next level only once it is open', () => {
    expect(nextLevel(level('p1'), defaultProgress())).toBeNull()
    expect(nextLevel(level('p1'), { ...defaultProgress(), stars: { p1: 1 } })?.id).toBe('p2')
    expect(nextLevel(level('e2'), { ...defaultProgress(), stars: { e1: 3, e2: 3 } })).toBeNull()
    expect(nextLevel(chronoLevel(defaultProgress()), defaultProgress())).toBeNull()
  })
})

describe('player level', () => {
  it('asks 100 × N XP to go from level N to the next', () => {
    expect(levelFromXp(0)).toEqual({ level: 1, into: 0, need: 100 })
    expect(levelFromXp(99)).toEqual({ level: 1, into: 99, need: 100 })
    expect(levelFromXp(100)).toEqual({ level: 2, into: 0, need: 200 })
    expect(levelFromXp(299)).toEqual({ level: 2, into: 199, need: 200 })
    expect(levelFromXp(600)).toEqual({ level: 4, into: 0, need: 400 })
    expect(levelFromXp(-5).level).toBe(1)
  })
})

describe('settle', () => {
  it('rewards a first validated session with a record, three stars, XP and badges', () => {
    const { input, record } = drill('p2', answers(SESSION_LENGTH, () => true), 1500, 30)
    const { progress, reward } = settle(defaultProgress(), input, record)
    expect(reward.newRecord).toBe(true)
    expect(reward.previousRecord).toBe(0)
    expect(progress.records.p2).toBe(1500)
    expect([reward.starsBefore, reward.starsAfter]).toEqual([0, 3])
    expect(progress.stars.p2).toBe(3)
    expect(reward.xpGained).toBe(150 + 75 + 50)
    expect(progress.xp).toBe(275)
    expect([reward.levelBefore, reward.levelAfter]).toEqual([1, 2])
    expect(reward.badges).toEqual(['first', 'perfect', 'lightning', 'combo'])
    expect(Object.keys(progress.badges).sort()).toEqual(['combo', 'first', 'lightning', 'perfect'])
  })

  it('keeps the record and badges when a later session is weaker', () => {
    const first = drill('p2', answers(SESSION_LENGTH, () => true), 1500, 30)
    const after = settle(defaultProgress(), first.input, first.record).progress
    const second = drill('p2', answers(SESSION_LENGTH, (i) => i % 4 !== 0, 1600), 400, 3)
    const { progress, reward } = settle(after, second.input, second.record)
    expect(reward.newRecord).toBe(false)
    expect(reward.previousRecord).toBe(1500)
    expect(progress.records.p2).toBe(1500)
    expect(reward.starsAfter).toBe(3)
    expect(reward.xpGained).toBe(40)
    expect(reward.badges).toEqual([])
  })

  it('is pure, so the screen and the saved progress agree', () => {
    const { input, record } = drill('p3', answers(SESSION_LENGTH, (i) => i % 10 !== 0, 1200), 900, 9)
    const before = defaultProgress()
    const a = settle(before, input, record)
    const b = settle(before, input, record)
    expect(a.reward).toEqual(b.reward)
    expect(a.progress.xp).toBe(b.progress.xp)
    expect(before.xp).toBe(0)
    expect(before.records).toEqual({})
  })

  it('gives stars from the session accuracy before validation', () => {
    const { input, record } = drill('p3', answers(20, (i) => i % 10 !== 0, 1200), 600, 9)
    const { reward } = settle(defaultProgress(), input, record)
    expect([reward.starsBefore, reward.starsAfter]).toEqual([0, 2])
  })

  it('counts correct notes as the chrono record and never grants the perfect badge there', () => {
    const chrono = chronoLevel(defaultProgress())
    const input: IGameInput = { level: chrono, points: 700, accuracy: 1, medianRt: 1200, bestCombo: 24, correct: 24 }
    const record = (p: IProgress): IProgress => recordSession(p, { date: Date.now(), level: CHRONO_ID, accuracy: 1, medianRt: 1200 })
    const { progress, reward } = settle(defaultProgress(), input, record)
    expect(reward.recordValue).toBe(24)
    expect(progress.records[CHRONO_ID]).toBe(24)
    expect(reward.badges).not.toContain('perfect')
    expect([reward.starsBefore, reward.starsAfter]).toEqual([0, 0])
    expect(progress.stars).toEqual({})
  })

  it('never keeps a record for the daily review', () => {
    const p = defaultProgress()
    for (let d = 0; d < REVIEW_MIN_CARDS; d++) p.cards[makeCard('treble', d, null).id] = updateStat(undefined, true, 900)
    const review: Level = { ...level('p2'), id: REVIEW_ID }
    const input: IGameInput = { level: review, points: 800, accuracy: 1, medianRt: 900, bestCombo: 30, correct: 30 }
    const { progress, reward } = settle(p, input, (x) => recordSession(x, { date: Date.now(), level: REVIEW_ID, accuracy: 1, medianRt: 900 }))
    expect(reward.newRecord).toBe(false)
    expect(progress.records).toEqual({})
    expect(reward.xpGained).toBe(80)
  })

  it('grants the week badge on the seventh day in a row', () => {
    const yesterday = dayKey(new Date(Date.now() - 86400000))
    const p = { ...defaultProgress(), streak: { lastDay: yesterday, count: 6 }, badges: { first: 1 } }
    const { input, record } = drill('p1', answers(10, (i) => i > 0, 2000), 100)
    expect(settle(p, input, record).reward.badges).toEqual(['week'])
  })

  it('grants the two clefs badge once both clefs are validated', () => {
    let p = played(defaultProgress(), 'p2', answers(SESSION_LENGTH, () => true))
    p = { ...p, badges: { first: 1, perfect: 1, lightning: 1 } }
    const { input, record } = drill('p3', answers(SESSION_LENGTH, () => true), 1000)
    expect(settle(p, input, record).reward.badges).toEqual(['clefs'])
  })

  it('knows every badge it can award', () => {
    expect(BADGES.map((b) => b.id)).toEqual(['first', 'perfect', 'lightning', 'combo', 'week', 'clefs', 'hands', 'ear'])
  })
})

describe('chrono level', () => {
  it('starts on the landmarks and the treble staff', () => {
    const chrono = chronoLevel(defaultProgress())
    const ids = chrono.cards.map((c) => c.id)
    const treble = level('p2')
    if (treble.kind !== 'pitch') throw new Error('p2 is a pitch level')
    expect(new Set(ids).size).toBe(ids.length)
    expect(ids).toEqual(expect.arrayContaining(treble.cards.map((c) => c.id)))
    expect(chrono.timed).toBe(CHRONO_SECONDS)
    expect(chrono.id).toBe(CHRONO_ID)
  })

  it('then draws from the plain notes already seen', () => {
    const p = defaultProgress()
    for (let d = 0; d < REVIEW_MIN_CARDS + 2; d++) p.cards[makeCard('treble', d, null).id] = updateStat(undefined, true, 900)
    p.cards[makeCard('treble', 3, 1).id] = updateStat(undefined, true, 900)
    p.cards[makeCard('treble', 4, null, 'G').id] = updateStat(undefined, true, 900)
    const chrono = chronoLevel(p)
    expect(chrono.cards.length).toBe(REVIEW_MIN_CARDS + 2)
    expect(chrono.cards.every((c) => c.key === 'C' && c.shown === null)).toBe(true)
  })
})

describe('progress migration', () => {
  it('gives XP for past sessions and empty game fields to an old export', () => {
    const old = JSON.parse(exportProgress(defaultProgress())) as Record<string, unknown>
    delete old.xp
    delete old.records
    delete old.stars
    delete old.badges
    old.sessions = [
      { date: 1, level: 'p1', accuracy: 1, medianRt: 900 },
      { date: 2, level: 'p2', accuracy: 0.8, medianRt: 1300 },
    ]
    const p = importProgress(JSON.stringify(old))
    expect(p?.xp).toBe(2 * XP_PER_PAST_SESSION)
    expect(p?.records).toEqual({})
    expect(p?.stars).toEqual({})
    expect(p?.badges).toEqual({})
  })

  it('keeps the XP of a current export', () => {
    const p = importProgress(exportProgress({ ...defaultProgress(), xp: 420, records: { p1: 900 } }))
    expect(p?.xp).toBe(420)
    expect(p?.records.p1).toBe(900)
  })
})
