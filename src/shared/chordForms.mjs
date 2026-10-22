// Chord forms held through a track: the shape the left hand keeps down across a span of beats,
// found from the frets those beats play together rather than from any one beat's notes. The rules,
// and why they are what they are, are in docs/chord-forms-in-scores.md.
//
// Works on a plain list of measures and events, which `trackEvents` reads out of an alphaTab
// staff, so the rules can be checked on tracks written out by hand. Kept free of alphaTab imports
// and DOM access, like scoreMetadata.mjs.

import { CHORD_FORMULAS, IDENTIFY_SUFFIXES, PITCH_CLASSES, identifyChordFromNotes } from './musicTheory.mjs';

// Chord qualities a player reading a strum would recognise. Identification can technically name
// any set of notes, but calling six open strings "G69" tells a guitarist less than listing the
// strings does, so only the everyday qualities stand in for a string-by-string reading.
export const RECOGNIZED_STRUM_SUFFIXES = new Set([
    'major', 'minor', '5', 'sus2', 'sus4', '7', 'maj7', 'm7', 'm7b5',
    'dim', 'dim7', 'aug', '6', 'm6', 'add9', 'madd9', '9', 'm9', 'maj9', 'mmaj7'
]);

/** The numbers the design note leaves to be measured, with the values tried first. */
export const FORM_DEFAULTS = {
    // Widest a held form may be: its highest fret less its lowest, open strings not counted.
    reach: 4,
    // The most of a form's sounding time its exceptions may take before it is not held at all.
    maxExceptionShare: 1 / 3,
    // The least of a printed symbol's sounding time its chord tones must fill for a melody to fit it.
    harmonyShare: 0.5,
    // How a note off the form is known to be an exception rather than a change; see `returns`.
    // 'compare' is what the corpus supports; the others are kept for the report to compare.
    returnRule: 'compare'
};

const TICKS_PER_QUARTER = 960;
const EPSILON = 1e-6;

/**
 * A staff as measures of events, in the frame the rest of this file works in.
 *
 * Each measure is { beatsPerBar, events, symbols }. An event is one beat that sounds:
 * { beat, length, notes, beatIndex }, `beatIndex` being its place among the bar's beats, rests
 * included, and `beat` its start counted from 1 in beats of the time signature, as chord
 * symbols are placed, and each note { string, fret, midi, slurIn, slurOut } in tab numbering.
 * `midi` has the capo taken off, so names come out as fingered, as describeChordedBeat's do.
 *
 * Left out: rests, grace notes, muted strings, and notes tied over from the beat before, which
 * are sound carried on rather than anything the hand does. Symbols are { name, beat }.
 */
export function trackEvents(staff, masterBars = []) {
    const stringCount = staff.tuning ? staff.tuning.length : 0;
    const capo = staff.capo > 0 ? staff.capo : 0;
    return (staff.bars ?? []).map((bar, index) => {
        const masterBar = masterBars[index];
        const ticksPerBeat = TICKS_PER_QUARTER * 4 / (masterBar?.timeSignatureDenominator || 4);
        const events = [];
        const symbols = [];
        for (const [beatIndex, beat] of (bar.voices[0] ? bar.voices[0].beats : []).entries()) {
            const start = (beat.playbackStart || 0) / ticksPerBeat + 1;
            if (beat.isRest) continue;
            if (beat.hasChord && beat.chord?.name) symbols.push({ name: beat.chord.name, beat: start });
            if (beat.graceType) continue;
            const notes = beat.notes
                .filter(note => note.isStringed && !note.isDead && !note.isTieDestination && typeof note.realValue === 'number')
                .map(note => ({
                    string: stringCount - note.string + 1,
                    fret: note.fret,
                    midi: note.realValue - capo,
                    slurIn: !!note.isHammerPullDestination,
                    slurOut: !!note.isHammerPullOrigin
                }));
            if (notes.length > 0) events.push({ beat: start, length: (beat.playbackDuration || 0) / ticksPerBeat, notes, beatIndex });
        }
        return { beatsPerBar: masterBar?.timeSignatureNumerator || 4, events, symbols };
    });
}

// --- Forms as fret maps ------------------------------------------------------------------

const pitchClass = midi => ((midi % 12) + 12) % 12;
const identityOf = chord => `${PITCH_CLASSES[chord.root]}|${chord.suffix}`;

/** Highest fret less lowest, open strings not counted. */
function reachOf(frets) {
    const fretted = [...frets.values()].filter(fret => fret > 0);
    return fretted.length === 0 ? 0 : Math.max(...fretted) - Math.min(...fretted);
}

/**
 * Notes of the event off the form: on a string the form already uses, at another fret.
 *
 * With `returnRule: 'compare'`, also notes on strings the form does not use yet, where the form
 * already spells a chord and they would turn it into one with another root, or none. A C on
 * string 5 under a D picked on strings 2 to 4 is the next chord arriving, not part of the D.
 */
function conflicts(frets, event, settings) {
    const off = event.notes.filter(note => frets.has(note.string) && frets.get(note.string) !== note.fret);
    if (off.length > 0 || settings?.returnRule !== 'compare') return off;
    const added = event.notes.filter(note => !frets.has(note.string));
    if (added.length === 0) return off;
    const before = chordOf(frets, settings.openMidi);
    if (!before) return off;
    const joined = new Map(frets);
    for (const note of added) joined.set(note.string, note.fret);
    const after = chordOf(joined, settings.openMidi);
    return after && PITCH_CLASSES[after.root] === PITCH_CLASSES[before.root] ? off : added;
}

/** Whether the event can be played without moving off the form; new strings may join it. */
function fits(frets, event, settings) {
    if (conflicts(frets, event, settings).length > 0) return false;
    const joined = new Map(frets);
    for (const note of event.notes) joined.set(note.string, note.fret);
    return reachOf(joined) <= settings.reach;
}

/** A hammer-on or pull-off runs from one event into the next. */
const slurred = (from, to) => from.notes.some(note => note.slurOut) && to.notes.some(note => note.slurIn);

/** The everyday chord a fret map spells, or null. Needs at least two different notes. */
function chordOf(frets, openMidi) {
    const midis = [...frets].map(([string, fret]) => openMidi.get(string) + fret);
    if (new Set(midis.map(pitchClass)).size < 2) return null;
    const reading = identifyChordFromNotes(midis).find(candidate => RECOGNIZED_STRUM_SUFFIXES.has(candidate.suffix));
    return reading ? { root: reading.root, suffix: reading.suffix, name: reading.name, notes: reading.complexity } : null;
}

/** The form as a fingering, from the lowest string to the highest, x for a string it leaves out. */
export function fretsKey(frets, stringCount = 6) {
    const parts = [];
    for (let string = stringCount; string >= 1; string--) {
        const fret = frets.get(string);
        parts.push(fret === undefined ? 'x' : String(fret));
    }
    // Frets past 9 would run together, so they get separators. None of the first cases do.
    return parts.some(part => part.length > 1) ? parts.join('-') : parts.join('');
}

// --- Gathering spans ---------------------------------------------------------------------

/**
 * First pass: walks the track, growing a form while the beats fit it.
 *
 * An event off the form is an exception when the next event fits the form again; events joined
 * by hammer-ons and pull-offs count as one, however many there are. Otherwise the form ends and a
 * new one starts on that event. A string's fret is the first one it is played at; which of two
 * frets is really the form is decided afterwards, in `chooseForm`.
 */
