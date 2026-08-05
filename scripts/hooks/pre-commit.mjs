// Runs before every commit, via scripts/hooks/pre-commit.
//
// Some files in this repository are committed but generated from other tracked files:
// help-content.json comes from README.md, and chord-library.json from the build script and its
// source dataset. Nothing stops the two being committed out of step, and that happened: a commit
// carried an edited README alongside a help snapshot built before the edit, so the app showed
// wording the README no longer used.
//
// So every generated file is rebuilt here and staged if it changed. That makes drift impossible
// rather than merely unlikely. This does not package anything -- no installer is built, and the
// renderer bundle is not touched, since it is not committed and `npm start` builds it anyway.

import { execFileSync } from 'node:child_process';

const GENERATED = [
    { script: 'scripts/build-help.mjs', output: 'src/assets/help/help-content.json' },
    { script: 'scripts/build-chord-library.mjs', output: 'src/assets/chords/chord-library.json' }
];

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

/**
 * Whether regenerating actually altered the file, meaning the working tree no longer matches what
 * is staged.
 *
 * `git status` is the wrong question here: it reports a file as changed while it is merely staged,
 * so asking it made the hook re-stage an untouched file on every run and claim it had regenerated
 * something. `git diff` compares the working tree against the index, which is exactly the
 * difference that needs staging.
 */
function differsFromIndex(file) {
    try {
        execFileSync('git', ['diff', '--quiet', '--', file], { stdio: 'pipe' });
        return false;
    } catch {
        return true;
    }
}

const staged = [];
for (const { script, output } of GENERATED) {
    try {
        execFileSync(process.execPath, [script], { stdio: 'pipe' });
    } catch (error) {
        // Blocking is deliberate: letting the commit through would mean committing whatever stale
        // copy is on disk, which is the problem this hook exists to prevent.
        const detail = (error.stderr?.toString() || error.message || '').trim().split('\n').slice(-4).join('\n');
        process.stderr.write(`\npre-commit: could not run ${script}\n${detail}\n\n` +
            'If dependencies are missing, run npm install. To commit anyway, use --no-verify.\n');
        process.exit(1);
    }

    if (differsFromIndex(output)) {
        git('add', '--', output);
        staged.push(output);
    }
}

if (staged.length > 0) {
    process.stdout.write('pre-commit: regenerated and staged ' + staged.join(', ') + '\n');
}
