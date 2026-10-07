import './styles.css';

import type { Vela, IndicatorHandle } from '@luxalgo/vela';
import type { EngineContextSnapshot, StrategyTrade, OHLCV } from '@luxalgo/vela/plugin';

import type {
    StrategyTesterOptions,
    StrategyTesterMode,
    StrategyTesterView,
    BacktestSummaryStats,
    TradesColumnKey,
    ChartWithOrchestrator,
    ExcursionBarItem,
    RunupDrawdownItem,
    PerformanceAnalysisTabId,
    TradesAnalysisTabId,
    BreakdownSubMode,
    PeriodicalMode,
    BenchmarkingMode,
    StreaksMode,
    ActiveSeriesToggles,
} from './types';

import { buildDOM, type StrategyTesterDOMElements } from './core/dom-builder';
import { formatNumber, formatSignedNumber } from './core/formatters';
import { generateReferenceData } from './data/reference-data';
import { filterTradesByPeriod } from './data/period-filter';
import { exportTradesToCsv } from './data/csv-exporter';
import { createDefaultActiveColumns } from './tabs/trades-table/columns';

import { EquityChartManager } from './charts/equity-chart';
import { HeaderControlsManager } from './components/header-controls';
import { PerformanceAnalysisManager } from './tabs/performance-analysis/index';
import { TradesAnalysisManager } from './tabs/trades-analysis/index';
import { TradesTableManager } from './tabs/trades-table/index';

export * from './types';
export { EquityChartManager } from './charts/equity-chart';
export { HeaderControlsManager } from './components/header-controls';
export { PerformanceAnalysisManager } from './tabs/performance-analysis/index';
export { TradesAnalysisManager } from './tabs/trades-analysis/index';
export { TradesTableManager } from './tabs/trades-table/index';
export * from './core/formatters';
export * from './data/stats-calculator';
export * from './data/period-filter';
export { generateReferenceData } from './data/reference-data';
export * from './data/csv-exporter';

export class StrategyTester {
    private readonly host: HTMLElement;
    private readonly getActiveChart: () => Vela | null;
    private readonly onStrategySelect?: (handle: IndicatorHandle) => void;

    // Root element and sub-DOM references
    public readonly el: HTMLElement;
    private readonly dom: StrategyTesterDOMElements;

    // Sub-system managers
    private readonly equityChart: EquityChartManager;
    private readonly perfAnalysis: PerformanceAnalysisManager;
    private readonly tradesAnalysis: TradesAnalysisManager;
    private readonly tradesTable: TradesTableManager;
    private readonly headerControls: HeaderControlsManager;

    // Lifecycle and display state
    private mode: StrategyTesterMode = 'hidden';
    private isChartExpanded = false;
    private currentHeight = 520;
    private currentView: StrategyTesterView = 'chart';
    private isDragging = false;
    private startY = 0;
    private startHeight = 0;

    // Tab state
    private activeAnalysisTab: PerformanceAnalysisTabId = 'breakdown';
    private breakdownSubMode: BreakdownSubMode = 'signals';
    private periodicalMode: PeriodicalMode = 'weekly';
    private benchmarkingMode: BenchmarkingMode = 'weekly';
    private activeTradesAnalysisTab: TradesAnalysisTabId = 'distribution';
    private streaksMode: StreaksMode = 'count';

    // Filter and settings state
    private selectedTestingPeriod = 'available';
    private customDateRange?: { from: number; to: number };
    private selectedCurrency = 'SAME';
    private customCapitalAmount = 10000;
    private selectedBarDetalization = 'default';
    private selectedExecModes: Array<'close' | 'fill' | 'tick'> = ['close'];
    private activeColumns: Record<TradesColumnKey, boolean> = createDefaultActiveColumns();

    // Active indicator handle and cached snapshot state
    private activeHandle: IndicatorHandle | null = null;
    private lastProcessedHandleId: string | undefined = undefined;
    private lastProcessedTradesCount = -1;
    private lastProcessedTradePnl: number | null = null;
    private lastProcessedSnapState: 'pine' | 'demo' | null = null;

    // Data cache
    private cachedStats: BacktestSummaryStats | null = null;
    private cachedTimeline: string[] = [];
    private cachedTimestamps: number[] = [];
    private cachedCumPnl: number[] = [];
    private cachedBuyHold: number[] = [];
    private cachedTradeBars: ExcursionBarItem[] = [];
    private cachedMfeBars: ExcursionBarItem[] = [];
    private cachedRealizedBars: ExcursionBarItem[] = [];
    private cachedMaeBars: ExcursionBarItem[] = [];
    private cachedRunupsDrawdowns: RunupDrawdownItem[] = [];
    private cachedTrades: StrategyTrade[] = [];
    private allRawTrades: StrategyTrade[] = [];
    private baseInitialCapital = 10000;

