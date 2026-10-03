# Release notes history

The notes for every Unstrung release, newest first, copied from the GitHub releases page. Releases
before 0.4.0 were deleted from GitHub on 2026-10-02 to tidy the releases page; their notes survive
only here, and their git tags still mark the commits they were built from.

Each release's own sections are one level below its heading. Links to downloads in the older notes
no longer work for the deleted releases.

When a new release is published, add a copy of its notes at the top of this file, under a level 2
heading with the release's title and the date it was published.

## Unstrung 0.6.0 - A new layout, ready for a web version

Published 2026-10-03.

0.6.0 changes how Unstrung is laid out and used, not what it does. There are no new features.
Reading songs, audio tracks, chord practice, saved progressions, the chord library and Frets to
Chord all work as they did in 0.5.0.

The changes bring the desktop app in line with what a web page in Chrome can support, so that a
web version of Unstrung, served from eyesunstrung.vip, can work exactly the same way. Doing it in
the desktop app first means the new layout gets used every day before any web version exists.

### Why things moved

Some of what the desktop app did cannot be done by a web page:

- Chrome keeps Control+T, Control+W and Control+Tab for itself. A page never sees them, so they
  could not open files, close tabs or move between tabs.
- A web page has no menu bar, and Alt opens Chrome's own menu.
- Inside a browser, Unstrung's tabs would sit inside a browser tab, and "Close Tab" or "tab, 2 of
  4" could mean either.

So the tabs and the menu bar are gone from the desktop app too.

### The window

The eyesunstrung.vip banner is across the top, and links to the site. Below it are two columns.
The left one holds the Menu button and the list of everything open. The right one shows whichever
of those you have chosen, and fills the window down to a status bar along the bottom. Control+Home
gets you to the top.

### The menu

The File, Tools and Help menus are replaced by one Menu button, which opens a menu that works like
a desktop application's:

- Enter, Space or the down arrow opens it on the first item; the up arrow opens it on the last.
- Up and down arrows move through the current menu only, and wrap around at either end.
- The right arrow opens a submenu. The left arrow and Escape back out one level at a time.
- A letter jumps to the next item starting with it. Enter runs the command.
- Tab leaves the menu and closes it.

The menu holds Open File, Recent Files, Chord Progressions, Chords, Settings and Help. Recent
Files, Chord Progressions, Chords and Help are submenus. Create Progression by Hand is now called
Manually Create Chord Progression.

### Open items instead of tabs

Every song, chord progression and the chord library you open is listed in the left column, newest
first. Each is a level 1 heading holding a button, followed by a Close button. Pressing the button
shows that item and moves focus to the start of it. In browse mode, 1 and Shift+1 move between the
open items. Closing one moves focus to the item that took its place in the list.

An item's own headings start at level 2, so the song summary and the list of tracks are level 2
and each track is level 3. The application's name is no longer a heading.

### Keyboard shortcuts

- Control+O opens a file. It replaces Control+T.
- Control+Shift+O still opens a saved progression.
- Control+S and Control+Shift+S still save a chord progression.
- Control+W and Control+Tab are gone. Use the Close button to close an item, and heading
  navigation to move between them.

### Audio tracks live in their track

The Create Audio Track button, and the separate tab it opened, are replaced by a collapsed region at
the end of each track, "Audio track for" and the track's name. Expand it to set up and play that
track's audio. It starts with a level 4 heading of the same name, so moving to the previous heading
and up one line gets you back to it.

Collapsing it stops playback, and expanding it again does not restart it; Play Track carries on
from where it stopped. Moving to another open item collapses it, if the setting to collapse
expanded sections is on, and so stops it too. The playback keys only act on an audio track that is
expanded.

### Dialogs say they are dialogs

Every dialog now starts with a level 1 heading ending in "Dialog Box", such as "Creating Chord
Progression Dialog Box", and its sections are level 2. While a dialog is open, the window title
names it. Before, the title went on naming whatever was open behind the dialog, which made it easy
to forget a dialog was open at all.

### Settings

"Collapse expanded sections when leaving a tab" now reads "Collapse expanded sections when
switching to another open item". It is the same setting, with the same default.

### Installing

**Unstrung Setup 0.6.0.exe** is the installer, and puts the `unstrung` command on your path.
**Unstrung 0.6.0.exe** is a portable build that runs without installing.

