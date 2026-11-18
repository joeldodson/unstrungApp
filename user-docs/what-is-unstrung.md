# What Is unstrung?

This document exists to set expectations of what unstrung is and how a user might find value in it.

I started unstrung as an experiment to access the contents of files containing guitar tabs using a screen reader.
I also wanted to build features to help blind people learning to play guitar.
I had two core goals:

* unstrung will be fully accessible to screen reader users.
* unstrung will be useful to people with little to no musical background.

I am not a musician.
I'm a blind guy trying to be a better guitar player.
I'm developing unstrung from a perspective of what I think will be useful to me.
And I'm putting it online in case it might be useful to others.

I'll keep this document high level.
The goal is to present the core motivations and areas of functionality of unstrung.
There is a [features document](/unstrung/docs/features/) with details of all the features.
If you want more details, that's the place.

## Reading Music Files

The initial motivation for unstrung was a desire to access guitar tab files using a screen reader.
The first prompt to Claude was: "Create an Electron app that lets me select a file and access its data using fully accessible, semantic HTML.
The HTML document you create must be well structured using headings, lists, and any other elements you think make sense.
You choose the structure based on file contents and we'll iterate from there."

Claude came back with metadata regarding the song, the artist, its key and timing, then headings for each track.
Each track had metadata regarding instrument, tuning, and a list of headings for each measure.
Each measure had a list of beats including duration (e.g., quarter note) and notes played.
The heading structure was logical, enabling me to jump around the document using single letter navigation.
We've been iterating on that initial structure ever since.

The presentation of the song is intentionally not based on traditional sheet music.
It's much closer to a sighted person looking at guitar tabs focused on which strings are fretted where, in what sequence, for how long.
For example, the first measure of Ripple, by the Grateful Dead, might read like:

* quarter note, rest
* eighth note, string 5, fret 2
* eighth note, string 6, fret 3
* quarter note, string 5, fret 2
* eighth note, string 5, fret 3
* eighth note, string 4, open

It's a bit verbose (though the list's bullet style is set to "none" to limit speech) but, I find, it works okay for fairly simple songs.
I plan to add an option to show notes instead of string and fret.
Notes though can be ambiguous.
For example, in standard tuning, an A2 can be played on string 6, fret 5, or open string 5.
Showing notes would reduce verbosity and be a great way to better learn the fretboard, but is for a more advanced player.
String and fret will likely always be the default with notes as an option.

When a song has a bass line written as a separate voice, for example, unstrung needs another way to present it.
I had to learn what Claude meant when it asked about "voices": a second line of notes played at the same time, such as a bass line under a melody.
That's part of me not being a musician.
If you open a file containing multiple voices, you'll find out how that's addressed.
In short, it's more verbose.

I find this approach to be useful for reading through the song a measure at a time.
As a blind person, I'll need to memorize each measure.
I don't get to look at the score as I play and instantly recognize a note, or notes, on a line or space at a certain beat.

This satisfied my basic desire to read the contents of a song file.
Now, how can unstrung help me to learn that song?

## Practice Buddy

I can access details about the structure of the song now.
I have a hard time though imagining it in my head.
It'd be nice if unstrung could play a measure for me.
Then I could play it myself knowing how it should sound.

### Audio Tracks

Each measure can be played to you.
Read the list of notes and chords for a measure, hear it played, then play it yourself.
Have unstrung play that measure in a loop at a chosen tempo, very slowly at first, and play along.

Once you have a measure down, go to the next one.
Try that measure, and once you're comfortable, play both together.
And so on.

I've tried to make it easy to focus on a single measure, then to build up an audio track of multiple measures.
Eventually, you know the song.

### Chord Progressions

Specific songs aside, chords and chord transitions are the first part of learning to play guitar.
Also, you'll find plenty of YouTube videos showing a simplified version of a song based on chords.
Learning those simplified versions is a great way to make progress and stay motivated.

The chord progression feature will generate a progression for you based on some options, e.g., key, complexity.
You can then play along with the progression at a chosen tempo and strumming style.
And you can edit a generated progression or create your own from scratch.
For example, if you've found a video describing a song you want to play, you can create a chord progression of that song and practice along with unstrung.

## References and Articles

### The Chord Library

YouTube lessons are part of why the chord library exists.
Not all YouTubers will describe how a chord is played.
Often you'll hear, "you can follow along with the tabs at the bottom of the screen."
Well, no, I cannot.
I can though look up how a chord is likely played in the song then play along with the video.

Also, chord progressions might contain chords you're not familiar with.
This is the other use of the chord library.
Each chord progression has a list of chords it uses.
Each chord in the list is an expandable element containing details of that chord, including how to play it.

You can look up a chord in the library, read the various ways it can be played, and hear it strummed.
You can compare chords as well.
Try listening to a C and a C minor chord played back to back.

If someone tells you to play a certain set of strings and frets, you can use the chord library to look up whether that maps to a chord.
If there's no match, the chord may just not be in the library.
That doesn't mean the notes aren't a chord.
With over 850 chords in the library though, there's a good chance you'll find a match.

### Articles

The articles are hosted on the eyesunstrung.vip site under [articles](/articles/).
That's not technically part of the unstrung app, but if you're using the web hosted version, you're on the eyesunstrung.vip site already.

I said at the beginning there would be no assumptions about a musical background.
Then I throw around terms like "key" and "timing" and "chord."
I plan to write articles on the very basics of Western music that explain those terms.
I also plan articles going into greater depth to satisfy my own curiosity, and hopefully yours as well.

## Should You Use unstrung?

If you're a blind guitar player who wants to read tabs and practice without learning standard notation first, unstrung is for you.

It's certainly a good idea to understand music notation and be able to read sheet music.
I'd argue that is less relevant for the casual guitar player, especially a blind one.
If you are aiming to be a serious musician though, understanding sheet music and all its complexities is necessary.
In that case, you probably do want to understand programs like [MuseScore Studio](https://musescore.org/).

There are blind people who are real musicians and are also developing musical score reading software.
Check out [Recall Score](https://github.com/Chessel85/RecallScore/releases) and [SpeakTab](https://speaktab.pages.dev/).
Those might be better choices if you're looking for more serious musical software that is also screen reader friendly.

## Getting Started

I'd suggest not initially reading through the entire features documentation.
The first few sections might be helpful though.
The general layout is described, including heading structure and different types of content.

I like to think the unstrung app is fairly intuitive.
It opens with nothing but a menu button.
Try pressing that button and arrowing up and down to hear the various options.
Try opening a .gp file (they are all over the web) and read through the content it generates.
There is a logical heading structure, and all form elements have descriptive labels.
Once you are familiar with the layout, and you have some files in the Recent Files menu, it's quite easy to jump around and find exactly what you want.

Try generating a practice chord progression.
Read through the content it generates.
Hopefully you will find the structure intuitive and usable.
You can save chord progressions and get back to them quickly.

I'd love to hear if you've found unstrung useful.
The footer of every page on eyesunstrung.vip has contact information.
Please send me an email with any comments or feature requests.
