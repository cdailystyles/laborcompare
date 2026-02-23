/**
 * LaborCompare - Main Application Init
 * Registers routes and initializes the SPA.
 */

(function () {
    'use strict';

    // ================================================================
    // Register routes
    // ================================================================
    Router.register('/', HomePage);
    Router.register('/occupation/:soc', OccupationPage);
    Router.register('/area/:fips', AreaProfilePage);
    Router.register('/map', MapExplorerPage);
    Router.register('/compare', ComparePage);

    // ================================================================
    // Global UI: header search, modals, mobile menu
    // ================================================================
    function initGlobalUI() {
        // Header search (desktop)
        const headerInput = document.getElementById('header-search-input');
        const headerDropdown = document.getElementById('header-search-dropdown');
        if (headerInput && headerDropdown) {
            Search.attach(headerInput, headerDropdown);
        }

        // Mobile search
        const mobileInput = document.getElementById('mobile-search-input');
        const mobileDropdown = document.getElementById('mobile-search-dropdown');
        if (mobileInput && mobileDropdown) {
            Search.attach(mobileInput, mobileDropdown);
        }

        // Sources modal
        const sourcesModal = document.getElementById('sources-modal');
        const openSources = () => sourcesModal?.classList.add('active');
        const closeSources = () => sourcesModal?.classList.remove('active');

        document.getElementById('sources-btn')?.addEventListener('click', openSources);
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

        // Close mobile nav on navigation
        mobileNav?.querySelectorAll('.mobile-nav-link').forEach(link => {
            link.addEventListener('click', closeMobileNav);
        });

        // Close mobile nav on route change
        window.addEventListener('hashchange', closeMobileNav);

        // Update active nav link
        window.addEventListener('hashchange', updateActiveNav);
        updateActiveNav();

        // Keyboard shortcut: / to focus search
        document.addEventListener('keydown', (e) => {
            if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
                const active = document.activeElement;
                if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.tagName === 'SELECT') return;
                e.preventDefault();
                headerInput?.focus();
            }
        });
    }

    function updateActiveNav() {
        const hash = window.location.hash || '#/';
        document.querySelectorAll('.nav-link[data-route], .mobile-nav-link[data-route]').forEach(link => {
            const route = link.dataset.route;
            const isActive = (route === 'home' && (hash === '#/' || hash === '#'))
                || (route && hash.startsWith('#/' + route));
            link.classList.toggle('active', isActive);
        });
    }

    // ================================================================
    // Boot
    // ================================================================
    function init() {
        initGlobalUI();
        Router.init();
    }

    // Start when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
