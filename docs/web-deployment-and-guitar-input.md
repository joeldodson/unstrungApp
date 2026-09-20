# Unstrung as a web application, and guitar input

Written 2026-09-20 from a discussion with Joel. Nothing here is built. Committed to `docs/` so it
survives with the repository.

Two related questions:

1. How much of Unstrung could run in a browser, as well as or instead of Electron?
2. How would plugging a guitar in for a tuner, timing feedback and chord checking be built, and
   would that need the desktop app?

Short answers: nearly all of Unstrung could run in a browser. All of the guitar input work could.
The way to keep both open is to keep logic in `src/shared` and platform access behind one
interface, which is already mostly how the code is shaped.

## The design rule

Any new code should follow these, whether or not a web version ever happens:

- **Logic goes in `src/shared`.** Anything that computes rather than displays or does I/O: parsing,
  music theory, generators, file formats, audio analysis. No DOM, no Node, no Electron.
  As of 2026-09-20 nothing in `src/shared` references `document`, `window`, `require` or `node:`,
  and that should stay true. It is also what lets the check scripts run it directly under Node.
- **Platform access goes through `window.unstrung`.** The renderer reaches Electron only through
  the object `src/main/preload.js` exposes. A web build would supply a second implementation of
  the same object over browser APIs. Do not reach around it.
- **The renderer stays ordinary browser code.** It is bundled by esbuild with
  `--platform=browser` already. DOM, ARIA, Web Audio and alphaTab all work unchanged in Chrome.

## How far the code already is

As of 2026-09-20:

| Part | Lines | Runs in a browser? |
|---|---|---|
| `src/renderer/renderer.js` | about 5,960 | Yes, except its calls into `window.unstrung` |
| `src/shared/*.mjs` (7 modules) | about 2,760 | Yes, unchanged |
| `src/main/main.js` | about 920 | No. This is what a web build replaces |

The renderer calls `window.unstrung` at 45 places, through 34 methods. Grouped, with what each
would become on the web:

| Group | Methods | Web replacement |
|---|---|---|
| Menu signals | `onFileOpened`, `onFileOpenError`, `onCloseCurrentTab`, `onAboutOpen`, `onHelpOpen`, `onGuitarSamplesOpen`, `onChordPracticeOpen`, `onChordLibraryOpen`, `onFretsToChordOpen`, `onSettingsOpen`, `onOpenSavedProgression`, `onNewProgression` | An in-page menu or buttons calling the same handlers. Needs care: a real menu bar is reliable with a screen reader, an in-page one has to be built well |
| Opening song files | via `onFileOpened` from the File menu | `<input type="file">` or drag and drop; alphaTab parses the bytes the same way |
| Static data | `getChordLibrary` | `fetch` of the JSON |
| Samples | `getGuitarSampleNotes`, `getGuitarSampleAudio` | `fetch` per note, kept in the Cache API. See the size section |
| Speech | `listSpokenVoices`, `getSpokenPhrases` | `fetch` per phrase, cached |
| Settings | `getSettings`, `saveScreenReaderSettings`, `saveChordVoiceSettings`, recent files, default folder | IndexedDB or local storage. Recent files and the default Open folder mostly lose their meaning |
| Saved progressions | `listProgressions`, `readProgression`, `saveProgression`, `openProgressionsFolder`, `chooseProgressionsDirectory`, `saveProgressionsDirectory` | File System Access API: `showDirectoryPicker`, handle stored in IndexedDB, so the tree still works. Chromium only; elsewhere, download and upload |
| Quitting | `setUnsavedProgressions`, `onConfirmQuit`, `confirmQuit` | A `beforeunload` handler. Browsers show their own generic prompt, not ours |
| Links | `openExternalLink` | Ordinary links |

## What makes a web version hard

### The samples: 395 MB

- 634 WAV files, mono, 44.1 kHz, 24-bit, 5 to 7 seconds, averaging 638 KB. Plus 1,128 chord-name
  recordings, about 20 MB.
- For comparison, a median web page is about 2 to 3 MB and a heavy single-page app 5 to 15 MB.
- **Compress to Opus.** At about 96 kbps mono, Opus is effectively transparent for a single
  recorded instrument and handles pick attacks well (it switches to short frames on transients).
  The full set would be roughly 45 MB, about 30 MB at 64 kbps. Speech would drop to about 2 MB.
  Playback code barely changes: samples are decoded into buffers before use either way.
  The attacks and the six strings mixing together are what to listen for. Only Joel can judge that.
