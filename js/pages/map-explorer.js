/**
 * LaborCompare — Map Explorer Page
 * 3-panel layout: left sidebar (controls/legend) | center map | right sidebar (state detail)
 * Route: #/map
 */

const MapExplorerPage = (() => {
    let map = null;
    let geoLayer = null;
    let currentData = null;
    let geoData = null;
    let currentField = 'median_household_income';
    let selectedOccupation = null;
    let selectedState = null;

    function getTitle() {
        return 'Map Explorer';
    }

    async function mount(params, container) {
        await loadLeaflet();

        container.innerHTML = `
            <div class="map-3col">
                <!-- Left Sidebar -->
                <aside class="map-sidebar map-sidebar-left">
                    <div class="map-panel">
                        <div class="map-panel-section">
                            <label class="map-panel-label">Data</label>
                            <select id="map-field-select" class="select-input">
                                <optgroup label="Wages & Income">
                                    <option value="median_household_income" selected>Median Household Income</option>
                                    <option value="median_earnings">Median Earnings</option>
                                    <option value="per_capita_income">Per Capita Income</option>
                                    <option value="avg_hourly_earnings">Avg Hourly Earnings</option>
                                    <option value="avg_weekly_earnings">Avg Weekly Earnings</option>
                                </optgroup>
                                <optgroup label="Employment">
                                    <option value="unemployment_rate">Unemployment Rate</option>
                                    <option value="labor_force_participation_rate">Labor Force Participation</option>
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

                        <div class="map-panel-section">
                            <label class="map-panel-label">Occupation Overlay</label>
                            <div class="map-occ-search">
                                <input type="text"
                                       id="map-occ-search"
                                       class="filter-input"
                                       placeholder="Search occupation..."
                                       autocomplete="off">
                                <div class="search-dropdown" id="map-occ-dropdown"></div>
                            </div>
                            <button id="map-clear-occ" class="btn-small btn-muted" style="display: none; margin-top: 6px; width: 100%;">Clear Overlay</button>
                        </div>
                    </div>

                    <div class="map-panel">
                        <label class="map-panel-label">Legend</label>
                        <div id="map-legend"></div>
                    </div>

                    <div class="map-panel">
                        <label class="map-panel-label">National Overview</label>
                        <div id="map-stats" class="map-stats-grid"></div>
                    </div>
                </aside>

                <!-- Center Map -->
                <div class="map-center">
                    <div id="explorer-map" class="explorer-map-full"></div>
                    <div class="map-loading" id="map-loading">
                        <div class="map-spinner"></div>
                        <span>Loading map data...</span>
                    </div>
                </div>

                <!-- Right Sidebar -->
                <aside class="map-sidebar map-sidebar-right">
                    <div class="map-panel map-info-panel">
                        <div class="map-info-header" id="map-info-header">
                            <span class="map-info-location">Select a State</span>
                        </div>
                        <div class="map-info-body" id="map-info-body">
                            <p class="map-hint-text">Click on any state to see detailed information.</p>
                        </div>
                    </div>
                </aside>
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

        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 10
        }).addTo(map);

        const [stateEcon, geo] = await Promise.all([
            OEWSLoader.loadStateEconomic(),
            OEWSLoader.loadStatesGeoJSON()
        ]);

        const loading = document.getElementById('map-loading');
        if (loading) loading.style.display = 'none';

        if (!geo || !stateEcon) return;
        currentData = stateEcon;
        geoData = geo;

        renderChoropleth(geo, stateEcon, currentField);
        renderNationalStats(stateEcon);
    }

    function renderChoropleth(geo, data, field) {
        if (geoLayer) {
            map.removeLayer(geoLayer);
            geoLayer = null;
        }

        const values = Object.values(data)
            .map(d => d[field])
            .filter(v => v != null && !isNaN(v));

        if (values.length === 0) {
            renderLegend(field, 0, 0, false);
            return;
        }

        const min = Math.min(...values);
        const max = Math.max(...values);
        const invertScale = ['unemployment_rate', 'poverty_rate', 'gini_index'].includes(field);

        geoLayer = L.geoJSON(geo, {
            style: (feature) => {
                const stateName = feature.properties.name;
                const stateData = data[stateName];
                const val = stateData?.[field];

                let fillColor = '#e5e7eb';
                if (val != null && max > min) {
                    let t = (val - min) / (max - min);
                    if (invertScale) t = 1 - t;
                    fillColor = interpolateColor(t);
                }

                const isSelected = selectedState === stateName;
                return {
                    fillColor,
                    weight: isSelected ? 2.5 : 1,
                    opacity: 0.8,
                    color: isSelected ? '#dc2626' : '#d1d5db',
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
                        if (selectedState !== stateName) {
                            e.target.setStyle({ weight: 2, color: '#dc2626' });
                            e.target.bringToFront();
                        }
                    },
                    mouseout: (e) => {
                        if (selectedState !== stateName) {
                            geoLayer.resetStyle(e.target);
                        }
                    },
                    click: () => {
                        selectedState = stateName;
                        updateInfoPanel(stateName, stateData, field, data);
                        // Re-render to highlight selected
                        if (geoData && currentData) {
                            if (selectedOccupation) return; // Don't re-render during occupation overlay
                            renderChoropleth(geoData, currentData, currentField);
                        }
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

                let fillColor = '#e5e7eb';
                if (val != null && max > min) {
                    const t = (val - min) / (max - min);
                    fillColor = interpolateColor(t);
                }

                const isSelected = selectedState === stateName;
                return {
                    fillColor,
                    weight: isSelected ? 2.5 : 1,
                    opacity: 0.8,
                    color: isSelected ? '#dc2626' : '#d1d5db',
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
                        if (selectedState !== stateName) {
                            e.target.setStyle({ weight: 2, color: '#dc2626' });
                            e.target.bringToFront();
                        }
                    },
                    mouseout: (e) => {
                        if (selectedState !== stateName) {
                            geoLayer.resetStyle(e.target);
                        }
                    },
                    click: () => {
                        selectedState = stateName;
                        // Show occupation wage detail in right panel
                        updateOccInfoPanel(stateName, data, occData.title);
                    }
                });
            }
        }).addTo(map);

        renderLegend('med', min, max, false, occData.title);
    }

    function interpolateColor(t) {
        // Blue (#dbeafe) to red (#dc2626) — matches accent color
        const r = Math.round(219 + t * (220 - 219));
        const g = Math.round(234 + t * (38 - 234));
        const b = Math.round(254 + t * (38 - 254));
        return `rgb(${r},${g},${b})`;
    }

    function renderLegend(field, min, max, invert, overlayTitle) {
        const legend = document.getElementById('map-legend');
        if (!legend) return;

        if (min === 0 && max === 0) {
            legend.innerHTML = '<div class="map-no-data">No data available for this metric</div>';
            return;
        }

        const label = overlayTitle
            ? `${overlayTitle} — Median Salary`
            : getFieldLabel(field);

        const steps = 5;
        const swatches = [];
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const val = min + t * (max - min);
            const color = interpolateColor(invert ? 1 - t : t);
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

    function updateInfoPanel(stateName, data, field, allData) {
        const header = document.getElementById('map-info-header');
        const body = document.getElementById('map-info-body');
        if (!header || !body || !data) return;

        const fips = Constants.STATE_NAME_TO_FIPS[stateName];
        const val = data[field];

        // Compute rank
        const allValues = Object.entries(allData)
            .filter(([, d]) => d[field] != null && !isNaN(d[field]))
            .sort((a, b) => b[1][field] - a[1][field]);
        const rank = allValues.findIndex(([name]) => name === stateName) + 1;
        const total = allValues.length;

        // Highest and lowest
        const highest = allValues[0];
        const lowest = allValues[allValues.length - 1];

        header.innerHTML = `
            <span class="map-info-location">${stateName}</span>
            ${fips ? `<a href="#/states/${fips}" class="map-info-link">View Full Profile &rarr;</a>` : ''}
        `;

        body.innerHTML = `
            <div class="map-info-value-large">${Formatters.auto(val, field)}</div>
            <div class="map-info-metric">${getFieldLabel(field)}</div>
            ${rank ? `<div class="map-info-rank">#${rank} of ${total}</div>` : ''}

            <div class="map-info-divider"></div>

            <div class="map-info-comparison">
                <div class="map-info-comp-row">
                    <span class="map-info-comp-label">Highest</span>
                    <span class="map-info-comp-value">${highest ? `${highest[0]}: ${Formatters.auto(highest[1][field], field)}` : '—'}</span>
                </div>
                <div class="map-info-comp-row">
                    <span class="map-info-comp-label">Lowest</span>
                    <span class="map-info-comp-value">${lowest ? `${lowest[0]}: ${Formatters.auto(lowest[1][field], field)}` : '—'}</span>
                </div>
            </div>

            <div class="map-info-divider"></div>

            <div class="map-info-stats">
                ${statRow('Population', Formatters.count(data.population))}
                ${statRow('Median HH Income', Formatters.salary(data.median_household_income))}
                ${statRow('Per Capita Income', Formatters.salary(data.per_capita_income))}
                ${statRow('Poverty Rate', data.poverty_rate != null ? data.poverty_rate.toFixed(1) + '%' : '—')}
                ${statRow('Median Age', data.median_age != null ? data.median_age.toFixed(1) : '—')}
                ${statRow("Bachelor's+", data.bachelors_or_higher_pct != null ? data.bachelors_or_higher_pct.toFixed(1) + '%' : '—')}
            </div>
        `;
    }

    function updateOccInfoPanel(stateName, occStateData, occTitle) {
        const header = document.getElementById('map-info-header');
        const body = document.getElementById('map-info-body');
        if (!header || !body) return;

        const fips = Constants.STATE_NAME_TO_FIPS[stateName];

        header.innerHTML = `
            <span class="map-info-location">${stateName}</span>
            ${fips ? `<a href="#/states/${fips}" class="map-info-link">View Full Profile &rarr;</a>` : ''}
        `;

        if (!occStateData) {
            body.innerHTML = '<p class="map-hint-text">No wage data available for this occupation in this state.</p>';
            return;
        }

        body.innerHTML = `
            <div class="map-info-occ-title">${occTitle || 'Occupation'}</div>
            <div class="map-info-value-large">${Formatters.salary(occStateData.med)}</div>
            <div class="map-info-metric">Median Annual Salary</div>

            <div class="map-info-divider"></div>

            <div class="map-info-stats">
                ${statRow('Hourly (Median)', Formatters.hourly(occStateData.medHr))}
                ${statRow('10th Percentile', Formatters.salary(occStateData.p10))}
                ${statRow('25th Percentile', Formatters.salary(occStateData.p25))}
                ${statRow('75th Percentile', Formatters.salary(occStateData.p75))}
                ${statRow('90th Percentile', Formatters.salary(occStateData.p90))}
                ${statRow('Employment', occStateData.emp ? Formatters.count(occStateData.emp) : '—')}
            </div>
        `;
    }

    function statRow(label, value) {
        return `
            <div class="map-info-stat-row">
                <span class="map-info-stat-label">${label}</span>
                <span class="map-info-stat-value">${value || '—'}</span>
            </div>
        `;
    }

    function renderNationalStats(data) {
        const stats = document.getElementById('map-stats');
        if (!stats) return;

        const allVals = Object.values(data);
        const median = (arr) => {
            const sorted = arr.filter(v => v != null).sort((a, b) => a - b);
            if (sorted.length === 0) return null;
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
        };

        const medIncome = median(allVals.map(d => d.median_household_income));
        const medPCI = median(allVals.map(d => d.per_capita_income));
        const medPoverty = median(allVals.map(d => d.poverty_rate));
        const totalPop = allVals.reduce((s, d) => s + (d.population || 0), 0);

        stats.innerHTML = `
            <div class="map-stat-item">
                <span class="map-stat-val">${totalPop ? Formatters.count(totalPop) : '—'}</span>
                <span class="map-stat-label">Total Population</span>
            </div>
            <div class="map-stat-item">
                <span class="map-stat-val">${medIncome ? Formatters.salary(medIncome) : '—'}</span>
                <span class="map-stat-label">Median HH Income</span>
            </div>
            <div class="map-stat-item">
                <span class="map-stat-val">${medPCI ? Formatters.salary(medPCI) : '—'}</span>
                <span class="map-stat-label">Per Capita Income</span>
            </div>
            <div class="map-stat-item">
                <span class="map-stat-val">${medPoverty != null ? medPoverty.toFixed(1) + '%' : '—'}</span>
                <span class="map-stat-label">Median Poverty Rate</span>
            </div>
        `;
    }

    function initControls() {
        // Field selector
        const fieldSelect = document.getElementById('map-field-select');
        fieldSelect?.addEventListener('change', async () => {
            currentField = fieldSelect.value;
            selectedOccupation = null;
            selectedState = null;
            document.getElementById('map-clear-occ').style.display = 'none';
            document.getElementById('map-occ-search').value = '';
            resetInfoPanel();

            if (geoData && currentData) {
                renderChoropleth(geoData, currentData, currentField);
            }
        });

        // Occupation search overlay
        const occInput = document.getElementById('map-occ-search');
        const occDropdown = document.getElementById('map-occ-dropdown');
        if (occInput && occDropdown) {
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

                            const [occData, geo] = await Promise.all([
                                OEWSLoader.loadOccupationByState(soc),
                                OEWSLoader.loadStatesGeoJSON()
                            ]);
                            if (occData && geo) {
                                selectedOccupation = soc;
                                selectedState = null;
                                resetInfoPanel();
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
            selectedState = null;
            document.getElementById('map-occ-search').value = '';
            document.getElementById('map-clear-occ').style.display = 'none';
            resetInfoPanel();

            if (geoData && currentData) {
                renderChoropleth(geoData, currentData, currentField);
            }
        });
    }

    function resetInfoPanel() {
        const header = document.getElementById('map-info-header');
        const body = document.getElementById('map-info-body');
        if (header) header.innerHTML = '<span class="map-info-location">Select a State</span>';
        if (body) body.innerHTML = '<p class="map-hint-text">Click on any state to see detailed information.</p>';
    }

    function unmount() {
        if (map) {
            map.remove();
            map = null;
            geoLayer = null;
            geoData = null;
        }
        selectedOccupation = null;
        selectedState = null;
    }

    return { getTitle, mount, unmount };
})();

window.MapExplorerPage = MapExplorerPage;
