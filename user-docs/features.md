# unstrung Features

Prompter's Note: This file was initially written by Claude.
I've lightly edited some areas and some sections are all human written.
There is still a lot that smells like AI writing though.
But it is accurate and has good details, I decided to leave it as is.

The user interface (UI) for unstrung is very accessible and, I think, intuitive.
You might want to simply try it and arrow around in the features when you use them.
If you have not yet, spend a few minutes skimming the
[Introduction to unstrung](/unstrung/docs/introduction/).
It might help to understand the features and why they exist as they do.

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
You can read below about challenges I've already run into with media controls on iOS, including how I was able to get something to work again.
Be flexible and patient when you run into something not working as you'd expect.
Try to find a workaround.
And look in the footer of any page on eyesunstrung.vip for how to provide feedback.

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

From the top, the window has:

- The eyesunstrung banner with a link to the main site.
- The web app has the eyesunstrung.vip main menu bar.
- **The Menu button,** through which all features are accessed.
  It is in a navigation landmark named unstrung, so in browse mode d and shift+d move to it.
- **Open items.** Every song, chord progression, chord library and help document you open is listed here, newest first.
  Each is a level 1 heading holding a button, followed by a Close button.
  Pressing an item's button shows it in the main area of the window and moves you to the start of it.
  In browse mode, 1 and shift+1 move from one open item to the next.
- **The main area,** showing the open item you chose.
  Its own headings start at level 2.
  A help document is the exception: it starts with its title as a level 1 heading, as on its page on eyesunstrung.vip, so 1 also stops there.
- **The status bar,** at the bottom of the window, where unstrung says what it has just done.
  Your screen reader reads it as it changes, and nvdaKey+end reads it again.

### Keyboard Shortcuts

As noted below regarding browsers, if your browser does not support the File System Access API, these commands work a little differently.

- ctrl+o: open a song file.
- ctrl+shift+o: open a saved chord progression.
- ctrl+s: save the chord progression being shown.
- ctrl+shift+s: save it under a new name.

Playback has its own keys, described with each kind of playback.
While a track is being played, ? lists its keys in a dialog.

### Dialogs

Every dialog starts with a level 1 heading ending in "Dialog Box", such as "Settings Dialog Box".
The window title names the dialog while it is open.
escape closes a dialog.

## The Menu

As noted below, some menu items are not available if your browser does not support the File System Access API.

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
- **Strumming Patterns**
- **Metronome**
- **Settings…**
- **Help:** the help documents, and About unstrung….

## Reading a Song File

### Opening a File

Choose Open File from the menu, or press ctrl+o.
unstrung reads Guitar Pro files (.gp, .gpx, .gp5, .gp4 and .gp3), MusicXML files (.musicxml and .xml), and alphaTex files (.atex).
alphaTex is the format chord progressions are saved in, so a saved progression can be opened as a song as well as a progression.
As a song, it has a track and measure headings like any other song, with its file name as its title.
Files you have opened are listed in Recent Files, in the menu.

The file opens as a new item in the list of open items, and you are moved to the start of it.

### Song Summary

The first heading is Song Summary.
It lists what the file says about the song: title, artist and album where the file has them, tempo, feel if the song is swung or shuffled, number of bars, time signature, key signature and number of tracks.
A swung or shuffled song is played with that feel, as described under Playing a Track.
The key signature is given as a key: "A minor" where the file marks the key as minor, and the major key alone, such as "C", where it does not.
Most files are marked major whatever the song is, so "C" names the signature, no sharps or flats, more than the key.
Where the tempo, time signature or key signature changes later in the song, the summary says so.

### Tracks

unstrung lists only the guitar and bass tracks of a song, since those are the only instruments it has recordings of.
Voice, keyboards, drums and other parts are left out, and the summary says how many.
A MusicXML part that names no instrument is listed if it is written as tablature, and its instrument is given as none named in the file.
The words of a vocal part are still read, and shown with every listed track's measures.

After the Song Summary, each track has a level 2 heading with its number and name, and a list of its instrument, tuning, capo and chord symbols.
The tuning is spelled out note by note, with its name when the file gives one.

The last item of the list is **Chord Symbols,** a collapsed section with the number of chords.
Inside it, each chord the file prints over the track is listed once, collapsed, in the order it first appears, with how many times it is printed.
Where the file gives a chord diagram, its fingering is shown; otherwise the fingering comes from the chord library.
A track the file prints no chords over says so.