Windows only, as before. Unstrung is an Electron app and should run on Mac and Linux, but I only
have a Windows laptop to build and test on. See Clone and Run in the README to run from source.

## Unstrung 0.5.0 - Saved and hand-made chord progressions

Published 2026-09-24.

Chord progressions can now be saved and opened again, edited, or written from scratch, chord by chord.

### Save a progression and open it again

A chord practice tab has Save Progression and Save Progression As buttons, straight after the
list of chords. Control+S and Control+Shift+S do the same from anywhere in the tab.

The first save offers a name made from the key, the number of measures, the level and the setting
for chords from outside the key, for example `Am-60-intermediate-occasional`. Change it to anything
you like. The name you save under becomes the name of the tab, and the Metadata list says
"Saved as" with the name, or "Not saved".

Progressions are saved as ordinary files in a folder, Unstrung\Progressions in your Documents folder
unless you choose another in File, Settings, General. Because they are ordinary files, they can be
copied, backed up and shared, and sub folders made in the Save dialog or in Explorer are kept.

To open one, choose Open Saved Progression from the Tools menu (Control+Shift+O), or the button of
the same name at the top of the Chord Practice dialog. The folder is shown as a tree: up and down
arrows move, right and left open and close a folder, a letter jumps to the next name starting with
it, and Enter opens the progression in a new tab. A file that cannot be opened is listed after the
tree with the reason.

Only the progression is saved: its key, time signature and chords. Tempo, the metronome and the
number of times to play are not. A progression opened from the Chord Practice dialog uses the
playback settings in that dialog.

### Edit a progression, or write your own

Edit Progression, beside the Save buttons, opens a dialog with the progression's measures as a
list, one chord each. Arrow to a measure and press Enter to choose its chord. With the chord field
empty, the down arrow lists the chords of the key, each with its scale degree. Typing searches every
chord in the chord library. A chord from outside the key is marked as such but can still be chosen.
Enter takes the chord and goes back to the measure in the list.

In the list of measures, Delete removes a measure, Control+I inserts an empty one after it,
Control+D duplicates it, and Alt with the up or down arrow moves it. There are buttons for each of
these as well. The dialog also sets the key and time signature. Applying the changes replaces the
progression in the same tab.

Create Progression by Hand, in the Tools menu and in the Chord Practice dialog, opens the same
dialog with one empty measure.

A tab with changes that have not been saved says "unsaved changes" in its name, and asks whether to
save them before the tab is closed or Unstrung is quit. A progression that has just been generated
and never saved is not asked about.

### The seed is gone

The seed field in the Chord Practice dialog and the Copy Seed Information button are removed. A seed
only rebuilt the same progression while the way progressions are generated stayed exactly the same,
and 0.4.1 already changed that. A saved progression keeps its chords, so it stays the same whatever
changes in later versions. Seeds from earlier versions can no longer be entered.

### Rows of buttons read one at a time

Where several buttons sat together, such as Previous Measure, Next Measure, Start of Measure and
Restart, a screen reader in browse mode treated them as one line: Control with the down arrow read
every label at once. Each button is now its own line, while they still appear side by side on
screen. This applies everywhere in Unstrung that buttons are grouped.

### Installing

**Unstrung Setup 0.5.0.exe** is the installer, and puts the `unstrung` command on your path.
**Unstrung 0.5.0.exe** is a portable build that runs without installing.

Windows only, as before. Unstrung is an Electron app and should run on Mac and Linux, but I only
have a Windows laptop to build and test on. See Clone and Run in the README to run from source.

## Unstrung 0.4.1 - Loop counts and fewer held chords

Published 2026-09-17.

Two fixes to playing a passage over and over, which is what most practice is.

### The play count did not start again when you changed it

In Chord Practice, setting the number of times to play to 0 plays until you stop it. Change that to
a number afterwards and the count carried on from wherever the run had already got to. Ask for 10
plays after going round a dozen times and the run was already past 10, so it stopped at the end of
the play in progress.

A new number now starts the count again at play 1 of that number, and the music carries on from
where it is rather than stopping or going back to the top. Press B and it says "play 1 of 10".

The Audio Track panel already did this, and still does: changing how many times to play the
selected measures takes you back to the start of the selection at play 1.

