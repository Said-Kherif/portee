import { describe, expect, it } from 'vitest'
import { LEVELS } from './levels'
import type { CellKind, IElement } from './rhythm'
import { BEATS_PER_MEASURE, generateMeasures, scoreTaps } from './rhythm'

const vocabs: CellKind[][] = LEVELS.flatMap((l) => (l.kind === 'rhythm' || l.kind === 'phrase' ? [l.vocab] : []))

function checkMeasure(elements: IElement[]): void {
  const sorted = [...elements].sort((a, b) => a.start - b.start)
  expect(sorted.map((e) => e.start)).toEqual(elements.map((e) => e.start))
  expect(elements.reduce((a, e) => a + e.beats, 0)).toBe(BEATS_PER_MEASURE)
  for (const e of elements) expect(e.start + e.beats).toBeLessThanOrEqual(BEATS_PER_MEASURE)
  for (const e of elements) {
    if (e.value === 'w') expect(e.start).toBe(0)
    if (e.value === 'h' && e.dots === 1) expect(e.start).toBe(0)
    if (e.value === 'h' && e.dots === 0) expect(e.start % 2).toBe(0)
    if (e.value === 'q' && e.dots === 1) expect(e.start % 2).toBe(0)
  }
  for (let i = 1; i < elements.length; i++) {
    if (elements[i].kind === 'rest') expect(elements[i - 1].kind).toBe('note')
  }
  expect(elements.some((e) => e.kind === 'note')).toBe(true)
}

describe('generateMeasures', () => {
  it('never produces an invalid bar', () => {
    for (const vocab of vocabs) {
      for (let run = 0; run < 300; run++) {
        for (const m of generateMeasures(vocab, 2)) checkMeasure(m.elements)
      }
    }
  })

  it('beams eighth pairs together', () => {
    for (let run = 0; run < 100; run++) {
      for (const m of generateMeasures(['ee'], 1)) {
        const eighths = m.elements.filter((e) => e.value === 'e')
        expect(eighths.length % 2).toBe(0)
        for (let i = 0; i < eighths.length; i += 2) expect(eighths[i].beam).toBe(eighths[i + 1].beam)
      }
    }
  })
})

describe('scoreTaps', () => {
  const onsets = [0, 500, 1000, 1500].map((time, index) => ({ index, time, midi: 60 }))

  it('grades by distance and penalises extra taps', () => {
    const r = scoreTaps(
      onsets,
      [
        { t: 10, midi: null },
        { t: 590, midi: null },
        { t: 1150, midi: null },
        { t: 3000, midi: null },
      ],
      false,
    )
    expect(r.results.map((x) => x.grade)).toEqual(['perfect', 'good', 'late', 'miss'])
    expect(r.extra).toBe(1)
    expect(r.score).toBe(50)
  })

  it('gives nothing for a wrong pitch without counting it as extra', () => {
    const r = scoreTaps(onsets, [{ t: 0, midi: 62 }], true)
    expect(r.results[0].pitchOk).toBe(false)
    expect(r.extra).toBe(0)
    expect(r.score).toBe(0)
  })

  it('scores a clean run at 100', () => {
    const r = scoreTaps(
      onsets,
      onsets.map((o) => ({ t: o.time + 20, midi: 60 })),
      true,
    )
    expect(r.score).toBe(100)
  })
})
