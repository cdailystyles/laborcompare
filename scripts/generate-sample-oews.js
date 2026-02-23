/**
 * generate-sample-oews.js
 * Creates sample OEWS data files for initial deployment.
 * Uses realistic 2023 BLS OEWS data for common occupations.
 * Run once locally, then commit the generated files.
 */

import { writeFileSync, mkdirSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const OEWS_DIR = path.join(DATA_DIR, 'oews');

// Sample occupation data (realistic 2023 OEWS national figures)
const OCCUPATIONS = {
  '11-1021': { title: 'General and Operations Managers', emp: 3182870, med: 101280, avg: 122430, hmed: 48.69, havg: 58.86, p10: 47740, p25: 66700, p75: 140940, p90: 208000 },
  '11-3021': { title: 'Computer and Information Systems Managers', emp: 509830, med: 164070, avg: 173670, hmed: 78.88, havg: 83.50, p10: 95570, p25: 125830, p75: 208000, p90: 208000 },
  '11-9013': { title: 'Farmers, Ranchers, and Other Agricultural Managers', emp: 7520, med: 80050, avg: 89780, hmed: 38.49, havg: 43.16, p10: 40420, p25: 54960, p75: 107880, p90: 143790 },
  '13-1161': { title: 'Market Research Analysts and Marketing Specialists', emp: 904800, med: 74680, avg: 82350, hmed: 35.90, havg: 39.59, p10: 40580, p25: 53750, p75: 99970, p90: 131850 },
  '13-2011': { title: 'Accountants and Auditors', emp: 1366810, med: 79880, avg: 86740, hmed: 38.40, havg: 41.70, p10: 49970, p25: 61740, p75: 101640, p90: 132690 },
  '15-1252': { title: 'Software Developers', emp: 1795300, med: 130160, avg: 135780, hmed: 62.58, havg: 65.28, p10: 74600, p25: 99710, p75: 166560, p90: 197500 },
  '15-1211': { title: 'Computer Systems Analysts', emp: 533240, med: 103800, avg: 105520, hmed: 49.90, havg: 50.73, p10: 62020, p25: 79620, p75: 128530, p90: 153120 },
  '15-1232': { title: 'Computer User Support Specialists', emp: 656550, med: 57890, avg: 61170, hmed: 27.83, havg: 29.41, p10: 35260, p25: 44020, p75: 73990, p90: 93600 },
  '15-1256': { title: 'Software Quality Assurance Analysts and Testers', emp: 199740, med: 101800, avg: 106140, hmed: 48.94, havg: 51.03, p10: 54070, p25: 76040, p75: 130960, p90: 160240 },
  '17-2112': { title: 'Industrial Engineers', emp: 309190, med: 99380, avg: 101990, hmed: 47.78, havg: 49.03, p10: 63350, p25: 78550, p75: 122340, p90: 148560 },
  '19-1042': { title: 'Medical Scientists, Except Epidemiologists', emp: 137930, med: 100890, avg: 110240, hmed: 48.50, havg: 53.00, p10: 52560, p25: 71060, p75: 132910, p90: 177170 },
  '21-1021': { title: 'Child, Family, and School Social Workers', emp: 345310, med: 53060, avg: 55160, hmed: 25.51, havg: 26.52, p10: 33890, p25: 41280, p75: 65720, p90: 79580 },
  '23-1011': { title: 'Lawyers', emp: 803900, med: 145760, avg: 163770, hmed: 70.08, havg: 78.74, p10: 65080, p25: 88900, p75: 198900, p90: 208000 },
  '25-2021': { title: 'Elementary School Teachers, Except Special Education', emp: 1401000, med: 63670, avg: 66360, hmed: null, havg: null, p10: 44970, p25: 51060, p75: 79890, p90: 99500 },
  '25-2031': { title: 'Secondary School Teachers, Except Special and Career/Technical Education', emp: 1048730, med: 65220, avg: 68970, hmed: null, havg: null, p10: 45860, p25: 52150, p75: 82480, p90: 104180 },
  '27-1024': { title: 'Graphic Designers', emp: 254240, med: 57990, avg: 63450, hmed: 27.88, havg: 30.51, p10: 33870, p25: 43870, p75: 76820, p90: 100090 },
  '29-1141': { title: 'Registered Nurses', emp: 3175390, med: 86070, avg: 89010, hmed: 41.38, havg: 42.79, p10: 59450, p25: 69340, p75: 102100, p90: 129400 },
  '29-1171': { title: 'Nurse Practitioners', emp: 264740, med: 126260, avg: 126480, hmed: 60.70, havg: 60.81, p10: 86590, p25: 105660, p75: 147060, p90: 168200 },
  '29-1228': { title: 'Physicians, All Other', emp: 50630, med: 229300, avg: 239200, hmed: 110.24, havg: 115.00, p10: 74490, p25: 134850, p75: 208000, p90: 208000 },
  '29-2061': { title: 'Licensed Practical and Licensed Vocational Nurses', emp: 658220, med: 55860, avg: 56090, hmed: 26.86, havg: 26.97, p10: 38200, p25: 45430, p75: 64050, p90: 72400 },
  '31-1120': { title: 'Home Health and Personal Care Aides', emp: 3832700, med: 33530, avg: 34130, hmed: 16.12, havg: 16.41, p10: 24440, p25: 28020, p75: 38350, p90: 43890 },
  '33-3051': { title: 'Police and Sheriff\'s Patrol Officers', emp: 669600, med: 74910, avg: 77410, hmed: 36.02, havg: 37.22, p10: 43560, p25: 56530, p75: 93070, p90: 107440 },
  '35-2014': { title: 'Cooks, Restaurant', emp: 1468150, med: 33150, avg: 35140, hmed: 15.94, havg: 16.89, p10: 24760, p25: 27900, p75: 39480, p90: 48270 },
  '35-3023': { title: 'Fast Food and Counter Workers', emp: 3737710, med: 28990, avg: 29680, hmed: 13.94, havg: 14.27, p10: 21310, p25: 24080, p75: 33510, p90: 39370 },
  '37-2011': { title: 'Janitors and Cleaners, Except Maids and Housekeeping Cleaners', emp: 2172670, med: 33390, avg: 35360, hmed: 16.05, havg: 17.00, p10: 24080, p25: 27420, p75: 40240, p90: 49570 },
  '39-9011': { title: 'Childcare Workers', emp: 556390, med: 30120, avg: 31950, hmed: 14.48, havg: 15.36, p10: 21340, p25: 24270, p75: 36420, p90: 44840 },
  '41-2031': { title: 'Retail Salespersons', emp: 3748960, med: 33020, avg: 37480, hmed: 15.87, havg: 18.02, p10: 23780, p25: 27070, p75: 41310, p90: 56820 },
  '41-3091': { title: 'Sales Representatives of Services, Except Advertising, Insurance, Financial Services, and Travel', emp: 1113180, med: 65630, avg: 78710, hmed: 31.55, havg: 37.84, p10: 33710, p25: 44340, p75: 95740, p90: 140970 },
  '43-3031': { title: 'Bookkeeping, Accounting, and Auditing Clerks', emp: 1380980, med: 47440, avg: 49490, hmed: 22.81, havg: 23.79, p10: 30860, p25: 37650, p75: 58100, p90: 68720 },
  '43-4051': { title: 'Customer Service Representatives', emp: 2857000, med: 39680, avg: 41690, hmed: 19.08, havg: 20.04, p10: 27720, p25: 32350, p75: 48290, p90: 57990 },
  '43-6014': { title: 'Secretaries and Administrative Assistants, Except Legal, Medical, and Executive', emp: 1838640, med: 43660, avg: 44820, hmed: 20.99, havg: 21.55, p10: 29120, p25: 35310, p75: 52550, p90: 60580 },
  '47-2061': { title: 'Construction Laborers', emp: 952940, med: 43500, avg: 46750, hmed: 20.91, havg: 22.48, p10: 29580, p25: 34590, p75: 55690, p90: 68410 },
  '47-2111': { title: 'Electricians', emp: 731400, med: 61590, avg: 66200, hmed: 29.61, havg: 31.83, p10: 37020, p25: 46370, p75: 79920, p90: 104180 },
  '49-3023': { title: 'Automotive Service Technicians and Mechanics', emp: 694770, med: 47930, avg: 51110, hmed: 23.04, havg: 24.57, p10: 30280, p25: 36670, p75: 61870, p90: 77090 },
  '49-9071': { title: 'Maintenance and Repair Workers, General', emp: 1458570, med: 46700, avg: 49290, hmed: 22.45, havg: 23.70, p10: 30390, p25: 36680, p75: 58940, p90: 72490 },
  '51-2098': { title: 'Assemblers and Fabricators, All Other', emp: 995870, med: 38490, avg: 40010, hmed: 18.50, havg: 19.24, p10: 27600, p25: 31780, p75: 46430, p90: 55070 },
  '53-3032': { title: 'Heavy and Tractor-Trailer Truck Drivers', emp: 2012440, med: 54320, avg: 56460, hmed: 26.11, havg: 27.14, p10: 35060, p25: 43260, p75: 66150, p90: 76400 },
  '53-7062': { title: 'Laborers and Freight, Stock, and Material Movers, Hand', emp: 3020350, med: 35530, avg: 37590, hmed: 17.08, havg: 18.07, p10: 25090, p25: 28870, p75: 42640, p90: 53050 },
  '15-1299': { title: 'Computer Occupations, All Other', emp: 426150, med: 99710, avg: 104200, hmed: 47.94, havg: 50.10, p10: 52570, p25: 71350, p75: 129950, p90: 159030 },
  '29-1051': { title: 'Pharmacists', emp: 323030, med: 136030, avg: 132750, hmed: 65.40, havg: 63.82, p10: 88750, p25: 117690, p75: 154880, p90: 163540 },
  '29-1123': { title: 'Physical Therapists', emp: 226620, med: 99710, avg: 100520, hmed: 47.94, havg: 48.33, p10: 65630, p25: 80760, p75: 115960, p90: 130220 },
  '29-1071': { title: 'Physician Assistants', emp: 148030, med: 130020, avg: 130850, hmed: 62.51, havg: 62.91, p10: 82830, p25: 107680, p75: 155090, p90: 175970 },
  '15-2051': { title: 'Data Scientists', emp: 192710, med: 108020, avg: 113220, hmed: 51.93, havg: 54.43, p10: 61860, p25: 82160, p75: 139640, p90: 174570 },
  '17-2051': { title: 'Civil Engineers', emp: 326690, med: 95890, avg: 101030, hmed: 46.10, havg: 48.57, p10: 61120, p25: 74990, p75: 121490, p90: 149790 },
  '11-9033': { title: 'Education Administrators, Postsecondary', emp: 195140, med: 102610, avg: 115300, hmed: 49.33, havg: 55.43, p10: 59470, p25: 75240, p75: 138250, p90: 195960 },
  '29-1215': { title: 'Family Medicine Physicians', emp: 109370, med: 224460, avg: 235930, hmed: 107.91, havg: 113.43, p10: 90770, p25: 165380, p75: 208000, p90: 208000 },
  '15-1244': { title: 'Network and Computer Systems Administrators', emp: 323660, med: 95360, avg: 97540, hmed: 45.85, havg: 46.89, p10: 57700, p25: 73260, p75: 117920, p90: 140610 },
  '53-3058': { title: 'Passenger Vehicle Drivers, Except Bus Drivers, Transit and Intercity', emp: 679380, med: 33660, avg: 37240, hmed: 16.18, havg: 17.90, p10: 22190, p25: 26170, p75: 42830, p90: 58020 },
  '41-4012': { title: 'Sales Representatives, Wholesale and Manufacturing, Except Technical and Scientific Products', emp: 1318950, med: 65630, avg: 74770, hmed: 31.55, havg: 35.95, p10: 34050, p25: 44940, p75: 92620, p90: 130700 },
};

// State FIPS + names
const STATES = {
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

// State wage multipliers (relative to national, based on real OEWS cost-of-living patterns)
const STATE_WAGE_MULT = {
  '01': 0.82, '02': 1.08, '04': 0.92, '05': 0.80, '06': 1.15, '08': 1.05, '09': 1.08,
  '10': 0.98, '11': 1.22, '12': 0.92, '13': 0.92, '15': 1.02, '16': 0.88, '17': 1.02,
  '18': 0.90, '19': 0.88, '20': 0.86, '21': 0.85, '22': 0.84, '23': 0.92, '24': 1.08,
  '25': 1.12, '26': 0.94, '27': 1.00, '28': 0.78, '29': 0.88, '30': 0.86, '31': 0.88,
  '32': 0.95, '33': 0.98, '34': 1.08, '35': 0.85, '36': 1.10, '37': 0.90, '38': 0.88,
  '39': 0.92, '40': 0.84, '41': 1.02, '42': 0.96, '44': 0.98, '45': 0.85, '46': 0.84,
  '47': 0.88, '48': 0.95, '49': 0.92, '50': 0.94, '51': 1.04, '53': 1.10, '54': 0.80,
  '55': 0.92, '56': 0.90
};

// State employment multipliers (rough proportion based on state workforce size)
const STATE_EMP_MULT = {
  '01': 0.015, '02': 0.002, '04': 0.022, '05': 0.008, '06': 0.115, '08': 0.019, '09': 0.012,
  '10': 0.003, '11': 0.005, '12': 0.065, '13': 0.032, '15': 0.004, '16': 0.006, '17': 0.041,
  '18': 0.021, '19': 0.010, '20': 0.009, '21': 0.013, '22': 0.013, '23': 0.004, '24': 0.020,
  '25': 0.025, '26': 0.030, '27': 0.020, '28': 0.008, '29': 0.019, '30': 0.003, '31': 0.007,
  '32': 0.010, '33': 0.005, '34': 0.030, '35': 0.006, '36': 0.065, '37': 0.031, '38': 0.003,
  '39': 0.036, '40': 0.012, '41': 0.013, '42': 0.042, '44': 0.004, '45': 0.015, '46': 0.003,
  '47': 0.021, '48': 0.090, '49': 0.011, '50': 0.002, '51': 0.028, '53': 0.025, '54': 0.005,
  '55': 0.019, '56': 0.002
};

function jitter(base, range = 0.05) {
  return Math.round(base * (1 + (Math.random() - 0.5) * 2 * range));
}

function main() {
  console.log('\n=== Generating Sample OEWS Data ===\n');

  const dirs = [
    OEWS_DIR,
    path.join(OEWS_DIR, 'occupations', 'by-state'),
    path.join(OEWS_DIR, 'occupations', 'by-metro'),
    path.join(OEWS_DIR, 'areas', 'states'),
    path.join(OEWS_DIR, 'areas', 'metros')
  ];
  dirs.forEach(d => mkdirSync(d, { recursive: true }));

  // 1. national.json
  console.log('1. Writing national.json...');
  const nationalOccs = {};
  for (const [soc, data] of Object.entries(OCCUPATIONS)) {
    nationalOccs[soc] = {
      title: data.title,
      emp: data.emp,
      med: data.med,
      avg: data.avg,
      hmed: data.hmed,
      havg: data.havg,
      p10: data.p10,
      p25: data.p25,
      p75: data.p75,
      p90: data.p90
    };
  }
  writeFileSync(path.join(OEWS_DIR, 'national.json'), JSON.stringify({
    year: '2023',
    count: Object.keys(nationalOccs).length,
    occupations: nationalOccs
  }));
  console.log(`  ${Object.keys(nationalOccs).length} occupations`);

  // 2. soc-hierarchy.json
  console.log('2. Writing soc-hierarchy.json...');
  const hierarchy = {};
  const majorNames = {
    '11': 'Management', '13': 'Business and Financial Operations', '15': 'Computer and Mathematical',
    '17': 'Architecture and Engineering', '19': 'Life, Physical, and Social Science',
    '21': 'Community and Social Service', '23': 'Legal', '25': 'Educational Instruction and Library',
    '27': 'Arts, Design, Entertainment, Sports, and Media', '29': 'Healthcare Practitioners and Technical',
    '31': 'Healthcare Support', '33': 'Protective Service', '35': 'Food Preparation and Serving Related',
    '37': 'Building and Grounds Cleaning and Maintenance', '39': 'Personal Care and Service',
    '41': 'Sales and Related', '43': 'Office and Administrative Support',
    '47': 'Construction and Extraction', '49': 'Installation, Maintenance, and Repair',
    '51': 'Production', '53': 'Transportation and Material Moving'
  };
  for (const [soc, data] of Object.entries(OCCUPATIONS)) {
    const major = soc.split('-')[0];
    if (!hierarchy[major]) {
      hierarchy[major] = { title: majorNames[major] || `Group ${major}`, occupations: [] };
    }
    hierarchy[major].occupations.push({ code: soc, title: data.title });
  }
  writeFileSync(path.join(OEWS_DIR, 'soc-hierarchy.json'), JSON.stringify(hierarchy));

  // 3. Per-occupation by-state files
  console.log('3. Writing per-occupation by-state files...');
  for (const [soc, data] of Object.entries(OCCUPATIONS)) {
    const states = {};
    for (const [fips, mult] of Object.entries(STATE_WAGE_MULT)) {
      const empMult = STATE_EMP_MULT[fips] || 0.01;
      states[fips] = {
        emp: Math.max(10, jitter(Math.round(data.emp * empMult), 0.15)),
        med: jitter(Math.round(data.med * mult), 0.03),
        avg: jitter(Math.round(data.avg * mult), 0.03),
      };
      if (data.hmed) states[fips].hmed = +(data.hmed * mult).toFixed(2);
    }
    writeFileSync(
      path.join(OEWS_DIR, 'occupations', 'by-state', `${soc}.json`),
      JSON.stringify({ soc, title: data.title, states })
    );
  }
  console.log(`  ${Object.keys(OCCUPATIONS).length} files`);

  // 4. Per-state area files
  console.log('4. Writing per-state area files...');
  for (const [fips, stateName] of Object.entries(STATES)) {
    const mult = STATE_WAGE_MULT[fips] || 0.90;
    const empMult = STATE_EMP_MULT[fips] || 0.01;
    const occs = {};
    for (const [soc, data] of Object.entries(OCCUPATIONS)) {
      occs[soc] = {
        title: data.title,
        emp: Math.max(10, jitter(Math.round(data.emp * empMult), 0.15)),
        med: jitter(Math.round(data.med * mult), 0.03),
        avg: jitter(Math.round(data.avg * mult), 0.03)
      };
    }
    writeFileSync(
      path.join(OEWS_DIR, 'areas', 'states', `${fips}.json`),
      JSON.stringify({ fips, name: stateName, count: Object.keys(occs).length, occupations: occs })
    );
  }
  console.log(`  ${Object.keys(STATES).length} state files`);

  // 5. search-index.json
  console.log('5. Writing search-index.json...');
  function keywords(title) {
    const words = title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').split(/[\s-]+/).filter(w => w.length > 1);
    const kw = new Set(words);
    for (const w of words) {
      if (w.endsWith('s') && w.length > 3) kw.add(w.slice(0, -1));
      if (w.endsWith('ers')) kw.add(w.slice(0, -3));
      if (w.endsWith('ists')) kw.add(w.slice(0, -1));
    }
    const stops = new Set(['and', 'or', 'the', 'of', 'in', 'for', 'all', 'other', 'except', 'not', 'with']);
    return [...kw].filter(k => !stops.has(k) && k.length > 1);
  }

  const stateAbbrevs = {
    'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
    'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
    'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
    'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
    'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
    'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
    'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
    'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR',
    'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
    'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA',
    'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY'
  };

  const index = {
    occupations: Object.entries(OCCUPATIONS)
      .map(([soc, d]) => ({ c: soc, t: d.title, k: keywords(d.title), med: d.med, emp: d.emp }))
      .sort((a, b) => (b.emp || 0) - (a.emp || 0)),
    areas: Object.entries(STATES)
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([fips, name]) => {
        const kw = keywords(name);
        const abbrev = stateAbbrevs[name];
        if (abbrev) kw.push(abbrev.toLowerCase());
        return { id: fips, t: name, type: 'state', k: kw };
      }),
    groups: Object.entries(hierarchy).map(([code, g]) => ({
      c: code, t: g.title, k: keywords(g.title), n: g.occupations.length
    }))
  };

  writeFileSync(path.join(DATA_DIR, 'search-index.json'), JSON.stringify(index));
  const sizeKB = (Buffer.byteLength(JSON.stringify(index)) / 1024).toFixed(1);
  console.log(`  ${index.occupations.length} occupations, ${index.areas.length} areas, ${sizeKB} KB`);

  console.log('\n=== Sample OEWS Data Complete ===');
}

main();
