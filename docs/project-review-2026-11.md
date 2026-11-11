# Project review, November 2026

A review of unstrung 0.10.2 at commit 03d8743, done 2026-11-10. Nothing was changed: no source
edited, nothing committed. `docs/scarlett-solo-and-archtop.md` was left out, as that work has not
started.

## How it was done

- Read `CLAUDE.md`, `docs/README.md` and the design notes, then every file under `src/`, the user
  documents, and the build, help, web and hook scripts.
- Ran the shared parsers under Node over 37 song files: the four in `musicfiles/` and every .gp,
  .gp5 and .gpx under `OneDrive\Guitar`. All 37 parse, and nothing throws. They hold 73 guitar and
  bass tracks.
- Drove the Electron app with playwright-core, sound muted, on a scratch profile, and read the DOM,
  ARIA state, focus and announcement lines. No screenshots.
- Ran the eight Node-only check scripts in `scripts/`. All eight pass.

Each finding says how it was established: **run** (a script showed it), **driven** (seen in the
app under Playwright), or **traced** (followed in the code, not run).

Not done: nothing was read with NVDA; the web build was not built or run; Safari and iOS were not
tried; the Electron `verify-*` scripts were not run. `docs/README.md` was not given an entry for
this file.

## Findings, most serious first

### High

#### 1. Songsterr files play one placeholder chord in place of the written notes

Area: correctness, audio. Established: run.

- `src/shared/audioTrack.mjs:178-195` (`statedChordVoicing`), used at `:317-347`.
- A beat that prints a chord and writes one or two notes is "completed": its notes are replaced by
  the chord's fingering from the file. Songsterr files carry the same placeholder fingering under
  every chord they print, frets 3 1 2 2 0 x from string 1, which is Am7. It is never shown in the
  file (`showDiagram` is false).
- `src/shared/scoreMetadata.mjs:909-918` already knows this and refuses the shape for display. The
  audio path does not check.
- Cases:
  - Mazzy Star, Into Dust, track 2: all 82 beats that print a chord play A E A C G. Measure 1
    prints D and writes D3; Am7 is played.
  - Pink Floyd, Wish You Were Here, tracks 4, 5 and 6: 116 beats.
  - America, Sister Golden Hair, track 3: 15 beats. The G#m and F#m measures play Am7.
- Across the 37 files, 213 of 337 completed beats use the hidden placeholder.
- About the Audio Track then says these chords are "voiced as the song writes them elsewhere"
  (`src/renderer/renderer.js:2514-2518`), which is not so.
- Smallest fix: require `chord.showDiagram`, as `chordDiagram` does.

Two related points, lower in weight:

- Where the file gives no fingering, the chord is "learned" from the fullest beat under that name
  (`audioTrack.mjs:69-101`). Vincent.gpx measure 23 prints Am7 over a written C and plays
  E G C E, with no A. Ripple Chord Solo measure 16 has a melody D under a printed C; the D is
  dropped and a C chord strummed. The printed chord is carried forward with no stop at a section,
  unlike the measure headings. This is the audio side of what was dropped for headings on
  2026-10-26: the notes need not spell the printed chord. Worth deciding whether completion stays.
- `audioTrack.mjs:190` adds the fret to the open string and leaves the capo out. alphaTab's
  `realValue` includes it. Traced only: no file here has a capo and a shown diagram together.

#### 2. A guitar track that carries lyrics is read as pitches, with no strings or frets

Area: accessibility, parsing. Established: run.

- `src/shared/scoreMetadata.mjs:822` sets `sung` when any beat of the track has a lyric. `:375-376`
  then never names a chord, and `:199-208` gives a pitch in place of string and fret.
- Case: Brothers In Arms Solo, track 1, Steel Guitar, program 25. 171 beats carry lyrics. A beat
  reads "eighth note, E3, slide in from below". The whole track reads that way.
