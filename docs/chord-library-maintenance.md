# Maintaining the chord library

A record of the discussion held 2026-11-02 about adding fingerings to the shipped chord library, and
what came of it. The first part is decided and built; the maintainer tool and the handling of your
own patterns and chords against new built-in ones are proposed, not built.

Related: `your-own-chords.md`, which is about chords and fingerings a player adds for themself.
Those are kept apart from the shipped library described here.

## What Joel asked for

- A utility, run only by someone with write access to the repository and never shipped, to look
  through the chords imported from chords-db and give fingerings to the ones that have none. What it
  adds ships with unstrung as official fingerings.
- Then: how to handle a pattern or chord a player made that a later release ships as a built-in,
  on the desktop and in the web version.
- To stop treating chords-db as an ongoing source: what we took from it is the starting point.

## Decided and built: chords-db is no longer a dependency

Until 2026-11-02, `scripts/build-chord-library.mjs` read `@tombatossals/chords-db` 0.5.1 on every
build. The library was generated, not for chords-db's updates, but because most of each voicing is
worked out from its frets: notes, MIDI numbers, the spoken description, quality and confidence.
When the spelling of chord tones changed on 2026-08-11 every voicing was regenerated in one run.

chords-db's last commit is 2025-10-14 and its pull requests go unmerged, so its shapes were copied
once into `scripts/chord-library/voicings.json`, unstrung's own file, and the dependency removed.
The build still works out everything else and still checks every voicing. The conversion:

- Frets converted from chords-db's base-fret numbering to frets from the nut, barres likewise.
- 1,989 voicings that pass the check went to `voicings.json`, marked `"from": "chords-db"`.
- 80 that did not went to `scripts/chord-library/voicings-to-review.json` with the reason.
- The rebuilt `chord-library.json` was compared with the one before: identical apart from its
  `source` block, which now names the file and says it started from chords-db 0.5.1.
- `user-docs/third-parties.md` still credits chords-db, which stays true.

`scripts/chord-library/README.md` describes both files.

## What the check rejected

Counted 2026-11-02 over all 2,069 chords-db voicings:

- 28 sound a note their chord does not contain.
- 1 has no seventh: a 9 chord without its flat 7th, which is an add9.
- 51 were skipped, their suffix having no formula: alt (48) and 7sg (3).

A missing note is not a failure, except the seventh. Of the accepted voicings, 321 leave out the
fifth, 13 the root and 1 the third.

Most of the 28 are plain errors: the four Emadd9 voicings sound F, G, Ab and C, and Gadd9 at
x x 3 2 1 4 sounds F, Ab, A and C. Three are real chords under the wrong name: a Dmmaj7 that adds
E (a minor major 9th), an F/A with the open E (Fmaj7 over A), and a D7#9 that also sounds the plain
9th. They are in the review file to be looked at again.

## Why the 38 chords have no fingering

The theory code knows 43 chord types (`CHORD_FORMULAS`, besides the aliases m and sus). They are
chords-db's own list minus alt and 7sg, plus power chords, plus add11, maj7sus2 and sus2sus4, added
on 2026-07-28 so Frets to Chord could name those sounds. The library lists every type in every key.
38 have no fingering:

- add11, maj7sus2 and sus2sus4 in all 12 keys, 36 in all. chords-db has none of them.
- C#11 and Emadd9, where every chords-db voicing sounds the wrong notes.

Many chord types are missing from the 43 altogether, such as sus4add6 (or 6sus4), add4, 7sus2,
7#11, 7b13, 13sus4 and m7#5, because chords-db lacked them. A new type needs a formula in
`musicTheory.mjs`.

## A shape is checked against the name it is given

Joel's example: a Gsus4add6 in a song in G, between G chords, played without the D so that string
4 at fret 2 gives the E. It sounds G, C and E, the notes of C major, and from its notes alone Frets
to Chord would call it C with G in the bass. In context it is Gsus4add6. This is the lesson of
`chord-forms-in-scores.md`: the name the player or the file gives is the harmony, and the notes need
not spell it.

So the check does not ask whether the notes spell the name. It asks that no note is outside the
chord and that the notes the chord cannot do without are there. A Gsus4add6 without its D would
pass, the D being the fifth, once sus4add6 has a formula. The library can note that the same notes
also spell C over G. No voicing like it was rejected from chords-db, which has no sus4add6.

## Proposed: the maintainer tool

- It edits `voicings.json`, the source file, never `chord-library.json`, which the build overwrites.
- It lives under `scripts/`, which neither the installer (`build.files` in `package.json`) nor
  `npm run build:web` packages.
- Candidate fingerings, most trusted first: a checked movable shape of the same type in another key,
  with no open strings, moved up or down the neck, fingers and all; a search of the fretboard for
  sets of frets within four frets that sound the chord with the root lowest, with fingers suggested
  and a barre where finger 1 covers two or more strings at one fret; or frets and fingers typed in.
- For each candidate it plays the shape, reads the description the library already produces, and
  lets Joel accept it, change the fingers or reject it. A small local page with its own Node server
  to write the file could reuse unstrung's audio and markup, which a terminal prompt cannot.
- It can also go through `voicings-to-review.json`, and remove a shape that passes the check but is
  wrong or unplayable.
- New chord types: whether their formulas go in the source file or stay a code change in
  `musicTheory.mjs` is open.

## Proposed: your own items against new built-in ones

No shipped progressions are planned. Progressions a player made or shared are not at risk: a saved
.atex file carries every chord's frets and every measure's strokes, and a pattern's name is worked
out on reading by comparing strokes (`namedPatternLike`). Removing a pattern or fingering of the
player's own cannot break one.

For the player's own strumming patterns, and chords once they exist, identity is the content, not
the name: a pattern is its strokes and time signature, a fingering is its chord and frets. When a
release ships a built-in:

- **Same content as one of yours, any name:** yours is a duplicate. Remove it and say so.
- **Same name, different content:** the built-in takes the name. Joel's first thought was to delete
  yours; the alternative is to rename it, "Busy Folk (yours)", since it exists nowhere else. Open.
- **A chord of yours that now ships with the same notes:** your chord goes, its fingerings become
  your fingerings of the shipped chord, and any identical to a shipped one go.
- **A chord of yours that now ships with other notes:** rename yours.

Importing patterns already skips any that match a built-in.

The check would be one function in `src/shared`, taking the built-in items and yours and returning
what to keep and a list of changes, run on every load. It changes nothing once your items are
checked, so it needs no record of versions, and the notice, a dialog listing each change once,
appears only when something changed. The desktop keeps your items in its settings file and a
browser in local storage, each saved through calls that exist already (`saveStrummingPatterns`), so
the two differ only in that each browser and device runs the check on its own next load.
