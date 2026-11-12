# One player for songs and progressions

Notes from 2026-11-12, written to be picked up in a new session. Nothing is built yet. The next
step is to go through each difference under Decisions, one at a time, and record which way the
combined player goes. Joel expects most to follow the audio track player, but each is to be decided
explicitly rather than assumed.

## How this came up

Swing was built on 2026-11-11 (see Swing in `strumming-patterns-and-metronome.md`). Chord practice
plays straight and triplet eighths only, so a saved progression stating any other feel, or a feel
in only some measures, is refused when opened. The same file opened as a song plays all six feels,
and feels that change partway through, because songs go through a different player. Joel had not
known there were two players, and asked why.

## There are two players, and neither is alphaTab's

alphaTab only reads files in unstrung. Its own player needs a SoundFont synthesizer; unstrung plays
its recorded guitar samples instead (see `js-synthesizer-investigation.md`). Both players are
unstrung's own, scheduling samples on Web Audio:

- **The audio track player.** `buildAudioTrack` in `src/shared/audioTrack.mjs` turns an alphaTab
  `Score` into a list of notes, and the renderer schedules them. Songs use it: Guitar Pro files,
  MusicXML, and a `.atex` file opened with ordinary Open.
- **The chord practice player.** `scheduleChordPracticeChunk` and `scheduleChordPracticeStrum` in
  `src/renderer/renderer.js` work from the progression's chords and strumming pattern directly,
  never building a `Score`. Progressions use it, and so does Play in the Strumming Patterns item
  and the New Strumming Pattern dialog (`startPatternPreview`).

The Metronome item has its own scheduler and is not part of this.

## Why there are two

Chord practice came first, built to strum a chord on each beat. The audio track player came with
reading songs. On 2026-10-14, `strumming-patterns-and-metronome.md` decided: "Chord practice moves
to the audio track player. One player for songs, progressions and opened Guitar Pro files. That
player has to learn to speak the next chord's name first." Stage 1 made progressions save as
alphaTex and noted "Playback moving to the audio track player is still to come." It was never
done. The November review (`project-review-2026-11.md`, Code quality) noted that the two keep their
own keydown handler, tempo stepping and count-in.

## Why move

- A progression plays the same in chord practice as when its file is opened as a song.
- Every feel the audio track plays, and feels that change by measure, come with no work in chord
  practice. So would different patterns on different measures, when progressions get them.
- Songs gain spoken chord names wherever the file prints chords, which suits Songsterr rhythm
  tracks.
- One set of keys, tempo stepping, count-in and repeat handling instead of two.

Speaking chord names does not need a player of its own. The phrases are pre-rendered audio buffers
scheduled on the same clock as the notes, and a saved progression already writes a chord name on
the beat where the harmony changes, so the names are in the `Score`.

## Decisions

Each is open until Joel decides it. "Track" is the audio track player, "chord practice" the chord
practice player. Where the combined player follows the track, a progression sounds or behaves
differently from today, and the entry says how.

### Playback settings

1. **How many times to play.** Track: a Repeat checkbox, once or until stopped, toggled with l;
   turning it off while repeating finishes the time through under way. Chord practice: Times to
   play, 0 to 50, 0 meaning until stopped. Joel's observation: once or continuous is the same
   setting with 1 or 0. Choices: the number for both, with 0 until stopped; or the number, with l
   switching between 1 and 0 or between the number and 0.
2. **Tempo range.** Track 15 to 300; chord practice 30 to 240. Both step by 5.
3. **Measures to Play.** Track has a selection (Entire Song, a section, or a run of measures).
   Chord practice always plays the whole progression. Whether progressions get the selection.
4. **Practicing measure by measure.** Track has Play measure N and Add measure N to selection under
   each measure. Chord practice's Progression list is one line per measure as the editor writes
   it. Whether progressions get these buttons, and how they fit that list.
5. **Speak the next measure.** Chord practice only. Whether tracks get it too, from the chords the
   file prints, and with the same rules: one beat ahead, all of a measure's chords said finishing
   before it, "repeat" for a measure like the one before.
