// Generates src/assets/chords/chord-library.json from scripts/chord-library/voicings.json.
//
// voicings.json is unstrung's own record of chord shapes. Since 2026-11-02 it holds the guitar
// voicings of tabsy-gr/chords-db (https://github.com/tabsy-gr/chords-db, MIT), a fork of
// chords-db that corrects it, less the ones held for review; see scripts/chord-library/README.md.
// Neither is a dependency. chords-db had real, confirmed errors, including off-by-one
// transposition bugs, so every voicing, whoever added it, is still re-derived from its frets and
// checked against its chord's interval formula before it ships. Anything that fails is dropped
// and reported, never silently included. A finger other than 0 to 4, such as the fork's "T" for
// the thumb, stops the build: unstrung ships no thumb fingerings.
//
// Run with: node scripts/build-chord-library.mjs

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
    CHORD_FORMULAS, FINGER_NAMES, IDENTIFY_SUFFIXES, PITCH_CLASSES, PITCH_CLASS_NAMES,
    QUALITY_LABELS, STANDARD_TUNING_MIDI, STANDARD_TUNING_NAMES, STRING_NUMBERS,
    fretToMidi, fretSpan, parseSuffix, spellChordNotes, verifyVoicing, voicingSoundedNotes
} from '../src/shared/musicTheory.mjs';

const SOURCE_PATH = path.join(import.meta.dirname, 'chord-library', 'voicings.json');
const source = JSON.parse(fs.readFileSync(SOURCE_PATH, 'utf8'));

// The origins' licenses ask for their notices to go with every copy, so a source without them,
// such as one re-seeded from a new version, stops the build rather than shipping without them.
const unnoticed = Object.entries(source.origin ?? {}).filter(([, origin]) => !origin.copyright?.length);
if (unnoticed.length > 0 || !source.license?.text) {
    throw new Error(`voicings.json must carry each origin's copyright and the license text; missing: ${
        [...unnoticed.map(([name]) => `${name} copyright`), ...(source.license?.text ? [] : ['license text'])].join(', ')}`);
}

const OUT_PATH = path.join(import.meta.dirname, '..', 'src', 'assets', 'chords', 'chord-library.json');

// --- Canonical shapes ---------------------------------------------------------------
// The open-position shapes essentially every guitar teacher starts with. Written as
// absolute frets, index 0 = string 6 (low E), -1 = muted, 0 = open. Each was verified
// note-by-note against its interval formula before being listed here.
const CANONICAL_OPEN_SHAPES = {
    'E major': [0, 2, 2, 1, 0, 0], 'A major': [-1, 0, 2, 2, 2, 0], 'D major': [-1, -1, 0, 2, 3, 2],
    'G major': [3, 2, 0, 0, 0, 3], 'C major': [-1, 3, 2, 0, 1, 0],
    'E minor': [0, 2, 2, 0, 0, 0], 'A minor': [-1, 0, 2, 2, 1, 0], 'D minor': [-1, -1, 0, 2, 3, 1],
    'E7': [0, 2, 0, 1, 0, 0], 'A7': [-1, 0, 2, 0, 2, 0], 'D7': [-1, -1, 0, 2, 1, 2],
    'G7': [3, 2, 0, 0, 0, 1], 'C7': [-1, 3, 2, 3, 1, 0], 'B7': [-1, 2, 1, 2, 0, 2],
    'E m7': [0, 2, 0, 0, 0, 0], 'A m7': [-1, 0, 2, 0, 1, 0], 'D m7': [-1, -1, 0, 2, 1, 1],
    'C maj7': [-1, 3, 2, 0, 0, 0], 'A maj7': [-1, 0, 2, 1, 2, 0], 'D maj7': [-1, -1, 0, 2, 2, 2],
    'E maj7': [0, 2, 1, 1, 0, 0], 'F maj7': [-1, -1, 3, 2, 1, 0], 'G maj7': [3, 2, 0, 0, 0, 2],
    'D sus4': [-1, -1, 0, 2, 3, 3], 'D sus2': [-1, -1, 0, 2, 3, 0],
    'A sus4': [-1, 0, 2, 2, 3, 0], 'A sus2': [-1, 0, 2, 2, 0, 0], 'E sus4': [0, 2, 2, 2, 0, 0],
    // Common taught variants that let a low string ring rather than muting it.
    'C maj7, G in the bass': [3, 3, 2, 0, 0, 0], 'G major, four-finger': [3, 2, 0, 0, 3, 3]
};

