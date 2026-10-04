# Rebuilding eyesunstrung.vip with Eleventy, and serving Unstrung from it

Written 2026-09-23 from a discussion with Joel. Nothing here is built. The companion note on what a
browser version of Unstrung needs is `web-deployment-and-guitar-input.md`.

## Goal

One site at https://eyesunstrung.vip that holds Joel's articles and serves the web version of
Unstrung at https://eyesunstrung.vip/unstrung/app/. Built with Eleventy, replacing Sphinx and
pydata-sphinx-theme, which made the markup hard to control.

## The site as of 2026-09-23

- Repository: `joeldodson/eyesunstrung`, public. Locally `C:\Users\joeld\localProjects\eyesunstrung`.
- The custom domain belongs to that repository's own Pages site, not to Joel's user site
  (`joeldodson.github.io` has no CNAME). Pages serves the `gh-pages` branch ("legacy" build type),
  HTTPS enforced, certificate covers `eyesunstrung.vip` and `www.eyesunstrung.vip`.
- `.github/workflows/sphinx.yml` runs `sphinx-build docs _build` on every push to `main` and pushes
  the output to `gh-pages` with `peaceiris/actions-gh-pages`, which also writes the CNAME file.
- Content is MyST Markdown in `docs/`, about 1,840 lines:
  - `index.md` (home), `about.md`
  - `blog/index.md`, `blog/something_new.md`, `blog/take_two.md`
  - `theory/index.md`, `theory/physics_math_music.md`, `theory/notes_keys.md` (the two long ones)
- MyST-only syntax in use: three `{raw} html` blocks and three `{toctree}` blocks. Nothing else.
  Markdown-it, which Eleventy uses, passes raw HTML through, so the raw blocks become plain HTML.
  The toctrees become the layout's navigation and the section index pages' lists.
- The repository also holds the older Python Eyes Unstrung code (`src/unstrung`, `pyproject.toml`).
  `site/` is leftover mkdocs output and is gitignored.

## Why Eleventy

- It emits exactly the HTML in the templates, with no theme and no client-side JavaScript of its
  own. Landmarks, heading levels, skip link and navigation are all ours to decide.
- The content is already Markdown.
- Node and npm, the same toolchain as Unstrung. The Python toolchain can leave the site build.
- It does not need to understand the app. The app is built by its own esbuild step and Eleventy
  copies the result unchanged (`addPassthroughCopy`).

Astro was the alternative considered. It adds a component model and its own runtime, which buys
nothing for articles plus one self-contained app. Current Eleventy is 3.1.6.

## Layout of the eyesunstrung repository after the change

```
eleventy.config.js
package.json
content/                  Markdown pages (moved from docs/ with git mv)
  index.md
  about.md
  unstrung/index.md       Later: what Unstrung is, desktop download, link to the web app
  _includes/base.njk      The one page layout
  assets/                 CSS; the font is copied in from node_modules at build time
.github/workflows/site.yml
```

`docs/conf.py`, `Makefile`, `make.bat` and `requirements.txt` go once the Eleventy site is live.
The Python code is left alone.

## Page template

One base layout, built for NVDA first:

- A skip link to `main`, then `header` with the site name and a `nav` with an accessible name.
- `main` holds exactly one `h1`, the page title from front matter. Article Markdown then starts at
  `##`. The existing articles start with `#`, so the port shifts their headings down one level, or
  the layout takes the title from the first heading. To decide during the port.
- `aria-current="page"` on the current navigation link.
- `footer` with copyright and the GitHub link.
- `lang="en"`, a real `<title>` per page, no JavaScript.

The two theory articles open with a raw HTML block that contains its own `h1`. Those would become a
second `h1` on the page and need to change to a lower level.

## How the app gets into the site

**Changed 2026-10-02; see "The web build, as built" below.** Each unstrungApp release carries the
built web app as a third asset, `Unstrung-web-<version>.tar.gz`, and the site's workflow downloads
the latest one rather than building unstrungApp itself. The plan below is kept for the record.

