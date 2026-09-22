export type Letter = 'C' | 'D' | 'E' | 'F' | 'G' | 'A' | 'B'
export type Accidental = -1 | 0 | 1
export type Clef = 'treble' | 'bass'
export type Notation = 'fr' | 'en'
export type KeyId = 'C' | 'G' | 'D' | 'A' | 'F' | 'Bb' | 'Eb'

export interface ICard {
  id: string
  clef: Clef
  diatonic: number
  shown: Accidental | null
  key: KeyId
  midi: number
}

export const LETTERS: Letter[] = ['C', 'D', 'E', 'F', 'G', 'A', 'B']
const SEMITONES: Record<Letter, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }
const NAMES_FR: Record<Letter, string> = { C: 'do', D: 'ré', E: 'mi', F: 'fa', G: 'sol', A: 'la', B: 'si' }
const SHARP_ORDER: Letter[] = ['F', 'C', 'G', 'D', 'A', 'E', 'B']
const FLAT_ORDER: Letter[] = ['B', 'E', 'A', 'D', 'G', 'F', 'C']

export const MIDDLE_LINE: Record<Clef, number> = { treble: 6, bass: -6 }

export const KEYS: Record<KeyId, { sharps: number; flats: number; label: string }> = {
  C: { sharps: 0, flats: 0, label: 'Do majeur' },
  G: { sharps: 1, flats: 0, label: 'Sol majeur' },
  D: { sharps: 2, flats: 0, label: 'Ré majeur' },
  A: { sharps: 3, flats: 0, label: 'La majeur' },
  F: { sharps: 0, flats: 1, label: 'Fa majeur' },
  Bb: { sharps: 0, flats: 2, label: 'Si bémol majeur' },
  Eb: { sharps: 0, flats: 3, label: 'Mi bémol majeur' },
}

export const SHARP_POSITIONS: Record<Clef, number[]> = {
  treble: [10, 7, 11, 8, 5, 9, 6],
  bass: [-4, -7, -3, -6, -9, -5, -8],
}
export const FLAT_POSITIONS: Record<Clef, number[]> = {
  treble: [6, 9, 5, 8, 4, 7, 3],
  bass: [-8, -5, -9, -6, -10, -7, -4],
}

export function keyAlteration(key: KeyId, letter: Letter): Accidental {
  const k = KEYS[key]
  if (k.sharps > 0 && SHARP_ORDER.slice(0, k.sharps).includes(letter)) return 1
  if (k.flats > 0 && FLAT_ORDER.slice(0, k.flats).includes(letter)) return -1
  return 0
}

export function letterAt(diatonic: number): Letter {
  return LETTERS[((diatonic % 7) + 7) % 7]
}

export function octaveAt(diatonic: number): number {
  return 4 + Math.floor(diatonic / 7)
}

export function midiAt(diatonic: number, accidental: Accidental): number {
  return (octaveAt(diatonic) + 1) * 12 + SEMITONES[letterAt(diatonic)] + accidental
}

export function isBlackKey(midi: number): boolean {
  return [1, 3, 6, 8, 10].includes(((midi % 12) + 12) % 12)
}

export function noteName(diatonic: number, accidental: Accidental | null, notation: Notation, withOctave = true): string {
  const letter = letterAt(diatonic)
  const base = notation === 'fr' ? NAMES_FR[letter] : letter
  const acc = accidental === 1 ? '♯' : accidental === -1 ? '♭' : ''
  return withOctave ? `${base}${acc}${octaveAt(diatonic)}` : `${base}${acc}`
}

export function whiteKeyLabel(midi: number, notation: Notation): string {
  const pc = ((midi % 12) + 12) % 12
  const letter = LETTERS.find((l) => SEMITONES[l] === pc)
  if (!letter) return ''
  const base = notation === 'fr' ? NAMES_FR[letter] : letter
  return letter === 'C' ? `${base}${Math.floor(midi / 12) - 1}` : base
}

export function cardName(card: ICard, notation: Notation): string {
  const effective = card.shown ?? keyAlteration(card.key, letterAt(card.diatonic))
  return noteName(card.diatonic, effective, notation)
}

export function makeCard(clef: Clef, diatonic: number, shown: Accidental | null, key: KeyId = 'C'): ICard {
  const effective = shown ?? keyAlteration(key, letterAt(diatonic))
  return {
    id: `${clef}:${diatonic}:${shown ?? 'k'}:${key}`,
    clef,
    diatonic,
    shown,
    key,
    midi: midiAt(diatonic, effective),
  }
}

export function cardFromId(id: string): ICard | null {
  const [clef, d, shown, key] = id.split(':')
  if ((clef !== 'treble' && clef !== 'bass') || d === undefined || shown === undefined || key === undefined) return null
  const diatonic = Number(d)
  if (Number.isNaN(diatonic) || !(key in KEYS)) return null
  const acc: Accidental | null = shown === 'k' ? null : (Number(shown) as Accidental)
  return makeCard(clef, diatonic, acc, key as KeyId)
}
