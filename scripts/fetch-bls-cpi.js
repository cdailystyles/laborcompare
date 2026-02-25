/**
 * fetch-bls-cpi.js
 * Fetches Consumer Price Index data from BLS API v2.
 * - CPI-U All Items (SA)
 * - CPI categories: Food, Shelter, Energy, Medical, Transportation, Apparel, Education, Recreation
 * Saves to data/raw/bls-cpi.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

const BLS_API_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const BLS_API_KEY = process.env.BLS_API_KEY;

if (!BLS_API_KEY) {
  console.log('WARN: BLS_API_KEY not set. Skipping CPI fetch.');
  process.exit(0);
}

// CPI series IDs
const CPI_SERIES = {
  'CUSR0000SA0':     { name: 'All Items', seasonal: true },
  'CUSR0000SAF1':    { name: 'Food', seasonal: true },
  'CUSR0000SAH1':    { name: 'Shelter', seasonal: true },
  'CUSR0000SEHF01':  { name: 'Energy', seasonal: true },
  'CUSR0000SAM':     { name: 'Medical Care', seasonal: true },
  'CUSR0000SAT1':    { name: 'Transportation', seasonal: true },
  'CUSR0000SAA':     { name: 'Apparel', seasonal: true },
  'CUSR0000SAE':     { name: 'Education & Communication', seasonal: true },
  'CUSR0000SAR':     { name: 'Recreation', seasonal: true },
  'CUUR0000SA0':     { name: 'All Items (NSA)', seasonal: false }
};

async function fetchBLS(seriesIds, startYear, endYear) {
  const body = JSON.stringify({
    seriesid: seriesIds,
    startyear: String(startYear),
    endyear: String(endYear),
    registrationkey: BLS_API_KEY
  });

  const resp = await fetch(BLS_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body
  });

  if (!resp.ok) throw new Error(`BLS API returned ${resp.status}`);
  const json = await resp.json();

  if (json.status !== 'REQUEST_SUCCEEDED') {
    const msg = json.message?.join(', ') || 'Unknown error';
    if (msg.includes('threshold') || msg.includes('daily') || msg.includes('rate')) {
      console.error(`  BLS API rate limit reached: ${msg}`);
      return []; // Return empty instead of throwing — CPI is single call
    }
    throw new Error(`BLS API error: ${msg}`);
  }

  return json.Results.series;
}

async function main() {
  if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5; // 5 years of history

  console.log(`Fetching CPI data ${startYear}-${currentYear}...`);

  const seriesIds = Object.keys(CPI_SERIES);
  const results = await fetchBLS(seriesIds, startYear, currentYear);

  const output = {
    fetched: new Date().toISOString(),
    startYear,
    endYear: currentYear,
    series: {}
  };

  for (const series of results) {
    const id = series.seriesID;
    const meta = CPI_SERIES[id];
    if (!meta) continue;

    // Sort data by year/period (most recent first)
    const data = series.data
      .map(d => ({
        year: parseInt(d.year),
        period: d.period,
        month: parseInt(d.period.replace('M', '')),
        value: parseFloat(d.value),
        footnotes: d.footnotes?.map(f => f.text).filter(Boolean) || []
      }))
      .filter(d => !isNaN(d.value) && d.period.startsWith('M'))
      .sort((a, b) => b.year - a.year || b.month - a.month);

    output.series[id] = {
      name: meta.name,
      seasonal: meta.seasonal,
      data
    };
  }

  const outPath = path.join(RAW_DIR, 'bls-cpi.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath} (${Object.keys(output.series).length} series)`);
}

main().catch(err => {
  console.error('CPI fetch warning:', err.message);
  // Exit 0 so workflow continues
});
