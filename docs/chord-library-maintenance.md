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

That was true of the npm package we built from, 0.5.1 of 2022. chords-db's GitHub master,
0.6.0 at df06fa7 (2025-10-14), was never published to npm and does have add11, maj7sus2 and
sus2sus4. See the tabsy-gr/chords-db section.

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

## Looked at: szaza/guitar-chords-db-json (2026-11-02)

https://github.com/szaza/guitar-chords-db-json, MIT on its face, last pushed 2020-04-21. Its README
calls it a filtered copy of T-vK/chord-collection, last pushed 2019, whose README says it was made
with the help of jguitar.com and that its source is under the GPL. GitHub finds no license file in
T-vK's repository. So where the shapes came from, and on what terms, is unclear.

Checked by unstrung's own check, with formulas written for the run for the types we lack:

- 99,231 voicings in 9,072 files, one per key, type and bass note. 98,828 pass. Most of the 403
  that fail are its maj#11, which seems to mean maj9#11, not the maj7#11 guessed for the run.
- 84,840 are slash chords: every type over every bass note, such as Amaj#11 over Bb.
- Frets go to 22, many shapes repeated an octave up. 562 span more than four frets.
- Fingers are given for every shape. 153 have a finger at two different frets or a fretted string
  with no finger.
- 846 of our 1,989 chords-db shapes are in it, so chords-db is not simply drawn from it.
- 23 types we have no formula for, such as 7sus2, 9sus4, m13, m7#5 and maj7sus4. No add11, no
  madd9, and no sus4add6 or 6sus4.
- For our 38 unfingered chords: 13 to 23 shapes for each maj7sus2 and sus2sus4, and 10 for C#11.
  None for add11 or Emadd9. That would cover 25 of the 38.

Nearly every shape passing, and every type in every key over every bass, look like a calculator's
output rather than shapes players chose. That is what the proposed fretboard search would make,
without the question of terms. Not copied into unstrung. Possible uses: as a cross-check of the
search's results, and a single shape looked up while reviewing a chord, a fact rather than the
collection.

Joel agreed (2026-11-02): it is not a fully reliable source, and it was almost certainly generated
by an algorithm.

## Looked at: tabsy-gr/chords-db (2026-11-02)

https://github.com/tabsy-gr/chords-db, found by Joel. A hard fork of chords-db 0.6.0 (df06fa7),
MIT, keeping the original copyright. Begun 2026-09-25, last pushed 2026-10-13 (43f8b4a), 68 commits
since September, one maintainer (Giorgos Ioannidis, for Tabsy). Marked pre-release, "nothing here
is stable yet", and published only to GitHub Packages, which needs a token even to install.

What it changed, in its words, in `UPSTREAM-DIFF.md` (every difference from 0.6.0, with the reason,
checked by its tests) and `MIGRATING-FROM-CHORDS-DB.md`:

- Absolute frets, a permanent id and a source on every voicing, `"T"` for a thumb.
- A validator: every note in the chord, every required tone present (from `data/qualities.json`,
  with a source cited for each formula), and a fingering that can be played: a finger for every
  fretted string, no finger on two frets, no crossed fingers, barres that are declared and do not
  sit over lower or open strings.
- For guitar: 37 voicings removed, 26 added, 150 relabelled, 360 with frets fixed, 406 with fingers
  fixed, and every chord's voicings ordered easiest first by a playability score.
- Several fixes match our rejections: the Emadd9 copies of Fmadd9, the Gadd9 and Adim that spell
  no such chord, alt relabelled as a major flat five, and 9#11 voicings with no 9th relabelled 7#11,
  which our check accepted because it lets the 9th be left out.
- Its own fixes are not signed off by a player. Only the bouzouki has a verifier.

Checked 2026-11-02 against unstrung, with our check and with `voicings.json`:

- 837 guitar chords, 3,272 voicings. Every voicing with a type we know passes our check; 120 have
  types we have no formula for: 7#11, (b5) and 7sus2 over a bass note.
- Of our 1,989: 1,506 are in it unchanged, fingers included; 65 have other fingers, often a thumb
  where we have finger 1; 81 are filed under another chord; 337 are not in it.
- Of those 337, 45 were already different in 0.6.0. 321 were changed by the fork's rule that the
  root sounds lowest: 254 by muting the low strings, such as Cm 335543 to x35543 and Cmaj7 332000 to
  x32000, which is the taught "C maj7, G in the bass" in our `CANONICAL_OPEN_SHAPES`; 67 by adding a
  root on a low string; 32 by other edits. 20 were removed, most of them 9#11s.
