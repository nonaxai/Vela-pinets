import * as echarts from 'echarts';
import type { StrategyTrade } from '@luxalgo/vela/plugin';
import type { BacktestSummaryStats } from '../../types';
import { formatNumber } from '../../core/formatters';

export interface DistributionOptions {
    containerEl: HTMLElement;
    stats: BacktestSummaryStats | null;
    trades: StrategyTrade[];
    baseInitialCapital: number;
}

export interface DistributionCharts {
    returnsDistChart: echarts.ECharts | null;
    tradesDistChart: echarts.ECharts | null;
}

export function renderDistributionTab(opts: DistributionOptions): DistributionCharts {
    const { containerEl, stats, trades, baseInitialCapital } = opts;
    const initCap = stats?.initialCapital ?? baseInitialCapital ?? 10000;
    const curr = stats?.currency || 'NONE';

    const totalTrades = trades.length;
    const totalPnl = stats?.totalPnl ?? trades.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
    const expectancy = totalTrades > 0 ? totalPnl / totalTrades : 0;
    const expectancyPct = initCap > 0 ? (expectancy / (initCap * 0.1)) * 100 : 0;

    // Outliers PnL
    const pnls = trades.map((t) => t.pnl ?? 0);
    const meanPnl = pnls.length > 0 ? pnls.reduce((a, b) => a + b, 0) / pnls.length : 0;
    const variance = pnls.length > 0 ? pnls.reduce((a, b) => a + Math.pow(b - meanPnl, 2), 0) / pnls.length : 0;
    const stdDev = Math.sqrt(variance);
    const outlierThreshold = meanPnl + 1.8 * stdDev;
    const outliers = trades.filter((t) => Math.abs((t.pnl ?? 0) - meanPnl) >= outlierThreshold || (t.pnl ?? 0) >= 800);
    const outliersPnl = outliers.reduce((acc, t) => acc + (t.pnl ?? 0), 0);
    const outliersPnlPct = initCap > 0 ? (outliersPnl / initCap) * 100 : 0;

    // Winning & losing trades
    const winningTrades = trades.filter((t) => (t.pnl ?? 0) > 0);
    const losingTrades = trades.filter((t) => (t.pnl ?? 0) < 0);
    const breakevenTrades = trades.filter((t) => (t.pnl ?? 0) === 0);

    let largestProfit = 0;
    let largestProfitPct = 0;
    for (const t of winningTrades) {
        const p = t.pnl ?? 0;
        if (p > largestProfit) {
            largestProfit = p;
            const entryVal = t.entry.price && t.qty ? t.entry.price * t.qty : initCap * 0.1;
            largestProfitPct = entryVal > 0 ? (p / entryVal) * 100 : 0;
        }
    }

    let largestLoss = 0;
    let largestLossPct = 0;
    for (const t of losingTrades) {
        const p = t.pnl ?? 0;
        if (p < largestLoss) {
            largestLoss = p;
            const entryVal = t.entry.price && t.qty ? t.entry.price * t.qty : initCap * 0.1;
            largestLossPct = entryVal > 0 ? (p / entryVal) * 100 : 0;
        }
    }

    const avgProfit = winningTrades.length > 0 ? winningTrades.reduce((a, b) => a + (b.pnl ?? 0), 0) / winningTrades.length : 0;
    const avgProfitPct = initCap > 0 ? (avgProfit / (initCap * 0.1)) * 100 : 0;
    const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((a, b) => a + (b.pnl ?? 0), 0) / losingTrades.length : 0;
    const avgLossPct = initCap > 0 ? (Math.abs(avgLoss) / (initCap * 0.1)) * 100 : 0;

    const winnersCount = winningTrades.length;
    const losersCount = losingTrades.length;
    const beCount = breakevenTrades.length;
    const winnersPct = totalTrades > 0 ? (winnersCount / totalTrades) * 100 : 0;
    const losersPct = totalTrades > 0 ? (losersCount / totalTrades) * 100 : 0;
    const bePct = totalTrades > 0 ? (beCount / totalTrades) * 100 : 0;

    const metricsHtml = `
        <div class="vst-analysis-metrics-row">
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Expectancy</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${formatNumber(expectancy)}</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                    <span class="vst-analysis-metric-sub">${expectancyPct.toFixed(2)}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Outliers PnL</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${formatNumber(outliersPnl)}</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                    <span class="vst-analysis-metric-sub">${outliersPnlPct.toFixed(2)}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Largest profit</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val is-positive">+${formatNumber(largestProfit)}</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                    <span class="vst-analysis-metric-sub is-positive">+${largestProfitPct.toFixed(2)}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Largest loss</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val is-negative">-${formatNumber(Math.abs(largestLoss))}</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                    <span class="vst-analysis-metric-sub is-negative">-${Math.abs(largestLossPct).toFixed(2)}%</span>
                </div>
            </div>
        </div>
    `;

    const chartsHtml = `
        <div class="vst-trades-dist-grid">
            <div class="vst-returns-dist-col">
                <div class="vst-analysis-subtitle" style="margin-bottom: 8px;">Returns distribution</div>
                <div id="vst-returns-dist-echarts" class="vst-analysis-chart" style="height: 230px;"></div>
                <div class="vst-returns-legend">
                    <div class="vst-returns-legend-left">
                        <span class="vst-legend-item"><span class="vst-legend-dot" style="background:#f23645;"></span> Losers</span>
                        <span class="vst-legend-item"><span class="vst-legend-dot" style="background:#089981;"></span> Winners</span>
                    </div>
                    <div class="vst-returns-legend-right">
                        <span class="vst-legend-item"><span class="vst-legend-dash" style="color:#f23645;">---</span> Average loss -${avgLossPct.toFixed(2)}%</span>
                        <span class="vst-legend-item"><span class="vst-legend-dash" style="color:#089981;">---</span> Average profit +${avgProfitPct.toFixed(2)}%</span>
                    </div>
                </div>
            </div>
            <div class="vst-donut-dist-col">
                <div class="vst-analysis-subtitle" style="margin-bottom: 8px;">Trades distribution</div>
                <div class="vst-donut-dist-body">
                    <div id="vst-trades-dist-echarts" style="width: 170px; height: 170px; flex-shrink: 0;"></div>
                    <div class="vst-donut-legend">
                        <div class="vst-donut-legend-row">
                            <span class="vst-donut-legend-dot" style="background:#089981;"></span>
                            <span class="vst-donut-legend-label">Winners</span>
                            <span class="vst-donut-legend-count">${winnersCount} trades</span>
                            <span class="vst-donut-legend-pct">${winnersPct.toFixed(2)}%</span>
                        </div>
                        <div class="vst-donut-legend-row">
                            <span class="vst-donut-legend-dot" style="background:#f23645;"></span>
                            <span class="vst-donut-legend-label">Losers</span>
                            <span class="vst-donut-legend-count">${losersCount} trades</span>
                            <span class="vst-donut-legend-pct">${losersPct.toFixed(2)}%</span>
                        </div>
                        <div class="vst-donut-legend-row">
                            <span class="vst-donut-legend-dot" style="background:#f7a600;"></span>
                            <span class="vst-donut-legend-label">Breakevens</span>
                            <span class="vst-donut-legend-count">${beCount} trades</span>
                            <span class="vst-donut-legend-pct">${bePct.toFixed(2)}%</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;

    containerEl.innerHTML = metricsHtml + chartsHtml;

    let returnsDistChart: echarts.ECharts | null = null;
    let tradesDistChart: echarts.ECharts | null = null;

    const returnsContainer = containerEl.querySelector('#vst-returns-dist-echarts') as HTMLDivElement;
    if (returnsContainer) {
        returnsDistChart = echarts.init(returnsContainer);
        const bins = [
            { label: '-40%', range: '-40.00% — -30.00%', min: -40, max: -30, count: 0, color: '#f23645' },
            { label: '-30%', range: '-30.00% — -20.00%', min: -30, max: -20, count: 0, color: '#f23645' },
            { label: '-20%', range: '-20.00% — -10.00%', min: -20, max: -10, count: 0, color: '#f23645' },
            { label: '-10%', range: '-10.00% — -7.74%', min: -10, max: -7.74, count: 0, color: '#f23645' },
            { label: '0%', range: '-7.74% — 0.00%', min: -7.74, max: 0, count: 0, color: '#f23645' },
            { label: '0%', range: '0.00% — 7.74%', min: 0, max: 7.74, count: 0, color: '#089981' },
            { label: '10%', range: '7.74% — 15.00%', min: 7.74, max: 15, count: 0, color: '#089981' },
            { label: '20%', range: '15.00% — 25.00%', min: 15, max: 25, count: 0, color: '#089981' },
            { label: '30%', range: '25.00% — 35.00%', min: 25, max: 35, count: 0, color: '#089981' },
            { label: '40%', range: '35.00% — 45.00%', min: 35, max: 45, count: 0, color: '#089981' },
            { label: '50%', range: '45.00% — 55.00%', min: 45, max: 55, count: 0, color: '#089981' },
            { label: '60%', range: '55.00% — 65.00%', min: 55, max: 65, count: 0, color: '#089981' },
            { label: '>60%', range: '> 65.00%', min: 65, max: Infinity, count: 0, color: '#089981' },
        ];

        for (const t of trades) {
            const p = t.pnl ?? 0;
            const entryVal = t.entry.price && t.qty ? t.entry.price * t.qty : initCap * 0.1;
            const retPct = entryVal > 0 ? (p / entryVal) * 100 : 0;
            if (retPct < -40) {
                bins[0]!.count++;
            } else {
                for (let bIdx = 0; bIdx < bins.length; bIdx++) {
                    const b = bins[bIdx]!;
                    if (retPct >= b.min && retPct < b.max) {
                        b.count++;
                        break;
                    }
                }
            }
        }

        const barData = bins.map((b, i) => ({
            value: [i, b.count],
            itemStyle: { color: b.color },
            meta: b,
        }));

        const maxBinCount = Math.max(...bins.map((b) => b.count), 5);
        const yHistMax = Math.ceil(maxBinCount * 1.15);

        returnsDistChart.setOption({
            backgroundColor: 'transparent',
            animation: false,
            grid: {
                left: 10,
                right: 40,
                top: 15,
                bottom: 25,
                containLabel: true,
            },
            tooltip: {
                trigger: 'item',
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
                    const p = params as { data?: { meta?: typeof bins[0] } };
                    const item = p?.data?.meta;
                    if (!item) return '';
                    return `
                        <div style="font-size:12px;color:#d1d4dc;display:flex;flex-direction:column;gap:4px;">
                            <div style="display:flex;justify-content:space-between;gap:16px;">
                                <span style="color:#787b86;">Range</span>
                                <span style="font-weight:600;color:#d1d4dc;">${item.range}</span>
                            </div>
                            <div style="display:flex;justify-content:space-between;gap:16px;">
                                <span style="color:#787b86;">Trades</span>
                                <span style="font-weight:600;color:#d1d4dc;">${item.count}</span>
                            </div>
                        </div>
                    `;
                },
            },
            xAxis: {
                type: 'category',
                data: ['-40%', '-30%', '-20%', '-10%', '', '0%', '10%', '20%', '30%', '40%', '50%', '60%', ''],
                axisLine: { lineStyle: { color: '#2e2e2e' } },
                axisTick: { show: false },
                axisLabel: {
                    color: '#787b86',
                    fontSize: 10,
                    interval: 0,
                },
            },
            yAxis: {
                type: 'value',
                position: 'right',
                min: 0,
                max: yHistMax,
                splitLine: { lineStyle: { color: '#1e1e1e' } },
                axisLabel: { color: '#787b86', fontSize: 11 },
            },
            series: [
                {
                    type: 'bar',
                    data: barData,
                    barMaxWidth: 20,
                    markLine: {
                        symbol: 'none',
                        lineStyle: { type: 'dashed', width: 1.5 },
                        data: [
                            {
                                xAxis: 4,
                                lineStyle: { color: '#f23645' },
                                label: { show: false },
                                tooltip: { show: false },
                            },
                            {
                                xAxis: 7,
                                lineStyle: { color: '#089981' },
                                label: { show: false },
                                tooltip: { show: false },
                            },
                        ],
                    },
                },
            ],
        });
    }

    const donutContainer = containerEl.querySelector('#vst-trades-dist-echarts') as HTMLDivElement;
    if (donutContainer) {
        tradesDistChart = echarts.init(donutContainer);
        tradesDistChart.setOption({
            backgroundColor: 'transparent',
            animation: false,
            tooltip: {
                trigger: 'item',
                backgroundColor: '#1e222d',
                borderColor: '#363c4e',
                borderWidth: 1,
                padding: [8, 12],
                textStyle: {
                    color: '#d1d4dc',
                    fontSize: 12,
                    fontFamily: "-apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif",
                },
                formatter: '{b}: {c} trades ({d}%)',
            },
            series: [
                {
                    type: 'pie',
                    radius: ['62%', '86%'],
                    center: ['50%', '50%'],
                    avoidLabelOverlap: false,
                    label: {
                        show: true,
                        position: 'center',
                        formatter: `{total|${totalTrades}}\n{sub|Total trades}`,
                        rich: {
                            total: {
                                fontSize: 22,
                                fontWeight: 700,
                                color: '#ffffff',
                                lineHeight: 28,
                            },
                            sub: {
                                fontSize: 11,
                                color: '#787b86',
                                lineHeight: 16,
                            },
                        },
                    },
                    data: [
                        { value: winnersCount, name: 'Winners', itemStyle: { color: '#089981' } },
                        { value: losersCount, name: 'Losers', itemStyle: { color: '#f23645' } },
                        { value: beCount, name: 'Breakevens', itemStyle: { color: '#f7a600' } },
                    ],
                },
            ],
        });
    }

    return { returnsDistChart, tradesDistChart };
}
