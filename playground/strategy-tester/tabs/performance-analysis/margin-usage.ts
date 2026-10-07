import type { BacktestSummaryStats } from '../../types';

export interface MarginUsageOptions {
    containerEl: HTMLElement;
    stats: BacktestSummaryStats | null;
}

export function renderMarginUsageTab(opts: MarginUsageOptions): void {
    const { containerEl, stats } = opts;
    const curr = stats?.currency || 'NONE';

    const metricsHtml = `
        <div class="vst-analysis-metrics-row">
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Margin efficiency</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">0</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Average margin used</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">0</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Margin calls</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">0</span>
                </div>
            </div>
            <div class="vst-analysis-metric-col">
                <div class="vst-analysis-metric-label">Total liquidated volume</div>
                <div class="vst-analysis-metric-val-wrap">
                    <span class="vst-analysis-metric-val">0</span>
                    <span class="vst-analysis-metric-unit">${curr}</span>
                </div>
            </div>
        </div>
    `;

    const subnavHtml = `
        <div class="vst-analysis-subnav">
            <div class="vst-analysis-subtitle">Margin utilization</div>
        </div>
    `;

    const emptyStateHtml = `
        <div class="vst-empty-state">
            <svg class="vst-ufo-cow-icon" viewBox="0 0 80 80" width="72" height="72" fill="none" stroke="#787b86" stroke-width="1.5">
                <!-- UFO dome & saucer -->
                <ellipse cx="40" cy="22" rx="14" ry="5"/>
                <ellipse cx="40" cy="20" rx="7" ry="4"/>
                <!-- Abduction beam rays -->
                <line x1="28" y1="26" x2="16" y2="68" stroke-dasharray="3 3"/>
                <line x1="52" y1="26" x2="64" y2="68" stroke-dasharray="3 3"/>
                <!-- Floating cow outline -->
                <g transform="translate(32, 38) rotate(18) scale(0.7)">
                    <rect x="2" y="5" width="18" height="11" rx="2" fill="none" stroke="#787b86" stroke-width="1.8"/>
                    <circle cx="21" cy="4" r="3.5" fill="none" stroke="#787b86" stroke-width="1.8"/>
                    <path d="M20 1l-1 -2M22 1l1 -2" stroke="#787b86" stroke-width="1.5"/>
                    <line x1="5" y1="16" x2="4" y2="22" stroke="#787b86" stroke-width="1.8"/>
                    <line x1="8" y1="16" x2="7" y2="22" stroke="#787b86" stroke-width="1.8"/>
                    <line x1="14" y1="16" x2="15" y2="22" stroke="#787b86" stroke-width="1.8"/>
                    <line x1="17" y1="16" x2="18" y2="22" stroke="#787b86" stroke-width="1.8"/>
                    <path d="M10 16a2 2 0 0 0 3 0" stroke="#787b86" stroke-width="1.5"/>
                    <path d="M2 7c-2 1 -3 4 -2 6" stroke="#787b86" stroke-width="1.5"/>
                </g>
            </svg>
            <div class="vst-empty-text">Not enough data to show</div>
        </div>
    `;

    containerEl.innerHTML = metricsHtml + subnavHtml + emptyStateHtml;
}
