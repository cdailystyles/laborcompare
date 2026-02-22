/**
 * fetch-bea.js
 * Fetches per capita personal income from BEA Regional Data API for all counties.
 * Table: CAINC1, LineCode: 3 (Per capita personal income)
 * Saves to data/raw/bea-income.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

const BEA_API_URL = 'https://apps.bea.gov/api/data';
const BEA_API_KEY = process.env.BEA_API_KEY;

if (!BEA_API_KEY) {
  console.error('ERROR: BEA_API_KEY environment variable is required.');
  process.exit(1);
}

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch from BEA API with retries
 */
async function fetchBEA(params, attempt = 1) {
  const url = new URL(BEA_API_URL);
  url.searchParams.set('UserID', BEA_API_KEY);
  url.searchParams.set('method', 'GetData');
  url.searchParams.set('datasetname', 'Regional');
  url.searchParams.set('ResultFormat', 'JSON');

  for (const [key, val] of Object.entries(params)) {
    url.searchParams.set(key, val);
  }

  const displayUrl = url.toString().replace(BEA_API_KEY, '***');
  console.log(`  Fetching: ${displayUrl}`);

  try {
    const response = await fetch(url.toString());

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 300)}`);
    }

    const json = await response.json();

    // Check for BEA API errors
    if (json.BEAAPI?.Error) {
      const errMsg = json.BEAAPI.Error.ErrorDetail?.Description || JSON.stringify(json.BEAAPI.Error);
      throw new Error(`BEA API error: ${errMsg}`);
    }

    return json;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`  Retry ${attempt}/${MAX_RETRIES}: ${err.message}`);
      await sleep(RETRY_DELAY_MS * attempt);
      return fetchBEA(params, attempt + 1);
    }
    throw err;
  }
}

/**
 * Fetch per capita personal income for all counties
 */
async function fetchPerCapitaIncome() {
  console.log('Fetching BEA per capita personal income (CAINC1, Line 3)...');

  const currentYear = new Date().getFullYear();
  // BEA data lags ~1-2 years; request a range
  const yearRange = `${currentYear - 3},${currentYear - 2},${currentYear - 1},${currentYear}`;

  const json = await fetchBEA({
    TableName: 'CAINC1',
    LineCode: '3',
    GeoFips: 'COUNTY',
    Year: yearRange
  });

  const results = json?.BEAAPI?.Results?.Data;
  if (!results || !Array.isArray(results)) {
    throw new Error('No data returned from BEA API');
  }

  console.log(`  Received ${results.length} data records from BEA`);

  // Group by GeoFips, keep most recent year with valid data
  const counties = {};

  // Sort by year descending so first valid entry per county is most recent
  const sorted = results
    .filter(r => r.GeoFips && r.GeoFips.length === 5)
    .sort((a, b) => parseInt(b.TimePeriod) - parseInt(a.TimePeriod));

  for (const record of sorted) {
    const fips = record.GeoFips;

    // Skip if we already have data for this county (from a more recent year)
    if (counties[fips]) continue;

    // Parse the value — BEA uses "(NA)" for not available, and commas in numbers
    let value = record.DataValue;
    if (!value || value === '(NA)' || value === '(NM)' || value === '(D)') continue;

    value = value.replace(/,/g, '');
    const numVal = parseFloat(value);
    if (isNaN(numVal)) continue;

    counties[fips] = {
      fips: fips,
      geo_name: record.GeoName || '',
      per_capita_income: numVal,
      year: parseInt(record.TimePeriod)
    };
  }

  console.log(`  Processed ${Object.keys(counties).length} counties with valid data`);
  return counties;
}

/**
 * Also fetch state-level per capita income for state aggregates
 */
async function fetchStatePerCapitaIncome() {
  console.log('Fetching BEA per capita personal income for states...');

  const currentYear = new Date().getFullYear();
  const yearRange = `${currentYear - 3},${currentYear - 2},${currentYear - 1},${currentYear}`;

  const json = await fetchBEA({
    TableName: 'CAINC1',
    LineCode: '3',
    GeoFips: 'STATE',
    Year: yearRange
  });

  const results = json?.BEAAPI?.Results?.Data;
  if (!results || !Array.isArray(results)) {
    console.warn('  No state-level data returned from BEA');
    return {};
  }

  console.log(`  Received ${results.length} state data records from BEA`);

  const states = {};
  const sorted = results
    .filter(r => r.GeoFips && r.GeoFips.length === 5 && r.GeoFips.endsWith('000'))
    .sort((a, b) => parseInt(b.TimePeriod) - parseInt(a.TimePeriod));

  for (const record of sorted) {
    // State FIPS in BEA is like "01000" — extract first 2 digits
    const stateFips = record.GeoFips.substring(0, 2);
    if (states[stateFips]) continue;

    let value = record.DataValue;
    if (!value || value === '(NA)' || value === '(NM)' || value === '(D)') continue;

    value = value.replace(/,/g, '');
    const numVal = parseFloat(value);
    if (isNaN(numVal)) continue;

    states[stateFips] = {
      fips: stateFips,
      geo_name: record.GeoName || '',
      per_capita_income: numVal,
      year: parseInt(record.TimePeriod)
    };
  }

  console.log(`  Processed ${Object.keys(states).length} states with valid data`);
  return states;
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  console.log('=== BEA Income Data Fetch ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  ensureDir(RAW_DIR);

  const countyData = await fetchPerCapitaIncome();
  const stateData = await fetchStatePerCapitaIncome();

  const output = {
    counties: countyData,
    states: stateData,
    fetched_at: new Date().toISOString()
  };

  const outFile = path.join(RAW_DIR, 'bea-income.json');
  writeFileSync(outFile, JSON.stringify(output, null, 2));
  console.log(`Saved BEA data to ${outFile}`);

  console.log('=== BEA fetch complete ===');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
