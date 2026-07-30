(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  root.MTGExploreLinks = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const text = value => String(value ?? '');
  const slug = value => text(value).toLowerCase().replace(/'/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

  function getCanonicalCardName(card = {}) {
    const scryfall = card.scryfall || card.scryfallCard || {};
    const candidate = card.oracleName || card.canonicalName || card.originalName ||
      card.oraclePrimaryName || scryfall.oracleName || scryfall.canonicalName ||
      scryfall.originalName || scryfall.name || card.name || card.primaryName ||
      card.displayName || card.flavorName;
    return text(candidate).trim() || text(card.name || card.primaryName).trim();
  }

  function mtgMateSlug(value) {
    const frontName = text(value).split(/\s+\/\/\s+/)[0].trim();
    return encodeURIComponent(frontName.replace(/\s+/g, '_'));
  }

  function normalizeCard(card = {}) {
    const primaryName = card.primaryName || card.displayName || card.flavorName ||
      text(card.name).split(' // ')[0];
    const canonicalName = getCanonicalCardName(card);
    const oraclePrimaryName = card.oraclePrimaryName || canonicalName ||
      text(card.name).split(' // ')[0];
    return {
      ...card,
      primaryName,
      canonicalName,
      oraclePrimaryName: text(oraclePrimaryName).split(' // ')[0],
      setCode: text(card.setCode || card.set).toUpperCase(),
      collectorNumber: text(card.collectorNumber || card.collector_number),
      finish: card.finish || card.foil || 'normal',
      scryfallUri: card.scryfallUri || card.scryfall_uri || ''
    };
  }

  const exploreDestinations = [
    {
      id: 'scryfall', label: 'Scryfall',
      getUrl: card => card.scryfallUri || `https://scryfall.com/search?q=${encodeURIComponent(card.primaryName)}`
    },
    {
      id: 'edhrec', label: 'EDHRec',
      getUrl: card => `https://edhrec.com/cards/${slug(card.oraclePrimaryName)}`
    },
    {
      id: 'combos', label: 'Combos',
      getUrl: card => `https://commanderspellbook.com/search/?q=${encodeURIComponent(card.oraclePrimaryName)}`
    },
    {
      id: 'mtggoldfish', label: 'MTGGoldfish',
      getUrl: card => `https://www.mtggoldfish.com/price/${encodeURIComponent(card.setCode)}/${encodeURIComponent(card.oraclePrimaryName.replace(/'/g, ''))}`
    },
    {
      id: 'mtgmate', label: 'MTGMate',
      getUrl: card => {
        const finishName = text(card.finish).toLowerCase();
        const finish = finishName === 'etched' ? ':etched' : finishName === 'foil' ? ':foil' : '';
        return `https://www.mtgmate.com.au/cards/${mtgMateSlug(card.canonicalName)}/${encodeURIComponent(card.setCode)}/${encodeURIComponent(card.collectorNumber)}${finish}`;
      }
    },
    {
      id: 'reddit', label: 'Reddit',
      getUrl: card => `https://www.reddit.com/r/magicTCG/search?q=${encodeURIComponent(card.primaryName)}&restrict_sr=1`
    },
    {
      id: 'ebay-au', label: 'eBay Australia',
      getUrl: card => `https://www.ebay.com.au/sch/i.html?_nkw=${encodeURIComponent(card.primaryName)}`
    }
  ];

  function getExploreLinks(card, ids) {
    const normalized = normalizeCard(card);
    const wanted = ids ? new Set(ids) : null;
    return exploreDestinations.filter(item => !wanted || wanted.has(item.id))
      .map(item => ({ id: item.id, label: item.label, url: item.getUrl(normalized) }));
  }

  function escapeHtml(value) {
    return text(value).replace(/[&<>"']/g, char => ({
      '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
    }[char]));
  }

  function renderQuickMenu(card) {
    return `<div class="quick-explore-heading">Explore</div>${getExploreLinks(card).map(link =>
      `<a role="menuitem" class="quick-explore-link quick-${link.id}" href="${escapeHtml(link.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(link.label)}</a>`
    ).join('')}`;
  }

  function renderQuickButton(card, id) {
    const name = normalizeCard(card).primaryName;
    return `<button type="button" class="quick-explore-toggle" data-quick-explore="${escapeHtml(id)}" aria-label="Quick explore ${escapeHtml(name)}" title="Quick explore ${escapeHtml(name)}" aria-haspopup="menu" aria-expanded="false">⋮</button>`;
  }

  return {
    exploreDestinations, normalizeCard, getCanonicalCardName, mtgMateSlug,
    getExploreLinks, renderQuickMenu, renderQuickButton, slug
  };
});
