/**
 * fetch-bls-jolts.js
 * Fetches JOLTS (Job Openings and Labor Turnover Survey) data from BLS API v2.
 * Series: Job Openings, Hires, Quits, Total Separations (all SA, total nonfarm)
 * Saves to data/raw/bls-jolts.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

const BLS_API_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const BLS_API_KEY = process.env.BLS_API_KEY;

if (!BLS_API_KEY) {
  console.log('WARN: BLS_API_KEY not set. Skipping JOLTS fetch.');
  process.exit(0);
}

// JOLTS series IDs (Seasonally Adjusted, Total Nonfarm)
const JOLTS_SERIES = {
  'JTS000000000000000JOL': { name: 'Job Openings', unit: 'thousands' },
  'JTS000000000000000HIL': { name: 'Hires', unit: 'thousands' },
  'JTS000000000000000QUL': { name: 'Quits', unit: 'thousands' },
  'JTS000000000000000TSL': { name: 'Total Separations', unit: 'thousands' }
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
    throw new Error(`BLS API error: ${json.message?.join(', ')}`);
  }

  return json.Results.series;
}

async function main() {
  if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 5;

  console.log(`Fetching JOLTS data ${startYear}-${currentYear}...`);

  const seriesIds = Object.keys(JOLTS_SERIES);
  const results = await fetchBLS(seriesIds, startYear, currentYear);

  const output = {
    fetched: new Date().toISOString(),
    startYear,
    endYear: currentYear,
    series: {}
  };

  for (const series of results) {
    const id = series.seriesID;
    const meta = JOLTS_SERIES[id];
    if (!meta) continue;

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
      unit: meta.unit,
      data
    };
  }

  const outPath = path.join(RAW_DIR, 'bls-jolts.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath} (${Object.keys(output.series).length} series)`);
}

main().catch(err => {
  console.error('JOLTS fetch warning:', err.message);
  // Exit 0 so workflow continues
});
