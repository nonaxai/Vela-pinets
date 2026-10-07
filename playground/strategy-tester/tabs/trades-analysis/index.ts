import type * as echarts from 'echarts';
import type { StrategyTrade } from '@luxalgo/vela/plugin';
import type { BacktestSummaryStats, TradesAnalysisTabId, StreaksMode } from '../../types';
import { renderDistributionTab } from './distribution';
import { renderStreaksTab } from './streaks';
import { renderTimePatternsTab } from './time-patterns';

export interface TradesAnalysisState {
    stats: BacktestSummaryStats | null;
    trades: StrategyTrade[];
    baseInitialCapital: number;
    activeTab: TradesAnalysisTabId;
    streaksMode: StreaksMode;
}

export class TradesAnalysisManager {
    private readonly containerEl: HTMLElement;
    private readonly getState: () => TradesAnalysisState;
    private readonly onStateChange: (patch: Partial<TradesAnalysisState>) => void;
    private returnsDistChart: echarts.ECharts | null = null;
    private tradesDistChart: echarts.ECharts | null = null;
    private streaksChart: echarts.ECharts | null = null;
    private timePatternsChart: echarts.ECharts | null = null;

    constructor(
        containerEl: HTMLElement,
        getState: () => TradesAnalysisState,
        onStateChange: (patch: Partial<TradesAnalysisState>) => void,
    ) {
        this.containerEl = containerEl;
        this.getState = getState;
        this.onStateChange = onStateChange;
    }

    public render(): void {
        this.disposeCharts();
        const state = this.getState();

        switch (state.activeTab) {
            case 'distribution': {
                const charts = renderDistributionTab({
                    containerEl: this.containerEl,
                    stats: state.stats,
                    trades: state.trades,
                    baseInitialCapital: state.baseInitialCapital,
                });
                this.returnsDistChart = charts.returnsDistChart;
                this.tradesDistChart = charts.tradesDistChart;
                break;
            }
            case 'streaks':
                this.streaksChart = renderStreaksTab({
                    containerEl: this.containerEl,
                    stats: state.stats,
                    trades: state.trades,
                    baseInitialCapital: state.baseInitialCapital,
                    mode: state.streaksMode,
                    onModeChange: (mode) => {
                        this.onStateChange({ streaksMode: mode });
                        this.render();
                    },
                });
                break;
            case 'time-patterns':
                this.timePatternsChart = renderTimePatternsTab({
                    containerEl: this.containerEl,
                    trades: state.trades,
                });
                break;
        }
    }

    public setTab(tab: TradesAnalysisTabId): void {
        this.onStateChange({ activeTab: tab });
        this.render();
    }

    public resize(): void {
        this.returnsDistChart?.resize();
        this.tradesDistChart?.resize();
        this.streaksChart?.resize();
        this.timePatternsChart?.resize();
    }

    public disposeCharts(): void {
        if (this.returnsDistChart) {
            this.returnsDistChart.dispose();
            this.returnsDistChart = null;
        }
        if (this.tradesDistChart) {
            this.tradesDistChart.dispose();
            this.tradesDistChart = null;
        }
        if (this.streaksChart) {
            this.streaksChart.dispose();
            this.streaksChart = null;
        }
        if (this.timePatternsChart) {
            this.timePatternsChart.dispose();
            this.timePatternsChart = null;
        }
    }

    public destroy(): void {
        this.disposeCharts();
    }

    public dispose(): void {
        this.disposeCharts();
    }
}
