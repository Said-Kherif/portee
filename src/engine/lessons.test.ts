import { describe, expect, it } from 'vitest'
import { LESSONS } from './lessons'
import { LEVELS, levelById } from './levels'
import { keyAlteration, letterAt, midiAt } from './notes'
import type { IScore } from '../score/layout'

function figureMidis(score: IScore): number[] {
  return score.measures
    .flatMap((m) => m.elements)
    .filter((el) => el.kind === 'note' && el.diatonic !== undefined)
    .map((el) => midiAt(el.diatonic as number, el.shown ?? keyAlteration(score.key, letterAt(el.diatonic as number))))
}

const spacedOctave = /\b(do|ré|mi|fa|sol|la|si) [1-7]\b/

describe('lessons', () => {
  it('belong to an existing level, once each', () => {
    const ids = LESSONS.map((l) => l.levelId)
    expect(new Set(ids).size).toBe(ids.length)
    for (const id of ids) expect(levelById(id)).toBeDefined()
  })

  for (const lesson of LESSONS) {
    describe(lesson.levelId, () => {
      lesson.steps.forEach((step, i) => {
        const name = `${i + 1}. ${step.title}`

        it(`${name}: piano marks come from the figure and fit the keyboard`, () => {
          if (!step.score || !step.piano) return
          const midis = figureMidis(step.score)
          for (const m of midis) expect(m).toBeGreaterThanOrEqual(step.piano.low)
          for (const m of midis) expect(m).toBeLessThanOrEqual(step.piano.high)
          for (const mark of step.piano.marks) expect(midis).toContain(mark)
        })

        it(`${name}: a quiz has a figure of notes and a keyboard that shows them all`, () => {
          if (!step.quiz) return
          if (!step.score || !step.piano) throw new Error('quiz step without score or piano')
          const midis = figureMidis(step.score)
          expect(midis.length).toBeGreaterThan(1)
          expect(new Set(midis).size).toBe(midis.length)
          expect(step.score.measures.flatMap((m) => m.elements).every((el) => el.kind === 'note')).toBe(true)
          expect(step.piano.marks).toEqual([])
        })

        it(`${name}: accents and labels point at existing elements`, () => {
          const count = step.score?.measures.flatMap((m) => m.elements).length ?? 0
          for (const a of step.accent ?? []) expect(a).toBeLessThan(count)
          for (const k of Object.keys(step.labels ?? {})) expect(Number(k)).toBeLessThan(count)
        })

        it(`${name}: text uses glued octaves and typographic apostrophes`, () => {
          for (const t of [step.title, ...step.text]) {
            expect(t).not.toMatch(spacedOctave)
            expect(t).not.toContain("'")
          }
        })
      })
    })
  }
})

describe('levels', () => {
  it('use glued octaves in subtitles', () => {
    for (const l of LEVELS) expect(l.subtitle).not.toMatch(spacedOctave)
  })

  it('cover the five lines of each clef', () => {
    const treble = levelById('p2')
    const bass = levelById('p3')
    if (treble?.kind !== 'pitch' || bass?.kind !== 'pitch') throw new Error('missing clef levels')
    const trebleDs = new Set(treble.cards.map((c) => c.diatonic))
    const bassDs = new Set(bass.cards.map((c) => c.diatonic))
    for (const d of [2, 4, 6, 8, 10]) expect(trebleDs.has(d)).toBe(true)
    for (const d of [-10, -8, -6, -4, -2]) expect(bassDs.has(d)).toBe(true)
  })

  it('have unique ids', () => {
    const ids = LEVELS.map((l) => l.id)
    expect(new Set(ids).size).toBe(ids.length)
  })
})
