# reelbeetz.ch

Source repo for <https://reelbeetz.ch>

Build with [Hugo](https://gohugo.io).

## Theme

The [Massively](https://github.com/curtiscde/hugo-theme-massively) theme is consumed as a
[Hugo Module](https://gohugo.io/hugo-modules/), pinned in `go.mod`. Building therefore
requires **Hugo extended** and a **Go toolchain** on the build machine.

Site-specific overrides live in this repo and must not be edited in the module cache:

- `layouts/_partials/header.html` and `layouts/_partials/intro.html` — REEL BEETZ logo
- `data/en/nav.yaml` — extra nav entries
- `assets/js/jquery.min.js` — jQuery 3.7.1, see below

To upgrade the theme:

```shell
hugo mod get -u github.com/curtiscde/hugo-theme-massively
```

### jQuery

The theme ships jQuery 3.3.1, which is affected by CVE-2019-11358 (prototype pollution)
and CVE-2020-11022 / CVE-2020-11023 (XSS). Project files take precedence over module
files, so `assets/js/jquery.min.js` overrides it with 3.7.1 before the theme concatenates
everything into `assets/js/bundle.js`.

Drop the override once the theme ships a current jQuery itself. To refresh it, download
the file and check it against the hash jQuery publishes on <https://code.jquery.com>:

```shell
curl -fsSL -o assets/js/jquery.min.js https://code.jquery.com/jquery-3.7.1.min.js
openssl dgst -sha256 -binary assets/js/jquery.min.js | openssl base64 -A
# expected: /JqT3SQfawRcv/BIHPThkBvs0OEvtFFmqPF/lYI/Cxo=
```

Meta tags: <https://stackoverflow.com/questions/19778620/provide-an-image-for-whatsapp-link-sharing#43154489>

## Release page designs

A release page (`content/releases/*.md`) picks its design through the `layout` key in the
front matter. Three designs live in [`layouts/_default/`](layouts/_default); they all show
the same title, content, credits, YouTube and Spotify embeds and the exact same set of
service links, and they are all responsive from phone to desktop.

| `layout:`         | Design                | Inspired by                                     |
| ----------------- | --------------------- | ----------------------------------------------- |
| `release`         | Split Stage (default) | <https://music.imusician.pro/a/LlETmnp1>        |
| `release_classic` | Classic               | the earlier reelbeetz.ch release page, rebuilt  |
| `release_card`    | Showcase Card         | <https://bfan.link/creme-brulee-1>              |

Every release carries `layout: release` and therefore gets the Split Stage design. Picking
a different one is a one-line change:

```yaml
---
title: "Crème Brûlée"
layout: release_card   # was: release
---
```

Hugo resolves `<layout>-baseof.html` per layout, so each design owns a base template plus a
body template. Note that a layout name must not contain a hyphen — Hugo splits on it and
then fails to find the matching base template, which is why the names use underscores.

### Comparing the designs locally

`content/releases/zz-preview-{classic,split,card}.md` render the same release in all three
designs, so they can be compared side by side:

```shell
hugo server
# http://localhost:1313/preview-classic/
# http://localhost:1313/preview-split/
# http://localhost:1313/preview-card/
```

They are **local only**. Each is `draft: true`, and
[`config/development/config.toml`](config/development/config.toml) — which Hugo merges on
top of the root config for the `development` environment that `hugo server` runs in — sets
`buildDrafts = true`. A production `hugo` build runs in the `production` environment, does
not build drafts, and therefore never emits them.

They also carry `build: { list: never }`, so even locally they stay out of the releases
list, the pagination, the sitemap and the RSS feed; the only difference to production is
the three extra URLs.

The files mirror `content/releases/so-close-creme-brulee.md`. If you want to preview a
different release, copy its front matter over and keep the `draft`, `build`, `layout` and
`url` keys.

### Structure

Markup is shared through partials in [`layouts/_partials/release/`](layouts/_partials/release),
so a design is essentially just a stylesheet:

- `services.html` — single source of truth for every outbound link, returned as data
  (`key`, `icon`, `name`, `url`, `group`). Add a platform here and all three designs pick it up.
- `icon.html` — the brand glyphs, taken verbatim from the original markup
- `embeds.html` — YouTube and Spotify players
- `palette.html` — artwork variants plus the colour custom properties below
- `luminance.html` — relative luminance of a hex colour
- `head.html`, `analytics.html`, `linklist.html`

The stylesheets are in [`assets/css/`](assets/css) and are bundled, minified and
fingerprinted with Hugo Pipes (`resources.Concat | minify | fingerprint`);
`release-brands.css` with the brand colours is shared by all three.

### Colours and background

`palette.html` extracts the artwork's dominant colours with Hugo's `.Colors` and exposes
everything as custom properties on `<html>`:

| Property                              | Meaning                                                        |
| ------------------------------------- | -------------------------------------------------------------- |
| `--accent`                            | the release's `color` front matter value                        |
| `--accent-on-dark` / `--accent-on-light` | the same colour, swapped for a readable one where it would not be |
| `--art-1` … `--art-5`                 | dominant artwork colours, most dominant first                   |
| `--scrim`                             | overall artwork brightness, drives how dark the background scrim is |
| `--canvas`                            | `url()` of a 48px WebP of the artwork, scaled up as the blurred background |

Releases that set `hideBackgroundImage: true` get `--canvas: none` and are painted from the
`--art-*` palette alone.

### Credits

`credits` is rendered with `markdownify`, so it accepts Markdown and raw HTML:

```yaml
credits: |
  released September 27th, 2024
  Vocals: **MISS C-LINE**
  Mix: [Joel Studler aka REEL BEETZ](https://reelbeetz.ch/)
  Artwork: Lilian Salathé
```

The `|` matters. A quoted scalar spanning several lines is a *folded* scalar — YAML
replaces every line break with a space while parsing, so the line breaks are gone before
Hugo ever sees the value and no template function can bring them back. `|` is a literal
block scalar and keeps them. The designs set `white-space: pre-line` on the credits block,
which is what turns those line breaks into rendered ones.

Raw HTML needs `markup.goldmark.renderer.unsafe`, which [`config.toml`](config.toml) sets;
Goldmark drops raw HTML otherwise.

Releases that still use the older single-quoted form keep working — they just render as
one flowing paragraph, exactly as before.

### Artwork tilt

The artwork leans in 3D as you move, so it reads as a physical sleeve rather than a flat
image. [`assets/js/release-tilt.js`](assets/js/release-tilt.js) only writes two custom
properties, `--tilt-x` and `--tilt-y`, normalised to `-1..1`, plus a
`data-release-tilt-live` flag on `<html>` while an input source is running;
[`assets/css/release-tilt.css`](assets/css/release-tilt.css) decides what that looks like.
Opt an element in with `data-release-tilt`.

Two input sources, both **relative rather than absolute**, so the artwork always drifts
back to a flat square:

- **Fine pointer** (`min-width: 1024px`, `hover: hover`, `pointer: fine`) — follows the
  cursor, then eases back to neutral after it has been still for 600ms.
- **Device motion** on touch devices — the baseline continuously drifts towards however
  the device is currently held, so only *changes* tilt the artwork. Holding a phone at any
  angle settles back to neutral within a few seconds, and one resting on a table never
  sits at a permanent angle.

Disabled entirely under `prefers-reduced-motion`, and the animation frame loop stops as
soon as the values settle, so an idle page costs nothing.

iOS 13+ puts device orientation behind a permission prompt that only a user gesture can
trigger. Asking a visitor for motion access the moment they tap a link is worse than
quietly doing without, so the script does not ask: Android and already-granted iOS get the
effect, everyone else sees a still artwork. `REQUEST_MOTION_PERMISSION` at the top of the
script flips that if you disagree.

### What was fixed in the classic design

Kept as `release_classic`, this is the earlier release page repaired rather than replaced.
Several of these fixes (the missing meta tags, the dropped Bootstrap CDN, the resized
artwork) apply to all three designs, since they share the same head and partials.

- added the missing `<meta charset>` and `<meta name="viewport">`; without the viewport tag
  mobile browsers laid the page out at ~980px and zoomed out, so the media queries never
  behaved as intended
- the document scrolls normally again — `#main` was `position:absolute; top:0; bottom:0`,
  which clipped the page to the viewport height
- the YouTube iframe keeps its 16:9 ratio instead of collapsing to a hardcoded 315px
- the blurred artwork is visible on phones too (`#bg img` was `display:none` below 992px)
- releases whose accent is near-black (`#000000`, `#111111`) no longer render black text on
  a black background
- removed the Bootstrap 4.4.1 CDN (end of life, ~160 KB for one three-column grid) in favour
  of a small CSS grid, and the duplicated `mobileonly` link list
- the 3000px artwork is served resized as WebP via `srcset` instead of at full size

## CI

[`.github/workflows/ci.yml`](.github/workflows/ci.yml) runs on every push to `master` and on
pull requests:

- **Build** — `hugo --gc --minify` with Go and Hugo extended, pinned via `HUGO_VERSION`.
  Dependabot updates the actions and `go.mod`, but not that variable, so bump it by hand.
- **New Hugo warnings** — [`check-hugo-warnings.sh`](.github/scripts/check-hugo-warnings.sh)
  fails the build on any warning that is not listed in
  [`hugo-known-warnings.txt`](.github/hugo-known-warnings.txt), which currently holds two
  accepted ones (missing section layout, libsass deprecation).
- **Internal links** — the site is rebuilt with `--baseURL http://localhost:8080/`, served
  locally and crawled with [lychee](https://github.com/lycheeverse/lychee); only this makes
  the absolute internal links checkable.
- **Thumbnail sizes** — [`check-thumb-sizes.sh`](.github/scripts/check-thumb-sizes.sh)
  enforces the 300 KiB limit described below.
- **Shellcheck** — lints `generate-thumbs.sh` and the CI scripts.

[`.github/workflows/external-links.yml`](.github/workflows/external-links.yml) checks
external links weekly rather than per push, because streaming and social platforms throttle
CI runners. It only reports for now; see the comment in the file.

Both check scripts run locally too:

```shell
hugo --gc --minify 2>&1 | tee /tmp/hugo.log
.github/scripts/check-hugo-warnings.sh /tmp/hugo.log
.github/scripts/check-thumb-sizes.sh
```

## Thumbnails

Thumbs (e.g. for WhatsApp) must be below 300KB: https://stackoverflow.com/questions/19778620/provide-an-image-for-whatsapp-link-sharing

Using [`generate-thumbs.sh`](generate-thumbs.sh) and a git hook to create thumbs
before committing. It resizes `static/artwork/*.jpg` to 400 px wide into
`static/thumbs/artwork` and stages the result.

The script is incremental: a thumb is only re-encoded when it is missing, when
its pixel dimensions do not match the `-resize 400` output for its original, or
when it is above the 300 KiB limit. Everything else keeps its bytes and stays
out of the diff. Thumbs whose original is gone are deleted. If a thumb is still
too large after the resize, the script re-encodes it from the original at
quality 85, 75 and 65, and exits non-zero if even that is not enough.