### Fewer chords held for a second bar

Chord Practice sometimes holds a chord for two bars, because that is how real songs are written.
The chance of it was set per level and applied bar by bar, so a long progression got the same
share of held chords as a short one, and many more of them. At beginner level a 120-chord
progression came with about 18 bars repeating the chord before them, roughly one change in seven.
The point of the practice is changing chord.

Every level's chance of holding a chord is now about half what it was: beginner 25% to 12%,
intermediate 15% to 7%, advanced 10% to 5%. A 120-chord beginner progression now gets about 9 held
chords. An 8-chord progression still gets one about two thirds of the time, which is what keeps a
two-bar chord sounding idiomatic rather than absent.

One consequence: a progression code saved or shared before this release now gives different
chords. The code carries the same seed, but the held chords fall differently, and that changes what
is drawn after them.

### Installing

**Unstrung Setup 0.4.1.exe** is the installer, and puts the `unstrung` command on your path.
**Unstrung 0.4.1.exe** is a portable build that runs without installing.

Windows only, as before. Unstrung is an Electron app and should run on Mac and Linux, but I only
have a Windows laptop to build and test on. See Clone and Run in the README to run from source.

## Unstrung 0.4.0 - Bass samples, spoken chord names, and a lot of re-reading

Published 2026-08-18.

This release covers everything since 0.3.0. Two things you can hear, and a lot of reading that was
wrong or missing.

### The octave below the guitar

Nothing below E2 had a sample, E2 being a guitar's own lowest note. Every bass track in every file
I have failed to build outright, and so would a guitar in any drop tuning. Across the songs tested
that was 1735 unplayable notes. It is now 31, all of them on one Hammond organ part.

