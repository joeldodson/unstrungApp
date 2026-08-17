// Turns a parsed alphaTab `Score` into a flat, playable note timeline.
//
// Works from the data model rather than the rendered HTML, so nothing here depends on how the
// song is displayed. Kept free of alphaTab imports (it only reads the object it is handed) so
// it can run standalone for testing, like scoreMetadata.mjs.

// alphaTab's tick resolution: a quarter note is 960 ticks, so a 4/4 bar is 3840.
export const TICKS_PER_QUARTER = 960;

// --- How notated music becomes audible guitar -----------------------------------------
// These rules apply to every supported file format, not just one song.
//
// THE FILE ALWAYS WINS. Everything below is a choice of last resort, used only where the score
// is silent about how something should be played. Where a file states a chord's fingering, a
// strum direction, a dynamic or a tempo, that is what gets played, and no guideline here
// overrides it. As support for more of what these formats can express is added, each new piece
// of real information should take its place ahead of the corresponding fallback.
//
// 1. A beat with more than one note is a strum, whether or not the file labels it a chord.
//    Its notes are sounded one after another, STRUM_STRING_DELAY_SECONDS apart, the way a pick
//    crosses the strings rather than hitting them all at once.
//
// 2. The direction of the strum comes from brushType or pickStroke, and from nothing else. Where
//    the file states neither, the strum sweeps from the lowest-pitched string upward: the
//    downstroke, which is what an unmarked strum means in notation, and what rule 3 below already
//    does for a chord filled in from its name.
//
//    The order the notes happen to appear in the beat is NOT used, though it once was. It is not
//    a signal: GP3-5 store a beat's notes as a bitmask of strings, which cannot express an order
//    at all, and the GPIF formats store whatever order the exporter wrote. Exporting one song
//    twice put 30 of its beats in opposite order, and the one beat in our files that does state a
//    brush has its notes listed the other way round. See scripts/gp-experiment/gpParsingFindings.md.
//
// 3. A beat that carries a chord name sounds the whole chord. Tablature often writes only the
//    bass note under a chord symbol and leaves the rest to the player, so where a named beat
//    sounds fewer than CHORD_COMPLETION_MAX_NOTES notes the remaining strings are filled in and
//    the beat is strummed. Filling the chord in says nothing about which way the pick went, so
//    the direction is settled by rule 2 like any other strum.
//
//    The voicing comes from the song, not from a chord dictionary: for each chord name we take
//    the fullest voicing the piece itself ever writes out. A song may deliberately play a chord
//    somewhere other than open position, and picking a textbook shape instead would move it to
//    the wrong octave. If a song never spells a chord out, its sparse beats are left as written
//    rather than guessing a shape.
//
// 4. A beat with no chord name sounds exactly what it notates. Tablature routinely splits a
//    chord across beats, plucking the bass on one and strumming the upper strings on the next,
//    and that is a deliberate rhythm rather than an incomplete chord.
//
// 5. A note rings until that same string is struck again, then decays on its own. Notated
//    duration says when the next attack falls, not when the string stops sounding.
//
// 6. A tied note is not struck again: the note it continues is simply still ringing, which
//    rule 5 already provides.
export const STRUM_STRING_DELAY_SECONDS = 0.020;

// A named beat writing this many notes or fewer is treated as shorthand for the whole chord.
// Above it, the notation is being specific -- a five-note G that omits the top string means to
// leave that string out -- and is left alone.
export const CHORD_COMPLETION_MAX_NOTES = 2;

/**
 * Learns how this song voices each chord it names, by taking the fullest set of strings any beat
 * under that chord ever sounds. The chord name is carried forward from the beat that declares it
 * until the next one, the way a player reads the harmony along the staff.
 */