- **Fetch on demand.** A progression uses about 20 to 30 pitches at one velocity, roughly 2 MB
  compressed, fetched once and cached. Offer the whole set as an optional download for offline use.
- Call `navigator.storage.persist()`, or the browser may evict the cache and fetch it all again.
- Hosting: GitHub Pages has a soft limit of about 100 GB a month, about 2,000 full downloads at
  45 MB. On-demand fetching makes that much less likely to matter.
- Should the desktop app compress too? Discussed and the answer was not now. It shrinks the
  installer, but not the repository: the WAVs stay in git history, so a fresh clone grows unless
  history is rewritten, which breaks every existing clone. It becomes worth doing if the Microsoft
  Store work resumes or a web version is built. A reasonable first step is a build-time encode into
  a parallel folder and a hidden setting to switch between them, so Joel can compare by ear.

### Keyboard shortcuts the browser keeps

Ctrl+T (Open File) and Ctrl+W (Close Tab) belong to the browser and a page cannot intercept them.
They would need new bindings on the web. Ctrl+S can be intercepted. The bare transport keys (Space,
arrows, B, M, S, F) are fine. An installed PWA gets some shortcuts back, but not reliably.

### Timers in a hidden tab

Playback schedules a 12 second horizon and tops it up every 3 seconds on a timer. Browsers throttle
timers hard in a background tab, so top-ups could arrive late and leave gaps. Audio already
scheduled keeps playing. The fix is a clock in a worker or an AudioWorklet. Electron does not need
this.

### Lost entirely

The command line (`unstrung ripple.gp`) and file associations.

### What it would gain

No installer, no per-platform builds, no Microsoft Store, and it runs on a Mac or a Chromebook the
day it ships. A URL also works on a machine Joel does not own.

### Suggested shape if it is ever built

A web version that reads and navigates song files fully, and treats audio as download-on-demand,
with the desktop app staying the one that plays instantly and works offline. Two implementations
of the `window.unstrung` object, one over IPC and one over browser APIs, and a second esbuild entry
point. `src/shared` needs no changes.

## SoundFonts do not solve the size problem

Also discussed 2026-09-19; see `js-synthesizer-investigation.md` in this folder for the full
synthesizer study.

