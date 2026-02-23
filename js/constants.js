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

// SOC Major Groups — 23 occupational categories
const SOC_MAJOR_GROUPS = {
    '11': 'Management',
    '13': 'Business & Financial Operations',
    '15': 'Computer & Mathematical',
    '17': 'Architecture & Engineering',
    '19': 'Life, Physical & Social Science',
    '21': 'Community & Social Service',
    '23': 'Legal',
    '25': 'Educational Instruction & Library',
    '27': 'Arts, Design, Entertainment, Sports & Media',
    '29': 'Healthcare Practitioners & Technical',
    '31': 'Healthcare Support',
    '33': 'Protective Service',
    '35': 'Food Preparation & Serving Related',
    '37': 'Building & Grounds Cleaning & Maintenance',
    '39': 'Personal Care & Service',
    '41': 'Sales & Related',
    '43': 'Office & Administrative Support',
    '45': 'Farming, Fishing & Forestry',
    '47': 'Construction & Extraction',
    '49': 'Installation, Maintenance & Repair',
    '51': 'Production',
    '53': 'Transportation & Material Moving',
    '55': 'Military Specific'
};

// OEWS area type codes
const AREA_TYPES = {
    1: 'national',
    2: 'state',
    3: 'metro',
    4: 'nonmetro',
    6: 'county'
};

// State FIPS to name (for area pages)
const STATE_FIPS_TO_NAME = {
    '01': 'Alabama', '02': 'Alaska', '04': 'Arizona', '05': 'Arkansas',
    '06': 'California', '08': 'Colorado', '09': 'Connecticut', '10': 'Delaware',
    '11': 'District of Columbia', '12': 'Florida', '13': 'Georgia', '15': 'Hawaii',
    '16': 'Idaho', '17': 'Illinois', '18': 'Indiana', '19': 'Iowa',
    '20': 'Kansas', '21': 'Kentucky', '22': 'Louisiana', '23': 'Maine',
    '24': 'Maryland', '25': 'Massachusetts', '26': 'Michigan', '27': 'Minnesota',
    '28': 'Mississippi', '29': 'Missouri', '30': 'Montana', '31': 'Nebraska',
    '32': 'Nevada', '33': 'New Hampshire', '34': 'New Jersey', '35': 'New Mexico',
    '36': 'New York', '37': 'North Carolina', '38': 'North Dakota', '39': 'Ohio',
    '40': 'Oklahoma', '41': 'Oregon', '42': 'Pennsylvania', '44': 'Rhode Island',
    '45': 'South Carolina', '46': 'South Dakota', '47': 'Tennessee', '48': 'Texas',
    '49': 'Utah', '50': 'Vermont', '51': 'Virginia', '53': 'Washington',
    '54': 'West Virginia', '55': 'Wisconsin', '56': 'Wyoming'
};

// Reverse lookup: state name to FIPS
const STATE_NAME_TO_FIPS = Object.fromEntries(
    Object.entries(STATE_FIPS_TO_NAME).map(([k, v]) => [v, k])
);

window.Constants = {
    FIELD_MAP, CT_FIPS_MAP, LABOR_INDICATORS,
    STATES_GEOJSON_URL, MAP_CONFIG, MOBILE_BREAKPOINT,
    SOC_MAJOR_GROUPS, AREA_TYPES, STATE_FIPS_TO_NAME, STATE_NAME_TO_FIPS,
    normalizeCtFips, getDataField, isLaborIndicator, isMobile
};