// The CAGED movable barre forms, as fret offsets above the barre. `rootString` is the
// string carrying the root, which is what lets us confirm a shape really is the chord it
// claims to be once transposed. An offset of -1 means the string must be muted; 'optional'
// means it may be muted or played at the barre fret, since A-shape barres are taught both
// ways (thumb-muted low string, or letting it ring as a fifth below the root).
const CANONICAL_MOVABLE_SHAPES = [
    { name: 'E shape major', rootString: 6, offsets: [0, 2, 2, 1, 0, 0] },
    { name: 'E shape minor', rootString: 6, offsets: [0, 2, 2, 0, 0, 0] },
    { name: 'E shape dominant 7th', rootString: 6, offsets: [0, 2, 0, 1, 0, 0] },
    { name: 'E shape minor 7th', rootString: 6, offsets: [0, 2, 0, 0, 0, 0] },
    { name: 'E shape major 7th', rootString: 6, offsets: [0, 2, 1, 1, 0, 0] },
    { name: 'A shape major', rootString: 5, offsets: ['optional', 0, 2, 2, 2, 0] },
    { name: 'A shape minor', rootString: 5, offsets: ['optional', 0, 2, 2, 1, 0] },
    { name: 'A shape dominant 7th', rootString: 5, offsets: ['optional', 0, 2, 0, 2, 0] },
    { name: 'A shape minor 7th', rootString: 5, offsets: ['optional', 0, 2, 0, 1, 0] },
    { name: 'A shape major 7th', rootString: 5, offsets: ['optional', 0, 2, 1, 2, 0] }
];

// --- Power chords ---------------------------------------------------------------------
// chords-db carries no power chords at all, yet they are among the first shapes a rock
// player learns and the score parser names them readily (any bare root-and-fifth beat).
// They are generated here rather than sourced, because unlike a jazz voicing there is
// nothing to look up: the shape is fully determined by the intervals. Frets are solved
// from MIDI rather than written down as offsets, so the awkward string 3 to string 2
// tuning gap is handled by arithmetic instead of by a table that could be typed wrong.
const POWER_CHORD_FORMS = [
    { label: 'root and fifth', intervals: [0, 7], fingers: [1, 3] },
    { label: 'root, fifth and octave', intervals: [0, 7, 12], fingers: [1, 3, 4] }
];
const POWER_CHORD_ROOT_STRINGS = [6, 5, 4];
const MAX_GENERATED_FRET = 15;

/**
 * One power chord voicing, or null if any note would fall off the fretboard. The strings
 * ascend from the root string, so a three-note form on string 4 reaches string 2 and its
 * octave lands a fret higher than it would anywhere else — solving from MIDI absorbs that.
 */
function powerChordVoicing(rootName, rootString, rootFret, form) {
    const rootMidi = fretToMidi(rootString, rootFret);
    const used = new Map();

    for (const [i, interval] of form.intervals.entries()) {
        const stringNumber = rootString - i;
        if (!STRING_NUMBERS.includes(stringNumber)) return null;
        const fret = rootMidi + interval - STANDARD_TUNING_MIDI[stringNumber];
        if (fret < 0 || fret > MAX_GENERATED_FRET) return null;
        used.set(stringNumber, { fret, finger: form.fingers[i] });
    }

    const strings = STRING_NUMBERS.map(stringNumber => {
        const entry = used.get(stringNumber);
        if (!entry) return { string: stringNumber, play: 'muted' };
        if (entry.fret === 0) return { string: stringNumber, play: 'open', fret: 0 };
        return { string: stringNumber, play: 'fretted', fret: entry.fret, finger: entry.finger };
    });

    const absolute = strings.map(s => (s.play === 'muted' ? -1 : s.fret));
    return { strings, barres: [], absolute };
}

