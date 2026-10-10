// Reading a chord progression from pasted text: the JSON of a saved progression, copied with Copy
// to Clipboard and passed on, perhaps through an email or a chat on the way.
//
// parseSavedProgression in savedProgressions.mjs reads a file unstrung wrote itself, and refuses
// anything that is not exactly right. Text that has been through other hands is different: an
// email client curls the quotation marks, a person adds a measure and forgets a comma, a signature
// follows the closing brace. So this reads it leniently, mends what it safely can, and says what it
// mended, each by line. Only text it cannot make sense of at all is refused, with the line and
// column where reading stopped.
//
// A chord it cannot find in the chord library does not refuse the whole text: its measure is left
// empty, which the editor already shows and asks to be filled before the progression is made.
//
// Kept free of the DOM and of Node, like the rest of src/shared, so the checks can run it directly.

import { KEY_ROOTS, chordDisplayName } from './chordProgressions.mjs';
import { SAVED_PROGRESSION_FORMAT, MAX_MEASURES, MAX_BEATS, ORIGINS, notePitchClass } from './savedProgressions.mjs';

// --- Lenient JSON -----------------------------------------------------------------------------

/** A place in the text where reading had to stop. */
class TextProblem extends Error {
    constructor(message, offset) {
        super(message);
        this.offset = offset;
    }
}

/** Line and column, both from 1, of an offset in the text. */
export function lineAndColumn(text, offset) {
    const before = text.slice(0, offset);
    const line = before.split('\n').length;
    return { line, column: offset - before.lastIndexOf('\n') };
}

/**
 * Characters an email or word processor puts in place of plain ones. Each is replaced by exactly
 * one character, so an offset into the cleaned text is the same offset into what was pasted.
 */
const DOUBLE_QUOTES = /[\u201c\u201d\u201e\u201f\u2033\u00ab\u00bb]/g;
const SINGLE_QUOTES = /[\u2018\u2019\u201a\u201b\u2032]/g;
const ANY_CURLY_QUOTE = /[\u201c\u201d\u201e\u201f\u2033\u00ab\u00bb\u2018\u2019\u201a\u201b\u2032]/;
const ODD_SPACES = /[\u00a0\u2000-\u200b\u202f\u205f\u3000\ufeff]/g;

