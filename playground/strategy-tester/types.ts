import type { Vela, IndicatorHandle } from '@luxalgo/vela';
import type { StrategyTrade, OHLCV } from '@luxalgo/vela/plugin';

export interface StrategyTesterOptions {
    host: HTMLElement;
    getActiveChart: () => Vela | null;
    onStrategySelect?: (handle: IndicatorHandle) => void;
}

export interface ChartWithOrchestrator {
    orchestrator?: {
        bars?: OHLCV[];
        rawBars?: OHLCV[];
    };
}

export interface BacktestSummaryStats {
    totalPnl: number;
    totalPnlPct: number;
    maxDrawdown: number;
    maxDrawdownPct: number;
    profitableTradesPct: number;
    wins: number;
    losses: number;
    totalTrades: number;
    profitFactor: number;
    initialCapital: number;
    currency: string;
    grossProfit?: number;
    grossLoss?: number;
}

export type TradesColumnKey =
    | 'dateTime'
    | 'signal'
    | 'price'
    | 'size'
    | 'netPnl'
    | 'returnPct'
    | 'commission'
    | 'favorableExcursion'
    | 'adverseExcursion'
    | 'cumPnl'
    | 'duration';

export type StrategyTesterMode = 'hidden' | 'docked' | 'expanded' | 'maximized';

export type StrategyTesterView = 'chart' | 'table';

export type PerformanceAnalysisTabId = 'breakdown' | 'periodical' | 'benchmarking' | 'margin-usage' | 'growth-decline';

export type TradesAnalysisTabId = 'distribution' | 'streaks' | 'time-patterns';

export type StreaksMode = 'count' | 'amount';

export type BreakdownSubMode = 'signals' | 'side';

export type PeriodicalMode = 'weekly' | 'quarterly' | 'yearly';

export type BenchmarkingMode = 'weekly' | 'quarterly' | 'yearly';

export type ScaleMode = 'regular' | 'percent';

export type ExecMode = 'close' | 'fill' | 'tick';

export interface ActiveSeriesToggles {
    cumPnl: boolean;
    buyHold: boolean;
    tradesExcursions: boolean;
    runupsDrawdowns: boolean;
}

export interface RunupDrawdownItem {
    entryIdx: number;
    exitIdx: number;
    pnl: number;
    val: number;
    pct: number;
    entryDateStr: string;
    exitDateStr: string;
}

export interface ExcursionBarItem {
    value: [number, number];
    itemStyle: { color: string };
}

export interface ReferenceDataResult {
    timeline: string[];
    timestamps: number[];
    cumPnl: number[];
    buyHold: number[];
    tradeBars: ExcursionBarItem[];
    mfeBars: ExcursionBarItem[];
    realizedBars: ExcursionBarItem[];
    maeBars: ExcursionBarItem[];
    runupsDrawdowns: RunupDrawdownItem[];
    trades: StrategyTrade[];
    stats: BacktestSummaryStats;
}
