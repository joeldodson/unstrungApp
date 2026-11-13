// Compares where each strum falls on the two players, for every built-in strumming pattern.
//
// Chord practice's player times its own strums from the pattern (`slotBeats`), and its tempo counts
// the time signature's lower number: 80 in 6/8 is 80 eighths a minute. The audio track player plays
// the Score that `songFromProgression` writes, as saving does, and alphaTab's tempo counts quarters.
// So a progression on the track player is played at its tempo turned into quarters
// (`progressionQuarterTempo`), and then every strum should fall where chord practice puts it.
// docs/one-player.md, decision 20: strum times only, not levels or which strings sound, which
// decisions 10 to 13 change on purpose.
//
// Each pattern is played straight, and swung where swing applies, over four measures of G, C, D
// and F at 80 beats a minute, the pattern preview's tempo. Strings are not spread here (spacing 0),
// so a strum's notes all start at its time. A mute sounds nothing on either player: on the track it
// is dead notes, which damp strings at the mute's time, so mutes are compared with those.
//
//   node scripts/songs/check-two-players-strum-times.mjs

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAudioTrack } from '../../src/shared/audioTrack.mjs';
import {
    songFromProgression, songToAlphaTex, progressionQuarterTempo, readSongFromScore, progressionFromSong
} from '../../src/shared/songScore.mjs';
import { BUILT_IN_PATTERNS, patternsFor, slotBeats, swingApplies } from '../../src/shared/strummingPatterns.mjs';

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

const TEMPO = 80;
const CHORDS = ['G', 'C', 'D', 'F'].map(root => ({ root, suffix: 'major' }));

/** Chord practice's strums as { at, mute }, in seconds, as scheduleChordPracticeChunk lays them out. */
function chordPracticeStrums(beatsPerBar, pattern, swing) {
    const secondsPerBeat = 60 / TEMPO;
    const strums = [];
    for (let measure = 0; measure < CHORDS.length; measure++) {
        for (const [index, slot] of pattern.slots.entries()) {
            if (slot.stroke === 'miss') continue;
            const beats = slotBeats(index, pattern.slotsPerBeat, swing);
            strums.push({ at: round((measure * beatsPerBar + beats) * secondsPerBeat), mute: slot.stroke === 'mute' });
        }
    }
    return strums;
}

console.log('The tempo a progression is played at on the track player');
check('a quarter-note beat is unchanged', progressionQuarterTempo(80, 4) === 80);
check('an eighth-note beat is halved: 80 eighths a minute is 40 quarters', progressionQuarterTempo(80, 8) === 40);
check('a half-note beat is doubled', progressionQuarterTempo(80, 2) === 160);

// Settled by Joel at the end of stage 3: a saved progression writes its tempo in quarters, so the
// file opened as a song plays at the progression's speed, and writes mf, so it plays the mf
// recordings as chord practice did rather than the f alphaTab gives a note with no dynamic.
console.log('\nWhat a saved progression writes');
{
    const pattern = patternsFor(6, 8).find(p => p.name === 'Down Only');
    const song = songFromProgression({ key: 'G', mode: 'major', beatsPerBar: 6, beatUnit: 8, chords: CHORDS },
        { library, tempo: 75, pattern });
    const text = songToAlphaTex(song).text;
    check('6/8 at 75 is written as 37.5 quarters a minute', text.includes('\\tempo 37.5\n'), text.split('\n')[0]);
    const score = scoreFromTex(text);
    const read = progressionFromSong(readSongFromScore(score, { library }), { library });
    check('and reads back as 75', read.progression?.tempo === 75, read.error ?? String(read.progression?.tempo));
    check('mf is written once, on the first beat', text.split('{').filter(part => part.includes('dy mf')).length === 1, text.slice(0, 300));
    const layers = new Set(buildAudioTrack(score, 0).notes.map(note => note.velocity));
    check('and every note plays the mf recordings', layers.size === 1 && layers.has('mf'), [...layers].join(' '));
    const old = progressionFromSong(readSongFromScore(scoreFromTex(text.replace('\\tempo 37.5', '\\tempo 75')), { library }), { library });
    check('a 6/8 file from before writes its own number, and opens at twice it', old.progression?.tempo === 150, String(old.progression?.tempo));
    const reggae = patternsFor(4, 4).find(p => p.name === 'Reggae Offbeat');
    const offbeat = scoreFromTex(songToAlphaTex(songFromProgression({ key: 'G', mode: 'major', beatsPerBar: 4, beatUnit: 4, chords: CHORDS },
        { library, tempo: 60, pattern: reggae })).text);
    const offbeatLayers = new Set(buildAudioTrack(offbeat, 0).notes.map(note => note.velocity));
    check('mf carries on from a first beat that is a rest', offbeatLayers.size === 1 && offbeatLayers.has('mf'), [...offbeatLayers].join(' '));
}

const signatures = [...new Set(BUILT_IN_PATTERNS.map(p => p.timeSignature))];
for (const signature of signatures) {
    const [beatsPerBar, beatUnit] = signature.split('/').map(Number);
    console.log(`\n=== ${signature} ===`);
    for (const pattern of patternsFor(beatsPerBar, beatUnit)) {
        for (const swing of [false, true]) {
            if (swing && !swingApplies(beatUnit, pattern.slotsPerBeat)) continue;
            const label = `${pattern.name}${swing ? ', swung' : ''}`;
            const song = songFromProgression({ key: 'G', mode: 'major', beatsPerBar, beatUnit, chords: CHORDS },
                { library, tempo: TEMPO, pattern, swing });
            const written = songToAlphaTex(song);
            if (written.error) { check(`${label}: is written`, false, written.error); continue; }
            const track = buildAudioTrack(scoreFromTex(written.text), 0,
                { targetTempo: progressionQuarterTempo(TEMPO, beatUnit), strumSpacingSeconds: 0 });

            const expected = chordPracticeStrums(beatsPerBar, pattern, swing);
            const struck = new Set(track.notes.map(note => round(note.startSeconds)));
            const damped = new Set(track.stops.map(stop => round(stop.startSeconds)));
            const problems = [];
            const notStruck = expected.filter(s => !s.mute && !struck.has(s.at)).map(s => s.at);
            const notDamped = expected.filter(s => s.mute && !damped.has(s.at)).map(s => s.at);
            const strumTimes = new Set(expected.map(s => s.at));
            const unasked = [...struck, ...damped].filter(at => !strumTimes.has(at));
            if (notStruck.length) problems.push(`no strum at ${notStruck.join(' ')}`);
            if (notDamped.length) problems.push(`no mute at ${notDamped.join(' ')}`);
            if (unasked.length) problems.push(`sounds at ${[...new Set(unasked)].sort((a, b) => a - b).join(' ')} unasked`);
            const lengthExpected = round(CHORDS.length * beatsPerBar * 60 / TEMPO);
            if (round(track.totalSeconds) !== lengthExpected) problems.push(`lasts ${round(track.totalSeconds)} s, not ${lengthExpected}`);
            check(`${label}: every strum where chord practice plays it`, problems.length === 0, problems.join('; '));
        }
    }
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) FAILED.`);
process.exitCode = failures === 0 ? 0 : 1;
