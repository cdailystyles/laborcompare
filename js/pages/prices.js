/**
 * LaborCompare — Prices Page
 * CPI headline stats, category breakdown, inflation calculator
 * Route: #/prices
 */

const PricesPage = (() => {
    // Hardcoded CPI category data (BLS December 2025 release) as fallback
    const FALLBACK_CATEGORIES = [
        { name: 'All Items', index: 315.5, yoy_change: 3.0 },
        { name: 'Food', index: 333.7, yoy_change: 2.5 },
        { name: 'Shelter', index: 406.4, yoy_change: 4.6 },
        { name: 'Energy', index: 274.8, yoy_change: -0.5 },
        { name: 'Medical Care', index: 560.3, yoy_change: 3.1 },
        { name: 'Transportation', index: 282.9, yoy_change: -0.8 },
        { name: 'Apparel', index: 130.6, yoy_change: 0.2 },
        { name: 'Education & Communication', index: 176.4, yoy_change: 1.9 },
        { name: 'Recreation', index: 136.0, yoy_change: 1.3 }
    ];

    // Historical CPI-U annual averages for inflation calculator
    const CPI_ANNUAL = {
        1980: 82.4, 1985: 107.6, 1990: 130.7, 1995: 152.4, 2000: 172.2,
        2005: 195.3, 2010: 218.1, 2011: 224.9, 2012: 229.6, 2013: 233.0,
        2014: 236.7, 2015: 237.0, 2016: 240.0, 2017: 245.1, 2018: 251.1,
        2019: 255.7, 2020: 258.8, 2021: 271.0, 2022: 292.7, 2023: 304.7,
        2024: 313.5, 2025: 315.5
    };

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
                        <div class="sr-value" id="cpi-index">315.5</div>
                        <div class="sr-delta fl" id="cpi-index-d">1982-84 = 100</div>
                    </div>
                    <div class="sr-card">
                        <div class="sr-label">YoY Change</div>
                        <div class="sr-value" id="cpi-yoy">3.0%</div>
                        <div class="sr-delta up" id="cpi-yoy-d">&#9650; 0.1 pts</div>
                    </div>
                    <div class="sr-card">
                        <div class="sr-label">MoM Change</div>
                        <div class="sr-value" id="cpi-mom">0.4%</div>
                        <div class="sr-delta fl"></div>
                    </div>
                </section>

                <section class="section">
                    <h2 class="section-title">CPI by Category</h2>
                    <div class="table-wrapper" id="cpi-categories"></div>
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
                                <select id="calc-from" class="select-input" style="width:100%;"></select>
                            </div>
                            <div style="flex: 1; min-width: 100px;">
                                <label style="display:block; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-3); margin-bottom: 4px;">To Year</label>
                                <select id="calc-to" class="select-input" style="width:100%;"></select>
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
                    <strong>Source:</strong>
                    <span>Bureau of Labor Statistics — Consumer Price Index. Base period: 1982-84 = 100. Updated monthly.</span>
                </div>
            </div>
        `;

        loadCPIData();
        initCalculator();
    }

    async function loadCPIData() {
        let categories = FALLBACK_CATEGORIES;

        // Try loading real CPI data from pipeline
        try {
            const cpi = await BLSLoader.loadCPI();
            if (cpi) {
                if (cpi.current) setEl('cpi-index', Formatters.cpi(cpi.current));
                if (cpi.yoy_change != null) setEl('cpi-yoy', Formatters.percent(cpi.yoy_change));
                if (cpi.mom_change != null) setEl('cpi-mom', Formatters.percent(cpi.mom_change));
            }
        } catch { /* use defaults */ }

        try {
            const cats = await BLSLoader.loadCPICategories();
            if (cats && cats.length > 0) {
                categories = cats;
            }
        } catch { /* use fallback */ }

        // Render categories table
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
                    ${categories.map(c => {
                        const changeClass = c.yoy_change > 0 ? 'up' : c.yoy_change < 0 ? 'dn' : 'fl';
                        const sign = c.yoy_change > 0 ? '+' : '';
                        return `
                            <tr>
                                <td>${c.name}</td>
                                <td class="value-cell">${c.index.toFixed(1)}</td>
                                <td class="value-cell sr-delta ${changeClass}">${sign}${c.yoy_change.toFixed(1)}%</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    function initCalculator() {
        const amountEl = document.getElementById('calc-amount');
        const fromEl = document.getElementById('calc-from');
        const toEl = document.getElementById('calc-to');

        // Populate year dropdowns
        const years = Object.keys(CPI_ANNUAL).map(Number).sort((a, b) => b - a);
        for (const y of years) {
            fromEl.innerHTML += `<option value="${y}" ${y === 2000 ? 'selected' : ''}>${y}</option>`;
            toEl.innerHTML += `<option value="${y}" ${y === 2025 ? 'selected' : ''}>${y}</option>`;
        }

        function calculate() {
            const amount = parseFloat(amountEl?.value);
            const from = parseInt(fromEl?.value);
            const to = parseInt(toEl?.value);

            if (isNaN(amount) || isNaN(from) || isNaN(to)) return;
            if (!CPI_ANNUAL[from] || !CPI_ANNUAL[to]) return;

            const factor = CPI_ANNUAL[to] / CPI_ANNUAL[from];
            const result = amount * factor;
            const pctChange = ((result - amount) / amount) * 100;

            setEl('calc-value', '$' + result.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
            const changeEl = document.getElementById('calc-change');
            if (changeEl) {
                changeEl.textContent = `${pctChange >= 0 ? '+' : ''}${pctChange.toFixed(1)}% cumulative inflation`;
                changeEl.className = 'sr-delta ' + (pctChange > 0 ? 'up' : pctChange < 0 ? 'dn' : 'fl');
            }
        }

        amountEl?.addEventListener('input', calculate);
        fromEl?.addEventListener('change', calculate);
        toEl?.addEventListener('change', calculate);

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
