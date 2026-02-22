/**
 * LaborCompare - Main Application
 * Interactive US Map with Labor Market Data
 */

// Application state
const AppState = {
    mainMap: null,
    mainStatesLayer: null,
    countyLayer: null,
    metroLayer: null,
    stateBackgroundLayer: null,
    currentView: 'state',
    currentProgram: 'unemployment_rate',
    currentMetroProgram: 'unemployment_rate',
    currentColorPalette: 'blue',
    displayMode: 'data',
    selectedLocation: null,
    selectedStateFips: null,
    statesGeoJSON: null,
    metroGeoJSON: null,
    loadedCountyData: null,
    stateEconomicData: null
};

// Working variables
let mainMap, mainStatesLayer, currentProgram = 'unemployment_rate';
let statesGeoJSON = null, selectedLocation = null, tooltip = null;
let currentView = 'state', selectedStateFips = null, countyLayer = null;
let loadedCountyData = null, currentColorPalette = 'blue';
let metroLayer = null, metroGeoJSON = null, currentMetroProgram = 'unemployment_rate';
let stateBackgroundLayer = null, displayMode = 'data', stateEconomicData = null;
let loadedMetroData = null;

// State names list
const stateNames = [
    'Alabama','Alaska','Arizona','Arkansas','California','Colorado','Connecticut',
    'Delaware','Florida','Georgia','Hawaii','Idaho','Illinois','Indiana','Iowa',
    'Kansas','Kentucky','Louisiana','Maine','Maryland','Massachusetts','Michigan',
    'Minnesota','Mississippi','Missouri','Montana','Nebraska','Nevada','New Hampshire',
    'New Jersey','New Mexico','New York','North Carolina','North Dakota','Ohio',
    'Oklahoma','Oregon','Pennsylvania','Rhode Island','South Carolina','South Dakota',
    'Tennessee','Texas','Utah','Vermont','Virginia','Washington','West Virginia',
    'Wisconsin','Wyoming','District of Columbia'
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    cacheDOMElements();
    tooltip = DOM.tooltip;
    initMaps();
    initControls();
    initModals();
    initMobile();
    initViewToggle();
    initColorScaleSelector();
    initRatioBuilder();
    initScreenshotMode();
    loadGeoData();
    loadStateEconomicData();
});

// Load state-level economic data
async function loadStateEconomicData() {
    try {
        const response = await fetch('data/states/economic-data.json');
        if (response.ok) {
            const json = await response.json();
            stateEconomicData = json.data || json || {};
        }
    } catch (error) {
        console.warn('Could not load state economic data:', error);
        stateEconomicData = {};
    }
}

// Load metro-level data
async function loadMetroData() {
    if (loadedMetroData) return loadedMetroData;
    try {
        const response = await fetch('data/metros/metro-data.json');
        if (response.ok) {
            const json = await response.json();
            loadedMetroData = json.data || json || {};
            return loadedMetroData;
        }
    } catch (error) {
        console.warn('Could not load metro data:', error);
    }
    loadedMetroData = {};
    return loadedMetroData;
}

// Format values for display
function formatValue(value, program) {
    if (value === null || value === undefined) return 'N/A';

    switch (program) {
        case 'unemployment_rate':
        case 'labor_force_participation':
        case 'poverty_rate':
        case 'bachelors_or_higher_pct':
        case 'hs_diploma_or_higher_pct':
        case 'homeownership_rate':
        case 'vacancy_rate':
            return value.toFixed(1) + '%';
        case 'job_growth':
            return (value >= 0 ? '+' : '') + value.toFixed(1) + '%';
        case 'avg_hourly_earnings':
            return '$' + value.toFixed(2);
        case 'avg_weekly_earnings':
        case 'median_income':
        case 'median_earnings':
        case 'per_capita_income':
        case 'median_household_income':
        case 'median_home_value':
            return '$' + Math.round(value).toLocaleString();
        case 'median_rent':
            return '$' + Math.round(value).toLocaleString() + '/mo';
        case 'minimum_wage':
            return '$' + value.toFixed(2) + '/hr';
        case 'nonfarm_employment':
        case 'total_nonfarm_employment':
            if (value >= 1000) return (value / 1000).toFixed(1) + 'M';
            return value.toFixed(0) + 'K';
        case 'population':
        case 'labor_force':
        case 'employment':
            if (value >= 1000000) return (value / 1000000).toFixed(1) + 'M';
            if (value >= 1000) return (value / 1000).toFixed(0) + 'K';
            return value.toLocaleString();
        case 'gini_index':
            return value.toFixed(3);
        case 'median_age':
            return value.toFixed(1) + ' yrs';
        case 'avg_weekly_hours':
            return value.toFixed(1) + ' hrs';
        default:
            if (typeof value === 'number') {
                if (value < 1 && value > 0) return value.toFixed(3);
                return value.toLocaleString();
            }
            return String(value);
    }
}

// Alias for county/metro values
function formatCountyValue(value, program) { return formatValue(value, program); }
function formatMetroValue(value, program) { return formatValue(value, program); }
function formatRatioValue(value) {
    if (value === null || value === undefined || isNaN(value)) return 'N/A';
    return value.toFixed(2);
}

// Get program label
function getProgramLabel(program) {
    const labels = {
        'unemployment_rate': 'Unemployment Rate',
        'labor_force_participation': 'Labor Force Participation Rate',
        'nonfarm_employment': 'Total Nonfarm Employment',
        'total_nonfarm_employment': 'Total Nonfarm Employment',
        'job_growth': 'Job Growth (YoY)',
        'avg_hourly_earnings': 'Average Hourly Earnings',
        'avg_weekly_earnings': 'Average Weekly Earnings',
        'avg_weekly_hours': 'Average Weekly Hours',
        'median_income': 'Median Household Income',
        'median_household_income': 'Median Household Income',
        'median_earnings': 'Median Earnings',
        'per_capita_income': 'Per Capita Income',
        'minimum_wage': 'Minimum Wage',
        'population': 'Population',
        'median_age': 'Median Age',
        'poverty_rate': 'Poverty Rate',
        'gini_index': 'Income Inequality (Gini Index)',
        'bachelors_or_higher_pct': "Bachelor's Degree or Higher",
        'hs_diploma_or_higher_pct': 'HS Diploma or Higher',
        'homeownership_rate': 'Homeownership Rate',
        'vacancy_rate': 'Vacancy Rate',
        'labor_force': 'Labor Force',
        'employment': 'Employment',
        'median_home_value': 'Median Home Value',
        'median_rent': 'Median Rent'
    };
    return labels[program] || program;
}

function getMetroProgramLabel(program) { return getProgramLabel(program); }
function getCountyProgramMeta(program) {
    return {
        name: getProgramLabel(program),
        description: getProgramLabel(program)
    };
}

// Get state value
function getStateValue(stateName, program) {
    if (!stateEconomicData || !stateEconomicData[stateName]) return null;
    const field = Constants.getDataField(program);
    return stateEconomicData[stateName][field] ?? stateEconomicData[stateName][program] ?? null;
}

