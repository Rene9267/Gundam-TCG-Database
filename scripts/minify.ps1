$srcDir = "C:\WorkSpace\Projects\Personal\Web\Gundam-TCG-Database"
$outDir = "$srcDir\_minified"
New-Item -ItemType Directory -Path $outDir -Force | Out-Null
if (-not (Get-Command 'node' -ErrorAction SilentlyContinue)) {
    Write-Host "Node.js required. Install from https://nodejs.org"
    exit 1
}

$files = @(
    "app.js","style.css","index.html","service-worker.js",
    "js/app.js","js/auth.js","js/cards.js","js/cardtrader.js",
    "js/collection.js","js/config.js","js/dashboard.js","js/menu.js",
    "js/reference.js","js/sheet.js","js/state.js","js/supabase.js","js/utils.js",
    "scripts/scrapers/scrape_cards.js","scripts/scrapers/enrich_rarity.js",
    "scripts/upload/upload_to_r2.js","supabase/functions/cardtrader-proxy/index.ts"
)

$shimPrefix = 'const gid=(i)=>document.getElementById(i),qsa=(s)=>document.querySelectorAll(s),qs=(s)=>document.querySelector(s),jp=JSON.parse,js=JSON.stringify,ns=Set,nu=URL,nusp=URLSearchParams,mm=Math.min,mx=Math.max,mr=Math.round,Af=Array.from,MP=Math.PI,Ok=Object.keys,Ov=Object.values;Element.prototype.ael=Element.prototype.addEventListener;'

New-Item -ItemType Directory -Path (Join-Path $outDir "js") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir "scripts\scrapers") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir "scripts\upload") -Force | Out-Null
New-Item -ItemType Directory -Path (Join-Path $outDir "supabase\functions\cardtrader-proxy") -Force | Out-Null

$totalOrig = 0; $totalMin = 0; $report = @()

# Build replacement rules as JSON for Node.js
$jsReplacements = @"
[
["document\\.getElementById\\(","gid("],
["document\\.querySelectorAll\\(","qsa("],
["document\\.querySelector\\(","qs("],
["JSON\\.parse\\(","jp("],
["JSON\\.stringify\\(","js("],
["new Set\\(","ns("],
["new URL\\(","nu("],
["new URLSearchParams\\(","nusp("],
["Math\\.min\\(","mm("],
["Math\\.max\\(","mx("],
["Math\\.round\\(","mr("],
["Math\\.PI","MP"],
["Math\\.random\\(\\)","mr()"],
["Date\\.now\\(\\)","Dn()"],
["Array\\.from\\(","Af("],
["Object\\.keys\\(","Ok("],
["Object\\.values\\(","Ov("],
["Object\\.assign\\(","Oa("],
["textContent","_t"],
["innerHTML","_h"],
["\\.addEventListener\\(",".ael("],
["console\\.\\w+\\(",""],
["throw new Error\\(","te("],
["function ","fn "],
["async ","a "],
["await ","aw "],
["return ","r "],
["undefined","u"],
["null","n"],
["true","!0"],
["false","!1"],
["} else {","}"],
["===","=="],
["!==","!="],
["!= !==","!=="],
["const ","c "],
["let ","l "],
["var ","v "],
["\\.toLowerCase\\(\\)",".lc()"],
["\\.trim\\(\\)",".tr()"],
["\\.includes\\(",".inc("],
["\\.startsWith\\(",".ss("],
["\\.replace\\(",".rp("],
["\\.match\\(",".mch("],
["\\.split\\(",".spl("],
["\\.join\\(",".jn("],
["\\.catch\\(",".ctch("],
["\\.finally\\(",".fnly("],
["\\.then\\(",".thn("],
["\\.filter\\(",".flt("],
["\\.map\\(",".mp("],
["\\.forEach\\(",".fe("],
["\\.some\\(",".sm("],
["\\.find\\(",".fnd("],
["\\.reduce\\(",".rd("],
["\\.sort\\(",".srt("],
["\\.slice\\(",".sl("]
]
"@

$renameRules = @"
{
"currentUser":"_cu","accessToken":"_at","currentColTab":"_cct",
"refCards":"_rc","refCardByCode":"_rcc","setTotals":"_st",
"setOrder":"_so","allCards":"_ac","activeFilters":"_af",
"cardTypeFilters":"_ctf","colorFilters":"_cf","levelRange":"_lr",
"costRange":"_cr","nameFirstSet":"_nfs","cardAltInfo":"_cai",
"authMode":"_am","pendingSheetQty":"_psq","searchTimeout":"_sto",
"SUPABASE_URL":"_SU","SUPABASE_ANON_KEY":"_SAK","CARD_IMAGE_BASE":"_CIB"
}
"@