The seventeen notes from B0 to D#2 come from
[Black And Blue Basses](https://github.com/sfzinstruments/karoryfer.black-and-blue-basses), by the
same creator as the guitar samples, released under the same CC0 licence and recorded the same way.
Together the two libraries cover every semitone from B0 to D6. That reaches the low B of a
five-string bass and every drop tuning down to drop A.

Each pitch is covered by one instrument only, chosen by pitch and nothing else, so a bass line
crossing E2 changes timbre there. Covering the range twice would be three times the samples and
would mean deciding what kind of instrument a track is before it could be played at all.

The samples are now about 397 MB, so the installer is larger than it was.

### Spoken chord names, in two voices

Chord names are spoken from recordings shipped with Unstrung rather than synthesized on the machine
running it, which is what makes them work in an installed build. Every chord the library can show
has one, in two voices: **Settings → General → Chord voices** chooses between Zira and David, and
sets the volume.

Names are spoken in Chord Practice, on the last beat of the measure before the chord arrives, and in
the Chord Library before a chord is played. Speaking them in Chord Practice is now a checkbox on the
progression tab rather than only a choice made in the dialog.

### What the files were already saying

A survey of 11 Guitar Pro 8 files across 56 tracks, none of which can be included here, settled a
run of assumptions. Most of this is information that was in the files all along and never reached
the reader.

**Section names ride on the measure heading**, beside the chord symbols, so a hundred numbered
measures now say which is the chorus:

    Measure 13 - Guitar Solo 1
    Measure 22 - Verse 1 - chord symbol C/G at beat 1

Some files write a section name as text on a beat instead of marking it on the bar. Ripple does
this and marks nothing, so its Intro, End Intro and Outro were invisible to heading navigation.
Text that names a section is lifted onto the heading, on every track, keeping its beat where it
does not fall on the first one. It is fenced so that a tuning instruction, an amp setting, or a
file storing its lyrics as beat text are not mistaken for structure.

**Lyrics lead each measure**, one line per singing part, on every track rather than only the one
carrying them. Guitar Pro stores a syllable per note, so they are joined back into words.

**Chord symbols sit on the measure they govern**, with the beat they start on, rather than hanging
off whichever note the file anchors them to. A D governing four measures used to arrive as a
footnote to one eighth note of the first.

**Each track lists the chords it uses**, in a collapsed region, ordered by how much of the track
each accounts for.

**Percussion tracks name their instruments.** A kick drum and a hi-hat read "A#0; G#-1" before,
which is not what the file says and not something a player can act on.

**Tuplets were reported at the wrong duration.** Three sixteenth-note triplets take the time of two
sixteenths, so calling each a plain sixteenth note misstated the note and the bar around it.

**Stroke direction now comes from the file alone.** It was being inferred from the order a beat
lists its notes, which is not a signal: two exports of the same song list 30 of its beats in
opposite order, so the same music read as up strokes from one and down strokes from the other.
Where the file says nothing, nothing is said, which is what a sighted player reads off the tab.
Playback was also inverted against Guitar Pro's own meaning of a downstroke, and ignored the brush
speed the file asks for.

Also: let ring is marked at the ends of each run, beat text is given verbatim, repeats and alternate
endings ride on the measure heading, the Chords Used list no longer shows one chord twice under two
spellings, sung notes are given as pitches rather than as string and fret, and the song summary
reports a tempo that changes and a swung feel.

### Fixes

**Form controls on a second audio track page had no labels.** The page built its controls with fixed
ids, which is correct until two are open at once. Then the ids collide, and one page's controls
announce as "checkbox, not checked" with nothing to say what they do, while the other page reads
each label twice. Ids are now unique per control. An audit walks every control, button and dialog
in the document and reports anything without a name.

**The window title names the current tab**, so asking a screen reader for the focused window says
which song is in front rather than only "Unstrung".

**The Track summary says where a part comes in.** The bass on Wish You Were Here is silent until
measure 29, and the note count alone gave no way to tell a quiet opening from a track built wrong.

**The Chord Practice dialog resets each time it opens.** A seed left behind from an earlier
progression silently overrode the key, level and length chosen beside it.

**A shape that does not sound every note of its chord says so**, under the notes it qualifies:
"Leaves out the fifth (G)." The open C7 is x32310, which has no fifth in it anywhere. 448 of the
2061 shapes in the library leave something out.

**Chord Library selections** no longer survive a change of search while being invisible and
unplayable, and the Settings panel no longer reads its own documentation aloud on opening.

### Installing

**Unstrung Setup 0.4.0.exe** is the installer, and puts the `unstrung` command on your path.
**Unstrung 0.4.0.exe** is a portable build that runs without installing.

Windows only, as before. Unstrung is an Electron app and should run on Mac and Linux, but I only
have a Windows laptop to build and test on. See Clone and Run in the README to run from source.

## Unstrung 0.3.0 - Chord Practice

Published 2026-08-14. The GitHub release was deleted on 2026-10-02; the tag v0.3.0 remains.

### Chord Practice

A new tool for practising chord changes. **Tools → Chord Practice** generates a chord
progression to play along with, and its audio track, in one tab.

You choose a key, an experience level, a time signature, a tempo, and how many measures. The
progression is generated fresh each time from weighted rules about how chords tend to move in a
key, so it is different every time but still goes somewhere rather than wandering.

**Only chords you can play.** Each level is tied to what is actually fretted: beginner is open
position, intermediate allows barre shapes and sevenths, advanced goes as far as extensions and
chords the library has no fingering for. A chord with no acceptable shape in the chosen key is
never offered. Open position does not cover all twelve keys, so a key it cannot support is
refused outright and the keys that do work are named.

**Chords from outside the key**, at three settings, because songs rarely stay strictly inside one.
Secondary dominants resolve to the chord they point at, and chords borrowed from the parallel minor
stand in for the diatonic chord of the same position.

**The tab** lists the metadata, then each distinct chord once with its fingering and notes, then
the progression itself as plain chord names, then playback. Playback works exactly as audio track
playback does, key for key: space, arrows to move by measure, B for where you are, M for the
metronome, S and F for tempo. Repeats, and a count-in before the first pass or before every one.

**Spoken chord names.** Optionally, the name of the next chord is spoken on the last beat of the
measure before it, at a volume you set. On Windows the names are rendered to audio so they land
exactly on the beat rather than being started on a timer and hoped for.

**Seeds.** Every progression reports a seed carrying its key, level, borrowing, length and time
signature. Paste one back and you get that exact progression, whatever else the dialog is set to,
so a progression worth practising can be written down or passed to somebody else. There is a
button to copy it.

### Fixes and tidying to what was already here

A good deal of this release is the rest of the app catching up.

**Chord names were spelled wrongly.** C sharp minor was listed as C#, E, Ab where it should be
C#, E, G#. The pitches were always right, so nothing that compares notes could catch it; the
names were wrong. Chord tones are now spelled as their chord requires. C sharp major, C augmented
and 7b5 chords were all affected.

**Notes are listed from the root.** F sharp minor read "C#, F#, A" — the right notes in an order
nobody builds a shape from.

**A voicing whose lowest note is not the root now says so**, and says which string to mute. A B
minor barred across all six strings sounds Bm/F#, which is a real way to play it and was silently
labelled as plain Bm. One voicing in five is affected.

**Chord Library**: a Playback heading after the search results, so a long list of results is one
jump from the play button, with the chords to be played listed in order ahead of it. The status
line follows the search instead of reporting whatever opened the library.

**Frets to Chord** clears the fretboard when reopened, rather than starting on the last shape.

**Audio track playback**: pressing B while a range of measures is selected now reports against the
selection — "measure 17 of measures 7 through 21" — rather than against the whole song. Asking the
same question twice now answers twice; a repeated answer used to go unspoken. Number fields no
longer swallow the transport keys.

Both kinds of playback now share one scheduler, which is what keeps them behaving the same.

## v0.2.0 - Audio tracks, chord library, and screen reader settings

Published 2026-08-05. The GitHub release was deleted on 2026-10-02; the tag v0.2.0 remains.

unstrung 0.2.0 is a large step up from 0.1.1. The headline is that unstrung can now
generate audio you can play along to, using real recorded guitar samples rather than a
synthesizer. There is also a chord library, tools for looking chords up in both
directions, and a set of settings and help documents written specifically for screen
reader users.

Windows only for now. There is an installer and a standalone portable exe below. As an
Electron app it should run on Mac and Linux from source; see Clone and Run in the README.

### Audio tracks

Any guitar track in a parsed file now has a Create Audio Track button, which opens the
track in its own tab and lets you play it.

- Tempo in beats per minute, from 15 to 300, which scales the song's own tempo changes
  rather than flattening them.
- Play all measures or pick a range, repeating from 1 to 50 times, or until you stop it.
- A metronome overlay, with a measure of clicks counting you in the first time through,
  and optionally before every repeat.
- Keyboard control while playing: space pauses, the arrow keys move by measure and
  restart, b says where you are, m toggles the metronome, s and f change the tempo.
  Buttons do the same moves, so nothing is keyboard only.

The audio comes from Black And Green Guitars by Karoryfer Lecolds, recorded by Brian
Wood and released under CC0. unstrung ships 430 recordings of a green Gretsch
Anniversary: three volumes of every note and up to four separate takes at each volume,
so a repeated note uses a different recording each time. That is most of the download
size, and it is bundled rather than fetched so nothing depends on a server years from
now.

### Chords

A chord library of 564 chords and 2,061 fingerings, under Tools. Every fingering is
re-derived from its fret positions and checked against the chord's interval formula
before it ships, so the seed data's real errors do not reach you. You can search by
name, filter by root, type and genre, and hear any fingering strummed.

Frets to Chord works the other way round: describe what each string is doing and it
names the chord. It has a tuning selector, and outside standard tuning it says plainly
that the stored fingerings do not apply, since those are standard tuning only.

Tools also has Listen to Guitar Samples, for hearing individual notes.

### Reading a song

The measure listing now names a chord where the notes unambiguously spell one, instead
of listing every string and fret. A beat reads as "Em7/D (G6/D), strings 1 through 4, up
stroke" rather than four string and fret pairs. Names come from the pitches sounded, so
a capo or an altered tuning makes no difference, and a second reading is given in
parentheses where the notes genuinely spell two chords. Beats that do not spell a
complete chord are still listed string by string, since a part chord needs telling that
way.

A track's tuning is now worked out from the pitches rather than read from the file's
label, which is often empty. A non-standard tuning is named along with how far each
string differs from standard.

### For screen reader users

- A Screen Reader tab in Settings, with an option to shorten each beat description once
  you know the chord shapes, and an option to collapse expanded sections when you leave
  a tab, which avoids waiting on the screen reader when you come back.
- A Screen Reader Users document under Help, gathering in one place the things worth
  knowing: that explanatory text sits beside controls and is easy to miss when tabbing,
  why the playback keys need focus mode and what goes wrong if you leave it on, and how
  to get around the tabs and a song.
- Help also has What is Unstrung and Feedback. All three are dialogs, so nothing is left
  open among your song and playback tabs.

### File menu

Recently opened files, and a Settings dialog with General, Files and Screen Reader tabs.
Settings covers the default folder for Open File, clearing recent files, and removing
files from the list that no longer exist.

### Fixes

- Entering a song tab took several seconds. A track's measures now sit behind a
  collapsed disclosure built only when opened, which took one panel from 221 exposed
  nodes to 19.
- Dense tracks crackled, because every note was scheduled at once. Notes are now
  scheduled in a rolling window, cutting a worst case from 2,198 live sources to 281.
- Two saves of the settings file landing together could corrupt it, which silently
  discarded the recent files list and every setting. Saves are queued and written
  atomically.
- The same file could appear twice in recent files when opened by a differently spelled
  path.
- Links written without a path, such as the one to claude.ai in the About dialog, closed
  the dialog and opened nothing.
- Ctrl+Tab stopped working when the Tabs menu was removed; it is handled directly now.

### Known limitations

- Bass tracks cannot be generated. The samples stop at E2 and a bass reaches a full
  octave lower. When you try, unstrung names the measures it could not play rather than
  leaving them out quietly.
- Chord library fingerings are for standard tuning only. Chord naming is not.
- The installer is unsigned, so Windows will warn about an unrecognised publisher.

## v0.1.1

Published 2026-07-20. The GitHub release was deleted on 2026-10-02; the tag v0.1.1 remains.

### Download

Two options below — pick whichever suits you:

- **`Unstrung Setup 0.1.1.exe`** (installer, recommended) — installs to your user profile, adds Unstrung to your PATH so you can run `unstrung` from a terminal, and creates a Start Menu shortcut. Starts almost instantly.
- **`Unstrung 0.1.1.exe`** (portable) — no installation, just run it. Re-extracts to a temp folder on every launch, so it's noticeably slower to start (a few seconds) and doesn't get a PATH entry or `-h`/`--help` terminal output.

Note: neither build is code-signed, so Windows SmartScreen will likely show a warning the first time you run it ("Windows protected your PC"). Click "More info" then "Run anyway" to proceed.

### What's new since 0.1.0

- **Help > About dialog** — accessible modal with app info, version, supported formats, and links to the project site, license, and source, reachable from a new Help menu.
- **Command-line support** — `unstrung file1.gp file2.gp5 ...` opens each file in its own tab on startup, just like using Ctrl+T. `unstrung -h` / `--help` prints usage info (works from the installer build and from a dev checkout; not from the portable build's console output, a known Windows/NSIS limitation).
- **Installer** — new NSIS installer alongside the portable build, adding/removing Unstrung from your PATH on install/uninstall.

### What it does

- Opens Guitar Pro and similar music notation files via the File menu (Ctrl+T)
- Multiple files open as tabs (Ctrl+Tab / Ctrl+Shift+Tab / Ctrl+W to navigate)
- Displays song summary, track details, and a measure-by-measure breakdown of notes and playing techniques (hammer-ons, bends, slides, harmonics, etc.)
- Synthesizes and plays back audio for the active file
- Built with semantic HTML and ARIA throughout for screen reader use (developed and tested with NVDA)

## v0.1.0 - Initial proof of concept

Published 2026-07-20. The GitHub release was deleted on 2026-10-02; the tag v0.1.0 remains.

Initial proof-of-concept release of Unstrung, an accessible song file inspector built for screen reader users.

### Download
Download `Unstrung 0.1.0.exe` below. It's a portable build — just run it, no installation needed.

Note: this build isn't code-signed, so Windows SmartScreen will likely show a warning the first time you run it ("Windows protected your PC"). Click "More info" then "Run anyway" to proceed.

### What it does
- Opens Guitar Pro and similar music notation files via the File menu (Ctrl+T)
- Multiple files open as tabs (Ctrl+Tab / Ctrl+Shift+Tab / Ctrl+W to navigate)
- Displays song summary, track details, and a measure-by-measure breakdown of notes and playing techniques (hammer-ons, bends, slides, harmonics, etc.)
- Synthesizes and plays back audio for the active file
- Built with semantic HTML and ARIA throughout for screen reader use (developed and tested with NVDA)
