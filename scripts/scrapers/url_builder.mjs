const CARDTRADER_BASE = 'https://www.cardtrader.com';

export function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[()',]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function computeSetSlug(setCode, setName) {
  const codeSlug = setCode.toLowerCase().slice(0, 2) + '-' + setCode.toLowerCase().slice(2);
  const namePart = setName.replace(/\[.*?\]$/, '').trim();
  const nameSlug = slugify(namePart);
  return `${codeSlug}-${nameSlug}`;
}

export function computeCardSlug(cardName, setSlug) {
  return `${slugify(cardName)}-${setSlug}`;
}

export function computeVariantSlug(cardName, rarity, setSlug) {
  return rarity ? `${slugify(cardName)}-${rarity}-${setSlug}` : computeCardSlug(cardName, setSlug);
}

export function buildCardtraderUrl(slug, lang = 'en') {
  return `${CARDTRADER_BASE}/${lang}/cards/${slug}`;
}

export function buildCardtraderSearchUrl(cardCode, lang = 'en') {
  const query = cardCode.replace(/-/g, '+');
  return `${CARDTRADER_BASE}/${lang}/cards?search=${query}`;
}

export function buildCardImageUrl(cardCode) {
  return `https://pub-f106953afafa4b379122130a0f038335.r2.dev/${cardCode}.webp`;
}
