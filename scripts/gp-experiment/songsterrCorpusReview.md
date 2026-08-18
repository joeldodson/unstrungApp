# What a wider corpus says we are getting wrong

A survey of 11 Guitar Pro 8 files from Songsterr — America, Glen Hansard,
Grateful Dead, John Mellencamp, Mazzy Star, Pink Floyd — covering 56 tracks.

**The files themselves are not in this repository and must not be.** They are
licensed to one subscriber for their own use. Everything below is a structural
observation: counts, feature usage, and what Unstrung says about them. No tab
content and no lyrics are reproduced here.

All 11 parse. `extractScoreMetadata` survives all of them without throwing, and
nothing in the corpus uses a second voice or a second staff, which were the two
structural gaps I most expected to find. The problems are elsewhere.

---

## Things we say that are wrong

### 1. Drum tracks are described as pitches

Eight percussion tracks across the corpus. `describeNotePitch` falls through to
`pitchName(note.realValue)` for anything not stringed, so a bar of Pink Floyd's
*Mother* reads:

    eighth note, A#0; G#-1
    eighth note, D#0
    eighth note, D#0; C-1

Those are a kick drum, a hi-hat and a snare. "A#0" is not a drum, is not what
the file says, and is not something a player can act on.

The names are right there. `note.percussionArticulation` indexes
`track.percussionArticulations`, and each entry carries an `elementType`:

    index 8  -> Kick Drum        index 0  -> Snare
    index 3  -> Charley (hi-hat) index 14 -> Ride
    index 22 -> Crash High       index 11 -> Tom Medium

That track uses 13 distinct articulations, all named in the file. This looks
like the cheapest large win in the list: a lookup, and drum parts go from
gibberish to readable.

### 2. Tuplets are ignored, so the rhythm is misstated

Twelve tracks use them. A triplet is reported as though it were a plain note:

    file:   duration 1/16, tuplet 3:2
    we say: sixteenth note, string 3, fret 4, pull-off

Three of those fit in the time of two sixteenths. `durationName` never looks at
`beat.tupletNumerator` / `tupletDenominator`, so the beat is named at the wrong
length and nothing says a triplet is happening. Anyone counting from our output
would come out wrong.

### 3. Non-stringed tracks are described as guitars

*Mother*'s Hammond organ track reports tuning "Standard (E A D G B E)" and
"Capo Fret 12". *Fade Into You*'s piano parts report seven strings. These are
artefacts of how Guitar Pro models a keyboard, not facts about the instrument,
and we repeat them as though they were.

The chord names on those tracks happen to survive, because our capo arithmetic
subtracts 12 semitones and that leaves the pitch class alone — but that is luck,
not correctness. A capo of 5 on a keyboard track would rename every chord.

### 4. The same chord listed twice under two spellings

*Sister Golden Hair*, Rhythm Guitar 1, in the Chords Used region:

    Abm   root=Ab  suffix=minor  beats=109  fromSymbol=false
    G#m   root=null suffix=null  beats=13   fromSymbol=true

The file prints G#m; we identify the same notes as Abm. `extractTrackChords`
de-duplicates by display name, so enharmonic spellings never merge. The chord
appears twice, and the 13 beats carrying the symbol are counted in both rows.

Both rhythm tracks in that song show it. The fix is to key the map on pitch
class and quality rather than on the printed name, and to prefer the file's
spelling for display, since the file is following the key signature and we are
not.

---

## Things present in the files that we say nothing about

### 5. Section markers — the biggest navigation gap

Seven of the eleven files carry them, and they are exactly what you would want
to move around a song by:

    Sister Golden Hair: Intro(2) Verse(12) Verse(28) Chorus(44) Interlude(56) Chorus(82) Outro(94)
    Wish You Were Here: Intro(1) Guitar Solo 1(13) Verse 1(22) Verse 2(29)
                        Guitar Solo 2(38) Chorus(47) Interlude(55) Guitar Solo 3(64) Outro(73)
    Into Dust:          Intro(1) Verse 1(13) Break(45) Verse 2(53) Refrain(69)
                        Interlude(75) Verse 3(79) Break(95) Outro(107)

They live on `masterBar.section` (`text` and `marker`). We show a flat list of
137 measures with nothing to say which are the chorus. Putting the section on
the measure heading, the way chord symbols now ride there, would make the whole
measure list navigable by structure.

**Since done.** Sections ride the measure heading. Beat text that names a
section is promoted onto a heading that has no marker of its own — see item 7.

### 6. Lyrics

Six vocal tracks carry them, 44 to 171 syllables each — *Fade Into You*, *Into
Dust*, *Mother* (two vocal parts), *Wish You Were Here* (lead and backing).
They are on `beat.lyrics`, syllable by syllable, aligned to the notes.

A vocal track currently reads as a list of string-and-fret positions, which is
close to useless for a sung part when the words are sitting right there.

### 7. Beat text — real playing instructions

Sixteen tracks carry `beat.text`, and it is not decoration:

