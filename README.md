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

Using generate-thumbs.sh and a git hook to create thumbs before committing.
