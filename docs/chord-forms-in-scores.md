# Chords in scores

Measure headings name the chords the file prints and nothing else. A beat is named as a chord only
when it sounds three different notes or more. Each track lists its Chord Symbols with the file's own
diagrams where it gives them. All three were decided 2026-10-26. From 2026-10-20 to then, headings
named a chord form instead: the shape the left hand holds, worked out from the notes. That is
recorded below, with why it was dropped.

## Printed chords only

### Why chord forms were dropped

Chord forms started with Ripple. Its lead part holds a G for its first measures, and unstrung
called open strings 3 and 4 "G5/D" and listed G5 among the track's chords. Over a week the rules
grew to choose between sus, add9 and 7th chords, with exceptions, and the Dire Straits songs
brought dozens of anomalies. Each rule that fixed one song's guess moved another's.

Joel asked a musician, whose advice was not to guess chords. A chord printed over a measure gives
the harmony, and the notes of the measure need not spell it: a melody can stray from the harmony on
purpose, and can have no note in common with it. If the file prints a chord, use it. If not,
nothing is better than being wrong.

Two measurements came before the decision, on 2026-10-26, across the 4,568 measures of guitar
tracks in Joel's Guitar folder:

- Naming forms by their root and major or minor only changed 640 headings and cut anomalies from 58
  to 35. The Brothers In Arms Solo kept all 25 of its anomalies, because they come from a lead line
  under the printed chords, which simpler names do not help.
- Not naming two-note beats removed every power-chord name from the beats. Power chords stayed in
  Chords Used and in 295 headings, because they came from forms.

### Measure headings

The heading gives the chords the track prints over the measure:

- "chord C" for one printed at beat 1, which is not said.
- "chord G at beat 3", or "during beat 2" for one between beats.
- "continues C" for a measure printing none after one that did. A printed chord stays in force
  until the next, as on sheet music, or until the next section.
- "continues C, chord G at beat 3" for a measure whose first printed chord is after beat 1.
- Nothing, before the first printed chord, on a track that prints none, or in a section from its
  start until it prints a chord.

"Holds" is not used, since it has its own meaning in music. Capitalization follows the rest of the
heading: "Measure 3 - continues C". The wording was Joel's, 2026-10-26.

Of the 4,568 guitar measures, 1,360 print a chord, 445 more continue one, and 2,763 name none, most
of them on tracks that print no chords. 24 of the 50 guitar tracks print chords. 8 print none
though another track of the same song does, such as Ripple's mandolin part. Those are left without:
a capo track prints its shapes, not the chords that sound, so borrowing another track's names can
be wrong. Those counts are from before a chord stopped at a section.

### Where a file stops printing chords

Joel asked on 2026-10-27 what happens when a file prints a chord early and never another: every
later measure would say "continues C". No file among his songs does that, but five carry a chord
through whole sections that print none, where it is plainly wrong:

- Wish You Were Here.gpx: chords stop at measure 10 of 20, and the Lead section read "continues G"
  for 9 measures.
- Songsterr's Wish You Were Here, both 12-string tracks: "continues A7sus4" through both verses and
  the chorus.
- Songsterr's American Pie: "continues Em" for the 17 measures of the slow last verse.
- Songsterr's Ripple, capo track: "continues F" for the 16 measures of the Outro.
- Songsterr's Mother, Gilmour's track: "continues G" for 22 measures of the Solo and the Verse after.

Each began at a section. Two fixes were weighed and set aside: deciding from the file whether its
chords are broken, which is a guess about the file, and working out what the missing chords should
be, which is the guessing just dropped. What was chosen is a rule with no guess in it: a printed
chord stops carrying at the next section, whether a marker or a name written as beat text, and a
section that prints no chord of its own names none until it does. Sheet music reprints the chord at
a new section anyway.

