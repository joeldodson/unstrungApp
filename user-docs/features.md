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

As noted elsewhere, unstrung started as an Electron based desktop app.
It was designed to be downloaded and installed.
I chose Electron for its web based core and tight control over components and their versions.
Building an Electron app you know exactly what you are using, it's all packaged and installed with your own code.
It's a lot of work though to get into app stores and support multiple platforms, even only Windows and macOS.

As noted in the [Introduction to eyesunstrung](https://eyesunstrung.vip/articles/introduction/), Claude assured me almost all of unstrung would run in a browser.
So I did a complete redesign with the goal of a single look and feel for unstrung across any platform.
My initial thought though was to still require a Chromium based browser to still have some level of consistency.
Then I wanted to try it on a browser on my phone.
I'll keep my rantings about Apple and WebKit to myself and simply note all browsers on iOS are effectively Safari (WebKit) underneath.
(I really wish Google could make TalkBack on Android less laggy, I'd switch.)
The unfortunate reality is most blind people, at least in the U.S., use iOS.
So I broadened my target to browsers on iOS which indirectly opens support for Firefox on Windows, macOS, and Linux.

I initially thought I'd limit functionality on non Chromium based browsers lacking support for some APIs.
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
Well, one caveat now, the desktop version does not include the eyesunstrung.vip main menu bar.

From the top, the window has:

- The eyesunstrung banner with a link to the main site.
- The web app has the eyesunstrung main menu bar.
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

As noted below regarding browsers, if your browser does not support the file system access API, these commands work a little differently.

- ctrl+o: open a song file.
- ctrl+shift+o: open a saved chord progression.
- ctrl+s: save the chord progression being shown.
- ctrl+shift+s: save it under a new name.

Playback has its own keys, described with each kind of playback.
You can find the description of the keyboard commands for playback within the document with the audio track.

### Dialogs

Every dialog starts with a level 1 heading ending in "Dialog Box", such as "Settings Dialog Box".
The window title names the dialog while it is open.
escape closes a dialog.

## The Menu

As noted below, some menu items are not available if your browser does not support the file system access API.

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
unstrung reads Guitar Pro files (.gp, .gpx, .gp5, .gp4 and .gp3) and MusicXML files (.musicxml and .xml).
Files you have opened are listed in Recent Files, in the menu.

The file opens as a new item in the list of open items, and you are moved to the start of it.

### Song Summary

The first heading is Song Summary.
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
- **Audio Track** and the track's name, where the track is played.

The measures are collapsed because a song can run to hundreds of lines.
Expand them when you want the detail.

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
You select which measures to play, including how many times to loop the selection.
Hit the play button and the audio will begin playing.
You can pause/resume playback with the media control mechanism, or using the spaceBar keyboard command.
You can restart the progression using previous track from media control, or upArrow on the keyboard.
Media control's "next track" (in quotes because we're kind of redefining that button), or downArrow on the keyboard, moves audio to the beginning of the current measure.
Remember the keyboard commands require your screen reader to be passing keyboard input through (focus mode in NVDA) while media controls work independent of the screen reader.

If you haven't, read the section above about Platform is a Feature.
The web based version of unstrung, especially on mobile, has implemented media control ... creatively (some might call it a hack).
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

Expand the "Audio Track" section at the end of a track.
It starts with a level 4 heading of the same name.
To collapse it again, go to that heading and then up one line.

### Setting It Up

- **Tempo in beats per minute,** from 15 to 300.
  It starts at the tempo the file gives.
- **Measures Selected,** a collapsed section saying which measures will play.
  Inside it are the first and last measure, how many times to play them (up to 50, or 0 to repeat until you stop), and whether to count in before every repeat or only the first time.
- **Metronome,** which also counts in one measure of clicks the first time through.

### Playing

After the settings, the Track heading is followed by a summary of the track: how many notes, how long it is, and the tempo.
Then come the Create Track and Play Track buttons.

Press Create Track.
unstrung builds the track from the guitar samples, says when it is ready, and enables Play Track.
Play Track starts and pauses playback.

Under the "Move Around the Track" heading are buttons to go to the previous or next measure, to the start of the current measure, or to the start of the selected measures.

Collapsing the Audio Track section stops playback.
Expanding it again does not restart it; press Play Track to carry on from where it stopped.
Showing another open item collapses the section, and so stops playback, unless you turn that setting off.

### Keys

While your screen reader is in focus mode, these keys control playback.
The same list is in the Audio Track section, under the Keyboard Control heading.

- spaceBar: pause and resume.
- leftArrow: back one measure.
- rightArrow: forward one measure.
- downArrow: back to the start of the current measure.
- upArrow: restart the selected measures, counting in again.
- b: say which measure you are in, and which repeat.
- m: metronome on or off.
- s: slower by 5 beats per minute.
- f: faster by 5 beats per minute.
- d: back to the default tempo, which is the song's own until you type another into the Tempo field.

In NVDA, nvdaKey+spaceBar turns focus mode on and off.
unstrung cannot do it for you.
Turn focus mode off before you move somewhere else, or the keys you press there will go to unstrung instead of moving you around.

## Chord Practice

Chord practice generates a chord progression and plays it for you to play along with.
Each measure has one chord, strummed with the progression's strumming pattern, with a metronome and, if you want it, the name of the next chord spoken.

### Generating a Progression

Choose Generate Practice Progression from the Chord Progressions submenu.
The Chord Practice dialog asks for:

- **Experience level.** Beginner uses open chords only.
  Intermediate adds barre chords and seventh chords.
  Advanced adds extended chords and chords borrowed from other keys.
  Some advanced chords have no fingering in the chord library; under Chords Used they say so.
- **Key.** Only keys with enough chords playable at the chosen level are listed.
- **Chords from outside the key:** none, occasional or frequent.
  These are mostly chords that lead into the next one, such as D7 before G in the key of C, and chords borrowed from the minor key.
- **Beats per measure** and **note value that gets one beat,** the two numbers of the time signature.
  The tempo counts beats, so the lower number does not change the speed: 6/8 at 90 is ninety eighth notes a minute.
- **Strumming pattern,** from the patterns for the time signature, described under Strumming Patterns.
  It starts on Down Only, and the list changes when the time signature does.
- **Tempo,** from 30 to 240 beats per minute.
- **Number of measures,** from 2 to 256.
- **No chord held over into the next measure,** checked to begin with.
  The chord then changes on every measure, which is what practising changes needs.
  Chords with the same root count as the same chord, so G7 never follows G.
  Unchecked, a chord is sometimes held for two measures, as in most real progressions.
- **Times to play the progression,** up to 50, or 0 to repeat until you stop, and whether to count in before every repeat.
- **Metronome.**
- **Speak the name of the next chord on the last beat of each measure,** checked to begin with.
  The voice and its volume are set in Settings.

Press Generate Progression.
The progression opens as a new item in the list of open items.

### The Progression

A progression's item has:

- **Metadata:** the key, level, time signature, strumming pattern, length, the cadence it ends with, how many chords come from outside the key, and whether it has been saved.
  The strumming pattern is given by its name and its strokes, such as Old Faithful: D - D U - U D U.
  A pattern unstrung does not have a name for is given by its strokes alone.
- **Chords Used:** each different chord once, collapsed, with its fingering and notes.
  A chord from outside the key says which key it comes from and why.
- **Progression:** the chords in order, one per measure.
  While there are unsaved changes, this heading, the item's name and the level 2 heading at the top all say "unsaved changes".
- The Edit Progression, Save Progression and Save Progression As buttons.
- **Playback:** whether to speak the chord names, the strumming pattern, tempo, times to play, count in, metronome, and the Play Progression button.
  Changing the strumming pattern carries on from where the progression is, so you can try patterns while it plays.
  Like the tempo, it is not counted as an unsaved change, but saving keeps the pattern you are on.
- **Move Around the Progression** and **Keyboard Control,** the same buttons and keys as an audio track.
  b also says the chord of the measure you are in.
  d goes back to the tempo the progression opened with, until you type another into the Tempo field.

The media keys and headphone buttons control a progression as they do an audio track; see Media Controls Integration, before Playing a Track.

### Saving and Opening Progressions

Save Progression, or ctrl+s, saves the progression.
The first time, unstrung suggests a name such as Am-60-intermediate-occasional: the key, the number of measures, the level and the setting for chords from outside the key.
Save Progression As, or ctrl+shift+s, saves a copy under a new name.
The key, time signature, chords, strumming pattern and tempo are saved, the pattern and tempo as they are set under Playback.
The metronome and the number of repeats are not.
Opening a progression sets the tempo to the one it was saved with.

Progressions are saved as ordinary files in a folder you choose in Settings, so they can be copied, backed up and shared like any other file.
On the desktop version, the folder is Unstrung\Progressions in your Documents folder unless you choose another.
The files end in .atex.
They are alphaTex, a plain-text way of writing music that other programs built on alphaTab can open too.

To open one, choose Open Saved Progression from the Chord Progressions submenu, or press ctrl+shift+o.
The folder is shown as a tree.
upArrow and downArrow move, rightArrow and leftArrow open and close a folder, a letter moves to the next name starting with that letter, and enter opens the progression.
Any file that cannot be opened is listed after the tree with the reason.
That includes music chord practice cannot show yet, such as a measure with two chords in it, or single notes rather than chords.

If you close a progression with unsaved changes, or quit the desktop app with one open, unstrung asks whether to save first.
A progression that has just been generated and never saved is not asked about.

### Strumming Patterns

A strumming pattern is written the way guitar teachers write it, one stroke for each place the hand passes the strings.
D is a downstroke and U an upstroke.
A dash is a place the hand passes without strumming, while the chord rings on.
x is a muted strum, a chuck, which stops the chord ringing; unstrung does not sound the chuck itself yet.
An accented stroke has a greater-than sign before it, as in >D.
A pattern with no accents of its own is played with beat 1 a little stronger, as a player leans on the downbeat without thinking about it; a written accent is much stronger.
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

### Your Own Strumming Patterns

Choose Strumming Patterns from the menu.
It opens as an item in the list of open items, with you on the Time signature list.
The Pattern list after it has that time signature's patterns, the ones that come with unstrung first and yours after them, each of yours ending in "yours".
After them, a line says what the chosen pattern is and reads its strokes out in words, such as "1 down, and miss, 2 down, and up".

The buttons after it:

- **Play:** plays the pattern on G, C, D and F, two measures each, with the metronome on the beats, round and round until you press it again; while playing it reads Pause.
  Choosing another pattern while it plays switches to that one.
- **New Pattern:** opens the New Strumming Pattern dialog.
- **Copy to My Patterns:** opens the same dialog with the chosen pattern's strokes, to make one of your own from it.
- **Edit:** changes one of yours.
  The patterns that come with unstrung cannot be changed, so a name always means the same strokes; copy one instead.
- **Delete:** removes one of yours.

The dialog asks for a name, the time signature and the strokes.
The strokes are typed as described under Strumming Patterns, and the line after the field reads them back in words as you type, or says what is wrong.
Play plays them the same way, until you press Pause or close the dialog, and Save Pattern keeps the pattern.
A name has to be new in its time signature, and so do the strokes: strokes that are already a pattern are refused, with that pattern's name.

Your patterns are listed in the Chord Practice dialog, the progression editor and a progression's Playback section, after the ones that come with unstrung.
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

The dialog sets the key, time signature and strumming pattern, and lists the measures, one chord each.
The strumming pattern starts on the progression's own.
A progression opened from a file whose pattern unstrung has no name for keeps it, listed as this progression's own.
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

## Metronome

Choose Metronome from the menu.
It opens as an item in the list of open items, with you on the Time signature list.
Its clicks follow a strumming pattern: one click wherever the pattern strikes the strings, and none where it passes without strumming.
Beat 1 is the strong click, a higher pitch.
The other beats are a normal click, and the strokes between them a soft, lower one.
In 6/8 and 12/8 the normal click is on every third eighth, the beats you feel, so 6/8 is heard on 1 and 4.
A pattern with accents of its own, such as Three-Three-Two, puts the strong click on its accents and the soft one everywhere else.

Under Settings:

- **Time signature** and **Strumming pattern,** the same patterns as in the Strumming Patterns item, the ones that come with unstrung and yours.
  After them, a line says where the clicks fall, such as "Clicks on 1 strong, 2, 2 and soft, 3 and soft, 4, 4 and soft".
- **Tempo,** from 30 to 240 beats per minute, 80 to begin with.
  The tempo you type here is the default tempo.
- **Volume,** from 1 to 5, 3 to begin with.

Under Controls:

- **Start:** starts the metronome, and reads Stop while it plays.
  It is a toggle button, pressed while the metronome plays.
- **Slower** and **Faster:** change the tempo by 5 beats per minute.
- **Default Tempo:** goes back to the tempo last typed into the Tempo field.
  Slower and Faster do not change it.
- **Quieter** and **Louder:** change the volume by one.

Changing the tempo, the volume or the pattern while it plays carries on without starting the measure again.
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
In the two lists every key belongs to the list.

## Chord Library

Choose Chord Library from the Chords submenu.
It opens as an item in the list of open items, with you in its search field.

Type part of a chord name and a list of matching names appears.
upArrow and downArrow move through the list, enter takes the highlighted name, and escape closes the list and leaves what you typed.
tab also closes it and moves on.

The Filtering Options section narrows the results by difficulty (standard shapes only, common alternatives, or advanced voicings), root note, chord type and genre.

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
View in Chord Library opens that chord in the chord library.

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
- **Spoken chord volume,** as a percentage, relative to the guitar.
- **Folder for saved chord progressions.**

### Files

- **Default folder for Open File dialog,** desktop only.
- **Clear All Recent Files.**
- **Remove Stale Files from Recents,** which takes out files that no longer exist.

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

## The Desktop App and the Web Version

The two work the same way, with these differences in the web version:

- Recent Files and the folder of saved progressions need Chrome or Edge on a computer.
  Firefox, Safari and every browser on an iPhone or iPad do not support the file system access API they use.
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
