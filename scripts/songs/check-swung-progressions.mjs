// Checks swing in chord practice: that a swung progression is saved as a song whose every "and"
// is played late, and reads back swung with the same chords and pattern.
//
// Chord practice times its own strums, each "and" two thirds of the way through the beat
// (`slotBeats` in src/shared/strummingPatterns.mjs). The saved file states triplet eighths, and
// a file's feel moves only an eighth that directly follows another on the beat, so
// `songToAlphaTex` cuts a swung song's notes at the beat (`swungPiece` in src/shared/songScore.mjs).
// This writes every built-in pattern that can swing, reads the text with alphaTab, plays it as an
// audio track, and compares where each strum sounds with where chord practice puts it.
//
//   node scripts/songs/check-swung-progressions.mjs

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAudioTrack } from '../../src/shared/audioTrack.mjs';
import { songFromProgression, songToAlphaTex, readSongFromScore, progressionFromSong } from '../../src/shared/songScore.mjs';
import {
    BUILT_IN_PATTERNS, formatStrummingPattern, patternsFor, slotBeats, swingApplies, SWING_AND
} from '../../src/shared/strummingPatterns.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};
const round = seconds => Math.round(seconds * 1000) / 1000;

function scoreFromTex(text) {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(text, new alphaTab.Settings());
    return importer.readScore();
}

// Three measures, so a strum ringing over a bar line is written and read too.
const CHORDS = [{ root: 'C', suffix: 'major' }, { root: 'G', suffix: 'major' }, { root: 'D', suffix: 'major' }];

function write(beatsPerBar, beatUnit, pattern, swing, chords = CHORDS) {
    const progression = { key: 'G', mode: 'major', beatsPerBar, beatUnit, chords };
    // Tempo 60 with a quarter-note beat: a beat is a second.
    const song = songFromProgression(progression, { library, tempo: 60, pattern, swing });
    return { song, written: songToAlphaTex(song) };
}

console.log('The slot grid');
check('a swung and falls two thirds of the way through its beat', slotBeats(3, 2, true) === 1 + SWING_AND);
check('a beat is not moved', slotBeats(4, 2, true) === 2);
check('straight, an and falls halfway', slotBeats(3, 2, false) === 1.5);
check('sixteenths are not moved', slotBeats(5, 4, true) === 1.25);
check('swing applies to eighths with a quarter-note beat', swingApplies(4, 2) && swingApplies(4, 1));
check('and not to sixteenths, or to a time signature counted in eighths', !swingApplies(4, 4) && !swingApplies(8, 1));

for (const signature of [...new Set(BUILT_IN_PATTERNS.map(p => p.timeSignature))]) {
    const [beatsPerBar, beatUnit] = signature.split('/').map(Number);
    for (const pattern of patternsFor(beatsPerBar, beatUnit)) {
        if (!swingApplies(beatUnit, pattern.slotsPerBeat)) continue;
        console.log(`\n${signature}, ${pattern.name}: ${pattern.text}`);
        const { written } = write(beatsPerBar, beatUnit, pattern, true);
        if (written.error) { check('is written', false, written.error); continue; }
        check('the file states triplet eighths once', written.text.split('\\tf triplet8th').length === 2);

        const score = scoreFromTex(written.text);
        check('every bar carries the feel', score.masterBars.every(bar => bar.tripletFeel === 2),
            score.masterBars.map(bar => bar.tripletFeel).join(' '));

        // Where chord practice strums, in seconds: mutes may or may not sound a note in an audio
        // track, so they are allowed and not required.
        const struck = [];
        const allowed = new Set();
        for (let measure = 0; measure < CHORDS.length; measure++) {
            for (const [index, slot] of pattern.slots.entries()) {
                if (slot.stroke === 'miss') continue;
                const at = round(measure * beatsPerBar + slotBeats(index, pattern.slotsPerBeat, true));
                allowed.add(at);
                if (slot.stroke !== 'mute') struck.push(at);
            }
        }
        const starts = new Set(buildAudioTrack(score, 0).notes.map(note => round(note.startSeconds)));
        const missing = struck.filter(at => !starts.has(at));
        // The strings of a strum follow its first by 20 milliseconds each, so a note within a
        // strum's sweep belongs to that strum.
        const STRUM_SWEEP_SECONDS = 0.125;
        const extra = [...starts].filter(at => ![...allowed].some(strum => at >= strum && at <= strum + STRUM_SWEEP_SECONDS));
        check('played as a track, every strum sounds where chord practice puts it', missing.length === 0 && extra.length === 0,
            `not sounded at ${missing.join(' ') || 'none'}; sounded at ${extra.join(' ') || 'none'} unasked`);

        const read = progressionFromSong(readSongFromScore(score, { library }), { library });
        check('reads back as a swung progression', read.progression?.swing === true, read.error ?? 'swing is not set');
        check('with the same pattern', read.progression &&
            formatStrummingPattern(read.progression.pattern.slots) === formatStrummingPattern(pattern.slots),
            read.progression ? formatStrummingPattern(read.progression.pattern.slots) : read.error);
        check('and the same chords', read.progression?.chords.map(c => c.root).join(' ') === 'C G D');
    }
}

