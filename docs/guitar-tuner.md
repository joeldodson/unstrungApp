# Guitar tuner

Discussed with Joel on 2026-11-23 and built the same day as a first version with testing options.
The plan it grew from is the tuner part of `web-deployment-and-guitar-input.md`. Which options stay
is not decided: Joel tries them with the guitar first. This record will be revised once that is
settled.

## What Joel asked for

- A tuner as a top-level item in the unstrung menu.
- Input from the built-in microphone, or a choice of every usable input with the system default
  chosen, since that is no more work.
- Feedback that is fast and continuous, like a needle a sighted player watches move. Joel uses
  Talking Tuner on his iPhone, which can take several seconds to say anything.
- Two questions: does the tuner need to be told the tuning, and does sound from the computer feed
  back into the microphone so that the tuner has to wait and speak instead?

## Answers settled in the discussion

### No tuning has to be chosen

Chromatic mode names the nearest equal-tempered note, A4 = 440 Hz, and how many cents off it the
string is. It works for any tuning. Its weakness is a string more than half a semitone off, which
reads as the neighbouring note: a slack low E reads as D sharp, and could be tuned to D sharp.

String mode measures against the nearest string of a chosen tuning, from `TUNINGS` in
`musicTheory.mjs`, however far off the string is. Both are built, as an option to try.

### Speed

Talking Tuner probably waits for a steady reading and then speaks it. This tuner never waits on
speech. It reads the input about every 15 milliseconds, smooths a few readings, and changes a
continuous sound. From pluck to sound should be roughly 100 to 150 milliseconds: Windows's input
buffering, a window of 2,048 or 4,096 samples, the smoothing, and output.

### Feedback into the microphone

With the Scarlett Solo and the guitar's pickup there is none: sound from the speakers never reaches
the instrument input, so the tone can play all the time.

With a microphone the tone does reach it, and the danger is a loop: the tuner hears its own tone.
Waiting for silence is not needed. Instead the feedback and the guitar are kept in different parts
of the spectrum:

- The feedback tone can sit around 2,000 Hz, the High register option.
- A low-pass filter at 1,000 Hz, two stages, cuts the input before analysis. Open strings run from
  82 to 330 Hz, so tuning loses nothing.
- Readings above 1,100 Hz are ignored.
- Pulses are a few a second, far below any note, so they cannot be read as a pitch.
- Chromium's echo cancellation removes a page's own output from the microphone. It is built for
  speech and may distort a held string, so it is an option, off by default.
- Speech is the remaining risk, since a speaking voice is in guitar range. NVDA's speech cannot be
  timed by the page. The first version kept it short and rare, the note name when it changed; the
  spoken readings Joel asked for on 2026-11-24 say more, so with a microphone and speakers the
  tuner may hear NVDA. Not yet tried.
- Headphones avoid the problem altogether.

## How it is built

### Pieces

- `src/shared/pitchDetection.mjs`: the McLeod pitch method over a `Float32Array`, with the
  autocorrelation done by FFT so it is cheap enough to run sixty times a second; conversion between
  frequency, note and cents; the nearest note and the nearest string of a tuning; and the wording
  of a reading. Pure functions, checked under Node by `scripts/tuner/check-pitch-detection.mjs`.
- The Tuner item in `src/renderer/renderer.js`, opened from the unstrung menu after Metronome.
- Its own `AudioContext`, made on Start and closed on Stop, so it never interferes with the shared
  one that playback uses and replaces when its clock goes wrong.

### Analysis on a timer, not in an AudioWorklet

The earlier plan put analysis in an AudioWorklet. This first version polls an `AnalyserNode` on a
15 millisecond timer instead. A worklet module has to be loaded from its own file, and the desktop
app loads its page from `file://`, where module loading is likely to be refused, or would need the
content security policy widened to `blob:` scripts. The analyser gives the same samples with none
of that. The cost is that analysis runs on the page's own thread; with the FFT it is small. A
background tab's timers are slowed, which does not matter for a tuner nobody is listening to.

### Platform

`getUserMedia`, `enumerateDevices` and Web Audio are the same in Electron and in a browser, so the
renderer uses them directly, as it already does Web Audio. Nothing goes through `window.unstrung`,
and nothing is Electron-only.

