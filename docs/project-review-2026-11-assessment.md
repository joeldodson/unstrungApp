# Assessment of the November 2026 project review

A check of `project-review-2026-11.md`, the review Fable 5.2 wrote of unstrung 0.10.2 at commit 03d8743, done by Claude Opus 5.5 on 2026-11-10.
Each finding was checked against the code, and findings 1 to 5 were run again over the same 37 song files.
Nothing in the app was changed by the assessment itself.

## Status

Kept up to date as findings are dealt with.
Last updated 2026-11-11.

- Done: finding 1.
  Chord filling was removed altogether on 2026-11-10, so playback plays exactly the notes written.
  That also settles the review's two related points, learned voicings and the capo.
- Done: finding 2, 2026-11-11.
  The sung branch was removed from the beat descriptions, so a guitar track carrying words reads strings and frets, and names chords, like any other.
  Its words are still read with each measure.
  Checked in `scripts/gp-experiment/verify-synthetic-score.mjs`.
- Done: finding 4, 2026-11-11.
  A pickup clicks only on its own beats, counted from its end, and is counted in with a whole measure and then the beats before it (Joel's choice).
  Recorded in `measure-practice.md`, Pickup measures, and checked by `scripts/songs/check-pickup-clicks.mjs`.
- Done: finding 3, 2026-11-11.
  Each voice after the first is one line after the words, "Voice 2: half note, string 6, fret 3, at beat 1; ...", and voice 1 is read beat by beat as before.
  Printed chords in voice 2 were left alone: no file has one.
  Decided with Joel; the outcome is under finding 3 below.
- Done: finding 5, 2026-11-11.
  Playback swings a bar whose file states a triplet feel, every feel alphaTab has, exactly as alphaTab's MIDI generator does.
  Checked by `scripts/songs/check-triplet-feel.mjs`; the outcome is under finding 5 below.
- Done: finding 6, 2026-11-11.
  A track's and a progression's playback keys act only while focus is in that item, as the metronome's always have, so the Menu button and the list of open items keep their own keys.
  Checked by `scripts/songs/verify-keys-stay-in-item.mjs`; the outcome is under finding 6 below.
- Done: finding 7, 2026-11-11.
  The voice and volume are read at startup with the screen reader settings, and the default is 50 everywhere.
  Checked in `scripts/speech/verify-chord-voice-settings.mjs`; the outcome is under finding 7 below.
- Done: finding 8, 2026-11-11.
  Song Summary names a key the file marks minor as "A minor"; a major key still reads "C".
  Checked by `scripts/songs/check-key-names.mjs`; the outcome is under finding 8 below.
- Done: finding 9, 2026-11-11.
  Closing the window with changes in the progression editor asks Save, Don't Save or Cancel, as a tab's unsaved changes do (Joel's choice).
  Checked by `scripts/progressions/verify-editor-quit.mjs`; the outcome is under finding 9 below.
- Done: finding 10, 2026-11-11.
  On the web the Chord Library decodes each recording once per pitch and loudness, as an audio track does, instead of once per length wanted.
  Checked by `scripts/audio/verify-chord-sample-cache.mjs`; the outcome is under finding 10 below.
- Done: finding 11, 2026-11-11.
  The web version forgets a failed download, so the next request tries again, and the Chord Library says when it could not load and tries again when chosen from the menu.
  Checked by `scripts/web/verify-failed-fetch-retry.mjs`; the outcome is under finding 11 below.
- Not started, Medium: 12 (MusicXML part with no instrument).
- Not started, Low: 13 to 19.
- Not started: `npm test` over the Node checks, and the other hardening and code-quality notes.
- features.md still needs the two wording fixes in finding 17.
  The swing it lacked, finding 17's lines 134 and 260, was added with finding 5, and its line 98 on spaceBar opening the menu is true again since finding 6.

## Verdict

The review is accurate.
Every finding describes what the code does, and every count that was checked again matched exactly.
Nothing in it is a misunderstanding of the code.

Two findings misread or overstate the intent or the effect:

- Finding 6 treats spaceBar playing from any button as an oversight.
  It is a rule chosen on 2026-08-01, recorded in a comment at `renderer.js:3582-3584`: "pausing has to be dependable, and Enter still presses the button."
  The bug is real, but it is narrower than reported: the rule predates the Menu button, the Close buttons and the Measures to Play summary, and now catches them too.
- Finding 10 says a long Chord Library session on a phone grows until the browser reloads the tab.
  The mechanism is right, but playing the same chords again reuses the cached copies.
  The cache grows with each new chord and stroke sequence, not with time.
  It was not measured.

Some severities could be argued, set out under each finding below.
One related problem was found that the review does not mention, under finding 3.

## How it was checked

- A Node script parsed the four files in `musicfiles/` and the 33 under `OneDrive\Guitar` with alphaTab, then counted completed chord beats and hidden diagrams, lyrics on guitar tracks, sounding beats outside the first voice, measures shorter than their time signature, and triplet feel.
- alphaTab's own source in `node_modules` was read for how it works out pitch with a capo and where it applies triplet feel.
- Everything else was traced in the code.
  Nothing was driven in the app, and nothing was heard with NVDA.

## Findings

### 1. Songsterr placeholder chord played in place of the written notes

Confirmed by running it.

- 337 beats were completed from a chord name across the 37 files, and 213 of them used a stated diagram that the file does not show.
- All 213 are the same shape, 3 1 2 2 0 x, whatever the chord's name, so it is a placeholder.
- Into Dust, track 2, measure 1 prints D and writes D3 (MIDI 50).
  It plays 45 52 57 60 67, which is Am7, and D3 is not played.
- Per track: Sister Golden Hair track 3, 15; Into Dust track 2, 82; Wish You Were Here tracks 4, 5 and 6, 28, 44 and 44.
  These match the review.
- `docs/chord-forms-in-scores.md:111` already records the placeholder, and `chordDiagram` in `scoreMetadata.mjs` refuses it, but `statedChordVoicing` in `audioTrack.mjs` does not.
- The About the Audio Track line, "voiced as the song writes them elsewhere", is wrong in a second way the review does not mention.
  Where the file shows the diagram, the voicing is the file's diagram, not one written elsewhere in the song.

On the proposed fix: requiring `chord.showDiagram` makes these beats fall back to `learnChordVoicings`, which is the behaviour the review's second point questions.
So the fix and that question should be settled together.
Leaving a beat as written whenever the diagram is hidden and no fuller beat exists is already what the fallback does.

The capo point is right about alphaTab: `Note.stringTuning` adds the staff's capo (alphaTab.core.mjs line 6138), and `statedChordVoicing` adds only the open string.
That assumes a diagram's frets are counted from the capo, as tab frets are, which is likely but was not checked against a file.

The second related point, that the learned voicing can replace a melody note with a strummed chord, is a design question, not a bug.
The rule at `audioTrack.mjs:36-46` decides it on purpose.
The 2026-10-26 decision in `CLAUDE.md` covers what is read, not what is played, so it does not settle this.

Of the review's two examples, only Ripple Chord Solo loses a note, traced on 2026-11-10:

- Vincent.gpx measure 23 prints Am7 over C4 on string 2, fret 1.
  The Am7 learned from measure 27 is E3 G3 C4 E4 on strings 4 to 1, which holds that same C4, so nothing written is lost.
  The review's "with no A" is wrong: the second voice plays A2 on the open fifth string on the same beat, so the beat sounds a whole Am7.
- Ripple Chord Solo measure 16 (both files) prints C over two eighth notes on string 4, open D3 then E3 at fret 2, before a full C strum.
  The C learned from measure 4, a beat that prints nothing and takes its name from an earlier one, is C3 E3 G3 C4 E4.
  It frets string 4 for E3, so the open D3 is replaced by E3 and the measure's opening D to E becomes a C strum then E.
- The rule is the same in both: the learned shape replaces the beat's notes whole.
  Whether a written note survives depends on whether that shape happens to hold it.

Outcome, 2026-11-10: Joel decided that playback plays exactly what the file writes, and filling in chords was removed altogether, diagrams and learned voicings both.
This settles the placeholder, the learned-voicing question and the capo point together, since none of that code remains.
The reasoning is in `chord-forms-in-scores.md`, Playing what is written.

### 2. A guitar track carrying lyrics is read as pitches

Confirmed by running it.

- Brothers In Arms Solo, track 1, Steel Guitar, program 25: 171 beats with lyrics.
  Measure 3 reads "eighth note, D3", "eighth note, A3", and so on, with no strings or frets.
- The review's reasoning holds in the history.
  The sung branch came in on 2026-08-17 for vocal tracks; only guitar and bass tracks have been listed since 2026-10-21 (commit 7817e63).
  Since then the branch can fire only on a guitar or bass track.

### 3. Notes in a second voice are played but not described

Confirmed by running it: 306 sounding beats over 73 measures in Brothers In Arms Solo, and 63 over 34 in Vincent.gpx.

The code knows this.
The comment at `scoreMetadata.mjs:814-815` says secondary voices "are not yet covered".
`features.md:156` does not say so.

Not in the review: `scoreMetadata.mjs:492`, which collects a measure's printed chords, also reads only the first voice.
A chord printed on a beat in voice 2 is missing from the measure heading and from the track's Chord Symbols.

Outcome, 2026-11-11, decided with Joel:

- Only two of the 31 distinct files use voices.
  Vincent's voice 2 is a plain bass line, mostly half notes on strings 4 to 6.
  Brothers In Arms Solo's is busier, includes muted thumb notes and inner notes on strings 1 to 3, is not always the lowest part, and has a voice 3 in 43 measures.
  Over half its voice 2 notes fall where voice 1 strikes nothing.
- Each voice after the first is summarised as one list item after the measure's words: "Voice 2: half note, string 6, fret 3, at beat 1; half note, string 6, fret 3, at beat 3".
  Each note is described as a beat is, with "at beat N", or "during beat N" off the beat, as chord symbols are placed.
  Rests are left out, and a voice with no notes in the measure gets no line.
- Voice 1 is read beat by beat as before.
  By Guitar Pro's convention it is the main voice, and both files follow that.
- The voices are named by number, never "bass", since that would be judging the notes.
- A heading for each voice was considered and set aside: it would add two headings to each of 107 measures for what a line covers.
- Chords printed in voice 2 were left alone, since no file has one.
- Checked in `scripts/gp-experiment/verify-synthetic-score.mjs` and by reading Vincent and Brothers In Arms Solo in the app.
- A voice note in a pickup measure is placed from the measure's start, as chord symbols and section labels are, not from where the full measure would begin.

### 4. A pickup measure gets a full measure of clicks

Confirmed by running it and tracing it.

- Vincent.gpx measure 1 is 1920 ticks of 3840.
  Brothers In Arms Solo measure 1 is 1440 of 3840.
  alphaTab marks both as pickups (`isAnacrusis`).
- `buildBarMap` places as many clicks as the time signature's upper number.
  The count-in (`renderer.js:2679-2685`) lasts as long as the measure but schedules all four clicks, so the last two fall on the music.
  The metronome (`renderer.js:2915-2926`) clicks bar 1's last two beats on top of bar 2's first two.

Medium is fair.
The count-in is on by default and is heard in both files.

### 5. A swung song is announced as swung and played straight

Confirmed.
alphaTab applies triplet feel only in `MidiFileGenerator` (alphaTab.core.mjs line 43301), not in `playbackStart`, and `audioTrack.mjs` reads `playbackStart`.
9 of the 37 files carry triplet eighths, every Ripple file among them and Blue Eyes Crying In The Rain (2009).

Outcome, 2026-11-11:

- `tripletFeelTimes` in `audioTrack.mjs` gives each beat of a voice its start and length with the bar's feel applied, and `buildAudioTrack` places notes from it instead of `playbackStart`.
- It follows `MidiFileGenerator._generateBeat` and `_calculateTripletFeelInfo` exactly.
  A beat of exactly the feel's value, an eighth or a sixteenth, starting on an even pair boundary and followed directly in the same voice by another of that value, is the long half of a pair.
  Triplet8th gives 640 and 320 ticks, Dotted8th 720 and 240, Scottish8th 240 and 720, and the 16th feels half those.
  Rests take part, so an eighth rest can be the long half.
  Written triplets, dotted notes and off-beat eighths are left as written.
- All six feels are handled, though the song files carry only Triplet8th.
- The metronome and count-in are unchanged: they come from bar and beat positions, which the feel does not move.
- `scripts/songs/check-triplet-feel.mjs` builds scores from alphaTex for every feel and checks the seconds played.
  It also runs each through alphaTab's MidiFileGenerator and compares every beat's start and end with alphaTab's tick lookup.
  Over the 37 song files, all 65,803 beats alphaTab plays match; 1,082 beats in 410 bars of 9 files are moved by a feel.
- Ripple (.gp) measure 35 now sounds at 0, 0.667, 1, 1.667 and so on, in beats.
- `features.md` says, under Playing a Track, that a swung or shuffled song is played that way.
- Not changed: `readSongFromScore` in `songScore.mjs`, which reads a song into chords and strumming patterns, still reads the written, straight rhythm.
  It is not playback.

### 6. spaceBar on the Menu button plays the track

Confirmed by tracing, with the correction set out under the verdict.
The Menu button handles only the up and down arrows itself (`menu.js:154`), so it relies on the click that spaceBar would send, and the document handler's `preventDefault` cancels that click.
`features.md:98` says spaceBar opens the menu, which holds only while no track or progression is the active item.
The review's suggestion, playback keys only while focus is inside the item's own panel, keeps the August rule where it was meant and fixes the rest.

Outcome, 2026-11-11:

- `keyIsForCurrentItem` in `renderer.js` lets the track and progression keys act only while focus is in the panel of the item in front, or on the page or the main area itself, where focus rests when nothing in particular has it.
  The metronome's handler already kept to its own panel, and this is the same rule.
- The Menu button and the list of open items, with each item's button and its Close button, are outside every panel, so spaceBar opens the menu and closes an item again.
- Found while fixing it: upArrow and downArrow on the Menu button opened the menu and also restarted the selection or went back to the start of the measure, since the button does not stop them reaching the page.
  The same rule fixes that.
- The August rule is kept inside the item: spaceBar on a button there plays and pauses, and enter presses the button.
  That includes the Measures to Play summary, the review's third case, which enter expands.
- `scripts/songs/verify-keys-stay-in-item.mjs` drives the app with a short alphaTex song and a generated progression.
  With the new rule switched off it fails 8 of its 16 checks, and with it on all pass.
- `features.md` says where the keys work, under Keys and The Progression.

### 7. Voice and volume settings ignored until Settings or Chord Practice is opened

Confirmed by tracing.
`chordVoiceSettings` starts as Zira at 75 and is loaded only by `openSettingsDialog` and the Chord Practice setup.
The defaults disagree as described: 50 in `main.js:71` and `index.html:622`, 75 in the renderer and in `src/web/platform.js:136`.
On a fresh desktop install the Chord Library speaks at 75 until Settings is opened, though the stored default is 50.

It affects only someone who has changed the setting, or the desktop default, and only until one of those two is opened.
Low rather than Medium.

Outcome, 2026-11-11:

- The startup read in `renderer.js` now loads the voice and volume along with the screen reader settings, through `readChordVoiceSettings`, which the Settings dialog and the Chord Practice setup use as well.
- The default is 50 everywhere.
  It was set to 50 on 2026-08-14 (commit d1f49ff) in `main.js` and the Settings form, but the renderer's three fallbacks stayed at 75, and the web version copied 75 in October.
  The renderer now has one default, `DEFAULT_CHORD_VOICE`, and `src/web/platform.js` says 50.
  A web visitor who has never saved the setting gets 50; one who has keeps what they saved.
- `scripts/speech/verify-chord-voice-settings.mjs` now plays a chord in the Chord Library after a restart, before Settings or Chord Practice is opened.
  It checks the spoken name's gain is the saved 40 percent, and that its recording is David's, by comparing its length in samples with each voice's recording of the same name.
  Without the startup read it fails both, with Zira at 50.
- `features.md`, Settings, says the volume starts at 50 and that both apply from startup.

### 8. A minor key is named as its relative major

Confirmed by tracing.
`keySignatureName` uses only the count of sharps and flats.
`songScore.mjs` writes `\ks aminor` for a progression in A minor, so unstrung's own file reads "Key signature - C" through Open File.
The fix is small: `songScore.mjs` already has `keyFromSignature` with the mode.

Outcome, 2026-11-11:

- `keySignatureName` in `scoreMetadata.mjs` reads the bar's `keySignatureType` as well, and names a minor key "A minor", for every signature from 7 flats to 7 sharps.
  `keyFromSignature` was not reused, since it knows only the twelve keys unstrung offers and returns nothing for G#, D# or A# minor.
- A major key is still named alone, "C", not "C major".
  None of the 37 song files is marked minor, and 30 are the default C, so "major" would state a mode most files hold only by default; "minor" is always someone's choice.
- A change of mode on the same signature, C major to A minor, now counts as a key change for "changes later in the song".
- `scripts/songs/check-key-names.mjs` saves a progression in each of the 24 keys unstrung offers and reads it back as a song, and reads alphaTex and MusicXML written in the script, minor keys outside unstrung's list among them.
  Given the song files, it checks that every file marked major is named exactly as before; all 37 are.
- `features.md`, Song Summary, says how the key is named.

### 9. Closing the window discards chords typed in the progression editor

Confirmed by tracing.
The close guard at `main.js:835-839` asks only when a progression tab is marked dirty, and the editor's contents count only once applied.
escape is guarded at `renderer.js:8065-8072`; closing the window is not.

Outcome, 2026-11-11, decided with Joel:

- `syncUnsavedProgressions` tells the main process there is something to lose whenever the editor is open, as well as when a tab has unsaved changes.
  So closing the window always asks the page while the editor is open, and the page need not report every keystroke.
- On closing, `editorHasChanges` decides: a measure given or changed, the key, time signature or pattern changed, or chords typed and not yet taken.
  With none, the window closes without a question.
- With changes, the Unsaved Changes dialog asks "The progression editor has changes that are not applied. Save them before quitting?"
  Save applies them, as Apply Changes or Create Progression would, and then saves that progression; Don't Save quits; Cancel goes back to the editor.
  Joel chose this over keeping the window open with escape's message.
- Where Save cannot apply them, such as a measure with no chord, the editor says why as Apply would, and the window stays open.
- The editor is asked about before any tab, since its changes may become a tab's.
- `applyProgressionEditor` now returns the tab's state, or null where it stopped.
- `scripts/progressions/verify-editor-quit.mjs` closes the window through the main process, as alt+f4 does, in four cases: nothing typed, Cancel then Don't Save, Save to a chosen file, and Save with an empty measure.
  With the editor left out of the unsaved report, every case with changes closes the window unasked, as the review found.
- The web version is unchanged in effect: it already asks the browser to confirm leaving whenever an item is open.
- `features.md`, under Editing a Progression, says what quitting asks.

### 10. Web version: whole samples cached once per requested length

The mechanism is confirmed by tracing.
`chordSampleKey` includes the length wanted, the web platform ignores the length and returns the whole recording (`platform.js:475-485`, a deliberate choice for Opus), and `sampleBufferCache` never lets anything go.

The effect is overstated, as set out under the verdict.
The desktop app has the same cache that never lets go, but its trimmed buffers are smaller.
The smallest fix is to leave the length out of the key when the platform returns whole recordings.

Outcome, 2026-11-11:

- The platform now says whether it trims samples: `capabilities.trimsSamples`, true in `preload.js` and false in `src/web/platform.js`.
- Where it does not, `chordSampleRequestSeconds` asks for the whole recording, so `chordSampleKey` is pitch, loudness and "full".
  That is the key `loadFullSample` uses for an audio track, so the Chord Library and a track now share decoded recordings on the web.
- The desktop app is unchanged: it still asks for trimmed WAVs and keys them by length.
  Its cache also never lets go, but each entry is only as long as the note needed.
- `scripts/audio/verify-chord-sample-cache.mjs` counts decodeAudioData calls while playing C major's first voicing, again, the first two voicings together, the second alone, and the first alone once more.
  On the web build, run in Edge, they decode 9, 0, 3, 0 and 0.
  Before the fix the first play decoded 10 there, and the desktop app, which keys by length as the web did, decodes 10, 0, 11, 3 and 0.
- Nine is right for the first play: each stroke plays its last two strings at mf and the rest at f (`buildStrokePlan`), so five strings down then up sound nine pitch and loudness pairs.
- One side effect: the web Chord Library now plays one round-robin take of each pitch and loudness for the visit, where the length in the key used to fetch a different take now and then.
  An audio track has always worked this way.
- The cache still keeps everything decoded for the visit, but that is now bounded by the recordings themselves, two loudnesses of each pitch played, rather than growing with every new chord sequence.
- Nothing user-facing changed, so `features.md` is unchanged.

### 11. Web version: one failed download remembered for the visit

Confirmed by tracing.
`sampleMap`, `voices`, `speechManifest` and `getChordLibrary` keep their first promise, failed or not, and three of them do not check `response.ok`.
`fetchAudio`, for the samples themselves, does check and does not keep a failed promise.

Outcome, 2026-11-11:

- `fetchJsonOnce` in `src/web/platform.js` now fetches the sample map, the voice list, each voice's speech manifest and the chord library.
  It keeps a successful promise for the visit, so callers asking at the same moment share one fetch, but drops a failed one, so the next request tries again.
  It checks `response.ok`, where three of the four read an error page as JSON.
- Two places in the page also held on to a failure, and were fixed with it:
  - The Chord Library said "loading chord library…" for good, and choosing it again only showed it.
    `fillChordLibrary` now says "the chord library could not be loaded. Check the connection, then choose Chord Library from the menu again", and choosing it again tries again.
  - Chord Practice took a failed voice list as "no voices" and kept that for the visit.
    `ensureChordPracticeReady` now asks again until the answer is yes.
- A track's Chord Symbols list, where the library is needed for fingerings, says the library could not be loaded and to open the song again.
- Frets to Chord, Chord Practice and the samples already tried again on their next use once nothing kept the failure.
- `scripts/web/verify-failed-fetch-retry.mjs` runs the web build in Edge and fails the first request for the chord library, the voice list and the sample map, then lets the next through.
  Against the committed code before the fix, the Chord Library checks fail and Frets to Chord never opens; with the fix all seven checks pass.

### 12. A MusicXML part with no MIDI instrument is not listed

Not run again.
The code agrees: `isGuitarOrBass` goes by program alone.
Listing any staff with a string tuning would also list a banjo or a sitar, which would then play guitar samples.
Better is to list a part with tablature and no program, which is the case the review describes.
There is no MusicXML file in either corpus, so this has not been met in use.

### 13. Open Saved Progression walks the whole folder tree

Confirmed by tracing: any existing folder is accepted, and `scanProgressionFolder` goes twelve levels deep each time the dialog opens.
Low is right.

### 14. Four dialogs take focus on the dialog with a lot of text

Confirmed by tracing the markup.
This is the follow-up `docs/chords-within-a-measure.md` already suggests: "If that works, other dialogs may want the same."
About may be better read in full, since reading it is why it is opened.
Guitar Samples, at 267 words, is the one most worth a description.

### 15. The Default folder field checks itself on every blur

Confirmed by tracing.
In Chromium a field also loses focus when the window does, so alt+tab with a bad path brings the Invalid Directory dialog back on return.

The second point, that the field and its Browse button share a paragraph, is not a breach of the button-row rule.
That rule is for groups of buttons.
A label, a field and its Browse button read as one line in browse mode is reasonable, and is a matter of taste.

### 16. The Metronome's Tempo and Volume fields have no inputmode

Confirmed: `numberField` at `renderer.js:6977-6985` sets none, and `docs/eyesunstrung-site-and-web-app.md:228` asks for one on every number field.

### 17. features.md against the app

Each point checked is correct:

- `formatMetronomeClicks` and `describeMetronomeClicks` add "high" to the first click, so "1 strong down" in `features.md:588` is out of date.
- The progression's section is called Playback Settings in the code (`renderer.js:5330`, `:5414`).
  The Chord Library template still has an h3 "Playback" (`index.html:530`), which is a different item.

The point about keys written three ways in the app's own text was not checked line by line.

### 18. Web version: a full cache stops a fetched sample from playing

Confirmed: `await cache?.put(...)` at `platform.js:273` throws on a quota error before the bytes are returned.

### 19. A hung page cannot be closed while a progression is unsaved

Confirmed by tracing.
Windows can still end the process from Task Manager, so this is rare and Low.

## Architecture, security, build and code quality

Each claim checked holds:

- `src/shared` has no reference to `document`, `window`, `require`, `node:`, `process` or `fetch`.
- `src/web/platform.js` reads `#status` and `#open-items-list` at lines 75, 93 and 408.
- No permission handler is set in `main.js`, there are no Electron fuses, and `UNSTRUNG_TEST_PROFILE` is honoured in every build.
- `core.hooksPath` is set locally to `scripts/hooks`, so a fresh clone has no pre-commit hook.
- `build/icon.ico` is ignored by git (`.gitignore:163`), and electron-builder looks for it there.
- `files` in the build config packs all of `src/renderer`, sources and bundle together.
- In `spokenPhrases.mjs`, `foldedSemitones`, `playbackRateForSemitones`, `shiftedSpeechSeconds` and `FOLD_WRAP_SEMITONES` are used nowhere else.
  The header still says "Nothing uses this yet", though `trimSilence` and `spokenChordName` are used.
- The stale comments are stale.
  `renderer.js:6216` says 80 beats a minute, and `PATTERN_PREVIEW_TEMPO` is `DEFAULT_TEMPO`, 60.
  `renderer.js:7138` names a Close Tab menu item, and the menu has none.
- "69 scripts under `scripts/`" is close; there are 78 files there, some of them notes and data.

Not settled: whether npm reads `allowScripts` in `package.json`.
It was added on 2026-10-02 with ffmpeg-static.
The review says npm does not read it, and that was not checked here.

## Order of fixing

The review's five to fix first stand.
The order suggested here differs slightly:

1. Finding 1, with the decision on learned voicings made at the same time.
2. Finding 4, since the count-in is on by default.
3. Finding 2, a one-line condition now that only guitar and bass are listed.
4. Finding 3, saying a measure has a second voice, including the printed chords in it.
5. `npm test` over the existing Node checks, with the corpus test the review describes.

Then finding 8, which is small, and finding 6 scoped to the item's panel.
