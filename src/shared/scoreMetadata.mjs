// Pure data extraction: turns an alphaTab `Score` object into a plain,
// JSON-serializable summary that the renderer can display. Kept free of
// alphaTab imports and DOM access so it can also run standalone for testing.

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

function describeBeat(beat, stringCount) {
    let pitchText;
    if (beat.isRest) {
        pitchText = 'rest';
    } else if (beat.hasChord) {
        pitchText = `chord ${beat.chord.name}`;
    } else {
        pitchText = beat.notes.map(note => describeNotePitch(note, stringCount)).join('; ');
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

function describeTrack(track) {
    const staff = track.staves && track.staves.length > 0 ? track.staves[0] : null;
    const isPercussion = track.isPercussion === true;

    return {
        name: track.name || '(untitled track)',
        instrument: isPercussion ? 'Percussion' : instrumentName(track.playbackInfo ? track.playbackInfo.program : 0),
        staffCount: track.staves ? track.staves.length : 0,
        isStringed: !!(staff && staff.isStringed),
        tuningName: staff && staff.isStringed ? staff.tuningName : null,
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
