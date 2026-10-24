# Working on chord forms

Written 2026-10-22, for picking the chord form work up in a later session: Joel downloads a song,
asks for its chord forms to be checked, and the rules are changed where the song shows something
they get wrong, without making any song already checked worse. This will go on for a long time.

What the rules are and why is in `chord-forms-in-scores.md`. Read it first; every rule there came
from a song and a decision of Joel's, with the date. This note is how to work on them.

## What chord forms are

On a guitar track, a measure heading says which chord shape the left hand holds, where the
measure is simple enough to say it: "Measure 4 - holds C, one exception", "continues C",
"holds G, holds C at beat 3". The shape is worked out from the frets the measure plays, so a part
picked one string at a time still holds a G. The point, from Ripple's lead, is a measure picked
inside one chord saying so, rather than naming fragments of it such as G5/D. It is not to list
every chord a measure passes through: a measure with more than one change names no form.

Joel reads the app with NVDA and is a guitarist. His reading of a measure as a player is what the
rules aim at, and he decides each one. He wants decisions put to him one question at a time.

## Where things are

- `src/shared/chordForms.mjs`: finding the forms, and the heading text for each measure. Pure, no
  DOM or Node, like everything in `src/shared`.
- `src/shared/scoreMetadata.mjs`: `trackForms` runs it on guitar tracks (General MIDI 24 to 31,
  not bass); `extractMeasures` puts the wording in `measure.forms` and drops the chord symbol
  phrase there; `partialBeats` lists part-chord beats string by string; `formsTrackChords` builds
  Chords Used; `anomalies` goes on the track.
- `src/renderer/renderer.js`: the measure heading joins section, repeat, `forms` and
  `chordSymbols`; Chords Used rows add "Played in this track"; `buildAnomaliesRegion`.
