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
