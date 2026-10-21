# Chord forms held through a score

Written 2026-10-20, from a discussion of the lead track of Grateful Dead's Ripple in the Songsterr
corpus. Not built yet.

## What Joel noticed

Ripple's lead part picks through open chord shapes. Its first measures can nearly all be played
with the left hand holding a G, with one note off it. unstrung described them otherwise:

- A beat on open strings 3 and 4 read "G5/D", and two strings of an open C read "C5/G".
- Chords Used listed G5 and C5 among the track's chords, and their rows showed the library's G5 and
  C5, which are movable power-chord shapes the part never plays.

None of those names is in the file. The track prints one chord symbol, a G, in its last measure.
The names come from `describeChordedBeat` in `src/shared/scoreMetadata.mjs`, which names a beat from
its own notes and nothing around it. G and D alone spell G5, so that is what the beat is called.
`extractTrackChords` counts every beat it can name, so G5 was the third chord of the track, at 32
beats.

## Why not add G5/D to the library

The library is keyed by root and suffix, and Chords Used already drops the bass, so G and G/B are
one chord to learn. An open G5 voicing would be a fair addition on its own, since the library has no
open-string power chords, but the beat would still be named as a chord apart from the G the hand is
already holding. That is the problem, and a library entry does not touch it.

## Held forms

The question to answer is whether the left hand moves, not which chord a beat's notes could spell.

### Finding the form

A form is the shape the hand would have to hold for a span of beats: every string and fret those
beats play, taken together. No single beat has to sound the whole chord, so a part that only picks
through a G still holds one. The frets are the file's own, not a library voicing, so a player's
variant such as x20003 is matched as played.

The frets taken together are a form when:

- each string is played at one fret, apart from exceptions (below);
- the frets are within a hand's reach, not counting open strings;
- their notes spell a chord `identifyChordFromNotes` recognises.

A span that fails, such as a scale run or a moving melody, is described beat by beat as now. Nothing
is guessed.

### How long a form lasts

A form carries across bar lines for as long as the beats keep fitting it, and grows as new strings
appear: a G whose low strings sound in one measure and high strings in the next is one G. Joel's
comparison is sheet music, which shows a chord form only where it changes. Where a track opens with
partial beats and no form yet, they look ahead to the first form that fits them.

Carrying a form means a measure's heading depends on the measures before it. A measure of two open
strings can say "continues G" because the G was established earlier. Worked out alone it would say
G5, which is the mistake this replaces.

### Exceptions

A note off the form, on a string the form already uses, is an exception when the next sounding beat
fits the form again. The form is interrupted, not contradicted, since the two frets on that string
cannot sound together. Joel's own example: holding G, the finger on string 6 fret 3 moves to string
5 fret 3 for one note and goes back.

A hammer-on and pull-off that leave the form and return to it are one exception, not two.

The form ends instead where the beats after an off-form note fit a different form, or where off-form
notes follow one another and the form does not come back.

### Choosing between two forms

Where one string is played at two frets in a span, either could be the form and the other the
exception. A measure of C with string 4 played open twice and at fret 2 once could be C (x32010)
with two exceptions or Cadd9 (x30010) with one. Joel would hold the C. In order:

1. The form the track holds in other measures, or, if both are, the one it holds in more.
2. The form with the fewest exceptions.
3. The form matching a voicing in the library.
4. The simpler chord.

The first needs two passes over a track: measures with only one possible form, then the ambiguous
ones decided from them. Counting time alone would have chosen the Cadd9.

## What a measure says

- Where a form is established: "Measure 1, holds G".
- Where it carries in from the measure before: "Measure 2, continues G".
- With exceptions: "holds G, one exception", "continues G, two exceptions". Where they fall is left
  to the beats. This was chosen over "exception at beat 4" to keep the heading short, and so that
  it does not matter whether a position counts notes or beats.
- A change partway through: "continues G for 2 beats, one exception, holds C at beat 3". Each form
  has its own count of exceptions straight after it.
- A form that ends with no new one after it: "continues G for 2 beats", or "holds G for 2 beats"
  where it was established in that measure.

Positions and lengths are beats of the time signature, as chord symbols already are: "at beat 3",
or "during beat 3" for a change between beats.

### Beats inside a form

Beats keep their strings and frets. A partial beat no longer names a piece of the form, so open
strings 3 and 4 read "strings 3 and 4, open" rather than "G5/D". A beat sounding the full chord
still names it. An exception beat reads as it always has: the heading has already said there is
one.

## Printed chord symbols

The file's symbol is weighed against the form the notes hold:

- **They agree.** Our wording, with the file's spelling: "holds G#m" rather than "holds Abm", since
  the file follows the key signature.
- **The symbol is G, but the notes hold G for only part of the measure.** Our wording, saying what
  the notes do.
- **The notes hold no form, but fit the symbol.** A melody over the harmony, as on a lead track. The
  chord is given without "holds": "Measure 40, G (harmony)".
- **The notes hold another form, or hold none and clash with the symbol.** The file's chord with
  "(anomaly)": "Measure 12, G (anomaly)".

The notes fit the symbol when its chord tones fill at least half of the measure's sounding time and
the note on beat 1, if there is one, is a chord tone. Time rather than a count of notes, so a quick
run between two held chord tones does not outweigh them; beat 1 on its own because a clash is
heard most there. A suspension held over the symbol would fail it, so the threshold is to be run
over every printed symbol in the corpus, and the measures it flags read, before it is relied on.

### Anomalies

A track with anomalies gets a collapsed region after Chords Used and before the measures, summarised
"Anomalies - 3" as Chords Used is, with one item per measure: "Measure 12: the file prints G, the
notes hold Em". A track with none has no region, so it does not add a stop to every track.

## Chords Used

Beats in a form count towards its chord, not towards the fragments they would spell alone, so G5
and C5 leave Ripple's lead track.

The file is the first source of truth for fingerings: a chord's row shows the form as the track
plays it, labelled so, and the library's shapes after it where they differ. The library is used
where the file gives no form or an ambiguous one. Ripple's G is 320003 in the file, which is the
library's first G.

## Left to settle when building

- What a hand's reach is, in frets.
- How the anomaly and harmony tests come out across the corpus, and whether the half-time threshold
  holds.
- Checking every rule against all the corpus files and the other files in Joel's Guitar folder, not
  Ripple alone. `scripts/gp-experiment/` has the scripts that read them; the corpus stays outside
  the repository.
- `user-docs/features.md`, for the new wording and the Anomalies region.
