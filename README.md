# Arcane Archive — Personal MTG Collection Dashboard

A static, privacy-conscious Magic: The Gathering collection dashboard built for ManaBox CSV exports and GitHub Pages. It preserves the original collection explorer, binder, carousel, timeline, detail view, deck checker, trade calculator, wishlist, trade binder, trivia, guessing game and game tracker while adding richer collection analytics and deterministic Commander tools.

## Attribution and licence

This project extends [pnz1990/mtg-collection-viewer](https://github.com/pnz1990/mtg-collection-viewer) and the existing jaemonty fork. Original work and this derivative remain available under the [MIT License](LICENSE). Card data and images are provided by [Scryfall](https://scryfall.com/); Magic: The Gathering is owned by Wizards of the Coast.

## Local setup

Requirements: Git and a current Node.js release.

```bash
git clone https://github.com/jaemonty/mtg-collection-viewer.git
cd mtg-collection-viewer
npm test
npm start
```

Open `http://localhost:4173/`. Do not open the HTML files directly with `file://`; browsers block CSV and JSON loading in that mode.

## Replace or update the ManaBox collection

1. Export the collection from ManaBox as CSV.
2. Keep the export headers unchanged.
3. Replace `data/Collection.csv` with the new export.
4. Run `npm test`, then `npm start` and check the dashboard.
5. Commit and push the replacement.

The parser accepts common ManaBox aliases and reads: Binder Name, Binder Type, Name, Set code, Set name, Collector number, Foil, Rarity, Quantity, ManaBox ID, Scryfall ID, Purchase price, Condition, Language, Purchase price currency and Added date. Extra columns are ignored safely. Exact repeated rows are merged; printing, finish, condition, language and binder differences stay separate.

## Prices and Scryfall

- **Purchase cost** is the recorded ManaBox purchase price multiplied by quantity.
- **Estimated market value** uses cached Scryfall printing prices where loaded. Missing prices are treated as unavailable/zero, never as an error.
- Scryfall publishes USD prices. No automatic AUD exchange conversion is performed. The UI clearly labels the source/currency.
- “Load Full Data” batches card identifiers through Scryfall's collection endpoint (75 per request), caches responses in IndexedDB and pauses between batches.

## Collection and privacy configuration

Edit `data/config.json` to update configurable franchise set-code groups, recent/high-value thresholds and public defaults. Display and privacy toggles are also available in the dashboard and persist locally.

**Important:** client-side settings and a client-side password only change what the interface shows. They do not secure committed files. Any CSV or JSON committed to a public GitHub repository can be downloaded by visitors. Do not commit addresses, credentials, API keys or other personal information. Use a private repository with appropriate Pages access, or remove sensitive columns before committing, if the data must remain private.

## Deck tools

- `deck-checker.html` imports Moxfield/ManaBox/plain lists and reports owned versus missing versions.
- `commander-builder.html` deterministically analyses owned legal cards by commander colour identity, Oracle text, keywords and creature types. Results are suggestions, not authoritative deck advice.
- `decks.html` provides configurable pages for Hosts of Mordor, Eternal Might, Blood Rites, and Food and Fellowship.

Deck files live in `data/decks/`. Add entries to `mainboard`, `removed`, `sideboard` and `wishlist`, then keep `data/decks/index.json` updated. Example:

```json
{
  "name": "Hosts of Mordor",
  "commander": "Sauron, Lord of the Rings",
  "mainboard": [
    { "quantity": 1, "name": "Sol Ring", "setCode": "LTC", "collectorNumber": "284" }
  ],
  "removed": [],
  "sideboard": [],
  "wishlist": []
}
```

## Tests

```bash
npm test
npm run check
```

The Node tests cover quoted CSV fields, ManaBox aliases, duplicate merging, distinct finishes, collection totals, missing prices, deck-list parsing and exact/alternative/missing matching. The original browser suite remains at `test/index.html`.

## GitHub Pages deployment

The workflow at `.github/workflows/deploy.yml` tests and publishes the repository root whenever `main` is pushed. All site-owned asset links are relative, so the site works below `/mtg-collection-viewer/`.

1. Push this project to a GitHub repository.
2. Open **Settings → Pages**.
3. Under **Build and deployment**, select **GitHub Actions** as the source.
4. Open **Actions**, select the latest **Deploy** run and wait for it to complete.
5. Visit `https://<username>.github.io/mtg-collection-viewer/`.

To commit and push:

```bash
git status
git add .
git commit -m "Build personal MTG collection dashboard"
git push origin main
```

## Static-hosting limitations

- There is no backend, database server or secret store.
- Browser storage is per-device and can be cleared.
- Scryfall availability and browser/network limits affect live metadata refresh.
- Scryfall prices are estimates and may be missing; they are not appraisals.
- Deterministic Commander categories are text-pattern suggestions and can misclassify unusual cards.
- Empty starter deck JSON files show zero metrics until deck lists are added.
- Partner/background commanders are visible when present, but the helper currently analyses one selected commander at a time; configure combined-identity deck lists manually.
- Token cards are retained in the collection browser but excluded from candidate Commander lists.

## Project structure

The project remains framework-free and static. Main additions are:

- `js/collection-core.js` — reusable parser, totals and deck matcher
- `js/dashboard.js` — dashboard metrics, presets, privacy and organisation filters
- `commander-builder.html` / `js/commander-builder.js`
- `decks.html` / `js/decks.js`
- `data/config.json` and `data/decks/`
- `test/core.test.js` and `scripts/validate-static.js`
