/**
 * process-ticker.js
 * Builds data/ticker.json from raw BLS data files.
 * Uses CPI + JOLTS data from new pipeline. Falls back to existing ticker.json
 * if no new data is available (preserving hardcoded values).
 *
 * NOTE: Unemployment, payrolls, earnings, and LFPR data come from the
 * existing LAUS/CES fetch scripts which produce state-level files, not
 * national series. Those ticker items are only updated when we add a
 * dedicated national-series fetch. For now they're kept from the existing
 * hardcoded ticker.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

function loadJSON(filePath) {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return null;
  }
}

function getLatestValue(series) {
  if (!series?.data?.length) return null;
  return series.data[0]; // Already sorted most recent first
}

function formatDelta(current, previous, suffix = '') {
  if (current == null || previous == null) return null;
  const diff = current - previous;
  const sign = diff > 0 ? '\u25b2' : diff < 0 ? '\u25bc' : '\u2014';
  const absDiff = Math.abs(diff).toFixed(1);
  return `${sign} ${absDiff}${suffix}`;
}

function main() {
  console.log('Building ticker.json...');

  // Load existing ticker as base (preserves hardcoded values)
  const tickerPath = path.join(DATA_DIR, 'ticker.json');
  const existing = loadJSON(tickerPath);

  // Load new raw data
  const cpiRaw = loadJSON(path.join(RAW_DIR, 'bls-cpi.json'));
  const joltsRaw = loadJSON(path.join(RAW_DIR, 'bls-jolts.json'));

  // If we have no new data at all, keep existing ticker unchanged
  if (!cpiRaw && !joltsRaw) {
    console.log('No new raw data found. Keeping existing ticker.json.');
    return;
  }

  // Start with existing data as base
  const ticker = existing?.ticker ? [...existing.ticker] : [];
  const cards = existing?.cards ? [...existing.cards] : [];

  // Helper to update or add a ticker item
  function upsertTicker(label, data) {
    const idx = ticker.findIndex(t => t.label === label);
    if (idx >= 0) ticker[idx] = { ...ticker[idx], ...data };
    else ticker.push({ label, ...data });
  }

  function upsertCard(id, data) {
    const idx = cards.findIndex(c => c.id === id);
    if (idx >= 0) cards[idx] = { ...cards[idx], ...data };
    else cards.push({ id, ...data });
  }

  // --- CPI (Year-over-Year) ---
  const cpiSeries = cpiRaw?.series?.['CUSR0000SA0'];
  if (cpiSeries?.data?.length >= 13) {
    const latest = cpiSeries.data[0];
    const yoyMatch = cpiSeries.data.find(d => d.year === latest.year - 1 && d.month === latest.month);
    if (yoyMatch) {
      const yoy = ((latest.value - yoyMatch.value) / yoyMatch.value * 100).toFixed(1);
      const prevMonth = cpiSeries.data[1];
      const prevYoyMatch = cpiSeries.data.find(d => d.year === prevMonth.year - 1 && d.month === prevMonth.month);
      const prevYoy = prevYoyMatch ? ((prevMonth.value - prevYoyMatch.value) / prevYoyMatch.value * 100).toFixed(1) : null;

      const direction = prevYoy ? (parseFloat(yoy) > parseFloat(prevYoy) ? 'up' : parseFloat(yoy) < parseFloat(prevYoy) ? 'down' : 'flat') : 'flat';
      const delta = prevYoy ? Math.abs(parseFloat(yoy) - parseFloat(prevYoy)).toFixed(1) : '0.0';

      upsertTicker('CPI', { value: `${yoy}%`, delta, direction });
      upsertCard('cpi', {
        label: 'CPI (YoY)',
        value: `${yoy}%`,
        delta: formatDelta(parseFloat(yoy), parseFloat(prevYoy), ' pts') || '\u2014 flat',
        direction
      });
      console.log(`  Updated CPI: ${yoy}%`);
    }
  }

  // --- Job Openings from JOLTS ---
  const openingsSeries = joltsRaw?.series?.['JTS000000000000000JOL'];
  const openingsLatest = getLatestValue(openingsSeries);
  const openingsPrev = openingsSeries?.data?.[1];

  if (openingsLatest) {
    const valM = (openingsLatest.value / 1000).toFixed(1);
    const direction = openingsPrev ? (openingsLatest.value > openingsPrev.value ? 'up' : openingsLatest.value < openingsPrev.value ? 'down' : 'flat') : 'flat';

    upsertCard('openings', {
      label: 'Job Openings',
      value: `${valM}M`,
      delta: formatDelta(openingsLatest.value, openingsPrev?.value, 'K') || '\u2014 flat',
      direction
    });
    console.log(`  Updated Job Openings: ${valM}M`);
  }

  const output = {
    updated: new Date().toISOString().split('T')[0],
    ticker,
    cards
  };

  writeFileSync(tickerPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${tickerPath} (${ticker.length} ticker items, ${cards.length} cards)`);
}

try {
  main();
} catch (err) {
  console.error('Ticker build warning:', err.message);
  console.log('Keeping existing ticker.json.');
  // Exit 0 so workflow continues
}
