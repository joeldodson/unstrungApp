// The web version's entry point, bundled by scripts/build-web.mjs.
//
// The browser's window.unstrung has to exist before the renderer runs, since the renderer uses it
// as it loads. Modules run in the order they are imported, so this order is the guarantee.
import './platform.js';
import '../renderer/renderer.js';
