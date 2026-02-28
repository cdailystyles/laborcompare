/**
 * LaborCompare — Jobs Page
 * Employment situation: headline stats, JOLTS, sector breakdown,
 * highest/lowest paying occupations, largest employers
 * Route: #/jobs
 */

const JobsPage = (() => {
    function getTitle() {
        return 'Jobs — Employment Situation';
    }

    async function mount(params, container) {
        container.innerHTML = `
            <div class="wages-page">
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>Jobs</span>
                </nav>

                <h1 class="page-title">Employment Situation</h1>

                <section class="stat-row" id="jobs-stats" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 32px;">
                    <div class="sr-card">
                        <div class="sr-label">Unemployment Rate</div>
                        <div class="sr-value" id="jobs-unemp">--</div>
                        <div class="sr-delta fl" id="jobs-unemp-d"></div>
                    </div>
                    <div class="sr-card">
                        <div class="sr-label">Nonfarm Payrolls</div>
                        <div class="sr-value" id="jobs-payrolls">--</div>
                        <div class="sr-delta fl" id="jobs-payrolls-d"></div>
                    </div>
                    <div class="sr-card">
                        <div class="sr-label">Labor Force Participation</div>
                        <div class="sr-value" id="jobs-lfpr">--</div>
                        <div class="sr-delta fl" id="jobs-lfpr-d"></div>
                    </div>
                </section>

                <section class="section">
                    <h2 class="section-title">JOLTS — Job Openings &amp; Labor Turnover</h2>
                    <div class="stat-row" id="jolts-stats" style="grid-template-columns: repeat(4, 1fr);">
                        <div class="sr-card">
                            <div class="sr-label">Job Openings</div>
                            <div class="sr-value" id="jolts-open">--</div>
                        </div>
                        <div class="sr-card">
                            <div class="sr-label">Hires</div>
                            <div class="sr-value" id="jolts-hires">--</div>
                        </div>
                        <div class="sr-card">
                            <div class="sr-label">Quits</div>
                            <div class="sr-value" id="jolts-quits">--</div>
                        </div>
                        <div class="sr-card">
                            <div class="sr-label">Separations</div>
                            <div class="sr-value" id="jolts-sep">--</div>
                        </div>
                    </div>
                </section>

                <section class="section">
                    <div class="sh"><h2>Employment by Sector</h2><span id="sector-total" style="font-size:13px;color:var(--text-3);"></span></div>
                    <div id="jobs-sectors">
                        <div class="page-loading"><div class="loader"></div></div>
                    </div>
                </section>

                <section class="section">
                    <div class="grid-2" id="jobs-lists">
                        <div>
                            <h2 class="section-title">Highest Paying Occupations</h2>
                            <div class="table-wrapper" id="top-paying">
                                <div class="page-loading"><div class="loader"></div></div>
                            </div>
                        </div>
                        <div>
                            <h2 class="section-title">Largest Employers</h2>
                            <div class="table-wrapper" id="top-employers">
                                <div class="page-loading"><div class="loader"></div></div>
                            </div>
                        </div>
                    </div>
                </section>

                <section class="section">
                    <div class="grid-2">
                        <div>
                            <h2 class="section-title">Lowest Paying Occupations</h2>
                            <div class="table-wrapper" id="low-paying">
                                <div class="page-loading"><div class="loader"></div></div>
                            </div>
                        </div>
                        <div>
                            <h2 class="section-title">Smallest Occupations</h2>
                            <div class="table-wrapper" id="smallest-occs">
                                <div class="page-loading"><div class="loader"></div></div>
                            </div>
                        </div>
                    </div>
                </section>

                <div class="fresh">
                    <strong>Source:</strong>
                    <span>Bureau of Labor Statistics — Current Employment Statistics, JOLTS, OEWS May 2024. Updated via automated data pipeline.</span>
                </div>
            </div>
        `;

        loadHeadlineStats();
        loadJOLTS();
        loadOEWSData();
    }

    async function loadHeadlineStats() {
        try {
            const ticker = await BLSLoader.loadTicker();
            if (!ticker?.cards) return;
            for (const card of ticker.cards) {
                if (card.id === 'unemployment') {
                    setEl('jobs-unemp', card.value);
                    setDelta('jobs-unemp-d', card.delta, card.direction);
                }
                if (card.id === 'payrolls') {
                    setEl('jobs-payrolls', card.value);
                    setDelta('jobs-payrolls-d', card.delta, card.direction);
                }
                if (card.id === 'lfpr') {
                    setEl('jobs-lfpr', card.value);
                    setDelta('jobs-lfpr-d', card.delta, card.direction);
                }
                if (card.id === 'openings') {
                    const el = document.getElementById('jolts-open');
                    if (el && el.textContent === '--') setEl('jolts-open', card.value);
                }
            }
        } catch { /* placeholders stay */ }
    }

    async function loadJOLTS() {
        try {
            const jolts = await BLSLoader.loadJOLTS();
            if (!jolts) return;
            if (jolts.openings) setEl('jolts-open', Formatters.count(jolts.openings * 1000));
            if (jolts.hires) setEl('jolts-hires', Formatters.count(jolts.hires * 1000));
            if (jolts.quits) setEl('jolts-quits', Formatters.count(jolts.quits * 1000));
            if (jolts.separations) setEl('jolts-sep', Formatters.count(jolts.separations * 1000));
        } catch { /* placeholders stay */ }
    }

    async function loadOEWSData() {
        try {
            const national = await OEWSLoader.loadNational();
            if (!national?.occupations) return;

            const occs = Object.entries(national.occupations);

            // --- Sector breakdown ---
            buildSectorTable(occs);

            // --- Top/bottom lists ---
            const detailed = occs.filter(([code]) => code.match(/^\d{2}-\d{4}$/));

            // Highest paying
            const topPaying = detailed
                .filter(([, d]) => d.med != null && d.med < 300000)
                .sort((a, b) => b[1].med - a[1].med)
                .slice(0, 15);
            renderOccTable('top-paying', topPaying, 'med');

            // Lowest paying
            const lowPaying = detailed
                .filter(([, d]) => d.med != null && d.med > 0)
                .sort((a, b) => a[1].med - b[1].med)
                .slice(0, 15);
            renderOccTable('low-paying', lowPaying, 'med');

            // Largest employers
            const topEmp = detailed
                .filter(([, d]) => d.emp != null)
                .sort((a, b) => b[1].emp - a[1].emp)
                .slice(0, 15);
            renderOccTable('top-employers', topEmp, 'emp');

            // Smallest occupations
            const smallEmp = detailed
                .filter(([, d]) => d.emp != null && d.emp > 0)
                .sort((a, b) => a[1].emp - b[1].emp)
                .slice(0, 15);
            renderOccTable('smallest-occs', smallEmp, 'emp');

        } catch {
            const el = document.getElementById('jobs-sectors');
            if (el) el.innerHTML = '<p class="hint-text">Unable to load occupation data.</p>';
        }
    }

    function buildSectorTable(occs) {
        const sectorsEl = document.getElementById('jobs-sectors');
        if (!sectorsEl) return;

        const groups = {};
        let totalEmp = 0;

        for (const [code, data] of occs) {
            const major = code?.substring(0, 2);
            const groupName = Constants.SOC_MAJOR_GROUPS[major];
            if (!groupName) continue;
            if (!groups[major]) groups[major] = { code: major, name: groupName, emp: 0, count: 0, medSum: 0, medCount: 0 };
            groups[major].emp += data.emp || 0;
            groups[major].count++;
            if (data.med) {
                groups[major].medSum += data.med;
                groups[major].medCount++;
            }
            totalEmp += data.emp || 0;
        }

        const sorted = Object.values(groups)
            .map(g => ({
                ...g,
                avgWage: g.medCount > 0 ? Math.round(g.medSum / g.medCount) : 0,
                share: totalEmp > 0 ? (g.emp / totalEmp * 100) : 0
            }))
            .filter(g => g.emp > 0)
            .sort((a, b) => b.emp - a.emp);

        // Show total
        const totalEl = document.getElementById('sector-total');
        if (totalEl) totalEl.textContent = `${Formatters.count(totalEmp)} total employed`;

        sectorsEl.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Sector</th>
                        <th class="value-cell">Employment</th>
                        <th class="value-cell">Share</th>
                        <th class="value-cell">Avg Median Salary</th>
                        <th class="value-cell">Occupations</th>
                    </tr>
                </thead>
                <tbody>
                    ${sorted.map(s => `
                        <tr class="clickable-row" data-sector="${s.code}">
                            <td>${s.name}</td>
                            <td class="value-cell">${Formatters.count(s.emp)}</td>
                            <td class="value-cell">${s.share.toFixed(1)}%</td>
                            <td class="value-cell">${Formatters.salary(s.avgWage)}</td>
                            <td class="value-cell">${s.count}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;

        // Click to filter wages by sector
        sectorsEl.querySelectorAll('[data-sector]').forEach(el => {
            el.addEventListener('click', () => {
                Router.navigate(`/wages?sector=${el.dataset.sector}`);
            });
        });
    }

    function renderOccTable(containerId, items, valueField) {
        const el = document.getElementById(containerId);
        if (!el) return;

        el.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Occupation</th>
                        <th class="value-cell">${valueField === 'emp' ? 'Employment' : 'Median Salary'}</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.map(([soc, data], i) => {
                        const val = valueField === 'emp'
                            ? Formatters.count(data.emp)
                            : Formatters.salary(data.med);
                        return `
                            <tr class="clickable-row" data-soc="${soc}">
                                <td>${i + 1}</td>
                                <td>${data.title}</td>
                                <td class="value-cell">${val}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;

        el.querySelectorAll('[data-soc]').forEach(row => {
            row.addEventListener('click', () => Router.navigate(`/wages/${row.dataset.soc}`));
        });
    }

    function setEl(id, text) {
        const el = document.getElementById(id);
        if (el && text) el.textContent = text;
    }

    function setDelta(id, text, direction) {
        const el = document.getElementById(id);
        if (el && text) {
            el.textContent = text;
            el.className = 'sr-delta ' + (direction === 'up' ? 'up' : direction === 'down' ? 'dn' : 'fl');
        }
    }

    function unmount() {}

    return { getTitle, mount, unmount };
})();

window.JobsPage = JobsPage;