// A word written without quotation marks: a name, a key, a chord. Not a number or a literal.
const BARE_WORD = /[A-Za-z0-9#+\-_./]/;

/**
 * Parses JSON, mending what a person or a mail program commonly breaks. Returns `{ value, fixes }`
 * or throws a TextProblem. Fixes are sentences, each starting with the line it applies to.
 */
function parseLenientJson(original) {
    const found = [];
    const fix = (offset, message) => found.push({ offset, message });

    let text = original.replace(ODD_SPACES, ' ');
    const firstCurly = text.search(ANY_CURLY_QUOTE);
    if (firstCurly !== -1) {
        fix(firstCurly, 'curly quotation marks were read as straight ones.');
        text = text.replace(DOUBLE_QUOTES, '"').replace(SINGLE_QUOTES, '\'');
    }

    let at = text.indexOf('{');
    if (at === -1) {
        throw new TextProblem('there is no progression here: it needs to start with an opening brace {.', 0);
    }
    if (text.slice(0, at).trim() !== '') fix(at, 'the text before the opening brace { was ignored.');

    const peek = () => text[at];
    const skipSpace = () => { while (at < text.length && /\s/.test(text[at])) at++; };
    const describe = () => (at >= text.length ? 'the end of the text' : `"${text[at]}"`);

    function parseString() {
        const quote = text[at];
        const start = at;
        if (quote === '\'') fix(at, 'single quotation marks were read as double ones.');
        at++;
        let value = '';
        while (at < text.length && text[at] !== quote) {
            if (text[at] === '\n') throw new TextProblem('this text in quotation marks is not closed before the line ends.', start);
            if (text[at] === '\\' && at + 1 < text.length) {
                const next = text[at + 1];
                const escapes = { n: '\n', t: '\t', r: '\r', b: '\b', f: '\f', '"': '"', '\'': '\'', '\\': '\\', '/': '/' };
                if (next === 'u' && /^[0-9a-fA-F]{4}$/.test(text.slice(at + 2, at + 6))) {
                    value += String.fromCharCode(parseInt(text.slice(at + 2, at + 6), 16));
                    at += 6;
                    continue;
                }
                value += escapes[next] ?? next;
                at += 2;
                continue;
            }
            value += text[at++];
        }
        if (at >= text.length) throw new TextProblem('this text in quotation marks is never closed.', start);
        at++;
        return value;
    }

    function parseBareWord() {
        const start = at;
        while (at < text.length && BARE_WORD.test(text[at])) at++;
        return { word: text.slice(start, at), start };
    }

    function parseValue() {
        skipSpace();
        const c = peek();
        if (c === '{') return parseObject();
        if (c === '[') return parseArray();
        if (c === '"' || c === '\'') return parseString();
        if (c !== undefined && BARE_WORD.test(c)) {
            const { word, start } = parseBareWord();
            if (/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(word)) return Number(word);
            if (word === 'true') return true;
            if (word === 'false') return false;
            if (word === 'null') return null;
            fix(start, `${word} had no quotation marks, and was read as text.`);
            return word;
        }
        throw new TextProblem(`a value was expected here, but found ${describe()}.`, at);
    }

    // Shared by objects and arrays: what comes after an entry. Returns true when the list is over.
    function afterEntry(close, closeName, startsEntry) {
        skipSpace();
        if (peek() === close) { at++; return true; }
        if (peek() === ',') {
            const comma = at;
            at++;
            skipSpace();
            if (peek() === close) {
                fix(comma, `a comma before the closing ${closeName} was removed.`);
                at++;
                return true;
            }
            return false;
        }
        if (at >= text.length) {
            fix(at, `the text ended early, so a closing ${closeName} was added.`);
            return true;
        }
        if (startsEntry(peek())) {
            fix(at, 'a missing comma was added.');
            return false;
        }
        throw new TextProblem(`a comma or a closing ${closeName} was expected here, but found ${describe()}.`, at);
    }

    function parseObject() {
        at++;
        const object = {};
        skipSpace();
        if (peek() === '}') { at++; return object; }
        if (at >= text.length) { fix(at, 'the text ended early, so a closing brace } was added.'); return object; }
        for (;;) {
            skipSpace();
            let name;
            const c = peek();
            if (c === '"' || c === '\'') {
                name = parseString();
            } else if (c !== undefined && BARE_WORD.test(c)) {
                const { word, start } = parseBareWord();
                fix(start, `the name ${word} had no quotation marks; they were added.`);
                name = word;
            } else {
                throw new TextProblem(`a name in quotation marks was expected here, but found ${describe()}.`, at);
            }
            skipSpace();
            if (peek() === ':') {
                at++;
            } else if (peek() === '=') {
                fix(at, 'an equals sign was read as a colon.');
                at++;
            } else {
                throw new TextProblem(`a colon was expected after "${name}", but found ${describe()}.`, at);
            }
            object[name] = parseValue();
            if (afterEntry('}', 'brace }', ch => ch === '"' || ch === '\'' || BARE_WORD.test(ch))) return object;
        }
    }

    function parseArray() {
        at++;
        const array = [];
        skipSpace();
        if (peek() === ']') { at++; return array; }
        if (at >= text.length) { fix(at, 'the text ended early, so a closing bracket ] was added.'); return array; }
        for (;;) {
            array.push(parseValue());
            if (afterEntry(']', 'bracket ]', ch => ch === '{' || ch === '[' || ch === '"' || ch === '\'' || BARE_WORD.test(ch))) {
                return array;
            }
        }
    }

    const value = parseObject();
    skipSpace();
    if (at < text.length) fix(at, 'the text after the closing brace } was ignored.');
    // In the order they come in the text, which is not the order they were found in: the curly
    // quotation marks are found first, wherever they are.
    const fixes = found
        .sort((a, b) => a.offset - b.offset)
        .map(({ offset, message }) => `Line ${lineAndColumn(original, offset).line}: ${message}`);
    return { value, fixes };
}

// --- From parsed text to a progression ----------------------------------------------------------

// Chord symbols people write that the library spells another way. Applied before anything else,
// so "M7" is caught here as maj7 and never folded to lower case, where it would be m7.
const SUFFIX_SYNONYMS = {
    '': 'major', M: 'major', maj: 'major', Maj: 'major', major: 'major', Major: 'major',
    m: 'minor', min: 'minor', mi: 'minor', '-': 'minor', minor: 'minor', Minor: 'minor',
    M7: 'maj7', Maj7: 'maj7', '\u0394': 'maj7', '\u03947': 'maj7', '\u2206': 'maj7',
    min7: 'm7', mi7: 'm7', '-7': 'm7',
    '\u00b0': 'dim', o: 'dim', '\u00b07': 'dim7', o7: 'dim7',
    '\u00f8': 'm7b5', '\u00f87': 'm7b5', '+': 'aug', '+7': 'aug7'
};

/** A key's root as unstrung spells it ("Db" is "C#"), or null. */
function keyRoot(name) {
    const match = /^\s*([A-Ga-g])([#b\u266f\u266d]?)\s*$/.exec(String(name ?? ''));
    if (!match) return null;
    const accidental = match[2].replace('\u266f', '#').replace('\u266d', 'b');
    const pitchClass = notePitchClass(match[1].toUpperCase() + accidental);
    return pitchClass === null ? null : KEY_ROOTS[pitchClass];
}

/** Looks chords up by root and suffix, forgiving spelling but never guessing between two. */
function chordFinder(library) {
    const bySuffix = new Map(); // "C|maj7" -> entry
    const folded = new Map(); // "C|maj7" lower-cased suffix -> entry, or null when two share it
    for (const entry of library?.chords ?? []) {
        bySuffix.set(`${entry.root}|${entry.suffix}`, entry);
        const key = `${entry.root}|${entry.suffix.toLowerCase()}`;
        folded.set(key, folded.has(key) ? null : entry);
    }
    return (rootText, suffixText) => {
        const root = keyRoot(rootText);
        if (!root) return null;
        const written = String(suffixText ?? '').trim();
        let suffix = SUFFIX_SYNONYMS[written] ?? written;
        // A capital M followed by a number is major: M9 is maj9. Never folded to lower case.
        if (/^M\d/.test(suffix)) suffix = `maj${suffix.slice(1)}`;
        const entry = bySuffix.get(`${root}|${suffix}`) ??
            (suffix.includes('M') ? null : folded.get(`${root}|${suffix.toLowerCase()}`)) ?? null;
        return entry ? { root: entry.root, suffix: entry.suffix } : null;
    };
}

/** "Am7" or "Bb/D" as a root and the rest. */
function splitChordName(name) {
    const match = /^\s*([A-Ga-g][#b\u266f\u266d]?)(.*?)\s*$/.exec(String(name ?? ''));
    return match ? { root: match[1], rest: match[2] } : null;
}

/** A whole number from a number or from text such as "4". */
function wholeNumber(value) {
    const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value;
    return Number.isInteger(number) ? number : null;
}

const MODE_NAMES = {
    major: 'major', maj: 'major', ionian: 'major', M: 'major',
    minor: 'minor', min: 'minor', m: 'minor', aeolian: 'minor'
};

/**
 * Reads progression text for the editor.
 *
 * Returns `{ progression, fixes }`, where progression is `{ key, mode, beatsPerBar, beatUnit,
 * chords, origin }` and a chord is null for a measure left empty, or `{ error, line, column,
 * offset }` when the text cannot be read; line, column and offset are null when the problem is not
 * at one place. `fixes` lists every change made, as sentences.
 */
export function readProgressionText(text, { model, library }) {
    let parsed;
    try {
        parsed = parseLenientJson(String(text ?? ''));
    } catch (problem) {
        if (!(problem instanceof TextProblem)) throw problem;
        return { error: problem.message, offset: problem.offset, ...lineAndColumn(String(text ?? ''), problem.offset) };
    }
    const data = parsed.value;
    const fixes = [...parsed.fixes];

    if (typeof data.format === 'number' && data.format > SAVED_PROGRESSION_FORMAT) {
        fixes.push('It was made by a newer version of unstrung, and was read as far as this version can.');
    }

    // The chords first: without a list of them there is nothing to mend.
    let chordsIn = data.chords;
    if (typeof chordsIn === 'string') {
        chordsIn = chordsIn.split(/[\s,|]+/).filter(Boolean);
        fixes.push('The chords were written as one piece of text, and were read as a list.');
    }
    if (!Array.isArray(chordsIn)) {
        return {
            error: 'there is no list of chords. A progression needs "chords": followed by the chords in square brackets [ ].',
            offset: null, line: null, column: null
        };
    }

    // Key and mode. "Am" or "A minor" as the key also gives the mode.
    let mode = null;
    const modeText = typeof data.mode === 'string' ? data.mode.trim() : '';
    if (modeText) {
        mode = MODE_NAMES[modeText] ?? MODE_NAMES[modeText.toLowerCase()] ?? null;
        if (!mode) fixes.push(`The mode "${modeText}" is not one unstrung knows.`);
        else if (mode !== modeText) fixes.push(`The mode "${modeText}" was read as ${mode}.`);
    }
    let key = null;
    const keyText = typeof data.key === 'string' ? data.key.trim() : '';
    const keyMatch = /^([A-Ga-g][#b\u266f\u266d]?)\s*(.*)$/.exec(keyText);
    if (keyMatch) {
        key = keyRoot(keyMatch[1]);
        const modeInKey = keyMatch[2] ? MODE_NAMES[keyMatch[2]] ?? MODE_NAMES[keyMatch[2].toLowerCase()] : null;
        if (keyMatch[2] && !modeInKey) key = null;
        if (key && modeInKey) {
            if (!mode) mode = modeInKey;
            fixes.push(`The key "${keyText}" was read as ${key} ${mode}.`);
        } else if (key && key !== keyText) {
            fixes.push(`The key "${keyText}" was read as ${key}.`);
        }
    }
    if (!key) {
        key = 'C';
        fixes.push(keyText ? `The key "${keyText}" is not one unstrung knows, so C is used.` : 'No key was given, so C is used.');
    }
    if (!model.modes[mode]) {
        if (!modeText) fixes.push('No mode was given, so major is used.');
        mode = 'major';
    }

    // Time signature: { beatsPerBar, beatUnit }, or "3/4", or the two numbers on their own.
    let beatsPerBar = null;
    let beatUnit = null;
    const signature = data.timeSignature ?? data.time;
    if (typeof signature === 'string' && /^\s*\d+\s*\/\s*\d+\s*$/.test(signature)) {
        [beatsPerBar, beatUnit] = signature.split('/').map(part => Number(part));
    } else {
        beatsPerBar = wholeNumber(signature?.beatsPerBar ?? data.beatsPerBar);
        beatUnit = wholeNumber(signature?.beatUnit ?? data.beatUnit);
    }
    for (const [name, value, set] of [
        ['beats per measure', beatsPerBar, v => { beatsPerBar = v; }],
        ['note value that gets one beat', beatUnit, v => { beatUnit = v; }]
    ]) {
        if (value === null) {
            set(4);
            fixes.push(`No ${name} was given, so 4 is used.`);
        } else if (value < 1 || value > MAX_BEATS) {
            const clamped = Math.max(1, Math.min(MAX_BEATS, value));
            set(clamped);
            fixes.push(`The ${name}, ${value}, is outside 1 to ${MAX_BEATS}, so ${clamped} is used.`);
        }
    }

    // The chords themselves. Each is { root, suffix }, or a name such as "Am7".
    const find = chordFinder(library);
    let entries = chordsIn;
    if (entries.length > MAX_MEASURES) {
        fixes.push(`There were ${entries.length} measures; only the first ${MAX_MEASURES} were kept.`);
        entries = entries.slice(0, MAX_MEASURES);
    }
    const chords = entries.map((entry, index) => {
        const measure = `Measure ${index + 1}`;
        let written;
        let chord = null;
        if (typeof entry === 'string') {
            written = entry.trim();
            const parts = splitChordName(written);
            chord = parts ? find(parts.root, parts.rest) : null;
        } else if (entry && typeof entry === 'object' && !Array.isArray(entry)) {
            const name = entry.name ?? entry.chord;
            if (typeof entry.root === 'string') {
                written = `${entry.root}${entry.suffix === undefined ? '' : ` ${entry.suffix}`}`;
                chord = find(entry.root, entry.suffix ?? '');
                if (chord && entry.suffix === undefined) fixes.push(`${measure}: the chord had no suffix, so it was read as ${chordDisplayName(chord)}.`);
            } else if (typeof name === 'string') {
                written = name.trim();
                const parts = splitChordName(written);
                chord = parts ? find(parts.root, parts.rest) : null;
            }
        }
        if (!written) {
            fixes.push(`${measure} had no chord, so it is left empty for you to fill.`);
            return null;
        }
        if (!chord) {
            fixes.push(`${measure}: the chord "${written}" is not in the chord library, so it is left empty for you to fill.`);
            return null;
        }
        const spelled = typeof entry === 'string' || entry.root === undefined ? written : null;
        if (spelled !== null && spelled !== chordDisplayName(chord)) {
            fixes.push(`${measure}: "${spelled}" was read as ${chordDisplayName(chord)}.`);
        } else if (spelled === null && (entry.root !== chord.root || entry.suffix !== chord.suffix) && entry.suffix !== undefined) {
            fixes.push(`${measure}: "${`${entry.root} ${entry.suffix}`.trim()}" was read as ${chordDisplayName(chord)}.`);
        }
        return chord;
    });
    if (chords.length === 0) {
        fixes.push('There were no chords, so there is one empty measure to start from.');
        chords.push(null);
    }

    const made = ORIGINS.includes(data.origin?.made) ? data.origin.made : 'hand';
    const origin = { made };
    if (made !== 'hand') {
        if (model.levels.some(level => level.id === data.origin.levelId)) origin.levelId = data.origin.levelId;
        if ((model.borrowing?.tiers ?? []).some(tier => tier.id === data.origin.borrowingId)) {
            origin.borrowingId = data.origin.borrowingId;
        }
    }

    return { progression: { key, mode, beatsPerBar, beatUnit, chords, origin }, fixes };
}
