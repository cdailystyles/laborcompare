/**
 * LaborCompare — Prices Page
 * CPI headline stats, category breakdown, inflation calculator
 * Route: #/prices
 */

const PricesPage = (() => {
    function getTitle() {
        return 'Prices — Consumer Price Index';
    }

    async function mount(params, container) {
        container.innerHTML = `
            <div class="wages-page">
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>Prices</span>
                </nav>

                <h1 class="page-title">Consumer Prices (CPI)</h1>

                <section class="stat-row" id="cpi-stats" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 32px;">
                    <div class="sr-card">
                        <div class="sr-label">CPI-U All Items</div>
                        <div class="sr-value" id="cpi-index">--</div>
                        <div class="sr-delta fl" id="cpi-index-d"></div>
                    </div>
                    <div class="sr-card">
                        <div class="sr-label">YoY Change</div>
                        <div class="sr-value" id="cpi-yoy">--</div>
                        <div class="sr-delta fl" id="cpi-yoy-d"></div>
                    </div>
                    <div class="sr-card">
                        <div class="sr-label">MoM Change</div>
                        <div class="sr-value" id="cpi-mom">--</div>
                        <div class="sr-delta fl"></div>
                    </div>
                </section>

                <section class="section">
                    <h2 class="section-title">CPI by Category</h2>
                    <div class="table-wrapper" id="cpi-categories">
                        <p class="hint-text">Category breakdown will appear once CPI data pipeline is live.</p>
                    </div>
                </section>

                <section class="section">
                    <h2 class="section-title">Inflation Calculator</h2>
                    <div style="max-width: 500px;">
                        <div style="display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;">
                            <div style="flex: 1; min-width: 120px;">
                                <label style="display:block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-3); margin-bottom: 4px;">Amount ($)</label>
                                <input type="number" id="calc-amount" class="filter-input" value="1000" min="0" style="max-width:100%;">
                            </div>
                            <div style="flex: 1; min-width: 100px;">
                                <label style="display:block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-3); margin-bottom: 4px;">From Year</label>
                                <input type="number" id="calc-from" class="filter-input" value="2014" min="1913" max="2026" style="max-width:100%;">
                            </div>
                            <div style="flex: 1; min-width: 100px;">
                                <label style="display:block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-3); margin-bottom: 4px;">To Year</label>
                                <input type="number" id="calc-to" class="filter-input" value="2024" min="1913" max="2026" style="max-width:100%;">
                            </div>
                        </div>
                        <div id="calc-result" class="sr-card" style="text-align: center;">
                            <div class="sr-label">Equivalent Value</div>
                            <div class="sr-value" id="calc-value">--</div>
                            <div class="sr-delta fl" id="calc-change"></div>
                        </div>
                    </div>
                </section>

                <div class="fresh">
                    <strong>Note:</strong>
                    <span>CPI data and inflation calculator will use real BLS data once the pipeline is deployed. Currently showing placeholder layout.</span>
                </div>
            </div>
        `;

        loadCPIData();
        initCalculator();
    }

    async function loadCPIData() {
        try {
            const cpi = await BLSLoader.loadCPI();
            if (cpi) {
                if (cpi.current) setEl('cpi-index', Formatters.cpi(cpi.current));
                if (cpi.yoy_change != null) setEl('cpi-yoy', Formatters.percent(cpi.yoy_change));
                if (cpi.mom_change != null) setEl('cpi-mom', Formatters.percent(cpi.mom_change));
            }
        } catch { /* stay at placeholder */ }

        try {
            const cats = await BLSLoader.loadCPICategories();
            if (cats && cats.length > 0) {
                const wrap = document.getElementById('cpi-categories');
                if (!wrap) return;
                wrap.innerHTML = `
                    <table class="data-table">
                        <thead>
                            <tr>
                                <th>Category</th>
                                <th class="value-cell">Index</th>
                                <th class="value-cell">YoY Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${cats.map(c => {
                                const changeClass = c.yoy_change > 0 ? 'up' : c.yoy_change < 0 ? 'dn' : 'fl';
                                return `
                                    <tr>
                                        <td>${c.name}</td>
                                        <td class="value-cell">${Formatters.cpi(c.index)}</td>
                                        <td class="value-cell sr-delta ${changeClass}">${Formatters.change(c.yoy_change)}</td>
                                    </tr>
                                `;
                            }).join('')}
                        </tbody>
                    </table>
                `;
            }
        } catch { /* stay at placeholder */ }
    }

    function initCalculator() {
        const amountEl = document.getElementById('calc-amount');
        const fromEl = document.getElementById('calc-from');
        const toEl = document.getElementById('calc-to');

        function calculate() {
            const amount = parseFloat(amountEl?.value);
            const from = parseInt(fromEl?.value);
            const to = parseInt(toEl?.value);

            if (isNaN(amount) || isNaN(from) || isNaN(to)) return;

            // Simple CPI ratio approximation (avg ~3% annual inflation)
            // Will be replaced with real CPI data when pipeline is live
            const years = to - from;
            const rate = 0.03;
            const factor = Math.pow(1 + rate, years);
            const result = amount * factor;
            const pctChange = ((result - amount) / amount) * 100;

            setEl('calc-value', Formatters.salary(result));
            const changeEl = document.getElementById('calc-change');
            if (changeEl) {
                changeEl.textContent = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% change`;
                changeEl.className = 'sr-delta ' + (pctChange > 0 ? 'up' : pctChange < 0 ? 'dn' : 'fl');
            }
        }

        amountEl?.addEventListener('input', calculate);
        fromEl?.addEventListener('input', calculate);
        toEl?.addEventListener('input', calculate);

        calculate();
    }

    function setEl(id, text) {
        const el = document.getElementById(id);
        if (el && text) el.textContent = text;
    }

    function unmount() {}

    return { getTitle, mount, unmount };
})();

window.PricesPage = PricesPage;