// Calculate stats across states
function calculateStats(program) {
    if (!stateEconomicData) return { min: 0, max: 0, average: 0, disparity: 'N/A' };

    const field = Constants.getDataField(program);
    const values = [];
    let maxState = '', minState = '';
    let maxVal = -Infinity, minVal = Infinity;

    Object.entries(stateEconomicData).forEach(([name, data]) => {
        const val = data[field] ?? data[program];
        if (val !== null && val !== undefined && !isNaN(val) && val !== 0) {
            values.push(val);
            if (val > maxVal) { maxVal = val; maxState = name; }
            if (val < minVal) { minVal = val; minState = name; }
        }
    });

    if (values.length === 0) return { min: 0, max: 0, average: 0, disparity: 'N/A' };

    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const disparity = minVal > 0 ? (maxVal / minVal).toFixed(1) : 'N/A';

    return { min: minVal, max: maxVal, average: avg, disparity, maxState, minState };
}

function getRank(stateName, program) {
    if (!stateEconomicData) return 0;
    const field = Constants.getDataField(program);
    const entries = Object.entries(stateEconomicData)
        .map(([name, data]) => ({ name, value: data[field] ?? data[program] ?? 0 }))
        .filter(e => e.value !== 0)
        .sort((a, b) => b.value - a.value);
    const idx = entries.findIndex(e => e.name === stateName);
    return idx >= 0 ? idx + 1 : 0;
}

// Color functions
function getColor(value, program) {
    return getColorForValue(value, program);
}

function getColorForValue(value, program) {
    if (value === null || value === undefined || isNaN(value)) return '#d1d5db';

    const colors = ColorScales.getPaletteColors();
    const field = Constants.getDataField(program);
    const bp = ColorScales.defaults[field] || ColorScales.defaults[program];

    if (!bp) {
        // Auto-generate breakpoints from data
        const stats = calculateStats(program);
        if (stats.max === 0) return colors[0];
        const range = stats.max - stats.min;
        const step = range / 5;
        for (let i = 4; i >= 0; i--) {
            if (value >= stats.min + step * i) return colors[Math.min(i, colors.length - 1)];
        }
        return colors[0];
    }

    // Use breakpoints
    for (let i = bp.length - 1; i >= 0; i--) {
        if (value >= bp[i]) return colors[Math.min(i + 1, colors.length - 1)] || colors[colors.length - 1];
    }
    return colors[0];
}

// Initialize map
function initMaps() {
    mainMap = L.map('main-map', {
        center: [39, -96],
        zoom: 5,
        minZoom: 2,
        maxZoom: 10,
        zoomControl: true,
        dragging: true,
        scrollWheelZoom: true,
        wheelDebounceTime: 40,
        wheelPxPerZoomLevel: 120,
        zoomDelta: 0.5,
        zoomSnap: 0.5,
        doubleClickZoom: true,
        touchZoom: true,
        boxZoom: true,
        keyboard: true,
        attributionControl: false
    });
}

// Initialize controls
function initControls() {
    document.getElementById('program-select').addEventListener('change', (e) => {
        currentProgram = e.target.value;
        const mobile = document.getElementById('mobile-program-select');
        if (mobile) mobile.value = currentProgram;
        updateAll();
    });

    document.getElementById('compare-btn').addEventListener('click', () => {
        document.getElementById('compare-modal').classList.add('active');
        populateCompareSelects();
    });

    document.getElementById('sources-btn').addEventListener('click', () => {
        document.getElementById('sources-modal').classList.add('active');
    });

    document.querySelector('.map-wrapper').addEventListener('mouseleave', hideTooltip);
}

// Initialize modals
function initModals() {
    document.getElementById('close-compare').addEventListener('click', () => {
        document.getElementById('compare-modal').classList.remove('active');
    });
    document.getElementById('close-sources').addEventListener('click', () => {
        document.getElementById('sources-modal').classList.remove('active');
    });
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) modal.classList.remove('active');
        });
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.querySelectorAll('.modal.active').forEach(m => m.classList.remove('active'));
        }
    });
    ['compare-state-1', 'compare-state-2'].forEach(id => {
        document.getElementById(id).addEventListener('change', updateCompareResults);
    });
}

// Load GeoJSON
async function loadGeoData(retryCount = 0) {
    const maxRetries = 3;
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const statesRes = await fetch(Constants.STATES_GEOJSON_URL, { signal: controller.signal });
        clearTimeout(timeoutId);
        if (!statesRes.ok) throw new Error(`HTTP ${statesRes.status}`);
        statesGeoJSON = await statesRes.json();
        if (!statesGeoJSON?.features?.length) throw new Error('Invalid GeoJSON');

        const allStates = {
            ...statesGeoJSON,
            features: statesGeoJSON.features.filter(f => f.properties.name !== 'Puerto Rico')
        };

        mainStatesLayer = L.geoJSON(allStates, {
            style: styleFeature,
            onEachFeature: onEachStateFeature
        }).addTo(mainMap);

        updateLegend();
        updateStats();
        updateContext();
        hideLoading();
    } catch (error) {
        console.error('Error loading map data:', error);
        if (retryCount < maxRetries) {
            document.getElementById('loading-overlay').innerHTML = `<div class="loader"></div><span>Retrying... (${retryCount + 1}/${maxRetries})</span>`;
            setTimeout(() => loadGeoData(retryCount + 1), 1500);
        } else {
            document.getElementById('loading-overlay').innerHTML = `
                <span style="color: var(--danger);">Error loading map data</span>
                <button id="retry-btn" style="margin-top: 12px; padding: 8px 16px; background: var(--primary); color: white; border: none; cursor: pointer;">Retry</button>
            `;
            document.getElementById('retry-btn')?.addEventListener('click', () => location.reload());
        }
    }
}

// Style feature
function styleFeature(feature) {
    const name = feature.properties.name || feature.properties.NAME;
    let value = 0;

    if (currentProgram === 'ratio_custom' && window.customRatioConfig) {
        const stateData = stateEconomicData?.[name];
        if (stateData) {
            const num = stateData[window.customRatioConfig.numerator];
            const den = stateData[window.customRatioConfig.denominator];
            if (num && den && den !== 0) value = num / den;
        }
    } else {
        value = getStateValue(name, currentProgram) || 0;
    }

    return {
        fillColor: getColorForValue(value, currentProgram),
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.85
    };
}

function onEachStateFeature(feature, layer) {
    layer.on({
        mouseover: (e) => showStateTooltip(e, feature.properties.name),
        mousemove: moveTooltip,
        mouseout: hideTooltip,
        click: () => selectLocation(feature.properties.name)
    });
}

