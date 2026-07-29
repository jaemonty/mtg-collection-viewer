# Arcane Archive

Arcane Archive is a static, framework-free Magic: The Gathering playgroup collection browser. It loads manually committed ManaBox CSV exports, shows who owns each card and builds a client-side trade-request list that can be copied, printed or screenshotted.

It remains compatible with GitHub Pages and uses no backend, database, account system, paid service or secret API key. Card metadata and images are progressively enriched through the public Scryfall API.

Based on the MIT-licensed [mtg-collection-viewer](https://github.com/pnz1990/mtg-collection-viewer). The original licence is preserved in `LICENSE`.

## Main pages

- `index.html` — focused homepage and library directory
- `all-collections.html` — every uploaded library, grouped by card name or shown by printing
- `library.html?owner=monty` — reusable single-library page
- `detail.html?id=SCRYFALL_ID` — card details and exact ownership records
- `trade-basket.html` — trade requests, shopping list, exports and screenshot mode
- `deck-checker.html` and selected older tools remain available under **Archived Tools**

## Collection files

Libraries are configured in `data/collections/index.json`:

| ID | Library | CSV |
|---|---|---|
| `monty` | Monty’s Manor | `data/collections/monty.csv` |
| `edward` | Edward’s Exhibit | `data/collections/edward.csv` |
| `luke` | Luke’s Library | `data/collections/luke.csv` |
| `mitch` | Mitch’s Museum | `data/collections/mitch.csv` |
| `sam` | Sam’s Sanctuary | `data/collections/sam.csv` |
| `daniel` | Daniel’s Delights | `data/collections/daniel.csv` |
| `jcjc` | JCJC’s Jewels | `data/collections/jcjc.csv` |

Missing files are expected until a friend’s collection is uploaded. The site labels that library **Collection not yet uploaded** and continues loading the others.

### Add or update a friend

1. Export and sanitise their collection from ManaBox.
2. Save it at the configured path in `data/collections/`.
3. If this is a new owner, add one entry to `data/collections/index.json`.
4. Run `npm test`.
5. Run `npm start`.
6. Test their `library.html?owner=OWNER_ID` page and `all-collections.html`.
7. Commit and push the changes.

No column reordering is required for normal ManaBox exports. The parser recognises common header aliases and keeps different owners, printings, finishes, conditions, languages and binders distinct.

## Local setup and testing

Requirements: Node.js 20 or newer.

```powershell
cd "C:\path\to\mtg-collection-viewer"
npm test
npm run check
npm start
```

Open:

```text
http://127.0.0.1:4173/
```

Do not open the HTML files directly from disk because browsers restrict CSV loading from `file://` URLs.

## Filters and ownership

The library and All Collections pages share one filtering implementation. Filters combine simultaneously and useful state is mirrored into the URL. All Collections can group by card name without merging the underlying ownership records. Owner badges always include text and link back to that owner’s library filtered to the card.

Scryfall metadata is loaded after basic ManaBox results are shown. Until enrichment completes, filters requiring Oracle text, type, colour or commander metadata may update as data arrives.

## Trade Request Basket and Shopping List

The Trade Request Basket stores a request for a specific owner and owned printing. Requested quantity cannot exceed the selected owner’s quantity. Adding the same ownership record twice increases its requested quantity instead of creating a duplicate.

Basket and Shopping List data are stored in browser `localStorage`:

- They survive refreshes on the same browser/device.
- They do not sync between devices.
- Clearing site data removes them.
- They are not written back to Git.

The basket can be copied as plain text or Markdown, downloaded as JSON or CSV, printed/saved as PDF, or displayed in a phone-friendly Screenshot Mode.

Ownership never implies availability. A **Likely trade binder** label is only an inference from configurable binder-name terms in `data/config.json`; users should still ask the owner.

## GitHub Pages deployment

`.github/workflows/deploy.yml` tests and deploys the static repository whenever `main` is updated.

1. Push a branch.
2. Open a pull request against `jaemonty/mtg-collection-viewer` → `main`.
3. Merge the pull request.
4. In repository **Settings → Pages**, use **GitHub Actions** as the source.
5. Check the **Actions** tab for the deployment result.

All internal asset and navigation paths are relative so the site works beneath:

```text
https://jaemonty.github.io/mtg-collection-viewer/
```

## Privacy warning

**Any CSV or JSON committed to this public repository can be downloaded by visitors.**

Before committing a friend’s export, remove anything they do not want public, including:

- Purchase prices or dates
- Personal notes
- Sensitive binder or storage names
- Addresses or other personal information
- Credentials and API keys

Client-side hiding controls and passwords do not secure publicly committed data. This project intentionally does not implement a misleading client-side login or password gate.

## Static-hosting limitations

- There are no permanent shareable basket URLs.
- Trade requests and shopping lists are device-specific.
- Owners must provide updated CSV exports manually.
- Scryfall or exchange-rate outages can temporarily leave images, metadata or prices unavailable.
- The site does not claim that owned cards are available for trade and does not execute transactions.

## Licence

MIT. See `LICENSE`.
