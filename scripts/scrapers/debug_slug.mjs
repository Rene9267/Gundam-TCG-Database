import https from 'https';

function slugify(name) {
  return name
    .toLowerCase()
    .replace(/[()',]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const names = [
  'Gundam',
  'Gundam (MA Form)',
  'Guncannon',
  'Guntank',
  'GM',
  'Gundam Aerial (Permet Score Six)',
  'Gundam Aerial (Bit on Form)',
  'Demi Trainer',
  'Zowort',
  'Amuro Ray',
  'Suletta Mercury',
  "Kai's Resolve",
  'Unforeseen Incident',
  'White Base',
  'Asticassia School of Technology, Earth House'
];

for (const n of names) {
  const s = slugify(n);
  console.log(`${n} -> ${s}-c-st-01-heroic-beginnings`);
}

// Test actual fetch
const url = 'https://www.cardtrader.com/en/cards/gundam-lr-st-01-heroic-beginnings';
console.log(`\nTesting: ${url}`);
https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, timeout: 10000 }, (res) => {
  console.log(`Status: ${res.statusCode}`);
  let d = '';
  res.on('data', (c) => d += c);
  res.on('end', () => {
    const m = d.match(/<meta\s+property="og:url"\s+content="[^"]*\/cards\/(\d+)/i);
    console.log(`Match: ${m ? m[1] : 'none'}`);
    console.log(`Title: ${d.match(/<title>([^<]+)/i)?.[1] || 'none'}`);
  });
}).on('error', (e) => console.log('Error:', e.message));