- Lyrics typed onto the guitar staff are common in single-track tabs.
- Since only guitar and bass tracks are listed (`:966-969`), `sung` can now only be true for a
  guitar or bass track. The branch is wrong every time it fires.

#### 3. Notes in a second voice are played but never described

Area: accessibility, parsing. Established: run.

- `src/shared/scoreMetadata.mjs:826` reads `bar.voices[0]` only. `audioTrack.mjs:305` plays every
  voice.
- Cases: Brothers In Arms Solo, 306 sounding beats in voices 2 and up over 73 measures.
  Vincent.gpx, 63 beats over 34 measures.
- The reader is not told anything is left out. `features.md:156` says each beat is described.
- At the least, a measure should say it has a second voice. Better, describe it.

### Medium

#### 4. A pickup measure gets a full measure of clicks

Area: correctness, timing. Established: run.

- `src/shared/audioTrack.mjs:251-267` gives every bar as many beats as its time signature, even a
  pickup, which alphaTab makes shorter. `renderer.js:2667-2686` (count-in) and `:2915-2926`
  (metronome) click on all of them.
- Vincent.gpx: measure 1 lasts 2 beats and clicks at beats 0, 1, 2 and 3. Measure 2 starts at
  beat 2 and clicks there too, so two clicks sound together twice. The count-in, on by default,
  is 2 beats long with 4 clicks; the last two land on the music.
- Brothers In Arms Solo: measure 1 lasts a beat and a half, so its extra clicks fall half a beat
  off measure 2's.
- 2 of the 37 files.

#### 5. A swung song is announced as swung and played straight

Area: correctness, audio. Established: run.

- `src/shared/audioTrack.mjs:308` takes `beat.playbackStart` as written. alphaTab applies triplet
  feel only when it makes MIDI.
- Ripple (.gp): Song Summary says "Feel - triplet eighths (swung)". Measure 35, eight eighth
  notes, sounds at 0, 0.5, 1, 1.5 and so on. Swung, the off-beats would be at 0.667.
- 9 of the 37 files state a feel, every Ripple file among them.
- Either play it, or say in About the Audio Track that playback is straight.

#### 6. spaceBar on the Menu button plays the track; it does not open the menu

Area: accessibility, keyboard. Established: driven.

- `src/renderer/renderer.js:3575-3592` and `:5314-5325` take spaceBar wherever focus is, unless it
  is in a text field or on a checkbox (`:3562-3573`).
- With a track's Measures and Playback region open, or a chord progression shown:
  - spaceBar on the Menu button: the menu stays closed and playback starts.
  - spaceBar on an open item's Close button: nothing closes and playback starts.
  - spaceBar on the Measures to Play summary: it stays collapsed and playback starts.
- `features.md:98` says spaceBar opens the menu. `features.md:286` covers this for the measure
  buttons only.
- NVDA in browse mode sends a click, so this is met in focus mode and by sighted keyboard users.
  Suggest the keys act only while focus is inside the item's own panel.

#### 7. The voice and volume settings are ignored until Settings or Chord Practice is opened

Area: correctness, settings. Established: driven.

- `src/renderer/renderer.js:1017` starts at Zira, 75 percent. The startup read (`:1112-1118`)
  loads only the screen reader settings. The Chord Library uses the value as it stands
  (`:1835`, `:1854`).
- Saved David at 30 percent, reloaded, opened the Chord Library, ticked Speak chord name, pressed
  Play: Zira was asked for.
- The defaults also disagree: 50 in `src/main/main.js:71` and `index.html:621`, 75 in
  `renderer.js:1017`, `:1056`, `:5673` and `src/web/platform.js:136`.

#### 8. A minor key is named as its relative major

Area: correctness. Established: run.

- `src/shared/scoreMetadata.mjs:46-49` and `:1046` name the key from the count of sharps and flats
  alone. `songScore.mjs:523-527` reads the mode as well, so the two disagree.
- A progression saved by unstrung in A minor, opened with Open File: "Key signature - C". E minor
  reads G. Opened as a progression, the same file says A minor.

