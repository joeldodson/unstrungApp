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
- Not started, High: 2 (lyrics on a guitar track read as pitches), 3 (second voice not described, and its printed chords missed).
- Not started, Medium: 4 (pickup measure clicks), 5 (swing played straight), 6 (spaceBar outside the item's panel), 7 (voice settings at startup), 8 (minor key named as major), 9 (window close loses editor contents), 10 (web sample cache), 11 (web failed fetch remembered), 12 (MusicXML part with no instrument).
- Not started, Low: 13 to 19.
- Not started: `npm test` over the Node checks, and the other hardening and code-quality notes.
- features.md still needs changes that go with findings 2, 3, 5 and 6, and the two wording fixes in finding 17.

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

### 6. spaceBar on the Menu button plays the track

Confirmed by tracing, with the correction set out under the verdict.
The Menu button handles only the up and down arrows itself (`menu.js:154`), so it relies on the click that spaceBar would send, and the document handler's `preventDefault` cancels that click.
`features.md:98` says spaceBar opens the menu, which holds only while no track or progression is the active item.
The review's suggestion, playback keys only while focus is inside the item's own panel, keeps the August rule where it was meant and fixes the rest.

### 7. Voice and volume settings ignored until Settings or Chord Practice is opened

Confirmed by tracing.
`chordVoiceSettings` starts as Zira at 75 and is loaded only by `openSettingsDialog` and the Chord Practice setup.
The defaults disagree as described: 50 in `main.js:71` and `index.html:622`, 75 in the renderer and in `src/web/platform.js:136`.
On a fresh desktop install the Chord Library speaks at 75 until Settings is opened, though the stored default is 50.

It affects only someone who has changed the setting, or the desktop default, and only until one of those two is opened.
Low rather than Medium.

### 8. A minor key is named as its relative major

Confirmed by tracing.
`keySignatureName` uses only the count of sharps and flats.
`songScore.mjs` writes `\ks aminor` for a progression in A minor, so unstrung's own file reads "Key signature - C" through Open File.
The fix is small: `songScore.mjs` already has `keyFromSignature` with the mode.

### 9. Closing the window discards chords typed in the progression editor

Confirmed by tracing.
The close guard at `main.js:835-839` asks only when a progression tab is marked dirty, and the editor's contents count only once applied.
escape is guarded at `renderer.js:8065-8072`; closing the window is not.

### 10. Web version: whole samples cached once per requested length

The mechanism is confirmed by tracing.
`chordSampleKey` includes the length wanted, the web platform ignores the length and returns the whole recording (`platform.js:475-485`, a deliberate choice for Opus), and `sampleBufferCache` never lets anything go.

The effect is overstated, as set out under the verdict.
The desktop app has the same cache that never lets go, but its trimmed buffers are smaller.
The smallest fix is to leave the length out of the key when the platform returns whole recordings.

### 11. Web version: one failed download remembered for the visit

Confirmed by tracing.
`sampleMap`, `voices`, `speechManifest` and `getChordLibrary` keep their first promise, failed or not, and three of them do not check `response.ok`.
`fetchAudio`, for the samples themselves, does check and does not keep a failed promise.

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
