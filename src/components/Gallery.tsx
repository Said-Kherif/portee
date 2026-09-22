import type { IMeasure } from '../engine/rhythm'
import { assignLine, assignMelody, generateMeasures } from '../engine/rhythm'
import type { IScore } from '../score/layout'
import { Staff } from './Staff'

function single(system: IScore['system'], clef: 'treble' | 'bass', diatonic: number, shown: -1 | 0 | 1 | null = null, key: IScore['key'] = 'C'): IScore {
  return {
    system,
    key,
    timeSig: null,
    barlines: false,
    measures: [{ elements: [{ kind: 'note', value: 'q', dots: 0, beats: 1, start: 0, clef, diatonic, shown }] }],
  }
}

const allCells: IMeasure[] = assignLine([
  {
    elements: [
      { kind: 'note', value: 'q', dots: 0, beats: 1, start: 0 },
      { kind: 'note', value: 'e', dots: 0, beats: 0.5, start: 1, beam: 1 },
      { kind: 'note', value: 'e', dots: 0, beats: 0.5, start: 1.5, beam: 1 },
      { kind: 'note', value: 'q', dots: 1, beats: 1.5, start: 2 },
      { kind: 'note', value: 'e', dots: 0, beats: 0.5, start: 3.5 },
    ],
  },
  {
    elements: [
      { kind: 'rest', value: 'q', dots: 0, beats: 1, start: 0 },
      { kind: 'note', value: 'h', dots: 0, beats: 2, start: 1 },
      { kind: 'rest', value: 'h', dots: 0, beats: 2, start: 3 },
    ],
  },
  {
    elements: [
      { kind: 'note', value: 'h', dots: 1, beats: 3, start: 0 },
      { kind: 'note', value: 'q', dots: 0, beats: 1, start: 3 },
    ],
  },
  { elements: [{ kind: 'note', value: 'w', dots: 0, beats: 4, start: 0 }] },
])

const melody = assignMelody(generateMeasures(['q', 'h', 'ee', 'q.e'], 2), 'bass', -9, 2)
const melodyHigh = assignMelody(generateMeasures(['q', 'ee', 'q.e'], 2), 'treble', 6, 11)

export function Gallery() {
  return (
    <div className="screen">
      <main className="scroll gallery">
        <h2>Repères</h2>
        <Staff score={single('grand', 'treble', 0)} sp={14} />
        <Staff score={single('grand', 'bass', 0)} sp={14} />
        <h2>Extrêmes</h2>
        <Staff score={single('treble', 'treble', 14)} sp={14} />
        <Staff score={single('bass', 'bass', -14)} sp={14} />
        <Staff score={single('grand', 'treble', -2)} sp={14} />
        <h2>Altérations et armures</h2>
        <Staff score={single('grand', 'treble', 3, 1)} sp={14} />
        <Staff score={single('grand', 'bass', -8, -1)} sp={14} />
        <Staff score={single('grand', 'treble', 10, 0, 'A')} sp={14} />
        <Staff score={single('grand', 'bass', -5, null, 'Eb')} sp={14} />
        <h2>Rythme</h2>
        <Staff score={{ system: 'rhythm', key: 'C', timeSig: [4, 4], barlines: true, measures: allCells }} sp={12} states={{ 1: 'ok', 3: 'meh', 4: 'bad', 6: 'current' }} labels={{ 1: '+12', 3: '−140', 4: '—' }} />
        <h2>Phrases</h2>
        <Staff score={{ system: 'bass', key: 'C', timeSig: [4, 4], barlines: true, measures: melody }} sp={12} />
        <Staff score={{ system: 'treble', key: 'C', timeSig: [4, 4], barlines: true, measures: melodyHigh }} sp={12} />
      </main>
    </div>
  )
}
