/** Formats a numeric value with commas and fixed decimals */
export function formatNumber(val: number, decimals = 2): string {
    const parts = val.toFixed(decimals).split('.');
    parts[0] = parts[0]!.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return parts.join('.');
}

/** Formats signed currency number e.g. +10,326.23 */
export function formatSignedNumber(val: number, decimals = 2): string {
    const formatted = formatNumber(Math.abs(val), decimals);
    return val >= 0 ? `+${formatted}` : `-${formatted}`;
}

/** Formats percentage e.g. +12.34% or -5.67% */
export function formatSignedPct(val: number, decimals = 2): string {
    const sign = val >= 0 ? '+' : '';
    return `${sign}${val.toFixed(decimals)}%`;
}

/** Format timestamp to readable date string e.g. 2024-05-12 14:30 */
export function formatDateTime(timeMs: number): string {
    const d = new Date(timeMs);
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hr = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    return `${yr}-${mo}-${day} ${hr}:${min}`;
}
