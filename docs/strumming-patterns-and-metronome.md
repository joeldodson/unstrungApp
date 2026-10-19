# Strumming patterns and a configurable metronome

A record of the design discussion begun 2026-10-14. What has been built since is recorded in the
dated sections near the end: Stage 1, the built-in patterns, your own patterns, and the Metronome
item.

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

Changed on 2026-10-14: patterns a player makes are to be kept in settings instead; see Built-in
patterns and choosing one. The original decision:

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
- **Announcing them.** `b` says the measure's chords as the editor writes them, then the beat
  playback is on: "Measure 5 of 8, G C@3, beat 2, play 1". The beat says which chord is sounding
  without reordering the chords. Decided 2026-10-15, from Joel's own suggestion, replacing the
  first decision, which put the chord sounding first: "Measure 5, C, after G on beat 1". That one
  changed order depending on when b was pressed, which made it hard to follow. Measures with one
  chord get the beat too, so every answer has the same shape. Whether NVDA says "@" as "at" at
  Joel's punctuation level is for him to hear; "C at 3" is the fallback.

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

Choosing a pattern was not built in this stage; it followed the same day, with the built-in
patterns. Per-measure patterns are still to come.

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

## Built-in patterns and choosing one (2026-10-14)

Joel asked for patterns that ship with unstrung, working in the browser too, starting with all
downstrokes on the beat and down-up on every beat, then the five to seven most common for each
common time signature, named the way guitar terminology names them. Making and editing patterns
comes later.

- **The library** is `BUILT_IN_PATTERNS` in `src/shared/strummingPatterns.mjs`, plain data in the
  bundle, so the browser has it with nothing to fetch. 4/4 has eight, 3/4 five, 6/8 six, 2/4
  three, 12/8 four. Every list starts with Down Only and All Down-Up, and any other time
  signature gets those two, made for it (`patternsFor`). In compound time All Down-Up alternates
  on the eighths, since the beat is already an eighth.
- **Where they came from.** Beginner lessons and forums agree on the core: Old Faithful,
  D DU UDU, is the most taught strum, also called the Island Strum; four downs; straight down-up
  eighths; boom-chicka, D DUD DU; chucks on the backbeat; reggae upstrokes on the ands. In 3/4 the
  usual first pattern is down, down-up, down-up. In 6/8 the weight goes on 1 and 4: two downs, or
  DUD DUD. Three-Three-Two is Joel's own example. Sources consulted included Wikipedia's Strum
  article, the JustinGuitar community, Good Guitarist, Acoustic Guitar's boom-chuck lesson and
  fachords.
- **Notation** stays the slot-by-slot form: `D - D U - U D U`. Teachers also write it grouped by
  beat, D DU UDU, which the descriptions use, but that form cannot say where a miss falls.
- **Each pattern is written on its coarsest grid**, so a pattern read back from a score, which
  always comes back coarsest, compares equal; `check-song-score.mjs` checks this.
  `namedPatternLike` names any pattern with the same strokes.
- **Down Only replaces "Every beat, down"** as the name of chord practice's old strum.
- **Choosing.** The Chord Practice dialog and the progression editor each have a Strumming pattern
  list after the time signature, refilled when the time signature changes, keeping the choice by
  name where the new list has it. Options read as name and strokes: "Old Faithful: D - D U - U D U".
  The editor starts on the progression's own pattern; one from a file that matches no built-in is
  offered as "This progression's own".
- **The Metadata line** gives the name and the strokes, which are what a player needs to play
  along.
- **Saving.** A progression keeps its pattern as the strokes written out in the alphaTex file, as
  before; nothing records which built-in it was, since the strokes name it again. Patterns a player
  makes are to be kept in unstrung's settings, which are the app's settings file on the desktop and
  the browser's local storage on the web, as name, time signature and strokes in this notation.
  Not built yet.

### Trying patterns while it plays (2026-10-15)

Joel asked to try different patterns on a progression without editing and saving it, as a
guitarist tries patterns on a song: the pattern, though written into the file, is a property to
play with.

