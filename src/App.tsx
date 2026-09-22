import { useEffect, useState } from 'react'
import { preloadAudio, unlockAudio } from './audio/piano'
import { Drill } from './components/Drill'
import { Exercise } from './components/Exercise'
import { Home } from './components/Home'
import { Lesson } from './components/Lesson'
import { Settings } from './components/Settings'
import { Stats } from './components/Stats'
import { Gallery } from './components/Gallery'
import type { Level } from './engine/levels'
import { lessonFor } from './engine/lessons'
import { levelById } from './engine/levels'
import { useProgress } from './engine/progress'
import { emitNoteOff, emitNoteOn } from './midi/bus'
import { useMidi } from './midi/webmidi'

type View = { name: 'home' } | { name: 'level'; level: Level } | { name: 'lesson'; level: Level } | { name: 'stats' } | { name: 'settings' } | { name: 'gallery' }

function viewFromHash(): View {
  const hash = window.location.hash.replace('#', '')
  if (hash === 'stats' || hash === 'settings' || hash === 'gallery') return { name: hash }
  const [id, sub] = hash.split('/')
  const level = levelById(id)
  if (!level) return { name: 'home' }
  return sub === 'lecon' ? { name: 'lesson', level } : { name: 'level', level }
}

function hashOf(view: View): string {
  if (view.name === 'home') return ''
  if (view.name === 'level') return view.level.id
  if (view.name === 'lesson') return `${view.level.id}/lecon`
  return view.name
}

export function App() {
  const [progress, update] = useProgress()
  const [view, setView] = useState<View>(viewFromHash)
  const [fontReady, setFontReady] = useState(false)
  const midi = useMidi(emitNoteOn, emitNoteOff)

  useEffect(() => {
    let done = false
    const ready = (): void => {
      if (done) return
      done = true
      setFontReady(true)
    }
    document.fonts.load('40px Bravura').then(ready).catch(ready)
    const t = window.setTimeout(ready, 2500)
    return () => window.clearTimeout(t)
  }, [])

  useEffect(() => {
    preloadAudio()
    const unlock = (): void => unlockAudio()
    const events = ['pointerdown', 'touchend', 'click', 'keydown']
    for (const name of events) window.addEventListener(name, unlock, { once: true })
    return () => {
      for (const name of events) window.removeEventListener(name, unlock)
    }
  }, [])

  useEffect(() => {
    const target = hashOf(view)
    if (window.location.hash.replace('#', '') !== target) {
      window.history.pushState(null, '', target ? `#${target}` : window.location.pathname)
    }
  }, [view])

  useEffect(() => {
    const onHash = (): void => setView(viewFromHash())
    window.addEventListener('popstate', onHash)
    window.addEventListener('hashchange', onHash)
    return () => {
      window.removeEventListener('popstate', onHash)
      window.removeEventListener('hashchange', onHash)
    }
  }, [])

  const home = (): void => setView({ name: 'home' })
  const openLevel = (level: Level): void => setView({ name: 'level', level })
  const openLesson = (level: Level): void => setView({ name: 'lesson', level })
  const select = (level: Level): void => {
    if (lessonFor(level.id) && !progress.lessonsSeen.includes(level.id)) openLesson(level)
    else openLevel(level)
  }
  const currentLesson = view.name === 'lesson' ? lessonFor(view.level.id) : undefined

  if (!fontReady) return <div className="app" />

  return (
    <div className="app">
      {view.name === 'home' && (
        <Home
          progress={progress}
          onSelect={select}
          onLesson={openLesson}
          onStats={() => setView({ name: 'stats' })}
          onSettings={() => setView({ name: 'settings' })}
        />
      )}
      {view.name === 'lesson' && currentLesson && (
        <Lesson
          key={view.level.id}
          level={view.level}
          lesson={currentLesson}
          progress={progress}
          update={update}
          onStart={() => openLevel(view.level)}
          onExit={home}
        />
      )}
      {view.name === 'lesson' && !currentLesson && <Home progress={progress} onSelect={select} onLesson={openLesson} onStats={() => setView({ name: 'stats' })} onSettings={() => setView({ name: 'settings' })} />}
      {view.name === 'level' && view.level.kind === 'pitch' && (
        <Drill key={view.level.id} level={view.level} progress={progress} update={update} onExit={home} onLesson={() => openLesson(view.level)} />
      )}
      {view.name === 'level' && view.level.kind !== 'pitch' && (
        <Exercise key={view.level.id} level={view.level} progress={progress} update={update} onExit={home} onLesson={() => openLesson(view.level)} />
      )}
      {view.name === 'stats' && <Stats progress={progress} onExit={home} />}
      {view.name === 'gallery' && <Gallery />}
      {view.name === 'settings' && (
        <Settings progress={progress} update={update} midi={midi} onExit={home} />
      )}
    </div>
  )
}
