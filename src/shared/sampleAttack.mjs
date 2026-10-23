// Where a recorded note's attack falls inside its recording.
//
// Kept dependency-free and free of Web Audio types so it can be tested in Node, like
// spokenPhrases.mjs.
//
// Every guitar and bass recording opens with the pick or finger on the string: 20 to 40 dB below
// the note, lasting about 22 ms on the guitar and 27 ms on the bass. The note itself comes after
// it. Started on the beat, the note sounded that much behind a metronome click, which starts at
// full level on its first sample. A player hears that. So a note is started early by its attack,
// which puts the attack on the beat and the pick noise just before it, where a player's pick is.
//
// The attack is where the level first comes within 6 dB of the recording's peak. The rise to it
// is steep: from 20 dB below the peak to there takes half a millisecond on the guitar and one and
// a half on the bass, measured over every recording the sample maps use. The loudest sample comes
// about 5 ms later, so this is the start of the attack rather than its peak. The measurements are
// in docs/note-timing.md.

// Only this much of the start of a recording is searched. The bass's loudest moment can come a
// third of a second in, well after its attack, and every attack measured is inside 35 ms; the
// window is the same for a recording fetched whole or cut short, so both give the same answer.
const SEARCH_SECONDS = 0.25;

// Within 6 dB of the peak.
const ATTACK_LEVEL = 0.5;

/**
 * Seconds from the start of a recording to its attack. 0 for silence.
 *
 * `samples` is a Float32Array of one channel.
 */
export function attackSeconds(samples, sampleRate) {
    const end = Math.min(samples.length, Math.round(SEARCH_SECONDS * sampleRate));
    let peak = 0;
    for (let i = 0; i < end; i++) peak = Math.max(peak, Math.abs(samples[i]));
    if (peak === 0) return 0;
    for (let i = 0; i < end; i++) {
        if (Math.abs(samples[i]) >= peak * ATTACK_LEVEL) return i / sampleRate;
    }
    return 0;
}

/**
 * When to start a recording, and how far into it, so its attack sounds at `at`.
 *
 * `into` is how far past its attack the note should already be at `at`, for a note that was
 * ringing when playback started; the recording then starts at `at`, that far past its attack.
 * Otherwise it starts `attack` seconds before `at`, unless that is before `notBefore`, the
 * earliest it can start: the audio clock's present time. Then it starts at `notBefore`, skipping
 * the part of its pick noise it no longer has time for, and its attack still lands at `at`.
 *
 * Returns { begin, offset }, for AudioBufferSourceNode.start(begin, offset).
 */
export function attackAlignedStart(attack, at, into, notBefore) {
    const ideal = at - attack - into;
    const begin = into > 0 ? at : Math.max(ideal, Math.min(at, notBefore));
    return { begin, offset: begin - ideal };
}
