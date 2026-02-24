/**
 * LaborCompare — Map Explorer Page (Strategy D: Occupation-Centric Table + Map Hybrid)
 * Two-panel layout: sortable data table (left) + choropleth/marker map (right)
 * Routes: #/map (landing) and #/map/:soc (deep-link to occupation)
 */

const MapExplorerPage = (() => {
    let map = null;
    let geoLayer = null;
    let markerLayer = null;
    let geoCache = null;
    let currentSOC = null;
    let currentView = 'states'; // 'states' or 'metros'
    let currentMetric = 'med';  // 'med', 'avg', 'emp'
    let stateData = null;
    let metroData = null;
    let nationalData = null;
    let sortCol = 'med';
    let sortAsc = false;

    // ================================================================
    // GeoJSON fetch (bypasses content-type check)
    // ================================================================
    async function fetchGeoJSON() {
        if (geoCache) return geoCache;
        try {
            const resp = await fetch(Constants.STATES_GEOJSON_URL);
            if (!resp.ok) return null;
            geoCache = await resp.json();
            return geoCache;
        } catch { return null; }
    }

    function getTitle(params) {
        if (params?.soc && stateData?.title) return `${stateData.title} Map`;
        return 'Map Explorer';
    }

    // ================================================================
    // Mount
    // ================================================================
    async function mount(params, container) {
        await loadLeaflet();

        container.innerHTML = `
            <div class="mapx-container">
                <div class="mapx-table-panel">
                    <div class="mapx-search-bar">
                        <input type="text" id="mapx-search" class="mapx-search-input"
                               placeholder="Search occupations by title or SOC code..."
                               autocomplete="off">
                    </div>
                    <div id="mapx-controls" class="mapx-controls" style="display:none">
                        <div class="mapx-occ-header">
                            <h2 id="mapx-occ-title" class="mapx-occ-title"></h2>
                            <button id="mapx-clear" class="btn-small btn-muted">Clear</button>
                        </div>
                        <div class="mapx-stat-row" id="mapx-stats"></div>
                        <div class="mapx-toggles">
                            <div class="mapx-view-toggle" id="mapx-view-toggle">
                                <button class="toggle-btn active" data-view="states">States</button>
                                <button class="toggle-btn" data-view="metros">Metros</button>
                            </div>
                            <div class="mapx-metric-toggle" id="mapx-metric-toggle">
                                <button class="toggle-btn active" data-metric="med">Median Wage</button>
                                <button class="toggle-btn" data-metric="avg">Avg Wage</button>
                                <button class="toggle-btn" data-metric="emp">Employment</button>
                            </div>
                        </div>
                    </div>
                    <div id="mapx-table-wrap" class="mapx-table-wrap">
                        <div class="mapx-loading" id="mapx-loading">Loading occupations...</div>
                    </div>
                </div>
                <div class="mapx-map-panel">
                    <div id="mapx-map" class="mapx-map"></div>
                    <div id="mapx-legend" class="mapx-legend"></div>
                </div>
            </div>
        `;

        await initMap();
        initSearch();
        initControls();

        // Deep-link: load occupation if SOC in URL
        if (params?.soc) {
            selectOccupation(params.soc);
        } else {
            loadLanding();
        }
    }

    // ================================================================
    // Map initialization
    // ================================================================
    async function initMap() {
        const mapEl = document.getElementById('mapx-map');
        if (!mapEl) return;
        if (map) { map.remove(); map = null; }

        map = L.map('mapx-map', {
            center: [40, -98],
            zoom: 4,
            zoomControl: true,
            attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 10
        }).addTo(map);

        // Load blank states outline
        const geo = await fetchGeoJSON();
        if (geo) {
            geoLayer = L.geoJSON(geo, {
                style: () => ({
                    fillColor: '#e5e7eb',
                    weight: 1,
                    opacity: 0.6,
                    color: '#d1d5db',
                    fillOpacity: 0.3
                })
            }).addTo(map);
        }
    }

    // ================================================================
    // Landing state — show all occupations
    // ================================================================
    async function loadLanding() {
        const wrap = document.getElementById('mapx-table-wrap');
        const loading = document.getElementById('mapx-loading');
        if (loading) loading.style.display = '';

        nationalData = await OEWSLoader.loadNational();
        if (loading) loading.style.display = 'none';

        if (!nationalData?.occupations) {
            if (wrap) wrap.innerHTML = '<div class="mapx-no-data">Failed to load occupation data.</div>';
            return;
        }

        renderLandingTable(nationalData.occupations);
    }

    function renderLandingTable(occupations, filter = '') {
        const wrap = document.getElementById('mapx-table-wrap');
        if (!wrap) return;

        let rows = Object.entries(occupations).map(([soc, d]) => ({
            soc, title: d.title, emp: d.emp, med: d.med
        }));

        if (filter) {
            const q = filter.toLowerCase();
            rows = rows.filter(r =>
                r.title.toLowerCase().includes(q) ||
                r.soc.toLowerCase().includes(q)
            );
        }

        // Sort
        rows.sort((a, b) => {
            const va = a[sortCol], vb = b[sortCol];
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortAsc ? va - vb : vb - va;
        });

        const sortIcon = (col) => sortCol === col ? (sortAsc ? ' &#9650;' : ' &#9660;') : '';

        wrap.innerHTML = `
            <table class="data-table mapx-table">
                <thead>
                    <tr>
                        <th class="mapx-sortable" data-col="soc">SOC${sortIcon('soc')}</th>
                        <th class="mapx-sortable" data-col="title">Title${sortIcon('title')}</th>
                        <th class="mapx-sortable mapx-num" data-col="emp">Employment${sortIcon('emp')}</th>
                        <th class="mapx-sortable mapx-num" data-col="med">Median Wage${sortIcon('med')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.length === 0 ? '<tr><td colspan="4" class="mapx-no-data">No matching occupations</td></tr>' :
                    rows.map(r => `
                        <tr class="mapx-row-clickable" data-soc="${r.soc}">
                            <td class="mapx-soc">${r.soc}</td>
                            <td>${r.title}</td>
                            <td class="mapx-num">${Formatters.count(r.emp)}</td>
                            <td class="mapx-num">${Formatters.salary(r.med)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Sort click handlers
        wrap.querySelectorAll('.mapx-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (sortCol === col) { sortAsc = !sortAsc; }
                else { sortCol = col; sortAsc = col === 'title' || col === 'soc'; }
                renderLandingTable(occupations, document.getElementById('mapx-search')?.value || '');
            });
        });

        // Row click → select occupation
        wrap.querySelectorAll('.mapx-row-clickable').forEach(tr => {
            tr.addEventListener('click', () => {
                const soc = tr.dataset.soc;
                selectOccupation(soc);
                // Update URL without re-mounting
                history.replaceState(null, '', `#/map/${soc}`);
            });
        });
    }

    // ================================================================
    // Search / filter
    // ================================================================
    function initSearch() {
        const input = document.getElementById('mapx-search');
        if (!input) return;

        let debounce = null;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            debounce = setTimeout(() => {
                const q = input.value.trim();
                if (!currentSOC && nationalData?.occupations) {
                    renderLandingTable(nationalData.occupations, q);
                }
            }, 150);
        });
    }

    // ================================================================
    // Controls (view toggle, metric toggle, clear)
    // ================================================================
    function initControls() {
        // View toggle (States | Metros)
        document.getElementById('mapx-view-toggle')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-view]');
            if (!btn || btn.dataset.view === currentView) return;
            currentView = btn.dataset.view;
            document.querySelectorAll('#mapx-view-toggle .toggle-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.view === currentView)
            );
            if (currentView === 'states' && stateData) renderStatesView();
            else if (currentView === 'metros' && metroData) renderMetrosView();
        });

        // Metric toggle (Median | Avg | Employment)
        document.getElementById('mapx-metric-toggle')?.addEventListener('click', (e) => {
            const btn = e.target.closest('[data-metric]');
            if (!btn || btn.dataset.metric === currentMetric) return;
            currentMetric = btn.dataset.metric;
            document.querySelectorAll('#mapx-metric-toggle .toggle-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.metric === currentMetric)
            );
            sortCol = currentMetric;
            sortAsc = false;
            if (currentView === 'states' && stateData) renderStatesView();
            else if (currentView === 'metros' && metroData) renderMetrosView();
        });

        // Clear button
        document.getElementById('mapx-clear')?.addEventListener('click', () => {
            currentSOC = null;
            stateData = null;
            metroData = null;
            currentView = 'states';
            currentMetric = 'med';
            sortCol = 'med';
            sortAsc = false;

            document.getElementById('mapx-controls').style.display = 'none';
            const input = document.getElementById('mapx-search');
            if (input) { input.value = ''; input.style.display = ''; }

            // Reset toggles
            document.querySelectorAll('#mapx-view-toggle .toggle-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.view === 'states')
            );
            document.querySelectorAll('#mapx-metric-toggle .toggle-btn').forEach(b =>
                b.classList.toggle('active', b.dataset.metric === 'med')
            );

            // Reset map
            resetMap();
            loadLanding();
            history.replaceState(null, '', '#/map');
        });
    }

    // ================================================================
    // Select occupation — main handler
    // ================================================================
    async function selectOccupation(soc) {
        currentSOC = soc;
        currentView = 'states';
        currentMetric = 'med';
        sortCol = 'med';
        sortAsc = false;

        // Show controls, hide search
        document.getElementById('mapx-controls').style.display = '';
        document.getElementById('mapx-search').style.display = 'none';

        // Reset toggles
        document.querySelectorAll('#mapx-view-toggle .toggle-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.view === 'states')
        );
        document.querySelectorAll('#mapx-metric-toggle .toggle-btn').forEach(b =>
            b.classList.toggle('active', b.dataset.metric === 'med')
        );

        const wrap = document.getElementById('mapx-table-wrap');
        if (wrap) wrap.innerHTML = '<div class="mapx-loading">Loading occupation data...</div>';

        // Fetch state + metro data in parallel
        const [byState, byMetro] = await Promise.all([
            OEWSLoader.loadOccupationByState(soc),
            OEWSLoader.loadOccupationByMetro(soc)
        ]);

        stateData = byState;
        metroData = byMetro;

        if (!stateData) {
            if (wrap) wrap.innerHTML = '<div class="mapx-no-data">No data found for this occupation.</div>';
            return;
        }

        // Update header
        const titleEl = document.getElementById('mapx-occ-title');
        if (titleEl) titleEl.textContent = `${stateData.title} (${soc})`;

        renderStatsRow();
        renderStatesView();
    }

    // ================================================================
    // Stats summary row
    // ================================================================
    function renderStatsRow() {
        const statsEl = document.getElementById('mapx-stats');
        if (!statsEl || !stateData) return;

        const states = stateData.states || {};
        const vals = Object.values(states);
        const medVals = vals.map(d => d.med).filter(v => v != null);
        const empTotal = vals.reduce((s, d) => s + (d.emp || 0), 0);

        // Get national median from national data
        let natMed = null;
        if (nationalData?.occupations?.[currentSOC]) {
            natMed = nationalData.occupations[currentSOC].med;
        }

        statsEl.innerHTML = `
            <div class="mapx-stat">
                <span class="mapx-stat-val">${natMed != null ? Formatters.salary(natMed) : '—'}</span>
                <span class="mapx-stat-label">National Median</span>
            </div>
            <div class="mapx-stat">
                <span class="mapx-stat-val">${Formatters.count(empTotal)}</span>
                <span class="mapx-stat-label">Total Employment</span>
            </div>
            <div class="mapx-stat">
                <span class="mapx-stat-val">${medVals.length}</span>
                <span class="mapx-stat-label">States with Data</span>
            </div>
        `;
    }

    // ================================================================
    // States View
    // ================================================================
    function renderStatesView() {
        if (!stateData?.states) return;
        const states = stateData.states;

        let rows = Object.entries(states).map(([fips, d]) => ({
            fips,
            name: Constants.STATE_FIPS_TO_NAME[fips] || fips,
            emp: d.emp,
            med: d.med,
            avg: d.avg
        }));

        rows.sort((a, b) => {
            const va = a[sortCol] ?? (sortCol === 'name' ? a.name : null);
            const vb = b[sortCol] ?? (sortCol === 'name' ? b.name : null);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortAsc ? va - vb : vb - va;
        });

        const sortIcon = (col) => sortCol === col ? (sortAsc ? ' &#9650;' : ' &#9660;') : '';
        const wrap = document.getElementById('mapx-table-wrap');
        if (!wrap) return;

        wrap.innerHTML = `
            <table class="data-table mapx-table">
                <thead>
                    <tr>
                        <th class="mapx-sortable" data-col="name">State${sortIcon('name')}</th>
                        <th class="mapx-sortable mapx-num" data-col="med">Median Wage${sortIcon('med')}</th>
                        <th class="mapx-sortable mapx-num" data-col="avg">Avg Wage${sortIcon('avg')}</th>
                        <th class="mapx-sortable mapx-num" data-col="emp">Employment${sortIcon('emp')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `
                        <tr class="mapx-row-clickable" data-fips="${r.fips}">
                            <td><a href="#/states/${r.fips}" class="mapx-state-link">${r.name}</a></td>
                            <td class="mapx-num">${Formatters.salary(r.med)}</td>
                            <td class="mapx-num">${Formatters.salary(r.avg)}</td>
                            <td class="mapx-num">${Formatters.count(r.emp)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Sort handlers
        wrap.querySelectorAll('.mapx-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (sortCol === col) { sortAsc = !sortAsc; }
                else { sortCol = col; sortAsc = col === 'name'; }
                renderStatesView();
            });
        });

        // Row click → highlight on map
        wrap.querySelectorAll('.mapx-row-clickable').forEach(tr => {
            tr.addEventListener('click', (e) => {
                // Don't intercept link clicks
                if (e.target.closest('a')) return;
                const fips = tr.dataset.fips;
                highlightState(fips);
            });
        });

        // Render choropleth
        renderChoropleth();
    }

    // ================================================================
    // Metros View
    // ================================================================
    function renderMetrosView() {
        if (!metroData?.metros) {
            const wrap = document.getElementById('mapx-table-wrap');
            if (wrap) wrap.innerHTML = '<div class="mapx-no-data">No metro data available for this occupation.</div>';
            clearMapLayers();
            return;
        }

        const metros = metroData.metros;
        let rows = Object.entries(metros).map(([cbsa, d]) => ({
            cbsa,
            name: d.name || cbsa,
            emp: d.emp,
            med: d.med,
            avg: d.avg
        }));

        rows.sort((a, b) => {
            const va = a[sortCol] ?? (sortCol === 'name' ? a.name : null);
            const vb = b[sortCol] ?? (sortCol === 'name' ? b.name : null);
            if (va == null && vb == null) return 0;
            if (va == null) return 1;
            if (vb == null) return -1;
            if (typeof va === 'string') return sortAsc ? va.localeCompare(vb) : vb.localeCompare(va);
            return sortAsc ? va - vb : vb - va;
        });

        const sortIcon = (col) => sortCol === col ? (sortAsc ? ' &#9650;' : ' &#9660;') : '';
        const wrap = document.getElementById('mapx-table-wrap');
        if (!wrap) return;

        wrap.innerHTML = `
            <table class="data-table mapx-table">
                <thead>
                    <tr>
                        <th class="mapx-sortable" data-col="name">Metro Area${sortIcon('name')}</th>
                        <th class="mapx-sortable mapx-num" data-col="med">Median Wage${sortIcon('med')}</th>
                        <th class="mapx-sortable mapx-num" data-col="avg">Avg Wage${sortIcon('avg')}</th>
                        <th class="mapx-sortable mapx-num" data-col="emp">Employment${sortIcon('emp')}</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(r => `
                        <tr class="mapx-row-clickable" data-cbsa="${r.cbsa}">
                            <td>${r.name}</td>
                            <td class="mapx-num">${Formatters.salary(r.med)}</td>
                            <td class="mapx-num">${Formatters.salary(r.avg)}</td>
                            <td class="mapx-num">${Formatters.count(r.emp)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Sort handlers
        wrap.querySelectorAll('.mapx-sortable').forEach(th => {
            th.addEventListener('click', () => {
                const col = th.dataset.col;
                if (sortCol === col) { sortAsc = !sortAsc; }
                else { sortCol = col; sortAsc = col === 'name'; }
                renderMetrosView();
            });
        });

        // Row click → pan map to metro
        wrap.querySelectorAll('.mapx-row-clickable').forEach(tr => {
            tr.addEventListener('click', () => {
                const cbsa = tr.dataset.cbsa;
                highlightMetro(cbsa);
            });
        });

        // Render circle markers
        renderMetroMarkers();
    }

    // ================================================================
    // Choropleth rendering (States view)
    // ================================================================
    async function renderChoropleth() {
        clearMapLayers();
        const geo = await fetchGeoJSON();
        if (!geo || !stateData?.states) return;

        const states = stateData.states;
        const metric = currentMetric;
        const values = Object.values(states).map(d => d[metric]).filter(v => v != null && !isNaN(v));
        if (values.length === 0) return;

        const min = Math.min(...values);
        const max = Math.max(...values);

        geoLayer = L.geoJSON(geo, {
            style: (feature) => {
                const stateName = feature.properties.name;
                const fips = Constants.STATE_NAME_TO_FIPS[stateName];
                const d = fips ? states[fips] : null;
                const val = d?.[metric];

                let fillColor = '#e5e7eb';
                if (val != null && max > min) {
                    const t = (val - min) / (max - min);
                    fillColor = colorScale(t);
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
                const d = fips ? states[fips] : null;
                const val = d?.[metric];

                const metricLabel = metric === 'emp' ? 'Employment' : metric === 'avg' ? 'Avg Wage' : 'Median Wage';
                const formatted = metric === 'emp' ? Formatters.count(val) : Formatters.salary(val);

                layer.bindTooltip(
                    `<strong>${stateName}</strong><br>${metricLabel}: ${formatted}`,
                    { sticky: true, className: 'map-tip' }
                );

                layer.on({
                    mouseover: (e) => {
                        e.target.setStyle({ weight: 2, color: '#dc2626' });
                        e.target.bringToFront();
                    },
                    mouseout: (e) => {
                        geoLayer.resetStyle(e.target);
                    },
                    click: () => {
                        highlightState(fips);
                        scrollTableToRow(fips);
                    }
                });
            }
        }).addTo(map);

        map.fitBounds(geoLayer.getBounds(), { padding: [10, 10] });
        renderLegend(metric, min, max);
    }

    // ================================================================
    // Metro markers rendering
    // ================================================================
    function renderMetroMarkers() {
        clearMapLayers();
        if (!metroData?.metros) return;

        const metros = metroData.metros;
        const metric = currentMetric;
        const values = Object.values(metros).map(d => d[metric]).filter(v => v != null);
        if (values.length === 0) return;

        const min = Math.min(...values);
        const max = Math.max(...values);
        const empValues = Object.values(metros).map(d => d.emp).filter(v => v != null);
        const maxEmp = Math.max(...empValues, 1);

        markerLayer = L.layerGroup();

        for (const [cbsa, d] of Object.entries(metros)) {
            const coords = Constants.METRO_COORDS?.[cbsa];
            if (!coords) continue;

            const val = d[metric];
            if (val == null) continue;

            const t = max > min ? (val - min) / (max - min) : 0.5;
            const radius = 4 + Math.sqrt((d.emp || 0) / maxEmp) * 20;

            const marker = L.circleMarker([coords.lat, coords.lng], {
                radius,
                fillColor: colorScale(t),
                color: '#666',
                weight: 1,
                fillOpacity: 0.75
            });

            const metricLabel = metric === 'emp' ? 'Employment' : metric === 'avg' ? 'Avg Wage' : 'Median Wage';
            const formatted = metric === 'emp' ? Formatters.count(val) : Formatters.salary(val);

            marker.bindTooltip(
                `<strong>${d.name}</strong><br>${metricLabel}: ${formatted}<br>Employment: ${Formatters.count(d.emp)}`,
                { sticky: true, className: 'map-tip' }
            );

            marker.on('click', () => {
                scrollTableToRow(cbsa);
            });

            marker.cbsa = cbsa;
            markerLayer.addLayer(marker);
        }

        markerLayer.addTo(map);

        // Also draw light state outlines for context
        fetchGeoJSON().then(geo => {
            if (!geo) return;
            geoLayer = L.geoJSON(geo, {
                style: () => ({
                    fillColor: '#f0f0f0',
                    weight: 1,
                    opacity: 0.5,
                    color: '#d1d5db',
                    fillOpacity: 0.2
                })
            }).addTo(map);
            if (geoLayer) geoLayer.bringToBack();
        });

        map.setView([40, -98], 4);
        renderLegend(metric, min, max);
    }

    // ================================================================
    // Highlight helpers
    // ================================================================
    function highlightState(fips) {
        if (!geoLayer || !fips) return;
        const stateName = Constants.STATE_FIPS_TO_NAME[fips];
        if (!stateName) return;

        geoLayer.eachLayer(layer => {
            const name = layer.feature?.properties?.name;
            if (name === stateName) {
                map.fitBounds(layer.getBounds(), { padding: [40, 40], maxZoom: 7 });
                layer.openPopup();
            }
        });

        // Highlight table row
        document.querySelectorAll('.mapx-row-active').forEach(r => r.classList.remove('mapx-row-active'));
        const row = document.querySelector(`tr[data-fips="${fips}"]`);
        if (row) {
            row.classList.add('mapx-row-active');
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function highlightMetro(cbsa) {
        if (!cbsa) return;
        const coords = Constants.METRO_COORDS?.[cbsa];
        if (coords) {
            map.setView([coords.lat, coords.lng], 7, { animate: true });
        }

        // Find and open marker popup
        if (markerLayer) {
            markerLayer.eachLayer(layer => {
                if (layer.cbsa === cbsa) {
                    layer.openTooltip();
                }
            });
        }

        // Highlight table row
        document.querySelectorAll('.mapx-row-active').forEach(r => r.classList.remove('mapx-row-active'));
        const row = document.querySelector(`tr[data-cbsa="${cbsa}"]`);
        if (row) {
            row.classList.add('mapx-row-active');
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    function scrollTableToRow(id) {
        // Highlight table row by fips or cbsa
        document.querySelectorAll('.mapx-row-active').forEach(r => r.classList.remove('mapx-row-active'));
        const row = document.querySelector(`tr[data-fips="${id}"], tr[data-cbsa="${id}"]`);
        if (row) {
            row.classList.add('mapx-row-active');
            row.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    }

    // ================================================================
    // Color scale & legend
    // ================================================================
    function colorScale(t) {
        // Blue (#dbeafe) → Green (#16a34a) interpolation
        const r = Math.round(219 + t * (22 - 219));
        const g = Math.round(234 + t * (163 - 234));
        const b = Math.round(254 + t * (74 - 254));
        return `rgb(${r},${g},${b})`;
    }

    function renderLegend(metric, min, max) {
        const legend = document.getElementById('mapx-legend');
        if (!legend) return;

        const label = metric === 'emp' ? 'Employment' : metric === 'avg' ? 'Average Wage' : 'Median Wage';
        const fmt = (v) => metric === 'emp' ? Formatters.count(v) : Formatters.salary(v);

        const steps = 5;
        const swatches = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const val = min + t * (max - min);
            swatches.push(`<span class="mapx-legend-swatch" style="background:${colorScale(t)}"></span>`);
            if (i === 0 || i === steps) {
                swatches.push(`<span class="mapx-legend-label">${fmt(val)}</span>`);
            }
        }

        legend.innerHTML = `
            <div class="mapx-legend-title">${label}</div>
            <div class="mapx-legend-bar">
                <span class="mapx-legend-label">${fmt(min)}</span>
                <div class="mapx-legend-gradient"></div>
                <span class="mapx-legend-label">${fmt(max)}</span>
            </div>
        `;

        // Set gradient via CSS
        const gradient = legend.querySelector('.mapx-legend-gradient');
        if (gradient) {
            const colors = [];
            for (let i = 0; i <= 10; i++) {
                colors.push(colorScale(i / 10));
            }
            gradient.style.background = `linear-gradient(to right, ${colors.join(', ')})`;
        }
    }

    // ================================================================
    // Map cleanup helpers
    // ================================================================
    function clearMapLayers() {
        if (geoLayer && map) { map.removeLayer(geoLayer); geoLayer = null; }
        if (markerLayer && map) { map.removeLayer(markerLayer); markerLayer = null; }
        const legend = document.getElementById('mapx-legend');
        if (legend) legend.innerHTML = '';
    }

    function resetMap() {
        clearMapLayers();
        if (!map) return;
        map.setView([40, -98], 4);

        // Redraw blank outline
        fetchGeoJSON().then(geo => {
            if (!geo) return;
            geoLayer = L.geoJSON(geo, {
                style: () => ({
                    fillColor: '#e5e7eb',
                    weight: 1,
                    opacity: 0.6,
                    color: '#d1d5db',
                    fillOpacity: 0.3
                })
            }).addTo(map);
        });
    }

    // ================================================================
    // Unmount
    // ================================================================
    function unmount() {
        if (map) {
            map.remove();
            map = null;
            geoLayer = null;
            markerLayer = null;
        }
        geoCache = null;
        currentSOC = null;
        stateData = null;
        metroData = null;
        nationalData = null;
    }

    return { getTitle, mount, unmount };
})();

window.MapExplorerPage = MapExplorerPage;
