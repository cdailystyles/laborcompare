/**
 * process-projections.js
 * Processes raw BLS employment projections into frontend-ready JSON.
 * Input:  data/raw/bls-projections.json
 * Output: data/projections/national.json   — all occupation projections
 *         data/projections/fastest.json    — top 30 fastest growing (by % change)
 *         data/projections/declining.json  — top 30 declining (by % change)
 *         data/projections/most-growth.json — top 30 by absolute job growth
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');
const PROJ_DIR = path.join(DATA_DIR, 'projections');

function main() {
  console.log('Processing employment projections...');

  const rawPath = path.join(RAW_DIR, 'bls-projections.json');
  if (!existsSync(rawPath)) {
    console.log('WARN: bls-projections.json not found. Skipping projections processing.');
    return;
  }

  const raw = JSON.parse(readFileSync(rawPath, 'utf-8'));
  if (!existsSync(PROJ_DIR)) mkdirSync(PROJ_DIR, { recursive: true });

  const occupations = raw.occupations || [];
  if (occupations.length === 0) {
    console.log('WARN: No occupation projections data found.');
  }

  // Clean and normalize
  const cleaned = occupations
    .filter(o => o.code && o.title && o.changePct != null && !isNaN(o.changePct))
    .map(o => ({
      code: o.code,
      title: o.title,
      empBase: o.empBase || null,
      empProjected: o.empProjected || null,
      changePct: parseFloat(Number(o.changePct).toFixed(1)),
      changeNum: o.changeNum != null ? o.changeNum : (o.empBase && o.empProjected ? Math.round(o.empProjected - o.empBase) : null),
      openings: o.openings || null,
      median: o.median || null
    }));

  // --- national.json: all projections ---
  const nationalPath = path.join(PROJ_DIR, 'national.json');
  writeFileSync(nationalPath, JSON.stringify({
    updated: raw.fetched,
    source: raw.source,
    count: cleaned.length,
    occupations: cleaned
  }, null, 2));
  console.log(`Wrote ${nationalPath} (${cleaned.length} occupations)`);

  // --- fastest.json: top 30 by % growth ---
  const fastest = [...cleaned]
    .filter(o => o.changePct > 0)
    .sort((a, b) => b.changePct - a.changePct)
    .slice(0, 30);

  writeFileSync(path.join(PROJ_DIR, 'fastest.json'), JSON.stringify({
    updated: raw.fetched,
    occupations: fastest
  }, null, 2));
  console.log(`Wrote fastest.json (${fastest.length} occupations)`);

  // --- declining.json: top 30 by % decline ---
  const declining = [...cleaned]
    .filter(o => o.changePct < 0)
    .sort((a, b) => a.changePct - b.changePct)
    .slice(0, 30);

  writeFileSync(path.join(PROJ_DIR, 'declining.json'), JSON.stringify({
    updated: raw.fetched,
    occupations: declining
  }, null, 2));
  console.log(`Wrote declining.json (${declining.length} occupations)`);

  // --- most-growth.json: top 30 by absolute job growth ---
  const mostGrowth = [...cleaned]
    .filter(o => o.changeNum != null && o.changeNum > 0)
    .sort((a, b) => b.changeNum - a.changeNum)
    .slice(0, 30);

  writeFileSync(path.join(PROJ_DIR, 'most-growth.json'), JSON.stringify({
    updated: raw.fetched,
    occupations: mostGrowth
  }, null, 2));
  console.log(`Wrote most-growth.json (${mostGrowth.length} occupations)`);
}

try {
  main();
} catch (err) {
  console.error('Projections processing warning:', err.message);
  // Exit 0 so workflow continues
}
