/**
 * LaborCompare — Wages Page (replaces occupation.js)
 * Landing: /wages — sortable occupation table with sector filter
 * Detail: /wages/:soc — stat cards, wage bars, map, tables
 */

const WagesPage = (() => {
    let map = null;
    let geoLayer = null;

    function getTitle(params) {
        if (params?.soc) return 'Occupation Details';
        return 'Wages — All Occupations';
    }

    async function mount(params, container) {
        if (params?.soc) {
            await mountDetail(params.soc, container);
        } else {
            await mountLanding(container);
        }
    }

    // ================================================================
    // Landing page: sortable occupation table
    // ================================================================
    async function mountLanding(container) {
        container.innerHTML = `
            <div class="wages-page">
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>Wages</span>
                </nav>

                <h1 class="page-title">All Occupations</h1>

                <div class="sector-wrap">
                    <div class="sector-chips" id="wages-sector-chips"></div>
                </div>

                <div style="margin-bottom: 16px;">
                    <input type="text" id="wages-filter" class="filter-input" placeholder="Filter occupations...">
                </div>

                <div class="table-wrapper" id="wages-table-wrap">
                    <div class="page-loading"><div class="loader"></div><span>Loading occupations...</span></div>
                </div>
            </div>
        `;

        renderSectorChips();
        await loadOccupationTable();
    }

    function renderSectorChips() {
        const container = document.getElementById('wages-sector-chips');
        if (!container) return;

        const groups = Constants.SOC_MAJOR_GROUPS;
        const allChip = '<a class="sc" href="#/wages" style="border-color: var(--accent); color: var(--accent);">All</a>';
        const chips = Object.entries(groups)
            .filter(([code]) => code !== '55')
            .map(([code, title]) => `<a class="sc" data-sector="${code}">${title}</a>`)
            .join('');

        container.innerHTML = allChip + chips;

        container.querySelectorAll('[data-sector]').forEach(chip => {
            chip.addEventListener('click', (e) => {
                e.preventDefault();
                filterBySector(chip.dataset.sector);
            });
        });
    }

    let allOccs = [];

    async function loadOccupationTable() {
        const wrap = document.getElementById('wages-table-wrap');
        if (!wrap) return;

        const national = await OEWSLoader.loadNational();
        if (!national?.occupations) {
            wrap.innerHTML = '<p class="hint-text">Occupation data not available. Run the OEWS pipeline.</p>';
            return;
        }

        allOccs = Object.entries(national.occupations)
            .map(([soc, d]) => ({ soc, ...d }))
            .filter(o => o.med != null);

        allOccs.sort((a, b) => b.med - a.med);
        renderTable(allOccs, wrap);

        // Filter input
        const filterInput = document.getElementById('wages-filter');
        filterInput?.addEventListener('input', () => {
            const q = filterInput.value.toLowerCase().trim();
            const filtered = q
                ? allOccs.filter(o => (o.title || '').toLowerCase().includes(q) || o.soc.includes(q))
                : allOccs;
            renderTable(filtered, wrap);
        });
    }

    function filterBySector(code) {
        const wrap = document.getElementById('wages-table-wrap');
        if (!wrap) return;
        const filtered = allOccs.filter(o => o.soc.startsWith(code + '-'));
        renderTable(filtered, wrap);
    }

    function renderTable(occs, wrap) {
        if (occs.length === 0) {
            wrap.innerHTML = '<p class="hint-text">No occupations found.</p>';
            return;
        }

        wrap.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Occupation</th>
                        <th class="value-cell">Median Salary</th>
                        <th class="value-cell">Average Salary</th>
                        <th class="value-cell">Employment</th>
                    </tr>
                </thead>
                <tbody>
                    ${occs.map((o, i) => `
                        <tr class="clickable-row" data-soc="${o.soc}">
                            <td>${i + 1}</td>
                            <td>${o.title || o.soc}</td>
                            <td class="value-cell">${Formatters.salary(o.med)}</td>
                            <td class="value-cell">${Formatters.salary(o.avg)}</td>
                            <td class="value-cell">${Formatters.count(o.emp)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        wrap.querySelectorAll('[data-soc]').forEach(el => {
            el.addEventListener('click', () => Router.navigate(`/wages/${el.dataset.soc}`));
        });
    }

    // ================================================================
    // Detail page: single occupation
    // ================================================================
    async function mountDetail(soc, container) {
        container.innerHTML = `
            <div class="wages-page">
                <div class="page-loading"><div class="loader"></div><span>Loading occupation data...</span></div>
            </div>
        `;

        const [national, byState, byMetro] = await Promise.all([
            OEWSLoader.loadNational(),
            OEWSLoader.loadOccupationByState(soc),
            OEWSLoader.loadOccupationByMetro(soc)
        ]);

        const occ = national?.occupations?.[soc];
        if (!occ) {
            container.innerHTML = `
                <div class="page-error">
                    <h2>Occupation not found</h2>
                    <p>SOC code "${soc}" was not found in the data.</p>
                    <a href="#/wages" class="btn-back">All Occupations</a>
                </div>`;
            return;
        }

        document.title = `${occ.title} — LaborCompare`;
        const stateData = byState?.states || {};
        const majorCode = soc.split('-')[0];
        const majorGroup = Constants.SOC_MAJOR_GROUPS[majorCode] || '';

        container.innerHTML = `
            <div class="wages-page">
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <a href="#/wages">Wages</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>${occ.title}</span>
                </nav>

                <header class="wages-header">
                    <div class="wages-header-text">
                        <span class="soc-badge">${soc}</span>
                        <h1 class="wages-title">${occ.title}</h1>
                        <p class="wages-group">${majorGroup}</p>
                    </div>
                    <div class="key-stats">
                        <div class="key-stat">
                            <span class="key-stat-value">${Formatters.salary(occ.med)}</span>
                            <span class="key-stat-label">Median Salary</span>
                        </div>
                        <div class="key-stat">
                            <span class="key-stat-value">${Formatters.hourly(occ.hmed)}</span>
                            <span class="key-stat-label">Median Hourly</span>
                        </div>
                        <div class="key-stat">
                            <span class="key-stat-value">${Formatters.count(occ.emp)}</span>
                            <span class="key-stat-label">Total Employed</span>
                        </div>
                    </div>
                </header>

                <section class="section">
                    <h2 class="section-title">Wage Distribution (Annual)</h2>
                    ${renderWageDistribution(occ)}
                </section>

                <section class="section">
                    <h2 class="section-title">Median Salary by State</h2>
                    <div class="occ-map-container">
                        <div id="occ-map" class="occ-map"></div>
                    </div>
                </section>

                <section class="section">
                    <h2 class="section-title">Top Paying States</h2>
                    <div class="table-wrapper">${renderStatesTable(stateData, 'med')}</div>
                </section>

                ${byMetro?.metros ? `
                <section class="section">
                    <h2 class="section-title">Top Paying Metro Areas</h2>
                    <div class="table-wrapper">${renderMetrosTable(byMetro.metros)}</div>
                </section>
                ` : ''}

                <section class="section">
                    <h2 class="section-title">Where the Jobs Are</h2>
                    <div class="table-wrapper">${renderStatesTable(stateData, 'emp')}</div>
                </section>

                <section class="section">
                    <h2 class="section-title">Related Occupations</h2>
                    ${renderRelated(soc, national)}
                </section>
            </div>
        `;

        initDetailMap(stateData);

        container.querySelectorAll('[data-fips]').forEach(el => {
            el.addEventListener('click', () => Router.navigate(`/states/${el.dataset.fips}`));
        });
    }

    function renderWageDistribution(occ) {
        const vals = [
            { label: '10th', value: occ.p10, key: 'p10' },
            { label: '25th', value: occ.p25, key: 'p25' },
            { label: 'Median', value: occ.med, key: 'med' },
            { label: '75th', value: occ.p75, key: 'p75' },
            { label: '90th', value: occ.p90, key: 'p90' }
        ];

        const max = Math.max(...vals.map(v => v.value || 0));
        if (!max) return '<p class="hint-text">Wage distribution data not available.</p>';

        return `
            <div class="wage-bars">
                ${vals.map(v => {
                    const pct = max > 0 ? ((v.value || 0) / max * 100) : 0;
                    const isMedian = v.key === 'med';
                    return `
                        <div class="wage-bar-row ${isMedian ? 'wage-bar-median' : ''}">
                            <span class="wage-bar-label">${v.label}</span>
                            <div class="wage-bar-track">
                                <div class="wage-bar-fill" style="width: ${pct}%"></div>
                            </div>
                            <span class="wage-bar-value">${Formatters.salary(v.value)}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    function renderStatesTable(states, sortBy) {
        const entries = Object.entries(states)
            .filter(([, d]) => d[sortBy] != null)
            .sort((a, b) => b[1][sortBy] - a[1][sortBy])
            .slice(0, 15);

        if (entries.length === 0) return '<p class="hint-text">State-level data not available.</p>';

        const isEmp = sortBy === 'emp';
        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>State</th>
                        <th class="value-cell">${isEmp ? 'Employment' : 'Median Salary'}</th>
                        <th class="value-cell">${isEmp ? 'Jobs per 1,000' : 'Avg Salary'}</th>
                        <th class="value-cell">${isEmp ? 'Median Salary' : 'Employment'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(([fips, d], i) => `
                        <tr class="clickable-row" data-fips="${fips}">
                            <td>${i + 1}</td>
                            <td>${Constants.STATE_FIPS_TO_NAME[fips] || fips}</td>
                            <td class="value-cell">${isEmp ? Formatters.count(d.emp) : Formatters.salary(d.med)}</td>
                            <td class="value-cell">${isEmp ? Formatters.quotient(d.j1k) : Formatters.salary(d.avg)}</td>
                            <td class="value-cell">${isEmp ? Formatters.salary(d.med) : Formatters.count(d.emp)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderMetrosTable(metros) {
        const entries = Object.entries(metros)
            .filter(([, d]) => d.med != null)
            .sort((a, b) => b[1].med - a[1].med)
            .slice(0, 15);

        if (entries.length === 0) return '<p class="hint-text">Metro-level data not available.</p>';

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Metro Area</th>
                        <th class="value-cell">Median Salary</th>
                        <th class="value-cell">Employment</th>
                        <th class="value-cell">Location Quotient</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(([cbsa, d], i) => `
                        <tr>
                            <td>${i + 1}</td>
                            <td>${d.name || cbsa}</td>
                            <td class="value-cell">${Formatters.salary(d.med)}</td>
                            <td class="value-cell">${Formatters.count(d.emp)}</td>
                            <td class="value-cell">${Formatters.quotient(d.lq)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderRelated(soc, national) {
        if (!national?.occupations) return '';

        const majorCode = soc.split('-')[0];
        const related = Object.entries(national.occupations)
            .filter(([code]) => code !== soc && code.startsWith(majorCode + '-'))
            .sort((a, b) => (b[1].emp || 0) - (a[1].emp || 0))
            .slice(0, 10);

        if (related.length === 0) return '<p class="hint-text">No related occupations found.</p>';

        return `
            <div class="related-grid">
                ${related.map(([code, data]) => `
                    <a href="#/wages/${code}" class="related-card">
                        <span class="related-title">${data.title}</span>
                        <span class="related-meta">${Formatters.salary(data.med)} · ${Formatters.count(data.emp)} workers</span>
                    </a>
                `).join('')}
            </div>
        `;
    }

    async function initDetailMap(states) {
        const mapEl = document.getElementById('occ-map');
        if (!mapEl || !states || Object.keys(states).length === 0) return;

        await loadLeaflet();

        if (map) { map.remove(); map = null; }

        map = L.map('occ-map', {
            center: [40, -98],
            zoom: 4,
            zoomControl: true,
            scrollWheelZoom: false,
            attributionControl: false
        });

        // Light tiles (CartoDB Positron)
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 10
        }).addTo(map);

        try {
            const geo = await OEWSLoader.loadStatesGeoJSON();
            if (!geo) return;

            const values = Object.values(states).map(d => d.med).filter(v => v != null);
            const min = Math.min(...values);
            const max = Math.max(...values);

            geoLayer = L.geoJSON(geo, {
                style: (feature) => {
                    const stateName = feature.properties.name;
                    const fips = Constants.STATE_NAME_TO_FIPS[stateName];
                    const data = fips ? states[fips] : null;
                    const val = data?.med;

                    let fillColor = '#e5e7eb';
                    if (val != null && max > min) {
                        const t = (val - min) / (max - min);
                        fillColor = interpolateColor(t);
                    }

                    return {
                        fillColor,
                        weight: 1,
                        opacity: 0.8,
                        color: '#d1d5db',
                        fillOpacity: 0.85
                    };
                },
                onEachFeature: (feature, layer) => {
                    const stateName = feature.properties.name;
                    const fips = Constants.STATE_NAME_TO_FIPS[stateName];
                    const data = fips ? states[fips] : null;

                    layer.on({
                        mouseover: (e) => {
                            e.target.setStyle({ weight: 2, color: '#dc2626' });
                            e.target.bringToFront();
                        },
                        mouseout: (e) => geoLayer.resetStyle(e.target),
                        click: () => { if (fips) Router.navigate(`/states/${fips}`); }
                    });

                    if (data?.med != null) {
                        layer.bindTooltip(
                            `<strong>${stateName}</strong><br>${Formatters.salary(data.med)}`,
                            { sticky: true, className: 'map-tip' }
                        );
                    }
                }
            }).addTo(map);
        } catch (err) {
            console.error('Map error:', err);
        }
    }

    function interpolateColor(t) {
        // Light blue (#dbeafe) to red (#dc2626)
        const r = Math.round(219 + t * (220 - 219));
        const g = Math.round(234 + t * (38 - 234));
        const b = Math.round(254 + t * (38 - 254));
        return `rgb(${r},${g},${b})`;
    }

    function unmount() {
        if (map) {
            map.remove();
            map = null;
            geoLayer = null;
        }
        allOccs = [];
    }

    return { getTitle, mount, unmount };
})();

window.WagesPage = WagesPage;
