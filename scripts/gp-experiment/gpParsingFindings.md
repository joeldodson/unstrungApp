# Does note order in a .gp file tell you the stroke direction?

No. The inference Unstrung currently makes — strings listed low-to-high is an
up stroke, high-to-low a down stroke, and a chord name is a down stroke — is
not supported by any of the four files in `musicfiles/`. The friend's doubt is
correct, and the evidence is not marginal.

Reproduce with:

    node scripts/gp-experiment/dump-strokes.mjs
    node scripts/gp-experiment/compare-orders.mjs
    node scripts/gp-experiment/gpx-order-sequence.mjs
    node scripts/gp-experiment/what-unstrung-says.mjs
    node scripts/gp-experiment/find-brushes.mjs

## 1. The files do carry stroke direction, and ours almost never use it

Guitar Pro stores direction explicitly, and alphaTab reads it from every
format we handle: `beat.brushType` (BrushUp / BrushDown / ArpeggioUp /
ArpeggioDown, with `brushDuration`) and `beat.pickStroke` (Up / Down).

Across all four files and every track:

| signal | count |
|---|---|
| `pickStroke` set | 0 |
| `brushType` set | 2, both BrushDown |

The two are in the GP8 file, `Acoustic Lead`, bars 11 and 14. They are in the
raw XML as `<Property name="Brush"><Direction>Down</Direction></Property>`.
So the author of that file knew how to mark a stroke and did so twice.

Everywhere else the files say nothing about direction. Unstrung is not reading
a signal the files are being coy about; it is inventing one.

## 2. Note order in a .gp5 file cannot carry direction

GP3–GP5 store the notes of a beat as a **bitmask of strings**, one byte, one
bit per string. A set has no order. alphaTab walks the bits in a fixed loop
(`for (let i = 6; i >= 0; i--)`, `alphaTab.core.mjs:18302`), so every beat it
produces from a .gp5 comes out in the same string order regardless of what
was played.

That is exactly what we see: in `Ripple.gp5` and `Ripple Chord Solo.gp5`,
100% of multi-note beats are "ascending". Unstrung therefore says "up stroke"
for every strum in every .gp5 file it will ever open. It has never said
"down stroke" for one.

## 3. GP8 normalises the order; GP6 stores it arbitrarily

`.gp` and `.gpx` use GPIF XML, where a beat lists note ids in sequence, so an
order *is* representable, and alphaTab preserves it. But:

- **GP8** (`Grateful Dead-Ripple-12-20-2025.gp`): 1840 of 1840 multi-note
  beats ascending, across all four tracks. Uniform, so it says nothing.
- **GP6** (`Ripple Chord Solo.gpx`): ascending 33, descending 29, and one beat
  listing strings **3, 2, 1, 4, 5** (bar 16). No pick travels 3-2-1-4-5. That
  is storage order, not a sweep.

## 4. The same song, exported twice, contradicts itself

`Ripple Chord Solo` exists as both .gp5 and .gpx. Same 151 sounding beats,
identical strings and frets on every one. 30 of them are listed in opposite
order between the two files. What Unstrung reads out today:

| bar | from the .gp5 | from the .gpx |
|---|---|---|
| 4 | `C, up stroke` | `C, down stroke` |
| 18 | `Am, up stroke` | `Am, down stroke` |
| 20 | `D/A, up stroke` | `D/A, down stroke` |

The music is the same. Only the export differs. A property that flips when you
re-save the file is a property of the file format, not of the performance.

## 5. The one beat where the file states the direction, we get it backwards

`Acoustic Lead`, bar 14: the file marks the beat **Brush Down**. alphaTab
lists its notes s2, s3, s4, s5, s6 — ascending — which Unstrung reads as an
**up stroke**. The single beat in the entire corpus where the answer is known
is a beat we currently get wrong.

## 6. A chord name is a chord symbol, not a strum

`beat.chord` is the chord symbol and diagram Guitar Pro prints above the
staff. It marks the harmony, and it is placed where the harmony changes.

- **It sits on beats that cannot be strummed.** In `Ripple Chord Solo.gp5`,
  10 of the 15 named beats have a **single note** — "G" on s6:3 alone, "C" on
  s3:0 alone. One string is not a down stroke of anything. In `Ripple.gp5`,
  "G" sits on s4:0 + s6:3, two non-adjacent strings: picked, not brushed.