The site workflow builds both:

1. Check out eyesunstrung.
2. Check out `joeldodson/unstrungApp` into a subfolder. It is public, so no token is needed.
3. In unstrungApp: `npm ci`, then a new `npm run build:web` that writes a self-contained folder
   (for example `dist-web/`): `index.html`, the bundle, CSS, chord library JSON, help.
4. In eyesunstrung: `npm ci`, then Eleventy, with `dist-web/` passed through to
   `_site/unstrung/app/`.
5. Deploy `_site/`.

A push to unstrungApp should also redeploy the site. A small workflow in unstrungApp can send a
`repository_dispatch` to eyesunstrung; that needs a token with access to eyesunstrung stored as a
secret in unstrungApp. Until then, rerunning the site workflow by hand works.

The site builds unstrungApp's latest release tag, not `main`, so the web app only changes when Joel
releases, the same as the desktop app.

Everything in the app has to use relative URLs, because it lives under `/unstrung/app/`, not at
the root. The Electron renderer already loads its files relatively.

### Deployment action

Two choices:

- Keep `peaceiris/actions-gh-pages` pushing to `gh-pages`. No settings change.
- Switch to GitHub's own `actions/upload-pages-artifact` and `actions/deploy-pages`. No `gh-pages`
  branch growing with every deploy, but the Pages source has to be changed to "GitHub Actions" in
  the repository settings.

Keep peaceiris for the first move; changing two things at once makes failures harder to place.

## Size limits that matter for the app

GitHub Pages allows a published site of up to 1 GB and has a soft bandwidth limit of 100 GB a
month. The WAV samples are 395 MB. That would fit once but would be pushed in full with every
deploy and downloaded per note by every visitor. The first web version should ship without the
sample library: reading and navigating song files, chord library, help. Audio follows once the Opus
encode described in `web-deployment-and-guitar-input.md` exists, fetched per note and cached.

## Order of work

1. **Port the site to Eleventy** in eyesunstrung, on a branch. Home and about pages only, new
   layout, same domain. Deploy it, replacing Sphinx. Nothing to do with the app yet, and useful on
   its own.
2. **Add `/unstrung/`**: a page about Unstrung with the desktop download.
3. **Web build of Unstrung** in unstrungApp: a browser implementation of `window.unstrung`, a second
   esbuild entry, `build:web`. Without samples at first. Checked with Playwright against a local
   static server, the same way the Electron app is checked.
4. **Wire the site workflow** to build and include the app at `/unstrung/app/`.
5. **Samples**: Opus encode, on-demand fetch, cache.

## Decisions, 2026-09-26

- **Content:** the blog and theory sections are dropped. The new site starts with only the home
  page and the about page. The old articles stay in git history.
- **URLs:** with only two pages, folder-style URLs (`/about/`) and no redirects. The old
  `about.html` address will stop working.
- **Branch:** all work happens on a branch in eyesunstrung. The live site is not touched until Joel
  merges it. The Sphinx workflow deploys on every push to `main` only, so a branch push is safe.
- **Web app version:** the site builds unstrungApp from its latest release tag, not `main`.
- **Reference site:** https://training.glidance.io, an Eleventy site Joel built under contract. None
  of its content or assets are used. It is a reference for its accessibility approach: no px root
  font size, visible focus outline, AA contrast in both colour schemes, reflow to 320 px, underlined
  links, nothing sticky or fixed, a skip link that appears on focus.
- **Font:** Atkinson Hyperlegible Next, by the Braille Institute, SIL Open Font License 1.1. Taken
  from the npm package `@fontsource-variable/atkinson-hyperlegible-next` rather than from the
  reference site. It is self-hosted, not loaded from Google Fonts.
