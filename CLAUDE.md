# Portée

Web app to learn sight-reading at the piano, in French. Solo personal project: the Staffmatch rules from the global CLAUDE.md (Redux, Yup, Emotion, locales tooling, ticket formats) do not apply here.

## Stack

- Vite 8, React 19, TypeScript 7, no router, no state library, no test runner.
- Node 22 via nvm (`.nvmrc`). Run `source ~/.nvm/nvm.sh && nvm use` before any npm or node command.
- `npm run build` = `tsc --noEmit && vite build`. `npm test` = Vitest on `src/**/*.test.ts` (engine, score layout, lesson consistency). Run both after every change; tsc also type-checks the tests.
- `npx vite preview --port 4173 --strictPort` serves `dist/`. `vite.config.ts` allows `.ngrok-free.app` hosts for phone testing.
- Fonts in `public/fonts/`: Bravura (SMuFL music glyphs), Instrument Sans (UI), Instrument Serif (titles, big numbers). All self-hosted, declared in `index.html`.
- PWA: `public/manifest.webmanifest`, icons in `public/icons/` (regenerate with `npm run icons`, headless Chrome renders the SVG in `tools/icons.mjs`). `vite.config.ts` emits `dist/sw.js` at build: it precaches the shell, fonts and hashed assets under a content-hashed cache name, serves navigations from cache, and caches the piano samples from `smpldsnds.github.io` on first use. `src/main.tsx` registers it in production only and reloads once when a new version takes control. Never edit `dist/sw.js` by hand.
- Audio: `preloadAudio()` runs at mount (creates the context, starts loading samples), `unlockAudio()` resumes it on the first gesture. `navigator.storage.persist()` is requested at startup.

## Conventions

- Interfaces prefixed `I`, types prefixed `T` or plain type aliases as in `engine/`. Props typed directly on the function parameter, never `React.FC`.
- No comments in code. No README unless asked.
- Relative imports (`../engine/notes`), no path aliases.
- Plain CSS in `src/styles.css` with custom properties on `:root`. No CSS-in-JS, no inline `style={{}}` except the CSS variables the Piano needs (`--kw`, `--n`, `--i`).
- Copy is French with typographic apostrophes (`’`). Note names are `do ré mi fa sol la si`, octave appended without space (`do4`, `ré5`).
- Icons are inline stroke SVGs in `components/Icons.tsx`. No emoji.
- Native controls only: `<button>`, `<input>`, with `aria-label` on icon-only buttons.

## Navigation

Hash routes handled in `App.tsx`: `` (home), `#<levelId>` (drill or exercise), `#<levelId>/lecon` (lesson), `#stats`, `#settings`, `#gallery`. Level ids: `p1`–`p7` (pitch), `r1`–`r3` (rhythm), `f0`–`f2` (phrase). Selecting a level from Home opens its lesson first if it has never been seen. A row of "À travailler" in Stats opens the level that contains that note.

## Engine invariants

- Diatonic index: `0` = middle C (do4). `+1` per step up, `-1` per step down. `letterAt`, `octaveAt`, `midiAt` in `engine/notes.ts` derive everything from it.
- `MIDDLE_LINE` = `{ treble: 6, bass: -6 }` (si4 and ré3). Staff y position = `top + 2sp - (d - middleLine) * sp / 2`.
- Key signatures: `KEYS` up to 3 sharps or 3 flats. `SHARP_POSITIONS` / `FLAT_POSITIONS` give the diatonic index of each accidental per clef.
- Card id encodes clef, diatonic, shown accidental and key. `shown === 0` is an explicit natural, `null` means nothing drawn.
- Scheduler: `SESSION_LENGTH` 30 notes per drill, level done at `PASS_ACCURACY` 0.95 and median reaction `PASS_RT` 1500 ms. Exercises: `EXERCISES_TO_PASS` 5 with average `PASS_SCORE` 85.
- Rhythm: 4/4 only, cells in `CellKind`, generation in `generateMeasures`. Placement rules in `allowed()`: half notes, half rests and dotted quarters only on odd beats, whole and dotted half only on beat 1, no two rests in a row, and the whole rest `rw` only as a full silent bar that is not the first bar and does not follow another silent bar. Scoring windows `PERFECT_MS` 60, `GOOD_MS` 120, `WINDOW_MS` 200. Timestamps come from the touch-down instant, not from when the note sounds.
- Keyed levels (p7): one session per key signature, in the order of `level.keys`. History is stored under `historyKey(levelId, key)` (`p7:G`), `nextKey()` gives the first key not yet validated, `levelStateOf()` aggregates (done when every key is done, `count` = keys done). Unkeyed levels keep `history[levelId]`.
- Lessons: a step with `quiz: true` lights one key of the figure at random on the piano and the learner taps the matching note on the staff (`components/Lesson.tsx`); its `piano.marks` stays empty in the data. Level `f0` (five-finger position, quarters and halves) sits between the rhythm levels and `f1`.
- Score layout: `score/layout.ts` produces primitives from an `IScore`; `components/Staff.tsx` renders them as SVG with Bravura glyphs from `score/glyphs.ts`. Glyph font size = 4 spaces. Labels are centred under the head using `headW`.
- Progress persisted in `localStorage` under `portee.v1`, shape `IProgress` (version 1). Export and import go through `exportProgress` / `importProgress`.

## Piano input

`components/Piano.tsx` is shared by lesson, drill and exercises. On touch, when the keyboard is scrollable, a note is deferred 150 ms or fired on release, and cancelled on `pointercancel` or on a move beyond 8 px, so that swiping to scroll never plays a note. Mouse, pen, MIDI, computer keys and non-scrollable keyboards are immediate. `onNoteOn(midi, at)` carries the original touch timestamp.

## Design

The design lives on a Claude Design canvas titled "Portée" (`https://claude.ai/artifact/VxzEkWNmkDBgMgvVQAGMh1`): seven phone screens plus a Fondations board. `src/styles.css` is its implementation. Tokens: paper `#f4efe6`, card `#fffcf7`, ink `#1b1814`, muted `#6b6358`, line `#e2dacc`, accent `#2e5bd7`, ok `#22703e`, bad `#c2392f`, meh `#8f5e12`.

## Testing

- `tools/shot.mjs <url> <WxH> <actions.json>`: headless Chrome via CDP. Actions: `wait`, `tap` (touch), `key`, `eval`, `text`, `shot`, `full`. Prints console errors and failed requests.
- `tools/shots.sh`: builds, serves, captures every screen at 390×844 and 375×667 into `shots/<date>/`.
- `tools/touch.mjs <url>`: piano gesture regression (swipe must not register a note, tap must, non-scrollable keyboard is immediate). Prints PASS or FAIL per case.
- A fresh headless profile has empty progress, so Home shows every level as new and Stats is empty.
- Test on 390×844 and on 375×667 (iPhone SE) for every visual change.
