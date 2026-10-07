import * as echarts from 'echarts';
import type { StrategyTrade } from '@luxalgo/vela/plugin';
import type { BacktestSummaryStats, StreaksMode } from '../../types';
import { formatNumber } from '../../core/formatters';

export interface StreaksOptions {
    containerEl: HTMLElement;
    stats: BacktestSummaryStats | null;
    trades: StrategyTrade[];
    baseInitialCapital: number;
    mode: StreaksMode;
    onModeChange: (mode: StreaksMode) => void;
}

interface StreakTradeMeta {
    num: number;
    pnl: number;
    pct: number;
    date: string;
    isWin: boolean;
    streakVal: number;
}

export function renderStreaksTab(opts: StreaksOptions): echarts.ECharts | null {
    const { containerEl, stats, trades, baseInitialCapital, mode, onModeChange } = opts;
    const initCap = stats?.initialCapital ?? baseInitialCapital ?? 10000;
    const curr = stats?.currency || 'NONE';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const winStreakLengths: number[] = [];
    const lossStreakLengths: number[] = [];
    let curWin = 0;
    let curLoss = 0;

    const isCount = mode === 'count';
    const tradeData: Array<{
        value: [number, number];
        itemStyle: { color: string };
        meta: StreakTradeMeta;
    }> = [];

    for (let idx = 0; idx < trades.length; idx++) {
        const t = trades[idx]!;
        const pnl = t.pnl ?? 0;
        const isWin = pnl >= 0;

        if (isWin) {
            if (curLoss > 0) {
                lossStreakLengths.push(curLoss);
                curLoss = 0;
            }
            curWin++;
        } else {
            if (curWin > 0) {
                winStreakLengths.push(curWin);
                curWin = 0;
            }
            curLoss++;
        }

        const streakVal = isWin ? curWin : -curLoss;
        const chartVal = isCount ? streakVal : pnl;
        const color = isWin ? '#089981' : '#f23645';

        const d = new Date(t.exit?.time ?? t.entry.time);
        const dateStr = `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
        const entryVal = t.entry.price && t.qty ? t.entry.price * t.qty : initCap * 0.1;
        const pct = entryVal > 0 ? (pnl / entryVal) * 100 : 0;

        tradeData.push({
            value: [idx, chartVal],
            itemStyle: { color },
            meta: {
                num: idx + 1,
                pnl,
                pct,
                date: dateStr,
                isWin,
                streakVal,
            },
        });
    }

    if (curWin > 0) winStreakLengths.push(curWin);
    if (curLoss > 0) lossStreakLengths.push(curLoss);

    const longestWinStreak = winStreakLengths.length > 0 ? Math.max(...winStreakLengths) : 0;
    const longestLossStreak = lossStreakLengths.length > 0 ? Math.max(...lossStreakLengths) : 0;
    const avgWinStreak = winStreakLengths.length > 0 ? winStreakLengths.reduce((a, b) => a + b, 0) / winStreakLengths.length : 0;
    const avgLossStreak = lossStreakLengths.length > 0 ? lossStreakLengths.reduce((a, b) => a + b, 0) / lossStreakLengths.length : 0;

    const metricsHtml = `
        <div class="vst-analysis-metrics-row">
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Longest winning streak</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${longestWinStreak} trades</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Longest losing streak</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${longestLossStreak} trades</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Average winning streak</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${avgWinStreak.toFixed(2)} trades</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Average losing streak</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${avgLossStreak.toFixed(2)} trades</span>
                </div>
            </div>
        </div>
    `;

    const chartHtml = `
        <div class="vst-analysis-subnav">
            <div class="vst-analysis-subtitle">Winning and losing streaks</div>
            <div class="vst-segmented-toggle vst-streaks-toggle">
                <button class="vst-toggle-btn ${mode === 'count' ? 'is-active' : ''}" data-mode="count">Count</button>
                <button class="vst-toggle-btn ${mode === 'amount' ? 'is-active' : ''}" data-mode="amount">Amount</button>
            </div>
        </div>
        <div id="vst-streaks-echarts" class="vst-analysis-chart" style="height: 250px;"></div>
    `;

    containerEl.innerHTML = metricsHtml + chartHtml;

    containerEl.querySelectorAll('.vst-streaks-toggle .vst-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const newMode = (e.currentTarget as HTMLElement).dataset.mode as StreaksMode;
            if (newMode && newMode !== mode) {
                onModeChange(newMode);
            }
        });
    });

    const chartBox = containerEl.querySelector('#vst-streaks-echarts') as HTMLDivElement;
    if (!chartBox) return null;
    const chartInstance = echarts.init(chartBox);

    let yMin = -6;
    let yMax = 6;
    let yInterval = 3;
    if (isCount) {
        yMin = -(Math.max(longestLossStreak, 3));
        yMax = Math.max(longestWinStreak, 3);
        yInterval = Math.max(1, Math.ceil((yMax - yMin) / 4));
    } else {
        const minPnl = trades.length > 0 ? Math.min(...trades.map((t) => t.pnl ?? 0)) : -100;
        const maxPnl = trades.length > 0 ? Math.max(...trades.map((t) => t.pnl ?? 0)) : 100;
        yMin = Math.floor(Math.min(minPnl * 1.15, -100));
        yMax = Math.ceil(Math.max(maxPnl * 1.15, 100));
        yInterval = Math.max(1, Math.ceil((yMax - yMin) / 4));
    }

    chartInstance.setOption({
        backgroundColor: 'transparent',
        animation: false,
        grid: {
            left: 10,
            right: 50,
            top: 20,
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
                const pList = params as Array<{ data?: { meta?: StreakTradeMeta } }>;
                const item = pList[0]?.data?.meta;
                if (!item) return '';
                const label = item.isWin ? 'Net profit' : 'Net loss';
                const sign = item.isWin ? '+' : '';
                const color = item.isWin ? '#089981' : '#f23645';
                return `
                    <div style="font-size:12px;color:#d1d4dc;">
                        <div style="font-weight:600;margin-bottom:6px;color:#787b86;">Trade #${item.num} ${item.isWin ? 'Win' : 'Loss'}</div>
                        <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:3px;">
                            <span style="color:#787b86;">${label}</span>
                            <span style="font-weight:700;color:${color};">${sign}${formatNumber(item.pnl)} ${curr}</span>
                        </div>
                        <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:6px;">
                            <span style="color:#787b86;">PnL return</span>
                            <span style="font-weight:700;color:${color};">${sign}${item.pct.toFixed(2)}%</span>
                        </div>
                        <div style="font-size:11px;color:#787b86;text-align:center;">${item.date}</div>
                    </div>
                `;
            },
        },
        xAxis: {
            type: 'category',
            show: false,
            data: trades.map((_, i) => String(i)),
        },
        yAxis: {
            type: 'value',
            position: 'right',
            min: yMin,
            max: yMax,
            interval: yInterval,
            splitLine: { lineStyle: { color: '#1e1e1e' } },
            axisLabel: {
                color: '#787b86',
                fontSize: 11,
                formatter: (val: number) => {
                    if (isCount) {
                        return String(Math.abs(val));
                    }
                    if (val === 0) return '0.00';
                    if (Math.abs(val) >= 1000) {
                        return (val / 1000).toFixed(2) + ' K';
                    }
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
            data: ['Winners', 'Losers'],
        },
        series: [
            {
                name: 'Winners',
                type: 'bar',
                data: tradeData,
                barMaxWidth: 10,
                itemStyle: { color: '#089981' },
            },
            { name: 'Losers', type: 'bar', data: [], itemStyle: { color: '#f23645' } },
        ],
    });

    return chartInstance;
}
