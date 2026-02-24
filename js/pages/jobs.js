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

                <div class="fresh">
                    <strong>Note:</strong>
                    <span>This page will show real-time BLS data once the data pipeline is live. Currently showing placeholder values.</span>
                </div>
            </div>
        `;

        loadJobsData();
    }

    async function loadJobsData() {
        try {
            const ticker = await BLSLoader.loadTicker();
            if (ticker?.cards) {
                for (const card of ticker.cards) {
                    if (card.id === 'unemployment') {
                        setEl('jobs-unemp', card.value);
                        setEl('jobs-unemp-d', card.delta);
                    }
                    if (card.id === 'payrolls') {
                        setEl('jobs-payrolls', card.value);
                        setEl('jobs-payrolls-d', card.delta);
                    }
                    if (card.id === 'lfpr') {
                        setEl('jobs-lfpr', card.value);
                        setEl('jobs-lfpr-d', card.delta);
                    }
                }
            }
        } catch { /* stay at placeholder */ }

        try {
            const jolts = await BLSLoader.loadJOLTS();
            if (jolts) {
                if (jolts.openings) setEl('jolts-open', Formatters.count(jolts.openings));
                if (jolts.hires) setEl('jolts-hires', Formatters.count(jolts.hires));
                if (jolts.quits) setEl('jolts-quits', Formatters.count(jolts.quits));
                if (jolts.separations) setEl('jolts-sep', Formatters.count(jolts.separations));
            }
        } catch { /* stay at placeholder */ }
    }

    function setEl(id, text) {
        const el = document.getElementById(id);
        if (el && text) el.textContent = text;
    }

    function unmount() {}

    return { getTitle, mount, unmount };
})();

window.JobsPage = JobsPage;