# Write Node.js minifier script
$nodeScript = @"
const fs = require('fs');
const path = require('path');

const REPLACEMENTS = $jsReplacements;
const RENAME_RULES = $renameRules;
const SHIM = $($(Get-Content (Join-Path $srcDir "scripts") -ErrorAction SilentlyContinue) -join "`n")'$shimPrefix';

const args = process.argv.slice(2);
const [inFile, outFile, fileType] = args;
const orig = fs.readFileSync(inFile, 'utf8');
let origLen = orig.length;

// Strip comments
let c = orig;
if (fileType === 'js' || fileType === 'ts') {
    c = c.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    // Strip inline styles
    c = c.replace(/\sstyle="[^"]*"/g, '');
    // Apply replacements
    for (const [pat, rep] of REPLACEMENTS) {
        c = c.replace(new RegExp(pat, 'g'), rep);
    }
} else if (fileType === 'css') {
    c = c.replace(/\/\*[\s\S]*?\*\//g, '');
    c = c.replace(/\s*{\s*/g, '{').replace(/\s*}\s*/g, '}')
         .replace(/\s*:\s*/g, ':').replace(/\s*;\s*/g, ';')
         .replace(/\s*,\s*/g, ',').replace(/;\}/g, '}')
         .replace(/;+/g, ';').replace(/\}\s*/g, '}');
} else if (fileType === 'html') {
    c = c.replace(/<!--[\s\S]*?-->/g, '');
    c = c.replace(/\sstyle="[^"]*"/g, '');
    c = c.replace(/>\s+</g, '><');
}

// Whitespace compression
c = c.replace(/[ \t]+(\r?\n)/g, '$1');
c = c.replace(/(\r?\n)[\t ]*(\r?\n)/g, '$1$2');
c = c.replace(/^(\r?\n)+/, '');
c = c.replace(/(\r?\n){3,}/g, '$1$2');

// Rename verbose identifiers
for (const [k, v] of Object.entries(RENAME_RULES)) {
    c = c.replace(new RegExp('\\\\b' + k + '\\\\b', 'g'), v);
}

// Add shim if content is large enough
const saved = origLen - c.length;
let result = c;
if (saved > 200 && (fileType === 'js' || fileType === 'ts')) {
    result = SHIM + c;
}

fs.writeFileSync(outFile, result, 'utf8');
console.log(JSON.stringify({file: path.basename(inFile), orig: origLen, min: result.length}));
"@

$nodeScript | Out-File -FilePath (Join-Path $outDir "_minify.js") -Encoding utf8

foreach ($relPath in $files) {
    $fullPath = Join-Path $srcDir $relPath
    if (!(Test-Path $fullPath)) { Write-Warning "NOT FOUND: $relPath"; continue }
    
    $ext = [System.IO.Path]::GetExtension($relPath).TrimStart('.')
    if ($ext -eq 'ts') { $ext = 'ts' }
    elseif ($ext -eq 'css') { $ext = 'css' }
    elseif ($ext -eq 'html') { $ext = 'html' }
    else { $ext = 'js' }
    
    $outRel = $relPath -replace '\.\w+$', '.min.$&'
    $outPath = Join-Path $outDir $outRel
    
    $result = node (Join-Path $outDir "_minify.js") $fullPath $outPath $ext 2>&1
    $parsed = $result | ConvertFrom-Json
    
    $totalOrig += $parsed.orig
    $totalMin += $parsed.min
    $savedPct = [math]::Round(($parsed.orig - $parsed.min) / $parsed.orig * 100, 1)
    $report += [PSCustomObject]@{File=$relPath; Original=$parsed.orig; Minified=$parsed.min; Saved="$savedPct%"}
}

$totalSavedPct = [math]::Round(($totalOrig - $totalMin) / $totalOrig * 100, 1)
Write-Host "`n=== MINIFICATION REPORT ==="
$report | Format-Table -AutoSize
Write-Host "Total Original: $totalOrig bytes"
Write-Host "Total Minified: $totalMin bytes"
Write-Host "Total Saved: $totalSavedPct%"
Write-Host "`nOutput directory: $outDir"