function showStateTooltip(e, stateName) {
    if (currentView === 'county') return;
    let value = 0;
    let description = '';

    if (currentProgram === 'ratio_custom' && window.customRatioConfig) {
        const stateData = stateEconomicData?.[stateName];
        if (stateData) {
            const num = stateData[window.customRatioConfig.numerator];
            const den = stateData[window.customRatioConfig.denominator];
            if (num && den && den !== 0) value = num / den;
        }
        const numLabel = getRatioOptionLabel(window.customRatioConfig.numerator);
        const denLabel = getRatioOptionLabel(window.customRatioConfig.denominator);
        description = `${numLabel} ÷ ${denLabel}`;
    } else {
        value = getStateValue(stateName, currentProgram) || 0;
        description = getProgramLabel(currentProgram);
    }

    const formattedValue = currentProgram === 'ratio_custom' ? formatRatioValue(value) : formatValue(value, currentProgram);

    tooltip.innerHTML = `
        <div class="tooltip-header">
            <span class="tooltip-name">${stateName}</span>
            <span class="tooltip-type">State</span>
        </div>
        <div class="tooltip-value">${formattedValue}</div>
        <div class="tooltip-detail">${description}</div>
    `;
    tooltip.classList.add('visible');
    moveTooltip(e);
    e.target.setStyle({ weight: 2, color: '#1a202c', fillOpacity: 1 });
    e.target.bringToFront();
}

function moveTooltip(e) {
    const x = e.originalEvent.clientX + 15;
    const y = e.originalEvent.clientY + 15;
    const rect = tooltip.getBoundingClientRect();
    tooltip.style.left = Math.min(x, window.innerWidth - rect.width - 20) + 'px';
    tooltip.style.top = Math.min(y, window.innerHeight - rect.height - 20) + 'px';
}

function hideTooltip(e) {
    if (currentView === 'county') return;
    tooltip.classList.remove('visible');
    if (e && e.target && mainStatesLayer?.hasLayer(e.target)) {
        mainStatesLayer.resetStyle(e.target);
    }
}

function selectLocation(name) {
    if (currentView === 'county') return;
    selectedLocation = { name };
    updateInfoPanel(name);
    if (window.innerWidth <= 768) switchMobileTab('info');
}

// Update info panel for state
function updateInfoPanel(name) {
    const value = getStateValue(name, currentProgram) || 0;
    const stats = calculateStats(currentProgram);
    const rank = getRank(name, currentProgram);
    const formattedValue = formatValue(value, currentProgram);

    document.querySelector('.info-location').textContent = name;

    let html = `
        <div class="info-value-large">${formattedValue}</div>
        <div class="info-description">
            ${getProgramLabel(currentProgram)}
            <span class="info-rank">#${rank} of 51</span>
        </div>
    `;

    // Stats comparison
    if (stats.max && stats.min) {
        const pctOfMax = ((value / stats.max) * 100).toFixed(0);
        html += `
            <div class="info-stats">
                <div class="info-stat">
                    <div class="info-stat-value">${formatValue(stats.max, currentProgram)}</div>
                    <div class="info-stat-label">Highest (${stats.maxState})</div>
                </div>
                <div class="info-stat">
                    <div class="info-stat-value">${formatValue(stats.min, currentProgram)}</div>
                    <div class="info-stat-label">Lowest (${stats.minState})</div>
                </div>
            </div>
            <div class="info-comparison">
                This is <strong>${pctOfMax}%</strong> of the highest state value.
                ${stats.disparity !== 'N/A' ? ` There is a <strong>${stats.disparity}x</strong> disparity between states.` : ''}
            </div>
        `;
    }

    // Additional state labor data
    const stateData = stateEconomicData?.[name];
    if (stateData) {
        html += `<div class="info-section-title">Employment</div>`;
        html += `<div class="info-stats">`;
        if (stateData.unemployment_rate != null) html += `<div class="info-stat"><div class="info-stat-value">${stateData.unemployment_rate.toFixed(1)}%</div><div class="info-stat-label">Unemployment</div></div>`;
        if (stateData.labor_force_participation_rate != null) html += `<div class="info-stat"><div class="info-stat-value">${stateData.labor_force_participation_rate.toFixed(1)}%</div><div class="info-stat-label">Labor Force Part.</div></div>`;
        html += `</div>`;

        html += `<div class="info-section-title">Wages</div>`;
        html += `<div class="info-stats">`;
        if (stateData.avg_hourly_earnings != null) html += `<div class="info-stat"><div class="info-stat-value">$${stateData.avg_hourly_earnings.toFixed(2)}/hr</div><div class="info-stat-label">Avg Hourly</div></div>`;
        if (stateData.median_household_income != null) html += `<div class="info-stat"><div class="info-stat-value">$${stateData.median_household_income.toLocaleString()}</div><div class="info-stat-label">Median HH Income</div></div>`;
        html += `</div>`;
    }

    html += `<div class="info-data-date"><span class="data-date-label">Data as of 2023-2024</span></div>`;

    document.getElementById('info-content').innerHTML = html;
    const mobileInfoContent = document.getElementById('mobile-info-content');
    const mobileInfoLocation = document.querySelector('#mobile-info-header .info-location');
    if (mobileInfoContent) mobileInfoContent.innerHTML = html;
    if (mobileInfoLocation) mobileInfoLocation.textContent = name;
}

// Update all
function updateAll() {
    updateAllMaps();
    updateLegend();
    updateStats();
    updateContext();
    if (selectedLocation && selectedLocation.name && !selectedLocation.type) {
        updateInfoPanel(selectedLocation.name);
    }
}

function updateAllMaps() {
    if (mainStatesLayer) {
        mainStatesLayer.eachLayer(layer => layer.setStyle(styleFeature(layer.feature)));
    }
}

// Update legend
function updateLegend() {
    const field = Constants.getDataField(currentProgram);
    let bp = ColorScales.defaults[field] || ColorScales.defaults[currentProgram];

    if (currentProgram === 'ratio_custom' && window.customRatioBreakpoints) {
        bp = window.customRatioBreakpoints;
    }

    if (!bp) {
        const stats = calculateStats(currentProgram);
        if (stats.max > stats.min) {
            const range = stats.max - stats.min;
            bp = [
                stats.min + range * 0.2,
                stats.min + range * 0.4,
                stats.min + range * 0.6,
                stats.min + range * 0.8
            ];
        } else {
            bp = [0, 25, 50, 75];
        }
    }

    const scale = ColorScales.generateColorScaleWithBreakpoints(bp);
    const formatter = (v) => {
        if (currentProgram === 'ratio_custom') return formatRatioValue(v);
        return formatValue(v, currentProgram);
    };
    const labels = ColorScales.generateLegendLabels(scale, formatter);

    const legendHTML = scale.map((item, i) => `
        <div class="legend-item">
            <span class="legend-color" style="background-color: ${item.color}"></span>
            <span>${labels[i]}</span>
        </div>
    `).join('');

    const legend = document.getElementById('legend');
    const mobileLegend = document.getElementById('mobile-legend-content');
    if (legend) legend.innerHTML = legendHTML;
    if (mobileLegend) mobileLegend.innerHTML = legendHTML;
}

