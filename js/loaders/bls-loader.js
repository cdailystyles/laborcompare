/**
 * LaborCompare - BLS Data Loader
 * Lazy-loads BLS data files (ticker, CPI, projections, JOLTS) with in-memory caching.
 * Transforms raw process-script output into frontend-friendly formats.
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
     * Process script outputs: { data: [{ year, month, value, yoyChange, momChange }] }
     * Returns: { current, yoy_change, mom_change, series }
     */
    async function loadCPI() {
        const raw = await fetchJSON('data/cpi/national.json');
        if (!raw?.data?.length) return null;

        const latest = raw.data[0];
        return {
            current: latest.value,
            yoy_change: latest.yoyChange ?? null,
            mom_change: latest.momChange ?? null,
            series: raw.data
        };
    }

    /**
     * Load CPI categories (food, shelter, energy, etc.)
     * Process script outputs: { categories: [{ name, latestValue, yoyChange }] }
     * Returns: [{ name, index, yoy_change }]
     */
    async function loadCPICategories() {
        const raw = await fetchJSON('data/cpi/categories.json');
        if (!raw?.categories?.length) return null;

        return raw.categories.map(c => ({
            name: c.name,
            index: c.latestValue,
            yoy_change: c.yoyChange ?? 0
        }));
    }

    /**
     * Load employment projections (all)
     * Returns { count, occupations: [...] }
     */
    async function loadProjections() {
        return fetchJSON('data/projections/national.json');
    }

    /**
     * Load fastest growing occupations
     * Process outputs: { occupations: [{ code, title, changePct, empBase, openings }] }
     * Returns: [{ soc, title, change, median }]
     */
    async function loadFastest() {
        const data = await fetchJSON('data/projections/fastest.json');
        return normalizeProjections(data);
    }

    /**
     * Load declining occupations
     * Returns: [{ soc, title, change, median }]
     */
    async function loadDeclining() {
        const data = await fetchJSON('data/projections/declining.json');
        return normalizeProjections(data);
    }

    /**
     * Load occupations with most new jobs
     * Process outputs: { occupations: [{ code, title, changeNum }] }
     * Returns: [{ soc, title, new_jobs, median }]
     */
    async function loadMostGrowth() {
        const data = await fetchJSON('data/projections/most-growth.json');
        if (!data?.occupations) return null;
        return data.occupations.map(o => ({
            soc: o.code || o.soc,
            title: o.title,
            new_jobs: o.changeNum ?? o.new_jobs ?? 0,
            change: o.changePct ?? o.change ?? 0,
            median: o.median ?? null
        }));
    }

    /** Normalize projection items to frontend format */
    function normalizeProjections(data) {
        if (!data?.occupations) return null;
        return data.occupations.map(o => ({
            soc: o.code || o.soc,
            title: o.title,
            change: o.changePct ?? o.change ?? 0,
            new_jobs: o.changeNum ?? o.new_jobs ?? 0,
            median: o.median ?? null
        }));
    }

    /**
     * Load JOLTS national data
     * Process script outputs: { latest: { openings: { value }, hires: { value }, ... }, series }
     * Returns: { openings, hires, quits, separations, latest, series }
     */
    async function loadJOLTS() {
        const raw = await fetchJSON('data/jolts/national.json');
        if (!raw) return null;

        // If already in flat format, return as-is
        if (typeof raw.openings === 'number') return raw;

        // Transform from process-jolts.js format
        if (raw.latest) {
            return {
                openings: raw.latest.openings?.value ?? null,
                hires: raw.latest.hires?.value ?? null,
                quits: raw.latest.quits?.value ?? null,
                separations: raw.latest.separations?.value ?? null,
                latest: raw.latest,
                series: raw.series
            };
        }

        return raw;
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
