'use strict';

// Rasterizes the logo in scripts/logo-art.js into every PNG the Microsoft Store /
// appx target needs, plus an .ico for the desktop build. Run with Electron, not node:
//
//   npm run build:icons
//
// Electron is used purely as an SVG rasterizer (offscreen BrowserWindow ->
// capturePage -> nativeImage.resize), so this adds no dependency the project did not
// already have. Every output is downscaled from a render several times its size
// rather than rendered at its final size, which keeps the edges clean.
//
// The script prints a coverage table instead of expecting anyone to look at the
// output: for each file it reports what share of pixels resolve to the cane, to the
// guitar, and to the background. That is the check that the cane has not been scaled
// out of existence at 16px, and it is verifiable without seeing the image.

const { app, BrowserWindow } = require('electron');
const fs = require('fs');
const path = require('path');
const { palette, squareSvg, wideSvg } = require('./logo-art.js');

const projectRoot = path.join(__dirname, '..');
const appxDir = path.join(projectRoot, 'build', 'appx');
const logoDir = path.join(projectRoot, 'build', 'logo');

// Below this many pixels the detailed artwork turns to mush, so the simplified
// variant is used instead. See logo-art.js.
const SMALL_ART_CUTOFF = 128;

// A single offscreen window is created once and reused, resized between renders.
// Creating a second offscreen BrowserWindow in the same process does not work here:
// the second one starts loading and never finishes, so loadFile rejects with
// ERR_FAILED. Reusing one window avoids that entirely.
function createRenderWindow() {
  return new BrowserWindow({
    width: 800,
    height: 800,
    useContentSize: true,
    show: false,
    frame: false,
    webPreferences: { offscreen: true, backgroundThrottling: false },
  });
}