function gatherSpans(events, settings) {
    const spans = [];
    let current = null;
    const begin = index => {
        current = { members: [index], frets: new Map(events[index].notes.map(note => [note.string, note.fret])) };
        spans.push(current);
    };

    for (let index = 0; index < events.length; index++) {
        const event = events[index];
        if (!current) { begin(index); continue; }
        if (fits(current.frets, event, settings)) {
            for (const note of event.notes) current.frets.set(note.string, note.fret);
            current.members.push(index);
            continue;
        }
        let last = index;
        while (last + 1 < events.length && !fits(current.frets, events[last + 1], settings) && slurred(events[last], events[last + 1])) last++;
        if (returns(current.frets, events, index, last, settings)) {
            // A one-finger change for a beat or less that the file prints as a chord of its own,
            // such as Sister Golden Hair's Asus2 inside an A, is kept as its own form, and the form
            // around it carries on afterwards with what the hand was holding.
            if (printedChange(current.frets, events, index, last, settings)) {
                spans.push({ members: range(index, last), frets: new Map(events.slice(index, last + 1).flatMap(e => e.notes.map(note => [note.string, note.fret]))) });
                current = { members: [], frets: new Map(current.frets) };
                spans.push(current);
                index = last;
                continue;
            }
            for (let member = index; member <= last; member++) current.members.push(member);
            index = last;
            continue;
        }
        begin(index);
    }
    // A form carried on after a printed change can end before any beat joins it.
    return spans.filter(span => span.members.length > 0);
}

const range = (first, last) => Array.from({ length: last - first + 1 }, (_, i) => first + i);

/**
 * Whether the events from `first` to `last`, off the form and about to come back to it, are a
 * change the file prints as a chord of its own: a chord printed where they start, other than the
 * form's chord but with its root, one string off the form, the hand back within a beat.
 */
function printedChange(frets, events, first, last, settings) {
    const name = events[first].printedName;
    if (!name) return false;
    const printed = parseChordSymbol(name);
    const held = chordOf(frets, settings.openMidi);
    if (!printed || !held || printed.pc !== PITCH_CLASSES[held.root]) return false;
    // A power chord being filled out to the printed chord is no change: Mother prints G where the
    // hand fills a G5 out to a full G. A full chord is a change, as C to a printed Cmaj7 is.
    const heldPcs = new Set([...frets].map(([string, fret]) => pitchClass(settings.openMidi.get(string) + fret)));
    if (heldPcs.size < 3 && [...heldPcs].every(pc => printed.pcs.has(pc))) return false;
    const strings = new Set();
    for (let k = first; k <= last; k++) for (const note of conflicts(frets, events[k], settings)) strings.add(note.string);
    if (strings.size !== 1) return false;
    const back = events[last + 1];
    return !!back && back.position - events[first].position <= 1 + EPSILON;
}

/**
 * Whether the hand comes back to the form after the events from `first` to `last` left it.
 *
 * `returnRule: 'next'`, as the design note first put it: the next event fits the form. Too loose
 * for fingerpicking, where an open string after every fretted note fits almost any form.
 *
 * `returnRule: 'string'`: the string that left the form is played at the form's fret again, by the
 * end of the next measure, with no other string leaving the form first. Too strict: holding G and
 * picking only open strings after the off note never plays that string again.
 *
 * `returnRule: 'fretted'`: as 'string', but a fretted note of the form on any of its strings also
 * shows the hand is back. Open strings in between are passed over, since they fit whatever the
 * hand is doing; the first fretted note after the exception is what tells.
 *
 * `returnRule: 'compare'`: as 'fretted', and then the stretch after the off note must not be
 * better read as a new form; see `keepsForm`.
 */
function returns(frets, events, first, last, settings) {
    const next = last + 1;
    if (next >= events.length) return false;
    const rule = settings.returnRule;
    if (rule !== 'string' && rule !== 'fretted' && rule !== 'compare') return fits(frets, events[next], settings);

    const left = new Set();
    for (let k = first; k <= last; k++) for (const note of conflicts(frets, events[k], settings)) left.add(note.string);
    // An exception is one finger: notes off the form on one string. A strum off it on several,
    // such as a D between two strums of C, is a change, however soon the C comes back.
    if (rule === 'compare' && left.size > 1) return false;
    const limit = events[first].measure + 1;
    let back = false;
    for (let k = next; k < events.length && events[k].measure <= limit; k++) {
        const event = events[k];
        if (!fits(frets, event, settings)) break;
        if (event.notes.some(note => left.has(note.string) && frets.get(note.string) === note.fret)) { back = true; break; }
        if (rule !== 'string' && event.notes.some(note => note.fret > 0 && frets.has(note.string))) { back = true; break; }
    }
    if (rule !== 'compare' || !back) return back;
    return keepsForm(frets, events, first, settings);
}

/**
 * Plays the events from `from` to the end of the measure after `from`'s against a form, letting new
 * strings join it as `gatherSpans` does. Returns how many events land off it and the form it ends
 * as. The form passed in is not changed.
 */
function playAgainst(start, events, from, settings) {
    const frets = new Map(start);
    const limit = events[from].measure + 1;
    let off = 0;
    for (let k = from; k < events.length && events[k].measure <= limit; k++) {
        if (conflicts(frets, events[k], settings).length > 0) { off++; continue; }
        for (const note of events[k].notes) if (!frets.has(note.string)) frets.set(note.string, note.fret);
    }
    return { off, frets };
}

/**
 * `returnRule: 'compare'`: whether a note off the form is an exception or the start of another form.
 *
 * Two readings of the stretch from the off note to the end of the next measure: the hand stays on
 * the form, or a new form starts at the off note. The new form wins only where it spells an
 * everyday chord within reach and leaves fewer notes off it than staying does. Holding G and
 * reaching for a C on string 5 once leaves one note off the G, where a form starting on that C
 * spells nothing; Into Dust's guitar moving from D to C leaves two or more notes off the D every
 * measure, where the C it moves to leaves almost none.
 */
function keepsForm(frets, events, first, settings) {
    const stay = playAgainst(frets, events, first, settings);
    const change = playAgainst(new Map(), events, first, settings);
    if (stay.off <= change.off) return true;
    const chord = chordOf(change.frets, settings.openMidi);
    if (!chord || reachOf(change.frets) > settings.reach) return true;
    // A "new form" with the held chord's root is the same hand with a note moved, not a change:
    // Ripple's C alternates string 4 between open and fret 2, and from the open D the notes spell
    // Csus2 with fewer off it than the C, which is still the C.
    const held = chordOf(frets, settings.openMidi);
    return !!held && PITCH_CLASSES[held.root] === PITCH_CLASSES[chord.root];
}

const noteKey = note => `${note.string}:${note.fret}`;

/**
 * The exceptions a form has over a span's events: runs off it, a slurred run counting once. Notes
 * in `passing` (see `passingNotes`) are off it too, though their strings are not in the form.
 */
function exceptionsOf(frets, members, events, settings, passing = new Set()) {
    const groups = [];
    let previous = null;
    for (const member of members) {
        const off = conflicts(frets, events[member], settings).length > 0
            || events[member].notes.some(note => passing.has(noteKey(note)));
        if (!off) { previous = null; continue; }
        if (previous !== null && previous === member - 1 && slurred(events[previous], events[member])) {
            groups[groups.length - 1].push(member);
        } else {
            groups.push([member]);
        }
        previous = member;
    }
    return groups;
}

/** A form with everything said about it: chord, exceptions, and whether it is held at all. */
function judge(frets, members, events, openMidi, settings, passing = new Set()) {
    const exceptions = exceptionsOf(frets, members, events, settings, passing);
    const time = members.reduce((sum, member) => sum + events[member].length, 0);
    const offTime = exceptions.flat().reduce((sum, member) => sum + events[member].length, 0);
    const chord = chordOf(frets, openMidi);
    let reason = null;
    if (!chord) reason = 'spells no everyday chord';
    else if (reachOf(frets) > settings.reach) reason = 'too wide';
    else if (time > 0 && offTime / time > settings.maxExceptionShare + EPSILON) reason = 'too many exceptions';
    return { frets, chord, exceptions, reason, reach: reachOf(frets), passing };
}

