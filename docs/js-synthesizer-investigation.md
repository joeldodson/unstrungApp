# js-synthesizer (FluidSynth in WebAssembly) investigation

Done on 2026-09-15 on the branch `experiment/js-synthesizer`, which was created from main at the
0.4.0 release commit. Nothing was installed and no code was changed. The branch was set aside on
2026-09-16 to go back to main. Kept locally at first, and moved into `docs/` on 2026-09-20.

The SoundFont question came up again on 2026-09-19, as a way to shrink the package; the conclusions
are in `web-deployment-and-guitar-input.md`, under "SoundFonts do not solve the size problem".

## The question

The current audio uses real recorded samples (Karoryfer Green Gretsch guitar and dark black bass),
which sound good but have limitations. FluidSynth with SoundFonts is a known option, but native
FluidSynth adds a build step for every platform. js-synthesizer is FluidSynth compiled to
WebAssembly, which avoids that. The question was whether it could sound as real as the samples.

## Short answer

js-synthesizer will very likely run in Unstrung without trouble. Whether it sounds as real depends
almost entirely on the SoundFont, not on the synthesizer. Some of what it would add can be done in
the existing Web Audio code without a new engine.

## What js-synthesizer is

- FluidSynth 2.4.6 compiled to WebAssembly, with a JavaScript wrapper. No native code, so no
  per-platform builds. Electron 43 supports everything it needs.
- Maintained: 1.13.0 was released in April 2026. One main maintainer, 8 open issues at the time,
  one of them an "out of bounds" memory error during rendering.
- Engine file is about 570 KB. SF3 (compressed SoundFont) support needs the larger build, about
  2.4 MB.
- Can run in an AudioWorklet, off the main thread. Has note on and off, pitch bend, control change
  and program change. Has a sequencer with event times in samples, and a `render()` call that fills
  a buffer without Web Audio.
- Licence: wrapper is BSD-3. Engine is LGPL 2.1, acceptable if shipped as a separate replaceable
  file, which is how it is packaged.

## The main issue: realism comes from the SoundFont

FluidSynth plays recorded samples, the same as Unstrung already does. It adds no realism of its
own. Free guitar SF2 files found were mostly smaller recordings than the Karoryfer packs, and their
licences were often unclear.

The realistic route is converting our own Green Gretsch and dark black bass recordings to SF2. That
hits one real gap: **SF2 has no round robin.** The guitar SFZ map uses `seq_length`, `lovel` and
related opcodes about 1,176 times, and the bass cycles through 4 round-robin positions per note.
Round robins are what make repeated notes sound real (see the guitar samples decision in memory).

Possible workaround, untested: make each round-robin position its own preset, give each string its
own MIDI channel, and send a program change before each note.

## What it would add, and what it would not

- **Gains:** pitch bend for bends and vibrato, slides, a filter that could approximate palm mute,
  looped sustain, other instruments. At the time, `src/shared/audioTrack.mjs` (around line 372)
  built each note from pitch, velocity and timing only. Bends, slides, vibrato and palm mute are
  present in the song metadata but not played.
- **Not unique to FluidSynth:** Web Audio buffer sources already have `detune` and `playbackRate`
  that can be automated over time, and Web Audio has a lowpass filter. Bends, slides and an
  approximate palm mute could be added to the current engine.
- **Costs:**
  - The rolling scheduler and metronome are timed on the Web Audio clock. They would have to feed
    the synth's sequencer, or call `render()` for each scheduling window.
  - An SF2 loads entirely into WebAssembly memory, about 400 MB at our sample sizes. Today one
    recording per pitch and velocity is decoded, and only when needed.
  - Round robin needs the preset workaround.

## Alternatives without WebAssembly

- **alphaTab's own synthesizer.** alphaTab is already a dependency and includes a SoundFont player
  ported from TinySoundFont.
- **SpessaSynth** (`spessasynth_lib`). Pure TypeScript SF2, SF3 and DLS player, Apache-2.0, runs
  in an AudioWorklet, version 4.x.

Both avoid the LGPL engine and the WebAssembly memory limit. Both play SF2, so the round-robin gap
is the same.

## Likelihood

| Question | Likelihood |
|---|---|
| js-synthesizer loads and plays in Unstrung on Windows | High |
| Sounds as real as now, using our samples converted to SF2 with the round-robin workaround | Moderate to high; only listening can decide |
| Sounds as real as now, using a free third-party guitar SF2 | Low |

## Proposed first experiment (not started)

1. Install js-synthesizer on a branch.
2. Write a Node script that builds a small SF2 from a few Green Gretsch notes, with each
   round-robin position as its own preset. Writing the SF2 ourselves avoids depending on
   Polyphone's interface.
3. Render one real measure both ways, current samples and FluidSynth, to WAV files for comparing
   by ear.

## Open question left unanswered

Which limitations of the current samples matter most: bends, slides, palm mutes, other
instruments, sustain, or memory and install size? The answer decides whether to test FluidSynth at
all, or first try the same effects in the existing Web Audio code.

## Sources

- js-synthesizer on GitHub: https://github.com/jet2jet/js-synthesizer
- js-synthesizer README: https://raw.githubusercontent.com/jet2jet/js-synthesizer/master/README.md
- js-synthesizer issues: https://github.com/jet2jet/js-synthesizer/issues
- js-synthesizer on npm: https://registry.npmjs.org/js-synthesizer
- js-synthesizer 1.13.0 file listing: https://data.jsdelivr.com/v1/packages/npm/js-synthesizer@1.13.0
- spessasynth_lib on GitHub: https://github.com/spessasus/spessasynth_lib
- spessasynth_lib on npm: https://registry.npmjs.org/spessasynth_lib
- Polyphone forum, round robin: https://www.polyphone.io/o/en/forum/support-bug-reports/101-round-robin
- SFZ seq_position opcode: https://sfzformat.com/opcodes/seq_position/
- MuseScore, Polyphone SFZ to SF2 conversion: https://musescore.org/en/node/154526
- KVR, clean guitar SF2: https://www.kvraudio.com/forum/viewtopic.php?t=191080
- Zanderjaz guitar SoundFonts: https://www.zanderjaz.com/downloads/soundfonts/guitars/
- HEDSound, FlameStudios guitar SoundFonts: https://www.hedsound.com/2019/07/flamestudios-guitar-soundfonts-in-sf2.html
- FlameStudios licence: https://github.com/gdm-2112/electric-guitar-soundfonts/blob/main/SF2/FlameStudios/license.txt
- Ardour forum, SFZ/SF2 sources: https://discourse.ardour.org/t/best-sfz-sf2-instrument-sources-open-source-free-and-commercial-and-related-misc-as-of-june-2023/108831
- Soundfonts 4U: https://sites.google.com/site/soundfonts4u/
