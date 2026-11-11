// Turns a parsed alphaTab `Score` into a flat, playable note timeline.
//
// Works from the data model rather than the rendered HTML, so nothing here depends on how the
// song is displayed. Kept free of alphaTab imports (it only reads the object it is handed) so
// it can run standalone for testing, like scoreMetadata.mjs.

import { scoreTempo } from './tempo.mjs';

// alphaTab's tick resolution: a quarter note is 960 ticks, so a 4/4 bar is 3840.
export const TICKS_PER_QUARTER = 960;

// --- How notated music becomes audible guitar -----------------------------------------
// These rules apply to every supported file format, not just one song.
//
// THE FILE ALWAYS WINS. Everything below is a choice of last resort, used only where the score
// is silent about how something should be played. Where a file states the notes, a
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
//    downstroke, which is what an unmarked strum means in notation.
//
//    The order the notes happen to appear in the beat is NOT used, though it once was. It is not
//    a signal: GP3-5 store a beat's notes as a bitmask of strings, which cannot express an order
//    at all, and the GPIF formats store whatever order the exporter wrote. Exporting one song
//    twice put 30 of its beats in opposite order, and the one beat in our files that does state a
//    brush has its notes listed the other way round. See scripts/gp-experiment/gpParsingFindings.md.
//
// 3. Every beat sounds exactly the notes it writes, whether or not a chord name is printed over
//    it. A chord name over a single bass note is played as that bass note.
//
//    Until 2026-11-10 a printed chord over one or two notes was filled in to the whole chord,
//    from the file's diagram or from the fullest beat the song played under that name. It was
//    dropped because it guessed that the written notes did not mean what they said, and the guess
//    was sometimes wrong: a melody note under a printed chord was replaced by a strum. Playing
//    what is written keeps the sound and the description in agreement; the printed chord is still
//    read in the measure heading and the track's Chord Symbols, so a player has what they need to
//    strum it if they want to. See docs/chord-forms-in-scores.md, Playing what is written.
//
// 4. A note rings until that same string is struck again, then decays on its own. Notated
//    duration says when the next attack falls, not when the string stops sounding.
//
// 5. A tied note is not struck again: the note it continues is simply still ringing, which
//    rule 4 already provides.
export const STRUM_STRING_DELAY_SECONDS = 0.020;

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
    let tempo = scoreTempo(score);

    // A practice tempo scales the whole song rather than flattening it, so a piece that speeds up
    // or slows down partway through keeps those changes in proportion.
    const fromScore = scoreTempo(score);
    const scale = targetTempo && targetTempo > 0 ? targetTempo / fromScore : 1;

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
    return { segments, totalSeconds: seconds, scale, scoreTempo: fromScore };
}

/**
 * Where every bar and every beat within it falls, in seconds.
 *
 * A metronome needs beat positions, and stepping or looping by measure needs bar boundaries. The
 * beat unit comes from the time signature's lower number, so 4/4 gives four quarter-note beats
 * and 6/8 gives six eighth-note beats. Compound meters are conventionally counted in dotted
 * beats rather than in eighths, so 6/8 will click six times per bar rather than twice.
 *
 * A bar shorter than its time signature has only the beats that fall inside it. A pickup, which
 * alphaTab marks `isAnacrusis`, is the end of a measure, so its beats are counted back from its
 * end: a two-beat pickup in 4/4 holds beats 3 and 4, and one of a beat and a half holds the and of
 * 3, with a click only on 4. Any other short bar is the start of a measure and is counted from its
 * start. Until 2026-11-11 every bar was given its whole time signature's beats, so a pickup's
 * clicks ran on into the next measure and landed on top of its own.
 *
 * `firstBeat` is the place in the full measure of the first beat listed, 0 for a downbeat, so a
 * click knows whether it is the accented one. `beatSeconds` is one beat's length at this bar's
 * tempo, which a count-in needs where the bar itself is too short to show it.
 */
function buildBarMap(score, tempoMap) {
    return (score.masterBars || []).map((masterBar, index) => {
        const numerator = masterBar.timeSignatureNumerator || 4;
        const denominator = masterBar.timeSignatureDenominator || 4;
        const beatTicks = (4 / denominator) * TICKS_PER_QUARTER;
        const durationTicks = masterBarDurationTicks(masterBar);
        const fullTicks = numerator * beatTicks;
        // Where the full measure would begin, relative to this bar's start: before it, for a pickup.
        const measureStartTick = masterBar.isAnacrusis && durationTicks < fullTicks
            ? durationTicks - fullTicks
            : 0;

        const beats = [];
        let firstBeat = null;
        for (let beat = 0; beat < numerator; beat++) {
            const tick = measureStartTick + beat * beatTicks;
            if (tick < 0 || tick >= durationTicks) continue;
            firstBeat ??= beat;
            beats.push(tickToSeconds(tempoMap, masterBar.start + tick));
        }
        const secondsPerTick = tempoMap.segments[index]?.secondsPerTick ?? 0;
        const startSeconds = tickToSeconds(tempoMap, masterBar.start);
        const endSeconds = startSeconds + durationTicks * secondsPerTick;

        return {
            index, startSeconds, endSeconds, beatsPerBar: numerator, beats,
            firstBeat: firstBeat ?? 0,
            beatSeconds: beatTicks * secondsPerTick,
            pickup: measureStartTick < 0
        };
    });
}

/**
 * The clicks of a count-in before `bar`, from one of `buildAudioTrack`'s bars: { seconds, clicks },
 * each click { offset, accent } in seconds from the count-in's start, and `seconds` from its start
 * to the bar's.
 *
 * One measure of the bar's time signature, at its tempo. A pickup is counted in with a whole
 * measure and then the beats of its own measure that come before it, so a two-beat pickup in 4/4
 * hears 1 2 3 4 1 2 and comes in on 3. Joel chose this on 2026-11-11 over counting only the 1 2,
 * which leaves a long pickup a single click. Before then the count-in lasted as long as the pickup
 * but clicked a whole measure, so its last clicks fell on the music.
 *
 * `beats` keeps only the last few clicks, for a repeat at a slow tempo, where a whole measure of
 * clicks is a long wait and one or two are enough to hear the top coming round. Null, or as many
 * as the time signature's beats or more, keeps them all.
 */
export function countInClicks(bar, beats = null) {
    const count = bar.beatsPerBar;
    const step = bar.beatSeconds;
    // Where the bar's own measure has its beat 1: before the bar begins, for a pickup.
    const downbeat = bar.pickup ? bar.endSeconds - count * step : bar.startSeconds;

    const clicks = [];
    for (let beat = 0; beat < count; beat++) clicks.push({ at: downbeat - (count - beat) * step, accent: beat === 0 });
    for (let beat = 0; beat < count; beat++) {
        const at = downbeat + beat * step;
        if (at < bar.startSeconds - 1e-6) clicks.push({ at, accent: beat === 0 });
    }

    const kept = beats !== null && beats < count ? clicks.slice(-Math.max(1, beats)) : clicks;
    const start = kept[0].at;
    return {
        seconds: bar.startSeconds - start,
        clicks: kept.map(({ at, accent }) => ({ offset: at - start, accent }))
    };
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
    const notes = [];
    const skipped = { tiedContinuations: 0, deadNotes: 0, unpitched: 0 };
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
                        startTick >= s.startTick && startTick < s.endTick)?.tempo ?? scoreTempo(score);
                    const notatedSeconds = beat.playbackDuration * (60 / (beatTempo * TICKS_PER_QUARTER));

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
        skipped
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
