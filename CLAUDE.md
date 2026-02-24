# LaborCompare — Claude Code Instructions

## Git Workflow
- **Always pull before working**: `git pull origin main` at the start of every session
- **Always push when done**: Stage, commit, and push all changes after completing work
- Never force push. Never amend published commits.

## Project Overview
Static SPA (no build step) at `laborcompare.com` — a user-friendly BLS.gov alternative.
Deployed via GitHub Pages; changes go live immediately on push to main.

## Tech Stack
- Vanilla HTML/CSS/JS (no frameworks, no build tools)
- Leaflet.js 1.9.4 for maps (CartoDB Positron light tiles)
- Google Fonts: Space Grotesk + Inter
- No Node.js or Python available locally — scripts run via GitHub Actions only

## Architecture
- Hash-based SPA router (`js/router.js`)
- Routes: `#/`, `#/wages`, `#/wages/:soc`, `#/jobs`, `#/prices`, `#/states`, `#/states/:fips`, `#/outlook`, `#/map`, `#/compare`
- Legacy redirects: `/occupation/:soc` → `/wages/:soc`, `/area/:fips` → `/states/:fips`
- Data loaders: `js/loaders/oews-loader.js` (wages), `js/loaders/bls-loader.js` (CPI/JOLTS/projections)
- All data in `data/` as static JSON files

## Design System (F3 Dense Data-First)
- Light theme: bg #f7f7f8, surface #ffffff, accent #dc2626 (red)
- Black topbar ticker, compact stat cards, 4-column data grids
- Brutalist hover effects (box-shadow: 2px 2px 0)
- Mockup source of truth: `mockups/concept-f3-dense-data.html`

## Version Convention
Format: `YYYY.MM.DD.N` (N starts at 1 per day)
Located in: `index.html` footer `.ftr-version` + Sources modal `.source-disclaimer`

## Data Pipeline Status
- **Live**: OEWS wages (830+ occupations × states/metros)
- **Placeholder**: CPI, JOLTS, employment projections (data files not yet generated)
- **ticker.json**: Hardcoded stats; will be auto-generated when pipeline is deployed
- Pipeline scripts in `scripts/`, run via `.github/workflows/update-data.yml`

## Rewrite Progress
- [x] Phase 1: Foundation (CSS, HTML shell, home page, app.js, new routes)
- [ ] Phase 2: Page rewrites (wages.js, states.js done; map-explorer restyled; compare restyled)
- [ ] Phase 3: New data pipelines (fetch-bls-cpi, fetch-bls-jolts, fetch-bls-projections)
- [ ] Phase 4: New pages with real data (prices, jobs, outlook populated)
- [ ] Phase 5: Cleanup (delete legacy files, polish)

## Legacy Files (DO NOT use, delete in Phase 5)
- `js/dom-elements.js`, `js/ui-updater.js`, `js/data.js`, `js/color-scales.js`
- `js/ratios.js`, `js/county-loader.js`, `js/metro-data.js`
- `js/pages/occupation.js`, `js/pages/area-profile.js`
