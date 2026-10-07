export interface StrategyTesterDOMElements {
    resizerEl: HTMLElement;
    dockBarEl: HTMLElement;
    drawerBodyEl: HTMLElement;
    perfViewEl: HTMLElement;
    perfSectionEl: HTMLElement;
    analysisSectionEl: HTMLElement;
    analysisBodyEl: HTMLElement;
    tradesAnalysisSectionEl: HTMLDivElement;
    tradesAnalysisBodyEl: HTMLDivElement;
    tradesSectionEl: HTMLElement;
    chartContainerEl: HTMLElement;
    tradesTableEl: HTMLElement;

    totalPnlEl: HTMLElement;
    totalPnlPctEl: HTMLElement;
    maxDdEl: HTMLElement;
    maxDdPctEl: HTMLElement;
    winRateEl: HTMLElement;
    tradesCountEl: HTMLElement;
    profitFactorEl: HTMLElement;

    stratNameDockEl: HTMLElement;
    stratNameTabEl: HTMLElement;
    dateRangeTextEl: HTMLElement;
}

export function buildDOM(rootEl: HTMLElement): StrategyTesterDOMElements {
    rootEl.innerHTML = `
        <div class="vst-resizer" title="Drag to resize">
            <div class="vst-resizer-line"></div>
        </div>

        <!-- Dock Bar (Image 1) -->
        <div class="vst-dock-bar">
            <div class="vst-dock-left">
                <span class="vst-icon vst-strat-icon">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M1.5 12.5l4-5 3.5 3.5 5.5-7.5"/>
                        <circle cx="5.5" cy="7.5" r="1.3" fill="currentColor"/>
                        <circle cx="9" cy="11" r="1.3" fill="currentColor"/>
                    </svg>
                </span>
                <button class="vst-title-btn vst-strat-btn">
                    <span class="vst-strat-name vst-dock-title">EMA Golden Cross Strategy</span>
                    <svg class="vst-chevron" viewBox="0 0 10 6" width="9" height="6" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4"/></svg>
                </button>
            </div>
            <div class="vst-dock-right">
                <button class="vst-icon-btn vst-btn-expand" title="Open backtest panel">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3.5 10.5l4.5-4.5 4.5 4.5"/></svg>
                </button>
                <button class="vst-icon-btn vst-btn-maximize" title="Maximize panel">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/>
                    </svg>
                </button>
            </div>
        </div>

        <!-- Drawer Body (Image 3, 4, 5) -->
        <div class="vst-drawer-body">
            <!-- Top Header Row -->
            <div class="vst-top-header">
                <div class="vst-strat-tab">
                    <span class="vst-icon vst-strat-icon">
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M1.5 12.5l4-5 3.5 3.5 5.5-7.5"/>
                            <circle cx="5.5" cy="7.5" r="1.3" fill="currentColor"/>
                            <circle cx="9" cy="11" r="1.3" fill="currentColor"/>
                        </svg>
                    </span>
                    <button class="vst-tab-title-btn vst-strat-btn">
                        <span class="vst-strat-name vst-tab-title">EMA Golden Cross Strategy</span>
                        <svg class="vst-chevron" viewBox="0 0 10 6" width="9" height="6" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4"/></svg>
                    </button>
                </div>

                <!-- Inline stats strip (visible in maximized mode, Image 3) -->
                <div class="vst-inline-stats-strip">
                    <div class="vst-inline-stat-item">
                        <span class="vst-inline-stat-label">Total PnL</span>
                        <span class="vst-inline-stat-val is-positive" id="vst-inline-total-pnl">+10,326.23</span>
                        <span class="vst-inline-stat-curr">NONE</span>
                        <span class="vst-inline-stat-sub is-positive" id="vst-inline-total-pnl-pct">+103.26%</span>
                    </div>
                    <div class="vst-inline-stat-divider">|</div>
                    <div class="vst-inline-stat-item">
                        <span class="vst-inline-stat-label">Max drawdown</span>
                        <span class="vst-inline-stat-val" id="vst-inline-max-dd">580.66</span>
                        <span class="vst-inline-stat-curr">NONE</span>
                        <span class="vst-inline-stat-sub" id="vst-inline-max-dd-pct">5.65%</span>
                    </div>
                    <div class="vst-inline-stat-divider">|</div>
                    <div class="vst-inline-stat-item">
                        <span class="vst-inline-stat-label">Profitable trades</span>
                        <span class="vst-inline-stat-val" id="vst-inline-win-rate">43.96%</span>
                        <span class="vst-inline-stat-sub is-muted" id="vst-inline-trades-count">40/91</span>
                    </div>
                    <div class="vst-inline-stat-divider">|</div>
                    <div class="vst-inline-stat-item">
                        <span class="vst-inline-stat-label">Profit factor</span>
                        <span class="vst-inline-stat-val" id="vst-inline-profit-factor">3.13</span>
                    </div>
                </div>

                <div class="vst-header-actions">
                    <button class="vst-icon-btn vst-btn-minimize" title="Minimize to bar">
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 8h10"/></svg>
                    </button>
                    <button class="vst-icon-btn vst-btn-toggle-max" title="Restore/Maximize">
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
                            <path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/>
                        </svg>
                    </button>
                </div>
            </div>

            <!-- Secondary Filter Bar -->
            <div class="vst-controls-bar">
                <div class="vst-seg-group">
                    <button class="vst-seg-btn is-active" data-view="chart" title="Performance Chart">
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M2 13c3-8 5 4 8-6 2 4 4 1 4 1"/></svg>
                    </button>
                    <button class="vst-seg-btn" data-view="table" title="Trades List">
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><path d="M2 6h12M2 10h12M6 2v12M10 2v12"/></svg>
                    </button>
                </div>

                <button class="vst-dropdown-pill vst-date-filter" title="Backtest period">
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 7h12M5 1.5v3M11 1.5v3"/></svg>
                    <span class="vst-date-text">Feb 1, 1871 — Oct 5, 2026</span>
                    <svg class="vst-chevron" viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4"/></svg>
                </button>

                <button class="vst-dropdown-pill vst-capital-filter" title="Initial Capital">
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 4.5v7M6.5 6.5h3c.5 0 1 .5 1 1s-.5 1-1 1h-3c-.5 0-1 .5-1 1s.5 1 1 1h3.5"/></svg>
                    <span class="vst-capital-text">10 K Same as chart</span>
                    <svg class="vst-chevron" viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4"/></svg>
                </button>

                <button class="vst-dropdown-pill vst-detail-filter" title="Detailization mode">
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M4 2v12M12 2v12M2 5h4v5H2zM10 7h4v4h-4z"/></svg>
                    <span>Default detalization</span>
                    <svg class="vst-chevron" viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4"/></svg>
                </button>

                <button class="vst-dropdown-pill vst-exec-filter" title="Script execution">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.5">
                        <path d="M3 2v3.5M1.5 4L3 5.5l1.5-1.5"/>
                        <path d="M7 14v-3.5M5.5 12l1.5-1.5 1.5 1.5"/>
                        <path d="M2.5 9c1.5-2.5 3.5-3.5 5.5-0.5s3.5 2 5.5-2"/>
                    </svg>
                    <span>Script execution</span>
                    <span class="vst-badge-circle">1</span>
                    <svg class="vst-chevron" viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4"/></svg>
                </button>

                <div class="vst-divider"></div>

                <button class="vst-icon-btn vst-btn-strat-settings" title="Strategy properties">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5l1.5 1.5M3 13l1.5-1.5M11.5 4.5l1.5-1.5"/></svg>
                </button>
                <button class="vst-icon-btn" title="Create Alert from strategy">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5"/><path d="M8 5v3l2 1.5M4 1.5l-2 2M12 1.5l2 2"/></svg>
                </button>
            </div>

            <!-- Performance View (Scrollable container in chart mode) -->
            <div class="vst-perf-view">
                <!-- Key Stats Section -->
                <div class="vst-stats-card-container">
                    <div class="vst-stats-title">Key stats</div>
                    <div class="vst-stats-grid">
                        <div class="vst-stat-card">
                            <div class="vst-stat-label">Total PnL</div>
                            <div class="vst-stat-value-row">
                                <span class="vst-stat-val is-positive" id="vst-total-pnl">+10,326.23</span>
                                <span class="vst-stat-curr">NONE</span>
                                <span class="vst-stat-sub is-positive" id="vst-total-pnl-pct">+103.26%</span>
                            </div>
                        </div>
                        <div class="vst-stat-card">
                            <div class="vst-stat-label">Max drawdown</div>
                            <div class="vst-stat-value-row">
                                <span class="vst-stat-val" id="vst-max-dd">580.66</span>
                                <span class="vst-stat-curr">NONE</span>
                                <span class="vst-stat-sub" id="vst-max-dd-pct">5.65%</span>
                            </div>
                        </div>
                        <div class="vst-stat-card">
                            <div class="vst-stat-label">Profitable trades</div>
                            <div class="vst-stat-value-row">
                                <span class="vst-stat-val" id="vst-win-rate">43.96%</span>
                                <span class="vst-stat-sub is-muted" id="vst-trades-count">40/91</span>
                            </div>
                        </div>
                        <div class="vst-stat-card">
                            <div class="vst-stat-label">Profit factor</div>
                            <div class="vst-stat-value-row">
                                <span class="vst-stat-val" id="vst-profit-factor">3.13</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Performance Chart Section -->
                <div class="vst-perf-section">
                    <div class="vst-perf-header">
                        <div class="vst-perf-title-row">
                            <span class="vst-perf-title">Performance</span>
                            <span class="vst-info-icon" title="Strategy performance metrics and backtest visualization">
                                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 5h.01"/></svg>
                            </span>
                        </div>
                        <div class="vst-perf-actions">
                            <button class="vst-icon-btn vst-btn-scale-settings" title="Scale settings">
                                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="5"/><path d="M8 1v3M8 12v3M1 8h3M12 8h3"/></svg>
                            </button>
                            <button class="vst-icon-btn vst-btn-strat-settings" title="Strategy properties">
                                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3 3l1.5 1.5M11.5 11.5l1.5 1.5M3 13l1.5-1.5M11.5 4.5l1.5-1.5"/></svg>
                            </button>
                            <button class="vst-icon-btn vst-perf-screenshot" title="Export image">
                                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2 5h3l1.5-2h3L11 5h3v9H2z"/><circle cx="8" cy="9.5" r="2.5"/></svg>
                            </button>
                            <button class="vst-icon-btn vst-perf-expand-chart" title="Expand chart">
                                <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M2.5 5.5v-3h3M10.5 2.5h3v3M13.5 10.5v3h-3M5.5 13.5h-3v-3"/></svg>
                            </button>
                        </div>
                    </div>

                    <div class="vst-perf-content">
                        <!-- Series Toggles Overlay (Image 3, 4, 5) -->
                        <div class="vst-series-toggles" id="vst-series-toggles">
                            <button class="vst-series-pill-compact" id="vst-series-compact-btn" title="Show series (4)" style="display:none;">
                                <svg viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4"/></svg>
                                <span class="vst-compact-count">4</span>
                            </button>
                            <div class="vst-series-pills-list" id="vst-series-pills-list">
                                <button class="vst-series-pill is-active" data-series="cumPnl" title="Toggle Cumulative PnL">
                                    <span class="vst-series-label">Cumulative PnL</span>
                                    <span class="vst-series-eye" title="Hide/Show">
                                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5-6.5-4.5-6.5-4.5z"/><circle cx="8" cy="8" r="2"/></svg>
                                    </span>
                                </button>
                                <button class="vst-series-pill" data-series="buyHold" title="Toggle Buy and hold">
                                    <span class="vst-series-label">Buy and hold</span>
                                    <span class="vst-series-eye" title="Hide/Show">
                                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5-6.5-4.5-6.5-4.5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>
                                    </span>
                                </button>
                                <button class="vst-series-pill is-active" data-series="tradesExcursions" title="Toggle Trades excursions">
                                    <span class="vst-series-label">Trades excursions</span>
                                    <span class="vst-series-eye" title="Hide/Show">
                                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5-6.5-4.5-6.5-4.5z"/><circle cx="8" cy="8" r="2"/></svg>
                                    </span>
                                </button>
                                <button class="vst-series-pill" data-series="runupsDrawdowns" title="Toggle Run-ups and drawdowns">
                                    <span class="vst-series-label">Run-ups and drawdowns</span>
                                    <span class="vst-series-eye" title="Hide/Show">
                                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5-6.5-4.5-6.5-4.5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>
                                    </span>
                                </button>
                                <button class="vst-series-collapse-btn" id="vst-series-collapse-btn" title="Collapse list">
                                    <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M3 10l5-5 5 5"/></svg>
                                </button>
                            </div>
                        </div>

                        <!-- ECharts Element -->
                        <div class="vst-echarts-container" id="vst-echarts"></div>
                    </div>
                </div>

                <!-- Performance Analysis Section (media_1791250134285.png) -->
                <div class="vst-analysis-section">
                    <div class="vst-analysis-title">Performance analysis</div>
                    <div class="vst-analysis-tabs">
                        <button class="vst-analysis-tab is-active" data-tab="breakdown">Breakdown</button>
                        <button class="vst-analysis-tab" data-tab="periodical">Periodical</button>
                        <button class="vst-analysis-tab" data-tab="benchmarking">Benchmarking</button>
                        <button class="vst-analysis-tab" data-tab="margin-usage">Margin usage</button>
                        <button class="vst-analysis-tab" data-tab="growth-decline">Growth and decline</button>
                    </div>
                    <div class="vst-analysis-body" id="vst-analysis-body"></div>
                </div>

                <!-- Trades Analysis Section (media_1791250361342.png) -->
                <div class="vst-trades-analysis-section">
                    <div class="vst-analysis-title">Trades analysis</div>
                    <div class="vst-trades-analysis-tabs">
                        <button class="vst-analysis-tab vst-trades-analysis-tab is-active" data-tab="distribution">Distribution</button>
                        <button class="vst-analysis-tab vst-trades-analysis-tab" data-tab="streaks">Streaks</button>
                        <button class="vst-analysis-tab vst-trades-analysis-tab" data-tab="time-patterns">Time patterns</button>
                    </div>
                    <div class="vst-trades-analysis-body" id="vst-trades-analysis-body"></div>
                </div>
            </div>

            <!-- Trades List Section (Dedicated Table View, media_1791243438337.png) -->
            <div class="vst-trades-section" style="display:none;">
                <div class="vst-trades-table-container"></div>
            </div>
        </div>
    `;

    return {
        resizerEl: rootEl.querySelector('.vst-resizer')!,
        dockBarEl: rootEl.querySelector('.vst-dock-bar')!,
        drawerBodyEl: rootEl.querySelector('.vst-drawer-body')!,
        perfViewEl: rootEl.querySelector('.vst-perf-view')!,
        perfSectionEl: rootEl.querySelector('.vst-perf-section')!,
        analysisSectionEl: rootEl.querySelector('.vst-analysis-section')!,
        analysisBodyEl: rootEl.querySelector('#vst-analysis-body')!,
        tradesAnalysisSectionEl: rootEl.querySelector('.vst-trades-analysis-section')!,
        tradesAnalysisBodyEl: rootEl.querySelector('#vst-trades-analysis-body')!,
        tradesSectionEl: rootEl.querySelector('.vst-trades-section')!,
        chartContainerEl: rootEl.querySelector('#vst-echarts')!,
        tradesTableEl: rootEl.querySelector('.vst-trades-table-container')!,

        totalPnlEl: rootEl.querySelector('#vst-total-pnl')!,
        totalPnlPctEl: rootEl.querySelector('#vst-total-pnl-pct')!,
        maxDdEl: rootEl.querySelector('#vst-max-dd')!,
        maxDdPctEl: rootEl.querySelector('#vst-max-dd-pct')!,
        winRateEl: rootEl.querySelector('#vst-win-rate')!,
        tradesCountEl: rootEl.querySelector('#vst-trades-count')!,
        profitFactorEl: rootEl.querySelector('#vst-profit-factor')!,

        stratNameDockEl: rootEl.querySelector('.vst-dock-title')!,
        stratNameTabEl: rootEl.querySelector('.vst-tab-title')!,
        dateRangeTextEl: rootEl.querySelector('.vst-date-text')!,
    };
}