- It fills 37 of our 38 unfingered chords, all but Absus2sus4. The shapes are chords-db 0.6.0's own,
  plus three C#11s the fork made by transposing C11.
- 1,701 voicings we do not have, 488 of them on chords we have; 323 chords we do not have, most of
  them slash chords.

The root-in-bass rule is the opposite of how this note treats a shape: by what players do, checked
only against the name it is given. A barre with its low string at the barre fret, or Cmaj7 with G in
the bass, is played and taught. The fork keeps such a shape only where its root-position form was
already a separate voicing.

## Decided and built: re-seeded from tabsy-gr/chords-db (2026-11-02)

Joel's decisions:

- Ship what is in the fork, and hold our earlier shapes for review rather than ship them beside it.
  He agrees with its root-in-bass rule where he knows the shape: Cm is x35543, as he learned it.
- No fingering with the thumb ships. The fork's 43 are held for review; every chord they belong to
  has other voicings, C#aug the fewest with one.

What was done:

- `scripts/chord-library/voicings.json` re-seeded from the fork at 43f8b4a: 3,112 voicings in 801
  chords, each with `"from": "tabsy-gr/chords-db"` and its fork `id`.
- `voicings-to-review.json` holds 723: the 43 thumb voicings; 117 whose types we have no formula for
  (7#11, (b5), 7sus2 over a bass note); the 483 chords-db 0.5.1 shapes that do not ship unchanged,
  each with the fork voicing that replaced it and the fork's change number and reason; and the 80
  kept from the first conversion. C minor 335543 is there with change 51.
- The build stops on any finger other than 0 to 4, so a thumb cannot get in. The source's power
  chords are merged with the generated ones instead of listed twice.
- The library is 802 chords and 3,149 voicings, from 564 and 2,061. Only Absus2sus4 has no
  fingering.
- 238 new chord names, mostly slash chords, were recorded for both voices; the 628 recordings already
  there came out byte for byte the same. The speech assets went from 25 MB to about 32 MB.
- `scripts/check-chord-spelling.mjs` asserted that Bm's first shape, 224432, has F# lowest. It is
  x24432 now, the fork's own example for change 51, so the check asserts the root is lowest.
- `user-docs/third-parties.md` credits the fork and chords-db.

Not yet checked: the app with NVDA, in particular the Chord Library with the many new slash chords
in its search and the new spoken names.

## Deciding the review list by group (2026-11-02)

Joel asked not to go through 700 voicings one by one, and to keep every entry, marking each settled
one resolved with a short note, for the next time another source is compared. An entry in
`voicings-to-review.json` gains `resolved: { date, note }`; one without it is open.

Decided so far:

- **Thumb voicings, 43:** resolved, not shipped. unstrung has no thumb fingerings.
- **Root lowest, 346:** our old shapes the fork changed to put the root lowest. Resolved; the fork's
  version ships. The taught shapes the build lists as canonical were left open; of those only Cmaj7
  332000, with G in the bass, was among them.
- **Ours where the fork used the thumb, 27:** the fork's only fingering of these frets used the thumb,
  so neither version shipped. Ours now ships, finger 1 across the barre with the muted string
  damped, as F6 1x3231 is 1 0 3 2 4 1. The UCI dataset fingers 8 of them the same way. One, Bb6
  6x7886, had no finger on string 1 in chords-db 0.5.1; it ships as 1 3 0 2 4 1.

Found on the way and fixed in `scripts/build-chord-library.mjs`:

- A barre was taken to be every string at its fret, whatever finger played it, so Cm7 8x888x read
  "Barre: fret 8, strings 6 through 2" with string 6 held by the barre, where finger 2 frets string 6
  and finger 3 barres strings 4 to 2. A barre is now the strings its own finger holds. 104 shipped
  descriptions changed.
- A muted string inside a barre is described as "not played, damped under the barre".
- A fretted string with no finger stops the build.

- **Types with no formula, 168:** formulas added in `src/shared/musicTheory.mjs` for the three the
  fork uses, and their 117 voicings ship: (b5), a major triad with a flat fifth, 1 3 b5, written
  C(b5) as the fork writes it, since a suffix starting with b would read as a flat root; 7#11,
  1 3 5 b7 #11; and 7sus2, 1 2 5 b7, which the fork has only over its flat seventh, such as
  C7sus2/Bb. chords-db's 48 alt, the same triads the fork relabelled (b5), and its 3 7sg, a name
  nobody could place, are resolved as not shipped.

  Joel asked that spoken names say "flat", never "b", and "fifth" rather than "five". So C(b5) is
  "C major flat fifth" (not "C flat fifth", which could be heard as a C flat chord), Bb7#11 is "B
  flat 7 sharp eleventh", and C7sus2/Bb is "C 7 sus 2 slash B flat". The older names said "7 flat
  5", "9 sharp 11" and so on; later the same day they were changed to match (see below).

  The three are also names Frets to Chord can give. Checked against every shape in both files: 167
  that had no name now get one, and no shape's existing name changed. Because every name it can
  give must be in the library, the twelve plain 7sus2 chords, C7sus2 to B7sus2, are listed with no
  fingering, as Absus2sus4 is. Dropping the bass of the fork's C7sus2/Bb, x35333, would finger
  C7sus2; that is the maintainer tool's kind of job.

- **The fork's other corrections, 81:** resolved, the fork's version shipping where it has one.
  - 25 that chords-db filed as 9#11, such as C9#11 x34353, have no 9th. The fork relabelled them
    7#11, and they ship under that name.
  - 29 sound a note outside their chord or leave out the seventh, and the fork dropped or replaced
    them. Twelve are shapes of another chord and ship under that name: the four "C#11" are C#7#11,
    and the four "Emadd9" are Fmadd9.
  - C9 8 10 8 7 8 10 had the D string behind the barre. The fork's 8 10 8 9 8 10 ships.
  - 26 refingered for a reason the fork records. 15 left a fretted string with no finger or put
    one finger on two frets, 9 minor-major 7 flat 5 shapes ran a barre across a muted string, one
    barre was not declared, and one rootless ninth was marked rootless.

  Twelve more refingerings were moved to the 0.6.0 group. The fork made no change to them; chords-db
  itself refingered them in 0.6.0, with no reason given. Some of the new fingerings are the usual
  ones, like Dm7 xx0211 as 2 1 1 for our 3 1 2. Others are not: D/A x00232 as 1 2 1, finger 1
  across the top three strings, where ours was the usual D fingering 1 3 2, and G/B x20033 with
  finger 2 on both strings at fret 3, where ours used 2 and 3.

- **chords-db's own changes in 0.6.0, 57:** shapes chords-db changed between 0.5.1 and 0.6.0
  with no reason recorded, compared one by one with the 0.6.0 data the fork keeps as a test fixture.
  - 13 had the root put lowest, as the fork's change 51 does, such as C 335553 to x35553. Resolved
    as the 346 were; six of our old shapes ship under their slash name, such as 335553 as C/G.
  - 12 refingered. 0.6.0's ships for 7, where it is the usual fingering or ours was awkward: Dm7
    xx0211 as 2 1 1, C/F xx3553, E/G xx5454, and E/B, E/F#, F/C and F/G, where ours put one
    finger at fret 4 on both sides of a fret-5 note. Ours ships for 5, where 0.6.0 lays one finger
    across two strings that the usual fingering plays with two: D/A x00232 and D/C x30232 with the
    D fingering 1 3 2, and G/B x20033, G/E 020033 and G/F# 220033 with separate fingers on strings 2
    and 1. These carry `forkId`, as the thumb substitutes do.
  - 32 were slash-chord shapes 0.6.0 replaced. Every chord concerned still ships three voicings or
    more, and many of ours were hard to play, such as C/G 33255x. Four common open shapes that no
    chord in the library had were restored: D/F# 200232, D/B x20232 (the open Bm7), Am/F 102210
    (an open Fmaj7) and G/F 120033. The other 28 are resolved as not shipped.

- **Cmaj7 332000:** G is its lowest note, so it ships as Cmaj7/G, a chord of its own, fingered
  3 4 2 as Joel plays it, the way he plays C/G 332010 as 3 4 2 0 1 0. The build lists it as
  canonical, the taught shape "C maj7, G in the bass". The fork's x32000 stays the Cmaj7. Spoken
  "C major 7 slash G", one new recording for each voice.

Every entry in the review list is now resolved.

## The chords with no fingering (2026-11-02)

Thirteen chords were listed with no fingering: Absus2sus4 and the twelve plain 7sus2 chords.

Two are common open shapes, and they ship: A7sus2 x02000, finger 2 on string 4 (A B E G), and
D7sus2 xx0210, fingers 2 and 1 (D E A C). The same frets already shipped as Em/A and Am/D; they now
have both names, as 332010 is C/G.

For the other eleven, a search of standard tuning listed every shape with the root lowest, no
note outside the chord, every note but the fifth, a span of four frets at most, no muted string
between played ones, and a fingering of four fingers and one barre at most. Joel approved one each,
mostly the two open shapes moved up the neck: the A7sus2 shape (barre on strings 5 to 1, ring
finger two frets up on string 4) for C, C#, Bb and B; the D7sus2 shape (index across strings 4 to
1, ring two frets up on 3, middle one up on 2) for Eb, F, F# and Ab; E7sus2 022432, the D shape
with the open low E; G7sus2 300031, an open G7 with string 5 open, fingers 2 0 0 0 3 1; and
Absus2sus4 446646, fingers 1 1 3 3 1 4, the most playable of the 11 shapes the search found. All
thirteen carry `"from":"unstrung"`. Every chord in the library now has a fingering.

