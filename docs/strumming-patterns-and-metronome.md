# Strumming patterns and a configurable metronome

A record of the design discussion begun 2026-10-14. Nothing here is built yet.

## What Joel asked for

- A highly configurable metronome. The simplest case clicks on every beat. Beyond that: 4/4 with a
  louder beat 1, softer 2, 3 and 4, and different sounds on some of the ands, with any beat or and
  left out.
- Strumming patterns, written like `D - D U - U D U`, where `-` means no strum.
- The two are separate features, configured independently, with a way to say "make the metronome
  match this strumming pattern".
- Strumming patterns applied to chord practice: one pattern for a whole progression, or different
  patterns on different measures.
- The direction behind it: a chord progression as a simplified version of a song, where the verse
  might use two patterns on two chords and the chorus one pattern throughout.

## What existed when this started

- Chord practice strums every beat as a downstroke, low string to high, one chord per measure
  (`scheduleChordPracticeChunk` and `scheduleChordPracticeStrum` in `src/renderer/renderer.js`).
- The metronome is a synthesized sine click per beat, higher and louder on beat 1
  (`metronomeClickBuffer`, `scheduleMetronomeClick`). Audio tracks and chord practice share it.
- Saved progressions (format 1) hold key, mode, time signature and one chord per measure. Tempo was
  deliberately left out in 0.5.0; see `saved-progressions-design.md`.
- Guitar Pro files are read by alphaTab into its `Score`: measures, beats with durations, rests,
  notes as string and fret, chords, dynamics, pick stroke and brush (strum) direction.
  `src/shared/audioTrack.mjs` turns that into the timeline the audio track player plays.

## Direction: alphaTab is the song model

Decided 2026-10-14, after the decisions below were first made. Several of them are changed by it,
and each says so.

The strumming design had been growing a song format of its own: patterns, sections, tempo, two
chords in a measure. A beat-level song editor (add a measure, add a beat of a chosen duration that
is a rest, a note by string and fret or by name, or a chord, with accent and stroke direction)
would have needed a fourth model of a song. The cost of growing a format step by step is not the
code but the files: every version saved has to keep opening. So the end state is decided now.

- **alphaTab's `Score` is the song.** Nobody else uses unstrung yet, so format 1 progression files
  are not supported. There is no format of our own and no converter.
- **Saved as alphaTex**, alphaTab's plain-text score notation, which alphaTab both reads and writes
  (`AlphaTexImporter`, `AlphaTexExporter` in alphaTab 1.8). Text was chosen partly to keep Copy
  to Clipboard and pasting working; both were later removed (see Stage 1). Guitar Pro 7 was the
  alternative: a zipped binary. alphaTab also has `Gp7Exporter`, so Guitar Pro export can be a
  feature later.
- **The format is hidden from the player.** Generating a progression, chord practice and the
  progression editor look as they do now. Behind them, unstrung builds a `Score` in memory, and a
  file is written only on save.
- **Chord practice moves to the audio track player.** One player for songs, progressions and
  opened Guitar Pro files. That player has to learn to speak the next chord's name first.
- **Patterns are applied, not linked.** A `Score` holds the beats themselves, with no way to say "this
  measure follows the song's pattern". The editor applies a pattern to the whole song, a section or
  selected measures by writing out its strokes. Changing a pattern later means applying it again,
  as in notation software. Keeping the link would have needed our own information beside or inside
  the file: a small format of our own again.
- **Built in stages**, each writing files already in the final format: first the `Score` built from
  a progression, played by the audio track player; then strumming patterns, the metronome,
  sections, tempo and split measures; then editing measures beat by beat; then opening Guitar Pro
  files in the editor.

### Converting both ways

There will be a good deal of conversion code, all in `src/shared`, so that the player never sees
alphaTab's model:

- **Writing:** chords and patterns in, a `Score` out. The simpler half.
- **Reading:** a `Score` in, each measure's chords and strumming pattern out. A measure of G strummed
  down-up in eighths is stored as eight eighth-note beats, each holding all six notes of G with its
  own brush direction; the reader gives it back as "G, D U D U D U D U". It places each beat on the
  slot grid: a beat longer than a slot leaves the following slots as misses, since the chord rings
  through them; a rest becomes a mute; an accent becomes `>`.

