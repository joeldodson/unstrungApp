# Design notes

Records of design discussions and investigations, kept so the reasoning survives. Nothing here is
user documentation; that is `user-docs/`, which is the in-app Help and the documentation on
eyesunstrung.vip.

- `saved-progressions-design.md` -- saving, opening, editing and creating chord progressions, and
  why the seed was removed. Built in 0.5.0.
- `screen-reader-findings.md` -- how NVDA reads parts of Unstrung, and the fixes that came from it.
- `web-deployment-and-guitar-input.md` -- running Unstrung in a browser, sample size and
  compression, SoundFonts, and a plan for a tuner, timing feedback and chord checking. Not built.
- `browser-parity-layout.md` -- replacing tabs and the native menu with a left column of open
  items and a page menu, so the desktop app and a browser version work the same way. Built in
  0.6.0.
- `eyesunstrung-site-and-web-app.md` -- rebuilding eyesunstrung.vip with Eleventy and serving the
  web version of Unstrung from it at `/unstrung/app/`, and the documentation pages built from
  `user-docs/`.
- `release-notes-history.md` -- the notes for every release, newest first, including those whose
  GitHub releases were deleted. A copy of each new release's notes is added at the top.
- `js-synthesizer-investigation.md` -- FluidSynth in WebAssembly as an audio engine. Studied and set
  aside.
- `media-session-experiment.md` -- headphone, lock-screen and media-key control of playback through
  the Media Session API, above all AirPods on iOS. Built in 0.7.2 to 0.7.5, with the phone tests
  that shaped it.
- `held-chords.md` -- where generated progressions hold a chord over, and the option, on by
  default, for a change of chord on every measure.
- `strumming-patterns-and-metronome.md` -- a slot grid shared by strumming patterns and a
  configurable metronome, and alphaTab's score, saved as alphaTex, as the model for songs and
  chord progressions. Partly built: alphaTex files, built-in and your own strumming patterns
  (0.8.0), and the Metronome item, clicking in the rhythm of a pattern.
- `speak-the-notes.md` -- speaking each note or chord just before it sounds, so a song can be
  learned by ear, and why pitching the speech needs platform code. Built on a branch, measured and
  set aside; the branch was deleted 2026-10-19.

Older findings live next to the scripts they came from: `scripts/sampleNotes.md`,
`scripts/gp-experiment/gpParsingFindings.md` and `scripts/gp-experiment/songsterrCorpusReview.md`.