## Joel's G chords, and spoken names in words (2026-11-02)

The chords that started this work: in Take It Easy, between open G chords, Joel strums Gsus4add6
3x2013, fingers 3x2014, and Gsus4add9 3x0213, fingers 3x0214. The first leaves out the fifth for
the sixth; it is the voicing that sounds best there. Both ship under his names, with formulas for
sus4add6 (1 4 5 6) and sus4add9 (1 4 5 9), and under their other names:

- 3x2013 is also G6sus4, the more usual name for sus4add6, given its own formula, and C/G, the
  chord its notes G, C and E spell.
- 3x0213 is also Gsus2sus4, which has the same notes, G A C D. It could also be read as D7sus4 over
  G; that name was not added.

The new types are not names Frets to Chord gives, so it still calls 3x2013 C/G, now "in the chord
library, C/G". Its check had used 3x2013 as a shape the library lacked; it now uses 3x2010.

Spoken names now say a number after "flat" or "sharp" as an ordinal, as Joel asked: "7 flat
fifth", "minor 7 flat fifth", "7 flat ninth", "7 sharp ninth", "9 flat fifth", "major 7 flat
fifth", "major 7 sharp fifth", "9 sharp eleventh", "minor major 7 flat fifth". The chord's own
number stays a number: "C 7", "C 9", "add 9". The new chords are "G sus 4 add 6", "G 6 sus 4" and
"G sus 4 add 9". Against the last commit, 108 recordings per voice were renamed, 4 are new (with C
major 7 slash G), and the other 806 are unchanged.

