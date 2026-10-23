# Note timing against the metronome

A professional musician playing along with the web version heard the chords land slightly after
the metronome's clicks. Investigated and fixed 2026-10-22.

## What was wrong

Every guitar and bass recording opens with the pick or finger on the string before the note
speaks: noise 20 to 40 dB below the note's peak. The note's attack, the first point within 6 dB
of the recording's peak, comes after it. Measured over every recording the sample maps use:

| Pack | Recordings | Attack, earliest | Typical | Latest |
| --- | --- | --- | --- | --- |
| Guitar (green Gretsch) | 430 | 20.2 ms | 22.4 ms | 32.8 ms |
| Bass (dark black) | 204 | 23.9 ms | 26.9 ms | 30.7 ms |

Notes were started on the beat, from their first sample. The metronome's click is generated in
code and is at full level on its first sample. So every note sounded 20 to 33 ms after its click,
which a player hears against a sharp click, the bass most of all. The `.sfz` maps have no
`offset` to skip the lead-in.

It was in the recordings, so the desktop app had it too. The web version's Opus copies add
nothing: decoded in Chrome 155, the Opus and WAV copies of the same recordings reach their attack
within 0.1 ms of each other. Safari was not measured, since the WebKit Playwright installs on
Windows has no Web Audio. If Safari ignored Opus's pre-skip it would add 6.5 ms (312 samples at
48 kHz) on top.

## Where the beat goes

The rise from the pick noise to the attack is steep: from 20 dB below the peak to 6 dB below
takes about half a millisecond on the guitar and one and a half on the bass. The loudest sample
comes about 5 ms after that. So the 6 dB point is both the start of the attack and a few
milliseconds ahead of the peak, and it is what is placed on the beat. Placing the beat earlier
would put pick noise on it and the note after it.

## What was decided

Start each note early by its attack, rather than cut the pick noise off the recordings.

- It keeps the whole sound. The noise is the pick meeting the string; it now falls just before
  the beat, where a player's pick is.
- The recordings stay as published. They are committed to the repository without LFS, so
  rewriting them would add about 415 MB to its history, and the web version's Opus copies would
  all need encoding again.
- If the noise before the beat ever sounds wrong, the app can skip part of it as it plays, by
  starting further into the recording, without touching the files.

## How it works

`src/shared/sampleAttack.mjs` finds the attack in the first quarter second of a recording, so a
recording fetched whole or cut short gives the same answer. The renderer measures each decoded
buffer once (`noteAttackSeconds`) and starts it through `startNoteOnAttack`, which starts it that
much before its time. When there is not that much time left before the note is due, as for a note
on the very first beat with no count-in, it starts now and skips the part of the noise it has no
time for, and the attack still lands on time. A note entered partway, ringing when playback
started, starts that far past its attack.

Chord practice (with the strumming pattern preview), an audio track, and chords played from the
chord library all start notes this way. The Guitar Samples dialog does not: it plays each
recording as it is, to audition it, and has no metronome.

`scripts/audio/verify-note-timing.mjs` plays chord practice, and a song's audio track when given
`--song`, records every source the page starts, and checks each note's attack falls within 1 ms
of its click.