function learnChordVoicings(track) {
    const fullest = new Map();

    for (const staff of track.staves || []) {
        const staffStringCount = staff.tuning ? staff.tuning.length : 0;
        let currentChord = null;

        for (const bar of staff.bars || []) {
            for (const voice of bar.voices || []) {
                for (const beat of voice.beats || []) {
                    if (beat.hasChord && beat.chord && beat.chord.name) currentChord = beat.chord.name;
                    if (!currentChord || beat.isRest || beat.notes.length === 0) continue;

                    const shape = beat.notes
                        .filter(note => note.isStringed && typeof note.realValue === 'number' && !note.isDead)
                        .map(note => ({
                            string: staffStringCount - note.string + 1,
                            fret: note.fret,
                            midi: note.realValue
                        }));
                    if (shape.length === 0) continue;

                    const existing = fullest.get(currentChord);
                    if (!existing || shape.length > existing.length) {
                        // Strum order is string 6 down to string 1: a downstroke.
                        fullest.set(currentChord, [...shape].sort((a, b) => b.string - a.string));
                    }
                }
            }
        }
    }
    return fullest;
}

// alphaTab's DynamicValue enum is not a simple soft-to-loud ordering: it starts PPP=0..FFF=7 but
// then continues with PPPP=8..PPPPPP=10 and FFFF=11 onwards, plus accents like SF and SFZ. So the
// mapping onto our three recorded velocity layers is spelled out rather than compared by value,
// which would put the very softest dynamics in the loudest layer.
const VELOCITY_LAYER_BY_DYNAMIC = {
    0: 'p', 1: 'p', 2: 'p',            // PPP, PP, P
    8: 'p', 9: 'p', 10: 'p',           // PPPP, PPPPP, PPPPPP
    3: 'mf', 4: 'mf',                  // MP, MF
    23: 'mf', 24: 'mf',                // N, PF
    15: 'mf', 16: 'mf', 17: 'mf',      // SFP, SFPP, FP: loud attack into something softer
    25: 'mf',                          // SFZP
    5: 'f', 6: 'f', 7: 'f',            // F, FF, FFF
    11: 'f', 12: 'f', 13: 'f',         // FFFF, FFFFF, FFFFFF
    14: 'f', 18: 'f', 19: 'f',         // SF, RF, RFZ
    20: 'f', 21: 'f', 22: 'f'          // SFZ, SFFZ, FZ
};

function velocityLayerFor(dynamics) {
    return VELOCITY_LAYER_BY_DYNAMIC[dynamics] ?? 'mf';
}

// alphaTab's BrushType and PickStroke, where a file bothers to state the stroke.
const BRUSH_NONE = 0, BRUSH_UP = 1, BRUSH_DOWN = 2, ARPEGGIO_UP = 3, ARPEGGIO_DOWN = 4;
const PICK_NONE = 0, PICK_UP = 1, PICK_DOWN = 2;

/**
 * The direction a strum should sweep, or null where the file states none.
 *
 * Guitar Pro's "down" sounds the lowest-pitched string first, which is what a guitarist means by a
 * downstroke. This was previously read the other way round. It is settled by alphaTab's own MIDI
 * generation, where BrushDown walks the tuning from index 0 upward and so gives string 1 -- the
 * lowest in alphaTab's numbering -- the zero offset, sounding it first.
 */
function statedStrumDirection(beat) {
    const brush = beat.brushType ?? BRUSH_NONE;
    if (brush === BRUSH_DOWN || brush === ARPEGGIO_DOWN) return 'lowToHigh';
    if (brush === BRUSH_UP || brush === ARPEGGIO_UP) return 'highToLow';

    const pick = beat.pickStroke ?? PICK_NONE;
    if (pick === PICK_DOWN) return 'lowToHigh';
    if (pick === PICK_UP) return 'highToLow';
    return null;
}

/**
 * How long to leave between one string of a sweep and the next, in seconds.
 *
 * A file that marks a brush also says how fast it was: `brushDuration` is the whole sweep in MIDI
 * ticks, spread over the gaps between the notes, which is how alphaTab's own MIDI generation
 * reads it. Guitar Pro 8 keeps it well away from the brush direction -- the direction is a beat
 * Property, the duration an XProperty on the same beat -- which is presumably why it went unread
 * here for so long.
 *
 * These are much tighter than our own spacing: the two brushes in Ripple are 30 ticks, about 15ms
 * across five strings, where STRUM_STRING_DELAY_SECONDS would have taken 100ms. So a stated brush
 * really is nearly a chord, and playing it at our own pace overstated it sevenfold.
 *
 * STRUM_STRING_DELAY_SECONDS remains the fallback, for the overwhelming majority of beats where
 * the file marks no brush at all and playing every string at the same instant would not sound
 * like a guitar.
 */
