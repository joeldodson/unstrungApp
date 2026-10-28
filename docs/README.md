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
- `chord-forms-in-scores.md` -- chords in measure headings. Since 2026-10-26 only the chords the
  file prints, a beat named as a chord only at three different notes or more, and a Chord Symbols
  list with the file's own diagrams. Before that, from 2026-10-20: chord forms, the shape the left
  hand holds, worked out from the notes with exceptions and anomalies, and why it was dropped.
  Also listing only guitar and bass tracks.
- `chord-forms-workflow.md` -- retired 2026-10-26 with chord forms: how songs were checked
  against the record of every song while the rules were changing.

- `measure-practice.md` -- one region per track for the measures and playback, with Play and Add
  buttons on each measure, so a song can be learned a measure at a time; and the Chord Symbols in
  the track's details. Decided and built 2026-10-27, with the assumptions made while building.
- `note-timing.md` -- why notes sounded behind the metronome's clicks (the pick noise at the start
  of every recording), measured for every recording, and starting each note early by its attack.
  Built 2026-10-22.

Older findings live next to the scripts they came from: `scripts/sampleNotes.md`,
`scripts/gp-experiment/gpParsingFindings.md` and `scripts/gp-experiment/songsterrCorpusReview.md`.
