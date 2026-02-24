/**
 * process-jolts.js
 * Processes raw JOLTS data into frontend-ready JSON.
 * Input:  data/raw/bls-jolts.json
 * Output: data/jolts/national.json — latest values + historical time series
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const JOLTS_DIR = path.join(DATA_DIR, 'jolts');

const SERIES_MAP = {
  'JTS000000000000000JOL': 'openings',
  'JTS000000000000000HIL': 'hires',
  'JTS000000000000000QUL': 'quits',
  'JTS000000000000000TSL': 'separations'
};

function main() {
  console.log('Processing JOLTS data...');

  const rawPath = path.join(RAW_DIR, 'bls-jolts.json');
  if (!existsSync(rawPath)) {
    console.log('WARN: bls-jolts.json not found. Skipping JOLTS processing.');
    return;
  }

  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
  if (!existsSync(JOLTS_DIR)) mkdirSync(JOLTS_DIR, { recursive: true });

  const output = {
    updated: raw.fetched,
    latest: {},
    series: {}
  };

  for (const [seriesId, key] of Object.entries(SERIES_MAP)) {
    const series = raw.series[seriesId];
    if (!series?.data?.length) continue;

    const latest = series.data[0];
    const prev = series.data[1];

    // Values are in thousands
    output.latest[key] = {
      value: latest.value,
      year: latest.year,
      month: latest.month,
      change: prev ? Math.round(latest.value - prev.value) : null,
      direction: prev ? (latest.value > prev.value ? 'up' : latest.value < prev.value ? 'down' : 'flat') : 'flat'
    };

    // Last 24 months for charts
    output.series[key] = series.data.slice(0, 24).map(d => ({
      year: d.year,
      month: d.month,
      value: d.value
    }));
  }

  const outPath = path.join(JOLTS_DIR, 'national.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath} (${Object.keys(output.latest).length} metrics)`);
}

try {
  main();
} catch (err) {
  console.error('JOLTS processing warning:', err.message);
  // Exit 0 so workflow continues
}
