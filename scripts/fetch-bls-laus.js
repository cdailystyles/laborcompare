/**
 * fetch-bls-laus.js
 * Fetches Local Area Unemployment Statistics (LAUS) from BLS API v2.
 * - State-level: unemployment rate, labor force, employment, unemployment count (51 areas)
 * - County-level: unemployment rate, labor force, employment (~3,143 counties)
 * Saves to data/raw/bls-laus-states.json and data/raw/bls-laus-counties.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

const BLS_API_URL = 'https://api.bls.gov/publicAPI/v2/timeseries/data/';
const BLS_API_KEY = process.env.BLS_API_KEY;

if (!BLS_API_KEY) {
  console.error('ERROR: BLS_API_KEY environment variable is required.');
  process.exit(1);
}

// 50 states + DC FIPS codes
const STATE_FIPS = [
  '01', '02', '04', '05', '06', '08', '09', '10', '11', '12',
  '13', '15', '16', '17', '18', '19', '20', '21', '22', '23',
  '24', '25', '26', '27', '28', '29', '30', '31', '32', '33',
  '34', '35', '36', '37', '38', '39', '40', '41', '42', '44',
  '45', '46', '47', '48', '49', '50', '51', '53', '54', '55',
  '56'
];

// County FIPS codes by state — we fetch dynamically via measure 03 (rate)
// LAUS series format:
//   States: LAUST{SS}0000000000000{measure}  (SS = 2-digit state FIPS, padded)
//   Counties: LAUCN{SSCCC}0000000000{measure} (SSCCC = 5-digit county FIPS)
// Measures: 03=rate, 04=unemployment count, 05=employment, 06=labor force

const LAUS_MEASURES = {
  '03': 'unemployment_rate',
  '04': 'unemployment_count',
  '05': 'employment',
  '06': 'labor_force'
};

const COUNTY_MEASURES = {
  '03': 'unemployment_rate',
  '05': 'employment',
  '06': 'labor_force'
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const BATCH_SIZE = 50; // BLS API limit
const BATCH_DELAY_MS = 1500; // Delay between batches to avoid rate limiting

/**
 * Sleep for given milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Track consecutive failures to abort early on rate limits
let consecutiveFailures = 0;
const MAX_CONSECUTIVE_FAILURES = 5;

/**
 * Fetch from BLS API with retries.
 * Fails fast on rate limit errors (no point retrying until tomorrow).
 */
