/**
 * LaborCompare - UI Updater
 * Consolidated UI update functions to eliminate desktop/mobile duplication
 */

const UIUpdater = {
    /**
     * Update both desktop and mobile elements with same content
     * @param {HTMLElement} desktopEl - Desktop element
     * @param {HTMLElement} mobileEl - Mobile element
     * @param {string} content - HTML content
     */
    updateDual(desktopEl, mobileEl, content) {
        if (desktopEl) desktopEl.innerHTML = content;
        if (mobileEl) mobileEl.innerHTML = content;
    },

    /**
     * Update legend content on both desktop and mobile
     * @param {string} html - Legend HTML content
     */
    updateLegend(html) {
        this.updateDual(DOM.legend, DOM.mobileLegend, html);
    },

    /**
     * Update stats content on both desktop and mobile
     * @param {string} html - Stats HTML content
     */
    updateStats(html) {
        this.updateDual(DOM.statsContent, DOM.mobileStatsContent, html);
    },

    /**
     * Update info panel location name
     * @param {string} name - Location name
     */
    updateLocationName(name) {
        if (DOM.infoLocation) DOM.infoLocation.textContent = name;
        if (DOM.mobileInfoLocation) DOM.mobileInfoLocation.textContent = name;
    },

    /**
     * Update info panel content
     * @param {string} html - Info panel HTML content
     */
    updateInfoContent(html) {
        this.updateDual(DOM.infoContent, DOM.mobileInfoContent, html);
    },

    /**
     * Full info panel update (location + content)
     * @param {string} locationName - Location name
     * @param {string} html - Info panel HTML content
     */
    updateInfoPanel(locationName, html) {
        this.updateLocationName(locationName);
        this.updateInfoContent(html);
    },

    /**
     * Sync select element values between desktop and mobile
     * @param {string} desktopId - Desktop select ID
     * @param {string} mobileId - Mobile select ID
     * @param {string} value - Value to set
     */
    syncSelects(desktopId, mobileId, value) {
        const desktop = document.getElementById(desktopId);
        const mobile = document.getElementById(mobileId);
        if (desktop) desktop.value = value;
        if (mobile) mobile.value = value;
    },

    /**
     * Show or hide an element
     * @param {HTMLElement} element - Element to show/hide
     * @param {boolean} visible - Whether to show
     * @param {string} displayType - Display type when visible (default: 'block')
     */
    setVisible(element, visible, displayType = 'block') {
        if (element) element.style.display = visible ? displayType : 'none';
    },

    /**
     * Toggle active class on view buttons
     * @param {string} activeView - Currently active view ('state', 'county', 'metro')
     */
    updateViewButtons(activeView) {
        const buttons = [
            { el: DOM.stateViewBtn, view: 'state' },
            { el: DOM.metroViewBtn, view: 'metro' },
            { el: DOM.countyViewBtn, view: 'county' },
            { el: DOM.mobileStateViewBtn, view: 'state' },
            { el: DOM.mobileMetroViewBtn, view: 'metro' },
            { el: DOM.mobileCountyViewBtn, view: 'county' }
        ];

        buttons.forEach(({ el, view }) => {
            if (el) el.classList.toggle('active', view === activeView);
        });
    },

    /**
     * Show/hide program sections based on current view
     * @param {string} view - Current view ('state', 'county', 'metro')
     */
    updateProgramSections(view) {
        const isState = view === 'state';
        const isCounty = view === 'county';
        const isMetro = view === 'metro';

        this.setVisible(DOM.stateProgramSection, isState);
        this.setVisible(DOM.mobileStateProgramSection, isState);
        this.setVisible(DOM.countyProgramSection, isCounty);
        this.setVisible(DOM.mobileCountyProgramSection, isCounty);
        this.setVisible(DOM.metroProgramSection, isMetro);
        this.setVisible(DOM.mobileMetroProgramSection, isMetro);
    },

    /**
     * Reset info panel to default state
     * @param {string} hintText - Hint text to display
     */
    resetInfoPanel(hintText) {
        this.updateLocationName('Select a Location');
        this.updateInfoContent(`<p class="hint-text">${hintText}</p>`);
    },

    /**
     * Show loading overlay
     */
    showLoading() {
        if (DOM.loadingOverlay) {
            DOM.loadingOverlay.innerHTML = '<div class="loader"></div><span>Loading...</span>';
            DOM.loadingOverlay.classList.remove('hidden');
        }
    },

    /**
     * Hide loading overlay
     */
    hideLoading() {
        if (DOM.loadingOverlay) {
            DOM.loadingOverlay.classList.add('hidden');
        }
    },

    /**
     * Show error in loading overlay with return button
     * @param {string} message - Error message
     * @param {Function} onReturn - Callback when return button clicked
     */
    showError(message, onReturn) {
        if (DOM.loadingOverlay) {
            DOM.loadingOverlay.innerHTML = `
                <span style="color: var(--danger);">${message}</span>
                <button id="error-return-btn" style="margin-top: 12px; padding: 8px 16px; background: var(--primary); color: white; border: none; border-radius: 6px; cursor: pointer;">
                    Return to State View
                </button>
            `;
            document.getElementById('error-return-btn')?.addEventListener('click', onReturn);
            DOM.loadingOverlay.classList.remove('hidden');
        }
    }
};

/**
 * Tooltip manager - consolidated tooltip handling
 */
