import type { Vela, IndicatorHandle } from '@luxalgo/vela';
import type { TradesColumnKey } from '../types';

export interface HeaderControlsOptions {
    rootEl: HTMLElement;
    getMode: () => 'docked' | 'floating';
    getActiveChart: () => Vela | null;
    getActiveHandle: () => IndicatorHandle | null;
    extractTitle: (handle: IndicatorHandle) => string;
    onSelectStrategy: (strat: IndicatorHandle) => void;
    // Testing period
    getSelectedTestingPeriod: () => string;
    onApplyTestingPeriod: (periodKey: string) => void;
    onPromptCustomDateRange: () => void;
    // Capital & Currency
    getCustomCapitalAmount: () => number;
    setCustomCapitalAmount: (amount: number) => void;
    getSelectedCurrency: () => string;
    setSelectedCurrency: (currency: string) => void;
    onRecalculateCapital: () => void;
    // Bar detalization
    getSelectedBarDetalization: () => string;
    setSelectedBarDetalization: (val: string) => void;
    // Script execution
    getSelectedExecModes: () => Array<'close' | 'fill' | 'tick'>;
    setSelectedExecModes: (modes: Array<'close' | 'fill' | 'tick'>) => void;
    // Scale settings
    getScaleMode: () => 'regular' | 'percent';
    setScaleMode: (mode: 'regular' | 'percent') => void;
    getShowWhitespaces: () => boolean;
    setShowWhitespaces: (val: boolean) => void;
    onScaleOrWhitespaceChange: () => void;
    // Trades columns
    getActiveColumns: () => Record<TradesColumnKey, boolean>;
    onColumnToggle: (key: TradesColumnKey) => void;
}

export class HeaderControlsManager {
    private readonly opts: HeaderControlsOptions;
    private activeDropdownEl: HTMLElement | null = null;

    constructor(opts: HeaderControlsOptions) {
        this.opts = opts;
    }

    public openDropdown(
        anchorBtn: HTMLElement,
        contentFn: (container: HTMLElement) => void,
        width = 240
    ): HTMLElement {
        this.closeAnyDropdown();
        anchorBtn.classList.add('is-active');

        const panel = document.createElement('div');
        panel.className = 'vst-dropdown-panel';
        panel.style.minWidth = `${width}px`;

        contentFn(panel);
        document.body.appendChild(panel);
        this.activeDropdownEl = panel;

        const rect = anchorBtn.getBoundingClientRect();
        const leftPos = rect.right - width >= 10 && rect.left + width > window.innerWidth
            ? rect.right - width
            : Math.max(10, Math.min(window.innerWidth - width - 10, rect.left));
        panel.style.left = `${leftPos}px`;

        const spaceBelow = window.innerHeight - rect.bottom;
        if (spaceBelow < 280 && rect.top > 280) {
            panel.style.bottom = `${window.innerHeight - rect.top + 4}px`;
        } else {
            panel.style.top = `${rect.bottom + 4}px`;
        }

        const outsideHandler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (!panel.contains(target) && !anchorBtn.contains(target)) {
                this.closeAnyDropdown();
                document.removeEventListener('mousedown', outsideHandler);
            }
        };
        setTimeout(() => document.addEventListener('mousedown', outsideHandler), 0);

