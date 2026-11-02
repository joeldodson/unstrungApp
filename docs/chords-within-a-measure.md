# More than one chord in a measure

A record of the design discussion held 2026-10-30, what was decided, and what was built the same
day.

## What Joel asked for

Different chords on different beats of a measure, as a first step towards more detailed editing
of progressions and songs. He offered two ways in: a checkbox for each beat the chosen chord
covers, or choosing a number of beats and then a chord. He also wanted fractional beats, so a
chord could change on the upstroke after a beat: two eighth notes in 4/4.

## Options considered

Four ways of entering the chords were put to him:

- **A checkbox per beat.** Easy to follow for four beats, but eight for eighths and sixteen for
  sixteenths. It records which beats a chord covers rather than where it starts, which raises
  questions the music never asks: what plays on a beat nobody checked, and what when two chords
  check the same one.
- **A length, then a chord,** appended to the measure, as step entry in notation software. It
  extends to notes, but changing a chord in the middle moves everything after it.
- **Typed chords,** `G C@2.5`, decided on 2026-10-15 in `strumming-patterns-and-metronome.md`
  but not built.
- **A list of beats inside the measure,** one row per beat or finer, typing a chord on the row
  where it starts. Recommended at first, as the same slot grid the strumming patterns use.

A song would eventually need a list of events, each with its length, for notes, rests and ties:
the written-out measures.

## Decisions

### Progressions stay chords

Joel decided against growing progressions toward song editing. Making them granular down to
notes would blur the line between a simple chord progression and a song, and the interface would
lose the cleanness that makes progressions easy to use. A progression holds chords and where they
start, with one strumming pattern. Full song editing, if it comes, is a separate thing.

### Typed chords, one beat each unless told

The chord field takes a list. The rule, in one sentence: each chord starts at its @ position, or,
without one, on the next whole beat after the chord before it, with the first chord on beat 1;
a chord lasts until the next chord starts or the measure ends.

- `G D C Am` in 4/4 is a chord a beat. `G D C` leaves C beats 3 and 4. `G D C@4` gives D beats 2
  and 3.
- This replaces the even split decided on 2026-10-15, where `G C` was two beats each. Two beats
  each is now `G C@3`. The even split needed a rounding rule for 3/4; this rule has no
  exceptions, which Joel preferred to saving two characters.
- After a chord on an and, the next chord without an @ starts on the next whole beat, not a beat
  later: `G C@2.5 D` puts D on 3. Joel expects this to be rare.
- Positions are written as decimals, quarters of a beat at the finest: 2.5, 2.25, 2.75. A
  sixteenth in 4/4 is the finest grid a strumming pattern has. Triplet positions wait for
  triplets.
- A dash for "carry on", `G - C -`, was offered as an alternative, matching the strumming
  notation. Joel did not want it. If `G C@3` turns out awkward, `C C G G` already works: a chord
  repeated on the next beat carries on, and is written back as `C G@3`.
- The first chord must start on beat 1.

### Speak the next measure

The spoken names became "Speak the next measure", the label on both checkboxes.

- One chord is said one beat before its measure, as before.
- Several are said one after the other, finishing 0.1 seconds before the measure: one beat ahead,
  or earlier if the list needs longer. The recordings are trimmed, so their lengths are known
  exactly.
- Never before the measure before has begun, nor over the names said before it. Where the list
  will not fit, only the first chord is said, so the downbeat is still announced.
- A measure the same as the one before it, same chords on the same beats, is announced as
  "repeat", which was Joel's suggestion. The first measure is always named, including on a repeat
  of the whole progression.
- A fixed starting point, such as the second-to-last beat of the measure before, was set aside: too
  early at slow tempos and too late at fast ones.

### Where Am I gives the beat

b, and the Where Am I button, say the measure's chords as the editor writes them and the beat:
"Measure 5 of 8, G C@3, beat 2". Every measure gets the beat, so every answer has the same shape,
as decided on 2026-10-15.

## As built (2026-10-30)

- **`src/shared/measureChords.mjs`** reads and writes the chord lists (`parseMeasureChords`,
  `formatMeasureChords`), finds chords the pattern does not strike where they start
  (`chordsStruckLate`), and plans the speech (`spokenMeasurePlan`).
- **The progression's shape is unchanged for one chord a measure.** Each entry of a progression's
  `chords` is still its measure's first chord; any after it are in `laterChords`, each with its
  `beat`. The generator and everything that reads one chord a measure carry on as they were.
  `chordsInMeasure` gives a measure's chords in order.
- **The editor** reads the field as a list. The suggestions are for the last chord typed, without
  its @ and beat; after a space Down lists the key's chords for the next. Choosing a suggestion
  puts it in place of that chord, keeps its beat, and takes the whole field. A measure is listed
  as its chords, with any outside the key named: "G D7 C@4, D7 outside the key". A field that
  does not read is refused with the reason. Apply refuses a chord left past the end of a measure
  by a shorter time signature.