function strumStepSeconds(beat, noteCount, beatTempo) {
    if (!beat.brushType || !(beat.brushDuration > 0) || noteCount < 2) return STRUM_STRING_DELAY_SECONDS;
    // Integer ticks per gap, matching alphaTab rather than being fractionally more exact than it.
    const ticks = Math.floor(beat.brushDuration / (noteCount - 1));
    return ticks * (60 / (beatTempo * TICKS_PER_QUARTER));
}

/**
 * A chord's fingering as stated by the file, or null if it does not give one.
 *
 * alphaTab's `Chord.strings` holds one fret per string with -1 for unplayed, ordered the same way
 * as the staff tuning array: highest-pitched string first. Files often carry a chord name with no
 * fingering at all, in which case every entry is -1 and there is nothing to use.
 */
function statedChordVoicing(chord, tuning) {
    if (!chord || !Array.isArray(chord.strings) || !Array.isArray(tuning)) return null;
    const stringCount = tuning.length;
    if (chord.strings.length !== stringCount) return null;

    const shape = [];
    for (const [index, fret] of chord.strings.entries()) {
        if (typeof fret !== 'number' || fret < 0) continue;
        shape.push({
            // Index 0 is the highest-pitched string, which is string 1 in tab numbering.
            string: index + 1,
            fret,
            midi: tuning[index] + fret
        });
    }
    if (shape.length === 0) return null;
    return shape.sort((a, b) => b.string - a.string); // string 6 first: a downstroke
}

function masterBarDurationTicks(masterBar) {
    if (typeof masterBar.calculateDuration === 'function') return masterBar.calculateDuration();
    // Fallback if the model does not expose the helper.
    const numerator = masterBar.timeSignatureNumerator || 4;
    const denominator = masterBar.timeSignatureDenominator || 4;
    return Math.round(numerator * (4 / denominator) * TICKS_PER_QUARTER);
}

/**
 * Maps absolute ticks to seconds, following any tempo changes.
 *
 * A tempo change is applied from the start of the bar that carries it. alphaTab can place one
 * partway through a bar via `ratioPosition`; that is ignored here, which is only wrong for a
 * score that changes tempo mid-bar.
 */
function buildTempoMap(score, targetTempo) {
    const segments = [];
    let seconds = 0;
    let tempo = score.tempo || 120;

    // A practice tempo scales the whole song rather than flattening it, so a piece that speeds up
    // or slows down partway through keeps those changes in proportion.
    const scoreTempo = score.tempo || 120;
    const scale = targetTempo && targetTempo > 0 ? targetTempo / scoreTempo : 1;

    for (const masterBar of score.masterBars || []) {
        if (masterBar.tempoAutomation && masterBar.tempoAutomation.value > 0) {
            tempo = masterBar.tempoAutomation.value;
        }
        const durationTicks = masterBarDurationTicks(masterBar);
        const secondsPerTick = 60 / (tempo * scale * TICKS_PER_QUARTER);
        segments.push({
            startTick: masterBar.start,
            endTick: masterBar.start + durationTicks,
            startSeconds: seconds,
            secondsPerTick,
            // The tempo actually being played, which is what note lengths must be derived from.
            tempo: tempo * scale,
            notatedTempo: tempo,
            barIndex: masterBar.index
        });
        seconds += durationTicks * secondsPerTick;
    }
    return { segments, totalSeconds: seconds, scale, scoreTempo };
}

/**
 * Where every bar and every beat within it falls, in seconds.
 *
 * A metronome needs beat positions, and stepping or looping by measure needs bar boundaries. The
 * beat unit comes from the time signature's lower number, so 4/4 gives four quarter-note beats
 * and 6/8 gives six eighth-note beats. Compound meters are conventionally counted in dotted
 * beats rather than in eighths, so 6/8 will click six times per bar rather than twice.
 */
