# Headphone and lock-screen controls through the Media Session API

Written 2026-10-12, at the end of a long session, as the starting point for an experiment in a new
session on its own branch. Nothing here is built.

## What Joel asked for

On his iPhone, AirPods control a podcast app: a single press on the stem plays or pauses, a double
press skips forward (30 seconds, set in the podcast app), a triple press skips back (15 seconds).
He would like the same for unstrung in a browser on iOS, above all to start and stop a chord
progression without touching the phone. The web version already works on iOS in Safari and Chrome
(fixed in 0.7.1 and on eyesunstrung.vip 2026-10-10 to 10-11).

## The API

The Media Session API (`navigator.mediaSession`) lets a page say what is playing
(`navigator.mediaSession.metadata = new MediaMetadata({ title, artist, album })`) and handle the
system's media actions with `setActionHandler(action, handler)`. Actions: `play`, `pause`, `stop`,
`nexttrack`, `previoustrack`, `seekforward`, `seekbackward`, `seekto`. The system routes headphone
buttons, the lock screen, Control Center and keyboard media keys to those handlers.

Support: Safari on iOS and macOS since 15, Chrome, Edge, Firefox, and Electron, which is Chromium.
It is a browser API, available in both the desktop and web versions, so it belongs in
`src/renderer/renderer.js` like the Web Audio code, not behind `window.unstrung`.

AirPods on iOS: a single press arrives as `play` or `pause`, a double press as `nexttrack`, a
triple press as `previoustrack`. A podcast app maps those to skipping; unstrung chooses its own
meaning. Some systems send `seekforward` and `seekbackward` instead when no track handlers exist,
so register both pairs.

## Proposed meaning in unstrung

For the chord progression in front (start here), and later the audio track in front:

- `play` / `pause`: start or stop playback, the same as spaceBar and Play Progression.
- `nexttrack` (double press): forward one measure, the same as rightArrow.
- `previoustrack` (triple press): back one measure, the same as leftArrow. Restarting the
  progression is the alternative; to decide with Joel.
- `seekforward` / `seekbackward`: the same as next and previous.
- Metadata: title the item's name ("Practice - C major"), artist "unstrung".
- Clear the handlers and metadata when nothing is playing or the item closes, so the lock screen
  does not offer controls for something gone.

The existing actions to call are already there: `toggleChordPracticePlayback`,
`seekChordPracticeByMeasure` and `CHORD_PRACTICE_SHORTCUTS` for progressions;
`toggleAudioTrackPlayback` and `AUDIO_TRACK_SHORTCUTS` for audio tracks; `activeChordPracticeState`
and `activeAudioTrackState` find the one in front.

## The complication: Web Audio is not "playing" to iOS

unstrung plays through the Web Audio API: strums, metronome and spoken names are scheduled live.
Each playback path connects a master gain to `context.destination` (in `renderer.js`: guitar
samples, chord library, audio track, and chord practice, `chordPracticeMasterGain.connect(...)`).

As far as is known, Safari on iOS puts a page in Now Playing, where headphone presses reach it, only
when audio comes through an `HTMLMediaElement` (`<audio>` or `<video>`). Web Audio alone may never
qualify, so the handlers would be registered and never called. Not verified; that is the first
thing the experiment has to find out.

The usual workaround: route the output into a media element.

```js
const streamOut = context.createMediaStreamDestination();
masterGain.connect(streamOut);            // instead of context.destination
audioElement.srcObject = streamOut.stream;
audioElement.play();                      // from the user's click or key press
```

Unknowns, to try in order:

1. Does iOS show the page in Now Playing and deliver `play`/`pause` from AirPods with this routing?
2. Does it add latency, or change the sound? (Desktop: probably not noticeably.)
3. Does `pause` from the headphones arrive while the screen is locked, and does iOS suspend the
   page's audio when the screen locks or the app is switched? A fallback is an `<audio>` element
   playing a pre-rendered WAV of the progression, but repeats, tempo and the metronome change live,
   so that is a bigger change.
4. Chrome on iOS is the same engine, so it should match Safari; check both.

## Testing

- **Desktop first.** In the Electron app and in Edge the same code makes the keyboard's play/pause
  key and Bluetooth headphone buttons on Windows work. Playwright cannot press media keys; a test
  can capture the handlers by wrapping `navigator.mediaSession.setActionHandler` in an init script
  and calling them, and check `navigator.mediaSession.playbackState` and the metadata.
- **WebKit.** Playwright's WebKit is installed (2026-10-11, `npx playwright-core install webkit`)
  and is the engine of Safari. It runs the page code, but it has no AirPods, lock screen or Now
  Playing, so it cannot answer the iOS questions.
- **iOS needs Joel's phone, and a way to reach the build.** The site serves only the latest
  release, so a branch is not on eyesunstrung.vip. Options to decide at the start:
  - a release (simple, but every try is a release);
  - the phone reaching the dev server on the local network. `npm run serve:web` listens on
    localhost; it would need to listen on the LAN. Over plain http on an IP address the page is not
    a secure context, and some APIs (the clipboard, possibly Media Session) need one, so this may
    need https or a tunnel;
  - a separate preview deployment.

## State when this was written

- unstrungApp 0.7.1 is released; eyesunstrung.vip serves it. Both repositories clean and pushed.
- The work goes on a new branch in unstrungApp, for example `media-session`.
- Two suggested tasks were left open in the session that wrote this: updating the stale check
  scripts that still send IPC messages the in-page menu replaced, and the failing progressions-
  folder check in `verify-saved-progressions.mjs`.
