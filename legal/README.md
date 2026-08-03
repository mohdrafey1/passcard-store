# Passcard Store — Legal & Info Site

Static, self-contained HTML/CSS pages for the Google Play listing requirements:

| Page | File | Purpose |
|------|------|---------|
| Home | `index.html` | About the app, Play Store link, links to the pages below |
| Privacy Policy | `privacy-policy.html` | Required by Google Play |
| Terms & Conditions | `terms.html` | Terms of use |
| Contact & Data Deletion | `contact.html` | Required "account/data deletion" URL |

All pages share `styles.css`. There are **no external dependencies** — no CDNs, fonts,
or images — so they work anywhere and load instantly. Light and dark mode are both
supported automatically.

## Hosting with GitHub Pages (free)

1. Push this repo to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source = Deploy from a branch**, pick your
   branch and the `/ (root)` folder, then **Save**.
4. After a minute your pages are live at:

   - Home: `https://mohdrafey1.github.io/passcard-store/legal/index.html`
   - Privacy: `https://mohdrafey1.github.io/passcard-store/legal/privacy-policy.html`
   - Terms: `https://mohdrafey1.github.io/passcard-store/legal/terms.html`
   - Contact/Deletion: `https://mohdrafey1.github.io/passcard-store/legal/contact.html`

Use the **Privacy** URL in the Play Console *Store listing → Privacy policy* field, and
the **Contact/Deletion** URL in *App content → Data deletion*.

> Tip: If you want cleaner URLs, put these files in the repo root (or a `docs/` folder
> and set Pages to serve `docs/`), or point a custom domain at GitHub Pages.

## Things to customize

Search the files for these and update if needed:

- **Contact email** — currently `mohdrafey600@gmail.com`.
- **Play Store URL** — `https://play.google.com/store/apps/details?id=com.mohdrafey1.passcardstore`
  (this is the correct link for your package id and goes live once the app is published).
- **Governing law** in `terms.html` — currently set to India.
- **Developer name** — currently `mohdrafey1`.
