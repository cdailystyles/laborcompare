/**
 * fetch-oews.js
 * Downloads the annual OEWS (Occupational Employment and Wage Statistics) data from BLS.
 *
 * BLS publishes OEWS data as separate Excel files:
 *   National: https://www.bls.gov/oes/special-requests/oesm{YY}nat.zip (~1MB)
 *   State:    https://www.bls.gov/oes/special-requests/oesm{YY}st.zip  (~3MB)
 *   Metro:    https://www.bls.gov/oes/special-requests/oesm{YY}ma.zip  (~8MB)
 *
 * These are MUCH smaller than the all-data file (76MB) and contain only
 * cross-industry data — exactly what we need.
 *
 * This script:
 * 1. Auto-detects the latest available OEWS year (or uses OEWS_YEAR env var)
 * 2. Downloads national, state, and metro Excel files
 * 3. Parses all ~830 detailed occupations across all areas
 * 4. Saves raw parsed data to data/raw/oews-raw.json
 *
 * No API key required — uses BLS bulk download files.
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync, readFileSync, statSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const TEMP_DIR = path.join(__dirname, '..', 'data', 'temp');
const OEWS_DIR = path.join(__dirname, '..', 'data', 'oews');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

// The three file types we download (cross-industry, much smaller than "all")
const FILE_TYPES = [
  { suffix: 'nat', label: 'National', areaType: 1 },
  { suffix: 'st',  label: 'State',    areaType: 2 },
  { suffix: 'ma',  label: 'Metro',    areaType: 3 },
];

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine the OEWS year to fetch.
 * BLS publishes May {YEAR} data around March/April of the following year.
 */
function getTargetYears() {
  if (process.env.OEWS_YEAR) {
    return [process.env.OEWS_YEAR];
  }
  const currentYear = new Date().getFullYear();
  return [String(currentYear - 1), String(currentYear - 2)];
}

/**
 * Build download URL for a specific file type and year
 */
function getOEWSUrl(year, suffix) {
  const yy = year.slice(-2);
  return `https://www.bls.gov/oes/special-requests/oesm${yy}${suffix}.zip`;
}

/**
 * Download a file with retries
 */
async function downloadFile(url, destPath, attempt = 1) {
  console.log(`    Downloading ${url} (attempt ${attempt})...`);
  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'LaborCompare-DataPipeline/1.0 (https://laborcompare.com; research use)'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    writeFileSync(destPath, buffer);
    console.log(`    Downloaded ${(buffer.length / 1024 / 1024).toFixed(1)} MB`);
    return destPath;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`    Retry ${attempt}/${MAX_RETRIES}: ${err.message}`);
      await sleep(RETRY_DELAY_MS);
      return downloadFile(url, destPath, attempt + 1);
    }
    throw err;
  }
}

/**
 * Unzip a file using adm-zip (pure Node.js, no system dependencies)
 */
async function unzipFile(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  const AdmZip = (await import('adm-zip')).default;
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, true);
}

/**
 * Recursively find an Excel file (.xlsx or .xls) in a directory tree
 */
function findExcelFile(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const found = findExcelFile(fullPath);
      if (found) return found;
    } else if (entry.name.endsWith('.xlsx') || entry.name.endsWith('.xls')) {
      return fullPath;
    }
  }
  return null;
}

/**
 * Parse OEWS Excel data using xlsx library
 */
async function parseOEWSExcel(xlsxPath) {
  let XLSX;
  try {
    const mod = await import('xlsx');
    XLSX = mod.default || mod;
  } catch {
    const { createRequire } = await import('module');
    const require = createRequire(import.meta.url);
    XLSX = require('xlsx');
  }

  console.log(`    Parsing ${path.basename(xlsxPath)}...`);
  const workbook = XLSX.readFile(xlsxPath, { type: 'file' });

  // The main data sheet — try common names
  const sheetName = workbook.SheetNames.find(n => {
    const lower = n.toLowerCase();
    return lower.includes('all') || lower.includes('data') || lower.includes('national') ||
           lower.includes('state') || lower.includes('metro');
  }) || workbook.SheetNames[0];

  console.log(`    Using sheet: "${sheetName}" (${workbook.SheetNames.length} sheets total)`);
  const rows = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
  console.log(`    Parsed ${rows.length} rows`);
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

  const get = (key) => row[key] || row[key.toLowerCase()] || row[key.toUpperCase()];

  return {
    area: String(get('AREA') || '').trim(),
    area_title: String(get('AREA_TITLE') || '').trim(),
    area_type: parseNum(get('AREA_TYPE')),
    occ_code: String(get('OCC_CODE') || '').trim(),
    occ_title: String(get('OCC_TITLE') || '').trim(),
    o_group: String(get('O_GROUP') || '').trim(),
    tot_emp: parseNum(get('TOT_EMP')),
    jobs_1000: parseNum(get('JOBS_1000')),
    loc_quotient: parseNum(get('LOC_QUOTIENT')),
    h_mean: parseNum(get('H_MEAN')),
    a_mean: parseNum(get('A_MEAN')),
    h_median: parseNum(get('H_MEDIAN')),
    a_median: parseNum(get('A_MEDIAN')),
    h_pct10: parseNum(get('H_PCT10')),
    h_pct25: parseNum(get('H_PCT25')),
    h_pct75: parseNum(get('H_PCT75')),
    h_pct90: parseNum(get('H_PCT90')),
    a_pct10: parseNum(get('A_PCT10')),
    a_pct25: parseNum(get('A_PCT25')),
    a_pct75: parseNum(get('A_PCT75')),
    a_pct90: parseNum(get('A_PCT90')),
    own_code: parseNum(get('OWN_CODE')),
    naics: String(get('NAICS') || '').trim(),
    naics_title: String(get('NAICS_TITLE') || '').trim(),
    i_group: String(get('I_GROUP') || '').trim()
  };
}

