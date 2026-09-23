import { useMemo, useState } from 'react'
import { percent, seconds } from '../engine/format'
import type { Level } from '../engine/levels'
import { levelById, LEVELS, levelTitle, REVIEW_ID } from '../engine/levels'
import type { Clef } from '../engine/notes'
import { cardFromId, cardName, noteName } from '../engine/notes'
import type { IProgress } from '../engine/progress'
import { isStreakAlive } from '../engine/progress'
import { PASS_ACCURACY, PASS_RT, weightOf } from '../engine/scheduler'
import type { IElement } from '../engine/rhythm'
import { readingWeeks } from '../engine/trend'
import type { IScore } from '../score/layout'
import { IconBack, IconForward } from './Icons'
import { Staff } from './Staff'
import { TrendChart } from './TrendChart'

interface IStatsProps {
  progress: IProgress
  onExit: () => void
  onSelect: (level: Level) => void
}

interface IAgg {
  clef: Clef
  diatonic: number
  n: number
  errors: number
  errSum: number
  rtSum: number
}

function heatClass(a: IAgg): string {
  const err = a.errSum / a.n
  const rt = a.rtSum / a.n
  let level = err < 0.12 ? 0 : err < 0.3 ? 1 : err < 0.55 ? 2 : 3
  if (rt > 2000 && level < 3) level++
  return `heat-${level}`
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function formatDay(ts: number): string {
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })
}

function timeDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  const top = Math.max(2000, Math.ceil((Math.max(...values) + 250) / 500) * 500)
  const step = top <= 3000 ? 1000 : 2000
  const ticks: number[] = []
  for (let t = 0; t <= top; t += step) ticks.push(t)
  return { domain: [0, top], ticks }
}

function accuracyDomain(values: number[]): { domain: [number, number]; ticks: number[] } {
  const low = Math.max(0, Math.min(0.8, Math.floor((Math.min(...values) - 0.02) * 10) / 10))
  const ticks: number[] = []
  const step = 1 - low <= 0.3 ? 0.1 : 0.2
  for (let t = 1; t >= low - 1e-9; t = Math.round((t - step) * 100) / 100) ticks.push(t)
  return { domain: [low, 1], ticks }
}

