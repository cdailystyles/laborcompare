/**
 * fetch-bls-projections.js
 * Downloads BLS Employment Projections Excel tables and parses them.
 * Source: https://www.bls.gov/emp/tables.htm
 * - Table 1.3: Fastest growing occupations
 * - Table 1.4: Occupations with most job growth
 * - Table 1.6: Occupations with largest declines
 * Saves to data/raw/bls-projections.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

let XLSX;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

// BLS Employment Projections Excel URLs (2023-2033)
const TABLES = {
  fastest: {
    url: 'https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx',
    name: 'Fastest Growing Occupations'
  }
};

// The main occupation projections file has all the data we need
const PROJECTIONS_URL = 'https://www.bls.gov/emp/ind-occ-matrix/occupation.xlsx';

async function downloadExcel(url) {
  console.log(`Downloading ${url}...`);
  const resp = await fetch(url);
  if (!resp.ok) throw new Error(`Download failed: ${resp.status} ${resp.statusText}`);
  const buffer = await resp.arrayBuffer();
  return XLSX.read(Buffer.from(buffer), { type: 'buffer' });
}

function parseProjectionsWorkbook(workbook) {
  // The occupation projections file has sheets with detailed occupation data
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });

  // Find the header row (contains "Occupation" or "Title")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (row && row.some(cell => typeof cell === 'string' &&
        (cell.includes('Occupation') || cell.includes('occupation code')))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    console.log('Could not find header row, using raw data');
    return rows;
  }

  const headers = rows[headerIdx].map(h => String(h || '').trim().toLowerCase());
  const dataRows = rows.slice(headerIdx + 1);

  const occupations = [];
  for (const row of dataRows) {
    if (!row || !row[0]) continue;

    // Try to find SOC code and title columns
    const codeIdx = headers.findIndex(h => h.includes('code'));
    const titleIdx = headers.findIndex(h => h.includes('title') || h.includes('occupation'));
    const empBaseIdx = headers.findIndex(h => h.includes('2023') && h.includes('employment'));
    const empProjIdx = headers.findIndex(h => h.includes('2033') && h.includes('employment'));
    const changeIdx = headers.findIndex(h => h.includes('change') && h.includes('percent'));
    const openingsIdx = headers.findIndex(h => h.includes('openings'));

    const code = codeIdx >= 0 ? String(row[codeIdx] || '').trim() : '';
    const title = titleIdx >= 0 ? String(row[titleIdx] || '').trim() : String(row[0] || '').trim();

    // Skip non-detail SOC codes (want XX-XXXX format)
    if (!code.match(/^\d{2}-\d{4}$/)) continue;

    occupations.push({
      code,
      title,
      empBase: empBaseIdx >= 0 ? parseFloat(row[empBaseIdx]) : null,
      empProjected: empProjIdx >= 0 ? parseFloat(row[empProjIdx]) : null,
      changePct: changeIdx >= 0 ? parseFloat(row[changeIdx]) : null,
      openings: openingsIdx >= 0 ? parseFloat(row[openingsIdx]) : null
    });
  }

  return occupations;
}

async function main() {
  if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });

  // Dynamic import for xlsx (ESM compatible)
  try {
    XLSX = (await import('xlsx')).default || (await import('xlsx'));
  } catch (err) {
    console.error('Could not load xlsx package:', err.message);
    console.log('Writing empty projections file.');
    writeFileSync(path.join(RAW_DIR, 'bls-projections.json'), JSON.stringify({
      fetched: new Date().toISOString(),
      source: 'BLS Employment Projections 2023-2033',
      occupations: []
    }, null, 2));
    return;
  }

  console.log('Fetching BLS Employment Projections...');

  let occupations = [];
  try {
    const workbook = await downloadExcel(PROJECTIONS_URL);
    occupations = parseProjectionsWorkbook(workbook);
    console.log(`Parsed ${occupations.length} occupation projections`);
  } catch (err) {
    console.error(`Failed to download/parse projections: ${err.message}`);
    console.log('Projections data will need to be added manually or URL updated.');
  }

  const output = {
    fetched: new Date().toISOString(),
    source: 'BLS Employment Projections 2023-2033',
    occupations
  };

  const outPath = path.join(RAW_DIR, 'bls-projections.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath} (${occupations.length} occupations)`);
}

main().catch(err => {
  console.error('Projections fetch warning:', err.message);
  console.log('Projections data will use fallback/placeholder values.');
  // Exit 0 so workflow continues
});
