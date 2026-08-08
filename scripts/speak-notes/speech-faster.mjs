// Two questions:
//   1. Is rate really capped? Rate 5 measured identical to rate 4, but that could be quantisation
//      rather than a ceiling. Sweep to 10, which is the spec's maximum.
//   2. With duration handed to the metronome, phrases lose their leading word. What does that buy?
//
// Reports the point at which speech actually ends -- last word boundary plus that word's own
// measured length -- since abandoning the utterance there is the plan.

// Repo root, from this file's own location, so the script runs from anywhere.
const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

const RATES = [4, 6, 8, 10];
const REPS = 6;

// The announcement set once the metronome carries duration. Octave kept, as asked.
const PHRASES = [
    'E minor 7 up',      // worst case: chord quality plus strum direction
    'F sharp 4 down',
    'G sharp 2',
    'E 4',
    'G sharp'            // for comparison only: what dropping the octave would cost
];
const CLOSING_WORDS = ['up', 'down', '2', '3', '4', 'sharp', 'E', 'G'];

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

await page.evaluate(async () => {
    const t0 = performance.now();
    while (performance.now() - t0 < 10000 && speechSynthesis.getVoices().length === 0) {
        await new Promise(r => setTimeout(r, 100));
    }
    window.__trace = ({ text, rate }) => new Promise(resolve => {
        const u = new SpeechSynthesisUtterance(text);
        u.rate = rate; u.volume = 0;
        const boundaries = [];
        let started = null, settled = false;
        const finish = r => { if (!settled) { settled = true; clearTimeout(guard); resolve(r); } };
        const guard = setTimeout(() => { speechSynthesis.cancel(); finish({ error: 'timeout' }); }, 15000);
        u.onstart = () => { started = performance.now(); };
        u.onboundary = e => boundaries.push({ charIndex: e.charIndex, atMs: started === null ? 0 : performance.now() - started });
        u.onerror = e => finish({ error: e.error || 'unknown' });
        u.onend = () => finish({ duration: started === null ? null : performance.now() - started, boundaries });
        speechSynthesis.cancel();
        speechSynthesis.speak(u);
    });
});

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const trace = (text, rate) => page.evaluate(async ({ text, rate, reps }) => {
    const out = [];
    for (let i = 0; i < reps; i++) {
        out.push(await window.__trace({ text, rate }));
        await new Promise(r => setTimeout(r, 100));
    }
    return out;
}, { text, rate, reps: REPS });

const firstBoundaryTimes = run => {
    const firstAt = new Map();
    for (const b of run.boundaries) if (!firstAt.has(b.charIndex)) firstAt.set(b.charIndex, b.atMs);
    return [...firstAt.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
};

for (const rate of RATES) {
    console.log(`\n================ rate ${rate} ================\n`);

    // Closing-word lengths at this rate, from the gaps between repeats of the same word.
    const wordLength = {};
    for (const word of CLOSING_WORDS) {
        const runs = (await trace(`${word} ${word} ${word} ${word}`, rate)).filter(r => !r.error);
        const gaps = [];
        for (const run of runs) {
            const times = firstBoundaryTimes(run);
            if (times.length >= 4) gaps.push(times[2] - times[1], times[3] - times[2]);
        }
        if (gaps.length) wordLength[word] = mean(gaps);
    }

    for (const text of PHRASES) {
        const runs = (await trace(text, rate)).filter(r => !r.error);
        if (runs.length === 0) { console.log(`  "${text}": failed`); continue; }
        const duration = mean(runs.map(r => r.duration));
        const lastAt = mean(runs.map(r => {
            const times = firstBoundaryTimes(r);
            return times[times.length - 1];
        }));
        const tail = wordLength[text.split(' ').pop()];
        const speechEnds = tail === undefined ? duration : lastAt + tail;

        console.log(`  "${text}"`.padEnd(24) +
            `end ${duration.toFixed(0).padStart(5)} ms   ` +
            `speech ends ${speechEnds.toFixed(0).padStart(5)} ms   ` +
            `-> ${(60000 / speechEnds).toFixed(0).padStart(3)} bpm quarters, ` +
            `${(30000 / speechEnds).toFixed(0).padStart(3)} bpm eighths`);
    }
}

await app.close();
