/**
 * process-cpi.js
 * Processes raw CPI data into frontend-ready JSON files.
 * Input:  data/raw/bls-cpi.json
 * Output: data/cpi/national.json    — headline CPI time series
 *         data/cpi/categories.json  — category breakdown with YoY changes
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const CPI_DIR = path.join(DATA_DIR, 'cpi');

function main() {
  console.log('Processing CPI data...');

  const rawPath = path.join(RAW_DIR, 'bls-cpi.json');
  if (!existsSync(rawPath)) {
    console.error('ERROR: bls-cpi.json not found. Run fetch-bls-cpi.js first.');
    process.exit(1);
  }

  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
  if (!existsSync(CPI_DIR)) mkdirSync(CPI_DIR, { recursive: true });

  // --- national.json: All Items CPI time series ---
  const allItemsSA = raw.series['CUSR0000SA0'];
  if (!allItemsSA) {
    console.error('ERROR: All Items SA series not found');
    process.exit(1);
  }

  const national = {
    updated: raw.fetched,
    seriesId: 'CUSR0000SA0',
    name: 'CPI-U All Items (Seasonally Adjusted)',
    data: allItemsSA.data.map(d => ({
      year: d.year,
      month: d.month,
      value: d.value
    }))
  };

  // Add computed fields: YoY change, MoM change
  for (let i = 0; i < national.data.length; i++) {
    const current = national.data[i];

    // Month-over-month
    const prevMonth = national.data[i + 1];
    if (prevMonth) {
      current.momChange = parseFloat(((current.value - prevMonth.value) / prevMonth.value * 100).toFixed(2));
    }

    // Year-over-year
    const sameMonthLastYear = national.data.find(
      d => d.year === current.year - 1 && d.month === current.month
    );
    if (sameMonthLastYear) {
      current.yoyChange = parseFloat(((current.value - sameMonthLastYear.value) / sameMonthLastYear.value * 100).toFixed(2));
    }
  }

  const nationalPath = path.join(CPI_DIR, 'national.json');
  writeFileSync(nationalPath, JSON.stringify(national, null, 2));
  console.log(`Wrote ${nationalPath} (${national.data.length} data points)`);

  // --- categories.json: Category breakdown with latest values and YoY ---
  const categories = [];
  const categorySeriesIds = [
    'CUSR0000SAF1',   // Food
    'CUSR0000SAH1',   // Shelter
    'CUSR0000SEHF01', // Energy
    'CUSR0000SAM',    // Medical Care
    'CUSR0000SAT1',   // Transportation
    'CUSR0000SAA',    // Apparel
    'CUSR0000SAE',    // Education & Communication
    'CUSR0000SAR'     // Recreation
  ];

  for (const seriesId of categorySeriesIds) {
    const series = raw.series[seriesId];
    if (!series) continue;

    const latest = series.data[0];
    if (!latest) continue;

    // Find same month last year
    const yearAgo = series.data.find(d => d.year === latest.year - 1 && d.month === latest.month);
    const yoyChange = yearAgo
      ? parseFloat(((latest.value - yearAgo.value) / yearAgo.value * 100).toFixed(2))
      : null;

    // Find previous month
    const prevMonth = series.data[1];
    const momChange = prevMonth
      ? parseFloat(((latest.value - prevMonth.value) / prevMonth.value * 100).toFixed(2))
      : null;

    categories.push({
      seriesId,
      name: series.name,
      latestValue: latest.value,
      latestYear: latest.year,
      latestMonth: latest.month,
      yoyChange,
      momChange,
      // Include last 12 months for sparkline
      history: series.data.slice(0, 12).map(d => ({
        year: d.year,
        month: d.month,
        value: d.value
      }))
    });
  }

  const categoriesPath = path.join(CPI_DIR, 'categories.json');
  writeFileSync(categoriesPath, JSON.stringify({ updated: raw.fetched, categories }, null, 2));
  console.log(`Wrote ${categoriesPath} (${categories.length} categories)`);
}

try {
  main();
} catch (err) {
  console.error('CPI processing failed:', err.message);
  process.exit(1);
}
