// Checks the chord progression generator against the model it is given.
//
// The weights are assumptions, so the useful thing a script can do is not assert that they are
// right -- nobody can -- but show what they actually produce, and prove the hard guarantees:
// every chord is playable at the level asked for, every progression ends on a cadence, and the
// same seed gives the same progression twice.

import { readFile } from 'node:fs/promises';
import {
    generateProgression, chordDisplayName, buildPlayability, transpose, usableKeys, KEY_ROOTS
} from '../../src/shared/chordProgressions.mjs';

const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const model = JSON.parse(await readFile(`${APP_DIR}/src/assets/progressions/progression-model.json`, 'utf8'));
const library = JSON.parse(await readFile(`${APP_DIR}/src/assets/chords/chord-library.json`, 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

console.log('=== What it actually produces ===\n');
for (const levelId of ['beginner', 'intermediate', 'advanced']) {
    console.log(`  ${model.levels.find(l => l.id === levelId).name}`);
    for (const [key, mode] of [['C', 'major'], ['G', 'major'], ['A', 'minor'], ['Eb', 'major']]) {
        const result = generateProgression(model, { key, mode, levelId, chordCount: 8, seed: 20260810, library });
        const written = result.chords.map(c => chordDisplayName(c) + (c.repeatOfPrevious ? '.' : '')).join('  ');
        console.log(`    ${(key + ' ' + mode).padEnd(10)} ${written || '(nothing playable)'}` +
            (result.cadence ? `   [${result.cadence}]` : ''));
        if (result.warning) console.log(`               ${result.warning}`);
    }
    console.log('');
}

console.log('=== Every chord is playable at the level asked for ===');
for (const levelId of ['beginner', 'intermediate']) {
    const level = model.levels.find(l => l.id === levelId);
    // alsoAllow must be passed here too, or the check disagrees with the generator about what the
    // level permits and reports its own omission as a defect.
    const isPlayable = buildPlayability(library, model.playabilityRules[level.playability], level.alsoAllow);
    let checked = 0, bad = [];
    for (const key of KEY_ROOTS) {
        for (const mode of ['major', 'minor']) {
            for (let seed = 0; seed < 40; seed++) {
                const result = generateProgression(model, { key, mode, levelId, chordCount: 8, seed, library });
                for (const chord of result.chords) {
                    checked++;
                    if (!isPlayable(chord.root, chord.suffix)) {
                        bad.push(`${chordDisplayName(chord)} in ${key} ${mode}`);
                    }
                }
            }
        }
    }
    check(`${levelId}: all ${checked} chords across 12 keys satisfy "${level.playability}"`,
        bad.length === 0, bad.slice(0, 5).join(', '));
}

console.log('\n=== Every progression ends on a cadence ===');
{
    let missing = 0, total = 0;
    const cadenceTally = {};
    for (const key of KEY_ROOTS) {
        for (const mode of ['major', 'minor']) {
            for (let seed = 0; seed < 40; seed++) {
                const result = generateProgression(model, { key, mode, levelId: 'intermediate', chordCount: 8, seed, library });
                if (result.chords.length === 0) continue;
                total++;
                if (!result.cadence) missing++;
                else cadenceTally[result.cadence] = (cadenceTally[result.cadence] ?? 0) + 1;
            }
        }
    }
    check(`all ${total} progressions ended on a drawn cadence`, missing === 0, `${missing} without`);
    console.log(`  cadences chosen: ${Object.entries(cadenceTally)
        .sort((a, b) => b[1] - a[1]).map(([n, c]) => `${n} ${c}`).join(', ')}`);
}

console.log('\n=== The same seed gives the same progression ===');
{
    const a = generateProgression(model, { key: 'D', mode: 'major', levelId: 'advanced', chordCount: 12, seed: 4242, library });
    const b = generateProgression(model, { key: 'D', mode: 'major', levelId: 'advanced', chordCount: 12, seed: 4242, library });
    const c = generateProgression(model, { key: 'D', mode: 'major', levelId: 'advanced', chordCount: 12, seed: 4243, library });
    const names = r => r.chords.map(chordDisplayName).join(' ');
    check('same seed, same chords', names(a) === names(b), names(a));
    check('a different seed gives something else', names(a) !== names(c), names(c));
    check('a seed is reported so it can be written down', typeof a.seed === 'number');
}

console.log('\n=== Degree distribution against the weights ===');
{
    const tally = {};
    let total = 0;
    for (const key of KEY_ROOTS) {
        for (let seed = 0; seed < 120; seed++) {
            const result = generateProgression(model, { key, mode: 'major', levelId: 'intermediate', chordCount: 8, seed, library });
            for (const chord of result.chords) {
                tally[chord.degree] = (tally[chord.degree] ?? 0) + 1;
                total++;
            }
        }
    }
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    for (const [degree, count] of sorted) {
        const share = (count / total) * 100;
        console.log(`      ${degree.padEnd(5)} ${share.toFixed(1).padStart(5)}%  ${'#'.repeat(Math.round(share / 2))}`);
    }
    const topThree = sorted.slice(0, 3).map(e => e[0]);
    check('the tonic is the most common chord', topThree[0] === 'I', sorted[0].join(' '));
    check('I, IV and V are all in the top four',
        ['I', 'IV', 'V'].every(d => sorted.slice(0, 4).some(e => e[0] === d)),
        sorted.slice(0, 4).map(e => e[0]).join(' '));
    check('the leading tone stays rare at this level', (tally.vii ?? 0) === 0);
}

console.log('\n=== Levels differ in the way they claim to ===');
{
    const suffixesAt = levelId => {
        const found = new Set();
        for (const key of KEY_ROOTS) {
            for (let seed = 0; seed < 60; seed++) {
                for (const chord of generateProgression(model,
                    { key, mode: 'major', levelId, chordCount: 8, seed, library }).chords) {
                    found.add(chord.suffix);
                }
            }
        }
        return found;
    };
    const beginner = suffixesAt('beginner');
    const intermediate = suffixesAt('intermediate');
    const advanced = suffixesAt('advanced');
    console.log(`  beginner suffixes    : ${[...beginner].join(', ')}`);
    console.log(`  intermediate suffixes: ${[...intermediate].join(', ')}`);
    console.log(`  advanced suffixes    : ${[...advanced].join(', ')}`);
    check('beginner sticks to plain triads',
        [...beginner].every(s => s === 'major' || s === 'minor'), [...beginner].join(','));
    check('intermediate adds sevenths', intermediate.has('7') || intermediate.has('m7'));
    check('advanced goes further still', advanced.size > intermediate.size,
        `${advanced.size} against ${intermediate.size}`);
}

console.log('\n=== Keys that open position cannot cover are refused, not fudged ===');
console.log('  (a one-chord progression passes every structural check and is useless to practise)');
for (const key of KEY_ROOTS) {
    const result = generateProgression(model, { key, mode: 'major', levelId: 'beginner', chordCount: 8, seed: 7, library });
    const written = result.chords.map(chordDisplayName).join(' ');
    console.log(`  ${key.padEnd(3)} ${written || 'refused'}` +
        (result.excludedDegrees?.length ? `   dropped: ${result.excludedDegrees.join(', ')}` : ''));
    if (result.warning) console.log(`      ${result.warning}`);

    const distinct = new Set(result.chords.map(chordDisplayName)).size;
    check(`${key} gives a real progression or refuses outright`,
        (result.chords.length > 0 && distinct >= 3) || Boolean(result.warning),
        `${distinct} distinct chord${distinct === 1 ? '' : 's'}`);
}

console.log('\n=== A chord is never held for more than two slots ===');
{
    let worstRun = 0, worstExample = '';
    for (const key of KEY_ROOTS) {
        for (const levelId of ['beginner', 'intermediate', 'advanced']) {
            for (let seed = 0; seed < 60; seed++) {
                const result = generateProgression(model, { key, mode: 'major', levelId, chordCount: 8, seed, library });
                let run = 1;
                for (let i = 1; i < result.chords.length; i++) {
                    run = chordDisplayName(result.chords[i]) === chordDisplayName(result.chords[i - 1]) ? run + 1 : 1;
                    if (run > worstRun) {
                        worstRun = run;
                        worstExample = `${key} ${levelId} seed ${seed}: ${result.chords.map(chordDisplayName).join(' ')}`;
                    }
                }
            }
        }
    }
    check('no chord repeats more than twice running', worstRun <= 2, `longest run ${worstRun} -- ${worstExample}`);
}

console.log('\n=== Which keys each level can offer ===');
for (const levelId of ['beginner', 'intermediate', 'advanced']) {
    for (const mode of ['major', 'minor']) {
        const keys = usableKeys(model, mode, levelId, library);
        const good = keys.filter(k => k.usable).map(k => k.key);
        console.log(`  ${levelId.padEnd(13)} ${mode.padEnd(6)} ${good.length}/12: ${good.join(' ')}`);
    }
}
check('beginner major covers the guitar-friendly keys',
    ['C', 'G', 'D', 'A', 'E'].every(k =>
        usableKeys(model, 'major', 'beginner', library).find(e => e.key === k)?.usable));
check('advanced can use every key',
    usableKeys(model, 'major', 'advanced', library).every(e => e.usable));

console.log('\n=== Transposition is sane ===');
check('a fifth above C is G', transpose('C', 7) === 'G');
check('a fifth above G is D', transpose('G', 7) === 'D');
check('it wraps at the octave', transpose('A', 3) === 'C');
check('every key transposes to a known root',
    KEY_ROOTS.every(k => [...Array(12).keys()].every(s => KEY_ROOTS.includes(transpose(k, s)))));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
