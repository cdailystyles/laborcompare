/**
 * LaborCompare — Occupation Detail Page
 * Shows wages, employment, and geographic distribution for a single occupation.
 * Route: #/occupation/{soc}
 */

const OccupationPage = (() => {
    let map = null;
    let geoLayer = null;
    let stateData = null;

    function getTitle(params) {
        return params?.title || 'Occupation Details';
    }

    async function mount(params, container) {
        const soc = params.soc;
        if (!soc) {
            container.innerHTML = '<div class="page-error"><h2>No occupation specified</h2><a href="#/">Back to Home</a></div>';
            return;
        }

        // Show loading state
        container.innerHTML = `
            <div class="occ-page">
                <div class="page-loading"><div class="loader"></div><span>Loading occupation data...</span></div>
            </div>
        `;

        // Load data in parallel
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
                    <a href="#/" class="btn-back">Back to Home</a>
                </div>`;
            return;
        }

        // Update page title
        document.title = `${occ.title} — LaborCompare`;
        stateData = byState?.states || {};

        const majorCode = soc.split('-')[0];
        const majorGroup = Constants.SOC_MAJOR_GROUPS[majorCode] || '';

        container.innerHTML = `
            <div class="occ-page">
                <!-- Breadcrumb -->
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>${majorGroup}</span>
                    <span class="breadcrumb-sep">/</span>
                    <span>${occ.title}</span>
                </nav>

                <!-- Header -->
                <header class="occ-header">
                    <div class="occ-header-text">
                        <span class="occ-soc-badge">${soc}</span>
                        <h1 class="occ-title">${occ.title}</h1>
                        <p class="occ-group">${majorGroup}</p>
                    </div>
                    <div class="occ-key-stats">
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

                <!-- Wage distribution -->
                <section class="occ-section">
                    <h2 class="occ-section-title">Wage Distribution (Annual)</h2>
                    <div class="wage-distribution" id="wage-distribution">
                        ${renderWageDistribution(occ)}
                    </div>
                </section>

                <!-- Map: Median wage by state -->
                <section class="occ-section">
                    <h2 class="occ-section-title">Median Salary by State</h2>
                    <div class="occ-map-container">
                        <div id="occ-map" class="occ-map"></div>
                    </div>
                </section>

                <!-- Top paying states -->
                <section class="occ-section">
                    <h2 class="occ-section-title">Top Paying States</h2>
                    <div class="occ-table-wrapper">
                        ${renderTopStatesTable(stateData)}
                    </div>
                </section>

                <!-- Top paying metros -->
                ${byMetro?.metros ? `
                <section class="occ-section">
                    <h2 class="occ-section-title">Top Paying Metro Areas</h2>
                    <div class="occ-table-wrapper">
                        ${renderTopMetrosTable(byMetro.metros)}
                    </div>
                </section>
                ` : ''}

                <!-- Where the jobs are -->
                <section class="occ-section">
                    <h2 class="occ-section-title">Where the Jobs Are</h2>
                    <div class="occ-table-wrapper">
                        ${renderEmploymentTable(stateData)}
                    </div>
                </section>

                <!-- Related occupations -->
                <section class="occ-section">
                    <h2 class="occ-section-title">Related Occupations</h2>
                    <div class="related-occs" id="related-occs">
                        ${renderRelatedOccupations(soc, national)}
                    </div>
                </section>
            </div>
        `;

        // Initialize map
        initMap(stateData);

        // Add click handlers for state links
        container.querySelectorAll('[data-fips]').forEach(el => {
            el.addEventListener('click', () => Router.navigate(`/area/${el.dataset.fips}`));
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

    function renderTopStatesTable(states) {
        const entries = Object.entries(states)
            .filter(([, d]) => d.med != null)
            .sort((a, b) => b[1].med - a[1].med)
            .slice(0, 15);

        if (entries.length === 0) return '<p class="hint-text">State-level data not available.</p>';

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>State</th>
                        <th>Median Salary</th>
                        <th>Avg Salary</th>
                        <th>Employment</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(([fips, d], i) => `
                        <tr class="clickable-row" data-fips="${fips}">
                            <td>${i + 1}</td>
                            <td>${Constants.STATE_FIPS_TO_NAME[fips] || fips}</td>
                            <td class="value-cell">${Formatters.salary(d.med)}</td>
                            <td class="value-cell">${Formatters.salary(d.avg)}</td>
                            <td class="value-cell">${Formatters.count(d.emp)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderTopMetrosTable(metros) {
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
                        <th>Median Salary</th>
                        <th>Employment</th>
                        <th>Location Quotient</th>
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

    function renderEmploymentTable(states) {
        const entries = Object.entries(states)
            .filter(([, d]) => d.emp != null)
            .sort((a, b) => b[1].emp - a[1].emp)
            .slice(0, 15);

        if (entries.length === 0) return '<p class="hint-text">Employment data not available.</p>';

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>State</th>
                        <th>Employment</th>
                        <th>Jobs per 1,000</th>
                        <th>Median Salary</th>
                    </tr>
                </thead>
                <tbody>
                    ${entries.map(([fips, d], i) => `
                        <tr class="clickable-row" data-fips="${fips}">
                            <td>${i + 1}</td>
                            <td>${Constants.STATE_FIPS_TO_NAME[fips] || fips}</td>
                            <td class="value-cell">${Formatters.count(d.emp)}</td>
                            <td class="value-cell">${Formatters.quotient(d.j1k)}</td>
                            <td class="value-cell">${Formatters.salary(d.med)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    function renderRelatedOccupations(soc, national) {
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
                    <a href="#/occupation/${code}" class="related-card">
                        <span class="related-title">${data.title}</span>
                        <span class="related-meta">${Formatters.salary(data.med)} · ${Formatters.count(data.emp)} workers</span>
                    </a>
                `).join('')}
            </div>
        `;
    }

    async function initMap(states) {
        const mapEl = document.getElementById('occ-map');
        if (!mapEl || !states || Object.keys(states).length === 0) return;

        // Clean up existing map
        if (map) {
            map.remove();
            map = null;
        }

        map = L.map('occ-map', {
            center: [40, -98],
            zoom: 4,
            zoomControl: true,
            scrollWheelZoom: false,
            attributionControl: false
        });

        // Dark tile layer
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
            maxZoom: 10
        }).addTo(map);

        // Load GeoJSON
        try {
            const geo = await OEWSLoader.loadStatesGeoJSON();
            if (!geo) return;

            // Calculate color scale
            const values = Object.values(states).map(d => d.med).filter(v => v != null);
            const min = Math.min(...values);
            const max = Math.max(...values);

            geoLayer = L.geoJSON(geo, {
                style: (feature) => {
                    const stateName = feature.properties.name;
                    const fips = Constants.STATE_NAME_TO_FIPS[stateName];
                    const data = fips ? states[fips] : null;
                    const val = data?.med;

                    let fillColor = '#1a1a2e';
                    if (val != null && max > min) {
                        const t = (val - min) / (max - min);
                        fillColor = interpolateColor(t);
                    }

                    return {
                        fillColor,
                        weight: 1,
                        opacity: 0.7,
                        color: '#374151',
                        fillOpacity: 0.85
                    };
                },
                onEachFeature: (feature, layer) => {
                    const stateName = feature.properties.name;
                    const fips = Constants.STATE_NAME_TO_FIPS[stateName];
                    const data = fips ? states[fips] : null;

                    layer.on({
                        mouseover: (e) => {
                            e.target.setStyle({ weight: 2, color: '#f59e0b' });
                            e.target.bringToFront();
                        },
                        mouseout: (e) => {
                            geoLayer.resetStyle(e.target);
                        },
                        click: () => {
                            if (fips) Router.navigate(`/area/${fips}`);
                        }
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

    /**
     * Interpolate between blue-to-gold color scale
     */
    function interpolateColor(t) {
        // Dark blue (#1e3a5f) to gold (#f59e0b)
        const r = Math.round(30 + t * (245 - 30));
        const g = Math.round(58 + t * (158 - 58));
        const b = Math.round(95 + t * (11 - 95));
        return `rgb(${r},${g},${b})`;
    }

    function unmount() {
        if (map) {
            map.remove();
            map = null;
            geoLayer = null;
        }
    }

    return { getTitle, mount, unmount };
})();

window.OccupationPage = OccupationPage;
