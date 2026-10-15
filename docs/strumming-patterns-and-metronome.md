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
cannot be saved (every iOS browser), copy to clipboard is the fallback, as it is for progressions.

### Progressions carry copies of their patterns

A progression file embeds each pattern it uses, so copying, sharing and the clipboard keep working.
Editing a library pattern later does not change progressions already using it.

### Layers: progression, section, measure

The most specific wins: a measure's pattern, else its section's, else the progression's, else the
built-in "Every beat, down", which is today's behaviour.

### Sections are labels on measures

Sections (verse, chorus) are named ranges of the one list of measures. A second verse is written out
again. Reusable blocks arranged in an order were considered and set aside: two lists to edit and
hold in mind. Repeats can be added later.

### Two chords in a measure, now

A measure can hold more than one chord, each starting at a position in the measure. Built together
with strumming patterns rather than later.

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
unsaved.

## A sketch of format 2

Not final. Format 1 files still open.

```json
{
  "format": 2,
  "key": "G",
  "mode": "major",
  "timeSignature": { "beatsPerBar": 4, "beatUnit": 4 },
  "tempo": 96,
  "patterns": {
    "p1": { "name": "Old faithful", "subdivision": 2, "measures": 1, "strokes": "D - D U - U D U" },
    "p2": { "name": "Down on the beat", "subdivision": 2, "measures": 1, "strokes": "D - D - D - D -" }
  },
  "strumming": "p1",
  "measures": [
    { "section": { "name": "Verse" }, "strumming": "p2",
      "chords": [ { "root": "G", "suffix": "major" } ] },
    { "chords": [ { "root": "G", "suffix": "major", "beat": 1 }, { "root": "C", "suffix": "major", "beat": 3 } ] },
    { "section": { "name": "Chorus", "strumming": "p1" },
      "chords": [ { "root": "D", "suffix": "major" } ] }
  ]
}
```

A section starts at the measure that carries `section` and runs until the next one, so sections can
neither overlap nor leave gaps. `beat` is where the chord starts, counted from 1 as in the editor;
2.5 is the and of beat 2. A measure with one chord leaves it out.

## Open questions

- Which metronome extras to build, once the core has been used.
- Triplets and swing, and with them counting compound time by the felt beat.
