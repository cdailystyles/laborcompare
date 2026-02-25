/**
 * fetch-oews.js
 * Downloads the annual OEWS (Occupational Employment and Wage Statistics) data from BLS.
 *
 * BLS publishes OEWS data as Excel files at:
 *   https://www.bls.gov/oes/special-requests/oesm{YY}all.zip
 *
 * This script:
 * 1. Auto-detects the latest available OEWS year (or uses OEWS_YEAR env var)
 * 2. Downloads and extracts the Excel file
 * 3. Parses all national, state, and metro data (~830 detailed occupations)
 * 4. Saves raw parsed data to data/raw/oews-raw.json
 *
 * No API key required — uses BLS bulk download files.
 */

import { writeFileSync, mkdirSync, existsSync, unlinkSync, readdirSync, readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');
const TEMP_DIR = path.join(__dirname, '..', 'data', 'temp');
const OEWS_DIR = path.join(__dirname, '..', 'data', 'oews');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Determine the OEWS year to fetch.
 * Priority: OEWS_YEAR env var > auto-detect latest available
 * BLS publishes May {YEAR} data around March/April of the following year.
 * So in 2025, May 2024 data is available. In 2026, May 2025 data should be available.
 */
function getTargetYears() {
  if (process.env.OEWS_YEAR) {
    return [process.env.OEWS_YEAR];
  }
  // Try most recent first: current year - 1, then current year - 2
  const currentYear = new Date().getFullYear();
  return [
    String(currentYear - 1),
    String(currentYear - 2)
  ];
}

/**
 * Build the OEWS download URL for a given year
 */
function getOEWSUrl(year) {
  const yy = year.slice(-2);
  return `https://www.bls.gov/oes/special-requests/oesm${yy}all.zip`;
}

/**
 * Download a file with retries
 */
async function downloadFile(url, destPath, attempt = 1) {
  console.log(`  Downloading ${url} (attempt ${attempt})...`);
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
 * Unzip a file using system tools
 */
function unzipFile(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true });
  try {
    execSync(`unzip -o "${zipPath}" -d "${destDir}"`, { stdio: 'pipe' });
  } catch {
    try {
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

  console.log('  Parsing Excel file...');
  const workbook = XLSX.readFile(xlsxPath, { type: 'file' });

  // The main data sheet — try common names
  const sheetName = workbook.SheetNames.find(n => {
    const lower = n.toLowerCase();
    return lower.includes('all') || lower.includes('data') || lower.includes('national');
  }) || workbook.SheetNames[0];

  console.log(`  Using sheet: "${sheetName}" (${workbook.SheetNames.length} sheets total)`);
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

  // Handle both uppercase and lowercase column names
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
 * Filter to cross-industry, all-ownerships relevant rows
 * AREA_TYPE: 1=nation, 2=state, 3=metro, 4=nonmetro, 6=county
 * OWN_CODE: 1235=cross-ownership (or null for older formats)
 * I_GROUP: "cross_industry" or NAICS="000000"
 * O_GROUP: "detailed" for specific occupations, "major"/"broad" for groups
 */
function filterRelevantRows(rows) {
  return rows.filter(r => {
    // Cross-industry totals only
    const isCrossIndustry = r.naics === '000000' || r.i_group === 'cross_industry' ||
      r.naics === '000000.0' || r.naics_title.toLowerCase().includes('cross-industry');
    // All ownerships (1235) or if not specified
    const isAllOwnership = r.own_code === 1235 || r.own_code === null;
    // Nation, state, or metro
    const isRelevantArea = [1, 2, 3].includes(r.area_type);
    // Keep detailed and major/broad occupations
    const isOccupation = ['detailed', 'major', 'broad'].includes(r.o_group);

    return isCrossIndustry && isAllOwnership && isRelevantArea && isOccupation;
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

async function main() {
  const targetYears = getTargetYears();
  console.log(`\n=== Fetching OEWS Data ===`);
  console.log(`  Target years to try: ${targetYears.join(', ')}\n`);

  const currentYear = getCurrentDataYear();
  console.log(`  Current data year: ${currentYear || 'none'}`);

  mkdirSync(RAW_DIR, { recursive: true });
  mkdirSync(TEMP_DIR, { recursive: true });

  let successYear = null;
  let filtered = null;

  for (const year of targetYears) {
    // Skip if we already have this year's data (unless forced via env)
    if (currentYear === year && !process.env.OEWS_FORCE) {
      console.log(`\n  Already have ${year} data. Set OEWS_FORCE=1 to re-fetch.`);
      console.log('  Skipping OEWS fetch.');
      return;
    }

    const yy = year.slice(-2);
    const url = getOEWSUrl(year);
    const zipPath = path.join(TEMP_DIR, `oesm${yy}all.zip`);
    const extractDir = path.join(TEMP_DIR, 'oews');

    try {
      // Step 1: Download
      console.log(`\nTrying OEWS ${year} data...`);
      await downloadFile(url, zipPath);

      // Step 2: Extract
      console.log('  Extracting ZIP...');
      unzipFile(zipPath, extractDir);

      // Find Excel file
      const files = readdirSync(extractDir);
      const xlsxFile = files.find(f => f.endsWith('.xlsx') || f.endsWith('.xls'));
      if (!xlsxFile) {
        console.warn(`  No Excel file found. Contents: ${files.join(', ')}`);
        continue;
      }
      console.log(`  Found: ${xlsxFile}`);

      // Step 3: Parse
      console.log('  Parsing Excel data...');
      const rawRows = await parseOEWSExcel(path.join(extractDir, xlsxFile));

      // Step 4: Normalize
      console.log('  Normalizing...');
      const normalized = rawRows.map(normalizeRow);
      console.log(`  ${normalized.length} rows normalized`);

      // Debug: show unique o_group values
      const oGroups = [...new Set(normalized.map(r => r.o_group))];
      console.log(`  o_group values: ${oGroups.join(', ')}`);
      const areaTypes = [...new Set(normalized.map(r => r.area_type))];
      console.log(`  area_type values: ${areaTypes.join(', ')}`);

      // Step 5: Filter
      filtered = filterRelevantRows(normalized);
      console.log(`  ${filtered.length} rows after filtering`);

      // Verify we got a reasonable number
      const detailedNational = filtered.filter(r => r.area_type === 1 && r.o_group === 'detailed');
      console.log(`  National detailed occupations: ${detailedNational.length}`);

      if (detailedNational.length < 100) {
        console.warn(`  WARNING: Only ${detailedNational.length} national detailed occupations found.`);
        console.warn('  This is fewer than expected (~830). Checking filter criteria...');

        // Try relaxed filtering for diagnosis
        const allNational = normalized.filter(r => r.area_type === 1);
        const allDetailed = normalized.filter(r => r.o_group === 'detailed');
        const allCross = normalized.filter(r => r.naics === '000000' || r.i_group === 'cross_industry');
        console.warn(`  Total national rows: ${allNational.length}`);
        console.warn(`  Total detailed rows: ${allDetailed.length}`);
        console.warn(`  Total cross-industry rows: ${allCross.length}`);

        // If the filter is too strict, try a relaxed version
        if (allDetailed.length > 100 && filtered.length < 100) {
          console.log('  Trying relaxed cross-industry filter...');
          filtered = normalized.filter(r => {
            const isRelevantArea = [1, 2, 3].includes(r.area_type);
            const isOccupation = ['detailed', 'major', 'broad'].includes(r.o_group);
            // More lenient: accept rows where NAICS starts with 0 or i_group contains cross
            const isCrossish = r.naics === '000000' || r.naics === '000000.0' ||
              r.naics.startsWith('0000') || r.i_group.includes('cross') ||
              r.naics_title.toLowerCase().includes('cross') || r.naics_title === '';
            const isAllOwn = r.own_code === 1235 || r.own_code === null;
            return isRelevantArea && isOccupation && isCrossish && isAllOwn;
          });
          const relaxedNational = filtered.filter(r => r.area_type === 1 && r.o_group === 'detailed');
          console.log(`  Relaxed filter: ${filtered.length} total, ${relaxedNational.length} national detailed`);
        }
      }

      successYear = year;

      // Cleanup temp
      try {
        unlinkSync(zipPath);
        const { rmSync } = await import('fs');
        rmSync(extractDir, { recursive: true });
      } catch { /* ignore */ }

      break; // Success — stop trying older years

    } catch (err) {
      console.warn(`  Failed for ${year}: ${err.message}`);
      // Cleanup on failure
      try {
        if (existsSync(zipPath)) unlinkSync(zipPath);
        const { rmSync } = await import('fs');
        const extractDir = path.join(TEMP_DIR, 'oews');
        if (existsSync(extractDir)) rmSync(extractDir, { recursive: true });
      } catch { /* ignore */ }
      continue;
    }
  }

  if (!successYear || !filtered) {
    throw new Error(`Failed to fetch OEWS data for any target year: ${targetYears.join(', ')}`);
  }

  // Step 6: Save
  const outputPath = path.join(RAW_DIR, 'oews-raw.json');
  console.log(`\nSaving to ${outputPath}...`);
  writeFileSync(outputPath, JSON.stringify({
    year: successYear,
    source: 'BLS Occupational Employment and Wage Statistics',
    url: getOEWSUrl(successYear),
    fetched: new Date().toISOString(),
    count: filtered.length,
    data: filtered
  }, null, 2));
  console.log(`  Saved ${filtered.length} records`);

  // Cleanup temp dir
  try {
    const { rmSync } = await import('fs');
    rmSync(TEMP_DIR, { recursive: true, force: true });
  } catch { /* ignore */ }

  // Summary
  const areas = new Set(filtered.map(r => r.area));
  const occs = new Set(filtered.filter(r => r.o_group === 'detailed').map(r => r.occ_code));
  console.log(`\n=== OEWS Fetch Complete (${successYear}) ===`);
  console.log(`  ${occs.size} unique detailed occupations`);
  console.log(`  ${areas.size} unique areas`);
  console.log(`  ${filtered.length} total records`);
}

main().catch(err => {
  console.error('FATAL:', err.message);
  process.exit(1);
});
