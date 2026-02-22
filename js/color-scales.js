/**
 * Color scale definitions for LaborCompare
 */

const colorPalettes = {
    blue: { name: 'Blue', description: 'Sequential blue', colors: ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1e3a8a'] },
    green: { name: 'Green', description: 'Sequential green', colors: ['#f0fdf4', '#bbf7d0', '#4ade80', '#16a34a', '#14532d'] },
    red: { name: 'Red', description: 'Sequential red', colors: ['#fef2f2', '#fecaca', '#f87171', '#dc2626', '#7f1d1d'] },
    purple: { name: 'Purple', description: 'Sequential purple', colors: ['#f5f3ff', '#c4b5fd', '#8b5cf6', '#6d28d9', '#4c1d95'] },
    heat: { name: 'Heat', description: 'Yellow to red', colors: ['#fef9c3', '#fde047', '#f59e0b', '#dc2626', '#7f1d1d'] },
    diverging: { name: 'Diverging', description: 'Red-Yellow-Green', colors: ['#dc2626', '#fb923c', '#fde047', '#86efac', '#16a34a'] },
    colorblind: { name: 'Colorblind Safe', description: 'Blue-orange', colors: ['#f0f9ff', '#7dd3fc', '#0284c7', '#c2410c', '#7c2d12'] }
};

const defaultBreakpoints = {
    // Labor
    unemployment_rate: [2, 4, 6, 8, 12],
    labor_force_participation_rate: [50, 57, 62, 67, 72],
    total_nonfarm_employment: [500, 2000, 5000, 10000, 20000],
    job_growth_yoy: [-2, 0, 2, 4, 8],
    avg_hourly_earnings: [20, 25, 30, 35, 42],
    avg_weekly_earnings: [800, 1000, 1200, 1500, 1800],
    minimum_wage: [7.25, 10, 12, 15, 17],
    // Income
    income: [30000, 45000, 60000, 80000, 120000],
    median_household_income: [30000, 45000, 60000, 80000, 120000],
    home_value: [100000, 200000, 300000, 450000, 700000],
    rent: [600, 900, 1200, 1600, 2200],
    median_earnings: [30000, 45000, 60000, 80000, 120000],
    per_capita_income: [25000, 40000, 55000, 70000, 100000],
    // Labor force counts
    labor_force: [50000, 200000, 500000, 1000000, 5000000],
    employment: [50000, 200000, 500000, 1000000, 5000000],
    // Percentages
    poverty_rate: [8, 12, 16, 22, 30],
    median_age: [30, 35, 40, 45, 50],
    bachelors_or_higher_pct: [10, 20, 30, 40, 55],
    hs_diploma_or_higher_pct: [70, 80, 85, 90, 95],
    gini_index: [0.35, 0.40, 0.45, 0.50, 0.55],
    homeownership_rate: [40, 55, 65, 75, 85],
    vacancy_rate: [3, 6, 10, 15, 25],
    // Population
    population: [500000, 2000000, 5000000, 10000000, 20000000],
    // Ratios
    home_to_income: [2.5, 4, 5.5, 7, 10],
    rent_to_income: [0.15, 0.22, 0.28, 0.35, 0.45],
    avg_weekly_hours: [30, 33, 35, 38, 42]
};

let currentPalette = 'blue';

function setColorPalette(paletteName) { if (colorPalettes[paletteName]) currentPalette = paletteName; }
function getCurrentPalette() { return currentPalette; }
function getPaletteColors(paletteName = currentPalette) { return colorPalettes[paletteName]?.colors || colorPalettes.blue.colors; }

function generateColorScale(min, max, paletteName = currentPalette) {
    const colors = getPaletteColors(paletteName);
    const range = max - min;
    const step = range / colors.length;
    return colors.map((color, i) => ({
        min: min + (step * i),
        max: i === colors.length - 1 ? max + 1 : min + (step * (i + 1)),
        color
    }));
}

function generateColorScaleWithBreakpoints(breakpoints, paletteName = currentPalette) {
    const colors = getPaletteColors(paletteName);
    const numBands = Math.min(breakpoints.length + 1, colors.length);
    const scale = [];
    for (let i = 0; i < numBands; i++) {
        const colorIndex = Math.floor(i * (colors.length - 1) / (numBands - 1));
        scale.push({
            min: i === 0 ? 0 : breakpoints[i - 1],
            max: i === numBands - 1 ? Infinity : breakpoints[i],
            color: colors[colorIndex]
        });
    }
    return scale;
}

function getColorFromScale(value, scale) {
    if (value === null || value === undefined || isNaN(value)) return '#d1d5db';
    for (let i = scale.length - 1; i >= 0; i--) {
        if (value >= scale[i].min) return scale[i].color;
    }
    return scale[0].color;
}

function generateLegendLabels(scale, formatter = (v) => v.toLocaleString()) {
    return scale.map((band, i) => {
        if (i === 0) return `Under ${formatter(band.max)}`;
        if (i === scale.length - 1 || band.max === Infinity) return `Over ${formatter(band.min)}`;
        return `${formatter(band.min)} - ${formatter(band.max)}`;
    });
}

function interpolateColor(color1, color2, factor) {
    const hex = (c) => parseInt(c.substring(1), 16);
    const r = (h) => (h >> 16) & 255;
    const g = (h) => (h >> 8) & 255;
    const b = (h) => h & 255;
    const h1 = hex(color1), h2 = hex(color2);
    const ri = Math.round(r(h1) + (r(h2) - r(h1)) * factor);
    const gi = Math.round(g(h1) + (g(h2) - g(h1)) * factor);
    const bi = Math.round(b(h1) + (b(h2) - b(h1)) * factor);
    return `#${((1 << 24) + (ri << 16) + (gi << 8) + bi).toString(16).slice(1)}`;
}

window.ColorScales = {
    palettes: colorPalettes, defaults: defaultBreakpoints,
    setColorPalette, getCurrentPalette, getPaletteColors,
    generateColorScale, generateColorScaleWithBreakpoints,
    getColorFromScale, generateLegendLabels, interpolateColor
};
