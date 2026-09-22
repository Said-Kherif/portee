import { createHash } from 'node:crypto'
import { readdirSync } from 'node:fs'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

const SAMPLES_HOST = 'smpldsnds.github.io'

function serviceWorker(): Plugin {
  return {
    name: 'portee-service-worker',
    apply: 'build',
    generateBundle(_, bundle) {
      const fonts = readdirSync('public/fonts')
        .filter((f) => f.endsWith('.woff2'))
        .map((f) => `fonts/${f}`)
      const built = Object.keys(bundle).filter((f) => f !== 'sw.js')
      const precache = ['./', 'manifest.webmanifest', ...fonts, ...built]
      const hash = createHash('sha1')
      for (const name of built) {
        const item = bundle[name]
        hash.update(name)
        hash.update(item.type === 'chunk' ? item.code : item.source)
      }
      const version = hash.digest('hex').slice(0, 12)
      const source = `const VERSION = '${version}'
const CACHE = 'portee-' + VERSION
const SAMPLES = 'portee-samples'
const PRECACHE = ${JSON.stringify(precache)}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('portee-') && k !== CACHE && k !== SAMPLES).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

function cacheFirst(cacheName, request) {
  return caches.open(cacheName).then((cache) =>
    cache.match(request).then((hit) => {
      if (hit) return hit
      return fetch(request).then((response) => {
        if (response.ok) cache.put(request, response.clone())
        return response
      })
    }),
  )
}

self.addEventListener('fetch', (event) => {
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.hostname === '${SAMPLES_HOST}') {
    event.respondWith(cacheFirst(SAMPLES, request))
    return
  }
  if (url.origin !== self.location.origin) return
  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./').then((hit) => hit || fetch(request)))
    return
  }
  event.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request)))
})
`
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

export default defineConfig({
  base: './',
  plugins: [react(), serviceWorker()],
  server: { allowedHosts: ['.ngrok-free.app'] },
  preview: { allowedHosts: ['.ngrok-free.app'] },
})
