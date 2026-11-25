# unstrung Features

Prompter's Note: This file was initially written by Claude.
I've lightly edited some areas and some sections are all human written.
There is still a lot that smells like AI writing though.
But it is accurate and has good details, I decided to leave it as is.

The user interface (UI) for unstrung is very accessible and, I think, intuitive.
You might want to simply try it and arrow around in the features when you use them.
If you have not yet, spend a few minutes skimming the [Introduction to unstrung](/unstrung/docs/introduction/).
It might help to understand the features and why they exist as they do.

This document describes everything unstrung does, in detail.
It starts with the platform, the window and the unstrung menu, and how media controls work.
After that it follows the menu, with a section for each item or submenu, in the order the menu lists them.
It doesn't assume a musical background, and it explains music terms the first time they come up.
For more on notes, scales and the parts of the guitar, read [Notes and Scales on the Guitar (opens in new tab)](/articles/notes-and-scales-on-the-guitar/).

## Platform is a Feature

As noted elsewhere, unstrung started as an Electron-based desktop app.
It was designed to be downloaded and installed.
I chose Electron for its web-based core and tight control over components and their versions.
Building an Electron app you know exactly what you are using, it's all packaged and installed with your own code.
It's a lot of work though to get into app stores and support multiple platforms, even only Windows and macOS.

