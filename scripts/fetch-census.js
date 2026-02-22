/**
 * fetch-census.js
 * Fetches Census ACS 5-year data for all counties.
 * Variables include: median household income, per capita income, median home value,
 * median rent, population, poverty count, labor force, unemployed, median earnings,
 * median age, educational attainment, gini index, homeownership rate, vacancy rate.
 * Saves to data/raw/census-acs.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

const CENSUS_API_KEY = process.env.CENSUS_API_KEY;

if (!CENSUS_API_KEY) {
  console.error('ERROR: CENSUS_API_KEY environment variable is required.');
  process.exit(1);
}

// ACS 5-year endpoint — try 2023, fall back to 2022
const ACS_YEAR = 2023;
const ACS_BASE_URL = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5`;

// Variables to fetch (detail tables)
const DETAIL_VARIABLES = [
  'B19013_001E',  // Median household income
  'B19301_001E',  // Per capita income
  'B25077_001E',  // Median home value
  'B25064_001E',  // Median gross rent
  'B01003_001E',  // Total population
  'B17001_002E',  // Poverty count (income below poverty level)
  'B17001_001E',  // Poverty universe (total for whom poverty status determined)
  'B23025_003E',  // Civilian labor force
  'B23025_005E',  // Unemployed (civilian)
  'B01002_001E',  // Median age
  'B15003_022E',  // Bachelor's degree
  'B15003_023E',  // Master's degree
  'B15003_024E',  // Professional school degree
  'B15003_025E',  // Doctorate degree
  'B15003_017E',  // Regular HS diploma
  'B15003_018E',  // GED/alternative
  'B15003_019E',  // Some college less than 1 year
  'B15003_020E',  // Some college 1+ years
  'B15003_021E',  // Associate's degree
  'B15003_001E',  // Total education universe (25+)
  'B19083_001E',  // Gini index
  'B25003_001E',  // Total occupied housing units
  'B25003_002E',  // Owner-occupied housing units
  'B25002_001E',  // Total housing units
  'B25002_003E',  // Vacant housing units
  'NAME'
];

// Subject table variables (fetched separately)
const SUBJECT_VARIABLES = [
  'S2401_C01_001E',  // Median earnings for workers (not always available at county)
  'NAME'
];

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch from Census API with retries
 */
async function fetchCensus(url, attempt = 1) {
  try {
    console.log(`  Fetching: ${url.replace(CENSUS_API_KEY, '***')}`);
    const response = await fetch(url);

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`HTTP ${response.status}: ${text.substring(0, 200)}`);
    }

    const json = await response.json();
    return json;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`  Retry ${attempt}/${MAX_RETRIES}: ${err.message}`);
      await sleep(RETRY_DELAY_MS * attempt);
      return fetchCensus(url, attempt + 1);
    }
    throw err;
  }
}

/**
 * Parse Census API response (array of arrays, first row is headers)
 */
function parseCensusResponse(data) {
  if (!data || data.length < 2) return [];

  const headers = data[0];
  const rows = data.slice(1);

  return rows.map(row => {
    const obj = {};
    headers.forEach((h, i) => {
      obj[h] = row[i];
    });
    return obj;
  });
}

/**
 * Fetch detail table variables for all counties
 */
async function fetchDetailData() {
  console.log('Fetching ACS detail table data for all counties...');

  const varList = DETAIL_VARIABLES.join(',');
  const url = `${ACS_BASE_URL}?get=${varList}&for=county:*&in=state:*&key=${CENSUS_API_KEY}`;

  const data = await fetchCensus(url);
  const parsed = parseCensusResponse(data);
  console.log(`  Received ${parsed.length} county records from detail tables`);
  return parsed;
}

/**
 * Fetch subject table variables for all counties.
 * Subject tables may not be available at county level; handle gracefully.
 */
async function fetchSubjectData() {
  console.log('Fetching ACS subject table data for all counties...');

  const varList = SUBJECT_VARIABLES.join(',');
  const subjectUrl = `https://api.census.gov/data/${ACS_YEAR}/acs/acs5/subject`;
  const url = `${subjectUrl}?get=${varList}&for=county:*&in=state:*&key=${CENSUS_API_KEY}`;

  try {
    const data = await fetchCensus(url);
    const parsed = parseCensusResponse(data);
    console.log(`  Received ${parsed.length} county records from subject tables`);
    return parsed;
  } catch (err) {
    console.warn(`  Subject table fetch failed (non-fatal): ${err.message}`);
    console.warn('  Median earnings will not be available.');
    return [];
  }
}

/**
 * Safe parse a numeric value from Census data.
 * Census returns null/-666666666 for missing data.
 */
function safeNum(val) {
  if (val === null || val === undefined || val === '' || val === 'null') return null;
  const n = parseFloat(val);
  if (isNaN(n) || n <= -666666666) return null;
  return n;
}

