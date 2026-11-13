// Songs as alphaTab scores: writing a song as alphaTex, and reading an alphaTab `Score` back into
// measures of chords and strumming patterns.
//
// A song here is plain data:
//
//   { title, key, mode, beatsPerBar, beatUnit, tempo,
//     measures: [{ section, chords: [{ root, suffix, beat, frets }], pattern: { slotsPerBeat, slots } }] }
//
// `beat` is where a chord starts, counted from 1 as players count; the first chord of a measure
// is at 1. `frets` is optional, [{ string, fret }] in tab numbering, and defaults to the chord
// library's preferred voicing. `slots` are strumming pattern slots (strummingPatterns.mjs).
//
// Writing gives alphaTex text, which alphaTab's AlphaTexImporter turns into a `Score`, so this
// module needs no alphaTab import. Reading takes the `Score` object it is handed, the same way
// audioTrack.mjs does.
//
// Reading decides measure by measure whether the simple form -- chords and a pattern -- says
// everything the measure does. The test is exact: write the simple form back out and compare
// what would be heard. A measure that passes is "plain" or "patterned"; one that does not is
// "written out", with the reason. See docs/strumming-patterns-and-metronome.md.

import { chordDisplayName } from './chordProgressions.mjs';
import {
    identifyChordFromNotes, spellChordNotes, IDENTIFY_SUFFIXES, PITCH_CLASS_NAMES, PITCH_CLASSES,
    STANDARD_TUNING_MIDI
} from './musicTheory.mjs';
import {
    coarsestPattern, everyBeatDown, finerPattern, formatStrummingPattern, SLOTS_PER_BEAT_CHOICES, swingApplies,
    feelApplies, feelPairTicks, FEELS
} from './strummingPatterns.mjs';
import { DEFAULT_TEMPO, scoreTempo } from './tempo.mjs';

export const TICKS_PER_QUARTER = 960;

// Note values alphaTex can write, longest first, in ticks. Spans that are none of these are
// written as a note followed by tied continuations.
const NOTE_VALUES = [
    { ticks: 3840, value: 1, dotted: false },
    { ticks: 2880, value: 2, dotted: true },
    { ticks: 1920, value: 2, dotted: false },
    { ticks: 1440, value: 4, dotted: true },
    { ticks: 960, value: 4, dotted: false },
    { ticks: 720, value: 8, dotted: true },
    { ticks: 480, value: 8, dotted: false },
    { ticks: 360, value: 16, dotted: true },
    { ticks: 240, value: 16, dotted: false },
    { ticks: 120, value: 32, dotted: false }
];

// alphaTab enum values, as audioTrack.mjs keeps them, so nothing here imports alphaTab.
const BRUSH_UP = 1, BRUSH_DOWN = 2, ARPEGGIO_UP = 3, ARPEGGIO_DOWN = 4;
const PICK_UP = 1, PICK_DOWN = 2;
const ACCENT_NONE = 0, ACCENT_NORMAL = 1;
const KEY_TYPE_MINOR = 1;

// Sharps (positive) or flats (negative) for each key unstrung offers, as alphaTab counts them.
const KEY_SIGNATURES = {
    major: { C: 0, 'C#': 7, D: 2, Eb: -3, E: 4, F: -1, 'F#': 6, G: 1, Ab: -4, A: 3, Bb: -2, B: 5 },
    minor: { C: -3, 'C#': 4, D: -1, Eb: -6, E: 1, F: -4, 'F#': 3, G: -2, Ab: -7, A: 0, Bb: -5, B: 2 }
};

const beatTicks = beatUnit => (4 / beatUnit) * TICKS_PER_QUARTER;
const slotTicks = (beatUnit, slotsPerBeat) => beatTicks(beatUnit) / slotsPerBeat;
const fretsKey = frets => [...frets].sort((a, b) => b.string - a.string).map(f => `${f.string}:${f.fret}`).join(' ');
const sameChord = (a, b) => !!a && !!b && a.root === b.root && a.suffix === b.suffix && fretsKey(a.frets) === fretsKey(b.frets);
const quoted = text => `"${String(text).replace(/["\\]/g, "'")}"`;

/**
 * The strings an upstroke strikes: the four highest the chord plays, or all of them for a chord of
 * four strings or fewer. The hand coming back up catches the top of the chord, and the strings
 * below ring on from the stroke before, as rule 4 in audioTrack.mjs plays them. Until 2026-11-12
 * every string of the chord was written on an upstroke, and chord practice's own player swept only
 * the top four, so a progression sounded different in the two. docs/one-player.md, decision 11.
 */
export const UPSTROKE_STRINGS = 4;
export function upstrokeFrets(frets) {
    return [...frets].sort((a, b) => a.string - b.string).slice(0, UPSTROKE_STRINGS);
}

/** The fingering a chord is written with: the library's preferred voicing, open and fretted strings. */
export function libraryFrets(library, chord) {
    const entry = (library?.chords ?? []).find(e => e.root === chord.root && e.suffix === chord.suffix);
    const voicings = entry?.voicings ?? [];
    const voicing = voicings.find(v => v.confidence === 'canonical')
        ?? voicings.find(v => v.confidence === 'common') ?? voicings[0];
    if (!voicing) return null;
    return voicing.strings
        .filter(s => s.play !== 'muted')
        .map(s => ({ string: s.string, fret: s.fret }))
        .sort((a, b) => b.string - a.string);
}

