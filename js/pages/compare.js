/**
 * LaborCompare — Compare Tool
 * Side-by-side comparison of occupations or areas.
 * Route: #/compare
 */

const ComparePage = (() => {
    function getTitle() {
        return 'Compare';
    }

    async function mount(params, container) {
        container.innerHTML = `
            <div class="compare-page">
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>Compare</span>
                </nav>

                <h1 class="page-title">Compare</h1>

                <!-- Compare mode toggle -->
                <div class="compare-mode-toggle">
                    <button class="toggle-btn active" id="compare-occ-btn">Compare Occupations</button>
                    <button class="toggle-btn" id="compare-area-btn">Compare States</button>
                </div>

                <!-- Occupation comparison -->
                <div class="compare-panel" id="compare-occ-panel">
                    <div class="compare-inputs">
                        <div class="compare-input-group">
                            <label>Occupation 1</label>
                            <div class="compare-search">
                                <input type="text" id="compare-occ-1" class="filter-input" placeholder="Search occupation..." autocomplete="off">
                                <div class="search-dropdown" id="compare-occ-dd-1"></div>
                            </div>
                            <span class="compare-selected" id="compare-occ-label-1">—</span>
                        </div>
                        <span class="vs-badge">VS</span>
                        <div class="compare-input-group">
                            <label>Occupation 2</label>
                            <div class="compare-search">
                                <input type="text" id="compare-occ-2" class="filter-input" placeholder="Search occupation..." autocomplete="off">
                                <div class="search-dropdown" id="compare-occ-dd-2"></div>
                            </div>
                            <span class="compare-selected" id="compare-occ-label-2">—</span>
                        </div>
                    </div>
                    <div id="compare-occ-results" class="compare-results"></div>
                </div>

                <!-- State comparison -->
                <div class="compare-panel" id="compare-area-panel" style="display: none;">
                    <div class="compare-inputs">
                        <div class="compare-input-group">
                            <label>State 1</label>
                            <select id="compare-state-1" class="select-input">
                                <option value="">Select state...</option>
                                ${renderStateOptions()}
                            </select>
                        </div>
                        <span class="vs-badge">VS</span>
                        <div class="compare-input-group">
                            <label>State 2</label>
                            <select id="compare-state-2" class="select-input">
                                <option value="">Select state...</option>
                                ${renderStateOptions()}
                            </select>
                        </div>
                    </div>
                    <div id="compare-area-results" class="compare-results"></div>
                </div>
            </div>
        `;

        initModeToggle();
        initOccupationCompare();
        initStateCompare();
    }

    function renderStateOptions() {
        return Object.entries(Constants.STATE_FIPS_TO_NAME)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([fips, name]) => `<option value="${fips}">${name}</option>`)
            .join('');
    }

    function initModeToggle() {
        const occBtn = document.getElementById('compare-occ-btn');
        const areaBtn = document.getElementById('compare-area-btn');
        const occPanel = document.getElementById('compare-occ-panel');
        const areaPanel = document.getElementById('compare-area-panel');

        occBtn?.addEventListener('click', () => {
            occBtn.classList.add('active');
            areaBtn.classList.remove('active');
            occPanel.style.display = '';
            areaPanel.style.display = 'none';
        });

        areaBtn?.addEventListener('click', () => {
            areaBtn.classList.add('active');
            occBtn.classList.remove('active');
            areaPanel.style.display = '';
            occPanel.style.display = 'none';
        });
    }

    function initOccupationCompare() {
        const selected = { 1: null, 2: null };

        [1, 2].forEach(n => {
            const input = document.getElementById(`compare-occ-${n}`);
            const dropdown = document.getElementById(`compare-occ-dd-${n}`);
            const label = document.getElementById(`compare-occ-label-${n}`);
            if (!input || !dropdown) return;

            let debounce = null;
            input.addEventListener('focus', () => Search.loadIndex());
            input.addEventListener('input', () => {
                clearTimeout(debounce);
                debounce = setTimeout(() => {
                    const q = input.value.trim();
                    if (q.length < 2) { dropdown.classList.remove('visible'); return; }
                    const results = Search.search(q, 6).filter(r => r.type === 'occupation');
                    if (!results.length) {
                        dropdown.innerHTML = '<div class="search-no-results">No results</div>';
                        dropdown.classList.add('visible');
                        return;
                    }
                    dropdown.innerHTML = results.map(r => `
                        <div class="search-result" data-soc="${r.id}">
                            <div class="search-result-text">
                                <span class="search-result-title">${r.title}</span>
                                <span class="search-result-subtitle">${r.subtitle}</span>
                            </div>
                        </div>
                    `).join('');
                    dropdown.classList.add('visible');

                    dropdown.querySelectorAll('.search-result').forEach(el => {
                        el.addEventListener('click', () => {
                            const soc = el.dataset.soc;
                            const title = el.querySelector('.search-result-title').textContent;
                            selected[n] = soc;
                            label.textContent = title;
                            input.value = '';
                            dropdown.classList.remove('visible');
                            if (selected[1] && selected[2]) runOccCompare(selected[1], selected[2]);
                        });
                    });
                }, 150);
            });

            document.addEventListener('click', (e) => {
                if (!input.contains(e.target) && !dropdown.contains(e.target)) {
                    dropdown.classList.remove('visible');
                }
            });
        });
    }

    async function runOccCompare(soc1, soc2) {
        const results = document.getElementById('compare-occ-results');
        if (!results) return;

        results.innerHTML = '<div class="page-loading"><div class="loader"></div></div>';

        const national = await OEWSLoader.loadNational();
        if (!national?.occupations) {
            results.innerHTML = '<p class="hint-text">Occupation data not loaded.</p>';
            return;
        }

        const o1 = national.occupations[soc1];
        const o2 = national.occupations[soc2];

        if (!o1 || !o2) {
            results.innerHTML = '<p class="hint-text">One or both occupations not found.</p>';
            return;
        }

        const rows = [
            ['Median Salary', Formatters.salary(o1.med), Formatters.salary(o2.med), o1.med, o2.med, true],
            ['Average Salary', Formatters.salary(o1.avg), Formatters.salary(o2.avg), o1.avg, o2.avg, true],
            ['Median Hourly', Formatters.hourly(o1.hmed), Formatters.hourly(o2.hmed), o1.hmed, o2.hmed, true],
            ['Employment', Formatters.count(o1.emp), Formatters.count(o2.emp), o1.emp, o2.emp, true],
            ['10th Percentile', Formatters.salary(o1.p10), Formatters.salary(o2.p10), o1.p10, o2.p10, true],
            ['25th Percentile', Formatters.salary(o1.p25), Formatters.salary(o2.p25), o1.p25, o2.p25, true],
            ['75th Percentile', Formatters.salary(o1.p75), Formatters.salary(o2.p75), o1.p75, o2.p75, true],
            ['90th Percentile', Formatters.salary(o1.p90), Formatters.salary(o2.p90), o1.p90, o2.p90, true]
        ];

        results.innerHTML = `
            <table class="data-table compare-table">
                <thead>
                    <tr>
                        <th>Metric</th>
                        <th>${o1.title}</th>
                        <th>${o2.title}</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows.map(([label, v1, v2, n1, n2, higherBetter]) => {
                        const cls1 = (n1 != null && n2 != null) ? (n1 > n2 ? (higherBetter ? 'higher' : 'lower') : (n1 < n2 ? (higherBetter ? 'lower' : 'higher') : '')) : '';
                        const cls2 = (n1 != null && n2 != null) ? (n2 > n1 ? (higherBetter ? 'higher' : 'lower') : (n2 < n1 ? (higherBetter ? 'lower' : 'higher') : '')) : '';
                        return `
                            <tr>
                                <td>${label}</td>
                                <td class="value-cell ${cls1}">${v1}</td>
                                <td class="value-cell ${cls2}">${v2}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    function initStateCompare() {
        const sel1 = document.getElementById('compare-state-1');
        const sel2 = document.getElementById('compare-state-2');

        const onChange = async () => {
            const fips1 = sel1?.value;
            const fips2 = sel2?.value;
            if (!fips1 || !fips2) return;

            const results = document.getElementById('compare-area-results');
            if (!results) return;

            results.innerHTML = '<div class="page-loading"><div class="loader"></div></div>';

            const econData = await OEWSLoader.loadStateEconomic();
            if (!econData) {
                results.innerHTML = '<p class="hint-text">State data not loaded.</p>';
                return;
            }

            const name1 = Constants.STATE_FIPS_TO_NAME[fips1];
            const name2 = Constants.STATE_FIPS_TO_NAME[fips2];
            const d1 = econData[name1];
            const d2 = econData[name2];

            if (!d1 || !d2) {
                results.innerHTML = '<p class="hint-text">Data not available for one or both states.</p>';
                return;
            }

            const fields = [
                ['Unemployment Rate', 'unemployment_rate', false],
                ['Labor Force Participation', 'labor_force_participation_rate', true],
                ['Median Household Income', 'median_household_income', true],
                ['Median Earnings', 'median_earnings', true],
                ['Per Capita Income', 'per_capita_income', true],
                ['Avg Hourly Earnings', 'avg_hourly_earnings', true],
                ['Population', 'population', true],
                ['Poverty Rate', 'poverty_rate', false],
                ["Bachelor's Degree+", 'bachelors_or_higher_pct', true],
                ['Homeownership Rate', 'homeownership_rate', true],
                ['Gini Index', 'gini_index', false],
                ['Median Age', 'median_age', false]
            ];

            results.innerHTML = `
                <table class="data-table compare-table">
                    <thead>
                        <tr>
                            <th>Metric</th>
                            <th>${name1}</th>
                            <th>${name2}</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${fields.map(([label, field, higherBetter]) => {
                            const v1 = d1[field];
                            const v2 = d2[field];
                            const f1 = Formatters.auto(v1, field);
                            const f2 = Formatters.auto(v2, field);
                            const cls1 = (v1 != null && v2 != null) ? (v1 > v2 ? (higherBetter ? 'higher' : 'lower') : (v1 < v2 ? (higherBetter ? 'lower' : 'higher') : '')) : '';
                            const cls2 = (v1 != null && v2 != null) ? (v2 > v1 ? (higherBetter ? 'higher' : 'lower') : (v2 < v1 ? (higherBetter ? 'lower' : 'higher') : '')) : '';
                            return `
                                <tr>
                                    <td>${label}</td>
                                    <td class="value-cell ${cls1}">${f1}</td>
                                    <td class="value-cell ${cls2}">${f2}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        };

        sel1?.addEventListener('change', onChange);
        sel2?.addEventListener('change', onChange);
    }

    function unmount() {}

    return { getTitle, mount, unmount };
})();

window.ComparePage = ComparePage;