// What a single note can add to a major or minor chord without the hand holding a different shape.
const ADDED_TONE_SUFFIXES = new Set(['add9', 'madd9', '6', 'm6', '7', 'maj7', 'm7', 'mmaj7']);

/**
 * Notes that passed through the form rather than belonging to it: a note on a string the form
 * otherwise leaves alone, picked on its own and never more than once in a measure, that turns its
 * major or minor chord into an add9, a 6 or a seventh. The open A on string 5 of a G picked once on
 * the way to the next chord is one, and so is a C sharp walking down under a D; an open string
 * picked on every pass of the pattern is part of the form.
 *
 * Returns the passing notes as "string:fret" keys, and the form without them.
 */
function passingNotes(span, events, openMidi) {
    const passing = new Set();
    const frets = new Map(span.frets);
    for (const [string, fret] of span.frets) {
        const heard = span.members.flatMap(member =>
            events[member].notes.filter(note => note.string === string).map(note => ({ note, event: events[member] })));
        if (heard.some(({ note, event }) => note.fret !== fret || event.notes.length > 1)) continue;
        const perMeasure = new Map();
        for (const { event } of heard) perMeasure.set(event.measure, (perMeasure.get(event.measure) ?? 0) + 1);
        if ([...perMeasure.values()].some(count => count > 1)) continue;
        const reduced = new Map(frets);
        reduced.delete(string);
        const full = chordOf(frets, openMidi);
        const rest = chordOf(reduced, openMidi);
        if (!full || !rest || !ADDED_TONE_SUFFIXES.has(full.suffix)) continue;
        if (rest.suffix !== 'major' && rest.suffix !== 'minor') continue;
        if (PITCH_CLASSES[full.root] !== PITCH_CLASSES[rest.root]) continue;
        passing.add(`${string}:${fret}`);
        frets.delete(string);
    }
    return { passing, frets };
}

/**
 * Every form a span could be: where a string is played at two frets, either could be the form
 * and the other the exception. Capped, since a run of melody can put many frets on one string.
 *
 * Each candidate also counts `strummed`: of the strings played at more than one fret, how many it
 * takes at a fret that sounds together with other strings somewhere in the span. A fret struck
 * in the chord is part of the shape; one only ever picked alone may be a note passing through.
 */
function candidatesFor(span, events, openMidi, settings) {
    const { passing, frets: base } = passingNotes(span, events, openMidi);
    const played = new Map();
    for (const member of span.members) {
        for (const note of events[member].notes) {
            if (passing.has(noteKey(note))) continue;
            if (!played.has(note.string)) played.set(note.string, new Set());
            played.get(note.string).add(note.fret);
        }
    }
    let maps = [new Map(base)];
    const varied = [];
    for (const [string, frets] of played) {
        if (frets.size < 2 || !base.has(string)) continue;
        varied.push(string);
        maps = maps.flatMap(map => [...frets].map(fret => new Map(map).set(string, fret)));
        if (maps.length > 32) { maps = maps.slice(0, 32); break; }
    }
    const together = (string, fret) => span.members.some(member =>
        events[member].notes.length > 1 && events[member].notes.some(note => note.string === string && note.fret === fret));
    return maps.map(frets => ({
        ...judge(frets, span.members, events, openMidi, settings, passing),
        strummed: varied.filter(string => together(string, frets.get(string))).length
    }));
}

/** Whether a library voicing has every string of the form at the same fret. */
function inLibrary(frets, library) {
    for (const entry of library?.chords ?? []) {
        for (const voicing of entry.voicings ?? []) {
            const byString = new Map(voicing.strings.filter(s => s.play !== 'muted').map(s => [s.string, s.fret]));
            if ([...frets].every(([string, fret]) => byString.get(string) === fret)) return true;
        }
    }
    return false;
}

/**
 * Which of a span's possible forms it holds, in the design note's order: the fret strummed with
 * the shape, then the form the track holds elsewhere, then fewest exceptions, then one the library
 * has, then the simpler chord. Returns the form and which rule settled it.
 */
function chooseForm(candidates, heldElsewhere, library) {
    const valid = candidates.filter(candidate => !candidate.reason);
    if (valid.length === 0) return { form: null, decidedBy: null };
    if (valid.length === 1) return { form: valid[0], decidedBy: candidates.length === 1 ? null : 'only one held' };

    const steps = [
        ['strummed with the shape', candidate => -candidate.strummed],
        ['held elsewhere in the track', candidate => -(heldElsewhere.get(identityOf(candidate.chord))?.size ?? 0)],
        ['fewest exceptions', candidate => candidate.exceptions.length],
        ['in the library', candidate => (inLibrary(candidate.frets, library) ? 0 : 1)],
        ['simpler chord', candidate => candidate.chord.notes * 100 + IDENTIFY_SUFFIXES.indexOf(candidate.chord.suffix)]
    ];
    let remaining = valid;
    for (const [rule, score] of steps) {
        const best = Math.min(...remaining.map(score));
        const kept = remaining.filter(candidate => score(candidate) === best);
        if (kept.length < remaining.length) {
            // A step that thins the field but leaves a tie hands the rest on to the next step.
            remaining = kept;
            if (remaining.length === 1) return { form: remaining[0], decidedBy: rule };
        }
    }
    return { form: remaining[0], decidedBy: 'no rule decided' };
}

// --- Whole measures ----------------------------------------------------------------------

/**
 * Whether a chord printed on a note off a form is no change from it: the form's own chord, or a
 * power chord being filled out to it, as Mother prints G where a G5 becomes a full G. Anything else
 * printed there is a change the file states, as a Cmaj7 printed for a beat inside a C is.
 */
function printedAgrees(name, frets, openMidi) {
    const printed = parseChordSymbol(name);
    const chord = chordOf(frets, openMidi);
    if (!printed || !chord) return true;
    if (`${printed.pc}|${printed.suffix}` === identityOf(chord)) return true;
    const held = new Set([...frets].map(([string, fret]) => pitchClass(openMidi.get(string) + fret)));
    return held.size < 3 && [...held].every(pc => printed.pcs.has(pc));
}

/**
 * How one form plays over a measure's events: the form grown by the strings the measure adds,
 * the notes off it, grouped as exceptions, and the passing notes. Null where it does not hold the
 * measure: where it spells no everyday chord, is too wide, has notes off it that do not come
 * straight back, or has more of the measure off it than `maxExceptionShare`.
 *
 * Coming back means the event after the notes off the form fits it: the next one in the measure,
 * or, after the measure's last, the first of the next measure. A C on the "and" of beat 4 that
 * carries on into the next measure is a change, not a note off the G.
 */
