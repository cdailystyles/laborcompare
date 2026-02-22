/**
 * generate-state-files.js
 * Joins BLS LAUS county data, Census ACS data, and BEA income data
 * into per-state county JSON files.
 * Also creates data/states/economic-data.json with state-level aggregates.
 *
 * Output per state: data/counties/{fips}-{name}.json
 * Output manifest: data/counties/index.json
 * Output state data: data/states/economic-data.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const COUNTIES_DIR = path.join(DATA_DIR, 'counties');
const STATES_DIR = path.join(DATA_DIR, 'states');

// Connecticut FIPS mapping: new planning region FIPS -> old county FIPS
// Census ACS uses new planning regions; BEA/BLS may use old county FIPS
const CT_NEW_TO_OLD = {
  '09110': '09001', // Capitol -> Fairfield (approximate)
  '09120': '09003', // Greater Bridgeport -> Hartford
  '09130': '09005', // Lower CT River Valley -> Litchfield
  '09140': '09007', // Naugatuck Valley -> Middlesex
  '09150': '09009', // Northeastern CT -> New Haven
  '09160': '09011', // Northwest Hills -> New London
  '09170': '09013', // South Central CT -> Tolland
  '09180': '09015', // Southeastern CT -> Windham
  '09190': null       // Western CT -> no direct mapping
};

// Reverse: old -> new
const CT_OLD_TO_NEW = {};
for (const [newFips, oldFips] of Object.entries(CT_NEW_TO_OLD)) {
  if (oldFips) CT_OLD_TO_NEW[oldFips] = newFips;
}

// State FIPS to name mapping
const STATE_NAMES = {
  '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
  '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
  '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
  '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
  '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
  '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
  '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
  '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
  '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
  '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
  '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
  '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
  '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
};

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readJSON(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`  Warning: Could not read ${filePath}: ${err.message}`);
    return null;
  }
}

/**
 * Round a number to specified decimal places, return null if invalid
 */
