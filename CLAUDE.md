# Working with this user

The user is totally blind and uses a screen reader (NVDA) to operate this
app. Keep this in mind for every session on this project:

- **Do not take screenshots to verify UI work.** The user cannot see them,
  and generating/reviewing screenshots as an intermediate verification step
  wastes time and tokens. Screenshots only matter if the user explicitly
  asks for one (e.g. to share with a sighted collaborator).
- **Do not treat visual/screenshot inspection as the verification step for
  this app.** Verify behavior through other means: automated/driver
  scripts (e.g. Playwright driving the Electron app and asserting on DOM
  state, ARIA attributes, focus, and text content), unit-style checks of
  parsing logic, and reading the rendered accessibility tree/text rather
  than pixels.
- When a change is ready, the user will run the app themselves with their
  screen reader to confirm the actual experience (keyboard behavior,
  announcements, focus order, etc.). Don't claim screen-reader behavior is
  "verified" — only the user can confirm that; describe what you tested
  and be explicit about what still needs their hands-on check.
- Prioritize semantic HTML, correct ARIA roles/states, and keyboard
  operability over visual styling. Visual polish is a low priority for
  this project.

# Keeping a web version possible

Unstrung may one day run in a browser as well as, or instead of, Electron.
Nearly all of it already could. Keep it that way:

- **Logic goes in `src/shared`**: parsing, music theory, generators, file
  formats, audio analysis. No DOM, no Node, no Electron there. Nothing in
  it references `document`, `window`, `require` or `node:` today.
- **The renderer reaches the platform only through `window.unstrung`**,
  the object `src/main/preload.js` exposes. A web build would supply a
  second implementation of it. Do not reach around it.
- **New features should not depend on Electron** unless there is no
  browser equivalent. Say so when one does.

The reasoning, the blockers (sample size, reserved browser shortcuts,
background-tab timers, folder access) and a plan for guitar input and
analysis are in `docs/web-deployment-and-guitar-input.md`.

# Design notes

`docs/` holds records of design discussions and investigations; its
`README.md` lists them. Read the relevant one before reopening a topic it
covers, and add to it when a discussion settles something. Joel uses the
repository as a backup, so anything worth keeping belongs there rather
than only in memory or on this machine. `docs/screen-reader-findings.md`
in particular records how NVDA reads this app.

# User documentation

`user-docs/` holds documentation for people using unstrung, as opposed to
the design notes in `docs/`. `user-docs/features.md` is shown in the app
under Help, unstrung Features (built in by `scripts/build-help.mjs`), and
is meant for eyesunstrung.vip/unstrung/docs/ as well. Its sections start
at level 2, since both places supply the level 1 title. When a feature is
added or changed, update it in the same change. Joel writes `README.md`
himself and keeps it high level.

# Releases

Every release's notes are kept in `docs/release-notes-history.md`, newest
first, because GitHub releases can be deleted and the notes go with them.
When publishing a release, add a copy of its notes at the top of that
file, under a level 2 heading with the release's title and the date it
was published, its own sections moved down to level 3. Commit that with
the release.

A release has three assets: `npm run dist` makes the installer and the
portable build in `release/`, and `npm run build:web` makes
`release/Unstrung-web-<version>.tar.gz`, the web version that
eyesunstrung.vip serves at `/unstrung/app/`. Attach all three. See
`docs/eyesunstrung-site-and-web-app.md`.
