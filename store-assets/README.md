# Play Store assets

Marketing graphics for the Google Play listing.

## Feature graphic (1024 × 500 px, required by Play)

| File | Style |
|------|-------|
| `feature-graphic-dark.png` | Dark, premium look (gold card on espresso background) |
| `feature-graphic-light.png` | Light look (cream background, dark card) |

Pick one and upload it in **Play Console → Store listing → Graphics → Feature graphic**.
Both are exactly 1024 × 500 px, 24-bit PNG, with the app's palette and no text near the
edges (Play may crop the sides).

## Re-rendering after edits

The HTML sources are in `sources/`. Edit the HTML/CSS, then render with the bundled
Chromium (or any Chrome):

```bash
chrome --headless=new --hide-scrollbars --force-device-scale-factor=1 \
  --window-size=1024,500 \
  --screenshot=feature-graphic-dark.png \
  file://"$PWD"/sources/feature-graphic-dark.html
```

Keep `--window-size=1024,500` and `--force-device-scale-factor=1` so the output stays
exactly 1024 × 500.
