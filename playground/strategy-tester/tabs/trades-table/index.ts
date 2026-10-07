import type { StrategyTrade } from '@luxalgo/vela/plugin';
import type { TradesColumnKey } from '../../types';
import { formatNumber, formatSignedNumber } from '../../core/formatters';
import { enrichTrades, filterAndSortTrades } from './filter-sort';

export interface TradesTableOptions {
    containerEl: HTMLElement;
    getTrades: () => StrategyTrade[];
    getCustomCapitalAmount: () => number;
    getActiveColumns: () => Record<TradesColumnKey, boolean>;
    onExportCsv: () => void;
    onOpenColumnPicker: (anchorBtn: HTMLElement) => void;
}

export class TradesTableManager {
    private readonly containerEl: HTMLElement;
    private readonly getTrades: () => StrategyTrade[];
    private readonly getCustomCapitalAmount: () => number;
    private readonly getActiveColumns: () => Record<TradesColumnKey, boolean>;
    private readonly onExportCsv: () => void;
    private readonly onOpenColumnPicker: (anchorBtn: HTMLElement) => void;

    private sortColumn = 'tradeNum';
    private sortDirection: 'asc' | 'desc' = 'asc';
    private sideFilter: 'all' | 'long' | 'short' = 'all';
    private outcomeFilter: 'all' | 'win' | 'loss' = 'all';
    private searchQuery = '';

    constructor(opts: TradesTableOptions) {
        this.containerEl = opts.containerEl;
        this.getTrades = opts.getTrades;
        this.getCustomCapitalAmount = opts.getCustomCapitalAmount;
        this.getActiveColumns = opts.getActiveColumns;
        this.onExportCsv = opts.onExportCsv;
        this.onOpenColumnPicker = opts.onOpenColumnPicker;
    }

    public render(): void {
        const rawTrades = this.getTrades();
        const cols = this.getActiveColumns();
        const cap = this.getCustomCapitalAmount();

        const enriched = enrichTrades(rawTrades, cap);
        const filtered = filterAndSortTrades(enriched, {
            sideFilter: this.sideFilter,
            outcomeFilter: this.outcomeFilter,
            searchQuery: this.searchQuery,
            sortColumn: this.sortColumn,
            sortDirection: this.sortDirection,
        });

        const makeTh = (colKey: string, label: string) => {
            const isSorted = this.sortColumn === colKey;
            const arrow = isSorted ? (this.sortDirection === 'asc' ? '▲' : '▼') : '↕';
            return `<th class="vst-sortable-th ${isSorted ? 'is-sorted' : ''}" data-col="${colKey}" title="Click to sort by ${label}">
                <span>${label}</span>
                <span class="vst-sort-arrow">${arrow}</span>
            </th>`;
        };

        let ths = makeTh('tradeNum', 'Trade #');
        if (cols.dateTime) ths += makeTh('dateTime', 'Date and time');
        if (cols.signal) ths += makeTh('signal', 'Signal');
        if (cols.price) ths += makeTh('price', 'Price');
        if (cols.size) ths += makeTh('size', 'Size');
        if (cols.netPnl) ths += makeTh('netPnl', 'Net PnL');
        if (cols.returnPct) ths += makeTh('returnPct', 'Return');
        if (cols.commission) ths += makeTh('commission', 'Commission');
        if (cols.favorableExcursion) ths += makeTh('favorableExcursion', 'Favorable excursion');
        if (cols.adverseExcursion) ths += makeTh('adverseExcursion', 'Adverse excursion');
        if (cols.cumPnl) ths += makeTh('cumPnl', 'Cumulative PnL');
        if (cols.duration) ths += makeTh('duration', 'Duration (bars)');

        let rows = '';
        if (filtered.length === 0) {
            const msg = rawTrades.length === 0 ? 'No trades recorded yet.' : 'No trades match the current filter criteria.';
            rows = `<tr><td colspan="12" style="text-align:center;padding:24px;color:#787b86;">${msg}</td></tr>`;
        } else {
            for (const t of filtered) {
                let tds = `<td>${t.tradeNumStr}</td>`;
                if (cols.dateTime) tds += `<td>${t.dateStr}</td>`;
                if (cols.signal) tds += `<td style="font-weight:600;color:${t.side === 'long' ? '#089981' : '#2962ff'}">${t.side.toUpperCase()}</td>`;
                if (cols.price) tds += `<td>${formatNumber(t.price)}</td>`;
                if (cols.size) tds += `<td>${t.size}</td>`;
                if (cols.netPnl) tds += `<td style="font-weight:700;color:${t.isProfit ? '#089981' : '#f23645'}">${formatSignedNumber(t.pnl)}</td>`;
                if (cols.returnPct) tds += `<td style="font-weight:600;color:${t.isProfit ? '#089981' : '#f23645'}">${t.returnPct >= 0 ? '+' : ''}${t.returnPct.toFixed(2)}%</td>`;
                if (cols.commission) tds += `<td>0.00</td>`;
                if (cols.favorableExcursion) tds += `<td style="color:#089981;">${t.mfe > 0 ? `+${formatNumber(t.mfe)}` : '—'}</td>`;
                if (cols.adverseExcursion) tds += `<td style="color:#f23645;">${t.mae > 0 ? `-${formatNumber(t.mae)}` : '—'}</td>`;
                if (cols.cumPnl) tds += `<td style="font-weight:700;color:${t.cumPnl >= 0 ? '#089981' : '#f23645'}">${formatSignedNumber(t.cumPnl)}</td>`;
                if (cols.duration) tds += `<td>${t.duration} bars</td>`;

                rows += `<tr>${tds}</tr>`;
            }
        }

        const countBadgeText = `${filtered.length} of ${rawTrades.length} trades`;

        this.containerEl.innerHTML = `
            <div class="vst-trades-header-bar">
                <div class="vst-trades-header-left">
                    <div class="vst-trades-header-title">List of trades</div>
                    <span class="vst-trades-badge">${countBadgeText}</span>
                </div>
                <div class="vst-trades-header-filters">
                    <!-- Side Filter -->
                    <div class="vst-filter-group" title="Filter by trade side">
                        <button class="vst-filter-pill ${this.sideFilter === 'all' ? 'is-active' : ''}" data-side="all">All</button>
                        <button class="vst-filter-pill ${this.sideFilter === 'long' ? 'is-active' : ''}" data-side="long">Long</button>
                        <button class="vst-filter-pill ${this.sideFilter === 'short' ? 'is-active' : ''}" data-side="short">Short</button>
                    </div>
                    <!-- Outcome Filter -->
                    <div class="vst-filter-group" title="Filter by outcome">
                        <button class="vst-filter-pill ${this.outcomeFilter === 'all' ? 'is-active' : ''}" data-outcome="all">All</button>
                        <button class="vst-filter-pill ${this.outcomeFilter === 'win' ? 'is-active' : ''}" data-outcome="win">Wins</button>
                        <button class="vst-filter-pill ${this.outcomeFilter === 'loss' ? 'is-active' : ''}" data-outcome="loss">Losses</button>
                    </div>
                    <!-- Search Input -->
                    <div class="vst-search-box">
                        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5L14 14"/></svg>
                        <input type="text" class="vst-trades-search-input" placeholder="Search trades..." value="${this.searchQuery.replace(/"/g, '&quot;')}" />
                        ${this.searchQuery ? `<button class="vst-search-clear" title="Clear search">✕</button>` : ''}
                    </div>
                </div>
                <div class="vst-trades-header-actions">
                    <button class="vst-trades-action-btn vst-trades-export-btn" title="Export CSV">
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4">
                            <path d="M2.5 10v3.5h11V10M8 2v8.5M4.5 7.5L8 11l3.5-3.5"/>
                        </svg>
                    </button>
                    <button class="vst-trades-action-btn vst-trades-cols-btn" title="Select columns">
                        <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.3">
                            <rect x="2.5" y="2.5" width="11" height="11" rx="1.5"/>
                            <path d="M6.5 2.5v11M9.5 2.5v11"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="vst-trades-table-wrapper">
                <table class="vst-trades-table">
                    <thead>
                        <tr>
                            ${ths}
                        </tr>
                    </thead>
                    <tbody>
                        ${rows}
                    </tbody>
                </table>
            </div>
        `;

        this.attachEventListeners();
    }

