import type { StrategyTrade } from '@luxalgo/vela/plugin';

export function filterTradesByPeriod(
    trades: StrategyTrade[],
    periodKey: string,
    customRange?: { from: number; to: number },
): StrategyTrade[] {
    if (trades.length === 0) return [];
    if (periodKey === 'available' || periodKey === 'all') return [...trades];

    if (periodKey === 'custom' && customRange) {
        const filtered = trades.filter((t) => {
            const time = t.exit?.time ?? t.entry.time;
            return time >= customRange.from && time <= customRange.to + 86_400_000;
        });
        return filtered.length > 0 ? filtered : [trades[trades.length - 1]!];
    }

    const timestamps = trades.map((t) => t.exit?.time ?? t.entry.time);
    const maxTime = Math.max(...timestamps);

    let cutoff = 0;
    if (periodKey === '7d') {
        cutoff = maxTime - 7 * 86_400_000;
    } else if (periodKey === '30d') {
        cutoff = maxTime - 30 * 86_400_000;
    } else if (periodKey === '90d') {
        cutoff = maxTime - 90 * 86_400_000;
    } else if (periodKey === '365d') {
        cutoff = maxTime - 365 * 86_400_000;
    } else {
        return [...trades];
    }

    const filtered = trades.filter((t) => (t.exit?.time ?? t.entry.time) >= cutoff);
    return filtered.length > 0 ? filtered : [trades[trades.length - 1]!];
}
