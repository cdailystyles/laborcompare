/**
 * LaborCompare - Main Application Init (F3 Dense Data-First)
 * Registers routes, initializes topbar ticker, search overlay, and nav.
 */

(function () {
    'use strict';

    // ================================================================
    // Register routes
    // ================================================================
    Router.register('/', HomePage);
    Router.register('/wages', WagesPage);
    Router.register('/wages/:soc', WagesPage);
    Router.register('/jobs', JobsPage);
    Router.register('/prices', PricesPage);
    Router.register('/states', StatesPage);
    Router.register('/states/:fips', StatesPage);
    Router.register('/outlook', OutlookPage);
    Router.register('/map', MapExplorerPage);
    Router.register('/compare', ComparePage);

    // Legacy redirects
    Router.register('/occupation/:soc', {
        getTitle: () => 'Redirecting...',
        mount: (params) => { Router.navigate(`/wages/${params.soc}`); },
        unmount: () => {}
    });
    Router.register('/area/:fips', {
        getTitle: () => 'Redirecting...',
        mount: (params) => { Router.navigate(`/states/${params.fips}`); },
        unmount: () => {}
    });

    // ================================================================
    // Topbar ticker
    // ================================================================
    async function initTicker() {
        try {
            const data = await BLSLoader.loadTicker();
            if (!data?.ticker) return;

            const topbar = document.getElementById('topbar');
            if (!topbar) return;

            topbar.innerHTML = data.ticker.map((item, i) => {
                let html = `<div class="tb-i"><span class="l">${item.label}</span><span class="v">${item.value}</span>`;
                if (item.delta) {
                    const cls = item.direction === 'up' ? 'u' : 'dn';
                    const arrow = item.direction === 'up' ? '&#9650;' : '&#9660;';
                    html += `<span class="d ${cls}">${arrow}${item.delta}</span>`;
                }
                html += '</div>';
                if (i < data.ticker.length - 1) html += '<div class="tb-s"></div>';
                return html;
            }).join('');
        } catch {
            // Ticker stays at placeholder values
        }
    }

    // ================================================================
    // Search overlay (command palette)
    // ================================================================
    function initSearchOverlay() {
        const overlay = document.getElementById('search-overlay');
        const input = document.getElementById('search-overlay-input');
        const resultsEl = document.getElementById('search-overlay-results');
        const trigger = document.getElementById('search-trigger');

        if (!overlay || !input || !resultsEl) return;

        let results = [];
        let selectedIdx = -1;
        let debounceTimer = null;

        function open() {
            overlay.classList.add('active');
            input.value = '';
            resultsEl.innerHTML = '';
            selectedIdx = -1;
            results = [];
            Search.loadIndex();
            setTimeout(() => input.focus(), 50);
        }

        function close() {
            overlay.classList.remove('active');
            input.blur();
        }

        function selectResult(result) {
            if (!result) return;
            close();
            switch (result.type) {
                case 'occupation':
                    Router.navigate(`/wages/${result.id}`);
                    break;
                case 'area':
                    Router.navigate(`/states/${result.id}`);
                    break;
                case 'group':
                    Router.navigate(`/wages?sector=${result.id}`);
                    break;
                default:
                    Router.navigate('/');
            }
        }

        function renderResults(searchResults) {
            results = searchResults;
            selectedIdx = -1;

            if (results.length === 0) {
                if (input.value.length >= 2) {
                    resultsEl.innerHTML = '<div class="search-no-results">No results found</div>';
                } else {
                    resultsEl.innerHTML = '';
                }
                return;
            }

            resultsEl.innerHTML = results.map((r, i) => `
                <div class="search-result ${i === selectedIdx ? 'selected' : ''}" data-idx="${i}">
                    <span class="search-result-icon">${getIcon(r.type)}</span>
                    <div class="search-result-text">
                        <span class="search-result-title">${r.title}</span>
                        <span class="search-result-subtitle">${r.subtitle}</span>
                    </div>
                    <span class="search-result-type">${r.type}</span>
                </div>
            `).join('');

            resultsEl.querySelectorAll('.search-result').forEach(el => {
                el.addEventListener('click', () => {
                    selectResult(results[parseInt(el.dataset.idx)]);
                });
            });
        }

        function getIcon(type) {
            switch (type) {
                case 'occupation': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2Z"/><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/></svg>';
                case 'area': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7Z"/><circle cx="12" cy="9" r="2.5"/></svg>';
                case 'group': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>';
                default: return '';
            }
        }

        function updateSelection() {
            const items = resultsEl.querySelectorAll('.search-result');
            items.forEach((el, i) => el.classList.toggle('selected', i === selectedIdx));
            if (selectedIdx >= 0 && items[selectedIdx]) {
                items[selectedIdx].scrollIntoView({ block: 'nearest' });
            }
        }

        // Trigger open
        trigger?.addEventListener('click', open);

        // Keyboard shortcut: / to open
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                const active = document.activeElement;
                if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.tagName === 'SELECT') return;
                e.preventDefault();
                open();
            }
        });

        // Close on backdrop click
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) close();
        });

        // Input handling
        input.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const q = input.value.trim();
                if (q.length < 2) {
                    resultsEl.innerHTML = '';
                    results = [];
                    return;
                }
                renderResults(Search.search(q));
            }, 150);
        });

        input.addEventListener('keydown', (e) => {
            switch (e.key) {
                case 'Escape':
                    e.preventDefault();
                    close();
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    if (results.length) {
                        selectedIdx = Math.min(selectedIdx + 1, results.length - 1);
                        updateSelection();
                    }
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    if (results.length) {
                        selectedIdx = Math.max(selectedIdx - 1, -1);
                        updateSelection();
                    }
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIdx >= 0) {
                        selectResult(results[selectedIdx]);
                    } else if (results.length > 0) {
                        selectResult(results[0]);
                    }
                    break;
            }
        });
    }

    // ================================================================
    // Global UI: modals, mobile menu, nav active state
    // ================================================================
    function initGlobalUI() {
        // Sources modal
        const sourcesModal = document.getElementById('sources-modal');
        const openSources = () => sourcesModal?.classList.add('active');
        const closeSources = () => sourcesModal?.classList.remove('active');

        document.getElementById('footer-sources-btn')?.addEventListener('click', (e) => {
            e.preventDefault();
            openSources();
        });
        document.getElementById('mobile-sources-btn')?.addEventListener('click', () => {
            closeMobileNav();
            openSources();
        });
        document.getElementById('close-sources')?.addEventListener('click', closeSources);
        sourcesModal?.addEventListener('click', (e) => {
            if (e.target === sourcesModal) closeSources();
        });

        // Mobile menu
        const mobileNav = document.getElementById('mobile-nav');
        const menuBtn = document.getElementById('mobile-menu-btn');

        function closeMobileNav() {
            mobileNav?.classList.remove('open');
        }

        menuBtn?.addEventListener('click', () => {
            mobileNav?.classList.toggle('open');
        });

        mobileNav?.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', closeMobileNav);
        });

        window.addEventListener('hashchange', closeMobileNav);

        // Update active nav link
        window.addEventListener('hashchange', updateActiveNav);
        updateActiveNav();
    }

    function updateActiveNav() {
        const hash = window.location.hash || '#/';

        // Desktop nav
        document.querySelectorAll('#main-nav a[data-route]').forEach(link => {
            const route = link.dataset.route;
            let isActive = false;
            if (route === 'home') {
                isActive = hash === '#/' || hash === '#' || hash === '';
            } else if (route) {
                isActive = hash === `#/${route}` || hash.startsWith(`#/${route}/`);
            }
            link.classList.toggle('active', isActive);
        });

        // Mobile nav
        document.querySelectorAll('.mobile-nav-link[data-route]').forEach(link => {
            const route = link.dataset.route;
            let isActive = false;
            if (route === 'home') {
                isActive = hash === '#/' || hash === '#' || hash === '';
            } else if (route) {
                isActive = hash === `#/${route}` || hash.startsWith(`#/${route}/`);
            }
            link.classList.toggle('active', isActive);
        });
    }

    // ================================================================
    // Dynamic meta tags per route
    // ================================================================
    const META_DEFAULTS = {
        title: 'LaborCompare — BLS Data, Built for Humans',
        description: 'Search 830+ occupations across every state and metro area. Wages, jobs, prices, and projections from the Bureau of Labor Statistics, redesigned for humans.'
    };

    const ROUTE_META = {
        '/': META_DEFAULTS,
        '/wages': { title: 'Wages — LaborCompare', description: 'Browse salaries for 830+ occupations. National medians, state breakdowns, and metro-level wage data from BLS OEWS.' },
        '/jobs': { title: 'Jobs & Employment — LaborCompare', description: 'Employment situation, payrolls, unemployment, and JOLTS data. Job openings, hires, and quits trends.' },
        '/prices': { title: 'Prices & Inflation — LaborCompare', description: 'Consumer Price Index (CPI) trends, category breakdowns, and an inflation calculator.' },
        '/states': { title: 'States — LaborCompare', description: 'Compare economic indicators across all 50 states. Unemployment, income, and top occupations by state.' },
        '/outlook': { title: 'Job Outlook — LaborCompare', description: 'Fastest growing, most new jobs, and declining occupations. BLS employment projections 2023-2033.' },
        '/map': { title: 'Map Explorer — LaborCompare', description: 'Interactive choropleth map of wages, unemployment, and economic indicators across US states.' },
        '/compare': { title: 'Compare — LaborCompare', description: 'Side-by-side comparison of occupations or states. Wages, employment, and economic data.' }
    };

    function updateMeta() {
        const hash = window.location.hash || '#/';
        const path = hash.replace('#', '').split('?')[0];
        const basePath = '/' + (path.split('/').filter(Boolean)[0] || '');
        const meta = ROUTE_META[basePath] || META_DEFAULTS;

        document.title = meta.title;
        const descEl = document.querySelector('meta[name="description"]');
        if (descEl) descEl.setAttribute('content', meta.description);
        const ogTitle = document.querySelector('meta[property="og:title"]');
        if (ogTitle) ogTitle.setAttribute('content', meta.title.split(' — ')[0]);
        const ogDesc = document.querySelector('meta[property="og:description"]');
        if (ogDesc) ogDesc.setAttribute('content', meta.description);
    }

    // ================================================================
    // Lazy-load Leaflet
    // ================================================================
    window.loadLeaflet = (() => {
        let promise = null;
        return function () {
            if (window.L) return Promise.resolve();
            if (promise) return promise;
            promise = new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
                script.onload = resolve;
                script.onerror = () => reject(new Error('Failed to load Leaflet'));
                document.head.appendChild(script);
            });
            return promise;
        };
    })();

    // ================================================================
    // Boot
    // ================================================================
    function init() {
        initGlobalUI();
        initSearchOverlay();
        Router.init();

        // Pre-fetch ticker data
        initTicker();

        // Dynamic meta tags on route change
        window.addEventListener('hashchange', updateMeta);
        updateMeta();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