/**
 * Frets for a chord the library has no fingering for, worked out from its spelling.
 *
 * A score has to hold notes, and some advanced chords in the library have no voicing at all.
 * This is not a fingering anyone would teach: the root on string 6, and each string above it the
 * next chord tone within four frets, or left out. Chord practice still plays nothing for these
 * chords, as before; the notes are there so the file says what the chord is.
 */
export function spelledFrets(chord) {
    let classes;
    try {
        classes = spellChordNotes(chord.root, chord.suffix).map(name => PITCH_CLASSES[name]);
    } catch {
        return null;
    }
    if (classes.length === 0 || classes.some(c => c === undefined)) return null;
    const base = ((classes[0] - STANDARD_TUNING_MIDI[6]) % 12 + 12) % 12;
    const frets = [{ string: 6, fret: base }];
    let next = 1;
    for (const string of [5, 4, 3, 2, 1]) {
        for (let tries = 0; tries < classes.length; tries++) {
            const pitchClass = classes[(next + tries) % classes.length];
            const fret = base + ((pitchClass - STANDARD_TUNING_MIDI[string] - base) % 12 + 12) % 12;
            if (fret <= base + 4) {
                frets.push({ string, fret });
                next += tries + 1;
                break;
            }
        }
    }
    return frets;
}

/**
 * A progression's tempo as alphaTab counts it, in quarters a minute.
 *
 * A progression's tempo counts the time signature's lower number, as chord practice always has: 80
 * in 6/8 is 80 eighths a minute. alphaTab's counts quarters whatever the time signature, so a 6/8
 * progression played on the audio track player is played at half its number. Saved files still
 * write the progression's own number (docs/one-player.md, stage 3).
 */
export function progressionQuarterTempo(tempo, beatUnit) {
    return tempo * 4 / (beatUnit || 4);
}

/**
 * A generated or edited progression as a song, with one pattern throughout. Each measure is its
 * chord, and the `laterChords` after it, each with the beat it starts on.
 *
 * `feel` is one of FEELS' ids, or null for straight; `swing`, as chord practice still gives it until
 * its Feel list comes in stage 3, means triplet eighths. The song's `feel` is kept only where it has
 * an effect (feelApplies), so a progression is never saved stating a feel that moves nothing.
 */
export function songFromProgression(progression, {
    library, tempo = DEFAULT_TEMPO, pattern = null, title = '', swing = false, feel = null
}) {
    const songPattern = pattern ?? everyBeatDown(progression.beatsPerBar);
    const wanted = feel ?? (swing ? 'triplet8th' : null);
    const kept = feelApplies(wanted, progression.beatUnit, songPattern.slotsPerBeat) ? wanted : null;
    return {
        title,
        feel: kept,
        swing: kept === 'triplet8th',
        key: progression.key,
        mode: progression.mode,
        beatsPerBar: progression.beatsPerBar,
        beatUnit: progression.beatUnit,
        tempo,
        measures: progression.chords.map(chord => ({
            section: null,
            chords: [{ root: chord.root, suffix: chord.suffix, beat: 1 }, ...(chord.laterChords ?? [])]
                .map(c => ({
                    root: c.root, suffix: c.suffix, beat: c.beat,
                    frets: libraryFrets(library, c) ?? spelledFrets(c)
                })),
            pattern: { slotsPerBeat: songPattern.slotsPerBeat, slots: songPattern.slots }
        }))
    };
}

/**
 * One measure's beats, as the simple form says they should be.
 *
 * `context` carries what the previous measure left: `ringing`, the frets still sounding, and
 * `named`, the chord last named, since a chord name is written only where the chord changes.
 * Returns { beats, context } or { error }.
 *
 * Each beat is { tick, ticks, kind, frets, direction, accent, chordName }, where kind is strike,
 * mute, tie or rest. A miss lengthens whatever came before it; at the start of a measure it ties
 * over what the previous measure left ringing, or is a rest if nothing is.
 */