// Update stats
function updateStats() {
    let stats;
    if (currentView === 'county') {
        updateCountyStats();
        return;
    }
    if (currentView === 'metro') {
        updateMetroStats();
        return;
    }

    stats = calculateStats(currentProgram);
    const statsHTML = `
        <div class="stat-item high">
            <div class="stat-value">${formatValue(stats.max, currentProgram)}</div>
            <div class="stat-label">Highest</div>
        </div>
        <div class="stat-item low">
            <div class="stat-value">${formatValue(stats.min, currentProgram)}</div>
            <div class="stat-label">Lowest</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${formatValue(Math.round(stats.average), currentProgram)}</div>
            <div class="stat-label">Average</div>
        </div>
        <div class="stat-item">
            <div class="stat-value">${stats.disparity}x</div>
            <div class="stat-label">Disparity</div>
        </div>
    `;

    const statsEl = document.getElementById('stats-content');
    const mobileStatsEl = document.getElementById('mobile-stats-content');
    if (statsEl) statsEl.innerHTML = statsHTML;
    if (mobileStatsEl) mobileStatsEl.innerHTML = statsHTML;
}

// Update context
function updateContext() {
    const programEl = document.getElementById('context-program');
    if (!programEl) return;

    if (displayMode === 'ratio' && window.customRatioConfig) {
        const numLabel = getRatioOptionLabel(window.customRatioConfig.numerator);
        const denLabel = getRatioOptionLabel(window.customRatioConfig.denominator);
        programEl.textContent = `${numLabel} ÷ ${denLabel}`;
    } else if (currentView === 'metro') {
        programEl.textContent = getProgramLabel(currentMetroProgram);
    } else if (currentView === 'county') {
        programEl.textContent = getProgramLabel(currentProgram);
    } else {
        programEl.textContent = getProgramLabel(currentProgram);
    }
}

// Compare functionality
function populateCompareSelects() {
    const options = '<option value="">Select state...</option>' +
        stateNames.map(name => `<option value="${name}">${name}</option>`).join('');
    document.getElementById('compare-state-1').innerHTML = options;
    document.getElementById('compare-state-2').innerHTML = options;
}

function updateCompareResults() {
    const state1 = document.getElementById('compare-state-1').value;
    const state2 = document.getElementById('compare-state-2').value;
    const resultsEl = document.getElementById('compare-results');

    if (!state1 || !state2) {
        resultsEl.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 2rem;">Select two states to compare</p>';
        return;
    }

    const programs = [
        'unemployment_rate', 'labor_force_participation',
        'avg_hourly_earnings', 'avg_weekly_earnings',
        'median_household_income', 'median_earnings', 'per_capita_income',
        'minimum_wage', 'poverty_rate', 'gini_index',
        'population', 'homeownership_rate'
    ];

    let html = `
        <div class="compare-row header">
            <span>${state1}</span>
            <span>Metric</span>
            <span>${state2}</span>
        </div>
    `;

    programs.forEach(prog => {
        const val1 = getStateValue(state1, prog) || 0;
        const val2 = getStateValue(state2, prog) || 0;
        let class1 = '', class2 = '';
        if (val1 > val2) { class1 = 'higher'; class2 = 'lower'; }
        else if (val2 > val1) { class1 = 'lower'; class2 = 'higher'; }

        // For unemployment/poverty, lower is better
        if (['unemployment_rate', 'poverty_rate'].includes(prog)) {
            [class1, class2] = [class2, class1];
        }

        html += `
            <div class="compare-row">
                <span class="compare-value ${class1}">${formatValue(val1, prog)}</span>
                <span class="compare-program">${getProgramLabel(prog)}</span>
                <span class="compare-value ${class2}">${formatValue(val2, prog)}</span>
            </div>
        `;
    });

    resultsEl.innerHTML = html;
}

// Loading
function showLoading() {
    const el = document.getElementById('loading-overlay');
    if (el) { el.innerHTML = '<div class="loader"></div><span>Loading...</span>'; el.classList.remove('hidden'); }
}
function hideLoading() {
    document.getElementById('loading-overlay')?.classList.add('hidden');
}

// Mobile
function initMobile() {
    document.querySelectorAll('.mobile-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            const tabName = tab.dataset.tab;
            document.querySelectorAll('.mobile-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            document.querySelectorAll('.mobile-tab-content').forEach(c => c.classList.remove('active'));
            document.getElementById(`mobile-${tabName === 'controls' ? 'controls' : tabName}`).classList.add('active');
        });
    });

    const mobileProgramSelect = document.getElementById('mobile-program-select');
    if (mobileProgramSelect) {
        mobileProgramSelect.addEventListener('change', (e) => {
            currentProgram = e.target.value;
            document.getElementById('program-select').value = currentProgram;
            updateAll();
        });
    }
}

function switchMobileTab(tabName) {
    document.querySelectorAll('.mobile-tab').forEach(t => {
        t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.mobile-tab-content').forEach(c => c.classList.remove('active'));
    document.getElementById(`mobile-${tabName}`)?.classList.add('active');
}

// ===== VIEW TOGGLE =====
function initViewToggle() {
    document.getElementById('state-view-btn')?.addEventListener('click', () => switchView('state'));
    document.getElementById('metro-view-btn')?.addEventListener('click', () => switchView('metro'));
    document.getElementById('county-view-btn')?.addEventListener('click', () => switchView('county'));
    document.getElementById('mobile-state-view-btn')?.addEventListener('click', () => switchView('state'));
    document.getElementById('mobile-metro-view-btn')?.addEventListener('click', () => switchView('metro'));
    document.getElementById('mobile-county-view-btn')?.addEventListener('click', () => switchView('county'));
    document.getElementById('county-program-select')?.addEventListener('change', handleCountyProgramChange);
    document.getElementById('mobile-county-program-select')?.addEventListener('change', handleCountyProgramChange);
    document.getElementById('metro-program-select')?.addEventListener('change', handleMetroProgramChange);
    document.getElementById('mobile-metro-program-select')?.addEventListener('change', handleMetroProgramChange);
}

function handleCountyProgramChange(e) {
    currentProgram = e.target.value;
    document.getElementById('county-program-select').value = currentProgram;
    document.getElementById('mobile-county-program-select').value = currentProgram;
    if (countyLayer) countyLayer.eachLayer(layer => layer.setStyle(styleCountyFeature(layer.feature)));
    updateCountyLegend();
    updateCountyStats();
    updateContext();
    if (selectedLocation?.type === 'county' && loadedCountyData) {
        const countyData = loadedCountyData.counties?.[selectedLocation.fips];
        if (countyData) updateCountyInfoPanel(countyData);
    }
}

function handleMetroProgramChange(e) {
    currentMetroProgram = e.target.value;
    const d = document.getElementById('metro-program-select');
    const m = document.getElementById('mobile-metro-program-select');
    if (d) d.value = currentMetroProgram;
    if (m) m.value = currentMetroProgram;
    if (metroLayer) metroLayer.eachLayer(layer => layer.setStyle(styleMetroFeature(layer.feature)));
    updateMetroLegend();
    updateMetroStats();
    updateContext();
}

function switchView(view) {
    currentView = view;
    updateRatioDropdowns();

    // Update toggle buttons
    document.querySelectorAll('[data-view]').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === view);
    });

    const isState = view === 'state', isCounty = view === 'county', isMetro = view === 'metro';

    document.getElementById('state-program-section').style.display = isState ? 'block' : 'none';
    document.getElementById('mobile-state-program-section').style.display = isState ? 'block' : 'none';
    document.getElementById('county-program-section').style.display = isCounty ? 'block' : 'none';
    document.getElementById('mobile-county-program-section').style.display = isCounty ? 'block' : 'none';
    const mps = document.getElementById('metro-program-section');
    const mmps = document.getElementById('mobile-metro-program-section');
    if (mps) mps.style.display = isMetro ? 'block' : 'none';
    if (mmps) mmps.style.display = isMetro ? 'block' : 'none';

    if (view === 'state') {
        currentProgram = document.getElementById('program-select').value;
        clearCountyLayer();
        clearMetroLayer();
        selectedStateFips = null;
        if (mainStatesLayer) mainStatesLayer.addTo(mainMap);
        mainMap.setView([39, -96], 5);
        selectedLocation = null;
        document.querySelector('.info-location').textContent = 'Select a Location';
        document.getElementById('info-content').innerHTML = '<p class="hint-text">Click on any state to see detailed labor market information.</p>';
        const mil = document.querySelector('#mobile-info-header .info-location');
        const mic = document.getElementById('mobile-info-content');
        if (mil) mil.textContent = 'Select a Location';
        if (mic) mic.innerHTML = '<p class="hint-text">Tap on any state to see labor market details.</p>';
        updateAll();
    } else if (view === 'metro') {
        currentMetroProgram = document.getElementById('metro-program-select')?.value || 'unemployment_rate';
        loadAndDisplayMetroAreas().catch(() => { hideLoading(); switchView('state'); });
    } else {
        currentProgram = document.getElementById('county-program-select').value;
        loadAndDisplayAllCounties().catch(() => { hideLoading(); switchView('state'); });
    }
}