function round(val, decimals = 1) {
  if (val === null || val === undefined || isNaN(val)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function main() {
  console.log('=== Generate State County Files ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  ensureDir(COUNTIES_DIR);
  ensureDir(STATES_DIR);

  // Load raw data
  const lausCounties = readJSON(path.join(RAW_DIR, 'bls-laus-counties.json')) || {};
  const lausStates = readJSON(path.join(RAW_DIR, 'bls-laus-states.json')) || {};
  const cesStates = readJSON(path.join(RAW_DIR, 'bls-ces-states.json')) || {};
  const censusData = readJSON(path.join(RAW_DIR, 'census-acs.json')) || {};
  const beaData = readJSON(path.join(RAW_DIR, 'bea-income.json'));
  const beaCounties = beaData?.counties || {};
  const beaStates = beaData?.states || {};

  console.log(`  LAUS counties: ${Object.keys(lausCounties).length}`);
  console.log(`  LAUS states: ${Object.keys(lausStates).length}`);
  console.log(`  CES states: ${Object.keys(cesStates).length}`);
  console.log(`  Census counties: ${Object.keys(censusData).length}`);
  console.log(`  BEA counties: ${Object.keys(beaCounties).length}`);
  console.log(`  BEA states: ${Object.keys(beaStates).length}`);

  // Group Census data by state FIPS
  const censusByState = {};
  for (const [fips, data] of Object.entries(censusData)) {
    const stateFips = data.state_fips || fips.substring(0, 2);
    if (!censusByState[stateFips]) censusByState[stateFips] = {};
    censusByState[stateFips][fips] = data;
  }

  const stateIndex = [];
  const stateEconomicData = {};
  let totalCounties = 0;

  for (const [stateFips, stateName] of Object.entries(STATE_NAMES)) {
    const stateCounties = censusByState[stateFips] || {};
    const countyOutput = {};

    for (const [fips, census] of Object.entries(stateCounties)) {
      // Get LAUS data — try direct FIPS, then try CT mapping
      let laus = lausCounties[fips];
      if (!laus && stateFips === '09') {
        // Try old CT FIPS
        const oldFips = CT_NEW_TO_OLD[fips];
        if (oldFips) laus = lausCounties[oldFips];
      }

      // Get BEA data — try direct FIPS, then try CT mapping
      let bea = beaCounties[fips];
      if (!bea && stateFips === '09') {
        const oldFips = CT_NEW_TO_OLD[fips];
        if (oldFips) bea = beaCounties[oldFips];
      }

      countyOutput[fips] = {
        name: census.name || '',
        unemployment_rate: round(laus?.unemployment_rate, 1) ?? round(census.unemployed && census.labor_force ? (census.unemployed / census.labor_force) * 100 : null, 1),
        labor_force: laus?.labor_force ?? census.labor_force ?? null,
        employment: laus?.employment ?? null,
        median_household_income: census.median_household_income,
        median_earnings: census.median_earnings,
        per_capita_income: bea?.per_capita_income ?? census.per_capita_income,
        median_home_value: census.median_home_value,
        median_rent: census.median_rent,
        population: census.population,
        poverty_rate: round(census.poverty_rate, 1),
        median_age: round(census.median_age, 1),
        bachelors_or_higher_pct: round(census.bachelors_or_higher_pct, 1),
        hs_diploma_or_higher_pct: round(census.hs_diploma_or_higher_pct, 1),
        gini_index: round(census.gini_index, 3),
        homeownership_rate: round(census.homeownership_rate, 1),
        vacancy_rate: round(census.vacancy_rate, 1)
      };
    }

    // Also include counties that are in LAUS but not in Census (unlikely, but defensive)
    for (const [fips, laus] of Object.entries(lausCounties)) {
      if (fips.substring(0, 2) !== stateFips) continue;
      if (countyOutput[fips]) continue;

      const bea = beaCounties[fips];
      countyOutput[fips] = {
        name: bea?.geo_name || `County ${fips}`,
        unemployment_rate: round(laus.unemployment_rate, 1),
        labor_force: laus.labor_force ?? null,
        employment: laus.employment ?? null,
        median_household_income: null,
        median_earnings: null,
        per_capita_income: bea?.per_capita_income ?? null,
        median_home_value: null,
        median_rent: null,
        population: null,
        poverty_rate: null,
        median_age: null,
        bachelors_or_higher_pct: null,
        hs_diploma_or_higher_pct: null,
        gini_index: null,
        homeownership_rate: null,
        vacancy_rate: null
      };
    }

    const countyCount = Object.keys(countyOutput).length;
    if (countyCount === 0) {
      console.warn(`  Warning: No counties for ${stateName} (${stateFips})`);
      continue;
    }

    totalCounties += countyCount;

    // Write per-state file
    const slug = stateName.toLowerCase().replace(/\s+/g, '-');
    const filename = `${stateFips}-${slug}.json`;
    const stateFile = {
      state_fips: stateFips,
      state_name: stateName,
      counties: countyOutput
    };

    writeFileSync(
      path.join(COUNTIES_DIR, filename),
      JSON.stringify(stateFile, null, 2)
    );

    stateIndex.push({
      fips: stateFips,
      name: stateName,
      filename: filename,
      county_count: countyCount
    });

    // Build state-level economic data aggregate
    const laus = lausStates[stateFips] || {};
    const ces = cesStates[stateFips] || {};
    const beaState = beaStates[stateFips] || {};

    // Aggregate from counties where state-level data is missing
    const countyValues = Object.values(countyOutput);
    const validPop = countyValues.filter(c => c.population != null);
    const totalPop = validPop.reduce((sum, c) => sum + c.population, 0);

    // Weighted average for median household income (approximate)
    const validIncome = countyValues.filter(c => c.median_household_income != null && c.population != null);
    const weightedIncome = validIncome.length > 0
      ? validIncome.reduce((sum, c) => sum + c.median_household_income * c.population, 0) /
        validIncome.reduce((sum, c) => sum + c.population, 0)
      : null;

    stateEconomicData[stateName] = {
      fips: stateFips,
      unemployment_rate: round(laus.unemployment_rate, 1),
      labor_force: laus.labor_force ?? null,
      employment: laus.employment ?? null,
      unemployment_count: laus.unemployment_count ?? null,
      total_nonfarm_employment: ces.total_nonfarm_employment ?? null,
      avg_hourly_earnings: round(ces.avg_hourly_earnings, 2),
      avg_weekly_earnings: round(ces.avg_weekly_earnings, 2),
      avg_weekly_hours: round(ces.avg_weekly_hours, 1),
      per_capita_income: beaState.per_capita_income ?? null,
      population: totalPop || null,
      median_household_income: round(weightedIncome, 0),
      county_count: countyCount
    };
  }

  // Write index manifest
  writeFileSync(
    path.join(COUNTIES_DIR, 'index.json'),
    JSON.stringify(stateIndex, null, 2)
  );

  // Write state economic data
  writeFileSync(
    path.join(STATES_DIR, 'economic-data.json'),
    JSON.stringify({ data: stateEconomicData }, null, 2)
  );

  console.log(`  Generated files for ${stateIndex.length} states, ${totalCounties} total counties`);
  console.log(`  Saved index to data/counties/index.json`);
  console.log(`  Saved state data to data/states/economic-data.json`);
  console.log('=== State file generation complete ===');
}

main();
