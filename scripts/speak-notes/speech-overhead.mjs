// Follow-up: the measured durations imply a large fixed cost per utterance.
//
// At rate 4:  3 syllables -> 839 ms,  5 -> 1071 ms,  7 -> 1232 ms.
// That is ~98 ms per syllable on top of a ~545 ms constant. If that constant is dead air
// rather than speech, the tempo ceiling is being set by silence we could simply not wait for.
//
// Word boundary events carry `elapsedTime`, so they say when the last word actually began.
// The gap between that and the end event is the reclaimable slack.
//
// Also checks whether the three installed voices differ.

// Repo root, from this file's own location, so the script runs from anywhere.
const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

const PHRASES = ['quarter E minor 7 up', 'quarter G sharp 2', 'eighth E 4'];
const REPS = 6;
const RATE = 4; // rate saturates here: rate 5 measured identical to rate 4

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

await page.evaluate(async () => {
    const startedAt = performance.now();
    while (performance.now() - startedAt < 10000 && speechSynthesis.getVoices().length === 0) {
        await new Promise(r => setTimeout(r, 100));
    }

    window.__trace = ({ text, rate, voiceName }) => new Promise(resolve => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = rate;
        utterance.volume = 0;
        if (voiceName) {
            const voice = speechSynthesis.getVoices().find(v => v.name === voiceName);
            if (voice) utterance.voice = voice;
        }

        const boundaries = [];
        let started = null, settled = false;
        const finish = r => { if (!settled) { settled = true; clearTimeout(guard); resolve(r); } };
        const guard = setTimeout(() => { speechSynthesis.cancel(); finish({ error: 'timeout' }); }, 15000);

        utterance.onstart = () => { started = performance.now(); };
        utterance.onboundary = event => boundaries.push({
            name: event.name,
            charIndex: event.charIndex,
            // Measured against our own clock: elapsedTime's units have been inconsistent
            // across implementations, so it is recorded but not relied on.
            atMs: started === null ? null : performance.now() - started,
            elapsedTime: event.elapsedTime
        });
        utterance.onerror = e => finish({ error: e.error || 'unknown' });
        utterance.onend = () => finish({
            duration: started === null ? null : performance.now() - started,
            boundaries
        });

        speechSynthesis.cancel();
        speechSynthesis.speak(utterance);
    });
});

const mean = xs => xs.reduce((a, b) => a + b, 0) / xs.length;
const run = (text, voiceName) => page.evaluate(async ({ text, rate, voiceName, reps }) => {
    const out = [];
    for (let i = 0; i < reps; i++) {
        out.push(await window.__trace({ text, rate, voiceName }));
        await new Promise(r => setTimeout(r, 120));
    }
    return out;
}, { text, rate: RATE, voiceName, reps: REPS });

console.log(`=== Where does the time go? (rate ${RATE}, default voice) ===\n`);
for (const text of PHRASES) {
    const runs = (await run(text, null)).filter(r => !r.error);
    if (runs.length === 0) { console.log(`"${text}": all runs failed`); continue; }

    const duration = mean(runs.map(r => r.duration));
    const boundaryCount = runs[0].boundaries.length;
    console.log(`"${text}"`);
    console.log(`   total start->end : ${duration.toFixed(0)} ms`);
    console.log(`   boundary events  : ${boundaryCount}`);

    if (boundaryCount === 0) {
        console.log('   no boundary events -- cannot see inside the utterance\n');
        continue;
    }
    const firstAt = mean(runs.map(r => r.boundaries[0].atMs));
    const lastAt = mean(runs.map(r => r.boundaries[r.boundaries.length - 1].atMs));
    console.log(`   first word begins: ${firstAt.toFixed(0)} ms  (leading dead air)`);
    console.log(`   last word begins : ${lastAt.toFixed(0)} ms`);
    console.log(`   after last word  : ${(duration - lastAt).toFixed(0)} ms  (trailing slack)`);
    console.log(`   words: ${runs[0].boundaries.map(b => `${text.slice(b.charIndex).split(' ')[0]}@${Math.round(mean(runs.map(r => r.boundaries[runs[0].boundaries.indexOf(b)]?.atMs ?? 0)))}`).join('  ')}`);
    console.log('');
}

console.log('=== Do the three voices differ? (worst-case phrase) ===\n');
const voiceNames = await page.evaluate(() => speechSynthesis.getVoices().map(v => v.name));
for (const voiceName of voiceNames) {
    const runs = (await run('quarter E minor 7 up', voiceName)).filter(r => !r.error);
    if (runs.length === 0) { console.log(`  ${voiceName}: failed`); continue; }
    const duration = mean(runs.map(r => r.duration));
    const last = runs[0].boundaries.length
        ? mean(runs.map(r => r.boundaries[r.boundaries.length - 1].atMs)) : null;
    console.log(`  ${voiceName.padEnd(46)} ${duration.toFixed(0)} ms` +
        (last === null ? '' : `   last word at ${last.toFixed(0)} ms`));
}

await app.close();
