# Chord library source

The chord shapes unstrung ships. Nothing in this folder is packaged; `scripts/build-chord-library.mjs`
(`npm run build:chords`, also run by the pre-commit hook) reads `voicings.json` and writes
`src/assets/chords/chord-library.json`, which is what the app loads. Edit the shapes here, never in
`chord-library.json`.

## voicings.json

One entry per chord, by `root` and `suffix`, with one voicing to a line:

```json
{"frets":[-1,3,2,0,1,0],"fingers":[0,3,2,0,1,0],"barres":[],"from":"chords-db"}
```

- `frets`: string 6 first. -1 not played, 0 open, otherwise the fret counted from the nut.
- `fingers`: in the same order. 1 index, 2 middle, 3 ring, 4 little, 0 for none.
- `barres`: the frets held by a barre. The build works out which strings each one covers.
- `from`: where the shape came from. `chords-db` for the 1,989 copied on 2026-11-02.

The suffix must be one `CHORD_FORMULAS` in `src/shared/musicTheory.mjs` knows. The build checks every
voicing against its chord's formula, as it did when the shapes came from chords-db, and drops and
reports any that sound a note outside the chord or leave out its seventh. Leaving out other notes,
most often the fifth, is allowed.

Voicings are ordered by the build, canonical shapes first and then lower on the neck. Where two tie,
the order in this file is kept.

## voicings-to-review.json

The 80 shapes from chords-db that did not pass in 2026-11, with the reason for each: 29 sound a note
outside their chord or have no seventh, and 51 have a suffix with no formula (alt and 7sg). The build
does not read this file. A shape moved to `voicings.json`, renamed or corrected, is checked there like
any other.

## Where this came from

chords-db (https://github.com/tombatossals/chords-db, MIT) 0.5.1 was a dependency until 2026-11-02,
read on every build. It is no longer updated in any way that reaches unstrung, so its shapes were
copied here once, frets converted from its base-fret numbering to frets from the nut, and the
dependency removed. The rebuilt library was identical apart from its `source` block. See
`docs/chord-library-maintenance.md`.