export function expandMeasure(measure, song, context = { ringing: null, named: null }) {
    // A measure may have its own time signature, such as a single bar of 2/4.
    const beatsPerBar = measure.beatsPerBar ?? song.beatsPerBar;
    const beatUnit = measure.beatUnit ?? song.beatUnit;
    if (measure.pattern.slots.length !== beatsPerBar * measure.pattern.slotsPerBeat) {
        return { error: `The pattern has ${measure.pattern.slots.length} slots; this measure needs ${beatsPerBar * measure.pattern.slotsPerBeat}.` };
    }
    // A chord may start between the pattern's slots, as C@2.5 does with Down Only. The pattern is
    // then laid on a grid fine enough to hold it, with misses between, so the change has a slot.
    const fineEnough = SLOTS_PER_BEAT_CHOICES.find(n => n % measure.pattern.slotsPerBeat === 0 &&
        measure.chords.every(chord => Number.isInteger(((chord.beat ?? 1) - 1) * n)));
    const { slotsPerBeat, slots } = fineEnough ? finerPattern(measure.pattern, fineEnough) : measure.pattern;
    const slotLength = slotTicks(beatUnit, slotsPerBeat);

    // Where each chord takes over. The first holds from beat 1. A chord may start on a miss, as on
    // beat 3 of D - D U - U D U: the player changes there, and the next stroke plays it.
    const starts = [];
    for (const [index, chord] of measure.chords.entries()) {
        if (!chord.frets?.length) return { error: `${chordDisplayName(chord)} has no fingering.` };
        const slot = index === 0 ? 0 : ((chord.beat ?? 1) - 1) * slotsPerBeat;
        if (!Number.isInteger(slot) || slot < 0 || slot >= slots.length) {
            return { error: `${chordDisplayName(chord)} starts on beat ${chord.beat}, which is not on the pattern's grid.` };
        }
        if (index > 0 && slot <= starts[starts.length - 1].slot) {
            return { error: `${chordDisplayName(chord)} does not start after the chord before it.` };
        }
        starts.push({ slot, chord });
    }
    const chordAt = slot => starts.filter(s => s.slot <= slot).pop()?.chord ?? null;
    const startsAt = new Set(starts.map(s => s.slot));

    // Spans: each struck or muted slot starts one, and so does each chord's start, so that its
    // name sits where the harmony changes, as on a lead sheet. Misses lengthen the span before.
    const spans = [];
    for (const [index, slot] of slots.entries()) {
        const chord = chordAt(index);
        if (slot.stroke === 'miss') {
            if (spans.length && !startsAt.has(index)) { spans[spans.length - 1].slots++; continue; }
            // Sustains whatever is ringing: the previous measure's chord, or the old chord of this one.
            const before = spans.length ? spans[spans.length - 1] : null;
            const ringingFrets = before
                ? (before.kind === 'strike' || before.kind === 'tie' ? before.frets : null)
                : context.ringing;
            spans.push({ slot: index, slots: 1, kind: ringingFrets ? 'tie' : 'rest', frets: ringingFrets, chord });
            continue;
        }
        // An upstroke strikes the top strings only, and what ties on after it ties those. A mute
        // damps every string of the chord whichever way the hand goes, as chord practice's does.
        const kind = slot.stroke === 'mute' ? 'mute' : 'strike';
        spans.push({
            slot: index,
            slots: 1,
            kind,
            frets: kind === 'strike' && slot.stroke === 'up' ? upstrokeFrets(chord.frets) : chord.frets,
            direction: slot.stroke === 'up' ? 'up' : 'down',
            accent: slot.accent,
            chord
        });
    }

    let { ringing, named } = context;
    // A feel's pairs, if it moves any here: cut every span at their edges (feelPiece). An eighth
    // feel is cut only with a quarter-note beat, as swing always was.
    const feel = songFeel(song);
    const pairTicks = FEELS.find(f => f.id === feel)?.pairs === 8 && beatUnit !== 4 ? null : feelPairTicks(feel);
    const beats = [];
    for (const span of spans) {
        let chordName = null;
        if (startsAt.has(span.slot) && !sameChord(span.chord, named)) {
            chordName = chordDisplayName(span.chord);
            named = span.chord;
        }
        // The span's own sound first, then continuations that only sustain it.
        let tick = span.slot * slotLength;
        let remaining = span.slots * slotLength;
        let first = true;
        while (remaining > 0) {
            const piece = pairTicks ? feelPiece(tick, remaining, pairTicks) : NOTE_VALUES.find(v => v.ticks <= remaining);
            if (!piece) return { error: 'A span is shorter than a thirty-second note.' };
            const kind = first ? span.kind
                : span.kind === 'strike' || span.kind === 'tie' ? 'tie' : 'rest';
            beats.push({
                tick,
                ticks: piece.ticks,
                value: piece.value,
                dotted: piece.dotted,
                kind,
                frets: kind === 'rest' ? null : span.frets,
                direction: first ? span.direction ?? null : null,
                accent: first ? !!span.accent : false,
                chordName: first ? chordName : null
            });
            tick += piece.ticks;
            remaining -= piece.ticks;
            first = false;
        }
        ringing = span.kind === 'strike' || span.kind === 'tie' ? span.frets : null;
    }
    return { beats, context: { ringing, named } };
}

/** A song's feel: one of FEELS' ids, or null for straight. `swing` is how songs said triplet eighths. */
const songFeel = song => song.feel ?? (song.swing ? 'triplet8th' : null);

/**
 * The next note value of a span in a song with a feel, whose pairs fill `pairTicks`: 960 for an
 * eighth feel, two eighths to a quarter, and 480 for a sixteenth feel.
 *
 * A file's feel moves only a note of the paired value that directly follows another on the edge of
 * a pair (see tripletFeelTimes in audioTrack.mjs, which follows alphaTab). Written the usual way,
 * the longest note first, some second halves would not be such a pair: in D - D U - U D U the up on
 * the and of 2 rings through beat 3, a quarter note starting off the beat, and it would be played
 * straight while the and of 4 swung. So a span is cut at the edges of the pairs: whole pairs from an
 * edge, and never more than half a pair from the middle of one, the rest tied on. Every second half
 * is then the second note of a pair, and the file plays as the feel says, here and in any program
 * that plays feels as alphaTab does. For eighth feels this is cutting at the beat, as swing has
 * since 2026-11-11; for sixteenth feels at each half beat, since 2026-11-12 (docs/one-player.md,
 * decision 18).
 *
 * A measure that needs a finer grid than the feel pairs, for a chord starting on a quarter of a
 * beat under an eighth feel, can still leave a pair unmatched, which is then played straight.
 */
