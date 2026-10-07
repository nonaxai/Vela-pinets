import type { StrategyTrade } from '@luxalgo/vela/plugin';
import type { BacktestSummaryStats, BreakdownSubMode } from '../../types';
import { formatNumber, formatSignedNumber } from '../../core/formatters';

export interface BreakdownOptions {
    containerEl: HTMLElement;
    stats: BacktestSummaryStats | null;
    trades: StrategyTrade[];
    subMode: BreakdownSubMode;
    onSubModeChange: (mode: BreakdownSubMode) => void;
}

export function renderBreakdownTab(opts: BreakdownOptions): void {
    const { containerEl, stats, trades, subMode, onSubModeChange } = opts;
    const initCap = stats?.initialCapital || 10000;
    const grossProfit = stats?.grossProfit ?? trades.filter((t) => (t.pnl ?? 0) > 0).reduce((acc, t) => acc + (t.pnl ?? 0), 0);
    const grossLoss = stats?.grossLoss ?? Math.abs(trades.filter((t) => (t.pnl ?? 0) < 0).reduce((acc, t) => acc + (t.pnl ?? 0), 0));
    const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : (grossProfit > 0 ? 999 : 0);
    const totalComm = trades.reduce((acc, t) => acc + (t.commission ?? 0), 0);
    const grossProfitPct = ((grossProfit / initCap) * 100).toFixed(2);
    const grossLossPct = ((grossLoss / initCap) * 100).toFixed(2);
    const commLoadPct = ((totalComm / initCap) * 100).toFixed(2);
    const curr = stats?.currency || 'NONE';

    // 4 summary metrics (media_1791253627698.png & media_1791250134285.png)
    const metricsHtml = `
        <div class="vst-analysis-metrics-row">
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Gross profit</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${formatNumber(grossProfit)}</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                    <span class="vst-analysis-metric-sub">${grossProfitPct}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Gross loss</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${formatNumber(grossLoss)}</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                    <span class="vst-analysis-metric-sub">${grossLossPct}%</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Profit factor</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${profitFactor.toFixed(2)}</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Commission load</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">${formatNumber(totalComm)}</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                    <span class="vst-analysis-metric-sub">${commLoadPct}%</span>
                </div>
            </div>
        </div>
    `;

    // Subnav with By signals / By side toggle
    const subnavHtml = `
        <div class="vst-analysis-subnav">
            <div class="vst-analysis-subtitle">Profits and losses</div>
            <div class="vst-segmented-toggle" id="vst-breakdown-submode-toggle">
                <button class="vst-toggle-btn ${subMode === 'signals' ? 'is-active' : ''}" data-mode="signals">By signals</button>
                <button class="vst-toggle-btn ${subMode === 'side' ? 'is-active' : ''}" data-mode="side">By side</button>
            </div>
        </div>
    `;

    interface BreakdownRowData {
        label: string;
        iconSvg?: string;
        profits: number;
        losses: number;
        comm: number;
        pf: number;
        netPnl: number;
    }

    const calcGroup = (grpTrades: StrategyTrade[], label: string, iconSvg?: string): BreakdownRowData => {
        const p = grpTrades.filter((t) => (t.pnl ?? 0) > 0).reduce((acc, t) => acc + (t.pnl ?? 0), 0);
        const l = Math.abs(grpTrades.filter((t) => (t.pnl ?? 0) < 0).reduce((acc, t) => acc + (t.pnl ?? 0), 0));
        const c = grpTrades.reduce((acc, t) => acc + (t.commission ?? 0), 0);
        const pf = l > 0 ? p / l : (p > 0 ? 999 : 0);
        return { label, iconSvg, profits: p, losses: l, comm: c, pf, netPnl: p - l };
    };

    const longTrades = trades.filter((t) => t.side === 'long');
    const shortTrades = trades.filter((t) => t.side === 'short');

    let groupList: BreakdownRowData[] = [];
    if (subMode === 'signals') {
        const allGrp = calcGroup(trades, 'All signals');
        const buyGrp = calcGroup(longTrades, 'Golden Cross BUY');
        const sellGrp = calcGroup(shortTrades, 'Death Cross SELL');
        groupList = [allGrp, buyGrp, sellGrp];
    } else {
        const bothGrp = calcGroup(trades, 'Both sides');
        const longsGrp = calcGroup(
            longTrades,
            'Longs',
            '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 12l8-8M6 4h6v6"/></svg>',
        );
        const shortsGrp = calcGroup(
            shortTrades,
            'Shorts',
            '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4l8 8M12 6v6H6"/></svg>',
        );
        groupList = [bothGrp, longsGrp, shortsGrp];
    }

    const maxTotal = Math.max(1, ...groupList.map((g) => Math.max(g.profits, g.losses)));

    let rowsHtml = '<div class="vst-breakdown-list">';
    for (const g of groupList) {
        const lossWidth = Math.min(48, maxTotal > 0 ? (g.losses / maxTotal) * 45 : 0);
        const profitWidth = Math.min(52, maxTotal > 0 ? (g.profits / maxTotal) * 50 : 0);
        const valClass = g.netPnl >= 0 ? 'is-positive' : 'is-negative';
        rowsHtml += `
            <div class="vst-breakdown-row"
                 data-profits="${formatNumber(g.profits)}"
                 data-losses="-${formatNumber(g.losses)}"
                 data-comm="${formatNumber(g.comm)}"
                 data-pf="${g.pf.toFixed(2)}"
                 data-unit="${curr}">
                <div class="vst-breakdown-label">
                    ${g.iconSvg ? g.iconSvg : ''}
                    ${g.label}
                </div>
                <div class="vst-breakdown-bar-track">
                    <div class="vst-breakdown-guide-line"></div>
                    <div class="vst-breakdown-zero-line"></div>
                    <div class="vst-breakdown-loss-group" style="width: ${lossWidth.toFixed(1)}%;">
                        <div class="vst-breakdown-bar-segment" style="width: 100%; background: #c22d38; border-radius: 3px 0 0 3px;"></div>
                    </div>
                    <div class="vst-breakdown-profit-group" style="width: ${profitWidth.toFixed(1)}%;">
                        <div class="vst-breakdown-bar-segment" style="width: 100%; background: #089981; border-radius: 0 3px 3px 0;"></div>
                    </div>
                </div>
                <div class="vst-breakdown-val-col ${valClass}">${formatSignedNumber(g.netPnl)} <span class="vst-unit">${curr}</span></div>
            </div>
        `;
    }
    rowsHtml += '</div>';

    const tooltipHtml = `
        <div class="vst-breakdown-tooltip" id="vst-breakdown-tooltip">
            <div class="vst-bdt-row">
                <div class="vst-bdt-label"><span class="vst-bdt-dot is-profit"></span>Profits</div>
                <div class="vst-bdt-val" id="vst-bdt-profits">${formatNumber(grossProfit)} ${curr}</div>
            </div>
            <div class="vst-bdt-row">
                <div class="vst-bdt-label"><span class="vst-bdt-dot is-loss"></span>Losses</div>
                <div class="vst-bdt-val" id="vst-bdt-losses">-${formatNumber(grossLoss)} ${curr}</div>
            </div>
            <div class="vst-bdt-row">
                <div class="vst-bdt-label"><span class="vst-bdt-dot is-comm"></span>Commissions</div>
                <div class="vst-bdt-val" id="vst-bdt-comm">${formatNumber(totalComm)} ${curr}</div>
            </div>
            <div class="vst-bdt-row">
                <div class="vst-bdt-label" style="padding-left: 14px;">Profit factor</div>
                <div class="vst-bdt-val" id="vst-bdt-pf">${profitFactor.toFixed(2)}</div>
            </div>
            <div class="vst-bdt-beak" id="vst-bdt-beak"></div>
        </div>
    `;

    containerEl.innerHTML = metricsHtml + subnavHtml + rowsHtml + tooltipHtml;

    // Attach By signals / By side toggle listener
    containerEl.querySelectorAll('#vst-breakdown-submode-toggle .vst-toggle-btn').forEach((btn) => {
        btn.addEventListener('click', (e) => {
            const target = e.currentTarget as HTMLElement;
            const mode = target.dataset.mode as BreakdownSubMode;
            if (mode && mode !== subMode) {
                onSubModeChange(mode);
            }
        });
    });

    attachBreakdownTooltipListeners(containerEl);
}