After the list is a collapsed section, **Measures and Playback,** with the number of measures.
It holds the settings and controls for playing the track, described below under Playing a Track, and then the measures.
The Measures heading is level 3, with the number of measures.
Each measure is a level 4 heading with its number, the section it starts if any, its repeat marks and its chord names.
Under the heading are two buttons, Play and Add, described under Practicing Measure by Measure.
Then come the lyrics sung over the measure, then a description of each beat: the strings and frets played, how the strings are struck, and techniques such as slides, bends, vibrato, harmonics and let ring.

Some files write a second part with its own rhythm on the same staff, called a voice, such as a bass held under the picking in a fingerstyle arrangement.
Each voice after the first is one line, after the lyrics and before the beats.
It starts "Voice 2" and gives each note with the beat it falls on, for example "Voice 2: half note, string 6, fret 3, at beat 1; half note, string 6, fret 3, at beat 3".
The beats that follow are the first voice.

### Chords in Measure Headings

A measure heading gives the chords the file prints over it, as sheet music does.

- "chord C" where the file prints a C at the start of the measure.
- "continues C" where the measure prints no chord and the last one printed was C.
- "continues C, chord G at beat 3" where a G is printed partway through, and "during beat 4" for one printed between beats.

A chord continues only to the end of its section.
A new section names no chord until the file prints one in it.

A printed chord gives the harmony, and the notes of the measure need not spell it: a melody can stray from it.
unstrung does not work chords out from the notes, so a heading names no chord where the file prints none.
The chords come from the file only.
If a file prints the wrong chords, or stops printing them partway through a song, unstrung cannot correct it.
Look for a better transcription of the song.

A beat is named as a chord when it sounds three different notes or more, such as "G/B, strings 1 through 5".
A beat with fewer is listed string by string, so open strings 3 and 4 are not called G5.
A stroke direction is given only where the file states one.

The Measures and Playback section is collapsed because a song can run to hundreds of lines.
Expand it when you want the detail or want to play the track.

## Media Controls Integration

Before we get into playing audio tracks from a song or playing along with a chord progression, let's discuss controlling playback.
Media controls are a universal, platform independent idea.
Most keyboards have play/pause, next track, and previous track buttons.
Headphones and earbuds might have similar controls.
For example, some support single click for play/pause, double click for "next track", and triple click for "previous track."
Those might be mapped differently depending on the application; maybe fast forward and rewind some seconds instead of entire tracks.

You'll read below about unstrung's keyboard commands to control audio playback.
Those are specific to unstrung and work only when the screen reader is in focus mode, when keys are passed through to the application.
In addition to the proprietary keyboard commands unstrung has defined, media controls are also supported.

Audio track and chord progression playback is focused on measures.
You select which measures to play, and how many times to play them.
Hit the play button and the audio will begin playing.
You can pause/resume playback with the media control mechanism, or using the spaceBar keyboard command.
You can restart the progression using previous track from media control, or upArrow on the keyboard.
Media control's "next track" (in quotes because we're kind of redefining that button), or downArrow on the keyboard, moves audio to the beginning of the current measure.
Remember the keyboard commands require your screen reader to be passing keyboard input through (focus mode in NVDA) while media controls work independent of the screen reader.

If you haven't, read the section above about Platform is a Feature.
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

## Playing a Track

Expand the "Measures and Playback" section after a track's details.
It starts with the Playback Settings and Playback Controls headings, both level 3, and then the Measures heading.
From any measure, shift+3 goes back up to the Measures heading, then Playback Controls, then Playback Settings.
To collapse the section, go to Playback Settings and then up one line.

### Playback Settings

- **Tempo in beats per minute,** from 15 to 300.
  It starts at the tempo the file gives, or 60 if the file gives none.
  A tempo you set stays until the song is closed.
- **Speak the next measure,** off to begin with.
  Before each measure, unstrung says its chords, as chord practice does: one beat ahead for a single chord, all of them together before a measure that changes chord partway, and "repeat" for a measure with the same chords as the one before.
  The chords are the ones the file prints over the track, as the measure headings name them, never worked out from the notes.
  A chord printed once carries on until the next, so measures that print none are "repeat".
  Measures before the first printed chord, and a section that prints none, say nothing.
  A chord unstrung does not know is not said; one it spells another way is said its way, so G#m is said "A flat minor".
  The voice and its volume are set in Settings.
  When the file prints no chords over the track, the checkbox is unavailable and says why.
  Turning it on or off while playing carries on from where it is.
- **Metronome,** clicks while the music plays.
  Each note is timed so that its attack sounds with the click, and the pick noise recorded before it comes just ahead.
  A song that starts with a pickup, a short first measure, clicks only on the beats the pickup holds: a two-beat pickup in 4/4 clicks on 3 and 4.
