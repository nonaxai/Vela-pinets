// Custom Timeframe Manager for Vela Playground
// Provides TradingView-style custom timeframe management:
// - Grouped interval catalog: Minutes, Hours, Days/Weeks/Months, Custom
// - Favorite (★) to add/remove quick chips on the topbar
// - Hide (👁) to hide/reveal timeframes
// - Delete (🗑) for custom timeframes
// - Add custom interval (number + unit: minutes, hours, days, weeks, months)
// - Persistent storage in localStorage

import type { VelaWorkspace } from '@luxalgo/vela/workspace';

interface TimeframeItem {
    id: string; // e.g. '1', '10', '60', '120', 'D', '3D', 'W', 'M'
    shortLabel: string; // e.g. '1m', '10m', '1h', '2h', '1D', '3D'
    fullLabel: string; // e.g. '1 minute', '10 minutes', '2 hours', '3 days'
    category: 'minutes' | 'hours' | 'days' | 'custom';
    isCustom: boolean;
}

const STORAGE_CUSTOM_KEY = 'vela_custom_timeframes';
const STORAGE_HIDDEN_KEY = 'vela_hidden_timeframes';

const STANDARD_TIMEFRAMES: Array<{ id: string; category: 'minutes' | 'hours' | 'days' }> = [
    { id: '1', category: 'minutes' },
    { id: '3', category: 'minutes' },
    { id: '5', category: 'minutes' },
    { id: '15', category: 'minutes' },
    { id: '30', category: 'minutes' },
    { id: '45', category: 'minutes' },
    { id: '60', category: 'hours' },
    { id: '120', category: 'hours' },
    { id: '180', category: 'hours' },
    { id: '240', category: 'hours' },
    { id: 'D', category: 'days' },
    { id: 'W', category: 'days' },
    { id: 'M', category: 'days' },
];

export function parseTfDetails(id: string, isCustom = false): TimeframeItem {
    let shortLabel = id;
    let fullLabel = id;
    let category: 'minutes' | 'hours' | 'days' | 'custom' = isCustom ? 'custom' : 'minutes';

    if (/^\d+$/.test(id)) {
        const mins = parseInt(id, 10);
        if (mins < 60) {
            shortLabel = `${mins}m`;
            fullLabel = `${mins} minute${mins > 1 ? 's' : ''}`;
            if (!isCustom) category = 'minutes';
        } else if (mins % 60 === 0) {
            const h = mins / 60;
            shortLabel = `${h}h`;
            fullLabel = `${h} hour${h > 1 ? 's' : ''}`;
            if (!isCustom) category = 'hours';
        } else {
            shortLabel = `${mins}m`;
            fullLabel = `${mins} minutes`;
            if (!isCustom) category = 'minutes';
        }
    } else if (id === 'D' || /^\d+D$/i.test(id)) {
        const d = id === 'D' ? 1 : parseInt(id, 10) || 1;
        shortLabel = `${d}D`;
        fullLabel = `${d} day${d > 1 ? 's' : ''}`;
        if (!isCustom) category = 'days';
    } else if (id === 'W' || /^\d+W$/i.test(id)) {
        const w = id === 'W' ? 1 : parseInt(id, 10) || 1;
        shortLabel = `${w}W`;
        fullLabel = `${w} week${w > 1 ? 's' : ''}`;
        if (!isCustom) category = 'days';
    } else if (id === 'M' || /^\d+M$/i.test(id)) {
        const m = id === 'M' ? 1 : parseInt(id, 10) || 1;
        shortLabel = `${m}M`;
        fullLabel = `${m} month${m > 1 ? 's' : ''}`;
        if (!isCustom) category = 'days';
    }

    return { id, shortLabel, fullLabel, category, isCustom };
}

export class CustomTimeframeManager {
    private workspace: VelaWorkspace;
    private customTimeframes: string[] = [];
    private hiddenTimeframes: Set<string> = new Set();
    private dropdownEl: HTMLElement | null = null;
    private showHidden = false;

    constructor(workspace: VelaWorkspace) {
        this.workspace = workspace;
        this.loadStorage();
        this.injectStyles();
        this.bindTrigger();
    }

