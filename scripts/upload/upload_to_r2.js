const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ENV_PATH = path.join(__dirname, '.env');

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) return;
  const lines = fs.readFileSync(ENV_PATH, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (key && process.env[key] == null) process.env[key] = value;
  }
}

function parseSetArg() {
  const eq = process.argv.find(a => a.startsWith('--set='));
  if (eq) return eq.split('=')[1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  const idx = process.argv.indexOf('--set');
  if (idx !== -1 && process.argv[idx + 1]) {
    return process.argv[idx + 1].split(',').map(s => s.trim().toUpperCase()).filter(Boolean);
  }
  return null;
}

loadEnvFile();

// === Config ===
// Le credenziali R2 DEVONO essere fornite tramite variabili d'ambiente.
// Non inserire mai secret in chiaro nel codice.
// Esempio (.env o shell):
//   R2_ACCOUNT_ID=8a465eceddf3c07bb8fbe59384572e9c
//   R2_ACCESS_KEY_ID=...
//   R2_SECRET_ACCESS_KEY=...
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;

if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
  console.error('Credenziali R2 mancanti. Esporta R2_ACCOUNT_ID, R2_ACCESS_KEY_ID e R2_SECRET_ACCESS_KEY.');
  console.error(`Oppure crea ${ENV_PATH} (vedi .env.example).`);
  process.exit(1);
}

const S3 = new S3Client({
  region: 'auto',
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = 'gundam-cards';
const IMAGE_BASE = 'https://www.gundam-gcg.com/en/images/cards/card';
const REF_CARDS_PATH = path.join(__dirname, '..', '..', 'reference_cards.json');
const OUTPUT_PATH = path.join(__dirname, '..', '..', 'reference_cards.json');

function fetchFollow(url, redirects = 0) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        const loc = res.headers.location.startsWith('http')
          ? res.headers.location
          : `https://www.cardtrader.com${res.headers.location}`;
        res.resume();
        if (redirects < 5) fetchFollow(loc, redirects + 1).then(resolve).catch(reject);
        else reject(new Error(`Too many redirects for ${url}`));
        return;
      }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
}

function extractCardtraderImageUrl(html) {
  const m = html.match(/src="(\/uploads\/blueprints\/image\/[^"]+)"/);
  return m ? `https://www.cardtrader.com${m[1]}` : null;
}

async function fetchCardtraderImage(blueprintId) {
  const html = await fetchFollow(`https://www.cardtrader.com/en/cards/${blueprintId}`);
  const imageUrl = extractCardtraderImageUrl(html.toString('utf-8'));
  if (!imageUrl) throw new Error(`No CardTrader image for blueprint ${blueprintId}`);
  return fetchFollow(imageUrl);
}

function isOfficialCardCode(code) {
  return !/_(?:beta|reprint|event|stp|winner|championship|other)(\d+)?$/i.test(code);
}

function collectUploadTargets(refCards, setFilter) {
  const targets = new Map();

  for (const rc of refCards) {
    if (setFilter?.length && !setFilter.includes(rc.set_code)) continue;

    if (!targets.has(rc.card_code)) {
      targets.set(rc.card_code, {
        code: rc.card_code,
        official: isOfficialCardCode(rc.card_code),
        cardtrader_id: rc.cardtrader_id || null,
      });
    }

    if (rc.printings?.length) {
      for (const p of rc.printings) {
        if (!targets.has(p.printing_id)) {
          targets.set(p.printing_id, {
            code: p.printing_id,
            official: isOfficialCardCode(p.printing_id),
            cardtrader_id: p.cardtrader_id || null,
          });
        }
      }
    }
  }

  return [...targets.values()].sort((a, b) => a.code.localeCompare(b.code));
}

async function imageExists(cardCode) {
  try {
    await S3.send(new HeadObjectCommand({ Bucket: BUCKET, Key: `${cardCode}.webp` }));
    return true;
  } catch (e) {
    return false;
  }
}

async function uploadImage(cardCode, buffer) {
  await S3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: `${cardCode}.webp`,
    Body: buffer,
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  }));
}

// === Main ===
async function main() {
  const refCards = JSON.parse(fs.readFileSync(REF_CARDS_PATH, 'utf-8'));
  const setFilter = parseSetArg();
  const targets = collectUploadTargets(refCards, setFilter);

  console.log(`Total cards in JSON: ${refCards.length}`);
  console.log(`Upload targets: ${targets.length}`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < targets.length; i++) {
    const target = targets[i];
    const code = target.code;

    const exists = await imageExists(code);
    if (exists) {
      skipped++;
      continue;
    }

    try {
      let buffer;
      if (target.official) {
        buffer = await fetchFollow(`${IMAGE_BASE}/${code}.webp`);
      } else if (target.cardtrader_id) {
        buffer = await fetchCardtraderImage(target.cardtrader_id);
      } else {
        throw new Error('No official or CardTrader source');
      }
      await uploadImage(code, buffer);
      uploaded++;
    } catch (err) {
      failed++;
      console.error(`\n✗ ${code}: ${err.message}`);
    }

    if (i % 50 === 0 || i === targets.length - 1) {
      console.log(`[${i + 1}/${targets.length}] Uploaded: ${uploaded} | Skipped: ${skipped} | Failed: ${failed}`);
    }

    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n\nDone! Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`);

  // Aggiorna reference_cards.json (le image_url sono ormai derivate al runtime)
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(refCards, null, 2), 'utf-8');
  console.log(`Verified reference_cards.json`);
}

main().catch(console.error);
