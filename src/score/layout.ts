import type { Clef, KeyId } from '../engine/notes'
import { FLAT_POSITIONS, KEYS, MIDDLE_LINE, SHARP_POSITIONS } from '../engine/notes'
import type { IElement, IMeasure } from '../engine/rhythm'
import { G } from './glyphs'

export type ScoreSystem = 'treble' | 'bass' | 'grand' | 'rhythm'

export interface IScore {
  system: ScoreSystem
  key: KeyId
  timeSig: [number, number] | null
  measures: IMeasure[]
  barlines: boolean
  beatWidth?: number
}

export type Prim =
  | { t: 'glyph'; code: string; x: number; y: number; scaleY?: number }
  | { t: 'line'; x1: number; y1: number; x2: number; y2: number; w: number }
  | { t: 'rect'; x: number; y: number; w: number; h: number }

export interface IElementLayout {
  index: number
  x: number
  y: number
  headW: number
  prims: Prim[]
}

export interface ILayout {
  width: number
  height: number
  sp: number
  statics: Prim[]
  elements: IElementLayout[]
  bottom: number
}

interface IStaffPos {
  clef: Clef | null
  top: number
}

interface IBeamNote {
  el: IElementLayout
  x: number
  y: number
  headW: number
  d: number
  clef: Clef
}

const HEAD_W: Record<IElement['value'], number> = { w: 1.7, h: 1.18, q: 1.18, e: 1.18 }
const ACC_W: Record<'1' | '-1' | '0', number> = { '1': 1.0, '-1': 0.95, '0': 0.7 }
const STEM_LEN = 3.5
const STEM_W = 0.12
const BEAM_H = 0.5
const STAFF_LINE_W = 0.13
const LEDGER_W = 0.16
const BARLINE_W = 0.16
const THICK_BARLINE_W = 0.5