- **A chord the pattern does not strike where it starts** is still taken: that is how a chord
  change on a miss works. The editor says when it is first heard: "The pattern first strums C on
  3", or that the pattern does not strum it before the next chord.
- **Saving.** `songFromProgression` writes every chord. `expandMeasure` used to refuse a chord
  between the pattern's slots; it now lays the pattern on a finer grid with misses between, so
  `C@2.5` with Down Only is written. Reading a file back, a chord named and never struck before
  the next is named, as C is in `G C@2.5 D` with Down Only, used to be lost; it is now kept with
  the library's shape. `progressionFromSong` no longer refuses more than one chord in a measure.
- **Playback** strums, at each stroke, the chord that has started by then. The last strum rings
  on through a change on a miss, as it would on a guitar.
- **Speech.** "repeat" was added to the recorded vocabulary in
  `scripts/speech/build-chord-speech.mjs`. It sorts after every chord name, so it took the next
  file number in each voice and nothing else changed; the other recordings came out identical.
- **Checked** by `scripts/progressions/check-measure-chords.mjs` (the rule, refusals, writing
  back, late chords and the speech plan), the round trips in `scripts/songs/check-song-score.mjs`,
  and `scripts/progressions/verify-measure-chords.mjs`, which drives the app: typing lists and
  suggestions in the editor, the tab, saving and opening again, Where Am I, and the chord of every
  strum and every spoken word that playback schedules.

## Enter on a measure in browse mode (2026-11-01)

Joel found that Enter, a chord and Enter worked on a measure when editing a progression but not
when creating one. Editing starts with focus on measure 1, where NVDA is in focus mode. Creating
starts at the key, and the way down to the measures passes the Keyboard Commands summary, where
NVDA returns to browse mode. Enter on a measure in browse mode reaches the page as a click, and a
click only selected the measure; typed in browse mode, g is NVDA's key for the next graphic. A
click on a measure now goes to the chord field, as Enter does. That this was the cause is the
likely reading, not yet confirmed by Joel.

Three more changes followed from his testing the same day. Joel tried them with NVDA and found
them working, along with typing several chords in a measure:

- **The dialog was read in full on opening.** NVDA reads every line of a dialog as its
  description when it has none of its own. The editor now has a one-line description, "Key, time
  signature, strumming pattern, then the measures." If that works, other dialogs may want the same.
- **The measures list in browse mode** is one line, "Measures clickable", and its chords cannot be
  arrowed through there. Enter on it clicks the list itself, which now goes into the list at the
  current measure, where NVDA should change to focus mode. Joel had suggested a spoken reminder
  that the list needs focus mode; this was tried first instead.
- **Control+I** goes straight to the new measure's chord field, since an empty measure is there to
  be given chords. Enter on the empty field goes back to the measure. Control+D and the Insert
  button still leave focus where they did.

### Saying where a chord starts

Joel found "G D" and "G D@3" both said "G D", so there was no hearing when D came in. The
decision on 2026-10-30 had been the names alone; he had expected the positions too. Now a measure
is said as the editor writes it: a chord with an @ is followed by "at" and its beat, "G, D, at 3".
A chord without one starts on the next whole beat, so it needs nothing said. Each position is a
recording of its own, "at 1.25" to "at 16.75", 63 a voice, made by
`scripts/speech/build-chord-speech.mjs` alongside "repeat"; the chord recordings were unchanged.
They add about 2 MB across the two voices. The beat is said as typed, "at 2.5" as "at two point
five"; "two and" would be a different recording if that reads better. Committed before Joel had
heard it.

## Saved progressions open as songs (2026-11-01)

With several chords in a measure, a progression comes closer to a song: the boat and ship of
`strumming-patterns-and-metronome.md`. Joel still thinks of progressions as boats, but some will
treat them as ships, so Open File now takes .atex, the format progressions are saved in, as a song.
The single kind of open item proposed in that document is not built; a saved progression opens as
either kind, by which way it is opened.

- **alphaTab's ScoreLoader already reads alphaTex**, as the last of its importers, so only the file
  filters needed it: `OPEN_FILE_FILTERS` in `src/main/main.js` and `SONG_FILE_TYPES` in
  `src/web/platform.js`.
- **An .atex file goes straight to the alphaTex importer**, not through ScoreLoader. Through it, a
  broken file was reported by the first importer to fail, a Guitar Pro one: "Unexpected end of data
  within reader". Read directly, the error gives the line and column, as opening a progression does.
- **A file without a title takes its file name**, since a progression is saved without one and is
  named by its file. Other formats still say "(untitled)".
- Checked at the end of `scripts/progressions/verify-measure-chords.mjs`: the saved progression
  opened through Open File, its measure headings, and a broken file's error.

## Not yet checked by Joel

How NVDA reads "@" and "2.5" at his punctuation level, both in the editor and from Where Am I;
whether the gap between spoken names (0.08 seconds) and the finish before the downbeat (0.1
seconds) feel right; and whether `G C@3` is comfortable to type or `C C G G` is easier.
