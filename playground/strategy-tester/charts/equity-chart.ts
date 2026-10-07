import * as echarts from 'echarts';
import type { StrategyTrade } from '@luxalgo/vela/plugin';
import { formatNumber, formatSignedNumber } from '../core/formatters';

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
    itemStyle?: { color: string };
}

export interface EquityChartOptions {
    containerEl: HTMLElement;
    rootEl?: HTMLElement;
    getTimeline: () => string[];
    getCumPnl: () => number[];
    getBuyHold: () => number[];
    getTimestamps: () => number[];
    getTrades: () => StrategyTrade[];
    getMaeBars: () => ExcursionBarItem[];
    getMfeBars: () => ExcursionBarItem[];
    getRealizedBars: () => ExcursionBarItem[];
    getRunupsDrawdowns: () => RunupDrawdownItem[];
    getCapitalAmount: () => number;
    getBaseInitialCapital: () => number;
}

export class EquityChartManager {
    private readonly opts: EquityChartOptions;
    private chartInstance: echarts.ECharts | null = null;

    public scaleMode: 'regular' | 'percent' = 'regular';
    public showWhitespaces = false;
    public isSeriesCollapsed = false;

    public activeSeries = {
        cumPnl: true,
        buyHold: true,
        tradesExcursions: true,
        runupsDrawdowns: true,
    };

    private savedZoomState: { start?: number; end?: number; startValue?: number; endValue?: number } | null = null;
    private hoveredTradeIdx = -1;

    constructor(opts: EquityChartOptions) {
        this.opts = opts;

        // Double click resets zoom
        this.opts.containerEl.addEventListener('dblclick', () => {
            this.resetZoom();
        });
    }

    public initIfNeeded(): void {
        if (!this.chartInstance && this.opts.containerEl) {
            this.chartInstance = echarts.init(this.opts.containerEl, undefined, {
                renderer: 'canvas',
            });

            // Listen to dataZoom events to preserve user scroll / zoom level
            this.chartInstance.on('dataZoom', (rawEvent: unknown) => {
                const event = rawEvent as {
                    start?: number;
                    end?: number;
                    startValue?: number;
                    endValue?: number;
                    batch?: Array<{ start?: number; end?: number; startValue?: number; endValue?: number }>;
                };
                const item = event.batch ? event.batch[0] : event;
                if (item) {
                    this.savedZoomState = {
                        start: item.start,
                        end: item.end,
                        startValue: item.startValue,
                        endValue: item.endValue,
                    };
                }
            });

            // Listen to axisPointer to show guideline bracket lines
            this.chartInstance.on('updateAxisPointer', (rawEvent: unknown) => {
                if (!this.activeSeries.runupsDrawdowns || !this.chartInstance) return;
                const event = rawEvent as { axesInfo?: Array<{ value?: number }>; dataIndex?: number };
                const dataInfo = event.axesInfo?.[0];
                const idx = dataInfo?.value ?? event.dataIndex;
                if (idx !== undefined && typeof idx === 'number' && idx !== this.hoveredTradeIdx) {
                    this.hoveredTradeIdx = idx;
                    const rds = this.opts.getRunupsDrawdowns();
                    const rd = rds[idx] || rds.find((r) => idx >= r.entryIdx && idx <= r.exitIdx);
                    if (rd) {
                        const trades = this.opts.getTrades();
                        const timestamps = this.opts.getTimestamps();
                        const targetX = this.showWhitespaces
                            ? (trades[rd.entryIdx]?.entry.time ?? timestamps[rd.entryIdx] ?? rd.entryIdx)
                            : rd.entryIdx;
                        const targetEndX = this.showWhitespaces
                            ? (trades[rd.exitIdx]?.exit?.time ?? timestamps[rd.exitIdx] ?? rd.exitIdx)
                            : rd.exitIdx;
                        this.chartInstance.setOption({
                            series: [
                                {
                                    name: 'Runups Guidelines',
                                    markLine: {
                                        data: [{ xAxis: targetX }, { xAxis: targetEndX }],
                                    },
                                },
                            ],
                        });
                    }
                }
            });

            this.update();
        }
    }