/** Every power chord voicing for one root: the open form where one exists, then up the neck. */
function powerChordVoicingsFor(rootName) {
    const rootPc = PITCH_CLASSES[rootName];
    const built = [];

    for (const rootString of POWER_CHORD_ROOT_STRINGS) {
        // Lowest fret on this string that gives the root, so each string contributes its
        // most accessible position rather than every octave of the same shape.
        let rootFret = null;
        for (let fret = 0; fret <= 12; fret++) {
            if (fretToMidi(rootString, fret) % 12 === rootPc) { rootFret = fret; break; }
        }
        if (rootFret === null) continue;

        for (const form of POWER_CHORD_FORMS) {
            const voicing = powerChordVoicing(rootName, rootString, rootFret, form);
            if (!voicing) continue;

            const theory = verifyVoicing(voicing, rootName, '5');
            if (theory.status !== 'pass') {
                throw new Error(`generated ${rootName}5 failed verification: ` +
                    `frets=[${voicing.absolute.join(',')}] notes=${theory.notes.join(' ')}`);
            }

            const where = rootFret === 0
                ? `open position, root on string ${rootString}`
                : `movable, root on string ${rootString} at fret ${rootFret}`;
            built.push({ voicing, theory, shape: `${where} (${form.label})` });
        }
    }
    return built;
}

// --- Genres -------------------------------------------------------------------------
// Our own curation: no source we found tags chords by genre. Deliberately generous,
// since the point is to help a learner find relevant material, not to be prescriptive.
const GENRES_BY_SUFFIX = {
    major: ['rock', 'pop', 'folk', 'country', 'bluegrass', 'blues'],
    minor: ['rock', 'pop', 'folk', 'country', 'blues'],
    5: ['rock', 'punk', 'metal'],
    sus2: ['rock', 'pop', 'folk'], sus4: ['rock', 'pop', 'folk'], sus: ['rock', 'pop', 'folk'],
    add9: ['rock', 'pop'], madd9: ['rock', 'pop'],
    7: ['blues', 'rock', 'country', 'bluegrass', 'jazz'],
    '7sus4': ['blues', 'rock', 'funk'],
    9: ['blues', 'funk', 'jazz'], '7b9': ['jazz'], '7#9': ['blues', 'funk', 'jazz'],
    '7b5': ['jazz'], aug7: ['jazz'], aug9: ['jazz'], '9b5': ['jazz'], '9#11': ['jazz'],
    11: ['jazz', 'funk'], 13: ['jazz', 'funk'],
    maj7: ['jazz', 'pop', 'bossa nova'], maj9: ['jazz', 'pop', 'bossa nova'],
    maj11: ['jazz'], maj13: ['jazz'], 'maj7b5': ['jazz'], 'maj7#5': ['jazz'], maj7sus2: ['jazz'],
    m7: ['jazz', 'rock', 'pop', 'funk', 'blues'], m9: ['jazz', 'funk', 'pop'],
    m11: ['jazz', 'funk'], 'm7b5': ['jazz'],
    6: ['jazz', 'swing', 'country'], m6: ['jazz', 'swing'], 69: ['jazz', 'swing'], m69: ['jazz'],
    dim: ['jazz', 'classical'], dim7: ['jazz', 'classical'], aug: ['jazz', 'classical'],
    mmaj7: ['jazz'], mmaj9: ['jazz'], 'mmaj7b5': ['jazz'], mmaj11: ['jazz'],
    add11: ['rock', 'pop'], sus2sus4: ['rock', 'folk'],
    '(b5)': ['jazz'], '7#11': ['jazz'], '7sus2': ['jazz', 'funk']
};

function genresFor(suffix) {
    const { base } = parseSuffix(suffix);
    const genres = GENRES_BY_SUFFIX[base] ?? ['other'];
    // Slash chords are inversions, most idiomatic where bass movement matters.
    return parseSuffix(suffix).bass ? [...new Set([...genres, 'folk', 'singer-songwriter'])] : genres;
}

