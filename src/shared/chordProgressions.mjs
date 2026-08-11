// Generating chord progressions to practise, without a model and without a network.
//
// Kept dependency-free so the same code runs in Node for testing and in the renderer for real,
// like musicTheory.mjs. Everything musical lives in progression-model.json and is passed in; this
// file is the machinery that reads it.
//
// THREE IDEAS DO THE WORK, and they are worth understanding before adjusting anything:
//
// 1. Chords are chosen as scale degrees -- I, ii, IV, V -- and only turned into names at the end.
//    One set of weights therefore serves all twelve keys, and transposing is arithmetic rather
//    than a second table.
//
// 2. A weighted transition table says what tends to follow what. On its own this wanders: it has
//    no sense of beginning or ending, and produces chords that are individually plausible and
//    collectively shapeless.
//
// 3. So the shape comes from elsewhere. A skeleton fixes some positions and leaves others open,
//    and a cadence is drawn separately and written over the ending. That is most of the difference
//    between "random but legal" and "sounds like it meant to stop there".
//
// Playability is applied throughout rather than afterwards. A progression full of chords the
// player cannot fret is not practice, so a degree whose chord has no acceptable fingering in this
// key simply has its weight removed before anything is drawn.

/**
 * Deterministic random numbers, so a progression can be written down and played again.
 *
 * mulberry32: small, fast, and good enough for choosing between a handful of weighted options.
 * Nothing here needs cryptographic quality, but it does need to be reproducible from a seed.
 */
