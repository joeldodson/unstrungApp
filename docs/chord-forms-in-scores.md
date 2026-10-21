# Chord forms held through a score

Written 2026-10-20, from a discussion of the lead track of Grateful Dead's Ripple in the Songsterr
corpus. Not in the app yet. The rules are in `src/shared/chordForms.mjs`, checked on hand-written
tracks by `scripts/check-chord-forms.mjs` and measured on real files by
`scripts/gp-experiment/chord-forms-report.mjs`.

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

A note off the form, on a string the form already uses, can be an exception: the form is
interrupted, not contradicted, since the two frets on that string cannot sound together. Joel's own
example: holding G, the finger on string 6 fret 3 moves to string 5 fret 3 for one note and goes
back.

A hammer-on and pull-off that leave the form and return to it are one exception, not two.

What makes it an exception rather than a change was first put as "the next sounding beat fits the
form again". The corpus showed that is too loose for fingerpicking. Into Dust's guitar keeps string
2 fret 3 down under D, C and G while the other strings change, and an open or common note after
every change fitted the old form, so the whole song read as one form with 196 exceptions. Three
replacements were tried with the report; the one kept has two tests:

1. **The hand comes back.** The first fretted note of the form after the off note, or the string
   that left played at the form's fret, by the end of the next measure, with nothing else off the
   form first. Open strings in between are passed over, since they fit whatever the hand is doing.
   Requiring the string that left to be played again was too strict: in Joel's G nothing is played
   on string 5 again until the next measure.
2. **A new form does not explain it better.** From the off note to the end of the next measure, the
   notes are played against the old form and against a new form starting at the off note. The new
   form wins only where it spells an everyday chord within reach and leaves fewer notes off it.
   Joel's C on string 5 starts nothing that spells a chord; Into Dust's move from D to C leaves two
   or more notes off the D every measure and almost none off the C.

A note on a string the form does not use yet is off the form too, where the form already spells a
chord and the note would give it another root or none: the C on string 5 that starts Into Dust's
C chord is the next chord arriving, not part of the D.

### Choosing between two forms

Where one string is played at two frets in a span, either could be the form and the other the
exception. A measure of C with string 4 played open twice and at fret 2 once could be C (x32010)
with two exceptions or Cadd9 (x30010) with one. Joel would hold the C. In order:

1. The fret struck together with the form's other strings, over one only ever picked alone.
2. The form the track holds in other measures, or, if both are, the one it holds in more.
3. The form with the fewest exceptions.
4. The form matching a voicing in the library.
5. The simpler chord.

The second needs two passes over a track: measures with only one possible form, then the ambiguous
ones decided from them. Counting time alone would have chosen the Cadd9.

The first was added after the report, for a bass note walking past the form. The Wish You Were
Here 12-string part strums a G with string 5 at fret 2, then picks string 5 open and back to fret
2. Gsus2 is held elsewhere in that track, so the second rule chose it, and the measure read as
Gsus2. A fret struck in the chord is part of the shape; one only picked alone may be passing
through. It decides 26 spans across the guitar tracks.

### Passing notes

A note on a string the form otherwise leaves alone, picked on its own, can turn the chord into
another: an open A walking up to B under a G makes it Gadd9. Decided 2026-10-20:

- A note like that heard once in a measure is a passing note: an exception, and not part of the
  form. The G stays G, with one exception.
- One heard more than once in a measure, as part of the picking pattern, is part of the form. Sister
  Golden Hair picks the open high E seven times through a G, and that is G6.
- A note that ever sounds together with the rest of the shape is part of the form however often
  it is heard.

