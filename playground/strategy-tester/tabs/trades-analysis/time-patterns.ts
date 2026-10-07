import * as echarts from 'echarts';
import type { StrategyTrade } from '@luxalgo/vela/plugin';

export interface TimePatternsOptions {
    containerEl: HTMLElement;
    trades: StrategyTrade[];
}

export function renderTimePatternsTab(opts: TimePatternsOptions): echarts.ECharts | null {
    const { containerEl, trades } = opts;
    const hourStats: Record<number, { wins: number; total: number }> = {};
    const dayStats: Record<number, { wins: number; total: number }> = {};
    const monthStats: Record<number, { wins: number; total: number }> = {};
    const winnersData: number[] = new Array<number>(12).fill(0);
    const losersData: number[] = new Array<number>(12).fill(0);
    let totalDurationDays = 0;

    for (const t of trades) {
        const d = new Date(t.entry.time);
        const h = d.getHours();
        const day = d.getDay();
        const m = d.getMonth();
        const isWin = (t.pnl ?? 0) >= 0;

        if (!hourStats[h]) hourStats[h] = { wins: 0, total: 0 };
        hourStats[h].total++;
        if (isWin) hourStats[h].wins++;

        if (!dayStats[day]) dayStats[day] = { wins: 0, total: 0 };
        dayStats[day].total++;
        if (isWin) dayStats[day].wins++;

        if (!monthStats[m]) monthStats[m] = { wins: 0, total: 0 };
        monthStats[m].total++;
        if (isWin) monthStats[m].wins++;

        if (isWin) winnersData[m] = (winnersData[m] ?? 0) + 1;
        else losersData[m] = (losersData[m] ?? 0) + 1;

        if (t.exit?.time) {
            totalDurationDays += Math.max(1, (t.exit.time - t.entry.time) / (86400 * 1000));
        }
    }

    let bestHour = 14;
    let bestHourWinRate = 0;
    for (const [hStr, stat] of Object.entries(hourStats)) {
        const wr = stat.total > 0 ? (stat.wins / stat.total) * 100 : 0;
        if (wr >= bestHourWinRate && stat.total >= 1) {
            bestHourWinRate = wr;
            bestHour = Number(hStr);
        }
    }

    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    let bestDay = 'Tuesday';
    let bestDayWinRate = 0;
    for (const [dStr, stat] of Object.entries(dayStats)) {
        const wr = stat.total > 0 ? (stat.wins / stat.total) * 100 : 0;
        if (wr >= bestDayWinRate && stat.total >= 1) {
            bestDayWinRate = wr;
            bestDay = dayNames[Number(dStr)] || 'Tuesday';
        }
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let bestMonth = 'May';
    let bestMonthWinRate = 0;
    for (const [mStr, stat] of Object.entries(monthStats)) {
        const wr = stat.total > 0 ? (stat.wins / stat.total) * 100 : 0;
        if (wr >= bestMonthWinRate && stat.total >= 1) {
            bestMonthWinRate = wr;
            bestMonth = monthNames[Number(mStr)] || 'May';
        }
    }

    const avgDurationDays = trades.length > 0 ? Math.round(totalDurationDays / trades.length) : 0;

    const metricsHtml = `
        <div class="vst-analysis-metrics-row">
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Best hour for entries</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${String(bestHour).padStart(2, '0')}:00 (${bestHourWinRate.toFixed(1)}%)</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Best day for entries</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${bestDay} (${bestDayWinRate.toFixed(1)}%)</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Best month for entries</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${bestMonth} (${bestMonthWinRate.toFixed(1)}%)</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Average trade duration</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${avgDurationDays} bars / ${avgDurationDays} days</span>
                </div>
            </div>
        </div>
    `;

    const chartHtml = `
        <div class="vst-analysis-subtitle" style="margin-bottom: 12px;">Results by time</div>
        <div id="vst-time-patterns-echarts" class="vst-analysis-chart" style="height: 250px;"></div>
    `;

    containerEl.innerHTML = metricsHtml + chartHtml;

    const chartBox = containerEl.querySelector('#vst-time-patterns-echarts') as HTMLDivElement;
    if (!chartBox) return null;
    const chartInstance = echarts.init(chartBox);

    const maxTotalMonth = Math.max(...winnersData.map((w: number, idx: number): number => w + (losersData[idx] ?? 0)), 4);
    const yMonthMax = Math.ceil(maxTotalMonth * 1.2);
    const yMonthInterval = Math.max(1, Math.ceil(yMonthMax / 4));

    chartInstance.setOption({
        backgroundColor: 'transparent',
        animation: false,
        grid: {
            left: 10,
            right: 40,
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
                const pList = params as Array<{ seriesName: string; value: number; name: string }>;
                const monthMap: Record<string, string> = {
                    Jan: 'January', Feb: 'February', Mar: 'March', Apr: 'April', May: 'May', Jun: 'June',
                    Jul: 'July', Aug: 'August', Sep: 'September', Oct: 'October', Nov: 'November', Dec: 'December'
                };
                const monthShort = pList[0]?.name || '';
                const fullMonth = monthMap[monthShort] || monthShort;
                const w = pList.find(p => p.seriesName === 'Winners')?.value ?? 0;
                const l = pList.find(p => p.seriesName === 'Losers')?.value ?? 0;
                return `
                    <div style="font-size:12px;color:#d1d4dc;display:flex;flex-direction:column;gap:4px;">
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
                            <span style="display:flex;align-items:center;gap:6px;">
                                <span style="width:7px;height:7px;border-radius:50%;background:#089981;display:inline-block;"></span>
                                <span>Winners</span>
                            </span>
                            <span style="font-weight:600;">${w} trades</span>
                        </div>
                        <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;">
                            <span style="display:flex;align-items:center;gap:6px;">
                                <span style="width:7px;height:7px;border-radius:50%;background:#f23645;display:inline-block;"></span>
                                <span>Losers</span>
                            </span>
                            <span style="font-weight:600;">${l} trades</span>
                        </div>
                        <div style="font-size:11px;color:#787b86;text-align:center;margin-top:2px;">${fullMonth}</div>
                    </div>
                `;
            },
        },
        xAxis: {
            type: 'category',
            data: monthNames,
            axisLine: { lineStyle: { color: '#2e2e2e' } },
            axisTick: { show: false },
            axisLabel: { color: '#787b86', fontSize: 11 },
        },
        yAxis: {
            type: 'value',
            position: 'right',
            min: 0,
            max: yMonthMax,
            interval: yMonthInterval,
            splitLine: { lineStyle: { color: '#1e1e1e' } },
            axisLabel: { color: '#787b86', fontSize: 11 },
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
                stack: 'total',
                data: winnersData,
                barMaxWidth: 32,
                itemStyle: { color: '#089981' },
            },
            {
                name: 'Losers',
                type: 'bar',
                stack: 'total',
                data: losersData,
                barMaxWidth: 32,
                itemStyle: { color: '#f23645' },
            },
        ],
    });

    return chartInstance;
}
