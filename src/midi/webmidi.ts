import { useCallback, useEffect, useRef, useState } from 'react'

type Handler = (midi: number) => void
export type MidiStatus = 'unsupported' | 'off' | 'requesting' | 'on' | 'denied'

interface IMidiInput {
  name: string | null
  onmidimessage: ((e: { data: Uint8Array | null }) => void) | null
}

interface IMidiAccess {
  inputs: Map<string, IMidiInput>
  onstatechange: (() => void) | null
}

interface IMidiNavigator {
  requestMIDIAccess?: () => Promise<IMidiAccess>
  permissions?: { query: (d: { name: string }) => Promise<{ state: string }> }
}

export interface IMidi {
  status: MidiStatus
  inputs: string[]
  connect: () => void
}

export function useMidi(onNoteOn: Handler, onNoteOff: Handler): IMidi {
  const onRef = useRef(onNoteOn)
  const offRef = useRef(onNoteOff)
  onRef.current = onNoteOn
  offRef.current = onNoteOff
  const nav = navigator as unknown as IMidiNavigator
  const supported = typeof nav.requestMIDIAccess === 'function'
  const [wanted, setWanted] = useState(false)
  const [status, setStatus] = useState<MidiStatus>(supported ? 'off' : 'unsupported')
  const [inputs, setInputs] = useState<string[]>([])

  useEffect(() => {
    if (!supported || !nav.permissions) return
    let cancelled = false
    nav.permissions
      .query({ name: 'midi' })
      .then((p) => {
        if (!cancelled && p.state === 'granted') setWanted(true)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [supported, nav.permissions])

  useEffect(() => {
    if (!supported || !wanted || !nav.requestMIDIAccess) return
    let access: IMidiAccess | null = null
    let cancelled = false
    const handle = (e: { data: Uint8Array | null }): void => {
      const d = e.data
      if (!d || d.length < 3) return
      const command = d[0] & 0xf0
      if (command === 0x90 && d[2] > 0) onRef.current(d[1])
      else if (command === 0x80 || (command === 0x90 && d[2] === 0)) offRef.current(d[1])
    }
    const bind = (): void => {
      if (!access) return
      const names: string[] = []
      access.inputs.forEach((input) => {
        input.onmidimessage = handle
        names.push(input.name ?? 'MIDI')
      })
      setInputs(names)
    }
    setStatus('requesting')
    nav
      .requestMIDIAccess()
      .then((a) => {
        if (cancelled) return
        access = a
        bind()
        a.onstatechange = bind
        setStatus('on')
      })
      .catch(() => {
        if (!cancelled) setStatus('denied')
      })
    return () => {
      cancelled = true
      if (access) {
        access.onstatechange = null
        access.inputs.forEach((input) => {
          input.onmidimessage = null
        })
      }
    }
  }, [supported, wanted, nav])

  const connect = useCallback(() => setWanted(true), [])

  return { status, inputs, connect }
}
