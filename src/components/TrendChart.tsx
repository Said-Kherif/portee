import { useLayoutEffect, useRef, useState, type KeyboardEvent } from 'react'

export interface ITrendPoint {
  label: string
  value: number | null
}

interface ITrendChartProps {
  title: string
  subtitle: string
  points: ITrendPoint[]
  domain: [number, number]
  ticks: number[]
  goal: number
  format: (v: number) => string
  first: string
  last: string
}

const HEIGHT = 136
const TOP = 12
const RIGHT = 50
const BOTTOM = 24
const LEFT = 46
const TIP_W = 136
const TIP_H = 40

export function TrendChart({ title, subtitle, points, domain, ticks, goal, format, first, last }: ITrendChartProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(320)
  const [active, setActive] = useState<number | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = (): void => setWidth(Math.max(240, Math.floor(el.clientWidth)))
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const plotW = width - LEFT - RIGHT
  const plotH = HEIGHT - TOP - BOTTOM
  const base = TOP + plotH
  const [lo, hi] = domain
  const x = (i: number): number => LEFT + (points.length > 1 ? (i * plotW) / (points.length - 1) : plotW / 2)
  const y = (v: number): number => TOP + (1 - (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo)) * plotH
  const data = points.flatMap((p, i) => (p.value === null ? [] : [{ i, v: p.value }]))
  const runs: { i: number; v: number }[][] = []
  let run: { i: number; v: number }[] = []
  points.forEach((p, i) => {
    if (p.value === null) {
      if (run.length > 0) runs.push(run)
      run = []
      return
    }
    run.push({ i, v: p.value })
  })
  if (run.length > 0) runs.push(run)
  const end = data[data.length - 1]
  const lines = ticks.includes(goal) ? ticks : [...ticks, goal]

  const pick = (clientX: number): void => {
    const el = ref.current
    if (!el || data.length === 0) return
    const px = clientX - el.getBoundingClientRect().left
    let best = data[0].i
    for (const d of data) if (Math.abs(x(d.i) - px) < Math.abs(x(best) - px)) best = d.i
    setActive(best)
  }

  const onKey = (e: KeyboardEvent<HTMLDivElement>): void => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const order = data.map((d) => d.i)
    const at = active === null ? order.length - 1 : order.indexOf(active)
    setActive(order[e.key === 'ArrowLeft' ? Math.max(0, at - 1) : Math.min(order.length - 1, at + 1)])
  }

  const shown = active !== null && points[active].value !== null ? { i: active, v: points[active].value as number, label: points[active].label } : null
  const tipX = shown ? (x(shown.i) > LEFT + plotW / 2 ? x(shown.i) - 10 - TIP_W : x(shown.i) + 10) : 0

  return (
    <figure className="trend">
      <figcaption className="trend-head">
        <span className="trend-title">{title}</span>
        <span className="trend-sub">{subtitle}</span>
      </figcaption>
      <div
        ref={ref}
        className="trend-plot"
        tabIndex={0}
        role="group"
        aria-label={`${title}, flèches gauche et droite pour parcourir les semaines`}
        onPointerDown={(e) => pick(e.clientX)}
        onPointerMove={(e) => {
          if (e.pointerType === 'mouse' || e.buttons > 0) pick(e.clientX)
        }}
        onPointerLeave={(e) => {
          if (e.pointerType === 'mouse') setActive(null)
        }}
        onFocus={() => setActive(end ? end.i : null)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        <svg width={width} height={HEIGHT} viewBox={`0 0 ${width} ${HEIGHT}`} aria-hidden="true">
          {lines.map((t) => (
            <g key={t}>
              <line className={`trend-grid ${t === goal ? 'goal' : ''}`} x1={LEFT} x2={LEFT + plotW} y1={y(t)} y2={y(t)} />
              <text className="trend-tick" x={LEFT - 8} y={y(t) + 4} textAnchor="end">
                {format(t)}
              </text>
            </g>
          ))}
          {runs.map((r, k) =>
            r.length > 1 ? (
              <g key={k}>
                <path className="trend-area" d={`M${x(r[0].i)},${base} ${r.map((p) => `L${x(p.i)},${y(p.v)}`).join(' ')} L${x(r[r.length - 1].i)},${base} Z`} />
                <path className="trend-line" d={r.map((p, j) => `${j === 0 ? 'M' : 'L'}${x(p.i)},${y(p.v)}`).join(' ')} />
              </g>
            ) : null,
          )}
          {shown && <line className="trend-cross" x1={x(shown.i)} x2={x(shown.i)} y1={TOP} y2={base} />}
          {data.map((d) => (
            <circle key={d.i} className="trend-dot" cx={x(d.i)} cy={y(d.v)} r={4} />
          ))}
          {end && (
            <text className="trend-end" x={x(end.i) + 9} y={y(end.v) + 4}>
              {format(end.v)}
            </text>
          )}
          <text className="trend-axis" x={LEFT} y={HEIGHT - 6} textAnchor="start">
            {first}
          </text>
          <text className="trend-axis" x={LEFT + plotW} y={HEIGHT - 6} textAnchor="end">
            {last}
          </text>
          {shown && (
            <g className="trend-tip" transform={`translate(${tipX} ${TOP})`}>
              <rect width={TIP_W} height={TIP_H} rx={8} />
              <text className="v" x={10} y={17}>
                {format(shown.v)}
              </text>
              <text className="d" x={10} y={32}>
                {shown.label}
              </text>
            </g>
          )}
        </svg>
        <p className="sr-only" aria-live="polite">
          {shown ? `${shown.label} : ${format(shown.v)}` : ''}
        </p>
      </div>
    </figure>
  )
}