- **It marks a change, and the strums that follow are unnamed.** On
  `Acoustic Capo VII` in the GP8 file, 36 of 37 named beats are followed by
  identical, un-named beats — the same C shape struck 11 more times, the same
  F 25 more times. If the name meant "down stroke", the eleven identical
  strums right after it would have to be something else.
- **Every named beat also carries its notes.** There is no beat in any file
  described only by a name. Unstrung's `describeBeat` sees `hasChord` and
  discards the notes, which is why a named beat sounds like a different kind
  of event from the ones around it. It is the same event with a label on it.

Bar 2 of `Acoustic Capo VII` is what this costs today:

    quarter note, chord C
    eighth note, G, up stroke
    eighth note, G, up stroke
    ...

Six strums of one shape. The first is named "C", the next five "G", and all
six are called up strokes.

## 7. Separate bug found on the way: capo and chord names disagree

`Acoustic Capo VII` has capo 7. `note.realValue` includes the capo, so
`identifyChordFromNotes` names the **sounding** chord, G. `beat.chord.name`
is the **fingered shape**, C. Both are right; the app prints them next to
each other with nothing to say they are the same chord in two frames. This is
independent of the stroke question and needs fixing either way.

## What the evidence supports

1. Note order carries nothing. Any direction derived from it should go.
2. `brushType` and `pickStroke` are the real signals, and should be reported
   when present — which in this corpus is twice.
3. When neither is set, the file does not say. A guitarist reading the
   printed tab does not learn the direction either; they infer it from the
   rhythm. Saying nothing matches what the file says.
4. A chord name should ride along with the strings rather than replace them,
   since it is a label on the beat, not a different kind of beat.

---

# What changed as a result

`node scripts/gp-experiment/verify-descriptions.mjs` and
`node scripts/gp-experiment/verify-sweep.mjs` check the outcome.

## Direction now comes only from the file

`scoreMetadata.mjs` no longer looks at note order. `statedStroke()` reads
`brushType` and `pickStroke`, and returns nothing when neither is set.

Across 6474 beat descriptions from all four files, exactly two now report a
direction — the two the GP8 file marks:

    bar 11: quarter note, G5/D, strings 4 and 3, down stroke
    bar 14: eighth note, G, strings 6 through 2, down stroke

Both formerly read "up stroke". Where the file states the stroke, the string
run is given in the order the pick travels, so a down stroke counts from the
lowest-pitched string: "strings 6 through 2".

## "Down" means the lowest string first

`audioTrack.mjs` had `BrushUp` sweeping from the lowest string, which is
backwards. alphaTab's own MIDI generation settles it: `_fillBrushInfo` walks
the tuning from index 0 upward for `BrushDown`, giving string 1 (its lowest)
the zero offset. So Guitar Pro's "down" sounds the low string first, which is
what a guitarist means by a down stroke. The pair is now swapped.

## Playback sweeps a downstroke when the file says nothing

Previously the sweep followed the file's note order, so every .gp5 strummed
from the high E — the bitmask artefact, played back as if it were music. Now
an unstated strum sweeps from the lowest-pitched string, the unmarked default
in notation, and the same one rule 3 already used for chords filled in from
their name.

Both exports of `Ripple Chord Solo` now produce identical playback: 73 strums,
all sweeping low-pitch first, where before they swept opposite ways.

## A chord symbol no longer replaces the beat

`describeBeat` used to see `hasChord` and drop the notes and the techniques.
Now every beat is described from its notes, and the symbol is added to that:

- symbol agrees with the notes: `quarter note, chord C, strings 1 through 5`
- symbol on a beat that is not a full chord: `quarter note, string 3, open,
  chord symbol C`
- symbol differs from the reading: the reading, then `chord symbol F`

The comparison ignores the bass note, so an F voiced with A at the bottom is
read "chord F/A" rather than being reported as disagreeing with the file.

## Chord names are now in the fingered frame

Chord identification takes the capo back off the pitches first. On the capo
VII track the same shape used to be announced "chord C" on the labelled beat
and "G" on the eleven identical beats after it. All twelve now say C, which
is also what the file's own symbols say and what the fret numbers alongside
them mean.

The trade is that a capo track is named by shape rather than by sound. The
sounding chord is a capo's worth of semitones up, and the track summary still
reports the capo.

