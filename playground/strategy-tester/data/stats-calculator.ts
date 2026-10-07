import type { StrategyState, StrategyTrade } from '@luxalgo/vela/plugin';
import type { BacktestSummaryStats } from '../types';

export function computeStatsFromPine(state: StrategyState, trades: StrategyTrade[]): BacktestSummaryStats {
    const initialCapital = state.initialCapital || 10000;
    const closed = trades.filter((t) => !t.open && t.pnl !== undefined);
    const wins = state.wins || closed.filter((t) => (t.pnl ?? 0) > 0).length;
    const losses = state.losses || closed.filter((t) => (t.pnl ?? 0) < 0).length;
    const totalTrades = wins + losses + (state.even || closed.filter((t) => (t.pnl ?? 0) === 0).length);

    const totalPnl = state.netPnl || closed.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
    const totalPnlPct = (totalPnl / initialCapital) * 100;
    const maxDrawdown = state.maxDrawdown || 0;
    const maxDrawdownPct = (maxDrawdown / initialCapital) * 100;
    const profitableTradesPct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const grossProfit = state.grossProfit || closed.filter((t) => (t.pnl ?? 0) > 0).reduce((acc, t) => acc + (t.pnl ?? 0), 0);
    const grossLoss = state.grossLoss || Math.abs(closed.filter((t) => (t.pnl ?? 0) < 0).reduce((acc, t) => acc + (t.pnl ?? 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);

    return {
        totalPnl,
        totalPnlPct,
        maxDrawdown,
        maxDrawdownPct,
        profitableTradesPct,
        wins,
        losses,
        totalTrades,
        profitFactor,
        initialCapital,
        currency: 'NONE',
        grossProfit,
        grossLoss,
    };
}
