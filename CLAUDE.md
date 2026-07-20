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