- Unstrung has no SoundFont player. It plays WAVs through Web Audio from `.sfz` maps. SF2 would
  need a synth engine (js-synthesizer, SpessaSynth, or alphaTab's own).
- Our own recordings as SF2 save almost nothing: SF2 is 16-bit PCM, uncompressed. FluidSynth also
  loads the whole file into memory. SF3 is compressed, which is the Opus saving again.
- A small third-party guitar SoundFont is small because it has far fewer recordings, not because of
  the format. The same saving is available by shipping fewer of our own samples (for example one
  velocity, two round robins, every third semitone: about 70 files), with no new engine.
- Sound quality would probably drop, and round robins would be lost.
- The one real gain from a General MIDI SoundFont is other instruments, drums especially, which
  Unstrung can read but not play. That would sit beside the guitar samples, not replace them.

## Guitar input: tuner, timing, chord checking

### Nothing here needs Electron

Every piece is a standard browser API, and Electron is Chromium, so it is the same code in both:

- Audio in: `getUserMedia`.
- Continuous analysis: an `AudioWorklet`, on the audio thread.
- What was supposed to be played: the chord library's note data, a small JSON file. **Not the
  samples.** A web tuner or chord checker without a backing track would be a few hundred kilobytes.
- When it was supposed to be played: the Web Audio clock playback already uses.

Browser differences, none blocking:

- The browser asks for microphone permission once per site, over HTTPS only. That prompt is
  browser interface, so how well NVDA handles it is outside Unstrung's control. Electron grants the
  permission itself, with no prompt.
- Device names are only listed after permission is granted, so first run is clumsier on the web.
- Firefox and Safari have been less reliable at honouring "no echo cancellation, no noise
  suppression". Chromium, and so Electron, is the dependable case.
- Saving recordings to a chosen folder is Chromium-only on the web, the same as saved progressions.

Neither environment gets ASIO-level latency. That only matters for hearing the guitar through the
computer with effects, not for analysis. Direct monitoring on the interface, or the amp, covers
hearing yourself.

A desktop app would only pull ahead if chord analysis moved to a machine-learning model (Spotify's
open-source Basic Pitch is the obvious one). Those run in a browser through WebAssembly or WebGPU
too, somewhat slower.

### Where the code should go

| Piece | Where | Notes |
|---|---|---|
| Pitch detection (tuner) | `src/shared` | YIN or the McLeod Pitch Method. A window of about 2,048 samples (about 45 ms) is enough for low E at 82 Hz; accuracy within a cent or two. Pure functions over a `Float32Array` |
| Onset detection (timing) | `src/shared` | An energy or spectral-flux jump. Far easier than knowing what was played |
| Chroma vector | `src/shared` | Spectrum folded into 12 pitch classes |
| Chord comparison | `src/shared` | Chroma against the expected chord's pitch classes, using the chord library and `musicTheory.mjs` |
| AudioWorklet processor | a thin file, likely under `src/renderer` | Only buffers audio and calls the shared functions. Loaded with `audioWorklet.addModule`, so it needs its own esbuild entry; the current CSP (`default-src 'self'`) allows it |
| Opening the input | behind `window.unstrung`, e.g. `listInputDevices()` and `openInput(deviceId)` | Must pass `echoCancellation: false`, `noiseSuppression: false`, `autoGainControl: false`. Electron needs a permission handler; Windows needs its microphone privacy setting on |
| Tuner and feedback interface | `src/renderer` | See below |

### What chord checking can and cannot do

- **Checking against the chord Unstrung asked for** is realistic: it compares against one candidate,
  not hundreds. Reliable for clean triads and common sevenths on an undistorted guitar.
- **Harmonics mislead.** The fifth harmonic of a note is a major third above, two octaves up, so a
  power chord looks major to a naive detector. This is the main source of false results. Say
  nothing rather than "you missed the third" when the evidence is weak.
- **Some chords have identical notes**, C6 and Am7 for example. Chroma cannot separate them.
- **Voicing is not detectable.** Which string an E came from differs only in timbre. Do not promise
  fingering feedback.
- Distortion, heavy palm muting and fast strumming all degrade it.

### Timing feedback

Probably the most useful piece. Unstrung already knows where every beat is because it generates the
backing track, so it could say that the change to F is consistently a beat late, or that strums are
drifting ahead of the click. Needs a one-off latency calibration (output plus input latency): strum
along with a click and measure the offset. `AudioContext.outputLatency` helps; the same APIs exist
in both environments.

### The tuner's output has to be sound, not a needle

Every commercial tuner is visual. Speaking "A, twelve cents flat" repeatedly would be unbearable.
Use a tone or pulse whose rate changes as the string approaches pitch and goes steady when it
arrives, with the note name spoken only when the string changes. The recorded speech and the audio
graph already exist. This is probably worth building on its own: it is where being blind costs Joel
the most today.

### Testing without listening

The 634 recorded samples are a labelled corpus: each file name states its pitch and velocity. Run
the pitch detector over all of them and compare with the name. Mix known notes to make chords with
known answers for the chord check. All of it runs headlessly under Node against `src/shared`,
matching how the project is tested.

### Suggested order

1. Input plumbing and the tuner. Small, useful on its own, and proves the chain with real hardware.
2. Onset detection and timing feedback against a progression being played along with.
3. Chord verification against the expected chord, phrased conservatively.

### Hardware

As of 2026-09-20 Joel does not own an interface or cable. His guitar is an Eastman AR905CE, which
has the standard 1/4 inch (6.35 mm) mono jack. Options discussed:

- Focusrite Scarlett Solo, 4th generation, about $130 to $140. Proper instrument input, physical
  gain knob, better built. Suggested.
- Behringer U-Phoria UM2 or UMC22, about $35 to $45. Adequate for analysis. No true instrument
  input, so slightly duller tone.
- A USB guitar cable such as the Behringer UCG102 or Rocksmith Real Tone Cable, about $25. Poor
  converters, fine for analysis.

All appear to Windows as standard USB audio devices, with no driver needed. An interface needs a
separate 1/4 inch instrument cable. Plugging in is better than a microphone: the backing track
from the speakers never reaches the input.
