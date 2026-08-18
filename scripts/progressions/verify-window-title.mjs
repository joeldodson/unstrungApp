// Checks that the window title names the tab that is current.
//
// A screen reader can be asked for the focused window's title at any moment, so with several
// songs open the title has to say which one is in front. Read from the Electron window itself
// rather than from document.title, since that is what the operating system hands the reader.

const APP_DIR = `${import.meta.dirname}/../..`.split('\\').join('/');
const SONGS = [
    'Grateful Dead-Ripple-12-20-2025.gp',
    'Ripple.gp5'
];
const { _electron } = await import(`file:///${APP_DIR}/node_modules/playwright-core/index.mjs`);
const { readFile } = await import('node:fs/promises');

let failures = 0;
const check = (label, condition, detail = '') => {
    if (!condition) failures++;
    console.log(`  ${condition ? 'ok  ' : 'FAIL'}  ${label}${detail ? `  -- ${detail}` : ''}`);
};

const app = await _electron.launch({ args: ['.'], cwd: APP_DIR });
const page = await app.firstWindow();
await page.waitForLoadState('domcontentloaded');

const windowTitle = () => app.evaluate(({ BrowserWindow }) =>
    BrowserWindow.getAllWindows()[0].getTitle());

console.log('=== With nothing open ===');
const empty = await windowTitle();
console.log(`  title: ${JSON.stringify(empty)}`);
check('the plain application name', empty === 'Unstrung', empty);

for (const fileName of SONGS) {
    const bytes = [...new Uint8Array(await readFile(`${APP_DIR}/musicfiles/${fileName}`))];
    await app.evaluate(({ BrowserWindow }, payload) => {
        BrowserWindow.getAllWindows()[0].webContents.send('tabs:open-file', {
            fileName: payload.fileName, data: new Uint8Array(payload.bytes)
        });
    }, { fileName, bytes });
    await page.waitForTimeout(6000);
}

console.log('\n=== With two songs open, the second one current ===');
const second = await windowTitle();
console.log(`  title: ${JSON.stringify(second)}`);
check('names the application and the tab', second === `Unstrung - ${SONGS[1]}`, second);

console.log('\n=== Moving to the other tab ===');
await page.evaluate(() => {
    const tabs = [...document.querySelectorAll('[role="tab"]')];
    tabs[0].click();
});
await page.waitForTimeout(1000);
const first = await windowTitle();
console.log(`  title: ${JSON.stringify(first)}`);
check('the title followed the tab', first === `Unstrung - ${SONGS[0]}`, first);

console.log('\n=== The tab strip and the title agree ===');
const selected = await page.evaluate(() =>
    document.querySelector('[role="tab"][aria-selected="true"]')?.textContent ?? null);
check('the title ends with the selected tab label', first === `Unstrung - ${selected}`,
    `tab says ${JSON.stringify(selected)}`);

console.log('\n=== Closing every tab ===');
// Closing is a menu item in the main process, so it is driven the way the menu drives it.
for (let i = 0; i < SONGS.length; i++) {
    await app.evaluate(({ BrowserWindow }) =>
        BrowserWindow.getAllWindows()[0].webContents.send('tabs:close-current'));
    await page.waitForTimeout(800);
}
const closed = await windowTitle();
console.log(`  title: ${JSON.stringify(closed)}`);
check('back to the plain application name', closed === 'Unstrung', closed);

console.log(`\n${failures === 0 ? 'all checks passed' : `${failures} FAILED`}`);
await app.close();
process.exit(failures === 0 ? 0 : 1);
