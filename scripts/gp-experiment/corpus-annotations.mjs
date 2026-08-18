// Both text channels across a whole directory tree of .gp files, so a rule about
// which beat texts are really section names can be checked against real files.
// Run: node scripts/gp-experiment/corpus-annotations.mjs <dir>
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as alphaTab from '@coderline/alphatab';

function* files(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) yield* files(full);
        else if (/\.gp\d?x?$/i.test(entry.name)) yield full;
    }
}

for (const file of files(process.argv[2])) {
    const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(
        new Uint8Array(fs.readFileSync(file)));
    const sections = score.masterBars
        .map((mb, i) => (mb.section ? `${(mb.section.text || mb.section.marker || '').trim()}(${i + 1})` : null))
        .filter(Boolean);
    const texts = [];
    for (const track of score.tracks) {
        for (const staff of track.staves) {
            staff.bars.forEach((bar, bi) => {
                bar.voices.forEach(voice => {
                    voice.beats.forEach((beat, i) => {
                        if (beat.text) texts.push({ track: track.name, bar: bi + 1, beat: i + 1, of: voice.beats.length, text: beat.text });
                    });
                });
            });
        }
    }
    console.log(`\n=== ${path.basename(file)}  bars=${score.masterBars.length}`);
    console.log(`  sections (${sections.length}): ${sections.join(' ') || '(none)'}`);
    console.log(`  beat texts: ${texts.length}`);
    const byTrack = new Map();
    for (const t of texts) {
        if (!byTrack.has(t.track)) byTrack.set(t.track, []);
        byTrack.get(t.track).push(t);
    }
    for (const [name, list] of byTrack) {
        const perBar = (score.masterBars.length / list.length).toFixed(1);
        console.log(`    ${name}: ${list.length} (one per ${perBar} bars)`);
        for (const t of list.slice(0, 12)) {
            console.log(`      bar ${t.bar} beat ${t.beat}/${t.of}: ${JSON.stringify(t.text)}`);
        }
        if (list.length > 12) console.log(`      ... ${list.length - 12} more`);
    }
}
