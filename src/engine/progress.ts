import { useCallback, useState } from 'react'
import type { Notation } from './notes'
import type { IAnswer, ICardStat } from './scheduler'

export interface ISettings {
  notation: Notation
  keyLabels: 'auto' | 'on' | 'off'
  bpm: number
}

export interface ISession {
  date: number
  level: string
  accuracy: number
  medianRt: number
}

export interface IProgress {
  version: 1
  cards: Record<string, ICardStat>
  history: Record<string, IAnswer[]>
  scores: Record<string, number[]>
  sessions: ISession[]
  streak: { lastDay: string; count: number }
  settings: ISettings
  lessonsSeen: string[]
  onboarded: boolean
}

const KEY = 'portee.v1'
const MAX_SESSIONS = 200
const MAX_SCORES = 10

export function defaultProgress(): IProgress {
  return {
    version: 1,
    cards: {},
    history: {},
    scores: {},
    sessions: [],
    streak: { lastDay: '', count: 0 },
    settings: { notation: 'fr', keyLabels: 'auto', bpm: 70 },
    lessonsSeen: [],
    onboarded: false,
  }
}

export function loadProgress(): IProgress {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<IProgress>
      const base = defaultProgress()
      return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } }
    }
  } catch {
    return defaultProgress()
  }
  return defaultProgress()
}

export function saveProgress(p: IProgress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(p))
  } catch {
    return
  }
}

export function useProgress(): [IProgress, (fn: (p: IProgress) => IProgress) => void] {
  const [progress, setProgress] = useState<IProgress>(loadProgress)
  const update = useCallback((fn: (p: IProgress) => IProgress) => {
    setProgress((prev) => {
      const next = fn(prev)
      saveProgress(next)
      return next
    })
  }, [])
  return [progress, update]
}

export function dayKey(date = new Date()): string {
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${m}-${d}`
}

export function bumpStreak(streak: IProgress['streak']): IProgress['streak'] {
  const today = dayKey()
  if (streak.lastDay === today) return streak
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  return { lastDay: today, count: streak.lastDay === yesterday ? streak.count + 1 : 1 }
}

export function isStreakAlive(streak: IProgress['streak']): boolean {
  const today = dayKey()
  const yesterday = dayKey(new Date(Date.now() - 86400000))
  return streak.lastDay === today || streak.lastDay === yesterday
}

export function recordSession(p: IProgress, session: ISession): IProgress {
  return { ...p, sessions: [...p.sessions, session].slice(-MAX_SESSIONS), streak: bumpStreak(p.streak) }
}

export function recordScore(p: IProgress, levelId: string, score: number): IProgress {
  const list = [...(p.scores[levelId] ?? []), score].slice(-MAX_SCORES)
  return { ...p, scores: { ...p.scores, [levelId]: list } }
}

export function exportProgress(p: IProgress): string {
  return JSON.stringify(p, null, 2)
}

export function importProgress(json: string): IProgress | null {
  try {
    const parsed = JSON.parse(json) as Partial<IProgress>
    if (!parsed || typeof parsed !== 'object' || parsed.version !== 1) return null
    const base = defaultProgress()
    return { ...base, ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } }
  } catch {
    return null
  }
}
