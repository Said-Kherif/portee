import { describe, expect, it } from 'vitest'
import { FLAT_POSITIONS, KEYS, keyAlteration, letterAt, MIDDLE_LINE, midiAt, noteName, octaveAt, SHARP_POSITIONS, whiteKeyLabel } from './notes'

const fr = (d: number): string => noteName(d, 0, 'fr')

describe('diatonic index', () => {
  it('starts at middle C', () => {
    expect(letterAt(0)).toBe('C')
    expect(octaveAt(0)).toBe(4)
    expect(midiAt(0, 0)).toBe(60)
  })

  it('names the landmarks', () => {
    expect(fr(4)).toBe('sol4')
    expect(fr(7)).toBe('do5')
    expect(fr(-4)).toBe('fa3')
    expect(fr(-7)).toBe('do3')
    expect(fr(-1)).toBe('si3')
    expect(fr(14)).toBe('do6')
    expect(fr(-14)).toBe('do2')
  })

  it('puts the middle line on si4 and ré3', () => {
    expect(fr(MIDDLE_LINE.treble)).toBe('si4')
    expect(fr(MIDDLE_LINE.bass)).toBe('ré3')
  })

  it('maps accidentals to midi', () => {
    expect(midiAt(3, 1)).toBe(66)
    expect(midiAt(4, -1)).toBe(66)
    expect(midiAt(-9, 1)).toBe(46)
    expect(noteName(3, 1, 'fr')).toBe('fa♯4')
    expect(noteName(4, -1, 'en')).toBe('G♭4')
  })

  it('labels white keys with the octave on C only', () => {
    expect(whiteKeyLabel(60, 'fr')).toBe('do4')
    expect(whiteKeyLabel(62, 'fr')).toBe('ré')
    expect(whiteKeyLabel(72, 'en')).toBe('C5')
  })
})

describe('key signatures', () => {
  it('engraves sharps in the order fa do sol ré la mi si', () => {
    expect(SHARP_POSITIONS.treble.map(fr)).toEqual(['fa5', 'do5', 'sol5', 'ré5', 'la4', 'mi5', 'si4'])
    expect(SHARP_POSITIONS.bass.map(fr)).toEqual(['fa3', 'do3', 'sol3', 'ré3', 'la2', 'mi3', 'si2'])
  })

  it('engraves flats in the order si mi la ré sol do fa', () => {
    expect(FLAT_POSITIONS.treble.map(fr)).toEqual(['si4', 'mi5', 'la4', 'ré5', 'sol4', 'do5', 'fa4'])
    expect(FLAT_POSITIONS.bass.map(fr)).toEqual(['si2', 'mi3', 'la2', 'ré3', 'sol2', 'do3', 'fa3'])
  })

  it('keeps every signature accidental within one step of the staff', () => {
    for (const d of [...SHARP_POSITIONS.treble, ...FLAT_POSITIONS.treble]) expect(d).toBeGreaterThanOrEqual(1)
    for (const d of [...SHARP_POSITIONS.treble, ...FLAT_POSITIONS.treble]) expect(d).toBeLessThanOrEqual(11)
    for (const d of [...SHARP_POSITIONS.bass, ...FLAT_POSITIONS.bass]) expect(d).toBeGreaterThanOrEqual(-11)
    for (const d of [...SHARP_POSITIONS.bass, ...FLAT_POSITIONS.bass]) expect(d).toBeLessThanOrEqual(-1)
  })

  it('alters the right letters', () => {
    expect(keyAlteration('D', 'F')).toBe(1)
    expect(keyAlteration('D', 'C')).toBe(1)
    expect(keyAlteration('D', 'G')).toBe(0)
    expect(keyAlteration('Bb', 'B')).toBe(-1)
    expect(keyAlteration('Bb', 'E')).toBe(-1)
    expect(keyAlteration('F', 'E')).toBe(0)
    expect(keyAlteration('C', 'F')).toBe(0)
  })

  it('counts accidentals per key', () => {
    expect([KEYS.G.sharps, KEYS.D.sharps, KEYS.A.sharps]).toEqual([1, 2, 3])
    expect([KEYS.F.flats, KEYS.Bb.flats, KEYS.Eb.flats]).toEqual([1, 2, 3])
  })
})
