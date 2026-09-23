import type { Clef, ICard, KeyId } from './notes'
import { cardFromId, keyAlteration, letterAt, makeCard, midiAt } from './notes'
import type { IProgress } from './progress'
import { dayKey } from './progress'
import type { CellKind, HandsMode } from './rhythm'
import { EAR_PASS_RT, SESSION_LENGTH } from './scheduler'

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
  length?: number
  passRt?: number
  ear?: boolean
  timed?: number
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
  hands?: { mode: HandsMode; bass: [number, number] }
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
const earChord = [makeCard('treble', 0, null), makeCard('treble', 2, null), makeCard('treble', 4, null), makeCard('treble', 7, null)]
const earScale = range('treble', 0, 7)

const RHYTHM_BASE: CellKind[] = ['q', 'h', 'w', 'h.']
const RHYTHM_EIGHTHS: CellKind[] = [...RHYTHM_BASE, 'ee', 'q.e']
const RHYTHM_RESTS: CellKind[] = ['q', 'h', 'w', 'h.', 'ee', 'q.e', 'rq', 'rh', 'rw']
const PHRASE_VOCAB: CellKind[] = ['q', 'h', 'h.', 'ee', 'q.e']
const RIGHT_HAND: [number, number] = [0, 4]
const LEFT_HAND: [number, number] = [-7, -3]

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
  { kind: 'phrase', id: 'f0', title: 'Cinq notes', subtitle: 'Do4 à sol4, noires, blanches et rondes, la main en place', clef: 'treble', range: RIGHT_HAND, vocab: RHYTHM_BASE },
  { kind: 'phrase', id: 'f1', title: 'Main droite', subtitle: 'Deux mesures en clé de sol, hauteurs et rythme', clef: 'treble', range: [0, 11], vocab: PHRASE_VOCAB },
  { kind: 'phrase', id: 'f2', title: 'Main gauche', subtitle: 'Deux mesures en clé de fa, hauteurs et rythme', clef: 'bass', range: [-9, 2], vocab: PHRASE_VOCAB },
  { kind: 'phrase', id: 'f3', title: 'Une main puis l’autre', subtitle: 'Grande portée, une mesure pour chaque main', clef: 'treble', range: RIGHT_HAND, vocab: RHYTHM_BASE, hands: { mode: 'alternate', bass: LEFT_HAND } },
  { kind: 'phrase', id: 'f4', title: 'Les deux mains ensemble', subtitle: 'Une ronde à gauche sous la mélodie de droite', clef: 'treble', range: RIGHT_HAND, vocab: RHYTHM_BASE, hands: { mode: 'together', bass: LEFT_HAND } },
  { kind: 'pitch', id: 'e1', title: 'L’accord de do', subtitle: 'Do, mi, sol et do aigu, après le do de repère', system: 'treble', cards: earChord, focus: new Set(), passRt: EAR_PASS_RT, ear: true },
  { kind: 'pitch', id: 'e2', title: 'La gamme de do', subtitle: 'Les huit notes du do4 au do5, après le do de repère', system: 'treble', cards: earScale, focus: new Set(), passRt: EAR_PASS_RT, ear: true },
]

export const REVIEW_ID = 'review'
export const REVIEW_MIN_CARDS = 8
export const CHRONO_ID = 'chrono'
export const CHRONO_SECONDS = 60

export interface IWorld {
  id: string
  title: string
  levels: Level[]
}

export const WORLDS: IWorld[] = [
  { id: 'lecture', title: 'Lecture', levels: LEVELS.filter((l) => l.kind === 'pitch' && !l.ear) },
  { id: 'rythme', title: 'Rythme', levels: LEVELS.filter((l) => l.kind === 'rhythm') },
  { id: 'phrases', title: 'Phrases', levels: LEVELS.filter((l) => l.kind === 'phrase') },
  { id: 'oreille', title: 'Oreille', levels: LEVELS.filter((l) => l.kind === 'pitch' && !!l.ear) },
]

export function levelById(id: string): Level | undefined {
  return LEVELS.find((l) => l.id === id)
}

export function levelTitle(id: string): string {
  if (id === REVIEW_ID) return 'Révision du jour'
  if (id === CHRONO_ID) return 'Défi chrono'
  return levelById(id)?.title ?? id
}

export function isReading(id: string): boolean {
  if (id === REVIEW_ID) return true
  const level = levelById(id)
  return level?.kind === 'pitch' && !level.ear
}

function seeded(text: string): number {
  let h = 2166136261
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

export function reviewLevel(progress: IProgress, today = dayKey()): IPitchLevel | null {
  const byKey = new Map<KeyId, ICard[]>()
  for (const [id, stat] of Object.entries(progress.cards)) {
    if (stat.n === 0) continue
    const card = cardFromId(id)
    if (!card) continue
    const list = byKey.get(card.key) ?? []
    list.push(card.shown === 0 ? { ...card, weight: 0.5 } : card)
    byKey.set(card.key, list)
  }
  const eligible = [...byKey.entries()].filter(([, cards]) => cards.length >= REVIEW_MIN_CARDS).sort(([a], [b]) => a.localeCompare(b))
  if (eligible.length === 0) return null
  const total = eligible.reduce((a, [, cards]) => a + cards.length, 0)
  let draw = seeded(today) * total
  let chosen = eligible[eligible.length - 1]
  for (const entry of eligible) {
    draw -= entry[1].length
    if (draw < 0) {
      chosen = entry
      break
    }
  }
  const [key, cards] = chosen
  return {
    kind: 'pitch',
    id: REVIEW_ID,
    title: 'Révision du jour',
    subtitle: 'Les notes déjà vues, les plus fragiles plus souvent',
    system: 'grand',
    cards,
    focus: new Set(),
    length: SESSION_LENGTH,
    keys: key === 'C' ? undefined : [key],
  }
}

export function chronoLevel(progress: IProgress): IPitchLevel {
  const seen = new Map<string, ICard>()
  for (const [id, stat] of Object.entries(progress.cards)) {
    if (stat.n === 0) continue
    const card = cardFromId(id)
    if (card && card.key === 'C' && card.shown === null) seen.set(card.id, card)
  }
  const pool = seen.size >= REVIEW_MIN_CARDS ? [...seen.values()] : [...new Map([...landmarks, ...range('treble', 2, 10)].map((c) => [c.id, c])).values()]
  return {
    kind: 'pitch',
    id: CHRONO_ID,
    title: 'Défi chrono',
    subtitle: 'Soixante secondes, un maximum de notes',
    system: 'grand',
    cards: pool,
    focus: new Set(),
    length: 999,
    timed: CHRONO_SECONDS,
  }
}

export function reviewedToday(progress: IProgress): boolean {
  const today = dayKey()
  return progress.sessions.some((s) => s.level === REVIEW_ID && dayKey(new Date(s.date)) === today)
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
    if (level.hands) return [midiAt(level.hands.bass[0], 0), midiAt(level.range[1], 0)]
    return [floorToC(midiAt(level.range[0], 0)), ceilToC(midiAt(level.range[1], 0))]
  }
  return [60, 72]
}
