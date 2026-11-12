# Removing the musicfiles folder

Notes from 2026-11-11. Nothing is changed yet.

## What Joel wants

To remove `musicfiles/` from the unstrungApp folder.
It is ignored by git, and every file in it is also in the OneDrive Guitar folder.
The plan is to keep all song files in the Guitar folder and point unstrungApp at it for examples, analysis and testing.

## What depends on musicfiles today

Found by searching the repository for `musicfiles` on 2026-11-11.
34 scripts name the folder directly.
Removing it as things stand would break them.

### Does not depend on it

- `npm test`: its 13 checks build their own scores.
- `npm run test:songs -- <folder>`: the folder is given on the command line, so the Guitar folder works today.
- The Electron scripts added with the November review fixes, which use a short song written in the script.

### App-driving scripts that would break

These open a file from `musicfiles` with the path written in:

- `scripts/progressions/verify-audio-track.mjs`
- `scripts/progressions/verify-button-rows.mjs`, which uses `Ripple.gp5`
- `scripts/progressions/verify-loop-and-range.mjs`
- `scripts/progressions/verify-media-session.mjs`
- `scripts/progressions/verify-repeat-count-reset.mjs`
- `scripts/progressions/verify-section-headings.mjs`
- `scripts/progressions/verify-track-start-measure.mjs`
- `scripts/progressions/verify-window-title.mjs`
- `scripts/progressions/audit-form-labels.mjs`
- `scripts/songs/verify-chord-symbols-in-app.mjs`

### App-driving scripts that only default to it

These take a song as an argument and fall back to Ripple in `musicfiles`.
They work if given a path:

- `scripts/songs/verify-measure-practice.mjs`
- `scripts/songs/verify-guitar-bass-tracks.mjs`
- `scripts/progressions/verify-count-in-beats.mjs`

### Investigation scripts that would break

These are in `scripts/gp-experiment/` and read `musicfiles` by a relative path.
They are one-off studies, not checks, and `checks.md` already lists them as tied to that folder.

- `alphatab-midi-spread.mjs`
- `capo-check.mjs`
- `chord-diagrams.mjs`
- `compare-orders.mjs`
- `cross-tab.mjs`
- `dump-strokes.mjs`
- `find-brushes.mjs`
- `gpx-order-sequence.mjs`
- `string-set-alternation.mjs`
- `verify-brush-timing.mjs`
- `verify-descriptions.mjs`
- `verify-sweep.mjs`
- `what-unstrung-says.mjs`

`dump-annotations.mjs` and `heading-vs-beat.mjs` only show `musicfiles` in their usage line and take the file as an argument.

### Documents that mention it

- `docs/checks.md`, lines 36 and 84.
- `docs/chord-forms-workflow.md`, line 39.
- `scripts/gp-experiment/gpParsingFindings.md`.
- `.gitignore`, line 148, which can go with the folder.
- The two November review documents mention it as a record of what was done, and should stay as they are.

## The files the scripts ask for by name

- `Grateful Dead-Ripple-12-20-2025.gp`
- `Ripple.gp5`
- `Ripple Chord Solo.gp5`
- `Ripple Chord Solo.gpx`

All four names are under the Guitar folder.
`Ripple.gp5` and the two Chord Solo files each appear there twice, in different subfolders.
The copies have not been compared byte for byte with the ones in `musicfiles`.
Do that before deleting, so it is known the delete loses nothing.

## Suggested change

Give the scripts one place to find song files.

- A helper in `scripts/lib/` reads the folder from an environment variable, say `UNSTRUNG_SONGS`.
- It searches that folder and its subfolders for a file by name, and says plainly when the variable is not set or the file is not found.
- Where a name is found more than once, it should say so, or take the first in a fixed order.
- The scripts above use the helper in place of the written-in path.
- `npm run test:songs` could read the same variable when no folder is given.

This keeps the Guitar folder's path out of the repository.
That matters because the song files are licensed to Joel alone and stay outside it.

## Order of work, when picked up

1. Compare the four files in `musicfiles` with their copies in the Guitar folder.
2. Write the helper and set the variable on this machine.
3. Change the app-driving scripts, then run each to see it still passes.
4. Change the investigation scripts, or leave them and note in `checks.md` that they need the variable.
5. Update `checks.md` and `chord-forms-workflow.md`.
6. Delete `musicfiles/` and its line in `.gitignore`.