async function render(win, svg, width, height) {
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>
    html,body{margin:0;padding:0;overflow:hidden;background:${palette.plate}}
    svg{display:block;width:100vw;height:100vh}
  </style></head><body>${svg}</body></html>`;

  // The markup goes through a file rather than a data: URL, because Chromium refuses
  // to navigate to a data: URL this long.
  const page = path.join(logoDir, 'render-scratch.html');
  fs.writeFileSync(page, html, 'utf8');

  try {
    win.setContentSize(width, height);
    await win.loadFile(page);
    // Offscreen windows paint on their own schedule; wait for a frame before
    // capturing so the capture is never of an unpainted surface.
    await new Promise(resolve => {
      const timer = setTimeout(resolve, 4000);
      win.webContents.once('paint', () => {
        clearTimeout(timer);
        setTimeout(resolve, 60);
      });
    });
    const image = await win.webContents.capturePage();
    const size = image.getSize();
    if (size.width !== width || size.height !== height) {
      throw new Error(`rendered ${size.width}x${size.height}, expected ${width}x${height}`);
    }
    return image;
  } finally {
    fs.rmSync(page, { force: true });
  }
}

// Buckets every pixel to the nearest colour in the palette, then reports the share by
// role. Antialiased pixels land in whichever bucket they are closest to, which is what
// we want: a cane that has blurred halfway into the background stops counting.
const ROLES = {
  plate: ['plate', 'soundhole'],
  guitar: ['binding', 'bodyTop', 'neck', 'fretboard', 'headstock', 'hardware', 'rosette', 'bridge', 'fret'],
  cane: ['caneWhite', 'caneRed'],
};

const SWATCHES = Object.entries(palette).map(([name, hex]) => {
  const role = Object.keys(ROLES).find(r => ROLES[r].includes(name));
  return {
    role,
    r: parseInt(hex.slice(1, 3), 16),
    g: parseInt(hex.slice(3, 5), 16),
    b: parseInt(hex.slice(5, 7), 16),
  };
});

function coverage(image) {
  const bitmap = image.toBitmap(); // BGRA
  const counts = { plate: 0, guitar: 0, cane: 0 };
  for (let i = 0; i < bitmap.length; i += 4) {
    const b = bitmap[i];
    const g = bitmap[i + 1];
    const r = bitmap[i + 2];
    let best = null;
    let bestDistance = Infinity;
    for (const s of SWATCHES) {
      const d = (s.r - r) ** 2 + (s.g - g) ** 2 + (s.b - b) ** 2;
      if (d < bestDistance) {
        bestDistance = d;
        best = s.role;
      }
    }
    counts[best] += 1;
  }
  const total = bitmap.length / 4;
  return {
    plate: (counts.plate / total) * 100,
    guitar: (counts.guitar / total) * 100,
    cane: (counts.cane / total) * 100,
  };
}

function relativeLuminance(hex) {
  const channel = value => {
    const c = parseInt(value, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * channel(hex.slice(1, 3)) +
    0.7152 * channel(hex.slice(3, 5)) +
    0.0722 * channel(hex.slice(5, 7))
  );
}

function contrast(a, b) {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// ICO is a directory of embedded PNGs: a 6 byte header, then one 16 byte entry per
// image, then the PNG payloads. A width or height of 256 is stored as 0.
function buildIco(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  const directory = Buffer.alloc(16 * entries.length);
  let offset = header.length + directory.length;
  entries.forEach((entry, index) => {
    const at = index * 16;
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, at);
    directory.writeUInt8(entry.size >= 256 ? 0 : entry.size, at + 1);
    directory.writeUInt8(0, at + 2);
    directory.writeUInt8(0, at + 3);
    directory.writeUInt16LE(1, at + 4);
    directory.writeUInt16LE(32, at + 6);
    directory.writeUInt32LE(entry.png.length, at + 8);
    directory.writeUInt32LE(offset, at + 12);
    offset += entry.png.length;
  });

  return Buffer.concat([header, directory, ...entries.map(entry => entry.png)]);
}

async function main() {
  fs.mkdirSync(appxDir, { recursive: true });
  fs.mkdirSync(logoDir, { recursive: true });

  fs.writeFileSync(path.join(logoDir, 'unstrung-logo.svg'), squareSvg(true), 'utf8');
  fs.writeFileSync(path.join(logoDir, 'unstrung-logo-small.svg'), squareSvg(false), 'utf8');
  fs.writeFileSync(path.join(logoDir, 'unstrung-logo-wide.svg'), wideSvg(), 'utf8');

  const win = createRenderWindow();
  let sources;
  try {
    sources = {
      small: await render(win, squareSvg(false), 800, 800),
      detail: await render(win, squareSvg(true), 1240, 1240),
      wide: await render(win, wideSvg(), 1240, 600),
    };
  } finally {
    win.destroy();
  }

  // Which drawing each asset uses is stated per asset rather than derived from the
  // pixel count, because a scale-200 variant must use the same drawing as the asset it
  // is a variant of. SmallTile is 71pt whether it is rendered at 71px or 142px, so
  // both use the simplified art; picking by pixel count would give the same tile two
  // different drawings depending on the display.
  const outputs = [
    ['Square44x44Logo.png', 44, 44, 'small', appxDir],
    ['Square44x44Logo.scale-200.png', 88, 88, 'small', appxDir],
    // targetsize variants are unplated icons at a literal pixel size, not scale
    // variants of the 44pt tile, so each one picks the drawing that suits its size.
    ['Square44x44Logo.targetsize-16.png', 16, 16, 'small', appxDir],
    ['Square44x44Logo.targetsize-24.png', 24, 24, 'small', appxDir],
    ['Square44x44Logo.targetsize-32.png', 32, 32, 'small', appxDir],
    ['Square44x44Logo.targetsize-48.png', 48, 48, 'small', appxDir],
    ['Square44x44Logo.targetsize-256.png', 256, 256, 'detail', appxDir],
    ['StoreLogo.png', 50, 50, 'small', appxDir],
    ['StoreLogo.scale-200.png', 100, 100, 'small', appxDir],
    ['SmallTile.png', 71, 71, 'small', appxDir],
    ['SmallTile.scale-200.png', 142, 142, 'small', appxDir],
    ['Square150x150Logo.png', 150, 150, 'detail', appxDir],
    ['Square150x150Logo.scale-200.png', 300, 300, 'detail', appxDir],
    ['LargeTile.png', 310, 310, 'detail', appxDir],
    ['LargeTile.scale-200.png', 620, 620, 'detail', appxDir],
    ['Wide310x150Logo.png', 310, 150, 'wide', appxDir],
    ['Wide310x150Logo.scale-200.png', 620, 300, 'wide', appxDir],
    // Not part of the package: the Store listing artwork, and a master to hand to
    // anyone who needs to work with the logo outside this repo.
    ['unstrung-store-300.png', 300, 300, 'detail', logoDir],
    ['unstrung-logo-1024.png', 1024, 1024, 'detail', logoDir],
  ];

  const rows = [];
  for (const [name, width, height, art, dir] of outputs) {
    const source = sources[art];
    const image = source.resize({ width, height, quality: 'best' });
    fs.writeFileSync(path.join(dir, name), image.toPNG());
    const actual = image.getSize();
    rows.push({
      name,
      expected: `${width}x${height}`,
      actual: `${actual.width}x${actual.height}`,
      art,
      ...coverage(image),
    });
  }

  const icoSizes = [16, 24, 32, 48, 64, 128, 256];
  const ico = buildIco(
    icoSizes.map(size => ({
      size,
      png: (size <= SMALL_ART_CUTOFF ? sources.small : sources.detail)
        .resize({ width: size, height: size, quality: 'best' })
        .toPNG(),
    }))
  );
  fs.writeFileSync(path.join(projectRoot, 'build', 'icon.ico'), ico);

  console.log('file                                  expected   actual     art     cane%  guitar%   plate%');
  for (const row of rows) {
    console.log(
      row.name.padEnd(38) +
        row.expected.padEnd(11) +
        row.actual.padEnd(11) +
        row.art.padEnd(8) +
        row.cane.toFixed(2).padStart(5) +
        row.guitar.toFixed(2).padStart(9) +
        row.plate.toFixed(2).padStart(9)
    );
  }
  console.log(`\nbuild/icon.ico: ${icoSizes.join(', ')} px, ${ico.length} bytes`);
  console.log('\ncontrast ratios');
  console.log(`  cane on guitar body, no halo: ${contrast(palette.caneWhite, palette.bodyTop).toFixed(2)}:1`);
  console.log(`  cane on halo / plate:         ${contrast(palette.caneWhite, palette.plate).toFixed(2)}:1`);
  console.log(`  guitar body on halo / plate:  ${contrast(palette.bodyTop, palette.plate).toFixed(2)}:1`);
  console.log(`  red band on halo / plate:     ${contrast(palette.caneRed, palette.plate).toFixed(2)}:1`);
}

// Without this the capture comes back multiplied by the display's scale factor (a
// 125% display renders an 800px window as 1003px), which would bake the machine that
// happened to run the build into the output.
app.commandLine.appendSwitch('force-device-scale-factor', '1');
app.disableHardwareAcceleration();
app
  .whenReady()
  .then(main)
  .then(() => app.exit(0))
  .catch(error => {
    console.error(error);
    app.exit(1);
  });