function attachBreakdownTooltipListeners(containerEl: HTMLElement): void {
    const tooltipEl = containerEl.querySelector('#vst-breakdown-tooltip') as HTMLElement;
    const beakEl = containerEl.querySelector('#vst-bdt-beak') as HTMLElement;
    const profitsEl = containerEl.querySelector('#vst-bdt-profits') as HTMLElement;
    const lossesEl = containerEl.querySelector('#vst-bdt-losses') as HTMLElement;
    const commEl = containerEl.querySelector('#vst-bdt-comm') as HTMLElement;
    const pfEl = containerEl.querySelector('#vst-bdt-pf') as HTMLElement;

    if (!tooltipEl || !beakEl) return;

    const rows = containerEl.querySelectorAll('.vst-breakdown-row');
    rows.forEach((row) => {
        const rowEl = row as HTMLElement;
        const barTrack = rowEl.querySelector('.vst-breakdown-bar-track') as HTMLElement;

        const onMove = (e: MouseEvent) => {
            const bodyRect = containerEl.getBoundingClientRect();
            const trackRect = barTrack ? barTrack.getBoundingClientRect() : rowEl.getBoundingClientRect();

            const profits = rowEl.dataset.profits || '0.00';
            const losses = rowEl.dataset.losses || '0.00';
            const comm = rowEl.dataset.comm || '0';
            const pf = rowEl.dataset.pf || '0.00';
            const unit = rowEl.dataset.unit || 'NONE';

            if (profitsEl) profitsEl.textContent = `${profits} ${unit}`;
            if (lossesEl) lossesEl.textContent = `${losses} ${unit}`;
            if (commEl) commEl.textContent = `${comm} ${unit}`;
            if (pfEl) pfEl.textContent = pf;

            const tooltipWidth = tooltipEl.offsetWidth || 205;
            const tooltipHeight = tooltipEl.offsetHeight || 105;

            const zeroDividerX = (trackRect.left + trackRect.width * 0.3) - bodyRect.left;
            const isOverTrack = barTrack && e.clientX >= trackRect.left && e.clientX <= trackRect.right;
            const targetX = isOverTrack ? (e.clientX - bodyRect.left) : zeroDividerX;

            const minLeft = 8;
            const maxLeft = bodyRect.width - tooltipWidth - 8;
            const tooltipLeft = Math.max(minLeft, Math.min(targetX - tooltipWidth / 2, maxLeft));

            const beakX = Math.max(14, Math.min(targetX - tooltipLeft, tooltipWidth - 14));
            beakEl.style.left = `${beakX}px`;

            const rowTop = (barTrack ? trackRect.top : rowEl.getBoundingClientRect().top) - bodyRect.top;
            const tooltipTop = rowTop - tooltipHeight - 8;

            tooltipEl.style.left = `${tooltipLeft}px`;
            tooltipEl.style.top = `${tooltipTop}px`;
            tooltipEl.classList.add('is-visible');
        };

        rowEl.addEventListener('mouseenter', onMove);
        rowEl.addEventListener('mousemove', onMove);
        rowEl.addEventListener('mouseleave', () => {
            tooltipEl.classList.remove('is-visible');
        });
    });
}
