/**
 * LaborCompare — Jobs Page
 * Employment situation: payrolls, unemployment, LFPR, JOLTS
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
                    <h2 class="section-title">Employment by Sector</h2>
                    <div id="jobs-sectors">
                        <div class="page-loading"><div class="loader"></div></div>
                    </div>
                </section>

                <div class="fresh">
                    <strong>Source:</strong>
                    <span>Bureau of Labor Statistics — Current Employment Statistics, JOLTS. Updated monthly via automated data pipeline.</span>
                </div>
            </div>
        `;

        loadJobsData();
    }

    async function loadJobsData() {
        // Load ticker data for headline stats
        try {
            const ticker = await BLSLoader.loadTicker();
            if (ticker?.cards) {
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
                    // Use ticker openings as JOLTS fallback
                    if (card.id === 'openings') {
                        const openEl = document.getElementById('jolts-open');
                        if (openEl && openEl.textContent === '--') {
                            setEl('jolts-open', card.value);
                        }
                    }
                }
            }
        } catch { /* stay at placeholder */ }

        // Try loading full JOLTS data
        try {
            const jolts = await BLSLoader.loadJOLTS();
            if (jolts) {
                if (jolts.openings) setEl('jolts-open', Formatters.count(jolts.openings * 1000));
                if (jolts.hires) setEl('jolts-hires', Formatters.count(jolts.hires * 1000));
                if (jolts.quits) setEl('jolts-quits', Formatters.count(jolts.quits * 1000));
                if (jolts.separations) setEl('jolts-sep', Formatters.count(jolts.separations * 1000));
            }
        } catch { /* stay at placeholder */ }

        // Build sectors overview from state economic data
        try {
            const sectorsEl = document.getElementById('jobs-sectors');
            if (!sectorsEl) return;

            // Show a summary of top occupational sectors by employment
            const national = await OEWSLoader.loadNational();
            if (national && national.length > 0) {
                // Group by major SOC code
                const groups = {};
                for (const occ of national) {
                    const major = occ.code?.substring(0, 2);
                    const groupName = Constants.SOC_MAJOR_GROUPS[major];
                    if (!groupName) continue;
                    if (!groups[major]) groups[major] = { name: groupName, emp: 0, count: 0, medianWage: 0 };
                    groups[major].emp += occ.emp || 0;
                    groups[major].count++;
                    if (occ.med) groups[major].medianWage += occ.med;
                }

                const sorted = Object.values(groups)
                    .map(g => ({ ...g, avgWage: g.count > 0 ? Math.round(g.medianWage / g.count) : 0 }))
                    .filter(g => g.emp > 0)
                    .sort((a, b) => b.emp - a.emp);

                sectorsEl.innerHTML = `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Sector</th>
                                <th class="value-cell">Employment</th>
                                <th class="value-cell">Avg Median Salary</th>
                                <th class="value-cell">Occupations</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${sorted.map(s => `
                                <tr>
                                    <td>${s.name}</td>
                                    <td class="value-cell">${Formatters.count(s.emp)}</td>
                                    <td class="value-cell">${Formatters.salary(s.avgWage)}</td>
                                    <td class="value-cell">${s.count}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                `;
            } else {
                sectorsEl.innerHTML = '<p class="hint-text">Sector data loading...</p>';
            }
        } catch {
            const sectorsEl = document.getElementById('jobs-sectors');
            if (sectorsEl) sectorsEl.innerHTML = '';
        }
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
