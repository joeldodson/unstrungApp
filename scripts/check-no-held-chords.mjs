// Checks that a progression generated with no held chords changes chord on every measure.
//
// Roots are compared rather than names, since G7 after G is the same chord held with a finger
// moved. Before this option existed a 75-measure progression had three to seven neighbouring pairs
// with the same root, and runs of three by root got through ("C C C7", "Em Em E7") because their
// names differ. Asking for no held chords must also leave alone what makes a progression work: its
// length, its cadence, and every chord from outside the key resolving where it points.
//
// Run with: node scripts/check-no-held-chords.mjs

import * as fs from 'node:fs';
import * as path from 'node:path';
import { generateProgression, chordDisplayName } from '../src/shared/chordProgressions.mjs';

const root = path.join(import.meta.dirname, '..');
const model = JSON.parse(fs.readFileSync(
    path.join(root, 'src', 'assets', 'progressions', 'progression-model.json'), 'utf8'));
const library = JSON.parse(fs.readFileSync(
    path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

const counts = { progressions: 0, sameRoot: 0, wrongLength: 0, cadenceBroken: 0, borrowed: 0, unresolved: 0 };
const failures = [];
const fail = (what, detail) => {
    if (failures.length < 10) failures.push(`${what}: ${detail}`);
};

for (const levelId of model.levels.map(level => level.id)) {
    for (const borrowingId of model.borrowing.tiers.map(tier => tier.id)) {
        for (const chordCount of [2, 3, 4, 5, 8, 16, 75, 256]) {
            for (let seed = 1; seed <= 30; seed++) {
                for (const key of ['C', 'G', 'D', 'A', 'E', 'F']) {
                    for (const mode of ['major', 'minor']) {
                        const settings = { key, mode, levelId, borrowingId, chordCount, seed, library, noHeldChords: true };
                        const progression = generateProgression(model, settings);
                        if (progression.chords.length === 0) continue;
                        counts.progressions++;
                        const chords = progression.chords;
                        const where = `${key} ${mode}, ${levelId}, ${borrowingId}, ${chordCount} measures, seed ${seed}`;

                        if (chords.length !== chordCount) {
                            counts.wrongLength++;
                            fail('wrong length', `${where}: ${chords.length}`);
                        }
                        for (let i = 1; i < chords.length; i++) {
                            if (chords[i].root !== chords[i - 1].root) continue;
                            counts.sameRoot++;
                            fail('same root', `${where}, measures ${i} and ${i + 1}: ` +
                                `${chordDisplayName(chords[i - 1])} ${chordDisplayName(chords[i])}`);
                        }
                        const cadence = model.modes[mode].cadences.find(entry => entry.name === progression.cadence);
                        if (cadence) {
                            const tail = chords.slice(-cadence.chords.length).map(c => c.baseDegree ?? c.degree);
                            if (tail.join() !== cadence.chords.join()) {
                                counts.cadenceBroken++;
                                fail('cadence broken', `${where}: ${tail.join(' ')} for ${cadence.chords.join(' ')}`);
                            }
                        }
                        for (let i = 0; i < chords.length; i++) {
                            if (!chords[i].borrowed) continue;
                            counts.borrowed++;
                            if (chords[i].resolvesTo && chords[i + 1]?.degree !== chords[i].resolvesTo) {
                                counts.unresolved++;
                                fail('does not resolve', `${where}, measure ${i + 1}: ${chords[i].borrowed}`);
                            }
                        }
                    }
                }
            }
        }
    }
}

console.log(`${counts.progressions} progressions, ${counts.borrowed} chords from outside the key`);
console.log(`  neighbours with the same root: ${counts.sameRoot}`);
console.log(`  wrong length: ${counts.wrongLength}`);
console.log(`  cadence broken: ${counts.cadenceBroken}`);
console.log(`  chords from outside the key that do not resolve: ${counts.unresolved}`);
for (const failure of failures) console.log(`  FAIL ${failure}`);
const failed = counts.sameRoot + counts.wrongLength + counts.cadenceBroken + counts.unresolved;
console.log(failed === 0 ? 'All checks passed.' : `${failed} failure(s).`);
process.exit(failed === 0 ? 0 : 1);
