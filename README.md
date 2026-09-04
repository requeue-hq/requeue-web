# requeue-web

Marketing waitlist site for [Requeue](https://github.com/requeue-hq/requeue) — catch failed webhooks & jobs, then replay them.

Live:

- Site: [https://getrequeue.com](https://getrequeue.com)
- Hosted API: [https://api.getrequeue.com](https://api.getrequeue.com)
- Core: [https://github.com/requeue-hq/requeue](https://github.com/requeue-hq/requeue)
- JS SDK: [https://github.com/requeue-hq/requeue-sdk-js](https://github.com/requeue-hq/requeue-sdk-js)

This repo is a static site. No build step, no paid form backend, no analytics, no dashboard server. The waitlist lives at `index.html`. A client-only inbox is at [`app.html`](app.html).

## Local preview

Serve the repo root with any static server:

```bash
python3 -m http.server 8080
```

Then open [http://localhost:8080](http://localhost:8080) for the waitlist and [http://localhost:8080/app.html](http://localhost:8080/app.html) for the inbox.

## Deploy on GitHub Pages (free)

The site ships from `main` at the repository root. A [`CNAME`](CNAME) file pins the custom domain to **getrequeue.com**.

1. Merge this site to `main`.
2. On GitHub, open the repo **Settings**.
3. In the sidebar, open **Pages**.
4. Under **Build and deployment**:
   - **Source:** Deploy from a branch
   - **Branch:** `main`
   - **Folder:** `/ (root)`
5. Click **Save**.
6. Under **Custom domain**, keep `getrequeue.com` (the `CNAME` file). DNS for that host should stay pointed at GitHub Pages.
7. Wait a minute, then open [https://getrequeue.com](https://getrequeue.com). The GitHub Pages URL (`https://requeue-hq.github.io/requeue-web/`) still works as a fallback.

`.nojekyll` is included so GitHub Pages does not run Jekyll on the files.

## Dashboard

[`app.html`](app.html) is a tiny client-only dead-letter inbox. It talks **from the browser** to a running [Requeue core API](https://github.com/requeue-hq/requeue). This repo does not proxy requests or store keys.

Paste:

- **API base URL** — hosted API (`https://api.getrequeue.com` by default), local Wrangler, or your own Worker
- **API key** — sent as `Authorization: Bearer <key>`

Both values are written to `localStorage` only (`requeue.dashboard.baseUrl`, `requeue.dashboard.apiKey`). They are never posted back to requeue-web.

The page then:

1. Checks `GET /health`
2. Lists events from `GET /v1/events` (Inbox filter = `failed` + `pending_replay`)
3. Loads `GET /v1/events/:id` when you select a row
4. Replays with `POST /v1/events/:id/replay`

### Against the hosted API

The live site at [https://getrequeue.com/app.html](https://getrequeue.com/app.html) defaults the API base URL to `https://api.getrequeue.com`.

1. Open the inbox (hosted or local).
2. Leave **API base URL** as `https://api.getrequeue.com`, or paste it if the field is empty.
3. Paste your API key.
4. Connect.

Quick health check from a terminal:

```bash
curl https://api.getrequeue.com/health
```

The hosted Pages site is HTTPS, so the API URL must also be HTTPS. The Worker already sends CORS headers, so the browser can call it directly.

### Against local Wrangler

Browsers block **HTTPS pages from calling HTTP APIs**. [https://getrequeue.com/app.html](https://getrequeue.com/app.html) cannot talk to `http://127.0.0.1:8787`. Serve this site locally instead.

In the [core repo](https://github.com/requeue-hq/requeue):

```bash
npm install
npm run db:migrate
npm run dev
```

Wrangler listens on `http://127.0.0.1:8787`. The first migration seeds this **local/demo** key — do not use it in production:

```
rq_demo_local_dev_only_do_not_use_in_prod
```

In this repo:

```bash
python3 -m http.server 8080
```

Open [http://localhost:8080/app.html](http://localhost:8080/app.html), then connect with:

| Field | Value |
| --- | --- |
| API base URL | `http://127.0.0.1:8787` |
| API key | `rq_demo_local_dev_only_do_not_use_in_prod` |

If the inbox is empty, create an endpoint and ingest a failure first (core README curl happy path, or the [JS SDK](https://github.com/requeue-hq/requeue-sdk-js)).

### Against your own Worker

1. Deploy the core API (`npm run deploy` in the core repo).
2. Open `/app.html` locally or at [https://getrequeue.com/app.html](https://getrequeue.com/app.html).
3. Paste the Worker URL (`https://….workers.dev` or your custom host) and your API key.
4. Connect.

Rotate the seeded demo key before any shared deploy.

## Waitlist

The waitlist form opens the visitor's email client to [maya.chen.yvr@agentmail.to](mailto:maya.chen.yvr@agentmail.to). Nothing is posted to a third-party form service.

## Stack

- Plain HTML, CSS, and small client-side scripts (`mailto` waitlist + `fetch` dashboard)
- Google Fonts (Instrument Serif, IBM Plex Sans, IBM Plex Mono)
- GitHub Pages from `main` / root, custom domain `getrequeue.com`
- Hosted API at `https://api.getrequeue.com`
- Dashboard credentials: browser `localStorage` only
