import { describe, expect, it } from 'vitest'
import { LEVELS } from './levels'
import type { CellKind, IElement, IMeasure } from './rhythm'
import { assignHands, BEATS_PER_MEASURE, generateMeasures, onsetsOf, scoreTaps } from './rhythm'

const vocabs: CellKind[][] = LEVELS.flatMap((l) => (l.kind === 'rhythm' || l.kind === 'phrase' ? [l.vocab] : []))

const isPause = (elements: IElement[]): boolean => elements.length === 1 && elements[0].kind === 'rest' && elements[0].value === 'w'

function checkMeasure(elements: IElement[], index: number, previous: IMeasure | undefined): void {
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
  if (previous && previous.elements[previous.elements.length - 1].kind === 'rest') expect(elements[0].kind).toBe('note')
  if (isPause(elements)) {
    expect(index).toBeGreaterThan(0)
    expect(previous && isPause(previous.elements)).toBe(false)
  } else {
    expect(elements.some((e) => e.kind === 'note')).toBe(true)
  }
}

describe('generateMeasures', () => {
  it('never produces an invalid bar', () => {
    for (const vocab of vocabs) {
      for (let run = 0; run < 300; run++) {
        const measures = generateMeasures(vocab, 2)
        measures.forEach((m, i) => checkMeasure(m.elements, i, measures[i - 1]))
        expect(onsetsOf(measures).length).toBeGreaterThanOrEqual(3)
      }
    }
  })

  it('produces a whole-measure pause from time to time, never in the first bar', () => {
    let pauses = 0
    for (let run = 0; run < 300; run++) {
      const measures = generateMeasures(['q', 'h', 'rq', 'rh', 'rw'], 2)
      expect(isPause(measures[0].elements)).toBe(false)
      if (isPause(measures[1].elements)) pauses++
    }
    expect(pauses).toBeGreaterThan(0)
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

describe('assignHands', () => {
  const treble: [number, number] = [0, 4]
  const bass: [number, number] = [-7, -3]

  it('gives each bar of an alternating phrase to one hand and rests the other', () => {
    const clefsSeen = new Set<string>()
    for (let run = 0; run < 200; run++) {
      const measures = assignHands(generateMeasures(['q', 'h', 'w', 'h.'], 2), 'alternate', treble, bass)
      const hands = measures.map((m) => {
        const [rest, ...notes] = m.elements
        expect(rest.kind).toBe('rest')
        expect(rest.value).toBe('w')
        const clef = notes[0].clef
        expect(rest.clef).not.toBe(clef)
        for (const n of notes) {
          expect(n.kind).toBe('note')
          expect(n.clef).toBe(clef)
          const [low, high] = clef === 'treble' ? treble : bass
          expect(n.diatonic).toBeGreaterThanOrEqual(low)
          expect(n.diatonic).toBeLessThanOrEqual(high)
        }
        expect(notes.reduce((a, n) => a + n.beats, 0)).toBe(BEATS_PER_MEASURE)
        return clef
      })
      expect(hands[0]).not.toBe(hands[1])
      clefsSeen.add(hands[0] ?? '')
      expect(onsetsOf(measures).length).toBeGreaterThanOrEqual(3)
    }
    expect(clefsSeen.size).toBe(2)
  })

  it('holds a left-hand chord note under the right-hand melody', () => {
    for (let run = 0; run < 200; run++) {
      const measures = assignHands(generateMeasures(['q', 'h', 'w', 'h.'], 2), 'together', treble, bass)
      measures.forEach((m, mi) => {
        const [left, ...right] = m.elements
        expect(left).toMatchObject({ kind: 'note', value: 'w', clef: 'bass', start: 0 })
        expect([-7, -5, -3]).toContain(left.diatonic)
        for (const n of right) {
          expect(n.clef).toBe('treble')
          expect(n.diatonic).toBeGreaterThanOrEqual(treble[0])
          expect(n.diatonic).toBeLessThanOrEqual(treble[1])
        }
        const downbeat = onsetsOf(measures).filter((o) => o.beat === mi * BEATS_PER_MEASURE)
        expect(downbeat.length).toBe(2)
      })
    }
  })
})

describe('scoreTaps with both hands', () => {
  const onsets = [
    { index: 0, time: 0, midi: 48 },
    { index: 1, time: 0, midi: 64 },
    { index: 2, time: 500, midi: 62 },
  ]

  it('matches each simultaneous note with the tap of its own pitch', () => {
    const r = scoreTaps(
      onsets,
      [
        { t: 4, midi: 64 },
        { t: 9, midi: 48 },
        { t: 505, midi: 62 },
      ],
      true,
    )
    expect(r.results.map((x) => x.pitchOk)).toEqual([true, true, true])
    expect(r.extra).toBe(0)
    expect(r.score).toBe(100)
  })

  it('counts a missing hand as missed without blaming the other', () => {
    const r = scoreTaps(
      onsets,
      [
        { t: 3, midi: 64 },
        { t: 502, midi: 62 },
      ],
      true,
    )
    expect(r.results[0].grade).toBe('miss')
    expect(r.results[1].pitchOk).toBe(true)
    expect(r.results[2].pitchOk).toBe(true)
    expect(r.score).toBe(67)
  })

  it('still flags a wrong note played at the right time', () => {
    const r = scoreTaps(
      onsets,
      [
        { t: 3, midi: 64 },
        { t: 6, midi: 50 },
        { t: 502, midi: 62 },
      ],
      true,
    )
    expect(r.results[0].pitchOk).toBe(false)
    expect(r.results[1].pitchOk).toBe(true)
    expect(r.extra).toBe(0)
  })
})