Checked by parsing that measure through alphaTab and writing it back out: eight beats, brush type 2
for down and 1 for up, in order. The chord name "G" was attached only to the first beat, with none
on the other seven, so the reader carries the last named chord forward or identifies the chord from
its notes.

### A boat or a ship: everything is a song, simplified measure by measure

There is no point at which a progression stops being a progression. Everything is a song, and how
simply it can be shown is decided per measure, not per file, by an exact test rather than a guess:
read the measure into its simple form, write that back, and compare. The same beats means the simple
form loses nothing.

- **Plain:** one chord, played with the song's most common pattern. Shown as "G", as today.
- **Patterned:** chords on the grid with another pattern, or two chords in the measure. Shown as
  "G, D - D U - U D U" or "G C at 3".
- **Written out:** anything else -- single notes, bends, ties across the bar line, triplets off the
  grid. Shown beat by beat, as audio tracks already describe beats.

A generated progression is all plain measures and looks exactly as it does now. A Songsterr file may
be mostly written out. A simplified song made by hand is plain and patterned.

- **The current editor keeps working on any song.** A written-out measure is listed as "Measure 7,
  written out", and its chord field is protected: typing a chord there replaces its beats, so the
  editor asks first.
- **Spoken chord names follow chord changes, not measures.** The next name is spoken one beat
  before the change, in any kind of measure, as long as the chord is known. Each phrase is
  pre-rendered, so its length is known: when the next change comes too soon for it, that name is
  skipped. An exact rule again.
- **The metadata lists the strumming patterns found**, most common first, with their measures:
  "D U D U D U D U, measures 1 to 8; >D D D >D D D >D D, measures 9 to 16". After three it says "and
  2 others". A pattern matching one in the library or the built-in set is given its name.

### One kind of open item

Progressions and opened song files become one kind of open item: measures at their simplest level,
the chord list where it applies, spoken names, the metronome. Keeping two kinds was set aside: a
progression grown into a song would have to move from one to the other.

### A saved song does not record that it was generated

A `Score` has no field for it, and none is added. Today the difference is only information: the
level, cadence and outside-key count in the metadata, and a suggested file name such as
`Am-60-intermediate-occasional`. After this change:

- The level and the outside-key setting show until the progression is first saved, and are not
  kept. They cannot be worked out from the chords: a progression of open chords was not
  necessarily generated at Beginner.
- The key, the cadence and the chords from outside the key are worked out from the chords whenever
  a song opens, so they show for any song, generated or not.
- The suggested file name, such as `Am-60-intermediate-occasional`, still works: it is offered at
  the first save, while the level and setting are still known.
- Writing "Generated by unstrung: intermediate, occasional" into the score's notices was the
  alternative, set aside.

What alphaTex was checked for, in alphaTab's source: pick stroke `su` and `sd`, brush `bu` and
`bd`, accent `ac` and heavy accent `hac`, each read and written. `audioTrack.mjs` does not yet play
accents; it does play dynamics.

## The shared foundation: a grid of slots

Both features divide a measure into equal slots. The time signature gives the beats and a
subdivision splits each beat: eighths give "1 and 2 and", sixteenths "1 e and a". A metronome
pattern says what sounds in each slot; a strumming pattern says what the hand does in each slot.
Same grid and timing code, different contents, which is what lets them combine without depending on
each other.

The patterns, their text forms and a function turning a pattern plus tempo into timed events belong
in `src/shared`. The renderer only schedules sounds, so a web version is unaffected.

## Decisions

### Eighths and sixteenths first

The first version supports eighth and sixteenth subdivisions. Triplets and swing come later; the
grid takes them without a redesign.

### The metronome

- Each slot has a level: 0 silent, 1 soft, 2 normal, 3 accent. Text form is the digits separated by
  spaces, for example `3 0 2 1 2 0 2 1`. A slot list box, like the measures list, edits one slot at
  a time and reads "2 and, soft".
- It becomes an open item of its own, usable with no progression, with saved presets.
- In chord practice the metronome checkbox becomes a choice: off, beats, a saved metronome pattern,
  or follow the strumming pattern. Follow is a live link: it clicks wherever the pattern strikes,
  accented on the beats, and changes when the pattern does. A "make a metronome pattern from this"
  button on a strumming pattern makes an editable copy for the case where the two should diverge.
  With alphaTab as the song model, follow means clicking wherever the score has a stroke, with the
  score's accents.
