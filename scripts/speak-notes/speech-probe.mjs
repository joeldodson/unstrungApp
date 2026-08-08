// Follow-up probe: getVoices() came back empty in the Electron renderer.
//
// Three questions:
//   a. Do voices arrive if we wait longer than 3s?
//   b. Does speak() work anyway? An empty voice list does not necessarily mean no default voice.
//   c. Is this Electron, or this machine? Same test in the installed Chrome for comparison.

// Repo root, from this file's own location, so the script runs from anywhere.
const APP_DIR = `${import.meta.dirname}/../..`.replace(/\\/g, '/');
const { _electron, chromium } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);

// Polls the voice list for `waitMs`, then tries to speak regardless of what it found.
const PROBE = async waitMs => {
    if (typeof speechSynthesis === 'undefined') return { available: false };

    const started = performance.now();
    let appearedAt = null, list = [];
    while (performance.now() - started < waitMs) {
        list = speechSynthesis.getVoices();
        if (list.length > 0) { appearedAt = performance.now() - started; break; }
        await new Promise(r => setTimeout(r, 250));
    }

    // Try to speak whatever the default is, even with an empty list.
    const spoke = await new Promise(resolve => {
        const utterance = new SpeechSynthesisUtterance('E minor 7 up');
        utterance.volume = 0;
        const calledAt = performance.now();
        let startedAt = null, settled = false;
        const finish = result => { if (!settled) { settled = true; clearTimeout(guard); resolve(result); } };
        const guard = setTimeout(() => {
            finish({
                outcome: 'no event within 10s',
                speaking: speechSynthesis.speaking,
                pending: speechSynthesis.pending,
                sawStart: startedAt !== null
            });
            speechSynthesis.cancel();
        }, 10000);
        utterance.onstart = () => { startedAt = performance.now(); };
        utterance.onerror = e => finish({ outcome: `error: ${e.error || 'unknown'}`, sawStart: startedAt !== null });
        utterance.onend = () => finish({
            outcome: 'spoke',
            latency: startedAt === null ? null : startedAt - calledAt,
            duration: startedAt === null ? null : performance.now() - startedAt
        });
        speechSynthesis.speak(utterance);
    });

    return {
        available: true,
        appearedAt,
        count: list.length,
        voices: list.slice(0, 12).map(v => `${v.default ? '*' : ' '} ${v.name} [${v.lang}]`),
        spoke
    };
};

const show = (label, r) => {
    console.log(`\n--- ${label} ---`);
    if (!r.available) return console.log('  speechSynthesis is not defined');
    console.log(`  voices: ${r.count}` +
        (r.appearedAt === null ? '  (never appeared)' : `  (appeared after ${r.appearedAt.toFixed(0)} ms)`));
    for (const v of r.voices) console.log(`    ${v}`);
    console.log(`  speak(): ${r.spoke.outcome}` +
        (r.spoke.latency != null ? `  latency ${r.spoke.latency.toFixed(1)} ms, duration ${r.spoke.duration.toFixed(1)} ms` : ''));
    if (r.spoke.speaking !== undefined) {
        console.log(`           speaking=${r.spoke.speaking} pending=${r.spoke.pending} sawStart=${r.spoke.sawStart}`);
    }
};

// a + b: the Electron app itself.
const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');
show('Electron renderer (the app), 15s wait', await page.evaluate(PROBE, 15000));
await app.close();

// c: the installed Chrome, same machine, same voices available to the OS.
try {
    const browser = await chromium.launch({ channel: 'chrome' });
    const chromePage = await browser.newPage();
    await chromePage.goto('about:blank');
    show('Installed Chrome, 15s wait', await chromePage.evaluate(PROBE, 15000));
    await browser.close();
} catch (error) {
    console.log(`\n--- Installed Chrome ---\n  could not launch: ${error.message.split('\n')[0]}`);
}
