(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MTGCollectionCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const FIELD_ALIASES = {
    binderName: ['binder name', 'binder', 'location'],
    binderType: ['binder type', 'location type'],
    name: ['name', 'card name'],
    setCode: ['set code', 'edition code', 'set'],
    setName: ['set name', 'edition'],
    collectorNumber: ['collector number', 'card number', 'number'],
    foil: ['foil', 'finish', 'printing'],
    rarity: ['rarity'],
    quantity: ['quantity', 'count', 'qty'],
    manaBoxId: ['manabox id', 'mana box id'],
    scryfallId: ['scryfall id', 'scryfallid'],
    purchasePrice: ['purchase price', 'price paid', 'price'],
    condition: ['condition'],
    language: ['language', 'lang'],
    currency: ['purchase price currency', 'currency'],
    addedDate: ['added date', 'date added', 'added'],
    currentPrice: ['current price', 'market price', 'scryfall price']
  };

  function parseCSV(text) {
    const rows = [];
    let row = [], value = '', quoted = false;
    const source = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      if (char === '"') {
        if (quoted && source[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (char === ',' && !quoted) {
        row.push(value); value = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && source[i + 1] === '\n') i++;
        row.push(value);
        if (row.some(cell => cell.trim())) rows.push(row);
        row = []; value = '';
      } else value += char;
    }
    if (value || row.length) { row.push(value); if (row.some(cell => cell.trim())) rows.push(row); }
    return rows;
  }

  const cleanHeader = value => String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
  const cleanFinish = value => {
    const finish = String(value || 'normal').toLowerCase();
    if (finish.includes('etched')) return 'etched';
    if (['true', 'yes', '1', 'foil'].includes(finish)) return 'foil';
    return 'normal';
  };
  const number = value => {
    const parsed = Number.parseFloat(String(value ?? '').replace(/[^\d.-]/g, ''));
    return Number.isFinite(parsed) ? parsed : 0;
  };

  function buildColumnMap(headers) {
    const normalized = headers.map(cleanHeader);
    return Object.fromEntries(Object.entries(FIELD_ALIASES).map(([key, aliases]) =>
      [key, normalized.findIndex(header => aliases.includes(header))]));
  }

  function parseManaBoxCSV(text, options = {}) {
    const rows = parseCSV(text);
    if (!rows.length) return { cards: [], errors: ['The CSV is empty.'], warnings: [], headers: [] };
    const headers = rows[0].map(value => value.trim());
    const col = buildColumnMap(headers);
    const errors = [];
    const warnings = [];
    if (col.name < 0) errors.push('Missing required Name column.');
    if (col.quantity < 0) warnings.push('Quantity column missing; each row defaults to one copy.');
    if (col.scryfallId < 0) warnings.push('Scryfall ID column missing; images and live metadata may be unavailable.');
    if (errors.length) return { cards: [], errors, warnings, headers };

    const get = (row, key) => col[key] >= 0 ? String(row[col[key]] || '').trim() : '';
    const byVersion = new Map();
    let duplicateRows = 0;
    rows.slice(1).forEach((row, rowIndex) => {
      const name = get(row, 'name');
      if (!name) { warnings.push(`Row ${rowIndex + 2} has no card name and was skipped.`); return; }
      const finish = cleanFinish(get(row, 'foil'));
      const quantity = Math.max(1, Math.trunc(number(get(row, 'quantity')) || 1));
      const purchasePrice = number(get(row, 'purchasePrice'));
      const card = {
        binderName: get(row, 'binderName'), binderType: get(row, 'binderType'),
        name, setCode: get(row, 'setCode').toUpperCase(), setName: get(row, 'setName'),
        collectorNumber: get(row, 'collectorNumber'), foil: finish,
        rarity: get(row, 'rarity').toLowerCase() || 'unknown', quantity,
        manaBoxId: get(row, 'manaBoxId'), scryfallId: get(row, 'scryfallId'),
        purchasePrice, price: purchasePrice, condition: get(row, 'condition'),
        language: get(row, 'language') || 'en', currency: get(row, 'currency') || options.defaultCurrency || 'AUD',
        addedDate: get(row, 'addedDate'), currentPrice: number(get(row, 'currentPrice')),
        sourceRows: [rowIndex + 2]
      };
      const identity = [card.scryfallId || card.manaBoxId || card.name.toLowerCase(), card.setCode, card.collectorNumber, finish,
        card.condition.toLowerCase(), card.language.toLowerCase(), card.binderName.toLowerCase(), card.currency].join('|');
      if (byVersion.has(identity)) {
        const existing = byVersion.get(identity);
        const totalQuantity = existing.quantity + quantity;
        existing.purchasePrice = ((existing.purchasePrice * existing.quantity) + (purchasePrice * quantity)) / totalQuantity;
        existing.price = existing.purchasePrice;
        existing.quantity = totalQuantity;
        existing.sourceRows.push(rowIndex + 2);
        duplicateRows++;
      } else byVersion.set(identity, card);
    });
    if (duplicateRows) warnings.push(`${duplicateRows} duplicate row${duplicateRows === 1 ? '' : 's'} merged by printing, finish, condition, language and binder.`);
    const cards = [...byVersion.values()];
    const missingIds = cards.filter(card => !card.scryfallId).length;
    if (missingIds) warnings.push(`${missingIds} card version${missingIds === 1 ? '' : 's'} missing a Scryfall ID.`);
    return { cards, errors, warnings, headers, duplicateRows };
  }

  function marketPrice(card) {
    if (Number.isFinite(card.currentPrice) && card.currentPrice > 0) return card.currentPrice;
    const prices = card.scryfallPrices || {};
    const raw = card.foil === 'etched' ? prices.usd_etched : card.foil === 'foil' ? prices.usd_foil : prices.usd;
    return number(raw);
  }

  function calculateTotals(cards) {
    const list = cards || [];
    const quantity = list.reduce((sum, card) => sum + card.quantity, 0);
    const purchaseCost = list.reduce((sum, card) => sum + number(card.purchasePrice) * card.quantity, 0);
    const estimatedValue = list.reduce((sum, card) => sum + marketPrice(card) * card.quantity, 0);
    const marketPricedQuantity = list.reduce((sum, card) => sum + (marketPrice(card) > 0 ? card.quantity : 0), 0);
    return {
      uniqueCards: new Set(list.map(card => (card.oracle_id || card.name).toLowerCase())).size,
      uniqueVersions: list.length, quantity, purchaseCost, estimatedValue,
      marketPricedQuantity, gainLoss: marketPricedQuantity ? estimatedValue - purchaseCost : null,
      foils: list.filter(card => card.foil !== 'normal').reduce((sum, card) => sum + card.quantity, 0),
      sets: new Set(list.map(card => card.setCode).filter(Boolean)).size,
      binders: new Set(list.map(card => card.binderName).filter(Boolean)).size
    };
  }

  function parseDeckList(text) {
    const cards = [];
    String(text || '').split(/\r?\n/).forEach(raw => {
      const line = raw.trim();
      if (!line || /^(\/\/|#|\[)/.test(line) || /^(commander|deck|sideboard|maybeboard)$/i.test(line)) return;
      const match = line.match(/^(\d+)\s*x?\s+(.+?)(?:\s+\(([A-Z0-9]+)\)\s+([^\s]+))?(?:\s+\*[Ff]?\*)?$/);
      if (!match) return;
      let name = match[2].trim().replace(/\s+\/\s+/g, ' // ');
      cards.push({ quantity: Number(match[1]), name, normalizedName: name.toLowerCase(), setCode: match[3] || '', collectorNumber: match[4] || '' });
    });
    return cards;
  }

  function matchDeckList(deck, collection) {
    const results = deck.map(wanted => {
      const versions = collection.filter(card => card.name.toLowerCase() === wanted.normalizedName || card.oracleName?.toLowerCase() === wanted.normalizedName);
      const exact = versions.filter(card => !wanted.setCode || (card.setCode === wanted.setCode && (!wanted.collectorNumber || card.collectorNumber === wanted.collectorNumber)));
      const owned = exact.reduce((sum, card) => sum + card.quantity, 0);
      const allOwned = versions.reduce((sum, card) => sum + card.quantity, 0);
      return { ...wanted, versions, exactVersions: exact, owned: Math.min(owned, wanted.quantity),
        alternativeOwned: Math.max(0, Math.min(allOwned - owned, wanted.quantity - owned)),
        missing: Math.max(0, wanted.quantity - allOwned) };
    });
    return { results, required: results.reduce((s, r) => s + r.quantity, 0), missing: results.reduce((s, r) => s + r.missing, 0) };
  }

  return { FIELD_ALIASES, parseCSV, buildColumnMap, parseManaBoxCSV, calculateTotals, parseDeckList, matchDeckList, marketPrice, cleanFinish };
});