- Audio tracks get the same metronome choice, without following a strumming pattern, since a file
  has its own rhythm. A metronome pattern applies only to measures in its time signature; other
  measures click every beat, as now.
- Extras were offered -- spoken counting, a speed trainer, gap training, tap tempo -- and Joel had
  no preference among them. They wait until the core is built and he has practised with it.

### Strumming patterns

- A slot is `D` down, `U` up, `-` miss, or `x` mute. A miss is the hand passing the strings without
  touching them: the chord keeps ringing. It is not silence. Silence is a mute.
- Text notation is the one guitar teachers use, `D - D U - U D U`, slots separated by spaces. Upper
  and lower case are not used to mean anything, since NVDA's "cap" announcement depends on
  settings.
- An accent is written as `>` before the stroke, the symbol sheet music uses. Whether NVDA speaks
  the `>` depends on the punctuation level, so the slot list box says "accented" in words. An
  accented strum is louder and an unaccented one a little softer, so the contrast is heard even
  when every stroke is a downstroke. A metronome following the pattern accents the same slots.
  Decided 2026-10-14 from Joel's example: 4/4, eight downstrokes on the eighths, grouped
  3 + 3 + 2 with accents on beat 1, the and of beat 2, and beat 4, written
  `>D D D >D D D >D D`, one chord per measure (D, Am, Am, Em). It ships as a built-in pattern.
- An upstroke sweeps high string to low, over the top three or four strings, a little softer. A
  miss lets the previous strum ring; the next strum cuts it.
- Mutes are in the notation and the files now. Until a muted-strum sample is found they play as a
  short damped click that stops the ringing chord.
- A pattern belongs to one time signature and is one or two measures long. A 4/4 pattern is not
  offered for a 3/4 progression.
- A two-measure pattern alternates its halves across a run of consecutive measures that use it:
  first half, second half, first half. A measure using it on its own gets the first half. Allowing
  it only on measure pairs was set aside: the editor would have to refuse odd placements and
  explain why.
- Compound time counts the written unit. 6/8 is six eighth-note slots, with sixteenths as the finer
  choice, and the default metronome accents 1 and 4. That is how tempo already counts it. Counting
  the felt beat, two dotted quarters split in three, needs triplets and changes how tempo reads, so
  it waits for triplets.
- Common patterns ship with the app. Each pattern has a Play button that strums it on a chord, with
  or without the metronome.
- Whether the guitar sounds in chord practice becomes its own switch, separate from the metronome.
  Guitar off with the metronome following the pattern is how you practise playing the pattern
  yourself.

### The library is files in a folder

Joel's own strumming patterns and metronome presets are JSON files in a folder under
Documents/Unstrung, like progressions: backed up, synced and shared as ordinary files. Where files
cannot be saved in place (every iOS browser), saving downloads a copy and opening uses the upload
picker, as for progressions.

### Progressions carry copies of their patterns

Replaced by the alphaTab direction. It was: a progression file embeds each pattern it uses. Now a
song holds only the strokes a pattern wrote out, which keeps the property that mattered: a shared
file plays the same without the sender's library.

### Layers: progression, section, measure

Changed by the alphaTab direction. It was: the most specific pattern wins, measure over section
over progression. The three remain, as what the editor can apply a pattern to. A generated
progression with no pattern chosen gets "Every beat, down", which is today's behaviour.

### Sections are labels on measures

Sections (verse, chorus) are named ranges of the one list of measures. A second verse is written out
again. Reusable blocks arranged in an order were considered and set aside: two lists to edit and
hold in mind. Repeats can be added later.

### Two chords in a measure, now

A measure can hold more than one chord, each starting at a position in the measure. Built together
with strumming patterns rather than later. In a `Score` this is ordinary: each beat carries its own
chord.

- **Entering them.** The editor's chord field takes several chords separated by spaces. Without
  beats they split the measure evenly: `G C` in 4/4 is G on beat 1 and C on beat 3. Where the
  beats do not divide evenly, the earlier chords get the extra beat, so `G C` in 3/4 is G for two
  beats and C on beat 3. A chord can be given its start: `G C@2.5` puts C on the and of beat 2.
  Beats are counted from 1, as players count them. Even split was chosen over always requiring a
  beat (more typing for the common case) and over a list of chords with a start field each (more
  Tab stops).
- **Announcing them.** `b` says the chord sounding at that moment first, then the rest of the
  measure: "Measure 5, C, after G on beat 1". Saying them in order was set aside: it leaves the
  player to work out which chord is playing now.