// ===== COUNTY VIEW =====
async function loadAndDisplayAllCounties() {
    showLoading();
    try {
        if (mainStatesLayer && mainMap.hasLayer(mainStatesLayer)) mainMap.removeLayer(mainStatesLayer);
        clearMetroLayer();
        if (countyLayer && mainMap.hasLayer(countyLayer)) { mainMap.removeLayer(countyLayer); countyLayer = null; }
        loadedCountyData = null;

        const { data, geojson } = await CountyLoader.loadAllCounties();
        if (!data || !geojson) throw new Error('Failed to load');

        loadedCountyData = data;

        document.querySelector('.info-location').textContent = 'United States';
        document.getElementById('info-content').innerHTML = `<p class="hint-text">Showing ${data.total_counties?.toLocaleString() || ''} counties. Click a county for details.</p>`;
        const mil = document.querySelector('#mobile-info-header .info-location');
        const mic = document.getElementById('mobile-info-content');
        if (mil) mil.textContent = 'United States';
        if (mic) mic.innerHTML = `<p class="hint-text">Showing counties. Tap for details.</p>`;

        countyLayer = L.geoJSON(geojson, {
            style: styleCountyFeature,
            onEachFeature: onEachCountyFeature
        }).addTo(mainMap);

        mainMap.setView([39, -96], 5);
        updateCountyLegend();
        updateCountyStats();
        updateContext();
        hideLoading();
    } catch (error) {
        console.error('Error loading counties:', error);
        document.getElementById('loading-overlay').innerHTML = `
            <span style="color: var(--danger);">Error loading county data</span>
            <button id="error-return-btn" style="margin-top: 12px; padding: 8px 16px; background: var(--primary); color: white; border: none; cursor: pointer;">Return to State View</button>
        `;
        document.getElementById('error-return-btn')?.addEventListener('click', () => switchView('state'));
        document.getElementById('loading-overlay').classList.remove('hidden');
    }
}

function styleCountyFeature(feature) {
    let fips = feature.id || feature.properties.GEOID;
    fips = Constants.normalizeCtFips(fips);
    const countyData = loadedCountyData?.counties?.[fips];
    let value = 0;

    if (countyData) {
        if (currentProgram === 'ratio_custom' && window.customRatioConfig) {
            const num = countyData[window.customRatioConfig.numerator];
            const den = countyData[window.customRatioConfig.denominator];
            if (num && den && den !== 0) value = num / den;
        } else {
            const field = Constants.getDataField(currentProgram);
            value = countyData[field] || 0;
        }
    }

    return {
        fillColor: getColorForValue(value, currentProgram),
        weight: 0.5,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.85
    };
}

function onEachCountyFeature(feature, layer) {
    layer.on({
        mouseover: (e) => showCountyTooltip(e, feature),
        mousemove: moveTooltip,
        mouseout: hideCountyTooltip,
        click: () => selectCounty(feature)
    });
}

function showCountyTooltip(e, feature) {
    let fips = feature.id || feature.properties.GEOID;
    fips = Constants.normalizeCtFips(fips);
    const countyData = loadedCountyData?.counties?.[fips];
    if (!countyData) return;

    let value = 0;
    if (currentProgram === 'ratio_custom' && window.customRatioConfig) {
        const num = countyData[window.customRatioConfig.numerator];
        const den = countyData[window.customRatioConfig.denominator];
        if (num && den && den !== 0) value = num / den;
    } else {
        const field = Constants.getDataField(currentProgram);
        value = countyData[field] || 0;
    }

    const stateLabel = countyData.state_abbr ? `, ${countyData.state_abbr}` : '';
    tooltip.innerHTML = `
        <div class="tooltip-header">
            <span class="tooltip-name">${countyData.name}${stateLabel}</span>
            <span class="tooltip-type">County</span>
        </div>
        <div class="tooltip-value">${formatValue(value, currentProgram)}</div>
        <div class="tooltip-detail">${getProgramLabel(currentProgram)}</div>
    `;
    tooltip.classList.add('visible');
    moveTooltip(e);
    e.target.setStyle({ weight: 2, color: '#1a202c', fillOpacity: 1 });
    e.target.bringToFront();
}

function hideCountyTooltip(e) {
    tooltip.classList.remove('visible');
    if (e && e.target && countyLayer) countyLayer.resetStyle(e.target);
}

function selectCounty(feature) {
    let fips = feature.id || feature.properties.GEOID;
    fips = Constants.normalizeCtFips(fips);
    const countyData = loadedCountyData?.counties?.[fips];
    if (!countyData) return;
    selectedLocation = { name: countyData.name, fips, type: 'county' };
    updateCountyInfoPanel(countyData);
    if (Constants.isMobile()) switchMobileTab('info');
}

