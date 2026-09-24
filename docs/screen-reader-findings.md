# Screen reader findings

Things learned about how NVDA reads Unstrung that apply beyond the feature where they came up.
Each was reported by Joel in real use; the explanations are what the fixes were based on.

## Buttons sharing a paragraph are read as one line

Found 2026-09-19 in the chord practice tab: Ctrl+Down from the last chord onto the Edit, Save and
Save As buttons read all three labels, and the same happened under "Move around the progression".

- The buttons were not in a form, fieldset or group. They were plain buttons inside one `<p>`.
- In browse mode NVDA lays the page out as lines, and Ctrl+Down reads to the next block boundary.
  Buttons are inline, so buttons in one paragraph are one line.
- Changing `<p>` to `<div>` alone would not help: NVDA does not treat them differently here.
- **Fix:** a `div.button-row` with `display: flex`. CSS blockifies the children of a flex
  container, so Chromium reports each button as a block and NVDA gives each its own line, while on
  screen they stay side by side. Stacking them vertically would also have worked, but Joel wants
  sighted users served too, and stacking wastes space.
- In code, `createButtonRow()` in `renderer.js` makes one; in markup, use the class.
  `scripts/progressions/verify-button-rows.mjs` checks that no element holds two buttons outside a
  row. `.field-row` uses the same idea for a field and something beside it.

## A description on a control is read every time it is reached

Found 2026-09-19 in the progression editor: the measures list's keyboard notes were attached with
`aria-describedby`, so they were read on every Tab into the list. Useful once, tiring after that.
**Fix:** move notes like this into a collapsed `<details>`, placed before the control they explain.
The Settings dialog already did this for "About spoken chord volume".

## A status line that keeps its text is read again later

Found 2026-09-19 in the progression editor: a live region announcing "Measure 3 is F." kept that
text, so reading down the dialog later met a message that was out of date.
**Fix:** the editor's status line empties itself four seconds after each message. It is heard
when it is set; an empty paragraph is skipped when reading.
Also: when focus moves to something that already says the result -- returning to a measure that
now reads its new chord -- make no announcement at all, or it is said twice.

## A combo box that expands as you type: not a bug

Reported 2026-09-23 and then withdrawn. Typing F into the progression editor's chord field said
only "expanded", not F. The fix tried was to stop typing from opening the list and open it on Down
instead, in that field and in the chord library search.

The cause was Joel's NVDA setting: it echoes whole words, not single characters, so a lone letter
is never spoken whatever the page does. The change was reverted the same day. Lists that open as
you type are also more useful to sighted users, which matters to Joel too.

Before treating missing speech as a bug, check the screen reader's echo settings.

## A live region cleared and refilled in one step says nothing

Found earlier, in the chord practice transport: pressing B twice on the same measure spoke once.
Clearing a live region and setting the same text in one task is coalesced into no change.
`announceLiveRegion()` clears it, then sets the text on the next tick.
