# unstrung Features

unstrung reads guitar tablature and other music notation files as text and headings.
It plays any guitar track at the tempo you choose, generates chord progressions to practice with, and looks up chords.
Everything works from the keyboard and is written to be read with a screen reader.

unstrung comes as a desktop app for Windows and as a web version that runs in Chrome or Edge.
They work the same way.
The differences are listed at the end of this document.

Prompter's Note: This file was written by Claude.
I was going to edit it down to bare essentials.
I decided, though, that some people like more complete directions.
The user interface (UI) for unstrung is very accessible and, I think, intuitive.
You might want to simply try it and arrow around in the features when you use them.
This file can be a good reference if you get lost.

## The window

From the top, the window has:

- **The Menu button,** which opens the menu with every command.
  ctrl+home gets you to it.
- **Open items.** Every song, chord progression, chord library and help document you open is listed here, newest first.
  Each is a level 1 heading holding a button, followed by a Close button.
  Pressing an item's button shows it in the main area of the window and moves you to the start of it.
  In browse mode, 1 and shift+1 move from one open item to the next.
- **The main area,** showing the open item you chose.
  Its own headings start at level 2.
- **The status bar,** at the bottom of the window, where unstrung says what it has just done.
  Your screen reader reads it as it changes, and nvdaKey+end reads it again.

### Keyboard shortcuts

- ctrl+o: open a song file.
- ctrl+shift+o: open a saved chord progression.
- ctrl+s: save the chord progression being shown.
- ctrl+shift+s: save it under a new name.

Playback has its own keys, described with each kind of playback.

### Dialogs

Every dialog starts with a level 1 heading ending in "Dialog Box", such as "Settings Dialog Box".
The window title names the dialog while it is open.
escape closes a dialog.

## The menu

Press enter, spaceBar or downArrow on the Menu button to open the menu.
It works like a desktop application's menu:

- upArrow and downArrow move through it, wrapping around at either end.
- rightArrow opens a submenu, and leftArrow closes it.
- A letter moves to the next item starting with that letter.
- enter runs the command.
- escape backs out one level, and from the top closes the menu.
- tab closes the menu and moves on.

The menu holds:

- **Open File…**
- **Recent Files,** the last ten song files you opened.
- **Chord Progressions:** Generate Practice Progression…, Manually Create Chord Progression… and Open Saved Progression….
- **Chords:** Chord Library, Frets to Chord… and Listen to Guitar Samples….
- **Settings…**
- **Help:** the help documents, and About unstrung….

## Reading a song file

### Opening a file

Choose Open File from the menu, or press ctrl+o.
unstrung reads Guitar Pro files (.gp, .gpx, .gp5, .gp4 and .gp3) and MusicXML files (.musicxml and .xml).
Files you have opened are listed in Recent Files, in the menu.

The file opens as a new item in the list of open items, and you are moved to the start of it.

### Song summary

The first heading is Song summary.
It lists what the file says about the song: title, artist and album where the file has them, tempo, feel if the song is swung or shuffled, number of bars, time signature, key signature and number of tracks.
Where the tempo, time signature or key signature changes later in the song, the summary says so.

### Tracks

The next heading is Tracks, with the number of tracks.
Each track has a level 3 heading with its number and name, and a list of its instrument, tuning and capo.
The tuning is spelled out note by note, with its name when the file gives one.

Each track then has three collapsed sections:

- **Chords Used,** with the number of chords.
  Each chord the track plays is listed, collapsed, with how many beats it sounds on, its fingering and its notes.
  A part played one note at a time names no chords, and the section says so.
- **Measures,** with the number of measures.
  Each measure is a level 4 heading with its number, the section it starts if any, its repeat marks and its chord names.
  Under the heading are the lyrics sung over the measure, then a description of each beat: the strings and frets played, how the strings are struck, and techniques such as slides, bends, vibrato, harmonics and let ring.
- **Audio track for** and the track's name, where the track is played.

The measures are collapsed because a song can run to hundreds of lines.
Expand them when you want the detail.

## Playing a track

Expand the "Audio track for" section at the end of a track.
It starts with a level 4 heading of the same name.
To collapse it again, go to that heading and then up one line.

### Setting it up

- **Tempo in beats per minute,** from 15 to 300.
  It starts at the tempo the file gives.
- **Measures selected,** a collapsed section saying which measures will play.
  Inside it are the first and last measure, how many times to play them (up to 50, or 0 to repeat until you stop), and whether to count in before every repeat or only the first time.