console.log('\nA chord that starts on an and');
{
    const pattern = patternsFor(4, 4).find(p => p.name === 'Old Faithful');
    const chords = [{ root: 'C', suffix: 'major', laterChords: [{ root: 'G', suffix: 'major', beat: 2.5 }] }, { root: 'D', suffix: 'major' }];
    const { written } = write(4, 4, pattern, true, chords);
    const score = scoreFromTex(written.text);
    const read = progressionFromSong(readSongFromScore(score, { library }), { library });
    check('keeps its written beat, 2.5', read.progression?.chords[0].laterChords?.[0].beat === 2.5, read.error ?? JSON.stringify(read.progression?.chords[0]));
    const starts = [...new Set(buildAudioTrack(score, 0).notes.map(note => round(note.startSeconds)))].sort((a, b) => a - b);
    check('and its first strum sounds late with the rest', starts.includes(round(1 + SWING_AND)) && !starts.includes(1.5), starts.join(' '));
}

console.log('\nStraight, and where swing has nothing to move');
{
    const oldFaithful = patternsFor(4, 4).find(p => p.name === 'Old Faithful');
    const straight = write(4, 4, oldFaithful, false);
    check('a straight progression states no feel', !straight.written.text.includes('\\tf'));
    const read = progressionFromSong(readSongFromScore(scoreFromTex(straight.written.text), { library }), { library });
    check('and reads back straight', read.progression?.swing === false, read.error ?? '');

    const sixteenths = { slotsPerBeat: 4, slots: Array.from({ length: 16 }, (_, i) => ({ stroke: i % 2 ? 'up' : 'down', accent: false })) };
    check('a pattern in sixteenths is saved straight though Swing is set', !write(4, 4, sixteenths, true).written.text.includes('\\tf'));
    const six = patternsFor(6, 8).find(p => p.name === 'All Down-Up');
    check('and so is 6/8', !write(6, 8, six, true).written.text.includes('\\tf'));
}

console.log('\nFiles chord practice cannot show');
{
    const reason = text => progressionFromSong(readSongFromScore(scoreFromTex(text), { library }), { library }).error ?? '';
    const bar = '(0.1 1.2 0.3 2.4 3.5).4 {sd ch "C"} (0.1 1.2 0.3 2.4 3.5).4 {sd} (0.1 1.2 0.3 2.4 3.5).4 {sd} (0.1 1.2 0.3 2.4 3.5).4 {sd}';
    check('swung in some measures only', /swung in some measures/.test(reason(`\\tempo 60\n\\ts (4 4) \\ks c \\tf triplet8th ${bar} |\n\\tf none ${bar} |\n`)),
        reason(`\\tempo 60\n\\ts (4 4) \\ks c \\tf triplet8th ${bar} |\n\\tf none ${bar} |\n`));
    check('a feel other than triplet eighths', /feel other than triplet eighths/.test(reason(`\\tempo 60\n\\ts (4 4) \\ks c \\tf dotted8th ${bar} |\n${bar} |\n`)),
        reason(`\\tempo 60\n\\ts (4 4) \\ks c \\tf dotted8th ${bar} |\n${bar} |\n`));
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