- **Count in,** one measure of clicks before playing starts.
  It is on to begin with, and works whether or not the metronome is on.
  Before a pickup it counts a whole measure, then the beats before the pickup comes in: 1 2 3 4 1 2, and a two-beat pickup comes in on 3.
- **Times to play,** from 1 to 50.
  It starts at 1.
  When the measures have played that many times, playback stops and says how many times it played.
  Changing it while playing starts again from the beginning of the measures, with the count back at 1.
- **Loop,** plays the measures over and over until you stop, whatever Times to play says.
  It is off to begin with, and l turns it on and off.
  Turning it on while playing carries on, counting each time through.
  Turning it off while playing goes on until Times to play is reached.
  If that has already been passed, the time through under way finishes, then playback stops.
  Each setting keeps its value when the other changes.
- **Count in before every repeat.**
  It has no effect when the measures play only once.
- **Number of beats to count in,** shown only while Count in before every repeat is checked.
  It runs from 1 to the beats per measure of the first measure of the selection, and starts at all of them.
  Fewer counts in each repeat with the last clicks of the count-in only, which is a shorter wait at a slow tempo: 2 in 4/4 clicks on beats 3 and 4, or on 1 and 2 before a two-beat pickup.
  The count-in before the first time through is always a whole measure.
- **Measures to Play,** a collapsed section saying which measures will play.
  Inside it is a Section dropdown, starting with Entire Song, then one entry for each section the file marks, such as Intro or Verse 2.
  A file that marks no sections has no dropdown.
  Then come the first and last measure.
  When the measures chosen are not the whole song or a section, the dropdown has an entry for them, such as "Measures 3 to 7".

### Playback Controls

The heading is followed by a reminder that ? lists the keys.

- **Play,** which becomes Pause while playing.
  The first time you play a track, unstrung loads its guitar samples first, says so, and then plays.
- **Where Am I,** which says which measure is playing, its chords, the beat, and which time through: "Measure 9 of measures 7 through 21, G C@3, beat 2, play 2 of 3".
  The measure is counted against the selection when it is not the whole song.
  The chords are the ones the file prints, carried on from earlier measures as the measure headings carry them, written as the progression editor writes them; they are left out where the file prints none.
  The beat follows the measure's own time signature.
  Times through are "play 2 of 3", or "play 5" while Loop is on, and nothing when the measures play once.
- **Slower, Faster and Default Tempo,** which change the tempo by 5 beats per minute, or put it back.
- **Restart Selection, Previous Measure, Next Measure and Start of Measure.**
  Restart Selection goes back to the start of the selection.

Below the buttons, unstrung says what it has done when you ask, and a collapsed section, About the Audio Track, gives how many notes the track has, how long it is, and its tempo.

unstrung plays exactly the notes the file writes.
Tab often prints a chord over a single bass note and leaves the rest to the player, and unstrung plays that bass note alone.
The chord is in the measure heading and the track's Chord Symbols, so you can strum it yourself if that is what the tab means.

Each string rings until it is played again, or until a muted note (x) on that string stops it.
A muted note sounds nothing yet, but stops whatever its string was ringing, as damping it with the hand does.
So a muted strum, a chuck, cuts the chord before it, and strings it does not touch ring on.

Accented notes are played louder than the notes around them, half as loud again, and heavy accents louder still.
Loudness otherwise comes from the dynamics the file writes.

A song the file marks as swung or shuffled is played that way, measure by measure, wherever the file marks it.
With triplet eighths, the feel Song Summary calls "triplet eighths (swung)", each pair of eighth notes is played long then short: the second comes two thirds of the way through the beat instead of halfway.
Triplet sixteenths do the same to each pair of sixteenth notes, and the dotted and Scottish feels play their pairs as a dotted note and a short one, or the other way round.
Notes written as triplets, and eighth notes that do not fall in pairs on the beat, are played as written.
The metronome and the count-in still click on the beats.

Collapsing the Measures and Playback section stops playback.
Expanding it again does not restart it; press Play to carry on from where it stopped.
Showing another open item collapses the section, and so stops playback, unless you turn that setting off.

### Practicing Measure by Measure

This is for learning a song a measure at a time: read a measure, listen to it until you have it, then add it to the measures you are learning, and so on.

Each measure has two buttons under its heading:

- **Play measure 5** plays that measure on its own, as many times as Times to play says, or until stopped if Loop is checked.
  It leaves the selection as it is, and remembers where the track had got to.
  While the measure plays, the button is named Stop measure 5, and pressing it stops the measure.
  Press Play measure 5 again to hear the measure from its start.
