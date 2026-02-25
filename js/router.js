/**
 * LaborCompare - Hash Router
 * Simple SPA router using hash-based navigation.
 *
 * Routes:
 *   #/                        Home (search + quick cards)
 *   #/occupation/{soc}        Occupation detail page
 *   #/area/{fips}             Area profile page (state or metro)
 *   #/map                     Choropleth map explorer
 *   #/compare                 Comparison tool
 */

const Router = (() => {
    const routes = {};
    let currentPage = null;
    let currentRoute = null;

    /**
     * Register a route handler
     * @param {string} pattern - Route pattern (e.g., '/occupation/:soc')
     * @param {object} handler - { init(), mount(params), unmount() }
     */
    function register(pattern, handler) {
        routes[pattern] = handler;
    }

    /**
     * Match a hash path against registered routes
     * Returns { handler, params } or null
     */
    function matchRoute(path) {
        // Normalize path
        if (!path || path === '#' || path === '#/') path = '/';
        else if (path.startsWith('#/')) path = path.slice(1);
        else if (path.startsWith('#')) path = '/' + path.slice(1);
        if (!path.startsWith('/')) path = '/' + path;

        // Try exact match first
        if (routes[path]) {
            return { handler: routes[path], params: {}, path };
        }

        // Try parameterized routes
        for (const [pattern, handler] of Object.entries(routes)) {
            const patternParts = pattern.split('/');
            const pathParts = path.split('/');

            if (patternParts.length !== pathParts.length) continue;

            const params = {};
            let match = true;

            for (let i = 0; i < patternParts.length; i++) {
                if (patternParts[i].startsWith(':')) {
                    params[patternParts[i].slice(1)] = decodeURIComponent(pathParts[i]);
                } else if (patternParts[i] !== pathParts[i]) {
                    match = false;
                    break;
                }
            }

            if (match) {
                return { handler, params, path };
            }
        }

        return null;
    }

    /**
     * Navigate to a route
     */
    function navigate(path) {
        if (!path.startsWith('#')) path = '#' + path;
        window.location.hash = path;
    }

    /**
     * Handle hash change
     */
    async function handleRoute() {
        const hash = window.location.hash || '#/';
        const matched = matchRoute(hash);

        if (!matched) {
            // Fallback to home
            navigate('/');
            return;
        }

        const { handler, params, path } = matched;

        // Unmount current page if different route pattern
        if (currentPage && currentPage !== handler) {
            if (typeof currentPage.unmount === 'function') {
                currentPage.unmount();
            }
        }

        // Get page container
        const container = document.getElementById('page-container');
        if (!container) return;

        // Update current
        currentPage = handler;
        currentRoute = path;

        // Mount new page
        try {
            if (typeof handler.mount === 'function') {
                await handler.mount(params, container);
            }
        } catch (err) {
            console.error('Route error:', err);
            container.innerHTML = `
                <div class="page-error">
                    <h2>Something went wrong</h2>
                    <p>${err.message}</p>
                    <a href="#/" class="btn-back">Back to Home</a>
                </div>`;
        }

        // Update page title
        if (typeof handler.getTitle === 'function') {
            document.title = handler.getTitle(params) + ' | LaborCompare';
        }

        // Track pageview in Google Analytics
        if (typeof gtag === 'function') {
            gtag('event', 'page_view', {
                page_path: '/' + (hash.startsWith('#') ? hash.slice(1) : hash),
                page_title: document.title
            });
        }

        // Scroll to top
        window.scrollTo(0, 0);
    }

    /**
     * Initialize the router
     */
    function init() {
        window.addEventListener('hashchange', handleRoute);

        // Initialize all registered routes
        for (const handler of Object.values(routes)) {
            if (typeof handler.init === 'function') {
                handler.init();
            }
        }

        // Handle initial route
        handleRoute();
    }

    /**
     * Get current route info
     */
    function getCurrent() {
        return { route: currentRoute, page: currentPage };
    }

    return { register, navigate, init, getCurrent, matchRoute };
})();

window.Router = Router;
