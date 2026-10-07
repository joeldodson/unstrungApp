// The documents in user-docs/, in the order the Help menu and the eyesunstrung.vip documentation
// list them. Each id is the file name without .md, and is also the page's address on the site:
// /unstrung/docs/<id>/. The about document is the /unstrung/docs/ page itself, and in the app it
// fills the About unstrung dialog rather than opening as an item.
//
// The Help menu's entries are written out in src/renderer/index.html, one per document here, in
// this order, with data-help-document set to the id.

export const HELP_DOCUMENTS = [
    { id: 'introduction', menuLabel: 'Introduction' },
    { id: 'screen-reader-users', menuLabel: 'Screen Reader Users' },
    { id: 'features', menuLabel: 'Features' },
    { id: 'third-parties', menuLabel: 'Third Party Components' },
    { id: 'resources', menuLabel: 'Resources' }
];

export const ABOUT_DOCUMENT = 'about';

/** A document's title: the text of its level 1 heading, which every user-docs file starts with. */
export function documentTitle(markdown, id) {
    const match = /^#\s+(.+)$/m.exec(markdown);
    if (!match) throw new Error(`user-docs/${id}.md has no level 1 heading to use as its title`);
    return match[1].trim();
}
