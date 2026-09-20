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
