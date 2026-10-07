import type * as echarts from 'echarts';
import type { StrategyTrade } from '@luxalgo/vela/plugin';
import type {
    BacktestSummaryStats,
    PerformanceAnalysisTabId,
    BreakdownSubMode,
    PeriodicalMode,
    BenchmarkingMode,
} from '../../types';
import { renderBreakdownTab } from './breakdown';
import { renderPeriodicalTab } from './periodical';
import { renderBenchmarkingTab } from './benchmarking';
import { renderMarginUsageTab } from './margin-usage';
import { renderGrowthDeclineTab } from './growth-decline';

export interface PerformanceAnalysisState {
    stats: BacktestSummaryStats | null;
    trades: StrategyTrade[];
    cachedBuyHold: number[];
    cachedCumPnl: number[];
    baseInitialCapital: number;
    activeTab: PerformanceAnalysisTabId;
    breakdownSubMode: BreakdownSubMode;
    periodicalMode: PeriodicalMode;
    benchmarkingMode: BenchmarkingMode;
}

export class PerformanceAnalysisManager {
    private readonly containerEl: HTMLElement;
    private readonly getState: () => PerformanceAnalysisState;
    private readonly onStateChange: (patch: Partial<PerformanceAnalysisState>) => void;
    private activeChart: echarts.ECharts | null = null;

    constructor(
        containerEl: HTMLElement,
        getState: () => PerformanceAnalysisState,
        onStateChange: (patch: Partial<PerformanceAnalysisState>) => void,
    ) {
        this.containerEl = containerEl;
        this.getState = getState;
        this.onStateChange = onStateChange;
    }

    public render(): void {
        this.disposeChart();
        const state = this.getState();

        switch (state.activeTab) {
            case 'breakdown':
                renderBreakdownTab({
                    containerEl: this.containerEl,
                    stats: state.stats,
                    trades: state.trades,
                    subMode: state.breakdownSubMode,
                    onSubModeChange: (subMode) => {
                        this.onStateChange({ breakdownSubMode: subMode });
                        this.render();
                    },
                });
                break;
            case 'periodical':
                this.activeChart = renderPeriodicalTab({
                    containerEl: this.containerEl,
                    stats: state.stats,
                    trades: state.trades,
                    mode: state.periodicalMode,
                    onModeChange: (mode) => {
                        this.onStateChange({ periodicalMode: mode });
                        this.render();
                    },
                });
                break;
            case 'benchmarking':
                this.activeChart = renderBenchmarkingTab({
                    containerEl: this.containerEl,
                    stats: state.stats,
                    trades: state.trades,
                    cachedBuyHold: state.cachedBuyHold,
                    cachedCumPnl: state.cachedCumPnl,
                    mode: state.benchmarkingMode,
                    onModeChange: (mode) => {
                        this.onStateChange({ benchmarkingMode: mode });
                        this.render();
                    },
                });
                break;
            case 'margin-usage':
                renderMarginUsageTab({
                    containerEl: this.containerEl,
                    stats: state.stats,
                });
                break;
            case 'growth-decline':
                this.activeChart = renderGrowthDeclineTab({
                    containerEl: this.containerEl,
                    stats: state.stats,
                    trades: state.trades,
                    baseInitialCapital: state.baseInitialCapital,
                });
                break;
        }
    }

    public setTab(tab: PerformanceAnalysisTabId): void {
        this.onStateChange({ activeTab: tab });
        this.render();
    }

    public resize(): void {
        this.activeChart?.resize();
    }

    public disposeChart(): void {
        if (this.activeChart) {
            this.activeChart.dispose();
            this.activeChart = null;
        }
    }

    public destroy(): void {
        this.disposeChart();
    }

    public dispose(): void {
        this.disposeChart();
    }
}
