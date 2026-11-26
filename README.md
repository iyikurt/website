# Kurt's website

The static build of Kurt's website: an MVC web framework for [iyi](https://iyi.dev).

These files are generated. The site itself is a Kurt application, kept in the
`site/` folder of the Kurt repository; this repository holds what
`kurt export` wrote from it:

```sh
cd site
kurt export -o ../path/to/website
```

Serve the folder from its root with any static host. Pages link to each
other with absolute paths (`/docs/models`), so the site expects to live at
the top of its domain.
