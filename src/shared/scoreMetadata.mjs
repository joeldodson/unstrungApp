// Pure data extraction: turns an alphaTab `Score` object into a plain,
// JSON-serializable summary that the renderer can display. Kept free of
// alphaTab imports and DOM access so it can also run standalone for testing.

import { STANDARD_TUNING_MIDI, identifyChordFromNotes, midiToPitchName } from './musicTheory.mjs';

const KEY_SIGNATURE_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];

// Standard General MIDI instrument program names (program numbers 0-127).
const GENERAL_MIDI_INSTRUMENTS = [
    'Acoustic Grand Piano', 'Bright Acoustic Piano', 'Electric Grand Piano', 'Honky-tonk Piano',
    'Electric Piano 1', 'Electric Piano 2', 'Harpsichord', 'Clavinet',
    'Celesta', 'Glockenspiel', 'Music Box', 'Vibraphone',
    'Marimba', 'Xylophone', 'Tubular Bells', 'Dulcimer',
    'Drawbar Organ', 'Percussive Organ', 'Rock Organ', 'Church Organ',
    'Reed Organ', 'Accordion', 'Harmonica', 'Tango Accordion',
    'Acoustic Guitar (nylon)', 'Acoustic Guitar (steel)', 'Electric Guitar (jazz)', 'Electric Guitar (clean)',
    'Electric Guitar (muted)', 'Overdriven Guitar', 'Distortion Guitar', 'Guitar Harmonics',
    'Acoustic Bass', 'Electric Bass (finger)', 'Electric Bass (pick)', 'Fretless Bass',
    'Slap Bass 1', 'Slap Bass 2', 'Synth Bass 1', 'Synth Bass 2',
    'Violin', 'Viola', 'Cello', 'Contrabass',
    'Tremolo Strings', 'Pizzicato Strings', 'Orchestral Harp', 'Timpani',
    'String Ensemble 1', 'String Ensemble 2', 'Synth Strings 1', 'Synth Strings 2',
    'Choir Aahs', 'Voice Oohs', 'Synth Voice', 'Orchestra Hit',
    'Trumpet', 'Trombone', 'Tuba', 'Muted Trumpet',
    'French Horn', 'Brass Section', 'Synth Brass 1', 'Synth Brass 2',
    'Soprano Sax', 'Alto Sax', 'Tenor Sax', 'Baritone Sax',
    'Oboe', 'English Horn', 'Bassoon', 'Clarinet',
    'Piccolo', 'Flute', 'Recorder', 'Pan Flute',
    'Blown Bottle', 'Shakuhachi', 'Whistle', 'Ocarina',
    'Lead 1 (square)', 'Lead 2 (sawtooth)', 'Lead 3 (calliope)', 'Lead 4 (chiff)',
    'Lead 5 (charang)', 'Lead 6 (voice)', 'Lead 7 (fifths)', 'Lead 8 (bass + lead)',
    'Pad 1 (new age)', 'Pad 2 (warm)', 'Pad 3 (polysynth)', 'Pad 4 (choir)',
    'Pad 5 (bowed)', 'Pad 6 (metallic)', 'Pad 7 (halo)', 'Pad 8 (sweep)',
    'FX 1 (rain)', 'FX 2 (soundtrack)', 'FX 3 (crystal)', 'FX 4 (atmosphere)',
    'FX 5 (brightness)', 'FX 6 (goblins)', 'FX 7 (echoes)', 'FX 8 (sci-fi)',
    'Sitar', 'Banjo', 'Shamisen', 'Koto',
    'Kalimba', 'Bagpipe', 'Fiddle', 'Shanai',
    'Tinkle Bell', 'Agogo', 'Steel Drums', 'Woodblock',
    'Taiko Drum', 'Melodic Tom', 'Synth Drum', 'Reverse Cymbal',
    'Guitar Fret Noise', 'Breath Noise', 'Seashore', 'Bird Tweet',
    'Telephone Ring', 'Helicopter', 'Applause', 'Gunshot'
];

function keySignatureName(value) {
    const index = value + 7;
    return KEY_SIGNATURE_NAMES[index] ?? `Unknown (${value})`;
}

function instrumentName(programNumber) {
    return GENERAL_MIDI_INSTRUMENTS[programNumber] ?? `Unknown (program ${programNumber})`;
}

const NOTE_LETTER_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// realValue is a MIDI key number; this is the standard scientific-pitch-notation formula
// (verified against real open strings: low E -> E2, high E -> E4, "c4" input -> C4/MIDI 60).
function pitchName(realValue) {
    const octave = Math.floor(realValue / 12) - 1;
    return `${NOTE_LETTER_NAMES[realValue % 12]}${octave}`;
}