function updateCountyInfoPanel(countyData) {
    const field = Constants.getDataField(currentProgram);
    const value = currentProgram === 'ratio_custom' ? 0 : (countyData[field] || 0);
    const stateAbbr = countyData.state_abbr || '';

    document.querySelector('.info-location').textContent = countyData.name;

    let html = `
        <div class="info-value-large">${formatValue(value, currentProgram)}</div>
        <div class="info-description">${getProgramLabel(currentProgram)} <span class="county-badge">${stateAbbr}</span></div>
    `;

    html += `<div class="info-section-title">Employment</div><div class="info-stats">`;
    if (countyData.unemployment_rate != null) html += `<div class="info-stat"><div class="info-stat-value">${countyData.unemployment_rate.toFixed(1)}%</div><div class="info-stat-label">Unemployment</div></div>`;
    if (countyData.labor_force != null) html += `<div class="info-stat"><div class="info-stat-value">${countyData.labor_force.toLocaleString()}</div><div class="info-stat-label">Labor Force</div></div>`;
    html += `</div>`;

    html += `<div class="info-section-title">Income</div><div class="info-stats">`;
    if (countyData.median_household_income != null) html += `<div class="info-stat"><div class="info-stat-value">$${countyData.median_household_income.toLocaleString()}</div><div class="info-stat-label">Median HH Income</div></div>`;
    if (countyData.per_capita_income != null) html += `<div class="info-stat"><div class="info-stat-value">$${countyData.per_capita_income.toLocaleString()}</div><div class="info-stat-label">Per Capita</div></div>`;
    html += `</div>`;

    html += `<div class="info-section-title">Demographics</div><div class="info-stats">`;
    if (countyData.population != null) html += `<div class="info-stat"><div class="info-stat-value">${countyData.population.toLocaleString()}</div><div class="info-stat-label">Population</div></div>`;
    if (countyData.poverty_rate != null) html += `<div class="info-stat"><div class="info-stat-value">${countyData.poverty_rate.toFixed(1)}%</div><div class="info-stat-label">Poverty Rate</div></div>`;
    html += `</div>`;

    html += `<div class="info-data-date"><span class="data-date-label">Data as of 2023</span></div>`;

    document.getElementById('info-content').innerHTML = html;
    const mic = document.getElementById('mobile-info-content');
    const mil = document.querySelector('#mobile-info-header .info-location');
    if (mic) mic.innerHTML = html;
    if (mil) mil.textContent = countyData.name;
}

function updateCountyLegend() { updateLegend(); }
function updateCountyStats() {
    if (!loadedCountyData?.counties) return;
    const field = Constants.getDataField(currentProgram);
    const values = Object.values(loadedCountyData.counties).map(c => c[field]).filter(v => v != null && !isNaN(v));
    if (values.length === 0) return;
    const min = Math.min(...values), max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const disparity = min > 0 ? (max / min).toFixed(1) : 'N/A';

    const html = `
        <div class="stat-item high"><div class="stat-value">${formatValue(max, currentProgram)}</div><div class="stat-label">Highest</div></div>
        <div class="stat-item low"><div class="stat-value">${formatValue(min, currentProgram)}</div><div class="stat-label">Lowest</div></div>
        <div class="stat-item"><div class="stat-value">${formatValue(Math.round(avg), currentProgram)}</div><div class="stat-label">Average</div></div>
        <div class="stat-item"><div class="stat-value">${disparity}x</div><div class="stat-label">Disparity</div></div>
    `;
    const s = document.getElementById('stats-content');
    const ms = document.getElementById('mobile-stats-content');
    if (s) s.innerHTML = html;
    if (ms) ms.innerHTML = html;
}

function clearCountyLayer() {
    if (countyLayer && mainMap.hasLayer(countyLayer)) mainMap.removeLayer(countyLayer);
    countyLayer = null;
    loadedCountyData = null;
    clearStateBackgroundLayer();
}

// ===== METRO VIEW =====
function clearMetroLayer() {
    if (metroLayer && mainMap.hasLayer(metroLayer)) mainMap.removeLayer(metroLayer);
    metroLayer = null;
    clearStateBackgroundLayer();
}

function clearStateBackgroundLayer() {
    if (stateBackgroundLayer && mainMap.hasLayer(stateBackgroundLayer)) mainMap.removeLayer(stateBackgroundLayer);
    stateBackgroundLayer = null;
}

async function loadAndDisplayMetroAreas() {
    showLoading();
    try {
        if (mainStatesLayer && mainMap.hasLayer(mainStatesLayer)) mainMap.removeLayer(mainStatesLayer);
        clearCountyLayer();
        clearMetroLayer();

        if (!metroGeoJSON) {
            const response = await fetch('data/geojson/metro/cbsa.json');
            if (!response.ok) throw new Error('Failed to load metro GeoJSON');
            metroGeoJSON = await response.json();
        }

        await loadMetroData();

        document.querySelector('.info-location').textContent = 'Metro Areas';
        document.getElementById('info-content').innerHTML = `<p class="hint-text">Showing metro statistical areas. Click an area for details.</p>`;

        if (statesGeoJSON) {
            const allStates = statesGeoJSON.features.filter(f => f.properties.name !== 'Puerto Rico');
            stateBackgroundLayer = L.geoJSON({ type: 'FeatureCollection', features: allStates }, {
                style: () => ({ fillColor: '#1a1814', weight: 0.5, opacity: 0.5, color: '#2d343d', fillOpacity: 0.6 }),
                interactive: false
            }).addTo(mainMap);
        }

        metroLayer = L.geoJSON(metroGeoJSON, {
            style: styleMetroFeature,
            onEachFeature: onEachMetroFeature
        }).addTo(mainMap);

        mainMap.setView([39, -96], 5);
        updateMetroLegend();
        updateMetroStats();
        updateContext();
        hideLoading();
    } catch (error) {
        console.error('Error loading metro areas:', error);
        document.getElementById('loading-overlay').innerHTML = `
            <span style="color: var(--danger);">Error loading metro data</span>
            <button id="error-return-btn" style="margin-top: 12px; padding: 8px 16px; background: var(--primary); color: white; border: none; cursor: pointer;">Return to State View</button>
        `;
        document.getElementById('error-return-btn')?.addEventListener('click', () => switchView('state'));
        document.getElementById('loading-overlay').classList.remove('hidden');
    }
}

function styleMetroFeature(feature) {
    const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
    const metroData = loadedMetroData?.[cbsaCode];
    let value = null;

    if (currentProgram === 'ratio_custom' && window.customRatioConfig && metroData) {
        const num = metroData[window.customRatioConfig.numerator];
        const den = metroData[window.customRatioConfig.denominator];
        if (num && den && den !== 0) value = num / den;
    } else if (metroData) {
        const fieldName = Constants.getDataField(currentMetroProgram);
        value = metroData[fieldName];
    }

    return {
        fillColor: getColorForValue(value, currentMetroProgram),
        weight: 1,
        opacity: 1,
        color: '#ffffff',
        fillOpacity: 0.75
    };
}

function onEachMetroFeature(feature, layer) {
    layer.on({
        mouseover: (e) => showMetroTooltip(e, feature),
        mousemove: moveTooltip,
        mouseout: hideMetroTooltip,
        click: () => selectMetro(feature)
    });
}

