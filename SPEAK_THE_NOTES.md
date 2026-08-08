# Speak the Notes — where this was left

Parked 2026-08-07 on branch `speakTheNotes`, two commits, **not merged**. `main` is untouched.

The idea: speak each note or chord immediately before it sounds, so a song can be learned by ear
while playing along. Not a replacement for reading the measure listings — a way to practise a song
you have already listened to a few times.

It was stopped after hearing it against real music. Nothing is broken; the tempo it allows was the
problem. Read [Was it any good?](#was-it-any-good) before deciding whether to pick it back up.

---

## Platform dependencies — the short version

**What is on this branch is fully platform independent.** No npm dependency, no bundled asset, no
platform command, no licence question. It uses the browser's own `speechSynthesis`, which Electron
provides everywhere. It will run on macOS as-is.

The only soft spot is Linux, and only because Electron there commonly reports no voices unless
`speech-dispatcher` is installed. Windows and macOS both work.

**The spoken note cannot be pitched, and that is not a coincidence.** This is the thing that is
easy to remember backwards, so it is worth being precise:

- `speechSynthesis` hands out *sound*, never *audio data*. The output goes straight to the sound
  device and never passes through an `AudioContext`. There is no buffer, so there is nothing to
  shift.
- `SpeechSynthesisUtterance.pitch` exists, but it is a unitless 0–2 multiplier, nonlinear and
  voice-dependent. It cannot express 82 Hz. It is not musically usable.
- Nothing in the browser can capture speech output — not a media recorder, not a media stream.

To pitch the speech you need an audio buffer, and the only way to get one is to render speech to a
file through a per-platform command:

| platform | command |
|---|---|
| Windows | PowerShell, `System.Speech.Synthesis` with `SetOutputToWaveFile` |
| macOS | `say -o` |
| Linux | `espeak -w` |

Once there is a buffer, the pitching itself is **free** — one `playbackRate` property on the node
that plays it, no DSP, no library. Playing a buffer faster raises its pitch and shortens it
together, like speeding up a tape. Holding the duration constant while moving the pitch would need
a real pitch shifter, but that was only ever required to keep a fixed tempo budget, which this
feature does not have.

**So: pitch is what costs the platform code. Nothing else does.** Dropping pitch is what made this
branch platform independent — it was not a side effect of some other decision.

Two further things worth remembering about pitch, if it comes back:

- A guitar spans E2 (82 Hz) to about E6 (1319 Hz). Speech lives around 85–255 Hz. Shifting a voice
  two or three octaves up is unintelligible, so any real version has to fold pitches into one
  octave the voice can carry and let the spoken octave number do the rest.
- Even then, speech has an intonation contour — "quarter G 2" glides downward. A perfect shift
  gives an announcement *centred near* G, never sitting on G. Useful for hearing that the next note
  is higher or lower; useless as a tuning reference.
- **The platform-independent way to give a pitch cue is to sound the guitar sample quietly under
  the announcement.** Dead in tune, already loaded, nothing new required. If pitch is wanted, try
  this first.

The escape hatch is intact. Those three shims are small, and the phrase building, caching,
scheduling and tempo-ceiling logic would all be unchanged — it is a swap of where the durations and
the sound come from, not a rewrite.

---

## What is built

`Tools → Speak the Notes (experimental)…`. A dialog, self-contained, touching nothing else in the
app. If a song is open its tracks are offered at the top of the passage list; otherwise there are
three built-in passages.

| file | what is there |
|---|---|
| `src/renderer/renderer.js` | everything, in one marked section: `--- Spoken note names (Tools menu, experimental) ---` |
| `src/renderer/index.html` | the `speak-notes-dialog` element |
| `src/main/main.js` | one Tools menu entry sending `speak-notes:open` |
| `src/main/preload.js` | `onSpeakNotesOpen` |
| `scripts/speak-notes/` | the measurement and verification scripts (below) |

Controls: passage, measures to play, speech rate (6/8/10), voice, tempo, and checkboxes for
metronome, octave, spoken duration, and guitar notes.

### The two load-bearing design decisions

**The music owns the clock, not the speech.** Notes and metronome clicks are scheduled in the audio
graph up front, exactly as the audio track does, and nothing the speech does can move them. Each
announcement is started on an ordinary timer sized to finish before its note. An announcement that
starts late or runs long overlaps its note; the beat does not shift. This is the whole reason the
tempo stays steady while the speech does not.

**Each phrase is timed once, silently, before anything plays.** Speaking at volume 0 measures the
same as speaking aloud to within 0.2%, and timings are stable to about 10 ms run to run, so one
measurement schedules every later use. That is also what lets the dialog state the fastest tempo
the phrases fit in and reduce the requested tempo to it.

### What a beat says

In order: the file's own chord name → a single note → two notes said as both → the chord identifier
(`identifyChordFromNotes`, the same reverse lookup Frets to Chord uses) → `"unknown"`.

The original plan was to say "unknown" for any multi-note beat. That was wrong, because the case is
not an exception: it is 44% of the sounding beats in Ripple's first ten measures and **70% across
the whole song**. The identifier names nearly all of them, and "unknown" ends up firing on 6% of a
whole song rather than 70%.

Two notes are said as two notes *ahead of* the identifier: "G, D" says exactly what to play where
"G power chord" makes you work it out, and it is no longer to say.

---

## What was measured

Microsoft David / SAPI, Electron 43, on the development machine. Every figure came from the scripts
in `scripts/speak-notes/`.

- **Phrase durations are extremely stable** — standard deviation 2–9 ms on durations of 800–2400 ms.
  Timing a phrase once is enough.
- **Volume 0 matches volume 1** to within 0.2%. Silent calibration measures the real thing.
- **A third to a half of every utterance is silence after the last word.** Waiting for the `end`
  event throws that away. Abandoning the utterance at the measured speech end — last word boundary
  plus that word's own length — is worth roughly a third of the tempo. Over a sustained run, every
  announcement still reached its last word.
- **Rate is not capped at 4.** Rates 4 and 5 measure identical because SAPI's scale is coarse and
  both land on one step, but 6, 8 and 10 keep improving. Rate 10 is about 35% faster than rate 4.
- **Start latency** is 20–30 ms typical, ~50 ms worst once the voice is warm.
- **Reading the voice list needs polling.** `voiceschanged` fires once while the list is still
  empty, so a one-shot listener on it reads zero voices and concludes the machine has none. This
  cost an hour the first time.

### Tempo ceilings, Ripple, first 10 measures

The song is written at 126 bpm.

| track | ceiling | make-up of the beats |
|---|---|---|
| Acoustic Lead | 57 bpm | 44 single, 6 named from notes, 4 two-note, 0 unknown |
| Acoustic Capo VII | 81 bpm | 4 named by the file, 46 named from notes |
| Electric Bass | 99 bpm | 23 single |
| Mandolin | — | nothing in the first 10 measures |

Speaking the octave drops the lead track from 57 to 44, because two-note beats say it twice.

**The longest phrase is usually not what sets the ceiling.** On the lead track the slowest phrase
sits in a whole beat and is comfortable; the limit comes from a shorter phrase landing in the
half-beat gap of an eighth-note run. The dialog names the binding pair for this reason.

One trap found the hard way: `QUALITY_LABELS` is written to be *read* in the chord library. Said
aloud, "G power chord (root and fifth)" measured 889 ms — longer than anything else in the track —
and on its own dragged that track's ceiling down by a fifth. Chord qualities needed a second set of
names meant for speaking (`SPEAK_NOTES_QUALITY_LABELS`).

---

## Was it any good?

Unknown, and that is the honest state. Everything above is measurement; nobody has judged whether
57 bpm with these announcements is actually useful for learning Ripple. That judgement is what
stopped the work, and it is the first thing to settle if it resumes — before writing any more code.

Open questions that need ears, not scripts:

1. Is rate 8 or 10 still intelligible while concentrating on playing?
2. Is 140 ms enough for the last word (`SPEAK_NOTES_TAIL_MS`), or does it clip too often? Erring
   toward clipping was a deliberate choice.
3. Does inferring duration from the metronome clicks work while playing along, or is the spoken
   duration worth its fifth of the tempo after all?
4. Does NVDA talk over it?

---

## Running it

```
npm start
```

Open a song, then `Tools → Speak the Notes (experimental)…`.

## The scripts

In `scripts/speak-notes/`, run with `node scripts/speak-notes/<name>.mjs` from the repo root. They
drive the real app through Playwright and print numbers; none of them change anything.

| script | question it answers |
|---|---|
| `speech-probe.mjs` | Does `speechSynthesis` work here, and what voices exist? Compares Electron against installed Chrome. |
| `speech-spike.mjs` | Are durations stable? Does volume 0 match volume 1? What is the start latency? |
| `speech-overhead.mjs` | Where does the time inside an utterance go? Do the voices differ? |
| `speech-tail.mjs` | How much of the trailing time is speech and how much is dead air? Does pipelining hold up? |
| `speech-faster.mjs` | Is the rate capped? What do shorter phrases buy? |
| `dump-ripple.mjs` | What is in the song, beat by beat, and how common is each kind of beat? |
| `ripple-multi.mjs` | How many unnamed multi-note beats can the chord identifier name? |
| `verify-speak-notes.mjs` | Dialog structure, labelling, ceilings, announcement order and timing. |
| `verify-ripple.mjs` | The same against a real song: track list, phrases, octave option, per-track ceilings. |

The two `verify-*` scripts exit non-zero on failure, so they can be treated as a test.

Note that `speech-spike.mjs` plays audio aloud in one section, deliberately — it cross-checks the
silent measurements against audible ones.
