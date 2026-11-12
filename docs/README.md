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
  list with the file's own diagrams. Since 2026-11-10 playback plays exactly the notes written,
  never filling a chord in from its name. Before that, from 2026-10-20: chord forms, the shape the left
  hand holds, worked out from the notes with exceptions and anomalies, and why it was dropped.
  Also listing only guitar and bass tracks.
- `chord-forms-workflow.md` -- retired 2026-10-26 with chord forms: how songs were checked
  against the record of every song while the rules were changing.

- `measure-practice.md` -- one region per track for the measures and playback, with Play and Add
  buttons on each measure, so a song can be learned a measure at a time; and the Chord Symbols in
  the track's details. Decided and built 2026-10-27, with the assumptions made while building.
- `chords-within-a-measure.md` -- more than one chord in a measure of a progression, typed as
  `G D C@4`; progressions kept to chords rather than grown into song editing; speaking the next
  measure, with "repeat". Decided and built 2026-10-30.
- `note-timing.md` -- why notes sounded behind the metronome's clicks (the pick noise at the start
  of every recording), measured for every recording, and starting each note early by its attack.
  Built 2026-10-22.
- `your-own-chords.md` -- adding fingerings and new chords of your own to the chord library, why
  not to send them to chords-db, and carrying them in .atex progressions with alphaTex's `lf`
  finger marks so a reader can add them. Proposed 2026-11-01, not built.
- `chord-library-maintenance.md` -- chords-db copied into unstrung's own source file and dropped as
  a dependency, then the library re-seeded from the tabsy-gr/chords-db fork with no thumb
  fingerings and our earlier shapes held for review (built 2026-11-02); what the check rejects, a
  shape checked against the name it is given, two other sources looked at and not taken, and,
  proposed, a maintainer tool for adding shipped fingerings and how your own items are handled
  when a release ships the same thing.
- `scarlett-solo-and-archtop.md` -- what every control on the Scarlett Solo 4th Gen and the
  Eastman AR905CE does and how to set them for a guitar, gain by ear without the halo, why the
  Solo's gain is analogue, Focusrite Control 2's MIDI control and mobile remote, what an
  Electron-only feature could reach, and announcing the input level from the audio. Notes from
  2026-11-08 and 2026-11-09, nothing built.
- `project-review-2026-11.md` -- a full review of 0.10.2 by Fable 5.2 on 2026-11-10: nineteen
  findings by severity, then architecture, security, build and code quality, nothing changed.
- `project-review-2026-11-assessment.md` -- each of those findings checked against the code and
  the song files the same day: all accurate, two with their intent or effect overstated, and one
  related gap in reading second voices.
- `removing-musicfiles.md` -- which scripts and documents depend on the ignored `musicfiles`
  folder, and a way to point them at a song folder outside the repository. Notes from 2026-11-11,
  nothing changed.
- `checks.md` -- `npm test` and `npm run test:songs`, which run the Node checks, and the app and
  browser drivers they leave out. Added 2026-11-11.

Older findings live next to the scripts they came from: `scripts/sampleNotes.md`,
`scripts/gp-experiment/gpParsingFindings.md` and `scripts/gp-experiment/songsterrCorpusReview.md`.