export function Stats({ progress, onExit, onSelect }: IStatsProps) {
  const notation = progress.settings.notation

  const aggs = useMemo(() => {
    const map = new Map<string, IAgg>()
    for (const [id, s] of Object.entries(progress.cards)) {
      const card = cardFromId(id)
      if (!card || s.n === 0) continue
      const key = `${card.clef}:${card.diatonic}`
      const a = map.get(key) ?? { clef: card.clef, diatonic: card.diatonic, n: 0, errors: 0, errSum: 0, rtSum: 0 }
      a.n += s.n
      a.errors += s.errors
      a.errSum += s.err * s.n
      a.rtSum += s.rt * s.n
      map.set(key, a)
    }
    return [...map.values()].sort((a, b) => (a.clef === b.clef ? a.diatonic - b.diatonic : a.clef === 'bass' ? -1 : 1))
  }, [progress.cards])

  const heat = useMemo<{ score: IScore; states: Record<number, string> } | null>(() => {
    if (aggs.length === 0) return null
    const elements: IElement[] = aggs.map((a, i) => ({ kind: 'note', value: 'w', dots: 0, beats: 1, start: i, clef: a.clef, diatonic: a.diatonic, shown: null }))
    const states: Record<number, string> = {}
    aggs.forEach((a, i) => {
      states[i] = heatClass(a)
    })
    return { score: { system: 'grand', key: 'C', timeSig: null, barlines: false, beatWidth: 2.6, measures: [{ elements }] }, states }
  }, [aggs])

  const weak = useMemo(() => {
    const now = Date.now()
    return Object.entries(progress.cards)
      .filter(([, s]) => s.n > 0)
      .map(([id, s]) => ({ id, s, w: weightOf(s, false, now) }))
      .sort((a, b) => b.w - a.w)
      .slice(0, 6)
      .map((x) => ({ ...x, card: cardFromId(x.id) }))
  }, [progress.cards])

  const [table, setTable] = useState(false)
  const weeks = useMemo(() => readingWeeks(progress), [progress])
  const accuracies = weeks.flatMap((w) => (w.accuracy === null ? [] : [w.accuracy]))
  const times = weeks.flatMap((w) => (w.time === null ? [] : [w.time]))
  const weekLabel = (start: number): string => `semaine du ${formatDay(start)}`
  const sessions = [...progress.sessions].reverse().slice(0, 8)
  const streak = isStreakAlive(progress.streak) ? progress.streak.count : 0
  const totalAnswers = Object.values(progress.cards).reduce((a, s) => a + s.n, 0)

  return (
    <div className="screen stats">
      <header className="bar">
        <button className="link" onClick={onExit}>
          <IconBack />
          Retour
        </button>
        <div className="bar-title">Stats</div>
        <div className="bar-meta" />
      </header>
      <main className="scroll">
        <div className="stat-row">
          <div className="stat">
            <div className="stat-value">{totalAnswers}</div>
            <div className="stat-label">notes lues</div>
          </div>
          <div className="stat">
            <div className="stat-value">{streak}</div>
            <div className="stat-label">jours d’affilée</div>
          </div>
          <div className="stat">
            <div className="stat-value">{progress.sessions.length}</div>
            <div className="stat-label">séries</div>
          </div>
        </div>
        <h2>Progression en lecture</h2>
        {accuracies.length >= 2 ? (
          <>
            <TrendChart
              title="Justesse"
              subtitle={`Moyenne par semaine, objectif ${percent(PASS_ACCURACY)}`}
              points={weeks.map((w) => ({ label: weekLabel(w.start), value: w.accuracy }))}
              {...accuracyDomain(accuracies)}
              goal={PASS_ACCURACY}
              format={percent}
              first={formatDay(weeks[0].start)}
              last="cette semaine"
            />
            {times.length >= 2 && (
              <TrendChart
                title="Temps médian"
                subtitle={`Par semaine, objectif sous ${seconds(PASS_RT)}`}
                points={weeks.map((w) => ({ label: weekLabel(w.start), value: w.time }))}
                {...timeDomain(times)}
                goal={PASS_RT}
                format={(v) => seconds(v)}
                first={formatDay(weeks[0].start)}
                last="cette semaine"
              />
            )}
            <button className="link table-toggle" onClick={() => setTable(!table)}>
              {table ? 'Masquer le tableau' : 'Voir le tableau'}
            </button>
            {table && (
              <table className="trend-table">
                <thead>
                  <tr>
                    <th scope="col">Semaine du</th>
                    <th scope="col">Séries</th>
                    <th scope="col">Justesse</th>
                    <th scope="col">Temps médian</th>
                  </tr>
                </thead>
                <tbody>
                  {[...weeks].reverse().map((w) => (
                    <tr key={w.start}>
                      <th scope="row">{formatDay(w.start)}</th>
                      <td>{w.sessions}</td>
                      <td>{w.accuracy === null ? '—' : percent(w.accuracy)}</td>
                      <td>{w.time === null ? '—' : seconds(w.time)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        ) : (
          <p className="muted">La courbe apparaît après deux semaines de séries de lecture.</p>
        )}
        <h2>Carte des notes</h2>
        {heat ? (
          <>
            <Staff score={heat.score} sp={10} states={heat.states} className="heat" />
            <div className="legend">
              <span className="legend-item heat-0">sûre</span>
              <span className="legend-item heat-1">correcte</span>
              <span className="legend-item heat-2">hésitante</span>
              <span className="legend-item heat-3">à revoir</span>
            </div>
          </>
        ) : (
          <p className="muted">Fais une première série pour voir tes notes ici.</p>
        )}
        {weak.length > 0 && (
          <>
            <h2>À travailler</h2>
            <ul className="weak">
              {weak.map((x) => {
                const target = LEVELS.find((l) => l.kind === 'pitch' && !l.ear && l.cards.some((c) => c.id === x.id))
                const body = (
                  <>
                    <span>
                      {x.card ? cardName(x.card, notation) : x.id}
                      <span className="muted small"> · {x.card ? (x.card.clef === 'treble' ? 'clé de sol' : 'clé de fa') : ''}</span>
                    </span>
                    <span className="muted">
                      {percent(x.s.errors / x.s.n)} d’erreurs · {seconds(x.s.rt)}
                    </span>
                  </>
                )
                return (
                  <li key={x.id} className={target ? 'tappable' : ''}>
                    {target ? (
                      <button className="row-button" onClick={() => onSelect(target)}>
                        {body}
                        <IconForward />
                      </button>
                    ) : (
                      body
                    )}
                  </li>
                )
              })}
            </ul>
          </>
        )}
        {sessions.length > 0 && (
          <>
            <h2>Dernières séries</h2>
            <ul className="sessions">
              {sessions.map((s, i) => {
                const timed = s.level === REVIEW_ID || levelById(s.level)?.kind === 'pitch'
                return (
                  <li key={`${s.date}-${i}`}>
                    <span>
                      <span className="session-level">{levelTitle(s.level)}</span>
                      <span className="muted small"> · {formatDate(s.date)}</span>
                    </span>
                    <span className="muted">
                      {percent(s.accuracy)}
                      {timed ? ` · ${seconds(s.medianRt)}` : ''}
                    </span>
                  </li>
                )
              })}
            </ul>
          </>
        )}
        <p className="muted small">
          {aggs.length > 0 ? `Note la plus travaillée : ${noteName(aggs.reduce((a, b) => (b.n > a.n ? b : a)).diatonic, 0, notation)}.` : ''}
        </p>
      </main>
    </div>
  )
}
