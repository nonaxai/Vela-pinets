import { describe, it, expect } from 'vitest';
import type { StrategyTrade, StrategyState } from '@luxalgo/vela/plugin';
import { computeStatsFromPine } from '../playground/strategy-tester/data/stats-calculator';
import { filterTradesByPeriod } from '../playground/strategy-tester/data/period-filter';
import { formatNumber, formatSignedNumber, formatSignedPct } from '../playground/strategy-tester/core/formatters';

describe('formatters', () => {
    it('formats numbers with thousands separators and decimals', () => {
        expect(formatNumber(1234567.891, 2)).toBe('1,234,567.89');
        expect(formatNumber(0, 2)).toBe('0.00');
        expect(formatNumber(100, 0)).toBe('100');
    });

    it('formats signed numbers', () => {
        expect(formatSignedNumber(1234.5)).toBe('+1,234.50');
        expect(formatSignedNumber(-5432.1)).toBe('-5,432.10');
        expect(formatSignedNumber(0)).toBe('+0.00');
    });

    it('formats signed percentages', () => {
        expect(formatSignedPct(12.34)).toBe('+12.34%');
        expect(formatSignedPct(-5.67)).toBe('-5.67%');
    });
});

describe('stats calculator', () => {
    it('computes correct win rate, gross profit, and profit factor from trades', () => {
        const trades: StrategyTrade[] = [
            {
                id: '1',
                qty: 1,
                entry: { id: 't1', time: 1000, price: 100 },
                exit: { id: 't1_x', time: 2000, price: 110 },
                side: 'long',
                pnl: 500,
                open: false,
            },
            {
                id: '2',
                qty: 1,
                entry: { id: 't2', time: 3000, price: 110 },
                exit: { id: 't2_x', time: 4000, price: 105 },
                side: 'long',
                pnl: -200,
                open: false,
            },
            {
                id: '3',
                qty: 1,
                entry: { id: 't3', time: 5000, price: 105 },
                exit: { id: 't3_x', time: 6000, price: 115 },
                side: 'long',
                pnl: 300,
                open: false,
            },
        ];

        const state = { initialCapital: 10000 } as unknown as StrategyState;
        const stats = computeStatsFromPine(state, trades);
        expect(stats.totalTrades).toBe(3);
        expect(stats.wins).toBe(2);
        expect(stats.losses).toBe(1);
        expect(stats.profitableTradesPct).toBeCloseTo(66.67, 1);
        expect(stats.totalPnl).toBe(600);
        expect(stats.totalPnlPct).toBe(6);
        expect(stats.grossProfit).toBe(800);
        expect(stats.grossLoss).toBe(200);
        expect(stats.profitFactor).toBe(4);
    });
});

describe('period filter', () => {
    const baseTime = 1_700_000_000_000;
    const dayMs = 86_400_000;

    const trades: StrategyTrade[] = [
        {
            id: '1',
            qty: 1,
            entry: { id: 't1', time: baseTime - 40 * dayMs, price: 100 },
            exit: { id: 't1_x', time: baseTime - 40 * dayMs, price: 105 },
            side: 'long',
            pnl: 100,
            open: false,
        },
        {
            id: '2',
            qty: 1,
            entry: { id: 't2', time: baseTime - 15 * dayMs, price: 105 },
            exit: { id: 't2_x', time: baseTime - 15 * dayMs, price: 110 },
            side: 'long',
            pnl: 100,
            open: false,
        },
        {
            id: '3',
            qty: 1,
            entry: { id: 't3', time: baseTime - 2 * dayMs, price: 110 },
            exit: { id: 't3_x', time: baseTime - 2 * dayMs, price: 115 },
            side: 'long',
            pnl: 100,
            open: false,
        },
    ];

    it('returns all trades for "available"', () => {
        const filtered = filterTradesByPeriod(trades, 'available');
        expect(filtered.length).toBe(3);
    });

    it('filters for 7d', () => {
        const filtered = filterTradesByPeriod(trades, '7d');
        expect(filtered.length).toBe(1);
        expect(filtered[0]?.entry.id).toBe('t3');
    });

    it('filters for 30d', () => {
        const filtered = filterTradesByPeriod(trades, '30d');
        expect(filtered.length).toBe(2);
    });
});
