/**
 * process-oews.js
 * Processes raw OEWS data into per-occupation and per-area JSON files.
 *
 * Input: data/raw/oews-raw.json (from fetch-oews.js)
 *
 * Output structure:
 *   data/oews/national.json                    All occupations, national stats
 *   data/oews/soc-hierarchy.json               SOC code tree for browsing
 *   data/oews/occupations/by-state/{soc}.json  One occupation across all states
 *   data/oews/occupations/by-metro/{soc}.json  One occupation across all metros
 *   data/oews/areas/states/{fips}.json          One state, all occupations
 *   data/oews/areas/metros/{cbsa}.json          One metro, all occupations
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const OEWS_DIR = path.join(DATA_DIR, 'oews');

// State FIPS to name mapping
const STATE_FIPS_TO_NAME = {
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

/**
 * Compact occupation record for file output
 */
function compactOcc(row) {
  const r = {};
  if (row.tot_emp !== null) r.emp = row.tot_emp;
  if (row.a_median !== null) r.med = row.a_median;
  if (row.a_mean !== null) r.avg = row.a_mean;
  if (row.h_median !== null) r.hmed = row.h_median;
  if (row.h_mean !== null) r.havg = row.h_mean;
  if (row.a_pct10 !== null) r.p10 = row.a_pct10;
  if (row.a_pct25 !== null) r.p25 = row.a_pct25;
  if (row.a_pct75 !== null) r.p75 = row.a_pct75;
  if (row.a_pct90 !== null) r.p90 = row.a_pct90;
  if (row.jobs_1000 !== null) r.j1k = row.jobs_1000;
  if (row.loc_quotient !== null) r.lq = row.loc_quotient;
  return r;
}

/**
 * Build SOC hierarchy from occupation codes
 * SOC format: XX-XXXX
 *   XX-0000 = major group
 *   XX-X000 = minor group (sometimes)
 *   XX-XXX0 = broad occupation
 *   XX-XXXX = detailed occupation
 */
function buildSOCHierarchy(occupations) {
  const majors = {};

  for (const [code, title] of Object.entries(occupations)) {
    const majorCode = code.slice(0, 2);
    if (!majors[majorCode]) {
      majors[majorCode] = { title: '', occupations: [] };
    }

    if (code.endsWith('-0000')) {
      majors[majorCode].title = title;
    } else {
      majors[majorCode].occupations.push({ code, title });
    }
  }

  // Sort occupations within each major group
  for (const group of Object.values(majors)) {
    group.occupations.sort((a, b) => a.title.localeCompare(b.title));
  }

  return majors;
}

/**
 * Extract state FIPS from OEWS area code
 * Handles multiple formats:
 *   7-digit: SS00000 (e.g., 0100000 for Alabama) — from "all" data file
 *   Numeric: 1000000, 100000, etc. — padded variants
 *   Direct:  01, 02, etc. — from state-specific files
 *   With zeros: 0100000 or just the state code
 */
function getStateFips(areaCode) {
  const s = String(areaCode).trim();

  // 7-digit format: SS00000
  if (s.length === 7 && s.endsWith('00000')) {
    return s.slice(0, 2);
  }

  // Numeric that ends in zeros (e.g., "100000" for state 10, or "4200000" for PA)
  if (/^\d+0{4,}$/.test(s) && s.length >= 6) {
    const fips = s.replace(/0+$/, '').padStart(2, '0');
    if (fips.length === 2 && STATE_FIPS_TO_NAME[fips]) return fips;
  }

  // Direct 2-digit FIPS (from state-specific download files)
  if (s.length <= 2 && /^\d+$/.test(s)) {
    return s.padStart(2, '0');
  }

  return null;
}

