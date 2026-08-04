// Turns the project's own Markdown into semantic HTML.
//
// This is deliberately not a general Markdown implementation. It handles the constructs README.md
// actually uses, and anything it does not recognise is emitted as ordinary paragraph text rather
// than dropped, so an unfamiliar construct degrades to readable prose instead of vanishing.
//
// Supported:
//   # ## ###          headings, mapped one level deeper so a document embedded in a tab does not
//                     introduce a second <h1>
//   blank-line        paragraph break; consecutive lines join into one paragraph, which is what
//                     Markdown means even though README.md writes one sentence per line
//   1. item           ordered list (Markdown renumbers these, so every item may be written "1.")
//   * item            unordered list, including indented under an ordered item
//   [text](url)       link
//   ```code```        inline code
//
// The input is first-party content shipped inside the application, not anything a user supplies,
// but everything is HTML-escaped before markup is added regardless: correctness here means "&"
// and "<" in prose survive intact, which matters for text like ".gp*" and "Help-> About".

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

function escapeHtml(text) {
    return text.replace(/[&<>"']/g, character => HTML_ESCAPES[character]);
}

/** Escapes, then applies the inline constructs: code spans first, so links inside them stay literal. */
function renderInline(text) {
    let html = escapeHtml(text);
    html = html.replace(/```([^`]+)```/g, (_match, code) => `<code>${code}</code>`);
    html = html.replace(/`([^`]+)`/g, (_match, code) => `<code>${code}</code>`);
    html = html.replace(
        /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
        (_match, label, url) => `<a href="${url}">${label}</a>`
    );
    return html;
}

const HEADING = /^(#{1,6})\s+(.*)$/;
const ORDERED_ITEM = /^\s*\d+\.\s+(.*)$/;
const UNORDERED_ITEM = /^\s*[*-]\s+(.*)$/;

/** How deeply a list item is indented, used to nest a bulleted list inside a numbered one. */
function indentOf(line) {
    return (/^(\s*)/.exec(line)[1] ?? '').replace(/\t/g, '    ').length;
}

/**
 * @param markdown  the document source
 * @param headingOffset  levels to push headings down by. The default of 1 turns the source's
 *   single "#" into an h2, so the document sits under the tab's own heading structure rather
 *   than competing with it.
 */
export function markdownToHtml(markdown, { headingOffset = 1 } = {}) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const out = [];

    let paragraph = [];
    // A stack, so a bulleted list nested under a numbered item closes in the right order.
    const listStack = [];

    const flushParagraph = () => {
        if (paragraph.length === 0) return;
        out.push(`<p>${paragraph.map(renderInline).join(' ')}</p>`);
        paragraph = [];
    };
    const closeListsTo = depth => {
        while (listStack.length > depth) {
            const closing = listStack.pop();
            out.push(closing.itemOpen ? `</li></${closing.tag}>` : `</${closing.tag}>`);
        }
    };
    const closeEverything = () => {
        flushParagraph();
        closeListsTo(0);
    };

    for (const line of lines) {
        if (line.trim() === '') {
            // A blank line ends a paragraph but not a list: Markdown allows loose lists, and
            // README.md separates nothing else with blanks inside its numbered steps.
            flushParagraph();
            continue;
        }

        const heading = HEADING.exec(line);
        if (heading) {
            closeEverything();
            const level = Math.max(1, Math.min(heading[1].length + headingOffset, 6));
            out.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
            continue;
        }

        const ordered = ORDERED_ITEM.exec(line);
        const unordered = ordered ? null : UNORDERED_ITEM.exec(line);
        if (ordered || unordered) {
            flushParagraph();
            const tag = ordered ? 'ol' : 'ul';
            const indent = indentOf(line);

            // Anything indented further than the open list starts a nested one; anything level
            // with or outside it closes back down to the matching depth.
            while (listStack.length > 0 && indent < listStack[listStack.length - 1].indent) {
                closeListsTo(listStack.length - 1);
            }
            const current = listStack[listStack.length - 1];
            if (!current || indent > current.indent) {
                if (current && current.itemOpen) out.push('');
                listStack.push({ tag, indent, itemOpen: false });
                out.push(`<${tag}>`);
            } else if (current.tag !== tag) {
                closeListsTo(listStack.length - 1);
                listStack.push({ tag, indent, itemOpen: false });
                out.push(`<${tag}>`);
            }

            const open = listStack[listStack.length - 1];
            if (open.itemOpen) out.push('</li>');
            out.push(`<li>${renderInline((ordered ? ordered[1] : unordered[1]).trim())}`);
            open.itemOpen = true;
            continue;
        }

        // A plain line inside a list item continues that item rather than starting a paragraph,
        // which is how Markdown treats a wrapped list item.
        const openList = listStack[listStack.length - 1];
        if (openList && openList.itemOpen && indentOf(line) > openList.indent) {
            out.push(` ${renderInline(line.trim())}`);
            continue;
        }

        closeListsTo(0);
        paragraph.push(line.trim());
    }

    closeEverything();
    return out.join('\n');
}

/**
 * Renders a document that is going to be displayed under a heading of its own, such as a tab
 * whose title already names it.
 *
 * The source's own opening heading is dropped, because the surrounding heading says the same
 * thing -- for a single section that means literally the same word twice over. What is left is
 * then shifted so its shallowest heading becomes an h2, which keeps the levels contiguous under
 * the h1 instead of jumping straight to h3 and leaving a gap.
 */
export function markdownBodyToHtml(markdown) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');

    let start = 0;
    while (start < lines.length && lines[start].trim() === '') start++;
    if (start < lines.length && HEADING.test(lines[start])) start++;

    const body = lines.slice(start);
    const levels = body.map(line => HEADING.exec(line)).filter(Boolean).map(match => match[1].length);
    const shallowest = levels.length > 0 ? Math.min(...levels) : 2;

    return markdownToHtml(body.join('\n').trim(), { headingOffset: 2 - shallowest });
}

/**
 * The part of a document under one heading, heading included, up to the next heading at the same
 * or a higher level.
 *
 * Lets a section of README.md be presented on its own without keeping a second copy of the text
 * that would drift from the first.
 */
export function markdownSection(markdown, headingText) {
    const lines = markdown.replace(/\r\n/g, '\n').split('\n');
    const wanted = headingText.trim().toLowerCase();

    let start = -1;
    let level = 0;
    for (const [index, line] of lines.entries()) {
        const heading = HEADING.exec(line);
        if (!heading) continue;
        if (start === -1) {
            if (heading[2].trim().toLowerCase() !== wanted) continue;
            start = index;
            level = heading[1].length;
            continue;
        }
        if (heading[1].length <= level) return lines.slice(start, index).join('\n').trim();
    }
    return start === -1 ? null : lines.slice(start).join('\n').trim();
}