6. **Strumming pattern and Swing, changed while playing.** Chord practice only, and they stay
   progression settings. On one player, a change rebuilds the `Score` and carries on from the same
   place, as a tempo change does. To confirm that is fast enough to feel the same.
7. **Stopping when another item is shown.** A track's controls are inside the Measures and
   Playback section, and showing another item collapses it and stops playback, unless that
   setting is off. Chord practice keeps playing, since its controls are not in a collapsed
   section.
8. **Where Am I.** Track: the measure, and which repeat. Chord practice: "Measure 5 of 8, G C@3,
   beat 2, play 1". Whether the track says the beat and the chords too.
9. **Restart.** Track: Restart Selection. Chord practice: Restart Progression. Mostly a name, and
   follows from 3.

### How it sounds

10. **Accents.** Chord practice plays an accented stroke 1.3 times as loud and, in a pattern with
    accents, the others at 0.85; in a pattern without, the first stroke of the measure at 1.12.
    The file writes accents (`{ac}`), but the track takes loudness only from dynamics and ignores
    them. Choices: the track learns accents, or progressions lose them. A file's accents are part of
    what it writes, so the track arguably should play them anyway.
11. **Upstrokes.** Chord practice sweeps the top four strings, from the highest, at 0.8 of the
    level. The file writes all six strings on an upstroke, and the track plays all six at full
    level. Could be settled in the writer instead of the player: write four strings on an
    upstroke, and the track plays what is written.
12. **How long a strum rings.** Chord practice rings each strum 1.8 times the gap to the next
    stroke, then fades. The track lets each string ring until it is struck again, or the recording
    runs out (`resolveRingLengths`). This is the difference most likely to be heard: chord practice
    is drier.
13. **Mutes.** Chord practice sounds nothing for a mute and stops the stroke before it. The file
    writes a mute as dead notes (`x`); the track skips dead notes entirely, so nothing sounds and
    the strings before ring on through the mute. The second half is probably a gap in the track
    either way: a dead note stops its string on a guitar.
14. **Sweep spacing.** Chord practice spaces the strings of a strum 22 milliseconds apart; the
    track 20 (`STRUM_STRING_DELAY_SECONDS`), or the brush speed the file gives.
15. **Level.** Chord practice plays the mf recordings at a gain of 0.55 times the stroke's gain. The
    track picks a recording layer from the dynamic, mf when there is none. To compare by
    measurement, so a progression is not suddenly louder or softer.
16. **A strum already ringing on restart.** Chord practice, restarting or moving mid-measure, starts
    the strums still ringing partway into their recordings, so there is no silence until the next
    stroke. To check what the track does.

### Timing

17. **Swing.** Chord practice times its own "ands" (`slotBeats`); the track applies the file's
    feel as alphaTab does (`tripletFeelTimes`). They agree except where a chord starts on a quarter
    of a beat, which leaves an "and" unpaired in the file and played straight by the track (Swing
    in `strumming-patterns-and-metronome.md`). After the move the track's rule is the only one,
    so that case plays straight unless the writer changes.
18. **Feels.** Following from 17: the Swing checkbox could become a Feel list (straight and the six
    feels), since the player would play them all, and a file stating another feel or a feel in
    some measures would open instead of being refused. Joel chose one amount, on or off, on
    2026-11-11; this reopens it.

### What else moves

19. **The pattern preview.** Play in the Strumming Patterns item and the New Strumming Pattern
    dialog uses chord practice's strum code. It would build a short `Score` and play it on the
    track player.
20. **Checks.** `verify-chord-practice.mjs`, `verify-swing.mjs`, `verify-note-timing.mjs` and the
    measure and media session drivers assume chord practice's player. Each is rewritten against
    the combined one.

## How to build it

In stages, so progressions keep working throughout:

1. Decide each item above and record it here.
2. Teach the track player what chord practice needs: spoken names, a number of times to play,
   accents, and whatever 10 to 16 decide.
3. Play progressions on the track player, building the `Score` with `songFromProgression` as
   saving does. Check strum times and levels against the current player, as
   `check-swung-progressions.mjs` does for swing.
4. Joel plays progressions on the new player. Only then is chord practice's own player removed.

Joel works on main, with no branches or worktrees unless he asks.