- Electron grants media permission itself when no permission handler is set, which is the case.
- Windows has to let desktop apps use the microphone: Settings, Privacy and security, Microphone.
  The tuner says so when the input cannot be opened.
- In a browser the page asks permission once, and input names appear only after it is granted.
  The list is filled again after Start for that reason.
- The input is opened with noise suppression and automatic gain off, and echo cancellation as the
  option sets it.

### Which channel

The Scarlett Solo gives two channels: the guitar on input 1 and the microphone socket on input 2.
Mixed together the guitar would be mixed with hiss. The input is opened asking for two channels and
split; the Input channel option picks the louder channel, the first or the second.

## Testing options

Joel asked for radio buttons where options exclude each other and checkboxes where they combine.
They last until unstrung is closed and are not saved, since most will go once a design is chosen.

Radio groups:

- **Mode**: Chromatic (default), or String in a tuning, with a list of tunings.
- **Feedback sound**:
  - Rising and falling tone (default): one tone whose pitch follows the string, exaggerated six
    times, so 50 cents flat is a minor third below the centre. In tune it rests on the centre.
  - Pulses that slow down: a tone a whole tone below the centre when flat and above when sharp,
    pulsing faster the further off it is, steady when in tune. Like the beating between two
    strings nearly in tune.
  - Both: the moving tone, pulsing.
  - None, added 2026-11-24: no tone, so the spoken readings can be tried on their own. The chime
    still plays if it is on.
- **When to speak**, added 2026-11-24: Every change, or Once it settles, then only on a real
  change (default). See Speaking once it settles.
- **In tune for speech**, added 2026-11-24: Within 2 cents (default) or Within 3 cents. Speech
  only: the reading on the page and the chime keep 2.
- **Time between spoken readings**: Quick, 0.4 seconds; Medium, 0.7 (default); Slow, 1. See
  Spoken Readings.
- **Tone register**: High, around 2,000 Hz, kept out of the microphone's way (default); or Middle,
  around 660 Hz, gentler, for headphones or the Scarlett.
- **Response**: Fast, Medium (default) or Steady: how many readings are smoothed and how long a
  window is analysed.
- **Input channel**: Louder of the two (default), First, Second.

Checkboxes:

- **Pan left when flat and right when sharp**, for headphones. Off.
- **Chime when in tune**: a short rising pair of notes once the string has been within 2 cents for
  a third of a second. On.
- **Speak the note and how far off**: the spoken readings, in a live region. On. Until 2026-11-24
  this was Speak the note when it changes, which said only the note name.
- **Filter the input for a microphone**: the 1,000 Hz low-pass. On.
- **Echo cancellation**: reopens the input. Off.
- **Record a log**, added 2026-11-24. Off. See The log.

## Spoken readings

Asked for by Joel on 2026-11-24, after trying the first version. He saw why Talking Tuner speaks
the number of cents: for someone new to tuning, a sound alone does not make it clear whether the
string is above or below the note. The rules he gave:

1. When a sound is first heard, name the nearest note, how far off and which way: "E2, 10 cents
   flat".
2. While it carries on and changes, say only the number: "7", "4", "2".
3. When it crosses to the other side of the note, say the direction again: "3 cents sharp".
4. When it goes so far that another note is nearer, name that note in full, as in rule 1.
5. When the sound stops, or drops and then quickly rises again because the string was plucked
   again, start over with rule 1.

He asked to keep the sounds, so the speech can be tried with the tone, the pulses or both, and for
a None sound so it can be tried alone. Speech is a checkbox of its own.

### How the rules are applied

`src/shared/tunerSpeech.mjs` holds them, free of the page, and is checked under Node by
`scripts/tuner/check-tuner-speech.mjs`. The tuner hands it every smoothed reading.

- In tune is said as "in tune", as the reading and the chime already have it: within 2 cents. So
  Joel's example "7, 4, 2, 3 cents sharp" comes out as "7, 4, in tune, 3 cents sharp". The In
  tune for speech option widens it to 3 cents for speech.
- Leaving in tune needs three quarters of a cent more than the range, 2.75 cents for 2, so a
  string resting at the edge is not said to be in and out of tune over and over. Past 2.75 it
  rounds to 3, so "3 cents sharp" after "in tune" is heard. The chime uses the same margin; it was
  3.5 cents before.