- The Playback section has the same Strumming pattern list as the Chord Practice dialog, after the
  speak checkbox, labelled "Strumming pattern".
- Changing it lays the strums out again from where playback is, like the tempo and the metronome
  (`setChordPracticePattern`). It does not go back to the first measure as the speak checkbox
  does: the chords and samples are already loaded, so nothing has to be fetched. Joel had asked
  for the same warning as the speak checkbox; a shorter one, "Changing this rebuilds the audio",
  was tried and dropped on 2026-10-15. Beside the speak checkbox's warning it read as if the
  pattern restarted the progression too, and like the tempo it needs no explanation.
- It is not an unsaved change and closing does not ask about it, as Joel asked. Saving writes the
  pattern being played, as it writes the tempo; the editor starts on it too.
- In the file the pattern is written out measure by measure, as each chord's strokes; the
  progression in the app holds it as one setting and expands it as it plays, so nothing has to be
  regenerated to change it.

## Making your own patterns: the design (2026-10-15)

Decided with Joel before building. Replaces "The library is files in a folder" above.

- **Built-in patterns are not editable.** A built-in name always means the same strokes, and an
  update to unstrung cannot collide with a player's edits. Copy to My Patterns makes an editable
  copy of one under a new name.
- **Stored in settings**: the desktop app's settings file (`app-state.json` in the app's data
  folder) and the browser's local storage, through the same `window.unstrung` settings calls, so
  patterns work alike everywhere, iOS browsers included. A pattern is a name, a time signature and
  its strokes, a few dozen characters. Chosen over a folder of files, which would be reachable
  in File Explorer but would mean opening and saving one file at a time where there is no folder
  access.
- **Export and import** make up for settings being out of reach: export writes every pattern of
  the player's own to one file, import reads one back. The file is plain text, one pattern per
  line, as the lists read them: `4/4, Busy Folk: D - D U D U D U`. Readable and editable in any
  editor and by screen reader, and easy to paste into a message. Import lists each line it could
  not read, with the reason; a line matching a pattern already kept is skipped, and one reusing a
  name with other strokes is added with "(imported)" after the name. alphaTex was considered and
  set aside: a pattern is not a score, and it would be far harder to read or edit by hand.
- **Its own item.** Strumming Patterns on the menu opens an item listing the built-in and the
  player's own patterns by time signature, with Play, New, Copy to My Patterns, Edit, Delete,
  Export and Import. The Strumming pattern lists in the dialogs and under Playback include the
  player's own patterns after the built-in ones. Buttons beside each list were the alternative:
  quicker in the moment, but no one place to see, delete, export or import.
- **Strokes are typed** in one text field, as the lists show them: `D - D U - U D U`. A line under
  the field reads it back slot by slot ("1 down, and miss, 2 down, and up...") or says what is
  wrong, and Play sounds it on a chord. Slot-by-slot editing was set aside for now.
- Names must be unique within a time signature, built-in names included.

### As built (2026-10-15)

- **Shared:** `checkOwnPattern`, `formatPatternFile`, `parsePatternFile`, `mergeImportedPatterns`
  and `describeStrummingPattern` in `src/shared/strummingPatterns.mjs`; `patternsFor` and
  `namedPatternLike` take the player's own patterns too.
- **Strokes must be new as well as names.** Found while testing: an imported "Calypso" with Old
  Faithful's strokes made a progression strumming those strokes be named by whichever list came
  first. So strokes that are already a pattern in the time signature, built-in or the player's
  own, on any grid, are refused with that pattern's name: "Those strokes are already Old Faithful
  in 4/4." An import line like that is listed with the same reason.
- **Platform:** `saveStrummingPatterns`, `exportStrummingPatterns` and `importStrummingPatterns` on
  `window.unstrung`. The desktop app keeps patterns in `app-state.json` as `strummingPatterns`,
  checking their shape on load, and uses the system Save and Open dialogs for `.txt` files; the
  web version keeps them in local storage with the other settings, saves through the browser's
  Save dialog where there is one and downloads otherwise, and imports through the upload picker.