    private loadStorage(): void {
        try {
            const rawCustom = localStorage.getItem(STORAGE_CUSTOM_KEY);
            if (rawCustom) {
                const parsed = JSON.parse(rawCustom) as unknown;
                if (Array.isArray(parsed)) {
                    this.customTimeframes = parsed.filter((x): x is string => typeof x === 'string');
                }
            }
        } catch {
            this.customTimeframes = [];
        }

        try {
            const rawHidden = localStorage.getItem(STORAGE_HIDDEN_KEY);
            if (rawHidden) {
                const parsed = JSON.parse(rawHidden) as unknown;
                if (Array.isArray(parsed)) {
                    this.hiddenTimeframes = new Set(parsed.filter((x): x is string => typeof x === 'string'));
                }
            }
        } catch {
            this.hiddenTimeframes = new Set();
        }
    }

    private saveCustom(): void {
        try {
            localStorage.setItem(STORAGE_CUSTOM_KEY, JSON.stringify(this.customTimeframes));
        } catch {}
    }

    private saveHidden(): void {
        try {
            localStorage.setItem(STORAGE_HIDDEN_KEY, JSON.stringify([...this.hiddenTimeframes]));
        } catch {}
    }

    public getCustomTimeframes(): string[] {
        return [...this.customTimeframes];
    }

    public addCustomTimeframe(count: number, unit: 'm' | 'h' | 'd' | 'w' | 'M'): string | null {
        if (!count || count <= 0) return null;
        let id = '';
        if (unit === 'm') {
            id = `${count}`;
        } else if (unit === 'h') {
            id = `${count * 60}`;
        } else if (unit === 'd') {
            id = count === 1 ? 'D' : `${count}D`;
        } else if (unit === 'w') {
            id = count === 1 ? 'W' : `${count}W`;
        } else if (unit === 'M') {
            id = count === 1 ? 'M' : `${count}M`;
        }

        if (!id) return null;

        // Check if already in standard or custom
        if (!this.customTimeframes.includes(id)) {
            this.customTimeframes.push(id);
            this.saveCustom();
        }

        // Unhide if was hidden
        if (this.hiddenTimeframes.has(id)) {
            this.hiddenTimeframes.delete(id);
            this.saveHidden();
        }

        return id;
    }

    public deleteCustomTimeframe(id: string): void {
        this.customTimeframes = this.customTimeframes.filter((tf) => tf !== id);
        this.saveCustom();
        this.hiddenTimeframes.delete(id);
        this.saveHidden();

        // Also remove from favorites if favorited
        this.setFavorite(id, false);
    }

    public toggleHidden(id: string): boolean {
        let isNowHidden = false;
        if (this.hiddenTimeframes.has(id)) {
            this.hiddenTimeframes.delete(id);
            isNowHidden = false;
        } else {
            this.hiddenTimeframes.add(id);
            isNowHidden = true;
        }
        this.saveHidden();
        return isNowHidden;
    }

    public isHidden(id: string): boolean {
        return this.hiddenTimeframes.has(id);
    }

    public isFavorite(id: string): boolean {
        const ws = this.workspace as unknown as { tfFavs?: string[] };
        return Array.isArray(ws.tfFavs) && ws.tfFavs.includes(id);
    }

    public setFavorite(id: string, on: boolean): void {
        const ws = this.workspace as unknown as {
            setTimeframeFavorite?: (tf: string, on: boolean) => void;
            topbar?: { setTimeframeFavorites?: (favs: string[]) => void };
            tfFavs?: string[];
        };

        if (typeof ws.setTimeframeFavorite === 'function') {
            ws.setTimeframeFavorite(id, on);
        } else if (Array.isArray(ws.tfFavs)) {
            if (on && !ws.tfFavs.includes(id)) {
                ws.tfFavs = [id, ...ws.tfFavs];
            } else if (!on) {
                ws.tfFavs = ws.tfFavs.filter((f) => f !== id);
            }
            ws.topbar?.setTimeframeFavorites?.(ws.tfFavs);
        }
    }

    public applyTimeframe(id: string): void {
        const ws = this.workspace as unknown as {
            setActiveTimeframe?: (tf: string) => void;
            active?: { setTimeframe?: (tf: string) => void };
        };

        if (typeof ws.setActiveTimeframe === 'function') {
            ws.setActiveTimeframe(id);
        } else if (ws.active?.setTimeframe) {
            ws.active.setTimeframe(id);
        }
    }

    public getActiveTimeframe(): string {
        const ws = this.workspace as unknown as { active?: { state?: { timeframe?: string } } };
        return ws.active?.state?.timeframe ?? '60';
    }

