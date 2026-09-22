import { useMemo, type KeyboardEvent } from 'react'
import type { IScore, Prim } from '../score/layout'
import { layoutScore } from '../score/layout'

interface IStaffProps {
  score: IScore
  sp?: number
  states?: Record<number, string>
  labels?: Record<number, string>
  className?: string
  onTap?: (index: number) => void
}

export function Staff({ score, sp = 12, states = {}, labels = {}, className = '', onTap }: IStaffProps) {
  const layout = useMemo(() => layoutScore(score, sp), [score, sp])
  const hasLabels = Object.keys(labels).length > 0
  const lowest = layout.elements.reduce((acc, el) => Math.max(acc, el.y), layout.bottom)
  const labelY = Math.max(layout.bottom + 2.8 * sp, lowest + 2.4 * sp)
  const height = hasLabels ? Math.max(layout.height, labelY + 0.8 * sp) : layout.height
  return (
    <svg
      className={`staff ${className}`}
      viewBox={`0 0 ${layout.width} ${height}`}
      width={layout.width}
      height={height}
      aria-hidden={onTap ? undefined : true}
      role={onTap ? 'group' : undefined}
    >
      <g className="ink">
        {layout.statics.map((p, i) => (
          <PrimView key={i} p={p} sp={sp} />
        ))}
      </g>
      {layout.elements.map((el) => {
        const tap = onTap ? () => onTap(el.index) : undefined
        const onKey = tap
          ? (e: KeyboardEvent<SVGGElement>) => {
              if (e.key !== 'Enter' && e.key !== ' ') return
              e.preventDefault()
              tap()
            }
          : undefined
        return (
          <g
            key={el.index}
            className={`el ${states[el.index] ?? ''} ${tap ? 'tappable' : ''}`}
            onClick={tap}
            onKeyDown={onKey}
            role={tap ? 'button' : undefined}
            tabIndex={tap ? 0 : undefined}
            aria-label={tap ? (labels[el.index] ?? `Note ${el.index + 1}`) : undefined}
          >
            {tap && <rect className="hit" x={el.x - 0.6 * sp} y={el.y - 2.5 * sp} width={el.headW + 1.2 * sp} height={5 * sp} />}
            {el.prims.map((p, i) => (
              <PrimView key={i} p={p} sp={sp} />
            ))}
            {labels[el.index] !== undefined && (
              <text className="label" x={el.x + el.headW / 2} y={labelY} textAnchor="middle" fontSize={1.3 * sp}>
                {labels[el.index]}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}

function PrimView({ p, sp }: { p: Prim; sp: number }) {
  if (p.t === 'glyph') {
    if (p.scaleY !== undefined) {
      return (
        <text className="glyph" transform={`translate(${p.x} ${p.y}) scale(1 ${p.scaleY})`} fontSize={4 * sp}>
          {p.code}
        </text>
      )
    }
    return (
      <text className="glyph" x={p.x} y={p.y} fontSize={4 * sp}>
        {p.code}
      </text>
    )
  }
  if (p.t === 'line') return <line x1={p.x1} y1={p.y1} x2={p.x2} y2={p.y2} strokeWidth={p.w} />
  return <rect x={p.x} y={p.y} width={p.w} height={p.h} />
}
