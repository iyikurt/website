# Kurt's website

The website of [Kurt](https://github.com/iyikurt/kurt), an MVC web framework
for [iyi](https://iyi.dev). The site is a Kurt application itself, and
`kurt export` turns it into static files.

## Where things are

- `app/controllers/docs_content.iyi`: the docs, one topic per page.
- `app/views/`: the home page, the docs page and the layout.
- `public/`: the stylesheet, the script, the fonts and the logos, served as they are.
- `config/routes.iyi`: `/`, `/docs` and `/docs/:slug`.

## Running it

You need [iyi](https://iyi.dev/install/) and `kurt`, built from a checkout of
[Kurt](https://github.com/iyikurt/kurt) with `make install`. Kurt has no
release yet, so point the site at that checkout with a line in `iyi.mod`, and
leave the line out of commits:

```
replace github.com/iyikurt/kurt => /path/to/kurt
```

Then:

```sh
kurt dev        # http://localhost:3000, reloads on changes
kurt export     # the static site, in dist/
```

## Publishing

`.github/workflows/pages.yml` runs on every push to `main`. It installs iyi,
builds `kurt` from Kurt's `main` branch, runs `kurt export` and publishes
`dist/` on GitHub Pages. Pages has to deploy from GitHub Actions: Settings →
Pages → Source.

The pages link to each other with absolute paths (`/docs/models`), so the site
has to be at the root of its domain: a custom domain, not
`iyikurt.github.io/website/`.
