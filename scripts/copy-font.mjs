// Copies the Atkinson Hyperlegible Next font and its licence from node_modules into
// src/renderer/fonts, where styles.css loads it. Run as part of build:renderer.
//
// The same font and the same npm package are used by eyesunstrung.vip, so the app and
// the site look alike. SIL Open Font License 1.1: the licence must ship with the font.
// src/renderer/fonts is generated, and gitignored like bundle.js.

import fs from 'node:fs';
import path from 'node:path';

const root = path.join(import.meta.dirname, '..');
const pkg = path.join(root, 'node_modules', '@fontsource-variable', 'atkinson-hyperlegible-next');
const out = path.join(root, 'src', 'renderer', 'fonts');

fs.mkdirSync(out, { recursive: true });
fs.copyFileSync(
    path.join(pkg, 'files', 'atkinson-hyperlegible-next-latin-wght-normal.woff2'),
    path.join(out, 'atkinson-hyperlegible-next-latin.woff2'),
);
fs.copyFileSync(path.join(pkg, 'LICENSE'), path.join(out, 'OFL.txt'));
