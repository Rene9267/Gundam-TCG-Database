const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// === Config ===
const S3 = new S3Client({
  region: 'auto',
  endpoint: 'https://8a465eceddf3c07bb8fbe59384572e9c.r2.cloudflarestorage.com',
  credentials: {
    accessKeyId: 'f1488e0b53e4824f8d4d801437fbe96b',
    secretAccessKey: 'ff0c34e44b299f2f9047429a13196bdea6762b893936ce90b04b95cb0b560fa8',
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

  // Rigenera reference_cards.json con URL R2
  const publicUrl = `https://pub-f106953afafa4b379122130a0f038335.r2.dev`;
  const updated = refCards.map((rc) => ({
    ...rc,
    image_url: `${publicUrl}/${rc.card_code}.webp`,
  }));

  // Verifica se le URL sono cambiate
  const changed = updated.some((rc, i) => rc.image_url !== refCards[i].image_url);
  if (changed) {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(updated, null, 2), 'utf-8');
    console.log(`Updated reference_cards.json with R2 URLs`);
  } else {
    console.log(`No changes to reference_cards.json`);
  }
}

main().catch(console.error);