export function layoutScore(score: IScore, sp: number): ILayout {
  const statics: Prim[] = []
  const elements: IElementLayout[] = []
  const top = 5 * sp
  const gap = 6 * sp
  const staves: IStaffPos[] =
    score.system === 'grand'
      ? [
          { clef: 'treble', top },
          { clef: 'bass', top: top + 4 * sp + gap },
        ]
      : [{ clef: score.system === 'rhythm' ? null : score.system, top }]
  const bottom = staves[staves.length - 1].top + 4 * sp
  const clefOf = (s: IStaffPos): Clef => s.clef ?? 'treble'
  const yOf = (s: IStaffPos, d: number): number => s.top + 2 * sp - ((d - MIDDLE_LINE[clefOf(s)]) * sp) / 2
  const staffFor = (clef?: Clef): IStaffPos => staves.find((s) => s.clef === clef) ?? staves[0]
  const stemUp = (d: number, s: IStaffPos): boolean => score.system === 'rhythm' || d < MIDDLE_LINE[clefOf(s)]

  let x = 0.8 * sp
  if (score.system === 'grand') {
    statics.push({ t: 'glyph', code: G.brace, x: 0.3 * sp, y: bottom, scaleY: (bottom - top) / (4 * sp) })
    x = 2.4 * sp
  }
  const left = x

  for (const s of staves) {
    if (s.clef === 'treble') statics.push({ t: 'glyph', code: G.gClef, x, y: s.top + 3 * sp })
    else if (s.clef === 'bass') statics.push({ t: 'glyph', code: G.fClef, x, y: s.top + sp })
  }
  if (score.system !== 'rhythm') x += 3.6 * sp

  const k = KEYS[score.key]
  const count = k.sharps || k.flats
  if (count > 0) {
    const adv = (k.sharps > 0 ? 1.0 : 0.95) * sp
    for (const s of staves) {
      if (!s.clef) continue
      const positions = k.sharps > 0 ? SHARP_POSITIONS[s.clef] : FLAT_POSITIONS[s.clef]
      for (let i = 0; i < count; i++) {
        statics.push({ t: 'glyph', code: k.sharps > 0 ? G.sharp : G.flat, x: x + i * adv, y: yOf(s, positions[i]) })
      }
    }
    x += count * adv + 0.8 * sp
  }

  if (score.timeSig) {
    for (const s of staves) {
      statics.push({ t: 'glyph', code: G.timeSig(score.timeSig[0]), x, y: s.top + sp })
      statics.push({ t: 'glyph', code: G.timeSig(score.timeSig[1]), x, y: s.top + 3 * sp })
    }
    x += 2.6 * sp
  }
  x += 0.5 * sp

  const beatW = (score.beatWidth ?? 4.2) * sp
  const pad = 1.6 * sp
  let index = 0

  const ledgers = (prims: Prim[], s: IStaffPos, d: number, ex: number, headW: number): void => {
    const mid = MIDDLE_LINE[clefOf(s)]
    const x1 = ex - 0.4 * sp
    const x2 = ex + headW + 0.4 * sp
    for (let line = mid + 6; line <= d; line += 2) {
      prims.push({ t: 'line', x1, y1: yOf(s, line), x2, y2: yOf(s, line), w: LEDGER_W * sp })
    }
    for (let line = mid - 6; line >= d; line -= 2) {
      prims.push({ t: 'line', x1, y1: yOf(s, line), x2, y2: yOf(s, line), w: LEDGER_W * sp })
    }
  }

  const stem = (prims: Prim[], ex: number, y: number, headW: number, up: boolean, flag: boolean): void => {
    const w = STEM_W * sp
    if (up) {
      const sx = ex + headW - w / 2
      const y2 = y - STEM_LEN * sp
      prims.push({ t: 'line', x1: sx, y1: y - 0.17 * sp, x2: sx, y2, w })
      if (flag) prims.push({ t: 'glyph', code: G.flagUp, x: sx - w / 2, y: y2 })
    } else {
      const sx = ex + w / 2
      const y2 = y + STEM_LEN * sp
      prims.push({ t: 'line', x1: sx, y1: y + 0.17 * sp, x2: sx, y2, w })
      if (flag) prims.push({ t: 'glyph', code: G.flagDown, x: sx - w / 2, y: y2 })
    }
  }

  score.measures.forEach((m, mi) => {
    const beats = score.timeSig ? score.timeSig[0] : Math.max(1, ...m.elements.map((e) => e.start + e.beats))
    const mX = x
    const groups = new Map<number, IBeamNote[]>()

    for (const e of m.elements) {
      const ex = e.kind === 'rest' && e.value === 'w' ? mX + pad + (beats * beatW) / 2 - 0.56 * sp : mX + pad + e.start * beatW
      const s = staffFor(e.clef)
      const prims: Prim[] = []
      let y: number
      if (e.kind === 'rest') {
        y = s.top + (e.value === 'w' ? sp : 2 * sp)
        prims.push({ t: 'glyph', code: G.rest[e.value], x: ex, y })
        if (e.dots) prims.push({ t: 'glyph', code: G.dot, x: ex + 1.3 * sp, y: s.top + 1.5 * sp })
      } else {
        const d = e.diatonic ?? MIDDLE_LINE[clefOf(s)]
        y = yOf(s, d)
        const headW = HEAD_W[e.value] * sp
        ledgers(prims, s, d, ex, headW)
        if (e.shown != null) {
          const code = e.shown === 1 ? G.sharp : e.shown === -1 ? G.flat : G.natural
          prims.push({ t: 'glyph', code, x: ex - (ACC_W[String(e.shown) as '1' | '-1' | '0'] + 0.25) * sp, y })
        }
        prims.push({ t: 'glyph', code: G.head[e.value], x: ex, y })
        if (e.dots) prims.push({ t: 'glyph', code: G.dot, x: ex + headW + 0.4 * sp, y: d % 2 === 0 ? y - 0.5 * sp : y })
        const el: IElementLayout = { index, x: ex, y, headW, prims }
        if (e.value !== 'w') {
          if (e.beam != null) {
            const g = groups.get(e.beam) ?? []
            g.push({ el, x: ex, y, headW, d, clef: clefOf(s) })
            groups.set(e.beam, g)
          } else {
            stem(prims, ex, y, headW, stemUp(d, s), e.value === 'e')
          }
        }
        elements.push(el)
        index++
        continue
      }
      elements.push({ index, x: ex, y, headW: 1.2 * sp, prims })
      index++
    }

    for (const g of groups.values()) {
      const avg = g.reduce((a, n) => a + n.d, 0) / g.length
      const up = score.system === 'rhythm' || avg < MIDDLE_LINE[g[0].clef]
      const w = STEM_W * sp
      const beamY = up ? Math.min(...g.map((n) => n.y)) - STEM_LEN * sp : Math.max(...g.map((n) => n.y)) + STEM_LEN * sp
      const stemXs = g.map((n) => (up ? n.x + n.headW - w / 2 : n.x + w / 2))
      g.forEach((n, i) => {
        n.el.prims.push({ t: 'line', x1: stemXs[i], y1: up ? n.y - 0.17 * sp : n.y + 0.17 * sp, x2: stemXs[i], y2: beamY, w })
      })
      g[0].el.prims.push({
        t: 'rect',
        x: stemXs[0] - w / 2,
        y: up ? beamY : beamY - BEAM_H * sp,
        w: stemXs[stemXs.length - 1] - stemXs[0] + w,
        h: BEAM_H * sp,
      })
    }

    x = mX + pad + beats * beatW + 0.6 * sp
    if (score.barlines) {
      const last = mi === score.measures.length - 1
      statics.push({ t: 'line', x1: x, y1: top, x2: x, y2: bottom, w: BARLINE_W * sp })
      if (last) {
        statics.push({ t: 'rect', x: x + 0.45 * sp, y: top, w: THICK_BARLINE_W * sp, h: bottom - top })
        x += 1.0 * sp
      }
      x += 0.8 * sp
    } else {
      x += 2.2 * sp
    }
  })

  const width = x + 0.4 * sp
  for (const s of staves) {
    for (let i = 0; i < 5; i++) {
      statics.push({ t: 'line', x1: left, y1: s.top + i * sp, x2: width - 0.4 * sp, y2: s.top + i * sp, w: STAFF_LINE_W * sp })
    }
  }
  if (score.system === 'grand') statics.push({ t: 'line', x1: left, y1: top, x2: left, y2: bottom, w: BARLINE_W * sp })

  return { width, height: bottom + 4 * sp, sp, statics, elements, bottom }
}