function feelPiece(tick, remaining, pairTicks) {
    const within = tick % pairTicks;
    if (within === 0 && remaining >= pairTicks) {
        return NOTE_VALUES.find(v => v.ticks <= remaining && v.ticks % pairTicks === 0);
    }
    const most = within === pairTicks / 2 ? Math.min(remaining, pairTicks / 2) : remaining;
    return NOTE_VALUES.find(v => v.ticks <= most);
}

function alphaTexBeat(beat) {
    const effects = [];
    if (beat.dotted) effects.push('d');
    if (beat.kind === 'strike' || beat.kind === 'mute') effects.push(beat.direction === 'up' ? 'su' : 'sd');
    if (beat.chordName) effects.push(`ch ${quoted(beat.chordName)}`);
    const effectText = effects.length ? ` {${effects.join(' ')}}` : '';

    if (beat.kind === 'rest') return `r.${beat.value}${effectText}`;
    const fretText = { strike: f => f.fret, tie: () => '-', mute: () => 'x' }[beat.kind];
    const noteEffect = beat.accent ? '{ac}' : '';
    const notes = [...beat.frets]
        .sort((a, b) => b.string - a.string)
        .map(f => `${fretText(f)}.${f.string}${noteEffect}`);
    return `(${notes.join(' ')}).${beat.value}${effectText}`;
}

/**
 * The song as alphaTex text. Returns { text } or { error, measure }.
 *
 * Each chord's fingering is also declared with \chord, so a reader that meets only its name, as
 * audioTrack.mjs can, still knows the shape.
 */
export function songToAlphaTex(song) {
    // alphaTab 1.8's own style: arguments in parentheses, and no dot after the score's metadata.
    const lines = [];
    if (song.title) lines.push(`\\title ${quoted(song.title)}`);
    lines.push(`\\tempo ${song.tempo}`);

    const declared = new Map();
    for (const measure of song.measures) {
        for (const chord of measure.chords) {
            const name = chordDisplayName(chord);
            if (declared.has(name) || !chord.frets) continue;
            // \chord lists frets from string 1, the highest, down to string 6, with x for unplayed.
            const byString = new Map(chord.frets.map(f => [f.string, f.fret]));
            const frets = [1, 2, 3, 4, 5, 6].map(s => byString.has(s) ? byString.get(s) : 'x');
            declared.set(name, `\\chord (${quoted(name)} ${frets.join(' ')})`);
        }
    }
    lines.push(...declared.values());

    let context = { ringing: null, named: null };
    let timeSignature = null;
    for (const [index, measure] of song.measures.entries()) {
        const expanded = expandMeasure(measure, song, context);
        if (expanded.error) return { error: expanded.error, measure: index + 1 };
        context = expanded.context;

        const parts = [];
        // A time signature is written where it changes, and alphaTab carries it forward.
        const measureSignature = `${measure.beatsPerBar ?? song.beatsPerBar} ${measure.beatUnit ?? song.beatUnit}`;
        if (measureSignature !== timeSignature) parts.push(`\\ts (${measureSignature})`);
        timeSignature = measureSignature;
        if (index === 0 && song.key) parts.push(`\\ks ${song.key.toLowerCase()}${song.mode}`);
        // Written once: alphaTab carries a bar's triplet feel forward, as it does the time signature.
        if (index === 0 && songFeel(song)) parts.push(`\\tf ${songFeel(song)}`);
        if (measure.section) parts.push(`\\section (${quoted(measure.section)})`);
        parts.push(...expanded.beats.map(alphaTexBeat));
        lines.push(`${parts.join(' ')} |`);
    }
    return { text: lines.join('\n') + '\n' };
}

// --- Reading ---------------------------------------------------------------------------------

/**
 * What would be heard, for comparing two ways of writing a measure.
 *
 * Ties are dropped, since they only sustain; so are rests after a rest or a mute, which are
 * silence either way. A strike is its time,
 * frets, direction and accent; a mute its time, direction and accent, since a deadened string
 * sounds no pitch.
 *
 * An upstroke is compared by its top four strings, which is what the writer writes, so a file
 * saved before 2026-11-12, which wrote every string of the chord on an upstroke, still reads as it
 * did. Saved again, its upstrokes are written on four strings.
 */
function heardEvents(beats) {
    const events = [];
    for (const beat of beats) {
        if (beat.kind === 'tie') continue;
        if (beat.kind === 'rest') {
            const before = events[events.length - 1]?.kind;
            if (before !== 'rest' && before !== 'mute') events.push({ tick: beat.tick, kind: 'rest' });
            continue;
        }
        const direction = beat.direction ?? 'down';
        events.push({
            tick: beat.tick,
            kind: beat.kind,
            frets: beat.kind !== 'strike' ? null
                : fretsKey(direction === 'up' ? upstrokeFrets(beat.frets) : beat.frets),
            direction,
            accent: !!beat.accent
        });
    }
    return JSON.stringify(events);
}

