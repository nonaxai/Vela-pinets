import type { StrategyTrade } from '@luxalgo/vela/plugin';

export function exportTradesToCsv(trades: StrategyTrade[], strategyTitle = 'strategy'): void {
    if (trades.length === 0) return;
    const headers = ['Trade #', 'Side', 'Entry Time', 'Entry Price', 'Exit Time', 'Exit Price', 'Net PnL', 'Max Run-up', 'Max Drawdown'];
    const rows = trades.map((t, i) => [
        i + 1,
        t.side.toUpperCase(),
        new Date(t.entry.time).toISOString(),
        t.entry.price,
        t.exit ? new Date(t.exit.time).toISOString() : '',
        t.exit ? t.exit.price : '',
        t.pnl ?? 0,
        t.maxRunup ?? 0,
        t.maxDrawdown ?? 0,
    ]);
    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trades-${strategyTitle}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
}
