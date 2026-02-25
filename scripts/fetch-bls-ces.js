/**
 * fetch-bls-ces.js
 * Fetches Current Employment Statistics (CES) from BLS API v2.
 * - State-level: total nonfarm employment, avg hourly earnings, avg weekly earnings, avg weekly hours
 * - Metro-level: same metrics for top ~400 metro areas
 * Saves to data/raw/bls-ces-states.json and data/raw/bls-ces-metros.json
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

// CES data codes (suffix after area code):
// 0000000001 = All employees, thousands (total nonfarm, supersector 00)
// 0500000003 = Avg hourly earnings, all employees, total private
// 0500000011 = Avg weekly earnings, all employees, total private
// 0500000002 = Avg weekly hours, all employees, total private
const CES_MEASURES = {
  '0000000001': 'total_nonfarm_employment',
  '0500000003': 'avg_hourly_earnings',
  '0500000011': 'avg_weekly_earnings',
  '0500000002': 'avg_weekly_hours'
};

// Top metro area CBSA codes for CES data
// These correspond to major metro areas that have CES data available
const METRO_CODES = [
  '0000071650', '0000071950', '0000672000', '0000673450', '0000674950',
  '0000610420', '0000611100', '0000612060', '0000612420', '0000612540',
  '0000612580', '0000612940', '0000613820', '0000614260', '0000614460',
  '0000615380', '0000615980', '0000616740', '0000616980', '0000617140',
  '0000617460', '0000617820', '0000617900', '0000618140', '0000619100',
  '0000619380', '0000619740', '0000619780', '0000619820', '0000620500',
  '0000621340', '0000622180', '0000623060', '0000623420', '0000623540',
  '0000624340', '0000624660', '0000624860', '0000625420', '0000625540',
  '0000626420', '0000626900', '0000627140', '0000627260', '0000628140',
  '0000628940', '0000629460', '0000629820', '0000630460', '0000630780',
  '0000631080', '0000631140', '0000632580', '0000633100', '0000633340',
  '0000633460', '0000634980', '0000635380', '0000635620', '0000635840',
  '0000636260', '0000636420', '0000636540', '0000636740', '0000637100',
  '0000637340', '0000637980', '0000638060', '0000638300', '0000638900',
  '0000639300', '0000639580', '0000640060', '0000640140', '0000640380',
  '0000640900', '0000641180', '0000641420', '0000641620', '0000641700',
  '0000641740', '0000641860', '0000641940', '0000642220', '0000642340',
  '0000642540', '0000642660', '0000643780', '0000644060', '0000644140',
  '0000645060', '0000645300', '0000645780', '0000646060', '0000646140',
  '0000647260', '0000647900', '0000648620', '0000649340'
];

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;
const BATCH_SIZE = 50;
const BATCH_DELAY_MS = 1500;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

class RateLimitError extends Error {
  constructor(msg) { super(msg); this.name = 'RateLimitError'; }
}

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
      if (msg.includes('threshold') || msg.includes('daily') || msg.includes('rate')) {
        throw new RateLimitError(`BLS API rate limit: ${msg}`);
      }
      throw new Error(`BLS API error: ${msg}`);
    }

    return json;
  } catch (err) {
    if (err instanceof RateLimitError) throw err;
    if (attempt < MAX_RETRIES) {
      console.warn(`  Retry ${attempt}/${MAX_RETRIES} after error: ${err.message}`);
      await sleep(RETRY_DELAY_MS * attempt);
      return fetchBLS(seriesIds, startYear, endYear, attempt + 1);
    }
    throw err;
  }
}

function extractAnnualAverage(seriesData) {
  const annualAvg = seriesData.find(d => d.period === 'M13');
  if (annualAvg) return annualAvg.value;

  const sorted = [...seriesData].sort((a, b) => {
    if (a.year !== b.year) return b.year.localeCompare(a.year);
    return b.period.localeCompare(a.period);
  });
  return sorted.length > 0 ? sorted[0].value : null;
}

function batchArray(arr, size) {
  const batches = [];
  for (let i = 0; i < arr.length; i += size) {
    batches.push(arr.slice(i, i + size));
  }
  return batches;
}

/**
 * Build CES state series IDs.
 * Format: SMU{stateFIPS}{measure} for seasonally adjusted state data.
 * Seasonally adjusted prefix: SMS for seasonally adjusted, SMU for not seasonally adjusted.
 * Not all states have SA data; we try SMS first, fall back to SMU.
 * Actually, state CES uses: S{seasonal}{stateFIPS}{areaCode}{supersector}{industry}{dataType}
 * Simplified: SMS{stateFIPS}00000000000{dataType} for SA state-level totals
 */
