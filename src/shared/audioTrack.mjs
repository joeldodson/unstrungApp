// Turns a parsed alphaTab `Score` into a flat, playable note timeline.
//
// Works from the data model rather than the rendered HTML, so nothing here depends on how the
// song is displayed. Kept free of alphaTab imports (it only reads the object it is handed) so
// it can run standalone for testing, like scoreMetadata.mjs.

import { scoreTempo } from './tempo.mjs';
import { FEELS, feelPairTicks } from './strummingPatterns.mjs';

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
//    Its notes are sounded one after another, the way a pick crosses the strings rather than
//    hitting them all at once: the file's brush speed apart where it states one, otherwise the
//    app-wide setting "Time between strings in a strum", passed in as strumSpacingSeconds.
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
// 4. A note rings until that same string is struck again or damped, then decays on its own.
//    Notated duration says when the next attack falls, not when the string stops sounding.
//
//    A dead note (x) is the string damped: it sounds nothing, there being no recordings of
//    deadened strings, but it stops whatever that string was ringing, at its place in the sweep.
//    Strings it does not touch ring on. Until 2026-11-12 dead notes were skipped outright, so the
//    strings before rang on through a muted strum. docs/one-player.md, decision 13.
//
// 5. A tied note is not struck again: the note it continues is simply still ringing, which
//    rule 4 already provides.
//
// 6. A bar's triplet feel is played as alphaTab's own MIDI generator plays it: each even pair of
//    eighths, or of sixteenths, becomes long then short. See tripletFeelTimes.
//
// 7. An accented note is louder than the notes around it: ACCENT_LEVEL times their level, and a
//    heavy accent HEAVY_ACCENT_LEVEL times. The recording layer still comes from the dynamic
//    alone, so the accent raises the level within it. Nothing unaccented is softened. Until
//    2026-11-12 accents were ignored and loudness came from dynamics only. docs/one-player.md,
//    decision 10.
//
// The strum spacing was a fixed 20 ms here, and 22 ms in chord practice, until 2026-11-12, when it
// became one setting for every strum: 0 to 50 ms, 20 by default. docs/one-player.md, decision 14.
// The same range and default are in src/main/main.js and src/web/platform.js, which store it.
export const STRUM_SPACING_MIN_MS = 0;
export const STRUM_SPACING_MAX_MS = 50;
export const DEFAULT_STRUM_SPACING_MS = 20;
export const DEFAULT_STRUM_SPACING_SECONDS = DEFAULT_STRUM_SPACING_MS / 1000;

