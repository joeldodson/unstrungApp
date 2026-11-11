// Checks that playback swings a bar whose file states a triplet feel, as alphaTab's own MIDI
// generator does. See `tripletFeelTimes` in src/shared/audioTrack.mjs.
//
// Until 2026-11-11 such a bar was played straight, though Song Summary said "Feel - triplet
// eighths (swung)": unstrung places beats from alphaTab's `playbackStart`, which is the written
// position, and alphaTab applies the feel only when it makes MIDI. Finding 5 of the November review.
//
// The first part builds scores from alphaTex and needs no song files. Each is played at 60 beats
// a minute, so a quarter note is a second, and each is also run through alphaTab's MidiFileGenerator
// to check that every beat starts and lasts exactly as alphaTab plays it. Given folders, it then
// reads every Guitar Pro file under them and makes the same comparison for every beat of every track.
//
//   node scripts/songs/check-triplet-feel.mjs [folder ...]

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAudioTrack, tripletFeelTimes } from '../../src/shared/audioTrack.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};
const round = seconds => Math.round(seconds * 1000) / 1000;
const list = values => values.map(round).join(' ');

/**
 * Every beat whose timing differs from alphaTab's MIDI generator, as text, and how many beats were
 * compared. alphaTab's tick lookup holds, for each beat it plays, where it starts in its bar and
 * where it ends, with the triplet feel applied.
 */
function compareWithAlphaTab(score) {
    const settings = new alphaTab.Settings();
    const generator = new alphaTab.midi.MidiFileGenerator(
        score, settings, new alphaTab.midi.AlphaSynthMidiFileHandler(new alphaTab.midi.MidiFile()));
    generator.generate();
    const lookup = generator.tickLookup.beatLookup;

    const differences = [];
    let compared = 0;
    for (const track of score.tracks) {
        for (const staff of track.staves) {
            for (const bar of staff.bars) {
                for (const voice of bar.voices) {
                    const times = tripletFeelTimes(voice);
                    voice.beats.forEach((beat, index) => {
                        const range = lookup.get(beat.id);
                        // Beats alphaTab does not play itself: an empty voice, or a bar a simile
                        // mark repeats. Neither is placed by this code either.
                        if (!range) return;
                        compared++;
                        const ours = times[index];
                        if (ours.start !== range.startTick || ours.start + ours.duration !== range.endTick) {
                            differences.push(`track ${track.index + 1} bar ${bar.index + 1} voice ${voice.index + 1} beat ${index + 1}: `
                                + `${ours.start}+${ours.duration}, alphaTab ${range.startTick}..${range.endTick}`);
                        }
                    });
                }
            }
        }
    }
    return { differences, compared };
}

function scoreFromTex(bars) {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(`\\tempo 60\n.\n${bars}\n`, new alphaTab.Settings());
    return importer.readScore();
}

/** Start and notated length, in seconds, of every note the audio track plays, in order. */
function played(score) {
    const { notes, bars } = buildAudioTrack(score, 0);
    return { starts: list(notes.map(n => n.startSeconds)), lengths: list(notes.map(n => n.notatedSeconds)), bars };
}

function matchesAlphaTab(score) {
    const { differences, compared } = compareWithAlphaTab(score);
    check(`all ${compared} beats start and end where alphaTab's MIDI puts them`, differences.length === 0, differences.join('; '));
}

// --- Scores built from alphaTex ---------------------------------------------------------------

console.log('Eight eighth notes, triplet eighths');
{
    const score = scoreFromTex('\\tf triplet8th 0.6.8 2.6.8 0.6.8 2.6.8 0.6.8 2.6.8 0.6.8 2.6.8');
    const { starts, lengths, bars } = played(score);
    check('the off-beats sound two thirds of the way through each beat', starts === '0 0.667 1 1.667 2 2.667 3 3.667', starts);
    check('long then short: two thirds of a beat, then one third', lengths === '0.667 0.333 0.667 0.333 0.667 0.333 0.667 0.333', lengths);
    check('the metronome still clicks on the beats', list(bars[0].beats) === '0 1 2 3', list(bars[0].beats));
    matchesAlphaTab(score);
}

console.log('\nThe same bar with no feel');
{
    const score = scoreFromTex('0.6.8 2.6.8 0.6.8 2.6.8 0.6.8 2.6.8 0.6.8 2.6.8');
    const { starts, lengths } = played(score);
    check('is played straight', starts === '0 0.5 1 1.5 2 2.5 3 3.5' && lengths === '0.5 0.5 0.5 0.5 0.5 0.5 0.5 0.5', `${starts} / ${lengths}`);
    matchesAlphaTab(score);
}

