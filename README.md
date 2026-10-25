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

To upgrade the theme:

```shell
hugo mod get -u github.com/curtiscde/hugo-theme-massively
```

Meta tags: <https://stackoverflow.com/questions/19778620/provide-an-image-for-whatsapp-link-sharing#43154489>

## Thumbnails

Thumbs (e.g. for WhatsApp) must be below 300KB: https://stackoverflow.com/questions/19778620/provide-an-image-for-whatsapp-link-sharing

Using generate-thumbs.sh and a git hook to create thumbs before committing.