- **The item** has a Time signature select, then a Pattern select with that time signature's
  patterns, built-in first and the player's own after, each own one ending in "yours". It first
  had one native list box (`select` with `size`) grouped by `optgroup`, which NVDA made hard to
  use; see `screen-reader-findings.md`. Arriving puts focus on Time signature, and coming back
  keeps both lists where they were. What the chosen pattern is, and its strokes in words, are in a
  paragraph after the lists rather than a description, so they are not read on every visit. Edit and Delete on a built-in pattern say why not, rather than being disabled.
  Delete does not ask first: a pattern is one line, and Export is the backup.
- **Play** is a Play/Pause toggle, in the item and in the dialog. It plays G, C, D and F, two
  measures each, at 80 beats a minute with metronome clicks, round and round until Pause; each
  time round is laid out on the audio clock two seconds before it is due. In the item, choosing
  another pattern while it plays switches to it. Closing the dialog or the item stops it. It goes
  through the chord library's playback, so it stops a chord library or another preview but leaves
  a progression playing. It first played two measures on G and stopped; Joel found that too short
  to get the feel of a pattern (2026-10-15).
- **On the menu's top level**, after Chords, rather than under Chord Progressions: patterns will be
  used by more than progressions.
- **The dialog** reads the strokes back in words as the strokes field's description, updated as
  they are typed. Save puts focus on the field a problem is in.
- **Copy to My Patterns** starts the name as the original's with "(copy)" after it.
- **A gentle downbeat** (2026-10-15). Joel asked whether built-in patterns without accents should
  accent beat 1, as the most common approach. Leaning on beat 1 is common but not universal --
  rock and pop accent 2 and 4, reggae the offbeats -- and teachers write patterns without accents.
  Writing `>` into the patterns would also change their strokes, so files and the player's own
  patterns without it would stop matching them by name. Instead, playback lifts the stroke on
  beat 1 by 12 percent when a pattern has no accents of its own (`CHORD_PRACTICE_DOWNBEAT_GAIN`),
  softening nothing else; a written accent is 30 percent up with the rest 15 percent down. Chord
  practice and Play both strum through `chordPracticeStrokes`, so both have it.
- Checked by `scripts/songs/verify-strumming-patterns.mjs` and the "Your own patterns" section of
  `scripts/songs/check-song-score.mjs`.

## The Metronome item (2026-10-19)

Joel asked for a top-level Metronome item whose clicks come from the strumming patterns, built-in
and his own, with tempo, pattern and a volume of 1 to 5; a Start/Stop toggle, Faster, Slower,
Louder, Quieter and Default Tempo, which goes back to the tempo first configured; and keys for them
while the item has focus: f, s, d, upArrow and downArrow. This is the "own open item" of the
metronome decision above, with "follow the strumming pattern" as its only kind of pattern for now.
Metronome patterns of their own (the `3 0 2 1` digits and a slot list box to edit them), saved
presets, and the metronome choice in chord practice and audio tracks are still to come.

- **Shared:** `src/shared/metronome.mjs`. `metronomeLevels` gives each slot its level from the
  pattern: silent on a miss; a pattern with accents of its own has its accents at 3 and every
  other stroke at 1, so Three-Three-Two is heard in threes and twos; one without has beat 1 at 3,
  the other pulses at 2 and the strokes between at 1. The pulse is the beat, or every third eighth
  in compound time, so 6/8 is heard on 1 and 4 as decided above. `describeMetronomeClicks` says it
  in words beside the list: "Clicks on 1 strong, 2, 2 and soft...". An off-beat is named with its
  beat ("2 and"), since a bare "and" cannot say which beat it follows when that beat has no click.
  Also the tempo and volume bounds, the volume gains, and the timing arithmetic below. Checked by
  `scripts/metronome/check-metronome.mjs`.
- **Three click sounds.** The synthesized click had two, 1600 Hz for beat 1 and 1000 Hz for the
  other beats. A third, 700 Hz and shorter, is the soft click, so an and differs in pitch as well
  as loudness (`METRONOME_CLICK_TONES` in the renderer).
