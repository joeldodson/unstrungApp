// Checks the key Song Summary names from a file's key signature: "A minor" where the file marks the
// key minor, the major key alone, "C", where it does not. See `keySignatureName` in
// src/shared/scoreMetadata.mjs.
//
// Until 2026-11-11 the mode was not read, so a progression unstrung saved in A minor, opened as a
// song, read "Key signature - C", and E minor read G. Finding 8 of the November review.
//
// The first part writes a progression in every key unstrung offers, as Save would, reads it back as
// a song, and checks the name; then alphaTex written here, for the keys unstrung does not offer and
// for a change of mode. Given folders, it reads every Guitar Pro file under them and checks that
// none is named differently from before unless it is marked minor.
//
//   node scripts/songs/check-key-names.mjs [folder ...]

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';
import { songFromProgression, songToAlphaTex } from '../../src/shared/songScore.mjs';
import { KEY_ROOTS } from '../../src/shared/chordProgressions.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);
const library = JSON.parse(fs.readFileSync(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), 'utf8'));

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};

function importAlphaTex(text) {
    const importer = new alphaTab.importer.AlphaTexImporter();
    importer.initFromString(text, new alphaTab.Settings());
    return importer.readScore();
}

// The name the old code gave: the major key with that many sharps or flats, whatever the mode.
const MAJOR_NAMES = ['Cb', 'Gb', 'Db', 'Ab', 'Eb', 'Bb', 'F', 'C', 'G', 'D', 'A', 'E', 'B', 'F#', 'C#'];

// --- Progressions saved by unstrung -----------------------------------------------------------------

console.log('A progression in every key unstrung offers, saved and opened as a song');
{
    const wrong = [];
    let count = 0;
    for (const mode of ['major', 'minor']) {
        for (const key of KEY_ROOTS) {
            // One measure of the key's own chord is enough: only the key signature is read here.
            const progression = { key, mode, beatsPerBar: 4, beatUnit: 4, chords: [{ root: key, suffix: mode }] };
            const { text } = songToAlphaTex(songFromProgression(progression, { library, title: `${key} ${mode}` }));
            const { keySignature, keySignatureVaries } = extractScoreMetadata(importAlphaTex(text));
            const expected = mode === 'minor' ? `${key} minor` : key;
            count++;
            if (keySignature !== expected || keySignatureVaries) wrong.push(`${key} ${mode} read "${keySignature}"`);
        }
    }
    check(`all ${count} are named by their own key and mode`, wrong.length === 0, wrong.join('; '));
}

{
    const { text } = songToAlphaTex(songFromProgression(
        { key: 'A', mode: 'minor', beatsPerBar: 4, beatUnit: 4, chords: [{ root: 'A', suffix: 'minor' }] }, { library }));
    const { keySignature } = extractScoreMetadata(importAlphaTex(text));
    check('the review\'s example, A minor, reads "A minor", not "C"', keySignature === 'A minor', keySignature);
}

// --- alphaTex written here ---------------------------------------------------------------------------

console.log('\nKey signatures written in alphaTex');
for (const [ks, expected] of [
    ['c', 'C'], ['g', 'G'], ['f', 'F'], ['eminor', 'E minor'], ['dminor', 'D minor'],
    // Minor keys unstrung does not offer, at the ends of the circle.
    ['abminor', 'Ab minor'], ['g#minor', 'G# minor'], ['d#minor', 'D# minor'], ['a#minor', 'A# minor']
]) {
    const { keySignature } = extractScoreMetadata(importAlphaTex(`\\ks ${ks}\n.\n0.6.1\n`));
    check(`\\ks ${ks} reads "${expected}"`, keySignature === expected, keySignature);
}

{
    const { keySignature, keySignatureVaries } = extractScoreMetadata(importAlphaTex('\\ks c\n.\n0.6.1 | \\ks aminor 0.6.1\n'));
    check('C major into A minor, the same signature, is a change of key', keySignature === 'C' && keySignatureVaries,
        `${keySignature}, varies ${keySignatureVaries}`);
}
{
    const { keySignatureVaries } = extractScoreMetadata(importAlphaTex('\\ks aminor\n.\n0.6.1 | 0.6.1\n'));
    check('A minor throughout does not change', keySignatureVaries === false, String(keySignatureVaries));
}

console.log('\nMusicXML');
{
    const musicXml = mode => `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Guitar</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>1</fifths><mode>${mode}</mode></key>
<time><beats>4</beats><beat-type>4</beat-type></time></attributes>
<note><pitch><step>E</step><octave>3</octave></pitch><duration>4</duration><type>whole</type></note></measure></part></score-partwise>`;
    for (const [mode, expected] of [['minor', 'E minor'], ['major', 'G']]) {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(musicXml(mode)));
        const { keySignature } = extractScoreMetadata(score);
        check(`one sharp, mode ${mode}, reads "${expected}"`, keySignature === expected, keySignature);
    }
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

    let minor = 0;
    const changed = [];
    for (const [fileIndex, file] of files.entries()) {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)));
        const first = score.masterBars[0];
        if (first.keySignatureType === 1) { minor++; continue; }
        const before = MAJOR_NAMES[first.keySignature + 7];
        const { keySignature } = extractScoreMetadata(score);
        // Files are numbered rather than named: the song files are not part of the repository.
        if (keySignature !== before) changed.push(`file ${fileIndex + 1}: "${before}" now "${keySignature}"`);
    }
    console.log(`  marked minor: ${minor}`);
    check('every file marked major is named as before', changed.length === 0, changed.join('; '));
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