Across every track printing chords in the folder, counting the duplicate copies, 483 measures read
"continues" before and 338 after. The 145 that lost it include all five stretches above, and about
a dozen single measures where the chord likely did carry into a new section, such as the first
measure of Mother's two Choruses. Those now say nothing rather than something right, which is the
side to err on.

The user documentation says that chords come from the file only, so a wrong or missing chord means
the file needs fixing or a better source.

### Naming a beat

A beat is named as a chord when it sounds three different notes or more, and listed string by
string otherwise. Decided by Joel, 2026-10-26.

- Every power-chord name goes: 2,125 beats in the folder, including Ripple's open strings 3 and 4.
- Triads keep their names: 699 three-string beats are named, 569 of them plain major chords.
- Counting strings instead was considered, naming a beat on four strings or more. That would bring
  back 720 two-note beats as power chords, and 716 of them are a G chord with its B left out on
  that beat: xx0033 (240 beats), 3x0033 (58), and x00035 in the open G tuning of the 2009 Pink
  Houses file (418). A guitarist calls those G, not G5. The real power chords in these songs are on
  two or three strings.

A stroke direction is said only where the file states one, as before. It is now said on a beat
listed string by string as well as on a named one. The audio track plays a downstroke wherever the
file states none.

### Chord Symbols

The list that was Chords Used is Chord Symbols: the chords the track prints, each once, in the order
they first appear, with how many times each is printed. A track printing none says so. Named by
Joel, 2026-10-26; "harmony" was considered and left, since it also means a second sung or played
part.

Each chord shows the fingering of the diagram the file gives with it, in place of the chord
library's shapes, and the library's shapes where the file gives none. A diagram counts only where
the file shows it and it sounds three different notes or more, the same as a beat:

- Songsterr files carry a placeholder shape, never shown, under every chord they print.
- Of 222 chord definitions in the folder, 78 are shown diagrams with frets. Full fingerings are in
  the American Pie chart, Ripple.gp5 and Wish You Were Here. The Brothers In Arms Solo and the Wish
  You Were Here chord solo mark one or two melody notes as a chord's diagram.

A printed name is matched against the library as written, then without its bass, so D/F# is found
as D where the library has no slash chord.

### MusicXML

alphaTab reads a MusicXML `harmony` into the same place as a Guitar Pro chord symbol, and its
`frame` as the diagram, so both formats give headings and Chord Symbols the same way. A MusicXML
part written as notes rather than tab has no tuning, so its diagrams are read as standard tuning.
alphaTab does not read a harmony's `bass`, so a MusicXML C/G arrives as C. Checked with a
hand-written file, 2026-10-26; there is no MusicXML file among Joel's songs.

### What was removed

`src/shared/chordForms.mjs`, its checks and measuring scripts, the Anomalies region, and the
form wording are gone. They are in the history up to commit 5441c24, Release 0.9.2.
`docs/chord-forms-workflow.md` and the record of every song in Joel's Guitar folder are no longer
kept up. `scripts/songs/verify-chord-symbols-in-app.mjs` checks what the app shows now.

## Chord forms, 2026-10-20 to 2026-10-26

What follows is the record of chord forms as they stood when dropped.

Written 2026-10-20, from a discussion of the lead track of Grateful Dead's Ripple in the Songsterr
corpus. The rules are in `src/shared/chordForms.mjs`, checked on hand-written tracks by
`scripts/check-chord-forms.mjs` and measured on real files by
`scripts/gp-experiment/chord-forms-report.mjs`. Built into the app 2026-10-21:
`src/shared/scoreMetadata.mjs` gives each guitar track's measures their form wording, beats and
anomalies, and `scripts/songs/verify-chord-forms-in-app.mjs` checks what the app shows. The
library is not consulted there, so the fourth rule for choosing between two forms never decides;
it decided 1 span of 302 in the report.

### What Joel noticed

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

### Why not add G5/D to the library

