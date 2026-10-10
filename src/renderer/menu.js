/**
 * A menu button that opens a menu, with submenus, behaving like a desktop application's menu.
 *
 * Follows the menu button pattern of the ARIA Authoring Practices Guide. The roles are what make it
 * work with a screen reader: on reaching an element with role="menu", NVDA switches to focus mode
 * by itself, so the arrow keys come here instead of moving NVDA's browse cursor through the
 * document. That is what keeps arrowing inside the menu, which no amount of script on ordinary
 * buttons and disclosures could do.
 *
 * Keys, on the button:
 *   Enter, Space, Down  open the menu on its first item
 *   Up                  open the menu on its last item
 * Keys, in a menu:
 *   Down, Up            next and previous item in this menu, looping at either end
 *   Home, End           first and last item
 *   a letter            next item starting with that letter
 *   Right, Enter, Space on an item with a submenu: open it on its first item
 *   Enter, Space        on any other item: close the menu and run the command
 *   Left                in a submenu: close it and go back to the item that opened it
 *   Escape              close this menu, back to the item or button that opened it
 *   Tab, Shift+Tab      close everything and move on, as from the button
 *
 * An item with aria-disabled="true" can be arrowed to, and is read as unavailable, but does
 * nothing: it runs no command and opens no submenu.
 *
 * Focus moves from item to item as you arrow (each item is focusable from script only), so the
 * screen reader's focus and its cursor are always the same place. Only one chain of menus is open
 * at a time, and a closed menu is hidden, so it is out of the accessibility tree.
 *
 * Markup: the button has aria-haspopup="menu" and aria-controls naming the menu. A menu is a
 * <ul role="menu">; each entry is <li role="none"> holding the element with role="menuitem", and a
 * submenu is a further <ul role="menu" hidden> inside that same <li>, named by the item's
 * aria-controls. Separators are <li role="separator">. Items with a submenu carry aria-haspopup,
 * which NVDA reads as "submenu", and no aria-expanded: a desktop menu does not say "collapsed".
 *
 * Plain DOM, nothing from Electron, so it is the same in a browser.
 */

const ITEMS = ':scope > li > [role="menuitem"]';

// What Tab can land on, for finding where Tab goes after the menu closes.
const TABBABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
    'textarea:not([disabled]), summary, [tabindex]';