- **Metronome,** which also counts in one measure of clicks the first time through.

### Playing

After the settings, the Track heading is followed by a summary of the track: how many notes, how long it is, and the tempo.
Then come the Create Track and Play Track buttons.

Press Create Track.
unstrung builds the track from the guitar samples, says when it is ready, and enables Play Track.
Play Track starts and pauses playback.

Under the "Move around the track" heading are buttons to go to the previous or next measure, to the start of the current measure, or to the start of the selected measures.

Collapsing the audio track section stops playback.
Expanding it again does not restart it; press Play Track to carry on from where it stopped.
Showing another open item collapses the section, and so stops playback, unless you turn that setting off.

### Keys

While your screen reader is in focus mode, these keys control playback.
The same list is in the audio track section, under the Keyboard control heading.

- spaceBar: pause and resume.
- leftArrow: back one measure.
- rightArrow: forward one measure.
- downArrow: back to the start of the current measure.
- upArrow: restart the selected measures, counting in again.
- b: say which measure you are in, and which repeat.
- m: metronome on or off.
- s: slower by 5 beats per minute.
- f: faster by 5 beats per minute.

In NVDA, nvdaKey+spaceBar turns focus mode on and off.
unstrung cannot do it for you.
Turn focus mode off before you move somewhere else, or the keys you press there will go to unstrung instead of moving you around.

## Chord practice

Chord practice generates a chord progression and plays it for you to play along with.
Each measure has one chord, strummed on every beat, with a metronome and, if you want it, the name of the next chord spoken.

### Generating a progression

Choose Generate Practice Progression from the Chord Progressions submenu.
The Chord Practice dialog asks for:

- **Experience level.** Beginner uses open chords only.
  Intermediate adds barre chords and seventh chords.
  Advanced adds extended chords and chords borrowed from other keys.
- **Key.** Only keys with enough chords playable at the chosen level are listed.
- **Chords from outside the key:** none, occasional or frequent.
  These are mostly chords that lead into the next one, such as D7 before G in the key of C, and chords borrowed from the minor key.
- **Beats per measure** and **note value that gets one beat,** the two numbers of the time signature.
- **Tempo,** from 30 to 240 beats per minute.
- **Number of measures,** from 2 to 256.
  A chord is sometimes held for two measures, as in most real progressions.
- **Times to play the progression,** up to 50, or 0 to repeat until you stop, and whether to count in before every repeat.
- **Metronome.**
- **Speak the name of the next chord on the last beat of each measure.**
  The voice and its volume are set in Settings.

Press Generate Progression.
The progression opens as a new item in the list of open items.

### The progression

A progression's item has:

- **Metadata:** the key, level, time signature, length, the cadence it ends with, how many chords come from outside the key, and whether it has been saved.
- **Chords Used:** each different chord once, collapsed, with its fingering and notes.
  A chord from outside the key says which key it comes from and why.
- **Progression:** the chords in order, one per measure.
  While there are unsaved changes, this heading, the item's name and the level 2 heading at the top all say "unsaved changes".
- The Edit Progression, Save Progression and Save Progression As buttons.
- **Playback:** whether to speak the chord names, tempo, times to play, count in, metronome, and the Play Progression button.
- **Move around the progression** and **Keyboard control,** the same buttons and keys as an audio track.
  b also says the chord of the measure you are in.

### Saving and opening progressions

Save Progression, or ctrl+s, saves the progression.
The first time, unstrung suggests a name such as Am-60-intermediate-occasional: the key, the number of measures, the level and the setting for chords from outside the key.
Save Progression As, or ctrl+shift+s, saves a copy under a new name.
Only the key, time signature and chords are saved, not the tempo, metronome or number of repeats.

Progressions are saved as ordinary files in a folder you choose in Settings, so they can be copied, backed up and shared like any other file.
On the desktop the folder is Unstrung\Progressions in your Documents folder unless you choose another.

To open one, choose Open Saved Progression from the Chord Progressions submenu, or press ctrl+shift+o.
The folder is shown as a tree.
upArrow and downArrow move, rightArrow and leftArrow open and close a folder, a letter moves to the next name starting with that letter, and enter opens the progression.
Any file that cannot be opened is listed after the tree with the reason.

If you close a progression with unsaved changes, or quit the desktop app with one open, unstrung asks whether to save first.
A progression that has just been generated and never saved is not asked about.

### Editing a progression, or making your own

