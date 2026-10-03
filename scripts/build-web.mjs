// Builds the web version of Unstrung into dist-web, ready to be served from any folder.
//
//   npm run build:web
//
// That runs scripts/build-web-audio.mjs first, which writes dist-web/audio. This adds:
//   index.html, styles.css, images/, fonts/   the page, unchanged from src/renderer
//   bundle.js                                 src/web/main.js: the browser's window.unstrung,
//                                             then the same renderer the desktop app runs
//   chord-library.json                        the chord library, which the desktop app reads
//                                             through its main process
// and then packs the folder as release/Unstrung-web-<version>.tar.gz, which is attached to each
// GitHub release. eyesunstrung.vip's workflow unpacks the latest one at /unstrung/app/.
//
// Every URL in the page is relative, so it works under a folder as well as at a site's root. It
// cannot be opened from disk: browsers will not fetch files from a page opened that way. Use
// npm run serve:web to try it.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import * as esbuild from 'esbuild';

const root = path.join(import.meta.dirname, '..');
const out = path.join(root, 'dist-web');
const renderer = path.join(root, 'src', 'renderer');
const { version } = JSON.parse(await fs.readFile(path.join(root, 'package.json'), 'utf8'));

// The font is copied into src/renderer/fonts from node_modules, as for the desktop build.
execFileSync(process.execPath, [path.join(root, 'scripts', 'copy-font.mjs')], { stdio: 'inherit' });

// Everything but the audio is rebuilt from scratch, so nothing stale is left behind.
for (const entry of await fs.readdir(out).catch(() => [])) {
    if (entry !== 'audio') await fs.rm(path.join(out, entry), { recursive: true, force: true });
}

await esbuild.build({
    entryPoints: [path.join(root, 'src', 'web', 'main.js')],
    bundle: true,
    outfile: path.join(out, 'bundle.js'),
    platform: 'browser',
    format: 'iife',
    define: { __UNSTRUNG_VERSION__: JSON.stringify(version) },
    logLevel: 'warning'
});

for (const name of ['index.html', 'styles.css']) {
    await fs.copyFile(path.join(renderer, name), path.join(out, name));
}
for (const name of ['images', 'fonts']) {
    await fs.cp(path.join(renderer, name), path.join(out, name), { recursive: true });
}
await fs.copyFile(path.join(root, 'src', 'assets', 'chords', 'chord-library.json'), path.join(out, 'chord-library.json'));

// The release asset. tar is part of Windows 10 and later, macOS and Linux.
const archive = path.join(root, 'release', `Unstrung-web-${version}.tar.gz`);
await fs.mkdir(path.dirname(archive), { recursive: true });
execFileSync('tar', ['-czf', archive, '-C', out, '.']);

const { size } = await fs.stat(archive);
console.log(`=== web build ===`);
console.log(`version:  ${version}`);
console.log(`output:   ${path.relative(root, out)}`);
console.log(`archive:  ${path.relative(root, archive)} (${(size / 1024 / 1024).toFixed(1)} MB)`);
