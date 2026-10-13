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

## First version, 2026-10-12

Joel decided to leave the phone for now. He tests with the media keys on his laptop under Windows
and NVDA; if that works well the feature stays, is merged into main, and is tried on iOS from the
released site.

Built on the `media-session` branch, for chord progressions only, in the Media keys section of
`src/renderer/renderer.js`:

- The progression plays through Web Audio to `context.destination`, unchanged. Alongside it an
  `<audio>` element loops a silent 10 second WAV (`src/shared/silentWav.mjs`, 8 kHz 8-bit mono,
  80 KB, made in memory), playing and pausing with the progression. That element is what Windows
  sees.
- The element is started at the top of `toggleChordPracticePlayback`, before the samples load, so
  the key press or click that started playback still counts. A refused `play()` is ignored: it
  costs only the media keys.
- `setPlaying` keeps `playbackState`, the metadata and the element in step.
- When the progression's tab closes the element is emptied (`src` removed, `load()`), not just
  paused. A paused element leaves Windows holding a paused session for unstrung as its current one,
  so the keys would go to unstrung, which no longer answers them, instead of Spotify or whatever
  else is playing. The next play makes a new element.
- nexttrack goes back to the start of the current measure (downArrow), and previoustrack restarts
  the progression (upArrow); seekforward and seekbackward do the same. Joel's decision: on AirPods
  a double or triple press has no direction, unlike arrow keys either side of a play button, and
  moving on to the next measure has no use in practice. The keyboard's next and previous keys read
  oddly this way, which he accepted.
- A key acts on the progression playing; otherwise the one in front; otherwise the one last
  played, if its tab is open. Closing that tab, or editing the progression, clears the handlers,
  the metadata and `playbackState`.

### Audio tracks too (2026-10-12)

Joel asked for the same keys on a song's audio track before the first release, on the assumption
that it will work on iOS too. The section now has a kind for each (`MEDIA_SESSION_KINDS`): next
is `seekToStartOfCurrentMeasure`, previous is `restartAudioTrackSelection`, and the title is the
song's title and the track's name ("Ripple - Acoustic Lead"). Only an expanded, created track
counts, as for its keys. The keys belong to whichever played last; closing the song releases them.
The section moved out of the chord practice code to its own place after it.

### First phone test, 0.7.2 (2026-10-12)

Joel tried 0.7.2 in Chrome on his iPhone with AirPods, with Overcast also in use.

- The keys reached the page: single, double and triple presses did what they should while the
  progression played, and single presses paused and resumed it.
- Once, the first press after a pause started the podcast in Overcast instead. Later presses
  toggled the progression correctly. Not explained; watch for it again.
- After Overcast had played, the progression was silent. The page's state followed every press
  ("Paused at measure 1." was spoken) but nothing was heard, through new progressions and
  regenerated audio too, until the phone was locked and woken. Cause: WebKit puts the context in
  an "interrupted" state when another app takes the audio, and unstrung resumed only from
  "suspended".
- Locking the phone stopped the progression, where Overcast keeps playing. On waking, the
  progression started again by itself: the lock had interrupted the context, freezing its clock
  with notes scheduled, the page still thought it was playing, and WebKit resumed the context on
  wake.

Changes in 0.7.3, decided with Joel:

- `audioContextNeedsResume` resumes from any state but running and closed, wherever a context is
  resumed.
- `navigator.audioSession.type = 'playback'`, where it exists, set before the shared context is
  made. The hope is that it keeps playback going with the screen locked; unknown until tried.
  Playwright's WebKit on Windows has neither `audioSession` nor `mediaSession`, so it cannot say.
- The Interruptions section: a `statechange` on the shared context to anything but running pauses
  whatever is playing, as the pause key would. If the context then returns to running by itself,
  what was paused starts again. Joel's reasoning: Overcast pauses for a call and carries on after
  it, and unstrung may do the same. Another app taking the audio leaves the context interrupted, so
  it stays paused until play is pressed. Anything starting clears what is waiting to resume.
  The test imitates an interruption by suspending the context and resuming it.

If the screen locking still stops playback, the remaining way is the fallback named above: render
the progression or track to a file and play that through the media element, as a podcast plays.

### Second phone test, 0.7.3 (2026-10-12)

- Overcast starting paused the progression, and play in Chrome brought it back and stopped the
  podcast. The interrupted-state fix works.
- With the progression playing, locking the phone did not stop it, and it was still playing on
  unlocking. `navigator.audioSession.type = 'playback'` works.
- Playing, locked, paused with the AirPods, unlocked: the controls worked and it played again.
- Paused, then locked, with nothing pressed, then unlocked: nothing would play again, through new
  progressions too, until Chrome was restarted. The same followed a press on the AirPods while
  locked and paused, which also did nothing. Overcast starts from the lock screen in that case;
  a web page apparently cannot.