- The songs: `C:\Users\joeld\OneDrive\Guitar`, in `songsterr\<artist>\` and
  `totallyGuitars\<artist>\<song>\`. They are licensed to Joel, so they stay outside the
  repository, and nothing that reproduces them is committed: no tab, no file of headings.
  `musicfiles\` in the repository holds local, ignored copies of the Ripple files, which some
  check scripts use.
- The record: `C:\Users\joeld\OneDrive\Guitar\unstrung-chord-forms-record.json`, what the app says
  about every song, measure by measure, as last accepted. It is what a change is compared against.

### Whether a rule is worth adding

Joel, 2026-10-24: the rules are a house of cards, and building them one at a time, knowing what
each one does, is the work. If a card needs one support card and the house is still stable, add
both. If adding it makes a mess, so the house falls or is too unstable to build on, leave it out
and accept a small error. Be careful of dependencies, immediate and longer term.

In practice: when a fix breaks something, look for one supporting rule. Keep the pair where the
comparison against the record shows nothing else moving and the cases pass. Where the support
needs support of its own, or the fixes start chasing each other, stop, leave the error, and say
so. Measure 108 of Into Dust is the example: a lone open E counted as an exception broke Sister
Golden Hair's F#m11, one support rule (only where it is the one such note in the measure) mended
it, and nothing else moved.

## The scripts

All take paths as arguments and print to the console. Those that print a song's measures are for
reading here only.

- `node scripts/check-chord-forms.mjs` - the rules on tracks written out by hand, one case per
  rule, with generic shapes. Fast; run it after every change. A new rule gets a new case here.
- `node scripts/gp-experiment/chord-forms-snapshot.mjs <Guitar dir> --compare <record>` - every
  measure heading, Chords Used list and anomaly that differs from the record, old and new, for
  every song. `--write <record>` records the current state. This is the regression check.
- `node scripts/gp-experiment/chord-forms-report.mjs <dir> --preview "<part of file name>" --track N [--bars A-B]`
  - the heading of each measure of one track, with the stretches holding no form and the printed
  chords' classifications. `N` is the track's place in the file.
- `node scripts/gp-experiment/chord-forms-report.mjs <dir> --guitars` - counts per track and in
  all: measures held, why spans hold nothing, how two possible forms were decided, printed
  chords agreeing or not, anomalies. `--return next|string|fretted` replays older exception rules.
- `node scripts/gp-experiment/chord-forms-inspect.mjs <file> <track> <first> [last]` - inside a
  stretch: each measure's heading, every beat's strings and frets with printed chords, and the
  spans the form finder made, with what decided them and where the exceptions are. This is where
  to look when a measure reads wrong.
- `node scripts/gp-experiment/chord-forms-anomalies.mjs <dir> [--file "<part of a name>"] [--trust | --diff]`
  - every anomaly on the guitar tracks with the beats under its printed chord's stretch, the
  forms found there and how much is in the chord's tones. `--trust` lists them with the
  `trustPrinted` experiment on; `--diff` lists every heading the experiment changes.
- `node scripts/songs/verify-chord-forms-in-app.mjs [file]` - opens the song in the app and checks
  every heading and Anomalies region against the metadata; on Ripple, also beats and Chords Used.
  Needs `npm run build:renderer` first.
- Also run after a change: `scripts/progressions/verify-track-chords.mjs`,
  `scripts/progressions/verify-section-headings.mjs`, `scripts/songs/verify-guitar-bass-tracks.mjs`,
  `scripts/gp-experiment/verify-synthetic-score.mjs`, `scripts/gp-experiment/verify-descriptions.mjs`.

## How the forms are found

In the order `findChordForms` does it. Each step's comment in the code says why it is there.

1. `trackEvents` reads a staff into measures of sounding beats: strings, frets, pitch with the
   capo taken off, hammer-on and pull-off marks, and the chords the file prints.
2. `gatherSpans` walks the track growing a form while beats fit it. A beat off it is an exception
   if one finger left the form and came back (`returns`, `keepsForm`); otherwise a new span
   starts. A one-finger change the file prints keeps its own span (`printedChange`).
3. Each span's possible forms (`candidatesFor`, where a string has two frets) are chosen between
   (`chooseForm`): the fret strummed with the shape, the form held elsewhere in the track, fewest
   exceptions, the library (not given in the app), the simpler chord. Passing notes
   (`passingNotes`) are exceptions and not part of the form.
4. A change pushed past the bar line by a common tone is pulled back to it; an unprinted
   one-finger change for a beat between two of the same form is folded into it.
5. `readWholeMeasures`: each measure read on its own. Where one form holds the whole measure
   (`playMeasure`), with exceptions that are one finger and come back, the measure holds it;
   failing that, the plain chord with one finger moving (`playMovingFinger`); failing that, for a
   measure whose notes spell no chord, the form before and the measure joined with its
   neighbours' strings. `keepPlainChord`
   keeps the plain chord's name through a run of a moving finger. The spans are rebuilt from this.
6. Each measure's runs of beats by span; each printed chord weighed over its stretch, up to the
   next printed chord, as agree, partial, differ, harmony or clash.
7. The heading: a measure names forms only for one form, or two with one change. "Continues"
   means the heading before ended on that chord. Then lengths, exception counts, and the
   "(anomaly)" and "(harmony)" labels.
8. Chords Used, counted from the forms.

The numbers to tune are `FORM_DEFAULTS`: reach 4 frets (never binds so far), exceptions at most a
third of a span's time, a melody fitting a printed chord at half its time in chord tones.

## Checking a new song

1. Put the file in the Guitar folder, under the source and artist.
2. Before changing anything, compare against the record. The only difference should be the new
   song, listed as new. Anything else means the record or the code moved since it was written:
   find out which before going on.
3. Read the new song: `--preview` for each of its guitar tracks, and `--guitars` on its folder for
   the counts. The questions are Joel's: does each heading say what the hand does? Measures
   naming nothing, many exceptions, an anomaly, a form named for a beat or two, or a name that
   changes measure to measure for the same shape are where to look.
4. Look inside a measure that reads wrong with `chord-forms-inspect.mjs`, and find which step
   above made it so.
5. Put it to Joel: what the heading says, what the notes are, and what you would call it and why.
   One question at a time. As a player, his answer is the rule. Where it is a matter of fact in
   the file, check it rather than ask.
6. Change `chordForms.mjs`, and add a case for it to `check-chord-forms.mjs`, written with generic
   shapes, never copied from the song.
7. Run `check-chord-forms.mjs`, then compare against the record. Read every measure that changed.
   Each should be better or the same reading said differently; anything worse means the rule is
   too broad. Narrow it, or put the case to Joel. Report the counts: how many measures changed,
   in which songs, and examples.
8. `npm run build:renderer`, then `verify-chord-forms-in-app.mjs` on the new song and two or three
   others, and the other checks listed above.
9. Write the decision into `chord-forms-in-scores.md`: what the song showed, what was decided and
   when, an example, and the counts. Where the wording a user hears changes, update
   `user-docs/features.md` too.
10. When Joel accepts it, write the record again with `--write`, so the next change is compared
    against this one. Commit when he says to.

## Things that have caught us out

- A rule made for one song can quietly change others. Ripple's capo part lost its one "holds Dm
  at beat 4" to the moving-finger rule; better there, but it broke a check that expected one.
  The record comparison is what shows these.
- The pre-commit hook rebuilds the in-app help from `user-docs/features.md` as it is in the
  working folder, not as staged. Splitting a change into commits that each touch
  `features.md` needs the right version of it in the folder while committing.
- A track's number in the file is not its number in the app, which lists only guitar and bass.
- Synthetic cases must use the rules as they stand: a case built on an exception can stop being
  one when an earlier rule changes, and the case needs rewriting, not the rule.
- Being in the record is not being checked. The totallyGuitars files were recorded on 2026-10-22
  without their headings being read, and the chord solo's first three measures were wrong. Read
  every guitar track of a song with `--preview` before calling it checked.
- Don't say the screen reader experience is verified. Joel checks that with NVDA.

## The songs so far, and what each tests

- Grateful Dead, Ripple (Songsterr): the lead picks through G and C; measure 4, two open G
  strings then a C with one exception, is why measures are read on their own first; measure 8 is
  G with two exceptions; the C with an open D before a G is "holds C, two exceptions". The capo
  part walks string 5 down to a B in measure 36. Mandolin, left out.
- Mazzy Star, Into Dust: fingerpicked with string 2 fret 3 held through D, C and G, which broke
  the first exception rule; a D picked without its third under a printed D; F over the open D in
  measure 109, where the C comes a measure later.
- America, Sister Golden Hair: printed Esus4 and Asus2 for a beat inside E and A; G#m spelled by
  the file; changes on the "and" of beat 4.
- Don McLean, American Pie: unprinted C to Cmaj7 for a beat; Dsus4/A measures with string 1
  moving, which name no form; vocals, piano and drums left out.
- Pink Floyd, Wish You Were Here: the 12-string part's open A walking to B under a G, decided by
  the fret strummed with the shape; Em7 as one finger moved off a G.
- Pink Floyd, Mother: a printed G where a G5 fills out.
- Mazzy Star, Fade Into You: 6/8, and pushes before the bar line.
- Kansas, Dust in the Wind, two versions: one finger moving through C, Cmaj7 and Cadd9, and Am,
  Asus2 and Asus4, which keeps the plain chord's name.
- Don McLean, Vincent: an anomaly that comes from a printed chord's stretch, not its measure.
- Grateful Dead, Ripple Chord Solo (totallyGuitars, .gpx and .gp5, the same part): a G picked
  over its first three measures, no one of which spells it alone, which is why a measure no form
  holds is tried with the form before and with its neighbours' strings.
- Glen Hansard, John Mellencamp and the other totallyGuitars files: strummed parts, mostly clean.

## Where we left off, 2026-10-24

The session of 2026-10-23 and 24, all committed, with every decision in
`chord-forms-in-scores.md`:

- The Ripple Chord Solo's first three measures: a form no measure spells alone.
- `keepPlainChord` no longer hides exceptions on a string the shape leaves out.
- Chords printed on rests are read as printed.
- `trustPrinted`: a measure under one printed chord is tried as that chord first. Joel asked for
  it after the chord solo's printed G proved right, and read every change it makes, a group at a
  time, adding rules where a reading was wrong.
- The anomaly review, `anomaly-review.md` in the Guitar folder, beside the record, since it
  describes the songs measure by measure. Its questions 1 to 3 are answered.
- The record was written again once Joel accepted everything. It now includes the three Willie
  Nelson files, which have not been read: being in the record does not make them checked.

Next, in no settled order:

- Fade Into You is slow to open: `findChordForms` takes about 13 seconds on each of its two
  acoustic guitar tracks, the same with the code as it was before 2026-10-24.
  `verify-chord-forms-in-app.mjs` times out on it after 15 seconds.
- Read every guitar track of the totallyGuitars files measure by measure, since they were
  recorded without being read, then the three Willie Nelson files.
- Wish You Were Here's measure 20 says "holds A7sus4, holds A7sus4 at beat 2", the same chord
  twice.
- Three finder bugs from the anomaly review that trying the printed chord works around: 7sus4
  not recognised, `keepPlainChord` joining G and G minor, a whole measure read as one form across
  a chord printed in its middle.
- Lead lines under a printed chord, question 4 of the review.

## Not settled yet

- Dust in the Wind's lead guitar: "holds G9, four exceptions" in measures 12 and 16, and measures
  that hold nothing, 11 and 13 in the fingerstyle version.
- The chord library is not given to the form finder in the app, so its rule for choosing between
  two forms never decides; it did in 1 span of 302 in the report.
- Reach is 4 frets and has never been what rejects a form; it could be 3.