// --- Display naming -----------------------------------------------------------------
function displayName(key, suffix) {
    if (suffix === 'major') return key;
    if (suffix === 'minor') return `${key}m`;
    if (suffix.startsWith('/')) return `${key}${suffix}`;
    return `${key}${suffix}`;
}

function qualityLabel(suffix) {
    const { base, bass } = parseSuffix(suffix);
    const label = QUALITY_LABELS[base] ?? base;
    return bass ? `${label}, with ${bass} in the bass` : label;
}

// --- Convert a source voicing into the library's voicing shape ----------------------
// The source gives frets string 6 first, -1 for not played and 0 for open, fingers in the
// same order with 0 for none, and the frets held by a barre.
const ALLOWED_FINGERS = new Set([0, 1, 2, 3, 4]);

function buildVoicing(source) {
    const unknownFinger = source.fingers.find(f => !ALLOWED_FINGERS.has(f));
    if (unknownFinger !== undefined) {
        throw new Error(`voicings.json: frets [${source.frets.join(',')}] have finger ${JSON.stringify(unknownFinger)}; ` +
            'fingers are 0 for none and 1 to 4, index to little. Thumb fingerings belong in voicings-to-review.json.');
    }
    if (source.frets.some((fret, index) => fret > 0 && !source.fingers[index])) {
        throw new Error(`voicings.json: frets [${source.frets.join(',')}] fingers [${source.fingers.join(',')}] ` +
            'leave a fretted string with no finger.');
    }
    const absolute = source.frets;
    const barreFrets = source.barres ?? [];

    const strings = STRING_NUMBERS.map((stringNumber, index) => {
        const fret = absolute[index];
        if (fret < 0) return { string: stringNumber, play: 'muted' };

        const entry = { string: stringNumber, play: fret === 0 ? 'open' : 'fretted', fret };
        const finger = source.fingers?.[index];
        if (finger) entry.finger = finger;
        return entry;
    });

    // A barre is the strings one finger holds at its fret. Other strings at that fret can have
    // fingers of their own: in Cm7 8x888x finger 2 frets string 6 and finger 3 barres strings 4
    // to 2, so the barre is 4 through 2, not 6 through 2. The barring finger is the one on the
    // most strings there, the lower finger where two tie; with no fingers given, every string
    // at the fret counts.
    const barres = barreFrets.map(fret => {
        const atFret = strings.filter(s => s.play === 'fretted' && s.fret === fret);
        const perFinger = new Map();
        for (const s of atFret) if (s.finger) perFinger.set(s.finger, (perFinger.get(s.finger) ?? 0) + 1);
        const barreFinger = [...perFinger].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
        const held = atFret.filter(s => barreFinger === undefined || s.finger === barreFinger);
        for (const s of held) s.barre = true;
        const covered = held.map(s => s.string);
        return { fret, fromString: Math.max(...covered), toString: Math.min(...covered) };
    });

    return { strings, barres, absolute };
}

// --- Confidence classification ------------------------------------------------------
function matchesCanonicalOpenShape(absolute, key, suffix) {
    for (const [name, shape] of Object.entries(CANONICAL_OPEN_SHAPES)) {
        if (shape.length !== absolute.length) continue;
        if (shape.every((f, i) => f === absolute[i])) return name;
    }
    return null;
}

function matchesCanonicalMovableShape(absolute, key) {
    const rootPc = PITCH_CLASSES[key];
    // Movable forms are fully fretted: an open string means it is anchored at the nut,
    // which is the open-position case handled separately.
    const fretted = absolute.filter(f => f > 0);
    if (fretted.length === 0 || absolute.some(f => f === 0)) return null;

    const barreFret = Math.min(...fretted);
    for (const shape of CANONICAL_MOVABLE_SHAPES) {
        const matches = shape.offsets.every((offset, i) => {
            if (offset === -1) return absolute[i] === -1;
            if (offset === 'optional') return absolute[i] === -1 || absolute[i] === barreFret;
            return absolute[i] === barreFret + offset;
        });
        if (!matches) continue;
        // Confirm the transposed shape really does put this chord's root on the root string.
        const rootIndex = STRING_NUMBERS.indexOf(shape.rootString);
        const rootMidi = fretToMidi(shape.rootString, absolute[rootIndex]);
        if (rootMidi % 12 === rootPc) return `${shape.name} barred at fret ${barreFret}`;
    }
    return null;
}