async function fetchBLS(seriesIds, startYear, endYear, attempt = 1) {
  const payload = {
    seriesid: seriesIds,
    startyear: String(startYear),
    endyear: String(endYear),
    annualaverage: true,
    registrationkey: BLS_API_KEY
  };

  try {
    const response = await fetch(BLS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (json.status === 'REQUEST_NOT_PROCESSED') {
      const msg = json.message?.join('; ') || 'Unknown error';
      // Detect rate limit errors — fail immediately, no retry
      if (msg.includes('threshold') || msg.includes('daily') || msg.includes('rate')) {
        throw new RateLimitError(`BLS API rate limit: ${msg}`);
      }
      throw new Error(`BLS API error: ${msg}`);
    }

    consecutiveFailures = 0; // Reset on success
    return json;
  } catch (err) {
    // Never retry rate limit errors
    if (err instanceof RateLimitError) throw err;

    if (attempt < MAX_RETRIES) {
      console.warn(`  Retry ${attempt}/${MAX_RETRIES} after error: ${err.message}`);
      await sleep(RETRY_DELAY_MS * attempt);
      return fetchBLS(seriesIds, startYear, endYear, attempt + 1);
    }
    throw err;
  }
}

class RateLimitError extends Error {
  constructor(msg) { super(msg); this.name = 'RateLimitError'; }
}

/**
 * Process BLS response to extract annual average values
 */
function extractAnnualAverage(seriesData) {
  // Look for M13 (annual average) first, fall back to latest month
  const annualAvg = seriesData.find(d => d.period === 'M13');
  if (annualAvg) return annualAvg.value;

  // Fall back to latest monthly value
  const sorted = [...seriesData].sort((a, b) => {
    if (a.year !== b.year) return b.year.localeCompare(a.year);
    return b.period.localeCompare(a.period);
  });
  return sorted.length > 0 ? sorted[0].value : null;
}

/**
 * Batch an array into chunks
 */
function batchArray(arr, size) {
  const batches = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

/**
 * Fetch state-level LAUS data
 */
async function fetchStateLAUS() {
  console.log('Fetching state-level LAUS data...');
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 1;

  const seriesIds = [];
  const seriesMap = {}; // seriesId -> { fips, measure }

  for (const fips of STATE_FIPS) {
    for (const measure of Object.keys(LAUS_MEASURES)) {
      const seriesId = `LASST${fips}0000000000000${measure}`;
      seriesIds.push(seriesId);
      seriesMap[seriesId] = { fips, measure };
    }
  }

  const states = {}; // fips -> { name, metrics... }
  const batches = batchArray(seriesIds, BATCH_SIZE);
  console.log(`  ${seriesIds.length} series in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i++) {
    const batch = batches[i];
    console.log(`  Batch ${i + 1}/${batches.length} (${batch.length} series)`);

    try {
      const json = await fetchBLS(batch, startYear, currentYear);

      if (json.Results?.series) {
        for (const series of json.Results.series) {
          const info = seriesMap[series.seriesID];
          if (!info) continue;

          const value = extractAnnualAverage(series.data);
          if (value === null || value === undefined) continue;

          if (!states[info.fips]) {
            states[info.fips] = { fips: info.fips };
          }

          const fieldName = LAUS_MEASURES[info.measure];
          const numVal = parseFloat(value.replace(/,/g, ''));
          states[info.fips][fieldName] = isNaN(numVal) ? null : numVal;
        }
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.error(`  Rate limited — aborting state fetch. Got ${Object.keys(states).length} states so far.`);
        break;
      }
      console.warn(`  Batch ${i + 1} failed: ${err.message}`);
    }

    if (i < batches.length - 1) await sleep(BATCH_DELAY_MS);
  }

  console.log(`  Fetched data for ${Object.keys(states).length} states`);
  return states;
}

/**
 * Fetch county-level LAUS data
 * Since we do not have a pre-built list of every county FIPS, we use a known list.
 * BLS county LAUS series: LAUCN{FIPS5}0000000000{measure}
 * We build series for all known county FIPS codes.
 */
async function fetchCountyLAUS() {
  console.log('Fetching county-level LAUS data...');
  console.log('  Building county series list from all possible county FIPS...');

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 1;

  // We will fetch measure 03 (unemployment rate) for all possible county FIPS
  // to discover valid counties, then fetch 05 and 06 for those counties.
  // County FIPS range: each state has counties 001-999 (odd numbers typically for counties).
  // Rather than guessing, we fetch in a structured way.

  // Strategy: For each state, we try county codes 001-510 in steps to find valid ones.
  // BLS will simply return empty data for invalid series.
  // But this creates too many series. Instead, let's fetch all 3 measures at once
  // for a reasonable range of counties per state.

  // Most states have < 300 counties. County FIPS are typically:
  // 001, 003, 005, ... (odd) for counties, and some even numbers for independent cities (VA)
  // Max county FIPS is typically around 510 (VA goes up to 840 with independent cities)

  // Better approach: build all possible 5-digit FIPS from 01001 to 56999
  // and only use measures 03, 05, 06. This is ~3200 counties * 3 measures = ~9600 series.

  // Actually, let's be smart about this. We know there are ~3,243 county-equivalents.
  // We will generate a comprehensive list.

  const countyFipsList = generateCountyFipsList();
  console.log(`  Generated ${countyFipsList.length} potential county FIPS codes`);

  const seriesIds = [];
  const seriesMap = {};

  for (const fips5 of countyFipsList) {
    for (const measure of Object.keys(COUNTY_MEASURES)) {
      const seriesId = `LAUCN${fips5}0000000000${measure}`;
      seriesIds.push(seriesId);
      seriesMap[seriesId] = { fips: fips5, measure };
    }
  }

  const counties = {}; // fips5 -> { metrics... }
  const batches = batchArray(seriesIds, BATCH_SIZE);
  console.log(`  ${seriesIds.length} series in ${batches.length} batches`);

  let successCount = 0;
  for (let i = 0; i < batches.length; i++) {
    if (i % 50 === 0) {
      console.log(`  Batch ${i + 1}/${batches.length}...`);
    }

    try {
      const json = await fetchBLS(batches[i], startYear, currentYear);

      if (json.Results?.series) {
        for (const series of json.Results.series) {
          const info = seriesMap[series.seriesID];
          if (!info || !series.data?.length) continue;

          const value = extractAnnualAverage(series.data);
          if (value === null || value === undefined) continue;

          if (!counties[info.fips]) {
            counties[info.fips] = { fips: info.fips };
            successCount++;
          }

          const fieldName = COUNTY_MEASURES[info.measure];
          const numVal = parseFloat(value.replace(/,/g, ''));
          counties[info.fips][fieldName] = isNaN(numVal) ? null : numVal;
        }
      }
      consecutiveFailures = 0;
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.error(`  Rate limited — aborting county fetch. Got ${Object.keys(counties).length} counties so far.`);
        break;
      }
      consecutiveFailures++;
      console.warn(`  Batch ${i + 1} failed: ${err.message}`);
      if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
        console.error(`  ${MAX_CONSECUTIVE_FAILURES} consecutive failures — aborting county fetch.`);
        break;
      }
    }

    if (i < batches.length - 1) await sleep(BATCH_DELAY_MS);
  }

  console.log(`  Fetched data for ${Object.keys(counties).length} counties`);
  return counties;
}

/**
 * Generate a list of all valid county-equivalent FIPS codes.
 * Based on the known structure: {stateFIPS}{countyCode}
 * County codes are typically odd (001-840+) but include even for independent cities.
 * We use a comprehensive list covering all real counties.
 */
function generateCountyFipsList() {
  const countyFips = [];

  // For each state, generate potential county FIPS
  // Max county code varies by state. VA goes up to 840 (independent cities).
  // Most states max out around 200-300 range.
  // We generate all odd numbers 001-510 plus VA special range.
  for (const stateFips of STATE_FIPS) {
    const maxCounty = stateFips === '51' ? 840 : 510;

    for (let c = 1; c <= maxCounty; c += 2) {
      countyFips.push(stateFips + String(c).padStart(3, '0'));
    }

    // Virginia independent cities have even FIPS codes in 510-840 range
    if (stateFips === '51') {
      for (let c = 510; c <= 840; c += 2) {
        countyFips.push(stateFips + String(c).padStart(3, '0'));
      }
    }

    // Some states have even county FIPS (e.g., some boroughs/parishes)
    // Add common even county codes for known states
    if (['02', '15', '25', '29', '22'].includes(stateFips)) {
      for (let c = 2; c <= 510; c += 2) {
        countyFips.push(stateFips + String(c).padStart(3, '0'));
      }
    }
  }

  // Connecticut planning regions (new FIPS)
  for (let c = 110; c <= 190; c += 10) {
    countyFips.push('09' + String(c).padStart(3, '0'));
  }

  return [...new Set(countyFips)].sort();
}

/**
 * Ensure output directory exists
 */
function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Main
 */
async function main() {
  console.log('=== BLS LAUS Data Fetch ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  ensureDir(RAW_DIR);

  // Fetch state data
  const stateData = await fetchStateLAUS();
  const stateFile = path.join(RAW_DIR, 'bls-laus-states.json');
  writeFileSync(stateFile, JSON.stringify(stateData, null, 2));
  console.log(`Saved state data to ${stateFile}`);

  // Fetch county data
  const countyData = await fetchCountyLAUS();
  const countyFile = path.join(RAW_DIR, 'bls-laus-counties.json');
  writeFileSync(countyFile, JSON.stringify(countyData, null, 2));
  console.log(`Saved county data to ${countyFile}`);

  console.log('=== LAUS fetch complete ===');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
