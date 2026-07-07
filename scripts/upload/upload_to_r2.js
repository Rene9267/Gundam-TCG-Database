const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

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

// === Helpers ===
function fetch(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks)));
    }).on('error', reject);
  });
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
  // Dobbiamo caricare UN'immagine per card_code (alcune si ripetono?)
  const unique = {};
  for (const rc of refCards) {
    if (!unique[rc.card_code]) unique[rc.card_code] = rc;
  }

  const codes = Object.keys(unique).sort();
  console.log(`Total cards in JSON: ${refCards.length}`);
  console.log(`Unique card codes: ${codes.length}`);

  let uploaded = 0;
  let skipped = 0;
  let failed = 0;

  for (let i = 0; i < codes.length; i++) {
    const code = codes[i];
    const url = `${IMAGE_BASE}/${code}.webp`;

    // Controlla se già presente
    const exists = await imageExists(code);
    if (exists) {
      skipped++;
      continue;
    }

    try {
      const buffer = await fetch(url);
      await uploadImage(code, buffer);
      uploaded++;
    } catch (err) {
      failed++;
      console.error(`\n✗ ${code}: ${err.message}`);
    }

    if (i % 50 === 0 || i === codes.length - 1) {
      console.log(`[${i + 1}/${codes.length}] Uploaded: ${uploaded} | Skipped: ${skipped} | Failed: ${failed}`);
    }

    // Rispetta il server Bandai — 500ms tra le richieste
    await new Promise((r) => setTimeout(r, 500));
  }

  console.log(`\n\nDone! Uploaded: ${uploaded}, Skipped: ${skipped}, Failed: ${failed}`);

  // Aggiorna reference_cards.json (le image_url sono ormai derivate al runtime)
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(refCards, null, 2), 'utf-8');
  console.log(`Verified reference_cards.json`);
}

main().catch(console.error);