### Progressions save a song tempo

This reverses the 0.5.0 decision. Once a progression is a simplified song, its tempo is part of what
it is. The practice tempo starts from the saved one and can be changed without marking the file
unsaved. A `Score` carries its tempo anyway.

A JSON progression format 2 was sketched here and dropped for the alphaTab direction; it is in
this file's history (commit c447f51).

## Prototype (2026-10-14, branch song-composer)

Code with no user interface, to test the riskiest assumptions:

- `src/shared/strummingPatterns.mjs`: pattern text read and written, fitting a pattern to a time
  signature, the coarsest grid that holds a pattern, and four built-in 4/4 patterns.
- `src/shared/songScore.mjs`: a song written as alphaTex, and an alphaTab `Score` read back into
  measures. Writing produces text, so the module imports nothing from alphaTab, like
  `audioTrack.mjs`.
- `scripts/songs/check-song-score.mjs`: the checks, all passing.
- `scripts/songs/survey-song-forms.mjs <folder>`: reads every Guitar Pro file in a folder and counts
  each six-string track's measures by form, with the reasons measures are written out. The folder
  is an argument because the files worth surveying are licensed and kept outside the repository.

### What was confirmed

- **The round trip holds.** A song written as alphaTex, read by alphaTab, written out again by
  alphaTab's own `AlphaTexExporter` and read once more gives the same measures: chords, chord
  names, a chord change mid-measure, strokes, accents, mutes, ties, sections, tempo, time
  signature, and the key with its mode. `\ks aminor` keeps minor, so the mode is not lost.
- **Joel's 3 + 3 + 2 example** round-trips as plain measures with `>D D D >D D D >D D`. Accents
  are `{ac}` on each note of the beat.
- **The audio track player plays a written song unchanged.** Strums fall where the pattern puts
  them, downstrokes sweep from string 6 and upstrokes from string 1, and tied beats are sustained,
  not struck again. Moving chord practice onto that player needs no change to the player for
  this.
- **Direction is written as pick stroke** (`sd`, `su`) rather than brush, so the player spaces
  the strings as chord practice does now. A brush also carries its own speed, which made strums
  nearly chords in Guitar Pro files; see the comments in `audioTrack.mjs`.

### What changed on the way

- **A chord may change on a miss.** Old faithful, `D - D U - U D U`, has a miss on beat 3, where
  chords commonly change: the player changes there and the up on the and of 3 plays the new
  chord. The first version refused it. Now a chord's name is written on the beat where the
  harmony changes, as on a lead sheet, even when that beat only sustains the old chord, and the
  next strike plays the new one.
- **The exact test compares what is heard, not how it is spelled.** A quarter note and an eighth
  tied to an eighth sound the same, and Guitar Pro files spell rhythms many ways. Ties are
  dropped before comparing, and a rest after a rest or a mute adds nothing. Without this,
  measures from real files would almost never read as simple.
- **Chords are named by shape, then by notes.** A shape in the chord library is named from it;
  otherwise `identifyChordFromNotes` names it, which takes in partial chords and power chords.
  The score's own frets are kept either way, so a G played as a different shape stays that
  shape.
- **Each measure has its own time signature,** so one bar of 2/4 no longer affects the rest.
- **A measure of rests with nothing ringing into it is silent,** a form of its own.

### The survey

The twelve Songsterr files on hand on 2026-10-14, with 45 six-string tracks, give 5,285
measures. Of
those, 290 are plain, 1,088 patterned, 1,462 silent and 2,445 written out. Lead and fingerstyle
tracks are almost all written out, as expected. Rhythm guitar tracks read as mostly simple: the
best ones are 60 to 90 percent plain, patterned or silent. The patterns found include
`D U D U D U D U`, `D - D U - U D U`, and a twelve-slot `>D - D U D U >D - D U D U`.

Why measures were written out:

- 1,023: notes that spell no chord, which is single-note lines. Correct.
- 326: let ring. unstrung's player rings every note until its string is struck again, so let ring
  changes nothing it plays.
- 202: the chords and pattern do not say everything. 195 of these have a rest: the chord stops
  partway through the measure, and a pattern has no symbol for stopping. A mute is a sound, not
  a stop.
