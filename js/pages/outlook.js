/**
 * LaborCompare — Outlook Page
 * Employment projections: fastest growing, most new jobs, declining
 * Route: #/outlook
 */

const OutlookPage = (() => {
    function getTitle() {
        return 'Outlook — Employment Projections';
    }

    async function mount(params, container) {
        container.innerHTML = `
            <div class="wages-page">
                <nav class="breadcrumb">
                    <a href="#/">Home</a>
                    <span class="breadcrumb-sep">/</span>
                    <span>Outlook</span>
                </nav>

                <h1 class="page-title">Employment Projections (2024-2034)</h1>

                <section class="section">
                    <h2 class="section-title">Fastest Growing Occupations</h2>
                    <div class="table-wrapper" id="fastest-table">
                        <div class="page-loading"><div class="loader"></div></div>
                    </div>
                </section>

                <section class="section">
                    <h2 class="section-title">Most New Jobs</h2>
                    <div class="table-wrapper" id="growth-table">
                        <div class="page-loading"><div class="loader"></div></div>
                    </div>
                </section>

                <section class="section">
                    <h2 class="section-title">Declining Occupations</h2>
                    <div class="table-wrapper" id="declining-table">
                        <div class="page-loading"><div class="loader"></div></div>
                    </div>
                </section>

                <div class="fresh">
                    <strong>Source:</strong>
                    <span>Bureau of Labor Statistics — Employment Projections 2024-2034. Updated biennially via automated data pipeline.</span>
                </div>
            </div>
        `;

        loadProjections();
    }

    async function loadProjections() {
        // Try loading from data files
        const [fastest, declining, mostGrowth] = await Promise.all([
            BLSLoader.loadFastest(),
            BLSLoader.loadDeclining(),
            BLSLoader.loadMostGrowth()
        ]);

        // Fastest growing
        const fastestEl = document.getElementById('fastest-table');
        if (fastestEl) {
            if (fastest && fastest.length > 0) {
                fastestEl.innerHTML = renderProjectionTable(fastest, 'change');
            } else {
                fastestEl.innerHTML = renderPlaceholderFastest();
            }
        }

        // Most new jobs
        const growthEl = document.getElementById('growth-table');
        if (growthEl) {
            if (mostGrowth && mostGrowth.length > 0) {
                growthEl.innerHTML = renderProjectionTable(mostGrowth, 'new_jobs');
            } else {
                growthEl.innerHTML = renderPlaceholderGrowth();
            }
        }

        // Declining
        const decliningEl = document.getElementById('declining-table');
        if (decliningEl) {
            if (declining && declining.length > 0) {
                decliningEl.innerHTML = renderProjectionTable(declining, 'change');
            } else {
                decliningEl.innerHTML = renderPlaceholderDeclining();
            }
        }

        // Attach click handlers
        document.querySelectorAll('[data-soc]').forEach(el => {
            el.addEventListener('click', () => Router.navigate(`/wages/${el.dataset.soc}`));
        });
    }

    function renderProjectionTable(items, valueField) {
        return `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>#</th>
                        <th>Occupation</th>
                        <th class="value-cell">${valueField === 'change' ? 'Projected Change' : 'New Jobs'}</th>
                        <th class="value-cell">Median Salary</th>
                    </tr>
                </thead>
                <tbody>
                    ${items.slice(0, 30).map((item, i) => {
                        const val = valueField === 'change'
                            ? Formatters.change(item.change)
                            : Formatters.count(item.new_jobs);
                        return `
                            <tr class="clickable-row" ${item.soc ? `data-soc="${item.soc}"` : ''}>
                                <td>${i + 1}</td>
                                <td>${item.title}</td>
                                <td class="value-cell">${val}</td>
                                <td class="value-cell">${item.median ? Formatters.salary(item.median) : '--'}</td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        `;
    }

    function renderPlaceholderFastest() {
        const data = [
            { title: 'Nurse Practitioners', change: 38, median: 126260 },
            { title: 'Data Scientists', change: 36, median: 108020 },
            { title: 'Information Security Analysts', change: 33, median: 120360 },
            { title: 'Medical & Health Services Managers', change: 28, median: 110680 },
            { title: 'Software Developers', change: 25, median: 132270 },
            { title: 'Physician Assistants', change: 27, median: 130020 },
            { title: 'Epidemiologists', change: 27, median: 81390 },
            { title: 'Physical Therapist Assistants', change: 24, median: 64080 },
            { title: 'Statisticians', change: 30, median: 104110 },
            { title: 'Home Health & Personal Care Aides', change: 22, median: 33530 }
        ];
        return renderProjectionTable(data, 'change');
    }

    function renderPlaceholderGrowth() {
        const data = [
            { title: 'Home Health & Personal Care Aides', new_jobs: 820200, median: 33530 },
            { title: 'Software Developers', new_jobs: 451200, median: 132270 },
            { title: 'Nurse Practitioners', new_jobs: 118600, median: 126260 },
            { title: 'Medical & Health Services Managers', new_jobs: 144700, median: 110680 },
            { title: 'Restaurant Cooks', new_jobs: 150700, median: 33770 },
            { title: 'Data Scientists', new_jobs: 59400, median: 108020 },
            { title: 'General & Operations Managers', new_jobs: 183100, median: 101280 },
            { title: 'Registered Nurses', new_jobs: 177400, median: 86070 },
            { title: 'Market Research Analysts', new_jobs: 99800, median: 74680 },
            { title: 'Financial Managers', new_jobs: 111800, median: 156100 }
        ];
        return renderProjectionTable(data, 'new_jobs');
    }

    function renderPlaceholderDeclining() {
        const data = [
            { title: 'Word Processors & Typists', change: -36, median: 46460 },
            { title: 'Parking Enforcement Workers', change: -35, median: 41740 },
            { title: 'Watch & Clock Repairers', change: -29, median: 46970 },
            { title: 'Switchboard Operators', change: -20, median: 35050 },
            { title: 'Data Entry Keyers', change: -19, median: 37970 },
            { title: 'Nuclear Power Reactor Operators', change: -16, median: 113110 },
            { title: 'Shoe Machine Operators', change: -16, median: 32350 },
            { title: 'Executive Secretaries', change: -15, median: 67230 },
            { title: 'Postal Service Mail Carriers', change: -13, median: 53440 },
            { title: 'Printing Press Operators', change: -12, median: 39100 }
        ];
        return renderProjectionTable(data, 'change');
    }

    function unmount() {}

    return { getTitle, mount, unmount };
})();

window.OutlookPage = OutlookPage;