Edit Progression opens the Editing Chord Progression dialog.
Manually Create Chord Progression, in the Chord Progressions submenu, opens the same dialog as Creating Chord Progression, with one empty measure.

The dialog sets the key and time signature, and lists the measures, one chord each.
In the list of measures:

- enter: choose a new chord for the measure.
- delete: remove the measure.
- ctrl+i: insert an empty measure after it.
- ctrl+d: duplicate it.
- alt+upArrow and alt+downArrow: move it.

There are buttons for each of these as well.

The chord field starts empty.
While it is empty, downArrow lists the chords the key is built from, each with its scale degree.
Typing searches every chord in the chord library instead.
A chord from outside the key is marked as such but can still be chosen.
enter takes the chord and goes back to the measure in the list.

Apply Changes, or Create Progression for a new one, puts the progression in its item.
With changes made, escape does not close the dialog; press Cancel to discard them.

## Chord library

Choose Chord Library from the Chords submenu.
It opens as an item in the list of open items, with you in its search field.

Type part of a chord name and a list of matching names appears.
upArrow and downArrow move through the list, enter takes the highlighted name, and escape closes the list and leaves what you typed.
tab also closes it and moves on.

The Filtering options section narrows the results by difficulty (standard shapes only, common alternatives, or advanced voicings), root note, chord type and genre.

Under the Search Results heading, each matching chord has a checkbox, and so does each of its fingerings.
The shortest matching name and its most common fingering start checked.
Each chord also has a collapsed section with what is known about it.

Under the Playback heading are the chords you have checked.
Play selected chords strums them, speaking each name first if "Speak chord name before playing" is checked.
Clear selected unchecks them all.

## Frets to Chord

Frets to Chord works the other way round: you say what each string is doing, and unstrung names the chord.
Choose it from the Chords submenu.

Set the tuning, then each string from 6 to 1: open, not played, or a fret from 1 to 15.
The chord name follows the Identified Chord heading, and updates as you change each string.
View in Chord Library opens that chord in the chord library.

In a tuning other than standard, unstrung still names the chord from its notes, but says that the fingerings in the chord library do not apply.

## Listening to the guitar samples

Every note unstrung plays is a real recording.
Listen to Guitar Samples, in the Chords submenu, plays them in order from lowest to highest.
From E2 up the notes are a green Gretsch guitar; from B0 to D#2 they are a bass guitar.

You can choose:

- **Velocity layer:** soft, medium or loud.
  Each was recorded separately and sounds different, not only quieter or louder.
- **Number of round robins to play per note.**
  Round robins are separate recordings of the same note, which is why a repeated note does not sound identical every time.
- **Time between notes.**
- **Announce note names while playing.**

## Settings

Choose Settings from the menu.
The dialog has three tabs.

### General

- **Voice for spoken chord names:** Zira or David.
- **Spoken chord volume,** as a percentage, relative to the guitar.
- **Folder for saved chord progressions.**

### Files

- **Default folder for Open File dialog,** desktop only.
- **Clear all recent files.**
- **Remove stale files from recents,** which takes out files that no longer exist.

### Screen Reader

- **Shorter beat descriptions.**
  A beat that strums a chord unstrung can name is described by the chord name and the stroke direction only.
  Off unless you turn it on.
- **Collapse expanded sections when switching to another open item.**
  Coming back to an item with its measures still expanded can leave a screen reader unresponsive for several seconds while it takes in every beat again.
  On unless you turn it off.

## Help

The Help submenu opens each help document as an item in the list of open items: Introduction, Screen Reader Users, Features (this document), Third Party Components and Resources.
The last entry, About unstrung, opens a dialog with the version and the file formats supported.

## The desktop app and the web version

The two work the same way, with these differences in the web version:

- It runs in Chrome or Edge.
  Firefox and Safari cannot open files from a web page this way.
- The guitar samples and spoken chord names are downloaded the first time each one is needed, and kept by the browser after that.
  The first time a song or progression plays, it may take a moment to start.
- Files and folders are chosen through the browser, which shows only a folder's name, never its full path.
  Settings has a Choose Folder button for saved progressions in place of a typed path, and there is no default folder for Open File and no Open Folder button.
- On a later visit, the browser asks permission again before unstrung can use a file or folder chosen earlier, unless you chose to allow it on every visit.
  The question appears beside the address bar, and unstrung's status bar says when it is waiting for one.
- Settings and recent files are kept by the browser, separately for each browser profile.
- Reloading or leaving the page closes everything open in unstrung.
  The browser asks first while anything is open.