const SAME_SOUND_EFFECTS = [
    ['bend', n => n.bendPoints?.length > 0],
    ['slide', n => n.slideInType > 0 || n.slideOutType > 0],
    ['vibrato', n => n.vibrato > 0],
    ['harmonic', n => n.harmonicType > 0],
    ['hammer-on or pull-off', n => n.isHammerPullOrigin],
    ['let ring', n => n.isLetRing],
    ['palm mute', n => n.isPalmMute],
    ['ghost note', n => n.isGhost],
    ['staccato', n => n.isStaccato],
    ['heavy accent or tenuto', n => n.accentuated !== ACCENT_NONE && n.accentuated !== ACCENT_NORMAL]
];

function beatDirection(beat) {
    if (beat.brushType === BRUSH_UP || beat.brushType === ARPEGGIO_UP) return 'up';
    if (beat.brushType === BRUSH_DOWN || beat.brushType === ARPEGGIO_DOWN) return 'down';
    if (beat.pickStroke === PICK_UP) return 'up';
    if (beat.pickStroke === PICK_DOWN) return 'down';
    return null;
}

/**
 * One alphaTab beat in this module's terms, or { reason } when the simple form cannot hold it.
 */
function readBeat(beat, stringCount) {
    if (beat.graceType > 0) return { reason: 'a grace note' };
    if (beat.tupletNumerator > 0 && beat.tupletNumerator !== beat.tupletDenominator) return { reason: 'a tuplet' };
    const base = { tick: beat.playbackStart, ticks: beat.playbackDuration };
    if (beat.isRest || beat.notes.length === 0) return { ...base, kind: 'rest' };

    for (const note of beat.notes) {
        if (!note.isStringed) return { reason: 'a note not on a string' };
        const effect = SAME_SOUND_EFFECTS.find(([, has]) => has(note));
        if (effect) return { reason: `a ${effect[0]}` };
    }
    const ties = beat.notes.filter(n => n.isTieDestination).length;
    const dead = beat.notes.filter(n => n.isDead).length;
    if (ties && ties !== beat.notes.length) return { reason: 'a beat that ties some strings and strikes others' };
    if (dead && dead !== beat.notes.length) return { reason: 'a beat that mutes some strings and plays others' };

    // alphaTab numbers strings from the lowest; tab numbering counts from the highest.
    const frets = beat.notes.map(n => ({ string: stringCount - n.string + 1, fret: n.fret }));
    return {
        ...base,
        kind: ties ? 'tie' : dead ? 'mute' : 'strike',
        frets,
        midi: beat.notes.map(n => n.realValue).filter(m => typeof m === 'number'),
        direction: beatDirection(beat),
        accent: beat.notes.some(n => n.accentuated === ACCENT_NORMAL),
        chordName: beat.hasChord && beat.chord ? beat.chord.name : null,
        diagram: beat.hasChord && beat.chord ? chordDiagramFrets(beat.chord) : null
    };
}

/**
 * The fingering a chord symbol's diagram gives, [{ string, fret }] in tab numbering, or null where
 * it gives none. alphaTab keeps a diagram's frets from string 1, the highest, with -1 for a string
 * not played; a saved progression declares one for every chord with \chord.
 */
function chordDiagramFrets(chord) {
    const frets = (chord.strings ?? []).map((fret, index) => ({ string: index + 1, fret }))
        .filter(f => typeof f.fret === 'number' && f.fret >= 0);
    return frets.length ? frets : null;
}

/**
 * The whole fingering of a chord whose first strike is an upstroke, which writes only its top
 * strings: the diagram printed with its name, or the library's shape, whichever has those top
 * strings. Otherwise the strike's own strings, as an upstroke of every string is.
 */
function upstrokeChordFrets(pending, beat, song) {
    const struck = fretsKey(beat.frets);
    const candidates = [pending.diagram, libraryFrets(song.library, pending) ?? spelledFrets(pending)];
    return candidates.find(frets => frets && fretsKey(upstrokeFrets(frets)) === struck) ?? beat.frets;
}

/**
 * Index of chord names and fingerings, for naming what a score plays.
 *
 * Names are every chord the library has, and every name identifyChordFromNotes can give, so a
 * chord named from its notes reads back by the same name.
 */
export function chordIndex(library) {
    const byName = new Map();
    const byFrets = new Map();
    for (const root of PITCH_CLASS_NAMES) {
        for (const suffix of IDENTIFY_SUFFIXES) byName.set(chordDisplayName({ root, suffix }), { root, suffix });
    }
    for (const entry of library?.chords ?? []) {
        byName.set(chordDisplayName(entry), entry);
        for (const voicing of entry.voicings ?? []) {
            const frets = voicing.strings.filter(s => s.play !== 'muted').map(s => ({ string: s.string, fret: s.fret }));
            const key = fretsKey(frets);
            // The first entry to claim a shape keeps it; see chordDisplayName's caveats about
            // shapes filed under more than one name.
            if (!byFrets.has(key)) byFrets.set(key, entry);
        }
    }
    return { byName, byFrets };
}