function main() {
  console.log('\n=== Processing OEWS Data ===\n');

  // Load raw data
  const rawPath = path.join(RAW_DIR, 'oews-raw.json');
  console.log(`Loading ${rawPath}...`);
  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
  const rows = raw.data;
  console.log(`  Loaded ${rows.length} records from OEWS ${raw.year}`);

  // Create output directories
  const dirs = [
    OEWS_DIR,
    path.join(OEWS_DIR, 'occupations', 'by-state'),
    path.join(OEWS_DIR, 'occupations', 'by-metro'),
    path.join(OEWS_DIR, 'areas', 'states'),
    path.join(OEWS_DIR, 'areas', 'metros')
  ];
  dirs.forEach(d => mkdirSync(d, { recursive: true }));

  // Categorize rows by area type
  // BLS OEWS area_type codes: 1=National, 2=State, 3=US Territory, 4=MSA, 5=Metro Division, 6=Non-metro
  const national = [];   // area_type 1
  const stateRows = [];  // area_type 2
  const metroRows = [];  // area_type 4 (MSA)

  for (const row of rows) {
    if (row.area_type === 1) national.push(row);
    else if (row.area_type === 2) stateRows.push(row);
    else if (row.area_type === 4) metroRows.push(row);
  }

  // Debug: show unique area_type values
  const areaTypeCounts = {};
  for (const row of rows) {
    const t = row.area_type === null ? 'null' : row.area_type;
    areaTypeCounts[t] = (areaTypeCounts[t] || 0) + 1;
  }
  console.log(`  Area type distribution: ${JSON.stringify(areaTypeCounts)}`);
  console.log(`  National: ${national.length}, State: ${stateRows.length}, Metro: ${metroRows.length}`);

  // Debug: show sample area codes
  if (stateRows.length > 0) {
    const sampleAreas = [...new Set(stateRows.slice(0, 100).map(r => r.area))].slice(0, 10);
    console.log(`  Sample state area codes: ${sampleAreas.join(', ')}`);
  }
  if (metroRows.length > 0) {
    const sampleMetros = [...new Set(metroRows.slice(0, 100).map(r => r.area))].slice(0, 10);
    console.log(`  Sample metro area codes: ${sampleMetros.join(', ')}`);
  }

  // ================================================================
  // 1. national.json — all occupations with national stats
  // ================================================================
  console.log('\n1. Building national.json...');
  const nationalData = {};
  const allOccupations = {}; // code -> title for hierarchy

  // Only keep detailed occupations for national file
  for (const row of national) {
    if (row.o_group !== 'detailed' && row.o_group !== 'major') continue;
    allOccupations[row.occ_code] = row.occ_title;

    if (row.o_group === 'detailed') {
      nationalData[row.occ_code] = {
        title: row.occ_title,
        ...compactOcc(row)
      };
    }
  }

  writeFileSync(
    path.join(OEWS_DIR, 'national.json'),
    JSON.stringify({
      year: raw.year,
      count: Object.keys(nationalData).length,
      occupations: nationalData
    })
  );
  console.log(`  Wrote ${Object.keys(nationalData).length} occupations`);

  // ================================================================
  // 2. soc-hierarchy.json — SOC tree for browsing
  // ================================================================
  console.log('\n2. Building soc-hierarchy.json...');
  const hierarchy = buildSOCHierarchy(allOccupations);
  writeFileSync(
    path.join(OEWS_DIR, 'soc-hierarchy.json'),
    JSON.stringify(hierarchy)
  );
  const majorCount = Object.keys(hierarchy).length;
  console.log(`  Wrote ${majorCount} major groups`);

  // ================================================================
  // 3. Per-occupation by-state files
  // ================================================================
  console.log('\n3. Building per-occupation by-state files...');
  const occByState = {}; // occ_code -> { fips: data }

  for (const row of stateRows) {
    if (row.o_group !== 'detailed') continue;
    const fips = getStateFips(row.area);
    if (!fips || !STATE_FIPS_TO_NAME[fips]) continue;

    if (!occByState[row.occ_code]) {
      occByState[row.occ_code] = {};
    }
    occByState[row.occ_code][fips] = compactOcc(row);
  }

  let stateFileCount = 0;
  for (const [soc, states] of Object.entries(occByState)) {
    const title = allOccupations[soc] || soc;
    writeFileSync(
      path.join(OEWS_DIR, 'occupations', 'by-state', `${soc}.json`),
      JSON.stringify({ soc, title, states })
    );
    stateFileCount++;
  }
  console.log(`  Wrote ${stateFileCount} occupation-by-state files`);

  // ================================================================
  // 4. Per-occupation by-metro files
  // ================================================================
  console.log('\n4. Building per-occupation by-metro files...');
  const occByMetro = {}; // occ_code -> { cbsa: { name, ...data } }

  for (const row of metroRows) {
    if (row.o_group !== 'detailed') continue;

    if (!occByMetro[row.occ_code]) {
      occByMetro[row.occ_code] = {};
    }
    occByMetro[row.occ_code][row.area] = {
      name: row.area_title,
      ...compactOcc(row)
    };
  }

  let metroFileCount = 0;
  for (const [soc, metros] of Object.entries(occByMetro)) {
    const title = allOccupations[soc] || soc;
    writeFileSync(
      path.join(OEWS_DIR, 'occupations', 'by-metro', `${soc}.json`),
      JSON.stringify({ soc, title, metros })
    );
    metroFileCount++;
  }
  console.log(`  Wrote ${metroFileCount} occupation-by-metro files`);

  // ================================================================
  // 5. Per-state area files (all occupations in one state)
  // ================================================================
  console.log('\n5. Building per-state area files...');
  const stateAreas = {}; // fips -> { occ_code: data }

  for (const row of stateRows) {
    if (row.o_group !== 'detailed') continue;
    const fips = getStateFips(row.area);
    if (!fips || !STATE_FIPS_TO_NAME[fips]) continue;

    if (!stateAreas[fips]) {
      stateAreas[fips] = {};
    }
    stateAreas[fips][row.occ_code] = {
      title: row.occ_title,
      ...compactOcc(row)
    };
  }

  for (const [fips, occs] of Object.entries(stateAreas)) {
    writeFileSync(
      path.join(OEWS_DIR, 'areas', 'states', `${fips}.json`),
      JSON.stringify({
        fips,
        name: STATE_FIPS_TO_NAME[fips],
        count: Object.keys(occs).length,
        occupations: occs
      })
    );
  }
  console.log(`  Wrote ${Object.keys(stateAreas).length} state area files`);

  // ================================================================
  // 6. Per-metro area files (all occupations in one metro)
  // ================================================================
  console.log('\n6. Building per-metro area files...');
  const metroAreas = {}; // cbsa -> { name, occ_code: data }
  const metroNames = {}; // cbsa -> name

  for (const row of metroRows) {
    if (row.o_group !== 'detailed') continue;

    if (!metroAreas[row.area]) {
      metroAreas[row.area] = {};
      metroNames[row.area] = row.area_title;
    }
    metroAreas[row.area][row.occ_code] = {
      title: row.occ_title,
      ...compactOcc(row)
    };
  }

  for (const [cbsa, occs] of Object.entries(metroAreas)) {
    writeFileSync(
      path.join(OEWS_DIR, 'areas', 'metros', `${cbsa}.json`),
      JSON.stringify({
        cbsa,
        name: metroNames[cbsa],
        count: Object.keys(occs).length,
        occupations: occs
      })
    );
  }
  console.log(`  Wrote ${Object.keys(metroAreas).length} metro area files`);

  // ================================================================
  // Summary
  // ================================================================
  console.log('\n=== OEWS Processing Complete ===');
  console.log(`  National occupations: ${Object.keys(nationalData).length}`);
  console.log(`  SOC major groups: ${majorCount}`);
  console.log(`  Occupation-by-state files: ${stateFileCount}`);
  console.log(`  Occupation-by-metro files: ${metroFileCount}`);
  console.log(`  State area files: ${Object.keys(stateAreas).length}`);
  console.log(`  Metro area files: ${Object.keys(metroAreas).length}`);
}

main();