function classify(voicing, key, suffix, theory) {
    if (theory.status !== 'pass') return { confidence: 'suspect', shape: null };

    const openShape = matchesCanonicalOpenShape(voicing.absolute, key, suffix);
    if (openShape) return { confidence: 'canonical', shape: `open position (${openShape})` };

    const movableShape = matchesCanonicalMovableShape(voicing.absolute, key);
    if (movableShape) return { confidence: 'canonical', shape: movableShape };

    // Sparse or awkward voicings are real but not what a learner should meet first.
    if (!theory.hasRoot || !theory.hasThird || fretSpan(voicing) > 4) {
        return { confidence: 'advanced', shape: null };
    }
    return { confidence: 'common', shape: null };
}

// --- Structured text description ----------------------------------------------------
// The primary artifact for a screen-reader user: no diagram, just an explicit, ordered
// account of every string. Strings held only by a barre are called out as such, matching
// how a player would describe the shape out loud.
function describeVoicing(voicing) {
    const lines = [];
    for (const barre of voicing.barres) {
        lines.push(`Barre: fret ${barre.fret}, strings ${barre.fromString} through ${barre.toString}`);
    }
    for (const stringNumber of STRING_NUMBERS) {
        const entry = voicing.strings.find(s => s.string === stringNumber);
        if (entry.play === 'muted') {
            // A barre across a string that is not played, as in F6 1x3231, leaves the string
            // damped rather than fretted: the barring finger touches it without pressing it down.
            const under = voicing.barres.some(b => b.fromString >= stringNumber && stringNumber >= b.toString);
            lines.push(`String ${stringNumber}: not played${under ? ', damped under the barre' : ''}`);
            continue;
        }
        if (entry.play === 'open') {
            lines.push(`String ${stringNumber}: open`);
            continue;
        }
        // Fingering is a suggestion, not a rule: it comes from the source dataset and a
        // player may well choose differently.
        const parts = [`fret ${entry.fret}`];
        if (entry.barre) parts.push('held by the barre');
        else if (FINGER_NAMES[entry.finger]) parts.push(FINGER_NAMES[entry.finger]);
        lines.push(`String ${stringNumber}: ${parts.join(', ')}`);
    }
    return lines;
}

// --- Build --------------------------------------------------------------------------
const chords = [];
const dropped = [];
const skippedSuffixes = new Map();
const counts = { canonical: 0, common: 0, advanced: 0, suspect: 0 };

for (const entry of source.chords) {
    const { root: key, suffix } = entry;
    const voicings = [];

    for (const sourceVoicing of entry.voicings) {
        const voicing = buildVoicing(sourceVoicing);
        const theory = verifyVoicing(voicing, key, suffix);

        if (theory.status === 'unknown') {
            skippedSuffixes.set(suffix, (skippedSuffixes.get(suffix) ?? 0) + 1);
            continue;
        }

        const { confidence, shape } = classify(voicing, key, suffix, theory);
        counts[confidence]++;

        if (confidence === 'suspect') {
            dropped.push(`${displayName(key, suffix)} frets=[${voicing.absolute.join(',')}] ` +
                `notes=${theory.notes.join(' ')} expected=${theory.expected.join(' ')} ` +
                `${theory.foreign.length ? 'foreign: ' + theory.foreign.join(',') : ''}` +
                `${!theory.hasSeventh ? ' missing 7th' : ''}`);
            continue;
        }

        const notes = voicingSoundedNotes(voicing);
        voicings.push({
            confidence,
            shape,
            strings: voicing.strings,
            barres: voicing.barres,
            fretSpan: fretSpan(voicing),
            lowestFret: Math.min(...voicing.absolute.filter(f => f > 0), Infinity) === Infinity
                ? 0 : Math.min(...voicing.absolute.filter(f => f > 0)),
            notes: theory.notes,
            midi: notes.map(n => n.midi),
            description: describeVoicing(voicing),
            theory: { status: theory.status, notes: theory.notes, expected: theory.expected }
        });
    }

    if (voicings.length === 0) continue;

    // Most approachable voicing first: canonical shapes, then lower on the neck.
    const rank = { canonical: 0, common: 1, advanced: 2 };
    voicings.sort((a, b) => rank[a.confidence] - rank[b.confidence] || a.lowestFret - b.lowestFret);

    chords.push({
        name: displayName(key, suffix),
        root: key,
        suffix,
        quality: qualityLabel(suffix),
        genres: genresFor(suffix),
        confidence: voicings[0].confidence,
        voicings
    });
}