console.log('\nSixteenth notes, triplet sixteenths');
{
    const score = scoreFromTex('\\tf triplet16th 0.6.16 2.6.16 0.6.16 2.6.16 0.6.4 0.6.2');
    const { starts, lengths } = played(score);
    check('each pair of sixteenths is swung within its eighth', starts === '0 0.333 0.5 0.833 1 2', starts);
    check('long then short: a third of a beat, then a sixth', lengths === '0.333 0.167 0.333 0.167 1 2', lengths);
    matchesAlphaTab(score);
}

console.log('\nTriplet eighths, a bar with eighths among other values');
{
    const score = scoreFromTex('\\tf triplet8th 0.6.4 0.6.8 2.6.8 0.6.4 {d} 2.6.8');
    const { starts } = played(score);
    check('a pair after a quarter is swung', starts.startsWith('0 1 1.667 2'), starts);
    check('an eighth after a dotted quarter is off the pair and played as written', starts.endsWith('2 3.5'), starts);
    matchesAlphaTab(score);
}

console.log('\nTriplet eighths, an eighth rest then an eighth note');
{
    const score = scoreFromTex('\\tf triplet8th r.8 2.6.8 0.6.4 0.6.2');
    const { starts } = played(score);
    check('the rest is the long half, so the note comes in late', starts === '0.667 1 2', starts);
    matchesAlphaTab(score);
}

console.log('\nTriplet eighths, written as eighth-note triplets');
{
    const score = scoreFromTex('\\tf triplet8th 0.6.8 {tu 3} 2.6.8 {tu 3} 0.6.8 {tu 3} 0.6.4 0.6.2');
    const { starts } = played(score);
    check('a written triplet is played as written', starts === '0 0.333 0.667 1 2', starts);
    matchesAlphaTab(score);
}

for (const [feel, name, expected] of [
    ['dotted8th', 'Dotted eighths', '0 0.75 1 1.75'],
    ['scottish8th', 'Scottish eighths', '0 0.25 1 1.25'],
    ['dotted16th', 'Dotted sixteenths', '0 0.375 0.5 0.875'],
    ['scottish16th', 'Scottish sixteenths', '0 0.125 0.5 0.625']
]) {
    console.log(`\n${name}`);
    const value = feel.endsWith('16th') ? 16 : 8;
    const score = scoreFromTex(`\\tf ${feel} 0.6.${value} 2.6.${value} 0.6.${value} 2.6.${value} 0.6.2 0.6.4${value === 16 ? ' 0.6.4' : ''}`);
    const { starts } = played(score);
    check(`the first two pairs start at ${expected}`, starts.startsWith(expected + ' '), starts);
    matchesAlphaTab(score);
}

console.log('\nThe feel changes from bar to bar');
{
    const score = scoreFromTex('\\tf triplet8th 0.6.8 2.6.8 0.6.4 0.6.2 | \\tf none 0.6.8 2.6.8 0.6.4 0.6.2');
    const { starts } = played(score);
    check('swung in the first bar and straight in the second', starts === '0 0.667 1 2 4 4.5 5 6', starts);
    matchesAlphaTab(score);
}

// --- Song files ----------------------------------------------------------------------------------

const folders = process.argv.slice(2);
if (folders.length > 0) {
    const walk = (dir, out = []) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
            const full = path.join(dir, entry.name);
            if (entry.isDirectory()) walk(full, out);
            else if (/\.(gp|gp3|gp4|gp5|gpx)$/i.test(entry.name)) out.push(full);
        }
        return out;
    };
    const files = folders.flatMap(folder => walk(folder));
    console.log(`\nSong files: ${files.length}`);

    let withFeel = 0, swungBars = 0, moved = 0, compared = 0;
    const differences = [];
    for (const [fileIndex, file] of files.entries()) {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)));
        const feelBars = score.masterBars.filter(m => m.tripletFeel !== 0).length;
        if (feelBars > 0) withFeel++;
        swungBars += feelBars;

        const result = compareWithAlphaTab(score);
        compared += result.compared;
        // Files are numbered rather than named: the song files are not part of the repository.
        differences.push(...result.differences.map(d => `file ${fileIndex + 1}, ${d}`));
        for (const track of score.tracks) for (const staff of track.staves) for (const bar of staff.bars) {
            for (const voice of bar.voices) {
                tripletFeelTimes(voice).forEach((time, index) => {
                    if (time.start !== voice.beats[index].playbackStart) moved++;
                });
            }
        }
    }
    console.log(`  files stating a feel: ${withFeel}, bars with one: ${swungBars}, beats moved by it: ${moved}`);
    check(`all ${compared} beats start and end where alphaTab's MIDI puts them`, differences.length === 0,
        `${differences.length} differ, first: ${differences.slice(0, 5).join('; ')}`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