#### 9. Closing the window discards chords typed in the progression editor

Area: correctness, data loss. Established: traced.

- `src/main/main.js:835-839` asks only when a progression is marked unsaved. That mark comes from
  applied changes (`renderer.js:5754-5756`).
- Manually Create Chord Progression, type twenty measures, alt+f4: the window closes without a
  question. escape is guarded (`renderer.js:8065-8072`); closing the window is not.

#### 10. Web version: each chord played in the Chord Library keeps extra copies of whole samples

Area: web build, memory. Established: traced, not measured.

- `src/renderer/renderer.js:1735-1754` caches a sample by pitch, loudness and length wanted. The
  desktop app trims the WAV to that length. `src/web/platform.js:477-485` ignores the length and
  returns the whole recording.
- Each string of a downstroke rings a slightly different time, so one six-string chord caches six
  whole recordings under six keys, then the same six again in full for the upstroke: about 15 MB
  decoded where half would do. `sampleBufferCache` (`:1606`) never lets anything go.
- A long session in the Chord Library on a phone grows until the browser reloads the tab.

#### 11. Web version: one failed download is remembered for the whole visit

Area: web build. Established: traced.

- `src/web/platform.js:279`, `:285`, `:288-296` and `:582` keep the promise of the first fetch,
  failed or not, and do not check `response.ok`.
- A phone loses its connection as the chord library is first asked for. The Chord Library, Frets
  to Chord, Chord Practice and every track's Chord Symbols then fail until the page is reloaded.

#### 12. A MusicXML part with no MIDI instrument is not listed

Area: parsing. Established: run, on a file written for the test.

- `src/shared/scoreMetadata.mjs:966-969` lists a track only by its MIDI program, 24 to 39.
- A MusicXML file of three parts, none declaring an instrument, one of them six-string tablature:
  "Tracks - 0 guitar and bass; 3 others are not listed" and "This file has no guitar or bass
  tracks." With the instruments declared, both guitar parts read and play correctly.
- A track whose staff has a string tuning could be listed whatever its program.
- There is no MusicXML file in `musicfiles/` or the Guitar folder, so that format rests on
  alphaTab alone.

### Low

#### 13. Open Saved Progression reads the whole folder tree before it opens

Area: file handling. Established: traced.

- `src/main/main.js:352-363` accepts any folder that exists. `:382-427` then walks it twelve
  levels deep and reads every .atex file each time the dialog opens, with nothing said meanwhile.
- Choose Documents, or the user folder, as the progressions folder: the dialog waits on a walk of
  everything under it. The web version does the same (`src/web/platform.js:349-379`).

#### 14. Four dialogs open with focus on the dialog and a lot of text in it

Area: accessibility. Established: driven for focus; what NVDA reads is not verified.

- Guitar Samples (`index.html:136`, 267 words of visible text), Chord Practice (`:206`), Frets to
  Chord (`:547`) and About (`:122`) take focus on the dialog itself and have no
  `aria-describedby`. `renderer.js:495-496`, `:840-841`, `:2382-2383`, `:6152-6153`.
- The comment at `index.html:322` says NVDA then reads every line. The editor and Unsaved Changes
  dialogs were given a short description for that reason.

#### 15. The Default folder field checks itself every time focus leaves it

Area: accessibility. Established: traced.

- `src/renderer/renderer.js:933` validates on blur. With a mistyped path in the field, tab, a
  click on OK, and alt+tab to another window each open the Invalid Directory dialog again.
- The progressions folder field next to it validates on change (`:968`), which avoids this.
- The field and its Browse button share one paragraph (`index.html:667-671`), so browse mode reads
  them as one line. `verify-button-rows.mjs` only looks for two buttons on a line.

#### 16. The Metronome's Tempo and Volume fields have no inputmode

Area: accessibility, phones. Established: driven.

