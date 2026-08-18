// Pure data extraction: turns an alphaTab `Score` object into a plain,
// JSON-serializable summary that the renderer can display. Kept free of
// alphaTab imports and DOM access so it can also run standalone for testing.

import { PITCH_CLASSES, STANDARD_TUNING_MIDI, identifyChordFromNotes, midiToPitchName } from './musicTheory.mjs';

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

// What a tuplet is called when its denominator is the conventional partner of its numerator.
// Anything else is spelled out as a ratio rather than given a name nobody uses.
const TUPLET_NAMES = {
    2: { over: 3, name: 'duplet' }, 3: { over: 2, name: 'triplet' }, 4: { over: 3, name: 'quadruplet' },
    5: { over: 4, name: 'quintuplet' }, 6: { over: 4, name: 'sextuplet' },
    7: { over: 4, name: 'septuplet' }, 9: { over: 8, name: 'nonuplet' }
};

/**
 * How long the beat is, including any tuplet.
 *
 * The tuplet was missing, and its absence made the duration wrong rather than merely incomplete:
 * three sixteenth-note triplets occupy the time of two sixteenths, so calling each of them a
 * plain "sixteenth note" misstates both the note and the bar it sits in. Every tuplet in the
 * files tested is a 3:2 triplet, but the ratio is read rather than assumed.
 */
