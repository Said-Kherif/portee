const input = { name: 'Piano test USB', onmidimessage: null }
const access = { inputs: new Map([['in1', input]]), onstatechange: null }
navigator.requestMIDIAccess = () => Promise.resolve(access)
navigator.permissions.query = (d) => Promise.resolve({ state: d.name === 'midi' ? 'granted' : 'prompt' })
window.__midi = (status, note, vel) => { if (input.onmidimessage) input.onmidimessage({ data: new Uint8Array([status, note, vel]) }); return !!input.onmidimessage }