So what breaks is the context losing the audio while nothing plays. Which state it is left in is
not known, and it may even report itself running.

Changes in 0.7.4:

- The shared context is marked suspect when the page is hidden with nothing playing, when it
  stops running with nothing playing, or when a start is refused. The next request for it, with
  nothing playing, closes it and makes a new one (`replaceSharedAudioContext`), which is what
  restarting Chrome amounted to. Decoded `AudioBuffer`s are not tied to a context and carry over.
  An interruption during playback, as for a call, keeps the context, so it can carry on by itself.
- `confirmAudioStarted`: one second after something starts, if the context is not running,
  playback goes back to paused and says "The sound could not start. Press play to try again.", and
  the context is marked suspect.
- The test imitates a refused start with a context that reports itself suspended, ignores resume
  and never fires a state change.

Known gap: if a refused start on the phone does fire a state change, it is taken for an
interruption during playback, which does not mark the context suspect. The next play resumes the
old context; if that stays stuck, the start check marks it, and the play after that replaces it.

### Third phone test, 0.7.4 (2026-10-12)

- Paused, locked, unlocked, play: plays. Fixed.
- Paused, locked, AirPods pressed, unlocked: the progression played at once on unlocking. Most
  likely the press started it with a new context, iOS held the page's timers while locked so the
  start check never ran, and the context was allowed to run on unlocking. Joel finds it acceptable.
- Playing, locked: every AirPods action works while locked (pause, resume, start of measure, start
  of progression). With something playing, iOS keeps the page running.
- Playing, Overcast started: the progression paused. Back in Chrome with the podcast still
  playing, the first play said "Paused at measure n" and went straight back to Play; the second
  play worked. Not the refused start, which would have said so: the context passed through a
  stopped state on its way back to running, and that was read as a fresh interruption.

Change in 0.7.5: for one second after something starts (`audioStartDeadline`), a change of the
context to anything but running is taken as part of the start. The context is asked to resume
again, and the start check decides at the end of the second whether it worked. The cost: a real
interruption in that second is reported as "The sound could not start" rather than paused for.

### Fourth phone test, 0.7.5 (2026-10-12), and where it was left

Taking the sound back from a playing Overcast still needs two presses: the first says "Paused at
measure n" and returns to Play, the second plays. The button is right each time. Joel is content
to leave it; everything else works.

What the message shows: it comes only from the progression's pause. The start check did not fire
("The sound could not start" was not said), so the context was running a second after play, and
was stopped after the one-second window. Either iOS takes the audio from Overcast in more than one
step and the later one comes after the window, or starting the silent media element makes iOS send
the page a pause action. To tell them apart, a build could word the pause differently for each
cause (interruption, pause action). Lengthening `AUDIO_START_SECONDS` would help only with the
first.

### Media stream routing did not work in Electron

The first version routed the progression's master gain into a `MediaStreamAudioDestinationNode`
and played that stream in the `<audio>` element, as the workaround above proposes. The page side
was right (`playbackState` "playing", metadata set), but Joel's keys did nothing: they went to
Spotify. Windows' list of media sessions showed Spotify only, while the progression played.
Chromium does not give a media session to an element playing a media stream (it is treated like a
call, not something to control). The same element playing an ordinary WAV, audible or silent,
appeared at once as `electron.exe`, became Windows' current session, and passed play/pause to the
page's handler. Whether Safari on iOS treats a silent element the same way is still unknown.

### Testing through Windows

`scripts/progressions/list-media-sessions.ps1` lists the sessions Windows holds (the apps the media
keys can reach) and can send one PlayPause, Next or Previous, which is what Windows does when the
key is pressed and that session is the one it picks. It runs under Windows PowerShell 5.1, which
can await WinRT calls.

`scripts/progressions/verify-media-session.mjs` uses it to drive play/pause, next and previous
through Windows, and calls the handlers Windows has no command for (seek pair, stop) directly,
having captured them by wrapping `setActionHandler`. It checks that Windows lists the app under
the progression's name, that it is the current session, that the state follows, and that the
session is gone once the tab closes. Running from source the app is `electron.exe` to Windows; the
installed app will have its own id. The only step not covered is Windows choosing the current
session for a physical key press.

## State when this was written

- unstrungApp 0.7.1 is released; eyesunstrung.vip serves it. Both repositories clean and pushed.
- The work goes on a new branch in unstrungApp, for example `media-session`.
- Two suggested tasks were left open in the session that wrote this: updating the stale check
  scripts that still send IPC messages the in-page menu replaced, and the failing progressions-
  folder check in `verify-saved-progressions.mjs`.