- **The desktop app follows the site.** Joel expects to change the installable app so it matches
  what the site offers. The first step, done 2026-09-26: the app uses the same font, from the same
  npm package, copied into `src/renderer/fonts/` by `scripts/copy-font.mjs` during
  `build:renderer`.
- **License:** eyesunstrung was relicensed from a custom licence to MIT (2026-09-26), matching
  unstrungApp.
- **Local testing:** `npm start` runs Eleventy's dev server at http://localhost:8080/.

## The web build, as built

Built 2026-10-02 for unstrungApp 0.6.1.

- `npm run build:web` writes `dist-web`, ignored by git, and packs it as
  `release/Unstrung-web-<version>.tar.gz`. It runs `scripts/build-web-audio.mjs` (the Opus audio,
  `sample-map.json`, speech manifests and `voices.json`; see `web-deployment-and-guitar-input.md`),
  then `scripts/build-web.mjs`: the page, styles, images and font from `src/renderer`, the chord
  library JSON, and `bundle.js` built from `src/web/main.js`.
- `src/web/main.js` imports `src/web/platform.js`, the browser's `window.unstrung`, and then the
  same `renderer.js` the desktop app runs. `src/shared` is unchanged.
- **Release asset, not a build in the site's workflow.** The archive is attached to each GitHub
  release next to the installers, and the site's workflow downloads the latest and unpacks it at
  `/unstrung/app/`. The Opus files are never committed, the site needs no encoder and no
  unstrungApp checkout, and the site always serves exactly what was released.
- `npm run serve:web` serves `dist-web` at http://localhost:8090/unstrung/app/, the path it has on
  the site, since a page opened from disk cannot fetch its own files.
- The page asks the platform what it can do, through `window.unstrung.capabilities`. In a browser
  there is no typed folder path (Settings shows the chosen folder's name and a Choose Folder
  button), no default folder for Open File (the browser remembers the last one), and no Open
  Folder button.
- Files: `showOpenFilePicker`, `showSaveFilePicker` and `showDirectoryPicker`, Chromium only.
  Recent files and the progressions folder are handles kept in IndexedDB; the browser may ask for
  permission again on a later visit. A recent file is named by its name only, since a browser
  never gives a page the folder.
- **Chrome's own permission question is used as it is (decided 2026-10-04).** Chrome asks for
  permission again, beside the address bar, before a file or folder from an earlier visit can be
  used. NVDA does not announce that question, Alt+Shift+A did not reach it, and Joel found it only
  by moving through the tab strip with F6. Two ways round it were built and dropped: a dialog of
  Unstrung's own before the question, and using only the Windows Open and Save dialogs so the
  question never comes up (no folder tree, a Save dialog on the first save of each visit, recent
  songs reopened from a kept copy). Both were judged more confusing than the ordinary flow,
  especially for sighted users. Joel will cover finding the question in notes and a video for
  screen reader users. What remains: while the question is waiting, the status bar says so ("The
  browser is asking for permission to use ... Its question is beside the address bar."), and a
  refusal is said plainly, for example in Open Saved Progression. Saving a new progression opens
  the Save dialog before anything else, so it never waits on a permission.
- Settings are in localStorage. Samples and speech are fetched the first time each is needed and
  kept in the Cache API, in a cache named for the release, so a later release fetches afresh and
  the old cache is removed; `navigator.storage.persist()` asks the browser not to clear it.
- Leaving the page asks Chrome's "Leave site?" whenever anything is open, not only when a
  progression is unsaved, since leaving closes every open item.
- Audio contexts are resumed whenever they are asked for: a browser starts one suspended if it
  was made before any key press or click.
- Checked in Edge with Playwright against the local server, with the file pickers replaced by ones
  returning real handles from the browser's private file system: opening a song with Ctrl+O, an
  audio track playing from the Opus samples, recent files surviving a reload, saving a progression
  with Ctrl+S into the chosen folder and listing it, settings surviving a reload, the chord
  library. Chrome itself, and NVDA in it, were not tried.