export function makeRandom(seed) {
    let state = seed >>> 0;
    return function next() {
        state = (state + 0x6D2B79F5) >>> 0;
        let t = state;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

/** Picks one key of a `{ option: weight }` object. Returns null when nothing has any weight. */
export function weightedPick(weights, random) {
    const entries = Object.entries(weights).filter(([, weight]) => weight > 0);
    const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
    if (total <= 0) return null;

    let roll = random() * total;
    for (const [option, weight] of entries) {
        roll -= weight;
        if (roll < 0) return option;
    }
    return entries[entries.length - 1][0];
}

// Pitch classes spelled to match the chord library's roots, which uses flats except for C# and F#.
const ROOT_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];

export const KEY_ROOTS = ROOT_NAMES;

/** Root name a given number of semitones above a key. */
export function transpose(keyRoot, semitones) {
    const index = ROOT_NAMES.indexOf(keyRoot);
    if (index < 0) return keyRoot;
    return ROOT_NAMES[(index + semitones + 120) % 12];
}

/**
 * Whether one voicing satisfies a playability rule.
 *
 * The rule names come from progression-model.json: "open" is what a beginner can reach, "fingered"
 * is anything with a known shape that does not stretch too far, and "any" accepts chords the
 * library has no fingering for at all -- deliberately, because naming a chord's notes is enough
 * for a player to work out a shape, and refusing to ever show one would cap what can be practised.
 */
function voicingSatisfies(voicing, rule) {
    if (rule.confidences && !rule.confidences.includes(voicing.confidence)) return false;
    if (!rule.allowBarres && (voicing.barres ?? []).length > 0) return false;
    if (rule.maxLowestFret !== undefined && voicing.lowestFret > rule.maxLowestFret) return false;
    if (rule.maxFretSpan !== undefined && voicing.fretSpan > rule.maxFretSpan) return false;
    return true;
}

/**
 * Builds a lookup of which chords are acceptable at a given level.
 *
 * Returns a function of (root, suffix). Passing no library at all makes everything acceptable,
 * which is what the "any" rule means and also lets the generator be tested without the library.
 */
export function buildPlayability(library, rule, alsoAllow = []) {
    if (!rule || rule.requireVoicing === false) return () => true;

    const acceptable = new Set();
    for (const chord of library?.chords ?? []) {
        if ((chord.voicings ?? []).some(voicing => voicingSatisfies(voicing, rule))) {
            acceptable.add(`${chord.root}|${chord.suffix}`);
        }
    }
    // Chords a level admits despite failing its rule, because a simplified shape everyone learns
    // early makes the full fingering beside the point. F major is the case this exists for: the
    // library only knows the barre, but the three and four string cheats are how it is first
    // played, and excluding it costs C major its IV chord.
    for (const chord of alsoAllow) acceptable.add(`${chord.root}|${chord.suffix}`);

    return (root, suffix) => acceptable.has(`${root}|${suffix}`);
}

// Below this many playable degrees a key is not worth generating in. Two chords produce a run that
// alternates, and one produces the same chord repeated, which passes every structural check while
// being useless to practise -- so this is a real limit rather than a tidy-up. Open position on
// guitar simply does not cover every key, and saying so is better than pretending.
const MINIMUM_USABLE_DEGREES = 3;

/**
 * Which keys are worth offering at a level, so a chooser can say so before anything is generated.
 *
 * Beginner level in C# is the case this exists for: open shapes cover the guitar-friendly keys and
 * little else, and offering all twelve equally would send a learner to a key where nothing works.
 */
export function usableKeys(model, mode, levelId, library) {
    const level = model.levels.find(entry => entry.id === levelId) ?? model.levels[0];
    const isPlayable = buildPlayability(library, model.playabilityRules[level.playability], level.alsoAllow);
    return KEY_ROOTS.map(key => {
        const degrees = usableDegrees(model, mode, key, level, isPlayable);
        return { key, degreeCount: degrees.length, usable: degrees.length >= MINIMUM_USABLE_DEGREES };
    });
}

/** The chord a degree names in a key, before any upgrade is applied. */
function chordForDegree(model, mode, keyRoot, degree) {
    const spec = model.modes[mode].degrees[degree];
    if (!spec) return null;
    return { degree, root: transpose(keyRoot, spec.semitones), suffix: spec.suffix };
}

/**
 * Degrees this level allows in this key that also have an acceptable fingering.
 *
 * The playability filter is applied to the *plain* form of the degree, not to whatever upgrade it
 * might later receive, so that a level never rules out a chord it could have played simply and
 * then offers it a seventh instead.
 */
function usableDegrees(model, mode, keyRoot, level, isPlayable) {
    return (level.degrees[mode] ?? Object.keys(model.modes[mode].degrees))
        .filter(degree => {
            const chord = chordForDegree(model, mode, keyRoot, degree);
            return chord && isPlayable(chord.root, chord.suffix);
        });
}

/** Restricts a weight row to degrees that survived, so nothing unusable can be drawn. */
function restrict(weights, allowed) {
    const out = {};
    for (const [degree, weight] of Object.entries(weights ?? {})) {
        if (allowed.includes(degree)) out[degree] = weight;
    }
    return out;
}

/**
 * Chooses the run of degrees, before any of them become chord names.
 *
 * A skeleton is drawn first and its fixed positions are honoured; the gaps are filled from the
 * transition table, following on from whatever is already to the left. The last two positions are
 * then overwritten by a drawn cadence, which is what makes a progression end rather than merely
 * stop. Skeletons and cadences are dropped when the key cannot play them, so a beginner in a
 * difficult key still gets something rather than nothing.
 */
function chooseDegrees(model, mode, level, allowed, count, random) {
    const modeModel = model.modes[mode];

    const skeletonWeights = {};
    for (const [index, skeleton] of (modeModel.skeletons ?? []).entries()) {
        const fixed = skeleton.slots.filter(slot => slot !== '?');
        if (fixed.every(degree => allowed.includes(degree))) skeletonWeights[index] = skeleton.weight;
    }
    const skeletonIndex = weightedPick(skeletonWeights, random);
    const skeleton = skeletonIndex === null ? [] : modeModel.skeletons[Number(skeletonIndex)].slots;

    const degrees = [];
    for (let position = 0; position < count; position++) {
        const fromSkeleton = skeleton[position];
        if (fromSkeleton && fromSkeleton !== '?') { degrees.push(fromSkeleton); continue; }

        const previous = degrees[degrees.length - 1];
        const weights = previous === undefined
            ? restrict(modeModel.startWeights, allowed)
            : restrict(modeModel.transitions[previous], allowed);

        // A degree with nothing playable to move to would otherwise dead-end the run; falling back
        // to an even choice over what is allowed keeps it going without inventing a transition.
        const even = Object.fromEntries(allowed.map(degree => [degree, 1]));
        degrees.push(weightedPick(Object.keys(weights).length > 0 ? weights : even, random) ?? allowed[0]);
    }

    let cadenceName = null;
    if (count >= 2) {
        const cadenceWeights = {};
        for (const [index, cadence] of (modeModel.cadences ?? []).entries()) {
            if (cadence.chords.every(degree => allowed.includes(degree))) {
                cadenceWeights[index] = cadence.weight;
            }
        }
        const cadenceIndex = weightedPick(cadenceWeights, random);
        if (cadenceIndex !== null) {
            const cadence = modeModel.cadences[Number(cadenceIndex)];
            degrees.splice(count - cadence.chords.length, cadence.chords.length, ...cadence.chords);
            cadenceName = cadence.name;
        }
    }

    return { degrees, cadence: cadenceName, skeleton: skeleton.length ? skeleton.join(' ') : null };
}

/**
 * Breaks up any chord held for more than two slots.
 *
 * Four things independently place chords -- the transition table, the skeleton, the cadence, and
 * the repeat roll -- and any two of them can agree by accident. Guarding each one separately was
 * tried and kept missing combinations, because each guard can only see its own step. Applied once
 * over the finished list, where the whole progression is visible, it cannot be evaded.
 *
 * Three bars of one chord in an eight-bar progression is not practice, it is waiting.
 */
function breakLongRuns(chords, allowedDegrees, buildChord, random) {
    for (let position = 2; position < chords.length; position++) {
        const name = chordDisplayName(chords[position]);
        if (name !== chordDisplayName(chords[position - 1])) continue;
        if (name !== chordDisplayName(chords[position - 2])) continue;

        const alternatives = allowedDegrees.filter(degree => degree !== chords[position].degree);
        if (alternatives.length === 0) continue;
        const replacement = alternatives[Math.floor(random() * alternatives.length)];
        chords[position] = { ...buildChord(replacement, position), repeatOfPrevious: false };
    }
    return chords;
}

/** Applies at most one upgrade to a degree, if this level offers one and the roll succeeds. */
function upgradeChord(chord, level, isPlayable, random) {
    for (const upgrade of level.upgrades ?? []) {
        if (!upgrade.degrees.includes(chord.degree)) continue;
        if (random() >= upgrade.probability) continue;
        if (!isPlayable(chord.root, upgrade.suffix)) continue;
        return { ...chord, suffix: upgrade.suffix, upgraded: true };
    }
    return chord;
}

/**
 * Generates a progression.
 *
 * `chordCount` counts slots, not distinct chords: a slot may repeat the one before it, which is
 * how a chord held for two bars is written, and is common enough that leaving it out makes
 * everything sound like it is changing on every bar.
 */
export function generateProgression(model, {
    key = 'C',
    mode = 'major',
    levelId = 'beginner',
    chordCount = 8,
    seed = null,
    library = null
} = {}) {
    const level = model.levels.find(entry => entry.id === levelId) ?? model.levels[0];
    const rule = model.playabilityRules[level.playability];
    const isPlayable = buildPlayability(library, rule, level.alsoAllow);

    const usedSeed = seed === null ? Math.floor(Math.random() * 2 ** 31) : seed;
    const random = makeRandom(usedSeed);

    const allowed = usableDegrees(model, mode, key, level, isPlayable);
    if (allowed.length < MINIMUM_USABLE_DEGREES) {
        const suggestions = usableKeys(model, mode, levelId, library)
            .filter(entry => entry.usable).map(entry => entry.key);
        return {
            key, mode, levelId, level: level.name, seed: usedSeed,
            chords: [], cadence: null, skeleton: null, excludedDegrees: [],
            warning: `${key} ${mode} has only ${allowed.length} chord` +
                `${allowed.length === 1 ? '' : 's'} playable at the ${level.name} level, ` +
                'which is not enough for a progression. ' +
                (suggestions.length > 0
                    ? `Keys that work at this level: ${suggestions.join(', ')}.`
                    : 'Try a level that allows more shapes.')
        };
    }

    const { degrees, cadence, skeleton } = chooseDegrees(model, mode, level, allowed, chordCount, random);

    const chords = [];
    for (const [position, degree] of degrees.entries()) {
        // A repeat holds the previous chord rather than drawing a new one, so it must copy it
        // whole: a repeat that re-rolled its upgrade would change chord without changing degree.
        //
        // Only one repeat in a row. Rolling independently at every slot lets repeats chain, and a
        // chord held for four bars in an eight-bar progression is not practice, it is waiting.
        // A held chord lasting two bars is idiomatic; three is already unusual.
        // Never repeat into a degree that already matches what follows, or the held chord and the
        // next one merge into a run of three.
        const previous = chords[chords.length - 1];
        if (previous && !previous.repeatOfPrevious && position > 0 && position < degrees.length - 2
            && degrees[position + 1] !== previous.degree
            && random() < (level.repeatProbability ?? 0)) {
            chords.push({ ...previous, position, repeatOfPrevious: true });
            continue;
        }

        let chord = chordForDegree(model, mode, key, degree);
        if (!chord) continue;
        chord = upgradeChord({ ...chord, position }, level, isPlayable, random);

        // A substitution replaces the chord *before* a named degree, so it needs to know what
        // follows; applied here, looking ahead at the degree list rather than at what was built.
        const next = degrees[position + 1];
        for (const substitution of level.substitutions ?? []) {
            if (substitution.modes && !substitution.modes.includes(mode)) continue;
            if (substitution.beforeDegree !== next) continue;
            if (random() >= substitution.probability) continue;
            const root = transpose(key, substitution.semitones);
            if (!isPlayable(root, substitution.suffix)) continue;
            chord = {
                ...chord, root, suffix: substitution.suffix,
                degree: substitution.label, substituted: substitution.name
            };
            break;
        }

        chords.push({ ...chord, repeatOfPrevious: false });
    }

    const buildChord = (degree, position) =>
        upgradeChord({ ...chordForDegree(model, mode, key, degree), position }, level, isPlayable, random);
    breakLongRuns(chords, allowed, buildChord, random);

    return {
        key, mode, levelId, level: level.name, seed: usedSeed,
        cadence, skeleton, chords,
        excludedDegrees: (level.degrees[mode] ?? []).filter(degree => !allowed.includes(degree))
    };
}

/** The written name of a generated chord: "C", "Am7", "F#m7b5". */
export function chordDisplayName(chord) {
    if (chord.suffix === 'major') return chord.root;
    if (chord.suffix === 'minor') return `${chord.root}m`;
    return `${chord.root}${chord.suffix}`;
}