function showMetroTooltip(e, feature) {
    const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
    const metroData = loadedMetroData?.[cbsaCode];
    const name = feature.properties.NAME || 'Unknown';

    let content = `<div class="tooltip-header"><span class="tooltip-name">${name}</span><span class="tooltip-type">Metro</span></div>`;

    if (metroData) {
        const fieldName = Constants.getDataField(currentMetroProgram);
        const value = metroData[fieldName];
        if (value != null) {
            content += `<div class="tooltip-value">${formatValue(value, currentMetroProgram)}</div>`;
            content += `<div class="tooltip-detail">${getProgramLabel(currentMetroProgram)}</div>`;
        }
    }

    tooltip.innerHTML = content;
    tooltip.classList.add('visible');
    moveTooltip(e);
    e.target.setStyle({ weight: 2, color: '#000000' });
    e.target.bringToFront();
}

function hideMetroTooltip(e) {
    tooltip.classList.remove('visible');
    if (metroLayer) metroLayer.resetStyle(e.target);
}

function selectMetro(feature) {
    const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
    const name = feature.properties.NAME || 'Unknown';
    selectedLocation = { type: 'metro', cbsaCode, name };
    updateMetroInfoPanel(feature);
    if (Constants.isMobile()) switchMobileTab('info');
}

function updateMetroInfoPanel(feature) {
    const cbsaCode = feature.properties.CBSAFP || feature.properties.GEOID;
    const name = feature.properties.NAME || 'Unknown';
    const metroData = loadedMetroData?.[cbsaCode];

    document.querySelector('.info-location').textContent = name;

    let html = '';
    if (metroData) {
        const fieldName = Constants.getDataField(currentMetroProgram);
        const value = metroData[fieldName];
        if (value != null) {
            html += `<div class="info-value-large">${formatValue(value, currentMetroProgram)}</div>`;
            html += `<div class="info-description">${getProgramLabel(currentMetroProgram)}</div>`;
        }

        html += `<div class="info-section-title">Employment</div><div class="info-stats">`;
        if (metroData.unemployment_rate != null) html += `<div class="info-stat"><div class="info-stat-value">${metroData.unemployment_rate.toFixed(1)}%</div><div class="info-stat-label">Unemployment</div></div>`;
        if (metroData.total_nonfarm_employment != null) html += `<div class="info-stat"><div class="info-stat-value">${formatValue(metroData.total_nonfarm_employment, 'nonfarm_employment')}</div><div class="info-stat-label">Nonfarm Jobs</div></div>`;
        html += `</div>`;

        html += `<div class="info-section-title">Wages</div><div class="info-stats">`;
        if (metroData.avg_hourly_earnings != null) html += `<div class="info-stat"><div class="info-stat-value">$${metroData.avg_hourly_earnings.toFixed(2)}/hr</div><div class="info-stat-label">Avg Hourly</div></div>`;
        if (metroData.median_household_income != null) html += `<div class="info-stat"><div class="info-stat-value">$${metroData.median_household_income.toLocaleString()}</div><div class="info-stat-label">Median HH Income</div></div>`;
        html += `</div>`;
    } else {
        html = '<p class="hint-text">No detailed data available for this area.</p>';
    }

    html += `<div class="info-data-date"><span class="data-date-label">Data as of 2023-2024</span></div>`;

    document.getElementById('info-content').innerHTML = html;
    const mic = document.getElementById('mobile-info-content');
    const mil = document.querySelector('#mobile-info-header .info-location');
    if (mic) mic.innerHTML = html;
    if (mil) mil.textContent = name;
}

function updateMetroLegend() { updateLegend(); }
function updateMetroStats() {
    if (!loadedMetroData) return;
    const fieldName = Constants.getDataField(currentMetroProgram);
    const values = Object.values(loadedMetroData).map(m => m[fieldName]).filter(v => v != null && !isNaN(v));
    if (values.length === 0) return;
    const min = Math.min(...values), max = Math.max(...values);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const disparity = min > 0 ? (max / min).toFixed(1) : 'N/A';

    const html = `
        <div class="stat-item high"><div class="stat-value">${formatValue(max, currentMetroProgram)}</div><div class="stat-label">Highest</div></div>
        <div class="stat-item low"><div class="stat-value">${formatValue(min, currentMetroProgram)}</div><div class="stat-label">Lowest</div></div>
        <div class="stat-item"><div class="stat-value">${formatValue(Math.round(avg), currentMetroProgram)}</div><div class="stat-label">Average</div></div>
        <div class="stat-item"><div class="stat-value">${disparity}x</div><div class="stat-label">Disparity</div></div>
    `;
    const s = document.getElementById('stats-content');
    const ms = document.getElementById('mobile-stats-content');
    if (s) s.innerHTML = html;
    if (ms) ms.innerHTML = html;
}

// ===== COLOR SCALE SELECTOR =====
function initColorScaleSelector() {
    document.querySelectorAll('.color-option').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.color-option').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentColorPalette = btn.dataset.palette;
            ColorScales.setColorPalette(currentColorPalette);

            if (currentView === 'state') updateAll();
            else if (currentView === 'county' && countyLayer) {
                countyLayer.eachLayer(l => l.setStyle(styleCountyFeature(l.feature)));
                updateCountyLegend();
            } else if (currentView === 'metro' && metroLayer) {
                metroLayer.eachLayer(l => l.setStyle(styleMetroFeature(l.feature)));
                updateMetroLegend();
            }
        });
    });
}

// ===== RATIO BUILDER =====
function initRatioBuilder() {
    updateRatioDropdowns();

    // Desktop
    DOM.modeToggleBtn?.addEventListener('click', toggleDisplayMode);
    DOM.mobileModeToggleBtn?.addEventListener('click', toggleDisplayMode);
    DOM.ratioSwapBtn?.addEventListener('click', swapRatio);
    DOM.mobileRatioSwapBtn?.addEventListener('click', swapRatio);

    const handleRatioChange = () => {
        const num = DOM.ratioNumerator?.value;
        const den = DOM.ratioDenominator?.value;
        if (DOM.mobileRatioNumerator) DOM.mobileRatioNumerator.value = num || '';
        if (DOM.mobileRatioDenominator) DOM.mobileRatioDenominator.value = den || '';
        applyCustomRatio(num, den);
    };

    const handleMobileRatioChange = () => {
        const num = DOM.mobileRatioNumerator?.value;
        const den = DOM.mobileRatioDenominator?.value;
        if (DOM.ratioNumerator) DOM.ratioNumerator.value = num || '';
        if (DOM.ratioDenominator) DOM.ratioDenominator.value = den || '';
        applyCustomRatio(num, den);
    };

    DOM.ratioNumerator?.addEventListener('change', handleRatioChange);
    DOM.ratioDenominator?.addEventListener('change', handleRatioChange);
    DOM.mobileRatioNumerator?.addEventListener('change', handleMobileRatioChange);
    DOM.mobileRatioDenominator?.addEventListener('change', handleMobileRatioChange);
}

