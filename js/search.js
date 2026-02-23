/**
 * LaborCompare - Search Autocomplete
 * Fuzzy search across occupations, areas, and SOC groups.
 * Loads search-index.json lazily on first focus.
 */

const Search = (() => {
    let index = null;
    let loading = false;
    let activeInput = null;
    let selectedIdx = -1;
    let results = [];
    let dropdown = null;

    /**
     * Load the search index (lazy, once)
     */
    async function loadIndex() {
        if (index || loading) return;
        loading = true;
        try {
            const resp = await fetch('data/search-index.json');
            if (!resp.ok) throw new Error('Failed to load search index');
            index = await resp.json();
            console.log(`Search index loaded: ${index.occupations.length} occupations, ${index.areas.length} areas`);
        } catch (err) {
            console.error('Search index load failed:', err);
            index = { occupations: [], areas: [], groups: [] };
        }
        loading = false;
    }

    /**
     * Simple fuzzy match: does query appear as a substring in any keyword or title?
     * Returns a relevance score (higher = better match)
     */
    function scoreMatch(query, item) {
        const q = query.toLowerCase();
        const title = (item.t || '').toLowerCase();
        const keywords = item.k || [];

        // Exact title match — best
        if (title === q) return 100;

        // Title starts with query
        if (title.startsWith(q)) return 90;

        // Title contains query as word boundary
        if (title.includes(' ' + q) || title.includes(q + ' ')) return 80;

        // Title contains query
        if (title.includes(q)) return 70;

        // Keyword exact match
        for (const kw of keywords) {
            if (kw === q) return 60;
        }

        // Keyword starts with query
        for (const kw of keywords) {
            if (kw.startsWith(q)) return 50;
        }

        // Keyword contains query
        for (const kw of keywords) {
            if (kw.includes(q)) return 40;
        }

        // Multi-word: all query words found
        const qWords = q.split(/\s+/);
        if (qWords.length > 1) {
            const allFound = qWords.every(w =>
                title.includes(w) || keywords.some(kw => kw.includes(w))
            );
            if (allFound) return 35;
        }

        return 0;
    }

    /**
     * Search the index
     * @param {string} query
     * @param {number} limit
     * @returns {Array} results with { type, id, title, subtitle, score }
     */
    function search(query, limit = 12) {
        if (!index || !query || query.length < 2) return [];

        const q = query.trim();
        const matches = [];

        // Search occupations
        for (const occ of index.occupations) {
            const score = scoreMatch(q, occ);
            if (score > 0) {
                const subtitle = [];
                if (occ.med) subtitle.push(Formatters.salary(occ.med));
                if (occ.emp) subtitle.push(Formatters.count(occ.emp) + ' employed');
                matches.push({
                    type: 'occupation',
                    id: occ.c,
                    title: occ.t,
                    subtitle: subtitle.join(' · '),
                    score: score + (occ.emp ? Math.min(occ.emp / 1000000, 10) : 0) // Boost popular jobs
                });
            }
        }

        // Search areas
        for (const area of index.areas) {
            const score = scoreMatch(q, area);
            if (score > 0) {
                matches.push({
                    type: 'area',
                    id: area.id,
                    title: area.t,
                    subtitle: area.type === 'state' ? 'State' : 'Metro Area',
                    score: score + (area.type === 'state' ? 5 : 0) // Boost states slightly
                });
            }
        }

        // Search SOC groups
        for (const group of (index.groups || [])) {
            const score = scoreMatch(q, group);
            if (score > 0) {
                matches.push({
                    type: 'group',
                    id: group.c,
                    title: group.t,
                    subtitle: `${group.n} occupations`,
                    score
                });
            }
        }

        // Sort by score desc, then alphabetically
        matches.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

        return matches.slice(0, limit);
    }

    /**
     * Handle result selection
     */
    function selectResult(result) {
        if (!result) return;

        switch (result.type) {
            case 'occupation':
                Router.navigate(`/occupation/${result.id}`);
                break;
            case 'area':
                Router.navigate(`/area/${result.id}`);
                break;
            case 'group':
                // Navigate to home with group filter (future)
                Router.navigate(`/`);
                break;
        }

        hideDropdown();
        if (activeInput) {
            activeInput.value = '';
            activeInput.blur();
        }
    }

    /**
     * Render the dropdown
     */
    function renderDropdown(searchResults) {
        if (!dropdown) return;

        results = searchResults;
        selectedIdx = -1;

        if (results.length === 0) {
            if (activeInput && activeInput.value.length >= 2) {
                dropdown.innerHTML = '<div class="search-no-results">No results found</div>';
                dropdown.classList.add('visible');
            } else {
                hideDropdown();
            }
            return;
        }

        dropdown.innerHTML = results.map((r, i) => `
            <div class="search-result ${i === selectedIdx ? 'selected' : ''}" data-idx="${i}">
                <span class="search-result-icon">${getIcon(r.type)}</span>
                <div class="search-result-text">
                    <span class="search-result-title">${highlightMatch(r.title, activeInput?.value || '')}</span>
                    <span class="search-result-subtitle">${r.subtitle}</span>
                </div>
                <span class="search-result-type">${r.type}</span>
            </div>
        `).join('');

        dropdown.classList.add('visible');

        // Add click handlers
        dropdown.querySelectorAll('.search-result').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.idx);
                selectResult(results[idx]);
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

    function highlightMatch(text, query) {
        if (!query || query.length < 2) return text;
        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`(${escaped})`, 'gi');
        return text.replace(regex, '<mark>$1</mark>');
    }

    function hideDropdown() {
        if (dropdown) {
            dropdown.classList.remove('visible');
            dropdown.innerHTML = '';
        }
        results = [];
        selectedIdx = -1;
    }

    function updateSelection() {
        if (!dropdown) return;
        const items = dropdown.querySelectorAll('.search-result');
        items.forEach((el, i) => {
            el.classList.toggle('selected', i === selectedIdx);
        });

        // Scroll selected into view
        if (selectedIdx >= 0 && items[selectedIdx]) {
            items[selectedIdx].scrollIntoView({ block: 'nearest' });
        }
    }

    /**
     * Attach search behavior to an input element
     */
    function attach(inputEl, dropdownEl) {
        if (!inputEl || !dropdownEl) return;

        dropdown = dropdownEl;
        let debounceTimer = null;

        inputEl.addEventListener('focus', () => {
            activeInput = inputEl;
            loadIndex();
        });

        inputEl.addEventListener('input', () => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const q = inputEl.value.trim();
                if (q.length < 2) {
                    hideDropdown();
                    return;
                }
                const searchResults = search(q);
                renderDropdown(searchResults);
            }, 150);
        });

        inputEl.addEventListener('keydown', (e) => {
            if (!results.length) return;

            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    selectedIdx = Math.min(selectedIdx + 1, results.length - 1);
                    updateSelection();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    selectedIdx = Math.max(selectedIdx - 1, -1);
                    updateSelection();
                    break;
                case 'Enter':
                    e.preventDefault();
                    if (selectedIdx >= 0) {
                        selectResult(results[selectedIdx]);
                    } else if (results.length > 0) {
                        selectResult(results[0]);
                    }
                    break;
                case 'Escape':
                    hideDropdown();
                    inputEl.blur();
                    break;
            }
        });

        // Close dropdown on outside click
        document.addEventListener('click', (e) => {
            if (!inputEl.contains(e.target) && !dropdownEl.contains(e.target)) {
                hideDropdown();
            }
        });
    }

    return { loadIndex, search, attach, hideDropdown };
})();

window.Search = Search;