The library is keyed by root and suffix, and Chords Used already drops the bass, so G and G/B are
one chord to learn. An open G5 voicing would be a fair addition on its own, since the library has no
open-string power chords, but the beat would still be named as a chord apart from the G the hand is
already holding. That is the problem, and a library entry does not touch it.

### Held forms

The question to answer is whether the left hand moves, not which chord a beat's notes could spell.

#### Finding the form

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

#### How long a form lasts

A form carries across bar lines for as long as the beats keep fitting it, and grows as new strings
appear: a G whose low strings sound in one measure and high strings in the next is one G. Joel's
comparison is sheet music, which shows a chord form only where it changes. Where a track opens with
partial beats and no form yet, they look ahead to the first form that fits them.

Carrying a form means a measure's heading depends on the measures before it. A measure of two open
strings can say "continues G" because the G was established earlier. Worked out alone it would say
G5, which is the mistake this replaces.

#### Exceptions

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

Added 2026-10-21, after Joel heard Ripple's lead in the app:

- **An exception is one finger:** notes off the form on one string. A strum off it on several, such
  as a D between two strums of C, is a change, however soon the C comes back.
- **A change to the same root is not a change.** Ripple's C alternates string 4 between open and
  fret 2 in measures 7 and 8, and from the open D the notes spell Csus2 with fewer off it than
  the C. That split the C in two; it is the same hand with a note moved.

#### Each measure on its own first

Also from Joel, 2026-10-21. Read across bar lines, Ripple's lead measure 4 came out as G for a
beat and a half, two notes holding nothing, then C from the "and" of beat 3, so its heading named
nothing and measure 5 said "continues C" of a C never named. The two open G strings that open
the measure fit the G before it as well as the C, and the reading gave them to the G. Read alone,
the measure is a C with one exception, the open string 4 that comes straight back to fret 2.

So each measure is first read on its own: does one form hold the whole of it, with notes off it
that are exceptions? The forms tried are those found in, just before and just after the measure,
and the measure's own notes taken together. Of those that hold it, the one whose frets are struck
with the shape, then one agreeing with the chord the file prints, then the one held in the
measure before, then the one the track holds elsewhere, then fewest exceptions, then the simpler
chord. The measure before matters for a measure of a fragment: two open strings after a G fit G
and G5 alike, and are G. A measure no one form holds is read across the bar lines as before.

For a whole measure, notes off the form are exceptions only where:

- they are on one string, and the string is heard at the form's fret somewhere in the measure, so
  the finger has a place in the shape to come back to. Into Dust's string 3 at fret 2 all through a
  measure is where the hand is, not a note off a G whose string 3 is open;
- the next note fits the form again: the next in the measure, or, after the last, the first of the
  next measure. A C on the "and" of beat 4 that carries on is a change, not a note off the G. The
  one allowance is a lone open string at the end of the measure, the hand lifting on its way to the
  next chord, as the open D before a G at the end of a measure of C;
- no chord is printed on them other than the form's own, or a power chord being filled out to it.

#### A form no measure spells alone

From the totallyGuitars Ripple Chord Solo, 2026-10-24. Its first three measures are a G, 320003,
picked across them: measure 1 plays string 5 at fret 2 and open string 4, with string 5 at fret 3
once near the end; measures 2 and 3 play strings 6, 3, 2 and 1, and measure 3 has string 3 at
fret 2 once. No measure spells a G on its own, B and D in the first, G and B in the others, and
read across bar lines the fret 3 joined string 6 of the next measure as a Gsus4. The headings were
"holds Gsus4 at beat 4", "G (anomaly)" under the file's printed G, and nothing. Joel: holds G
with one exception, continues G, continues G with one exception.

So a measure no form holds, whose own notes spell no chord, is tried with the form the measure
before was held with, and with its own notes joined by the strings the measure before or after
plays and it does not. A neighbour lends its strings only where it plays none of the measure's
strings at another fret. It is the last thing tried, after the moving finger, and these forms are
not tried with one.