    private attachEventListeners(): void {
        this.containerEl.querySelectorAll<HTMLElement>('.vst-sortable-th').forEach((th) => {
            th.addEventListener('click', () => {
                const colKey = th.dataset.col;
                if (!colKey) return;
                if (this.sortColumn === colKey) {
                    this.sortDirection = this.sortDirection === 'asc' ? 'desc' : 'asc';
                } else {
                    this.sortColumn = colKey;
                    this.sortDirection = colKey === 'netPnl' || colKey === 'returnPct' || colKey === 'cumPnl' ? 'desc' : 'asc';
                }
                this.render();
            });
        });

        this.containerEl.querySelectorAll<HTMLElement>('.vst-filter-pill[data-side]').forEach((pill) => {
            pill.addEventListener('click', () => {
                const side = pill.dataset.side as 'all' | 'long' | 'short';
                if (side && this.sideFilter !== side) {
                    this.sideFilter = side;
                    this.render();
                }
            });
        });

        this.containerEl.querySelectorAll<HTMLElement>('.vst-filter-pill[data-outcome]').forEach((pill) => {
            pill.addEventListener('click', () => {
                const outcome = pill.dataset.outcome as 'all' | 'win' | 'loss';
                if (outcome && this.outcomeFilter !== outcome) {
                    this.outcomeFilter = outcome;
                    this.render();
                }
            });
        });

        const searchInput = this.containerEl.querySelector<HTMLInputElement>('.vst-trades-search-input');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                this.searchQuery = searchInput.value;
                this.render();
                const newSearch = this.containerEl.querySelector<HTMLInputElement>('.vst-trades-search-input');
                if (newSearch) {
                    newSearch.focus();
                    newSearch.setSelectionRange(newSearch.value.length, newSearch.value.length);
                }
            });
        }

        const clearBtn = this.containerEl.querySelector('.vst-search-clear');
        if (clearBtn) {
            clearBtn.addEventListener('click', () => {
                this.searchQuery = '';
                this.render();
            });
        }

        this.containerEl.querySelector('.vst-trades-export-btn')?.addEventListener('click', () => {
            this.onExportCsv();
        });

        const colsBtn = this.containerEl.querySelector('.vst-trades-cols-btn') as HTMLElement;
        colsBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.onOpenColumnPicker(colsBtn);
        });
    }
}