export function createMenuButton(button, rootMenu, { onActivate }) {
    const container = button.parentElement;

    const itemsOf = menu => [...menu.querySelectorAll(ITEMS)];
    const menuOf = item => item.closest('[role="menu"]');
    const submenuOf = item => {
        const id = item.getAttribute('aria-controls');
        return id ? document.getElementById(id) : null;
    };
    const parentItemOf = menu =>
        menu === rootMenu ? null : menu.parentElement.querySelector(':scope > [role="menuitem"]');
    const isOpen = () => !rootMenu.hidden;

    function focusEnd(menu, which) {
        const items = itemsOf(menu);
        (which === 'last' ? items[items.length - 1] : items[0])?.focus();
    }

    function closeSubmenusOf(menu) {
        for (const item of itemsOf(menu)) {
            const submenu = submenuOf(item);
            if (submenu && !submenu.hidden) {
                closeSubmenusOf(submenu);
                submenu.hidden = true;
            }
        }
    }

    function open(which = 'first') {
        rootMenu.hidden = false;
        button.setAttribute('aria-expanded', 'true');
        focusEnd(rootMenu, which);
    }

    /**
     * Closes every menu. With `focusButton`, focus goes to the button first: hiding a menu that
     * holds focus would drop focus to the page body, and NVDA's cursor with it.
     */
    function close({ focusButton = false } = {}) {
        if (focusButton) button.focus();
        if (!isOpen()) return;
        closeSubmenusOf(rootMenu);
        rootMenu.hidden = true;
        button.setAttribute('aria-expanded', 'false');
    }

    function openSubmenu(item, which = 'first') {
        const submenu = submenuOf(item);
        if (!submenu) return;
        closeSubmenusOf(menuOf(item));
        submenu.hidden = false;
        focusEnd(submenu, which);
    }

    function closeSubmenu(menu) {
        // Focus first, for the same reason as in close().
        parentItemOf(menu)?.focus();
        closeSubmenusOf(menu);
        menu.hidden = true;
    }

    function move(item, delta) {
        const items = itemsOf(menuOf(item));
        const index = items.indexOf(item);
        items[(index + delta + items.length) % items.length].focus();
    }

    function typeAhead(item, letter) {
        const items = itemsOf(menuOf(item));
        const start = items.indexOf(item);
        for (let step = 1; step <= items.length; step++) {
            const candidate = items[(start + step) % items.length];
            if (candidate.textContent.trim().toLowerCase().startsWith(letter)) {
                candidate.focus();
                return;
            }
        }
    }

    const isDisabled = item => item.getAttribute('aria-disabled') === 'true';

    function activate(item) {
        if (isDisabled(item)) return;
        if (submenuOf(item)) {
            openSubmenu(item);
            return;
        }
        // Focus is on the button when the command runs, so a dialog it opens returns focus there.
        close({ focusButton: true });
        onActivate(item);
    }

    /** The first element Tab would reach after the menu, for Tab from inside it. */
    function nextTabbableAfterMenu() {
        return [...document.querySelectorAll(TABBABLE)].find(element =>
            !container.contains(element) &&
            (container.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING) &&
            element.tabIndex >= 0 &&
            element.checkVisibility()) ?? null;
    }

    // Enter and Space on the button arrive as a click, which is also what a screen reader in
    // browse mode sends, so opening is done there.
    button.addEventListener('click', () => {
        if (isOpen()) close();
        else open('first');
    });

    button.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            open(event.key === 'ArrowUp' ? 'last' : 'first');
        }
    });

    rootMenu.addEventListener('keydown', event => {
        const item = event.target.closest('[role="menuitem"]');
        if (!item || event.ctrlKey || event.altKey || event.metaKey) return;
        const menu = menuOf(item);

        switch (event.key) {
            case 'ArrowDown': move(item, 1); break;
            case 'ArrowUp': move(item, -1); break;
            case 'Home': focusEnd(menu, 'first'); break;
            case 'End': focusEnd(menu, 'last'); break;
            case 'ArrowRight':
                // Only an item with a submenu goes anywhere. Elsewhere Right does nothing, rather
                // than letting the key through to the page.
                if (submenuOf(item) && !isDisabled(item)) openSubmenu(item);
                break;
            case 'ArrowLeft':
                if (menu !== rootMenu) closeSubmenu(menu);
                break;
            case 'Enter':
            case ' ':
                activate(item);
                break;
            case 'Escape':
                if (menu === rootMenu) close({ focusButton: true });
                else closeSubmenu(menu);
                break;
            case 'Tab': {
                const target = event.shiftKey ? button : (nextTabbableAfterMenu() ?? button);
                target.focus();
                close();
                break;
            }
            default:
                if (event.key.length === 1 && event.key.trim() !== '') {
                    typeAhead(item, event.key.toLowerCase());
                    break;
                }
                return;
        }
        event.preventDefault();
        // A key the menu used is the menu's alone. The page's own shortcuts listen on the document,
        // and Space or a letter reaching them would also pause playback or toggle the metronome.
        event.stopPropagation();
    });

    rootMenu.addEventListener('click', event => {
        const item = event.target.closest('[role="menuitem"]');
        if (item) activate(item);
    });

    // Focus leaving the menu altogether, by any route, closes it.
    container.addEventListener('focusout', event => {
        if (!container.contains(event.relatedTarget)) close();
    });

    document.addEventListener('pointerdown', event => {
        if (!container.contains(event.target)) close();
    });

    return { close, isOpen };
}