It is kept that narrow because the corpus showed what wider does. Tried for every measure, the
form before beat the measure's own chord: Falling Slowly's Fsus2 measures after a C became
"continues C". Tried before the moving finger, it gave Into Dust's lone D under a printed D the
F before it and an anomaly. Joined with a neighbour that contradicts it, Sister Golden Hair's
measure 42 became a Gmaj7 from strings of the G before it. And a measure of one note, or of notes
on one string, is not a piece of a chord: American Pie's lead had a lone E holding Em, and slide
and pedal steel melodies borrowed a string to hold power chords.

The chord solo now reads "holds G at beat 2, one exception" (beat 1 is a rest), "continues G",
"continues G, one exception", in both its files. Elsewhere it gave Pink Houses' measures 52 to 54,
which held nothing between measures of G, "continues G", and Sister Golden Hair's measure 13,
which held nothing, "holds G6, one exception".

#### One finger moving through chords of one root

Dust in the Wind holds a C shape while one finger moves on string 2 between fret 1, open and fret
3: C, Cmaj7 and Cadd9. Over A minor the same finger gives Am, Asus2 and Asus4. Each measure plays
only two of the three, so read measure by measure the name followed whichever two it played: C,
then Cmaj7; Asus2, then Am. Decided 2026-10-21: where one finger moves through chords with the
same root, the plain chord's name is kept across the measures and the moves are counted as
exceptions.

- Consecutive measures held whole whose forms share a root and differ on one string at most take
  the plain major or minor chord, where its fret on that string is heard among them. A run where
  it never is keeps its own name, since naming it would name a note the track never plays.
- A measure no form holds, because the moves take more of it than an exception may, is tried as
  the plain chord with the finger moving. Every position of the finger must make a chord with the
  plain chord's root and not a second plain chord: E to Em is a change of chord, though one finger
  makes it. A melody on one string is not a finger moving through chords. The plain fret may be
  heard in the measure or the ones beside it, and no chord may be printed on a move.
- A move is counted once: it lasts until the finger goes to another fret, with notes on other
  strings in between, and a hammer-on or pull-off straight on from it is the same move.
- A measure with an exception on another string, one the shape leaves out, keeps its own reading.
  Until 2026-10-24 the moves replaced its exceptions and that note went uncounted: Dust in the
  Wind's lead measure 72, an Am with string 2 at fret 3 picked twice, said "continues Am" with
  none. It now says "continues Am, two exceptions". Six measures that said one exception now say
  two: Sister Golden Hair 16, 32 and 70, where the open string 1 at the end of a G is counted as
  it already was in measure 12, and Dust in the Wind's lead 8 and 51 and fingerstyle 34, each with
  an open B or a G on a string the shape leaves out.

Dust in the Wind's intro reads "holds C, one exception", "continues C, one exception", "holds Am,
two exceptions", and so on. Ripple's capo part, measure 36, walks string 5 down to a B before the
D minor: once "holds Dm at beat 4" of that B, it is now "continues C, one exception".

#### Holds or continues

"Continues C" means the heading before ended on C, since that is what the listener has; anything
else is "holds", even where the hand has been on the form since before the bar line. A measure
naming no form, or ending on "(anomaly)" or "(harmony)", leaves the next to say "holds". It was
first worked out from where the hand's form began, and 191 headings said "continues" of a chord
the heading before had not named. A printed chord's name goes with the whole form it agreed
with, so Sister Golden Hair's "holds E, holds G#m during beat 4" is followed by "continues G#m",
not Abm then G#m.

A measure that fits two forms equally, such as four beats of open string 3 between a C and a G,
continues the form before it: "continues C", then "holds G" in the measure that needs the G.
Looking ahead would announce the change a measure before anything in the notes shows it, and a
chord holds until something changes it, on the guitar and on the chart. A G printed over that
measure would make it "holds G". Decided 2026-10-21.