function buildBarMap(score, tempoMap) {
    return (score.masterBars || []).map((masterBar, index) => {
        const numerator = masterBar.timeSignatureNumerator || 4;
        const denominator = masterBar.timeSignatureDenominator || 4;
        const beatTicks = (4 / denominator) * TICKS_PER_QUARTER;

        const beats = [];
        for (let beat = 0; beat < numerator; beat++) {
            beats.push(tickToSeconds(tempoMap, masterBar.start + beat * beatTicks));
        }
        const startSeconds = tickToSeconds(tempoMap, masterBar.start);
        const endSeconds = startSeconds + masterBarDurationTicks(masterBar) *
            (tempoMap.segments[index]?.secondsPerTick ?? 0);

        return { index, startSeconds, endSeconds, beatsPerBar: numerator, beats };
    });
}

function tickToSeconds(tempoMap, tick) {
    const { segments } = tempoMap;
    if (segments.length === 0) return 0;
    for (const segment of segments) {
        if (tick >= segment.startTick && tick < segment.endTick) {
            return segment.startSeconds + (tick - segment.startTick) * segment.secondsPerTick;
        }
    }
    const last = segments[segments.length - 1];
    return last.startSeconds + (tick - last.startTick) * last.secondsPerTick;
}

/**
 * Extracts every sounded note of one track as { startSeconds, midi, string, fret, velocity }.
 *
 * String numbers are converted to the guitarist convention on the way out: alphaTab counts
 * strings from the lowest pitch up, tab notation counts from the highest pitch down.
 */
