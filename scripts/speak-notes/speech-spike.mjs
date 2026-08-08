// Spike: can the Web Speech API give us reliable phrase durations and start latency?
//
// Answers three questions and nothing else:
//   1. Does speechSynthesis work in this Electron build, and what voices does it list?
//   2. Is a zero-volume utterance's measured duration stable, and does it match an audible one?
//   3. How long after speak() is called does the start event fire?
//
// Makes no changes to the app. Launches it, measures in the renderer, prints numbers.

// Imported by path: this script lives in a scratch directory, outside the project's node_modules.
// Repo root, from this file's own location, so the script runs from anywhere.
const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

// The phrase the user nominated as a worst case: a chord name plus a strum direction.
const PHRASES = [
    'quarter E minor 7 up',
    'quarter G sharp 2',
    'eighth E 4'
];

// Rate is a multiplier on the voice's normal speed. Screen reader users habitually run far
// above 1, and rate is the single biggest lever on the tempo ceiling, so sweep it wide.
const RATES = [1, 2, 3, 4, 5];
const SILENT_REPS = 10;
const AUDIBLE_REPS = 5;

function stats(values) {
    if (values.length === 0) return null;
    const sorted = [...values].sort((a, b) => a - b);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
    return {
        n: values.length,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        mean,
        sd: Math.sqrt(variance),
        spread: sorted[sorted.length - 1] - sorted[0]
    };
}

const ms = value => (value === null || value === undefined ? '--' : `${value.toFixed(1)} ms`);