---

# What alphaTab's own MIDI generation does

`node scripts/gp-experiment/alphatab-midi-spread.mjs` runs alphaTab's
`MidiFileGenerator` over our files and measures, per beat, how many distinct
ticks that beat's note-ons land on.

| track | multi-note beats at one tick | beats with any spread |
|---|---|---|
| Acoustic Lead (.gp) | 204 | **2** |
| Acoustic Capo VII (.gp) | 318 | 0 |
| Mandolin (.gp) | 303 | 0 |
| Acoustic Guitar (.gp5 / .gpx) | 39 | 0 |
| Acoustic Lead / Capo VII (Ripple.gp5) | 27 / 68 | 0 |

alphaTab makes **no assumption at all**. Every multi-note beat sounds at a
single tick — all notes together, no sweep, no direction — except the two beats
whose file marks a brush. The source agrees: `_getBrushInfo` returns a
zero-filled array unless `beat.brushType` is set, and that array is the only
thing that offsets a note within its beat (outside rasgueado, which none of our
files use).

The two marked beats come out as:

    bar 11: note-ons at +0, +30 ticks     (2 notes, brushDuration 30)
    bar 14: note-ons at +0, +7, +14, +21, +28 ticks   (5 notes, brushDuration 30)

which is `brushDuration / (noteCount - 1)` per gap, floored — the spacing
`strumStepSeconds` now reproduces.

So alphaTab is strictly literal: it plays what the file states and invents
nothing. Anything that makes a chord sound strummed rather than struck is our
own addition.

## The two remaining fixes

- Chord completion now goes through `statedStrumDirection` instead of always
  sweeping downward. The learned voicing is stored lowest-string-first, so a
  stated upstroke reverses it.
- `brushDuration` is honoured. The two marked brushes now spread over 14.9 ms
  and 13.9 ms, as the file asks, instead of the 20 ms per string that would
  have stretched them to 20 ms and 80 ms.

---

# What a chord symbol is, confirmed on a second song

Mazzy Star's *Into Dust* settled the question the Ripple files only suggested.
Its acoustic part is fingerpicked throughout, never strummed, and carries 82
chord symbols over 116 bars.

- **Never more than one per measure.** Across all five files tested, 169 bars
  carry a symbol and there are exactly 169 symbols.
- **Almost always at the start of the measure.** 167 of the 169. The two
  exceptions are real mid-measure chord changes: Ripple's capo part at bar 44
  (beat 2) and Into Dust at bar 115 (a triplet into beat 1).
- **It has nothing to do with what the beat plays.** In Into Dust every symbol
  sits on a single picked note — measure 1's D is anchored to string 4 open —
  and that D governs four measures of picking before C arrives at measure 5.

So a chord symbol is a property of the *measure*, not of the note Guitar Pro
anchors it to. It is written where the harmony turns over, which is why the
symbols in a fingerpicked part map exactly onto its chord changes.

Reported on the beat, as it was, a D governing four bars arrived as a footnote
to one eighth note of the first — easy to miss, and attached to the wrong
thing. It now rides on the measure heading instead:

    Measure 1 - chord symbol D at beat 1
    Measure 5 - chord symbol C at beat 1
    Measure 44 - chord symbol G at beat 2
    Measure 115 - chord symbol D during beat 1

Every symbol is placed by beat, including the ones on beat 1, where all but two
of the 169 fall. Stating it even when it is not news is what makes a measure
carrying two symbols read like one carrying a single symbol, instead of the
reader having to notice that a position has appeared:

    Measure 2 - chord symbols C at beat 1, G at beat 3

Nothing in these formats stops an author writing a chord change on every beat.
None of our files does, so that case is covered by attaching a second symbol to
a beat of Ripple's bar 2 in verify-descriptions.mjs.

Position counts beats of the time signature, not notes played: a bar of eight
eighth notes still has four beats. A symbol landing between beats is placed by
the beat it falls inside -- "during beat 1" rather than "at beat 1" -- so it is
not confused with one squarely on the beat.

Beat descriptions no longer mention symbols at all, so the "chord C" prefix
that used to mark a labelled strum is gone too. The name is still there when
the notes spell it — the beat reads "C, strings 1 through 5" — but where the
score prints its label is now a fact about the measure.
