// Runs the Node checks: every scripts/**/check-*.mjs and scripts/gp-experiment/verify-synthetic-score.mjs.
// None of them starts the app or a browser, and without folders none reads a song file.
//
//   npm test                          the checks that need no song files
//   npm run test:songs -- <folder>    all of them, the song checks reading every Guitar Pro file
//                                     under the folders given
//
// Prints one line per script and a total, with the FAIL lines of any script that failed, and exits
// non-zero if any failed. The checks that drive the app or a browser are listed in docs/checks.md.

import { spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

const root = path.join(import.meta.dirname, '..');

// Checks that read song files from folders given as arguments. The first group still checks
// something without them; the second has nothing to check without them and is skipped.
const TAKES_FOLDERS = new Set([
    'scripts/songs/check-key-names.mjs',
    'scripts/songs/check-pickup-clicks.mjs',
    'scripts/songs/check-plays-as-written.mjs',
    'scripts/songs/check-track-listing.mjs',
    'scripts/songs/check-triplet-feel.mjs',
]);
const NEEDS_FOLDERS = new Set([
    'scripts/gp-experiment/check-section-promotion.mjs',
    'scripts/progressions/check-first-sounding-bar.mjs',
]);

const args = process.argv.slice(2);
const songsMode = args.includes('--songs');
const folders = args.filter(arg => arg !== '--songs').map(folder => path.resolve(folder));
if (songsMode && folders.length === 0) {
    console.error('Give one or more folders of song files: npm run test:songs -- <folder>');
    process.exit(2);
}
for (const folder of folders) {
    if (!fs.existsSync(folder) || !fs.statSync(folder).isDirectory()) {
        console.error(`Not a folder: ${folder}`);
        process.exit(2);
    }
}

function findChecks(dir, out = []) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name !== 'node_modules') findChecks(full, out);
        } else if (/^check-.*\.mjs$/.test(entry.name)) {
            out.push(path.relative(root, full).split(path.sep).join('/'));
        }
    }
    return out;
}

const scripts = [...findChecks(path.join(root, 'scripts')), 'scripts/gp-experiment/verify-synthetic-score.mjs']
    .sort((a, b) => a.localeCompare(b));

function run(script, scriptArgs) {
    return new Promise(resolve => {
        const started = performance.now();
        const child = spawn(process.execPath, [script, ...scriptArgs], { cwd: root });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk; });
        child.stderr.on('data', chunk => { output += chunk; });
        child.on('error', error => {
            resolve({ code: 1, output: `${output}\n${error.message}`, seconds: (performance.now() - started) / 1000 });
        });
        child.on('close', code => {
            resolve({ code: code ?? 1, output, seconds: (performance.now() - started) / 1000 });
        });
    });
}

// Run several at once, but report in order.
const limit = Math.max(1, Math.min(os.availableParallelism(), 8));
let next = 0;
const results = new Array(scripts.length);
const done = scripts.map(() => {
    let settle;
    const promise = new Promise(resolve => { settle = resolve; });
    return { promise, settle };
});

function plan(script) {
    const withFolders = TAKES_FOLDERS.has(script) || NEEDS_FOLDERS.has(script);
    if (NEEDS_FOLDERS.has(script) && folders.length === 0) return null;
    return withFolders ? folders : [];
}

async function worker() {
    while (next < scripts.length) {
        const index = next++;
        const scriptArgs = plan(scripts[index]);
        results[index] = scriptArgs === null ? { skipped: true } : await run(scripts[index], scriptArgs);
        done[index].settle();
    }
}

const started = performance.now();
const workers = Array.from({ length: limit }, worker);

let passed = 0;
let failed = 0;
let skipped = 0;
for (const [index, script] of scripts.entries()) {
    await done[index].promise;
    const result = results[index];
    if (result.skipped) {
        skipped++;
        console.log(`skip  ${script}  (needs song files: npm run test:songs -- <folder>)`);
        continue;
    }
    const time = `${result.seconds.toFixed(1)}s`;
    if (result.code === 0) {
        passed++;
        console.log(`ok    ${script}  ${time}`);
        continue;
    }
    failed++;
    console.log(`FAIL  ${script}  ${time}, exit code ${result.code}`);
    const lines = result.output.split(/\r?\n/);
    const failLines = lines.filter(line => /\bFAIL\b/.test(line));
    for (const line of (failLines.length > 0 ? failLines : lines.filter(Boolean).slice(-15))) {
        console.log(`      ${line.trim()}`);
    }
}
await Promise.all(workers);

const seconds = ((performance.now() - started) / 1000).toFixed(1);
const parts = [`${passed} passed`, `${failed} failed`];
if (skipped > 0) parts.push(`${skipped} skipped`);
console.log(`\n${scripts.length} scripts: ${parts.join(', ')}, in ${seconds}s.`);
process.exitCode = failed === 0 ? 0 : 1;