    public update(): void {
        if (!this.chartInstance) return;

        const timeline = this.opts.getTimeline();
        const cumPnl = this.opts.getCumPnl();
        const buyHold = this.opts.getBuyHold();
        const timestamps = this.opts.getTimestamps();
        const trades = this.opts.getTrades();
        const runupsDrawdowns = this.opts.getRunupsDrawdowns();

        const lastCumPnl = cumPnl[cumPnl.length - 1] ?? 10326.23;
        const lastBuyHold = buyHold[buyHold.length - 1] ?? 4755654.0;

        const hasEquity = this.activeSeries.cumPnl || this.activeSeries.buyHold;
        const hasExcursions = this.activeSeries.tradesExcursions;
        const hasDrawdowns = this.activeSeries.runupsDrawdowns;

        type CatId = 'equity' | 'excursions' | 'drawdowns';
        const activeCategories: { id: CatId; gridIndex: number }[] = [];
        if (hasEquity) activeCategories.push({ id: 'equity', gridIndex: activeCategories.length });
        if (hasExcursions) activeCategories.push({ id: 'excursions', gridIndex: activeCategories.length });
        if (hasDrawdowns) activeCategories.push({ id: 'drawdowns', gridIndex: activeCategories.length });

        const gridCount = activeCategories.length;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const grids: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const xAxis: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const yAxis: any[] = [];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const series: any[] = [];

        if (gridCount === 0) {
            grids.push({ left: 24, right: 74, top: 32, bottom: 28 });
            xAxis.push({
                type: 'category',
                gridIndex: 0,
                data: timeline,
                axisLine: { lineStyle: { color: '#2e2e2e' } },
                axisLabel: { color: '#787b86', fontSize: 10.5 },
            });
            yAxis.push({
                type: 'value',
                gridIndex: 0,
                position: 'right',
                splitLine: { lineStyle: { color: 'rgba(255,255,255,0.04)', type: 'dashed' } },
            });
        } else if (gridCount === 1) {
            grids.push({ left: 24, right: 74, top: 32, bottom: 28 });
        } else if (gridCount === 2) {
            grids.push(
                { left: 24, right: 74, top: 32, height: '80%' },
                { left: 24, right: 74, top: '85%', height: '10%' }
            );
        } else {
            grids.push(
                { left: 24, right: 74, top: 32, height: '78%' },
                { left: 24, right: 74, top: '83%', height: '8%' },
                { left: 24, right: 74, top: '92%', height: '4%' }
            );
        }

        for (let i = 0; i < gridCount; i++) {
            const cat = activeCategories[i]!;
            const isBottomGrid = i === gridCount - 1;

            if (this.showWhitespaces) {
                const minTime = timestamps.length > 0 ? timestamps[0] : undefined;
                const maxTime = timestamps.length > 0 ? timestamps[timestamps.length - 1] : undefined;
                xAxis.push({
                    type: 'time',
                    gridIndex: cat.gridIndex,
                    min: minTime,
                    max: maxTime,
                    splitNumber: 15,
                    axisLine: { lineStyle: { color: '#2e2e2e' } },
                    axisTick: { show: false },
                    axisLabel: {
                        show: isBottomGrid,
                        color: '#787b86',
                        fontSize: 10.5,
                        formatter: '{yyyy}',
                    },
                    splitLine: { show: false },
                });
            } else {
                xAxis.push({
                    type: 'category',
                    gridIndex: cat.gridIndex,
                    data: timeline,
                    boundaryGap: cat.id === 'equity' ? false : true,
                    axisLine: { lineStyle: { color: '#2e2e2e' } },
                    axisTick: { show: false },
                    axisLabel: {
                        show: isBottomGrid,
                        color: '#787b86',
                        fontSize: 10.5,
                        interval: Math.max(1, Math.floor(timeline.length / 12)),
                        formatter: (val: string) => val.split('-')[0] || val,
                    },
                    splitLine: { show: false },
                });
            }

            if (cat.id === 'equity') {
                yAxis.push({
                    type: 'value',
                    gridIndex: cat.gridIndex,
                    position: 'right',
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: {
                        lineStyle: { color: 'rgba(255, 255, 255, 0.04)', type: 'dashed' },
                    },
                    axisLabel: {
                        color: '#787b86',
                        fontSize: 10.5,
                        formatter: (val: number) => {
                            if (this.scaleMode === 'percent') {
                                const cap = this.opts.getCapitalAmount() || 10000;
                                const pct = (val / cap) * 100;
                                return `${pct >= 0 ? '+' : ''}${pct.toFixed(0)}%`;
                            }
                            if (val >= 10000000) return `${(val / 1000000).toFixed(1)}M`;
                            if (val >= 1000000) return `${(val / 1000000).toFixed(2)}M`;
                            if (val === 0) return '0';
                            return formatNumber(val, 2);
                        },
                    },
                });
            } else if (cat.id === 'excursions') {
                yAxis.push({
                    type: 'value',
                    gridIndex: cat.gridIndex,
                    position: 'right',
                    min: gridCount === 1 ? -500 : undefined,
                    max: gridCount === 1 ? 3500 : undefined,
                    interval: gridCount === 1 ? 500 : undefined,
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: {
                        lineStyle: { color: 'rgba(255, 255, 255, 0.04)', type: 'dashed' },
                    },
                    axisLabel: {
                        show: gridCount === 1,
                        color: '#787b86',
                        fontSize: 10.5,
                        formatter: (val: number) => {
                            if (val === 0) return '0';
                            return formatNumber(val, 2);
                        },
                    },
                });
            } else if (cat.id === 'drawdowns') {
                yAxis.push({
                    type: 'value',
                    gridIndex: cat.gridIndex,
                    position: 'right',
                    min: gridCount === 1 ? -0.04 : undefined,
                    max: gridCount === 1 ? 0.04 : undefined,
                    interval: gridCount === 1 ? 0.02 : undefined,
                    axisLine: { show: false },
                    axisTick: { show: false },
                    splitLine: {
                        show: false,
                    },
                    axisLabel: {
                        show: gridCount === 1,
                        color: '#787b86',
                        fontSize: 10.5,
                        formatter: (val: number) => {
                            if (val === 0) return '0';
                            return val.toFixed(2);
                        },
                    },
                });
            }
        }

        // 1. Equity series
        if (hasEquity) {
            const eqGrid = activeCategories.find((c) => c.id === 'equity')!.gridIndex;
            const initCap = this.opts.getBaseInitialCapital() || 10000;
            const lastBnhLabel = this.scaleMode === 'percent'
                ? `${lastBuyHold >= 0 ? '+' : ''}${((lastBuyHold / initCap) * 100).toFixed(2)}%`
                : formatSignedNumber(lastBuyHold);
            const lastCumPnlLabel = this.scaleMode === 'percent'
                ? `${lastCumPnl >= 0 ? '+' : ''}${((lastCumPnl / initCap) * 100).toFixed(2)}%`
                : formatSignedNumber(lastCumPnl);

            if (this.activeSeries.buyHold) {
                if (this.showWhitespaces) {
                    const buyHoldPoints = timestamps.map((time, idx) => [time, buyHold[idx] ?? 0]);
                    const lastTime = timestamps[timestamps.length - 1] ?? Date.now();
                    series.push({
                        name: 'Buy and hold',
                        type: 'line',
                        xAxisIndex: eqGrid,
                        yAxisIndex: eqGrid,
                        data: buyHoldPoints,
                        smooth: 0.2,
                        showSymbol: false,
                        lineStyle: { color: '#2962ff', width: 1.8 },
                        markPoint: {
                            symbol: 'roundRect',
                            symbolSize: [85, 20],
                            data: [
                                {
                                    coord: [lastTime, lastBuyHold],
                                    value: lastBnhLabel,
                                    itemStyle: { color: '#2962ff' },
                                    label: { color: '#ffffff', fontSize: 10.5, fontWeight: 'bold', formatter: '{c}' },
                                },
                            ],
                        },
                    });
                } else {
                    series.push({
                        name: 'Buy and hold',
                        type: 'line',
                        xAxisIndex: eqGrid,
                        yAxisIndex: eqGrid,
                        data: buyHold,
                        smooth: 0.2,
                        showSymbol: false,
                        lineStyle: { color: '#2962ff', width: 1.8 },
                        markPoint: {
                            symbol: 'roundRect',
                            symbolSize: [85, 20],
                            data: [
                                {
                                    coord: [buyHold.length - 1, lastBuyHold],
                                    value: lastBnhLabel,
                                    itemStyle: { color: '#2962ff' },
                                    label: { color: '#ffffff', fontSize: 10.5, fontWeight: 'bold', formatter: '{c}' },
                                },
                            ],
                        },
                    });
                }
            }

            if (this.activeSeries.cumPnl) {
                if (this.showWhitespaces) {
                    const cumPnlPoints = timestamps.map((time, idx) => {
                        const val = cumPnl[idx] ?? 0;
                        return {
                            value: [time, val],
                            itemStyle: {
                                color: idx === 0 ? '#f23645' : '#089981',
                                borderColor: idx === 0 ? '#f23645' : '#089981',
                            },
                        };
                    });
                    const lastTime = timestamps[timestamps.length - 1] ?? Date.now();
                    series.push({
                        name: 'Cumulative PnL',
                        type: 'line',
                        xAxisIndex: eqGrid,
                        yAxisIndex: eqGrid,
                        data: cumPnlPoints,
                        smooth: 0.1,
                        showSymbol: true,
                        symbol: 'circle',
                        symbolSize: 4.5,
                        itemStyle: { color: '#089981' },
                        lineStyle: { color: '#089981', width: 2 },
                        markPoint: {
                            symbol: 'roundRect',
                            symbolSize: [78, 20],
                            data: [
                                {
                                    coord: [lastTime, lastCumPnl],
                                    value: lastCumPnlLabel,
                                    itemStyle: { color: '#089981' },
                                    label: { color: '#ffffff', fontSize: 10.5, fontWeight: 'bold', formatter: '{c}' },
                                },
                            ],
                        },
                    });
                } else {
                    series.push({
                        name: 'Cumulative PnL',
                        type: 'line',
                        xAxisIndex: eqGrid,
                        yAxisIndex: eqGrid,
                        data: cumPnl,
                        smooth: 0.15,
                        showSymbol: true,
                        symbol: 'circle',
                        symbolSize: 4.5,
                        itemStyle: { color: '#089981' },
                        lineStyle: { color: '#089981', width: 2 },
                        areaStyle: {
                            color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                                { offset: 0, color: 'rgba(8, 153, 129, 0.22)' },
                                { offset: 1, color: 'rgba(8, 153, 129, 0.0)' },
                            ]),
                        },
                        markPoint: {
                            symbol: 'roundRect',
                            symbolSize: [75, 20],
                            data: [
                                {
                                    coord: [cumPnl.length - 1, lastCumPnl],
                                    value: lastCumPnlLabel,
                                    itemStyle: { color: '#089981' },
                                    label: { color: '#ffffff', fontSize: 10.5, fontWeight: 'bold', formatter: '{c}' },
                                },
                            ],
                        },
                    });
                }
            }
        }

        // 2. Trades excursions series
        if (hasExcursions) {
            const excGrid = activeCategories.find((c) => c.id === 'excursions')!.gridIndex;
            const maeBars = this.opts.getMaeBars();
            const mfeBars = this.opts.getMfeBars();
            const realizedBars = this.opts.getRealizedBars();

            const maeData = this.showWhitespaces
                ? maeBars.map((b, idx) => ({ value: [timestamps[idx] ?? idx, b.value[1]], itemStyle: b.itemStyle }))
                : maeBars;
            const mfeData = this.showWhitespaces
                ? mfeBars.map((b, idx) => ({ value: [timestamps[idx] ?? idx, b.value[1]], itemStyle: b.itemStyle }))
                : mfeBars;
            const realizedData = this.showWhitespaces
                ? realizedBars.map((b, idx) => ({ value: [timestamps[idx] ?? idx, b.value[1]], itemStyle: b.itemStyle }))
                : realizedBars;

            series.push(
                {
                    name: 'MAE Excursions',
                    type: 'bar',
                    xAxisIndex: excGrid,
                    yAxisIndex: excGrid,
                    data: maeData,
                    barWidth: 2.5,
                    barGap: '-100%',
                    silent: true,
                },
                {
                    name: 'MFE Excursions',
                    type: 'bar',
                    xAxisIndex: excGrid,
                    yAxisIndex: excGrid,
                    data: mfeData,
                    barWidth: 2.5,
                    barGap: '-100%',
                    silent: true,
                },
                {
                    name: 'Trades excursions',
                    type: 'bar',
                    xAxisIndex: excGrid,
                    yAxisIndex: excGrid,
                    data: realizedData,
                    barWidth: 2.5,
                    barGap: '-100%',
                    silent: false,
                    markLine: {
                        symbol: 'none',
                        silent: true,
                        lineStyle: { color: 'rgba(255, 255, 255, 0.18)', width: 1 },
                        data: [{ yAxis: 0 }],
                    },
                }
            );
        }

        // 3. Run-ups and drawdowns series
        if (hasDrawdowns) {
            const rdGrid = activeCategories.find((c) => c.id === 'drawdowns')!.gridIndex;
            const rdData = this.showWhitespaces
                ? runupsDrawdowns.map((r, i) => {
                      const entryTime = trades[r.entryIdx]?.entry.time ?? timestamps[r.entryIdx] ?? 0;
                      const exitTime = trades[r.exitIdx]?.exit?.time ?? timestamps[r.exitIdx] ?? 0;
                      return [entryTime, exitTime, r.pnl, i, r.val, r.pct];
                  })
                : runupsDrawdowns.map((r, i) => [r.entryIdx, r.exitIdx, r.pnl, i, r.val, r.pct]);

            series.push(
                {
                    name: 'Run-ups and drawdowns',
                    type: 'custom',
                    xAxisIndex: rdGrid,
                    yAxisIndex: rdGrid,
                    data: rdData,
                    renderItem: (
                        _params: echarts.CustomSeriesRenderItemParams,
                        api: echarts.CustomSeriesRenderItemAPI
                    ) => {
                        const startVal = Number(api.value(0));
                        const endVal = Number(api.value(1));
                        const pnl = Number(api.value(2));
                        const yVal = gridCount === 1 ? -0.038 : 0;
                        const start = api.coord([startVal, yVal]) as [number, number];
                        const end = api.coord([endVal, yVal]) as [number, number];
                        const x = Math.min(start[0], end[0]);
                        const w = Math.max(4, Math.abs(end[0] - start[0]));
                        return {
                            type: 'rect',
                            shape: {
                                x,
                                y: start[1] - 2,
                                width: w,
                                height: 4,
                                r: 1,
                            },
                            style: {
                                fill: pnl >= 0 ? '#089981' : '#f23645',
                            },
                        };
                    },
                },
                {
                    name: 'Runups Guidelines',
                    type: 'line',
                    xAxisIndex: rdGrid,
                    yAxisIndex: rdGrid,
                    data: [],
                    markLine: {
                        symbol: 'none',
                        silent: true,
                        lineStyle: {
                            color: 'rgba(255, 255, 255, 0.22)',
                            width: 1,
                            type: 'solid',
                        },
                        data: [],
                    },
                }
            );
        }

        // Query current zoom if not already captured
        if (this.chartInstance) {
            try {
                const curOpt = this.chartInstance.getOption() as {
                    dataZoom?: Array<{ start?: number; end?: number; startValue?: number; endValue?: number }>;
                };
                if (curOpt?.dataZoom?.[0]) {
                    const dz = curOpt.dataZoom[0];
                    if (dz.start !== undefined || dz.startValue !== undefined) {
                        this.savedZoomState = {
                            start: dz.start,
                            end: dz.end,
                            startValue: dz.startValue,
                            endValue: dz.endValue,
                        };
                    }
                }
            } catch {
                // Ignore chart state read failure
            }
        }

        const dataZoomConfig: echarts.DataZoomComponentOption = {
            type: 'inside',
            xAxisIndex: 'all',
            zoomOnMouseWheel: true,
            moveOnMouseMove: true,
        };
        if (this.savedZoomState) {
            if (this.savedZoomState.start !== undefined && this.savedZoomState.end !== undefined) {
                dataZoomConfig.start = this.savedZoomState.start;
                dataZoomConfig.end = this.savedZoomState.end;
            } else if (this.savedZoomState.startValue !== undefined && this.savedZoomState.endValue !== undefined) {
                dataZoomConfig.startValue = this.savedZoomState.startValue;
                dataZoomConfig.endValue = this.savedZoomState.endValue;
            }
        }

        const option: echarts.EChartsOption = {
            backgroundColor: '#000000',
            animation: false,
            dataZoom: [dataZoomConfig],
            tooltip: {
                trigger: 'axis',
                backgroundColor: 'transparent',
                borderWidth: 0,
                padding: 0,
                shadowBlur: 0,
                axisPointer: {
                    type: 'cross',
                    label: {
                        backgroundColor: '#2e2e2e',
                        color: '#ffffff',
                    },
                    lineStyle: {
                        color: '#4e5260',
                        type: 'dashed',
                    },
                },
                formatter: (params) => {
                    if (!Array.isArray(params) || params.length === 0) return '';
                    const idx = params[0]?.dataIndex ?? 0;
                    const date = this.showWhitespaces && timestamps[idx]
                        ? new Date(timestamps[idx]).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                        : (timeline[idx] ?? '');

                    // If ONLY Run-ups and drawdowns is active
                    if (gridCount === 1 && hasDrawdowns) {
                        const rd = runupsDrawdowns[idx] || runupsDrawdowns.find((r) => idx >= r.entryIdx && idx <= r.exitIdx);
                        if (rd) {
                            const isRunup = rd.pnl >= 0;
                            return `
                                <div class="vst-rd-card">
                                    <div class="vst-rd-row1">
                                        <span>${isRunup ? 'Run-up' : 'Drawdown'}</span>
                                        <span>${formatNumber(rd.val)} <span style="font-size:10px;color:#787b86;">NONE</span></span>
                                    </div>
                                    <div class="vst-rd-row2">${rd.pct.toFixed(2)}%</div>
                                    <div class="vst-rd-row3">${rd.entryDateStr} — ${rd.exitDateStr}</div>
                                </div>
                            `;
                        }
                    }

                    // If ONLY Trades excursions is active
                    if (gridCount === 1 && hasExcursions) {
                        const rd = runupsDrawdowns[idx];
                        const t = trades[idx];
                        const pnl = t?.pnl ?? (rd ? rd.pnl : 0);
                        const runupVal = t?.maxRunup ?? (rd ? rd.val : 0);
                        const drawdownVal = t?.maxDrawdown ?? 0;
                        const runupPct = rd?.pct ?? 0;
                        const drawdownPct = rd?.pct ?? 0;
                        const entryDateStr = rd?.entryDateStr ?? '';
                        const exitDateStr = rd?.exitDateStr ?? date;
                        const cumPnlVal = cumPnl[idx] ?? 0;

                        return `
                            <div style="background:#1e222d;border:1px solid #363c4e;border-radius:6px;padding:8px 12px;color:#d1d4dc;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Trebuchet MS',Roboto,sans-serif;min-width:180px;box-shadow:0 4px 16px rgba(0,0,0,0.45);">
                                <div style="font-weight:700;color:#ffffff;margin-bottom:6px;">Trade #${idx + 1}</div>
                                <div style="display:flex;justify-content:space-between;gap:12px;margin:3px 0;">
                                    <span style="color:#787b86;">Max run-up:</span>
                                    <span style="font-weight:600;color:#089981;">+${formatNumber(runupVal)} (${runupPct.toFixed(2)}%)</span>
                                </div>
                                <div style="display:flex;justify-content:space-between;gap:12px;margin:3px 0;">
                                    <span style="color:#787b86;">Max drawdown:</span>
                                    <span style="font-weight:600;color:#f23645;">-${formatNumber(drawdownVal)} (${drawdownPct.toFixed(2)}%)</span>
                                </div>
                                <div style="display:flex;justify-content:space-between;gap:12px;margin:3px 0;">
                                    <span style="color:#787b86;">Profit:</span>
                                    <span style="font-weight:600;color:${pnl >= 0 ? '#089981' : '#f23645'}">${formatSignedNumber(pnl)}</span>
                                </div>
                                <div style="display:flex;justify-content:space-between;gap:12px;margin:3px 0;">
                                    <span style="color:#787b86;">Accumulated profit:</span>
                                    <span style="font-weight:600;color:${cumPnlVal >= 0 ? '#089981' : '#f23645'}">${formatSignedNumber(cumPnlVal)}</span>
                                </div>
                                <div style="border-top:1px solid #2a2e39;margin-top:6px;padding-top:4px;color:#787b86;font-size:11px;">
                                    ${entryDateStr} — ${exitDateStr}
                                </div>
                            </div>
                        `;
                    }

                    // Combined / Multi-pane tooltip
                    let html = `
                        <div style="background:#1e222d;border:1px solid #363c4e;border-radius:6px;padding:8px 12px;color:#d1d4dc;font-size:12px;font-family:-apple-system,BlinkMacSystemFont,'Trebuchet MS',Roboto,sans-serif;min-width:180px;box-shadow:0 4px 16px rgba(0,0,0,0.45);">
                            <div style="font-weight:700;margin-bottom:4px;color:#ffffff;">${date}</div>
                    `;

                    for (const p of params) {
                        if (p.seriesName === 'MAE Excursions' || p.seriesName === 'MFE Excursions' || p.seriesName === 'Runups Guidelines') {
                            continue;
                        }
                        const val = typeof p.value === 'number' ? p.value : (Array.isArray(p.value) ? p.value[1] : 0);
                        const color = (p.color as string) || '#ffffff';
                        html += `
                            <div style="display:flex;justify-content:space-between;gap:12px;margin-top:3px;">
                                <span style="color:${color}">● ${p.seriesName}:</span>
                                <span style="font-weight:600;font-variant-numeric:tabular-nums">${formatNumber(Number(val ?? 0))}</span>
                            </div>
                        `;
                    }

                    if (hasExcursions || hasDrawdowns) {
                        const rd = runupsDrawdowns[idx];
                        if (rd) {
                            html += `
                                <div style="border-top:1px solid #2a2e39;margin-top:6px;padding-top:4px;color:#787b86;font-size:11px;">
                                    Trade #${idx + 1}: ${rd.entryDateStr} — ${rd.exitDateStr}
                                </div>
                            `;
                        }
                    }

                    html += `</div>`;
                    return html;
                },
            },
            axisPointer: {
                link: [{ xAxisIndex: 'all' }],
            },
            grid: grids,
            xAxis,
            yAxis,
            series,
        };

        this.chartInstance.setOption(option, true);
    }

    public updateSeriesTogglesUI(rootEl?: HTMLElement): void {
        const root = rootEl || this.opts.rootEl;
        if (!root) return;

        const eyeOpenSvg = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5-6.5-4.5z"/><circle cx="8" cy="8" r="2"/></svg>`;
        const eyeSlashSvg = `<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5-6.5-4.5z"/><circle cx="8" cy="8" r="2"/><line x1="2" y1="2" x2="14" y2="14"/></svg>`;

        let activeCount = 0;
        root.querySelectorAll('.vst-series-pill').forEach((pill) => {
            const key = (pill as HTMLElement).dataset.series as keyof typeof this.activeSeries;
            if (key && key in this.activeSeries) {
                const isActive = this.activeSeries[key];
                if (isActive) activeCount++;
                pill.classList.toggle('is-active', isActive);
                const eye = pill.querySelector('.vst-series-eye');
                if (eye) {
                    eye.innerHTML = isActive ? eyeOpenSvg : eyeSlashSvg;
                }
            }
        });

        const compactCount = root.querySelector('.vst-compact-count');
        if (compactCount) {
            compactCount.textContent = String(activeCount || 4);
        }
    }

    public resetZoom(): void {
        this.savedZoomState = null;
        if (this.chartInstance) {
            this.chartInstance.dispatchAction({
                type: 'dataZoom',
                start: 0,
                end: 100,
            });
        }
    }

    public exportImage(title?: string): void {
        if (!this.chartInstance) return;
        const url = this.chartInstance.getDataURL({ pixelRatio: 2, backgroundColor: '#000000' });
        const a = document.createElement('a');
        a.href = url;
        a.download = `backtest-${title || 'strategy'}-${Date.now()}.png`;
        a.click();
    }

    public resize(): void {
        if (this.chartInstance) {
            this.chartInstance.resize();
        }
    }

    public dispose(): void {
        if (this.chartInstance) {
            this.chartInstance.dispose();
            this.chartInstance = null;
        }
    }

    public clearZoomState(): void {
        this.savedZoomState = null;
    }
}
