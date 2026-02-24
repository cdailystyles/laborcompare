/**
 * LaborCompare - BLS Data Loader
 * Lazy-loads BLS data files (ticker, CPI, projections, JOLTS) with in-memory caching.
 * Same pattern as oews-loader.
 */

const BLSLoader = (() => {
    const cache = new Map();

    async function fetchJSON(url) {
        if (cache.has(url)) return cache.get(url);

        try {
            const resp = await fetch(url);
            if (!resp.ok) return null;
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
     * Load ticker data (headline stats for topbar + home stat cards)
     * Returns { ticker: [...], cards: [...] }
     */
    async function loadTicker() {
        return fetchJSON('data/ticker.json');
    }

    /**
     * Load CPI national data
     * Returns { current, yoy_change, series: [...] }
     */
    async function loadCPI() {
        return fetchJSON('data/cpi/national.json');
    }

    /**
     * Load CPI categories (food, shelter, energy, etc.)
     * Returns [ { code, name, index, yoy_change } ]
     */
    async function loadCPICategories() {
        return fetchJSON('data/cpi/categories.json');
    }

    /**
     * Load employment projections
     * Returns { period, occupations: [...] }
     */
    async function loadProjections() {
        return fetchJSON('data/projections/national.json');
    }

    /**
     * Load fastest growing occupations
     * Returns [ { soc, title, change, ... } ]
     */
    async function loadFastest() {
        const data = await fetchJSON('data/projections/fastest.json');
        return data?.occupations || data || null;
    }

    /**
     * Load declining occupations
     * Returns [ { soc, title, change, ... } ]
     */
    async function loadDeclining() {
        const data = await fetchJSON('data/projections/declining.json');
        return data?.occupations || data || null;
    }

    /**
     * Load occupations with most new jobs
     * Returns [ { soc, title, new_jobs, ... } ]
     */
    async function loadMostGrowth() {
        const data = await fetchJSON('data/projections/most-growth.json');
        return data?.occupations || data || null;
    }

    /**
     * Load JOLTS national data
     * Returns { openings, hires, quits, separations, series: [...] }
     */
    async function loadJOLTS() {
        return fetchJSON('data/jolts/national.json');
    }

    function clearCache() {
        cache.clear();
    }

    return {
        loadTicker,
        loadCPI,
        loadCPICategories,
        loadProjections,
        loadFastest,
        loadDeclining,
        loadMostGrowth,
        loadJOLTS,
        clearCache
    };
})();

window.BLSLoader = BLSLoader;
