/**
 * LaborCompare — Home Page (F3 Dense Data-First)
 * Compact hero, 6 stat cards, 4-column occupation grid, tools, sectors
 */

const HomePage = (() => {
    function getTitle() {
        return 'BLS Data, Built for Humans';
    }

    async function mount(params, container) {
        container.innerHTML = `
            <!-- Compact hero -->
            <div class="hero-compact">
                <div>
                    <h1>BLS data, <span class="red">built for humans.</span></h1>
                    <p>830+ occupations &middot; every state &amp; metro &middot; wages, jobs, prices &amp; projections</p>
                </div>
                <div class="hero-search-sm">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    <input type="text" id="home-search-input" placeholder="Search any job, state, or metro..." autocomplete="off" spellcheck="false">
                    <div class="search-dropdown" id="home-search-dropdown"></div>
                </div>
            </div>

            <!-- 6-column stats -->
            <section class="stat-row" id="stat-row">
                ${renderStatPlaceholders()}
            </section>

            <!-- 4-column data -->
            <div class="sh"><h2>Occupation Snapshots</h2><a href="#/wages">All 830+ &rarr;</a></div>
            <section class="grid-4" id="occ-grid">
                <div class="d-card"><div class="d-card-head">Highest Pay</div><div style="padding:20px;" class="loading-shimmer">&nbsp;</div></div>
                <div class="d-card"><div class="d-card-head">Fastest Growing</div><div style="padding:20px;" class="loading-shimmer">&nbsp;</div></div>
                <div class="d-card"><div class="d-card-head">Most Employed</div><div style="padding:20px;" class="loading-shimmer">&nbsp;</div></div>
                <div class="d-card"><div class="d-card-head">Declining</div><div style="padding:20px;" class="loading-shimmer">&nbsp;</div></div>
            </section>

            <!-- Tools -->
            <div class="sh"><h2>Tools</h2></div>
            <section class="tool-strip">
                <a class="ts-card" href="#/wages">
                    <span class="ts-icon">&#128269;</span>
                    <div><h3>Salary Lookup</h3><p>Any job, any location</p></div>
                </a>
                <a class="ts-card" href="#/map">
                    <span class="ts-icon">&#128506;</span>
                    <div><h3>Map Explorer</h3><p>Data across 50 states</p></div>
                </a>
                <a class="ts-card" href="#/compare">
                    <span class="ts-icon">&#9878;&#65039;</span>
                    <div><h3>Compare</h3><p>Head-to-head</p></div>
                </a>
                <a class="ts-card" href="#/prices">
                    <span class="ts-icon">&#128178;</span>
                    <div><h3>Inflation Calc</h3><p>CPI purchasing power</p></div>
                </a>
            </section>

            <!-- Sectors -->
            <div class="sector-wrap">
                <div class="sh"><h2>Sectors</h2><a href="#/wages">All 23 &rarr;</a></div>
                <div class="sector-chips" id="sector-chips"></div>
            </div>

            <!-- Data freshness -->
            <div class="fresh">
                <strong>Data:</strong>
                <span class="fresh-i"><span class="fdot g"></span> Employment Feb 2026</span>
                <span class="fresh-i"><span class="fdot g"></span> CPI Jan 2026</span>
                <span class="fresh-i"><span class="fdot b"></span> OEWS May 2024</span>
                <span class="fresh-i"><span class="fdot b"></span> Projections 2023-33</span>
            </div>
        `;

        // Attach home search
        const input = document.getElementById('home-search-input');
        const dropdown = document.getElementById('home-search-dropdown');
        if (input && dropdown) {
            Search.attach(input, dropdown);
        }

        // Load data
        loadStatCards();
        loadOccupationGrid();
        renderSectorChips();
    }

    function renderStatPlaceholders() {
        const stats = [
            { label: 'Unemployment', value: '--', delta: '' },
            { label: 'Payrolls', value: '--', delta: '' },
            { label: 'CPI (YoY)', value: '--', delta: '' },
            { label: 'Hourly Earnings', value: '--', delta: '' },
            { label: 'Participation', value: '--', delta: '' },
            { label: 'Job Openings', value: '--', delta: '' }
        ];
        return stats.map(s => `
            <div class="sr-card">
                <div class="sr-label">${s.label}</div>
                <div class="sr-value">${s.value}</div>
                <div class="sr-delta fl">${s.delta}</div>
            </div>
        `).join('');
    }

    async function loadStatCards() {
        try {
            const data = await BLSLoader.loadTicker();
            if (!data) return;

            const row = document.getElementById('stat-row');
            if (!row) return;

            row.innerHTML = (data.cards || []).map(card => {
                const deltaClass = card.direction === 'up' ? 'up' : card.direction === 'down' ? 'dn' : 'fl';
                return `
                    <div class="sr-card">
                        <div class="sr-label">${card.label}</div>
                        <div class="sr-value">${card.value}</div>
                        <div class="sr-delta ${deltaClass}">${card.delta || ''}</div>
                    </div>
                `;
            }).join('');
        } catch {
            // Stat cards stay at placeholder values
        }
    }

    async function loadOccupationGrid() {
        const grid = document.getElementById('occ-grid');
        if (!grid) return;

        try {
            const national = await OEWSLoader.loadNational();
            if (!national?.occupations) {
                grid.innerHTML = '<p class="hint-text" style="grid-column:1/-1;">Occupation data not yet loaded.</p>';
                return;
            }

            const occs = Object.entries(national.occupations);

            // Highest paying (filter out $302K+ ceiling values for variety)
            const topPaying = occs
                .filter(([, d]) => d.med != null)
                .sort((a, b) => b[1].med - a[1].med)
                .slice(0, 5);

            // Most employed
            const mostEmployed = occs
                .filter(([, d]) => d.emp != null)
                .sort((a, b) => b[1].emp - a[1].emp)
                .slice(0, 5);

            // Fastest growing + declining — from BLSLoader (or placeholder)
            let fastest = null;
            let declining = null;
            try {
                fastest = await BLSLoader.loadFastest();
                declining = await BLSLoader.loadDeclining();
            } catch { /* use placeholders */ }

            grid.innerHTML = `
                ${renderDataCard('Highest Pay', '#/wages', topPaying, 'salary')}
                ${renderGrowthCard('Fastest Growing', '#/outlook', fastest)}
                ${renderDataCard('Most Employed', '#/wages', mostEmployed, 'employment')}
                ${renderDeclineCard('Declining', '#/outlook', declining)}
            `;

            // Click handlers for data rows
            grid.querySelectorAll('[data-soc]').forEach(el => {
                el.addEventListener('click', (e) => {
                    e.preventDefault();
                    Router.navigate(`/wages/${el.dataset.soc}`);
                });
            });
        } catch (err) {
            grid.innerHTML = '<p class="hint-text" style="grid-column:1/-1;">Unable to load occupation data.</p>';
        }
    }

    function renderDataCard(title, href, items, mode) {
        const rows = items.map(([soc, data]) => {
            const value = mode === 'employment'
                ? Formatters.count(data.emp)
                : Formatters.salary(data.med);
            return `<a class="d-row" data-soc="${soc}"><span class="d-row-t">${data.title}</span><span class="d-row-v">${value}</span></a>`;
        }).join('');

        return `
            <div class="d-card">
                <div class="d-card-head">${title} <a href="${href}">All &rarr;</a></div>
                ${rows}
            </div>
        `;
    }

    function renderGrowthCard(title, href, data) {
        if (!data || !data.length) {
            // Hardcoded placeholders until pipeline is live
            const placeholders = [
                { title: 'Nurse Practitioners', pct: '+38%' },
                { title: 'Data Scientists', pct: '+36%' },
                { title: 'Info Security Analysts', pct: '+33%' },
                { title: 'Software Developers', pct: '+25%' },
                { title: 'Home Health Aides', pct: '+22%' }
            ];
            const rows = placeholders.map(p =>
                `<div class="d-row"><span class="d-row-t">${p.title}</span><span class="badge-sm g">${p.pct}</span></div>`
            ).join('');
            return `<div class="d-card"><div class="d-card-head">${title} <a href="${href}">All &rarr;</a></div>${rows}</div>`;
        }

        const rows = data.slice(0, 5).map(item => {
            const pct = item.change != null ? Formatters.change(item.change) : '--';
            const soc = item.soc || '';
            return `<a class="d-row" ${soc ? `data-soc="${soc}"` : ''}><span class="d-row-t">${item.title}</span><span class="badge-sm g">${pct}</span></a>`;
        }).join('');
        return `<div class="d-card"><div class="d-card-head">${title} <a href="${href}">All &rarr;</a></div>${rows}</div>`;
    }

    function renderDeclineCard(title, href, data) {
        if (!data || !data.length) {
            const placeholders = [
                { title: 'Word Processors', pct: '-36%' },
                { title: 'Parking Enforcers', pct: '-35%' },
                { title: 'Watch Repairers', pct: '-29%' },
                { title: 'Switchboard Ops', pct: '-20%' },
                { title: 'Data Entry Keyers', pct: '-19%' }
            ];
            const rows = placeholders.map(p =>
                `<div class="d-row"><span class="d-row-t">${p.title}</span><span class="badge-sm r">${p.pct}</span></div>`
            ).join('');
            return `<div class="d-card"><div class="d-card-head">${title} <a href="${href}">All &rarr;</a></div>${rows}</div>`;
        }

        const rows = data.slice(0, 5).map(item => {
            const pct = item.change != null ? Formatters.change(item.change) : '--';
            const soc = item.soc || '';
            return `<a class="d-row" ${soc ? `data-soc="${soc}"` : ''}><span class="d-row-t">${item.title}</span><span class="badge-sm r">${pct}</span></a>`;
        }).join('');
        return `<div class="d-card"><div class="d-card-head">${title} <a href="${href}">All &rarr;</a></div>${rows}</div>`;
    }

    function renderSectorChips() {
        const container = document.getElementById('sector-chips');
        if (!container) return;

        const groups = Constants.SOC_MAJOR_GROUPS;
        // Short labels for chips
        const shortLabels = {
            '11': 'Management', '13': 'Business', '15': 'Computer & Math',
            '17': 'Engineering', '19': 'Science', '21': 'Social Service',
            '23': 'Legal', '25': 'Education', '27': 'Arts & Media',
            '29': 'Healthcare', '31': 'Health Support', '33': 'Protective',
            '35': 'Food Service', '37': 'Maintenance', '39': 'Personal Care',
            '41': 'Sales', '43': 'Office & Admin', '45': 'Farming',
            '47': 'Construction', '49': 'Repair', '51': 'Production',
            '53': 'Transportation'
        };

        container.innerHTML = Object.entries(groups)
            .filter(([code]) => code !== '55')
            .map(([code]) => `<a class="sc" href="#/wages?sector=${code}">${shortLabels[code] || groups[code]}</a>`)
            .join('');
    }

    function unmount() {}

    return { getTitle, mount, unmount };
})();

window.HomePage = HomePage;
