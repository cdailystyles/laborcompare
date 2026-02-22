/**
 * Ratio definitions for LaborCompare
 */

const predefinedRatios = {
    home_to_income: {
        id: 'home_to_income', name: 'Home Price to Income',
        description: 'Years of income to buy median home',
        numerator: 'median_home_value', denominator: 'median_household_income',
        format: (v) => v.toFixed(1) + 'x', unit: 'ratio', inverse: false,
        breakpoints: [2.5, 4, 5.5, 7, 10],
        legendLabels: ['Under 2.5x', '2.5-4x', '4-5.5x', '5.5-7x', 'Over 7x']
    },
    earnings_to_income: {
        id: 'earnings_to_income', name: 'Earnings to Household Income',
        description: 'Median earnings relative to household income',
        numerator: 'median_earnings', denominator: 'median_household_income',
        format: (v) => (v * 100).toFixed(0) + '%', unit: 'percent', inverse: true,
        breakpoints: [0.4, 0.5, 0.6, 0.7, 0.85],
        legendLabels: ['Under 40%', '40-50%', '50-60%', '60-70%', 'Over 70%']
    },
    employment_rate: {
        id: 'employment_rate', name: 'Employment Rate',
        description: 'Inverse of unemployment rate',
        numerator: null, denominator: null,
        transform: (data) => 100 - (data.unemployment_rate || 0),
        format: (v) => v.toFixed(1) + '%', unit: 'percent', inverse: true,
        breakpoints: [88, 92, 94, 96, 98],
        legendLabels: ['Under 88%', '88-92%', '92-94%', '94-96%', 'Over 96%']
    }
};

const availableFields = {
    median_household_income: { name: 'Median Income', unit: '$/year', format: (v) => '$' + v.toLocaleString() },
    median_home_value: { name: 'Home Value', unit: '$', format: (v) => '$' + v.toLocaleString() },
    median_rent: { name: 'Median Rent', unit: '$/month', format: (v) => '$' + v.toLocaleString() + '/mo' },
    median_earnings: { name: 'Median Earnings', unit: '$', format: (v) => '$' + v.toLocaleString() },
    per_capita_income: { name: 'Per Capita Income', unit: '$', format: (v) => '$' + v.toLocaleString() },
    avg_hourly_earnings: { name: 'Avg Hourly Earnings', unit: '$/hr', format: (v) => '$' + v.toFixed(2) + '/hr' },
    avg_weekly_earnings: { name: 'Avg Weekly Earnings', unit: '$/wk', format: (v) => '$' + v.toLocaleString() + '/wk' },
    population: { name: 'Population', unit: 'people', format: (v) => v.toLocaleString() },
    unemployment_rate: { name: 'Unemployment Rate', unit: '%', format: (v) => v.toFixed(1) + '%' },
    poverty_rate: { name: 'Poverty Rate', unit: '%', format: (v) => v.toFixed(1) + '%' },
    labor_force: { name: 'Labor Force', unit: 'people', format: (v) => v.toLocaleString() },
    total_nonfarm_employment: { name: 'Nonfarm Employment', unit: 'thousands', format: (v) => v.toLocaleString() + 'K' }
};

function calculateRatio(data, ratioConfig) {
    if (ratioConfig.transform) return ratioConfig.transform(data);
    const numerator = data[ratioConfig.numerator];
    const denominator = data[ratioConfig.denominator];
    if (!numerator || !denominator || denominator === 0) return null;
    let value = numerator / denominator;
    if (ratioConfig.multiplier) value *= ratioConfig.multiplier;
    return value;
}

function calculateRatiosForDataset(dataset, ratioConfig) {
    const results = {};
    Object.entries(dataset).forEach(([key, data]) => { results[key] = calculateRatio(data, ratioConfig); });
    return results;
}

function createCustomRatio(numeratorField, denominatorField, options = {}) {
    const numInfo = availableFields[numeratorField];
    const denomInfo = availableFields[denominatorField];
    if (!numInfo || !denomInfo) throw new Error('Invalid field names');
    return {
        id: `custom_${numeratorField}_${denominatorField}`,
        name: `${numInfo.name} / ${denomInfo.name}`,
        description: `Custom ratio: ${numInfo.name} divided by ${denomInfo.name}`,
        numerator: numeratorField, denominator: denominatorField,
        multiplier: options.multiplier || 1,
        format: options.format || ((v) => v.toFixed(2)),
        unit: 'ratio', inverse: options.inverse || false,
        breakpoints: options.breakpoints || null, isCustom: true
    };
}

function getRatioStats(ratioValues) {
    const values = Object.values(ratioValues).filter(v => v !== null && !isNaN(v));
    if (values.length === 0) return { min: 0, max: 0, avg: 0, count: 0 };
    const min = Math.min(...values), max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const entries = Object.entries(ratioValues);
    return { min, max, avg, count: values.length,
        minLocation: entries.find(([_, v]) => v === min)?.[0],
        maxLocation: entries.find(([_, v]) => v === max)?.[0]
    };
}

function generateAutoBreakpoints(ratioValues, numBands = 5) {
    const values = Object.values(ratioValues).filter(v => v !== null && !isNaN(v)).sort((a, b) => a - b);
    if (values.length < numBands) return values;
    const breakpoints = [];
    for (let i = 1; i < numBands; i++) {
        breakpoints.push(values[Math.floor((i / numBands) * values.length)]);
    }
    return breakpoints;
}

window.Ratios = {
    predefined: predefinedRatios, fields: availableFields,
    calculateRatio, calculateRatiosForDataset, createCustomRatio,
    getRatioStats, generateAutoBreakpoints
};
