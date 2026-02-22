/**
 * County data and GeoJSON loading utilities for LaborCompare
 * Handles lazy loading and caching of county-level data
 */

// Cache for loaded data
const countyDataCache = {};
const countyGeoJSONCache = {};
let countyIndex = null;

// Base paths
const DATA_BASE = 'data/counties';
const GEOJSON_BASE = 'data/geojson/counties';

/**
 * Load the county index file
 * @returns {Promise<object>}
 */
async function loadCountyIndex() {
    if (countyIndex) return countyIndex;

    try {
        const response = await fetch(`${DATA_BASE}/index.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        countyIndex = await response.json();
        return countyIndex;
    } catch (error) {
        console.error('Error loading county index:', error);
        return { states: [], total_counties: 0 };
    }
}

/**
 * Get state info from index
 * @param {string} stateFips - State FIPS code
 * @returns {Promise<object|null>}
 */
async function getStateInfo(stateFips) {
    const index = await loadCountyIndex();
    return index.states.find(s => s.fips === stateFips) || null;
}

/**
 * Load county data for a specific state
 * @param {string} stateFips - State FIPS code (e.g., "06" for California)
 * @returns {Promise<object>}
 */
async function loadCountyData(stateFips) {
    // Check cache
    if (countyDataCache[stateFips]) {
        return countyDataCache[stateFips];
    }

    const stateInfo = await getStateInfo(stateFips);
    if (!stateInfo) {
        console.error(`Unknown state FIPS: ${stateFips}`);
        return null;
    }

    try {
        const response = await fetch(`${DATA_BASE}/${stateInfo.file}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        countyDataCache[stateFips] = data;
        return data;
    } catch (error) {
        console.error(`Error loading county data for ${stateFips}:`, error);
        return null;
    }
}

/**
 * Load county GeoJSON for a specific state
 * @param {string} stateFips - State FIPS code
 * @returns {Promise<object>}
 */
async function loadCountyGeoJSON(stateFips) {
    // Check cache
    if (countyGeoJSONCache[stateFips]) {
        return countyGeoJSONCache[stateFips];
    }

    try {
        const response = await fetch(`${GEOJSON_BASE}/${stateFips}.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const geojson = await response.json();
        countyGeoJSONCache[stateFips] = geojson;
        return geojson;
    } catch (error) {
        console.error(`Error loading county GeoJSON for ${stateFips}:`, error);
        return null;
    }
}

/**
 * Load both data and GeoJSON for a state
 * @param {string} stateFips - State FIPS code
 * @returns {Promise<{data: object, geojson: object}>}
 */
async function loadStateCounties(stateFips) {
    const [data, geojson] = await Promise.all([
        loadCountyData(stateFips),
        loadCountyGeoJSON(stateFips)
    ]);

    return { data, geojson };
}

/**
 * Get county value for a specific field
 * @param {string} countyFips - County FIPS code
 * @param {string} field - Data field name
 * @param {object} countyData - Pre-loaded county data
 * @returns {number|null}
 */
function getCountyValue(countyFips, field, countyData) {
    const county = countyData?.counties?.[countyFips];
    if (!county) return null;
    return county[field] ?? null;
}

/**
 * Get all values for a field across a state's counties
 * @param {object} countyData - Pre-loaded county data
 * @param {string} field - Data field name
 * @returns {object} - Object mapping FIPS to values
 */
function getFieldValues(countyData, field) {
    const values = {};
    if (!countyData?.counties) return values;

    Object.entries(countyData.counties).forEach(([fips, data]) => {
        values[fips] = data[field] ?? null;
    });

    return values;
}

/**
 * Calculate statistics for a field across counties
 * @param {object} countyData - Pre-loaded county data
 * @param {string} field - Data field name
 * @returns {object}
 */
function calculateCountyStats(countyData, field) {
    if (!countyData?.counties) {
        return { min: 0, max: 0, avg: 0, count: 0 };
    }

    const entries = Object.entries(countyData.counties);
    const values = entries
        .map(([fips, data]) => ({ fips, name: data.name, value: data[field] }))
        .filter(item => item.value !== null && item.value !== undefined);

    if (values.length === 0) {
        return { min: 0, max: 0, avg: 0, count: 0 };
    }

    const numericValues = values.map(v => v.value);
    const min = Math.min(...numericValues);
    const max = Math.max(...numericValues);
    const avg = numericValues.reduce((a, b) => a + b, 0) / values.length;

    const minItem = values.find(v => v.value === min);
    const maxItem = values.find(v => v.value === max);

    return {
        min,
        max,
        avg,
        count: values.length,
        minCounty: minItem?.name,
        minFips: minItem?.fips,
        maxCounty: maxItem?.name,
        maxFips: maxItem?.fips
    };
}

/**
 * Search counties by name
 * @param {string} query - Search query
 * @param {string} stateFips - Optional state FIPS to limit search
 * @returns {Promise<Array>}
 */
async function searchCounties(query, stateFips = null) {
    const results = [];
    const lowerQuery = query.toLowerCase();

    const index = await loadCountyIndex();
    const statesToSearch = stateFips
        ? index.states.filter(s => s.fips === stateFips)
        : index.states;

    for (const state of statesToSearch) {
        const data = await loadCountyData(state.fips);
        if (!data?.counties) continue;

        Object.entries(data.counties).forEach(([fips, county]) => {
            if (county.name.toLowerCase().includes(lowerQuery)) {
                results.push({
                    fips,
                    name: county.name,
                    state: state.name,
                    stateFips: state.fips
                });
            }
        });

        // Limit results
        if (results.length >= 20) break;
    }

    return results.slice(0, 20);
}

/**
 * Clear cached data
 * @param {string} stateFips - Optional specific state to clear
 */
function clearCache(stateFips = null) {
    if (stateFips) {
        delete countyDataCache[stateFips];
        delete countyGeoJSONCache[stateFips];
    } else {
        Object.keys(countyDataCache).forEach(key => delete countyDataCache[key]);
        Object.keys(countyGeoJSONCache).forEach(key => delete countyGeoJSONCache[key]);
    }
}

/**
 * Prefetch county data for adjacent states (for smoother UX)
 * @param {string} stateFips - Current state FIPS
 */
async function prefetchAdjacentStates(stateFips) {
    // Map of adjacent states (simplified)
    const adjacentStates = {
        '06': ['32', '04', '41'], // CA: NV, AZ, OR
        '48': ['35', '40', '05', '22'], // TX: NM, OK, AR, LA
        '12': ['13', '01'], // FL: GA, AL
        '36': ['42', '34', '09', '25', '50'], // NY: PA, NJ, CT, MA, VT
        // Add more as needed
    };

    const adjacent = adjacentStates[stateFips] || [];
    adjacent.forEach(fips => {
        // Load in background without awaiting
        loadCountyData(fips).catch(() => {});
        loadCountyGeoJSON(fips).catch(() => {});
    });
}

// Cache for national data
let nationalCountyData = null;
let nationalCountyGeoJSON = null;

/**
 * Load all county data nationally
 * @returns {Promise<object>}
 */
async function loadAllCountyData() {
    if (nationalCountyData) return nationalCountyData;

    try {
        const response = await fetch(`${DATA_BASE}/all-counties.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        nationalCountyData = await response.json();
        return nationalCountyData;
    } catch (error) {
        console.error('Error loading national county data:', error);
        return null;
    }
}

/**
 * Load all county GeoJSON nationally
 * @returns {Promise<object>}
 */
async function loadAllCountyGeoJSON() {
    if (nationalCountyGeoJSON) return nationalCountyGeoJSON;

    try {
        const response = await fetch(`${GEOJSON_BASE}/all.json`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        nationalCountyGeoJSON = await response.json();
        return nationalCountyGeoJSON;
    } catch (error) {
        console.error('Error loading national county GeoJSON:', error);
        return null;
    }
}

/**
 * Load both national data and GeoJSON
 * @returns {Promise<{data: object, geojson: object}>}
 */
async function loadAllCounties() {
    const [data, geojson] = await Promise.all([
        loadAllCountyData(),
        loadAllCountyGeoJSON()
    ]);
    return { data, geojson };
}

// Export for use in other modules
window.CountyLoader = {
    loadCountyIndex,
    getStateInfo,
    loadCountyData,
    loadCountyGeoJSON,
    loadStateCounties,
    loadAllCountyData,
    loadAllCountyGeoJSON,
    loadAllCounties,
    getCountyValue,
    getFieldValues,
    calculateCountyStats,
    searchCounties,
    clearCache,
    prefetchAdjacentStates
};