    private injectStyles(): void {
        if (document.getElementById('vela-custom-tf-styles')) return;
        const style = document.createElement('style');
        style.id = 'vela-custom-tf-styles';
        style.textContent = `
            .vtf-dropdown {
                position: absolute;
                z-index: 10000;
                background: #1e222d;
                border: 1px solid #363c4e;
                border-radius: 6px;
                box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
                width: 250px;
                max-height: 480px;
                display: flex;
                flex-direction: column;
                font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif;
                font-size: 13px;
                color: #d1d4dc;
                overflow: hidden;
                user-select: none;
                animation: vtf-pop 100ms ease-out;
            }
            @keyframes vtf-pop {
                from { opacity: 0; transform: translateY(-4px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .vtf-list {
                flex: 1 1 auto;
                overflow-y: auto;
                padding: 6px 0;
                min-height: 0;
            }
            .vtf-list::-webkit-scrollbar {
                width: 5px;
            }
            .vtf-list::-webkit-scrollbar-thumb {
                background: #363a45;
                border-radius: 3px;
            }
            .vtf-section-title {
                padding: 6px 14px 4px 14px;
                font-size: 10px;
                font-weight: 700;
                text-transform: uppercase;
                letter-spacing: 0.8px;
                color: #787b86;
            }
            .vtf-row {
                display: flex;
                align-items: center;
                padding: 6px 12px;
                cursor: pointer;
                transition: background 100ms ease;
                gap: 8px;
                color: #d1d4dc;
            }
            .vtf-row:hover {
                background: #2a2e39;
                color: #f0f3fa;
            }
            .vtf-row.is-active {
                background: rgba(41, 98, 255, 0.12);
                color: #2962ff;
                font-weight: 600;
            }
            .vtf-row.is-hidden-row {
                opacity: 0.45;
            }
            .vtf-check {
                width: 14px;
                height: 14px;
                display: flex;
                align-items: center;
                justify-content: center;
                flex-shrink: 0;
                color: #2962ff;
            }
            .vtf-label {
                flex: 1;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }
            .vtf-actions {
                display: flex;
                align-items: center;
                gap: 4px;
                flex-shrink: 0;
            }
            .vtf-btn-action {
                all: unset;
                display: flex;
                align-items: center;
                justify-content: center;
                width: 22px;
                height: 22px;
                border-radius: 3px;
                cursor: pointer;
                color: #787b86;
                transition: color 120ms ease, background 120ms ease;
            }
            .vtf-btn-action:hover {
                color: #d1d4dc;
                background: rgba(255, 255, 255, 0.08);
            }
            .vtf-btn-action.is-fav {
                color: #f5a623;
            }
            .vtf-btn-action.is-del:hover {
                color: #f23645;
            }
            .vtf-separator {
                height: 1px;
                background: #2a2e39;
                margin: 4px 0;
            }
            .vtf-footer {
                border-top: 1px solid #2a2e39;
                padding: 10px 12px;
                background: #131722;
                flex-shrink: 0;
            }
            .vtf-add-title {
                font-size: 10px;
                font-weight: 700;
                color: #787b86;
                margin-bottom: 6px;
                text-transform: uppercase;
                letter-spacing: 0.8px;
            }
            .vtf-add-form {
                display: flex;
                align-items: center;
                gap: 6px;
            }
            .vtf-input-num {
                width: 48px;
                background: #1e222d;
                border: 1px solid #2a2e39;
                border-radius: 4px;
                color: #f0f3fa;
                font-size: 12px;
                padding: 4px 6px;
                outline: none;
            }
            .vtf-input-num:focus {
                border-color: #2962ff;
            }
            .vtf-select-unit {
                flex: 1;
                background: #1e222d;
                border: 1px solid #2a2e39;
                border-radius: 4px;
                color: #f0f3fa;
                font-size: 12px;
                padding: 4px 6px;
                outline: none;
            }
            .vtf-btn-add {
                all: unset;
                background: #2962ff;
                color: #ffffff;
                font-size: 12px;
                font-weight: 500;
                padding: 4px 10px;
                border-radius: 4px;
                cursor: pointer;
                transition: background 120ms ease;
                white-space: nowrap;
            }
            .vtf-btn-add:hover {
                background: #1e53e5;
            }
            .vtf-show-hidden-toggle {
                all: unset;
                display: block;
                width: 100%;
                text-align: center;
                font-size: 11px;
                color: #787b86;
                cursor: pointer;
                padding: 6px 0;
                background: #131722;
                border-top: 1px solid #2a2e39;
                transition: color 120ms ease;
            }
            .vtf-show-hidden-toggle:hover {
                color: #d1d4dc;
            }
        `;
        document.head.appendChild(style);
    }