Measured on the guitar tracks with these changes: 2,214 of 2,542 sounding measures name a form,
87%; no "holds" or "continues" disagrees with the heading before; anomalies went from 61 to 44.
Ripple's lead measures 1 to 12: holds G at beat 2 with one exception, continues G, continues G
with one exception, holds C with one exception, continues C with one exception three times, holds
G with two exceptions, continues G three times, holds C with one exception.

#### A one-finger change for a beat

Sister Golden Hair goes from E to Esus4 and back within a beat, one finger on string 3, and the
file prints E, Esus4 and E. American Pie turns a C into Cmaj7 for a beat, string 2 coming off fret
1, and prints nothing there. Decided 2026-10-20:

- Where the file does not print it, a change of one string for a beat or less, with the same root,
  between two of the same form, is an exception of that form: "holds C, one exception".
- Where the file prints it, it stays a form of its own, and the form around it carries on
  afterwards with what the hand was holding. That makes three forms in the measure, so its heading
  names none: the printed E, Esus4 and E say it.

The second also applies where the change would otherwise have been taken as an exception and its
printed chord flagged as an anomaly, as four of Sister Golden Hair's sus chords were. A power chord
being filled out to the printed chord is not a change: Mother prints G where a G5 becomes a full G.

Making every chord printed on a note off the form start a new form was tried first and went too
far: Wish You Were Here's Em7 is one finger moved off a G and held there, and cut off from the G
its notes spell no chord, so those measures held nothing.

Across the guitar tracks 15 short changes like this were found. The 5 not printed are now
exceptions; the 10 printed, with 4 more that had been exceptions, are forms of their own.

#### Choosing between two forms

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

#### Passing notes

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

### What a measure says

#### Which measures name a form

The point is a measure picked inside one chord, as Ripple's first two are, saying "holds G, one
exception" rather than naming fragments of the G. It is not to list every chord a measure passes
through. A measure with a chord on every beat says nothing about forms; its beats, and the chord
symbols the file prints, say the rest. Decided 2026-10-20. A measure names forms when it has:

- one form, through the whole measure or part of it;
- two forms, with one change at a beat ("holds G, holds C at beat 3") or on the "and" of a beat
  ("holds G, holds C during beat 4"), and no beat or more holding nothing besides.

Measured on the guitar tracks: 1,531 of 2,542 sounding measures hold one form throughout, 163 one
form for part of the measure, 242 change at a beat, and 233 on the "and" of a beat, 85 of them the
last beat with the new form carried into the next measure. That is 2,169, or 85%. 183 hold no form.
The other 190 or so are spread over three or more forms, a change with a stretch holding nothing,
and the printed one-finger changes, none of them 2%, and name no forms. The forms are still found
for them: they count in Chords Used, and their printed chords are still weighed against them.

- Where a form is established: "Measure 1, holds G".
- Where it carries in from the measure before: "Measure 2, continues G".
- With exceptions: "holds G, one exception", "continues G, two exceptions". Where they fall is left
  to the beats. This was chosen over "exception at beat 4" to keep the heading short, and so that
  it does not matter whether a position counts notes or beats.
- A change partway through: "continues G, one exception, holds C at beat 3". Each form has its own
  count of exceptions straight after it. This was first "continues G for 2 beats, ..."; the length
  was dropped on 2026-10-20, since the next form's "at beat" or "during beat" already says where
  the first ends. Half of the headings with a position between beats were a change on the "and"
  of the last beat, as in "holds C#m, holds A during beat 4", and the length was the most words.
- A form that ends with no new one after it: "continues G for 2 beats", or "holds G for 2 beats"
  where it was established in that measure. Only a beat or more of notes holding nothing gives a
  form a length. Under a beat of them, such as a pickup into the next chord, does not end the hold,
  and those notes are still described beat by beat: Fade Into You's "holds A for 5.5 beats" is
  "holds A". Decided 2026-10-20; it took the guitar headings with a length between beats from 216
  to 89.