function playMeasure(start, members, events, openMidi, settings, { movingFinger = false, nearby = [] } = {}) {
    let frets = new Map(start);
    for (const member of members) {
        if (conflicts(frets, events[member], settings).length > 0) continue;
        for (const note of events[member].notes) if (!frets.has(note.string)) frets.set(note.string, note.fret);
    }
    const { passing, frets: held } = passingNotes({ members, frets }, events, openMidi);
    frets = held;
    const chord = chordOf(frets, openMidi);
    if (!chord || reachOf(frets) > settings.reach) return null;
    if (movingFinger) return playMovingFinger(frets, chord, members, nearby, events, openMidi, settings);

    const isOff = member => conflicts(frets, events[member], settings).length > 0
        || events[member].notes.some(note => passing.has(noteKey(note)));
    const groups = [];
    for (let k = 0; k < members.length; k++) {
        if (!isOff(members[k])) continue;
        const group = [members[k]];
        while (k + 1 < members.length && isOff(members[k + 1]) && slurred(events[members[k]], events[members[k + 1]])) group.push(members[++k]);
        // A chord the file prints on a note off the form is a change the file states.
        if (group.some(member => events[member].printedName && !printedAgrees(events[member].printedName, frets, openMidi))) return null;
        // An exception is one finger, notes off the form on one string; more is another chord.
        const offStrings = new Set(group.flatMap(member => [
            ...conflicts(frets, events[member], settings),
            ...events[member].notes.filter(note => passing.has(noteKey(note)))
        ].map(note => note.string)));
        if (offStrings.size > 1) return null;
        // And the finger has a place in the shape to come back to: the string is heard at the
        // form's fret somewhere in the measure. Into Dust's string 3 at fret 2 all through a
        // measure is where the hand is, not a note off a G whose string 3 is open.
        for (const string of offStrings) {
            if (!frets.has(string)) continue;
            if (!members.some(member => events[member].notes.some(note => note.string === string && note.fret === frets.get(string)))) return null;
        }
        const next = group[group.length - 1] + 1;
        if (k + 1 < members.length) {
            if (isOff(members[k + 1])) return null;
        } else if (next >= events.length || conflicts(frets, events[next], settings).length > 0) {
            // Not coming back at the bar line is a change, except for a lone open string at the
            // end of the measure, which is the hand lifting off on its way to the next chord: the
            // open D before Ripple's G, at the end of a measure of C.
            const lift = group.length === 1 && events[group[0]].notes.every(note => note.fret === 0);
            if (!lift) return null;
        }
        groups.push(group);
    }
    const time = members.reduce((sum, member) => sum + events[member].length, 0);
    const offTime = groups.flat().reduce((sum, member) => sum + events[member].length, 0);
    if (time > 0 && offTime / time > settings.maxExceptionShare + EPSILON) return null;
    return { frets, chord, exceptions: groups, passing, reach: reachOf(frets), reason: null };
}

const isPlain = chord => !!chord && (chord.suffix === 'major' || chord.suffix === 'minor');

/**
 * The moves of one finger on a string: each stretch of the string's notes at one fret other than
 * the form's, lasting until the string is played at another fret. Notes on other strings in
 * between do not end a move. Each move is one exception, its events grouped.
 */
function movesOn(frets, members, string, events) {
    const moves = [];
    let current = null;
    for (const member of members) {
        const note = events[member].notes.find(n => n.string === string);
        if (!note) continue;
        if (note.fret === frets.get(string)) { current = null; continue; }
        const last = current?.members[current.members.length - 1];
        // The same fret again, or a hammer-on or pull-off straight on from the move, is the same move.
        if (current && (current.fret === note.fret || (last === member - 1 && slurred(events[last], events[member])))) {
            current.members.push(member);
            current.fret = note.fret;
            continue;
        }
        current = { fret: note.fret, members: [member] };
        moves.push(current);
    }
    return moves.map(move => move.members);
}

/**
 * A measure as the plain chord with one finger moving through chords of its root, where no form
 * holds it otherwise: Cmaj7 and Cadd9 inside a C, strummed for half the measure each, with no
 * limit on how much of the measure the moves take. Null unless the chord is plain, every note off
 * it is on one string, each position of that string makes a chord with the plain chord's root and
 * not a second plain chord (E and Em are a change, though one finger makes it), the plain fret is
 * heard in the measure or the ones beside it (`nearby`), and no chord is printed on a move.
 */
function playMovingFinger(frets, chord, members, nearby, events, openMidi, settings) {
    if (!isPlain(chord)) return null;
    const off = members.flatMap(member => conflicts(frets, events[member], settings).map(note => ({ member, note })));
    const strings = new Set(off.map(({ note }) => note.string));
    if (strings.size !== 1) return null;
    const [string] = strings;
    if (![...members, ...nearby].some(member => events[member].notes.some(note => note.string === string && note.fret === frets.get(string)))) return null;
    for (const { member, note } of off) {
        const other = chordOf(new Map(frets).set(string, note.fret), openMidi);
        if (!other || isPlain(other) || PITCH_CLASSES[other.root] !== PITCH_CLASSES[chord.root]) return null;
        if (events[member].printedName && !printedAgrees(events[member].printedName, frets, openMidi)) return null;
    }
    return { frets, chord, exceptions: movesOn(frets, members, string, events), passing: new Set(), reach: reachOf(frets), reason: null };
}

/**
 * One finger moving through chords with the same root keeps the plain chord's name, the moves
 * counted as exceptions. Dust in the Wind holds a C shape while string 2 goes between fret 1, open
 * and fret 3, C, Cmaj7 and Cadd9, and each measure plays only two of the three; read measure by
 * measure the name followed whichever two, C in one measure and Cmaj7 in the next. A guitarist
 * calls it C throughout, with the finger moving.
 *
 * Works on consecutive measures held whole whose forms share a root and differ on one string at
 * most. The moving string is that one, or the string their exceptions are on. Where one of the
 * frets heard on it across those measures makes the plain major or minor chord, every measure in
 * the run takes that form, and its notes on the moving string at another fret are its exceptions.
 * The share of a measure an exception may take does not apply: the moving finger is most of what
 * the measure plays. A run where the plain chord's fret is never heard is left as it is, since
 * naming it would name a note the track never plays.
 */
function keepPlainChord(whole, byMeasure, events, openMidi) {
    const rootOf = form => PITCH_CLASSES[form.chord.root];
    for (let first = 0; first < whole.length; first++) {
        if (!whole[first]) continue;
        let last = first;
        while (last + 1 < whole.length && whole[last + 1] && rootOf(whole[last + 1]) === rootOf(whole[first])) last++;
        const run = [];
        for (let m = first; m <= last; m++) run.push(m);
        first = last;

        // The moving string: where the forms differ, or else where their exceptions fall.
        const differing = new Set();
        for (const m of run) {
            for (const [string, fret] of whole[m].frets) {
                if (run.some(other => whole[other].frets.has(string) && whole[other].frets.get(string) !== fret)) differing.add(string);
            }
        }
        const excepted = new Set(run.flatMap(m => whole[m].exceptions.flat().flatMap(member =>
            events[member].notes.filter(note => whole[m].frets.has(note.string) && whole[m].frets.get(note.string) !== note.fret).map(note => note.string))));
        const strings = differing.size > 0 ? differing : excepted;
        if (strings.size !== 1) continue;
        const [moving] = strings;

        const heard = new Set(run.flatMap(m => byMeasure[m].flatMap(member =>
            events[member].notes.filter(note => note.string === moving).map(note => note.fret))));
        const base = whole[run[0]].frets;
        const plain = [...heard].map(fret => ({ fret, chord: chordOf(new Map(base).set(moving, fret), openMidi) }))
            .find(({ chord }) => chord && (chord.suffix === 'major' || chord.suffix === 'minor') && PITCH_CLASSES[chord.root] === rootOf(whole[run[0]]));
        if (!plain) continue;

        for (const m of run) {
            const already = whole[m].frets.get(moving) === plain.fret;
            const frets = new Map(whole[m].frets).set(moving, plain.fret);
            // Notes off the shape on any other string would be a second finger; leave such a measure.
            const elsewhere = byMeasure[m].some(member => events[member].notes.some(note =>
                note.string !== moving && frets.has(note.string) && frets.get(note.string) !== note.fret));
            if (elsewhere) continue;
            // A measure whose own strings, with the plain fret, make some other chord is left too.
            const chord = chordOf(frets, openMidi);
            if (!isPlain(chord) || PITCH_CLASSES[chord.root] !== rootOf(whole[m])) continue;
            // Each move of the finger is one exception, however many notes it plays, in a measure
            // that already held the plain chord as in one that is brought to it.
            whole[m] = {
                ...whole[m], frets, chord, exceptions: movesOn(frets, byMeasure[m], moving, events),
                decidedBy: already ? whole[m].decidedBy : 'the plain chord through a moving finger'
            };
        }
    }
}