- `src/renderer/renderer.js:6977-6985`. Every other number field has it.
  `docs/eyesunstrung-site-and-web-app.md` says a new number field needs it, or iOS shows the full
  keyboard.

#### 17. features.md against the app

Area: docs. Established: by comparison.

- `:588` gives the metronome line as "Clicks on 1 strong down, 2 down, …". The app says
  "1 high strong down" (`src/shared/metronome.mjs:102-121`).
- `:98` says spaceBar opens the menu; see finding 6.
- `:156` says each beat gives strings and frets; see findings 2 and 3.
- `:134` and `:260` say nothing of swing being played straight; see finding 5.
- `:412` and `:506` call the section "Playback"; it has been Playback Settings since 2026-10-28.
- The built help matches `user-docs/` exactly, every heading level is in order, and the files
  follow the style rules. One line holds two sentences, a quotation, at `:214`.
- In the app's own text, keys are written three ways: "Ctrl+O" (`index.html:109`), "Control+I"
  (`index.html:355-359`), "Space" and "Up arrow" (`renderer.js:7040-7045`), against "spaceBar"
  and "upArrow" in the Playback Keys dialog (`renderer.js:3530-3541`).

#### 18. Web version: a full cache stops a sample that was fetched from playing

Area: web build. Established: traced.

- `src/web/platform.js:273` awaits `cache.put`. If the browser refuses for want of space, the
  error is thrown although the bytes are in hand.

#### 19. A hung page cannot be closed while a progression is unsaved

Area: robustness. Established: traced.

- `src/main/main.js:835-839` cancels the close and waits for the page to answer. If the page has
  stopped responding, the window stays.

## Accessibility: what still needs NVDA

None of this was heard. These are the places worth a hands-on check:

- What is read on opening Guitar Samples, Chord Practice, Frets to Chord and About (finding 14).
- spaceBar on the Menu button in focus mode with a track open (finding 6).
- A track with lyrics on the guitar staff, and one with a second voice (findings 2 and 3).
- Whether nvdaKey+end reads the status bar in the web version, as `features.md:74` says.
- Whether `aria-keyshortcuts` is read on Open File and Open Saved Progression.
  `docs/browser-parity-layout.md` records it as untested.
- "Loading the guitar samples for this track…" then "Samples loaded.": both go to one status
  line a moment apart.

What the driven run found in order, with a song and a progression open, and then the Chord
Library, Metronome, Strumming Patterns and a Help document: no duplicate ids; every control has a
name; every `aria-controls`, `aria-labelledby`, `aria-describedby` and label points at something;
no positive tab index; heading levels in order. The seven dialogs opened from the menu each return
focus to the Menu button on escape. escape pressed twice in the editor with changes keeps it open.

## Architecture

Sound. Nothing here blocks the web build.

- `src/shared` has no reference to `document`, `window`, `require`, `node:`, `process`, `fetch` or
  Web Audio. Checked by search.
- The renderer reaches the platform only through `window.unstrung`. Every method it calls exists
  in `preload.js` and in `platform.js`, except `pickProgressionFile`, which is web only and is
  called only where `fileAccess` is false.
- The reverse reach exists: `src/web/platform.js:74-77`, `:93` and `:408` read the page's
  `#status` and `#open-items-list` by id. It works, but the platform now depends on the page's
  markup.
- `main.js` and `platform.js` each hold their own copy of the folder scan, `safeFileName`, the
  round-robin choice and the pattern validation. `main.js` already imports `sampleMap.mjs` from
  `src/shared`; the rest could go the same way.
- `npm run build:web` was not run in this review.

## Security

No serious finding.

- `contextIsolation` on, `nodeIntegration` off, `sandbox` on (`src/main/main.js:825-830`).
  Navigation is refused and new windows denied (`:844-845`).
- Outside links go through an allowlist built from the page's own links and the Help documents
  (`:34-50`), http and https only.
