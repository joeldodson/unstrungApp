# Third Party Components

This is a list of the most important third party components in unstrung.
Most of them depend on other third parties in turn, so not everything is listed here.
Tools like Visual Studio Code and Claude (which I actually pay for) are not listed either.
I consider those tools for building, not components.
By components, I mean the pieces that make up the unstrung application and ship with it.

## Electron

The desktop app is built on [Electron](https://www.electronjs.org/).
Electron packages the Chromium browser together with Node.js, so a web page can be installed and run as a desktop application.
That is why the desktop app and the web version can share almost all of their code.
Electron is released under the MIT License.
The web version does not use it.

## alphaTab

[alphaTab](https://alphatab.net) reads the song files.
It turns a Guitar Pro or MusicXML file into tracks, measures, beats and notes, and unstrung builds its text and headings from those.
alphaTab can also draw a score and play it, but unstrung uses only the part that reads files.
alphaTab is released under the Mozilla Public License 2.0.

## chords-db

The fingerings in the chord library start from [chords-db](https://github.com/tombatossals/chords-db), a community collection of guitar chord shapes.
It has some errors, so unstrung checks every shape against the notes its chord should have and leaves out the ones that are wrong.
unstrung also adds chords it lacks, such as power chords.
chords-db is released under the MIT License.

## Audio Samples

I didn't like the sound of simple MIDI, a very basic synthesizer sound.
I looked into generating more realistic sounds by passing MIDI through various tools.
That would have added more complicated dependencies, which could affect cross-platform support.
So instead, I found real recordings of guitar notes online.

The samples come from two free libraries by Karoryfer Lecolds.
Both are released under CC0, so there's nothing to license and nothing to pay.

The guitar is from [Black And Green Guitars](https://github.com/sfzinstruments/karoryfer.black-and-green-guitars), recorded by Brian Wood.
unstrung uses only the normal picking samples of the green Gretsch Anniversary, 430 recordings covering E2 up to D6.
Each note was recorded at three volumes, soft, medium and loud, with up to four separate recordings of the same note at the same volume.
Playing the same note twice in a row uses a different recording each time, which is why repeated notes sound like someone playing rather than a sound being replayed.

Below E2, the lowest note on a guitar, unstrung uses [Black And Blue Basses](https://github.com/sfzinstruments/karoryfer.black-and-blue-basses), by the same creator and also released under CC0.
The seventeen notes from B0 up to D#2 come from its "dark black" bass, 204 recordings with the same three volumes and four takes each.
Together the two cover every semitone from B0 to D6, which reaches the low B of a five-string bass and every drop tuning down to drop A.
There is a slight change in sound between D#2 and E2, where the recordings switch instrument.

Nothing is being modeled or approximated, so it sounds like a guitar without any further work.
It also needs no plugins and no synthesizer.

The desktop app ships with every sample, which is why its installer is large.
The web version downloads each sample the first time it is needed, from eyesunstrung.vip, and the browser keeps it after that.

Nothing above D6 or below B0 exists in these samples.
When a track goes outside that range, unstrung tells you which measures it could not play instead of quietly leaving them out.

## Font

unstrung uses [Atkinson Hyperlegible Next](https://www.brailleinstitute.org/freefont/), a typeface the Braille Institute designed for low vision readers.
It is the same font as the [eyesunstrung website](https://eyesunstrung.vip).
It is released under the SIL Open Font License 1.1, and its license ships with the app.