/**
 * Each measure on its own, before the reading across bar lines has its say: where one form holds
 * the whole measure, the measure holds that form. Ripple's lead measure 4 picks two open G strings,
 * which fit the G before it as well as the C, and then a C with one note off it; read across the
 * bar line the G kept the open strings and the C began on the "and" of beat 3, read alone the
 * measure is a C with one exception.
 *
 * The forms tried are those the reading found in, just before and just after the measure, and the
 * measure's own notes taken together. Of those that hold it: the one whose frets are struck with
 * the shape, then one agreeing with the chord the file prints, then the one held in the measure
 * before, then the one the track holds elsewhere, then the fewest exceptions, then the simpler
 * chord. So a measure of two open strings after a G is G.
 *
 * Measures no one form holds keep the reading across bar lines. The spans are rebuilt so that a
 * measure held whole is a span of its own, or joins the one before where that holds the same chord.
 * Returns how many measures were held whole.
 */
function readWholeMeasures(spans, measures, events, openMidi, settings, heldElsewhere) {
    const spanOf = new Array(events.length).fill(-1);
    spans.forEach((span, s) => { for (const member of span.members) spanOf[member] = s; });
    const byMeasure = measures.map(() => []);
    events.forEach((event, index) => byMeasure[event.measure].push(index));

    // The last chord printed at or before the first beat of each measure, read as a chord.
    let inEffect = null;
    const printedAtStart = measures.map(measure => {
        const atStart = measure.symbols.filter(symbol => symbol.beat <= 1 + EPSILON).pop();
        if (atStart) inEffect = parseChordSymbol(atStart.name);
        const current = inEffect;
        const later = measure.symbols.filter(symbol => symbol.beat > 1 + EPSILON).pop();
        if (later) inEffect = parseChordSymbol(later.name);
        return current;
    });
    const printedBy = m => printedAtStart[m];

    const whole = [];
    let previousIdentity = null;
    for (let m = 0; m < measures.length; m++) {
        const members = byMeasure[m];
        whole.push(null);
        if (members.length === 0) continue;

        const tried = new Map();
        const tryForm = (frets, rank) => {
            const key = fretsKey(frets, 12);
            if (frets.size === 0 || tried.has(key)) return;
            tried.set(key, {
                frets, rank,
                result: playMeasure(frets, members, events, openMidi, settings)
            });
        };
        const nearby = new Set([...members.map(member => spanOf[member]), spanOf[members[0] - 1], spanOf[members[members.length - 1] + 1]]);
        for (const s of nearby) if (s >= 0 && spans[s]?.form) tryForm(spans[s].form.frets, 0);
        // The measure's own notes: each string at the first fret it is played at, and where a string
        // is played at two, each of them.
        const played = new Map();
        for (const member of members) {
            for (const note of events[member].notes) {
                if (!played.has(note.string)) played.set(note.string, []);
                if (!played.get(note.string).includes(note.fret)) played.get(note.string).push(note.fret);
            }
        }
        let maps = [new Map([...played].map(([string, frets]) => [string, frets[0]]))];
        for (const [string, frets] of played) {
            if (frets.length < 2) continue;
            maps = maps.flatMap(map => frets.map(fret => new Map(map).set(string, fret)));
            if (maps.length > 16) { maps = maps.slice(0, 16); break; }
        }
        for (const map of maps) tryForm(map, 1);

        let holding = [...tried.values()].filter(entry => entry.result);
        // No form holds the measure: try each as the plain chord with one finger moving through it,
        // which may take as much of the measure as it likes.
        if (holding.length === 0) {
            const nearby = [...(byMeasure[m - 1] ?? []), ...(byMeasure[m + 1] ?? [])];
            holding = [...tried.values()]
                .map(entry => ({ ...entry, result: playMeasure(entry.frets, members, events, openMidi, settings, { movingFinger: true, nearby }) }))
                .filter(entry => entry.result);
            // A measure whose own notes never sound the plain chord is tried as it too, its moving
            // string set to each fret heard on it beside the measure.
            if (holding.length === 0) {
                for (const entry of tried.values()) {
                    for (const [string] of entry.frets) {
                        for (const member of nearby) {
                            const note = events[member].notes.find(n => n.string === string && n.fret !== entry.frets.get(string));
                            if (!note) continue;
                            const result = playMeasure(new Map(entry.frets).set(string, note.fret), members, events, openMidi, settings, { movingFinger: true, nearby });
                            if (result) holding.push({ ...entry, result });
                        }
                    }
                }
            }
        }
        if (holding.length === 0) { previousIdentity = null; continue; }
        // Strings the measure plays at more than one fret, and whether a form's fret on each sounds
        // together with other strings: a fret struck in the chord is part of the shape.
        const varied = [...played].filter(([, frets]) => frets.length > 1).map(([string]) => string);
        const strummed = frets => varied.filter(string => members.some(member =>
            events[member].notes.length > 1 && events[member].notes.some(note => note.string === string && note.fret === frets.get(string)))).length;
        // The chord the file has printed by the time the measure starts, if any: the file is the
        // first source of truth, so a form agreeing with it comes first.
        const printed = printedBy(m);
        const agrees = frets => {
            if (!printed) return 0;
            const pcs = new Set([...frets].map(([string, fret]) => pitchClass(openMidi.get(string) + fret)));
            return [...pcs].every(pc => printed.pcs.has(pc)) || [...printed.pcs].every(pc => pcs.has(pc)) ? 0 : 1;
        };
        const rules = [
            ['strummed with the shape', entry => -strummed(entry.result.frets)],
            ['the chord the file prints', entry => agrees(entry.result.frets)],
            ['held in the measure before', entry => (identityOf(entry.result.chord) === previousIdentity ? 0 : 1)],
            ['held elsewhere in the track', entry => -(heldElsewhere.get(identityOf(entry.result.chord))?.size ?? 0)],
            ['fewest exceptions', entry => entry.result.exceptions.length],
            ['simpler chord', entry => entry.result.chord.notes * 100 + IDENTIFY_SUFFIXES.indexOf(entry.result.chord.suffix)],
            ['found by the reading', entry => entry.rank]
        ];
        const compare = (a, b) => { for (const [, score] of rules) { const d = score(a) - score(b); if (d !== 0) return d; } return 0; };
        holding.sort(compare);
        const [best, second] = holding;
        best.result.decidedBy = second
            ? (rules.find(([, score]) => score(best) !== score(second))?.[0] ?? 'no rule decided')
            : null;
        whole[m] = best.result;
        previousIdentity = identityOf(best.result.chord);
    }

    keepPlainChord(whole, byMeasure, events, openMidi);

    // Rebuild the spans: a measure held whole is its own span, or joins the span before where that
    // ends just before it, holds the same chord and does not contradict it; every other measure
    // keeps its pieces of the spans it had.
    const rebuilt = [];
    const compatible = (a, b) => [...b].every(([string, fret]) => !a.has(string) || a.get(string) === fret);
    for (let m = 0; m < measures.length; m++) {
        const members = byMeasure[m];
        if (members.length === 0) continue;
        const last = rebuilt[rebuilt.length - 1];
        const adjoining = last && last.members[last.members.length - 1] === members[0] - 1 ? last : null;
        if (whole[m]) {
            const form = whole[m];
            if (adjoining?.form && identityOf(adjoining.form.chord) === identityOf(form.chord) && compatible(adjoining.form.frets, form.frets)) {
                for (const [string, fret] of form.frets) if (!adjoining.form.frets.has(string)) adjoining.form.frets.set(string, fret);
                adjoining.members.push(...members);
                adjoining.form.exceptions.push(...form.exceptions);
                for (const key of form.passing) adjoining.form.passing.add(key);
                adjoining.whole = true;
            } else {
                rebuilt.push({ members: [...members], form: { ...form, frets: new Map(form.frets), passing: new Set(form.passing), exceptions: [...form.exceptions] }, candidates: [form], decidedBy: form.decidedBy, whole: true });
            }
            continue;
        }
        for (const member of members) {
            const s = spanOf[member];
            const tail = rebuilt[rebuilt.length - 1];
            if (tail && tail.origin === s && tail.members[tail.members.length - 1] === member - 1) { tail.members.push(member); continue; }
            const origin = spans[s];
            rebuilt.push({
                origin: s, members: [member], candidates: origin.candidates, decidedBy: origin.decidedBy,
                form: origin.form ? { ...origin.form, frets: new Map(origin.form.frets) } : null
            });
        }
    }
    // A piece of a span keeps only the exceptions among its own beats.
    for (const span of rebuilt) {
        if (span.origin === undefined || !span.form) continue;
        const own = new Set(span.members);
        span.form.exceptions = span.form.exceptions.map(group => group.filter(member => own.has(member))).filter(group => group.length > 0);
    }
    spans.splice(0, spans.length, ...rebuilt);
    return whole.filter(Boolean).length;
}