- A length is said in words: "for 2 and a half beats", "for half a beat", "for three quarters of a
  beat", rather than "for 2.5 beats", which a synthesizer reads as two point five. Thirds are there
  for triplets, and a length between these parts goes to the nearest. Decided 2026-10-20. Across the
  guitar tracks every length said falls on a half or a quarter.

Positions and lengths are beats of the time signature, as chord symbols already are: "at beat 3",
or "during beat 3" for a change between beats.

#### Beats inside a form

This is the one change to the list of beats; everything else about forms is in the heading.

In a measure whose heading names its form, a partial beat no longer names a piece of that form.
The name was never in the file: unstrung worked it out from the beat's own notes. The beat is
listed string by string, as a beat unstrung does not name already is, so open strings 3 and 4
read "eighth note, string 3, open; string 4, open" rather than "eighth note, G5/D, strings 3 and
4". The strings and frets are the file's and are unchanged. A stroke the file states is still
said, after the strings, as it was after the name: "quarter note, string 3, open; string 4, open,
down stroke". A beat sounding the full chord still names it, and an exception beat reads as it
always has: the heading has already said there is one.

In a measure whose heading names no form, about 15% of them, the beats stay as they are now,
G5/D and its strings included, since there is no named form for them to belong to. Decided
2026-10-21.

### Printed chord symbols

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

#### The chord symbol phrase

Measure headings already carry a phrase for the chords the file prints: "chord symbol G at beat
1". Where the heading names a form, the form already gives the file's name, or "(harmony)" or
"(anomaly)" does, so the phrase would say the chord twice and is dropped: "Measure 102, holds G".
It stays for a printed name unstrung cannot read, which nothing else says, and in measures that
name no form, where it is the only place the file's chords are given. Decided 2026-10-21.

#### Anomalies

A track with anomalies gets a collapsed region after Chords Used and before the measures, summarised
"Anomalies - 3" as Chords Used is, with one item per measure: "Measure 12: the file prints G, the
notes hold Em". A track with none has no region, so it does not add a stop to every track.

#### Chords printed on rests

Fixed 2026-10-24. `trackEvents`, `describeChordSymbols` and Chords Used all skipped a chord the
file prints on a rest, which files do before a strum: Sister Golden Hair's second rhythm guitar
prints A on the rest before it. The chord before stayed in effect, so the printed F#m seemed to
run over measures of E, and a measure naming no form said nothing of the chord. A chord printed
on a rest is now read as printed. It changes 7 of Vincent's headings, and gives Vincent two
anomalies: a C printed on a rest over E, G and B.

#### Trusting the printed chord

Joel's question, 2026-10-24, after the Ripple Chord Solo printed a G over measure 2 that the app
called an anomaly: what if the file's chord is trusted? Every anomaly on the guitar tracks was read
beat by beat. The detail names songs measure by measure, so it is in `anomaly-review.md` beside the
record in the Guitar folder, not here.

Of the 45 anomalies, none is the file plainly wrong. In 19 the printed chord is right and the form
finder misread the notes, for these reasons:

- A bass note counted as an exception, because adding it changes the chord's root: Into Dust's F
  under its Fsus2, the F#m11 shape in Sister Golden Hair, the E under Wish You Were Here's Em7.
- A quality the finder does not recognise: 7sus4 is not in `RECOGNIZED_STRUM_SUFFIXES`, so Wish
  You Were Here's A7sus4 shape is never a candidate and the Em7 shape is held instead.
- `keepPlainChord` treats G to G minor, one finger on string 5, as one chord with a finger
  moving, though `playMovingFinger` already says a change from E to Em is a change of chord.
- A quick hammer from B flat to B taken as the form's fret, making a G minor.
- A whole measure read as one form across a chord printed in the middle of it.
- Lead playing: a fragment held for half a beat named, where the line is mostly in the printed
  chord's tones.

