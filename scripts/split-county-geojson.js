/**
 * split-county-geojson.js
 * Downloads national county GeoJSON from Census/Plotly and splits into per-state files.
 * Source: https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json
 * Output: data/geojson/counties/{stateFIPS}.json (per-state)
 * Output: data/geojson/counties/all.json (national)
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const GEOJSON_DIR = path.join(__dirname, '..', 'data', 'geojson', 'counties');

const GEOJSON_SOURCE = 'https://raw.githubusercontent.com/plotly/datasets/master/geojson-counties-fips.json';

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 10000;

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

/**
 * Download the national GeoJSON file with retries
 */
async function downloadGeoJSON(attempt = 1) {
  console.log(`Downloading national county GeoJSON (attempt ${attempt})...`);
  console.log(`  Source: ${GEOJSON_SOURCE}`);

  try {
    const response = await fetch(GEOJSON_SOURCE);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const json = await response.json();

    if (!json.features || !Array.isArray(json.features)) {
      throw new Error('Invalid GeoJSON: no features array');
    }

    console.log(`  Downloaded ${json.features.length} county features`);
    return json;
  } catch (err) {
    if (attempt < MAX_RETRIES) {
      console.warn(`  Retry ${attempt}/${MAX_RETRIES}: ${err.message}`);
      await sleep(RETRY_DELAY_MS);
      return downloadGeoJSON(attempt + 1);
    }
    throw err;
  }
}

/**
 * Split GeoJSON features by state FIPS (first 2 digits of county FIPS)
 */
function splitByState(geojson) {
  const byState = {};

  for (const feature of geojson.features) {
    const fips = feature.id || feature.properties?.GEO_ID?.slice(-5) || feature.properties?.FIPS;
    if (!fips || fips.length < 5) {
      console.warn(`  Skipping feature with invalid FIPS: ${fips}`);
      continue;
    }

    const stateFips = fips.substring(0, 2);

    if (!byState[stateFips]) {
      byState[stateFips] = [];
    }
    byState[stateFips].push(feature);
  }

  return byState;
}

async function main() {
  console.log('=== Split County GeoJSON ===');
  console.log(`Timestamp: ${new Date().toISOString()}`);

  ensureDir(GEOJSON_DIR);

  // Download the national file
  const geojson = await downloadGeoJSON();

  // Save national file
  const allFile = path.join(GEOJSON_DIR, 'all.json');
  writeFileSync(allFile, JSON.stringify(geojson));
  const allSizeMB = (Buffer.byteLength(JSON.stringify(geojson)) / (1024 * 1024)).toFixed(2);
  console.log(`  Saved national GeoJSON to all.json (${allSizeMB} MB)`);

  // Split by state
  const byState = splitByState(geojson);
  const stateCount = Object.keys(byState).length;
  console.log(`  Splitting into ${stateCount} state files...`);

  let totalFeatures = 0;
  for (const [stateFips, features] of Object.entries(byState)) {
    const stateGeoJSON = {
      type: 'FeatureCollection',
      features: features
    };

    const stateFile = path.join(GEOJSON_DIR, `${stateFips}.json`);
    writeFileSync(stateFile, JSON.stringify(stateGeoJSON));
    totalFeatures += features.length;
  }

  console.log(`  Created ${stateCount} state GeoJSON files with ${totalFeatures} total features`);
  console.log('=== GeoJSON split complete ===');
}

main().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
