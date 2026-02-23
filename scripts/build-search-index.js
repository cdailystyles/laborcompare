/**
 * build-search-index.js
 * Builds a unified search index across occupations, areas, and industries.
 *
 * Input:
 *   data/oews/national.json        Occupation titles + national stats
 *   data/oews/soc-hierarchy.json   SOC major groups
 *   data/states/economic-data.json State names
 *   data/metros/metro-data.json    Metro area names
 *
 * Output:
 *   data/search-index.json         Compact search index (~80KB)
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// State FIPS for area entries
const STATE_FIPS = {
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
 * Generate search keywords from a title
 * "Registered Nurses" -> ["registered", "nurses", "nurse"]
 * Strips common suffixes, lowercases
 */
function generateKeywords(title) {
  const words = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .split(/[\s-]+/)
    .filter(w => w.length > 1);

  const keywords = new Set(words);

  // Add stemmed versions (simple suffix removal)
  for (const w of words) {
    if (w.endsWith('ers')) keywords.add(w.slice(0, -3));
    else if (w.endsWith('ing')) keywords.add(w.slice(0, -3));
    else if (w.endsWith('ists')) keywords.add(w.slice(0, -1));
    else if (w.endsWith('ors')) keywords.add(w.slice(0, -3));
    else if (w.endsWith('ants')) keywords.add(w.slice(0, -1));
    else if (w.endsWith('ians')) keywords.add(w.slice(0, -1));
    else if (w.endsWith('es')) keywords.add(w.slice(0, -2));
    else if (w.endsWith('s') && w.length > 3) keywords.add(w.slice(0, -1));
  }

  // Remove very common stopwords
  const stops = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'all', 'other', 'except', 'not', 'with']);
  return [...keywords].filter(k => !stops.has(k) && k.length > 1);
}

function main() {
  console.log('\n=== Building Search Index ===\n');

  const index = {
    occupations: [],  // { c: soc_code, t: title, k: keywords, med: median_salary, emp: employment }
    areas: [],        // { id: fips/cbsa, t: name, type: "state"|"metro", k: keywords }
    groups: []        // { c: major_code, t: group_title, k: keywords }
  };

  // ================================================================
  // 1. Occupations from national.json
  // ================================================================
  const nationalPath = path.join(DATA_DIR, 'oews', 'national.json');
  if (existsSync(nationalPath)) {
    console.log('Loading occupation data...');
    const national = JSON.parse(readFileSync(nationalPath, 'utf-8'));
    const occs = national.occupations;

    for (const [code, data] of Object.entries(occs)) {
      index.occupations.push({
        c: code,
        t: data.title,
        k: generateKeywords(data.title),
        med: data.med || null,
        emp: data.emp || null
      });
    }
    console.log(`  Added ${index.occupations.length} occupations`);

    // Sort by employment (most common first for better search results)
    index.occupations.sort((a, b) => (b.emp || 0) - (a.emp || 0));
  } else {
    console.log('  WARN: national.json not found, skipping occupations');
  }

  // ================================================================
  // 2. SOC major groups
  // ================================================================
  const hierarchyPath = path.join(DATA_DIR, 'oews', 'soc-hierarchy.json');
  if (existsSync(hierarchyPath)) {
    console.log('Loading SOC hierarchy...');
    const hierarchy = JSON.parse(readFileSync(hierarchyPath, 'utf-8'));

    for (const [code, group] of Object.entries(hierarchy)) {
      if (group.title) {
        index.groups.push({
          c: code,
          t: group.title,
          k: generateKeywords(group.title),
          n: group.occupations.length
        });
      }
    }
    console.log(`  Added ${index.groups.length} SOC groups`);
  }

  // ================================================================
  // 3. State areas
  // ================================================================
  console.log('Adding state areas...');
  for (const [fips, name] of Object.entries(STATE_FIPS)) {
    // Add state abbreviation as keyword
    const stateAbbrevs = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
      'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
      'District of Columbia': 'DC', 'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI',
      'Idaho': 'ID', 'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA',
      'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME',
      'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
      'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE',
      'Nevada': 'NV', 'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM',
      'New York': 'NY', 'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH',
      'Oklahoma': 'OK', 'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI',
      'South Carolina': 'SC', 'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX',
      'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA',
      'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
    };

    const keywords = generateKeywords(name);
    const abbrev = stateAbbrevs[name];
    if (abbrev) keywords.push(abbrev.toLowerCase());

    index.areas.push({
      id: fips,
      t: name,
      type: 'state',
      k: keywords
    });
  }
  console.log(`  Added ${Object.keys(STATE_FIPS).length} states`);

  // ================================================================
  // 4. Metro areas
  // ================================================================
  const metroPath = path.join(DATA_DIR, 'metros', 'metro-data.json');
  if (existsSync(metroPath)) {
    console.log('Loading metro areas...');
    const metroRaw = JSON.parse(readFileSync(metroPath, 'utf-8'));
    const metros = metroRaw.data || metroRaw;

    let metroCount = 0;
    for (const [cbsa, data] of Object.entries(metros)) {
      const name = data.name || data.metro_name || cbsa;
      index.areas.push({
        id: cbsa,
        t: name,
        type: 'metro',
        k: generateKeywords(name)
      });
      metroCount++;
    }
    console.log(`  Added ${metroCount} metro areas`);
  } else {
    console.log('  WARN: metro-data.json not found, skipping metros');
  }

  // Also try OEWS metro area names if available
  const oewsMetroDir = path.join(DATA_DIR, 'oews', 'areas', 'metros');
  if (existsSync(oewsMetroDir)) {
    const existingMetroIds = new Set(index.areas.filter(a => a.type === 'metro').map(a => a.id));
    const metroFiles = readdirSync(oewsMetroDir).filter(f => f.endsWith('.json'));

    let addedCount = 0;
    for (const file of metroFiles) {
      const cbsa = file.replace('.json', '');
      if (existingMetroIds.has(cbsa)) continue;

      try {
        const metroData = JSON.parse(readFileSync(path.join(oewsMetroDir, file), 'utf-8'));
        if (metroData.name) {
          index.areas.push({
            id: cbsa,
            t: metroData.name,
            type: 'metro',
            k: generateKeywords(metroData.name)
          });
          addedCount++;
        }
      } catch { /* skip */ }
    }
    if (addedCount > 0) {
      console.log(`  Added ${addedCount} additional OEWS metro areas`);
    }
  }

  // ================================================================
  // 5. Save index
  // ================================================================
  const outputPath = path.join(DATA_DIR, 'search-index.json');
  const json = JSON.stringify(index);
  writeFileSync(outputPath, json);

  const sizeKB = (Buffer.byteLength(json) / 1024).toFixed(1);
  console.log(`\n=== Search Index Complete ===`);
  console.log(`  Occupations: ${index.occupations.length}`);
  console.log(`  Areas: ${index.areas.length}`);
  console.log(`  SOC Groups: ${index.groups.length}`);
  console.log(`  File size: ${sizeKB} KB`);
}

try {
  main();
} catch (err) {
  console.error('FATAL:', err.message);
  process.exit(1);
}
