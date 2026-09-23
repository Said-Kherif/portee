import { spawn } from 'node:child_process'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [major] = process.versions.node.split('.').map(Number)
if (major < 22) {
  console.error(`Node ${process.versions.node} détecté, il faut Node 22 ou plus (nvm use).`)
  process.exit(1)
}
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const url = process.argv[2] ?? 'http://localhost:4173/'
const LEVEL = 'p2'
const port = 9300 + Math.floor(Math.random() * 500)
const profile = mkdtempSync(join(tmpdir(), 'cdp-'))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-timer-throttling', '--disable-renderer-backgrounding', '--autoplay-policy=no-user-gesture-required', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let target = null
for (let i = 0; i < 150 && !target; i++) {
  await sleep(200)
  try {
    target = await (await fetch(`http://localhost:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  } catch {}
}
if (!target) { console.error('no target'); chrome.kill(); process.exit(1) }
const ws = new WebSocket(target.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pending = new Map()
ws.onmessage = (m) => {
  const msg = JSON.parse(m.data)
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id) }
}
const send = (method, params = {}) => new Promise((resolve) => { const i = ++id; pending.set(i, resolve); ws.send(JSON.stringify({ id: i, method, params })) })
const evaluate = async (expression) => (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result?.result?.value
await send('Runtime.enable'); await send('Page.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
await send('Emulation.setTouchEmulationEnabled', { enabled: true })
await send('Page.navigate', { url })
await sleep(2500)

const center = (sel) => evaluate(`(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) return null; el.scrollIntoView({ inline: 'center', block: 'nearest' }); const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 } })()`)
const touch = (type, pts) => send('Input.dispatchTouchEvent', { type, touchPoints: pts })
const tap = async (sel) => {
  const c = await center(sel)
  if (!c) return false
  await touch('touchStart', [{ x: c.x, y: c.y }])
  await sleep(70)
  await touch('touchEnd', [])
  return true
}
const shownMidi = () => evaluate(`(() => {
  const svg = document.querySelector('.drill .staff')
  if (!svg) return null
  const ys = [...svg.querySelectorAll('g.ink line')].filter((l) => l.getAttribute('y1') === l.getAttribute('y2')).map((l) => Number(l.getAttribute('y1')))
  const lines = [...new Set(ys)].sort((a, b) => a - b)
  const top = lines[0]
  const sp = lines[1] - lines[0]
  const head = svg.querySelector('g.el text.glyph')
  const y = Number(head.getAttribute('y'))
  const d = Math.round(6 + ((top + 2 * sp - y) * 2) / sp)
  const semitones = [0, 2, 4, 5, 7, 9, 11]
  const letter = ((d % 7) + 7) % 7
  const octave = 4 + Math.floor(d / 7)
  return (octave + 1) * 12 + semitones[letter]
})()`)

let failed = 0
const check = (name, ok, detail) => {
  failed += ok ? 0 : 1
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
}

const text = (sel) => evaluate(`document.querySelector(${JSON.stringify(sel)})?.textContent.trim() ?? ''`)
const saved = async () => JSON.parse(await evaluate(`localStorage.getItem('portee.v1')`))

await evaluate(`location.hash='${LEVEL}'`)
await sleep(800)
const total = Number((await text('.progress-count')).split('/')[1])
check('drill opens with a session length', total >= 30, `length=${total}`)
const hud = { score: await text('.score-num'), combo: await text('.combo') }
check('the game bar starts at zero without combo', hud.score === '0' && hud.combo === 'Combo ×1', `${hud.score} · ${hud.combo}`)
let answered = 0
let combo = ''
for (let i = 0; i < total; i++) {
  const midi = await shownMidi()
  if (midi === null) break
  if (!(await tap(`[data-midi="${midi}"]`))) break
  answered++
  await sleep(600)
  if (i === 4) combo = await text('.combo')
}
check('every note of the session was answered', answered === total, `${answered}/${total}`)
check('five right notes in a row double the points', combo === 'Combo ×2', combo)
await sleep(500)
const reward = JSON.parse(await evaluate(`JSON.stringify({
  shown: !!document.querySelector('.reward'),
  stats: [...document.querySelectorAll('.reward .stat-value')].map((e) => e.textContent),
  verdict: document.querySelector('.reward .verdict')?.textContent ?? '',
  score: Number((document.querySelector('.reward .big-score')?.textContent ?? '').replace(/\\D/g, '')),
  record: !!document.querySelector('.reward .record-flag'),
  stars: document.querySelectorAll('.reward .stars.big .star.on').length,
  xp: document.querySelector('.reward .xp-gain')?.textContent ?? '',
  badges: [...document.querySelectorAll('.reward .badge-card .badge-title')].map((e) => e.textContent),
  next: document.querySelector('.reward button.next')?.textContent ?? '',
})`))
check('reward screen is shown', reward.shown, reward.stats.join(' · '))
check('accuracy is 100 %', reward.stats[0] === '100\u00a0%', reward.stats[0])
check('level is validated', reward.verdict.includes('validé'), reward.verdict)
check('a first session is a new record with three stars', reward.record && reward.stars === 3 && reward.score >= 30 * 20, `score=${reward.score} stars=${reward.stars}`)
check('XP and the first badges are awarded', reward.xp.startsWith('+') && reward.badges.includes('Premier pas') && reward.badges.includes('Sans faute'), `${reward.xp} · ${reward.badges.join(', ')}`)
check('the next level is offered', reward.next === 'Suivant', reward.next)
const p = await saved()
check('history holds the whole session', (p.history[LEVEL] ?? []).length === total, `history=${(p.history[LEVEL] ?? []).length}`)
check('one session and a streak of 1 were recorded', p.sessions.length === 1 && p.streak.count === 1, `sessions=${p.sessions.length} streak=${p.streak.count}`)
check('card stats were written', Object.keys(p.cards).length > 0, `cards=${Object.keys(p.cards).length}`)
check('record, stars, XP and badges were saved', p.records[LEVEL] === reward.score && p.stars[LEVEL] === 3 && p.xp > 0 && 'first' in p.badges, `record=${p.records[LEVEL]} stars=${p.stars[LEVEL]} xp=${p.xp}`)
await tap('.reward button.replay')
await sleep(800)
const again = { count: await text('.progress-count'), score: await text('.score-num') }
check('a new session starts from the reward screen', again.count.startsWith('1 /') && again.score === '0', `${again.count} · ${again.score}`)

await evaluate(`location.hash=''`)
await sleep(800)
const home = JSON.parse(await evaluate(`JSON.stringify({
  level: document.querySelector('.player-level')?.textContent ?? '',
  tiles: [...document.querySelectorAll('.world')[0].querySelectorAll('.tile')].map((t) => t.className.replace('tile', '').trim()),
  record: document.querySelectorAll('.world')[0].querySelectorAll('.tile')[1]?.querySelector('.tile-info')?.textContent ?? '',
  review: document.querySelector('.banner.review .banner-title')?.textContent ?? '',
})`))
check('home shows the player level from the saved XP', /^Niveau [2-9]/.test(home.level), home.level)
check('tiles show p2 done, p3 open and p4 locked', home.tiles[1] === 'done' && home.tiles[2] === 'open' && home.tiles[3] === 'locked', home.tiles.join(' '))
check('the tile shows its record', home.record.startsWith('Record'), home.record)
check('home offers the daily review once notes were seen', home.review === 'Révision du jour', home.review)
await tap('.banner.review')
await sleep(800)
const reviewBar = { title: await text('.game-title'), count: await text('.progress-count'), hash: await evaluate('location.hash') }
check('the review opens as a drill of 30 notes', reviewBar.title === 'Révision du jour' && reviewBar.count === '1 / 30' && reviewBar.hash === '#review', `${reviewBar.title} ${reviewBar.count} ${reviewBar.hash}`)

await evaluate(`location.hash='chrono'`)
await sleep(800)
const ready = { start: await evaluate(`!!document.querySelector('.chrono-start')`), timer: await text('.progress-count') }
check('the chrono waits for the start button', ready.start && ready.timer === '60 s', ready.timer)
await tap('[data-midi="64"]')
await sleep(300)
const idle = { score: await text('.score-num'), pop: await evaluate(`!!document.querySelector('.pop')`) }
check('keys are ignored before the start', idle.score === '0' && !idle.pop, `score=${idle.score} pop=${idle.pop}`)
await tap('.chrono-start button.primary')
const started = Date.now()
await sleep(300)
let hits = 0
while (Date.now() - started < 75000) {
  if (await evaluate(`!!document.querySelector('.reward')`)) break
  const midi = await shownMidi()
  if (midi === null) { await sleep(200); continue }
  if (!(await tap(`[data-midi="${midi}"]`))) break
  hits++
  await sleep(450)
}
const elapsed = Date.now() - started
const chronoEnd = { eyebrow: await text('.reward .eyebrow'), score: Number(await text('.reward .big-score')) }
check('the chrono ends by itself after 60 seconds', chronoEnd.eyebrow.startsWith('Temps écoulé') && elapsed >= 59000 && elapsed < 64000, `${(elapsed / 1000).toFixed(1)} s, ${hits} taps`)
const pc = await saved()
check('the chrono record counts the right notes and writes no history', chronoEnd.score > 0 && pc.records.chrono === chronoEnd.score && pc.history.chrono === undefined, `score=${chronoEnd.score} record=${pc.records.chrono}`)

const cardsBefore = Number(await evaluate(`Object.keys(JSON.parse(localStorage.getItem('portee.v1')).cards).length`))
await evaluate(`location.hash='e1'`)
await sleep(300)
const earStart = JSON.parse(await evaluate(`JSON.stringify({ heads: document.querySelectorAll('.drill .staff g.el').length, button: document.querySelector('.ear-controls button')?.textContent ?? '' })`))
check('the ear drill hides the note and offers to listen', earStart.heads === 0 && earStart.button.includes('coute'), `heads=${earStart.heads} button=${earStart.button}`)
await tap('[data-midi="61"]')
await sleep(120)
const early = { answer: await text('.answer'), count: await text('.progress-count') }
check('a key pressed before the note sounds is ignored', early.answer === '' && early.count === '1 / 30', `answer=${JSON.stringify(early.answer)} ${early.count}`)
await sleep(900)
if ((await evaluate(`document.querySelector('.ear-controls button')?.textContent ?? ''`)).includes('Écouter')) {
  await tap('.ear-controls button')
  await sleep(1000)
}
let earAnswers = 0
let revealed = true
for (let k = 0; k < 30; k++) {
  if (!(await tap('[data-midi="61"]'))) break
  await sleep(150)
  const shown = Number(await evaluate(`document.querySelectorAll('.drill .staff g.el').length`))
  revealed = revealed && shown === 1
  const hint = await evaluate(`document.querySelector('.key.hint')?.dataset.midi ?? null`)
  if (!hint) break
  await tap(`[data-midi="${hint}"]`)
  earAnswers++
  await sleep(1400)
}
check('every ear card was answered after hearing it', earAnswers === 30, `${earAnswers}/30`)
check('a wrong answer reveals the note on the staff', revealed)
const earVerdict = await text('.reward .verdict')
check('the ear reward uses the relaxed time limit', earVerdict.includes('3,0'), earVerdict)
const pe = await saved()
check('ear answers are saved without touching reading stats', (pe.history.e1 ?? []).length === 30 && Object.keys(pe.cards).length === cardsBefore, `history=${(pe.history.e1 ?? []).length} cards=${cardsBefore}->${Object.keys(pe.cards).length}`)

ws.close(); chrome.kill()
process.exit(failed ? 1 : 0)
