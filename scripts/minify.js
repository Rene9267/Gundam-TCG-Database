const fs = require('fs');
const path = require('path');

const SRC_DIR = path.resolve(__dirname, '..');
const OUT_DIR = path.join(SRC_DIR, '_minified');

const FILES = [
  'app.js','style.css','index.html','service-worker.js',
  'js/app.js','js/auth.js','js/cards.js','js/cardtrader.js',
  'js/collection.js','js/config.js','js/dashboard.js','js/menu.js',
  'js/reference.js','js/sheet.js','js/state.js','js/supabase.js','js/utils.js',
  'scripts/scrapers/scrape_cards.js','scripts/scrapers/enrich_rarity.js',
  'scripts/upload/upload_to_r2.js','supabase/functions/cardtrader-proxy/index.ts'
];

const SHIM = `const gid=(i)=>document.getElementById(i),qsa=(s)=>document.querySelectorAll(s),qs=(s)=>document.querySelector(s),jp=JSON.parse,js=JSON.stringify,ns=Set,nu=URL,nusp=URLSearchParams,mm=Math.min,mx=Math.max,mr=Math.round,Af=Array.from,MP=Math.PI,Ok=Object.keys,Ov=Object.values;Element.prototype.ael=Element.prototype.addEventListener;`;

const REPLACEMENTS = [
  [/document\.getElementById\(/g, 'gid('],
  [/document\.querySelectorAll\(/g, 'qsa('],
  [/document\.querySelector\(/g, 'qs('],
  [/JSON\.parse\(/g, 'jp('],
  [/JSON\.stringify\(/g, 'js('],
  [/new Set\(/g, 'ns('],
  [/new URL\(/g, 'nu('],
  [/new URLSearchParams\(/g, 'nusp('],
  [/Math\.min\(/g, 'mm('],
  [/Math\.max\(/g, 'mx('],
  [/Math\.round\(/g, 'mr('],
  [/Math\.PI/g, 'MP'],
  [/Math\.random\(\)/g, 'mr()'],
  [/Date\.now\(\)/g, 'Dn()'],
  [/Array\.from\(/g, 'Af('],
  [/Object\.keys\(/g, 'Ok('],
  [/Object\.values\(/g, 'Ov('],
  [/Object\.assign\(/g, 'Oa('],
  [/textContent/g, '_t'],
  [/innerHTML/g, '_h'],
  [/\.addEventListener\(/g, '.ael('],
  [/throw new Error\(/g, 'te('],
  [/console\.\w+\([^)]*\)/g, ''],
  [/\}\s*else\s*\{/g, '}'],
  [/function /g, 'fn '],
  [/async /g, 'a '],
  [/await /g, 'aw '],
  [/return /g, 'r '],
  [/const /g, 'c '],
  [/let /g, 'l '],
  [/var /g, 'v '],
  [/\bundefined\b/g, 'u'],
  [/\bnull\b/g, 'n'],
  [/\btrue\b/g, '!0'],
  [/\bfalse\b/g, '!1'],
  [/===/g, '=='],
  [/!==/g, '!='],
  [/\.toLowerCase\(\)/g, '.lc()'],
  [/\.trim\(\)/g, '.tr()'],
  [/\.includes\(/g, '.inc('],
  [/\.startsWith\(/g, '.ss('],
  [/\.replace\(/g, '.rp('],
  [/\.match\(/g, '.mch('],
  [/\.split\(/g, '.spl('],
  [/\.join\(/g, '.jn('],
  [/\.catch\(/g, '.ctch('],
  [/\.finally\(/g, '.fnly('],
  [/\.then\(/g, '.thn('],
  [/\.filter\(/g, '.flt('],
  [/\.map\(/g, '.mp('],
  [/\.forEach\(/g, '.fe('],
  [/\.some\(/g, '.sm('],
  [/\.find\(/g, '.fnd('],
  [/\.reduce\(/g, '.rd('],
  [/\.sort\(/g, '.srt('],
  [/\.slice\(/g, '.sl(']
];

const RENAME_RULES = {
  currentUser: '_cu', accessToken: '_at', currentColTab: '_cct',
  refCards: '_rc', refCardByCode: '_rcc', setTotals: '_st',
  setOrder: '_so', allCards: '_ac', activeFilters: '_af',
  cardTypeFilters: '_ctf', colorFilters: '_cf', levelRange: '_lr',
  costRange: '_cr', nameFirstSet: '_nfs', cardAltInfo: '_cai',
  authMode: '_am', pendingSheetQty: '_psq', searchTimeout: '_sto',
  SUPABASE_URL: '_SU', SUPABASE_ANON_KEY: '_SAK', CARD_IMAGE_BASE: '_CIB'
};

function minifyJS(c) {
  c = c.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
  c = c.replace(/\sstyle="[^"]*"/g, '');
  for (const [re, rep] of REPLACEMENTS) c = c.replace(re, rep);
  return c;
}

function minifyCSS(c) {
  c = c.replace(/\/\*[\s\S]*?\*\//g, '');
  c = c.replace(/\s*{\s*/g, '{').replace(/\s*}\s*/g, '}')
       .replace(/\s*:\s*/g, ':').replace(/\s*;\s*/g, ';')
       .replace(/\s*,\s*/g, ',').replace(/;\}/g, '}')
       .replace(/;+/g, ';');
  return c;
}

function minifyHTML(c) {
  c = c.replace(/<!--[\s\S]*?-->/g, '');
  c = c.replace(/\sstyle="[^"]*"/g, '');
  c = c.replace(/>\s+</g, '><');
  return c;
}

function compressWhitespace(c) {
  c = c.replace(/[ \t]+(\r?\n)/g, '$1');
  c = c.replace(/(\r?\n)[ \t]*(\r?\n)/g, '$1$2');
  c = c.replace(/^(\r?\n)+/, '');
  c = c.replace(/(\r?\n){3,}/g, '$1$2');
  return c;
}

function renameIdentifiers(c) {
  const keys = Object.keys(RENAME_RULES).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    const re = new RegExp('\\b' + k + '\\b', 'g');
    c = c.replace(re, RENAME_RULES[k]);
  }
  return c;
}

// Main
let totalOrig = 0, totalMin = 0;

// Create output directories
for (const f of FILES) {
  const outPath = path.join(OUT_DIR, f.replace(/\.\w+$/, '.min$&'));
  const dir = path.dirname(outPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

for (const relPath of FILES) {
  const fullPath = path.join(SRC_DIR, relPath);
  if (!fs.existsSync(fullPath)) { console.error('NOT FOUND:', relPath); continue; }

  const orig = fs.readFileSync(fullPath, 'utf8');
  const origLen = orig.length;
  const ext = path.extname(relPath).slice(1);
  const type = ext === 'ts' ? 'js' : ext;

  let c = orig;
  if (type === 'js') c = minifyJS(c);
  else if (type === 'css') c = minifyCSS(c);
  else if (type === 'html') c = minifyHTML(c);

  c = compressWhitespace(c);
  c = renameIdentifiers(c);

  const saved = origLen - c.length;
  let result = c;
  if (saved > 200 && type === 'js') result = SHIM + c;

  const outRel = relPath.replace(/\.\w+$/, '.min.$&');
  const outPath = path.join(OUT_DIR, outRel);
  fs.writeFileSync(outPath, result, 'utf8');

  const minLen = result.length;
  totalOrig += origLen;
  totalMin += minLen;
  const pct = ((origLen - minLen) / origLen * 100).toFixed(1);
  console.log(`${relPath.padEnd(45)} ${String(origLen).padStart(6)} → ${String(minLen).padStart(6)}  (${pct}%)`);
}

const totalPct = ((totalOrig - totalMin) / totalOrig * 100).toFixed(1);
console.log('\n========================================');
console.log(`TOTAL: ${totalOrig} → ${totalMin} bytes (${totalPct}% saved)`);
console.log('========================================');
console.log(`Output: ${OUT_DIR}`);
