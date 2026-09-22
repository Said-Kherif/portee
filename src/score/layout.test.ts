import { describe, expect, it } from 'vitest'
import type { IElement } from '../engine/rhythm'
import type { IScore } from './layout'
import { layoutScore } from './layout'

const whole = (clef: 'treble' | 'bass', diatonic: number): IElement => ({ kind: 'note', value: 'w', dots: 0, beats: 1, start: 0, clef, diatonic, shown: null })
const single = (system: IScore['system'], el: IElement): IScore => ({ system, key: 'C', timeSig: null, barlines: false, measures: [{ elements: [el] }] })
const sp = 10

describe('layoutScore', () => {
  it('draws five lines per staff', () => {
    const lines = (s: IScore) => layoutScore(s, sp).statics.filter((p) => p.t === 'line' && p.y1 === p.y2).length
    expect(lines(single('treble', whole('treble', 6)))).toBe(5)
    expect(lines(single('grand', whole('treble', 6)))).toBe(10)
  })

  it('places the middle line note on the third line', () => {
    const l = layoutScore(single('treble', whole('treble', 6)), sp)
    expect(l.elements[0].y).toBe(7 * sp)
    const b = layoutScore(single('bass', whole('bass', -6)), sp)
    expect(b.elements[0].y).toBe(7 * sp)
  })

  it('adds ledger lines from middle C outwards', () => {
    const ledgers = (el: IElement, system: IScore['system'] = 'treble') => layoutScore(single(system, el), sp).elements[0].prims.filter((p) => p.t === 'line').length
    expect(ledgers(whole('treble', 11))).toBe(0)
    expect(ledgers(whole('treble', 12))).toBe(1)
    expect(ledgers(whole('treble', 14))).toBe(2)
    expect(ledgers(whole('treble', 0))).toBe(1)
    expect(ledgers(whole('bass', 0), 'bass')).toBe(1)
    expect(ledgers(whole('bass', -12), 'bass')).toBe(1)
    expect(ledgers(whole('bass', -14), 'bass')).toBe(2)
  })

  it('points stems up below the middle line and down from it', () => {
    const stem = (d: number) => {
      const el = layoutScore(single('treble', { ...whole('treble', d), value: 'q' }), sp).elements[0]
      const line = el.prims.find((p) => p.t === 'line')
      if (!line || line.t !== 'line') throw new Error('no stem')
      return line.y2 < el.y ? 'up' : 'down'
    }
    expect(stem(4)).toBe('up')
    expect(stem(6)).toBe('down')
    expect(stem(8)).toBe('down')
  })

  it('centres a whole rest in its bar', () => {
    const bar = (value: 'w' | 'q'): IScore => ({ system: 'rhythm', key: 'C', timeSig: [4, 4], barlines: true, measures: [{ elements: [{ kind: 'rest', value, dots: 0, beats: value === 'w' ? 4 : 1, start: 0 }] }] })
    const whole = layoutScore(bar('w'), sp)
    const quarter = layoutScore(bar('q'), sp)
    expect(whole.elements[0].x).toBeGreaterThan(quarter.elements[0].x + 5 * sp)
    expect(whole.width).toBe(quarter.width)
  })

  it('draws a natural only when shown is 0', () => {
    const glyphs = (shown: -1 | 0 | 1 | null) => layoutScore(single('treble', { ...whole('treble', 4), shown }), sp).elements[0].prims.filter((p) => p.t === 'glyph').length
    expect(glyphs(null)).toBe(1)
    expect(glyphs(0)).toBe(2)
    expect(glyphs(1)).toBe(2)
  })
})
