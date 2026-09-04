# requeue-web

Marketing waitlist site for [Requeue](https://github.com/requeue-hq) — catch failed webhooks & jobs, then replay them.

This repo is a static site. No build step, no paid form backend, no analytics.

## Local preview

Serve the repo root with any static server:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Deploy on GitHub Pages (free)

The site is meant to ship from `main` at the repository root. There is no `CNAME` file — leave custom domains unset unless you add one later.

1. Merge this site to `main`.
2. On GitHub, open the repo **Settings**.
3. In the sidebar, open **Pages**.
4. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
5. Click **Save**.
6. Wait a minute, then open the Pages URL GitHub prints (typically `https://requeue-hq.github.io/requeue-web/`).

`.nojekyll` is included so GitHub Pages does not run Jekyll on the files.

## Waitlist

The waitlist form opens the visitor's email client to [maya.chen.yvr@agentmail.to](mailto:maya.chen.yvr@agentmail.to). Nothing is posted to a third-party form service.

## Stack

- Plain HTML, CSS, and a small `mailto` script
- Google Fonts (Instrument Serif, IBM Plex Sans, IBM Plex Mono)
- GitHub Pages from `main` / root
