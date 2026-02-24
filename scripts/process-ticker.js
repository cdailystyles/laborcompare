/**
 * process-ticker.js
 * Builds data/ticker.json from raw BLS data files.
 * Combines latest values from LAUS, CES, CPI, and JOLTS.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const RAW_DIR = path.join(DATA_DIR, 'raw');

function loadJSON(filePath) {
  if (!existsSync(filePath)) return null;
  return JSON.parse(readFileSync(filePath, 'utf-8'));
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

  // Load raw data
  const lausRaw = loadJSON(path.join(RAW_DIR, 'bls-laus.json'));
  const cesRaw = loadJSON(path.join(RAW_DIR, 'bls-ces.json'));
  const cpiRaw = loadJSON(path.join(RAW_DIR, 'bls-cpi.json'));
  const joltsRaw = loadJSON(path.join(RAW_DIR, 'bls-jolts.json'));

  const ticker = [];
  const cards = [];

  // --- Unemployment Rate ---
  // LAUS series LNS14000000 (Unemployment Rate, SA)
  const unempSeries = lausRaw?.series?.['LNS14000000'];
  const unempLatest = getLatestValue(unempSeries);
  const unempPrev = unempSeries?.data?.[1];

  if (unempLatest) {
    const val = `${unempLatest.value}%`;
    const direction = unempPrev ? (unempLatest.value < unempPrev.value ? 'down' : unempLatest.value > unempPrev.value ? 'up' : 'flat') : 'flat';
    const delta = unempPrev ? Math.abs(unempLatest.value - unempPrev.value).toFixed(1) : '0.0';

    ticker.push({ label: 'UNEMP', value: val, delta, direction });
    cards.push({
      id: 'unemployment',
      label: 'Unemployment',
      value: val,
      delta: formatDelta(unempLatest.value, unempPrev?.value, ' pts') || '\u2014 flat',
      direction
    });
  }

  // --- Payrolls (Total Nonfarm Employment Change) ---
  // CES series CES0000000001 (Total Nonfarm, SA)
  const payrollSeries = cesRaw?.series?.['CES0000000001'];
  const payLatest = getLatestValue(payrollSeries);
  const payPrev = payrollSeries?.data?.[1];

  if (payLatest && payPrev) {
    const change = Math.round(payLatest.value - payPrev.value);
    const sign = change >= 0 ? '+' : '';
    const val = `${sign}${change}K`;
    const monthNames = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const periodLabel = `${monthNames[payLatest.month] || ''} ${payLatest.year}`;

    ticker.push({ label: 'PAYROLLS', value: val });
    cards.push({
      id: 'payrolls',
      label: 'Payrolls',
      value: val,
      delta: periodLabel,
      direction: change >= 0 ? 'up' : 'down'
    });
  }

  // --- CPI (Year-over-Year) ---
  // CPI series CUSR0000SA0 (All Items, SA)
  const cpiSeries = cpiRaw?.series?.['CUSR0000SA0'];
  if (cpiSeries?.data?.length >= 13) {
    const latest = cpiSeries.data[0];
    // Find same month last year
    const yoyMatch = cpiSeries.data.find(d => d.year === latest.year - 1 && d.month === latest.month);
    if (yoyMatch) {
      const yoy = ((latest.value - yoyMatch.value) / yoyMatch.value * 100).toFixed(1);
      // Previous month YoY for delta
      const prevMonth = cpiSeries.data[1];
      const prevYoyMatch = cpiSeries.data.find(d => d.year === prevMonth.year - 1 && d.month === prevMonth.month);
      const prevYoy = prevYoyMatch ? ((prevMonth.value - prevYoyMatch.value) / prevYoyMatch.value * 100).toFixed(1) : null;

      const direction = prevYoy ? (parseFloat(yoy) > parseFloat(prevYoy) ? 'up' : parseFloat(yoy) < parseFloat(prevYoy) ? 'down' : 'flat') : 'flat';
      const delta = prevYoy ? Math.abs(parseFloat(yoy) - parseFloat(prevYoy)).toFixed(1) : '0.0';

      ticker.push({ label: 'CPI', value: `${yoy}%`, delta, direction });
      cards.push({
        id: 'cpi',
        label: 'CPI (YoY)',
        value: `${yoy}%`,
        delta: formatDelta(parseFloat(yoy), parseFloat(prevYoy), ' pts') || '\u2014 flat',
        direction
      });
    }
  }

  // --- Average Hourly Earnings ---
  // CES series CES0500000003 (Private, SA)
  const earnSeries = cesRaw?.series?.['CES0500000003'];
  const earnLatest = getLatestValue(earnSeries);
  // Find same month last year for YoY
  const earnYoy = earnSeries?.data?.find(d => d.year === earnLatest?.year - 1 && d.month === earnLatest?.month);

  if (earnLatest) {
    const val = `$${earnLatest.value.toFixed(2)}/hr`;
    const yoyPct = earnYoy ? (((earnLatest.value - earnYoy.value) / earnYoy.value) * 100).toFixed(1) : null;

    ticker.push({ label: 'EARNINGS', value: `$${earnLatest.value.toFixed(2)}/hr`, delta: yoyPct ? `${yoyPct}%` : undefined, direction: 'up' });
    cards.push({
      id: 'earnings',
      label: 'Hourly Earnings',
      value: `$${earnLatest.value.toFixed(2)}`,
      delta: yoyPct ? `\u25b2 ${yoyPct}%` : '\u2014',
      direction: 'up'
    });
  }

  // --- LFPR ---
  // LAUS series LNS11300000 (Civilian LFPR, SA)
  const lfprSeries = lausRaw?.series?.['LNS11300000'];
  const lfprLatest = getLatestValue(lfprSeries);
  const lfprPrev = lfprSeries?.data?.[1];

  if (lfprLatest) {
    const direction = lfprPrev ? (lfprLatest.value > lfprPrev.value ? 'up' : lfprLatest.value < lfprPrev.value ? 'down' : 'flat') : 'flat';
    ticker.push({ label: 'LFPR', value: `${lfprLatest.value}%` });
    cards.push({
      id: 'lfpr',
      label: 'Participation',
      value: `${lfprLatest.value}%`,
      delta: formatDelta(lfprLatest.value, lfprPrev?.value, ' pts') || '\u2014 flat',
      direction
    });
  }

  // --- Job Openings ---
  const openingsSeries = joltsRaw?.series?.['JTS000000000000000JOL'];
  const openingsLatest = getLatestValue(openingsSeries);
  const openingsPrev = openingsSeries?.data?.[1];

  if (openingsLatest) {
    const valM = (openingsLatest.value / 1000).toFixed(1);
    const direction = openingsPrev ? (openingsLatest.value > openingsPrev.value ? 'up' : openingsLatest.value < openingsPrev.value ? 'down' : 'flat') : 'flat';
    const changK = openingsPrev ? Math.round(openingsLatest.value - openingsPrev.value) : 0;

    cards.push({
      id: 'openings',
      label: 'Job Openings',
      value: `${valM}M`,
      delta: formatDelta(openingsLatest.value, openingsPrev?.value, 'K') || '\u2014 flat',
      direction
    });
  }

  const output = {
    updated: new Date().toISOString().split('T')[0],
    ticker,
    cards
  };

  const outPath = path.join(DATA_DIR, 'ticker.json');
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath} (${ticker.length} ticker items, ${cards.length} cards)`);
}

try {
  main();
} catch (err) {
  console.error('Ticker build failed:', err.message);
  process.exit(1);
}