export function buildAudioTrack(score, trackIndex, { targetTempo = null } = {}) {
    const track = (score.tracks || [])[trackIndex];
    if (!track) return null;

    const tempoMap = buildTempoMap(score, targetTempo);
    const chordVoicings = learnChordVoicings(track);
    const notes = [];
    const skipped = { tiedContinuations: 0, deadNotes: 0, unpitched: 0 };
    const completedChords = [];
    let stringCount = 0;

    for (const staff of track.staves || []) {
        const staffStringCount = staff.tuning ? staff.tuning.length : 0;
        stringCount = Math.max(stringCount, staffStringCount);

        for (const bar of staff.bars || []) {
            const barStartTick = bar.masterBar ? bar.masterBar.start : 0;

            for (const voice of bar.voices || []) {
                for (const beat of voice.beats || []) {
                    if (beat.isRest || beat.notes.length === 0) continue;
                    const startTick = barStartTick + beat.playbackStart;
                    const beatStartSeconds = tickToSeconds(tempoMap, startTick);
                    const beatTempo = tempoMap.segments.find(s =>
                        startTick >= s.startTick && startTick < s.endTick)?.tempo ?? score.tempo ?? 120;
                    const notatedSeconds = beat.playbackDuration * (60 / (beatTempo * TICKS_PER_QUARTER));

                    // A named beat writing only a bass note is shorthand for the whole chord.
                    // A fingering stated by the file is used ahead of one inferred from the song.
                    const chordName = beat.hasChord && beat.chord ? beat.chord.name : null;
                    const voicing = chordName
                        ? (statedChordVoicing(beat.chord, staff.tuning) ?? chordVoicings.get(chordName))
                        : undefined;
                    if (voicing && beat.notes.length <= CHORD_COMPLETION_MAX_NOTES
                        && voicing.length > beat.notes.length) {
                        const velocity = velocityLayerFor(beat.notes[0]?.dynamics);
                        // The voicing is stored lowest-pitched string first, which is a
                        // downstroke; a stated upstroke turns it round. This beat is being filled
                        // in from a chord name, but that is no reason to ignore a brush the file
                        // marked on it.
                        const sweep = statedStrumDirection(beat) === 'highToLow'
                            ? [...voicing].reverse()
                            : voicing;
                        const step = strumStepSeconds(beat, sweep.length, beatTempo);
                        for (const [indexInBeat, string] of sweep.entries()) {
                            notes.push({
                                startSeconds: beatStartSeconds + indexInBeat * step,
                                notatedSeconds,
                                midi: string.midi,
                                string: string.string,
                                fret: string.fret,
                                velocity,
                                bar: bar.index,
                                indexInBeat,
                                strumSize: sweep.length,
                                completedFromChord: chordName
                            });
                        }
                        completedChords.push({ bar: bar.index, chord: chordName, notes: voicing.length });
                        continue;
                    }

                    const isStrum = beat.notes.length > 1;

                    // The file's stated stroke, or a downstroke where it states none. The order
                    // the notes are listed in is not consulted: it is an artefact of the format,
                    // not of the performance.
                    const stated = isStrum ? (statedStrumDirection(beat) ?? 'lowToHigh') : null;
                    let sweep = beat.notes;
                    if (stated) {
                        sweep = [...beat.notes].sort((a, b) => stated === 'lowToHigh'
                            // alphaTab counts strings low-to-high, so low pitch first is ascending.
                            ? a.string - b.string
                            : b.string - a.string);
                    }

                    // The index comes from the raw note list so a skipped note still leaves its
                    // place in the sweep: the pick travels past that string either way.
                    const step = strumStepSeconds(beat, beat.notes.length, beatTempo);

                    for (const [indexInBeat, note] of sweep.entries()) {
                        // A tied note is not struck again; the note it continues is simply
                        // still ringing, which the ring-until-restruck rule already gives us.
                        if (note.isTieDestination) { skipped.tiedContinuations++; continue; }
                        if (note.isDead) { skipped.deadNotes++; continue; }
                        if (typeof note.realValue !== 'number') { skipped.unpitched++; continue; }

                        notes.push({
                            // Notes of a strum are spread across the sweep, which is what makes a
                            // downstroke sound different from an upstroke.
                            startSeconds: beatStartSeconds + (isStrum ? indexInBeat * step : 0),
                            notatedSeconds,
                            midi: note.realValue,
                            // alphaTab numbers strings low-to-high; flip to tab convention.
                            string: note.isStringed && staffStringCount
                                ? staffStringCount - note.string + 1
                                : null,
                            fret: note.isStringed ? note.fret : null,
                            velocity: velocityLayerFor(note.dynamics),
                            bar: bar.index,
                            indexInBeat,
                            strumSize: beat.notes.length
                        });
                    }
                }
            }
        }
    }

    notes.sort((a, b) => a.startSeconds - b.startSeconds || (a.string ?? 0) - (b.string ?? 0));

    return {
        trackIndex,
        trackName: track.name || `Track ${trackIndex + 1}`,
        songTitle: score.title || '(untitled)',
        // The tempo written in the score, and the one this timeline was actually built at.
        scoreTempo: tempoMap.scoreTempo,
        tempo: Math.round(tempoMap.scoreTempo * tempoMap.scale),
        tempoScale: tempoMap.scale,
        stringCount,
        totalSeconds: tempoMap.totalSeconds,
        barCount: (score.masterBars || []).length,
        // Where each bar begins, so playback can start, loop or step by measure.
        barStartSeconds: tempoMap.segments.map(s => s.startSeconds),
        // Bars with their beat positions, for the metronome and the count-in.
        bars: buildBarMap(score, tempoMap),
        notes,
        skipped,
        completedChords
    };
}

/**
 * Fills in how long each note actually sounds.
 *
 * A note rings until that same string is struck again, and otherwise decays away on its own,
 * which is how a guitar behaves: notated duration says when the next attack falls, not when
 * the string stops. `ringSeconds` of null means "let the recording run out".
 *
 * Notes with no string information (a non-stringed track) fall back to their notated length,
 * since without a string there is nothing to steal the voice.
 */
export function resolveRingLengths(notes) {
    const nextOnString = new Map();

    for (let index = notes.length - 1; index >= 0; index--) {
        const note = notes[index];
        if (note.string === null) {
            note.ringSeconds = note.notatedSeconds;
            continue;
        }
        const next = nextOnString.get(note.string);
        note.ringSeconds = next === undefined ? null : next - note.startSeconds;
        nextOnString.set(note.string, note.startSeconds);
    }
    return notes;
}
