/**
 * LaborCompare - Value Formatters
 * Consistent formatting for wages, counts, percentages, etc.
 */

const Formatters = (() => {
    /**
     * Format as salary: $52,340
     */
    function salary(value) {
        if (value == null || isNaN(value)) return 'N/A';
        return '$' + Math.round(value).toLocaleString('en-US');
    }

    /**
     * Format as hourly wage: $25.17/hr
     */
    function hourly(value) {
        if (value == null || isNaN(value)) return 'N/A';
        return '$' + Number(value).toFixed(2) + '/hr';
    }

    /**
     * Format as large count: 1.2M, 340K, 1,234
     */
    function count(value) {
        if (value == null || isNaN(value)) return 'N/A';
        const n = Number(value);
        if (n >= 1000000) return (n / 1000000).toFixed(1).replace(/\.0$/, '') + 'M';
        if (n >= 10000) return (n / 1000).toFixed(0) + 'K';
        if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K';
        return n.toLocaleString('en-US');
    }

    /**
     * Format as exact number with commas: 1,234,567
     */
    function number(value) {
        if (value == null || isNaN(value)) return 'N/A';
        return Math.round(value).toLocaleString('en-US');
    }

    /**
     * Format as percentage: 4.2%
     */
    function percent(value) {
        if (value == null || isNaN(value)) return 'N/A';
        return Number(value).toFixed(1) + '%';
    }

    /**
     * Format a location quotient: 1.23
     */
    function quotient(value) {
        if (value == null || isNaN(value)) return 'N/A';
        return Number(value).toFixed(2);
    }

    /**
     * Format salary range (e.g., percentile spread)
     */
    function salaryRange(low, high) {
        if (low == null || high == null) return 'N/A';
        return salary(low) + ' – ' + salary(high);
    }

    /**
     * Format a change/growth value: +2.3%, -1.5%
     */
    function change(value) {
        if (value == null || isNaN(value)) return 'N/A';
        const n = Number(value);
        const sign = n >= 0 ? '+' : '';
        return sign + n.toFixed(1) + '%';
    }

    /**
     * Smart format based on field type
     */
    function auto(value, field) {
        if (value == null) return 'N/A';

        // Salary fields
        if (field && (field.includes('median') || field.includes('mean') ||
            field.includes('salary') || field.includes('income') ||
            field.includes('earnings') || field.includes('a_pct') ||
            field === 'med' || field === 'avg' ||
            field === 'p10' || field === 'p25' || field === 'p75' || field === 'p90')) {
            return salary(value);
        }

        // Hourly fields
        if (field && (field.includes('hourly') || field.includes('h_pct') ||
            field === 'hmed' || field === 'havg')) {
            return hourly(value);
        }

        // Employment/count fields
        if (field && (field.includes('emp') || field.includes('employment') ||
            field.includes('labor_force') || field === 'population')) {
            return count(value);
        }

        // Rate/percent fields
        if (field && (field.includes('rate') || field.includes('pct') ||
            field.includes('percent'))) {
            return percent(value);
        }

        // Location quotient
        if (field && (field === 'lq' || field.includes('quotient'))) {
            return quotient(value);
        }

        // Default: number
        return number(value);
    }

    /**
     * Format signed delta: +0.1 pts, -556K
     */
    function delta(value, suffix = '') {
        if (value == null || isNaN(value)) return 'N/A';
        const n = Number(value);
        const sign = n >= 0 ? '+' : '';
        return sign + n.toFixed(1) + (suffix ? ' ' + suffix : '');
    }

    /**
     * Format CPI index value: 315.2
     */
    function cpi(value) {
        if (value == null || isNaN(value)) return 'N/A';
        return Number(value).toFixed(1);
    }

    return { salary, hourly, count, number, percent, quotient, salaryRange, change, delta, cpi, auto };
})();

window.Formatters = Formatters;