const DURATION_NAMES = {
    '-4': 'quadruple whole',
    '-2': 'double whole',
    1: 'whole',
    2: 'half',
    4: 'quarter',
    8: 'eighth',
    16: 'sixteenth',
    32: 'thirty-second',
    64: 'sixty-fourth',
    128: 'one-hundred-twenty-eighth',
    256: 'two-hundred-fifty-sixth'
};

function durationName(duration, dots) {
    const base = DURATION_NAMES[duration] ?? `1/${duration}`;
    const dotPrefix = dots === 1 ? 'dotted ' : dots === 2 ? 'double-dotted ' : dots > 2 ? `${dots}-dotted ` : '';
    return `${dotPrefix}${base} note`;
}

// HarmonicType, SlideInType, SlideOutType, VibratoType enum values, per alphaTab's model.
const HARMONIC_NAMES = {
    1: 'natural harmonic',
    2: 'artificial harmonic',
    3: 'pinch harmonic',
    4: 'tap harmonic',
    5: 'semi harmonic',
    6: 'feedback harmonic'
};
const SLIDE_IN_NAMES = { 1: 'slide in from below', 2: 'slide in from above' };
const SLIDE_OUT_NAMES = {
    1: 'shift slide',
    2: 'legato slide',
    3: 'slide out upward',
    4: 'slide out downward',
    5: 'pick slide down',
    6: 'pick slide up'
};
const VIBRATO_NAMES = { 1: 'slight vibrato', 2: 'wide vibrato' };

function describeNoteTechniques(note) {
    const techniques = [];
    if (note.isHammerPullOrigin) {
        const destination = note.hammerPullDestination;
        techniques.push(destination && destination.fret < note.fret ? 'pull-off' : 'hammer-on');
    }
    if (note.hasBend) techniques.push('bend');
    if (note.isGhost) techniques.push('ghost note');
    if (note.isPalmMute) techniques.push('palm mute');
    if (note.isTieDestination) techniques.push('tied');
    if (note.isStaccato) techniques.push('staccato');
    if (note.harmonicType) techniques.push(HARMONIC_NAMES[note.harmonicType] ?? 'harmonic');
    if (note.slideInType) techniques.push(SLIDE_IN_NAMES[note.slideInType] ?? 'slide in');
    if (note.slideOutType) techniques.push(SLIDE_OUT_NAMES[note.slideOutType] ?? 'slide out');
    if (note.vibrato) techniques.push(VIBRATO_NAMES[note.vibrato] ?? 'vibrato');
    return techniques;
}

// AlphaTab numbers strings low-to-high (1 = low E). Guitarists and tab notation
// conventionally number high-to-low (1 = high E), so we flip for display.
function describeNotePitch(note, stringCount) {
    if (note.isStringed) {
        const conventionalString = stringCount - note.string + 1;
        if (note.isDead) return `string ${conventionalString}, muted (X)`;
        if (note.fret === 0) return `string ${conventionalString}, open`;
        return `string ${conventionalString}, fret ${note.fret}`;
    }
    return pitchName(note.realValue);
}

// Chord qualities a player reading a strum would recognise. Identification can technically name
// any set of notes, but calling six open strings "G69" tells a guitarist less than listing the
// strings does, so only the everyday qualities stand in for a string-by-string reading.
const RECOGNIZED_STRUM_SUFFIXES = new Set([
    'major', 'minor', '5', 'sus2', 'sus4', '7', 'maj7', 'm7', 'm7b5',
    'dim', 'dim7', 'aug', '6', 'm6', 'add9', 'madd9', '9', 'm9', 'maj9', 'mmaj7'
]);

/**
 * Names a beat that strums one unmistakable chord, e.g. "A, up stroke".
 *
 * Tablature often writes a strum out string by string, leaving the reader to recognise the shape.
 * Where the notes spell exactly one everyday chord this says so instead, which is both shorter to
 * listen to and more useful than five string-and-fret pairs.
 *
 * Identification works from the pitches sounded, not from a stored shape, so it is indifferent to
 * how the chord is fingered: a barred B minor is named the same as any other B minor, and a
 * capo or an altered tuning makes no difference.
 *
 * Where the same notes spell a second chord as well, that reading follows in parentheses, e.g.
 * "Em7 (G6), down stroke".
 *
 * Returns null, leaving the strings listed, when naming the beat would say less than the strings do:
 * - notes that do not spell a complete chord, such as the top three strings of a G, which give
 *   only G and B: a genuine part-chord the player needs told string by string
 * - notes that spell only chords outside everyday use, where a name would be more work to
 *   interpret than the frets it replaced
 * - notes listed in no consistent direction, which is not a sweep of the pick at all; naming it
 *   without a direction would invite reading it as the unmarked case, a down stroke
 * - notes that leave a gap in the middle, skipping a string the file says nothing about. A pick
 *   cannot cross a string without sounding it, so those notes were plucked, not strummed, and
 *   calling them a stroke would be wrong. A string the file explicitly marks muted does not
 *   break the run: muting a string and strumming through it is exactly how chords like these
 *   are played, so the gap is accounted for.
 */
