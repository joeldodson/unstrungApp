# One player for songs and progressions

Notes from 2026-11-12. Nothing is built yet. Every difference under Decisions was put to Joel one
at a time the same day, and each now records which way the combined player goes. The next step is
stage 2 under How to build it.

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

   **Decided 2026-11-12:** two settings, the same for songs and progressions, and no 0 meaning
   until stopped. Times to play is a number, 1 to 50, default 1. Loop is a checkbox, off by
   default, toggled with l; while it is on, playback goes on until stopped whatever the number.
   Each keeps its value when the other changes.
   - Turning Loop on while playing does not interrupt anything; the count of times through goes
     on.
   - Turning Loop off while playing: if the count is below Times to play, playback goes on until
     it is reached. If the count has reached or passed it, the time through under way finishes,
     playback stops, and it says how many times it played.
   - Changing Times to play while playing restarts from the beginning of what is playing, as
     Restart does, but with the count back at 1, where Restart keeps it. Nothing tries to carry
     the old count over. Joel
     expects someone changing it has usually stopped already and wants to play anew.
   - Count in before every repeat is shown today only while Repeat is checked. It becomes an
     ordinary checkbox, always shown: simpler code, and it already applies when l turns Loop on
     from the keyboard. It has no effect when only one time through is due.
2. **Tempo range.** Track 15 to 300; chord practice 30 to 240. Both step by 5.

   **Decided 2026-11-12:** 15 to 300 for both, stepping by 5. Progressions gain the slower and
   faster ends and lose nothing they allow today.
3. **Measures to Play.** Track has a selection (Entire Song, a section, or a run of measures).
   Chord practice always plays the whole progression. Whether progressions get the selection.

   **Decided 2026-11-12:** progressions get Measures to Play, the same control as songs. With no
   sections they have First and Last measure to play only, and the summary says Entire
   Progression rather than Entire Song. If progressions ever get sections, the Section list
   comes with them.
4. **Practicing measure by measure.** Track has Play measure N and Add measure N to selection under
   each measure. Chord practice's Progression list is one line per measure as the editor writes
   it. Whether progressions get these buttons, and how they fit that list.

   **Decided 2026-11-12:** the Progression list stays a plain list, one item per measure, and each
   item gets only an Add measure N to selection button. No Play measure button, and no heading per
   measure: chord practice is meant to be the simpler view, and someone who wants to go measure by
   measure by heading can open the progression as a song. The button works as a song's does
   (`addMeasureToSelection`): a measure outside the selection stretches it to take that measure
   in, a measure inside it becomes the whole selection, it says what the selection now is, and
   anything playing stops.
5. **Speak the next measure.** Chord practice only. Whether tracks get it too, from the chords the
   file prints, and with the same rules: one beat ahead, all of a measure's chords said finishing
   before it, "repeat" for a measure like the one before.

   **Decided 2026-11-12:** songs get it, with the same rules, from the chords the file prints and
   never from its notes. Off by default for songs, on by default for progressions as now. A file
   that prints no chords shows the checkbox unavailable, with a note saying so, as chord practice
   does when speech is missing.

   A printed chord carries forward, as measure headings already say ("continues C"): a measure's
   harmony is the chord carried in from the one before plus any the measure prints. A measure
   whose harmony is the same as the one before's is "repeat"; otherwise its names are said.
   This matters for progressions too: the writer prints a name only where the chord changes, so G
   G G C saved prints G in measure 1 and C in measure 4 and nothing between. Carrying forward is
   what keeps "repeat" for measures 2 and 3. Measures before a song's first printed chord say
   nothing. A lead fill or rests under a carried chord still get "repeat", as a lead sheet's
   harmony continues there.
6. **Strumming pattern and Swing, changed while playing.** Chord practice only, and they stay
   progression settings. On one player, a change rebuilds the `Score` and carries on from the same
   place, as a tempo change does. To confirm that is fast enough to feel the same.

   **Decided 2026-11-12:** as today (`setChordPracticePattern`, `setChordPracticeSwing`): carry on
   from the same place, no count-in, the count of times through kept, unlike changing Times to
   play, which restarts. Samples and spoken names are already loaded and do not depend on the
   pattern, so only the `Score` is rebuilt. Stage 3 times the rebuild on a long progression and
   reports to Joel if the pause is noticeably longer than today's.
7. **Stopping when another item is shown.** A track's controls are inside the Measures and
   Playback section, and showing another item collapses it and stops playback, unless that
   setting is off. Chord practice keeps playing, since its controls are not in a collapsed
   section.

   **Decided 2026-11-12:** one rule for both, tied to the existing setting. With "Collapse
   expanded sections when switching to another open item" on, the default, showing another item
   pauses whatever is playing, song or progression, keeping the place. With it off, both keep
   playing. The setting's label changes to say it pauses playback too. No change for songs;
   progressions now pause on switching away unless the setting is off, which is how to keep one
   playing while looking up a fingering in the Chord Library.
