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
- **No native menu.** `Menu.setApplicationMenu(null)`. A Menu button at the top of the left column
  opens a real menu, with submenus: Open File, Recent Files (submenu), Chord Progressions (submenu:
  Generate Practice Progression, Manually Create Chord Progression, Open Saved Progression), Chords
  (submenu: Chord Library, Frets to Chord, Listen to Guitar Samples), Settings, Help (submenu).
  See "The menu" below for how it was chosen and how it behaves.
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
- **Dialogs say they are dialogs.** Joel lost track of being in the Edit Progression dialog: heading
  navigation found nothing outside it, and the window title still named the item behind it. Now
  every dialog starts with an `h1` ending in "Dialog Box", such as "Creating Chord Progression
  Dialog Box". The dialog's accessible name is the part before "Dialog Box", so NVDA does not say
  "dialog" twice on entering it. Sections inside a dialog are `h2`, the Help documents included.
  While a dialog is open the window title names it, "Unstrung - Creating Chord Progression
  dialog", and goes back to the current item when it closes. The editor is titled Editing Chord
  Progression or Creating Chord Progression.
- **Firefox and Safari are out of scope.** Chromium only, which includes Electron.

## The menu

Decided 2026-10-02. The first version was a disclosure holding nested disclosures and buttons. In
NVDA it behaved like part of the page, not like a menu:

- Down arrow walked out of a group, into the next group and on past the menu, because in browse
  mode NVDA keeps the arrow keys for its own cursor. Several groups could be left open at once.
- Escape could leave NVDA's cursor inside a collapsed group. Arrowing in browse mode moves only
  NVDA's cursor, so focus stayed on the group's summary; focusing it again changed nothing NVDA
  could hear. A blur and refocus 100 ms apart was tried and did not settle it.

No script on buttons and disclosures can change the first point. What does is the role: on
reaching `role="menu"`, NVDA switches to focus mode by itself, so the arrows come to the page.

Options weighed:

- **A menu button with a menu and submenus.** Chosen.
- **A menu bar** (File, Chord Progressions, Chords, Help across the top). The most desktop-like,
  and what eyesunstrung.vip uses, which is the right choice for a website. Rejected for Unstrung
  because the web version will be served inside eyesunstrung.vip, and two menu bars on one page
  would be odd. It shares nearly all its code with a menu button, so the door stays open.
- **The disclosures plus script.** Cannot keep the arrows inside in browse mode. Rejected.
- **A tree.** Confines the arrows, but says "tree" and "expanded", not "menu" and "submenu".
  Rejected.

How it behaves, following the ARIA Authoring Practices Guide's menu button pattern. The code is
`src/renderer/menu.js`; `renderer.js` only maps each item's `data-command` to what it does.

- Enter, Space or Down on the button opens the menu on its first item; Up opens it on its last.
- Up and Down move within the current menu only, and loop at either end, as Windows menus do.
  Home and End go to the first and last item. A letter goes to the next item starting with it.
- Right, Enter or Space on an item with a submenu opens it on its first item. Left in a submenu
  closes it and returns to the item that opened it. Right on any other item does nothing.
- Escape closes the current submenu, or at the top level the whole menu, returning focus to
  whatever opened it.
- Enter or Space on a command closes the menu, puts focus on the Menu button, then runs the
  command, so a dialog it opens returns focus to the button.
- Tab closes the menu and moves to the next thing after it; Shift+Tab closes it onto the button.
  Focus leaving by any route, or a click outside, closes it.
- Focus moves from item to item, so NVDA's focus and cursor never part. Only one chain of menus is
  open, and closed menus are hidden, so out of the accessibility tree.
- Items with a submenu carry `aria-haspopup="menu"`, which NVDA reads as "submenu", and no
  `aria-expanded`, so it does not say "collapsed". The Menu button does carry `aria-expanded`.
- Keys used by the menu do not reach the page's own shortcuts, so Space in the menu never pauses
  playback.
- Open File and Open Saved Progression carry `aria-keyshortcuts`. Whether NVDA reads it on a menu
  item is untested; if not, the shortcut goes into the item's text.
- Visually the menu drops down over the main area and submenus open to the right. The left column
  no longer scrolls as a whole, since that would clip the menu; the list of open items scrolls on
  its own.

## Still to do

- `README.md`, and so the in-app Help, still describes the File menu, tabs and Ctrl+T. To be
  rewritten once the layout settles.
- The Settings dialog keeps its own tab list (General, Files, Screen Reader). It uses no reserved
  keys and works in a browser, so it was left alone.
