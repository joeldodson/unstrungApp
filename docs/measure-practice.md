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

## Set aside for later

- A tempo that rises a few BPM each repeat, up to the song's tempo.
- A key that drops the first measure of the selection, so it can slide forward through the song
  instead of always growing.
- A dialog for editing the selection. The Measures to Play fields already do it, and a dialog
  would be a third place.

## Nothing here needs Electron

All of it is renderer and Web Audio work, and runs in the web version as it is.
