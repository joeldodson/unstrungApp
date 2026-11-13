// Checks every feel a progression can be saved with: that the saved song states it, plays every
// strum where the feel puts it, and reads back with the same chords and pattern.
//
// Swing, triplet eighths, came first (2026-11-11): chord practice times its own strums, each "and"
// two thirds of the way through the beat (`slotBeats` in src/shared/strummingPatterns.mjs). On
// 2026-11-12 the writer learned all six feels alphaTab knows (docs/one-player.md, decision 18):
// triplet, dotted and Scottish, each at eighths and at sixteenths. A file's feel moves only a note
// of the paired value that directly follows another on the edge of a pair, so `songToAlphaTex` cuts
// notes at the edges of the pairs (`feelPiece` in src/shared/songScore.mjs): at the beat for eighth
// feels, at each half beat for sixteenth feels. This writes patterns each feel applies to, reads
// the text with alphaTab, plays it as an audio track, and compares where each strum sounds with
// where the feel puts it, as alphaTab's own MIDI generator would.
//
// Until stage 3, when progressions moved to the audio track player, a file stating a feel other
// than triplet eighths read back with it but was not opened as a progression; now every one is.
//
//   node scripts/songs/check-swung-progressions.mjs

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAudioTrack } from '../../src/shared/audioTrack.mjs';
import { songFromProgression, songToAlphaTex, readSongFromScore, progressionFromSong, progressionQuarterTempo } from '../../src/shared/songScore.mjs';
import {
    BUILT_IN_PATTERNS, FEELS, feelApplies, feelPairTicks, formatStrummingPattern, parseStrummingPattern, patternsFor,
    slotBeats, swingApplies, SWING_AND
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

function write(beatsPerBar, beatUnit, pattern, feel, chords = CHORDS) {
    const progression = { key: 'G', mode: 'major', beatsPerBar, beatUnit, chords };
    // Tempo 60 with a quarter-note beat: a quarter is a second.
    const song = songFromProgression(progression, { library, tempo: 60, pattern, feel });
    return { song, written: songToAlphaTex(song) };
}

// alphaTab's TripletFeel for each feel, and the long and short halves of its pairs in ticks, as its
// MidiFileGenerator gives them.
const TRIPLET_FEEL = { triplet16th: 1, triplet8th: 2, dotted16th: 3, dotted8th: 4, scottish16th: 5, scottish8th: 6 };
const FIRST_HALF = { triplet8th: 640, dotted8th: 720, scottish8th: 240, triplet16th: 320, dotted16th: 360, scottish16th: 120 };

/**
 * Where a slot sounds in its measure, in quarters from 0, with the feel applied: a slot on the
 * middle of a pair is moved to the end of the pair's long first half.
 */
function feelQuarters(slot, slotsPerBeat, beatUnit, feel) {
    const ticks = slot * (4 / beatUnit) * 960 / slotsPerBeat;
    const pair = feelPairTicks(feel);
    if (pair && ticks % pair === pair / 2) return (ticks - pair / 2 + FIRST_HALF[feel]) / 960;
    return ticks / 960;
}

const pattern = (text, slotsPerBeat, name) => ({ name, text, slotsPerBeat, slots: parseStrummingPattern(text).slots });
// No built-in pattern is in sixteenths, so these stand in for one a player makes.
const SIXTEENTH_PATTERNS = [
    [4, 4, pattern('D U D U D U D U D U D U D U D U', 4, 'All Down-Up in sixteenths')],
    [4, 4, pattern('D - D U - U D U D - D U - U D U', 4, 'Old Faithful twice, in sixteenths')],
    [4, 4, pattern('>D x U D x U D U >D x U D x U D U', 4, 'a funk strum with mutes')],
    [6, 8, pattern('D U D U D U D U D U D U', 2, 'All Down-Up in sixteenths, 6/8')]
];

console.log('The slot grid');
check('a swung and falls two thirds of the way through its beat', slotBeats(3, 2, true) === 1 + SWING_AND);
check('a beat is not moved', slotBeats(4, 2, true) === 2);
check('straight, an and falls halfway', slotBeats(3, 2, false) === 1.5);
check('sixteenths are not moved by swing', slotBeats(5, 4, true) === 1.25);
check('swing applies to eighths with a quarter-note beat', swingApplies(4, 2) && swingApplies(4, 1));
check('and not to sixteenths, or to a time signature counted in eighths', !swingApplies(4, 4) && !swingApplies(8, 1));
check('every eighth feel applies as swing does', FEELS.filter(f => f.pairs === 8).every(f =>
    feelApplies(f.id, 4, 2) && feelApplies(f.id, 4, 1) && !feelApplies(f.id, 4, 4) && !feelApplies(f.id, 8, 1)));
check('every sixteenth feel applies to sixteenths, in 4/4 or 6/8, and nothing coarser', FEELS.filter(f => f.pairs === 16).every(f =>
    feelApplies(f.id, 4, 4) && feelApplies(f.id, 8, 2) && !feelApplies(f.id, 4, 2) && !feelApplies(f.id, 8, 1)));
check('straight applies nowhere', !feelApplies(null, 4, 2));

for (const feel of FEELS) {
    console.log(`\n=== ${feel.label} (${feel.id}) ===`);
    const cases = feel.pairs === 8
        ? [...new Set(BUILT_IN_PATTERNS.map(p => p.timeSignature))].flatMap(signature => {
            const [beatsPerBar, beatUnit] = signature.split('/').map(Number);
            return patternsFor(beatsPerBar, beatUnit).map(p => [beatsPerBar, beatUnit, p]);
        })
        : SIXTEENTH_PATTERNS;
    for (const [beatsPerBar, beatUnit, p] of cases) {
        if (!feelApplies(feel.id, beatUnit, p.slotsPerBeat)) continue;
        const label = `${beatsPerBar}/${beatUnit}, ${p.name}`;
        const { written } = write(beatsPerBar, beatUnit, p, feel.id);
        if (written.error) { check(`${label}: is written`, false, written.error); continue; }
        const problems = [];
        if (written.text.split(`\\tf ${feel.id}`).length !== 2) problems.push('the feel is not stated once');

        const score = scoreFromTex(written.text);
        if (!score.masterBars.every(bar => bar.tripletFeel === TRIPLET_FEEL[feel.id])) problems.push('not every bar carries the feel');

        // Where the feel puts each strum, in seconds: mutes sound no note in an audio track, so they
        // are allowed and not required.
        const measureQuarters = beatsPerBar * 4 / beatUnit;
        // The file's tempo is in quarters since 2026-11-12: 60 beats a minute in 6/8 is 30
        // quarters, so a quarter is two seconds there.
        const secondsPerQuarter = 60 / progressionQuarterTempo(60, beatUnit);
        const struck = [];
        const allowed = new Set();
        for (let measure = 0; measure < CHORDS.length; measure++) {
            for (const [index, slot] of p.slots.entries()) {
                if (slot.stroke === 'miss') continue;
                const at = round((measure * measureQuarters + feelQuarters(index, p.slotsPerBeat, beatUnit, feel.id)) * secondsPerQuarter);
                allowed.add(at);
                if (slot.stroke !== 'mute') struck.push(at);
            }
        }
        const starts = new Set(buildAudioTrack(score, 0).notes.map(note => round(note.startSeconds)));
        const missing = struck.filter(at => !starts.has(at));
        // The strings of a strum follow its first by 20 milliseconds each, so a note within a
        // strum's sweep belongs to that strum.
        const STRUM_SWEEP_SECONDS = 0.105;
        const extra = [...starts].filter(at => ![...allowed].some(strum => at >= strum - 1e-9 && at <= strum + STRUM_SWEEP_SECONDS));
        if (missing.length || extra.length) problems.push(`not sounded at ${missing.join(' ') || 'none'}; sounded at ${extra.join(' ') || 'none'} unasked`);

        const song = readSongFromScore(score, { library });
        if (song.feel !== feel.id) problems.push(`reads back as ${song.feel}`);
        const unread = song.measures.filter(m => m.form === 'written').map(m => m.reason);
        if (unread.length) problems.push(`measures read as written out: ${unread[0]}`);
        if (song.pattern?.text !== formatStrummingPattern(p.slots)) problems.push(`reads its pattern as ${song.pattern?.text}`);

        // Every feel opens as a progression since they play on the audio track player (stage 3).
        const read = progressionFromSong(song, { library });
        if (read.progression?.feel !== feel.id) problems.push(read.error ?? `opens with feel ${read.progression?.feel}`);
        if (read.progression?.swing !== (feel.id === 'triplet8th')) problems.push('opens with swing set wrongly');
        if (read.progression?.chords.map(c => c.root).join(' ') !== 'C G D') problems.push('opens with other chords');
        check(`${label}: plays as the feel says and reads back with it`, problems.length === 0, problems.join('; '));
    }
}

console.log('\nA chord that starts on an and');
{
    const oldFaithful = patternsFor(4, 4).find(p => p.name === 'Old Faithful');
    const chords = [{ root: 'C', suffix: 'major', laterChords: [{ root: 'G', suffix: 'major', beat: 2.5 }] }, { root: 'D', suffix: 'major' }];
    const { written } = write(4, 4, oldFaithful, 'triplet8th', chords);
    const score = scoreFromTex(written.text);
    const read = progressionFromSong(readSongFromScore(score, { library }), { library });
    check('keeps its written beat, 2.5', read.progression?.chords[0].laterChords?.[0].beat === 2.5, read.error ?? JSON.stringify(read.progression?.chords[0]));
    const starts = [...new Set(buildAudioTrack(score, 0).notes.map(note => round(note.startSeconds)))].sort((a, b) => a - b);
    check('and its first strum sounds late with the rest', starts.includes(round(1 + SWING_AND)) && !starts.includes(1.5), starts.join(' '));
}

console.log('\nSwing as chord practice gives it');
{
    const oldFaithful = patternsFor(4, 4).find(p => p.name === 'Old Faithful');
    const song = songFromProgression({ key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4, chords: CHORDS },
        { library, tempo: 60, pattern: oldFaithful, swing: true });
    check('Swing checked is triplet eighths', song.feel === 'triplet8th' && songToAlphaTex(song).text.includes('\\tf triplet8th'), song.feel);
}

console.log('\nStraight, and where a feel has nothing to move');
{
    const oldFaithful = patternsFor(4, 4).find(p => p.name === 'Old Faithful');
    const straight = write(4, 4, oldFaithful, null);
    check('a straight progression states no feel', !straight.written.text.includes('\\tf'));
    const read = progressionFromSong(readSongFromScore(scoreFromTex(straight.written.text), { library }), { library });
    check('and reads back straight', read.progression?.swing === false && read.progression?.feel === null, read.error ?? '');

    const sixteenths = SIXTEENTH_PATTERNS[0][2];
    check('an eighth feel over sixteenths is saved straight', !write(4, 4, sixteenths, 'dotted8th').written.text.includes('\\tf'));
    const six = patternsFor(6, 8).find(p => p.name === 'All Down-Up');
    check('and so is one in 6/8', !write(6, 8, six, 'triplet8th').written.text.includes('\\tf'));
    check('a sixteenth feel over eighths is saved straight', !write(4, 4, oldFaithful, 'triplet16th').written.text.includes('\\tf'));

    // A file from elsewhere can state a feel where it has nothing to move. Written here by setting
    // the feel on the song after songFromProgression has left it off.
    const forced = (beatsPerBar, beatUnit, p, feel) => {
        const song = songFromProgression({ key: 'G', mode: 'major', beatsPerBar, beatUnit, chords: CHORDS }, { library, tempo: 60, pattern: p });
        const written = songToAlphaTex({ ...song, feel });
        return progressionFromSong(readSongFromScore(scoreFromTex(written.text), { library }), { library });
    };
    const swungSix = forced(6, 8, six, 'triplet8th');
    check('a file swung in 6/8 opens with Swing off', swungSix.progression?.swing === false, swungSix.error ?? 'swing is set');
    const swungSixteenths = forced(4, 4, sixteenths, 'triplet8th');
    check('and so does one swung over sixteenths', swungSixteenths.progression?.swing === false, swungSixteenths.error ?? 'swing is set');
}

console.log('\nFiles a progression cannot hold');
{
    const reason = text => progressionFromSong(readSongFromScore(scoreFromTex(text), { library }), { library }).error ?? '';
    const bar = '(0.1 1.2 0.3 2.4 3.5).4 {sd ch "C"} (0.1 1.2 0.3 2.4 3.5).4 {sd} (0.1 1.2 0.3 2.4 3.5).4 {sd} (0.1 1.2 0.3 2.4 3.5).4 {sd}';
    const mixed = reason(`\\tempo 60\n\\ts (4 4) \\ks c \\tf triplet8th ${bar} |\n\\tf none ${bar} |\n`);
    check('a feel in some measures only is refused, saying it opens as a song',
        mixed === 'its feel changes partway through, which a progression cannot hold; opened as a song, with Open File, it plays as written', mixed);
    const twoFeels = reason(`\\tempo 60\n\\ts (4 4) \\ks c \\tf triplet8th ${bar} |\n\\tf dotted8th ${bar} |\n`);
    check('so is one that changes from one feel to another', /feel changes partway through/.test(twoFeels), twoFeels);
    const dotted = reason(`\\tempo 60\n\\ts (4 4) \\ks c \\tf dotted8th ${bar} |\n${bar} |\n`);
    check('a feel other than triplet eighths throughout is not refused, since progressions play on the track player', dotted === '', dotted);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