function durationName(duration, dots, numerator, denominator) {
    const base = DURATION_NAMES[duration] ?? `1/${duration}`;
    const dotPrefix = dots === 1 ? 'dotted ' : dots === 2 ? 'double-dotted ' : dots > 2 ? `${dots}-dotted ` : '';
    const name = `${dotPrefix}${base} note`;

    if (!(numerator > 0) || !(denominator > 0) || (numerator === 1 && denominator === 1)) return name;
    const known = TUPLET_NAMES[numerator];
    return known && known.over === denominator
        ? `${name} ${known.name}`
        : `${name}, ${numerator} in the time of ${denominator}`;
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

// alphaTab's TripletFeel. A swung song is written in straight notes and played long-short, so the
// notated durations alone are not what a player does with them.
const TRIPLET_FEEL_NAMES = {
    1: 'triplet sixteenths (swung)', 2: 'triplet eighths (swung)',
    3: 'dotted sixteenths', 4: 'dotted eighths',
    5: 'Scottish sixteenths (snapped)', 6: 'Scottish eighths (snapped)'
};

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

// The General MIDI percussion key map, which is what a drum note's articulation resolves to. Kept
// here rather than taken from alphaTab so this file stays free of alphaTab imports, the same
// reason the melodic instrument names above are spelled out.
const GENERAL_MIDI_PERCUSSION = {
    35: 'acoustic bass drum', 36: 'bass drum', 37: 'side stick', 38: 'acoustic snare',
    39: 'hand clap', 40: 'electric snare', 41: 'low floor tom', 42: 'closed hi-hat',
    43: 'high floor tom', 44: 'pedal hi-hat', 45: 'low tom', 46: 'open hi-hat',
    47: 'low-mid tom', 48: 'hi-mid tom', 49: 'crash cymbal 1', 50: 'high tom',
    51: 'ride cymbal 1', 52: 'china cymbal', 53: 'ride bell', 54: 'tambourine',
    55: 'splash cymbal', 56: 'cowbell', 57: 'crash cymbal 2', 58: 'vibraslap',
    59: 'ride cymbal 2', 60: 'high bongo', 61: 'low bongo', 62: 'muted high conga',
    63: 'open high conga', 64: 'low conga', 65: 'high timbale', 66: 'low timbale',
    67: 'high agogo', 68: 'low agogo', 69: 'cabasa', 70: 'maracas',
    71: 'short whistle', 72: 'long whistle', 73: 'short guiro', 74: 'long guiro',
    75: 'claves', 76: 'high wood block', 77: 'low wood block', 78: 'muted cuica',
    79: 'open cuica', 80: 'muted triangle', 81: 'open triangle'
};

/**
 * Which drum or cymbal a percussion note strikes.
 *
 * `note.percussionArticulation` is an index into the track's own articulation list, and each entry
 * carries both a name and the General MIDI number it sounds. The MIDI number is preferred because
 * the file's own names collapse distinctions a drummer needs: Guitar Pro calls 42, 44 and 46 all
 * "Charley", where the map has them as closed, pedal and open hi-hat, and calls both 37 and 38
 * "Snare" where one is a side stick.
 *
 * Without this a drum part was described by pitch -- "A#0" for a kick drum -- which is not what
 * the file says and is nothing a player can act on.
 */
function describePercussionNote(note, articulations) {
    const articulation = articulations[note.percussionArticulation];
    if (!articulation) return 'unnamed percussion';
    return GENERAL_MIDI_PERCUSSION[articulation.outputMidiNumber]
        // The file's own name, lowercased to sit with the rest, for anything outside the map:
        // electronic kits and hand percussion can carry articulations the map has no entry for.
        ?? (articulation.elementType ? articulation.elementType.toLowerCase() : 'unnamed percussion');
}

/**
 * AlphaTab numbers strings low-to-high (1 = low E). Guitarists and tab notation conventionally
 * number high-to-low (1 = high E), so we flip for display.
 *
 * A sung note is given as a pitch instead. Guitar Pro models a vocal line on a six-string staff
 * like everything else, so the notes carry a string and a fret, but nobody sings fret 3 of string
 * 2. The pitch is the note, and it is what the words are hung on.
 */
function describeNotePitch(note, stringCount, percussion, sung) {
    if (note.isStringed && !sung) {
        const conventionalString = stringCount - note.string + 1;
        if (note.isDead) return `string ${conventionalString}, muted (X)`;
        if (note.fret === 0) return `string ${conventionalString}, open`;
        return `string ${conventionalString}, fret ${note.fret}`;
    }
    if (percussion) return describePercussionNote(note, percussion);
    return pitchName(note.realValue);
}

// Chord qualities a player reading a strum would recognise. Identification can technically name
// any set of notes, but calling six open strings "G69" tells a guitarist less than listing the
// strings does, so only the everyday qualities stand in for a string-by-string reading.
const RECOGNIZED_STRUM_SUFFIXES = new Set([
    'major', 'minor', '5', 'sus2', 'sus4', '7', 'maj7', 'm7', 'm7b5',
    'dim', 'dim7', 'aug', '6', 'm6', 'add9', 'madd9', '9', 'm9', 'maj9', 'mmaj7'
]);

// alphaTab's BrushType and PickStroke: the only places a Guitar Pro file actually states which
// way the pick travelled. Guitar Pro's "down" sounds the lowest-pitched string first, which is
// what a guitarist means by a down stroke. Confirmed against alphaTab's own MIDI generation,
// where BrushDown gives string 1 -- the low E in its numbering -- the zero offset.
const BRUSH_NONE = 0, BRUSH_UP = 1, BRUSH_DOWN = 2, ARPEGGIO_UP = 3, ARPEGGIO_DOWN = 4;
const PICK_NONE = 0, PICK_UP = 1, PICK_DOWN = 2;

/**
 * The stroke the file states, or null where it states none.
 *
 * The order the notes are listed in is deliberately not consulted. It looks like a signal and is
 * not one: GP3-5 store a beat's notes as a bitmask of strings, which has no order at all, and the
 * GPIF formats store an order each exporter writes to its own convention. One song exported twice
 * lists 30 of its beats in opposite order, and the single beat in our files that does state a
 * stroke has its notes listed the other way round. See scripts/gp-experiment/gpParsingFindings.md.
 */
function statedStroke(beat) {
    switch (beat.brushType ?? BRUSH_NONE) {
        case BRUSH_UP: return { text: 'up stroke', lowestFirst: false };
        case BRUSH_DOWN: return { text: 'down stroke', lowestFirst: true };
        case ARPEGGIO_UP: return { text: 'arpeggiated up stroke', lowestFirst: false };
        case ARPEGGIO_DOWN: return { text: 'arpeggiated down stroke', lowestFirst: true };
    }
    switch (beat.pickStroke ?? PICK_NONE) {
        case PICK_UP: return { text: 'up stroke', lowestFirst: false };
        case PICK_DOWN: return { text: 'down stroke', lowestFirst: true };
    }
    return null;
}

/**
 * Names a beat that sounds one unmistakable chord, e.g. "A, strings 1 through 5".
 *
 * Tablature often writes a chord out string by string, leaving the reader to recognise the shape.
 * Where the notes spell exactly one everyday chord this says so instead, which is both shorter to
 * listen to and more useful than five string-and-fret pairs.
 *
 * Identification works from the pitches sounded, not from a stored shape, so it is indifferent to
 * how the chord is fingered: a barred B minor is named the same as any other B minor, and an
 * altered tuning makes no difference. A capo is taken back off the pitches first, so the name is
 * in the same frame as the fret numbers beside it, which are themselves counted from the capo,
 * and in the same frame as the file's own chord symbols: a capo VII track fingering a C shape is
 * labelled C in the file even though it sounds G. Without this the chords a track uses cannot be
 * listed at all, since the file's symbols and our own readings would name the same shape
 * differently and both would appear.
 *
 * Where the same notes spell a second chord as well, that reading follows in parentheses, e.g.
 * "Em7 (G6)".
 *
 * A stroke direction is given only where the file states one. Where it does not, nothing is said:
 * the direction is genuinely absent from the file, and a guitarist reading the printed tab does
 * not learn it either.
 *
 * Returns null, leaving the strings listed, when naming the beat would say less than the strings do:
 * - notes that do not spell a complete chord, such as the top three strings of a G, which give
 *   only G and B: a genuine part-chord the player needs told string by string
 * - notes that spell only chords outside everyday use, where a name would be more work to
 *   interpret than the frets it replaced
 * - notes that leave a gap in the middle, skipping a string the file says nothing about. A pick
 *   cannot cross a string without sounding it, so those notes were plucked rather than swept, and
 *   a run of strings would be the wrong thing to report. A string the file explicitly marks muted
 *   does not break the run: muting a string and playing through it is exactly how chords like
 *   these are played, so the gap is accounted for.
 *
 * Returns `{ text, name, root, suffix }`. The name is the plain chord without its bass, and root
 * and suffix are what the chord library is keyed by, so a beat's reading can be looked up there.
 */
function describeChordedBeat(beat, stringCount, terse, capo) {
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
    // point of naming a chord is to be quicker to take in than the strings it replaces.
    const readings = identifyChordFromNotes(sounding.map(note => note.realValue - capo))
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

    const stroke = statedStroke(beat);
    const strokeText = stroke ? `, ${stroke.text}` : '';

    // Which strings to play, which the name only implies. A chord name and its bass do narrow it
    // down against a shape the player already knows, but the same chord is voiced in more than
    // one position, so the run is given outright.
    //
    // The strings that sound are what bound it. A muted string at either end is struck to no
    // effect, so it is indistinguishable from not playing that string and is left unsaid: a full
    // sweep with string 6 deadened is simply strings 1 through 5.
    const soundingStrings = sounding.map(tabString);
    const low = Math.min(...soundingStrings);
    const high = Math.max(...soundingStrings);
    // Where the file states the stroke, the run is given in the order the pick travels: a down
    // stroke starts at the lowest-pitched string, which carries the highest string number.
    // Otherwise it is only a range, counted the way string numbers run.
    const [from, to] = stroke && stroke.lowestFirst ? [high, low] : [low, high];
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

    // A player who knows the shape gets the strings and the mutes from the chord name, so with
    // terse descriptions those are dropped. A stated stroke stays: it is two syllables and is not
    // recoverable from the name, unlike everything else being left out here.
    const text = terse
        ? `${chordText}${strokeText}`
        : `${chordText}, ${rangeText}${strokeText}${mutedText}`;

    return { text, name: primary.name, root: primary.root, suffix: primary.suffix };
}

/**
 * A beat's chord symbol is the name Guitar Pro prints above the staff, and it belongs to the
 * measure rather than to the beat it happens to be anchored to -- see `describeChordSymbols`. So
 * nothing about it appears here: this describes what the beat plays, and only that.
 */
function describeBeat(beat, stringCount, terse, capo, percussion, sung, letRing, textPromoted) {
    let pitchText;
    if (beat.isRest) {
        pitchText = 'rest';
    } else {
        // Only a beat that names a chord can be shortened. A beat listed string by string has no
        // name to fall back on, so terse descriptions leave it exactly as it was. A sung beat is
        // never named as a chord: two notes of a vocal harmony are a harmony, not a power chord.
        pitchText = (sung ? null : describeChordedBeat(beat, stringCount, terse, capo)?.text)
            ?? beat.notes.map(note => describeNotePitch(note, stringCount, percussion, sung)).join('; ');

        // The syllable this note carries. The measure's words are assembled above the beats, so
        // this is not the way to read the lyric; it is what says which note each syllable lands
        // on, which is the part a singer cannot get from the words alone.
        const syllables = beatSyllables(beat);
        if (syllables.length > 0) pitchText += `, "${syllables.join(' ')}"`;
    }

    const techniques = new Set();
    if (!beat.isRest) {
        for (const note of beat.notes) {
            for (const technique of describeNoteTechniques(note)) techniques.add(technique);
        }
    }
    if (beat.vibrato) techniques.add(VIBRATO_NAMES[beat.vibrato] ?? 'vibrato');
    if (letRing) techniques.add(letRing);

    // What the score has written above the beat. It ranges from a one-word instruction to the
    // player to something the whole track depends on -- Pink Houses opens with "All Guitars tune
    // to Open G", without which every fret number on that track means the wrong note -- so it is
    // given verbatim rather than summarised or dropped. The exception is text that was a section
    // name in disguise: it now heads the measure, and saying it twice is noise.
    const textNote = beat.text && !textPromoted ? `, text "${beat.text}"` : '';

    const durationText = durationName(
        beat.duration, beat.dots,
        beat.hasTuplet ? beat.tupletNumerator : 0,
        beat.hasTuplet ? beat.tupletDenominator : 0
    );
    const techniquesText = techniques.size > 0 ? `, ${[...techniques].join(', ')}` : '';
    return `${durationText}, ${pitchText}${techniquesText}${textNote}`;
}

/**
 * Where each run of let-ring notes starts and stops, one entry per beat.
 *
 * Let ring is notated as a bracket over a passage, and the file marks every note under it. Saying
 * so on every beat would be 2846 repetitions across the files tested, most of them in runs eight
 * beats long, and one track carries it almost throughout. Marking the two ends of each run says
 * the same thing in 348 places instead, and matches how it is written.
 */
function letRingMarks(beats) {
    const held = beats.map(beat => !beat.isRest && beat.notes.some(note => note.isLetRing));
    return held.map((on, index) => {
        if (!on) return null;
        const starts = !held[index - 1];
        const stops = !held[index + 1];
        if (starts && stops) return 'let ring';
        if (starts) return 'let ring begins';
        return stops ? 'let ring ends' : null;
    });
}

// Pitches carry the capo; fret numbers and the file's chord symbols do not. Chord naming works in
// the fingered frame, so the capo comes back off before anything is identified.
const staffCapo = staff => (staff.capo > 0 ? staff.capo : 0);

/**
 * The chord symbols printed over a measure, as a phrase for its heading, or null for none.
 *
 * A chord symbol is a property of the measure, not of the note it is attached to. Guitar Pro
 * anchors it to a beat because it has to anchor it to something, but what it means is "the
 * harmony here is this", and it is written where the harmony changes. Into Dust makes that plain:
 * 82 symbols over 116 bars of fingerpicking, one per bar at most, each on the bar where the
 * chord turns over. Reported on the beat, a D that governs four bars arrived as a footnote to one
 * eighth note of the first, which is both easy to miss and the wrong thing to attach it to.
 *
 * Every symbol is placed by beat, including the overwhelming majority that fall on beat 1: 167 of
 * the 169 across the files tested. Stating it even when it is not news is what makes a measure
 * carrying two of them read the same as one carrying a single symbol, rather than the reader
 * having to notice that a position has appeared. Nothing in these formats stops an author writing
 * a chord change on every beat, and a heading is worth a few extra words if it saves opening the
 * measure and walking its beats to find where the second chord starts.
 *
 * Position is counted in beats of the time signature, not in notes played, since a bar of eight
 * eighth notes still has four beats. A symbol landing between beats -- Into Dust has one a triplet
 * in -- is placed by the beat it falls inside, "during beat 1" rather than "at beat 1", so it is
 * not confused with one squarely on the beat.
 */
function describeChordSymbols(bar, masterBar) {
    const beats = bar.voices[0] ? bar.voices[0].beats : [];
    const found = [];
    for (const beat of beats) {
        if (beat.isRest || !beat.hasChord || !beat.chord || !beat.chord.name) continue;
        found.push({ name: beat.chord.name, start: beat.playbackStart || 0 });
    }
    if (found.length === 0) return null;

    const denominator = masterBar ? masterBar.timeSignatureDenominator || 4 : 4;
    const ticksPerBeat = 960 * (4 / denominator);

    const describe = symbol => {
        const beatNumber = symbol.start / ticksPerBeat + 1;
        return Number.isInteger(beatNumber)
            ? `${symbol.name} at beat ${beatNumber}`
            : `${symbol.name} during beat ${Math.floor(beatNumber)}`;
    };

    return `chord symbol${found.length === 1 ? '' : 's'} ${found.map(describe).join(', ')}`;
}

/** Every syllable a beat carries. The array holds one entry per lyric line; only the first is
 *  used by any file tested, but they are all taken rather than assuming that holds. */
function beatSyllables(beat) {
    return (beat.lyrics ?? []).filter(syllable => typeof syllable === 'string' && syllable.trim() !== '');
}

function trackSings(track) {
    for (const staff of track.staves || []) {
        for (const bar of staff.bars || []) {
            for (const voice of bar.voices || []) {
                for (const beat of voice.beats || []) if (beatSyllables(beat).length > 0) return true;
            }
        }
    }
    return false;
}

/**
 * Joins a measure's syllables back into words.
 *
 * Guitar Pro stores one syllable per note, and a trailing hyphen is what says the word carries on
 * to the next one: two beats holding "hea-" and "ven" are one word. About a fifth of the syllables
 * in the files tested are hyphenated, so read out one at a time they are close to unintelligible,
 * where a measure's worth joined up is a readable line of eight or nine words.
 */
function joinSyllables(syllables) {
    let line = '';
    for (const syllable of syllables) {
        if (line.endsWith('-')) line = line.slice(0, -1) + syllable;
        else line = line === '' ? syllable : `${line} ${syllable}`;
    }
    return line;
}

/**
 * What to call each singing track, when a song has more than one.
 *
 * Songsterr names a track by pipe-separated parts -- "David Gilmour | Lead Vocals" -- so the
 * useful label is whichever parts actually differ between the singers. Mother has two people
 * singing the same role, and differs in the first part, giving "David Gilmour" and "Roger Waters".
 * Wish You Were Here has one person in two roles, and differs in the second, giving "Lead Vocals"
 * and "Backing Vocals". Taking the differing parts gets both right without knowing which is which.
 *
 * A song with one singing track needs no label at all, and names that share no structure fall back
 * to the whole track name.
 */
function labelSingingTracks(tracks) {
    if (tracks.length < 2) return new Map(tracks.map(track => [track, null]));

    const parts = tracks.map(track => (track.name || '').split('|').map(part => part.trim()));
    const partCount = Math.max(...parts.map(p => p.length));
    const differing = [];
    for (let i = 0; i < partCount; i++) {
        if (new Set(parts.map(p => p[i] ?? '')).size > 1) differing.push(i);
    }

    return new Map(tracks.map((track, index) => {
        const label = differing.map(i => parts[index][i] ?? '').filter(Boolean).join(' ');
        return [track, label || track.name || null];
    }));
}

/**
 * The words sung over each measure, as a line per singing track, indexed by measure.
 *
 * Lyrics sit on the singing track, but they belong to the song: they are the best landmark there
 * is for knowing where you are, and a guitarist reading the guitar part had no access to them at
 * all. So they are gathered here once and handed to every track, the way sections are.
 *
 * Each singing track gets its own line rather than being merged into one. Mother is sung by two
 * people in call and response, and running their words together would lose who sings what and
 * make a long line longer.
 */
function extractSongLyrics(score) {
    const singing = (score.tracks || []).filter(trackSings);
    if (singing.length === 0) return [];

    const labels = labelSingingTracks(singing);
    const byMeasure = [];

    for (const track of singing) {
        const staff = track.staves && track.staves.length > 0 ? track.staves[0] : null;
        if (!staff) continue;
        const label = labels.get(track);

        (staff.bars || []).forEach((bar, index) => {
            const syllables = [];
            for (const voice of bar.voices || []) {
                for (const beat of voice.beats || []) syllables.push(...beatSyllables(beat));
            }
            if (syllables.length === 0) return;
            if (!byMeasure[index]) byMeasure[index] = [];
            byMeasure[index].push(`Words${label ? `, ${label}` : ''}: ${joinSyllables(syllables)}`);
        });
    }

    return byMeasure;
}

const ORDINALS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

/**
 * What a measure does to the playing order: starts a repeat, ends one, or is an alternate ending.
 *
 * The measure list runs straight through from 1 to the end, which is not the order the song is
 * played when it repeats. Ripple doubles back twice, with a first and second ending each time,
 * and nothing said so. This does not reorder anything -- it reports what the score marks, which
 * is what a sighted player reads off the barlines.
 *
 * `alternateEndings` is a bit per ending, so a bar played on both the first and second time
 * through has two bits set.
 */
function describeRepeat(masterBar) {
    if (!masterBar) return null;
    const parts = [];

    if (masterBar.alternateEndings) {
        const endings = [];
        for (let bit = 0; bit < 8; bit++) {
            if (masterBar.alternateEndings & (1 << bit)) endings.push(ORDINALS[bit]);
        }
        if (endings.length > 0) parts.push(`${endings.join(' and ')} ending`);
    }
    if (masterBar.isRepeatStart) parts.push('repeat starts here');
    // repeatCount is how many times the passage is played in total, counting the first pass.
    if (masterBar.repeatCount > 0) {
        parts.push(masterBar.repeatCount > 1
            ? `repeat ends here, played ${masterBar.repeatCount} times`
            : 'repeat ends here');
    }

    return parts.length === 0 ? null : parts.join(', ');
}

/**
 * The name of the section starting at this measure, e.g. "Verse 2", or null.
 *
 * Guitar Pro marks a section on the bar it begins, so this is set on that bar alone and stays null
 * for the rest of the section. Seven of the eleven Songsterr files tested carry them and they are
 * the structure of the song: Intro, Verse 1, Guitar Solo 2, Chorus, Outro. A measure list without
 * them is a hundred numbered rows with nothing to say which is the chorus.
 *
 * Sections live on the master bar, so every track of a song shares them.
 *
 * `text` is what those files fill in; `marker` is a short label Guitar Pro can show instead and is
 * empty throughout the corpus, so it is only a fallback.
 */
function describeSection(masterBar) {
    const section = masterBar ? masterBar.section : null;
    if (!section) return null;
    const name = (section.text || section.marker || '').trim();
    return name === '' ? null : name;
}

/**
 * The words that name a part of a song, as opposed to telling the player how to play something.
 *
 * Kept deliberately narrow. `beat.text` is a free field and the corpus shows it used for at least
 * four unrelated purposes -- a tuning instruction, an amp setting, a dedication, and one file's
 * entire lyric -- so anything not on this list stays where the file put it.
 */
const SECTION_NOUNS = [
    'intro', 'outro', 'verse', 'chorus', 'pre-chorus', 'prechorus', 'bridge', 'solo',
    'interlude', 'break', 'refrain', 'coda', 'ending', 'tag', 'vamp', 'head', 'instrumental'
];

// What a section noun is allowed to be qualified by, which in practice is which instrument takes
// it: "Guitar Solo 1" in Wish You Were Here.
const SECTION_MODIFIERS = [
    'guitar', 'bass', 'drum', 'drums', 'piano', 'keyboard', 'keys', 'organ', 'sax', 'saxophone',
    'harmonica', 'lead', 'rhythm', 'acoustic', 'electric', 'violin', 'cello', 'mandolin',
    'banjo', 'fiddle', 'slide', 'vocal'
];

// "End Intro", "Guitar Solo 2", "Verse III". The number may be arabic or roman, since the same
// transcriber writes "Verse 1" in one file and "Verse II" in another. Matched against text whose
// whitespace has already been collapsed to single spaces, so a literal space is enough here.
const SECTION_PATTERN = new RegExp(
    `^(?:(?:end|start|begin) )?(?:(?:${SECTION_MODIFIERS.join('|')}) )?` +
    `(?:${SECTION_NOUNS.join('|')})(?: (?:[0-9]{1,2}|[ivx]{1,5}))?$`
);

/**
 * The beat text as written if it names a section, or null if it is anything else.
 *
 * Returns the original spelling rather than the matched form: the file's own "Verse II" is what
 * the player sees on the page, and normalising it to "verse 2" would be us rewriting the score.
 */
function structuralLabel(text) {
    if (typeof text !== 'string') return null;
    // Brackets and trailing punctuation are decoration around the same word: "[Intro]", "Outro:".
    const trimmed = text.split(/\s+/).join(' ').trim()
        .replace(/^[[({]+/, '')
        .replace(/[)}\].:;,]+$/, '')
        .trim();
    if (trimmed === '') return null;
    return SECTION_PATTERN.test(trimmed.toLowerCase()) ? trimmed : null;
}

const ROMAN_VALUES = { i: 1, v: 5, x: 10 };

/**
 * Two ways of writing the same section, reduced to one string.
 *
 * The 2009 Pink Houses marks bar 10 as "Verse 1" and writes "Verse I" on the beat inside it. They
 * are the same section named twice, so the numbering is normalised to compare them: case, spacing
 * and roman numerals all vary between files by the same transcriber. Only used for comparison --
 * what gets read out is always the file's own spelling.
 */
function normalizedSection(label) {
    if (!label) return null;
    const words = label.toLowerCase().split(/\s+/).filter(Boolean);
    const last = words[words.length - 1];
    if (words.length > 1 && /^[ivx]+$/.test(last)) {
        // Standard subtractive form, which is all a section number is ever written in.
        let total = 0;
        for (let i = 0; i < last.length; i++) {
            const value = ROMAN_VALUES[last[i]];
            const next = i + 1 < last.length ? ROMAN_VALUES[last[i + 1]] : 0;
            total += value < next ? -value : value;
        }
        words[words.length - 1] = String(total);
    }
    return words.join(' ');
}

/**
 * Section names that the file wrote as beat text instead of as section markers, gathered for the
 * whole song.
 *
 * Guitar Pro offers a transcriber two separate places to write "Intro": a section marker on the
 * bar, which belongs to the song and which every track shares, and a text annotation stuck to one
 * note on one track. They are not interchangeable in the file, but transcribers use them
 * interchangeably. Ripple carries no section markers at all -- its Intro, End Intro and Outro are
 * beat text on the Acoustic Lead -- so a reader moving by heading finds a hundred numbered
 * measures and no structure, while the same publisher's other files have it.
 *
 * Promoting text to a heading is a guess about what the transcriber meant, so it is fenced three
 * ways, each of which a real file in the corpus fails:
 *
 * 1. The bar must not already carry a section marker. Where a file has both, they overlap rather
 *    than agree: the 2009 Pink Houses marks six sections and writes eight as beat text, and this
 *    keeps the six it marked while gaining the Interlude, Chorus and Outro it did not.
 * 2. The text must name a section. Wish You Were Here writes amp settings on beats, Mother writes
 *    "rake", and Pink Houses opens with the tuning the whole track depends on. None are structure
 *    and all must stay on their beat.
 * 3. The track must not carry beat text in bulk. Falling Slowly stores its entire lyric this way,
 *    185 texts over 59 bars. A track writing on nearly every beat is not labelling structure,
 *    whatever the individual words happen to say.
 *
 * Returns the labels by measure index, and the set of beats they came from, so the beat itself
 * can stop repeating what is now in the heading above it.
 */
function extractPromotedSections(score, masterBars) {
    const byMeasure = [];
    const beats = new Set();
    // Roughly one label every eight bars is generous for real structure -- the corpus's densest
    // is one per 12 bars -- and nowhere near a lyric. The floor keeps a short song workable.
    const limit = Math.max(3, masterBars.length / 8);

    for (const track of score.tracks || []) {
        for (const staff of track.staves || []) {
            // Only the primary voice, matching what the measure list describes.
            const texts = [];
            (staff.bars || []).forEach((bar, index) => {
                const voice = bar.voices && bar.voices.length > 0 ? bar.voices[0] : null;
                for (const beat of (voice ? voice.beats : []) || []) {
                    if (beat.text) texts.push({ index, beat });
                }
            });
            if (texts.length === 0 || texts.length > limit) continue;

            for (const { index, beat } of texts) {
                const label = structuralLabel(beat.text);
                if (!label) continue;

                const marked = describeSection(masterBars[index]);
                if (marked) {
                    // The bar keeps its own marker. Where the beat was saying the same thing in
                    // different words, it stops saying it: the heading above already has it.
                    if (normalizedSection(marked) === normalizedSection(label)) beats.add(beat);
                    continue;
                }

                const entry = `${label}${sectionBeatPosition(beat, masterBars[index])}`;
                if (!byMeasure[index]) byMeasure[index] = [];
                // Two tracks may carry the same label on the same bar; it is one section.
                if (!byMeasure[index].includes(entry)) byMeasure[index].push(entry);
                beats.add(beat);
            }
        }
    }

    return { byMeasure: byMeasure.map(labels => (labels ? labels.join(', ') : null)), beats };
}

/**
 * Where in the measure a promoted label sits, phrased as chord symbols already phrase it.
 *
 * A section marker can only fall on a barline, but beat text lands wherever the note it is
 * attached to lands, and it means something different there: Ripple's "End Intro" is on the and
 * of three in bar 18, not at the top of it. Saying nothing for the first beat keeps the common
 * case short.
 */
function sectionBeatPosition(beat, masterBar) {
    const denominator = masterBar ? masterBar.timeSignatureDenominator || 4 : 4;
    const ticksPerBeat = 960 * (4 / denominator);
    const beatNumber = (beat.playbackStart || 0) / ticksPerBeat + 1;
    if (beatNumber === 1) return '';
    return Number.isInteger(beatNumber)
        ? ` at beat ${beatNumber}`
        : ` during beat ${Math.floor(beatNumber)}`;
}

// Only the primary voice is described; secondary voices (used for genuinely
// polyphonic parts, e.g. independent piano hands) are not yet covered.
function extractMeasures(track, terse, masterBars, songLyrics, promotedSections) {
    const staff = track.staves && track.staves.length > 0 ? track.staves[0] : null;
    if (!staff) return [];
    const stringCount = staff.tuning ? staff.tuning.length : 0;
    const capo = staffCapo(staff);
    const percussion = track.isPercussion ? (track.percussionArticulations ?? []) : null;
    const sung = trackSings(track);

    // Let ring runs across bar lines, so the marks are worked out over the whole track at once and
    // handed back to each bar by position.
    const barBeats = staff.bars.map(bar => (bar.voices[0] ? bar.voices[0].beats : []));
    const marks = letRingMarks(barBeats.flat());
    let seen = 0;

    return staff.bars.map((bar, index) => {
        const beats = barBeats[index];
        const offset = seen;
        seen += beats.length;
        return {
            // A marker the file actually placed always wins; a name lifted out of beat text only
            // fills a bar that has none. See `extractPromotedSections`.
            section: describeSection(masterBars[index]) ?? promotedSections.byMeasure[index] ?? null,
            repeat: describeRepeat(masterBars[index]),
            chordSymbols: describeChordSymbols(bar, masterBars[index]),
            lyrics: songLyrics[index] ?? [],
            beats: beats.map((beat, i) =>
                describeBeat(beat, stringCount, terse, capo, percussion, sung, marks[offset + i],
                    promotedSections.beats.has(beat)))
        };
    });
}

/**
 * What makes two chord names the same chord, for the purpose of listing which a track uses.
 *
 * Not the printed name, which was the bug: Sister Golden Hair is in A, so the file spells a chord
 * G#m and we identify the same notes as Abm, and both appeared in the list with the symbol's
 * thirteen beats counted twice. The root is reduced to a pitch class, which makes those one entry.
 *
 * A bass note is dropped too. C and C/G are one chord to learn, and which note is underneath is a
 * property of the beat rather than of the chord the track is built from.
 */
function chordIdentity(name) {
    const withoutBass = String(name).trim().split('/')[0];
    const match = /^([A-G][#b]?)(.*)$/.exec(withoutBass);
    const pitchClass = match ? PITCH_CLASSES[match[1]] : undefined;
    // Anything we cannot read as a chord name keys on itself, so it is neither merged nor lost.
    return pitchClass === undefined ? `name:${name}` : `${pitchClass}|${match[2].trim().toLowerCase()}`;
}

/**
 * Every chord the track uses, the ones it is actually built from first.
 *
 * Two sources, because neither covers a track on its own. The file's own chord symbols are the
 * authority where they exist, but a file labels only what its author chose to: the lead track of
 * Ripple prints one symbol across a hundred bars of arrangement. So beats the parser can name from
 * their notes count too, which is what makes the list useful on a part that carries no symbols at
 * all, like the mandolin.
 *
 * Both sources have to be in the same frame or the same shape is listed twice under two names.
 * Symbols are always as fingered, so identification is too -- see describeChordedBeat.
 *
 * Only the plain chord is kept, never its bass: a C and a C/G are one chord to learn, and the
 * inversion is a property of the beat rather than of the chord the track uses. `root` and `suffix`
 * are what the chord library is keyed by, and are null for a symbol the parser did not also
 * identify, since a printed name alone does not say how the library spells it.
 */
function extractTrackChords(track) {
    const staff = track.staves && track.staves.length > 0 ? track.staves[0] : null;
    if (!staff || !staff.isStringed) return [];
    const stringCount = staff.tuning ? staff.tuning.length : 0;
    const capo = staffCapo(staff);

    const chords = new Map();
    const add = (name, root, suffix, fromSymbol) => {
        const key = chordIdentity(name);
        const existing = chords.get(key);
        if (existing) {
            existing.beats++;
            // A symbol beat and an identified beat can name the same chord. Whichever arrives with
            // root and suffix fills them in, so the library can be reached either way.
            if (root && !existing.root) { existing.root = root; existing.suffix = suffix; }
            // The file's own spelling wins for display: it is following the key signature and we
            // are not, so a song in A gets G#m rather than our Abm.
            if (fromSymbol && !existing.fromSymbol) existing.name = name;
            if (fromSymbol) existing.fromSymbol = true;
            return;
        }
        chords.set(key, { name, root: root ?? null, suffix: suffix ?? null, beats: 1, fromSymbol });
    };

    for (const bar of staff.bars || []) {
        for (const beat of (bar.voices[0] ? bar.voices[0].beats : [])) {
            if (beat.isRest) continue;
            if (beat.hasChord && beat.chord && beat.chord.name) {
                add(beat.chord.name, null, null, true);
            }
            // Identification runs on symbol beats too, so the list does not depend on which beats
            // their author happened to label.
            const reading = describeChordedBeat(beat, stringCount, true, capo);
            if (reading) add(reading.name, reading.root, reading.suffix, false);
        }
    }

    // Ordered by how much of the track each chord accounts for, not by where it first appears.
    // A strummed part throws off fragments -- two strings of a C read as C5, a passing tone that
    // completes an Em7 for one beat -- and those are real readings of those beats but are not what
    // the track is built from. Ripple's capo part spells its five chords across 450 beats and
    // seven fragments across ten, so frequency puts the useful answer at the top and leaves the
    // rest below it rather than filtering out beats the file really does contain. The beat count
    // travels with each chord so a 208-beat C is distinguishable from a one-beat oddity.
    return [...chords.values()].sort((a, b) => b.beats - a.beats);
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

function describeTrack(track, terse, masterBars, songLyrics, promotedSections) {
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
        chords: extractTrackChords(track),
        measures: extractMeasures(track, terse, masterBars, songLyrics, promotedSections)
    };
}

/**
 * @param score an alphaTab Score
 * @param options.terseBeats  Shorten named strums to the chord and the stroke direction, leaving
 *   out the string range and any muted strings. For a player who already knows the shapes those
 *   are recoverable from the name, and every beat is one line a screen reader has to read.
 */
export function extractScoreMetadata(score, { terseBeats = false } = {}) {
    const masterBars = score.masterBars || [];
    const firstBar = masterBars.length > 0 ? masterBars[0] : null;

    const timeSignatureVaries = masterBars.some(
        bar => bar.timeSignatureNumerator !== firstBar.timeSignatureNumerator ||
            bar.timeSignatureDenominator !== firstBar.timeSignatureDenominator
    );
    const keySignatureVaries = masterBars.some(bar => bar.keySignature !== firstBar.keySignature);

    // A tempo automation sits on the bar it takes effect from, and there is normally one on bar 1
    // stating the tempo the song already reports. Only a different value is a change: Sister
    // Golden Hair slows from 120 to 100 and then to 80 over its last two bars, a ritard into the
    // ending that the single tempo figure said nothing about.
    const tempos = new Set();
    for (const bar of masterBars) {
        for (const automation of bar.tempoAutomations ?? []) tempos.add(automation.value);
    }
    if (score.tempo) tempos.add(score.tempo);
    const tempoVaries = tempos.size > 1;

    // Triplet feel is a property of the bar, and every bar of a song that has it normally carries
    // it. It changes how every pair of notes at that level is played, so it belongs with the time
    // signature rather than being discoverable only by ear.
    const feels = new Set();
    for (const bar of masterBars) if (bar.tripletFeel) feels.add(bar.tripletFeel);
    const feel = feels.size === 0 ? null
        : [...feels].map(value => TRIPLET_FEEL_NAMES[value] ?? `feel ${value}`).join(', ') +
            (feels.size === 1 && masterBars.every(bar => bar.tripletFeel) ? '' : ' (in part of the song)');

    // Gathered once for the whole song, then given to every track: the words are the clearest
    // landmark in a hundred measures, and the track carrying them is rarely the one being read.
    const songLyrics = extractSongLyrics(score);

    // Likewise gathered once for the whole song: a section name written as beat text sits on one
    // track, but it names a part of the song, so every track's measure heading gets it.
    const promotedSections = extractPromotedSections(score, masterBars);

    return {
        title: score.title || '(untitled)',
        artist: score.artist || null,
        album: score.album || null,
        tempo: score.tempo || null,
        tempoVaries,
        feel,
        barCount: masterBars.length,
        timeSignature: firstBar ? `${firstBar.timeSignatureNumerator}/${firstBar.timeSignatureDenominator}` : null,
        timeSignatureVaries,
        keySignature: firstBar ? keySignatureName(firstBar.keySignature) : null,
        keySignatureVaries,
        tracks: (score.tracks || []).map(track =>
            describeTrack(track, terseBeats, masterBars, songLyrics, promotedSections))
    };
}
