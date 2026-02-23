/**
 * LaborCompare — Map Explorer Page
 * Choropleth map with occupation wage overlay.
 * Route: #/map
 */

const MapExplorerPage = (() => {
    let map = null;
    let geoLayer = null;
    let currentData = null;
    let currentField = 'unemployment_rate';
    let selectedOccupation = null;

    function getTitle() {
        return 'Map Explorer';
    }

    async function mount(params, container) {
        container.innerHTML = `
            <div class="map-page">
                <div class="map-controls-bar">
                    <div class="map-control-group">
                        <label class="map-control-label">Data</label>
                        <select id="map-field-select" class="select-input select-compact">
                            <optgroup label="Employment">
                                <option value="unemployment_rate" selected>Unemployment Rate</option>
                                <option value="labor_force_participation_rate">Labor Force Participation</option>
                            </optgroup>
                            <optgroup label="Wages & Income">
                                <option value="avg_hourly_earnings">Avg Hourly Earnings</option>
                                <option value="avg_weekly_earnings">Avg Weekly Earnings</option>
                                <option value="median_household_income">Median Household Income</option>
                                <option value="median_earnings">Median Earnings</option>
                                <option value="per_capita_income">Per Capita Income</option>
                            </optgroup>
                            <optgroup label="Demographics">
                                <option value="population">Population</option>
                                <option value="poverty_rate">Poverty Rate</option>
                                <option value="median_age">Median Age</option>
                            </optgroup>
                            <optgroup label="Education">
                                <option value="bachelors_or_higher_pct">Bachelor's Degree+</option>
                                <option value="hs_diploma_or_higher_pct">HS Diploma+</option>
                            </optgroup>
                            <optgroup label="Economic">
                                <option value="gini_index">Gini Index</option>
                                <option value="homeownership_rate">Homeownership Rate</option>
                            </optgroup>
                        </select>
                    </div>

                    <div class="map-control-group">
                        <label class="map-control-label">Occupation Overlay</label>
                        <div class="map-occ-search">
                            <input type="text"
                                   id="map-occ-search"
                                   class="filter-input"
                                   placeholder="Search an occupation to overlay wages..."
                                   autocomplete="off">
                            <div class="search-dropdown" id="map-occ-dropdown"></div>
                        </div>
                        <button id="map-clear-occ" class="btn-small btn-muted" style="display: none;">Clear Overlay</button>
                    </div>
                </div>

                <div class="map-main-wrapper">
                    <div id="explorer-map" class="explorer-map"></div>
                    <div class="map-legend-panel" id="map-legend"></div>
                </div>

                <div class="map-info-bar" id="map-info-bar">
                    <span class="hint-text">Click a state to view its full profile</span>
                </div>
            </div>
        `;

        await initMap();
        initControls();
    }

    async function initMap() {
        const mapEl = document.getElementById('explorer-map');
        if (!mapEl) return;

        if (map) { map.remove(); map = null; }

        map = L.map('explorer-map', {
            center: [40, -98],
            zoom: 4,
            zoomControl: true,
            attributionControl: false
        });

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png', {
            maxZoom: 10
        }).addTo(map);

        // Load state data and GeoJSON
        const [stateEcon, geo] = await Promise.all([
            OEWSLoader.loadStateEconomic(),
            OEWSLoader.loadStatesGeoJSON()
        ]);

        if (!geo || !stateEcon) return;
        currentData = stateEcon;

        renderChoropleth(geo, stateEcon, currentField);
    }

    function renderChoropleth(geo, data, field) {
        if (geoLayer) {
            map.removeLayer(geoLayer);
            geoLayer = null;
        }

        // Calculate min/max for this field
        const values = Object.values(data)
            .map(d => d[field])
            .filter(v => v != null && !isNaN(v));

        if (values.length === 0) return;

        const min = Math.min(...values);
        const max = Math.max(...values);

        // Determine if higher = worse (like unemployment, poverty)
        const invertScale = ['unemployment_rate', 'poverty_rate', 'gini_index'].includes(field);

        geoLayer = L.geoJSON(geo, {
            style: (feature) => {
                const stateName = feature.properties.name;
                const stateData = data[stateName];
                const val = stateData?.[field];

                let fillColor = '#1a1a2e';
                if (val != null && max > min) {
                    let t = (val - min) / (max - min);
                    if (invertScale) t = 1 - t;
                    fillColor = interpolateBlueGold(t);
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
                const stateData = data[stateName];
                const val = stateData?.[field];

                layer.bindTooltip(
                    `<strong>${stateName}</strong><br>${Formatters.auto(val, field)}`,
                    { sticky: true, className: 'map-tip' }
                );

                layer.on({
                    mouseover: (e) => {
                        e.target.setStyle({ weight: 2, color: '#f59e0b' });
                        e.target.bringToFront();
                        updateInfoBar(stateName, stateData, field);
                    },
                    mouseout: (e) => {
                        geoLayer.resetStyle(e.target);
                    },
                    click: () => {
                        const fips = Constants.STATE_NAME_TO_FIPS[stateName];
                        if (fips) Router.navigate(`/area/${fips}`);
                    }
                });
            }
        }).addTo(map);

        renderLegend(field, min, max, invertScale);
    }

    function renderOccupationOverlay(geo, occData) {
        if (geoLayer) {
            map.removeLayer(geoLayer);
            geoLayer = null;
        }

        const states = occData.states || {};
        const values = Object.values(states).map(d => d.med).filter(v => v != null);
        if (values.length === 0) return;

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
                    fillColor = interpolateBlueGold(t);
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

                layer.bindTooltip(
                    `<strong>${stateName}</strong><br>${Formatters.salary(data?.med)}`,
                    { sticky: true, className: 'map-tip' }
                );

                layer.on({
                    mouseover: (e) => {
                        e.target.setStyle({ weight: 2, color: '#f59e0b' });
                        e.target.bringToFront();
                    },
                    mouseout: (e) => geoLayer.resetStyle(e.target),
                    click: () => {
                        if (fips) Router.navigate(`/area/${fips}`);
                    }
                });
            }
        }).addTo(map);

        renderLegend('med', min, max, false, occData.title);
    }

    function interpolateBlueGold(t) {
        const r = Math.round(30 + t * (245 - 30));
        const g = Math.round(58 + t * (158 - 58));
        const b = Math.round(95 + t * (11 - 95));
        return `rgb(${r},${g},${b})`;
    }

    function renderLegend(field, min, max, invert, overlayTitle) {
        const legend = document.getElementById('map-legend');
        if (!legend) return;

        const label = overlayTitle
            ? `${overlayTitle} — Median Salary`
            : getFieldLabel(field);

        const steps = 5;
        const swatches = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const val = min + t * (max - min);
            const color = interpolateBlueGold(invert ? 1 - t : t);
            swatches.push(`
                <div class="legend-step">
                    <span class="legend-swatch" style="background: ${color}"></span>
                    <span class="legend-val">${Formatters.auto(val, field)}</span>
                </div>
            `);
        }

        legend.innerHTML = `
            <div class="legend-title">${label}</div>
            <div class="legend-scale">${swatches.join('')}</div>
        `;
    }

    function getFieldLabel(field) {
        const labels = {
            'unemployment_rate': 'Unemployment Rate',
            'labor_force_participation_rate': 'Labor Force Participation',
            'avg_hourly_earnings': 'Avg Hourly Earnings',
            'avg_weekly_earnings': 'Avg Weekly Earnings',
            'median_household_income': 'Median Household Income',
            'median_earnings': 'Median Earnings',
            'per_capita_income': 'Per Capita Income',
            'population': 'Population',
            'poverty_rate': 'Poverty Rate',
            'median_age': 'Median Age',
            'bachelors_or_higher_pct': "Bachelor's Degree or Higher",
            'hs_diploma_or_higher_pct': 'HS Diploma or Higher',
            'gini_index': 'Gini Index',
            'homeownership_rate': 'Homeownership Rate'
        };
        return labels[field] || field;
    }

    function updateInfoBar(stateName, data, field) {
        const bar = document.getElementById('map-info-bar');
        if (!bar || !data) return;
        bar.innerHTML = `
            <strong>${stateName}</strong>: ${Formatters.auto(data[field], field)}
            ${data.population ? ` · Pop: ${Formatters.count(data.population)}` : ''}
        `;
    }

    function initControls() {
        // Field selector
        const fieldSelect = document.getElementById('map-field-select');
        fieldSelect?.addEventListener('change', async () => {
            currentField = fieldSelect.value;
            selectedOccupation = null;
            document.getElementById('map-clear-occ').style.display = 'none';
            document.getElementById('map-occ-search').value = '';

            const geo = await OEWSLoader.loadStatesGeoJSON();
            if (geo && currentData) {
                renderChoropleth(geo, currentData, currentField);
            }
        });

        // Occupation search overlay
        const occInput = document.getElementById('map-occ-search');
        const occDropdown = document.getElementById('map-occ-dropdown');
        if (occInput && occDropdown) {
            // Custom search that only returns occupations
            let debounce = null;
            occInput.addEventListener('focus', () => Search.loadIndex());
            occInput.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(async () => {
                    const q = occInput.value.trim();
                    if (q.length < 2) {
                        occDropdown.classList.remove('visible');
                        return;
                    }
                    const results = Search.search(q, 8).filter(r => r.type === 'occupation');
                    if (results.length === 0) {
                        occDropdown.innerHTML = '<div class="search-no-results">No occupations found</div>';
                        occDropdown.classList.add('visible');
                        return;
                    }
                    occDropdown.innerHTML = results.map((r, i) => `
                        <div class="search-result" data-idx="${i}" data-soc="${r.id}">
                            <div class="search-result-text">
                                <span class="search-result-title">${r.title}</span>
                                <span class="search-result-subtitle">${r.subtitle}</span>
                            </div>
                        </div>
                    `).join('');
                    occDropdown.classList.add('visible');

                    occDropdown.querySelectorAll('.search-result').forEach(el => {
                        el.addEventListener('click', async () => {
                            const soc = el.dataset.soc;
                            occInput.value = el.querySelector('.search-result-title').textContent;
                            occDropdown.classList.remove('visible');

                            // Load and overlay
                            const [occData, geo] = await Promise.all([
                                OEWSLoader.loadOccupationByState(soc),
                                OEWSLoader.loadStatesGeoJSON()
                            ]);
                            if (occData && geo) {
                                selectedOccupation = soc;
                                renderOccupationOverlay(geo, occData);
                                document.getElementById('map-clear-occ').style.display = '';
                            }
                        });
                    });
                }, 150);
            });

            document.addEventListener('click', (e) => {
                if (!occInput.contains(e.target) && !occDropdown.contains(e.target)) {
                    occDropdown.classList.remove('visible');
                }
            });
        }

        // Clear overlay button
        document.getElementById('map-clear-occ')?.addEventListener('click', async () => {
            selectedOccupation = null;
            document.getElementById('map-occ-search').value = '';
            document.getElementById('map-clear-occ').style.display = 'none';

            const geo = await OEWSLoader.loadStatesGeoJSON();
            if (geo && currentData) {
                renderChoropleth(geo, currentData, currentField);
            }
        });
    }

    function unmount() {
        if (map) {
            map.remove();
            map = null;
            geoLayer = null;
        }
        selectedOccupation = null;
    }

    return { getTitle, mount, unmount };
})();

window.MapExplorerPage = MapExplorerPage;