// --- Measures ----------------------------------------------------------------------------

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const countWord = n => NUMBER_WORDS[n] ?? String(n);
// Parts of a beat a length is said in, nearest first: halves, quarters and the thirds of a triplet.
const BEAT_FRACTIONS = [
    [0, null, null], [1 / 4, 'a quarter', 'a quarter of a beat'], [1 / 3, 'a third', 'a third of a beat'],
    [1 / 2, 'a half', 'half a beat'], [2 / 3, 'two thirds', 'two thirds of a beat'],
    [3 / 4, 'three quarters', 'three quarters of a beat'], [1, null, null]
];

/**
 * A length in beats as it is said: "2 beats", "1 beat", "2 and a half beats", "half a beat".
 * Words rather than "2.5 beats", which a synthesizer reads as two point five. A length that falls
 * between these parts goes to the nearest.
 */
export function beatsText(n) {
    let whole = Math.floor(n + EPSILON);
    const [fraction, joined, alone] = BEAT_FRACTIONS.reduce((best, entry) =>
        (Math.abs(n - whole - entry[0]) < Math.abs(n - whole - best[0]) ? entry : best));
    if (fraction === 1) whole++;
    if (!joined) return `${whole} beat${whole === 1 ? '' : 's'}`;
    return whole === 0 ? alone : `${whole} and ${joined} beats`;
}
const positionText = beat => Number.isInteger(Number(beat.toFixed(6)))
    ? `at beat ${Math.round(beat)}`
    : `during beat ${Math.floor(beat + EPSILON)}`;

/**
 * A printed chord symbol as a chord: { pc, suffix, pcs }, or null for a name this cannot read.
 * The bass is dropped, as Chords Used drops it.
 */
