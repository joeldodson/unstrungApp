# One layout for the desktop app and the browser

Written 2026-10-01 from a discussion with Joel. Work happens on the `web-based-unstrung` branch, in
Electron first. The companion notes are `web-deployment-and-guitar-input.md` (samples, timers,
storage, guitar input) and `eyesunstrung-site-and-web-app.md` (hosting the web app on the site).

## The problem

Several things the desktop app did cannot be done by a page in Chrome:

- **Keys the browser keeps.** Chrome acts on Ctrl+T, Ctrl+W, Ctrl+N, Ctrl+Tab, Ctrl+Shift+Tab,
  Ctrl+Page Up and Ctrl+Page Down (and the Shift forms of T, W and N) before the page sees them.
  Unstrung used Ctrl+T to open a file, Ctrl+W to close a tab and Ctrl+Tab to move between tabs.
- **No menu bar.** A page has no native menu, and Alt goes to Chrome's own menu.
- **"Tab" means two things.** Unstrung's tabs would sit inside a browser tab, and "Close Tab" or
  NVDA's "tab, 2 of 4" would describe either.
- **Files and folders.** No typed paths, no Open Folder, permission asked again each session. See
  the companion note.
- **Leaving.** Back, reload and closing the browser tab all discard every open file, and
  `beforeunload` only offers Chrome's generic prompt.

The aim is one interface that works the same in both, built in Electron first so Joel uses it
daily before any web build exists.

## Decisions

- **No accordion.** Joel's experience of accordions on websites is uniformly bad. Ruled out.
- **Two columns below the banner.** The left column, about a fifth of the width, holds the menu
  and the list of open items, newest first. The right column shows one item at a time and fills the
  height between the banner and a status bar along the bottom. Each column scrolls on its own.
- **Open items are headings holding buttons.** Each is an `h1` containing a button, then a Close
  button. They are `h1` so an item's own content can start at `h2` without its headings mixing with
  the list's, and keep every level below that. There is no `h1` for the application's name and no
  skip link: Unstrung is an application, not a web page, and Ctrl+Home reaches the top of it. Pressing the item's button shows it on the right and moves focus to the top of its
  content. The button carries `aria-current="true"` on the item being shown, not `aria-expanded`:
  it never hides anything, so there is no collapsed state to report. NVDA's heading navigation
  moves between open items in browse mode, in Electron and in a browser alike.
- **Closing** is the Close button beside each item. Focus goes to the item that takes its place in
  the list, which is then shown. No shortcut for now.
- **No native menu.** `Menu.setApplicationMenu(null)`. One disclosure, Menu, at the top of the left
  column, with nested disclosures for groups: Open File (the Open File button and the recent
  files), Chord Progressions (Generate Practice Progression, Manually Create Chord Progression, Open
  Saved Progression), Chords (library, frets to chord,
  guitar samples), Settings, and Help. Buttons and `<details>`, not an ARIA menu. Escape closes the
  innermost open group and returns focus to its summary. The summary is blurred first if it
  already has focus: arrowing in NVDA's browse mode moves only NVDA's cursor, so the summary can
  still hold focus while that cursor is several lines into the group, and focusing it again would
  fire nothing and leave the cursor inside a collapsed group. Choosing a command closes the menu and
  puts focus on the Menu summary, so a dialog the command opens returns focus there.
- **Shortcuts that work in both:** Ctrl+O opens a file, Ctrl+Shift+O opens a saved progression,
  Ctrl+S and Ctrl+Shift+S save a progression. Ctrl+T, Ctrl+W and Ctrl+Tab are retired.
- **The audio track lives in its track.** The Create Audio Track button became a disclosure at the
  end of each track's section, "Audio track for" and the track name. Its content is built the first
  time it is opened and starts with an `h4` of the same name, so the previous heading and one line
  up reach the summary to collapse it. Its own headings are `h5`. **Collapsing it stops it**, keeping the
  position, and expanding it again does not start it; Play Track carries on from where it stopped.
  That includes the collapse done on showing another open item. Playback keys act only on an
  expanded audio track of the song being shown: the one holding focus, or else the one last used.
- **The banner** is the eyesunstrung.vip banner, copied from that repository into
  `src/renderer/images/banner.svg`, linking to the site. Its height is capped at a fifth of the
  window so the columns keep most of it.
- **Firefox and Safari are out of scope.** Chromium only, which includes Electron.

## Still to do

- `README.md`, and so the in-app Help, still describes the File menu, tabs and Ctrl+T. To be
  rewritten once the layout settles.
- The Settings dialog keeps its own tab list (General, Files, Screen Reader). It uses no reserved
  keys and works in a browser, so it was left alone.