8. **Where Am I.** Track: the measure, and which repeat. Chord practice: "Measure 5 of 8, G C@3,
   beat 2, play 1". Whether the track says the beat and the chords too.

   **Decided 2026-11-12:** one announcement for both, in this order:
   - The measure, against the selection as a song's is now ("Measure 9 of measures 7 through
     21"), since progressions have selections too.
   - The chords, written as the editor writes them ("G C@3"), from the printed chords carried
     forward as in 5. Left out for a song that prints none.
   - The beat, by the measure's own time signature.
   - Which time through, following 1: "play 2 of 3" when Times to play is above 1 and Loop is
     off, "play 5" while Loop is on, nothing when it plays once.

   A song's "Measure 12 on its own" stays, Play measure being a song's only.
9. **Restart.** Track: Restart Selection. Chord practice: Restart Progression. Mostly a name, and
   follows from 3.

   **Decided 2026-11-12:** Restart Selection for both, since progressions have selections now.
   Both already go back to the start of what is playing and keep which time through it is
   (restarting in the third of five plays replays the third, then two more). Both count in as the
   count-in setting says; today a progression always counts in.

### How it sounds

10. **Accents.** Chord practice plays an accented stroke 1.3 times as loud and, in a pattern with
    accents, the others at 0.85; in a pattern without, the first stroke of the measure at 1.12.
    The file writes accents (`{ac}`), but the track takes loudness only from dynamics and ignores
    them. Choices: the track learns accents, or progressions lose them. A file's accents are part of
    what it writes, so the track arguably should play them anyway.

    **Decided 2026-11-12:** the track learns accents, as its own rule that the file always wins
    says it should. An accented note plays about 1.5 times the level of the notes around it,
    keeping the contrast progressions have today (1.3 against 0.85). A heavy accent, where a
    Guitar Pro file writes one, plays louder again, the level set by ear. Songs that write accents
    change too. Chord practice's softening of unaccented strokes and its downbeat lean are
    dropped, since the file writes neither: a pattern without accents plays every stroke evenly.
    Joel judges progressions by ear in stage 4. If the downbeat lean is missed, the writer writes
    it into the file; the player does not add it.

    **Built 2026-11-12,** stage 2's third step. Each note of `buildAudioTrack` has a `level`: 1,
    `ACCENT_LEVEL` 1.5, or `HEAVY_ACCENT_LEVEL` 1.8, a first guess for Joel to judge by ear. The
    scheduler multiplies `AUDIO_TRACK_NOTE_GAIN` by it; the recording layer still comes from the
    dynamic. Over the 33 Guitar Pro files in Joel's Guitar folder, 9 tracks write accents: 2,506
    accented notes and 26 heavy ones, of 112,007. Checked by `scripts/songs/check-accents.mjs` and
    `scripts/songs/verify-accents.mjs`.

    Found while building it, for stage 3: alphaTab reads an alphaTex note with no dynamic as f,
    not mf, so a
    saved progression, which writes no dynamic, plays the f recordings on the track player.
    Decision 15 assumed mf. Stage 3 should compare the two players' levels with that in mind, and
    the writer could write mf if the f layer sounds too hard.
11. **Upstrokes.** Chord practice sweeps the top four strings, from the highest, at 0.8 of the
    level. The file writes all six strings on an upstroke, and the track plays all six at full
    level. Could be settled in the writer instead of the player: write four strings on an
    upstroke, and the track plays what is written.

    **Decided 2026-11-12:** settled in the writer. An upstroke writes the four highest strings the
    chord plays (all of them for a chord of four strings or fewer), and the track plays what is
    written; the strings below ring on from the stroke before, as on a guitar. The 0.8 level is
    dropped: the file could only write it as a dynamic, which changes recording layer, and four
    strings are lighter than six already. Joel judges it by ear in stage 4. The reader, which
    turns a saved progression back into chords and a pattern, learns that an upstroke on the top
    strings of the chord sounding continues that chord rather than starting a new one; six-string
    upstrokes in older files read as before. Song files that upstroke fewer strings, as Songsterr's
    often do, may then open as progressions where they are refused today.
12. **How long a strum rings.** Chord practice rings each strum 1.8 times the gap to the next
    stroke, then fades. The track lets each string ring until it is struck again, or the recording
    runs out (`resolveRingLengths`). This is the difference most likely to be heard: chord practice
    is drier.

    **Decided 2026-11-12:** progressions ring as songs do, by the track's rule 4, with no new
    rule now. Within a chord there is little difference, since each strum strikes the same strings
    again and cuts off the last. The difference is at a chord change that leaves strings out: G
    on six strings to D on four leaves strings 6 and 5 of the G ringing under the D for seconds,
    where chord practice fades them within about two strokes. Joel listens for that in stage 4. If
    it sounds wrong, the fix considered, for songs too, is that a strum changing the chord shape
    stops the fretted strings it does not play, while open strings ring on and an upstroke on the
    same shape stops nothing. It is held back until heard, being a guess about the hand.