// --- Power chords -------------------------------------------------------------------
// Marked canonical outright. That is the same claim CANONICAL_OPEN_SHAPES makes: these
// are not a dataset's opinion to be second-guessed, they are the shape everyone is taught.
for (const rootName of PITCH_CLASS_NAMES) {
    const voicings = powerChordVoicingsFor(rootName).map(({ voicing, theory, shape }) => {
        counts.canonical++;
        const frets = voicing.absolute.filter(f => f > 0);
        return {
            confidence: 'canonical',
            shape,
            strings: voicing.strings,
            barres: [],
            fretSpan: fretSpan(voicing),
            lowestFret: frets.length ? Math.min(...frets) : 0,
            notes: theory.notes,
            midi: voicingSoundedNotes(voicing).map(n => n.midi),
            description: describeVoicing(voicing),
            theory: { status: theory.status, notes: theory.notes, expected: theory.expected }
        };
    });

    // The source may list power chords too, as tabsy-gr/chords-db does. Shapes the generator
    // already makes are dropped from it, and any others are kept beside the generated ones.
    const listed = chords.findIndex(c => c.root === rootName && c.suffix === '5');
    if (listed !== -1) {
        const fretsOf = v => v.strings.map(s => (s.play === 'muted' ? -1 : s.fret)).join(',');
        const generated = new Set(voicings.map(fretsOf));
        voicings.push(...chords[listed].voicings.filter(v => !generated.has(fretsOf(v))));
        chords.splice(listed, 1);
    }

    const powerRank = { canonical: 0, common: 1, advanced: 2 };
    voicings.sort((a, b) => powerRank[a.confidence] - powerRank[b.confidence] || a.lowestFret - b.lowestFret);
    chords.push({
        name: `${rootName}5`,
        root: rootName,
        suffix: '5',
        quality: qualityLabel('5'),
        genres: genresFor('5'),
        confidence: 'canonical',
        voicings
    });
}
const powerChordCount = PITCH_CLASS_NAMES.length;

// --- Coverage backfill ----------------------------------------------------------------
// A chord the score parser can put in front of the user must be findable here, or the
// Chord Library contradicts the measure listing. identifyChordFromNotes works from
// intervals alone, so it can name chords no fingering dataset carries. Those are listed
// with their notes and an explicit statement that the fingering is not known, which is
// honest and searchable; inventing a shape to fill the hole would not be.
const present = new Set(chords.map(c => `${c.root}|${c.suffix}`));
const unfingered = [];

for (const rootName of PITCH_CLASS_NAMES) {
    for (const suffix of IDENTIFY_SUFFIXES) {
        if (present.has(`${rootName}|${suffix}`)) continue;

        // Spelled as the chord requires: C# minor is C#, E, G#, not C#, E, Ab. These names are the
        // only thing a player has to go on for a chord with no fingering.
        const notes = spellChordNotes(rootName, suffix);

        chords.push({
            name: displayName(rootName, suffix),
            root: rootName,
            suffix,
            quality: qualityLabel(suffix),
            genres: genresFor(suffix),
            confidence: 'unfingered',
            notes,
            // An empty voicings array is what marks the chord as unfingered; the wording shown for
            // it belongs to the renderer, not to the data.
            voicings: []
        });
        unfingered.push(displayName(rootName, suffix));
    }
}