/**
 * Reads one bar into its simple form, or says why it has none.
 *
 * Returns { measure, context } or { reason, context }. The context is what the bar actually left
 * ringing, whichever way it reads, so the next bar is judged on what really precedes it.
 */
function readBar(bar, song, stringCount, context) {
    // What the bar really leaves ringing for the next, whatever its form, taken from its last
    // beat: the sounded or tied strings, or nothing after a rest or a mute.
    const beats = bar.voices?.[0]?.beats ?? [];
    const last = beats[beats.length - 1];
    let actualRinging = !last ? context.ringing
        : last.isRest || last.notes.length === 0 || last.notes.every(n => n.isDead) ? null
            : last.notes.filter(n => !n.isDead).map(n => ({ string: stringCount - n.string + 1, fret: n.fret }));
    let actualNamed = context.named;

    const raw = [];
    for (const beat of beats) {
        const read = readBeat(beat, stringCount);
        if (read.reason) return { reason: `it has ${read.reason}`, context: { ringing: actualRinging, named: context.named } };
        raw.push(read);
    }
    const otherVoices = (bar.voices ?? []).slice(1).some(v => (v.beats ?? []).some(b => !b.isRest && b.notes.length));
    if (otherVoices) return { reason: 'it has more than one voice', context: { ringing: null, named: context.named } };

    // Where each chord takes over. A name written on any beat starts that chord there, even on a
    // beat that only sustains the one before, as on a lead sheet; its shape comes from the next
    // strike. An unnamed strike whose shape differs from the chord sounding starts the chord its
    // shape is.
    const fail = reason => ({ reason, context: { ringing: actualRinging, named: actualNamed } });
    let current = context.named;
    let pending = null;
    const changes = [];
    for (const beat of raw) {
        if (beat.chordName) {
            const entry = song.index.byName.get(beat.chordName);
            if (!entry) return fail(`it names a chord unstrung does not know, ${beat.chordName}`);
            // A chord named and not struck before the next is named, as C is in G C@2.5 D played
            // on the beat: it still starts where it is named, with the library's shape.
            if (pending) {
                current = {
                    root: pending.root, suffix: pending.suffix,
                    frets: libraryFrets(song.library, pending) ?? spelledFrets(pending)
                };
                if (!current.frets) return fail(`it names ${chordDisplayName(pending)}, which has no fingering`);
                changes.push({ tick: pending.tick, chord: current });
            }
            pending = { root: entry.root, suffix: entry.suffix, tick: beat.tick, diagram: beat.diagram };
        }
        if (beat.kind !== 'strike') continue;
        const up = beat.direction === 'up';
        if (pending) {
            const frets = up ? upstrokeChordFrets(pending, beat, song) : beat.frets;
            current = { root: pending.root, suffix: pending.suffix, frets };
            changes.push({ tick: pending.tick, chord: current });
            pending = null;
        } else if (current && up && fretsKey(upstrokeFrets(current.frets)) === fretsKey(beat.frets)) {
            // An upstroke on the top strings of the chord sounding continues it: decision 11.
            continue;
        } else if (!current || fretsKey(current.frets) !== fretsKey(beat.frets)) {
            // A library shape first; otherwise whatever its notes spell, which takes in partial
            // chords and power chords. The score's own frets are kept either way.
            const shaped = song.index.byFrets.get(fretsKey(beat.frets)) ?? identifyChordFromNotes(beat.midi)[0];
            if (!shaped) return fail(`it plays notes that spell no chord (${fretsKey(beat.frets)})`);
            current = { root: shaped.root, suffix: shaped.suffix, frets: beat.frets };
            changes.push({ tick: beat.tick, chord: current });
        }
    }
    if (pending) {
        // Named, but not struck before the bar ends: the library's shape stands in.
        current = {
            root: pending.root, suffix: pending.suffix,
            frets: libraryFrets(song.library, pending) ?? spelledFrets(pending)
        };
        if (!current.frets) return fail(`it names ${chordDisplayName(pending)}, which has no fingering`);
        changes.push({ tick: pending.tick, chord: current });
    }
    actualNamed = current;

    // The coarsest grid that every sounding event and every chord change falls on.
    const events = raw.filter(b => b.kind !== 'tie');
    const ticks = [...events.map(b => b.tick), ...changes.map(c => c.tick)];
    const slotsPerBeat = [1, 2, 4].find(n => ticks.every(t => t % slotTicks(song.beatUnit, n) === 0));
    if (!slotsPerBeat) return fail('its rhythm is finer than sixteenths');
    const slotLength = slotTicks(song.beatUnit, slotsPerBeat);

    const slots = Array.from({ length: song.beatsPerBar * slotsPerBeat }, () => ({ stroke: 'miss', accent: false }));
    for (const beat of events) {
        if (beat.kind === 'rest') continue;
        slots[beat.tick / slotLength] = {
            stroke: beat.kind === 'mute' ? 'mute' : beat.direction === 'up' ? 'up' : 'down',
            accent: beat.accent
        };
    }

    // The chord at beat 1 is whatever the bar opens with: its own first change, or the chord the
    // previous bar left. Later changes keep their place.
    const chords = [];
    if (context.named && !(changes[0]?.tick === 0)) chords.push({ ...context.named, beat: 1 });
    for (const change of changes) {
        if (sameChord(chords[chords.length - 1], change.chord)) continue;
        chords.push({ ...change.chord, beat: chords.length === 0 ? 1 : 1 + change.tick / beatTicks(song.beatUnit) });
    }
    // A bar of rests, with nothing ringing into it, is a silent measure: no chords at all.
    if (chords.length === 0 && events.some(b => b.kind !== 'rest')) return fail('it mutes strings with no chord to mute');

    const pattern = coarsestPattern(slots, slotsPerBeat);
    const measure = { section: bar.masterBar?.section?.text ?? null, chords, pattern };

    // The exact test: written back out, would it sound the same?
    const rewritten = expandMeasure(measure, song, context);
    if (rewritten.error) return { reason: rewritten.error, context: { ringing: actualRinging, named: actualNamed } };
    if (heardEvents(rewritten.beats) !== heardEvents(raw)) {
        return { reason: 'its chords and pattern do not say everything it plays', context: { ringing: actualRinging, named: actualNamed } };
    }
    return { measure, context: { ringing: actualRinging, named: actualNamed } };
}

