# Practising a song measure by measure

Written 2026-10-27, from a design discussion.

## What Joel asked for

Learning a song a measure at a time: read a measure, play it until it is right, try the next one
on its own, then play the two together, and so on through the song. Today that means leaving the
measures, opening the Audio Track section at the end of the track, and typing a first and last
measure. He wanted to play a measure from where he is reading it, add measures to what is playing
one at a time, choose between playing once and repeating until stopped, and keep tempo control
close at hand, with keys for all of it.

## Decisions

### One region per track for measures and playback

The Measures disclosure and the Audio Track disclosure become one disclosure per track, after the
track's details list. Choosing measures and playing them is one activity, and with two regions the
selection could be edited from two places. Its summary is "Measures and Playback - 112 measures";
the track's name is already in the h3 above it.

Inside it, in order:

- h4 **Playback Settings**: the settings below, the Play button, and the status line.
- h4 **Measures - 112**.
- h5 for each measure, as the h4 is today: "Measure 5 - Verse - chord G". Then a button row, then
  the measure's lyrics and beats.

The levels are chosen so that shift+4 from any measure reaches the Measures heading and then
Playback Settings, while 5 still steps through the measures. The measures are no longer behind a
disclosure of their own. They are still built only when the region is first opened, for the
reason given in `buildSummaryPanel`: exposing every beat costs the screen reader time on entering
the document.

Collapsing the region stops playback, as collapsing the Audio Track section does now. The playback
keys act on the track whose region is open; of several, the one holding focus, otherwise the one
last used.

### Playback settings

- **Tempo**, starting at the file's tempo. A tempo set by any means stays until the song is
  closed, which is how it already works. D goes back to the file's tempo or the last one typed.
- **Metronome**: clicks while the music plays.
- **Count in**: one measure of clicks before playing starts. Separate from the metronome, so a
  count-in with no clicks during the music is possible. Today the count-in only happens with the
  metronome on, and a "count in every repeat" checkbox depending on it would have had to be
  disabled, which NVDA reads as "unavailable" without saying why.
- **Repeat**: a checkbox, repeating until stopped. It replaces the 0 to 50 count; once or
  continuously is all that is needed. When checked, **Count in before every repeat** appears
  straight after it.
- **Measures to Play**, a disclosure whose summary states the selection: "Measures to Play - 5 to
  12, Verse". Inside it, a Section dropdown, then the first and last measure fields.
  - The dropdown starts with Entire Song, then one entry per section marker in the file. A section
  runs from its marker to the next one.
  - A file with no markers has no dropdown.
  - When the fields, or the measure buttons, leave a selection that matches no section, the
  dropdown shows an entry for it at the end, "Measures 3 to 7".

### Buttons on each measure

A button row straight after each measure's heading, not inside it: a button in the heading would be
read at every heading stop. Each names its measure, because Tab in focus mode reads the button and
not the heading.

- **Play measure 5** plays that measure alone and leaves the selection as it was.
- **Add measure 5 to selection** stretches the selection to take it in, then plays the selection.
  The selection is always a continuous run: adding 5 to 1 to 2 gives 1 to 5. "Add to Track" was
  considered and dropped, since "track" already means the instrument part.

Both follow the Repeat checkbox.

### Keys

The existing single keys stay, in focus mode, as described in `user-docs/features.md`. Added:

- **N**: play the measure after the selection on its own.
- **A**: add that measure to the selection and play the selection.
- **L**: Repeat on or off.

Up arrow already goes back to the start of the selection, so after trying a measure with N it
returns to the selection without adding it. B says what is playing: "measure 3 alone", or "measure
2 of measures 1 through 3".

The list of keys, printed in every Audio Track section today, is no longer printed in each track.
In the merged region it would otherwise come before the measures. Instead, **?** opens a dialog
listing the playback keys, with a link to the Features document; following the link closes the
dialog and opens Features as an open item, as the Help menu does. A button in Playback Settings
opens the same dialog, for when the key cannot be used.

### Buttons for everything the keys do

Keys are no use on a phone, so every key has a button as well: play and pause, the measure moves,
restart, slower, faster and default tempo, try the next measure, add the next measure. Where they
go was left open; they are placed somewhere reasonable first and moved once tried.

### No Create Track button

The first Play, from the settings, a measure button or a key, loads the track's samples and says so
while it does. Having to open the settings and press Create Track before a measure button works
would defeat the purpose.

### Announcements

Messages from the measure buttons and keys go to an announcement region of the region's own, near
Playback Settings, which stays in the accessibility tree while the region is open.

### Chord Symbols in the track's details

