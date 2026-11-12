// Checks which tracks a song lists: the guitars and basses by their MIDI program, 24 to 39, and a
// MusicXML part that names no instrument but is written as tablature. See `isGuitarOrBass` and
// `isUnnamedTablature` in src/shared/scoreMetadata.mjs.
//
// Until 2026-11-11 a MusicXML part with no MIDI instrument, which alphaTab gives program 0, was not
// listed even as six-string tablature, so the file said it had no guitar or bass tracks. Finding 12
// of the November review.
//
// The first part reads MusicXML written here. Given folders, it reads every Guitar Pro file under
// them and checks that the same tracks are listed as by program alone.
//
//   node scripts/songs/check-track-listing.mjs [folder ...]

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { extractScoreMetadata } from '../../src/shared/scoreMetadata.mjs';
import { buildAudioTrack } from '../../src/shared/audioTrack.mjs';

const root = path.join(import.meta.dirname, '..', '..');
const alphaTab = await import(pathToFileURL(path.join(root, 'node_modules', '@coderline', 'alphatab', 'dist', 'alphaTab.mjs')).href);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${condition ? '' : `  -- ${detail}`}`);
};
const load = text => alphaTab.importer.ScoreLoader.loadScoreFromBytes(new TextEncoder().encode(text));

const TAB_ATTRIBUTES = `<clef><sign>TAB</sign><line>5</line></clef><staff-details><staff-lines>6</staff-lines>
${['E2', 'A2', 'D3', 'G3', 'B3', 'E4'].map(([step, octave], i) =>
        `<staff-tuning line="${i + 1}"><tuning-step>${step}</tuning-step><tuning-octave>${octave}</tuning-octave></staff-tuning>`).join('')}
</staff-details>`;
const TREBLE = '<clef><sign>G</sign><line>2</line></clef>';
const TAB_NOTE = '<note><pitch><step>E</step><octave>2</octave></pitch><duration>4</duration><type>whole</type>' +
    '<notations><technical><string>6</string><fret>0</fret></technical></notations></note>';
const PITCH_NOTE = '<note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>whole</type></note>';

/** A MusicXML file of parts that name no instrument: [name, attributes, note] each. */
function musicXml(parts) {
    return `<?xml version="1.0" encoding="UTF-8"?>
<score-partwise version="3.1"><part-list>
${parts.map(([name], i) => `<score-part id="P${i + 1}"><part-name>${name}</part-name></score-part>`).join('\n')}
</part-list>
${parts.map(([, attributes, note], i) => `<part id="P${i + 1}"><measure number="1"><attributes><divisions>1</divisions>
<time><beats>4</beats><beat-type>4</beat-type></time>${attributes}</attributes>${note}</measure></part>`).join('\n')}
</score-partwise>`;
}

console.log('MusicXML whose parts name no instrument: voice, six-string tablature, piano');
{
    const score = load(musicXml([['Voice', TREBLE, PITCH_NOTE], ['Guitar', TAB_ATTRIBUTES, TAB_NOTE], ['Piano', TREBLE, PITCH_NOTE]]));
    const meta = extractScoreMetadata(score, { musicXml: true });
    check('the tablature part is listed, and only it', meta.tracks.map(t => t.name).join() === 'Guitar', meta.tracks.map(t => t.name).join());
    check('the other two are counted as not listed', meta.otherTrackCount === 2, String(meta.otherTrackCount));
    check('its instrument line says the file names none',
        meta.tracks[0]?.instrument === 'none named in the file; listed as a guitar for its tablature', meta.tracks[0]?.instrument);
    const audio = buildAudioTrack(score, meta.tracks[0].index);
    check('it plays its note: E2, string 6, fret 0',
        audio.notes.length === 1 && audio.notes[0].midi === 40 && audio.notes[0].string === 6 && audio.notes[0].fret === 0,
        JSON.stringify(audio.notes.map(({ midi, string, fret }) => ({ midi, string, fret }))));
}

console.log('\nMusicXML with no tablature at all');
{
    const meta = extractScoreMetadata(load(musicXml([['Melody', TREBLE, PITCH_NOTE]])), { musicXml: true });
    check('a part in standard notation naming no instrument is still not listed', meta.tracks.length === 0 && meta.otherTrackCount === 1,
        `${meta.tracks.length} listed, ${meta.otherTrackCount} not`);
}

console.log('\nThe same parts, not marked as MusicXML');
{
    // As a Guitar Pro file's program 0 is read: a piano someone chose, tablature or not.
    const meta = extractScoreMetadata(load(musicXml([['Guitar', TAB_ATTRIBUTES, TAB_NOTE]])));
    check('program 0 with tablature is not listed', meta.tracks.length === 0, meta.tracks.map(t => t.name).join());
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
    const changed = [];
    let listed = 0;
    for (const [fileIndex, file] of files.entries()) {
        const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(new Uint8Array(fs.readFileSync(file)));
        const byProgram = score.tracks
            .filter(t => t.isPercussion !== true && t.playbackInfo.program >= 24 && t.playbackInfo.program <= 39)
            .map(t => t.index).join();
        const now = extractScoreMetadata(score).tracks.map(t => t.index).join();
        listed += now === '' ? 0 : now.split(',').length;
        // Files are numbered rather than named: the song files are not part of the repository.
        if (now !== byProgram) changed.push(`file ${fileIndex + 1}: ${byProgram} by program, now ${now}`);
    }
    console.log(`  tracks listed: ${listed}`);
    check('every file lists the same tracks as by program alone', changed.length === 0, changed.join('; '));
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exitCode = failures === 0 ? 0 : 1;
