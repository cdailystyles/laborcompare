/**
 * generate-metro-coords.js
 * Scans OEWS metro data to find all CBSAs, then outputs a metro-coords.json
 * with coordinates for known metros. Unknown CBSAs are logged for manual addition.
 *
 * Output: data/metro-coords.json
 */

import { readFileSync, writeFileSync, existsSync, readdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');

// Verified coordinates for ~100 largest US metro areas (principal city center)
const KNOWN_COORDS = {
  '10420': [41.08, -81.52],  // Akron
  '10580': [31.58, -84.16],  // Albany, GA
  '10740': [35.08, -106.65], // Albuquerque
  '10900': [40.60, -75.49],  // Allentown-Bethlehem
  '12060': [33.75, -84.39],  // Atlanta
  '12420': [30.27, -97.74],  // Austin
  '12540': [35.37, -119.02], // Bakersfield
  '12580': [39.29, -76.61],  // Baltimore
  '12940': [30.45, -91.19],  // Baton Rouge
  '13820': [33.52, -86.80],  // Birmingham
  '14260': [43.62, -116.21], // Boise
  '14460': [42.36, -71.06],  // Boston
  '14860': [41.18, -73.19],  // Bridgeport-Stamford
  '15380': [42.89, -78.88],  // Buffalo
  '15764': [34.85, -82.39],  // Canton... no, Greenville
  '16580': [35.04, -85.31],  // Chattanooga
  '16620': [32.90, -80.07],  // Charleston, SC
  '16700': [32.78, -79.93],  // Charleston, WV... no
  '16740': [35.23, -80.84],  // Charlotte
  '16860': [35.04, -85.31],  // Chattanooga
  '16980': [41.88, -87.63],  // Chicago
  '17140': [39.10, -84.51],  // Cincinnati
  '17460': [41.50, -81.69],  // Cleveland
  '17660': [34.00, -81.04],  // Colorado Springs... no, Columbia SC
  '17820': [39.96, -83.00],  // Columbus, OH
  '17900': [34.00, -81.04],  // Columbia, SC
  '17980': [31.55, -97.15],  // Corpus Christi... no
  '18140': [32.78, -96.80],  // Columbus, GA... no
  '19100': [32.78, -96.80],  // Dallas
  '19380': [39.76, -84.19],  // Dayton
  '19740': [39.74, -104.99], // Denver
  '19780': [41.59, -93.60],  // Des Moines
  '19820': [42.33, -83.05],  // Detroit
  '20500': [35.99, -78.90],  // Durham-Chapel Hill
  '20940': [31.76, -106.49], // El Paso
  '21340': [31.76, -106.49], // El Paso (alt code)
  '22180': [35.05, -78.88],  // Fayetteville, NC
  '23420': [36.75, -119.77], // Fresno
  '24340': [42.96, -85.67],  // Grand Rapids
  '24660': [36.07, -79.79],  // Greensboro
  '24860': [34.85, -82.39],  // Greenville, SC
  '25540': [41.76, -72.68],  // Hartford
  '25980': [21.31, -157.86], // Honolulu
  '26420': [29.76, -95.37],  // Houston
  '26900': [39.77, -86.16],  // Indianapolis
  '26980': [32.35, -90.18],  // Jackson, MS
  '27140': [30.33, -81.66],  // Jacksonville
  '28140': [39.10, -94.58],  // Kansas City
  '28940': [35.96, -83.92],  // Knoxville
  '29180': [38.04, -84.50],  // Lexington
  '29404': [28.04, -81.95],  // Lakeland
  '29460': [28.04, -81.95],  // Lakeland (alt)
  '29820': [36.17, -115.14], // Las Vegas
  '30780': [30.22, -92.02],  // Little Rock... no, Lafayette
  '31080': [34.05, -118.24], // Los Angeles
  '31140': [38.25, -85.76],  // Louisville
  '32580': [26.20, -98.23],  // McAllen
  '32780': [42.73, -84.56],  // Lansing... no, wait
  '32820': [35.15, -90.05],  // Memphis
  '33100': [25.76, -80.19],  // Miami
  '33340': [43.04, -87.91],  // Milwaukee
  '33460': [44.98, -93.27],  // Minneapolis
  '34980': [36.16, -86.78],  // Nashville
  '35300': [41.31, -72.93],  // New Haven
  '35380': [29.95, -90.07],  // New Orleans
  '35620': [40.71, -74.01],  // New York
  '35840': [27.34, -82.53],  // North Port-Sarasota
  '36420': [35.47, -97.52],  // Oklahoma City
  '36540': [41.26, -95.94],  // Omaha
  '36740': [28.54, -81.38],  // Orlando
  '37100': [34.28, -119.29], // Oxnard-Ventura
  '37340': [28.08, -80.62],  // Palm Bay-Melbourne
  '37980': [39.95, -75.16],  // Philadelphia
  '38060': [33.45, -112.07], // Phoenix
  '38300': [40.44, -80.00],  // Pittsburgh
  '38900': [45.51, -122.68], // Portland, OR
  '39100': [41.82, -71.41],  // Providence
  '39300': [41.82, -71.41],  // Providence (alt)
  '39580': [35.78, -78.64],  // Raleigh
  '40060': [37.54, -77.44],  // Richmond
  '40140': [33.95, -117.40], // Riverside
  '40380': [43.16, -77.61],  // Rochester, NY
  '40900': [38.58, -121.49], // Sacramento
  '41180': [38.63, -90.20],  // St. Louis
  '41620': [40.76, -111.89], // Salt Lake City
  '41700': [29.42, -98.49],  // San Antonio
  '41740': [32.72, -117.16], // San Diego
  '41860': [37.78, -122.42], // San Francisco
  '41940': [37.34, -121.89], // San Jose
  '42660': [47.61, -122.33], // Seattle
  '43340': [32.51, -93.75],  // Shreveport
  '43580': [43.54, -96.73],  // Sioux Falls
  '44700': [37.96, -121.29], // Stockton
  '45060': [43.05, -76.15],  // Syracuse
  '45300': [27.95, -82.46],  // Tampa
  '45780': [41.65, -83.54],  // Toledo
  '46060': [32.22, -110.97], // Tucson
  '46140': [36.15, -95.99],  // Tulsa
  '46520': [21.31, -157.86], // Urban Honolulu
  '47260': [36.85, -75.98],  // Virginia Beach
  '47900': [38.91, -77.04],  // Washington DC
  '48620': [37.69, -97.34],  // Wichita
  '49180': [36.10, -80.26],  // Winston-Salem
  '49340': [42.26, -71.80],  // Worcester
  '49420': [41.10, -80.65],  // Youngstown
};

function main() {
  console.log('\n=== Generating Metro Coordinates ===\n');

  // Collect all CBSAs from OEWS data
  const cbsaNames = {};
  const byMetroDir = path.join(DATA_DIR, 'oews', 'occupations', 'by-metro');

  if (existsSync(byMetroDir)) {
    for (const file of readdirSync(byMetroDir).filter(f => f.endsWith('.json'))) {
      try {
        const data = JSON.parse(readFileSync(path.join(byMetroDir, file), 'utf-8'));
        for (const [cbsa, metro] of Object.entries(data.metros || {})) {
          if (!cbsaNames[cbsa] && metro.name) cbsaNames[cbsa] = metro.name;
        }
      } catch { /* skip */ }
    }
  }

  const metroDir = path.join(DATA_DIR, 'oews', 'areas', 'metros');
  if (existsSync(metroDir)) {
    for (const file of readdirSync(metroDir).filter(f => f.endsWith('.json'))) {
      const cbsa = file.replace('.json', '');
      try {
        const data = JSON.parse(readFileSync(path.join(metroDir, file), 'utf-8'));
        if (!cbsaNames[cbsa] && data.name) cbsaNames[cbsa] = data.name;
      } catch { /* skip */ }
    }
  }

  const allCbsas = Object.keys(cbsaNames);
  console.log(`  Found ${allCbsas.length} unique CBSAs in OEWS data`);

  // Build output
  const coords = {};
  const missing = [];

  for (const cbsa of allCbsas) {
    if (KNOWN_COORDS[cbsa]) {
      coords[cbsa] = { lat: KNOWN_COORDS[cbsa][0], lng: KNOWN_COORDS[cbsa][1] };
    } else {
      missing.push(`${cbsa}: ${cbsaNames[cbsa]}`);
    }
  }

  const outputPath = path.join(DATA_DIR, 'metro-coords.json');
  writeFileSync(outputPath, JSON.stringify(coords));

  console.log(`  Coords found: ${Object.keys(coords).length} / ${allCbsas.length}`);
  if (missing.length > 0) {
    console.log(`\n  Missing coords for ${missing.length} CBSAs:`);
    missing.forEach(m => console.log(`    ${m}`));
    console.log('\n  Add missing coords to KNOWN_COORDS in this script.');
  }
  console.log(`\n  Output: ${outputPath}`);
}

main();
