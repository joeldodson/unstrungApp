# Screen Reader Users

unstrung was written entirely by Claude, directed by a blind developer using NVDA on Windows 11.
I chose web technologies largely for the accessibility we already get from them.
There are still some unavoidable limitations though.
In those cases, I've chosen a possibly less usable experience rather than a workaround almost certain to confuse.
One gotcha is having to manually toggle focus mode.
I've called that out in a few places.

The features document describes every part of unstrung and its keys.
This page is specifically directed at screen reader users to highlight some areas.

## Read the Whole Page

There are short notes and hints all through the app explaining what a control does.
A line of text sitting right after a control is easy to miss though.
When you first look around unstrung, take your time and read a whole page rather than tabbing from control to control.
Move around with the arrow keys, or ctrl+arrow, to be sure you hear everything.

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

The keys are listed in the audio track itself, under a level 5 heading called Keyboard Control, once a track has been created.
There are buttons for moving around the track as well, so nothing is keyboard only.
The keys go further than the buttons, though.
They also tell you where you are, turn the metronome on and off, and change the tempo without you leaving your place.

## Why the Measures Are Collapsed

Inside a song, headings are the fastest way around: the Song Summary, then a heading for each track.
A track's measures sit behind a collapsed section called Measures.
That is deliberate.
A song can run to hundreds of lines of beat descriptions, and leaving them all exposed made showing the song slow enough to be painful.
Expand the measures when you want the detail.
The Screen Reader settings tab has an option to collapse them again for you when you switch to another open item, and it is on unless you turn it off.

## Where Messages Go

The status bar is the last thing in the window.
Your screen reader reads it when it changes, without you going looking for it.
If a message went by while you were busy, go to the end of the page to read it again, or press nvdaKey+end.
