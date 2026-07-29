const test = require('node:test');
const assert = require('node:assert/strict');
const core = require('../js/collection-core.js');

const csv = `Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,ManaBox ID,Scryfall ID,Purchase price,Condition,Language,Purchase price currency,Added date
Main,collection,"Fire // Ice",MH2,Modern Horizons 2,290,normal,uncommon,2,1,sf-1,3.50,near_mint,en,AUD,2026-01-01
Main,collection,"Fire // Ice",MH2,Modern Horizons 2,290,normal,uncommon,1,1,sf-1,5.50,near_mint,en,AUD,2026-01-01
Trade,trade,"Fire // Ice",MH2,Modern Horizons 2,290,foil,uncommon,1,1,sf-1,,excellent,ja,AUD,2026-02-01
,collection,Sol Ring,CMM,Commander Masters,396,etched,uncommon,1,2,,12.00,near_mint,en,AUD,`;

test('ManaBox parser maps fields and preserves versions', () => {
  const result = core.parseManaBoxCSV(csv);
  assert.equal(result.errors.length, 0);
  assert.equal(result.cards.length, 3);
  assert.equal(result.cards[0].binderName, 'Main');
  assert.equal(result.cards[2].foil, 'etched');
});

test('duplicate rows merge quantities and weighted purchase price', () => {
  const result = core.parseManaBoxCSV(csv);
  assert.equal(result.duplicateRows, 1);
  assert.equal(result.cards[0].quantity, 3);
  assert.equal(result.cards[0].purchasePrice.toFixed(2), '4.17');
});

test('foil, etched and binder locations remain distinct', () => {
  const result = core.parseManaBoxCSV(csv);
  assert.equal(result.cards.filter(card => card.name === 'Fire // Ice').length, 2);
});

test('totals tolerate missing current prices', () => {
  const cards = core.parseManaBoxCSV(csv).cards;
  cards[0].currentPrice = 8;
  const totals = core.calculateTotals(cards);
  assert.equal(totals.quantity, 5);
  assert.equal(totals.uniqueCards, 2);
  assert.equal(totals.foils, 2);
  assert.ok(Number.isFinite(totals.estimatedValue));
});

test('deck parser supports set/collector and plain formats', () => {
  const deck = core.parseDeckList('1 Fire // Ice (MH2) 290\n2 Sol Ring\n# Sideboard');
  assert.deepEqual(deck[0], { quantity: 1, name: 'Fire // Ice', normalizedName: 'fire // ice', setCode: 'MH2', collectorNumber: '290' });
  assert.equal(deck[1].quantity, 2);
});

test('deck matching separates exact, alternative and missing copies', () => {
  const collection = core.parseManaBoxCSV(csv).cards;
  const deck = core.parseDeckList('2 Fire // Ice (MH2) 290\n2 Sol Ring');
  const match = core.matchDeckList(deck, collection);
  assert.equal(match.results[0].owned, 2);
  assert.equal(match.results[1].owned, 1);
  assert.equal(match.results[1].missing, 1);
  assert.equal(match.missing, 1);
});

test('quoted commas and escaped quotes parse correctly', () => {
  const rows = core.parseCSV("Name,Note\n\"Jace, Vryn's Prodigy\",\"said \"\"hello\"\"\"");
  assert.equal(rows[1][0], "Jace, Vryn's Prodigy");
  assert.equal(rows[1][1], 'said "hello"');
});

const monty = { id: 'monty', name: 'Monty’s Manor', shortName: 'Monty', badgeClass: 'owner-monty' };
const edward = { id: 'edward', name: 'Edward’s Exhibit', shortName: 'Edward', badgeClass: 'owner-edward' };
const ownerCsv = owner => `Binder Name,Binder Type,Name,Set code,Set name,Collector number,Foil,Rarity,Quantity,Scryfall ID,Condition,Language
${owner} Main,binder,Cyclonic Rift,CMM,Commander Masters,84,normal,rare,2,rift-1,near_mint,en
${owner} Trade,trade,Sol Ring,CMM,Commander Masters,396,foil,uncommon,1,ring-1,excellent,en`;
const montyCards = core.applyOwnerMetadata(core.parseManaBoxCSV(ownerCsv('Monty')).cards, monty);
const edwardCards = core.applyOwnerMetadata(core.parseManaBoxCSV(ownerCsv('Edward')).cards, edward);
const groupCards = [...montyCards, ...edwardCards];

test('owner metadata creates stable owner-specific collection item IDs', () => {
  assert.equal(montyCards[0].ownerName, 'Monty’s Manor');
  assert.notEqual(montyCards[0].collectionItemId, edwardCards[0].collectionItemId);
});

test('grouping combines names while retaining underlying owner records', () => {
  const groups = core.groupCardsByName(groupCards);
  const rift = groups.find(group => group.name === 'Cyclonic Rift');
  assert.equal(rift.quantity, 4);
  assert.equal(rift.ownerCount, 2);
  assert.equal(rift.records.length, 2);
  assert.deepEqual(rift.owners, { monty: 2, edward: 2 });
});

