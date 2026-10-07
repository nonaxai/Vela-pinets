import * as echarts from 'echarts';
import type { StrategyTrade } from '@luxalgo/vela/plugin';
import type { BacktestSummaryStats, PeriodicalMode } from '../../types';
import { formatSignedNumber } from '../../core/formatters';

export interface PeriodicalOptions {
    containerEl: HTMLElement;
    stats: BacktestSummaryStats | null;
    trades: StrategyTrade[];
    mode: PeriodicalMode;
    onModeChange: (mode: PeriodicalMode) => void;
}

export function renderPeriodicalTab(opts: PeriodicalOptions): echarts.ECharts | null {
    const { containerEl, stats, trades, mode, onModeChange } = opts;
    const titlePrefix = mode === 'weekly' ? 'Weekly' : mode === 'quarterly' ? 'Quarterly' : 'Yearly';
    const initCap = stats?.initialCapital || 10000;
    const totalPnl = stats?.totalPnl || 0;
    const totalReturnPct = ((totalPnl / initCap) * 100).toFixed(2);

    // CAGR
    const firstTime = trades.length > 0 ? Math.min(...trades.map((t) => t.entry.time)) : Date.now();
    const lastTime = trades.length > 0 ? Math.max(...trades.map((t) => t.exit?.time ?? t.entry.time)) : Date.now();
    const years = Math.max(0.08, (lastTime - firstTime) / (365.25 * 86_400_000));
    const endCap = initCap + totalPnl;
    const cagrVal = endCap > 0 ? (((endCap / initCap) ** (1 / years)) - 1) * 100 : 0;
    const cagrStr = formatSignedNumber(cagrVal, 2);

    // Sharpe & Sortino ratios
    const rets = trades.map((t) => (t.pnl ?? 0) / initCap);
    const count = Math.max(1, rets.length);
    const mean = rets.reduce((a, b) => a + b, 0) / count;
    const variance = rets.reduce((a, b) => a + (b - mean) ** 2, 0) / count;
    const stdDev = Math.sqrt(variance);
    const tradesPerYear = Math.max(1, count / years);
    const sharpe = stdDev > 0 ? (mean / stdDev) * Math.sqrt(tradesPerYear) : 0;

    const downsideRets = rets.filter((r) => r < 0);
    const downsideVar = downsideRets.length > 0 ? downsideRets.reduce((a, b) => a + b ** 2, 0) / count : 0.0001;
    const downsideStd = Math.sqrt(downsideVar);
    const sortino = downsideStd > 0 ? (mean / downsideStd) * Math.sqrt(tradesPerYear) : 0;

    const metricsHtml = `
        <div class="vst-analysis-metrics-row">
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Annualized return (CAGR)</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val ${cagrVal >= 0 ? 'is-positive' : 'is-negative'}">${cagrStr}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Total return</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val ${totalPnl >= 0 ? 'is-positive' : 'is-negative'}">${formatSignedNumber(Number(totalReturnPct), 2)}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Sharpe ratio</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${sharpe.toFixed(2)}</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Sortino ratio</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${sortino.toFixed(2)}</span>
                </div>
            </div>
        </div>
    `;

    const subnavHtml = `
        <div class="vst-analysis-subnav">
            <div class="vst-analysis-subtitle">${titlePrefix} PnL</div>
            <div class="vst-segmented-toggle" id="vst-periodical-toggle">
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
            <div class="vst-analysis-chart" id="vst-periodical-echarts"></div>
            <button class="vst-analysis-nav-btn vst-nav-next" title="Next period">
                <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 3l5 5-5 5"/></svg>
            </button>
        </div>
    `;

    containerEl.innerHTML = metricsHtml + subnavHtml + chartHtml;

    // Toggle buttons
    containerEl.querySelectorAll('#vst-periodical-toggle .vst-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const newMode = target.dataset.mode as PeriodicalMode;
            if (newMode && newMode !== mode) {
                onModeChange(newMode);
            }
        });
    });

    const chartBox = containerEl.querySelector('#vst-periodical-echarts') as HTMLDivElement;
    if (!chartBox) return null;
    const chartInstance = echarts.init(chartBox);

    const buckets = new Map<string, { p: number; l: number; fe: number; ae: number }>();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (const t of trades) {
        const d = new Date(t.exit?.time ?? t.entry.time);
        let key = '';
        if (mode === 'weekly') {
            key = `${months[d.getMonth()]} ${d.getDate()}`;
        } else if (mode === 'quarterly') {
            key = `Q${Math.floor(d.getMonth() / 3) + 1} ${d.getFullYear()}`;
        } else {
            key = `${d.getFullYear()}`;
        }

        const cur = buckets.get(key) || { p: 0, l: 0, fe: 0, ae: 0 };
        const pnl = t.pnl ?? 0;
        if (pnl > 0) cur.p += pnl;
        else if (pnl < 0) cur.l += pnl;

        const runup = t.maxRunup ?? (pnl > 0 ? pnl * 1.2 : 0);
        const dd = t.maxDrawdown ?? (pnl < 0 ? Math.abs(pnl) : 0);
        cur.fe = Math.max(cur.fe, runup);
        cur.ae = Math.min(cur.ae, -dd);
        buckets.set(key, cur);
    }

    let categories: string[] = [];
    let realizedProfit: (number | null)[] = [];
    let realizedLoss: (number | null)[] = [];
    let favorableExcursion: (number | null)[] = [];
    let adverseExcursion: (number | null)[] = [];

    for (const [k, v] of buckets.entries()) {
        categories.push(k);
        realizedProfit.push(Number(v.p.toFixed(2)));
        realizedLoss.push(Number(v.l.toFixed(2)));
        favorableExcursion.push(Number(v.fe.toFixed(2)));
        adverseExcursion.push(Number(v.ae.toFixed(2)));
    }

    if (categories.length === 0) {
        categories = ['All'];
        realizedProfit = [Number(stats?.grossProfit?.toFixed(2) || '0')];
        realizedLoss = [-Number(stats?.grossLoss?.toFixed(2) || '0')];
        favorableExcursion = [0];
        adverseExcursion = [0];
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
            axisPointer: { type: 'shadow' },
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
                    if (p.value !== null && p.value !== 0) {
                        html += `<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;margin:2px 0;">
                            <span style="display:flex;align-items:center;gap:6px;">
                                <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color};"></span>
                                <span>${p.seriesName}</span>
                            </span>
                            <span style="font-weight:600;font-variant-numeric:tabular-nums;">${formatSignedNumber(p.value)}</span>
                        </div>`;
                    }
                }
                return html;
            },
        },
        xAxis: {
            type: 'category',
            data: categories,
            axisLine: { lineStyle: { color: '#2e2e2e' } },
            axisTick: { show: false },
            axisLabel: { color: '#787b86', fontSize: 11 },
        },
        yAxis: {
            type: 'value',
            position: 'right',
            splitLine: { lineStyle: { color: '#1e1e1e' } },
            axisLabel: {
                color: '#787b86',
                fontSize: 11,
                formatter: (val: number) => {
                    if (val === 0) return '0.00';
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
            data: ['Realized profit', 'Realized loss', 'Favorable excursion', 'Adverse excursion'],
        },
        series: [
            {
                name: 'Realized profit',
                type: 'bar',
                data: realizedProfit,
                itemStyle: { color: '#089981' },
                barMaxWidth: 16,
            },
            {
                name: 'Realized loss',
                type: 'bar',
                data: realizedLoss,
                itemStyle: { color: '#f23645' },
                barMaxWidth: 16,
            },
            {
                name: 'Favorable excursion',
                type: 'bar',
                data: favorableExcursion,
                itemStyle: { color: '#00897b' },
                barMaxWidth: 16,
            },
            {
                name: 'Adverse excursion',
                type: 'bar',
                data: adverseExcursion,
                itemStyle: { color: '#782028' },
                barMaxWidth: 16,
            },
        ],
    });

    return chartInstance;
}
