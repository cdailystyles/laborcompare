/**
 * LaborCompare - OEWS Data Loader
 * Lazy-loads OEWS data files with in-memory caching.
 * Each file is fetched once and cached for the session.
 */

const OEWSLoader = (() => {
    const cache = new Map();

    /**
     * Fetch JSON with caching
     */
    async function fetchJSON(url) {
        if (cache.has(url)) return cache.get(url);

        try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
            // Cloudflare Pages returns 200 + HTML for missing files (SPA fallback)
            const ct = resp.headers.get('content-type') || '';
            if (!ct.includes('json')) return null;
            const data = await resp.json();
            cache.set(url, data);
            return data;
        } catch {
            return null;
        }
    }

    /**
     * Load national occupation data (all ~830 occupations)
     * Returns { year, count, occupations: { soc: { title, emp, med, avg, ... } } }
     */
    async function loadNational() {
        return fetchJSON('data/oews/national.json');
    }

    /**
     * Load SOC hierarchy (major groups with child occupations)
     * Returns { "11": { title: "Management", occupations: [...] }, ... }
     */
    async function loadHierarchy() {
        return fetchJSON('data/oews/soc-hierarchy.json');
    }

    /**
     * Load one occupation across all states
     * Returns { soc, title, states: { fips: { emp, med, avg, ... } } }
     */
    async function loadOccupationByState(soc) {
        return fetchJSON(`data/oews/occupations/by-state/${soc}.json`);
    }

    /**
     * Load one occupation across all metros
     * Returns { soc, title, metros: { cbsa: { name, emp, med, avg, ... } } }
     */
    async function loadOccupationByMetro(soc) {
        return fetchJSON(`data/oews/occupations/by-metro/${soc}.json`);
    }

    /**
     * Load all occupations for one state
     * Returns { fips, name, count, occupations: { soc: { title, emp, med, ... } } }
     */
    async function loadStateArea(fips) {
        return fetchJSON(`data/oews/areas/states/${fips}.json`);
    }

    /**
     * Load all occupations for one metro
     * Returns { cbsa, name, count, occupations: { soc: { title, emp, med, ... } } }
     */
    async function loadMetroArea(cbsa) {
        return fetchJSON(`data/oews/areas/metros/${cbsa}.json`);
    }

    /**
     * Load state economic data (existing, for area profiles)
     */
    async function loadStateEconomic() {
        const data = await fetchJSON('data/states/economic-data.json');
        return data?.data || data;
    }

    /**
     * Load states GeoJSON for maps
     */
    async function loadStatesGeoJSON() {
        return fetchJSON(Constants.STATES_GEOJSON_URL);
    }

    /**
     * Get occupation info from national data
     */
    async function getOccupation(soc) {
        const national = await loadNational();
        if (!national?.occupations?.[soc]) return null;
        return { soc, ...national.occupations[soc] };
    }

    /**
     * Get top occupations nationally by a field (emp, med, avg)
     */
    async function getTopOccupations(field = 'emp', limit = 20) {
        const national = await loadNational();
        if (!national?.occupations) return [];

        return Object.entries(national.occupations)
            .map(([soc, data]) => ({ soc, ...data }))
            .filter(o => o[field] != null)
            .sort((a, b) => (b[field] || 0) - (a[field] || 0))
            .slice(0, limit);
    }

    /**
     * Clear the cache (for testing/memory management)
     */
    function clearCache() {
        cache.clear();
    }

    return {
        loadNational,
        loadHierarchy,
        loadOccupationByState,
        loadOccupationByMetro,
        loadStateArea,
        loadMetroArea,
        loadStateEconomic,
        loadStatesGeoJSON,
        getOccupation,
        getTopOccupations,
        clearCache
    };
})();

window.OEWSLoader = OEWSLoader;