- **Add measure 5 to selection** changes the selection and says what the track now is, for example "Audio track is now measures 1 through 5."
  If measure 5 is outside the selection, the selection stretches to include it.
  The selection is always one run of measures, so adding measure 5 to measures 1 to 2 gives 1 to 5.
  If measure 5 is already in the selection, the selection becomes measure 5 alone.
  That is how to start over from one measure, including from the whole song, as it is to begin with.
  Adding the old first and last measures back undoes it.
  Add does not play the track; press Play when you are ready.
  Anything playing stops.

In focus mode, enter presses the measure button you are on, as it does in browse mode.
spaceBar does not: it is the track's play and pause key.

Two things can play here: the track, which is the selected measures, and a measure on its own.
Play, the playback keys and media keys belong to the track.
A measure's own button belongs to the measure.
The one exception is spaceBar while a measure plays on its own: it stops the measure and says "Stopped measure 5."

After listening to a measure on its own, Play goes back to the track, from where it was.
So do spaceBar, media keys, Restart Selection, Previous Measure, Next Measure, Start of Measure and their keys.
Each says where the track is as it goes back, for example "Back to the track at measure 12."
Nothing else about playing and stopping is said.
Where Am I says "Measure 5 on its own" while a measure plays on its own.

For example, with Loop checked, press Play measure 1 and listen until you have it, then Add measure 1 to selection.
Read measure 2, press Play measure 2, and when you have that, Add measure 2 to selection.
Press Play to hear measures 1 and 2 together.

Play measure starts from the beginning of its measure, and Play after Add starts from the beginning of the selection, each counting in if Count in is checked.
The tempo stays as you set it.

### Keys

While your screen reader is in focus mode, these keys control playback.
They work while focus is anywhere in the song, on a button as well, but not on the Menu button or in the list of open items, where spaceBar and the arrows do what they do there.
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

## Chord Practice

Chord practice generates a chord progression and plays it for you to play along with.
Each measure has one chord or more, strummed with the progression's strumming pattern, with a metronome and, if you want it, the next measure's chords spoken.

### Generating a Progression

Choose Generate Practice Progression from the Chord Progressions submenu.
The Chord Practice dialog asks for:

- **Experience level.** Beginner uses open chords only.
  Intermediate adds barre chords and seventh chords.
  Advanced adds extended chords and chords borrowed from other keys.
- **Key.** Only keys with enough chords playable at the chosen level are listed.
- **Chords from outside the key:** none, occasional or frequent.
  These are mostly chords that lead into the next one, such as D7 before G in the key of C, and chords borrowed from the minor key.
- **Beats per measure** and **note value that gets one beat,** the two numbers of the time signature.
  The tempo counts beats, so the lower number does not change the speed: 6/8 at 90 is ninety eighth notes a minute.
- **Strumming pattern,** from the patterns for the time signature, described under Strumming Patterns.
  It starts on Down Only, and the list changes when the time signature does.
- **Feel,** Straight to begin with, described under Feel.
- **Tempo,** from 15 to 300 beats per minute, 60 to begin with.
- **Number of measures,** from 2 to 256.
- **No chord held over into the next measure,** checked to begin with.
  The chord then changes on every measure, which is what practicing changes needs.
  Chords with the same root count as the same chord, so G7 never follows G.
  Unchecked, a chord is sometimes held for two measures, as in most real progressions.
- **Times to play,** from 1 to 50, 1 to begin with, and **Loop,** unchecked to begin with, which plays until you stop whatever the number says.
  Then whether to count in before every repeat.
  Once that is checked, Number of beats to count in sets how many beats each repeat is counted in with, from 1 to the beats per measure.
  It starts at the beats per measure, and goes back to it when Beats per measure changes.
- **Metronome.**
  Each strum is timed so that its attack sounds with the click, and the pick noise recorded before it comes just ahead.
- **Speak the next measure,** checked to begin with.
  The next measure's chords are said just before it starts, as described under The Progression.
  The voice and its volume are set in Settings.

Press Generate Progression.
The progression opens as a new item in the list of open items.

### The Progression

A progression's item has:

- **Metadata:** the key, level, time signature, strumming pattern, length, the cadence it ends with, how many chords come from outside the key, and whether it has been saved.
  The strumming pattern is given by its name and its strokes, such as Old Faithful: D - D U - U D U.
  A pattern unstrung does not have a name for is given by its strokes alone.
  A progression with a feel names it after the strokes: Old Faithful: D - D U - U D U, triplet eighths (swing).
- **Chords Used:** each different chord once, collapsed, with its fingering and notes.
  A chord from outside the key says which key it comes from and why.