/** A typed or stored spacing as whole milliseconds within range; the default for anything else. */
export function clampStrumSpacingMs(value) {
    const number = typeof value === 'string' && value.trim() === '' ? NaN : Number(value);
    if (value === null || !Number.isFinite(number)) return DEFAULT_STRUM_SPACING_MS;
    return Math.max(STRUM_SPACING_MIN_MS, Math.min(STRUM_SPACING_MAX_MS, Math.round(number)));
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

// Rule 7. 1.5 keeps the contrast chord practice gave a progression's accents, 1.3 against 0.85
// for the strokes around them, now that the strokes around them are not softened. The heavy
// accent's level is a first guess, to be set by ear.
export const ACCENT_LEVEL = 1.5;
export const HEAVY_ACCENT_LEVEL = 1.8;

// alphaTab's AccentuationType.
const ACCENT_NORMAL = 1, ACCENT_HEAVY = 2;

/** How loud a note plays against an unaccented one: 1, or more for an accent. */
function accentLevel(note) {
    if (note.accentuated === ACCENT_HEAVY) return HEAVY_ACCENT_LEVEL;
    if (note.accentuated === ACCENT_NORMAL) return ACCENT_LEVEL;
    return 1;
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
 * across five strings, where our default spacing would have taken 100ms. So a stated brush
 * really is nearly a chord, and playing it at our own pace overstated it sevenfold.
 *
 * The strum spacing setting, `fallback`, remains for the overwhelming majority of beats where the
 * file marks no brush at all and playing every string at the same instant would not sound like a
 * guitar.
 */
function strumStepSeconds(beat, noteCount, beatTempo, fallback) {
    if (!beat.brushType || !(beat.brushDuration > 0) || noteCount < 2) return fallback;
    // Integer ticks per gap, matching alphaTab rather than being fractionally more exact than it.
    const ticks = Math.floor(beat.brushDuration / (noteCount - 1));
    return ticks * (60 / (beatTempo * TICKS_PER_QUARTER));
}

// alphaTab's TripletFeel, with the long and short halves of a pair in ticks. A feel pairs notes of
// `interval` ticks: Triplet8th plays two eighths as a triplet quarter and eighth, 640 and 320;
// Dotted8th as a dotted eighth and sixteenth; Scottish8th the other way round. The 16th feels do
// the same to sixteenths. These are the durations alphaTab's MidiFileGenerator gives them.
//
// Worked out from FEELS in strummingPatterns.mjs, the one table of feels: a pair's span, and where
// in it the second note falls. Triplet8th comes to { interval: 480, first: 640, second: 320 }.
const TRIPLET_FEEL_PAIRS = Object.fromEntries(FEELS.map(feel => {
    const pair = feelPairTicks(feel.id);
    const first = Math.round(pair * feel.secondAt);
    return [feel.tripletFeel, { interval: pair / 2, first, second: pair - first }];
}));

/**
 * Where each beat of a voice sounds and for how long, in ticks from its bar's start, once the
 * bar's triplet feel is applied: [{ start, duration }], one for each of `voice.beats`.
 *
 * alphaTab's `playbackStart` and `playbackDuration` are the written, straight values; it swings
 * only when it makes MIDI (`MidiFileGenerator._generateBeat` and `_calculateTripletFeelInfo`),
 * which unstrung does not use. This follows that code exactly. A beat of exactly the feel's note
 * value, starting on an even pair boundary, and followed directly in the same voice by another of
 * the same value, is the long half of a pair, and the beat after it the short half. Anything else
 * -- a dotted note, a triplet, a quarter, an off-beat start -- is played as written, and so is the
 * beat after it. Rests take part, as in alphaTab, so a rest can be the long half of a pair.
 *
 * Until 2026-11-11 every beat was played straight, though Song Summary announced the feel.
 * Finding 5 of the November review.
 */
export function tripletFeelTimes(voice) {
    const beats = voice.beats || [];
    const times = beats.map(beat => ({ start: beat.playbackStart, duration: beat.playbackDuration }));
    // alphaTab's own exception, ahead of the feel: an empty bar's single rest lasts the whole bar.
    // It sounds nothing, so this only keeps the times the same as alphaTab's.
    if (voice.bar?.isEmpty && beats.length === 1) {
        if (voice.bar.masterBar) times[0].duration = masterBarDurationTicks(voice.bar.masterBar);
        return times;
    }
    const feel = TRIPLET_FEEL_PAIRS[voice.bar?.masterBar?.tripletFeel];
    if (!feel) return times;

    for (let index = 0; index + 1 < beats.length; index++) {
        const beat = beats[index];
        const next = beats[index + 1];
        if (beat.playbackDuration !== feel.interval) continue;
        if (beat.playbackStart % (feel.interval * 2) !== 0) continue;
        if (next.playbackDuration !== feel.interval || next.playbackStart !== beat.playbackStart + feel.interval) continue;

        times[index] = { start: beat.playbackStart, duration: feel.first };
        times[index + 1] = { start: beat.playbackStart + feel.first, duration: feel.second };
        index++;
    }
    return times;
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
 *
 * `strumSpacingSeconds` is the time between strings of a strum whose file states no brush speed.
 */
export function buildAudioTrack(score, trackIndex, {
    targetTempo = null, strumSpacingSeconds = DEFAULT_STRUM_SPACING_SECONDS
} = {}) {
    const track = (score.tracks || [])[trackIndex];
    if (!track) return null;

    const tempoMap = buildTempoMap(score, targetTempo);
    const notes = [];
    // Where a dead note damps a string: { startSeconds, string, bar }. See rule 4.
    const stops = [];
    const skipped = { tiedContinuations: 0, deadNotes: 0, unpitched: 0 };
    let stringCount = 0;

    for (const staff of track.staves || []) {
        const staffStringCount = staff.tuning ? staff.tuning.length : 0;
        stringCount = Math.max(stringCount, staffStringCount);

        for (const bar of staff.bars || []) {
            const barStartTick = bar.masterBar ? bar.masterBar.start : 0;

            for (const voice of bar.voices || []) {
                // The bar's triplet feel, if it states one, moves the second of each swung pair.
                const times = tripletFeelTimes(voice);
                for (const [beatIndex, beat] of (voice.beats || []).entries()) {
                    if (beat.isRest || beat.notes.length === 0) continue;
                    const startTick = barStartTick + times[beatIndex].start;
                    const beatStartSeconds = tickToSeconds(tempoMap, startTick);
                    const beatTempo = tempoMap.segments.find(s =>
                        startTick >= s.startTick && startTick < s.endTick)?.tempo ?? scoreTempo(score);
                    const notatedSeconds = times[beatIndex].duration * (60 / (beatTempo * TICKS_PER_QUARTER));

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
                    const step = strumStepSeconds(beat, beat.notes.length, beatTempo, strumSpacingSeconds);

                    for (const [indexInBeat, note] of sweep.entries()) {
                        // Notes of a strum are spread across the sweep, which is what makes a
                        // downstroke sound different from an upstroke.
                        const startSeconds = beatStartSeconds + (isStrum ? indexInBeat * step : 0);
                        // alphaTab numbers strings low-to-high; flip to tab convention.
                        const string = note.isStringed && staffStringCount
                            ? staffStringCount - note.string + 1
                            : null;

                        // A tied note is not struck again; the note it continues is simply
                        // still ringing, which the ring-until-restruck rule already gives us.
                        if (note.isTieDestination) { skipped.tiedContinuations++; continue; }
                        // A dead note sounds nothing but damps its string: rule 4.
                        if (note.isDead) {
                            skipped.deadNotes++;
                            if (string !== null) stops.push({ startSeconds, string, bar: bar.index });
                            continue;
                        }
                        if (typeof note.realValue !== 'number') { skipped.unpitched++; continue; }

                        notes.push({
                            startSeconds,
                            notatedSeconds,
                            midi: note.realValue,
                            string,
                            fret: note.isStringed ? note.fret : null,
                            velocity: velocityLayerFor(note.dynamics),
                            // Against an unaccented note's level, which the player sets: rule 7.
                            level: accentLevel(note),
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
    stops.sort((a, b) => a.startSeconds - b.startSeconds || a.string - b.string);

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
        // Not sounded, so not among the notes; they only end what a string was ringing.
        stops,
        skipped
    };
}

/**
 * Where each string is next struck or damped after a time, for working out how long a note rings:
 * `next(string, seconds)` is the first strike or stop on that string later than `seconds`, or
 * undefined. `notes` and `stops` are a track's, or any part of them.
 */
export function stringEvents(notes, stops = []) {
    const byString = new Map();
    // Notes with no string are kept together under null, as one voice that each cuts off the last.
    for (const event of [...notes, ...stops]) {
        if (event.string === undefined) continue;
        if (!byString.has(event.string)) byString.set(event.string, []);
        byString.get(event.string).push(event.startSeconds);
    }
    for (const times of byString.values()) times.sort((a, b) => a - b);
    // A binary search, since a long song asks this once for each of thousands of notes.
    const next = (string, seconds) => {
        const times = byString.get(string);
        if (!times) return undefined;
        let low = 0, high = times.length;
        while (low < high) {
            const middle = (low + high) >> 1;
            if (times[middle] > seconds + 1e-9) high = middle;
            else low = middle + 1;
        }
        return times[low];
    };
    return { first: string => byString.get(string)?.[0], next };
}

/**
 * The notes of a selection, { startSeconds, endSeconds }, each with how long it rings when the
 * selection is played: `ringFinal` on its last time through and `ringLoop` when it repeats, in
 * seconds, null meaning let the recording run out.
 *
 * Rule 4 within the selection: until the string is next struck or damped. When it repeats, the
 * next of those may be in the next time through, so the ring wraps: the time left to the end of
 * the selection plus the time from its start to that string's first strike or stop. Moved here
 * from the renderer's rangeNotesFor on 2026-11-12, when dead notes began to damp strings.
 */
export function ringLengthsInRange(audioTrack, { startSeconds, endSeconds }) {
    const within = event => event.startSeconds >= startSeconds - 1e-9 && event.startSeconds < endSeconds - 1e-9;
    const inRange = audioTrack.notes.filter(within);
    const events = stringEvents(inRange, (audioTrack.stops ?? []).filter(within));
    return inRange.map(note => {
        const next = events.next(note.string, note.startSeconds);
        const ringFinal = next !== undefined ? next - note.startSeconds : null;
        const ringLoop = next !== undefined
            ? next - note.startSeconds
            : (endSeconds - note.startSeconds) + (events.first(note.string) - startSeconds);
        return { ...note, ringFinal, ringLoop };
    });
}

/**
 * Fills in how long each note actually sounds.
 *
 * A note rings until that same string is struck again or damped by a dead note, and otherwise
 * decays away on its own, which is how a guitar behaves: notated duration says when the next
 * attack falls, not when the string stops. `ringSeconds` of null means "let the recording run out".
 *
 * Notes with no string information (a non-stringed track) fall back to their notated length,
 * since without a string there is nothing to steal the voice.
 */
export function resolveRingLengths(notes, stops = []) {
    const events = stringEvents(notes, stops);
    for (const note of notes) {
        if (note.string === null) {
            note.ringSeconds = note.notatedSeconds;
            continue;
        }
        const next = events.next(note.string, note.startSeconds);
        note.ringSeconds = next === undefined ? null : next - note.startSeconds;
    }
    return notes;
}
