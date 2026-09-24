# Saved, edited and hand-made chord progressions

A record of the design discussion held 2026-09-18 to 2026-09-19, what was decided, and why. The
feature shipped in version 0.5.0, which is committed but not yet built or released as of 2026-09-20.

## What Joel asked for

- A way to edit a generated chord progression, or to write one by hand.
- Instead of showing and copying a seed, a way to save any progression -- generated, edited or
  hand-made -- and open it again later.
- A button to open a saved progression in place of the seed field at the start of the chord
  practice dialog.
- A Save button, and an Edit button beside it, under the heading with the progression list.
- One editing process for both editing and creating.
- The questions he raised: store progressions in the app's own data or a folder he chooses? Allow a
  hierarchy like browser bookmarks? Load them from an arrowable menu rather than Explorer? Limit the
  chord drop-down to chords in the key?

## Decisions and the reasons for them

### The seed is gone completely

A seed only reproduces a progression while the generator stays exactly the same. Commit 93396ff
("Hold a chord for a second bar about half as often") had just changed the random draws, so every
seed copied before it already gave a different progression. Saved progressions store the chords
themselves. The generator keeps a seed option internally, used only by
`scripts/progressions/check-progressions.mjs` for repeatable statistical checks. Nothing in the app
shows or accepts one.

### Files in a folder, not the app's own data

- Default `Documents/Unstrung/Progressions`, changeable in Settings, General.
- Chosen over the app's data folder because it needs no export or import feature, the files can be
  backed up, synced or shared, and sub-folders give the bookmark-style hierarchy for free: the
  system Save dialog can already create folders.
- Joel raised that Documents sounded Windows-specific. It is resolved through Electron's
  `app.getPath('documents')`, which works on macOS and Linux too, and it is stored as empty in the
  settings file so the default follows the Documents folder if it moves.
- Tempo, the metronome and the repeat count are not saved: they are how you practise, not what the
  progression is. The time signature is saved.

### The file format

JSON, in `src/shared/savedProgressions.mjs`:

```json
{
  "format": 1,
  "key": "A",
  "mode": "minor",
  "timeSignature": { "beatsPerBar": 4, "beatUnit": 4 },
  "chords": [ { "root": "A", "suffix": "minor" }, { "root": "F", "suffix": "major" } ],
  "origin": { "made": "generated", "levelId": "intermediate", "borrowingId": "occasional" }
}
```

`origin.made` is `generated`, `edited` or `hand`. The file name is the progression's name; there is
no separate name field, so the two can never disagree. Every chord must be in the chord library,
since that is what gives it a fingering and a spoken name.

### Opening: a tree in a dialog, not a menu

A native menu mirroring the folders was considered. It was set aside because a menu has no search,
gets unwieldy with many items, and would need rebuilding whenever files change. The Open Saved
Progression dialog shows the folder as an ARIA tree: folders first, arrow keys to open and close
them, type a letter to jump, Enter to open. Files that cannot be opened are listed after the tree
with the reason. It reopens on the progression last opened, with folders as they were left. A file
already open in a tab is shown there instead of opened twice.

### One editor for editing and creating

- Two layouts were considered: a row of controls per measure, or a list box of measures with one
  chord field editing the current measure. The list box was chosen: the number of Tab stops stays
  the same however long the progression is.
- The chord field is a combo box. With it empty, Down lists the key's own chords with their scale
  degree. Degrees are given as numbers, because a screen reader reads "ii" as two letters. Typing
  searches the whole chord library.
- Chords are not limited to the key. A chord outside it is labelled "outside the key" and can
  still be chosen. "In the key" is decided by the chord's notes, not its name, so G7 counts as in C
  major and E7 as in A minor.
- Editing replaces the progression in the same tab rather than opening a new one.

### Unsaved changes

A tab with changes since it was saved says "(unsaved changes)" in its heading and tab name, asks
Save, Don't Save or Cancel before closing, and the window asks before quitting. A freshly generated
progression does not count as unsaved: asking about every throwaway draft would train the wrong
answer.

### Other recommendations accepted

- A hand-made progression has no level; fingerings come from the library's first shape, which is
  also what playback already did for generated ones.
- A progression edited from a generated one keeps its original level and borrowing setting in its
  file, where `origin.made` is `edited`. The tab reported this as "generated, then edited" until
  2026-09-23, when the line was dropped.
- Applying an edit stops playback and resets the play count.
- Apply with an empty measure moves focus to that measure and says why, rather than disabling the
  button without explanation.
- Ctrl+S saves and Ctrl+Shift+S saves as, named on the buttons with `aria-keyshortcuts`.

## Changes after Joel tried it

- **Buttons read together.** Ctrl+Down onto a row of buttons read every label. See
  `screen-reader-findings.md`. Fixed for every button group in the app.
- **The chord field starts empty** each time a measure is chosen, with the measure's current chord
  in the field's label instead ("Chord for measure 3, now F"). An empty field now means "leave the
  chord as it is".
- **Enter on a chosen chord** takes it and returns focus to that measure in the list, whether it
  was typed or picked with the arrows.
- **The keyboard notes for the measures list** were a description on the list, read on every visit.
  They are now a collapsed disclosure between the Measures heading and the list.
- **The chord field and "How the chord field works"** share one row; the measure buttons are on
  the next row, Apply and Cancel on the last.
- **The editor's status line** empties itself four seconds after each message, so it is heard when
  something happens and not met again when reading down the dialog.
- **The disclosure is named "Keyboard commands for the measures list"** (2026-09-23), not
  "Keyboard notes".
- **No "Made" line in the tab's metadata** (2026-09-23). How a progression was made is still kept
  in its file. The saved line reads "Not saved" until it is saved, then "Saved as - " and the name.
- **Typing in the chord field still opens the list** as it did. A change to open it only on Down
  was made and reverted on 2026-09-23; see `screen-reader-findings.md`.
- **Default file name** follows the pattern key, measures, level, borrowing: for example
  `Am-60-intermediate-occasional`. The key is written as its chord, so A minor is `Am`. A hand-made
  progression ends in `hand` instead: `Am-8-hand`.

## Open items as of 2026-09-20

- Joel has not yet confirmed any of this with NVDA in real use.
- Save As on a progression already saved offers its current name, not the pattern. Changing that
  is one line if wanted.
- In Settings, Files, the default Open folder's Browse button still shares a paragraph with its
  field. It is a single button, so it was left alone.
- `README.md` got a short paragraph about saved progressions on 2026-09-23, written to match Joel's
  own style since the rest of it is his writing.
- The file format is version 1. `parseSavedProgression` refuses a higher version with "saved by a
  newer version of Unstrung", so the format can grow later.

## Where it lives in the code

- `src/shared/savedProgressions.mjs`: the file format, parsing with plain-language errors, and
  which chords belong to a key.
- `src/main/main.js`: the progressions folder, listing, reading and saving files, the quit check.
- `src/renderer/renderer.js`: the chord practice tab, the open dialog, the editor, the unsaved
  changes dialog.
- `scripts/progressions/verify-saved-progressions.mjs`: Playwright checks, run against a scratch
  profile through the `UNSTRUNG_TEST_PROFILE` environment variable so they never touch the real
  Documents folder.
