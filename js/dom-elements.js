/**
 * LaborCompare - DOM Element Cache
 */

const DOM = {};

function cacheDOMElements() {
    DOM.tooltip = document.getElementById('custom-tooltip');
    DOM.loadingOverlay = document.getElementById('loading-overlay');
    DOM.infoLocation = document.querySelector('.info-location');
    DOM.infoContent = document.getElementById('info-content');
    DOM.mobileInfoLocation = document.querySelector('#mobile-info-header .info-location');
    DOM.mobileInfoContent = document.getElementById('mobile-info-content');
    DOM.legend = document.getElementById('legend');
    DOM.statsContent = document.getElementById('stats-content');
    DOM.mobileLegend = document.getElementById('mobile-legend-content');
    DOM.mobileStatsContent = document.getElementById('mobile-stats-content');
    DOM.contextProgram = document.getElementById('context-program');
    DOM.programSelect = document.getElementById('program-select');
    DOM.countyProgramSelect = document.getElementById('county-program-select');
    DOM.metroProgramSelect = document.getElementById('metro-program-select');
    DOM.mobileProgramSelect = document.getElementById('mobile-program-select');
    DOM.mobileCountyProgramSelect = document.getElementById('mobile-county-program-select');
    DOM.mobileMetroProgramSelect = document.getElementById('mobile-metro-program-select');
    DOM.stateProgramSection = document.getElementById('state-program-section');
    DOM.countyProgramSection = document.getElementById('county-program-section');
    DOM.metroProgramSection = document.getElementById('metro-program-section');
    DOM.mobileStateProgramSection = document.getElementById('mobile-state-program-section');
    DOM.mobileCountyProgramSection = document.getElementById('mobile-county-program-section');
    DOM.mobileMetroProgramSection = document.getElementById('mobile-metro-program-section');
    DOM.stateViewBtn = document.getElementById('state-view-btn');
    DOM.metroViewBtn = document.getElementById('metro-view-btn');
    DOM.countyViewBtn = document.getElementById('county-view-btn');
    DOM.mobileStateViewBtn = document.getElementById('mobile-state-view-btn');
    DOM.mobileMetroViewBtn = document.getElementById('mobile-metro-view-btn');
    DOM.mobileCountyViewBtn = document.getElementById('mobile-county-view-btn');
    DOM.ratioNumerator = document.getElementById('ratio-numerator');
    DOM.ratioDenominator = document.getElementById('ratio-denominator');
    DOM.ratioSwapBtn = document.getElementById('ratio-swap-btn');
    DOM.ratioSection = document.getElementById('ratio-section');
    DOM.modeToggleBtn = document.getElementById('mode-toggle-btn');
    DOM.dataLabel = document.getElementById('data-label');
    DOM.ratioLabel = document.getElementById('ratio-label');
    DOM.mobileRatioNumerator = document.getElementById('mobile-ratio-numerator');
    DOM.mobileRatioDenominator = document.getElementById('mobile-ratio-denominator');
    DOM.mobileRatioSwapBtn = document.getElementById('mobile-ratio-swap-btn');
    DOM.mobileRatioSection = document.getElementById('mobile-ratio-section');
    DOM.mobileModeToggleBtn = document.getElementById('mobile-mode-toggle-btn');
    DOM.mobileDataLabel = document.getElementById('mobile-data-label');
    DOM.mobileRatioLabel = document.getElementById('mobile-ratio-label');
    DOM.countyBackSection = document.getElementById('county-back-section');
    DOM.mobileCountyBackSection = document.getElementById('mobile-county-back-section');
    DOM.currentStateLabel = document.getElementById('current-state-label');
    DOM.mobileCurrentStateLabel = document.getElementById('mobile-current-state-label');
    DOM.compareModal = document.getElementById('compare-modal');
    DOM.sourcesModal = document.getElementById('sources-modal');
    DOM.mobileTabs = document.querySelectorAll('.mobile-tab');
    DOM.mobileTabContents = document.querySelectorAll('.mobile-tab-content');
}

function getElement(id) {
    const cacheKey = id.replace(/-/g, '');
    return DOM[cacheKey] || document.getElementById(id);
}

window.DOM = DOM;
window.cacheDOMElements = cacheDOMElements;
window.getElement = getElement;
