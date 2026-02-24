/**
 * LaborCompare — States Page (replaces area-profile.js)
 * Landing: /states — grid of 51 state cards
 * Detail: /states/:fips — economic snapshot + top occupations
 */

const StatesPage = (() => {
    function getTitle(params) {
        if (params?.fips) {
            const name = Constants.STATE_FIPS_TO_NAME[params.fips];
            if (name) return `${name} Labor Market`;
            return 'Area Profile';
        }
        return 'States — Labor Market Data';
    }

    async function mount(params, container) {
        if (params?.fips) {
            await mountDetail(params.fips, container);
        } else {
            await mountLanding(container);
        }
    }

    // ================================================================
    // Landing: state card grid
    // ================================================================
    async function mountLanding(container) {
        container.innerHTML = `
            <div class="states-page">
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>States</span>
                </nav>

                <h1 class="page-title">States &amp; Territories</h1>

                <div style="margin-bottom: 16px;">
                    <input type="text" id="state-filter" class="filter-input" placeholder="Filter states...">
                </div>

                <div class="state-grid" id="state-grid">
                    <div class="page-loading" style="grid-column:1/-1;"><div class="loader"></div><span>Loading state data...</span></div>
                </div>
            </div>
        `;

        const econData = await OEWSLoader.loadStateEconomic();
        const grid = document.getElementById('state-grid');
        if (!grid) return;

        const states = Object.entries(Constants.STATE_FIPS_TO_NAME)
            .sort((a, b) => a[1].localeCompare(b[1]));

        function render(stateList) {
            grid.innerHTML = stateList.map(([fips, name]) => {
                const econ = econData?.[name];
                const unemp = econ?.unemployment_rate != null ? Formatters.percent(econ.unemployment_rate) : '--';
                const income = econ?.median_household_income != null ? Formatters.salary(econ.median_household_income) : '--';
                const pop = econ?.population != null ? Formatters.count(econ.population) : '--';
                return `
                    <a href="#/states/${fips}" class="state-card">
                        <div class="state-card-name">${name}</div>
                        <div class="state-card-meta">Unemp ${unemp} · Income ${income} · Pop ${pop}</div>
                    </a>
                `;
            }).join('');
        }

        render(states);

        document.getElementById('state-filter')?.addEventListener('input', (e) => {
            const q = e.target.value.toLowerCase().trim();
            const filtered = q ? states.filter(([, name]) => name.toLowerCase().includes(q)) : states;
            render(filtered);
        });
    }

    // ================================================================
    // Detail: state or metro profile
    // ================================================================
    async function mountDetail(fips, container) {
        container.innerHTML = `
            <div class="states-page">
                <div class="page-loading"><div class="loader"></div><span>Loading area data...</span></div>
            </div>
        `;

        const isState = fips.length === 2 || Constants.STATE_FIPS_TO_NAME[fips];
        let areaData, econData, areaName;

        if (isState) {
            const [oewsData, stateEcon] = await Promise.all([
                OEWSLoader.loadStateArea(fips),
                OEWSLoader.loadStateEconomic()
            ]);
            areaData = oewsData;
            areaName = Constants.STATE_FIPS_TO_NAME[fips] || fips;
            econData = stateEcon?.[areaName] || null;
        } else {
            areaData = await OEWSLoader.loadMetroArea(fips);
            areaName = areaData?.name || fips;
        }

        if (!areaData?.occupations || Object.keys(areaData.occupations).length === 0) {
            container.innerHTML = `
                <div class="page-error">
                    <h2>Area data not available</h2>
                    <p>No occupation data found for "${areaName}".</p>
                    <a href="#/states" class="btn-back">All States</a>
                </div>`;
            return;
        }

        document.title = `${areaName} — LaborCompare`;

        const occs = areaData.occupations;
        const occList = Object.entries(occs).map(([soc, d]) => ({ soc, ...d }));
        const byPay = [...occList].filter(o => o.med != null).sort((a, b) => b.med - a.med);
        const byEmp = [...occList].filter(o => o.emp != null).sort((a, b) => b.emp - a.emp);
        const totalEmp = occList.reduce((sum, o) => sum + (o.emp || 0), 0);
        const medianWages = occList.filter(o => o.med != null).map(o => o.med).sort((a, b) => a - b);
        const overallMedian = medianWages.length > 0 ? medianWages[Math.floor(medianWages.length / 2)] : null;

        container.innerHTML = `
            <div class="states-page">
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <a href="#/states">States</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>${areaName}</span>
                </nav>

                <header class="wages-header">
                    <div class="wages-header-text">
                        <span class="area-type-badge">${isState ? 'State' : 'Metro Area'}</span>
                        <h1 class="wages-title">${areaName}</h1>
                    </div>
                    <div class="key-stats">
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

                ${econData ? renderEconOverview(econData) : ''}

                <section class="section">
                    <h2 class="section-title">Top Paying Occupations</h2>
                    <div class="table-wrapper">${renderOccTable(byPay.slice(0, 20))}</div>
                </section>

                <section class="section">
                    <h2 class="section-title">Largest Occupations</h2>
                    <div class="table-wrapper">${renderOccTable(byEmp.slice(0, 20))}</div>
                </section>

                <section class="section">
                    <h2 class="section-title">All Occupations (${occList.length})</h2>
                    <div style="margin-bottom: 12px;">
                        <input type="text" id="area-occ-filter" class="filter-input" placeholder="Filter occupations...">
                    </div>
                    <div class="table-wrapper" id="all-occs-table">${renderOccTable(byPay)}</div>
                </section>
            </div>
        `;

        // Filter
        const filterInput = document.getElementById('area-occ-filter');
        filterInput?.addEventListener('input', () => {
            const q = filterInput.value.toLowerCase().trim();
            const table = document.getElementById('all-occs-table');
            if (!table) return;
            const filtered = q ? byPay.filter(o => (o.title || '').toLowerCase().includes(q) || o.soc.includes(q)) : byPay;
            table.innerHTML = renderOccTable(filtered);
            attachOccClicks(table);
        });

        attachOccClicks(container);
    }

    function renderEconOverview(data) {
        const items = [];
        if (data.labor_force_participation_rate != null) items.push(['LFPR', Formatters.percent(data.labor_force_participation_rate)]);
        if (data.per_capita_income != null) items.push(['Per Capita Income', Formatters.salary(data.per_capita_income)]);
        if (data.median_earnings != null) items.push(['Median Earnings', Formatters.salary(data.median_earnings)]);
        if (data.poverty_rate != null) items.push(['Poverty Rate', Formatters.percent(data.poverty_rate)]);
        if (data.population != null) items.push(['Population', Formatters.number(data.population)]);
        if (data.median_age != null) items.push(['Median Age', data.median_age.toFixed(1)]);
        if (data.bachelors_or_higher_pct != null) items.push(["Bachelor's+", Formatters.percent(data.bachelors_or_higher_pct)]);
        if (data.homeownership_rate != null) items.push(['Homeownership', Formatters.percent(data.homeownership_rate)]);

        if (items.length === 0) return '';

        return `
            <section class="section">
                <h2 class="section-title">Economic Overview</h2>
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

    function renderOccTable(occs) {
        if (occs.length === 0) return '<p class="hint-text">No data available.</p>';

        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Occupation</th>
                        <th class="value-cell">Median Salary</th>
                        <th class="value-cell">Avg Salary</th>
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
    }

    function attachOccClicks(container) {
        container.querySelectorAll('[data-soc]').forEach(el => {
            el.addEventListener('click', () => Router.navigate(`/wages/${el.dataset.soc}`));
        });
    }

    function unmount() {}

    return { getTitle, mount, unmount };
})();

window.StatesPage = StatesPage;