async function main() {
    const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');

    // --- 1. Is the API there, and what voices does it have? ---------------------------
    const voices = await page.evaluate(async () => {
        if (typeof speechSynthesis === 'undefined') return { available: false };

        // The voice list starts empty and fills asynchronously. Waiting on `voiceschanged` is a
        // trap: Chromium fires it once with the list still empty, so a one-shot listener reads
        // zero voices and concludes there are none. Poll instead.
        const startedAt = performance.now();
        let list = [], appearedAt = null;
        while (performance.now() - startedAt < 10000) {
            list = speechSynthesis.getVoices();
            if (list.length > 0) { appearedAt = performance.now() - startedAt; break; }
            await new Promise(r => setTimeout(r, 100));
        }

        return {
            available: true,
            appearedAt,
            count: list.length,
            voices: list.map(v => ({
                name: v.name, lang: v.lang, default: v.default, localService: v.localService
            }))
        };
    });

    console.log('=== 1. speechSynthesis availability ===');
    if (!voices.available) {
        console.log('speechSynthesis is NOT defined in this renderer. Everything else is moot.');
        await app.close();
        return;
    }
    console.log(`voices listed: ${voices.count}` +
        (voices.appearedAt === null ? '  (never appeared)' : `  (after ${voices.appearedAt.toFixed(0)} ms)`));
    for (const v of voices.voices) {
        console.log(`  ${v.default ? '*' : ' '} ${v.name}  [${v.lang}]${v.localService ? '' : '  (network)'}`);
    }
    if (voices.count === 0) {
        console.log('\nNo voices. Nothing further can be measured.');
        await app.close();
        return;
    }

    // --- The measurement primitive, installed once in the page ------------------------
    await page.evaluate(() => {
        // Speaks one phrase and reports, in page time:
        //   latency  - speak() returning to the start event
        //   duration - start event to end event
        // A hung utterance resolves with an error rather than blocking forever, which
        // Chromium's speech queue is known to do.
        window.__measureUtterance = ({ text, rate, volume }) => new Promise(resolve => {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.rate = rate;
            utterance.volume = volume;

            let called = null, started = null, settled = false;
            const finish = result => {
                if (settled) return;
                settled = true;
                clearTimeout(guard);
                resolve(result);
            };
            const guard = setTimeout(() => {
                speechSynthesis.cancel();
                finish({ error: 'timed out after 15s', started: started !== null });
            }, 15000);

            utterance.onstart = () => { started = performance.now(); };
            utterance.onerror = event => finish({ error: `error event: ${event.error || 'unknown'}` });
            utterance.onend = () => {
                const ended = performance.now();
                if (started === null) return finish({ error: 'end fired without start' });
                finish({ latency: started - called, duration: ended - started });
            };

            // Nothing else should be in the queue; make sure of it before timing.
            speechSynthesis.cancel();
            called = performance.now();
            speechSynthesis.speak(utterance);
        });
    });

    const measure = (text, rate, volume, reps) => page.evaluate(async ({ text, rate, volume, reps }) => {
        const results = [];
        for (let i = 0; i < reps; i++) {
            results.push(await window.__measureUtterance({ text, rate, volume }));
            await new Promise(r => setTimeout(r, 120)); // let the engine settle between runs
        }
        return results;
    }, { text, rate, volume, reps });

    const report = (label, results) => {
        const errors = results.filter(r => r.error);
        const ok = results.filter(r => !r.error);
        const d = stats(ok.map(r => r.duration));
        const l = stats(ok.map(r => r.latency));
        console.log(`  ${label}`);
        if (errors.length) console.log(`      ${errors.length}/${results.length} failed: ${errors[0].error}`);
        if (!d) return null;
        console.log(`      duration  mean ${ms(d.mean)}  spread ${ms(d.spread)}  sd ${ms(d.sd)}   [${ms(d.min)} .. ${ms(d.max)}]`);
        console.log(`      latency   mean ${ms(l.mean)}  spread ${ms(l.spread)}  sd ${ms(l.sd)}   [${ms(l.min)} .. ${ms(l.max)}]`);
        return { duration: d, latency: l };
    };

    // --- 2. Duration stability at volume 0, and 3. start latency ----------------------
    console.log('\n=== 2/3. Silent (volume 0) duration and start latency ===');
    const silent = {};
    for (const rate of RATES) {
        console.log(`\n rate ${rate}:`);
        for (const text of PHRASES) {
            const results = await measure(text, rate, 0, SILENT_REPS);
            silent[`${text}@${rate}`] = report(`"${text}"`, results);
        }
    }

    // --- Does volume 0 actually take as long as speaking aloud? -----------------------
    console.log('\n=== 4. Audible (volume 1) cross-check -- THIS MAKES NOISE ===');
    const audible = {};
    for (const rate of RATES) {
        console.log(`\n rate ${rate}:`);
        for (const text of ['E minor 7 up', 'quarter G sharp 2']) {
            const results = await measure(text, rate, 1, AUDIBLE_REPS);
            audible[`${text}@${rate}`] = report(`"${text}"`, results);
        }
    }

    console.log('\n=== 5. Silent vs audible ===');
    for (const key of Object.keys(audible)) {
        const s = silent[key], a = audible[key];
        if (!s || !a) { console.log(`  ${key}: incomparable`); continue; }
        const ratio = a.duration.mean === 0 ? Infinity : s.duration.mean / a.duration.mean;
        console.log(`  ${key}:  silent ${ms(s.duration.mean)}  audible ${ms(a.duration.mean)}  ratio ${ratio.toFixed(3)}`);
    }

    // --- What this means for the tempo ceiling ----------------------------------------
    console.log('\n=== 6. Tempo ceiling implied by the worst-case phrase ===');
    console.log('  (one announcement per beat; margin = measured mean latency + 2 sd)');
    for (const rate of RATES) {
        const s = silent[`quarter E minor 7 up@${rate}`] || silent[`E minor 7 up@${rate}`];
        if (!s) continue;
        const budget = s.duration.max + s.latency.mean + 2 * s.latency.sd;
        console.log(`  rate ${rate}:  budget ${ms(budget)}  ->  ` +
            `quarters ${(60000 / budget).toFixed(0)} bpm, eighths ${(30000 / budget).toFixed(0)} bpm`);
    }

    // --- How long would calibrating a whole song take? --------------------------------
    console.log('\n=== 7. Calibration cost ===');
    for (const rate of RATES) {
        const durations = PHRASES.map(p => silent[`${p}@${rate}`]).filter(Boolean)
            .map(s => s.duration.mean + s.latency.mean);
        if (durations.length === 0) continue;
        const perPhrase = durations.reduce((a, b) => a + b, 0) / durations.length;
        console.log(`  rate ${rate}:  ${ms(perPhrase)} per phrase  ->  ` +
            `40 phrases = ${(perPhrase * 40 / 1000).toFixed(1)} s`);
    }

    await app.close();
}

main().catch(async error => {
    console.error('SPIKE FAILED:', error);
    process.exit(1);
});
