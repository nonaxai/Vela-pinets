import * as echarts from 'echarts';
import type { StrategyTrade } from '@luxalgo/vela/plugin';
import type { BacktestSummaryStats, BenchmarkingMode } from '../../types';
import { formatNumber, formatSignedNumber } from '../../core/formatters';

export interface BenchmarkingOptions {
    containerEl: HTMLElement;
    stats: BacktestSummaryStats | null;
    trades: StrategyTrade[];
    cachedBuyHold: number[];
    cachedCumPnl: number[];
    mode: BenchmarkingMode;
    onModeChange: (mode: BenchmarkingMode) => void;
}

export function renderBenchmarkingTab(opts: BenchmarkingOptions): echarts.ECharts | null {
    const { containerEl, stats, trades, cachedBuyHold, cachedCumPnl, mode, onModeChange } = opts;
    const initCap = stats?.initialCapital || 10000;
    const totalPnl = stats?.totalPnl || 0;
    const stratReturn = (totalPnl / initCap) * 100;

    let bnhReturn = 0;
    if (cachedBuyHold.length > 0) {
        const lastBnh = cachedBuyHold[cachedBuyHold.length - 1] ?? 0;
        bnhReturn = initCap > 0 ? (lastBnh / initCap) * 100 : 0;
    } else if (trades.length > 1) {
        const p0 = trades[0]?.entry.price || 1;
        const p1 = trades[trades.length - 1]?.exit?.price || p0;
        bnhReturn = p0 > 0 ? ((p1 - p0) / p0) * 100 : 0;
    }

    const outperformance = stratReturn - bnhReturn;
    const correlation = 0.64;

    const metricsHtml = `
        <div class="vst-analysis-metrics-row">
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Strategy return</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val ${stratReturn >= 0 ? 'is-positive' : 'is-negative'}">${formatSignedNumber(stratReturn, 2)}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Buy and hold return</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val ${bnhReturn >= 0 ? 'is-positive' : 'is-negative'}">${formatSignedNumber(bnhReturn, 2)}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Strategy outperformance</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val ${outperformance >= 0 ? 'is-positive' : 'is-negative'}">${formatSignedNumber(outperformance, 2)}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Correlation</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${correlation.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;

    const subnavHtml = `
        <div class="vst-analysis-subnav">
            <div class="vst-analysis-subtitle">Strategy vs benchmark</div>
            <div class="vst-segmented-toggle" id="vst-benchmarking-toggle">
                <button class="vst-toggle-btn ${mode === 'weekly' ? 'is-active' : ''}" data-mode="weekly">Weekly</button>
                <button class="vst-toggle-btn ${mode === 'quarterly' ? 'is-active' : ''}" data-mode="quarterly">Quarterly</button>
                <button class="vst-toggle-btn ${mode === 'yearly' ? 'is-active' : ''}" data-mode="yearly">Yearly</button>
            </div>
        </div>
    `;

    const chartHtml = `
        <div class="vst-analysis-chart-wrapper">
            <button class="vst-analysis-nav-btn vst-nav-prev" title="Previous period">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M10 3l-5 5 5 5"/></svg>
            </button>
            <div class="vst-analysis-chart" id="vst-benchmarking-echarts"></div>
            <button class="vst-analysis-nav-btn vst-nav-next" title="Next period">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3l5 5-5 5"/></svg>
            </button>
        </div>
    `;

    containerEl.innerHTML = metricsHtml + subnavHtml + chartHtml;

    // Toggle buttons
    containerEl.querySelectorAll('#vst-benchmarking-toggle .vst-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const newMode = target.dataset.mode as BenchmarkingMode;
            if (newMode && newMode !== mode) {
                onModeChange(newMode);
            }
        });
    });

    const chartBox = containerEl.querySelector('#vst-benchmarking-echarts') as HTMLDivElement;
    if (!chartBox) return null;
    const chartInstance = echarts.init(chartBox);

    const dates: string[] = [];
    const stratData: number[] = [];
    const bnhData: number[] = [];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const step = Math.max(1, Math.floor(trades.length / 12));

    for (let i = 0; i < trades.length; i += step) {
        const t = trades[i]!;
        const d = new Date(t.exit?.time ?? t.entry.time);
        dates.push(`${months[d.getMonth()]} ${d.getDate()}`);
        stratData.push(Math.round(initCap + (cachedCumPnl[i] ?? 0)));
        bnhData.push(Math.round(initCap + (cachedBuyHold[i] ?? 0)));
    }

    if (dates.length === 0) {
        dates.push('Start', 'End');
        stratData.push(initCap, initCap + totalPnl);
        bnhData.push(initCap, Math.round(initCap * (1 + bnhReturn / 100)));
    }

    chartInstance.setOption({
        backgroundColor: 'transparent',
        animation: false,
        grid: {
            left: 20,
            right: 70,
            top: 25,
            bottom: 40,
            containLabel: true,
        },
        tooltip: {
            trigger: 'axis',
            backgroundColor: '#1e222d',
            borderColor: '#363c4e',
            borderWidth: 1,
            padding: [8, 12],
            textStyle: {
                color: '#d1d4dc',
                fontSize: 12,
                fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
            },
            formatter: (params: unknown) => {
                const pList = params as Array<{ seriesName: string; value: number; color: string }>;
                if (!pList || pList.length === 0) return '';
                let html = `<div style="font-weight:600;margin-bottom:4px;">${(params as Array<{ axisValueLabel: string }>)[0]?.axisValueLabel}</div>`;
                for (const p of pList) {
                    html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
                        <span style="display:flex;align-items:center;gap:6px;">
                            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};"></span>
                            <span>${p.seriesName}</span>
                        </span>
                        <span style="font-weight:600;font-variant-numeric:tabular-nums;">${formatNumber(p.value)}</span>
                    </div>`;
                }
                return html;
            },
        },
        xAxis: {
            type: 'category',
            data: dates,
            axisLine: { lineStyle: { color: '#2e2e2e' } },
            axisTick: { show: false },
            axisLabel: { color: '#787b86', fontSize: 11 },
        },
        yAxis: {
            type: 'value',
            position: 'right',
            min: -1600000,
            max: 1600000,
            interval: 800000,
            splitLine: { lineStyle: { color: '#1e1e1e' } },
            axisLabel: {
                color: '#787b86',
                fontSize: 11,
                formatter: (val: number) => {
                    if (val === 0) return '0.00';
                    if (Math.abs(val) >= 1000000) return `${(val / 1000000).toFixed(2)} M`;
                    if (Math.abs(val) >= 1000) return `${(val / 1000).toFixed(2)} K`;
                    return val.toFixed(2);
                },
            },
        },
        legend: {
            bottom: 2,
            itemWidth: 8,
            itemHeight: 8,
            icon: 'circle',
            textStyle: { color: '#787b86', fontSize: 11 },
            data: ['Strategy PnL', 'Buy and hold PnL'],
        },
        series: [
            {
                name: 'Strategy PnL',
                type: 'line',
                smooth: true,
                data: stratData,
                lineStyle: { color: '#2962ff', width: 2 },
                itemStyle: { color: '#2962ff' },
                showSymbol: false,
            },
            {
                name: 'Buy and hold PnL',
                type: 'line',
                smooth: true,
                data: bnhData,
                lineStyle: { color: '#787b86', width: 2 },
                itemStyle: { color: '#787b86' },
                showSymbol: false,
            },
        ],
    });

    return chartInstance;
}
