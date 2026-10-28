// Checks that a song lists only its guitar and bass tracks, General MIDI programs 24 to 39.
//
// Opens the song in the app and compares the track headings, the summary's Tracks row and the
// Measures and Playback regions against the file read here with alphaTab. The region of the first
// track listed is opened, to show it reaches a track that plays: in a file whose first track is not
// a guitar, its place in the list and its place in the file differ.
//
// Run: node scripts/songs/verify-guitar-bass-tracks.mjs [song file]
// The song defaults to musicfiles/Grateful Dead-Ripple-12-20-2025.gp, whose mandolin is left out.
// A file with vocals and keyboards before its guitars tests more.

import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { launchApp, openSongFile, APP_DIR, VISIBLE_PANEL } from '../lib/app-ui.mjs';

const song = process.argv[2] ?? path.join(APP_DIR, 'musicfiles', 'Grateful Dead-Ripple-12-20-2025.gp');
const bytes = new Uint8Array(await readFile(song));

const require = createRequire(path.join(APP_DIR, 'package.json'));
const alphaTab = require('@coderline/alphatab');
const score = alphaTab.importer.ScoreLoader.loadScoreFromBytes(bytes);
const listed = score.tracks.filter(track => !track.isPercussion && track.playbackInfo.program >= 24 && track.playbackInfo.program <= 39);
const others = score.tracks.length - listed.length;
console.log(`${path.basename(song)}: ${score.tracks.length} tracks, ${listed.length} guitar or bass`);
for (const track of score.tracks) console.log(`  ${track.name} (program ${track.playbackInfo.program}${track.isPercussion ? ', percussion' : ''})`);

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const { app, page, close } = await launchApp();
await openSongFile(app, path.basename(song), bytes);
await page.waitForSelector(`${VISIBLE_PANEL} h2`, { timeout: 15000 });

const seen = await page.evaluate(panelSelector => {
    const panel = document.querySelector(panelSelector);
    return {
        headings: [...panel.querySelectorAll('h2')].map(h => h.textContent).filter(t => t !== 'Song Summary'),
        tracksHeading: [...panel.querySelectorAll('h2, h3')].map(h => h.textContent).find(t => /^Tracks/.test(t)),
        summaryRow: [...panel.querySelectorAll('li')].map(li => li.textContent).find(t => /^Tracks/.test(t)),
        regions: [...panel.querySelectorAll('details.track-region > summary')].map(s => s.textContent),
        status: document.querySelector('[role="status"]')?.textContent ?? ''
    };
}, VISIBLE_PANEL);

console.log('\n=== Tracks listed ===');
const expected = listed.map((track, i) => `Track ${i + 1} - ${track.name || '(untitled track)'}`);
check('the track headings are the guitar and bass tracks, numbered in the list', JSON.stringify(seen.headings) === JSON.stringify(expected),
    seen.headings.join(' | '));
// The tracks are h2 beside Song Summary, the count being the summary's last row.
check('there is no Tracks heading', seen.tracksHeading === undefined, seen.tracksHeading);
check('the summary row says how many were left out', others === 0
    ? seen.summaryRow?.endsWith(String(listed.length))
    : new RegExp(`${listed.length} guitar and bass; ${others} others? (is|are) not listed`).test(seen.summaryRow ?? ''), seen.summaryRow);
check('each listed track has its Measures and Playback region', seen.regions.length === listed.length &&
    seen.regions.every(text => text.startsWith('Measures and Playback - ')), seen.regions.join(' | '));
check('the status line counts guitar and bass tracks', new RegExp(`Found ${listed.length} guitar and bass tracks?`).test(seen.status), seen.status);

console.log('\n=== The first listed track plays ===');
const audio = await page.evaluate(async panelSelector => {
    const details = document.querySelector(`${panelSelector} details.track-region`);
    if (!details) return null;
    details.open = true;
    for (let i = 0; i < 50 && details.children.length < 2; i++) await new Promise(r => setTimeout(r, 100));
    return details.textContent;
}, VISIBLE_PANEL);
check('its region builds', audio !== null && audio.length > 0);
check('it has notes to play', audio !== null && !/no playable notes/.test(audio), (audio ?? '').slice(0, 120));

console.log(failures === 0 ? '\nALL CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
await close();
process.exit(failures === 0 ? 0 : 1);