The library is 854 chords and 3,316 voicings.

## Looked at: UCI "Guitar Chords finger positions" (2026-11-02)

https://archive.ics.uci.edu/dataset/575/guitar+chords+finger+positions, DOI 10.24432/C5RG8K,
donated 2020-06-04 by someone the page does not name, from a source it does not give: "double
checked with software". CC BY 4.0, so a shape shipped from it needs credit in
`user-docs/third-parties.md`. No newer version was found; this is the one checked.

One file, `chord-fingers.csv`: root, type, intervals, the finger on each string (x, 0, or 1 to 4),
and the notes sounded. No frets: they were worked out from the notes, each fretted note at the
fret that gives it, moved up 12 where that closes the shape. Spellings such as C## for D suggest the
names were generated.

Checked 2026-11-02:

- 2,632 rows; 383 repeat a shape because the file lists both spellings of a root (C# and Db), so
  2,203 shapes. 34 types match ours; 8 do not: 7#11, 6#11, 13b9, +#11, 13#11, 7b13, 13#9 and m13.
- Our check passes all but 9, which leave out the seventh, such as A13 with no G.
- No finger at two frets. 13 cross fingers, most of them diminished shapes with the little finger a
  fret behind the ring finger, where ours has them the other way round.
- 163 sound fewer than three different notes, such as C major as C and E alone.
- 393 shapes are ours; 335 of those have our fingers. 537 are the fork's; 463 have its fingers.
- Nothing for add11, maj7sus2, sus2sus4 or Emadd9. Only C#11, which the fork has too.
- 8 of the fork's 43 thumb voicings are in it with the same fingers as ours, finger 1 across the
  barre over the muted string: F6 1x3231 as 1 0 3 2 4 1, and the same in C, C#, F#, C7b9, Bb7b9,
  G7b9 and G13.
- 1,643 shapes are in neither library; 1,497 of those have three notes or more, fingers that do not
  cross, and stay within four frets. The count is too high: the comparison was by chord name, and
  UCI files an inversion under its root chord where the libraries file it as a slash chord. C
  032010 and 332010, first given here as missing from both, are in both as C/E and C/G (corrected
  2026-11-02, after Joel found C/G 332010 in the app). G 320033, the four-finger G our build
  already lists as canonical, is the one common shape checked that both lack.

Not a source to take whole: no named author or method, and partial shapes mixed in with chords.
Useful as a second opinion on fingers, where ours and the fork's differ, and as a list of candidate
shapes for the maintainer tool to put to Joel.

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
