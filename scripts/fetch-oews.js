/**
 * fetch-oews.js
 * Downloads the annual OEWS (Occupational Employment and Wage Statistics) data from BLS.
 *
 * BLS publishes OEWS data as Excel files at:
 *   https://www.bls.gov/oes/special-requests/oesm{YY}all.zip
 *
 * This script:
 * 1. Downloads the latest OEWS Excel file (all data, all ownerships)
 * 2. Parses relevant sheets (national, state, metro)
 * 3. Saves raw parsed data to data/raw/oews-raw.json
 *
 * No API key required — uses BLS bulk download files.
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const TEMP_DIR = path.join(__dirname, '..', 'data', 'temp');

// OEWS data year — update annually when BLS publishes new data
const OEWS_YEAR = process.env.OEWS_YEAR || '2023';
const OEWS_YY = OEWS_YEAR.slice(-2);

// BLS publishes OEWS as Excel files
// Format: https://www.bls.gov/oes/special-requests/oesm{YY}all.zip
const OEWS_URL = `https://www.bls.gov/oes/special-requests/oesm${OEWS_YY}all.zip`;

// Alternative: use the research estimates Excel directly
const OEWS_EXCEL_URL = `https://www.bls.gov/oes/special-requests/oesm${OEWS_YY}all.zip`;

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Download a file with retries
 */