25 are a matter of naming: Into Dust's C, 23 measures of C, G and the drone D with no E, which the
rule of 2026-10-20 makes Csus2 and an anomaly; and Vincent's two measures of E, G and B under a C.
One is a lick of C, B and G under an Am, fair by the notes.

`trustPrinted` in `FORM_DEFAULTS`, on in the app from 2026-10-24, Joel's decision after reading
the review: where one printed chord covers a whole measure, the measure is first tried as that
chord (`playPrinted`). Each string takes the
fret that sounds one of the chord's tones; a string with none keeps its fret as an added tone,
unless that is a semitone from a chord tone. It holds where at least two of the chord's tones are
held, there are no more added tones than chord tones, the shape does not spell a chord of another
root, and the notes off it pass the tests of any whole measure. Beyond the measure where the chord
is printed, it is tried only where the measure's notes spell no chord of their own.

A shape that leaves out the printed chord's third and holds its second or fourth is the sus
chord, not the printed chord with a note added, and keeps the rule of 2026-10-20. Into Dust's
23 measures of C, G and the drone D stay "C (anomaly)". Joel, 2026-10-24: the Csus2 is clear and
persistent across many measures, beyond a single flourish. A second or fourth heard for a moment
is an exception of the printed chord, as before.

With it on, 16 of the 45 anomalies end, none are made, and 67 headings change in 9 tracks.
`chord-forms-anomalies.mjs --diff` lists every change. Joel is going through them a group at a
time; each decision goes here.

- Into Dust's other seven, accepted 2026-10-24: "holds Fsus2" in measures 45 and 95, where the F
  bass had been a note off a G5; "holds Gm" and "continues Gm" in 71 and 72; "holds Em7" in 46
  and 96, where the E bass had been two exceptions.
- Measure 108 of Into Dust is "continues G, one exception": the open high E picked once is an
  exception, not a note added to the G, as Joel hears it. A note added to the printed chord that
  is picked once in the measure, on its own, is an exception, as `passingNotes` already says for
  forms found from the notes. That alone lost Sister Golden Hair's three F#m measures, whose
  F#m11 shape picks its open B and E once each, so it applies only where one string in the
  measure is like that: several are an arpeggio ringing through the shape. With both, nothing
  else changed. Decided 2026-10-24, with the principle in `chord-forms-workflow.md`.
- Sister Golden Hair's F#m, measures 24, 40 and 78 of the second rhythm guitar, "holds F#m, one
  exception", 2026-10-24. The shape is 2x2200, an E and a B added to F#m. Taking both into the
  shape made "holds F#m", and Joel: a seventh and an eleventh added is getting loose to call it
  F#m. Taking both as exceptions does not hold at all, since they are half the measure and two
  come together. So the printed chord keeps at most one added note, the one heard longest, and
  any other is off the form. Nothing else in the corpus changed.
- Vincent's measures 6 and 32 stay "C (anomaly)", 2026-10-24. The file prints C on a rest and
  the notes are E, G and B, no C; Joel: they spell Em, not C. The printed chord is not taken where
  the measure's notes, those off the form included, spell a chord with another root. A first
  version used the first reading of the notes and rejected more than it should, since G, B, D and
  E read as Em7 before G6, and A, E and B as Esus4 before Asus2; so it rejects only where no
  reading has the printed root. With that, nothing else changed.
- Vincent's measure 4, "holds Am during beat 1, two exceptions", accepted 2026-10-24. The Am is
  picked with an open B twice and no C, a sus2 for one measure, and the C comes in the next.
  Unlike Into Dust's Csus2, which holds for many measures, it is the Am with the B as
  exceptions. The B is a semitone from the C, so it is off the form, and the rule for a held sus
  chord does not see it. Measure 5 after it, "continues Am, three exceptions", and measure 15,
  "holds Am, two exceptions", one for each time the finger leaves the C for the open B, accepted
  too.