chords.sort((a, b) => (PITCH_CLASSES[a.root] - PITCH_CLASSES[b.root]) || a.suffix.localeCompare(b.suffix));

// The invariant the backfill exists to hold. If the identifier ever gains a suffix this
// loop cannot cover, the build fails here rather than shipping a library that disagrees
// with what the measure listing will say.
const covered = new Set(chords.map(c => `${c.root}|${c.suffix}`));
const gaps = [];
for (const rootName of PITCH_CLASS_NAMES) {
    for (const suffix of IDENTIFY_SUFFIXES) {
        if (!covered.has(`${rootName}|${suffix}`)) gaps.push(`${rootName} ${suffix}`);
    }
}
if (gaps.length) {
    throw new Error(`chords the parser can name are missing from the library: ${gaps.join(', ')}`);
}

const library = {
    version: 1,
    // Deliberately no build date: this file is committed, and a timestamp would make it differ
    // from its own regenerated output every day, defeating any check that it is up to date.
    source: {
        name: 'unstrung',
        file: 'scripts/chord-library/voicings.json',
        origins: source.origin,
        // The origins' copyright notices and their license travel with the library, as the
        // license asks of a copy, since the library can be downloaded on its own from the site.
        license: source.license,
        note: 'Every voicing re-verified against its interval formula; failures excluded. ' +
            'Power chords and coverage entries are generated here, not kept in the source file.'
    },
    tuning: {
        name: 'standard',
        strings: STRING_NUMBERS.map(n => ({ string: n, note: STANDARD_TUNING_NAMES[n] }))
    },
    confidenceLevels: {
        canonical: 'Matches a standard open-position or CAGED barre shape. What a teacher shows first.',
        common: 'Theory-verified, comfortable to play, but not one of the standard taught shapes.',
        advanced: 'Theory-verified but sparse or a wide stretch: omits the root or third, or spans over four frets.',
        unfingered: 'Listed so it can be looked up, but no fingering is known for it yet.'
    },
    chords
};

fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
fs.writeFileSync(OUT_PATH, JSON.stringify(library), 'utf8');

// --- Report -------------------------------------------------------------------------
console.log('=== chord library build ===');
console.log(`source: ${library.source.file} (from ${Object.keys(library.source.origins).join(', ')})`);
console.log(`\nvoicings by confidence:`);
for (const [level, count] of Object.entries(counts)) console.log(`  ${level.padEnd(10)} ${count}`);
console.log(`\nchords written:   ${chords.length}`);
console.log(`voicings written: ${chords.reduce((n, c) => n + c.voicings.length, 0)}`);
console.log(`output:           ${path.relative(process.cwd(), OUT_PATH)} ` +
    `(${(fs.statSync(OUT_PATH).size / 1024).toFixed(0)} KB)`);

if (skippedSuffixes.size) {
    console.log(`\nskipped, no interval formula:`);
    for (const [suffix, n] of skippedSuffixes) console.log(`  ${suffix} (${n} voicings)`);
}

console.log(`\ndropped as theory failures (${dropped.length}):`);
for (const line of dropped) console.log(`  ${line}`);

const canonicalChords = chords.filter(c => c.confidence === 'canonical').length;
console.log(`\nchords with at least one canonical voicing: ${canonicalChords}`);

console.log(`\ngenerated power chords: ${powerChordCount} ` +
    `(${chords.filter(c => c.suffix === '5').reduce((n, c) => n + c.voicings.length, 0)} voicings)`);
console.log(`listed without a fingering (${unfingered.length}): ${unfingered.join(', ') || 'none'}`);
console.log(`\nevery chord the parser can name is present: ${PITCH_CLASS_NAMES.length}` +
    ` roots x ${IDENTIFY_SUFFIXES.length} suffixes = ${PITCH_CLASS_NAMES.length * IDENTIFY_SUFFIXES.length} covered`);