- *Pink Houses*: "All Guitars tune to Open G: (low to high) DGDGBD" — an
  instruction without which every fret number on the track is wrong
- *Wish You Were Here*: "with a transistor radio effect and heavily EQ'd",
  "turn off effects", "use neck pickup, use a short and light delay for warm
  sustain", "tone knob rolled down"
- *Mother*: "rake", "even release" on the lead guitar
- *Ripple*: "Intro", "End Intro", "Outro" — section names, in a file that has
  no section markers
- *Falling Slowly*: 185 beat texts, which are the lyrics stored this way rather
  than in the lyrics field

We drop all of it.

**Since done.** Beat text is now read out on the beat that carries it, and the
part of it that names a section is lifted onto the measure heading instead. The
five uses above are exactly why the promotion is fenced: only *Ripple*'s three
and the three the 2009 *Pink Houses* markers omit are promoted across all
eleven files, and the other 208 texts stay on their beat. The rule and its
guards are in `extractPromotedSections`; `scripts/gp-experiment/check-section-promotion.mjs`
prints the verdict on every text in a corpus directory.

### 8. Let ring

Nine tracks. *Wish You Were Here*'s rhythm guitar carries it on 1686 notes;
*Into Dust*'s acoustic on 916. `describeNoteTechniques` has no case for
`note.isLetRing`, so it is never spoken. For fingerstyle parts, whether the
notes ring into each other is most of the sound.

### 9. Repeats and alternate endings

*Ripple* has a repeat start at bar 19, a repeat ×2 at bar 34, and alternate
endings at bars 34 and 35 — plus the same again at bars 45–61. *Pink Houses*
(2009) has a repeat start at 104 and alternate endings at 111 and 115.

We present measures 1..102 in a flat line. The actual playing order is not
that, and nothing in our output hints otherwise.

### 10. Triplet feel

Every one of *Ripple*'s 102 bars is marked triplet feel. That means every pair
of eighth notes is played long-short — a swing — and it changes how the entire
song is counted. We report the time signature and say nothing about this.

### 11. Tempo changes

*Sister Golden Hair* (07-25) slows from 120 to 100 at bar 91 and to 80 at bar
92: a ritard into the ending. We report `score.tempo` as a single number. We
already flag when a time signature or key signature varies; tempo deserves the
same, and the audio track already reads the tempo map, so only the display is
missing.

### 12. Dynamics

Forty-one tracks vary their dynamics; one slide guitar part uses six different
levels. We never mention them. Lower priority than the rest — a dynamic on
every beat would be noise — but a change of dynamic is worth saying.

### 13. Grace notes

A grace note is reported as a full note of its written duration:

    graceType=1 -> "eighth note, string 2, fret 8, legato slide"

It is an ornament ahead of the beat, not an eighth note.

---

## What this corpus confirms we got right

### Stroke direction is stated constantly — just not in the files we had

This is the significant one. The conclusion that files rarely state stroke
direction was drawn from four files that happened not to. Across this corpus,
**4111 beats state a direction**:

    Pink Houses / Guitar I                 brush: 307 down, 377 up
    Mother / Roger Waters acoustic         brush: 577 down, 324 up
    Fade Into You / Martin 000-28          pick:  762 down, 506 up
    Wish You Were Here / Martin D-35 rhythm pick: 316 down, 181 up
    Falling Slowly / Kytara                brush: 96 up

Deciding to report only what the file states was the right call, and it pays
off here: these songs get a fully annotated strumming hand where Ripple got
almost nothing. Nothing needs changing — this is the feature working.

### The strumming heuristic we declined would have been wrong 1 beat in 7

We now have ground truth to test it against. Taking all 4111 stated strokes and
asking whether "down on the beat, up on the off-beat" holds:

    ON a beat:  1939 down,  127 up
    OFF a beat: 1602 up,    443 down
    rule holds on 86.1%

So the rule is real — it is clearly what these transcribers are following — and
it is also wrong about one stroke in seven, silently, in a way a player could
not detect. *Fade Into You* follows it exactly for bars at a time; the failures
cluster where the picking subdivides finer than the beat. Declining to guess
was right, and if it is ever revisited, this corpus is the test set.

---

## Suggested order

1. **Percussion articulation names.** Eight tracks currently produce nonsense;
   the data is a lookup away.
2. **Section markers on measure headings.** Largest navigation gain, and the
   mechanism already exists from chord symbols.
3. **Let ring, and tuplets.** Both change what a player would actually do; the
   tuplet one is us stating a wrong duration.
4. **Lyrics on vocal tracks.**
5. **Beat text**, at least on the beats that carry it — it includes tuning
   instructions we currently discard.
6. **Enharmonic de-duplication** in Chords Used.
7. **Tempo changes and triplet feel** in the song summary, beside the existing
   "changes later in the song" notes.
8. **Repeats and alternate endings**, which need a decision about whether to
   describe the structure or expand the playing order.
9. Grace notes, dynamics, and not describing keyboards as guitars.