// alphaTab's TripletFeel, by the FEELS id alphaTex writes it with.
const FEEL_BY_TRIPLET_FEEL = {
    1: 'triplet16th', 2: 'triplet8th', 3: 'dotted16th', 4: 'dotted8th', 5: 'scottish16th', 6: 'scottish8th'
};

/**
 * The song's feel, as { feel, feelChanges, swing }: `feel` one of FEELS' ids, or null for straight
 * or for one that changes from bar to bar, which `feelChanges` says. `swing` is triplet eighths.
 */
function readFeel(masterBars) {
    const feels = new Set(masterBars.map(bar => bar.tripletFeel ?? 0));
    if (feels.size > 1) return { feel: null, feelChanges: true, swing: false };
    const feel = FEEL_BY_TRIPLET_FEEL[[...feels][0]] ?? null;
    return { feel, feelChanges: false, swing: feel === 'triplet8th' };
}

function keyFromSignature(signature, type) {
    const mode = type === KEY_TYPE_MINOR ? 'minor' : 'major';
    const key = Object.entries(KEY_SIGNATURES[mode]).find(([, count]) => count === signature)?.[0];
    return key ? { key, mode } : { key: null, mode };
}

/**
 * Reads one track of a `Score`, the first unless told, into a song: each measure in its simplest
 * form.
 *
 * Every measure has `form`: "plain" (one chord, the song's most common pattern), "patterned"
 * (chords on the grid with another pattern, or more than one chord), "silent" (rests, with
 * nothing ringing into it), or "written" (with `reason`). The song's `pattern` is the most common one; `patterns` lists each with its measures.
 */
export function readSongFromScore(score, { library, trackIndex = 0 }) {
    const staff = score.tracks?.[trackIndex]?.staves?.[0];
    const firstMaster = score.masterBars?.[0];
    const firstBar = staff?.bars?.[0];
    const song = {
        title: score.title ?? '',
        ...keyFromSignature(firstBar?.keySignature ?? 0, firstBar?.keySignatureType ?? 0),
        beatsPerBar: firstMaster?.timeSignatureNumerator ?? 4,
        beatUnit: firstMaster?.timeSignatureDenominator ?? 4,
        tempo: scoreTempo(score),
        // The feel every bar states, one of FEELS' ids or null for straight; `feelChanges` when the
        // bars state more than one. Swung when it is triplet eighths.
        ...readFeel(score.masterBars ?? []),
        measures: []
    };
    const stringCount = staff?.tuning?.length ?? 6;
    const reading = { ...song, library, index: chordIndex(library) };

    let context = { ringing: null, named: null };
    for (const [index, bar] of (staff?.bars ?? []).entries()) {
        const master = score.masterBars[index];
        // Each bar is read in its own time signature; one that differs from the song's says so.
        const beatsPerBar = master.timeSignatureNumerator;
        const beatUnit = master.timeSignatureDenominator;
        const own = beatsPerBar !== song.beatsPerBar || beatUnit !== song.beatUnit ? { beatsPerBar, beatUnit } : {};
        const read = readBar(bar, { ...reading, beatsPerBar, beatUnit }, stringCount, context);
        context = read.context;
        song.measures.push(read.measure
            ? { form: 'simple', ...read.measure, ...own }
            : { form: 'written', reason: read.reason, section: master.section?.text ?? null, ...own });
    }

    // The song's pattern is its most common one that strikes something; measures with one chord
    // and that pattern are plain. Measures with no chords are silent.
    const counts = new Map();
    for (const [index, measure] of song.measures.entries()) {
        if (measure.form !== 'simple') continue;
        if (measure.chords.length === 0) { measure.form = 'silent'; continue; }
        const text = formatStrummingPattern(measure.pattern.slots);
        if (!counts.has(text)) counts.set(text, { text, slotsPerBeat: measure.pattern.slotsPerBeat, measures: [] });
        counts.get(text).measures.push(index + 1);
    }
    song.patterns = [...counts.values()].sort((a, b) => b.measures.length - a.measures.length);
    song.pattern = song.patterns.find(p => /[DUx]/.test(p.text)) ?? null;
    for (const measure of song.measures) {
        if (measure.form !== 'simple') continue;
        measure.form = measure.chords.length === 1 && formatStrummingPattern(measure.pattern.slots) === song.pattern?.text
            ? 'plain' : 'patterned';
    }
    return song;
}

