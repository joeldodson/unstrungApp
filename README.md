# unstrung application

unstrung is designed and built specifically for screen reader users learning to play guitar.
And hopefully will also be useful for more advanced players.
And maybe even sighted people will find some value here.
It's an electron application thus all your web based accessibility skills will work here.
It attempts to make music notation files (e.g., .gp and musicxml) readable using basic web technologies.
It might expand at some point.
It might go away at some point.
It is free and open source software, released under the MIT License.

I am totally blind and use NVDA on Windows 11.
You'll hear lots of references to browse and focus modes and single letter navigation in HTML documents.
I think that maps directly to slightly different terms in other screen readers.
In short, focus mode is when input goes to the element with system focus, e.g., text input field.
Browse mode is when NVDA is getting the keyboard input and performing functions like single letter navigation.

As an electron app, unstrung should run on Windows, Mac, and Linux.
I only have a Windows laptop though, so there is only a Windows installer in the 
[unstrungApp github releases](https://github.com/joeldodson/unstrungApp/releases).
See the Clone and Run section below to run from source in your environment.

## What It Does

This section is intentionally short.
unstrung is evolving quickly thus adding too much here risks outdated information.
Hopefully you will find the app fairly intuitive.
It has standard menus and helpful text along the way.
The Help-> About dialog tells you files supported (e.g., gp* and music xml) and will be kept current.
I mention the About dialog because that is written by Claude and much more likely to be current.
This text is being written by a real person, not one devoted to documentation.

The core usefulness of unstrung is reading in a file with musical notation, parsing it, and displaying the tracks and measures in very accessible, semantic HTML.
Once parsed, an audio track can be generated for any of the guitar tracks.
The user can select the tempo, whether to play all measures or a subset of them, and whether to have a metronome assistant.
The measures can be played in a loop, one time, or until stopped manually.
The audio track is intended as a resource to play along and/or understand the song.

For screen reader users, once an audio track is playing, you can control it with single keyboard input (you must be in focus mode).
For example, go forward or backward a measure, or back to the beginning of the current measure, or back to the beginning of the selected measures.
The metronome can be toggled and the playback tempo can be adjusted dynamically.
The keys to perform these tasks are described on the page where the audio is being played.
I suppose that will work for non screen reader users as well.

## Command Line Interface (cli)

Note the cli only works if you have installed unstrung.
The installer is what puts the ```unstrung``` command on your path.
If you are running from source instead, use the ```npm start``` forms described in Clone and Run below.

unstrung can be run directly from the command line with a list of song files:

```unstrung ripple.gp wish_you_were_here.gpx```

The GUI will open and each song listed on the command line will be parsed in its own tab.

```unstrung --help```

will print the command line help text to the terminal.

## Various Tools

In addition to reading a music notation file and generating an audio track to play along,
there are tools associated with guitar chords.
Check out the tools menu, alt+t.
You can search for a chord in the chord library and hear it strummed.
You can look up a chord given a description of strings and frets played.
You can even listen to the guitar samples used to generate the audio tracks.
There will hopefully be more tools soon.

## Screen Reader Settings

The File-> Settings dialog has a Screen Reader tab worth knowing about.
It holds settings that reduce how much your screen reader has to read out.
Each one is described in the dialog itself, so this will not go stale.
One shortens the description of each beat once you know the chord shapes.
Another collapses expanded sections when you leave a tab,
which keeps you from waiting on the screen reader when you come back to it.

## Resources

### Guitar Pro, .gp* Files

I've been thinking of unstrung for a few years.
I finally found the motivation after hearing friends rave about AI coding.
Then really motivated while going through some lessons on
[Totally Guitars](https://totallyguitars.com).
It's a site much better at creating guitar lessons than building accessible/usable websites.
It's also a good place to find .gp* files for hundreds (thousands?) of songs.

I have purchased several lesson packs and generally enjoy Neil's teaching.
Unfortunately, the videos often assume the user is following along with the tab sheet (generally a .gp* file).
Now, with unstrung, I can read the tab sheet and follow along with the videos.

Another good site for .gp* files is
[Songsterr](https://www.songsterr.com/).

Unfortunately you need a subscription ($9.99/month) to download the .gp files.
It's not a long term commitment though and I have not come across a limit of how many files can be downloaded a month.
Their files are crowdsource generated and tend to be more complete than TotallyGuitar.
They tend to be more complicated too though.
Totally Guitars might be a better place when getting started.
Songsterr might be better when you really want to get into the eighth and sixteenth notes.

Songsterr is also not a very accessible/usable site.
With patience though, I was able to create an account and figure out how to search, find search results, and find the download functionality.
Search is generally exposed as an editable text element.
Type in your request, hit enter, wait a few seconds (there is no audible indication anything is happening),
then in browse mode look for the next link ('k' in NVDA).
If it found anything for your search, it should be in links after the search box.

Once you've clicked on a search result, you go to the page for that song.
It seems to put me directly on a "play" button to hear a MIDI version.
On that page, search for "download". It's in a set of tabs, I think near the end of the page.
Hit enter on the download tab to select it.
Immediately after selecting the download tab, I ctrl+downarrow and hear "dialog download tab."
Hit enter on that and you get, I guess, a pop up dialog with buttons for which format you want.
Choose the Guitar Pro button and you should get a standard where to save the file dialog.

### MusicXML

I could not find good resources for musicXML files.
I tried to poke around [MuseScore](https://musescore.com) which is supposedly a good resource.
I could not make sense of that stinking pile of, probably React based, HTML.
Reach out in Feedback if you know of good musicXML sources.

## Clone and Run

unstrung is an electron application.
It should "just work" on Windows, Mac, and Linux, though I have only run it on Windows.
Nothing here needs a C++ compiler, Python, or Visual Studio Build Tools.
All the dependencies ship prebuilt, which is not always true of electron apps.
To clone the repo and run from source, do the following:

1. prerequisites: you need [git](https://git-scm.com/) and [Node.js](https://nodejs.org/). It's been developed using node version 24, best to use at least that.
1. Clone the [unstrungApp repo on GitHub](https://github.com/joeldodson/unstrungApp) locally. Best to get the repo clone URL directly from github, it's different depending on whether you use https or ssh.
   * For https: ```git clone https://github.com/joeldodson/unstrungApp.git```
   * The repo is large due to the audio samples it stores, cloning might take a while depending on your network
1. ```cd unstrungApp```
1. ```npm install``` - this only needs to be done once, after cloning, not with each run.
1. ```npm start``` - this will start the unstrung GUI with no tabs
1. ```npm start -- some_file.gp``` - starts the unstrung GUI with passed in file parsed in a tab
1. ```npm start -- --help``` - prints the command line help output

## Feedback

I'd love to hear what you think of unstrung.
And requests for changes and/or new features are welcomed.
Please open an issue in the
[unstrungApp issues on GitHub](https://github.com/joeldodson/unstrungApp/issues).
Please search before creating a new issue.
It's better to add a comment to an open issue if it's an issue similar to your feedback.
It helps others follow a discussion and helps me understand the level of interest and/or impact.