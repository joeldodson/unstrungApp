# Screen Reader Users

unstrung was written entirely by Claude, directed by a blind developer using NVDA on Windows 11.
I chose web technologies largely for the accessibility we already get from them.
There are still some unavoidable limitations though.
In those cases, I've chosen a possibly less usable experience rather than a workaround almost certain to confuse.
One gotcha is having to manually toggle focus mode.
I've called that out in a few places.

The features document describes every part of unstrung and its keys.
This page is specifically directed at screen reader users to highlight some areas.

## Semantic HTML and Local Hints

By using Electron initially, I was able to focus on semantic HTML for accessibility.
All your web-based navigation skills will be useful in unstrung.
The UI makes use of landmarks, headings, expandable elements, and lots of lists.
You can get a decent understanding of the layout navigating by headings and form elements.
Listen closely though for "collapsed" as there is lots of functionality contained in those expandable widgets.

As you are learning the user interface, arrow, or ctrl+arrow around to hear everything.
Navigating by tabs or specific elements will skip over text intended to provide helpful hints.
Many of the helpful hints have been moved into expandable elements partly so they are not skipped when tabbing.
You'll need to expand the element of course to read the information.

On the pages of eyesunstrung.vip, the only places that do not have labels are nav elements.
In the unstrung app itself, the nav elements do have labels: the Menu button is in one named unstrung, and the open items are in one named Open items.
On the site, I left them out intentionally due to the label being read then the immediately following element.
It led to either duplicate announcements or verbose confusion.
I made sure when navigating by landmarks (d in NVDA), there is a useful announcement when you land on a nav element.

## Settings for Screen Reader Users

The Settings dialog, reached from the menu, has a tab called Screen Reader.
Its settings have defaults chosen with newer users in mind.
Each has a paragraph beneath it saying what it does and why you might want to change it.
Read the whole tab rather than only the checkbox labels.

## The Playback Keys Need Focus Mode

Once you have created an audio track, you can control playback with single keys.
For those keys to reach unstrung, your screen reader has to be in the mode where keyboard input goes straight to the application.
In NVDA that is focus mode, and nvdaKey+spaceBar turns it on and off.

A screen reader normally switches in and out of focus mode by itself, depending on whether you have landed on something that takes typed input.
Nothing in the audio track playback takes typed input, so it will not switch for you.
You have to turn focus mode on yourself, and it will not turn itself off.

While testing, I kept catching myself out this way.
I would turn on focus mode to try the playback keys, then move to another open item.
I would get there but be unable to navigate it, until I remembered I was still in focus mode and switched back to browse mode.
If something suddenly seems unresponsive, that is almost certainly why.

Type ? in a track's Measures and Playback section, or in a chord progression, and the Playback Keys dialog lists the keys.
Each key has a button under Playback Controls as well, so nothing is keyboard only.
The keys save you leaving your place, though: they tell you where you are, turn the metronome on and off, and change the tempo from wherever you are reading.

## Why the Measures Are Collapsed

Inside a song, headings are the fastest way around: the Song Summary, then a heading for each track.
A track's measures sit behind a collapsed section called Measures and Playback.
That is deliberate.
A song can run to hundreds of lines of beat descriptions, and leaving them all exposed made showing the song slow enough to be painful.
Expand Measures and Playback when you want to work with a specific track.
The Screen Reader settings tab has an option to collapse them again for you when you switch to another open item, and it is on unless you turn it off.

## Where Messages Go

The status bar is the last thing in the window.
Your screen reader reads it when it changes, without you going looking for it.
If a message went by while you were busy, go to the end of the page to read it again, or press nvdaKey+end.