- **Progression:** the measures in order, each as its chords are written in the editor, such as G D C@4.
  Each is followed by a button, Add measure 5 to selection, which works as a track's does; see Practicing Measure by Measure.
  It says what the selection now is, such as "Selection is now measures 2 through 5."
  There is no Play measure button: open the progression as a song, with Open File, to go measure by measure that way.
  While there are unsaved changes, this heading, the item's name and the level 2 heading at the top all say "unsaved changes".
- The Edit Progression, Save Progression and Save Progression As buttons.
- **Playback Settings** and **Playback Controls,** level 3 headings with the same settings, buttons and keys as a track's; see Playing a Track.

A progression is played by the same player as a song's tracks.
It sounds exactly as its saved file does when opened as a song with Open File.

Playback Settings has a track's settings, with two more after the tempo:

- **Tempo in beats per minute,** from 15 to 300.
  It counts beats, so 6/8 at 90 is ninety eighth notes a minute.
- **Strumming pattern.**
  Changing it carries on from where the progression is, so you can try patterns while it plays.
  Like the tempo, it is not counted as an unsaved change, but saving keeps the pattern you are on.
- **Feel,** described under Feel.
  Like the pattern, it changes while the progression plays, is not counted as an unsaved change, and is saved with the progression.
- **Speak the next measure,** checked to begin with, where a song's is not.
  Changing it carries on from where the progression is.
  A measure with one chord has its name said one beat before it.
  A measure with several has them all said one after the other, finishing just before it starts, which may be earlier than one beat ahead.
  They are said as the editor writes them, so a chord with an @ is followed by its beat: G C@3 is said "G, C, at 3".
  Where there is not time for them all, only the first is said.
  A measure the same as the one before it is announced as "repeat".
  The first measure's chords are said during the count-in, so with Count in unchecked they are not heard the first time through.
- **Metronome,** **Count in,** **Times to play,** **Loop,** **Count in before every repeat** and **Number of beats to count in,** as for a track.
  Playing a progression a set number of times is a way to practice for a set time.
- **Measures to Play,** collapsed, as for a track, with First measure to play and Last measure to play.
  A progression has no sections, so its summary says Entire Progression when every measure plays.

Playback Controls has a track's buttons: Play and Where Am I; Slower, Faster and Default Tempo; Restart Selection, Previous Measure, Next Measure and Start of Measure.
Default Tempo goes back to the tempo the progression opened with, until you type another into the Tempo field.

The keys are a track's, l for Loop included.
Like a track's, they work while focus is in the progression, and not on the Menu button or in the list of open items.
? lists them in the Playback Keys dialog.

The media keys on your keyboard and headphone buttons control a progression as they do an audio track; see Media Controls Integration, before Playing a Track.

### Saving and Opening Progressions

Save Progression, or ctrl+s, saves the progression.
The first time, unstrung suggests a name such as Am-60-intermediate-occasional: the key, the number of measures, the level and the setting for chords from outside the key.
Save Progression As, or ctrl+shift+s, saves a copy under a new name.
The key, time signature, chords, strumming pattern, feel and tempo are saved, the pattern, feel and tempo as they are set under Playback Settings.
A feel is saved only where it has an effect, so a progression in 6/8 with Triplet eighths chosen opens as Straight.
The same goes for a file from elsewhere that is swung in 6/8 or over sixteenths.
A file in any one feel opens with it.
The metronome and the number of repeats are not.
Opening a progression sets the tempo to the one it was saved with.

Progressions are saved as ordinary files in a folder you choose in Settings, so they can be copied, backed up and shared like any other file.
On the desktop version, the folder is Unstrung\Progressions in your Documents folder unless you choose another.
The files end in .atex.
They are alphaTex, a plain-text way of writing music that other programs built on alphaTab can open too.
An upstroke is written on the four highest strings of the chord, all of them for a chord of four strings or fewer, as a hand coming back up catches the top of the chord.
A progression opened as a song, with Open File, plays it that way, the lower strings ringing on from the stroke before.
Earlier versions of unstrung wrote every string on an upstroke; those files still open, and are written the new way when saved again.

To open one, choose Open Saved Progression from the Chord Progressions submenu, or press ctrl+shift+o.
The folder is shown as a tree.
upArrow and downArrow move, rightArrow and leftArrow open and close a folder, a letter moves to the next name starting with that letter, and enter opens the progression.
Any file that cannot be opened is listed after the tree with the reason.
That includes music chord practice cannot show, such as single notes rather than chords, more than one strumming pattern, or a feel, such as swing, that changes partway through.
A file like that can still be opened as a song with Open File, where it plays as written.
A folder that holds a great deal besides progressions, such as Documents itself, is listed only in part, and the dialog says so.
Choose a folder just for saved progressions.