As noted in the [Introduction to eyesunstrung](https://eyesunstrung.vip/articles/introduction/), Claude assured me almost all of unstrung would run in a browser.
So I did a complete redesign with the goal of a single look and feel for unstrung across any platform.
My initial thought though was to still require a Chromium-based browser to still have some level of consistency.
Then I wanted to try it on a browser on my phone.
I'll keep my rantings about Apple and WebKit to myself and simply note all browsers on iOS are effectively Safari (WebKit) underneath.
(I really wish Google could make TalkBack on Android less laggy, I'd switch.)
The unfortunate reality is most blind people, at least in the U.S., use iOS.
So I broadened my target to browsers on iOS which indirectly opens support for Firefox on Windows, macOS, and Linux.

I initially thought I'd limit functionality on non-Chromium-based browsers lacking support for some APIs.
Claude suggested workarounds though which sounded not too bad.
And I figured if people are using those platforms and browsers, that's the experience they'd expect anyway.

To get to my point, I've mostly abandoned the comforting idea of knowing what versions of which components unstrung is running on.
I try to test features on Electron, Chrome on Windows, and Chrome on iOS.
I hope that reduces most critical bugs.
You will run into issues, be ready to try and find workarounds.
You can read later in this document, under Media Controls Integration, about challenges I've already run into with media controls on iOS, including how I was able to get something to work again.
Be flexible and patient when you run into something not working as you'd expect.
Try to find a workaround.
And look in the footer of any page on eyesunstrung.vip for how to provide feedback.

The differences between the desktop app and the web version are listed at the end of this document, under The Desktop App and the Web Version.

## The Window

unstrung is designed to be identical in both the web and desktop versions.
This window description thus applies to both.
Well, one caveat now, the desktop version does not include the eyesunstrung.vip horizontal main menu bar.

First, at a high level, after the banner and menu button, the window is split into two columns.
The left column is the open items and should be at most 20% of the width of the window.
The remaining 80% I'll refer to as the main area.
Open items are a vertically stacked list of buttons with h1 headings to what is available in the main area.
Only one open item is active at a time and its contents fills the main area.
Next to each h1 is a close button.
Navigating by h1 headings should take you to all open items and the active one should say so.
There should be no other h1 headings in the app.
Caveat, the help documents start with h1 headings and they can be opened within the unstrung app.

Browse mode, which this document mentions often, is the screen reader's reading mode.
In it, single letters move through the page, such as h to the next heading and d to the next landmark.
Focus mode passes keys straight through to unstrung instead.
NVDA switches between them with nvdaKey+spaceBar.

From the top, the window has:

- The eyesunstrung banner, with a link to the main site.
- The eyesunstrung.vip main menu bar, in the web version only.
- **The unstrung menu button,** which opens every feature.
  It's in a navigation landmark, so in browse mode d and shift+d move to it.
- **Open items.** Every song, chord progression, tool and help document you open is listed here, newest first.
  Each is a level 1 heading holding a button, followed by a Close button.
  Pressing an item's button shows it in the main area and moves you to the start of it.
  In browse mode, 1 and shift+1 move from one open item to the next.
- **The main area,** showing the open item you chose.
  Its own headings start at level 2.
  A help document is the exception: it starts with its title as a level 1 heading, as on its page on eyesunstrung.vip, so 1 also stops there.
- **The status bar,** at the end of the window, where unstrung says what it has just done.
  Your screen reader reads it as it changes, and nvdaKey+end reads it again.

### Keyboard Shortcuts

If your browser doesn't support the File System Access API, they work a little differently, as described under The Desktop App and the Web Version, later in this document.

- ctrl+o: open a song file.
- ctrl+shift+o: open a saved chord progression.
- ctrl+s: save the chord progression being shown.
- ctrl+shift+s: save it under a new name.

Playback, the Metronome and the Tuner have their own keys, described in their sections.
While a song or progression is open, ? lists its playback keys in a dialog.

### Dialogs

Every dialog starts with a level 1 heading ending in "Dialog Box", such as "Settings Dialog Box".
The window title names the dialog while it's open.
escape closes a dialog.

## The unstrung Menu

Press enter, spaceBar or downArrow on the unstrung menu button to open the menu.
It works like a desktop application's menu.

- upArrow and downArrow move through it, wrapping around at either end.
- rightArrow opens a submenu, and leftArrow closes it.
- A letter moves to the next item starting with that letter.
- enter runs the command.
- escape backs out one level, and from the top level it closes the menu.
- tab closes the menu and moves on.

The menu holds these items, and the rest of this document has a section for each, in the same order.

- **Open File…** and **Recent Files,** the last ten song files you opened, are under Open File and Recent Files.
- **Chord Progressions** is a submenu: Generate Practice Progression…, Manually Create Chord Progression… and Open Saved Progression….
- **Chords** is a submenu: Chord Library, Frets to Chord… and Listen to Guitar Samples….
- **Strumming Patterns**
- **Metronome**
- **Tuner**
- **Settings…**
- **Help** is a submenu: the help documents, and About unstrung….

An item ending in three dots opens a dialog first.
Some items are unavailable in a browser without the File System Access API, as described under The Desktop App and the Web Version.

## Media Controls Integration

Before we get into playing audio tracks from a song or playing along with a chord progression, let's discuss controlling playback.
Media controls are a universal, platform independent idea.
Most keyboards have play/pause, next track, and previous track buttons.
Headphones and earbuds might have similar controls.
For example, some support single click for play/pause, double click for "next track", and triple click for "previous track."
Those might be mapped differently depending on the application; maybe fast forward and rewind some seconds instead of entire tracks.

You'll read later in this document about unstrung's keyboard commands to control audio playback.
Those are specific to unstrung and work only when the screen reader is in focus mode, when keys are passed through to the application.
In addition to the proprietary keyboard commands unstrung has defined, media controls are also supported.

Audio track and chord progression playback is focused on measures.
You select which measures to play, and how many times to play them.
Hit the play button and the audio will begin playing.
You can pause/resume playback with the media control mechanism, or using the spaceBar keyboard command.
You can restart the progression using previous track from media control, or upArrow on the keyboard.
Media control's "next track" (in quotes because we're kind of redefining that button), or downArrow on the keyboard, moves audio to the beginning of the current measure.
Remember the keyboard commands require your screen reader to be passing keyboard input through (focus mode in NVDA) while media controls work independent of the screen reader.

If you haven't, read the section earlier in this document about Platform is a Feature.
The web-based version of unstrung, especially on mobile, has implemented media control ... creatively (some might call it a hack).
There are times it will not work, or be inconsistent.
Suppose your phone goes to sleep.
A chord progression, for example, should continue to play.
And you should be able to start and stop it while the phone is still sleeping.
I've had times though when the progression has been stopped for a while, I could not get it to start again.
Even unlocking my phone and hitting play in the browser tab would not restart the progression.
I switched to another app and listened to some audio, then back to unstrung and the progression would now play.
Since version 0.7.7, unstrung tries to notice when the sound has stopped working and start it afresh.
So first, press play in the browser tab.
It should play, or say "The sound could not start. Press play to try again."
If it says that, press play again.
If that does not work, try what I did: play some audio in another app, then come back to unstrung and press play.
Worst case you might need to close the tab with unstrung and open a new one.

## Open File and Recent Files

These two menu items open song files.
A song file is a transcription of a song, usually written as tablature, or tab: for each note, which string to play and at which fret.
Each song opens as an item in the list of open items, and you're moved to the start of it.

### Choosing a File

Choose Open File from the menu, or press ctrl+o.
unstrung reads Guitar Pro files (.gp, .gpx, .gp5, .gp4 and .gp3), MusicXML files (.musicxml and .xml), and alphaTex files (.atex).
Guitar Pro and MusicXML files are easy to find on the web.

alphaTex is the format unstrung saves chord progressions in, so a saved progression can be opened as a song as well as a progression.
As a song, it has a track and measure headings like any other song, with its file name as its title.

Recent Files, in the menu, is a submenu of the last ten song files you opened.
Choosing one opens it again.

### Song Summary

The first heading is Song Summary.
It lists what the file says about the song:

- The title, artist and album, where the file has them.
- The tempo, the speed of the song in beats per minute.
- The feel, if the song is swung or shuffled, described under Feel, in Strumming Patterns.
- The number of bars, another name for measures, the short groups of beats a song is divided into.
- The time signature, such as 4/4, where the first number is the beats in a measure.
- The key signature.
- The number of tracks.

The key signature is given as a key: "A minor" where the file marks the key as minor, and the major key alone, such as "C", where it doesn't.
Most files are marked major whatever the song is, so "C" names the signature, no sharps or flats, more than the key.
Where the tempo, time signature or key signature changes later in the song, the summary says so.

### Tracks

A track is one instrument's part.
unstrung lists only the guitar and bass tracks of a song, since those are the only instruments it has recordings of.
Voice, keyboards, drums and other parts are left out, and the summary says how many.
A MusicXML part that names no instrument is listed if it's written as tablature, and its instrument is given as none named in the file.
The words of a vocal part are still read, and shown with every listed track's measures.

After the Song Summary, each track has a level 2 heading with its number and name, such as "Track 1 - Acoustic Lead".
After the heading is a list of the track's instrument, tuning, capo and chord symbols.
The tuning is spelled out note by note, with its name when the file gives one.
A capo is a clamp across the strings at one fret, and the list says which fret, or None.

The last item of the list is **Chord Symbols,** a collapsed section with the number of chords.
A chord symbol is a chord name printed over the music, such as G or Am7.
Inside the section, each chord the file prints over the track is listed once, collapsed, in the order it first appears, with how many times it's printed.
Where the file gives a chord diagram, its fingering is shown; otherwise the fingering comes from the chord library.
A track the file prints no chords over says so.

After the list is a collapsed section, **Measures and Playback,** with the number of measures.
It holds the settings and controls for playing the track, described under Playing a Track, and then the measures.
It's collapsed because a song can run to hundreds of lines.
Expand it when you want the detail or want to play the track.

### Measures

The Measures heading is level 3, with the number of measures.
Each measure is a level 4 heading with its number, the section it starts if any, its repeat marks and its chord names, such as "Measure 1 - Intro" or "Measure 4 - chord C".
A section is a part of the song the file names, such as Intro, Verse or Chorus.

Under the heading are two buttons, Play and Add, described under Practicing Measure by Measure.
Then come the lyrics sung over the measure.
Then each beat is described: how long it lasts, the strings and frets played, how the strings are struck, and techniques such as slides, bends, vibrato, harmonics and let ring.
For example, "eighth note, string 5, fret 2".

Some files write a second part with its own rhythm on the same staff, called a voice, such as a bass held under the picking in a fingerstyle arrangement.
Each voice after the first is one line, after the lyrics and before the beats.
It starts "Voice 2" and gives each note with the beat it falls on, for example "Voice 2: half note, string 6, fret 3, at beat 1; half note, string 6, fret 3, at beat 3".
The beats that follow are the first voice.

### Chords in Measure Headings

A measure heading gives the chords the file prints over it, as sheet music does.

- "chord C" means the file prints a C at the start of the measure.
- "continues C" means the measure prints no chord and the last one printed was C.
- "continues C, chord G at beat 3" means a G is printed partway through, and "during beat 4" is for one printed between beats.

A chord continues only to the end of its section.
A new section names no chord until the file prints one in it.

A printed chord gives the harmony, and the notes of the measure don't need to spell it: a melody can stray from it.
unstrung doesn't work chords out from the notes, so a heading names no chord where the file prints none.
The chords come from the file only.
If a file prints the wrong chords, or stops printing them partway through a song, unstrung can't correct it.
Look for a better transcription of the song.

Inside a measure, a beat is named as a chord when it sounds three different notes or more, such as "G/B, strings 1 through 5".
A beat with fewer is listed string by string, so open strings 3 and 4 aren't called G5.
A stroke direction is given only where the file states one.

### Playing a Track

Expand the Measures and Playback section after a track's details.
It starts with the Playback Settings and Playback Controls headings, both level 3, and then the Measures heading.
From any measure, shift+3 goes back to the Measures heading, then Playback Controls, then Playback Settings.
To collapse the section, go to Playback Settings and then up one line.

One track or chord progression plays at a time.
Starting one pauses whichever was playing, whether a track of the same song, a track of another song or a progression, and that one keeps its place.
Starting one also stops the Chord Library's Play Selected Chords, and Play Selected Chords pauses whichever track or progression was playing.

Collapsing the Measures and Playback section stops playback.
Expanding it again doesn't restart it; press Play to carry on from where it stopped.
Showing another open item collapses the section, and so stops playback, unless you turn that setting off in Settings.

#### Playback Settings

- **Tempo in beats per minute,** from 15 to 300.
  It starts at the tempo the file gives, or 60 if the file gives none.
  A tempo you set stays until the song is closed.
- **Speak the next measure,** off by default.
  When the file prints no chords over the track, it's unavailable and says why.
- **Metronome,** clicks on the beats while the music plays, off by default.
- **Count in,** one measure of clicks before playing starts, on by default.
  It works whether or not the metronome is on.
- **Times to play,** from 1 to 50, and 1 by default.
- **Loop,** which plays the measures over and over until you stop, whatever Times to play says.
  It's off by default, and l turns it on and off.
- **Count in before every repeat,** off by default.
- **Number of beats to count in,** shown only while Count in before every repeat is checked.
- **Measures to Play,** a collapsed section saying which measures will play.

Speak the next measure says each measure's chords just before it, as a progression does.
It says them one beat ahead for a single chord, all of them together before a measure that changes chord partway, and "repeat" for a measure with the same chords as the one before.
The chords are the ones the file prints over the track, as the measure headings name them, never worked out from the notes.
A chord printed once carries on until the next, so measures that print none are "repeat".
Measures before the first printed chord, and a section that prints none, say nothing.
A chord unstrung doesn't know isn't said, and one it spells another way is said its way, so G#m is said "A flat minor".
The first measure's chords are said during the count-in.
With Count in unchecked, playing from the start waits one silent measure so they can be said.
The voice and its volume are set in Settings.
Turning it on or off while playing carries on from where it is.

With the metronome on, each note is timed so that its attack sounds with the click, and the pick noise recorded before it comes just ahead.
A song that starts with a pickup, a short first measure, clicks only on the beats the pickup holds: a two-beat pickup in 4/4 clicks on 3 and 4.

Before a pickup, Count in counts a whole measure, then the beats before the pickup comes in: 1 2 3 4 1 2, and a two-beat pickup comes in on 3.
A change made before the first chord sounds starts the count-in again from its first click.
That's a new tempo, the metronome, Loop, a move to another measure, the strum spacing or the voice in Settings, or a progression's strumming pattern or feel.
With Count in unchecked, the silent measure before the first chord starts again in the same way.

When the measures have played Times to play times, playback stops and says how many times it played.
Changing Times to play while playing starts again from the beginning of the measures, with the count back at 1.
Turning Loop on while playing carries on, counting each time through.
Turning it off while playing goes on until Times to play is reached.
If that's already been passed, the time through under way finishes, then playback stops.
Times to play and Loop each keep their value when the other changes.

Count in before every repeat has no effect when the measures play only once.
Number of beats to count in runs from 1 to the beats per measure of the first measure played, and starts at all of them.
Fewer counts in each repeat with only the last clicks of the count-in, which is a shorter wait at a slow tempo.
So 2 in 4/4 clicks on beats 3 and 4, or on 1 and 2 before a two-beat pickup.
The count-in before the first time through is always a whole measure.

Inside Measures to Play is a Section dropdown, starting with Entire Song, then one entry for each section the file marks, such as Intro or Verse 2.
A file that marks no sections has no dropdown.
Then come the first and last measure to play.
When the measures chosen aren't the whole song or a section, the dropdown has an entry for them, such as "Measures 3 to 7".
The measures chosen are called the selection.

#### Playback Controls

The heading is followed by a reminder that ? lists the keys.

- **Play,** which becomes Pause while playing.
- **Where Am I,** which says which measure is playing, its chords, the beat, and which time through.
- **Slower, Faster and Default Tempo,** which change the tempo by 5 beats per minute, or put it back.
- **Restart Selection, Previous Measure, Next Measure and Start of Measure,** which go to the start of the selection, back one measure, forward one measure, or to the start of the current measure.

Pausing says where it stopped, such as "Paused at measure 3", whether from spaceBar, the button, headphones or a phone call.
The first time you play a track, unstrung loads its guitar samples first, says so, and then plays.

Where Am I says something like "Measure 9 of measures 7 through 21, G C@3, beat 2, play 2 of 3".
The measure is counted against the selection when it isn't the whole song.
The chords are the ones the file prints, carried on from earlier measures as the measure headings carry them, and written as the progression editor writes them.
They're left out where the file prints none.
The beat follows the measure's own time signature.
Times through are "play 2 of 3", or "play 5" while Loop is on, and nothing when the measures play once.

After the buttons, unstrung says what it has done when you ask.
A collapsed section, About the Audio Track, gives how many notes the track has, how long it is, and its tempo.

#### How a Track Sounds

unstrung plays exactly the notes the file writes.
Tab often prints a chord over a single bass note and leaves the rest to the player, and unstrung plays that bass note alone.
The chord is in the measure heading and the track's Chord Symbols, so you can strum it yourself if that's what the tab means.

Each string rings until it's played again, or until a muted note, written x, on that string stops it.
A muted note sounds nothing itself, but stops whatever its string was ringing, as damping it with the hand does.
So a muted strum, called a chuck, cuts off the chord before it, and strings it doesn't touch ring on.

Accented notes are played half as loud again as the notes around them, and heavy accents louder still.
Loudness otherwise comes from the dynamics the file writes, its markings for how loud to play.

A song the file marks as swung or shuffled is played that way, measure by measure, wherever the file marks it.
With triplet eighths, the feel Song Summary calls "triplet eighths (swung)", each pair of eighth notes is played long then short.
The second comes two thirds of the way through the beat instead of halfway.
Triplet sixteenths do the same to each pair of sixteenth notes.
The dotted and Scottish feels play their pairs as a dotted note and a short one, or the other way around.
Notes written as triplets, and eighth notes that don't fall in pairs on the beat, are played as written.
The metronome and the count-in still click on the beats.
Feel, in Strumming Patterns, describes each feel.

#### Practicing Measure by Measure

This is for learning a song a measure at a time.
Read a measure, listen to it until you have it, then add it to the measures you're learning, and so on.

Each measure has two buttons under its heading.

- **Play measure 5** plays that measure on its own, as many times as Times to play says, or until stopped if Loop is checked.
- **Add measure 5 to selection** changes the selection and says what the track now is, for example "Audio track is now measures 1 through 5."

Play measure leaves the selection as it is, and remembers where the track had got to.
While the measure plays, the button is named Stop measure 5, and pressing it stops the measure.
Press Play measure 5 again to hear the measure from its start.

Add measure works like this:

- If measure 5 is outside the selection, the selection stretches to include it.
- The selection is always one run of measures, so adding measure 5 to measures 1 to 2 gives 1 to 5.
- If measure 5 is already in the selection, the selection becomes measure 5 alone.

That's how to start over from one measure, including from the whole song, which is the selection to begin with.
Adding the old first and last measures back undoes it.
Add doesn't play the track; press Play when you're ready.
Anything playing stops.

In focus mode, enter presses the measure button you're on, as it does in browse mode.
spaceBar doesn't, because it's the track's play and pause key.

Two things can play here: the track, which is the selected measures, and a measure on its own.
Play, the playback keys and media keys belong to the track.
A measure's own button belongs to the measure.
The one exception is spaceBar while a measure plays on its own: it stops the measure and says "Stopped measure 5."

After listening to a measure on its own, Play goes back to the track, from where it was.
So do spaceBar, media keys, Restart Selection, Previous Measure, Next Measure, Start of Measure and their keys.
Each says where the track is as it goes back, for example "Back to the track at measure 12."
Nothing else about playing and stopping is said.
Where Am I says "Measure 5 on its own" while a measure plays on its own.

For example, with Loop checked:

1. Press Play measure 1 and listen until you have it.
2. Press Add measure 1 to selection.
3. Read measure 2, press Play measure 2, and listen until you have it.
4. Press Add measure 2 to selection.
5. Press Play to hear measures 1 and 2 together.

Play measure starts from the beginning of its measure, and Play after Add starts from the beginning of the selection.
Each counts in if Count in is checked.
The tempo stays as you set it.

#### Playback Keys

While your screen reader is in focus mode, these keys control playback.
They work while focus is anywhere in the song, on a button as well.
They don't work on the unstrung menu button or in the list of open items, where spaceBar and the arrows do what they do there.
? lists them in the Playback Keys dialog.
The dialog has a link to this document, which closes the dialog and opens this document.

- spaceBar: play and pause.
- leftArrow: back one measure.
- rightArrow: forward one measure.
- downArrow: back to the start of the current measure.
- upArrow: back to the start of the selection, counting in again.
- l: loop on or off.
- b: say which measure is playing, its chords, the beat, and which time through.
- m: metronome on or off.
- s: slower by 5 beats per minute.
- f: faster by 5 beats per minute.
- d: back to the default tempo, which is the song's own until you type another into the Tempo field.
- ?: the list of keys.

## Chord Progressions

A chord progression is a series of chords played one after another.
Most songs are built on one.
unstrung plays a progression for you to play along with.
Each measure has one chord or more, strummed with the progression's strumming pattern, with a metronome and, if you want it, the next measure's chords spoken.

The Chord Progressions submenu has three items:

- **Generate Practice Progression…** makes a progression for you from a few choices.
- **Manually Create Chord Progression…** starts an empty one for you to fill in.
- **Open Saved Progression…** opens one you saved.

### Generate Practice Progression

The Chord Practice dialog asks for these.

- **Experience level.**
  Beginner uses open chords only, the chords played near the headstock with some strings left open.
  Intermediate adds barre chords, where one finger presses several strings at once, and seventh chords.
  Advanced adds extended chords and chords borrowed from other keys.
- **Key,** the set of notes and chords a song is built around, named after its home note, such as C major.
  Only keys with enough chords playable at the chosen level are listed.
- **Chords from outside the key:** stay in the key, occasional or frequent.
  These are mostly chords that lead into the next one, such as D7 before G in the key of C, and chords borrowed from the minor key.
- **Beats per measure** and **Note value that gets one beat,** the two numbers of the time signature.
  The tempo counts beats, so the lower number doesn't change the speed: 6/8 at 90 is ninety eighth notes a minute.
- **Strumming pattern,** from the patterns for the time signature, described under Strumming Patterns.
  It starts on Down Only, and the list changes when the time signature does.
- **Feel,** Straight by default, described under Feel, in Strumming Patterns.
- **Tempo in beats per minute,** from 15 to 300, and 60 by default.
- **Number of measures,** from 2 to 256.
- **No chord held over into the next measure,** checked by default.
  The chord then changes on every measure, which is what practicing changes needs.
  Chords with the same root count as the same chord, so G7 never follows G.
  Unchecked, a chord is sometimes held for two measures, as in most real progressions.
- **Times to play,** from 1 to 50, and 1 by default.
- **Loop,** checked by default, which plays until you stop, whatever Times to play says.
  A progression opened from a file or made in the editor starts with Loop checked too, while a song's track starts with it unchecked.
- **Count in before every repeat.**
  Once that's checked, Number of beats to count in sets how many beats each repeat is counted in with, from 1 to the beats per measure.
  It starts at the beats per measure, and goes back to it when Beats per measure changes.
- **Metronome.**
  Each strum is timed so that its attack sounds with the click, and the pick noise recorded before it comes just ahead.
- **Speak the next measure,** checked by default.
  The next measure's chords are said just before it starts, as described under Playing a Progression.
  The voice and its volume are set in Settings.

Press Generate Progression.
The progression opens as a new item in the list of open items.

### The Progression

A progression's item has these parts.

- **Metadata:** the key, level, time signature, strumming pattern, length, the cadence it ends with, how many chords come from outside the key, and whether it's been saved.
- **Chords Used:** each different chord once, collapsed, with its fingering and notes.
- **Progression:** the measures in order, each written as the editor writes its chords, such as G D C@4.
- The Edit Progression, Save Progression and Save Progression As buttons.
- **Playback Settings** and **Playback Controls,** level 3 headings, described under Playing a Progression.

In the Metadata, the length is the number of measures and how long one time through takes at the tempo, such as "Length - 8 measures, 32 seconds at 60 beats per minute".
It changes with the tempo.
The strumming pattern is given by its name and its strokes, such as Old Faithful: D - D U - U D U.
A pattern unstrung doesn't have a name for is given by its strokes alone.
A progression with a feel names it after the strokes: Old Faithful: D - D U - U D U, triplet eighths (swing).
The cadence is the chord change that ends a progression, and its name, such as authentic, says what kind of ending it is.

In Chords Used, a chord from outside the key says which key it comes from and why.

In Progression, each measure is followed by a button, Add measure 5 to selection, which works as a track's does; see Practicing Measure by Measure.
It says what the selection now is, such as "Selection is now measures 2 through 5."
There's no Play measure button.
Open the saved progression as a song, with Open File, to go measure by measure that way.
While there are unsaved changes, the Progression heading, the item's name and the level 2 heading at the top all say "unsaved changes".

#### Playing a Progression

A progression is played by the same player as a song's tracks.
It sounds exactly as its saved file does when opened as a song with Open File.

Playback Settings has a track's settings, described under Playback Settings for a track, with two more after the tempo.

- **Tempo in beats per minute,** from 15 to 300.
  It counts beats, so 6/8 at 90 is ninety eighth notes a minute.
- **Strumming pattern.**
  Changing it carries on from where the progression is, so you can try patterns while it plays.
  Like the tempo, it isn't counted as an unsaved change, but saving keeps the pattern you're on.
- **Feel,** described under Feel, in Strumming Patterns.
  Like the pattern, it changes while the progression plays, isn't counted as an unsaved change, and is saved with the progression.
- **Speak the next measure,** checked by default, where a song's isn't.
- **Metronome,** **Count in,** **Times to play,** **Loop,** **Count in before every repeat** and **Number of beats to count in,** as for a track.
- **Measures to Play,** collapsed, as for a track, with First measure to play and Last measure to play.

Changing Speak the next measure carries on from where the progression is.
A measure with one chord has its name said one beat before it.
A measure with several has them all said one after the other, finishing just before it starts, which may be earlier than one beat ahead.
They're said as the editor writes them, so a chord with an @ is followed by its beat: G C@3 is said "G, C, at 3".
Where there isn't time for them all, only the first is said.
A measure the same as the one before it is announced as "repeat".
The first measure's chords are said during the count-in.
With Count in unchecked, playing from the start waits one silent measure so they can be said, as for a track.

Playing a progression a set number of times is a way to practice for a set time.
A progression has no sections, so the Measures to Play summary says Entire Progression when every measure plays.

Playback Controls has a track's buttons: Play and Where Am I; Slower, Faster and Default Tempo; Restart Selection, Previous Measure, Next Measure and Start of Measure.
Default Tempo goes back to the tempo the progression opened with, until you type another into the Tempo field.

The keys are a track's, listed under Playback Keys, l for Loop included.
Like a track's, they work while focus is in the progression, and not on the unstrung menu button or in the list of open items.
? lists them in the Playback Keys dialog.

The media keys on your keyboard and headphone buttons control a progression as they do an audio track; see Media Controls Integration.

### Creating and Editing a Progression

The Edit Progression button in a progression's item opens the Editing Chord Progression dialog.
Manually Create Chord Progression, in the Chord Progressions submenu, opens the same dialog as Creating Chord Progression, with one empty measure.

The dialog sets the key, time signature, strumming pattern and feel, and lists the measures with their chords.
The strumming pattern starts on the progression's own, and the feel as the progression has it.
Changing the feel here is a change to apply, unlike in Playback Settings.
A progression opened from a file whose pattern unstrung has no name for keeps it, listed as this progression's own.

The list of measures is used in focus mode.
In browse mode it's one line, Measures, and enter on it goes into the list at the current measure.
In the list of measures:

- enter: choose new chords for the measure.
- delete: remove the measure.
- ctrl+i: insert an empty measure after it and go to its chord field, ready to type its chords.
- ctrl+d: duplicate it.
- alt+upArrow and alt+downArrow: move it.

There are buttons for each of these as well.

The chord field starts empty.
While it's empty, downArrow lists the chords the key is built from, each with its scale degree, its place in the key's scale.
Typing searches every chord in the chord library instead.
A chord from outside the key is marked as such but can still be chosen.
enter takes the chord and goes back to the measure in the list.

Apply Changes, or Create Progression for a new one, puts the progression in its item.
With changes made, escape doesn't close the dialog; press Cancel to discard them.
If you quit the desktop app with changes in the dialog, unstrung asks whether to save them first.
Save applies them and then saves the progression, Don't Save quits without them, and Cancel goes back to the dialog.

#### More Than One Chord in a Measure

Type the chords with spaces between them.
Each chord starts on the next beat, and the last one lasts to the end of the measure.
In 4/4:

- G D C Am is a chord on each beat.
- G D C is G on beat 1, D on beat 2, and C on beats 3 and 4.
- G D C@4 is G on beat 1, D on beats 2 and 3, and C on beat 4.

An @ and a beat after a chord starts it on that beat, so G C@3 is two beats each.
The same chord typed twice in a row carries on rather than starting again, so C C G G is the same as C G@3, and is written that way.

A chord can start partway through a beat.
2.5 is the and of 2, halfway between beats 2 and 3, and 2.25 and 2.75 are the sixteenths either side of it.
So G C@2.5 changes to C on the upstroke after beat 2.
A chord after one that starts on an and starts on the next whole beat: G C@2.5 D puts D on beat 3.

The list of chords offers matches for the last chord typed.
After a space, downArrow lists the key's chords for the next one.
Anything that can't be read isn't taken, and the reason is said, such as a chord past the end of the measure.
Where the strumming pattern doesn't strum a chord on the beat it starts, the editor says when it's first heard.
With Down Only, G C@2.5 says "The pattern first strums C on 3."

### Saving and Opening Progressions

Save Progression, or ctrl+s, saves the progression.
The first time, unstrung suggests a name such as Am-60-intermediate-occasional: the key, the number of measures, the level and the setting for chords from outside the key.
Save Progression As, or ctrl+shift+s, saves a copy under a new name.

The key, time signature, chords, strumming pattern, feel and tempo are saved, the pattern, feel and tempo as they're set under Playback Settings.
The metronome and the number of repeats aren't.
Opening a progression sets the tempo to the one it was saved with.

Progressions are saved as ordinary files in a folder you choose in Settings, so they can be copied, backed up and shared like any other file.
On the desktop version, the folder is Unstrung\Progressions in your Documents folder unless you choose another.
The files end in .atex.
They're alphaTex, a plain-text way of writing music that other programs built on alphaTab can open too.

A few details of how the file is written matter when it's opened as a song with Open File:

- The tempo is written in quarter notes a minute, as music programs read a tempo, so 6/8 at 80 is written as 40 and the file opened as a song plays at the same speed.
- A 6/8 or 12/8 progression saved by an earlier version wrote its own number, so it opens at twice its tempo; set the tempo and save it again.
- Every note is written mf, medium loud, so a progression plays the medium recordings, opened as a song too.
- A feel is saved only where it has an effect, so a progression in 6/8 with Triplet eighths chosen opens as Straight.
- An upstroke is written on the four highest strings of the chord, or all of them for a chord of four strings or fewer, as a hand coming back up catches the top of the chord.
- Opened as a song, an upstroke plays that way, the lower strings ringing on from the stroke before.
- Earlier versions of unstrung wrote every string on an upstroke; those files still open, and are written the new way when saved again.

A file from elsewhere that's swung in 6/8 or over sixteenths opens as Straight too.
A file in any one feel opens with it.

To open one, choose Open Saved Progression from the Chord Progressions submenu, or press ctrl+shift+o.
The folder is shown as a tree.
upArrow and downArrow move, rightArrow and leftArrow open and close a folder, a letter moves to the next name starting with that letter, and enter opens the progression.

Any file that can't be opened is listed after the tree with the reason.
That includes music chord practice can't show, such as single notes rather than chords, more than one strumming pattern, or a feel, such as swing, that changes partway through.
A file like that can still be opened as a song with Open File, where it plays as written.
A folder that holds a great deal besides progressions, such as Documents itself, is listed only in part, and the dialog says so.
Choose a folder just for saved progressions.

If you close a progression with unsaved changes, or quit the desktop app with one open, unstrung asks whether to save first.
A progression that has just been generated and never saved isn't asked about.

## Chords

The Chords submenu has three items:

- **Chord Library** looks up a chord by name and plays it.
- **Frets to Chord…** names the chord for the strings and frets you give it.
- **Listen to Guitar Samples…** plays the recordings unstrung uses.

### Chord Library

Choose Chord Library from the Chords submenu.
It opens as an item in the list of open items, with you in its search field.
The library has over 850 chords.

Type part of a chord name and a list of matching names appears.
upArrow and downArrow move through the list, enter takes the highlighted name, and escape closes the list and leaves what you typed.
tab also closes it and moves on.

The Filtering Options section narrows the results by difficulty, root note, chord type and genre.
Difficulty is standard shapes only, common alternatives, or advanced voicings.
It starts on common alternatives, which include the standard shapes.
A voicing is one way of playing a chord: which strings, at which frets.
A chord's standard shape is listed before its alternatives.

Under the Search Results heading, each matching chord has a checkbox, followed by a collapsed section with the number of its voicings, such as "4 Voicing Options".
Inside it, each voicing has a checkbox, followed by a collapsed section, Fingering and Notes, with the chord's notes, its shape or position, the genres it's used in, any barre, and what each string does and with which finger.
The shortest matching name and its most common voicing start checked.

Every chord in the library has at least one voicing.
A shape can be listed under more than one name.
3x2013 is Gsus4add6, its other name G6sus4, and C/G, the chord its notes spell.

Under the Playback heading are the chords you've checked.
Play Selected Chords strums them, speaking each name first if "Speak chord name before playing" is checked.
Each chord is strummed down across every string it plays, then up across its four highest, at the same level and with the same recordings as a chord progression.
Play Selected Chords pauses a track or progression that's playing, and one starting stops it.
Clear Selected unchecks them all.

### Frets to Chord

Frets to Chord works the other way around: you say what each string is doing, and unstrung names the chord.
Choose it from the Chords submenu, and the Frets to Chord dialog opens.

Set the tuning, then each string from 6 to 1: open, not played, or a fret from 1 to 15.
The chord name follows the Identified Chord heading, and updates as you change each string.
The heading is a tab stop, between string 1 and View in Chord Library, so tabbing past the strings reads the chord.
After it come the notes played, how many strings sound, and what each string does.

Where the shape is in the chord library, the result says under which chord and which voicing option, such as C/G, voicing option 3, for 332010.
View in Chord Library then opens that chord in the chord library, with Difficulty widened if needed so the shape's voicing shows.
That voicing is the one checked, so Play Selected Chords plays the shape you entered, and you land on it, with the chord's voicing options expanded.
Otherwise View in Chord Library opens the identified chord, and you land on the Search Results heading.

In a tuning other than standard, unstrung still names the chord from its notes, but says that the voicings in the chord library don't apply.

### Listen to Guitar Samples

Every note unstrung plays is a real recording, called a sample.
Listen to Guitar Samples, in the Chords submenu, opens the Guitar Samples dialog, which plays them in order from lowest to highest.
From E2 up the notes are a green Gretsch guitar; from B0 to D#2 they're a bass guitar.
E2 is the lowest note of a guitar in standard tuning, its open sixth string.

You can choose:

- **Velocity layer:** soft, medium or loud.
  Each was recorded separately and sounds different, not only quieter or louder.
- **Number of round robins to play per note.**
  Round robins are separate recordings of the same note, which is why a repeated note doesn't sound identical every time.
- **Time between notes,** in seconds.
- **Announce note names while playing.**

Play Normal Notes starts playing, and pressing it again stops.

## Strumming Patterns

A strumming pattern is the rhythm of downstrokes and upstrokes a strumming hand plays across the strings.
Progressions are strummed with one, and the Metronome can click one.
Choose Strumming Patterns from the menu to hear the patterns and make your own.

### Writing a Strumming Pattern

A strumming pattern is written the way guitar teachers write it, one stroke for each place the hand passes the strings.

- D is a downstroke, toward the floor.
- U is an upstroke.
- A dash is a place the hand passes without strumming, while the chord rings on.
- x is a muted strum, a chuck, which stops the chord ringing; unstrung doesn't sound the chuck itself yet.
- A greater-than sign before a stroke, as in >D, accents it.

An accented stroke is played about one and a half times as loud as the others.
A pattern with no accents plays every stroke at the same level.
With eight places in a measure of 4/4, the downstrokes fall on the beats and the upstrokes on the ands between them.
The and is the halfway point between two beats, as in counting "1 and 2 and".

### Patterns That Come with unstrung

These come with unstrung, and each list starts with Down Only and All Down-Up.
Any other time signature has those two.

4/4:

- Down Only: D D D D, a downstroke on each beat.
- All Down-Up: D U D U D U D U, down on each beat and up on each and.
- Old Faithful: D - D U - U D U, the most common strum of all, also called the Island Strum.
- Boom-Chicka: D - D U D - D U, country and folk.
- Eighth-Note Downs: D D D D D D D D, driving rock and punk.
- Three-Three-Two: >D D D >D D D >D D, eighth-note downs accented on beat 1, the and of 2, and beat 4.
- Backbeat Chuck: D - x U - U x U, Old Faithful with chucks on beats 2 and 4.
- Reggae Offbeat: - U - U - U - U, upstrokes on the ands only.

3/4:

- Down Only: D D D.
- All Down-Up: D U D U D U.
- Waltz Strum: D - D U D U, down, down-up, down-up.
- Oom-Pah-Pah: >D D D, the first beat strong.
- Down Down Down-Up: D - D - D U.

6/8, six eighth-note beats felt in two:

- Down Only: D D D D D D.
- All Down-Up: D U D U D U.
- On the Pulse: D - - D - -, downs on 1 and 4.
- Accented Downs: >D D D >D D D.
- Rolling Six: D U D D U D.
- Ballad Six: D - U D - U.

2/4:

- Down Only: D D.
- All Down-Up: D U D U.
- Down, Down-Up: D - D U, polkas and marches.

12/8, four beats of three eighths:

- Down Only: twelve downs.
- All Down-Up: down and up in turn on the eighths.
- On the Pulse: D - - D - - D - - D - -.
- Slow Blues: every eighth down, strong on each beat.

### Feel

Played straight, the and falls halfway between two beats.
With a feel, the notes go in pairs, long then short, or short then long.
Every place you choose a strumming pattern has a Feel list after it: the Chord Practice dialog, a progression's Playback Settings, the progression editor and the Strumming Patterns item.
The Metronome has the same list.

- **Straight,** the default.
- **Triplet eighths (swing):** each and comes two thirds of the way through the beat, so each beat is a long stroke and a short one.
  This is the feel Song Summary calls "triplet eighths (swung)", and it's also called a shuffle.
  It was a checkbox, Swing, until unstrung had a list of feels.
- **Dotted eighths:** each and comes three quarters of the way through the beat.
- **Scottish eighths:** each and comes a quarter of the way through, short then long.
- **Triplet sixteenths,** **dotted sixteenths** and **Scottish sixteenths** do the same to each pair of sixteenths, within each half of the beat.

Only the second of each pair moves; the strokes on the beat stay where they are, and so does the metronome.
A chord that starts on an and, such as C@2.5, is still written that way, and is played late with the rest.
A chord that starts on a quarter of a beat, such as C@2.25, can leave the and beside it played straight; the rest of the measure keeps the feel.

An eighth feel has no effect on a pattern in sixteenths, or in a time signature counted in eighths such as 6/8 or 12/8, which is in threes already.
A sixteenth feel has no effect on a pattern with no sixteenths, and none of the patterns that come with unstrung has any; make one of your own to hear one.
The list then says so in its description, such as "This feel has no effect in 6/8."

A progression is saved with its feel, so it's played the same way when the file is opened as a track.

### The Strumming Patterns Item

Choose Strumming Patterns from the menu.
It opens as an item in the list of open items, with you on the Time signature list, under the Patterns heading.

The Pattern list after it has that time signature's patterns, the ones that come with unstrung first and yours after them, each of yours ending in "yours".
After them, a line says what the chosen pattern is and reads its strokes out in words, such as "1 down, and miss, 2 down, and up".
After that is the Feel list.
It's for hearing a pattern with a feel when you press Play, and isn't part of the pattern.
It stays as you set it until unstrung is closed.

The buttons after it:

- **Play** plays the pattern on G, C, D and F, two measures each, with the metronome on the beats, round and round until you press it again.
  While playing, it reads Pause.
- **New Pattern** opens the New Strumming Pattern dialog.
- **Copy to My Patterns** opens the same dialog with the chosen pattern's strokes, to make one of your own from it.
- **Edit** changes one of yours.
- **Delete** removes one of yours.

Play plays the pattern as a saved song would, so a written accent is louder, every other stroke is even, an upstroke catches the four highest strings, and a chuck stops the chord.
Choosing another pattern while it plays switches to that one, and so does choosing another feel.
It goes on while a progression or a song plays, and stops when the Chord Library plays chords.
It stops when you show another item, unless the setting to collapse expanded sections and pause playback is off; see Settings.

The patterns that come with unstrung can't be changed, so a name always means the same strokes.
Copy one instead.

### Your Own Strumming Patterns

The New Strumming Pattern dialog asks for a name, the time signature and the strokes.
The strokes are typed as described under Writing a Strumming Pattern.
The line after the field reads them back in words as you type, or says what's wrong.
Play plays them the same way, with the feel chosen in the Strumming Patterns item, until you press Pause or close the dialog.
Save Pattern keeps the pattern.
A name has to be new in its time signature, and so do the strokes: strokes that are already a pattern are refused, with that pattern's name.

Your patterns are listed in the Chord Practice dialog, the progression editor and a progression's Playback Settings, after the ones that come with unstrung.
They're kept with your settings.

Under the Export and Import heading:

- **Export My Patterns** saves all of yours to one text file, to back up or pass on.
- **Import Patterns** adds the patterns in such a file to yours.

In the exported file, each line is one pattern, written as its time signature, a comma, its name, a colon and its strokes, such as 4/4, Busy Folk: D - D U D U D U.
On import, one you already have is skipped.
One with a name you already use but other strokes is added with "(imported)" after its name.
Any line that couldn't be added is listed with the reason.

## Metronome

A metronome clicks a steady beat to play along with.
Choose Metronome from the menu.
It opens as an item in the list of open items, with you on the Time signature list.

### The Clicks

The clicks follow a strumming pattern: one click wherever the pattern strikes the strings, and none where it passes without strumming.
The click follows the stroke, wherever it falls.

- A downstroke is a low, round click.
- An upstroke is a much higher, shorter tick, and quieter.
- A muted strum is a short burst of noise, like a chuck.

So eight downs in a measure are eight of the same click, and down-up eighths alternate the two.
The first stroke of the measure is higher, so you can hear where the measure starts.
That's beat 1 in most patterns, and the and of 1 in a pattern with nothing on beat 1, such as Reggae Offbeat.
It's also louder, and a down there is hit harder, with a sharp attack.
A pattern with accents of its own, such as Three-Three-Two, makes its accents louder, and its downs hit harder, at their own pitch.
Its first stroke is still the higher one, so beat 1 stands out from the other accents.

### Metronome Settings

Under the Settings heading:

- **Time signature** and **Strumming pattern,** the same patterns as in the Strumming Patterns item, the ones that come with unstrung and yours.
- **Feel,** Straight by default, then the six feels: triplet, dotted and Scottish, each at eighths and at sixteenths.
- **Tempo,** from 15 to 300 beats per minute, and 60 by default.
- **Volume,** from 1 to 5, and 3 by default.

After the pattern, a line says where the clicks fall, such as "Clicks on 1 high strong down, 2 down, 2 and up, 3 and up, 4 down, 4 and up".

A feel plays the clicks in pairs, long then short, or short then long for Scottish, as described under Feel, in Strumming Patterns.
An eighth feel has no effect on a pattern in sixteenths or in 6/8, and a sixteenth feel none on a pattern with no sixteenths.
The list then says so in its description, such as "This feel has no effect in 6/8."
The feel stays as you set it until unstrung is closed.

The tempo you type into the Tempo field is the default tempo.

### Metronome Controls

Under the Controls heading:

- **Start** starts the metronome, and reads Stop while it plays.
  It's a toggle button, pressed while the metronome plays.
- **Slower** and **Faster** change the tempo by 5 beats per minute.
- **Default Tempo** goes back to the tempo last typed into the Tempo field.
  Slower and Faster don't change it.
- **Quieter** and **Louder** change the volume by one.

Changing the tempo, the volume, the pattern or the feel while it plays carries on without starting the measure again.
Each button says what it did, such as "85 BPM" or "Volume 4", and says so when the tempo or volume is already as far as it goes.
The metronome keeps playing while you look at another open item.
Closing the item stops it, and opening it again keeps your settings until unstrung is closed.

### Metronome Keys

While focus is in the metronome and your screen reader is in focus mode, these keys do what the buttons do.
The same list is in the item, under the Keyboard Control heading.

- spaceBar: start and stop.
- f: faster.
- s: slower.
- d: back to the default tempo.
- upArrow: louder.
- downArrow: quieter.

On a button, spaceBar starts and stops rather than pressing the button; enter still presses it.
In the Tempo and Volume fields, digits and the arrows change the field, while the letters still work.
In the Time signature and Strumming pattern lists, f, s and d still change the tempo, so you can change it while trying one pattern after another.
The arrows and the other keys move through the list.

## Tuner

Choose Tuner from the menu.
It opens as an item in the list of open items, with you on the Start button.
The tuner listens to your guitar through a microphone or an audio interface, and answers with a sound that follows the string as you turn the tuning machine.
Once the string settles after each pluck, it also says the note and how far off it is, such as "E2, 5 cents flat".

This is a first version.
Some of its settings are there so the different sounds can be compared, and some will go once one way is settled on.
The settings stay as you set them until unstrung is closed.

### The Reading

After the Tuner heading comes the reading, such as "E2, 8 cents flat" or "E2, in tune", or "Stopped" before you start.
Flat means lower than the note, and sharp means higher.
A cent is a hundredth of a semitone, the distance from one fret to the next.
In words, within 3 cents either side of the note counts as in tune.
The chime and the feedback tone are stricter and count within 2 cents.
The reading changes several times a second as the string rings, so Say Reading, or r, says it whenever you ask.

### Input

Under the Input heading:

- **Input:** the microphones and audio interfaces your computer has, with the system default chosen at first.
- **Input channel,** which appears only after you start the tuner, and only if the input has two channels.
- **Filter the input for a microphone,** on by default, which cuts the input above 1,000 Hz before the tuner reads it.
- **Echo cancellation,** off by default, which asks the computer to take its own sound out of the microphone.

The Input list changes when you plug something in or take it out.
In a browser the names may only appear after you start the tuner and allow the microphone.

An audio interface such as the Scarlett Solo has two inputs, the guitar in the first and a microphone in the second.
Input channel's Louder of the two, the default, listens to whichever is louder, and First and Second choose one.
Most USB microphones and phones have one channel, and then there's nothing to choose.
Some laptop microphones report two, with the same sound in both, and Louder of the two is right for them.

The open strings are all well below 1,000 Hz, and the tuner's own high sound is well above it, so the filter keeps a microphone from confusing the tuner's sound with your guitar.
Echo cancellation is built for speech and may change how a held string sounds to the tuner.

With a guitar plugged into an interface, the tuner's sound never reaches the input, so none of this matters.
With a microphone, headphones keep the tuner's sound away from it altogether.
Either way, check **Headphones or a plugged-in guitar** under the Feedback heading, and the tuner uses a gentler tone.

On Windows, the desktop app needs permission to use the microphone.
In Windows Settings, under Privacy and security, Microphone, turn on letting desktop apps use the microphone.
The tuner says so if it can't open the input.

### Mode

- **Chromatic,** the default, names the nearest note, whatever the tuning.
  A string more than a quarter of a tone, 50 cents, off reads as the next note, so a very slack low E reads as D sharp.
- **String** measures against the nearest string of the tuning chosen in the **Tuning** list, such as "string 6, E2, 130 cents flat", however far off the string is.
  The tunings are the ones Frets to Chord knows: standard, drop D, DADGAD, open G, open D, open E, half step down and drop C.

### Feedback

- **Feedback sound,** a group of four choices.
  - **Rising and falling tone,** the default, is one tone whose pitch follows the string, six times as far, so 10 cents flat is 60 cents below the tone's center.
    In tune, it rests on the center.
  - **Pulses that slow down** is a tone a whole step below the center when the string is flat and a whole step above when it's sharp, pulsing faster the further off it is, like the beating between two strings that are nearly in tune.
    In tune, it stops pulsing and sits on the center.
  - **Both** is the moving tone, pulsing.
  - **None** is no tone, so you hear only the spoken readings, and the chime if it's on.
- **Headphones or a plugged-in guitar, so the tuner's sounds can't reach its input,** off by default.
- **Chime when in tune,** on by default: two short rising notes once the string has stayed within 2 cents for a third of a second.
- **Speak the note and how far off once it settles,** on by default, which speaks through your screen reader.

With Headphones or a plugged-in guitar off, the tuner expects a microphone and speakers in the same device, such as a laptop or a phone.
It keeps its tone around 2,000 Hz, well above the guitar, so the microphone doesn't mistake the tone for the string.
Checked, the tone sits around 660 Hz, which is easier to listen to.

The sound fades a fifth of a second after the string stops sounding clearly.
Closing the item stops the tuner and lets go of the input.

### When the Tuner Speaks

A plucked string doesn't hold one pitch.
It starts sharp, more so the harder you pluck, then slides flat for a second or so before it settles, a low E by 4 or 5 cents.
On some guitars it holds near the first pitch for half a second before the slide, which can sound like in tune when it isn't.
So the tuner waits until the string has settled, at least a second after you pluck and at most two, and says where it settled, such as "E2, 5 cents flat".

It says one thing for each pluck, and nothing more while that pluck rings, even if you turn the tuning machine.
Pluck again to hear where the string is now.
The same reading is said again if nothing has changed.

If you turn the string so far that another note is nearer, the tuner names that note once it settles.
In String mode the string comes first, as in "string 6, E2, 10 cents flat".
The tuner tells a new pluck by the string suddenly getting louder.
It also starts over when the string stops sounding.

With a microphone and speakers, the tuner may also hear your screen reader's voice, which is in the same range as a guitar.
Headphones avoid that.

### Tuner Controls

The buttons are under the Controls heading, in a region of their own, so in browse mode d and shift+d move to it.

- **Start** starts listening, and reads Stop while it listens.
  It's a toggle button, pressed while the tuner listens.
- **Say Reading** says the reading.
- **Say Input Level** says the loudest the input has been in the last second, in decibels below the most it can take, such as "Input peak -18 dB".
  It warns when the input is clipping, too loud for the input to take cleanly, so you can turn the gain down on an interface.
- **Quieter** and **Louder** change the volume of the tuner's sound, from 1 to 10, and 5 by default.

The spoken readings come from just after these buttons.

### Tuner Keys

While focus is in the tuner and your screen reader is in focus mode, these keys do what the buttons do.
The same list is in the item, under the Keyboard Control heading.

- spaceBar: start and stop.
- r: say the reading.
- l: say the input level.
- upArrow: louder.
- downArrow: quieter.

In a group of radio buttons, the arrows move through the group as usual, and in a list they move through the list.

## Settings

Choose Settings from the menu.
The Settings dialog has three tabs: General, Files and Screen Reader.

### General

Under the Chord Voices heading:

- **Voice for spoken chord names:** Zira or David.
- **Spoken chord volume (percent),** relative to the guitar, and 50 by default.

Names are spoken in words: B flat 7 sharp eleventh, C 7 flat fifth, G sus 4 add 6.
The voice and volume are used everywhere names are spoken, the Chord Library as well as chord progressions and songs, from the moment unstrung starts.
A change to either is taken up at once by a track or progression that's already open.
If one is playing, it carries on from where it is, and the next names are in the new voice.

Under the Strumming heading is **Time between strings in a strum, in milliseconds,** from 0 to 50, and 20 by default.
A strum sounds its strings one after another, as a pick crosses them, and this is the time from one string to the next.
0 sounds every string at once, and higher numbers make a slower, looser strum.
It's used by every strum: a song's tracks, a progression, the strumming pattern preview and the Chord Library's Play Selected Chords.
Where a song file gives its own strum speed, the file's is used instead.
Changing it while something plays carries on from the same place with the new spacing.

Under the Saved Progressions heading is **Folder for saved chord progressions,** with a Browse button to choose it and a Use Default Folder button.

### Files

- **Default folder for Open File dialog,** with a Browse button, in the desktop app only.
- **Clear All Recent Files.**
- **Remove Stale Files from Recents,** which takes out files that no longer exist.

### Screen Reader

- **Shorter beat descriptions,** off by default.
  A beat that strums a chord unstrung can name is described by the chord name and the stroke direction only.
- **Collapse expanded sections and pause playback when switching to another open item,** on by default.

Coming back to an item with its measures still expanded can leave a screen reader unresponsive for several seconds while it takes in every beat again.
That's why the second setting is on.
A song's track or a progression that's playing is paused, keeping its place, so Play carries on from there when you come back.
Play in the Strumming Patterns item stops.
Turn it off to keep a progression playing while you look something up in another item, such as a fingering in the Chord Library.

## Help

The Help submenu opens each help document as an item in the list of open items: Introduction, What Is unstrung?, Screen Reader Users, Features (this document), Resources and Third Party Components.
The last entry, About unstrung, opens a dialog with the version, the file formats unstrung reads, and where its source code is.

## The Desktop App and the Web Version

The two work the same way, with these differences in the web version.

Recent Files and the folder of saved progressions need Chrome or Edge on a computer.
Firefox, Safari and every browser on an iPhone or iPad don't support the File System Access API they use.
In those browsers, Recent Files and the folder settings are there but unavailable, and:

- Open File and Open Saved Progression open one file at a time through the browser's upload picker, which on an iPhone or iPad is the Files app.
  To open a song or progression sent as an email attachment there, save it to Files first.
- Save Progression and Save Progression As download the progression as a file, named as unstrung suggests, wherever the browser keeps downloads.
  unstrung doesn't ask about unsaved changes, since a download is a copy.

In every browser:

- The guitar samples and spoken chord names are downloaded the first time each one is needed, and kept by the browser after that.
  The first time a song or progression plays, it may take a moment to start.
- Files and folders are chosen through the browser, which shows only a folder's name, never its full path.
  Settings has a Choose Folder button for saved progressions in place of a typed path, and there's no default folder for Open File and no Open Folder button.
- On a later visit, the browser asks permission again before unstrung can use a file or folder chosen earlier, unless you chose to allow it on every visit.
  The question appears beside the address bar, and unstrung's status bar says when it's waiting for one.
- Settings and recent files are kept by the browser, separately for each browser profile.
- Reloading or leaving the page closes everything open in unstrung.
  The browser asks first while anything is open.