/**
 * A song as chord practice shows it: chords in each measure, one strumming pattern throughout.
 * A measure's first chord is its entry in `chords`, and any after it are its `laterChords`.
 *
 * Returns { progression } in the shape chord practice is built from, with the song's tempo and
 * pattern, or { error } saying, in the words the Open dialog uses, what chord practice cannot show
 * yet. A saved song does not record that it was generated, so it reads as made by hand.
 */
export function progressionFromSong(song, { library, maxMeasures = 256 }) {
    if (!song.key) return { error: 'its key signature is not one of the keys unstrung offers' };
    if (song.measures.length === 0) return { error: 'it has no measures' };
    if (song.measures.length > maxMeasures) return { error: `it has more than ${maxMeasures} measures` };
    // A progression has no settings per measure, so a feel that changes partway is refused for good,
    // and the file is better opened as a song: docs/one-player.md, decision 18.
    if (song.feelChanges) {
        return { error: 'its feel changes partway through, which a progression cannot hold; opened as a song, with Open File, it plays as written' };
    }
    // Any one feel opens: progressions play on the audio track player, which plays all six, since
    // stage 3 of docs/one-player.md. Until then a feel other than triplet eighths was refused.

    const chords = [];
    let pattern = null;
    for (const [index, measure] of song.measures.entries()) {
        const number = index + 1;
        if (measure.form === 'written') return { error: `measure ${number} is written out, because ${measure.reason}` };
        if (measure.form === 'silent') return { error: `measure ${number} is silent, which chord practice cannot show yet` };
        if (measure.beatsPerBar) return { error: `measure ${number} changes the time signature, which chord practice cannot show yet` };
        for (const chord of measure.chords) {
            if (!(library?.chords ?? []).some(e => e.root === chord.root && e.suffix === chord.suffix)) {
                return { error: `measure ${number} has ${chordDisplayName(chord)}, which is not in the chord library` };
            }
        }
        const [chord, ...later] = measure.chords;
        const text = formatStrummingPattern(measure.pattern.slots);
        if (pattern && text !== pattern.text) {
            return { error: 'it uses more than one strumming pattern, which chord practice cannot show yet' };
        }
        pattern ??= { text, slotsPerBeat: measure.pattern.slotsPerBeat, slots: measure.pattern.slots };
        chords.push({
            root: chord.root, suffix: chord.suffix,
            ...(later.length ? { laterChords: later.map(c => ({ root: c.root, suffix: c.suffix, beat: c.beat })) } : {})
        });
    }
    return {
        progression: {
            key: song.key,
            mode: song.mode,
            beatsPerBar: song.beatsPerBar,
            beatUnit: song.beatUnit,
            tempo: song.tempo,
            // One of FEELS' ids, or null for straight, kept only where it is played, as
            // songFromProgression keeps it: a file stating triplet eighths in 6/8, or over
            // sixteenths, opens straight, as it would be saved again.
            feel: feelApplies(song.feel, song.beatUnit, pattern.slotsPerBeat) ? song.feel : null,
            // The same as a yes or no for triplet eighths, as Swing was before the Feel list.
            swing: !!song.swing && swingApplies(song.beatUnit, pattern.slotsPerBeat),
            chords,
            pattern: { slotsPerBeat: pattern.slotsPerBeat, slots: pattern.slots },
            origin: { made: 'hand' }
        }
    };
}

/**
 * The first error alphaTab reported reading alphaTex, as { message, line, column, offset }.
 *
 * alphaTab throws one error for the lot and keeps the details on its cause, in three lists.
 * Hints and warnings are passed over: only an error stopped the reading.
 */
export function alphaTexError(error) {
    const inner = error?.cause ?? error;
    for (const list of [inner?.lexerDiagnostics, inner?.parserDiagnostics, inner?.semanticDiagnostics]) {
        const item = (list?.items ?? []).find(d => d.severity === 2);
        if (item) {
            return { message: item.message, line: item.start?.line ?? null, column: item.start?.col ?? null, offset: item.start?.offset ?? null };
        }
    }
    return { message: error?.message ?? String(error), line: null, column: null, offset: null };
}

/** A short description of a measure, as a list item or `b` might say it. */
export function describeMeasure(measure, number) {
    if (measure.form === 'written') return `Measure ${number}, written out, because ${measure.reason}`;
    if (measure.form === 'silent') return `Measure ${number}, silent`;
    const chords = measure.chords.map((c, i) => i === 0 ? chordDisplayName(c) : `${chordDisplayName(c)} at ${c.beat}`).join(' ');
    if (measure.form === 'plain') return `Measure ${number}, ${chords}`;
    return `Measure ${number}, ${chords}, ${formatStrummingPattern(measure.pattern.slots)}`;
}