If you close a progression with unsaved changes, or quit the desktop app with one open, unstrung asks whether to save first.
A progression that has just been generated and never saved is not asked about.

### Strumming Patterns

A strumming pattern is written the way guitar teachers write it, one stroke for each place the hand passes the strings.
D is a downstroke and U an upstroke.
A dash is a place the hand passes without strumming, while the chord rings on.
x is a muted strum, a chuck, which stops the chord ringing; unstrung does not sound the chuck itself yet.
An accented stroke has a greater-than sign before it, as in >D.
An accented stroke is played about one and a half times as loud as the others; a pattern with no accents plays every stroke at the same level.
With eight places in a measure of 4/4, the downstrokes fall on the beats and the upstrokes on the ands between them.

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
Each place a strumming pattern is chosen has a list after it, Feel: the Chord Practice dialog, a progression's Playback Settings, the progression editor and the Strumming Patterns item.
The Metronome has the same list; see Metronome.

- **Straight,** to begin with.
- **Triplet eighths (swing):** each and comes two thirds of the way through the beat, so each beat is a long stroke and a short one.
  This is the feel Song Summary calls "triplet eighths (swung)", and it is also called a shuffle.
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

A progression is saved with its feel, so it is played the same way when the file is opened as a track.

### Your Own Strumming Patterns

Choose Strumming Patterns from the menu.
It opens as an item in the list of open items, with you on the Time signature list.
The Pattern list after it has that time signature's patterns, the ones that come with unstrung first and yours after them, each of yours ending in "yours".
After them, a line says what the chosen pattern is and reads its strokes out in words, such as "1 down, and miss, 2 down, and up".
After that is the Feel list, described under Feel.
It is for hearing a pattern with a feel with Play, and is not part of the pattern; it stays as you set it until unstrung is closed.

The buttons after it:

- **Play:** plays the pattern on G, C, D and F, two measures each, with the metronome on the beats, round and round until you press it again; while playing it reads Pause.
  It is played as a saved song would be, so a written accent is louder, every other stroke is even, an upstroke catches the four highest strings, and a chuck stops the chord.
  Choosing another pattern while it plays switches to that one, and so does choosing another feel.
  It goes on while a progression or a song plays, and stops when the Chord Library plays chords.
- **New Pattern:** opens the New Strumming Pattern dialog.
- **Copy to My Patterns:** opens the same dialog with the chosen pattern's strokes, to make one of your own from it.
- **Edit:** changes one of yours.
  The patterns that come with unstrung cannot be changed, so a name always means the same strokes; copy one instead.
- **Delete:** removes one of yours.

The dialog asks for a name, the time signature and the strokes.
The strokes are typed as described under Strumming Patterns, and the line after the field reads them back in words as you type, or says what is wrong.
Play plays them the same way, until you press Pause or close the dialog, and Save Pattern keeps the pattern.
Play has the feel chosen in the Strumming Patterns item.
A name has to be new in its time signature, and so do the strokes: strokes that are already a pattern are refused, with that pattern's name.

Your patterns are listed in the Chord Practice dialog, the progression editor and a progression's Playback Settings, after the ones that come with unstrung.
They are kept with your settings.

Under Export and Import:

- **Export My Patterns** saves all of yours to one text file, to back up or pass on.
  Each line is one pattern, written as its time signature, a comma, its name, a colon and its strokes, such as 4/4, Busy Folk: D - D U D U D U.
- **Import Patterns** adds the patterns in such a file to yours.
  One you already have is skipped.
  One with a name you already use but other strokes is added with "(imported)" after its name.
  Any line that could not be added is listed with the reason.

### Editing a Progression, or Making Your Own

Edit Progression opens the Editing Chord Progression dialog.
Manually Create Chord Progression, in the Chord Progressions submenu, opens the same dialog as Creating Chord Progression, with one empty measure.

The dialog sets the key, time signature, strumming pattern and feel, and lists the measures with their chords.
The strumming pattern starts on the progression's own, and the feel as the progression has it.
Changing the feel here is a change to apply, unlike in Playback Settings.
A progression opened from a file whose pattern unstrung has no name for keeps it, listed as this progression's own.
The list of measures is used in focus mode.
In browse mode it is one line, Measures, and enter on it goes into the list at the current measure.
In the list of measures:

