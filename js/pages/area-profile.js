/**
 * LaborCompare — Area Profile Page
 * Shows employment, wages, and top occupations for a state or metro.
 * Route: #/area/{fips}
 */

const AreaProfilePage = (() => {
    function getTitle(params) {
        const name = Constants.STATE_FIPS_TO_NAME[params?.fips];
        return name ? `${name} Labor Market` : 'Area Profile';
    }

    async function mount(params, container) {
        const fips = params.fips;
        if (!fips) {
            container.innerHTML = '<div class="page-error"><h2>No area specified</h2><a href="#/">Back to Home</a></div>';
            return;
        }

        container.innerHTML = `
            <div class="area-page">
                <div class="page-loading"><div class="loader"></div><span>Loading area data...</span></div>
            </div>
        `;

        // Determine if this is a state or metro area
        const isState = fips.length === 2 || Constants.STATE_FIPS_TO_NAME[fips];

        let areaData, econData, areaName;

        if (isState) {
            const [oewsData, stateEcon] = await Promise.all([
                OEWSLoader.loadStateArea(fips),
                OEWSLoader.loadStateEconomic()
            ]);
            areaData = oewsData;
            areaName = Constants.STATE_FIPS_TO_NAME[fips] || fips;
            // Get economic data for this state
            econData = stateEcon?.[areaName] || null;
        } else {
            areaData = await OEWSLoader.loadMetroArea(fips);
            areaName = areaData?.name || fips;
        }

        if (!areaData?.occupations || Object.keys(areaData.occupations).length === 0) {
            container.innerHTML = `
                <div class="page-error">
                    <h2>Area data not available</h2>
                    <p>No occupation data found for "${areaName}". This data may not yet be loaded.</p>
                    <a href="#/" class="btn-back">Back to Home</a>
                </div>`;
            return;
        }

        document.title = `${areaName} — LaborCompare`;

        const occs = areaData.occupations;
        const occList = Object.entries(occs).map(([soc, d]) => ({ soc, ...d }));

        // Sort by different criteria
        const byPay = [...occList].filter(o => o.med != null).sort((a, b) => b.med - a.med);
        const byEmployment = [...occList].filter(o => o.emp != null).sort((a, b) => b.emp - a.emp);

        // Calculate summary stats
        const totalEmp = occList.reduce((sum, o) => sum + (o.emp || 0), 0);
        const medianWages = occList.filter(o => o.med != null).map(o => o.med).sort((a, b) => a - b);
        const overallMedian = medianWages.length > 0 ? medianWages[Math.floor(medianWages.length / 2)] : null;

        container.innerHTML = `
            <div class="area-page">
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>${areaName}</span>
                </nav>

                <header class="area-header">
                    <div class="area-header-text">
                        <span class="area-type-badge">${isState ? 'State' : 'Metro Area'}</span>
                        <h1 class="area-title">${areaName}</h1>
                    </div>
                    <div class="occ-key-stats">
                        ${econData?.unemployment_rate != null ? `
                        <div class="key-stat">
                            <span class="key-stat-value">${Formatters.percent(econData.unemployment_rate)}</span>
                            <span class="key-stat-label">Unemployment</span>
                        </div>` : ''}
                        <div class="key-stat">
                            <span class="key-stat-value">${Formatters.count(totalEmp)}</span>
                            <span class="key-stat-label">Total Employed</span>
                        </div>
                        <div class="key-stat">
                            <span class="key-stat-value">${Formatters.salary(overallMedian)}</span>
                            <span class="key-stat-label">Median Wage</span>
                        </div>
                        ${econData?.median_household_income != null ? `
                        <div class="key-stat">
                            <span class="key-stat-value">${Formatters.salary(econData.median_household_income)}</span>
                            <span class="key-stat-label">Household Income</span>
                        </div>` : ''}
                    </div>
                </header>

                ${econData ? renderEconomicOverview(econData) : ''}

                <section class="occ-section">
                    <h2 class="occ-section-title">Top Paying Occupations</h2>
                    <div class="occ-table-wrapper">
                        ${renderOccTable(byPay.slice(0, 20), 'med')}
                    </div>
                </section>

                <section class="occ-section">
                    <h2 class="occ-section-title">Largest Occupations by Employment</h2>
                    <div class="occ-table-wrapper">
                        ${renderOccTable(byEmployment.slice(0, 20), 'emp')}
                    </div>
                </section>

                <section class="occ-section">
                    <h2 class="occ-section-title">All Occupations (${occList.length})</h2>
                    <div class="area-search-filter">
                        <input type="text" id="area-occ-filter" class="filter-input" placeholder="Filter occupations...">
                    </div>
                    <div class="occ-table-wrapper" id="all-occs-table">
                        ${renderOccTable(byPay, 'med', true)}
                    </div>
                </section>
            </div>
        `;

        // Filter functionality
        const filterInput = document.getElementById('area-occ-filter');
        if (filterInput) {
            filterInput.addEventListener('input', () => {
                const q = filterInput.value.toLowerCase().trim();
                const tableEl = document.getElementById('all-occs-table');
                if (!tableEl) return;

                const filtered = q
                    ? byPay.filter(o => o.title?.toLowerCase().includes(q) || o.soc?.includes(q))
                    : byPay;
                tableEl.innerHTML = renderOccTable(filtered, 'med', true);
                attachOccLinks(tableEl);
            });
        }

        // Attach click handlers for occupation links
        attachOccLinks(container);
    }

    function renderEconomicOverview(data) {
        const items = [];
        if (data.labor_force_participation_rate != null)
            items.push(['Labor Force Participation', Formatters.percent(data.labor_force_participation_rate)]);
        if (data.per_capita_income != null)
            items.push(['Per Capita Income', Formatters.salary(data.per_capita_income)]);
        if (data.median_earnings != null)
            items.push(['Median Earnings', Formatters.salary(data.median_earnings)]);
        if (data.poverty_rate != null)
            items.push(['Poverty Rate', Formatters.percent(data.poverty_rate)]);
        if (data.population != null)
            items.push(['Population', Formatters.number(data.population)]);
        if (data.median_age != null)
            items.push(['Median Age', data.median_age.toFixed(1)]);
        if (data.bachelors_or_higher_pct != null)
            items.push(["Bachelor's Degree+", Formatters.percent(data.bachelors_or_higher_pct)]);
        if (data.homeownership_rate != null)
            items.push(['Homeownership', Formatters.percent(data.homeownership_rate)]);

        if (items.length === 0) return '';

        return `
            <section class="occ-section">
                <h2 class="occ-section-title">Economic Overview</h2>
                <div class="econ-grid">
                    ${items.map(([label, value]) => `
                        <div class="econ-stat">
                            <span class="econ-stat-value">${value}</span>
                            <span class="econ-stat-label">${label}</span>
                        </div>
                    `).join('')}
                </div>
            </section>
        `;
    }

    function renderOccTable(occs, sortField, showAll = false) {
        if (occs.length === 0) return '<p class="hint-text">No data available.</p>';

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Occupation</th>
                        <th>Median Salary</th>
                        <th>Average Salary</th>
                        <th>Employment</th>
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
    }

    function attachOccLinks(container) {
        container.querySelectorAll('[data-soc]').forEach(el => {
            el.addEventListener('click', () => {
                Router.navigate(`/occupation/${el.dataset.soc}`);
            });
        });
    }

    function unmount() {}

    return { getTitle, mount, unmount };
})();

window.AreaProfilePage = AreaProfilePage;