- **Volume.** Levels 1 to 5 set the gain of an accented click: 0.08, 0.13, 0.21, 0.34, 0.55, each
  about 1.6 times the last, some 4 decibels, so the steps sound even. Level 1 is a little under the
  beat click that plays with chord practice (0.096); level 5 leaves headroom before clipping when
  other sound plays too. A normal click is 0.55 of an accent, the ratio chord practice's clicks
  already use, and a soft one 0.35. Chosen for first testing, to be set by ear. Volume is a gain
  node in front of every click, so a change is heard at once, even on clicks already laid out.
- **Tempo** is 30 to 240, as in chord practice, starting at 80, with Faster and Slower stepping 5,
  as f and s do in chord practice and audio tracks.
- **Default Tempo** goes back to the tempo last typed into the Tempo field, or 80 before anything
  is typed; Faster and Slower leave it alone. "Originally configured" was read as what the player
  set in the field, not whatever the tempo was when Start was pressed.
- **Scheduling.** The pattern preview lays out a whole round two seconds ahead at a fixed tempo,
  which cannot take a tempo change mid-round. The metronome lays out slot by slot, 1.5 seconds
  ahead on the audio clock, topped up every 200 milliseconds; the lead covers a browser holding a
  background tab's timers to once a second. Times come from an anchor, the clock time of one slot,
  so they never drift. A tempo change sets a new anchor on the next slot, keeping that slot's
  place on the clock, and cancels only what was laid out after it; a pattern change does the same
  on the next beat, keeping the place in the measure if the time signature is the same and
  starting a new measure if not (`retimeMetronome`, `regridMetronome`). So nothing restarts the
  measure. Clicks go through their own gain node on the shared audio context, not the chord
  library's playback, so playing a chord or a pattern preview does not stop the metronome.
- **Keys.** spaceBar starts and stops, as it pauses chord practice and audio tracks. It is taken
  on keydown, so on a focused button it starts and stops rather than pressing the button; enter
  still presses it. The keys work only while focus is inside the item (not from its button in the
  list of open items), and go through `eventTargetSwallowsKey`, as the other playback keys do: in
  the lists every key belongs to the list; in the number fields digits and the arrows change the
  field while letters still reach the metronome. No other playback keys are live then, since
  chord practice and audio tracks act only when their own item is in front.
- **Announcements** go through `announceLiveRegion` into a polite, atomic live region after the
  buttons: "Started, 80 BPM.", "Stopped.", "85 BPM" (just the number, as the other tempo keys say
  it), "Default tempo, 80 BPM", "Volume 4", and at either end "240 BPM is the fastest." or "Volume
  1 is the quietest." The other playback keys say nothing at a limit; here silence would leave a
  key press unanswered.
- **The item** has Settings (Time signature, Strumming pattern, the line of clicks in words, Tempo,
  Volume), Controls (Start; Slower, Faster, Default Tempo; Quieter, Louder, in three button rows)
  and Keyboard Control. Start reads Stop while it plays, with aria-pressed, as Play Track and Play
  Progression do. The metronome keeps playing while another item is shown, stops when its item
  closes, and keeps its settings until unstrung closes; they are not saved. Changes to the
  player's own patterns refill its lists. An interruption, such as a phone call taking the sound,
  stops it rather than leaving it to resume by itself.
- **Default tempo elsewhere.** d was added to chord practice and audio tracks too, since it was a
  few lines each: back to the progression's or song's own tempo, until another is typed into the
  Tempo field. No button was added there; their tempo keys have none.
- **Checked** by `scripts/metronome/verify-metronome.mjs`, in the Electron app and, with `--web`,
  in the web build in Edge; with `--song` and a song file it also checks d in an audio track,
  since song files are kept outside the repository. It records every click the page schedules, by wrapping
  `AudioBufferSourceNode` start and stop, and checks timing and pitch from those records: one
  measure of Old Faithful at 80, the spacing after a tempo change, Three-Three-Two's accents after
  a pattern change, nothing left to sound after closing. Playwright's WebKit for Windows has no Web
  Audio, so Safari is unchecked.

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
