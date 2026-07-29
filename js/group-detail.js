(async function () {
  const Core = window.MTGCollectionCore;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char]));
  const query = new URLSearchParams(location.search);
  const id = query.get('id');
  const wanted = (query.get('name') || '').toLowerCase();
  const basketKey = 'mtg-trade-basket-v1';

  const [owners, config] = await Promise.all([
    fetch('data/collections/index.json').then(response => response.json()),
    fetch('data/config.json').then(response => response.json())
  ]);
  const records = (await Promise.all(owners.map(async owner => {
    try {
      const response = await fetch(owner.file, { cache: 'no-store' });
      if (!response.ok) return [];
      const parsed = Core.parseManaBoxCSV(await response.text());
      return Core.applyOwnerMetadata(parsed.cards, owner)
        .filter(card => (id && card.scryfallId === id) || (!id && card.name.toLowerCase() === wanted));
    } catch (_) { return []; }
  }))).flat();

  let meta = id ? Core.readCachedScryfall([id])[id] || null : null;
  try {
    if (!meta) {
      const endpoint = id
        ? `https://api.scryfall.com/cards/${encodeURIComponent(id)}`
        : `https://api.scryfall.com/cards/named?exact=${encodeURIComponent(query.get('name') || '')}`;
      const response = await fetch(endpoint);
      if (response.ok) {
        meta = await response.json();
        Core.cacheScryfallCards([meta]);
      }
    }
  } catch (_) {}

  let usdToAud = Number(localStorage.getItem('mtg-usd-aud-rate')) || Number(config.fallbackUsdToAudRate) || 1.5346;
  try {
    const response = await fetch('https://api.frankfurter.dev/v2/rate/USD/AUD');
    const rate = response.ok ? Number((await response.json()).rate) : 0;
    if (rate > 0) usdToAud = rate;
  } catch (_) {}

  const oracleName = meta?.name || records[0]?.name || 'Card not found';
  const flavorName = meta?.flavor_name || '';
  const name = flavorName || oracleName;
  const faces = meta?.card_faces?.filter(face => face.image_uris) || [];
  const faceData = faces.length ? faces : [{
    name,
    image_uris: meta?.image_uris,
    oracle_text: meta?.oracle_text,
    type_line: meta?.type_line
  }];
  const images = faceData.map(face => face.image_uris?.large || face.image_uris?.normal).filter(Boolean);
  const typeLine = meta?.type_line || faceData.map(face => face.type_line).filter(Boolean).join(' // ');
  const oracleHtml = faceData.map(face => `
    ${faceData.length > 1 ? `<h3>${esc(face.name)}</h3>` : ''}
    <p>${esc(face.oracle_text || 'Oracle text unavailable.').replaceAll('\n', '<br>')}</p>`).join('');
  const quantity = records.reduce((sum, card) => sum + card.quantity, 0);
  const priceFor = card => {
    const prices = meta?.prices || {};
    const usd = card.foil === 'etched' ? prices.usd_etched : card.foil === 'foil' ? prices.usd_foil : prices.usd;
    return Core.convertUsdToAud(usd, usdToAud);
  };
  const totalValue = records.reduce((sum, card) => sum + priceFor(card) * card.quantity, 0);
  const money = `A$${new Intl.NumberFormat('en-AU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(totalValue)}`;
  const finishes = [...new Set(records.map(card => card.foil).filter(Boolean))].join(', ') || 'Unknown';
  const conditions = [...new Set(records.map(card => card.condition).filter(Boolean))].map(value => value.replaceAll('_', ' ')).join(', ') || 'Unknown';
  const legalities = Object.entries(meta?.legalities || {}).filter(([, status]) => status !== 'not_legal');
  const primaryName = flavorName || faceData[0]?.name || name.split(' // ')[0];
  const oraclePrimaryName = faceData[0]?.name || oracleName.split(' // ')[0];
  const cardSlug = oraclePrimaryName.toLowerCase().replace(/'/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const mtgmateName = encodeURIComponent(primaryName.replaceAll(' ', '_'));
  const mtgmateSet = encodeURIComponent((meta?.set || records[0]?.setCode || '').toUpperCase());
  const mtgmateCollector = encodeURIComponent(meta?.collector_number || records[0]?.collectorNumber || '');
  const mtgmateFinish = records.some(card => card.foil === 'etched') ? ':etched'
    : records.some(card => card.foil === 'foil') ? ':foil' : '';
  const mtgmateUrl = `https://www.mtgmate.com.au/cards/${mtgmateName}/${mtgmateSet}/${mtgmateCollector}${mtgmateFinish}`;

  document.title = `${name} — Arcane Archive`;
  $('detail-container').innerHTML = `
    <button class="detail-back" type="button" id="detail-back">← Back to collection</button>
    <section class="archive-detail">
      <div class="archive-detail-media">
        <img id="detail-card-face" class="detail-face" src="${esc(images[0] || 'images/back.png')}" alt="${esc(faceData[0]?.name || name)}">
        ${faceData.length > 1 ? `<div class="face-switcher" aria-label="Card faces">${faceData.map((face, index) =>
          `<button type="button" data-face-index="${index}" class="${index === 0 ? 'active' : ''}">${index === 0 ? 'Front' : 'Back'} · ${esc(face.name)}</button>`).join('')}</div>` : ''}
      </div>
      <div class="archive-detail-info">
        <p class="eyebrow">CARD DETAILS</p>
        <h1>${esc(name)}</h1>
        <section class="collection-summary">
          <h2>Your playgroup collection</h2>
          <dl><div><dt>Quantity</dt><dd>${quantity}</dd></div><div><dt>Estimated value</dt><dd>${totalValue ? money : 'Unavailable'}</dd></div>
          <div><dt>Finish</dt><dd>${esc(finishes)}</dd></div><div><dt>Condition</dt><dd>${esc(conditions)}</dd></div></dl>
        </section>
        <p class="detail-type-line">${esc(typeLine)}</p>
        <section class="oracle-panel"><h2>Oracle text</h2>${oracleHtml}</section>
        <section class="card-meta-panel">
          <dl>${flavorName ? `<div><dt>Original card</dt><dd>${esc(oracleName)}</dd></div>` : ''}<div><dt>Set</dt><dd>${esc(meta?.set_name || records[0]?.setName || 'Unknown')} (${esc((meta?.set || records[0]?.setCode || '').toUpperCase())} #${esc(meta?.collector_number || records[0]?.collectorNumber || '')})</dd></div>
          <div><dt>Rarity</dt><dd><span class="preview-tag rarity-${esc(meta?.rarity || records[0]?.rarity || '')}">${esc(meta?.rarity || records[0]?.rarity || 'Unknown')}</span></dd></div>
          <div><dt>Artist</dt><dd>${esc(meta?.artist || faceData.map(face => face.artist).filter(Boolean).join(' & ') || 'Unknown')}</dd></div></dl>
        </section>
        ${legalities.length ? `<section class="detail-legalities"><h2>Format legality</h2><div>${legalities.map(([format, status]) =>
          `<span><strong>${esc(format.replaceAll('_', ' '))}</strong><small>${esc(status.replaceAll('_', ' '))}</small></span>`).join('')}</div></section>` : ''}
        <section class="external-links">
          <h2>Explore</h2>
          <div class="link-buttons">
            <a href="${esc(meta?.scryfall_uri || `https://scryfall.com/search?q=${encodeURIComponent(primaryName)}`)}" target="_blank" rel="noopener" class="ext-btn scryfall">Scryfall</a>
            <a href="https://edhrec.com/cards/${esc(cardSlug)}" target="_blank" rel="noopener" class="ext-btn edhrec">EDHRec</a>
            <a href="https://commanderspellbook.com/search/?q=${encodeURIComponent(oraclePrimaryName)}" target="_blank" rel="noopener" class="ext-btn spellbook">Combos</a>
            <a href="https://www.mtggoldfish.com/price/${encodeURIComponent((meta?.set || records[0]?.setCode || '').toUpperCase())}/${encodeURIComponent(oraclePrimaryName.replace(/'/g, ''))}" target="_blank" rel="noopener" class="ext-btn goldfish">MTGGoldfish</a>
            <a href="${esc(mtgmateUrl)}" target="_blank" rel="noopener" class="ext-btn mtgmate">MTGmate</a>
            <a href="https://www.reddit.com/r/magicTCG/search?q=${encodeURIComponent(primaryName)}&restrict_sr=1" target="_blank" rel="noopener" class="ext-btn reddit">Reddit</a>
          </div>
        </section>
        <section class="ownership-section"><h2>Who owns this card</h2>${records.map(card => {
          const owner = owners.find(item => item.id === card.ownerId);
          const trade = Core.isLikelyTradeBinder(card, config.tradeBinderTerms || []);
          return `<article class="ownership-row"><span class="owner-badge ${owner?.badgeClass || ''}">${esc(card.ownerName)}</span>
            <dl><dt>Quantity</dt><dd>${card.quantity}</dd><dt>Printing</dt><dd>${esc(card.setCode)} #${esc(card.collectorNumber)}</dd>
            <dt>Finish</dt><dd>${esc(card.foil)}</dd><dt>Condition</dt><dd>${esc((card.condition || 'Unknown').replaceAll('_', ' '))}</dd>
            <dt>Binder</dt><dd>${esc(card.binderName || 'No binder')}${trade ? ' — likely trade binder (inferred)' : ''}</dd></dl>
            <button class="trade-add" data-add="${esc(card.collectionItemId)}">Add this copy to Trade Basket</button></article>`;
        }).join('') || '<p>No uploaded library owns this card.</p>'}</section>
      </div>
    </section>`;

  $('detail-back').onclick = () => history.back();
  document.querySelectorAll('[data-face-index]').forEach(button => button.onclick = () => {
    const index = Number(button.dataset.faceIndex);
    $('detail-card-face').src = images[index];
    $('detail-card-face').alt = faceData[index].name;
    document.querySelectorAll('[data-face-index]').forEach(item => item.classList.toggle('active', item === button));
  });
  document.querySelectorAll('[data-add]').forEach(button => button.onclick = () => {
    const card = records.find(item => item.collectionItemId === button.dataset.add);
    if (!card) return;
    let basket = [];
    try { basket = JSON.parse(localStorage.getItem(basketKey) || '[]'); } catch (_) {}
    if (basket.some(item => item.collectionItemId === card.collectionItemId)) {
      $('live-region').textContent = 'This copy is already in the Trade Basket. Change its quantity there.';
      return;
    }
    basket = Core.addBasketItem(basket, { ...card, imageUri: images[0] || '', currentPrice: priceFor(card) }, 1);
    localStorage.setItem(basketKey, JSON.stringify(basket));
    button.disabled = true;
    button.textContent = 'Added to Trade Basket';
    document.querySelectorAll('[data-basket-count]').forEach(element => {
      element.textContent = basket.reduce((sum, item) => sum + item.quantityRequested, 0);
    });
    $('live-region').textContent = 'Added to Trade Basket.';
  });
  let basket = [];
  try { basket = JSON.parse(localStorage.getItem(basketKey) || '[]'); } catch (_) {}
  document.querySelectorAll('[data-add]').forEach(button => {
    if (basket.some(item => item.collectionItemId === button.dataset.add)) {
      button.disabled = true;
      button.textContent = 'Added to Trade Basket';
    }
  });
  document.querySelectorAll('[data-basket-count]').forEach(element => {
    element.textContent = basket.reduce((sum, item) => sum + item.quantityRequested, 0);
  });
})();