function describeStrum(beat, stringCount) {
    if (beat.notes.length < 2 || !stringCount) return null;
    if (!beat.notes.every(note => note.isStringed && typeof note.realValue === 'number')) return null;

    // Muted strings are part of the sweep but sound no pitch, so they count towards covering
    // the run of strings and are kept out of the chord identification.
    const sounding = beat.notes.filter(note => !note.isDead);
    if (sounding.length < 2) return null;

    const tabString = note => stringCount - note.string + 1;
    const covered = new Set(beat.notes.map(tabString));
    if (covered.size !== beat.notes.length) return null;
    if (Math.max(...covered) - Math.min(...covered) + 1 !== covered.size) return null;

    // Restricted to everyday chord names: an obscure one is worse than concrete frets, since the
    // point of naming a strum is to be quicker to take in than the strings it replaces.
    const readings = identifyChordFromNotes(sounding.map(note => note.realValue))
        .filter(candidate => RECOGNIZED_STRUM_SUFFIXES.has(candidate.suffix));
    if (readings.length === 0) return null;

    // Readings come ranked with root-in-bass first, so the plainest one leads. Where the same
    // notes spell a second chord it follows in parentheses rather than being decided silently.
    const primary = readings[0];
    const alternative = readings.find(candidate => candidate.name !== primary.name) ?? null;

    // Every name carries its own bass note, including the one in parentheses. The readings all
    // share a bass, since it is just the lowest string sounding, but leaving it off the
    // alternative invites reading that name as having its own root at the bottom instead.
    // Without it at all, "Em7" would be heard as having E lowest when the file says D.
    const withBass = reading => reading.rootInBass ? reading.name : `${reading.name}/${reading.bass}`;
    const chordText = withBass(primary) + (alternative ? ` (${withBass(alternative)})` : '');

    // The order the file lists the notes in gives the direction of the sweep, the same signal
    // audio generation uses: low string to high is an up stroke, high to low a down stroke.
    const strings = sounding.map(tabString);
    const ascending = strings.every((s, i) => i === 0 || s > strings[i - 1]);
    const descending = strings.every((s, i) => i === 0 || s < strings[i - 1]);
    if (!ascending && !descending) return null;

    // Which strings to play, which the name only implies. A chord name and its bass do narrow it
    // down against a shape the player already knows, but the same chord is voiced in more than
    // one position, so the run is given outright, in the order the pick travels.
    //
    // The strings that sound are what bound it. A muted string at either end is struck to no
    // effect, so it is indistinguishable from not playing that string and is left unsaid: a full
    // sweep with string 6 deadened is simply strings 1 through 5.
    const soundingStrings = sounding.map(tabString);
    const low = Math.min(...soundingStrings);
    const high = Math.max(...soundingStrings);
    const [from, to] = ascending ? [low, high] : [high, low];
    const rangeText = high - low + 1 === 2
        ? `strings ${from} and ${to}`
        : `strings ${from} through ${to}`;

    // Only a muted string inside the run needs reporting. There the pick has no choice but to
    // cross it, so deadening it is deliberate work for the player, often done with a finger
    // already fretting a neighbouring string.
    const muted = beat.notes.filter(note => note.isDead).map(tabString)
        .filter(stringNumber => stringNumber > low && stringNumber < high)
        .sort((a, b) => a - b);
    const mutedText = muted.length === 0 ? ''
        : `, string${muted.length === 1 ? '' : 's'} ${muted.join(' and ')} muted`;

    return `${chordText}, ${rangeText}, ${ascending ? 'up stroke' : 'down stroke'}${mutedText}`;
}

function describeBeat(beat, stringCount) {
    let pitchText;
    if (beat.isRest) {
        pitchText = 'rest';
    } else if (beat.hasChord) {
        pitchText = `chord ${beat.chord.name}`;
    } else {
        pitchText = describeStrum(beat, stringCount)
            ?? beat.notes.map(note => describeNotePitch(note, stringCount)).join('; ');
    }

    const techniques = new Set();
    if (!beat.isRest && !beat.hasChord) {
        for (const note of beat.notes) {
            for (const technique of describeNoteTechniques(note)) techniques.add(technique);
        }
    }
    if (beat.vibrato) techniques.add(VIBRATO_NAMES[beat.vibrato] ?? 'vibrato');

    const durationText = durationName(beat.duration, beat.dots);
    const techniquesText = techniques.size > 0 ? `, ${[...techniques].join(', ')}` : '';
    return `${durationText}, ${pitchText}${techniquesText}`;
}