    private resizeObserver: ResizeObserver | null = null;

    constructor(opts: StrategyTesterOptions) {
        this.host = opts.host;
        this.getActiveChart = opts.getActiveChart;
        this.onStrategySelect = opts.onStrategySelect;

        this.el = document.createElement('div');
        this.el.className = 'vela-strategy-tester vela-ui';
        this.dom = buildDOM(this.el);
        this.host.appendChild(this.el);

        // Instantiate EquityChartManager
        this.equityChart = new EquityChartManager({
            containerEl: this.dom.chartContainerEl,
            rootEl: this.el,
            getTimeline: () => this.cachedTimeline,
            getCumPnl: () => this.cachedCumPnl,
            getBuyHold: () => this.cachedBuyHold,
            getTimestamps: () => this.cachedTimestamps,
            getTrades: () => this.cachedTrades,
            getMaeBars: () => this.cachedMaeBars,
            getMfeBars: () => this.cachedMfeBars,
            getRealizedBars: () => this.cachedRealizedBars,
            getRunupsDrawdowns: () => this.cachedRunupsDrawdowns,
            getCapitalAmount: () => this.customCapitalAmount,
            getBaseInitialCapital: () => this.baseInitialCapital,
        });

        // Instantiate PerformanceAnalysisManager
        this.perfAnalysis = new PerformanceAnalysisManager(
            this.dom.analysisBodyEl,
            () => ({
                stats: this.cachedStats,
                trades: this.cachedTrades,
                cachedBuyHold: this.cachedBuyHold,
                cachedCumPnl: this.cachedCumPnl,
                baseInitialCapital: this.baseInitialCapital,
                activeTab: this.activeAnalysisTab,
                breakdownSubMode: this.breakdownSubMode,
                periodicalMode: this.periodicalMode,
                benchmarkingMode: this.benchmarkingMode,
            }),
            (patch) => {
                if (patch.activeTab) this.activeAnalysisTab = patch.activeTab;
                if (patch.breakdownSubMode) this.breakdownSubMode = patch.breakdownSubMode;
                if (patch.periodicalMode) this.periodicalMode = patch.periodicalMode;
                if (patch.benchmarkingMode) this.benchmarkingMode = patch.benchmarkingMode;
            }
        );

        // Instantiate TradesAnalysisManager
        this.tradesAnalysis = new TradesAnalysisManager(
            this.dom.tradesAnalysisBodyEl,
            () => ({
                stats: this.cachedStats,
                trades: this.cachedTrades,
                baseInitialCapital: this.baseInitialCapital,
                activeTab: this.activeTradesAnalysisTab,
                streaksMode: this.streaksMode,
            }),
            (patch) => {
                if (patch.activeTab) this.activeTradesAnalysisTab = patch.activeTab;
                if (patch.streaksMode) this.streaksMode = patch.streaksMode;
            }
        );

        // Instantiate TradesTableManager
        this.tradesTable = new TradesTableManager({
            containerEl: this.dom.tradesTableEl,
            getTrades: () => this.cachedTrades,
            getCustomCapitalAmount: () => this.customCapitalAmount,
            getActiveColumns: () => this.activeColumns,
            onExportCsv: () => {
                exportTradesToCsv(
                    this.cachedTrades,
                    this.activeHandle?.title
                );
            },
            onOpenColumnPicker: (anchorBtn) => {
                this.headerControls.showTradesColumnPickerDropdown(anchorBtn);
            },
        });

        // Instantiate HeaderControlsManager
        this.headerControls = new HeaderControlsManager({
            rootEl: this.el,
            getMode: () => (this.mode === 'docked' ? 'docked' : 'floating'),
            getActiveChart: () => this.getActiveChart(),
            getActiveHandle: () => this.activeHandle,
            extractTitle: (h) => this.extractTitle(h),
            onSelectStrategy: (strat) => {
                if (!strat.visible) strat.setVisible(true);
                void this.bindStrategy(strat);
                this.onStrategySelect?.(strat);
            },
            getSelectedTestingPeriod: () => this.selectedTestingPeriod,
            onApplyTestingPeriod: (key) => this.applyTestingPeriod(key),
            onPromptCustomDateRange: () => this.promptCustomDateRange(),
            getCustomCapitalAmount: () => this.customCapitalAmount,
            setCustomCapitalAmount: (amount) => {
                this.customCapitalAmount = amount;
            },
            getSelectedCurrency: () => this.selectedCurrency,
            setSelectedCurrency: (curr) => {
                this.selectedCurrency = curr;
            },
            onRecalculateCapital: () => this.recalculateCapitalAndStats(),
            getSelectedBarDetalization: () => this.selectedBarDetalization,
            setSelectedBarDetalization: (val) => {
                this.selectedBarDetalization = val;
            },
            getSelectedExecModes: () => this.selectedExecModes,
            setSelectedExecModes: (modes) => {
                this.selectedExecModes = modes;
            },
            getScaleMode: () => this.equityChart.scaleMode,
            setScaleMode: (mode) => {
                this.equityChart.scaleMode = mode;
            },
            getShowWhitespaces: () => this.equityChart.showWhitespaces,
            setShowWhitespaces: (val) => {
                this.equityChart.showWhitespaces = val;
            },
            onScaleOrWhitespaceChange: () => {
                this.equityChart.update();
            },
            getActiveColumns: () => this.activeColumns,
            onColumnToggle: (key) => {
                this.activeColumns[key] = !this.activeColumns[key];
                this.tradesTable.render();
            },
        });

        this.attachEvents();
        this.setMode('hidden');
    }

