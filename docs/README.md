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
  items and a page menu, so the desktop app and a browser version work the same way. On the
  `web-based-unstrung` branch.
- `eyesunstrung-site-and-web-app.md` -- rebuilding eyesunstrung.vip with Eleventy and serving the
  web version of Unstrung from it at `/unstrung/app/`, and the documentation pages built from
  `user-docs/`.
- `release-notes-history.md` -- the notes for every release, newest first, including those whose
  GitHub releases were deleted. A copy of each new release's notes is added at the top.
- `js-synthesizer-investigation.md` -- FluidSynth in WebAssembly as an audio engine. Studied and set
  aside.

Older findings live next to the scripts they came from: `scripts/sampleNotes.md`,
`scripts/gp-experiment/gpParsingFindings.md` and `scripts/gp-experiment/songsterrCorpusReview.md`.
