/**
 * generate-national-counties.js
 * Combines all per-state county JSON files into a single national file.
 * Output: data/counties/all-counties.json (minified)
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNTIES_DIR = path.join(__dirname, '..', 'data', 'counties');

const SKIP_FILES = ['index.json', 'all-counties.json'];

function readJSON(filePath) {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    console.warn(`  Warning: Could not read ${filePath}: ${err.message}`);
    return null;
  }
}

function main() {
  console.log('=== Generate National Counties File ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  if (!existsSync(COUNTIES_DIR)) {
    console.error(`ERROR: Counties directory not found: ${COUNTIES_DIR}`);
    console.error('Run generate-state-files.js first.');
    process.exit(1);
  }

  const files = readdirSync(COUNTIES_DIR)
    .filter(f => f.endsWith('.json') && !SKIP_FILES.includes(f))
    .sort();

  console.log(`  Found ${files.length} state county files`);

  const allCounties = {};
  let totalCount = 0;

  for (const file of files) {
    const filePath = path.join(COUNTIES_DIR, file);
    const data = readJSON(filePath);
    if (!data?.counties) {
      console.warn(`  Skipping ${file}: no counties property`);
      continue;
    }

    const stateFips = data.state_fips;
    const stateName = data.state_name;

    for (const [fips, county] of Object.entries(data.counties)) {
      allCounties[fips] = {
        ...county,
        state_fips: stateFips,
        state_name: stateName
      };
      totalCount++;
    }
  }

  // Write minified national file
  const outFile = path.join(COUNTIES_DIR, 'all-counties.json');
  writeFileSync(outFile, JSON.stringify(allCounties));

  const fileSizeMB = (Buffer.byteLength(JSON.stringify(allCounties)) / (1024 * 1024)).toFixed(2);
  console.log(`  Combined ${totalCount} counties from ${files.length} states`);
  console.log(`  Saved to ${outFile} (${fileSizeMB} MB)`);

  console.log('=== National counties file generation complete ===');
}

main();