    private bindTrigger(): void {
        const findAndBind = (): boolean => {
            const caret = document.querySelector<HTMLElement>('.vela-widget-tf-caret');
            if (!caret) return false;

            // Capture clicks to show our custom menu instead of the default compact menu
            caret.addEventListener(
                'pointerdown',
                (e) => {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                    this.toggleDropdown(caret);
                },
                true,
            );
            caret.addEventListener(
                'click',
                (e) => {
                    e.stopImmediatePropagation();
                    e.preventDefault();
                },
                true,
            );

            return true;
        };

        if (!findAndBind()) {
            const interval = setInterval(() => {
                if (findAndBind()) clearInterval(interval);
            }, 200);
            setTimeout(() => clearInterval(interval), 5000);
        }
    }

    public toggleDropdown(anchor: HTMLElement): void {
        if (this.dropdownEl) {
            this.closeDropdown();
        } else {
            this.openDropdown(anchor);
        }
    }

    public openDropdown(anchor: HTMLElement): void {
        this.closeDropdown();
        this.dropdownEl = document.createElement('div');
        this.dropdownEl.className = 'vtf-dropdown';
        this.renderDropdownContent();

        document.body.appendChild(this.dropdownEl);

        // Position dropdown right under anchor
        const rect = anchor.getBoundingClientRect();
        this.dropdownEl.style.top = `${rect.bottom + 4}px`;
        this.dropdownEl.style.left = `${Math.max(10, Math.min(window.innerWidth - 260, rect.left))}px`;

        // Close on interact outside
        const onOutsideClick = (e: MouseEvent) => {
            if (this.dropdownEl && !this.dropdownEl.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
                this.closeDropdown();
                document.removeEventListener('pointerdown', onOutsideClick, true);
            }
        };
        setTimeout(() => document.addEventListener('pointerdown', onOutsideClick, true), 10);

        // Close on Esc
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                this.closeDropdown();
                document.removeEventListener('keydown', onKey);
            }
        };
        document.addEventListener('keydown', onKey);
    }

    public closeDropdown(): void {
        if (this.dropdownEl) {
            this.dropdownEl.remove();
            this.dropdownEl = null;
        }
    }

    private renderDropdownContent(): void {
        if (!this.dropdownEl) return;

        const activeTf = this.getActiveTimeframe();

        // 1. Minutes group
        const minItems = STANDARD_TIMEFRAMES.filter((t) => t.category === 'minutes').map((t) => parseTfDetails(t.id));

        // 2. Hours group
        const hourItems = STANDARD_TIMEFRAMES.filter((t) => t.category === 'hours').map((t) => parseTfDetails(t.id));

        // 3. Days group
        const dayItems = STANDARD_TIMEFRAMES.filter((t) => t.category === 'days').map((t) => parseTfDetails(t.id));

        // 4. Custom group
        const customItems = this.customTimeframes.map((id) => parseTfDetails(id, true));

        const renderGroup = (title: string, items: TimeframeItem[]): string => {
            const visibleItems = items.filter((item) => this.showHidden || !this.isHidden(item.id));
            if (visibleItems.length === 0) return '';

            let html = `<div class="vtf-section-title">${title}</div>`;
            for (const item of visibleItems) {
                const isActive = item.id === activeTf;
                const isFav = this.isFavorite(item.id);
                const isHidden = this.isHidden(item.id);

                html += `
                    <div class="vtf-row ${isActive ? 'is-active' : ''} ${isHidden ? 'is-hidden-row' : ''}" data-tf="${item.id}">
                        <span class="vtf-check">
                            ${isActive ? '<svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 8.5l3.5 3.5 6.5-7"/></svg>' : ''}
                        </span>
                        <span class="vtf-label">${item.fullLabel}</span>
                        <div class="vtf-actions">
                            <button class="vtf-btn-action ${isFav ? 'is-fav' : ''}" data-action="fav" data-tf="${item.id}" title="${isFav ? 'Remove from favorites' : 'Add to favorites'}">
                                <svg viewBox="0 0 16 16" width="13" height="13" fill="${isFav ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.3">
                                    <path d="M8 1.5l1.8 4.2 4.5.4-3.4 3 1 4.4L8 11.2 4.1 13.5l1-4.4-3.4-3 4.5-.4z"/>
                                </svg>
                            </button>
                            <button class="vtf-btn-action" data-action="hide" data-tf="${item.id}" title="${isHidden ? 'Show timeframe' : 'Hide timeframe'}">
                                ${
                                    isHidden
                                        ? '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5-6.5-4.5-6.5-4.5z"/><line x1="2" y1="2" x2="14" y2="14"/></svg>'
                                        : '<svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" stroke-width="1.3"><path d="M1.5 8s2.5-4.5 6.5-4.5 6.5 4.5 6.5 4.5-2.5 4.5-6.5 4.5-6.5-4.5-6.5-4.5z"/><circle cx="8" cy="8" r="2"/></svg>'
                                }
                            </button>
                            ${
                                item.isCustom
                                    ? `<button class="vtf-btn-action is-del" data-action="del" data-tf="${item.id}" title="Delete custom interval">
                                        <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.3">
                                            <path d="M3 4.5h10M6 4.5V3h4v1.5M5 6v7h6V6"/>
                                        </svg>
                                    </button>`
                                    : ''
                            }
                        </div>
                    </div>
                `;
            }
            return html;
        };

        const hiddenCount = this.hiddenTimeframes.size;

        this.dropdownEl.innerHTML = `
            <div class="vtf-list">
                ${renderGroup('Minutes', minItems)}
                ${renderGroup('Hours', hourItems)}
                ${renderGroup('Days / Weeks / Months', dayItems)}
                ${renderGroup('Custom intervals', customItems)}
            </div>
            ${
                hiddenCount > 0
                    ? `<button class="vtf-show-hidden-toggle" id="vtf-toggle-hidden">
                        ${this.showHidden ? `Hide hidden (${hiddenCount})` : `Show hidden (${hiddenCount})`}
                    </button>`
                    : ''
            }
            <div class="vtf-footer">
                <div class="vtf-add-title">Add custom interval</div>
                <div class="vtf-add-form">
                    <input type="number" class="vtf-input-num" id="vtf-input-num" min="1" max="1440" value="10" />
                    <select class="vtf-select-unit" id="vtf-select-unit">
                        <option value="m">Minute(s)</option>
                        <option value="h">Hour(s)</option>
                        <option value="d">Day(s)</option>
                        <option value="w">Week(s)</option>
                        <option value="M">Month(s)</option>
                    </select>
                    <button class="vtf-btn-add" id="vtf-btn-add">+ Add</button>
                </div>
            </div>
        `;

        // Row clicks -> select timeframe
        this.dropdownEl.querySelectorAll<HTMLElement>('.vtf-row').forEach((row) => {
            row.addEventListener('click', (e) => {
                const target = e.target as HTMLElement;
                if (target.closest('.vtf-btn-action')) return;
                const tf = row.dataset.tf;
                if (tf) {
                    this.applyTimeframe(tf);
                    this.closeDropdown();
                }
            });
        });

        // Favorite toggle
        this.dropdownEl.querySelectorAll<HTMLElement>('.vtf-btn-action[data-action="fav"]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tf = btn.dataset.tf;
                if (tf) {
                    const nextFav = !this.isFavorite(tf);
                    this.setFavorite(tf, nextFav);
                    this.renderDropdownContent();
                }
            });
        });

        // Hide toggle
        this.dropdownEl.querySelectorAll<HTMLElement>('.vtf-btn-action[data-action="hide"]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tf = btn.dataset.tf;
                if (tf) {
                    this.toggleHidden(tf);
                    this.renderDropdownContent();
                }
            });
        });

        // Delete custom timeframe
        this.dropdownEl.querySelectorAll<HTMLElement>('.vtf-btn-action[data-action="del"]').forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const tf = btn.dataset.tf;
                if (tf) {
                    this.deleteCustomTimeframe(tf);
                    this.renderDropdownContent();
                }
            });
        });

        // Show/hide hidden rows toggle
        const toggleHiddenBtn = this.dropdownEl.querySelector('#vtf-toggle-hidden');
        if (toggleHiddenBtn) {
            toggleHiddenBtn.addEventListener('click', () => {
                this.showHidden = !this.showHidden;
                this.renderDropdownContent();
            });
        }

        // Add custom interval button
        const addBtn = this.dropdownEl.querySelector('#vtf-btn-add');
        const numInput = this.dropdownEl.querySelector<HTMLInputElement>('#vtf-input-num');
        const unitSelect = this.dropdownEl.querySelector<HTMLSelectElement>('#vtf-select-unit');

        const handleAdd = () => {
            if (!numInput || !unitSelect) return;
            const count = parseInt(numInput.value, 10);
            const unit = unitSelect.value as 'm' | 'h' | 'd' | 'w' | 'M';
            if (count > 0) {
                const addedId = this.addCustomTimeframe(count, unit);
                if (addedId) {
                    this.applyTimeframe(addedId);
                    this.renderDropdownContent();
                }
            }
        };

        addBtn?.addEventListener('click', handleAdd);
        numInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAdd();
        });
    }
}