async function fetchStateCES() {
  console.log('Fetching state-level CES data...');
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 1;

  const seriesIds = [];
  const seriesMap = {};

  for (const fips of STATE_FIPS) {
    for (const [measureCode, fieldName] of Object.entries(CES_MEASURES)) {
      // Try seasonally adjusted (SMS) for total nonfarm, not adjusted (SMU) for wages
      const prefix = measureCode === '0000000001' ? 'SMS' : 'SMU';
      const seriesId = `${prefix}${fips}${measureCode}`;
      seriesIds.push(seriesId);
      seriesMap[seriesId] = { fips, field: fieldName };
    }
  }

  const states = {};
  const batches = batchArray(seriesIds, BATCH_SIZE);
  console.log(`  ${seriesIds.length} series in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i++) {
    console.log(`  Batch ${i + 1}/${batches.length}`);

    try {
      const json = await fetchBLS(batches[i], startYear, currentYear);

      if (json.Results?.series) {
        for (const series of json.Results.series) {
          const info = seriesMap[series.seriesID];
          if (!info || !series.data?.length) continue;

          const value = extractAnnualAverage(series.data);
          if (value === null || value === undefined) continue;

          if (!states[info.fips]) {
            states[info.fips] = { fips: info.fips };
          }

          const numVal = parseFloat(value.replace(/,/g, ''));
          states[info.fips][info.field] = isNaN(numVal) ? null : numVal;
        }
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.error(`  Rate limited — aborting state CES fetch. Got ${Object.keys(states).length} states.`);
        break;
      }
      console.warn(`  Batch ${i + 1} failed: ${err.message}`);
    }

    if (i < batches.length - 1) await sleep(BATCH_DELAY_MS);
  }

  console.log(`  Fetched CES data for ${Object.keys(states).length} states`);
  return states;
}

/**
 * Fetch metro-level CES data for major metropolitan areas.
 * Metro CES series format: SMS{areaCode}{measureCode} or SMU{areaCode}{measureCode}
 * Area codes for metros are CBSA-based, zero-padded to 10 digits.
 */
async function fetchMetroCES() {
  console.log('Fetching metro-level CES data...');
  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 1;

  const seriesIds = [];
  const seriesMap = {};

  for (const metroCode of METRO_CODES) {
    for (const [measureCode, fieldName] of Object.entries(CES_MEASURES)) {
      // Metro CES uses SMU (not seasonally adjusted) for most metros
      const seriesId = `SMU${metroCode}${measureCode}`;
      seriesIds.push(seriesId);
      seriesMap[seriesId] = { metro: metroCode, field: fieldName };
    }
  }

  const metros = {};
  const batches = batchArray(seriesIds, BATCH_SIZE);
  console.log(`  ${seriesIds.length} series in ${batches.length} batches`);

  for (let i = 0; i < batches.length; i++) {
    if (i % 10 === 0) {
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

          if (!metros[info.metro]) {
            metros[info.metro] = { areaCode: info.metro };
          }

          const numVal = parseFloat(value.replace(/,/g, ''));
          metros[info.metro][info.field] = isNaN(numVal) ? null : numVal;
        }
      }
    } catch (err) {
      if (err instanceof RateLimitError) {
        console.error(`  Rate limited — aborting metro CES fetch. Got ${Object.keys(metros).length} metros.`);
        break;
      }
      console.warn(`  Batch ${i + 1} failed: ${err.message}`);
    }

    if (i < batches.length - 1) await sleep(BATCH_DELAY_MS);
  }

  console.log(`  Fetched CES data for ${Object.keys(metros).length} metros`);
  return metros;
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  console.log('=== BLS CES Data Fetch ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  ensureDir(RAW_DIR);

  const stateData = await fetchStateCES();
  const stateFile = path.join(RAW_DIR, 'bls-ces-states.json');
  writeFileSync(stateFile, JSON.stringify(stateData, null, 2));
  console.log(`Saved state CES data to ${stateFile}`);

  const metroData = await fetchMetroCES();
  const metroFile = path.join(RAW_DIR, 'bls-ces-metros.json');
  writeFileSync(metroFile, JSON.stringify(metroData, null, 2));
  console.log(`Saved metro CES data to ${metroFile}`);

  console.log('=== CES fetch complete ===');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