- enter: choose new chords for the measure.
- delete: remove the measure.
- ctrl+i: insert an empty measure after it and go to its chord field, ready to type its chords.
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
2.5 is the and of 2, and 2.25 and 2.75 are the sixteenths either side of it, so G C@2.5 changes to C on the upstroke after beat 2.
A chord after one that starts on an and starts on the next whole beat: G C@2.5 D puts D on beat 3.

The list of chords offers matches for the last chord typed.
After a space, downArrow lists the key's chords for the next one.
Anything that cannot be read is not taken, and the reason is said, such as a chord past the end of the measure.
Where the strumming pattern does not strum a chord on the beat it starts, the editor says when it is first heard: with Down Only, G C@2.5 says "The pattern first strums C on 3."

## Metronome

Choose Metronome from the menu.
It opens as an item in the list of open items, with you on the Time signature list.
Its clicks follow a strumming pattern: one click wherever the pattern strikes the strings, and none where it passes without strumming.
The click follows the stroke, wherever it falls.
A downstroke is a low, round click.
An upstroke is a much higher, shorter tick, and quieter.
A muted strum is a short burst of noise, like a chuck.
So eight downs in a measure are eight of the same click, and down-up eighths alternate the two.
The first stroke of the measure is higher, so you can hear where the measure starts.
That is beat 1 in most patterns, and the and of 1 in a pattern with nothing on beat 1, such as Reggae Offbeat.
It is also louder, and a down there is hit harder, with a sharp attack.
A pattern with accents of its own, such as Three-Three-Two, makes its accents louder, and its downs hit harder, at their own pitch.
Its first stroke is still the higher one, so beat 1 stands out from the other accents.

Under Settings:

- **Time signature** and **Strumming pattern,** the same patterns as in the Strumming Patterns item, the ones that come with unstrung and yours.
  After them, a line says where the clicks fall, such as "Clicks on 1 high strong down, 2 down, 2 and up, 3 and up, 4 down, 4 and up".
- **Feel,** Straight to begin with, then the six feels: triplet, dotted and Scottish, each at eighths and at sixteenths.
  A feel plays the clicks in pairs, long then short, or short then long for Scottish.
  Triplet eighths is the swing described under Feel, in Chord Practice, each and two thirds of the way through the beat.
  Dotted eighths puts the and three quarters of the way through, Scottish eighths a quarter of the way.
  The sixteenth feels do the same to each pair of sixteenths.
  An eighth feel has no effect on a pattern in sixteenths or in 6/8, and a sixteenth feel none on a pattern with no sixteenths; the list then says so in its description, such as "This feel has no effect in 6/8."
  The feel stays as you set it until unstrung is closed.
- **Tempo,** from 30 to 240 beats per minute, 60 to begin with.
  The tempo you type here is the default tempo.
- **Volume,** from 1 to 5, 3 to begin with.

Under Controls:

- **Start:** starts the metronome, and reads Stop while it plays.
  It is a toggle button, pressed while the metronome plays.
- **Slower** and **Faster:** change the tempo by 5 beats per minute.
- **Default Tempo:** goes back to the tempo last typed into the Tempo field.
  Slower and Faster do not change it.
- **Quieter** and **Louder:** change the volume by one.

Changing the tempo, the volume, the pattern or the feel while it plays carries on without starting the measure again.
Each button says what it did, such as "85 BPM" or "Volume 4", and says so when the tempo or volume is already as far as it goes.
The metronome keeps playing while you look at another open item.
Closing the item stops it, and opening it again keeps your settings until unstrung is closed.

### Metronome Keys

While focus is in the metronome and your screen reader is in focus mode, these keys do what the buttons do.
The same list is in the item, under the Keyboard Control heading.

- spaceBar: start and stop.
  On a button it starts and stops rather than pressing the button; enter still presses it.
- f: faster.
- s: slower.
- d: back to the default tempo.
- upArrow: louder.
- downArrow: quieter.

In the Tempo and Volume fields, digits and the arrows change the field, while the letters still work.
In the Time signature and Strumming pattern lists, f, s and d still change the tempo, so you can change it while trying one pattern after another.
The arrows and the other keys move through the list.

## Chord Library

Choose Chord Library from the Chords submenu.
It opens as an item in the list of open items, with you in its search field.

Type part of a chord name and a list of matching names appears.
upArrow and downArrow move through the list, enter takes the highlighted name, and escape closes the list and leaves what you typed.
tab also closes it and moves on.

The Filtering Options section narrows the results by difficulty (standard shapes only, common alternatives, or advanced voicings), root note, chord type and genre.
Difficulty starts on common alternatives, which include the standard shapes; a chord's standard shape is listed before its alternatives.