function getRatioOptionLabel(field) {
    return Ratios.fields[field]?.name || getProgramLabel(field) || field;
}

function updateRatioDropdowns() {
    const ratioOptions = {
        state: {
            'unemployment_rate': 'Unemployment Rate',
            'median_household_income': 'Median Household Income',
            'median_home_value': 'Median Home Value',
            'median_rent': 'Median Rent',
            'median_earnings': 'Median Earnings',
            'per_capita_income': 'Per Capita Income',
            'avg_hourly_earnings': 'Avg Hourly Earnings',
            'avg_weekly_earnings': 'Avg Weekly Earnings',
            'population': 'Population',
            'poverty_rate': 'Poverty Rate'
        },
        metro: {
            'unemployment_rate': 'Unemployment Rate',
            'median_household_income': 'Median Household Income',
            'avg_hourly_earnings': 'Avg Hourly Earnings',
            'population': 'Population',
            'poverty_rate': 'Poverty Rate'
        },
        county: {
            'unemployment_rate': 'Unemployment Rate',
            'median_household_income': 'Median Household Income',
            'median_home_value': 'Median Home Value',
            'median_rent': 'Median Rent',
            'per_capita_income': 'Per Capita Income',
            'population': 'Population',
            'poverty_rate': 'Poverty Rate',
            'labor_force': 'Labor Force'
        }
    };

    const options = ratioOptions[currentView] || ratioOptions.state;
    const html = '<option value="">Select...</option>' +
        Object.entries(options).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');

    [DOM.ratioNumerator, DOM.ratioDenominator, DOM.mobileRatioNumerator, DOM.mobileRatioDenominator].forEach(el => {
        if (el) el.innerHTML = html;
    });
}

function toggleDisplayMode() {
    displayMode = displayMode === 'data' ? 'ratio' : 'data';

    const isRatio = displayMode === 'ratio';
    const toggleText = isRatio ? 'Switch to Data' : 'Switch to Ratio';

    if (DOM.modeToggleBtn) DOM.modeToggleBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M7 4l-4 4 4 4"/><path d="M17 20l4-4-4-4"/><path d="M3 8h18"/><path d="M3 16h18"/></svg>${toggleText}`;
    if (DOM.mobileModeToggleBtn) DOM.mobileModeToggleBtn.innerHTML = DOM.modeToggleBtn?.innerHTML || toggleText;

    // Update active labels
    [DOM.dataLabel, DOM.mobileDataLabel].forEach(el => {
        if (el) el.classList.toggle('panel-label-active', !isRatio);
    });
    [DOM.ratioLabel, DOM.mobileRatioLabel].forEach(el => {
        if (el) el.classList.toggle('panel-label-active', isRatio);
    });

    if (!isRatio) {
        // Switch back to data mode
        window.customRatioConfig = null;
        window.customRatioBreakpoints = null;
        currentProgram = document.getElementById(
            currentView === 'county' ? 'county-program-select' :
            currentView === 'metro' ? 'metro-program-select' : 'program-select'
        )?.value || 'unemployment_rate';

        if (currentView === 'state') updateAll();
        else if (currentView === 'county' && countyLayer) {
            countyLayer.eachLayer(l => l.setStyle(styleCountyFeature(l.feature)));
            updateCountyLegend(); updateCountyStats(); updateContext();
        } else if (currentView === 'metro' && metroLayer) {
            metroLayer.eachLayer(l => l.setStyle(styleMetroFeature(l.feature)));
            updateMetroLegend(); updateMetroStats(); updateContext();
        }
    }
}

function swapRatio() {
    const numVal = DOM.ratioNumerator?.value;
    const denVal = DOM.ratioDenominator?.value;
    if (DOM.ratioNumerator) DOM.ratioNumerator.value = denVal || '';
    if (DOM.ratioDenominator) DOM.ratioDenominator.value = numVal || '';
    if (DOM.mobileRatioNumerator) DOM.mobileRatioNumerator.value = denVal || '';
    if (DOM.mobileRatioDenominator) DOM.mobileRatioDenominator.value = numVal || '';
    applyCustomRatio(denVal, numVal);
}

function applyCustomRatio(numerator, denominator) {
    if (!numerator || !denominator) return;

    displayMode = 'ratio';
    currentProgram = 'ratio_custom';
    window.customRatioConfig = { numerator, denominator };

    // Calculate breakpoints from data
    let ratioValues = {};
    if (currentView === 'state' && stateEconomicData) {
        Object.entries(stateEconomicData).forEach(([name, data]) => {
            const num = data[numerator], den = data[denominator];
            if (num && den && den !== 0) ratioValues[name] = num / den;
        });
    } else if (currentView === 'county' && loadedCountyData?.counties) {
        Object.entries(loadedCountyData.counties).forEach(([fips, data]) => {
            const num = data[numerator], den = data[denominator];
            if (num && den && den !== 0) ratioValues[fips] = num / den;
        });
    } else if (currentView === 'metro' && loadedMetroData) {
        Object.entries(loadedMetroData).forEach(([code, data]) => {
            const num = data[numerator], den = data[denominator];
            if (num && den && den !== 0) ratioValues[code] = num / den;
        });
    }

    window.customRatioBreakpoints = Ratios.generateAutoBreakpoints(ratioValues);

    // Update labels
    [DOM.dataLabel, DOM.mobileDataLabel].forEach(el => { if (el) el.classList.remove('panel-label-active'); });
    [DOM.ratioLabel, DOM.mobileRatioLabel].forEach(el => { if (el) el.classList.add('panel-label-active'); });

    if (currentView === 'state') updateAll();
    else if (currentView === 'county' && countyLayer) {
        countyLayer.eachLayer(l => l.setStyle(styleCountyFeature(l.feature)));
        updateCountyLegend(); updateCountyStats(); updateContext();
    } else if (currentView === 'metro' && metroLayer) {
        metroLayer.eachLayer(l => l.setStyle(styleMetroFeature(l.feature)));
        updateMetroLegend(); updateMetroStats(); updateContext();
    }
}

// ===== SCREENSHOT MODE =====
function initScreenshotMode() {
    const screenshotBtn = document.getElementById('screenshot-btn');
    const screenshotExit = document.getElementById('screenshot-exit');
    const screenshotTitle = document.getElementById('screenshot-title');

    if (screenshotBtn) {
        screenshotBtn.addEventListener('click', () => {
            document.querySelector('.app-container').classList.add('screenshot-mode');
            if (screenshotTitle) {
                screenshotTitle.textContent = `LaborCompare — ${getProgramLabel(currentView === 'metro' ? currentMetroProgram : currentProgram)}`;
            }
            mainMap.invalidateSize();
        });
    }

    if (screenshotExit) {
        screenshotExit.addEventListener('click', () => {
            document.querySelector('.app-container').classList.remove('screenshot-mode');
            mainMap.invalidateSize();
        });
    }
}