// Only the primary voice is described; secondary voices (used for genuinely
// polyphonic parts, e.g. independent piano hands) are not yet covered.
function extractMeasures(track) {
    const staff = track.staves && track.staves.length > 0 ? track.staves[0] : null;
    if (!staff) return [];
    const stringCount = staff.tuning ? staff.tuning.length : 0;

    return staff.bars.map(bar => ({
        beats: (bar.voices[0] ? bar.voices[0].beats : []).map(beat => describeBeat(beat, stringCount))
    }));
}

/**
 * What each string is actually tuned to, worked out from the pitches rather than trusting the
 * file's label.
 *
 * The label is optional and frequently just absent: a file can carry a non-standard tuning with
 * `tuningName` empty, in which case reporting the label alone says nothing is unusual when
 * something is. Since a wrong assumption of standard tuning makes every fret number in the
 * listing mean the wrong note, any deviation is called out explicitly and by how much.
 */
function describeTuning(staff) {
    if (!staff || !staff.isStringed || !staff.tuning || staff.tuning.length === 0) return null;

    const stringCount = staff.tuning.length;
    // alphaTab orders the array highest-pitched first; strings are named the other way round.
    const strings = [];
    for (let tabString = stringCount; tabString >= 1; tabString--) {
        const midi = staff.tuning[tabString - 1];
        const standard = STANDARD_TUNING_MIDI[tabString];
        const offset = stringCount === 6 && typeof standard === 'number' ? midi - standard : null;
        strings.push({ string: tabString, midi, note: midiToPitchName(midi), offset });
    }

    const altered = strings.filter(s => s.offset !== null && s.offset !== 0);
    const comparable = stringCount === 6 && strings.every(s => s.offset !== null);

    const semitones = n => `${Math.abs(n)} semitone${Math.abs(n) === 1 ? '' : 's'}`;
    let summary;
    if (!comparable) {
        summary = `${stringCount} strings: ` + strings.map(s => `${s.string} ${s.note}`).join(', ');
    } else if (altered.length === 0) {
        summary = 'Standard (E A D G B E)';
    } else {
        summary = strings.map(s => s.note.replace(/\d+$/, '')).join(' ') + ', non-standard: ' +
            altered.map(s => `string ${s.string} is ${s.note}, ` +
                `${semitones(s.offset)} ${s.offset > 0 ? 'above' : 'below'} standard`).join('; ');
    }

    return { summary, strings, isStandard: comparable && altered.length === 0, label: staff.tuningName || null };
}

function describeTrack(track) {
    const staff = track.staves && track.staves.length > 0 ? track.staves[0] : null;
    const isPercussion = track.isPercussion === true;

    return {
        name: track.name || '(untitled track)',
        instrument: isPercussion ? 'Percussion' : instrumentName(track.playbackInfo ? track.playbackInfo.program : 0),
        staffCount: track.staves ? track.staves.length : 0,
        isStringed: !!(staff && staff.isStringed),
        tuningName: staff && staff.isStringed ? staff.tuningName : null,
        tuning: describeTuning(staff),
        capo: staff && staff.capo > 0 ? staff.capo : null,
        measures: extractMeasures(track)
    };
}

export function extractScoreMetadata(score) {
    const masterBars = score.masterBars || [];
    const firstBar = masterBars.length > 0 ? masterBars[0] : null;

    const timeSignatureVaries = masterBars.some(
        bar => bar.timeSignatureNumerator !== firstBar.timeSignatureNumerator ||
            bar.timeSignatureDenominator !== firstBar.timeSignatureDenominator
    );
    const keySignatureVaries = masterBars.some(bar => bar.keySignature !== firstBar.keySignature);

    return {
        title: score.title || '(untitled)',
        artist: score.artist || null,
        album: score.album || null,
        tempo: score.tempo || null,
        barCount: masterBars.length,
        timeSignature: firstBar ? `${firstBar.timeSignatureNumerator}/${firstBar.timeSignatureDenominator}` : null,
        timeSignatureVaries,
        keySignature: firstBar ? keySignatureName(firstBar.keySignature) : null,
        keySignatureVaries,
        tracks: (score.tracks || []).map(describeTrack)
    };
}