- Ripple's capo part, measure 40, "holds G7", accepted 2026-10-24: a full G7 strummed under a
  printed G7, which had been the G before it with the F as an exception.
- The same note off the printed chord picked again straight after is one exception, the finger
  staying where it went, as a move counts once in `movesOn`. Found 2026-10-24 in the Wish You
  Were Here Chord Solo's measure 18, where a D on string 2 picked twice at the end of the measure
  had become two exceptions. It also changed Vincent's measure 11, from "continues Am, holds Am
  during beat 3, one exception" to "continues Am, two exceptions", an open B picked and picked
  again into a hammer-on counting once; and the chord solo's measure 5, from "holds G, holds Gsus2
  during beat 2" to "holds G, two exceptions". Nothing else moved.
- The totallyGuitars Wish You Were Here files, accepted 2026-10-24: the chord solo's measures 2,
  3 and 5, "holds Em7, four exceptions", "holds G, two exceptions" and "holds G, two exceptions";
  the .gpx's measures 2 and 4, "holds Em7", and 13, "holds G, one exception", where a quick hammer
  from B flat to B had made it G minor.

Every change trying the printed chord makes has been read and accepted. With it and the rules
above, 65 headings change in 9 tracks against it off, and 14 of the 45 anomalies end, none made.
The 31 left: Into Dust's 23 Csus2 measures and Vincent's 2 Em measures, decided to be anomalies;
and 6 the printed chord cannot hold: four lead lines in the Wish You Were Here Chord Solo,
Vincent's measure 22, a melody on string 2 taking more than a third of the measure, and its
measure 19, with a chord printed in its middle.
- Wish You Were Here on Songsterr, three tracks, accepted 2026-10-24: the Em7 measures say
  "holds Em7", where the E bass had been exceptions of a G shape; the A7sus4 measures say "holds
  A7sus4", with the walk into the Em7 as its exceptions, where they had been anomalies or named
  nothing.

### Chords Used

Beats in a form count towards its chord, not towards the fragments they would spell alone, so G5
and C5 leave Ripple's lead track. Where the form agreed with a printed chord they count towards that
chord under the file's name, so Into Dust's D picked without its third is listed as D, not D5.

The file is the first source of truth for fingerings: a chord's row shows the form as the track
plays it, labelled so, and the library's shapes after it where they differ. The library is used
where the file gives no form or an ambiguous one. Ripple's G is 320003 in the file, which is the
library's first G.

### Measured across Joel's Guitar folder

The report was run on 2026-10-20 over the 22 Guitar Pro files in Joel's Guitar folder: the Songsterr
corpus and the totallyGuitars files. Two are byte-for-byte copies of others and were skipped. Its
output names songs and measures, so it is read on Joel's machine and not kept here. With the rules
above, on the 35 guitar tracks (General MIDI programs 24 to 31):

- 2,359 of 2,542 sounding measures hold a form.
- No held form is wider than 3 frets, and none was rejected for width, so a reach of 4 does not
  bind.
- Of 1,456 printed symbols, 919 agree, 437 partly agree (the form covers only part of the
  symbol's stretch, up to the next printed chord), 30 are harmony and 61 are anomalies. 6 are names
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

### Which tracks

unstrung lists only guitar and bass tracks, General MIDI 24 to 39, since those are the only samples
it has; decided 2026-10-20. The Tracks row of the summary says how many others the file has. Chord
forms in the measure heading are for guitar tracks only, 24 to 31, not bass, since a root and fifth
on a bass reads as "holds C5"; decided 2026-10-21. Lyrics are still read from the vocal tracks,
which are no longer listed, and hung on every listed track's measures as before; also decided
2026-10-21. Ripple's mandolin, General MIDI 107, is one of the tracks left out.

Each listed track keeps its place in the file, which is how its audio track reaches the score: in
American Pie the first guitar listed is the file's fifth track. `scripts/songs/verify-guitar-bass-tracks.mjs`
checks the list and that the first listed track plays.
