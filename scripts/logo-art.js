'use strict';

// Source geometry for the Unstrung logo. Everything is authored in a 1000x1000
// coordinate space and rasterized from SVG by scripts/build-icons.js; nothing here
// is hand-tuned against a rendered image, so the numbers below are the design.
//
// Subject: a guitar lying on its side (headstock left, body right, seen face-on) with
// no strings between the nut and the bridge, and a folded white cane lying across the
// front of its lower bout.
//
// Two variants exist because detail that helps at 150px is mud at 44px:
//   detailArt() -- frets, tuning pegs, rosette, bridge pins, a four-segment cane
//   smallArt()  -- the same silhouette with those dropped and the cane as one bar
// build-icons.js picks smallArt for outputs <= 128px.

const palette = {
  plate: '#171210', // background; also the halo colour that separates cane from body
  binding: '#F0DCBC', // cream rim around the body silhouette
  bodyTop: '#D79A52', // amber soundboard
  neck: '#8A5A33',
  fretboard: '#43291A',
  headstock: '#6B4525',
  hardware: '#E4DCCC', // nut, tuning pegs, bridge pins
  soundhole: '#120E0C',
  rosette: '#B07C3E',
  bridge: '#4A2F1C',
  fret: '#C9B79A',
  caneWhite: '#F6F5F2',
  caneRed: '#C0342E',
};

// Scales the drawing to ~88% and recentres it so the ink sits in the middle of the
// canvas with even margins (the raw geometry runs x 36..920, y 308..783).
const ART_TRANSFORM =
  'translate(500,500) scale(0.88) translate(-500,-500) translate(22,-45)';

// The body is the union of three ellipses: upper bout, waist, lower bout. Drawing the
// union as one path would mean hand-solving the intersections, so instead it is drawn
// twice -- once oversized in the binding colour, once at true size in the top colour.
// The second pass covers the seams where the ellipses cross, leaving a clean rim.
const BODY_ELLIPSES = [
  { cx: 545, cy: 500, rx: 118, ry: 152 },
  { cx: 648, cy: 500, rx: 72, ry: 120 },
  { cx: 772, cy: 500, rx: 148, ry: 192 },
];

function bodyShape(bindingWidth) {
  const outer = BODY_ELLIPSES.map(
    e => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx + bindingWidth}" ry="${e.ry + bindingWidth}"/>`
  ).join('');
  const inner = BODY_ELLIPSES.map(
    e => `<ellipse cx="${e.cx}" cy="${e.cy}" rx="${e.rx}" ry="${e.ry}"/>`
  ).join('');
  return `<g fill="${palette.binding}">${outer}</g><g fill="${palette.bodyTop}">${inner}</g>`;
}

// The cane is a bundle of parallel capsules. Every capsule gets a halo in the plate
// colour drawn underneath the whole bundle, so the gaps between segments stay dark and
// the bundle keeps a dark edge where it crosses the amber body. Halo 4 units per side
// against an 8 unit gap means the gaps fill in exactly.
function cane(offsets, thickness, redFraction, halo) {
  const x = 240;
  const width = 520;
  const half = thickness / 2;
  const redWidth = Math.round(width * redFraction);

  const halos = offsets
    .map(
      off =>
        `<rect x="${x - halo}" y="${690 + off - half - halo}" width="${width + halo * 2}" height="${thickness + halo * 2}" rx="${half + halo}"/>`
    )
    .join('');
  const rods = offsets
    .map(
      off =>
        `<rect x="${x}" y="${690 + off - half}" width="${width}" height="${thickness}" rx="${half}"/>`
    )
    .join('');
  const reds = offsets
    .map(
      off =>
        `<rect x="${x}" y="${690 + off - half}" width="${redWidth}" height="${thickness}" rx="${half}"/>`
    )
    .join('');

  return (
    `<g transform="rotate(-9 500 690)">` +
    `<g fill="${palette.plate}">${halos}</g>` +
    `<g fill="${palette.caneWhite}">${rods}</g>` +
    `<g fill="${palette.caneRed}">${reds}</g>` +
    `</g>`
  );
}

function detailArt() {
  const pegs = [62, 96, 130]
    .flatMap(cx => [440, 560].map(cy => `<circle cx="${cx}" cy="${cy}" r="14"/>`))
    .join('');
  const frets = [195, 240, 283, 323, 360, 394]
    .map(x => `<line x1="${x}" y1="458" x2="${x}" y2="542"/>`)
    .join('');
  const pins = [478, 487, 496, 505, 514, 523]
    .map(cy => `<circle cx="840" cy="${cy}" r="6"/>`)
    .join('');

  return `<g transform="${ART_TRANSFORM}">
  <rect x="36" y="418" width="116" height="164" rx="20" fill="${palette.headstock}"/>
  <g fill="${palette.hardware}">${pegs}</g>
  <rect x="120" y="452" width="315" height="96" fill="${palette.neck}"/>
  <rect x="150" y="458" width="285" height="84" fill="${palette.fretboard}"/>
  <g stroke="${palette.fret}" stroke-width="5">${frets}</g>
  <rect x="150" y="448" width="14" height="104" fill="${palette.hardware}"/>
  ${bodyShape(8)}
  <circle cx="628" cy="500" r="60" fill="${palette.soundhole}"/>
  <circle cx="628" cy="500" r="72" fill="none" stroke="${palette.rosette}" stroke-width="7"/>
  <rect x="800" y="462" width="80" height="76" rx="10" fill="${palette.bridge}"/>
  <g fill="${palette.hardware}">${pins}</g>
  ${cane([-39, -13, 13, 39], 18, 0.22, 4)}
</g>`;
}

function smallArt() {
  return `<g transform="${ART_TRANSFORM}">
  <rect x="36" y="418" width="116" height="164" rx="20" fill="${palette.headstock}"/>
  <rect x="120" y="452" width="315" height="96" fill="${palette.neck}"/>
  <rect x="150" y="458" width="285" height="84" fill="${palette.fretboard}"/>
  ${bodyShape(14)}
  <circle cx="628" cy="500" r="60" fill="${palette.soundhole}"/>
  <rect x="800" y="462" width="80" height="76" rx="10" fill="${palette.bridge}"/>
  ${cane([0], 92, 0.25, 8)}
</g>`;
}

function svgDocument(viewBoxWidth, viewBoxHeight, content) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewBoxWidth} ${viewBoxHeight}" width="${viewBoxWidth}" height="${viewBoxHeight}">
  <rect x="0" y="0" width="${viewBoxWidth}" height="${viewBoxHeight}" fill="${palette.plate}"/>
  ${content}
</svg>`;
}

// 310x150 tiles are 2.0667:1. The square artwork is centred in that canvas rather than
// stretched, so the guitar keeps its proportions.
const WIDE_WIDTH = 2067;

function squareSvg(detailed) {
  return svgDocument(1000, 1000, detailed ? detailArt() : smallArt());
}

// The square artwork is already centred on (500,500) within its own box, so the wide
// tile just recentres and enlarges it. A horizontal guitar suits a 2.07:1 canvas far
// better than a square one, so it is scaled up to use it rather than left floating at
// square-tile size: at 2x the ink spans about 76% of the width and 84% of the height.
function wideSvg() {
  return svgDocument(
    WIDE_WIDTH,
    1000,
    `<g transform="translate(${WIDE_WIDTH / 2},500) scale(2) translate(-500,-500)">${detailArt()}</g>`
  );
}

module.exports = { palette, squareSvg, wideSvg, WIDE_WIDTH };