export function parseChordSymbol(name) {
    const match = /^([A-G][#b]?)([^/]*)/.exec(String(name).trim());
    if (!match || PITCH_CLASSES[match[1]] === undefined) return null;
    const pc = PITCH_CLASSES[match[1]];
    const rest = match[2].trim();
    const aliases = { '': 'major', M: 'major', maj: 'major', m: 'minor', min: 'minor', '-': 'minor', sus: 'sus4', M7: 'maj7', Maj7: 'maj7', min7: 'm7', '-7': 'm7' };
    const suffix = aliases[rest] ?? rest;
    const formula = CHORD_FORMULAS[suffix];
    if (!formula) return null;
    return { root: match[1], pc, suffix: suffix === 'm' ? 'minor' : suffix, pcs: new Set(formula.map(i => (pc + i) % 12)) };
}

/**
 * Whether a melody under a printed chord fits it: its chord tones fill at least `harmonyShare` of
 * the sounding time, and the notes where the chord is printed, if any sound there, are mostly
 * chord tones.
 */
function fitsHarmony(regionEvents, symbol, first, settings) {
    let time = 0, toneTime = 0;
    for (const event of regionEvents) {
        const tones = event.notes.filter(note => symbol.pcs.has(pitchClass(note.midi))).length;
        time += event.length;
        toneTime += event.length * tones / event.notes.length;
    }
    if (time <= 0) return false;
    if (toneTime / time + EPSILON < settings.harmonyShare) return false;
    if (first && first.notes.filter(note => symbol.pcs.has(pitchClass(note.midi))).length * 2 < first.notes.length) return false;
    return true;
}

/**
 * The chord forms of one track, and what each measure says about them.
 *
 * `measures` comes from `trackEvents`. Returns:
 * - `spans`: every span gathered, with `form` null where it holds nothing, and `decidedBy` where
 *   it could have held two forms;
 * - `measures`: per measure, its `runs` of beats by span, the `heading` text, and `symbols`, each
 *   classified agree, partial, differ, harmony, clash, unknown or silent;
 * - `anomalies`: { measure, symbol, held } for each symbol the notes contradict;
 * - `chords`: Chords Used as the forms count it, with the fingering the track plays most.
 */
export function findChordForms(measures, { library = null, ...options } = {}) {
    // Each event also carries its position in beats from the start of the track, and the chord
    // the file prints on it, if any.
    const events = [];
    let measureStartBeat = 0;
    measures.forEach((measure, index) => {
        for (const event of measure.events) {
            events.push({
                ...event,
                measure: index,
                position: measureStartBeat + event.beat - 1,
                printedName: measure.symbols.find(symbol => Math.abs(symbol.beat - event.beat) < EPSILON)?.name ?? null
            });
        }
        measureStartBeat += measure.beatsPerBar;
    });
    const openMidi = new Map();
    for (const event of events) for (const note of event.notes) if (!openMidi.has(note.string)) openMidi.set(note.string, note.midi - note.fret);
    const settings = { ...FORM_DEFAULTS, ...options, openMidi };

    // Gather, then settle each span's form. Spans with only one possible form go first, since the
    // first rule for the others is which forms the track holds where there was no doubt.
    const spans = gatherSpans(events, settings);
    for (const span of spans) span.candidates = candidatesFor(span, events, openMidi, settings);
    const heldElsewhere = new Map();
    for (const span of spans) {
        if (span.candidates.length !== 1 || span.candidates[0].reason) continue;
        const key = identityOf(span.candidates[0].chord);
        if (!heldElsewhere.has(key)) heldElsewhere.set(key, new Set());
        for (const member of span.members) heldElsewhere.get(key).add(events[member].measure);
    }
    for (const span of spans) Object.assign(span, chooseForm(span.candidates, heldElsewhere, library));

    // A change of form that a common tone has pushed past the bar line is pulled back to it: where
    // a form starts mid-measure and every beat before it in that measure fits it too, those beats
    // join it, so a change written at beat 1 is found at beat 1.
    let aligned = 0;
    for (let i = 1; i < spans.length; i++) {
        const [before, after] = [spans[i - 1], spans[i]];
        if (!before.form || !after.form) continue;
        const first = events[after.members[0]];
        if (first.beat <= 1 + EPSILON || before.members[before.members.length - 1] !== after.members[0] - 1) continue;
        const moving = [];
        for (let k = before.members.length - 1; k >= 1 && events[before.members[k]].measure === first.measure; k--) moving.unshift(before.members[k]);
        if (moving.length === 0 || events[moving[0]].beat > 1 + EPSILON) continue;
        if (!moving.every(member => fits(after.form.frets, events[member], settings))) continue;
        // Moved only where both forms are still held afterwards.
        const kept = before.members.slice(0, before.members.length - moving.length);
        const joined = [...moving, ...after.members];
        const frets = new Map(after.form.frets);
        for (const member of moving) for (const note of events[member].notes) frets.set(note.string, note.fret);
        // The form left behind keeps only the strings its remaining beats still play at its frets.
        const keptFrets = new Map([...before.form.frets].filter(([string, fret]) =>
            kept.some(member => events[member].notes.some(note => note.string === string && note.fret === fret))));
        const newBefore = judge(keptFrets, kept, events, openMidi, settings, before.form.passing);
        const newAfter = judge(frets, joined, events, openMidi, settings, after.form.passing);
        if (newBefore.reason || newAfter.reason) continue;
        Object.assign(before, { members: kept, form: newBefore });
        Object.assign(after, { members: joined, form: newAfter });
        aligned++;
    }

    // A one-finger change for a beat or less between two of the same form is an exception of that
    // form, unless the file prints it: American Pie's C turns to Cmaj7 for a beat as string 2 comes
    // off fret 1, and nothing is printed there, so the C holds with one exception. Sister Golden
    // Hair prints its Esus4 for a beat inside an E, and that stays a form of its own.
    let folded = 0;
    for (let i = 1; i + 1 < spans.length; i++) {
        const [a, b, c] = [spans[i - 1], spans[i], spans[i + 1]];
        if (!a.form || !b.form || !c.form) continue;
        const adjacent = (x, y) => x.members[x.members.length - 1] + 1 === y.members[0];
        if (!adjacent(a, b) || !adjacent(b, c)) continue;
        if (identityOf(a.form.chord) !== identityOf(c.form.chord)) continue;
        if (PITCH_CLASSES[a.form.chord.root] !== PITCH_CLASSES[b.form.chord.root]) continue;
        const differ = [...b.form.frets].filter(([string, fret]) => a.form.frets.has(string) && a.form.frets.get(string) !== fret);
        if (differ.length !== 1) continue;
        if ([...c.form.frets].some(([string, fret]) => a.form.frets.has(string) && a.form.frets.get(string) !== fret)) continue;
        const first = events[b.members[0]];
        if (events[c.members[0]].position - first.position > 1 + EPSILON || first.printedName) continue;
        const frets = new Map(a.form.frets);
        for (const [string, fret] of c.form.frets) if (!frets.has(string)) frets.set(string, fret);
        const members = [...a.members, ...b.members, ...c.members];
        const passing = new Set([...a.form.passing, ...c.form.passing]);
        const form = judge(frets, members, events, openMidi, settings, passing);
        if (form.reason) continue;
        Object.assign(a, { members, form });
        spans.splice(i, 2);
        folded++;
        i--;
    }

    const wholeMeasures = readWholeMeasures(spans, measures, events, openMidi, settings, heldElsewhere);

    const owner = new Array(events.length).fill(null);
    spans.forEach((span, index) => { if (span.form) for (const member of span.members) owner[member] = index; });
    const exceptionStarts = new Set(spans.flatMap(span => (span.form ? span.form.exceptions.map(group => group[0]) : [])));

    const byMeasure = measures.map(() => []);
    events.forEach((event, index) => byMeasure[event.measure].push(index));

    // First the runs of each measure: its beats grouped by the span holding them. A form carried in
    // holds from beat 1, through any rest before its first note here. A run lasts until the next
    // one starts, or to the end of the measure: a form that simply stops sounding has not been let
    // go of, so only something else starting gives it a length.
    const measureStart = [];
    let total = 0;
    for (const measure of measures) { measureStart.push(total); total += measure.beatsPerBar; }
    const at = (m, beat) => measureStart[m] + beat - 1;
    const allRuns = measures.map((measure, m) => {
        const runs = [];
        for (const index of byMeasure[m]) {
            const last = runs[runs.length - 1];
            if (last && last.span === owner[index]) { last.members.push(index); continue; }
            runs.push({ span: owner[index], members: [index], measure: m });
        }
        runs.forEach((run, r) => {
            const span = run.span === null ? null : spans[run.span];
            run.carried = !!span && r === 0 && events[span.members[0]].measure < m;
            run.start = run.carried ? 1 : events[run.members[0]].beat;
            run.exceptions = run.members.filter(member => exceptionStarts.has(member)).length;
        });
        runs.forEach((run, r) => { run.end = runs[r + 1] ? runs[r + 1].start : measure.beatsPerBar + 1; });
        return runs;
    });

    // Then each printed chord, over everything until the next one, as a chord name holds on sheet
    // music: Into Dust prints F over a measure of D, F and A, and the C that makes it an F comes in
    // the measure after, before the next printed chord.
    const printed = measures.flatMap((measure, m) => measure.symbols.map((symbol, s) => ({ ...symbol, m, s })));
    const symbolsByMeasure = measures.map(() => []);
    printed.forEach((symbol, i) => {
        const measure = measures[symbol.m];
        const next = printed[i + 1];
        const from = at(symbol.m, symbol.beat);
        const to = next ? at(next.m, next.beat) : total;
        // Where the symbol's own measure stops being its: the next symbol in it, or its end.
        const regionEnd = measure.symbols[symbol.s + 1]?.beat ?? measure.beatsPerBar + 1;
        const result = { name: symbol.name, beat: symbol.beat, regionEnd };
        symbolsByMeasure[symbol.m].push(result);

        const chord = parseChordSymbol(symbol.name);
        if (!chord) { result.kind = 'unknown'; return; }
        const lastMeasure = next ? next.m : measures.length - 1;
        const overlapping = [];
        for (let m = symbol.m; m <= lastMeasure; m++) {
            for (const run of allRuns[m]) if (at(m, run.start) < to - EPSILON && at(m, run.end) > from + EPSILON) overlapping.push(run);
        }
        const overlap = run => Math.min(at(run.measure, run.end), to) - Math.max(at(run.measure, run.start), from);
        const held = overlapping.filter(run => run.span !== null);

        // A form agrees with the printed chord when it is that chord, part of it (a D picked without
        // its third under a printed D) or all of it with notes added (a Cadd9 shape under a printed
        // C). Only a different chord is an anomaly. Weighed over all of a span's beats under the
        // printed chord, with the passing notes they play: not part of the shape, but heard, and a
        // printed chord says what is heard.
        const relationOf = new Map();
        for (const run of held) {
            if (relationOf.has(run.span)) continue;
            const form = spans[run.span].form;
            let relation = null;
            if (identityOf(form.chord) === `${chord.pc}|${chord.suffix}`) relation = 'same';
            else {
                const pcs = new Set([...form.frets].map(([string, fret]) => pitchClass(openMidi.get(string) + fret)));
                for (const other of held.filter(r => r.span === run.span)) {
                    for (const member of other.members) {
                        for (const note of events[member].notes) if (form.passing.has(noteKey(note))) pcs.add(pitchClass(note.midi));
                    }
                }
                if ([...pcs].every(pc => chord.pcs.has(pc))) relation = 'part';
                else if ([...chord.pcs].every(pc => pcs.has(pc))) relation = 'more';
            }
            relationOf.set(run.span, relation);
        }
        const same = held.filter(run => relationOf.get(run.span));
        if (same.length > 0) {
            // The file's name, so the heading and Chords Used say what the file says.
            for (const run of same) {
                if (!run.fileChord) run.fileChord = { name: symbol.name.split('/')[0].trim(), root: chord.root, suffix: chord.suffix };
            }
            const covered = same.reduce((sum, run) => sum + overlap(run), 0);
            result.kind = covered >= to - from - EPSILON ? 'agree' : 'partial';
            result.relations = [...new Set(same.map(run => relationOf.get(run.span)))];
            return;
        }
        if (held.length > 0) {
            result.kind = 'differ';
            result.held = [...new Set(held.map(run => spans[run.span].form.chord.name))].join(' and ');
            return;
        }
        const regionEvents = overlapping.flatMap(run => run.members)
            .filter(member => at(events[member].measure, events[member].beat) >= from - EPSILON
                && at(events[member].measure, events[member].beat) < to - EPSILON)
            .map(member => events[member]);
        if (regionEvents.length === 0) { result.kind = 'silent'; return; }
        const first = regionEvents.find(event => event.measure === symbol.m && Math.abs(event.beat - symbol.beat) < EPSILON) ?? null;
        result.kind = fitsHarmony(regionEvents, chord, first, settings) ? 'harmony' : 'clash';
    });

    // A printed chord's name goes with the whole form it agreed with, not only the beats under it:
    // Sister Golden Hair's G#m is printed from the measure after the form starts, on the "and" of
    // beat 4, and the form is G#m from there too, not Abm. A run under a printed chord it does not
    // agree with keeps its own name.
    const spanName = new Map();
    for (const runs of allRuns) for (const run of runs) if (run.fileChord && !spanName.has(run.span)) spanName.set(run.span, run.fileChord);
    for (const runs of allRuns) for (const run of runs) if (!run.fileChord && run.span !== null && spanName.has(run.span)) run.fileChord = spanName.get(run.span);

    // "Continues" is said against what the heading before said, since that is what the listener
    // has: the chord the previous measure's heading ended on, or null where it named none.
    let lastSaid = null;
    const described = measures.map((measure, m) => {
        const end = measure.beatsPerBar + 1;
        const runs = allRuns[m];
        const symbols = symbolsByMeasure[m];
        for (const run of runs) run.name = run.span === null ? null : (run.fileChord?.name ?? spans[run.span].form.chord.name);

        // Forms are named in the heading only where the measure is simple enough to say quickly:
        // one form, whole or for part of the measure, or two with one change, at a beat or during
        // one, and no beat or more holding nothing besides. That covers about 85% of the sounding
        // measures on the guitar tracks tested. A measure with more, such as a chord on every
        // beat, says nothing about forms; its beats and the file's own chord symbols say the rest.
        const heldRuns = runs.filter(run => run.span !== null);
        const unheldTime = runs.filter(run => run.span === null).reduce((sum, run) => sum + run.end - run.start, 0);
        const named = heldRuns.length === 1 || (heldRuns.length === 2 && unheldTime < 1 - EPSILON);

        // The heading: each run of a form in order, with the symbols that override it.
        const pieces = runs.map((run, r) => {
            if (run.span === null || !named) return { start: run.start, text: null, run };
            // "Continues C" where the heading before ended on C, in that heading's spelling;
            // otherwise "holds", even where the hand has been on the form since before the bar
            // line, since the listener has not been told so.
            const identity = identityOf(run.fileChord ?? spans[run.span].form.chord);
            const continues = r === 0 && lastSaid?.identity === identity;
            // The file's spelling where it has one, otherwise the spelling the listener just heard.
            if (continues && !run.fileChord) run.name = lastSaid.name;
            let text = `${continues ? 'continues' : 'holds'} ${run.name}`;
            if (!continues && (r > 0 || run.start > 1 + EPSILON)) text += ` ${positionText(run.start)}`;
            // A length only where a beat or more holding nothing follows. Where another form comes
            // next, its own "at beat" or "during beat" already says where this one ends; under a
            // beat of notes holding nothing, such as a pickup into the next chord, does not end
            // the hold. Those notes are still described beat by beat.
            const nextHeld = runs.slice(r + 1).find(other => other.span !== null);
            const gapEnd = nextHeld ? nextHeld.start : end;
            const gap = runs.slice(r + 1).filter(other => other.span === null && other.start < gapEnd - EPSILON)
                .reduce((sum, other) => sum + Math.min(other.end, gapEnd) - other.start, 0);
            if (run.end < end - EPSILON && gap >= 1 - EPSILON) text += ` for ${beatsText(run.end - run.start)}`;
            if (run.exceptions > 0) text += `, ${countWord(run.exceptions)} exception${run.exceptions === 1 ? '' : 's'}`;
            return { start: run.start, text, run, said: { identity, name: run.name } };
        });
        for (const symbol of symbols) {
            if (!['differ', 'clash', 'harmony'].includes(symbol.kind)) continue;
            const label = `${symbol.name} (${symbol.kind === 'harmony' ? 'harmony' : 'anomaly'})`;
            const at = symbol.beat > 1 + EPSILON ? ` ${positionText(symbol.beat)}` : '';
            for (let p = pieces.length - 1; p >= 0; p--) {
                const piece = pieces[p];
                const inside = piece.start >= symbol.beat - EPSILON && piece.start < symbol.regionEnd - EPSILON;
                if (inside && (symbol.kind !== 'harmony' || piece.text === null)) pieces.splice(p, 1);
            }
            pieces.push({ start: symbol.beat, text: label + at });
        }
        pieces.sort((a, b) => a.start - b.start);
        const heading = pieces.filter(piece => piece.text).map(piece => piece.text).join(', ');
        // What the next heading continues from: the last form this one names, if the heading ends
        // on it. An anomaly or harmony label after it, or a measure naming no form, leaves nothing.
        const lastPiece = pieces.filter(piece => piece.text).pop();
        lastSaid = lastPiece?.said ?? null;
        return { number: m + 1, runs, symbols, heading, named };
    });

    const anomalies = described.flatMap(measure => measure.symbols
        .filter(symbol => symbol.kind === 'differ' || symbol.kind === 'clash')
        .map(symbol => ({
            measure: measure.number, symbol: symbol.name, beat: symbol.beat,
            held: symbol.kind === 'differ' ? symbol.held : null
        })));

    // Chords Used: every event of a form counts towards its chord, or towards the printed chord it
    // agreed with, under the file's name: a D picked without its third under a printed D is a D.
    // Events in no form still count as before, where their own notes spell an everyday chord, so a
    // strum between forms is not lost.
    const chords = new Map();
    const fileNames = new Map();
    const count = (chord, frets, held) => {
        const key = identityOf(chord);
        if (!chords.has(key)) chords.set(key, { name: chord.name, root: chord.root, suffix: chord.suffix, beats: 0, held: 0, fingerings: new Map(), fretMaps: new Map() });
        const entry = chords.get(key);
        entry.beats++;
        if (held) {
            entry.held++;
            const fingering = fretsKey(frets, Math.max(6, ...openMidi.keys()));
            entry.fingerings.set(fingering, (entry.fingerings.get(fingering) ?? 0) + 1);
            entry.fretMaps.set(fingering, frets);
        }
    };
    for (const measure of described) {
        for (const run of measure.runs) {
            for (const member of run.members) {
                if (run.span !== null) {
                    const form = spans[run.span].form;
                    if (run.fileChord) fileNames.set(identityOf(run.fileChord), run.fileChord.name);
                    count(run.fileChord ?? form.chord, form.frets, true);
                    continue;
                }
                const event = events[member];
                if (event.notes.length < 2) continue;
                const chord = chordOf(new Map(event.notes.map(note => [note.string, note.fret])), openMidi);
                if (chord) count(chord, null, false);
            }
        }
    }
    // `played` is the fingering the track holds the chord with most, as { string, fret } from the
    // lowest string, for showing ahead of the library's shapes.
    const chordList = [...chords].map(([key, { fretMaps, ...entry }]) => {
        const fingering = [...entry.fingerings].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
        const played = fingering === null ? null
            : [...fretMaps.get(fingering)].map(([string, fret]) => ({ string, fret })).sort((a, b) => b.string - a.string);
        return { ...entry, name: fileNames.get(key) ?? entry.name, fingering, played, fingerings: Object.fromEntries(entry.fingerings) };
    }).sort((a, b) => b.beats - a.beats);

    return { spans, measures: described, anomalies, chords: chordList, aligned, folded, wholeMeasures, events };
}