13. **Mutes.** Chord practice sounds nothing for a mute and stops the stroke before it. The file
    writes a mute as dead notes (`x`); the track skips dead notes entirely, so nothing sounds and
    the strings before ring on through the mute. The second half is probably a gap in the track
    either way: a dead note stops its string on a guitar.

    **Decided 2026-11-12:** the track learns that a dead note stops its string, as the file always
    wins: a dead note says the string is damped. It still sounds nothing, there being no
    recordings of deadened strings, and strings it does not touch ring on. Progressions keep the
    gap they have now. Songs change too: Songsterr rhythm tracks write many dead-note strokes,
    which will cut the strings instead of ringing through.

    **Built 2026-11-12,** stage 2's second step. `buildAudioTrack` returns the dead notes as
    `stops`, each at its string's place in the sweep, and `resolveRingLengths` and
    `ringLengthsInRange` (moved from the renderer's `rangeNotesFor`) end a ring at the next strike
    or stop. Over the 33 Guitar Pro files in Joel's Guitar folder, 19 tracks write dead notes, and
    537 of their 31,111 notes now stop earlier. Checked by `scripts/songs/check-dead-notes.mjs` and
    `scripts/songs/verify-dead-notes.mjs`.
14. **Sweep spacing.** Chord practice spaces the strings of a strum 22 milliseconds apart; the
    track 20 (`STRUM_STRING_DELAY_SECONDS`), or the brush speed the file gives.

    **Decided 2026-11-12:** 20 milliseconds, and it becomes an app-wide setting in the Settings
    dialog: "Time between strings in a strum, in milliseconds", 0 to 50 in steps of 1, default
    20. It applies wherever a chord is strummed and the file states no brush speed; a file's
    brush speed still wins. Changing it while playing carries on from the same place, as a tempo
    change does. Today three pieces of code space a strum, and all three take the setting:
    - the track player (`STRUM_STRING_DELAY_SECONDS` in `audioTrack.mjs`): songs, and after the
      move progressions and the pattern preview;
    - the Chords item's Play (`STRUM_STRING_DELAY_MS` in `renderer.js`, `buildStrokePlan`);
    - chord practice's own strum (`CHORD_PRACTICE_STRUM_DELAY_SECONDS`, 22), until it is removed.

    **Built 2026-11-12,** stage 2's first step. The three constants are gone: `buildAudioTrack` takes
    `strumSpacingSeconds`, and the renderer's `strumSpacingMs` feeds it, `buildStrokePlan` and
    `scheduleChordPracticeStrum`. Checked by `scripts/songs/check-strum-spacing.mjs` and
    `scripts/settings/verify-strum-spacing.mjs`.
15. **Level.** Chord practice plays the mf recordings at a gain of 0.55 times the stroke's gain. The
    track picks a recording layer from the dynamic, mf when there is none. To compare by
    measurement, so a progression is not suddenly louder or softer.

    **Decided 2026-11-12:** the track's level as it is: mf recordings, absent a dynamic, at a gain
    of 0.4 (`AUDIO_TRACK_NOTE_GAIN`). Progressions play about 3 decibels quieter than chord
    practice's 0.55, and that is accepted. No measuring.
16. **A strum already ringing on restart.** Chord practice, restarting or moving mid-measure, starts
    the strums still ringing partway into their recordings, so there is no silence until the next
    stroke. To check what the track does.

    **Settled 2026-11-12, no difference:** the track does the same. The first chunk scheduled
    after any start or move includes notes already ringing, entered partway into their recordings
    (`includeRinging` in `scheduleAudioTrackChunk`).

### Timing

17. **Swing.** Chord practice times its own "ands" (`slotBeats`); the track applies the file's
    feel as alphaTab does (`tripletFeelTimes`). They agree except where a chord starts on a quarter
    of a beat, which leaves an "and" unpaired in the file and played straight by the track (Swing
    in `strumming-patterns-and-metronome.md`). After the move the track's rule is the only one,
    so that case plays straight unless the writer changes.

    **Decided 2026-11-12:** accept the track's rule. A chord starting on a quarter of a beat in a
    swung progression may leave the "and" beside it played straight; the rest of the measure
    swings. It is rare, and a sixteenth change inside a swung eighth feel is a contradictory thing
    to write. Mentioned under Swing in `user-docs/features.md` when the move is built.
18. **Feels.** Following from 17: the Swing checkbox could become a Feel list (straight and the six
    feels), since the player would play them all, and a file stating another feel or a feel in
    some measures would open instead of being refused. Joel chose one amount, on or off, on
    2026-11-11; this reopens it.

    **Decided 2026-11-12:** progressions get a Feel list in place of the Swing checkbox, since the
    work is being done anyway: Straight, then the six feels alphaTab knows and alphaTex can write
    (`\tf`): triplet, dotted and Scottish, each at eighths and at sixteenths. Triplet eighths is
    today's Swing. It is set for the whole progression, where the Swing checkbox is now: the
    Chord Practice dialog, Playback Settings and the editor.
    - As with swing, the list has a note saying when the chosen feel has no effect: an eighth feel
      over a pattern in sixteenths or in 6/8, a sixteenth feel over a pattern with no sixteenths.
      A feel is saved only where it has an effect.
    - The writer cuts notes so that the track pairs them as the feel needs, as `swungPiece` now
      does for triplet eighths: at the beat for eighth feels, at each half beat for sixteenth
      feels. `check-swung-progressions.mjs` is extended to every feel.
    - Reading: a file stating one feel throughout opens with it. A file with a feel in only some
      measures is still refused, progressions having no settings per measure, and the refusal
      says it can be opened as a song, where it plays as written.
    - The Feel list replaces the Swing checkbox everywhere it is, so the control is the same
      throughout: also the Strumming Patterns item and the New Strumming Pattern dialog, whose
      Play moves to the track player (19) and so plays any feel as it is, and the Metronome, whose
      own scheduler learns the other five feels. There, as now, it is not part of a pattern and
      lasts until unstrung closes.

### What else moves

19. **The pattern preview.** Play in the Strumming Patterns item and the New Strumming Pattern
    dialog uses chord practice's strum code. It would build a short `Score` and play it on the
    track player.

    **Decided 2026-11-12:** only the player changes. The preview builds its eight measures (G, C,
    D and F, two each, at 80 beats a minute) as a `Score` and plays it on the track player with
    Loop on, the metronome on the beats and no count-in. The Play and Pause button stays, and so
    does how it sits with the rest: the Chords item playing stops it, and it leaves a
    progression's playback alone. It picks up 10 to 14 with no work of its own, so the preview
    sounds as a progression with that pattern does.
20. **Checks.** `verify-chord-practice.mjs`, `verify-swing.mjs`, `verify-note-timing.mjs` and the
    measure and media session drivers assume chord practice's player. Each is rewritten against
    the combined one.

    **Decided 2026-11-12:**
    - Through stages 2 and 3 the existing checks keep running against chord practice's player
      (`verify-chord-practice.mjs`, `verify-measure-chords.mjs`, `verify-media-session.mjs`,
      `verify-swing.mjs`, `verify-note-timing.mjs`), so anything that breaks it shows while it is
      still the one in use. `verify-measure-practice.mjs` and `check-swung-progressions.mjs`
      already use the track player.
    - Each piece gets a check against the track player as it lands: Times to play and Loop, Add
      to selection in a progression, speaking the next measure in songs, the Feel list, accents,
      dead notes stopping their strings, and the strum spacing setting.
    - In stage 3 one comparison plays every built-in pattern on both players and compares each
      strum's time. Not levels or which strings sound, which 10 to 13 change on purpose.
    - In stage 4, once chord practice's player is removed, the old checks are rewritten against
      the track player, or dropped where a new one covers them.

## How to build it

In stages, so progressions keep working throughout:

1. Decide each item above and record it here. Done 2026-11-12.
2. Teach the track player what chord practice needs and what the decisions add: Times to play
   and Loop, spoken names, accents, dead notes stopping their strings, the strum spacing
   setting, and the Feel list. The writer's changes (four-string upstrokes, cutting notes for
   each feel) and the reader's go with them.

   Proposed order, one commit each: the strum spacing setting; dead notes stopping their
   strings; accents; four-string upstrokes in the writer and reader; Times to play and Loop on a
   song's player; carrying printed chords forward and planning speech for measures of any length;
   speaking the next measure in songs; the writer and reader for every feel; the Metronome's Feel
   list.

   Decided 2026-11-12: the Feel list in chord practice, the editor, the Strumming Patterns item
   and the New Strumming Pattern dialog waits for stage 3. Chord practice's own player plays only
   straight and triplet eighths, so another feel chosen there before the move would play wrong.
   Stage 2 builds what the list needs (the writer, the reader and the track's timing) and the
   Metronome's list, which has its own scheduler.
3. Play progressions on the track player, building the `Score` with `songFromProgression` as
   saving does. Check strum times and levels against the current player, as
   `check-swung-progressions.mjs` does for swing.
4. Joel plays progressions on the new player. Only then is chord practice's own player removed.

Joel works on main, with no branches or worktrees unless he asks.
