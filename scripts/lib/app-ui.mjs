// Driving the Electron app from Playwright the way it is built now: commands from the page's own
// menu, open items as sections under #item-panels with a button each in #open-items-list.
//
// The app once had a native menu, which sent IPC messages such as 'chord-practice:open' to the
// page, and showed open items as tabs. Scripts written then sent those messages; nothing listens
// for them now. These helpers are the replacement.

import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const APP_DIR = path.join(import.meta.dirname, '..', '..');
const { _electron } = await import(pathToFileURL(path.join(APP_DIR, 'node_modules', 'playwright-core', 'index.mjs')).href);

/**
 * Starts the app on a scratch profile, so nothing a check does reaches the real settings, recent
 * files or Documents folder (UNSTRUNG_TEST_PROFILE in src/main/main.js).
 *
 * `close` ends the app without waiting on any question it would ask, such as about unsaved
 * changes, and removes the profile.
 */
export async function launchApp({ args = [], env = {} } = {}) {
    const profile = await mkdtemp(path.join(tmpdir(), 'unstrung-verify-'));
    const app = await _electron.launch({
        args: ['.', ...args], cwd: APP_DIR, env: { ...process.env, UNSTRUNG_TEST_PROFILE: profile, ...env }
    });
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    const close = async () => {
        await app.evaluate(({ app: electronApp }) => electronApp.exit(0)).catch(() => {});
        await app.close().catch(() => {});
        await rm(profile, { recursive: true, force: true }).catch(() => {});
    };
    return { app, page, profile, close };
}

// The section of the item being shown, and the button that names it in the list of open items.
export const VISIBLE_PANEL = '#item-panels > section:not([hidden])';
export const CURRENT_ITEM_BUTTON = '#open-items-list button[aria-current="true"]';
export const ITEM_BUTTONS = '#open-items-list h1 > button';

// The page menu's commands, by the data-command of their items. See MENU_COMMANDS in
// src/renderer/renderer.js.
export const MENU = {
    openFile: 'open-file',
    chordPractice: 'chord-practice',
    newProgression: 'new-progression',
    openProgression: 'open-progression',
    chordLibrary: 'chord-library',
    fretsToChord: 'frets-to-chord',
    guitarSamples: 'guitar-samples',
    settings: 'settings',
    about: 'about'
};

/** Runs a page menu command, as choosing it from the menu would. */
export function runMenuCommand(page, command) {
    return page.evaluate(name => {
        const item = document.querySelector(`#app-menu-list [data-command="${name}"]`);
        if (!item) throw new Error(`No menu item for the command "${name}".`);
        item.click();
    }, command);
}

/**
 * Opens a song file from its bytes, as the main process does after the Open dialog: by sending
 * the page 'files:opened' with the file's name and contents.
 */
export function openSongFile(app, fileName, bytes) {
    return app.evaluate(({ BrowserWindow }, payload) => {
        BrowserWindow.getAllWindows()[0].webContents.send('files:opened', {
            fileName: payload.fileName, data: new Uint8Array(payload.bytes)
        });
    }, { fileName, bytes: [...bytes] });
}

/** Closes the item being shown, as its close button does; one with unsaved changes asks first. */
export function closeCurrentItem(page) {
    return page.evaluate(() => {
        const current = document.querySelector('#open-items-list button[aria-current="true"]');
        if (!current) throw new Error('No item is being shown.');
        current.closest('li').querySelector('button.close-item').click();
    });
}

/** The name of the item being shown, as the list of open items says it. */
export function currentItemName(page) {
    return page.evaluate(selector => document.querySelector(selector)?.textContent ?? null, CURRENT_ITEM_BUTTON);
}

/** How many items are open. */
export function openItemCount(page) {
    return page.evaluate(selector => document.querySelectorAll(selector).length, ITEM_BUTTONS);
}
