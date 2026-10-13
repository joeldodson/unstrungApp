# Held chords in generated progressions

Written 2026-10-12, when the option for no held chords was added.

## What Joel asked for

A 75-measure progression had many places where the same chord played twice in a row, and at
least once three times, near the end. The point of a generated progression is practising chord
changes, so he asked for a checkbox, right after Number of measures, for no held-over chords,
checked by default. He also asked for speaking the chord names to be checked by default.

## Where held chords came from

Measured over 7,200 progressions of 75 measures (200 seeds; C and G major, A and E minor; every
level and borrowing tier), counting neighbours with the same root:

- **The repeat roll** (`repeatProbability` per level, halved in 0.4.1), deliberately holding a
  chord for a second measure. Most of them: 2.6 pairs per 75 measures at advanced, 5.6 at
  beginner, of 3.0 to 6.7 pairs in all.
- **The skeleton or cadence agreeing with the chord beside it.** The transition table has no
  chord-to-itself entries, but fixed slots are placed without looking at their neighbours.
- **Secondary dominants sharing a root with the chord before them.** The A7 that points at Dm
  shares its root with an Am before it: "Am A7 Dm". So does C7 after C, D7 after Dm, E7 after Em.
- **The same root with a different quality**: G then G7 from an upgrade, or Em then E in a minor
  key (v then V).

`breakLongRuns` stops three of the same *name*, so runs of three by *root* got through: "C C C7"
(a held C, then the C7 pointing at F) and "Em Em E7" turned up dozens of times. That is the likely
source of the triple Joel heard.

## What the option does

`generateProgression(..., { noHeldChords: true })`:

- skips the repeat roll;
- `separateRepeatedRoots` goes over the degree list after the skeleton and cadence are placed and
  replaces one of any pair of neighbours whose degrees share a root (by semitones, so v and V
  count). The cadence is kept; where it would repeat the chord before it, that chord is replaced.
  The replacement is drawn from the transition row of the chord before it, and never shares a
  root with either neighbour;
- `applyBorrowing` passes the neighbours' roots to `borrowedChordFor`, which then skips a chord
  from outside the key that shares a root with either.

Roots rather than names, because G7 after G is the same chord with a finger moved, not a change
worth practising.

`scripts/check-no-held-chords.mjs` generates 25,920 progressions of 2 to 256 measures with the
option and checks: no neighbours with the same root, the length asked for, the cadence intact, and
every secondary dominant resolving. With the option off, generation is exactly as before: the same
seeds give the same progressions.

`scripts/progressions/verify-no-held-chords.mjs` checks the dialog in the app: the checkbox's
place, label and default, the speak default, and five 75-measure progressions with and without it.

Speaking the chord names is checked in the markup now. Where the recordings are missing the
checkbox is disabled and also unchecked, so it is not read as checked and unavailable.