Separate from the rest and can be built first. The Chord Symbols disclosure goes away and the
track's details list reads Instrument, Tuning, Capo, then "Chord Symbols - 4", with the chords
listed inside that item, each keeping its own collapsed details. The chord names are then heard
reading the track, without opening anything.

## What was built, 2026-10-27

Built the same day, while Joel was away, with the questions that came up settled by assumption so
that he could try it and change what is wrong. Where it differs from the decisions above, this is
what the app does.

- **Play measure 5 selects the measure**, rather than playing it and leaving the selection as it
  was. The selection starts as the whole song, so a Play that left it alone gave Add nothing to
  build from: Play measure 1 then Add measure 2 would have stretched the whole song to the whole
  song. Trying a measure without changing the selection is n, or Try Next Measure, as decided.
  Going back from a measure played alone loses nothing that matters: Play measure 3 while 1 to 2 is
  selected, then Add measure 1, gives 1 to 3, which is the next step anyway.
- **The whole song counts as nothing selected.** With it selected, n tries measure 1, a and Add
  Next Measure select measure 1, and Add measure 5 selects measure 5 alone.
- **n pressed again moves on**: it tries the measure after the one being tried. a then adds up to
  that measure, so trying 4 and 5 and adding gives the selection through 5.
- **Two headings for playback, not one**: Playback Settings (tempo and its buttons, the
  checkboxes, Measures to Play) and Playback Controls (Play, Keyboard Commands, the practice and
  moving buttons, the announcement and status lines, and About the Audio Track, collapsed, which
  holds the facts the old Track list gave). shift+4 from a measure reaches Measures, then Playback
  Controls, then Playback Settings.
- **The buttons**: Slower, Faster and Default Tempo straight after the Tempo field; Play and
  Keyboard Commands in a row of their own; Try Next Measure, Add Next Measure and Restart
  Selection; then Previous Measure, Next Measure, Start of Measure and Where Am I (b). The
  metronome and repeat keys have their checkboxes. Placed to be tried and moved.
- **Count In is on to begin with.** Playing along from a standing start is what it is for. Count In
  Before Every Repeat is independent of it, and off.
- **What is said**: n, a and l say what they did ("Measure 4 on its own", "Measures 3 to 4",
  "Repeat on"), since none of it can be heard straight away. Play measure 5 and Add measure 5 say
  nothing, the button having said it. The first play says "Loading the guitar samples for this
  track…" and then "Samples loaded."
- **The Playback Keys dialog** works where the keys do: while a track's region is open and focus
  mode passes keys through. Chord practice keeps its own printed list of keys for now; ? does
  nothing there.
- **Sections** come from what the measure headings already show, which includes section names a
  file wrote as beat text. Ripple's dropdown reads Intro, then "End Intro during beat 3, measures
  18 to 85", then Outro: the file's words, not tidied.
- **Headphones and media keys** can start a track that has never been played; the first play loads
  the samples as Play does. On a phone, the context is asked for in the press itself, before the
  loading, but this has not been tried on an iPhone.

Checked by `scripts/songs/verify-measure-practice.mjs` against Ripple. The older scripts that drove
the Audio Track disclosure were moved to the new region; `verify-track-chords.mjs`, which checked
the old order of Chord Symbols, Measures and Audio Track, was removed, the new script covering it.

## Changed after Joel tried it, 2026-10-28

- **No Tracks heading.** The number of tracks is the Song Summary's last row, so the heading only
  repeated it. Each track is now an h2 beside Song Summary, which frees a level inside the track:
  Playback Settings, Playback Controls and Measures are h3, and each measure is h4. shift+3 from a
  measure goes back up through them.
- **Chord Symbols is a collapsed region again,** inside the last row of the track's details, so the
  row reads "Chord Symbols - 5" and the chords are passed over until it is expanded. A track with
  none still says so in the row itself, with nothing to expand.
- **The tempo buttons are in Playback Controls,** after the measure moves, not after the Tempo
  field. On a phone, moving around a track and changing the tempo happen together, so the buttons
  belong in one place.
- **No Keyboard Commands button.** Playback Controls starts with a line, "Type ? for keyboard
  commands." A screen reader user knows the keys need focus mode, so the dialog no longer explains
  it either; it is said once in Features.
- **No Try Next Measure or Add Next Measure buttons.** The Play and Add buttons under each measure do
  it on a phone; n and a do it from the keyboard. Restart Selection stays, in the row of moves.

## Set aside for later

- A tempo that rises a few BPM each repeat, up to the song's tempo.
- A key that drops the first measure of the selection, so it can slide forward through the song
  instead of always growing.
- A dialog for editing the selection. The Measures to Play fields already do it, and a dialog
  would be a third place.

## Nothing here needs Electron

All of it is renderer and Web Audio work, and runs in the web version as it is.