- Changing any speech option starts the speech over, so the next thing said is the full reading.
- A new number is said once the reading is three quarters of a cent from the last one said, so a
  reading sitting between two numbers does not alternate.
- A note is named only once it has held a fifth of a second, so the first instant of a pluck,
  which can read as a neighbouring note, is not named.
- A silence is the existing one: a fifth of a second with no clear reading.

### Pace

NVDA says a live region's new text after whatever it is saying; it does not drop what has not been
said. Readings faster than NVDA can speak them pile up and fall further and further behind the
string. So nothing is said within a set time of the last thing said, and when that time is up the
latest reading is said, not the ones in between. How long suits Joel's voice rate is for him to
find: the Time between spoken readings option offers 0.4, 0.7 and 1 second.

The recorded chord names that practice mode plays were considered instead, since their length is
known exactly and they could be cut off. They are only chord names, numbers would need recording,
and they would go through the same speakers as NVDA. Not pursued unless the live region proves too
slow.

### A new pluck

A string only gets quieter once plucked, so a level that jumps up is a new pluck. Each reading
takes the level of the last 1,024 samples, about 21 ms, rather than the whole analysis window, so
the jump shows at once. A pluck is a level more than twice, 6 dB above, the quietest of the four
readings before it, and above the tuner's input floor. While the level is still rising, and for
four readings after it peaks, nothing else counts as a pluck: some recordings take more than 60 ms
to reach their loudest and were counted twice before this was added.

Across the 448 guitar and bass recordings from C2 to A5, 445 are one pluck each. The other three
are the softest high Gretsch notes, which never reach the input floor and are not read at all. Each
recording started again a second into itself is a second pluck, every time.

On a pluck, or a silence, the reading starts over: the smoother is cleared, the note is named in
full again, and the chime can play again.

## Speaking once it settles

### What Joel heard

On 2026-11-24 Joel tried the every-change speech on his guitar, through the laptop microphone and
through the Focusrite, with the Steady response and a second between readings. On the low E he
heard "E2, in tune, 4 cents flat, 5", run together with almost no pause. He asked whether the
problem is inherently hard or the algorithm can be tuned, and remembered that an analog tuner's
needle moved too, but he ignored it as long as it was stable enough near the middle.

### What the string does

The tuner's own detector was run over the ten low E recordings in the Green Gretsch pack, a
reading every 15 ms:

- A pluck starts sharp. The first readings were 4 to 16 cents sharp of where the string settled,
  further for a harder pluck. A hard pluck stretches the string, raising its tension.
- It then slides flat, fast at first and slower later, for about two seconds: 6 to 13 cents in
  all. Between 0.6 and 1.6 seconds after the pluck each recording moved over about 5 cents.
- The Steady response gave the same figures. The string's pitch is moving, not the measurement.
- On the A to high E strings the middle of the note moved about 1.5 cents.

So what Joel heard was the tuner reporting the string faithfully: named a fifth of a second in,
while still sharp, as in tune, then sliding to 4 and 5 flat. The tuner reported every cent of a
slide a needle would show but an eye would ignore. The run-together sound: the second between
readings is counted from when the words go to NVDA, not from when NVDA finishes, so with "E2, in
tune" taking half a second, only half a second of quiet was left.

### The rules

Chosen by When to speak; Every change is the style before this.

- Wait until the reading moves less than 4 cents a second, judged over the last 0.3 seconds: the
  middle of its last third against the middle of its first third. At least half a second after
  the pluck, at most two seconds.
- Say the middle, the median, of the last 0.3 seconds of readings, in full.
- Then speak again only on a real change, held for 0.3 seconds: more than 4 cents from what was
  last said, or to the other side of the note, in tune included. Then Joel's rules decide the
  words: the number alone on the same side, the direction when the side changes.
- A new note, a pluck or a silence starts over, as before.

A fixed wait of half a second was tried first. Two thirds of the low E recordings were still
sliding then and were said twice, first sharp and then in tune. Waiting for the slide to slow
does better, but not perfectly: across the 60 open-string recordings, low E to high E, it says one
thing for 44 and two for the rest, 72 things in all against 184 for the every style. The ones said
twice are low E recordings that keep sliding 5 to 7 cents for two seconds. The rules were not fitted
any closer to these recordings, since Joel's guitar is the one that matters: the log is for that.

