# Checks

The scripts under `scripts/` that check unstrung, and which of them `npm test` runs.
Added on 2026-11-11, after the November review's findings were fixed, so that they stay fixed.

## npm test

`npm test` runs `scripts/run-checks.mjs`.
It runs every `scripts/**/check-*.mjs` and `scripts/gp-experiment/verify-synthetic-score.mjs` with Node, several at once.
None of them starts the app or a browser, and none reads a song file.
It prints one line per script, ok, FAIL or skip, with its time, then a total, and exits with 1 if any failed.
Under a script that failed it prints that script's FAIL lines, or its last lines when it printed none.
A new `check-*.mjs` anywhere under `scripts/` is picked up without changing the runner.

On 2026-11-11 it ran 13 scripts and skipped 2, all passing, in 5.5 seconds.
`check-no-held-chords.mjs` is most of that time.

## Song files

The song files are licensed and are kept outside the repository, so no check names one.
Seven checks read every Guitar Pro file under folders given to them:

- `scripts/songs/check-key-names.mjs`
- `scripts/songs/check-pickup-clicks.mjs`
- `scripts/songs/check-plays-as-written.mjs`
- `scripts/songs/check-track-listing.mjs`
- `scripts/songs/check-triplet-feel.mjs`
- `scripts/gp-experiment/check-section-promotion.mjs`
- `scripts/progressions/check-first-sounding-bar.mjs`

The first five check scores built in the script as well, and `npm test` runs them without folders.
The last two have nothing to check without song files, so `npm test` skips them.
`check-section-promotion.mjs` is a report: it lists what it did and fails only if it cannot read a file.

`npm run test:songs -- <folder> [more folders]` runs every check, giving the folders to all seven.
Over the `musicfiles` folder on 2026-11-11 all 15 passed in 6.9 seconds.

## Not in npm test

These drive the Electron app with Playwright, so they need a display, take longer, and some need a song file or the packaged app.
Run each with `node <script>`; the comment at the top of each says what it takes.

- `scripts/accessibility/verify-dialog-descriptions.mjs`
- `scripts/audio/verify-note-timing.mjs`
- `scripts/progressions/verify-audio-track.mjs`
- `scripts/progressions/verify-big-progressions-folder.mjs`
- `scripts/progressions/verify-button-rows.mjs`
- `scripts/progressions/verify-chord-playback-list.mjs`
- `scripts/progressions/verify-chord-practice.mjs`
- `scripts/progressions/verify-chord-search-selection.mjs`
- `scripts/progressions/verify-chord-tools.mjs`
- `scripts/progressions/verify-count-in-beats.mjs`
- `scripts/progressions/verify-editor-quit.mjs`
- `scripts/progressions/verify-frets-to-library.mjs`
- `scripts/progressions/verify-hung-page-quit.mjs`
- `scripts/progressions/verify-loop-and-range.mjs`
- `scripts/progressions/verify-measure-chords.mjs`
- `scripts/progressions/verify-media-session.mjs`
- `scripts/progressions/verify-no-held-chords.mjs`
- `scripts/progressions/verify-repeat-count-reset.mjs`
- `scripts/progressions/verify-sample-range.mjs`
- `scripts/progressions/verify-saved-progressions.mjs`
- `scripts/progressions/verify-section-headings.mjs`
- `scripts/progressions/verify-spinner-keys.mjs`
- `scripts/progressions/verify-track-start-measure.mjs`
- `scripts/progressions/verify-window-title.mjs`
- `scripts/settings/verify-default-folder-field.mjs`
- `scripts/settings/verify-strum-spacing.mjs`
- `scripts/songs/verify-accents.mjs`
- `scripts/songs/verify-chord-symbols-in-app.mjs`
- `scripts/songs/verify-dead-notes.mjs`
- `scripts/songs/verify-guitar-bass-tracks.mjs`
- `scripts/songs/verify-keys-stay-in-item.mjs`
- `scripts/songs/verify-measure-practice.mjs`
- `scripts/songs/verify-progression-files.mjs`
- `scripts/songs/verify-song-speech.mjs`
- `scripts/songs/verify-strumming-patterns.mjs`
- `scripts/songs/verify-swing.mjs`
- `scripts/songs/verify-times-and-loop.mjs`
- `scripts/songs/verify-transports.mjs`
- `scripts/speech/verify-chord-voice-settings.mjs`
- `scripts/speech/verify-prerendered-speech.mjs`, against the packaged app

These drive the web version in Edge, after `npm run build:web` and `npm run serve:web`.
The first two drive the Electron app instead when not given `--web` and an address:

- `scripts/audio/verify-chord-sample-cache.mjs`
- `scripts/metronome/verify-metronome.mjs`
- `scripts/web/verify-failed-fetch-retry.mjs`, the web version only

This one is Node only and reads the bundled guitar samples, but is a report rather than a check:

- `scripts/audio/report-progression-levels.mjs`, how loud a progression is on the audio track player against chord practice's player

These are Node only but read particular files from the `musicfiles` folder, which is not in the repository, so they cannot run anywhere else:

- `scripts/gp-experiment/verify-brush-timing.mjs`
- `scripts/gp-experiment/verify-descriptions.mjs`
- `scripts/gp-experiment/verify-sweep.mjs`