async function downloadFile(url, destPath, attempt = 1) {
  console.log(`  Downloading ${url} (attempt ${attempt})...`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LaborCompare-DataPipeline/1.0 (research use)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(destPath, buffer);
    console.log(`  Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
    return destPath;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`  Retry ${attempt}/${MAX_RETRIES}: ${err.message}`);
      await sleep(RETRY_DELAY_MS);
      return downloadFile(url, destPath, attempt + 1);
    }
    throw err;
  }
}

/**
 * Parse OEWS Excel data using xlsx library
 * The OEWS "all data" file contains one large sheet with columns:
 *   AREA, AREA_TITLE, AREA_TYPE, NAICS, NAICS_TITLE, I_GROUP, OWN_CODE,
 *   OCC_CODE, OCC_TITLE, O_GROUP, TOT_EMP, EMP_PRSE, JOBS_1000,
 *   LOC_QUOTIENT, PCT_TOTAL, H_MEAN, A_MEAN, MEAN_PRSE,
 *   H_PCT10, H_PCT25, H_MEDIAN, H_PCT75, H_PCT90,
 *   A_PCT10, A_PCT25, A_MEDIAN, A_PCT75, A_PCT90
 */
function parseOEWSData(xlsxPath) {
  // Dynamic import since xlsx is optional dependency
  let XLSX;
  try {
    XLSX = await import('xlsx');
    if (XLSX.default) XLSX = XLSX.default;
  } catch {
    // Fallback: try require
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    XLSX = require('xlsx');
  }

  console.log('  Parsing Excel file...');
  const workbook = XLSX.readFile(xlsxPath, { type: 'file' });

  // The main data sheet is usually the first (or "All data")
  const sheetName = workbook.SheetNames.find(n =>
    n.toLowerCase().includes('all') || n.toLowerCase().includes('data')
  ) || workbook.SheetNames[0];

  console.log(`  Using sheet: "${sheetName}"`);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  console.log(`  Parsed ${rows.length} rows`);
  return rows;
}

/**
 * Clean and normalize a single OEWS row
 */
function normalizeRow(row) {
  const parseNum = (val) => {
    if (val === undefined || val === null || val === '' || val === '**' || val === '#' || val === '*') return null;
    const s = String(val).replace(/,/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  };

  return {
    area: String(row.AREA || row.area || '').trim(),
    area_title: String(row.AREA_TITLE || row.area_title || '').trim(),
    area_type: parseNum(row.AREA_TYPE || row.area_type),
    occ_code: String(row.OCC_CODE || row.occ_code || '').trim(),
    occ_title: String(row.OCC_TITLE || row.occ_title || '').trim(),
    o_group: String(row.O_GROUP || row.o_group || '').trim(),
    tot_emp: parseNum(row.TOT_EMP || row.tot_emp),
    jobs_1000: parseNum(row.JOBS_1000 || row.jobs_1000),
    loc_quotient: parseNum(row.LOC_QUOTIENT || row.loc_quotient),
    h_mean: parseNum(row.H_MEAN || row.h_mean),
    a_mean: parseNum(row.A_MEAN || row.a_mean),
    h_median: parseNum(row.H_MEDIAN || row.h_median),
    a_median: parseNum(row.A_MEDIAN || row.a_median),
    h_pct10: parseNum(row.H_PCT10 || row.h_pct10),
    h_pct25: parseNum(row.H_PCT25 || row.h_pct25),
    h_pct75: parseNum(row.H_PCT75 || row.h_pct75),
    h_pct90: parseNum(row.H_PCT90 || row.h_pct90),
    a_pct10: parseNum(row.A_PCT10 || row.a_pct10),
    a_pct25: parseNum(row.A_PCT25 || row.a_pct25),
    a_pct75: parseNum(row.A_PCT75 || row.a_pct75),
    a_pct90: parseNum(row.A_PCT90 || row.a_pct90),
    own_code: parseNum(row.OWN_CODE || row.own_code),
    naics: String(row.NAICS || row.naics || '').trim(),
    naics_title: String(row.NAICS_TITLE || row.naics_title || '').trim(),
    i_group: String(row.I_GROUP || row.i_group || '').trim()
  };
}

/**
 * Filter to cross-industry, all-ownerships detailed occupations
 * AREA_TYPE: 1=nation, 2=state, 3=metro, 4=nonmetro, 6=county (rare)
 * OWN_CODE: 1235=all ownerships (cross-ownership)
 * I_GROUP: "cross_industry" or NAICS="000000"
 * O_GROUP: "detailed" for specific occupations, "major"/"minor"/"broad"/"total" for groups
 */
function filterRelevantRows(rows) {
  return rows.filter(r => {
    // Cross-industry totals only (NAICS 000000 or i_group cross-industry)
    const isCrossIndustry = r.naics === '000000' || r.i_group === 'cross_industry';
    // All ownerships
    const isAllOwnership = r.own_code === 1235 || r.own_code === null;
    // Nation, state, or metro areas only
    const isRelevantArea = [1, 2, 3].includes(r.area_type);
    // Detailed occupations (not groups/totals) — but keep major for hierarchy
    const isOccupation = r.o_group === 'detailed' || r.o_group === 'major' || r.o_group === 'broad';

    return isCrossIndustry && isRelevantArea && isOccupation;
  });
}

/**
 * Unzip a file using system tools
 */
function unzipFile(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  try {
    // Try unzip command first (Linux/Mac)
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'pipe' });
  } catch {
    try {
      // Try python as fallback
      execSync(`python3 -c "import zipfile; zipfile.ZipFile('${zipPath}').extractall('${destDir}')"`, { stdio: 'pipe' });
    } catch {
      try {
        execSync(`python -c "import zipfile; zipfile.ZipFile('${zipPath}').extractall('${destDir}')"`, { stdio: 'pipe' });
      } catch {
        throw new Error('Cannot unzip: no unzip, python3, or python available');
      }
    }
  }
}

// Make parseOEWSData async-compatible
async function parseOEWSDataAsync(xlsxPath) {
  let XLSX;
  try {
    XLSX = (await import('xlsx')).default || (await import('xlsx'));
  } catch {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    XLSX = require('xlsx');
  }

  console.log('  Parsing Excel file...');
  const workbook = XLSX.readFile(xlsxPath, { type: 'file' });

  const sheetName = workbook.SheetNames.find(n =>
    n.toLowerCase().includes('all') || n.toLowerCase().includes('data')
  ) || workbook.SheetNames[0];

  console.log(`  Using sheet: "${sheetName}"`);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  console.log(`  Parsed ${rows.length} rows`);
  return rows;
}

async function main() {
  console.log(`\n=== Fetching OEWS ${OEWS_YEAR} Data ===\n`);

  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });

  const zipPath = path.join(TEMP_DIR, `oesm${OEWS_YY}all.zip`);
  const extractDir = path.join(TEMP_DIR, 'oews');

  // Step 1: Download ZIP
  console.log('Step 1: Downloading OEWS data...');
  await downloadFile(OEWS_URL, zipPath);

  // Step 2: Extract
  console.log('\nStep 2: Extracting ZIP...');
  unzipFile(zipPath, extractDir);

  // Find the Excel file in extracted contents
  const { readdirSync } = await import('fs');
  const files = readdirSync(extractDir);
  const xlsxFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
  if (!xlsxFile) {
    throw new Error(`No Excel file found in ZIP. Contents: ${files.join(', ')}`);
  }
  const xlsxPath = path.join(extractDir, xlsxFile);
  console.log(`  Found: ${xlsxFile}`);

  // Step 3: Parse Excel
  console.log('\nStep 3: Parsing OEWS Excel data...');
  const rawRows = await parseOEWSDataAsync(xlsxPath);

  // Step 4: Normalize
  console.log('\nStep 4: Normalizing rows...');
  const normalized = rawRows.map(normalizeRow);
  console.log(`  Normalized ${normalized.length} rows`);

  // Step 5: Filter
  console.log('\nStep 5: Filtering to relevant data...');
  const filtered = filterRelevantRows(normalized);
  console.log(`  Kept ${filtered.length} rows (cross-industry, nation/state/metro, detailed occupations)`);

  // Step 6: Save
  const outputPath = path.join(RAW_DIR, 'oews-raw.json');
  console.log(`\nStep 6: Saving to ${outputPath}...`);
  writeFileSync(outputPath, JSON.stringify({
    year: OEWS_YEAR,
    source: 'BLS Occupational Employment and Wage Statistics',
    url: OEWS_URL,
    fetched: new Date().toISOString(),
    count: filtered.length,
    data: filtered
  }, null, 2));
  console.log(`  Saved ${filtered.length} records`);

  // Cleanup temp files
  try {
    unlinkSync(zipPath);
    const { rmSync } = await import('fs');
    rmSync(extractDir, { recursive: true });
    rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch {
    console.log('  (temp cleanup skipped)');
  }

  // Summary
  const areas = new Set(filtered.map(r => r.area));
  const occs = new Set(filtered.map(r => r.occ_code));
  console.log(`\n=== OEWS Fetch Complete ===`);
  console.log(`  ${occs.size} unique occupations`);
  console.log(`  ${areas.size} unique areas`);
  console.log(`  ${filtered.length} total records`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