It covers a note that turns a major or minor chord into an add9, a 6 or a seventh. Sevenths were
first left out, since a seventh picked alone is as often a finger held down, but most of the 12 the
report then found were bass walks: a C sharp on string 5 under Ripple's D making Dmaj7, an open E
on string 6 under an F making Fmaj7, a C on string 5 under a D making D7. Sevenths were added the
same day. Of the lone notes heard once that joined a form, 2 are left, neither making one of these
chords from a major or minor one with the same root.

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
  the file follows the key signature. A form agrees when it is the printed chord, part of it, or
  all of it with notes added: a D picked without its third under a printed D is "holds D", and a
  Cadd9 shape under a printed C is "holds C". A printed chord holds until the next one, as on sheet
  music, and is weighed over all of that stretch, not only the measure it is printed in. The file's
  name goes with every beat of a form that agrees with it there, so the D's next measure is
  "continues D". Into Dust prints F over a measure of D, F and A, which alone is Dm; the C that makes
  it an F comes in the measure after, before the next printed chord, so both measures hold F. Decided 2026-10-20, after the report found 99 of
  the 185 differences on guitar tracks were of these two kinds. Passing notes the measure plays
  (below) are weighed with the form: they are not part of the shape, but they are heard, and a
  printed chord says what is heard. Without them, an F shape over open string 4 with a C heard once
  under a printed F in Into Dust read as Dm, a different chord.
- **The symbol is G, but the notes hold G for only part of the measure.** Our wording, saying what
  the notes do.
- **The notes hold no form, but fit the symbol.** A melody over the harmony, as on a lead track. The
  chord is given without "holds": "Measure 40, G (harmony)".
- **The notes hold a different chord, or hold none and clash with the symbol.** The file's chord
  with "(anomaly)": "Measure 12, G (anomaly)". A sus chord under the plain chord, such as Csus2
  under a printed C, is a different chord: the second or fourth replaces the third.

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
and C5 leave Ripple's lead track. Where the form agreed with a printed chord they count towards that
chord under the file's name, so Into Dust's D picked without its third is listed as D, not D5.

The file is the first source of truth for fingerings: a chord's row shows the form as the track
plays it, labelled so, and the library's shapes after it where they differ. The library is used
where the file gives no form or an ambiguous one. Ripple's G is 320003 in the file, which is the
library's first G.

## Measured across Joel's Guitar folder

The report was run on 2026-10-20 over the 22 Guitar Pro files in Joel's Guitar folder: the Songsterr
corpus and the totallyGuitars files. Two are byte-for-byte copies of others and were skipped. Its
output names songs and measures, so it is read on Joel's machine and not kept here. With the rules
above, on the 35 guitar tracks (General MIDI programs 24 to 31):

- 2,359 of 2,542 sounding measures hold a form.
- No held form is wider than 3 frets, and none was rejected for width, so a reach of 4 does not
  bind.
- Of 1,456 printed symbols, 915 agree, 433 partly agree (the form covers only part of the
  symbol's stretch, up to the next printed chord), 30 are harmony and 69 are anomalies. 6 are names
  the parser cannot read and 3 sit over stretches that sound nothing. Weighing a printed chord up to
  the next one moved about a hundred from agree to partly agree, since a longer stretch more often
  has a beat or two holding nothing; partly agreeing still gives the file's name to the beats that
  agree. It ended one anomaly, in Into Dust, and made one: Vincent prints G over a measure that
  holds nothing, and the measures after it, before the next printed chord, hold Dsus4.
- Two possible forms came up in 302 spans: 231 had only one that held, 26 were settled by the fret
  struck with the shape, 28 by the form held elsewhere in the track, 16 by fewest exceptions and 1
  by the library.
- Strummed rhythm parts come out cleanly: the American Pie chart holds a form in all 267 measures
  with no anomaly. Ripple's lead reads "Measure 1, holds G at beat 2, one exception", then
  "continues G"; its Chords Used becomes G, C, D and Am.

Vocals, keyboards and bass are written on string staves in these files, so the rules run on them
too and find nonsense such as a vocal line holding Esus4. Forms are meant for guitar tracks only.

## Left to settle

- **Positions between beats.** 631 guitar headings have one, such as "holds A for 5.5 beats", and
  439 measures are part held and part not: mostly a short stretch at the end of a measure that
  holds nothing, or a change that comes in just before the bar line.
- **Which tracks get forms.** Guitars only, by General MIDI program, would leave out Ripple's
  mandolin.
- `user-docs/features.md`, for the new wording and the Anomalies region, when it is built into the
  app.