/**
 * Filter rows to keep only detailed/major/broad occupations
 * The nat/st/ma files are already cross-industry, so we only need to filter by o_group
 */
function filterRelevantRows(rows) {
  return rows.filter(r => {
    return ['detailed', 'major', 'broad'].includes(r.o_group);
  });
}

/**
 * Check if we already have data for this year
 */
function getCurrentDataYear() {
  try {
    const nationalPath = path.join(OEWS_DIR, 'national.json');
    if (existsSync(nationalPath)) {
      const data = JSON.parse(readFileSync(nationalPath, 'utf-8'));
      return data.year || null;
    }
  } catch { /* ignore */ }
  return null;
}

/**
 * Download, extract, and parse a single OEWS file type
 */
async function fetchFileType(year, fileType) {
  const yy = year.slice(-2);
  const url = getOEWSUrl(year, fileType.suffix);
  const zipPath = path.join(TEMP_DIR, `oesm${yy}${fileType.suffix}.zip`);
  const extractDir = path.join(TEMP_DIR, `oews-${fileType.suffix}`);

  try {
    await downloadFile(url, zipPath);

    // Validate download size
    const zipSize = statSync(zipPath).size;
    if (zipSize < 10_000) {
      console.warn(`    Download too small (${(zipSize / 1024).toFixed(0)} KB) — likely an error page`);
      return null;
    }

    console.log(`    Extracting ZIP...`);
    await unzipFile(zipPath, extractDir);

    const xlsxPath = findExcelFile(extractDir);
    if (!xlsxPath) {
      const contents = readdirSync(extractDir);
      console.warn(`    No Excel file found. Contents: ${contents.join(', ')}`);
      return null;
    }
    console.log(`    Found: ${path.basename(xlsxPath)}`);

    const rawRows = await parseOEWSExcel(xlsxPath);
    const normalized = rawRows.map(normalizeRow);
    const filtered = filterRelevantRows(normalized);

    console.log(`    ${filtered.length} relevant rows (from ${normalized.length} total)`);

    // Cleanup
    try {
      unlinkSync(zipPath);
      const { rmSync } = await import('fs');
      rmSync(extractDir, { recursive: true });
    } catch { /* ignore */ }

    return filtered;
  } catch (err) {
    console.warn(`    Failed ${fileType.label}: ${err.message}`);
    // Cleanup on failure
    try {
      if (existsSync(zipPath)) unlinkSync(zipPath);
      if (existsSync(extractDir)) {
        const { rmSync } = await import('fs');
        rmSync(extractDir, { recursive: true });
      }
    } catch { /* ignore */ }
    return null;
  }
}

async function main() {
  const targetYears = getTargetYears();
  console.log(`\n=== Fetching OEWS Data ===`);
  console.log(`  Target years to try: ${targetYears.join(', ')}\n`);

  const currentYear = getCurrentDataYear();
  console.log(`  Current data year: ${currentYear || 'none'}`);

  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });

  let successYear = null;
  let allRows = null;

  for (const year of targetYears) {
    if (currentYear === year && !process.env.OEWS_FORCE) {
      console.log(`\n  Already have ${year} data. Set OEWS_FORCE=1 to re-fetch.`);
      console.log('  Skipping OEWS fetch.');
      return;
    }

    console.log(`\nTrying OEWS ${year} data...`);
    const collected = [];
    let anySuccess = false;

    for (const ft of FILE_TYPES) {
      console.log(`\n  [${ft.label}]`);
      const rows = await fetchFileType(year, ft);
      if (rows && rows.length > 0) {
        collected.push(...rows);
        anySuccess = true;
      }
    }

    if (!anySuccess) {
      console.warn(`  No data fetched for ${year}, trying next year...`);
      continue;
    }

    // Verify we got a reasonable number of national detailed occupations
    const detailedNational = collected.filter(r => r.area_type === 1 && r.o_group === 'detailed');
    console.log(`\n  Total rows collected: ${collected.length}`);
    console.log(`  National detailed occupations: ${detailedNational.length}`);

    if (detailedNational.length < 100) {
      console.warn(`  WARNING: Only ${detailedNational.length} national detailed occupations found.`);
      console.warn('  Expected ~830. Data may be incomplete but proceeding anyway.');
    }

    allRows = collected;
    successYear = year;
    break;
  }

  if (!successYear || !allRows) {
    throw new Error(`Failed to fetch OEWS data for any target year: ${targetYears.join(', ')}`);
  }

  // Save
  const outputPath = path.join(RAW_DIR, 'oews-raw.json');
  console.log(`\nSaving to ${outputPath}...`);
  writeFileSync(outputPath, JSON.stringify({
    year: successYear,
    source: 'BLS Occupational Employment and Wage Statistics',
    urls: FILE_TYPES.map(ft => getOEWSUrl(successYear, ft.suffix)),
    fetched: new Date().toISOString(),
    count: allRows.length,
    data: allRows
  }, null, 2));
  console.log(`  Saved ${allRows.length} records`);

  // Cleanup temp dir
  try {
    const { rmSync } = await import('fs');
    rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }

  // Summary
  const areas = new Set(allRows.map(r => r.area));
  const occs = new Set(allRows.filter(r => r.o_group === 'detailed').map(r => r.occ_code));
  console.log(`\n=== OEWS Fetch Complete (${successYear}) ===`);
  console.log(`  ${occs.size} unique detailed occupations`);
  console.log(`  ${areas.size} unique areas`);
  console.log(`  ${allRows.length} total records`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
