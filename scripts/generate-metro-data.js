/**
 * generate-metro-data.js
 * Creates metro-level data file from BLS CES metro data.
 * Combines CES employment/earnings data for metro areas.
 * Output: data/metros/metro-data.json
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const METROS_DIR = path.join(DATA_DIR, 'metros');

// CBSA code to metro name mapping for major metros
// Area codes in BLS CES format (10-digit, zero-padded)
const METRO_NAMES = {
  '0000071650': 'Los Angeles-Long Beach, CA',
  '0000071950': 'New York City, NY',
  '0000672000': 'Chicago, IL',
  '0000673450': 'Dallas, TX',
  '0000674950': 'Houston, TX',
  '0000610420': 'Akron, OH',
  '0000611100': 'Amarillo, TX',
  '0000612060': 'Atlanta, GA',
  '0000612420': 'Austin, TX',
  '0000612540': 'Bakersfield, CA',
  '0000612580': 'Baltimore, MD',
  '0000612940': 'Baton Rouge, LA',
  '0000613820': 'Birmingham, AL',
  '0000614260': 'Boise City, ID',
  '0000614460': 'Boston, MA',
  '0000615380': 'Buffalo, NY',
  '0000615980': 'Cape Coral-Fort Myers, FL',
  '0000616740': 'Charlotte, NC',
  '0000616980': 'Chicago, IL',
  '0000617140': 'Cincinnati, OH',
  '0000617460': 'Cleveland, OH',
  '0000617820': 'Colorado Springs, CO',
  '0000617900': 'Columbia, SC',
  '0000618140': 'Columbus, OH',
  '0000619100': 'Dallas-Fort Worth, TX',
  '0000619380': 'Dayton, OH',
  '0000619740': 'Denver, CO',
  '0000619780': 'Des Moines, IA',
  '0000619820': 'Detroit, MI',
  '0000620500': 'Durham, NC',
  '0000621340': 'El Paso, TX',
  '0000622180': 'Fayetteville, AR',
  '0000623060': 'Fort Wayne, IN',
  '0000623420': 'Fresno, CA',
  '0000623540': 'Gainesville, FL',
  '0000624340': 'Grand Rapids, MI',
  '0000624660': 'Greensboro, NC',
  '0000624860': 'Greenville, SC',
  '0000625420': 'Harrisburg, PA',
  '0000625540': 'Hartford, CT',
  '0000626420': 'Houston, TX',
  '0000626900': 'Indianapolis, IN',
  '0000627140': 'Jackson, MS',
  '0000627260': 'Jacksonville, FL',
  '0000628140': 'Kansas City, MO',
  '0000628940': 'Knoxville, TN',
  '0000629460': 'Lakeland, FL',
  '0000629820': 'Las Vegas, NV',
  '0000630460': 'Lexington, KY',
  '0000630780': 'Little Rock, AR',
  '0000631080': 'Los Angeles, CA',
  '0000631140': 'Louisville, KY',
  '0000632580': 'McAllen, TX',
  '0000633100': 'Miami, FL',
  '0000633340': 'Milwaukee, WI',
  '0000633460': 'Minneapolis, MN',
  '0000634980': 'Nashville, TN',
  '0000635380': 'New Orleans, LA',
  '0000635620': 'New York, NY',
  '0000635840': 'North Port-Sarasota, FL',
  '0000636260': 'Ogden, UT',
  '0000636420': 'Oklahoma City, OK',
  '0000636540': 'Omaha, NE',
  '0000636740': 'Orlando, FL',
  '0000637100': 'Oxnard, CA',
  '0000637340': 'Palm Bay, FL',
  '0000637980': 'Philadelphia, PA',
  '0000638060': 'Phoenix, AZ',
  '0000638300': 'Pittsburgh, PA',
  '0000638900': 'Portland, OR',
  '0000639300': 'Providence, RI',
  '0000639580': 'Raleigh, NC',
  '0000640060': 'Richmond, VA',
  '0000640140': 'Riverside, CA',
  '0000640380': 'Rochester, NY',
  '0000640900': 'Sacramento, CA',
  '0000641180': 'St. Louis, MO',
  '0000641420': 'Salem, OR',
  '0000641620': 'Salt Lake City, UT',
  '0000641700': 'San Antonio, TX',
  '0000641740': 'San Diego, CA',
  '0000641860': 'San Francisco, CA',
  '0000641940': 'San Jose, CA',
  '0000642220': 'Santa Rosa, CA',
  '0000642340': 'Savannah, GA',
  '0000642540': 'Scranton, PA',
  '0000642660': 'Seattle, WA',
  '0000643780': 'South Bend, IN',
  '0000644060': 'Spokane, WA',
  '0000644140': 'Springfield, MA',
  '0000645060': 'Syracuse, NY',
  '0000645300': 'Tampa, FL',
  '0000645780': 'Toledo, OH',
  '0000646060': 'Tucson, AZ',
  '0000646140': 'Tulsa, OK',
  '0000647260': 'Virginia Beach, VA',
  '0000647900': 'Washington, DC',
  '0000648620': 'Wichita, KS',
  '0000649340': 'Worcester, MA'
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

function round(val, decimals = 1) {
  if (val === null || val === undefined || isNaN(val)) return null;
  const factor = Math.pow(10, decimals);
  return Math.round(val * factor) / factor;
}

function main() {
  console.log('=== Generate Metro Data ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  ensureDir(METROS_DIR);

  // Load CES metro data
  const cesMetros = readJSON(path.join(RAW_DIR, 'bls-ces-metros.json')) || {};
  console.log(`  CES metros loaded: ${Object.keys(cesMetros).length}`);

  const metroOutput = {};

  for (const [areaCode, ces] of Object.entries(cesMetros)) {
    const name = METRO_NAMES[areaCode] || `Metro ${areaCode}`;

    // Extract CBSA code from the 10-digit area code
    // BLS area code format: first 4 digits are zeros, last 5 are CBSA (approximately)
    const cbsa = areaCode.replace(/^0+/, '') || areaCode;

    metroOutput[areaCode] = {
      name: name,
      cbsa: cbsa,
      area_code: areaCode,
      total_nonfarm_employment: ces.total_nonfarm_employment ?? null,
      avg_hourly_earnings: round(ces.avg_hourly_earnings, 2),
      avg_weekly_earnings: round(ces.avg_weekly_earnings, 2),
      avg_weekly_hours: round(ces.avg_weekly_hours, 1)
    };
  }

  // Also add metros from METRO_NAMES that may not have CES data (placeholder)
  for (const [areaCode, name] of Object.entries(METRO_NAMES)) {
    if (!metroOutput[areaCode]) {
      const cbsa = areaCode.replace(/^0+/, '') || areaCode;
      metroOutput[areaCode] = {
        name: name,
        cbsa: cbsa,
        area_code: areaCode,
        total_nonfarm_employment: null,
        avg_hourly_earnings: null,
        avg_weekly_earnings: null,
        avg_weekly_hours: null
      };
    }
  }

  const outFile = path.join(METROS_DIR, 'metro-data.json');
  writeFileSync(outFile, JSON.stringify(metroOutput, null, 2));
  console.log(`  Saved ${Object.keys(metroOutput).length} metros to ${outFile}`);

  console.log('=== Metro data generation complete ===');
}

main();
