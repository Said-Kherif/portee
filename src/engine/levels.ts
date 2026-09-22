import type { Clef, ICard, KeyId } from './notes'
import { keyAlteration, letterAt, makeCard, midiAt } from './notes'
import type { CellKind } from './rhythm'

export type System = 'treble' | 'bass' | 'grand'

export interface IPitchLevel {
  kind: 'pitch'
  id: string
  title: string
  subtitle: string
  system: System
  cards: ICard[]
  focus: Set<string>
  keys?: KeyId[]
}

export interface IRhythmLevel {
  kind: 'rhythm'
  id: string
  title: string
  subtitle: string
  vocab: CellKind[]
}

export interface IPhraseLevel {
  kind: 'phrase'
  id: string
  title: string
  subtitle: string
  clef: Clef
  range: [number, number]
  vocab: CellKind[]
}

export type Level = IPitchLevel | IRhythmLevel | IPhraseLevel

function range(clef: Clef, from: number, to: number): ICard[] {
  const out: ICard[] = []
  for (let d = from; d <= to; d++) out.push(makeCard(clef, d, null))
  return out
}

function ids(cards: ICard[]): Set<string> {
  return new Set(cards.map((c) => c.id))
}

function accidentalCards(clef: Clef, from: number, to: number): ICard[] {
  const out: ICard[] = []
  for (let d = from; d <= to; d++) {
    const letter = letterAt(d)
    if (letter !== 'E' && letter !== 'B') out.push(makeCard(clef, d, 1))
    if (letter !== 'F' && letter !== 'C') out.push(makeCard(clef, d, -1))
  }
  return out
}

function keyCards(clef: Clef, from: number, to: number, key: KeyId): ICard[] {
  const out: ICard[] = []
  for (let d = from; d <= to; d++) {
    out.push(makeCard(clef, d, null, key))
    if (keyAlteration(key, letterAt(d)) !== 0) out.push({ ...makeCard(clef, d, 0, key), weight: 0.5 })
  }
  return out
}

const landmarks = [
  makeCard('treble', 0, null),
  makeCard('treble', 4, null),
  makeCard('treble', 7, null),
  makeCard('bass', 0, null),
  makeCard('bass', -4, null),
  makeCard('bass', -7, null),
]
const aroundMiddle = [...range('treble', -2, 10), ...range('bass', -10, 2)]
const aroundMiddleFocus = ids([...range('treble', -2, 1), ...range('bass', -1, 2)])
const ledgers = [...range('treble', -2, 14), ...range('bass', -14, 2)]
const ledgersFocus = ids([...range('treble', 11, 14), ...range('bass', -14, -11)])
const accidentals = [...accidentalCards('treble', 2, 10), ...accidentalCards('bass', -10, -2)]
const withAccidentals = [...range('treble', 2, 10), ...range('bass', -10, -2), ...accidentals]
const KEY_LIST: KeyId[] = ['G', 'D', 'A', 'F', 'Bb', 'Eb']
const keyed = KEY_LIST.flatMap((k) => [...keyCards('treble', 2, 10, k), ...keyCards('bass', -10, -2, k)])
const keyedFocus = ids(keyed.filter((c) => c.shown === 0 || keyAlteration(c.key, letterAt(c.diatonic)) !== 0))

const RHYTHM_BASE: CellKind[] = ['q', 'h', 'w', 'h.']
const RHYTHM_EIGHTHS: CellKind[] = [...RHYTHM_BASE, 'ee', 'q.e']
const RHYTHM_RESTS: CellKind[] = ['q', 'h', 'w', 'h.', 'ee', 'q.e', 'rq', 'rh', 'rw']
const PHRASE_VOCAB: CellKind[] = ['q', 'h', 'h.', 'ee', 'q.e']

export const LEVELS: Level[] = [
  { kind: 'pitch', id: 'p1', title: 'Notes repères', subtitle: 'Do central, sol4, do5, fa3, do3', system: 'grand', cards: landmarks, focus: new Set() },
  { kind: 'pitch', id: 'p2', title: 'Clé de sol', subtitle: 'Les notes sur la portée, de mi4 à fa5', system: 'treble', cards: range('treble', 2, 10), focus: new Set() },
  { kind: 'pitch', id: 'p3', title: 'Clé de fa', subtitle: 'Les notes sur la portée, de sol2 à la3', system: 'bass', cards: range('bass', -10, -2), focus: new Set() },
  { kind: 'pitch', id: 'p4', title: 'Autour du do central', subtitle: 'Les deux clés mélangées et la zone entre les portées', system: 'grand', cards: aroundMiddle, focus: aroundMiddleFocus },
  { kind: 'pitch', id: 'p5', title: 'Lignes supplémentaires', subtitle: 'Vers le haut jusqu’au do6, vers le bas jusqu’au do2', system: 'grand', cards: ledgers, focus: ledgersFocus },
  { kind: 'pitch', id: 'p6', title: 'Altérations', subtitle: 'Dièses et bémols, donc les touches noires', system: 'grand', cards: withAccidentals, focus: ids(accidentals) },
  { kind: 'pitch', id: 'p7', title: 'Armures', subtitle: 'Une tonalité par série, jusqu’à trois dièses ou trois bémols', system: 'grand', cards: keyed, focus: keyedFocus, keys: KEY_LIST },
  { kind: 'rhythm', id: 'r1', title: 'Noires et blanches', subtitle: 'Noires, blanches, blanches pointées et rondes en 4/4', vocab: RHYTHM_BASE },
  { kind: 'rhythm', id: 'r2', title: 'Croches', subtitle: 'Croches par deux et noires pointées', vocab: RHYTHM_EIGHTHS },
  { kind: 'rhythm', id: 'r3', title: 'Silences', subtitle: 'Soupirs, demi-pauses et pauses au milieu des notes', vocab: RHYTHM_RESTS },
  { kind: 'phrase', id: 'f0', title: 'Cinq notes', subtitle: 'Do4 à sol4, noires, blanches et rondes, la main en place', clef: 'treble', range: [0, 4], vocab: RHYTHM_BASE },
  { kind: 'phrase', id: 'f1', title: 'Main droite', subtitle: 'Deux mesures en clé de sol, hauteurs et rythme', clef: 'treble', range: [0, 11], vocab: PHRASE_VOCAB },
  { kind: 'phrase', id: 'f2', title: 'Main gauche', subtitle: 'Deux mesures en clé de fa, hauteurs et rythme', clef: 'bass', range: [-9, 2], vocab: PHRASE_VOCAB },
]

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id)
}

function floorToC(midi: number): number {
  return Math.floor(midi / 12) * 12
}

function ceilToC(midi: number): number {
  return Math.ceil(midi / 12) * 12
}

export function pianoRange(level: Level): [number, number] {
  if (level.kind === 'pitch') {
    const midis = level.cards.map((c) => c.midi)
    return [floorToC(Math.min(...midis)), ceilToC(Math.max(...midis))]
  }
  if (level.kind === 'phrase') {
    return [floorToC(midiAt(level.range[0], 0)), ceilToC(midiAt(level.range[1], 0))]
  }
  return [60, 72]
}