test('search includes owner, binder, set and card fields', () => {
  assert.equal(core.filterCards(groupCards, { search: 'Edward Trade' }).length, 1);
  assert.equal(core.filterCards(groupCards, { search: 'commander masters' }).length, 4);
});

test('combined filters apply owner, finish, condition and binder simultaneously', () => {
  const result = core.filterCards(groupCards, {
    ownerIds: ['edward'], finish: 'foil', condition: 'excellent', binders: ['Edward Trade']
  });
  assert.equal(result.length, 1);
  assert.equal(result[0].name, 'Sol Ring');
});

test('duplicate filtering uses group totals across owners', () => {
  const totals = new Map(core.groupCardsByName(groupCards).map(group => [group.key, group]));
  assert.equal(core.filterCards(groupCards, { duplicates: true }, { groupTotals: totals }).length, 4);
});

test('trade basket adds, combines and caps requested quantities', () => {
  let items = core.addBasketItem([], montyCards[0], 1);
  items = core.addBasketItem(items, montyCards[0], 2);
  assert.equal(items.length, 1);
  assert.equal(items[0].quantityRequested, 2);
  assert.equal(JSON.parse(JSON.stringify(items))[0].ownerId, 'monty');
});

test('trade basket removes items and groups them by owner', () => {
  let items = core.addBasketItem([], montyCards[0], 1);
  items = core.addBasketItem(items, edwardCards[1], 1);
  assert.equal(Object.keys(core.groupBasketByOwner(items)).length, 2);
  items = core.removeBasketItem(items, montyCards[0].collectionItemId);
  assert.equal(items.length, 1);
});

test('multi-library loading continues when a CSV is missing', async () => {
  const result = await core.loadCollections([monty, edward], async owner => {
    if (owner.id === 'edward') throw new Error('Collection not yet uploaded');
    return ownerCsv('Monty');
  });
  assert.equal(result.cards.length, 2);
  assert.equal(result.successes.length, 1);
  assert.equal(result.failures.length, 1);
  assert.equal(result.failures[0].owner.id, 'edward');
});

test('Scryfall USD prices convert to AUD exactly once', () => {
  assert.equal(core.convertUsdToAud(120.5, 1.4332), 172.7006);
  assert.equal(core.convertUsdToAud(null, 1.4332), 0);
  assert.equal(core.convertUsdToAud(10, 0), 0);
});

test('creature-type filtering matches only the subtype portion', () => {
  const cards = [
    { name: 'A', type_line: 'Legendary Creature — Vampire Noble', quantity: 1 },
    { name: 'B', type_line: 'Legendary Creature — Human Hero', quantity: 1 },
    { name: 'Heroic Spell', type_line: 'Instant', quantity: 1 }
  ];
  assert.deepEqual(core.filterCards(cards, { creatureType: 'Vampire' }).map(card => card.name), ['A']);
  assert.deepEqual(core.filterCards(cards, { creatureType: 'Hero' }).map(card => card.name), ['B']);
});

test('search matches both Universes Beyond flavor and Oracle names', () => {
  const cards = [{
    name: 'Roaming Throne', displayName: 'Doom Variant',
    flavorName: 'Doom Variant', oracleName: 'Roaming Throne', quantity: 1
  }];
  assert.equal(core.filterCards(cards, { search: 'Doom Variant' }).length, 1);
  assert.equal(core.filterCards(cards, { search: 'Roaming Throne' }).length, 1);
});

test('identical copies combine across owners but preserve meaningful versions', () => {
  const base = {
    name: 'Jennifer Walters // The Sensational She-Hulk',
    scryfallId: 'same-printing', setCode: 'MSH', collectorNumber: '388',
    foil: 'foil', language: 'en', condition: 'near_mint', quantity: 1
  };
  const groups = core.groupIdenticalCopies([
    { ...base, ownerId: 'monty', ownerName: 'Monty', binderName: 'marvel' },
    { ...base, ownerId: 'mitch', ownerName: 'Mitch', binderName: '' },
    { ...base, ownerId: 'mitch', ownerName: 'Mitch', foil: 'normal' }
  ]);
  assert.equal(groups.length, 2);
  assert.equal(groups.find(group => group.representative.foil === 'foil').quantity, 2);
  assert.equal(groups.find(group => group.representative.foil === 'foil').ownerCount, 2);
});

test('Scryfall session cache expires after one hour', () => {
  const values = new Map();
  const storage = {
    getItem: key => values.get(key) || null,
    setItem: (key, value) => values.set(key, value),
    removeItem: key => values.delete(key)
  };
  const now = 1_000_000;
  core.cacheScryfallCards([{ id: 'card-1', name: 'Cached Card', prices: { usd: '1.00' } }], storage, now);
  assert.equal(core.readCachedScryfall(['card-1'], storage, now + 3_599_999)['card-1'].name, 'Cached Card');
  assert.deepEqual(core.readCachedScryfall(['card-1'], storage, now + 3_600_000), {});
});
