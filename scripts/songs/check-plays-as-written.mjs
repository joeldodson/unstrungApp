// Checks that src/shared/audioTrack.mjs plays exactly the notes a track writes, whatever chord name
// is printed over them.
//
// Until 2026-11-10 a printed chord over one or two notes was filled in to the whole chord, from the
// file's diagram or from the fullest beat the song played under that name. Joel decided the file
// should be played as written: a chord name over string 6, fret 3 plays G2, and a reader who wants
// to strum a G has the printed name to go on. See docs/chord-forms-in-scores.md, Playing what is
// written.
//
// The first part builds scores by hand and needs no song files. Given folders, it then reads every
// Guitar Pro file under them and compares each guitar and bass track's timeline with its notes.
//
//   node scripts/songs/check-plays-as-written.mjs [folder ...]
//
// Folders are taken as arguments so that nothing here names a song file: the files in the wider
// test set are licensed for one person's use and stay outside the repository.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildAudioTrack } from '../../src/shared/audioTrack.mjs';

const root = path.join(import.meta.dirname, '..', '..');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};

// --- Scores built by hand ------------------------------------------------------------------------

// Standard tuning as alphaTab holds it: highest-pitched string first.
const TUNING = [64, 59, 55, 50, 45, 40];
const PLACEHOLDER = [3, 1, 2, 2, 0, -1]; // Am7 from string 1: the shape Songsterr hides under every chord
const G_SHAPE = [3, 0, 0, 0, 2, 3];      // G from string 1

/** A one-bar score of one guitar track; each beat is { chord, notes: [{ string, fret }] }. */
function scoreWith(beats) {
    const masterBar = {
        index: 0, start: 0, timeSignatureNumerator: 4, timeSignatureDenominator: 4,
        calculateDuration: () => 3840
    };
    const note = ({ string, fret }) => ({
        // alphaTab numbers strings from the lowest; `string` here is tab numbering, 1 the highest.
        string: TUNING.length - string + 1, fret, realValue: TUNING[string - 1] + fret,
        isStringed: true, isDead: false, isTieDestination: false, dynamics: 4
    });
    const bar = {
        index: 0, masterBar,
        voices: [{
            beats: beats.map((b, i) => ({
                isRest: false, hasChord: !!b.chord, chord: b.chord, notes: b.notes.map(note),
                playbackStart: i * 960, playbackDuration: 960, brushType: 0, pickStroke: 0
            }))
        }]
    };
    return { tempo: 60, masterBars: [masterBar], tracks: [{ name: 'Guitar', staves: [{ tuning: TUNING, bars: [bar] }] }] };
}

// The pitches sounded during the first beat (a quarter note is a second at 60).
const firstBeat = track => track.notes.filter(n => n.startSeconds < 0.5).map(n => n.midi).sort((a, b) => a - b);
const G2 = { string: 6, fret: 3 };
const FULL_G = [{ string: 6, fret: 3 }, { string: 5, fret: 2 }, { string: 4, fret: 0 }, { string: 3, fret: 0 }, { string: 2, fret: 0 }, { string: 1, fret: 3 }];

console.log('Scores built by hand');

{
    const track = buildAudioTrack(scoreWith([{ chord: { name: 'G', strings: PLACEHOLDER, showDiagram: false }, notes: [G2] }]), 0);
    check('G printed over string 6, fret 3, with a hidden diagram, plays G2 alone', JSON.stringify(firstBeat(track)) === '[43]',
        JSON.stringify(firstBeat(track)));
}

{
    const track = buildAudioTrack(scoreWith([{ chord: { name: 'G', strings: G_SHAPE, showDiagram: true }, notes: [G2] }]), 0);
    check('with the G diagram shown, it still plays G2 alone', JSON.stringify(firstBeat(track)) === '[43]',
        JSON.stringify(firstBeat(track)));
}

{
    // The song strums a full G on the next beat; the thin beat is not filled in from it.
    const track = buildAudioTrack(scoreWith([
        { chord: { name: 'G', strings: [-1, -1, -1, -1, -1, -1], showDiagram: false }, notes: [G2] },
        { notes: FULL_G }
    ]), 0);
    check('a full G strummed elsewhere does not fill it in', JSON.stringify(firstBeat(track)) === '[43]',
        JSON.stringify(firstBeat(track)));
    check('and the full G plays all six strings', track.notes.length === 7, `${track.notes.length} notes`);
}

{
    const track = buildAudioTrack(scoreWith([{ chord: { name: 'C', strings: [-1, -1, -1, -1, -1, -1], showDiagram: false },
        notes: [{ string: 4, fret: 0 }, { string: 2, fret: 1 }] }]), 0);
    check('two notes under a chord name play those two', JSON.stringify(firstBeat(track)) === '[50,60]',
        JSON.stringify(firstBeat(track)));
}

// --- Song files ----------------------------------------------------------------------------------

const folders = process.argv.slice(2);
if (folders.length > 0) {
    const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
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

    const isGuitarOrBass = track => !track.isPercussion && track.playbackInfo?.program >= 24 && track.playbackInfo?.program <= 39;
    let tracks = 0, differing = 0;

    for (const file of files) {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)));
        score.tracks.forEach((track, index) => {
            if (!isGuitarOrBass(track)) return;
            tracks++;
            const staff = track.staves[0];
            const strings = staff.tuning.length;

            // Every note the track writes and would strike: not a tie's continuation, not muted.
            const written = [];
            for (const bar of staff.bars) for (const voice of bar.voices) for (const beat of voice.beats) {
                if (beat.isRest) continue;
                for (const note of beat.notes) {
                    if (note.isTieDestination || note.isDead || typeof note.realValue !== 'number') continue;
                    written.push(`${bar.index}:${strings - note.string + 1}:${note.fret}:${note.realValue}`);
                }
            }
            const played = buildAudioTrack(score, index).notes.map(n => `${n.bar}:${n.string}:${n.fret}:${n.midi}`);
            if (written.sort().join() !== played.sort().join()) differing++;
        });
    }

    check(`every guitar and bass track plays exactly its written notes (${tracks} tracks)`, differing === 0, `${differing} differ`);
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
