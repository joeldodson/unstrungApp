// Final measurement: how much of the trailing slack is speech, and how much is dead air?
//
// The last word begins at its boundary event and the utterance ends ~500 ms later, but part of
// that is the word itself being spoken. To separate them without ears: say the same word several
// times in one utterance. The gap between consecutive boundaries is that word's true spoken
// length. Whatever is left after the final word is dead air we can stop waiting for.
//
// Then: can we actually pipeline? Cancel at the reclaimed point, immediately speak the next, and
// see what sustained announcement interval that yields.

// Repo root, from this file's own location, so the script runs from anywhere.
const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

const RATE = 4;
const REPS = 6;

// Words that end an announcement: strum directions, octave numbers, plain note names.
const FINAL_WORDS = ['up', 'down', '2', '3', '4', 'sharp', 'E', 'G'];
const PHRASES = ['quarter E minor 7 up', 'quarter G sharp 2', 'eighth E 4'];

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

    // Speaks a run of announcements, abandoning each after `holdMs` from its start rather than
    // waiting for the end event. Reports the interval actually achieved and whether each
    // utterance got as far as its last word.
    window.__pipeline = ({ texts, rate, holdMs, expectedBoundaries }) => new Promise(async resolve => {
        const marks = [];
        for (let i = 0; i < texts.length; i++) {
            const u = new SpeechSynthesisUtterance(texts[i]);
            u.rate = rate; u.volume = 0;
            let started = null, count = 0;
            u.onstart = () => { started = performance.now(); };
            u.onboundary = () => { count++; };
            const calledAt = performance.now();
            speechSynthesis.cancel();
            speechSynthesis.speak(u);
            await new Promise(r => setTimeout(r, holdMs));
            marks.push({
                calledAt,
                startLatency: started === null ? null : started - calledAt,
                boundaries: count,
                reachedLastWord: count >= expectedBoundaries[i]
            });
        }
        speechSynthesis.cancel();
        const intervals = marks.slice(1).map((m, i) => m.calledAt - marks[i].calledAt);
        resolve({ marks, intervals });
    });
});

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const trace = (text) => page.evaluate(async ({ text, rate, reps }) => {
    const out = [];
    for (let i = 0; i < reps; i++) {
        out.push(await window.__trace({ text, rate }));
        await new Promise(r => setTimeout(r, 120));
    }
    return out;
}, { text, rate: RATE, reps: REPS });

// --- 1. How long does each closing word actually take to say? ------------------------
console.log(`=== 1. True spoken length of closing words (rate ${RATE}) ===\n`);
const wordLength = {};
for (const word of FINAL_WORDS) {
    // Four repeats: the gaps between boundaries 2->3 and 3->4 are the word's own length,
    // clear of any first-word or last-word edge effects.
    const runs = (await trace(`${word} ${word} ${word} ${word}`)).filter(r => !r.error);
    const gaps = [];
    for (const run of runs) {
        // Boundaries can include a leading duplicate at charIndex 0; group by charIndex.
        const firstAt = new Map();
        for (const b of run.boundaries) if (!firstAt.has(b.charIndex)) firstAt.set(b.charIndex, b.atMs);
        const times = [...firstAt.entries()].sort((a, b) => a[0] - b[0]).map(e => e[1]);
        if (times.length >= 4) gaps.push(times[2] - times[1], times[3] - times[2]);
    }
    if (gaps.length === 0) { console.log(`  "${word}": could not resolve`); continue; }
    wordLength[word] = mean(gaps);
    console.log(`  "${word}"`.padEnd(12) + `${wordLength[word].toFixed(0)} ms`);
}

// --- 2. Split each phrase into speech and dead air -----------------------------------
console.log(`\n=== 2. Speech versus dead air, per phrase ===\n`);
const usefulEnd = {};
for (const text of PHRASES) {
    const runs = (await trace(text)).filter(r => !r.error);
    if (runs.length === 0) { console.log(`  "${text}": failed`); continue; }
    const duration = mean(runs.map(r => r.duration));

    const lastAts = runs.map(r => r.boundaries[r.boundaries.length - 1].atMs);
    const lastAt = mean(lastAts);
    const finalWord = text.split(' ').pop();
    const tail = wordLength[finalWord];

    usefulEnd[text] = tail === undefined ? duration : lastAt + tail;
    console.log(`  "${text}"`);
    console.log(`     end event at        ${duration.toFixed(0)} ms`);
    console.log(`     last word starts at ${lastAt.toFixed(0)} ms, runs ${tail === undefined ? '?' : tail.toFixed(0) + ' ms'}`);
    console.log(`     speech ends at      ${usefulEnd[text].toFixed(0)} ms`);
    console.log(`     dead air            ${(duration - usefulEnd[text]).toFixed(0)} ms` +
        `  (${((1 - usefulEnd[text] / duration) * 100).toFixed(0)}% of the utterance)`);
    console.log(`     boundary spread across runs: ${(Math.max(...lastAts) - Math.min(...lastAts)).toFixed(0)} ms`);
}

// --- 3. Does pipelining actually hold up? -------------------------------------------
console.log(`\n=== 3. Sustained pipelining: cancel early, speak the next ===\n`);
const worst = 'quarter E minor 7 up';
const expected = (await trace(worst))[0].boundaries.length;
const holds = [
    Math.round(usefulEnd[worst] ?? 900),
    Math.round((usefulEnd[worst] ?? 900) + 60),
    Math.round((usefulEnd[worst] ?? 900) + 150)
];
for (const holdMs of holds) {
    const texts = Array.from({ length: 12 }, () => worst);
    const result = await page.evaluate(({ texts, rate, holdMs, expected }) =>
        window.__pipeline({ texts, rate, holdMs, expectedBoundaries: texts.map(() => expected) }),
        { texts, rate: RATE, holdMs, expected });

    const reached = result.marks.filter(m => m.reachedLastWord).length;
    const latencies = result.marks.map(m => m.startLatency).filter(v => v !== null);
    console.log(`  hold ${holdMs} ms:  interval mean ${mean(result.intervals).toFixed(0)} ms ` +
        `[${Math.min(...result.intervals).toFixed(0)} .. ${Math.max(...result.intervals).toFixed(0)}]`);
    console.log(`      reached last word: ${reached}/${result.marks.length}` +
        `   start latency mean ${latencies.length ? mean(latencies).toFixed(0) : '--'} ms`);
    console.log(`      -> quarters ${(60000 / mean(result.intervals)).toFixed(0)} bpm, ` +
        `eighths ${(30000 / mean(result.intervals)).toFixed(0)} bpm`);
}

await app.close();
