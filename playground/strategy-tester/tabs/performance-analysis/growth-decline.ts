import * as echarts from 'echarts';
import type { StrategyTrade } from '@luxalgo/vela/plugin';
import type { BacktestSummaryStats } from '../../types';
import { formatNumber } from '../../core/formatters';

export interface GrowthDeclineOptions {
    containerEl: HTMLElement;
    stats: BacktestSummaryStats | null;
    trades: StrategyTrade[];
    baseInitialCapital: number;
}

interface GdPeriod {
    type: 'Run-up' | 'Drawdown' | 'Current drawdown';
    val: number;
    pnl: number;
    date: string;
    durationDays: number;
}

export function renderGrowthDeclineTab(opts: GrowthDeclineOptions): echarts.ECharts | null {
    const { containerEl, stats, trades, baseInitialCapital } = opts;
    const initCap = stats?.initialCapital ?? baseInitialCapital ?? 10000;
    const maxDd = stats?.maxDrawdown ?? 0;
    const maxDdPct = stats?.maxDrawdownPct ?? 0;
    const curr = stats?.currency || 'NONE';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const periods: GdPeriod[] = [];
    let curType: 'Run-up' | 'Drawdown' | null = null;
    let curPnl = 0;
    let curStartTrade: StrategyTrade | null = null;
    let curEndTrade: StrategyTrade | null = null;

    for (let i = 0; i < trades.length; i++) {
        const t = trades[i]!;
        const p = t.pnl ?? 0;
        const isWin = p >= 0;
        const type: 'Run-up' | 'Drawdown' = isWin ? 'Run-up' : 'Drawdown';

        if (curType === null) {
            curType = type;
            curPnl = p;
            curStartTrade = t;
            curEndTrade = t;
        } else if (curType === type) {
            curPnl += p;
            curEndTrade = t;
        } else {
            const sDate = new Date(curStartTrade!.entry.time);
            const eDate = new Date(curEndTrade!.exit?.time ?? curEndTrade!.entry.time);
            const sStr = `${months[sDate.getMonth()]} ${sDate.getDate()}, ${sDate.getFullYear()}`;
            const eStr = `${months[eDate.getMonth()]} ${eDate.getDate()}, ${eDate.getFullYear()}`;
            const durDays = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (86400 * 1000)));
            const pct = initCap > 0 ? (Math.abs(curPnl) / initCap) * 100 : 0;
            periods.push({
                type: curType,
                val: Number(pct.toFixed(2)),
                pnl: Number(curPnl.toFixed(2)),
                date: `${sStr} — ${eStr}`,
                durationDays: durDays,
            });

            curType = type;
            curPnl = p;
            curStartTrade = t;
            curEndTrade = t;
        }
    }

    if (curType !== null && curStartTrade && curEndTrade) {
        const sDate = new Date(curStartTrade.entry.time);
        const eDate = new Date(curEndTrade.exit?.time ?? curEndTrade.entry.time);
        const sStr = `${months[sDate.getMonth()]} ${sDate.getDate()}, ${sDate.getFullYear()}`;
        const eStr = `${months[eDate.getMonth()]} ${eDate.getDate()}, ${eDate.getFullYear()}`;
        const durDays = Math.max(1, Math.round((eDate.getTime() - sDate.getTime()) / (86400 * 1000)));
        const pct = initCap > 0 ? (Math.abs(curPnl) / initCap) * 100 : 0;
        const finalType = curType === 'Drawdown' ? 'Current drawdown' : 'Run-up';
        periods.push({
            type: finalType,
            val: Number(pct.toFixed(2)),
            pnl: Number(curPnl.toFixed(2)),
            date: `${sStr} — ${eStr}`,
            durationDays: durDays,
        });
    }

    const runupPeriods = periods.filter((p) => p.type === 'Run-up');
    const ddPeriods = periods.filter((p) => p.type === 'Drawdown' || p.type === 'Current drawdown');

    const maxRunupPct = runupPeriods.length > 0 ? Math.max(...runupPeriods.map((p) => p.val)) : 0;
    const avgRunupPct = runupPeriods.length > 0 ? runupPeriods.reduce((a, b) => a + b.val, 0) / runupPeriods.length : 0;
    const avgRunupDurationDays = runupPeriods.length > 0 ? Math.round(runupPeriods.reduce((a, b) => a + b.durationDays, 0) / runupPeriods.length) : 0;

    const maxPeriodDdPct = ddPeriods.length > 0 ? Math.max(...ddPeriods.map((p) => p.val)) : 0;
    const avgDdPct = ddPeriods.length > 0 ? ddPeriods.reduce((a, b) => a + b.val, 0) / ddPeriods.length : 0;
    const avgDdDurationDays = ddPeriods.length > 0 ? Math.round(ddPeriods.reduce((a, b) => a + b.durationDays, 0) / ddPeriods.length) : 0;

    const curDdPeriod = periods.find((p) => p.type === 'Current drawdown');
    const curDdPct = curDdPeriod?.val ?? 0;

    const maxDdOfInitCapPct = initCap > 0 ? (maxDd / initCap) * 100 : 0;

    const runupAvgBarWidth = maxRunupPct > 0 ? Math.min(100, (avgRunupPct / maxRunupPct) * 100) : 0;
    const ddAvgBarWidth = maxPeriodDdPct > 0 ? Math.min(100, (avgDdPct / maxPeriodDdPct) * 100) : 0;
    const curDdBarWidth = maxPeriodDdPct > 0 ? Math.min(100, (curDdPct / maxPeriodDdPct) * 100) : 0;

    const metricsHtml = `
        <div class="vst-analysis-metrics-row">
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Average run-up duration</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${avgRunupDurationDays.toLocaleString()} days</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Average drawdown duration</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${avgDdDurationDays.toLocaleString()} days</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Max drawdown</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${formatNumber(maxDd)}</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                    <span class="vst-analysis-metric-sub">${maxDdPct.toFixed(2)}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Max drawdown as % of initial capital</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${maxDdOfInitCapPct.toFixed(2)}%</span>
                </div>
            </div>
        </div>
    `;

    const gridHtml = `
        <div class="vst-growth-decline-grid">
            <div class="vst-gd-chart-card">
                <div class="vst-analysis-subtitle">Alternating growth and decline</div>
                <div class="vst-gd-echarts-container" id="vst-gd-echarts"></div>
            </div>
            <div class="vst-gd-comparison-card">
                <div class="vst-analysis-subtitle">Comparison of growth and decline periods</div>
                <div class="vst-gd-comp-section">
                    <div class="vst-gd-comp-heading">Run-up</div>
                    <div class="vst-gd-comp-row">
                        <div class="vst-gd-comp-label">Maximum</div>
                        <div class="vst-gd-comp-bar-track">
                            <div class="vst-gd-comp-bar is-runup" style="width: 100%;"></div>
                        </div>
                        <div class="vst-gd-comp-val">${maxRunupPct.toFixed(2)}%</div>
                    </div>
                    <div class="vst-gd-comp-row">
                        <div class="vst-gd-comp-label">Average</div>
                        <div class="vst-gd-comp-bar-track">
                            <div class="vst-gd-comp-bar is-runup" style="width: ${runupAvgBarWidth.toFixed(1)}%;"></div>
                        </div>
                        <div class="vst-gd-comp-val">${avgRunupPct.toFixed(2)}%</div>
                    </div>
                </div>
                <div class="vst-gd-comp-section">
                    <div class="vst-gd-comp-heading">Drawdown</div>
                    <div class="vst-gd-comp-row">
                        <div class="vst-gd-comp-label">Maximum</div>
                        <div class="vst-gd-comp-bar-track">
                            <div class="vst-gd-comp-bar is-drawdown" style="width: 100%;"></div>
                        </div>
                        <div class="vst-gd-comp-val">${maxPeriodDdPct.toFixed(2)}%</div>
                    </div>
                    <div class="vst-gd-comp-row">
                        <div class="vst-gd-comp-label">Average</div>
                        <div class="vst-gd-comp-bar-track">
                            <div class="vst-gd-comp-bar is-drawdown" style="width: ${ddAvgBarWidth.toFixed(1)}%;"></div>
                        </div>
                        <div class="vst-gd-comp-val">${avgDdPct.toFixed(2)}%</div>
                    </div>
                    <div class="vst-gd-comp-row">
                        <div class="vst-gd-comp-label">Current</div>
                        <div class="vst-gd-comp-bar-track">
                            <div class="vst-gd-comp-bar is-cur-drawdown" style="width: ${curDdBarWidth.toFixed(1)}%;"></div>
                        </div>
                        <div class="vst-gd-comp-val">${curDdPct.toFixed(2)}%</div>
                    </div>
                </div>
            </div>
        </div>
    `;

    containerEl.innerHTML = metricsHtml + gridHtml;

    const chartBox = containerEl.querySelector('#vst-gd-echarts') as HTMLDivElement;
    if (!chartBox) return null;
    const chartInstance = echarts.init(chartBox);

    const barItems = periods.map((p, idx) => ({
        value: [idx, p.val],
        itemStyle: {
            color: p.type === 'Run-up' ? '#089981' : p.type === 'Drawdown' ? '#f23645' : '#8b2631',
        },
        meta: p,
    }));

    const maxChartVal = periods.length > 0 ? Math.max(...periods.map((p) => p.val)) : 10;
    const yMax = Number((maxChartVal * 1.15).toFixed(2));
    const yInterval = Number((yMax / 4).toFixed(2));

    chartInstance.setOption({
        backgroundColor: 'transparent',
        animation: false,
        grid: {
            left: 10,
            right: 60,
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
                const pList = params as Array<{ data: { meta: GdPeriod } }>;
                const item = pList[0]?.data?.meta;
                if (!item) return '';
                const color = item.type === 'Run-up' ? '#089981' : item.type === 'Drawdown' ? '#f23645' : '#8b2631';
                return `
                    <div style="font-size:12px;display:flex;justify-content:space-between;gap:16px;margin-bottom:2px;">
                        <span style="font-weight:600;color:#d1d4dc;">${item.type}</span>
                        <span style="font-weight:700;color:#d1d4dc;">${formatNumber(Math.abs(item.pnl))} ${curr}</span>
                    </div>
                    <div style="text-align:right;font-weight:700;color:${color};margin-bottom:4px;">${item.val.toFixed(2)}%</div>
                    <div style="font-size:11px;color:#787b86;">${item.date}</div>
                `;
            },
        },
        xAxis: {
            type: 'category',
            show: false,
            data: periods.map((_, i) => String(i)),
        },
        yAxis: {
            type: 'value',
            position: 'right',
            min: 0,
            max: yMax,
            interval: yInterval,
            splitLine: { lineStyle: { color: '#1e1e1e' } },
            axisLabel: {
                color: '#787b86',
                fontSize: 11,
                formatter: (val: number) => val.toFixed(2) + '%',
            },
        },
        legend: {
            bottom: 2,
            itemWidth: 8,
            itemHeight: 8,
            icon: 'circle',
            textStyle: { color: '#787b86', fontSize: 11 },
            data: ['Run-up', 'Drawdown', 'Current drawdown'],
        },
        series: [
            {
                name: 'Run-up',
                type: 'bar',
                data: barItems,
                barMaxWidth: 14,
                itemStyle: { color: '#089981' },
            },
            { name: 'Drawdown', type: 'bar', data: [], itemStyle: { color: '#f23645' } },
            { name: 'Current drawdown', type: 'bar', data: [], itemStyle: { color: '#8b2631' } },
        ],
    });

    return chartInstance;
}