    private attachEvents(): void {
        // Drag to resize
        this.dom.resizerEl.addEventListener('mousedown', (e) => this.onDragStart(e));

        // Dock Bar clicks (green icon, title or expand buttons maximize panel)
        this.el.querySelector('.vst-dock-left .vst-strat-icon')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setMode('maximized');
        });
        this.el.querySelector('.vst-dock-title')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setMode('maximized');
        });
        this.el.querySelector('.vst-btn-expand')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setMode('maximized');
        });
        this.el.querySelector('.vst-btn-maximize')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.setMode('maximized');
        });

        // Minimize button (dock panel)
        this.el.querySelector('.vst-btn-minimize')?.addEventListener('click', () => {
            this.setMode('docked');
        });

        // Toggle Maximize button in top header
        this.el.querySelector('.vst-btn-toggle-max')?.addEventListener('click', () => {
            if (this.mode === 'maximized') {
                this.setMode('expanded');
            } else {
                this.setMode('maximized');
            }
        });

        // Expand chart icon in performance header
        this.el.querySelector('.vst-perf-expand-chart')?.addEventListener('click', () => {
            this.toggleChartExpanded();
        });

        // Screenshot icon
        this.el.querySelector('.vst-perf-screenshot')?.addEventListener('click', () => {
            this.equityChart.exportImage(this.activeHandle?.title);
        });

        // View toggle (Chart vs Table)
        this.el.querySelectorAll('.vst-seg-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const view = target.dataset.view as 'chart' | 'table';
                this.setView(view);
            });
        });

        // Series toggles
        this.el.querySelectorAll('.vst-series-pill').forEach((pill) => {
            pill.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const key = target.dataset.series as keyof ActiveSeriesToggles;
                if (key && key in this.equityChart.activeSeries) {
                    this.equityChart.activeSeries[key] = !this.equityChart.activeSeries[key];
                    this.equityChart.updateSeriesTogglesUI(this.el);
                    this.equityChart.update();
                }
            });
        });

        // Collapse / Expand series toggle pills
        this.el.querySelector('#vst-series-collapse-btn')?.addEventListener('click', () => {
            this.equityChart.isSeriesCollapsed = true;
            const list = this.el.querySelector('#vst-series-pills-list') as HTMLElement;
            const compact = this.el.querySelector('#vst-series-compact-btn') as HTMLElement;
            if (list) list.style.display = 'none';
            if (compact) compact.style.display = 'inline-flex';
        });

        this.el.querySelector('#vst-series-compact-btn')?.addEventListener('click', () => {
            this.equityChart.isSeriesCollapsed = false;
            const list = this.el.querySelector('#vst-series-pills-list') as HTMLElement;
            const compact = this.el.querySelector('#vst-series-compact-btn') as HTMLElement;
            if (list) list.style.display = 'flex';
            if (compact) compact.style.display = 'none';
        });

        // Strategy title buttons click (shows strategy selector dropdown)
        this.el.querySelectorAll('.vst-strat-btn').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.headerControls.showStrategyDropdown(btn as HTMLElement);
            });
        });

        // Settings gear buttons (Chart indicator settings)
        this.el.querySelectorAll('.vst-btn-strat-settings').forEach((btn) => {
            btn.addEventListener('click', () => {
                const chart = this.getActiveChart();
                if (chart && 'renderer' in chart) {
                    const withRenderer = chart as unknown as { renderer?: { openSettings?: () => void } };
                    withRenderer.renderer?.openSettings?.();
                }
            });
        });

        // Filter pills dropdowns
        const dateFilterBtn = this.el.querySelector('.vst-date-filter') as HTMLElement;
        dateFilterBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.headerControls.showTestingPeriodDropdown(dateFilterBtn);
        });

        const capitalFilterBtn = this.el.querySelector('.vst-capital-filter') as HTMLElement;
        capitalFilterBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.headerControls.showInitialCapitalDropdown(capitalFilterBtn);
        });

        const detailFilterBtn = this.el.querySelector('.vst-detail-filter') as HTMLElement;
        detailFilterBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.headerControls.showBarDetalizationDropdown(detailFilterBtn);
        });

        const execFilterBtn = this.el.querySelector('.vst-exec-filter') as HTMLElement;
        execFilterBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.headerControls.showScriptExecutionDropdown(execFilterBtn);
        });

        // Scale settings gear button in perf header
        const scaleSettingsBtn = this.el.querySelector('.vst-btn-scale-settings') as HTMLElement;
        scaleSettingsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.headerControls.showScaleSettingsDropdown(scaleSettingsBtn);
        });

        // Performance analysis tabs
        this.el.querySelectorAll('.vst-analysis-tabs .vst-analysis-tab').forEach((tab) => {
            tab.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tabKey = target.dataset.tab as PerformanceAnalysisTabId;
                if (tabKey) {
                    this.setAnalysisTab(tabKey);
                }
            });
        });

        // Trades analysis tabs
        this.el.querySelectorAll('.vst-trades-analysis-tabs .vst-trades-analysis-tab').forEach((tab) => {
            tab.addEventListener('click', (e) => {
                const target = e.currentTarget as HTMLElement;
                const tabKey = target.dataset.tab as TradesAnalysisTabId;
                if (tabKey) {
                    this.setTradesAnalysisTab(tabKey);
                }
            });
        });

        // Setup resize observer on containers
        this.resizeObserver = new ResizeObserver(() => {
            if (this.mode !== 'hidden') {
                this.equityChart.resize();
            }
            this.perfAnalysis.resize();
            this.tradesAnalysis.resize();
        });
        this.resizeObserver.observe(this.dom.chartContainerEl);
        if (this.dom.analysisBodyEl) {
            this.resizeObserver.observe(this.dom.analysisBodyEl);
        }
        if (this.dom.tradesAnalysisBodyEl) {
            this.resizeObserver.observe(this.dom.tradesAnalysisBodyEl);
        }
    }

    private onDragStart(e: MouseEvent): void {
        e.preventDefault();
        this.isDragging = true;
        this.startY = e.clientY;
        this.startHeight = this.el.getBoundingClientRect().height;

        document.body.style.cursor = 'row-resize';
        document.body.style.userSelect = 'none';

        const onMouseMove = (ev: MouseEvent) => {
            if (!this.isDragging) return;
            const deltaY = this.startY - ev.clientY;
            const newHeight = this.startHeight + deltaY;
            this.setHeight(newHeight);
        };

        const onMouseUp = () => {
            this.isDragging = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        };

        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    }

    public setMode(mode: StrategyTesterMode): void {
        this.mode = mode;

        this.el.classList.remove('is-open', 'is-absolute', 'is-maximized');
        this.el.style.display = mode === 'hidden' ? 'none' : 'block';

        if (mode === 'hidden') {
            return;
        }

        if (mode === 'docked') {
            this.el.style.height = '34px';
        } else if (mode === 'expanded') {
            this.el.classList.add('is-open', 'is-absolute');
            this.el.style.height = `${this.currentHeight}px`;
            setTimeout(() => {
                this.equityChart.initIfNeeded();
                this.equityChart.resize();
            }, 10);
        } else if (mode === 'maximized') {
            this.el.classList.add('is-open', 'is-maximized');
            this.el.style.height = '100%';
            setTimeout(() => {
                this.equityChart.initIfNeeded();
                this.equityChart.resize();
            }, 10);
        }
    }

    public toggleChartExpanded(): void {
        this.isChartExpanded = !this.isChartExpanded;
        this.el.classList.toggle('is-chart-expanded', this.isChartExpanded);

        const expandBtn = this.el.querySelector('.vst-perf-expand-chart');
        if (expandBtn) {
            expandBtn.classList.toggle('is-active', this.isChartExpanded);
            expandBtn.setAttribute('title', this.isChartExpanded ? 'Restore chart' : 'Expand chart');
        }

        if (this.currentView === 'chart') {
            this.dom.analysisSectionEl.style.display = this.isChartExpanded ? 'none' : 'block';
            if (this.dom.tradesAnalysisSectionEl) {
                this.dom.tradesAnalysisSectionEl.style.display = this.isChartExpanded ? 'none' : 'block';
            }
        }

        setTimeout(() => {
            this.equityChart.resize();
            this.perfAnalysis.resize();
            this.tradesAnalysis.resize();
        }, 10);
    }

    public getMode(): StrategyTesterMode {
        return this.mode;
    }

    public getView(): StrategyTesterView {
        return this.currentView;
    }

    public getHeight(): number {
        return this.currentHeight;
    }

    public setHeight(height: number): void {
        this.currentHeight = Math.max(120, Math.min(window.innerHeight - 80, height));
        if (this.mode === 'expanded') {
            this.el.style.height = `${this.currentHeight}px`;
            this.equityChart.resize();
        }
    }

    public setView(view: StrategyTesterView): void {
        this.currentView = view;
        this.el.querySelectorAll('.vst-seg-btn').forEach((btn) => {
            btn.classList.toggle('is-active', (btn as HTMLElement).dataset.view === view);
        });
        if (view === 'chart') {
            if (this.dom.perfViewEl) this.dom.perfViewEl.style.display = 'flex';
            this.dom.perfSectionEl.style.display = 'flex';
            this.dom.analysisSectionEl.style.display = this.isChartExpanded ? 'none' : 'block';
            if (this.dom.tradesAnalysisSectionEl) {
                this.dom.tradesAnalysisSectionEl.style.display = this.isChartExpanded ? 'none' : 'block';
            }
            this.dom.tradesSectionEl.style.display = 'none';
            this.equityChart.resize();
            this.perfAnalysis.resize();
            this.tradesAnalysis.resize();
        } else {
            if (this.dom.perfViewEl) this.dom.perfViewEl.style.display = 'none';
            this.dom.perfSectionEl.style.display = 'none';
            this.dom.analysisSectionEl.style.display = 'none';
            if (this.dom.tradesAnalysisSectionEl) {
                this.dom.tradesAnalysisSectionEl.style.display = 'none';
            }
            this.dom.tradesSectionEl.style.display = 'flex';
            this.tradesTable.render();
        }
    }

    private extractTitle(h: IndicatorHandle): string {
        if (h.source) {
            const m = /^\s*(?:indicator|strategy)\s*\(\s*(?:title\s*=\s*)?(["'])((?:\\.|(?!\1).)*)\1/m.exec(h.source);
            if (m?.[2]) return m[2];
        }
        if (h.title && h.title !== 'Indicator') return h.title;
        return 'EMA Golden Cross Strategy';
    }

    public async bindStrategy(handle: IndicatorHandle | null): Promise<void> {
        if (this.activeHandle?.id !== handle?.id) {
            this.equityChart.clearZoomState();
            this.lastProcessedHandleId = undefined;
            this.lastProcessedTradesCount = -1;
            this.lastProcessedTradePnl = null;
            this.lastProcessedSnapState = null;
        }
        this.activeHandle = handle;

        if (!handle || !handle.visible) {
            this.setMode('hidden');
            return;
        }

        // Title update
        const title = this.extractTitle(handle);
        this.dom.stratNameDockEl.textContent = title;
        this.dom.stratNameTabEl.textContent = title;

        // If currently hidden, default to docked mode
        if (this.mode === 'hidden') {
            this.setMode('docked');
        }

        // Pull context snapshot from the engine
        try {
            const snap = await handle.context(['strategy', 'trades']);
            this.processSnapshot(snap);
        } catch {
            this.processSnapshot(null);
        }
    }

    private processSnapshot(snap: EngineContextSnapshot | null): void {
        const strategy = snap?.strategy;
        const trades = snap?.trades ?? [];

        const tradesCount = trades.length;
        const lastTradePnl = trades.length > 0 ? (trades[trades.length - 1]?.pnl ?? null) : null;
        const handleId = this.activeHandle?.id;
        const snapState = trades.length > 0 && strategy ? 'pine' : 'demo';

        const isUnchanged = (
            handleId === this.lastProcessedHandleId &&
            tradesCount === this.lastProcessedTradesCount &&
            lastTradePnl === this.lastProcessedTradePnl &&
            this.lastProcessedSnapState === snapState
        );

        if (isUnchanged) {
            return;
        }

        this.lastProcessedHandleId = handleId;
        this.lastProcessedTradesCount = tradesCount;
        this.lastProcessedTradePnl = lastTradePnl;
        this.lastProcessedSnapState = snapState;

        if (trades.length > 0 && strategy) {
            this.allRawTrades = trades;
            this.baseInitialCapital = strategy.initialCapital || 10000;
        } else {
            const chart = this.getActiveChart();
            const orch = (chart as unknown as ChartWithOrchestrator | null)?.orchestrator;
            const bars: OHLCV[] = orch?.bars ?? orch?.rawBars ?? [];
            const ref = generateReferenceData(bars);
            this.allRawTrades = ref.trades;
            this.baseInitialCapital = ref.stats.initialCapital;
        }

        this.applyTestingPeriod(this.selectedTestingPeriod);
    }

    public applyTestingPeriod(periodKey: string): void {
        this.selectedTestingPeriod = periodKey;
        if (this.allRawTrades.length === 0) return;

        const filtered = filterTradesByPeriod(this.allRawTrades, periodKey, this.customDateRange);
        this.recalculateActiveTrades(filtered);
    }

    private promptCustomDateRange(): void {
        const minT = this.allRawTrades.length > 0 ? Math.min(...this.allRawTrades.map((t) => t.entry.time)) : Date.now();
        const maxT = this.allRawTrades.length > 0 ? Math.max(...this.allRawTrades.map((t) => t.exit?.time ?? t.entry.time)) : Date.now();
        const d0 = new Date(minT);
        const d1 = new Date(maxT);
        const defFrom = `${d0.getFullYear()}-${String(d0.getMonth() + 1).padStart(2, '0')}-${String(d0.getDate()).padStart(2, '0')}`;
        const defTo = `${d1.getFullYear()}-${String(d1.getMonth() + 1).padStart(2, '0')}-${String(d1.getDate()).padStart(2, '0')}`;

        const fromInput = prompt('Enter From date (YYYY-MM-DD):', defFrom);
        if (!fromInput) return;
        const toInput = prompt('Enter To date (YYYY-MM-DD):', defTo);
        if (!toInput) return;

        const tFrom = new Date(fromInput).getTime();
        const tTo = new Date(toInput).getTime();
        if (isNaN(tFrom) || isNaN(tTo)) return;

        this.selectedTestingPeriod = 'custom';
        this.customDateRange = { from: tFrom, to: tTo };
        const filtered = filterTradesByPeriod(this.allRawTrades, 'custom', this.customDateRange);
        this.recalculateActiveTrades(filtered);
    }

    private recalculateActiveTrades(trades: StrategyTrade[]): void {
        this.cachedTrades = trades;
        const initCap = this.baseInitialCapital || 10000;

        const closed = trades.filter((t) => !t.open && t.pnl !== undefined);
        const wins = closed.filter((t) => (t.pnl ?? 0) > 0).length;
        const losses = closed.filter((t) => (t.pnl ?? 0) < 0).length;
        const totalTrades = closed.length;
        const totalPnl = closed.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
        const totalPnlPct = (totalPnl / initCap) * 100;
        const grossProfit = closed.filter((t) => (t.pnl ?? 0) > 0).reduce((acc, t) => acc + (t.pnl ?? 0), 0);
        const grossLoss = Math.abs(closed.filter((t) => (t.pnl ?? 0) < 0).reduce((acc, t) => acc + (t.pnl ?? 0), 0));
        const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
        const profitableTradesPct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

        let peak = initCap;
        let eqRun = initCap;
        let maxDd = 0;
        for (const t of closed) {
            eqRun += (t.pnl ?? 0);
            if (eqRun > peak) peak = eqRun;
            const dd = peak - eqRun;
            if (dd > maxDd) maxDd = dd;
        }
        const maxDrawdownPct = (maxDd / initCap) * 100;

        this.cachedStats = {
            totalPnl,
            totalPnlPct,
            maxDrawdown: maxDd,
            maxDrawdownPct,
            profitableTradesPct,
            wins,
            losses,
            totalTrades,
            profitFactor,
            initialCapital: initCap,
            currency: 'NONE',
            grossProfit,
            grossLoss,
        };

        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        if (trades.length > 0 && this.dom.dateRangeTextEl) {
            const minT = Math.min(...trades.map((t) => t.entry.time));
            const maxT = Math.max(...trades.map((t) => t.exit?.time ?? t.entry.time));
            const d0 = new Date(minT);
            const d1 = new Date(maxT);
            this.dom.dateRangeTextEl.textContent = `${months[d0.getMonth()]} ${d0.getDate()}, ${d0.getFullYear()} — ${months[d1.getMonth()]} ${d1.getDate()}, ${d1.getFullYear()}`;
        }

        let eq = 0;
        this.cachedCumPnl = [];
        this.cachedBuyHold = [];
        this.cachedTradeBars = [];
        this.cachedMfeBars = [];
        this.cachedRealizedBars = [];
        this.cachedMaeBars = [];
        this.cachedRunupsDrawdowns = [];
        this.cachedTimeline = [];
        this.cachedTimestamps = [];

        const chart = this.getActiveChart();
        const orch = (chart as unknown as ChartWithOrchestrator | null)?.orchestrator;
        const bars: OHLCV[] = orch?.bars ?? orch?.rawBars ?? [];

        const getBarPriceAtTime = (time: number): number | null => {
            if (!bars || bars.length === 0) return null;
            let low = 0;
            let high = bars.length - 1;
            let best = bars[0]!;
            while (low <= high) {
                const mid = Math.floor((low + high) / 2);
                const b = bars[mid]!;
                if (b.time <= time) {
                    best = b;
                    low = mid + 1;
                } else {
                    high = mid - 1;
                }
            }
            return best.close;
        };

        const firstTradeTime = trades[0]?.entry.time ?? (bars[0]?.time ?? 0);
        const p0 = getBarPriceAtTime(firstTradeTime) ?? trades[0]?.entry.price ?? (bars[0]?.close ?? 1);

        for (let i = 0; i < trades.length; i++) {
            const t = trades[i]!;
            const p = t.pnl ?? 0;
            eq += p;
            this.cachedCumPnl.push(Number(eq.toFixed(2)));

            const exitTime = t.exit?.time ?? t.entry.time;
            const currentPrice = getBarPriceAtTime(exitTime) ?? t.exit?.price ?? t.entry.price ?? p0;
            const bnHPnl = p0 > 0 ? initCap * ((currentPrice - p0) / p0) : 0;
            this.cachedBuyHold.push(Number(bnHPnl.toFixed(2)));
            this.cachedTradeBars.push({
                value: [i, Number(p.toFixed(2))],
                itemStyle: { color: p >= 0 ? 'rgba(8, 153, 129, 0.75)' : 'rgba(242, 54, 69, 0.75)' },
            });

            const runupVal = t.maxRunup ?? (p > 0 ? Number((p * 1.3).toFixed(2)) : Number(Math.max(10, Math.abs(p) * 0.25).toFixed(2)));
            const drawdownVal = t.maxDrawdown ?? Number((Math.abs(Math.min(0, p * 1.1)) || Math.min(100, Math.abs(p) * 0.2)).toFixed(2));
            const runupPct = initCap > 0 ? Number(((runupVal / initCap) * 100).toFixed(2)) : 0;
            const drawdownPct = initCap > 0 ? Number(((drawdownVal / initCap) * 100).toFixed(2)) : 0;

            const entryD = new Date(t.entry.time);
            const exitD = new Date(t.exit?.time ?? t.entry.time);
            const entryDateStr = `${months[entryD.getMonth()]} ${entryD.getDate()}, ${entryD.getFullYear()}`;
            const exitDateStr = `${months[exitD.getMonth()]} ${exitD.getDate()}, ${exitD.getFullYear()}`;

            this.cachedMfeBars.push({ value: [i, runupVal], itemStyle: { color: 'rgba(8, 153, 129, 0.42)' } });
            this.cachedRealizedBars.push({ value: [i, Number(p.toFixed(2))], itemStyle: { color: p >= 0 ? '#089981' : '#f23645' } });
            this.cachedMaeBars.push({ value: [i, -drawdownVal], itemStyle: { color: 'rgba(242, 54, 69, 0.72)' } });
            this.cachedRunupsDrawdowns.push({
                entryIdx: Math.max(0, i - 1),
                exitIdx: i,
                pnl: p,
                val: p >= 0 ? runupVal : drawdownVal,
                pct: p >= 0 ? runupPct : drawdownPct,
                entryDateStr,
                exitDateStr,
            });
            this.cachedTimeline.push(`${exitD.getFullYear()}-${String(exitD.getMonth() + 1).padStart(2, '0')}-${String(exitD.getDate()).padStart(2, '0')}`);
            this.cachedTimestamps.push(exitD.getTime());
        }

        this.updateStatsUI();
        this.equityChart.update();
        this.perfAnalysis.render();
        this.tradesAnalysis.render();
        if (this.currentView === 'table') {
            this.tradesTable.render();
        }
    }

    private recalculateCapitalAndStats(): void {
        if (!this.cachedStats) return;
        this.cachedStats.initialCapital = this.customCapitalAmount;
        this.cachedStats.totalPnlPct = (this.cachedStats.totalPnl / this.customCapitalAmount) * 100;
        this.cachedStats.maxDrawdownPct = (this.cachedStats.maxDrawdown / this.customCapitalAmount) * 100;
        this.cachedStats.currency = this.selectedCurrency === 'SAME' ? 'NONE' : this.selectedCurrency;
        this.updateStatsUI();
        this.headerControls.updateCapitalPillLabel();
        if (this.equityChart.scaleMode === 'percent') {
            this.equityChart.update();
        }
        this.perfAnalysis.render();
        this.tradesAnalysis.render();
        if (this.currentView === 'table') {
            this.tradesTable.render();
        }
    }

    private updateStatsUI(): void {
        if (!this.cachedStats) return;
        const s = this.cachedStats;

        // Card container stats
        this.dom.totalPnlEl.textContent = formatSignedNumber(s.totalPnl);
        this.dom.totalPnlEl.className = `vst-stat-val ${s.totalPnl >= 0 ? 'is-positive' : 'is-negative'}`;
        this.dom.totalPnlPctEl.textContent = `${s.totalPnlPct >= 0 ? '+' : ''}${s.totalPnlPct.toFixed(2)}%`;
        this.dom.totalPnlPctEl.className = `vst-stat-sub ${s.totalPnlPct >= 0 ? 'is-positive' : 'is-negative'}`;

        this.dom.maxDdEl.textContent = formatNumber(s.maxDrawdown);
        this.dom.maxDdPctEl.textContent = `${s.maxDrawdownPct.toFixed(2)}%`;

        this.dom.winRateEl.textContent = `${s.profitableTradesPct.toFixed(2)}%`;
        this.dom.tradesCountEl.textContent = `${s.wins}/${s.totalTrades}`;

        this.dom.profitFactorEl.textContent = s.profitFactor.toFixed(2);
        if (this.cachedTrades.length > 0 && this.dom.dateRangeTextEl) {
            const minT = Math.min(...this.cachedTrades.map((t) => t.entry.time));
            const maxT = Math.max(...this.cachedTrades.map((t) => t.exit?.time ?? t.entry.time));
            const d0 = new Date(minT);
            const d1 = new Date(maxT);
            const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
            this.dom.dateRangeTextEl.textContent = `${months[d0.getMonth()]} ${d0.getDate()}, ${d0.getFullYear()} — ${months[d1.getMonth()]} ${d1.getDate()}, ${d1.getFullYear()}`;
        }

        // Inline strip stats (maximized mode)
        const inlinePnl = this.el.querySelector('#vst-inline-total-pnl');
        if (inlinePnl) {
            inlinePnl.textContent = formatSignedNumber(s.totalPnl);
            inlinePnl.className = `vst-inline-stat-val ${s.totalPnl >= 0 ? 'is-positive' : 'is-negative'}`;
        }
        const inlinePnlPct = this.el.querySelector('#vst-inline-total-pnl-pct');
        if (inlinePnlPct) {
            inlinePnlPct.textContent = `${s.totalPnlPct >= 0 ? '+' : ''}${s.totalPnlPct.toFixed(2)}%`;
            inlinePnlPct.className = `vst-inline-stat-sub ${s.totalPnlPct >= 0 ? 'is-positive' : 'is-negative'}`;
        }
        const inlineMaxDd = this.el.querySelector('#vst-inline-max-dd');
        if (inlineMaxDd) inlineMaxDd.textContent = formatNumber(s.maxDrawdown);
        const inlineMaxDdPct = this.el.querySelector('#vst-inline-max-dd-pct');
        if (inlineMaxDdPct) inlineMaxDdPct.textContent = `${s.maxDrawdownPct.toFixed(2)}%`;
        const inlineWinRate = this.el.querySelector('#vst-inline-win-rate');
        if (inlineWinRate) inlineWinRate.textContent = `${s.profitableTradesPct.toFixed(2)}%`;
        const inlineTradesCount = this.el.querySelector('#vst-inline-trades-count');
        if (inlineTradesCount) inlineTradesCount.textContent = `${s.wins}/${s.totalTrades}`;
        const inlinePf = this.el.querySelector('#vst-inline-profit-factor');
        if (inlinePf) inlinePf.textContent = s.profitFactor.toFixed(2);

        this.el.querySelectorAll('.vst-inline-stat-curr, .vst-stat-curr').forEach((currEl) => {
            currEl.textContent = s.currency || 'NONE';
        });
    }

    public setAnalysisTab(tab: PerformanceAnalysisTabId): void {
        this.el.querySelectorAll('.vst-analysis-tab').forEach((t) => {
            const btn = t as HTMLElement;
            btn.classList.toggle('is-active', btn.dataset.tab === tab);
        });
        this.perfAnalysis.setTab(tab);
    }

    public setTradesAnalysisTab(tab: TradesAnalysisTabId): void {
        this.el.querySelectorAll('.vst-trades-analysis-tab').forEach((t) => {
            const btn = t as HTMLElement;
            btn.classList.toggle('is-active', btn.dataset.tab === tab);
        });
        this.tradesAnalysis.setTab(tab);
    }

    public destroy(): void {
        this.headerControls.closeAnyDropdown();
        this.resizeObserver?.disconnect();
        this.equityChart.dispose();
        this.perfAnalysis.dispose();
        this.tradesAnalysis.dispose();
        this.el.remove();
    }
}
