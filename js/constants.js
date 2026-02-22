/**
 * LaborCompare - Constants and Shared Utilities
 */

const FIELD_MAP = {
    'unemployment_rate': 'unemployment_rate',
    'labor_force_participation': 'labor_force_participation_rate',
    'nonfarm_employment': 'total_nonfarm_employment',
    'job_growth': 'job_growth_yoy',
    'avg_hourly_earnings': 'avg_hourly_earnings',
    'avg_weekly_earnings': 'avg_weekly_earnings',
    'median_income': 'median_household_income',
    'median_earnings': 'median_earnings',
    'per_capita_income': 'per_capita_income',
    'minimum_wage': 'minimum_wage',
    'population': 'population',
    'median_age': 'median_age',
    'poverty_rate': 'poverty_rate',
    'gini_index': 'gini_index',
    'bachelors_or_higher_pct': 'bachelors_or_higher_pct',
    'hs_diploma_or_higher_pct': 'hs_diploma_or_higher_pct',
    'homeownership_rate': 'homeownership_rate',
    'vacancy_rate': 'vacancy_rate',
    'labor_force': 'labor_force',
    'employment': 'employment',
    'avg_weekly_hours': 'avg_weekly_hours'
};

// Connecticut FIPS mapping (same as welfarecompare)
const CT_FIPS_MAP = {
    '09001': '09120',
    '09003': '09110',
    '09005': '09160',
    '09007': '09130',
    '09009': '09170',
    '09011': '09180',
    '09013': '09110',
    '09015': '09150'
};

// All programs that use economic/labor data (not hardcoded welfare data)
const LABOR_INDICATORS = [
    'unemployment_rate', 'labor_force_participation', 'nonfarm_employment',
    'job_growth', 'avg_hourly_earnings', 'avg_weekly_earnings',
    'median_income', 'median_earnings', 'per_capita_income',
    'minimum_wage', 'population', 'median_age', 'poverty_rate',
    'gini_index', 'bachelors_or_higher_pct', 'hs_diploma_or_higher_pct',
    'homeownership_rate', 'vacancy_rate', 'labor_force', 'employment',
    'avg_weekly_hours'
];

const STATES_GEOJSON_URL = 'https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json';

const MAP_CONFIG = {
    center: [40, -98],
    defaultZoom: 4,
    minZoom: 2,
    maxZoom: 10
};

const MOBILE_BREAKPOINT = 768;

function normalizeCtFips(fips) {
    if (fips && fips.startsWith('09') && CT_FIPS_MAP[fips]) {
        return CT_FIPS_MAP[fips];
    }
    return fips;
}

function getDataField(program) {
    return FIELD_MAP[program] || program;
}

function isLaborIndicator(program) {
    return LABOR_INDICATORS.includes(program) || program.startsWith('ratio_');
}

function isMobile() {
    return window.innerWidth <= MOBILE_BREAKPOINT;
}

window.Constants = {
    FIELD_MAP, CT_FIPS_MAP, LABOR_INDICATORS,
    STATES_GEOJSON_URL, MAP_CONFIG, MOBILE_BREAKPOINT,
    normalizeCtFips, getDataField, isLaborIndicator, isMobile
};
