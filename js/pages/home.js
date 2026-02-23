/**
 * LaborCompare — Home Page
 * Search bar + quick-access cards + explore by sector
 */

const HomePage = (() => {
    function getTitle() {
        return 'Search Jobs, Wages & Employment';
    }

    async function mount(params, container) {
        container.innerHTML = `
            <div class="home-page">
                <!-- Hero search -->
                <section class="home-hero">
                    <h1 class="home-title">What does <em>any job</em> pay in <em>any place</em>?</h1>
                    <p class="home-subtitle">Search 830+ occupations across all 50 states and 400+ metro areas</p>
                    <div class="home-search-wrapper">
                        <div class="home-search">
                            <svg class="search-icon" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <circle cx="11" cy="11" r="8"/>
                                <path d="M21 21l-4.35-4.35"/>
                            </svg>
                            <input type="text"
                                   id="home-search-input"
                                   class="search-input search-input-lg"
                                   placeholder="Search for an occupation or place... (e.g. &quot;nurse&quot;, &quot;Dallas&quot;)"
                                   autocomplete="off"
                                   spellcheck="false"
                                   autofocus>
                            <div class="search-dropdown" id="home-search-dropdown"></div>
                        </div>
                    </div>
                </section>

                <!-- Quick access cards -->
                <section class="home-section">
                    <h2 class="home-section-title">Quick Look</h2>
                    <div class="quick-cards" id="quick-cards">
                        <div class="quick-card loading-shimmer" style="height: 120px;"></div>
                        <div class="quick-card loading-shimmer" style="height: 120px;"></div>
                        <div class="quick-card loading-shimmer" style="height: 120px;"></div>
                    </div>
                </section>

                <!-- Explore by sector -->
                <section class="home-section">
                    <h2 class="home-section-title">Explore by Sector</h2>
                    <div class="sector-grid" id="sector-grid"></div>
                </section>

                <!-- Explore by location -->
                <section class="home-section">
                    <h2 class="home-section-title">Explore by State</h2>
                    <div class="state-list" id="state-list"></div>
                </section>

                <footer class="home-footer">
                    <p>Data from the Bureau of Labor Statistics, U.S. Census Bureau, and Bureau of Economic Analysis.</p>
                    <p>
                        <a href="#/map">Map Explorer</a> ·
                        <a href="#/compare">Compare Tool</a> ·
                        <button class="link-btn" id="home-sources-btn">Sources</button>
                    </p>
                </footer>
            </div>
        `;

        // Attach search
        const input = document.getElementById('home-search-input');
        const dropdown = document.getElementById('home-search-dropdown');
        Search.attach(input, dropdown);

        // Sources button
        document.getElementById('home-sources-btn')?.addEventListener('click', () => {
            document.getElementById('sources-modal').classList.add('active');
        });

        // Load quick cards and sector grid
        loadQuickCards();
        renderSectorGrid();
        renderStateList();
    }

    async function loadQuickCards() {
        const container = document.getElementById('quick-cards');
        if (!container) return;

        try {
            const national = await OEWSLoader.loadNational();
            if (!national?.occupations) {
                container.innerHTML = '<p class="hint-text">Occupation data not yet loaded. Run the OEWS pipeline to populate.</p>';
                return;
            }

            const occs = Object.entries(national.occupations);

            // Highest paying
            const topPaying = occs
                .filter(([, d]) => d.med != null)
                .sort((a, b) => b[1].med - a[1].med)
                .slice(0, 5);

            // Most employed
            const mostEmployed = occs
                .filter(([, d]) => d.emp != null)
                .sort((a, b) => b[1].emp - a[1].emp)
                .slice(0, 5);

            // Lowest paying (often searched by students/researchers)
            const lowestPaying = occs
                .filter(([, d]) => d.med != null && d.med > 0)
                .sort((a, b) => a[1].med - b[1].med)
                .slice(0, 5);

            container.innerHTML = `
                ${renderQuickCard('Highest Paying Jobs', topPaying, 'med')}
                ${renderQuickCard('Most Workers', mostEmployed, 'emp')}
                ${renderQuickCard('Lowest Paying Jobs', lowestPaying, 'med')}
            `;

            // Add click handlers
            container.querySelectorAll('[data-soc]').forEach(el => {
                el.addEventListener('click', () => {
                    Router.navigate(`/occupation/${el.dataset.soc}`);
                });
            });
        } catch (err) {
            container.innerHTML = '<p class="hint-text">Unable to load occupation data.</p>';
        }
    }

    function renderQuickCard(title, items, field) {
        const rows = items.map(([soc, data]) => {
            const value = field === 'emp' ? Formatters.count(data[field]) : Formatters.salary(data[field]);
            return `<li data-soc="${soc}"><span class="qc-name">${data.title}</span><span class="qc-value">${value}</span></li>`;
        }).join('');

        return `
            <div class="quick-card">
                <h3 class="quick-card-title">${title}</h3>
                <ul class="quick-card-list">${rows}</ul>
            </div>
        `;
    }

    function renderSectorGrid() {
        const container = document.getElementById('sector-grid');
        if (!container) return;

        const groups = Constants.SOC_MAJOR_GROUPS;
        container.innerHTML = Object.entries(groups)
            .filter(([code]) => code !== '55') // Skip military
            .map(([code, title]) => `
                <a href="#/area/sector-${code}" class="sector-tile" title="${title}">
                    <span class="sector-code">${code}</span>
                    <span class="sector-name">${title}</span>
                </a>
            `).join('');
    }

    function renderStateList() {
        const container = document.getElementById('state-list');
        if (!container) return;

        const states = Constants.STATE_FIPS_TO_NAME;
        container.innerHTML = Object.entries(states)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(([fips, name]) => `
                <a href="#/area/${fips}" class="state-link">${name}</a>
            `).join('');
    }

    function unmount() {
        // Cleanup if needed
    }

    return { getTitle, mount, unmount };
})();

window.HomePage = HomePage;