The numbers, 4 cents a second, 4 cents of change and 0.3 seconds held, are constants at the top
of `src/shared/tunerSpeech.mjs`, to be set from Joel's logs.

Talking Tuner's wait of several seconds is likely the same problem solved by waiting for the
string to stop sliding. Half a second to two seconds is enough here.

## The log

Asked for by Joel on 2026-11-24, to record the settings, what is spoken, and the guitar as he plays,
so the tuner can be tuned from his own strings rather than the sample packs.

It is a development tool, not a feature for people using unstrung. Joel said the same day that it
will not be in production and only ever needs to work in Electron. The Log section appears only in
the desktop app, the web build has no way to save it, and `user-docs/` does not describe it. Take
it out, or hide it from packaged builds, before the tuner is settled.

- **Record a log**, a checkbox under the Log heading, off to begin with. While it is checked the
  tuner keeps a log across Stop and Start, up to five minutes of audio, about 58 MB in memory.
  Unchecking it pauses the log; checking it again carries on.
- **Save Log** stops the tuner and saves. A save dialog names the WAV, and the other two files go
  beside it under the same name. Once saved, the log is gone, and the next Start begins a new one.
- **Where**: the dialog starts in `logs/` in the repository, made if it is not there. `.gitignore`
  already leaves `logs` out, so the WAVs stay out of git. An installed copy, which has no
  repository, and the verify scripts' scratch profiles start in `Documents\unstrung\logs`.
- **Names**: tuner-<date>-<time>.wav, as tuner-2026-11-24-153005.wav, from when the log began,
  to the second. Each log has its own name without an epoch time added, and the date and time
  read better. Should two names ever match, the dialog asks before replacing the file.
- **The WAV**: both input channels, 16-bit, at the audio context's rate. Recorded by a
  ScriptProcessorNode, which is deprecated but, unlike an AudioWorklet, loads no module from a
  file.
- **The text log**: a header with the version and when it began, then one line per event, each
  timed in seconds into the audio: every setting whenever one changes, everything said, Pluck,
  Nothing heard for 0.2 seconds, Stopped, Saved. Readable with NVDA.
- **The CSV**: one row per reading, about 66 a second while listening: seconds, the channel read,
  the level used for plucks, the detected frequency and its clarity (blank when nothing was
  detected), the note and the smoothed cents (blank unless the reading was clear), and whether it
  was a pluck.
- Times come from the number of samples recorded, so they line up with the WAV to within about a
  tenth of a second: the recorder hands over audio in blocks of 4,096 samples.
- `src/shared/tunerLog.mjs` makes the files, checked by `scripts/tuner/check-tuner-log.mjs`, and
  `tuner:save-log` in `src/main/main.js` saves them.

## Keys

While focus is in the Tuner item and NVDA is in focus mode: spaceBar starts and stops, r says the
reading, l says the input level, upArrow and downArrow change the volume of the feedback. The
radio groups keep their arrows.

## Testing without listening

- `scripts/tuner/check-pitch-detection.mjs`: synthetic tones at known detuning, with harmonics
  and noise, and every Green Gretsch sample, read against the pitch in its file name.
- `scripts/tuner/check-tuner-speech.mjs`: the spoken readings, fed by hand with their times,
  including Joel's example, in both styles and both in-tune ranges; the pluck detector on made-up
  levels and on every recording in the sample packs; and every open-string recording read the
  way the tuner reads it, through to the words, in both styles.
- `scripts/tuner/check-tuner-log.mjs`: the WAV read back, the text log and the CSV.
- `scripts/tuner/verify-tuner.mjs`: drives the app with Chromium's fake input device playing a
  generated WAV, and checks the item's structure, labels, the reading, and that the feedback
  sound follows it. Since 2026-11-24 also a string gliding from 15 cents flat to 6 sharp, which
  was said as "E2, 15 cents flat", "12", "8", "4", "in tune", "5 cents sharp", "6"; a string
  plucked again while ringing, which was named in full both times; and that None silences the
  tone. Once it settles, the same glide was said as "E2, 15 cents flat", "9", "3", "in tune",
  "5 cents sharp". In the desktop app a log is recorded and saved, with the save dialog answered
  by the script, and the three files are read back.

What only Joel can judge: how each sound feels, whether it is fast enough, how the built-in
microphone behaves with the speakers on, and whether speaking once it settles says the right
amount on his own strings. His logs can answer the last one.