Every chord in the library has at least one fingering.
A shape can be listed under more than one name.
3x2013 is Gsus4add6, its other name G6sus4, and C/G, the chord its notes spell.

Under the Search Results heading, each matching chord has a checkbox, and so does each of its fingerings.
The shortest matching name and its most common fingering start checked.
Each chord also has a collapsed section with what is known about it.

Under the Playback heading are the chords you have checked.
Play Selected Chords strums them, speaking each name first if "Speak chord name before playing" is checked.
Clear Selected unchecks them all.

## Frets to Chord

Frets to Chord works the other way round: you say what each string is doing, and unstrung names the chord.
Choose it from the Chords submenu.

Set the tuning, then each string from 6 to 1: open, not played, or a fret from 1 to 15.
The chord name follows the Identified Chord heading, and updates as you change each string.
The heading is a tab stop, between string 1 and View in Chord Library, so tabbing past the strings reads the chord.
Where the shape is in the chord library, the result says under which chord and which voicing option, such as C/G, voicing option 3, for 332010.
View in Chord Library opens that chord in the chord library, with Difficulty widened if needed so the shape's voicing shows.
That voicing is the one checked, so Play Selected Chords plays the shape you entered, and you land on it, with the chord's voicing options expanded.
Otherwise it opens the identified chord, and you land on the Search Results heading.

In a tuning other than standard, unstrung still names the chord from its notes, but says that the fingerings in the chord library do not apply.

## Listening to the Guitar Samples

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
  Names are spoken in words: B flat 7 sharp eleventh, C 7 flat fifth, G sus 4 add 6.
- **Spoken chord volume,** as a percentage, relative to the guitar.
  It starts at 50.
  The voice and volume are used everywhere names are spoken, the Chord Library as well as Chord Practice, from the moment unstrung starts.
- **Time between strings in a strum, in milliseconds,** from 0 to 50.
  It starts at 20.
  A strum sounds its strings one after another, as a pick crosses them, and this is the time from one string to the next.
  0 sounds every string at once, and higher numbers make a slower, looser strum.
  It is used by every strum: a song's tracks, a progression, the strumming pattern preview and the Chord Library's Play.
  Where a song file gives its own strum speed, the file's is used instead.
  Changing it while something plays carries on from the same place with the new spacing.
- **Folder for saved chord progressions.**

### Files

- **Default folder for Open File dialog,** desktop only.
- **Clear All Recent Files.**
- **Remove Stale Files from Recents,** which takes out files that no longer exist.

### Screen Reader

- **Shorter beat descriptions.**
  A beat that strums a chord unstrung can name is described by the chord name and the stroke direction only.
  Off unless you turn it on.
- **Collapse expanded sections and pause playback when switching to another open item.**
  Coming back to an item with its measures still expanded can leave a screen reader unresponsive for several seconds while it takes in every beat again.
  A song's track or a progression that is playing is paused, keeping its place, so Play carries on from there when you come back.
  Turn it off to keep a progression playing while you look something up in another item, such as a fingering in the Chord Library.
  On unless you turn it off.

## Help

The Help submenu opens each help document as an item in the list of open items: Introduction, Screen Reader Users, Features (this document), Third Party Components and Resources.
The last entry, About unstrung, opens a dialog with the version and the file formats supported.

## The Desktop App and the Web Version

The two work the same way, with these differences in the web version:

- Recent Files and the folder of saved progressions need Chrome or Edge on a computer.
  Firefox, Safari and every browser on an iPhone or iPad do not support the File System Access API they use.
  In those browsers, Recent Files and the folder settings are there but unavailable, and:
  - Open File and Open Saved Progression open one file at a time through the browser's upload picker, which on an iPhone or iPad is the Files app.
    To open a song or progression sent as an email attachment there, save it to Files first.
  - Save Progression and Save Progression As download the progression as a file, named as unstrung suggests, wherever the browser keeps downloads.
    unstrung does not ask about unsaved changes, since a download is a copy.
- The guitar samples and spoken chord names are downloaded the first time each one is needed, and kept by the browser after that.
  The first time a song or progression plays, it may take a moment to start.
- Files and folders are chosen through the browser, which shows only a folder's name, never its full path.
  Settings has a Choose Folder button for saved progressions in place of a typed path, and there is no default folder for Open File and no Open Folder button.
- On a later visit, the browser asks permission again before unstrung can use a file or folder chosen earlier, unless you chose to allow it on every visit.
  The question appears beside the address bar, and unstrung's status bar says when it is waiting for one.
- Settings and recent files are kept by the browser, separately for each browser profile.
- Reloading or leaving the page closes everything open in unstrung.
  The browser asks first while anything is open.
