# 🎫 Encore — Concert Ticket Price Tracker

A **Progressive Web App** for tracking concert ticket prices across multiple
platforms (Ticketmaster, StubHub, SeatGeek, Live Nation, AXS, Vivid Seats and
more). Pick your show, set a target price, watch the trend, and get a
**notification the moment your seats drop** to the price you want.

Encore is fully static, installable, and works offline — your data never leaves
your device.

## ✨ Features

- **Track any concert** — capture the artist, **date**, **venue / location**,
  **specific seats or section**, and the **platform** you're buying on.
- **Multi-platform** — log prices from Ticketmaster, StubHub, SeatGeek, AXS,
  Live Nation, Vivid Seats, or anywhere else.
- **Target price alerts** — set the price you're willing to pay and Encore
  fires a **push notification** (via the Web Notifications API) when a tracked
  ticket hits or drops below it.
- **Price history & trends** — every price you log is charted with sparklines,
  a full history graph, lowest-seen price, and percentage change.
- **Beautiful, aesthetic UI** — animated aurora background, glassmorphism
  cards, light/dark themes, and smooth micro-interactions.
- **Installable PWA** — add it to your home screen; it launches full-screen and
  works **offline** thanks to a service worker.
- **Private by design** — all trackers are stored locally in your browser
  (`localStorage`). No accounts, no servers, no tracking of *you*.

## 🚀 Live app

Once GitHub Pages is enabled for this repository, the app is served from:

```
https://<your-username>.github.io/<repo-name>/
```

## 🛠️ Running locally

No build step required — it's plain HTML, CSS and JavaScript. Just serve the
folder over HTTP (a service worker needs `http`/`https`, not `file://`):

```bash
# Python
python3 -m http.server 8080

# or Node
npx serve .
```

Then open <http://localhost:8080>.

## 📦 Deploying to GitHub Pages

This repo ships a workflow at `.github/workflows/deploy.yml` that publishes the
site automatically on every push to **`main`**.

1. Push the app to the `main` branch.
2. In **Settings → Pages**, set **Source** to **GitHub Actions**.
3. The workflow builds and deploys; your app goes live at the URL above.

## 📁 Project structure

```
.
├── index.html              # App shell & markup
├── manifest.webmanifest    # PWA manifest (name, icons, theme)
├── sw.js                   # Service worker (offline cache + notifications)
├── css/
│   └── style.css           # Theme, layout, components
├── js/
│   ├── store.js            # Data model & localStorage persistence
│   ├── notifications.js    # Web Notifications / price alerts
│   └── app.js              # UI controller, charts, market simulation
├── icons/                  # PWA icons (any + maskable)
└── .github/workflows/      # GitHub Pages deployment
```

## 🔔 A note on live prices

Encore is a **static** web app, so it can't legally scrape or call
Ticketmaster/StubHub pricing APIs from the browser (they require server-side
keys and forbid cross-origin access). Instead you **log the prices you see**,
and Encore does the tracking, charting, and alerting for you.

Use the **“Refresh”** button to run a market simulation — it nudges each
tracker's price with a realistic random walk so you can see the trend lines
move and watch the target-price alerts fire. The code is structured so a real
price feed (via your own backend/proxy) could drop straight into
`Store.logPrice()`.

---

Built as a Progressive Web App. 🎶