const Tooltip = {
    /**
     * Show tooltip with content
     * @param {string} content - HTML content
     * @param {Event} event - Mouse event for positioning
     */
    show(content, event) {
        if (!DOM.tooltip) return;
        DOM.tooltip.innerHTML = content;
        DOM.tooltip.classList.add('visible');
        this.position(event);
    },

    /**
     * Hide tooltip
     */
    hide() {
        if (DOM.tooltip) {
            DOM.tooltip.classList.remove('visible');
        }
    },

    /**
     * Position tooltip near cursor
     * @param {Event} event - Mouse event
     */
    position(event) {
        if (!DOM.tooltip || !event) return;

        const clientX = event.originalEvent?.clientX || event.clientX;
        const clientY = event.originalEvent?.clientY || event.clientY;

        let x = clientX + 15;
        let y = clientY + 15;

        // Keep tooltip in viewport
        const rect = DOM.tooltip.getBoundingClientRect();
        const maxX = window.innerWidth - rect.width - 20;
        const maxY = window.innerHeight - rect.height - 20;

        DOM.tooltip.style.left = Math.min(x, maxX) + 'px';
        DOM.tooltip.style.top = Math.min(y, maxY) + 'px';
    },

    /**
     * Update tooltip position (for mousemove)
     * @param {Event} event - Mouse event
     */
    move(event) {
        this.position(event);
    }
};

/**
 * Info panel HTML builders - reusable components
 */
const InfoPanelBuilder = {
    /**
     * Build value header section
     * @param {string} value - Formatted value
     * @param {string} description - Description text
     * @param {string} badge - Optional badge text
     * @returns {string} HTML
     */
    valueHeader(value, description, badge = null) {
        return `
            <div class="info-value-large">${value}</div>
            <div class="info-description">
                ${description}
                ${badge ? `<span class="info-rank">${badge}</span>` : ''}
            </div>
        `;
    },

    /**
     * Build section title
     * @param {string} title - Section title
     * @returns {string} HTML
     */
    sectionTitle(title) {
        return `<div class="info-section-title">${title}</div>`;
    },

    /**
     * Build stats grid
     * @param {Array<{value: string, label: string}>} items - Stat items
     * @returns {string} HTML
     */
    statsGrid(items) {
        return `
            <div class="info-stats">
                ${items.map(item => `
                    <div class="info-stat">
                        <div class="info-stat-value">${item.value}</div>
                        <div class="info-stat-label">${item.label}</div>
                    </div>
                `).join('')}
            </div>
        `;
    },

    /**
     * Build funding breakdown
     * @param {number} fedPct - Federal percentage
     * @param {number} statePct - State percentage
     * @returns {string} HTML
     */
    fundingBreakdown(fedPct, statePct) {
        if (fedPct === 0 && statePct === 0) return '';
        return `
            <div class="funding-breakdown">
                <div class="funding-title">Funding Source</div>
                <div class="funding-bar">
                    <div class="funding-federal" style="width: ${fedPct}%"></div>
                    <div class="funding-state" style="width: ${statePct}%"></div>
                </div>
                <div class="funding-labels">
                    <span class="funding-label"><span class="funding-dot federal"></span> Federal ${fedPct}%</span>
                    <span class="funding-label"><span class="funding-dot state"></span> State ${statePct}%</span>
                </div>
            </div>
        `;
    },

    /**
     * Build data date footer
     * @param {string} year - Data year
     * @returns {string} HTML
     */
    dataDate(year) {
        return `
            <div class="info-data-date">
                <span class="data-date-label">Data as of ${year}</span>
            </div>
        `;
    },

    /**
     * Build comparison note
     * @param {string} text - Comparison text
     * @param {string} type - 'good', 'warning', or 'neutral'
     * @returns {string} HTML
     */
    comparison(text, type = 'neutral') {
        return `<div class="info-comparison ${type}">${text}</div>`;
    }
};

/**
 * Stats HTML builder
 */
const StatsBuilder = {
    /**
     * Build standard high/low/avg/disparity stats
     * @param {Object} stats - Stats object with max, min, average, disparity
     * @param {Function} formatFn - Value formatter function
     * @returns {string} HTML
     */
    standard(stats, formatFn) {
        return `
            <div class="stat-item high">
                <div class="stat-value">${formatFn(stats.max)}</div>
                <div class="stat-label">Highest</div>
            </div>
            <div class="stat-item low">
                <div class="stat-value">${formatFn(stats.min)}</div>
                <div class="stat-label">Lowest</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${formatFn(Math.round(stats.average))}</div>
                <div class="stat-label">Average</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${stats.disparity}x</div>
                <div class="stat-label">Disparity</div>
            </div>
        `;
    },

    /**
     * Build medicaid expanded/not expanded stats
     * @param {number} expanded - Number expanded
     * @param {number} notExpanded - Number not expanded
     * @returns {string} HTML
     */
    medicaid(expanded, notExpanded) {
        return `
            <div class="stat-item high">
                <div class="stat-value">${expanded}</div>
                <div class="stat-label">Expanded</div>
            </div>
            <div class="stat-item low">
                <div class="stat-value">${notExpanded}</div>
                <div class="stat-label">Not Expanded</div>
            </div>
        `;
    },

    /**
     * Build metro area stats
     * @param {number} total - Total areas
     * @param {number} metro - Metropolitan count
     * @param {number} micro - Micropolitan count
     * @returns {string} HTML
     */
    metro(total, metro, micro) {
        return `
            <div class="stat-card">
                <div class="stat-value">${total}</div>
                <div class="stat-label">Total Areas</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${metro}</div>
                <div class="stat-label">Metropolitan</div>
            </div>
            <div class="stat-card">
                <div class="stat-value">${micro}</div>
                <div class="stat-label">Micropolitan</div>
            </div>
        `;
    }
};

// Export to global scope
window.UIUpdater = UIUpdater;
window.Tooltip = Tooltip;
window.InfoPanelBuilder = InfoPanelBuilder;
window.StatsBuilder = StatsBuilder;