        return panel;
    }

    public closeAnyDropdown(): void {
        if (this.activeDropdownEl) {
            this.activeDropdownEl.remove();
            this.activeDropdownEl = null;
        }
        this.opts.rootEl.querySelectorAll('.vst-dropdown-pill.is-active, .vst-icon-btn.is-active, .vst-trades-action-btn.is-active').forEach((btn) => {
            btn.classList.remove('is-active');
        });
    }

    public showStrategyDropdown(anchorBtn: HTMLElement): void {
        const existing = document.querySelector('.vst-strategy-dropdown-menu');
        if (existing) {
            existing.remove();
            return;
        }

        const chart = this.opts.getActiveChart();
        const indicators: IndicatorHandle[] = chart ? chart.indicators() : [];
        const strategies = indicators.filter((h) => {
            if (h.source && /^\s*strategy\s*\(/m.test(h.source)) return true;
            if (h.title && /strategy/i.test(h.title)) return true;
            if (h.props && h.props.some((p) => p.key === 'initial_capital' || p.key === 'default_qty_value')) return true;
            return false;
        });

        const menu = document.createElement('div');
        menu.className = 'vst-strategy-dropdown-menu';
        menu.style.cssText = `
            position: absolute;
            background: #141414;
            border: 1px solid #383838;
            border-radius: 6px;
            box-shadow: 0 8px 24px rgba(0,0,0,0.5);
            padding: 6px 0;
            z-index: 100;
            min-width: 240px;
            font-size: 12px;
            color: #d1d4dc;
        `;

        const rect = anchorBtn.getBoundingClientRect();
        menu.style.left = `${Math.max(12, rect.left)}px`;
        if (this.opts.getMode() === 'docked') {
            menu.style.bottom = `${window.innerHeight - rect.top + 6}px`;
        } else {
            menu.style.top = `${rect.bottom + 6}px`;
        }

        let itemsHtml = '<div style="padding:4px 12px 6px;font-size:11px;font-weight:700;color:#787b86;border-bottom:1px solid #2e2e2e;">Active Chart Strategies</div>';

        const activeHandle = this.opts.getActiveHandle();
        if (strategies.length === 0) {
            itemsHtml += '<div style="padding:8px 12px;color:#787b86;">No strategy indicators on chart</div>';
        } else {
            for (const s of strategies) {
                const isActive = s.id === activeHandle?.id;
                itemsHtml += `
                    <div class="vst-strat-item" data-id="${s.id}" style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;cursor:pointer;${isActive ? 'background:#242424;color:#089981;font-weight:600;' : ''}">
                        <div style="display:flex;align-items:center;gap:6px;">
                            <span style="color:${isActive ? '#089981' : '#787b86'}">${isActive ? '✓' : '•'}</span>
                            <span>${this.opts.extractTitle(s)}</span>
                        </div>
                        <span style="font-size:10px;color:#787b86;">${s.visible ? 'Visible' : 'Hidden'}</span>
                    </div>
                `;
            }
        }

        menu.innerHTML = itemsHtml;
        document.body.appendChild(menu);

        menu.querySelectorAll('.vst-strat-item').forEach((item) => {
            item.addEventListener('mouseenter', () => {
                (item as HTMLElement).style.background = '#2a2b32';
            });
            item.addEventListener('mouseleave', () => {
                const id = (item as HTMLElement).dataset.id;
                (item as HTMLElement).style.background = id === activeHandle?.id ? '#262830' : 'transparent';
            });
            item.addEventListener('click', () => {
                const id = (item as HTMLElement).dataset.id;
                const strat = strategies.find((s) => s.id === id);
                if (strat) {
                    this.opts.onSelectStrategy(strat);
                }
                menu.remove();
            });
        });

        const closeHandler = (ev: MouseEvent) => {
            if (!menu.contains(ev.target as Node) && ev.target !== anchorBtn) {
                menu.remove();
                document.removeEventListener('click', closeHandler);
            }
        };
        setTimeout(() => document.addEventListener('click', closeHandler), 0);
    }

    public showTestingPeriodDropdown(anchorBtn: HTMLElement): void {
        if (anchorBtn.classList.contains('is-active')) {
            this.closeAnyDropdown();
            return;
        }

        const periods = [
            { key: 'available', label: 'All available data', hint: '', range: '' },
            { key: '7d', label: 'Last 7 days', hint: '', range: 'Sep 28, 2026 — Oct 5, 2026' },
            { key: '30d', label: 'Last 30 days', hint: '', range: 'Sep 5, 2026 — Oct 5, 2026' },
            { key: '90d', label: 'Last 90 days', hint: '', range: 'Jul 7, 2026 — Oct 5, 2026' },
            { key: '365d', label: 'Last 365 days', hint: '', range: 'Oct 5, 2025 — Oct 5, 2026' },
            { key: 'entire', label: 'Entire history', hint: '', range: 'Feb 1, 1871 — Oct 5, 2026' },
        ];

        this.openDropdown(anchorBtn, (panel) => {
            const currentPeriod = this.opts.getSelectedTestingPeriod();
            let itemsHtml = `
                <div class="vst-drop-header">
                    <span>Testing period</span>
                    <button class="vst-drop-reset-btn ${currentPeriod !== 'available' ? 'is-active' : ''}">Reset</button>
                </div>
                <div class="vst-drop-divider"></div>
            `;

            for (const p of periods) {
                const isSel = currentPeriod === p.key;
                itemsHtml += `
                    <div class="vst-drop-item ${isSel ? 'is-selected' : ''}" data-key="${p.key}">
                        <span>${p.label}</span>
                        ${p.hint ? `<span class="vst-drop-hint">${p.hint}</span>` : ''}
                    </div>
                `;
            }

            itemsHtml += `
                <div class="vst-drop-divider"></div>
                <div class="vst-drop-custom-item" data-key="custom">
                    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.4"><rect x="2" y="3" width="12" height="11" rx="2"/><path d="M2 7h12M5 1.5v3M11 1.5v3"/></svg>
                    <span>Custom date range</span>
                </div>
            `;

            panel.innerHTML = itemsHtml;

            panel.querySelector('.vst-drop-reset-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.opts.onApplyTestingPeriod('available');
                this.closeAnyDropdown();
            });

            panel.querySelectorAll('.vst-drop-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const key = (item as HTMLElement).dataset.key;
                    if (key) {
                        this.opts.onApplyTestingPeriod(key);
                    }
                    this.closeAnyDropdown();
                });
            });

            panel.querySelector('.vst-drop-custom-item')?.addEventListener('click', () => {
                this.opts.onPromptCustomDateRange();
                this.closeAnyDropdown();
            });
        }, 250);
    }

    public showInitialCapitalDropdown(anchorBtn: HTMLElement): void {
        if (anchorBtn.classList.contains('is-active')) {
            this.closeAnyDropdown();
            return;
        }

        const currencies = ['Same as chart', 'USD', 'EUR', 'AUD', 'GBP', 'NZD', 'CAD', 'CHF', 'SHOW MORE'];

        this.openDropdown(anchorBtn, (panel) => {
            const currentCurrency = this.opts.getSelectedCurrency();
            const capitalAmount = this.opts.getCustomCapitalAmount();
            const currLabel = currentCurrency === 'SAME' ? 'Same as chart' : currentCurrency;
            const shortCurr = currLabel.length > 11 ? `${currLabel.slice(0, 10)}...` : currLabel;

            panel.innerHTML = `
                <div class="vst-drop-header">
                    <span>Initial capital</span>
                </div>
                <div class="vst-drop-divider"></div>
                <div class="vst-capital-panel-row">
                    <input class="vst-capital-input" type="text" value="${capitalAmount.toLocaleString('en-US')}" />
                    <button class="vst-curr-toggle-btn" type="button">
                        <span class="vst-curr-btn-label">${shortCurr}</span>
                        <svg class="vst-chevron" viewBox="0 0 10 6" width="8" height="5" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M1 1l4 4 4-4"/></svg>
                    </button>
                    <div class="vst-curr-submenu" style="display:none;">
                        ${currencies.map((c) => {
                            const isSel = (c === 'Same as chart' && currentCurrency === 'SAME') || c === currentCurrency;
                            return `<div class="vst-curr-item ${isSel ? 'is-selected' : ''}" data-curr="${c}">${c}</div>`;
                        }).join('')}
                    </div>
                </div>
            `;

            const input = panel.querySelector('.vst-capital-input') as HTMLInputElement;
            const currBtn = panel.querySelector('.vst-curr-toggle-btn') as HTMLElement;
            const submenu = panel.querySelector('.vst-curr-submenu') as HTMLElement;

            input.addEventListener('change', () => {
                const num = parseFloat(input.value.replace(/,/g, ''));
                if (!isNaN(num) && num > 0) {
                    const rounded = Math.round(num);
                    this.opts.setCustomCapitalAmount(rounded);
                    input.value = rounded.toLocaleString('en-US');
                    this.opts.onRecalculateCapital();
                }
            });

            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    input.blur();
                    this.closeAnyDropdown();
                }
            });

            currBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const isOpen = submenu.style.display !== 'none';
                submenu.style.display = isOpen ? 'none' : 'block';
                currBtn.classList.toggle('is-active', !isOpen);
            });

            submenu.querySelectorAll('.vst-curr-item').forEach((item) => {
                item.addEventListener('click', (e) => {
                    e.stopPropagation();
                    const c = (item as HTMLElement).dataset.curr;
                    if (c && c !== 'SHOW MORE') {
                        this.opts.setSelectedCurrency(c === 'Same as chart' ? 'SAME' : c);
                        this.opts.onRecalculateCapital();
                        this.closeAnyDropdown();
                    }
                });
            });
        }, 270);
    }

    public updateCapitalPillLabel(): void {
        const amount = this.opts.getCustomCapitalAmount();
        const curr = this.opts.getSelectedCurrency();
        const k = amount >= 1000
            ? `${(amount / 1000).toLocaleString('en-US', { maximumFractionDigits: 1 })} K`
            : `${amount.toLocaleString('en-US')}`;
        const currStr = curr === 'SAME' ? 'Same as chart' : curr;
        const pillText = this.opts.rootEl.querySelector('.vst-capital-filter .vst-capital-text');
        if (pillText) {
            pillText.textContent = `${k} ${currStr}`;
        }
    }

    public showBarDetalizationDropdown(anchorBtn: HTMLElement): void {
        if (anchorBtn.classList.contains('is-active')) {
            this.closeAnyDropdown();
            return;
        }

        const options = [
            { key: 'default', label: 'Default detalization', hint: '4 ticks per bar' },
            { key: 'high', label: 'High detalization', hint: '~96 ticks per bar' },
        ];

        this.openDropdown(anchorBtn, (panel) => {
            const currentDet = this.opts.getSelectedBarDetalization();
            let html = `
                <div class="vst-drop-header">
                    <div class="vst-drop-header-left">
                        <span>Bar detalization</span>
                        <span class="vst-help-circle" title="Calculates intra-bar ticks">?</span>
                    </div>
                </div>
                <div class="vst-drop-divider"></div>
            `;

            for (const opt of options) {
                const isSel = currentDet === opt.key;
                html += `
                    <div class="vst-drop-item ${isSel ? 'is-selected' : ''}" data-key="${opt.key}">
                        <span>${opt.label}</span>
                        <span class="vst-drop-hint">${opt.hint}</span>
                    </div>
                `;
            }

            panel.innerHTML = html;

            panel.querySelectorAll('.vst-drop-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const key = (item as HTMLElement).dataset.key;
                    if (key) {
                        this.opts.setSelectedBarDetalization(key);
                        const labelEl = this.opts.rootEl.querySelector('.vst-detail-filter span:not(.vst-chevron)');
                        if (labelEl) {
                            labelEl.textContent = key === 'high' ? 'High detalization' : 'Default detalization';
                        }
                    }
                    this.closeAnyDropdown();
                });
            });
        }, 280);
    }

    public showScriptExecutionDropdown(anchorBtn: HTMLElement): void {
        if (anchorBtn.classList.contains('is-active')) {
            this.closeAnyDropdown();
            return;
        }

        const modes = [
            { key: 'close', label: 'On bar close', desc: 'Calculate on completed historical bars' },
            { key: 'fill', label: 'On order fill', desc: 'Calculate intra-bar on each fill' },
            { key: 'tick', label: 'On realtime bar tick', desc: 'Recalculate on every live tick' },
        ];

        this.openDropdown(anchorBtn, (panel) => {
            const currentModes = this.opts.getSelectedExecModes();
            let html = `
                <div class="vst-drop-header">
                    <div class="vst-drop-header-left">
                        <span>Script execution</span>
                        <span class="vst-help-circle" title="Controls calculation execution trigger points">?</span>
                    </div>
                    <button class="vst-drop-reset-btn ${currentModes.length !== 1 || !currentModes.includes('close') ? 'is-active' : ''}">Reset</button>
                </div>
                <div class="vst-drop-divider"></div>
            `;

            for (const m of modes) {
                const isChecked = currentModes.includes(m.key as 'close' | 'fill' | 'tick');
                html += `
                    <div class="vst-check-item ${isChecked ? 'is-checked' : ''}" data-key="${m.key}">
                        <div class="vst-checkbox">${isChecked ? '✓' : ''}</div>
                        <span>${m.label}</span>
                        <span class="vst-check-info" title="${m.desc}">
                            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="8" cy="8" r="6"/><path d="M8 7v4M8 4.8h.01"/></svg>
                        </span>
                    </div>
                `;
            }

            panel.innerHTML = html;

            panel.querySelector('.vst-drop-reset-btn')?.addEventListener('click', (e) => {
                e.stopPropagation();
                this.opts.setSelectedExecModes(['close']);
                this.updateExecBadge();
                panel.querySelectorAll('.vst-check-item').forEach((el) => {
                    const k = (el as HTMLElement).dataset.key as 'close' | 'fill' | 'tick';
                    const checked = k === 'close';
                    el.classList.toggle('is-checked', checked);
                    const box = el.querySelector('.vst-checkbox');
                    if (box) box.textContent = checked ? '✓' : '';
                });
                const resetBtn = panel.querySelector('.vst-drop-reset-btn');
                resetBtn?.classList.remove('is-active');
            });

            panel.querySelectorAll('.vst-check-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const key = (item as HTMLElement).dataset.key as 'close' | 'fill' | 'tick';
                    let updated = [...this.opts.getSelectedExecModes()];
                    if (updated.includes(key)) {
                        if (updated.length > 1) {
                            updated = updated.filter((k) => k !== key);
                        }
                    } else {
                        updated.push(key);
                    }
                    this.opts.setSelectedExecModes(updated);
                    const isChecked = updated.includes(key);
                    item.classList.toggle('is-checked', isChecked);
                    const box = item.querySelector('.vst-checkbox');
                    if (box) box.textContent = isChecked ? '✓' : '';
                    this.updateExecBadge();
                    const resetBtn = panel.querySelector('.vst-drop-reset-btn');
                    resetBtn?.classList.toggle('is-active', updated.length !== 1 || !updated.includes('close'));
                });
            });
        }, 260);
    }

    public updateExecBadge(): void {
        const badge = this.opts.rootEl.querySelector('.vst-exec-filter .vst-badge-circle');
        if (badge) {
            badge.textContent = String(this.opts.getSelectedExecModes().length);
        }
    }

    public showScaleSettingsDropdown(anchorBtn: HTMLElement): void {
        if (anchorBtn.classList.contains('is-active')) {
            this.closeAnyDropdown();
            return;
        }

        this.openDropdown(anchorBtn, (panel) => {
            const currentMode = this.opts.getScaleMode();
            const showWhitespaces = this.opts.getShowWhitespaces();

            panel.innerHTML = `
                <div style="font-size:11px;font-weight:700;color:#787b86;padding:4px 14px 6px;">SCALE</div>
                <div class="vst-drop-item ${currentMode === 'percent' ? 'is-selected' : ''}" data-mode="percent">
                    <span>Percent</span>
                </div>
                <div class="vst-drop-item ${currentMode === 'regular' ? 'is-selected' : ''}" data-mode="regular">
                    <span>Regular</span>
                </div>
                <div class="vst-drop-divider"></div>
                <div class="vst-switch-item" id="vst-whitespace-toggle">
                    <span>Whitespaces</span>
                    <div class="vst-switch-track ${showWhitespaces ? 'is-on' : ''}">
                        <div class="vst-switch-thumb"></div>
                    </div>
                </div>
            `;

            panel.querySelectorAll('.vst-drop-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const mode = (item as HTMLElement).dataset.mode as 'regular' | 'percent';
                    if (mode) {
                        this.opts.setScaleMode(mode);
                        this.opts.onScaleOrWhitespaceChange();
                    }
                    this.closeAnyDropdown();
                });
            });

            panel.querySelector('#vst-whitespace-toggle')?.addEventListener('click', () => {
                const nextVal = !this.opts.getShowWhitespaces();
                this.opts.setShowWhitespaces(nextVal);
                const track = panel.querySelector('.vst-switch-track');
                track?.classList.toggle('is-on', nextVal);
                this.opts.onScaleOrWhitespaceChange();
            });
        }, 180);
    }

    public showTradesColumnPickerDropdown(anchorBtn: HTMLElement): void {
        if (anchorBtn.classList.contains('is-active')) {
            this.closeAnyDropdown();
            return;
        }

        const cols: Array<{ key: TradesColumnKey; label: string }> = [
            { key: 'dateTime', label: 'Date and time' },
            { key: 'signal', label: 'Signal' },
            { key: 'price', label: 'Price' },
            { key: 'size', label: 'Size' },
            { key: 'netPnl', label: 'Net PnL' },
            { key: 'returnPct', label: 'Return' },
            { key: 'commission', label: 'Commission' },
            { key: 'favorableExcursion', label: 'Favorable excursion' },
            { key: 'adverseExcursion', label: 'Adverse excursion' },
            { key: 'cumPnl', label: 'Cumulative PnL' },
            { key: 'duration', label: 'Duration (bars)' },
        ];

        this.openDropdown(anchorBtn, (panel) => {
            const activeCols = this.opts.getActiveColumns();
            let html = '';
            for (const c of cols) {
                const isChecked = activeCols[c.key];
                html += `
                    <div class="vst-check-item ${isChecked ? 'is-checked' : ''}" data-key="${c.key}">
                        <div class="vst-checkbox">${isChecked ? '✓' : ''}</div>
                        <span>${c.label}</span>
                    </div>
                `;
            }
            panel.innerHTML = html;

            panel.querySelectorAll('.vst-check-item').forEach((item) => {
                item.addEventListener('click', () => {
                    const key = (item as HTMLElement).dataset.key as TradesColumnKey;
                    if (key) {
                        this.opts.onColumnToggle(key);
                        const isChecked = this.opts.getActiveColumns()[key];
                        item.classList.toggle('is-checked', isChecked);
                        const box = item.querySelector('.vst-checkbox');
                        if (box) box.textContent = isChecked ? '✓' : '';
                    }
                });
            });
        }, 210);
    }
}