- The IPC surface is narrow. A recent file is opened only if it is on the list (`:554-559`). A
  progression is read only from inside its folder (`:430-437`) and overwritten without a dialog
  only if this session opened or saved it (`:466-468`).
- The page's policy is `default-src 'self'` with blob media. Help content is escaped before it is
  made into HTML.

Hardening, each low:

- No permission handler is set, so Electron would grant any permission the page asked for. The
  page asks for none today; guitar input will.
- Electron fuses are not set, so the installed program can be run as plain Node with
  `ELECTRON_RUN_AS_NODE`.
- `UNSTRUNG_TEST_PROFILE` (`:54-58`) is honoured in the released app.
- The installer is not signed, so Windows SmartScreen warns on install.

## Build and release

- There is no `test` script and no CI. There are 69 scripts under `scripts/`, most of them checks,
  and the eight that need only Node pass in about six seconds. Nothing runs them together, and
  nothing runs before a release.
- The pre-commit hook rebuilds the help and the chord library, which is why they are in step. It
  is switched on by a local git setting (`core.hooksPath`), so a fresh clone does not have it. A
  `prepare` script would set it.
- `build/icon.ico` is ignored by git and `npm run dist` does not make it. A fresh clone builds an
  installer with Electron's own icon unless `npm run build:icons` is run first.
- A release is several steps by hand: version, `dist`, `build:web`, three assets, the notes
  copied to `docs/release-notes-history.md`, the site workflow, the check of the site. A script
  that at least checks the three assets exist and carry the same version would catch a slip.
- The packaged app includes `src/renderer/renderer.js` and `menu.js` as well as the bundle built
  from them. Harmless, about 400 KB.
- `allowScripts` in `package.json` is not a key npm reads.

### Tests worth adding first

1. `npm test`, running the Node-only checks that exist. No new code, and it gives a release a gate.
2. A corpus test of `buildAudioTrack`: no completed beat may use a hidden diagram, and every beat
   of a bar must fall inside that bar. Covers findings 1 and 4.
3. A golden text of `extractScoreMetadata` for each file in the corpus, compared on every run.
   It would have caught findings 2 and 3, and catches any change to how a song reads.
4. One Electron smoke test for the keys: spaceBar on the Menu button, and a setting surviving a
   reload. Covers findings 6 and 7.
5. The web build opened in Playwright's WebKit: open a song through the upload field, play a
   progression. Nothing checks that path now.

## Code quality

- `src/renderer/renderer.js` is 8,511 lines. The audio track, chord practice, Chord Library,
  metronome, editor and media session would each stand as a file; esbuild bundles them the same.
- Ten dialogs each repeat the same opener variable, close handler and focus return.
- The audio track and chord practice share the scheduler but each has its own keydown handler,
  tempo stepping and count-in.
- alphaTab's brush and pick values are spelled out in three shared files; note names in three.
- Dead code: the pitch functions in `src/shared/spokenPhrases.mjs` (`foldedSemitones` and three
  more), left from Speak the Notes; the paths for a chord with no fingering
  (`renderer.js:1167`, `:1320`, `:4439`, `songScore.mjs:86`), since all 854 chords now have one.
- Stale comments: `spokenPhrases.mjs:1-10` ("Nothing uses this yet"); `renderer.js:6216` (80
  beats a minute, it is 60); `renderer.js:7138` ("the menu's Close Tab"); `renderer.js:761`
  ("random take").
- Song Summary and About the Audio Track say "Bars"; everything else says measures.

## The five to fix first

1. Stop the audio track playing the hidden placeholder shape (finding 1). One condition, and it
   is wrong notes in three of Joel's own songs.
2. Read a guitar track with lyrics as tablature (finding 2).
3. Say when a measure has a second voice, then describe it (finding 3).
4. Keep a pickup measure's clicks inside it, count-in included (finding 4).
5. Add `npm test` over the existing checks, with the corpus test for the first four, so they stay
   fixed.

After those: spaceBar outside the item (6), the voice setting at startup (7), and swing (5).
