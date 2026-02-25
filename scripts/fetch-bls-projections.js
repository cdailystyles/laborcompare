/**
 * fetch-bls-projections.js
 * Fetches BLS Employment Projections from the interactive data page.
 * Source: https://data.bls.gov/projections/occupationProj
 * Parses HTML table rows — no xlsx dependency needed.
 * Saves to data/raw/bls-projections.json
 */

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RAW_DIR = path.join(__dirname, '..', 'data', 'raw');

const PROJECTIONS_URL = 'https://data.bls.gov/projections/occupationProj';

function parseNum(s) {
  if (!s) return null;
  // Remove $, commas, whitespace
  const cleaned = s.replace(/[$,\s]/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

function parseHTML(html) {
  const occupations = [];

  // Match each <TR> in the <tbody> section
  // Each row has: Title, Code, Emp2024, Emp2034, Change, PctChange, Openings, MedianWage, ...
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) {
    console.warn('Could not find <tbody> in HTML');
    return occupations;
  }

  const tbody = tbodyMatch[1];
  // Split into individual rows
  const rowRegex = /<TR>([\s\S]*?)<\/TR>/gi;
  let match;

  while ((match = rowRegex.exec(tbody)) !== null) {
    const rowHTML = match[1];

    // Extract all <TD> contents
    const cells = [];
    const tdRegex = /<TD[^>]*>([\s\S]*?)<\/TD>/gi;
    let tdMatch;
    while ((tdMatch = tdRegex.exec(rowHTML)) !== null) {
      // Strip HTML tags and trim
      const text = tdMatch[1].replace(/<[^>]+>/g, '').trim();
      // Remove "Show/hide Example Job Titles" and example titles (layN paragraphs)
      cells.push(text.replace(/Show\/hide Example Job Titles/g, '').replace(/\*[^*]+(?:\n|$)/g, '').trim());
    }

    if (cells.length < 8) continue;

    // cells[0] = Title (may have extra text from example job titles)
    // cells[1] = SOC Code
    // cells[2] = Employment 2024
    // cells[3] = Employment 2034
    // cells[4] = Employment Change
    // cells[5] = Percent Change
    // cells[6] = Occupational Openings
    // cells[7] = Median Annual Wage

    const code = cells[1].trim();
    // Only keep detail-level SOC codes (XX-XXXX)
    if (!code.match(/^\d{2}-\d{4}$/)) continue;

    // Clean up title — take just the first line (occupation name)
    let title = cells[0].split('\n')[0].trim();
    // Remove any residual asterisk content
    title = title.replace(/\s*\*.*$/, '').trim();

    occupations.push({
      code,
      title,
      empBase: parseNum(cells[2]),
      empProjected: parseNum(cells[3]),
      changeNum: parseNum(cells[4]),
      changePct: parseNum(cells[5]),
      openings: parseNum(cells[6]),
      median: parseNum(cells[7])
    });
  }

  return occupations;
}

async function main() {
  if (!existsSync(RAW_DIR)) mkdirSync(RAW_DIR, { recursive: true });

  console.log('Fetching BLS Employment Projections...');
  console.log(`URL: ${PROJECTIONS_URL}`);

  let occupations = [];
  try {
    const resp = await fetch(PROJECTIONS_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });

    if (!resp.ok) {
      throw new Error(`HTTP ${resp.status} ${resp.statusText}`);
    }

    const html = await resp.text();
    console.log(`  Downloaded ${(html.length / 1024).toFixed(0)} KB HTML`);

    occupations = parseHTML(html);
    console.log(`  Parsed ${occupations.length} occupation projections`);

    if (occupations.length > 0) {
      console.log(`  Sample: ${occupations[0].code} — ${occupations[0].title} (${occupations[0].changePct}%)`);
    }
  } catch (err) {
    console.error(`Failed to fetch/parse projections: ${err.message}`);
    console.log('Projections data will use fallback values.');
  }

  const output = {
    fetched: new Date().toISOString(),
    source: 'BLS Employment Projections 2024-2034',
    url: PROJECTIONS_URL,
    occupations
  };

  const outPath = path.join(RAW_DIR, 'bls-projections.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath} (${occupations.length} occupations)`);
}

main().catch(err => {
  console.error('Projections fetch warning:', err.message);
  // Exit 0 so workflow continues
});