/**
 * Process and join all Census data into a structured format
 */
function processData(detailRows, subjectRows) {
  console.log('Processing Census data...');

  // Index subject data by FIPS for easy lookup
  const subjectByFips = {};
  for (const row of subjectRows) {
    const fips = row.state + row.county;
    subjectByFips[fips] = row;
  }

  const counties = {};

  for (const row of detailRows) {
    const fips = row.state + row.county;
    const subjectRow = subjectByFips[fips] || {};

    // Parse education components
    const eduTotal = safeNum(row.B15003_001E);
    const bachelors = safeNum(row.B15003_022E);
    const masters = safeNum(row.B15003_023E);
    const professional = safeNum(row.B15003_024E);
    const doctorate = safeNum(row.B15003_025E);
    const hsRegular = safeNum(row.B15003_017E);
    const hsGed = safeNum(row.B15003_018E);
    const someCollege1 = safeNum(row.B15003_019E);
    const someCollege2 = safeNum(row.B15003_020E);
    const associates = safeNum(row.B15003_021E);

    // Bachelor's or higher percentage
    let bachelorsOrHigherPct = null;
    if (eduTotal && eduTotal > 0) {
      const bachPlus = (bachelors || 0) + (masters || 0) + (professional || 0) + (doctorate || 0);
      bachelorsOrHigherPct = Math.round((bachPlus / eduTotal) * 1000) / 10;
    }

    // HS diploma or higher percentage
    let hsDiplomaOrHigherPct = null;
    if (eduTotal && eduTotal > 0) {
      const hsPlus = (hsRegular || 0) + (hsGed || 0) + (someCollege1 || 0) +
        (someCollege2 || 0) + (associates || 0) + (bachelors || 0) +
        (masters || 0) + (professional || 0) + (doctorate || 0);
      hsDiplomaOrHigherPct = Math.round((hsPlus / eduTotal) * 1000) / 10;
    }

    // Poverty rate
    const povertyCount = safeNum(row.B17001_002E);
    const povertyUniverse = safeNum(row.B17001_001E);
    let povertyRate = null;
    if (povertyCount !== null && povertyUniverse && povertyUniverse > 0) {
      povertyRate = Math.round((povertyCount / povertyUniverse) * 1000) / 10;
    }

    // Homeownership rate
    const totalOccupied = safeNum(row.B25003_001E);
    const ownerOccupied = safeNum(row.B25003_002E);
    let homeownershipRate = null;
    if (ownerOccupied !== null && totalOccupied && totalOccupied > 0) {
      homeownershipRate = Math.round((ownerOccupied / totalOccupied) * 1000) / 10;
    }

    // Vacancy rate
    const totalHousing = safeNum(row.B25002_001E);
    const vacantUnits = safeNum(row.B25002_003E);
    let vacancyRate = null;
    if (vacantUnits !== null && totalHousing && totalHousing > 0) {
      vacancyRate = Math.round((vacantUnits / totalHousing) * 1000) / 10;
    }

    // Gini index (3 decimal places)
    let giniIndex = safeNum(row.B19083_001E);
    if (giniIndex !== null) {
      giniIndex = Math.round(giniIndex * 1000) / 1000;
    }

    counties[fips] = {
      name: row.NAME || '',
      state_fips: row.state,
      county_fips: row.county,
      fips: fips,
      median_household_income: safeNum(row.B19013_001E),
      per_capita_income: safeNum(row.B19301_001E),
      median_home_value: safeNum(row.B25077_001E),
      median_rent: safeNum(row.B25064_001E),
      population: safeNum(row.B01003_001E),
      poverty_rate: povertyRate,
      labor_force: safeNum(row.B23025_003E),
      unemployed: safeNum(row.B23025_005E),
      median_earnings: safeNum(subjectRow.S2401_C01_001E) || null,
      median_age: safeNum(row.B01002_001E),
      bachelors_or_higher_pct: bachelorsOrHigherPct,
      hs_diploma_or_higher_pct: hsDiplomaOrHigherPct,
      gini_index: giniIndex,
      homeownership_rate: homeownershipRate,
      vacancy_rate: vacancyRate
    };
  }

  console.log(`  Processed ${Object.keys(counties).length} counties`);
  return counties;
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

async function main() {
  console.log('=== Census ACS Data Fetch ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);
  console.log(`ACS year: ${ACS_YEAR}`);
  ensureDir(RAW_DIR);

  const detailRows = await fetchDetailData();
  const subjectRows = await fetchSubjectData();
  const processedData = processData(detailRows, subjectRows);

  const outFile = path.join(RAW_DIR, 'census-acs.json');
  writeFileSync(outFile, JSON.stringify(processedData, null, 2));
  console.log(`Saved Census data to ${outFile}`);

  console.log('=== Census ACS fetch complete ===');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