- 164 ghost notes, 142 beats that tie some strings and strike others, 123 that mute some and
  play others, 117 hammer-ons and pull-offs, 114 slides, 68 bends, 67 vibrato, and a few grace
  notes, tuplets, palm mutes, staccato and harmonics: real detail, correctly written out.
- 11: chord names neither the library nor the identifier knows.

## Stage 1 in the app (2026-10-14, branch song-composer)

Chord practice looks as it did. Underneath:

- **Saving writes alphaTex**, `.atex`, with the tempo and the strumming pattern. No published
  convention for an alphaTex file extension was found; `.atex` was chosen and is easy to change
  (`PROGRESSION_EXTENSION` in `src/main/main.js` and `src/web/platform.js`,
  `PROGRESSION_FILE_EXTENSION` in the renderer).
- **Opening reads alphaTex** through alphaTab's `AlphaTexImporter`, then `readSongFromScore`,
  then `progressionFromSong`, which accepts only what chord practice can show: one chord a
  measure, one pattern throughout, one time signature, chords in the library. Anything else is
  listed in the Open dialog with the reason, such as "measure 1 has more than one chord, which
  chord practice cannot show yet".
- **The JSON format is gone.** A first version still opened `.json` files from before; Joel asked
  for it removed completely, with no backward compatibility, since nobody else uses unstrung yet.
  `src/shared/savedProgressions.mjs` kept only its key helpers and became
  `src/shared/keyChords.mjs`.
- **Copy to Clipboard and Edit Progression Text are gone**, with the lenient reader behind the
  latter (`src/shared/progressionText.mjs`) and its check. They were a way to keep a progression
  where saving could not work; opening a file through the upload picker now works in iOS
  browsers, and saving there downloads a copy, so Joel removed them.
- **The file's tempo becomes the practice tempo** when it is opened.
- **Chord practice plays the pattern.** Strums come from the pattern's slots rather than one per
  beat: an upstroke sweeps the top four strings from the highest, a little softer; an accent is
  louder and, where a pattern has accents, the other strokes a little softer; a strum rings 1.8
  times the gap to the next stroke, as it rang 1.8 beats before, except before a mute, where it
  stops. Mutes sound nothing yet. "Every beat, down" sounds as chord practice did. The metronome
  and spoken names stay on the beats. Playback moving to the audio track player is still to come.
- **Metadata has a Strumming line**: a built-in pattern's name, or the pattern written out.
- **Chords with no fingering in the library** (38, all advanced) are written with frets worked out
  from their spelling (`spelledFrets`), since a score has to hold notes. Chord practice still
  plays nothing for them, as before.
- **The writer uses alphaTab 1.8's syntax**: metadata arguments in parentheses, no dot after the
  score metadata. The older form reads, but with warnings.

Choosing a pattern -- in the Chord Practice dialog, the editor, or per measure -- is not built
yet, so a pattern other than "Every beat, down" comes only from an opened file.

Checked by `scripts/songs/verify-progression-files.mjs`, which drives the real app on a scratch
profile.

Sixteen older Playwright scripts had stopped working before this began: they gave menu commands
through IPC messages the app stopped listening for when the menu moved into the page, found open
items as tabs, and made audio tracks with a Create Audio Track button that became a disclosure.
They now go through `scripts/lib/app-ui.mjs` (`launchApp` on a scratch profile, `runMenuCommand`,
`closeCurrentItem`), and all pass. Expectations that had changed on purpose were updated, each
with a comment: speaking chord names on by default (fdc09fc), Open Saved Progression and Create
by Hand on the menu rather than in the Chord Practice dialog, and dialog headings and the
unsaved-changes question as they now read (5c91d72). `verify-saved-progressions.mjs` checks
alphaTex files.

## Open questions

- A stop symbol for strumming patterns, so a chord that stops partway through a measure can be a
  pattern instead of written out. 195 measures in the survey.
- Whether let ring should be ignored when deciding if a measure is simple, since unstrung's
  player already lets every note ring. A file saved again would keep it either way.
- The writer always uses standard tuning and no capo. Songs read from files with another tuning
  or a capo need both carried through.
- The player does not yet play accents louder; it plays dynamics. Muted strums are silent: the
  "short damped click" is not built.
- A written-out measure is described only by its reason. Describing its beats, as audio tracks
  do, is the next step for a song view.
- A chord name written inside a written-out measure does not yet carry into the next measure.- Which metronome extras to build, once the core has been used.
- Triplets and swing, and with them counting compound time by the felt beat.
