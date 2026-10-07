import type { WidgetContext, SidePanelHeader, SidePanelHandle } from '@luxalgo/vela/plugin';

export interface WatchlistItem {
    ticker: string;
    displayTicker: string;
    desc: string;
    category: 'COMMODITY' | 'CRYPTO' | 'FOREX' | 'FUTURES';
    lastPrice: number;
    change: number;
    changePct: number;
    precision: number;
    exchange: string;
}

const DEFAULT_WATCHLIST: WatchlistItem[] = [
    // COMMODITY
    {
        ticker: 'BINANCE:PAXGUSDT',
        displayTicker: 'PAXGUSDT',
        desc: 'PAX Gold / Tether',
        category: 'COMMODITY',
        lastPrice: 2654.10,
        change: 14.20,
        changePct: 0.54,
        precision: 2,
        exchange: 'Binance',
    },
    {
        ticker: 'OIL',
        displayTicker: 'OIL',
        desc: 'Crude Oil',
        category: 'COMMODITY',
        lastPrice: 74.85,
        change: -0.42,
        changePct: -0.56,
        precision: 2,
        exchange: 'TVC',
    },
    // CRYPTO
    {
        ticker: 'BINANCE:BTCUSDT',
        displayTicker: 'BTCUSDT',
        desc: 'Bitcoin / TetherUS',
        category: 'CRYPTO',
        lastPrice: 67842.10,
        change: 1420.50,
        changePct: 2.14,
        precision: 2,
        exchange: 'Binance',
    },
    {
        ticker: 'BINANCE:ETHUSDT',
        displayTicker: 'ETHUSDT',
        desc: 'Ethereum / TetherUS',
        category: 'CRYPTO',
        lastPrice: 2642.80,
        change: 58.30,
        changePct: 2.26,
        precision: 2,
        exchange: 'Binance',
    },
    {
        ticker: 'BINANCE:SOLUSDT',
        displayTicker: 'SOLUSDT',
        desc: 'Solana / TetherUS',
        category: 'CRYPTO',
        lastPrice: 174.25,
        change: 6.10,
        changePct: 3.63,
        precision: 2,
        exchange: 'Binance',
    },
    {
        ticker: 'BINANCE:BNBUSDT',
        displayTicker: 'BNBUSDT',
        desc: 'BNB / TetherUS',
        category: 'CRYPTO',
        lastPrice: 592.40,
        change: -3.10,
        changePct: -0.52,
        precision: 2,
        exchange: 'Binance',
    },
    {
        ticker: 'BINANCE:XRPUSDT',
        displayTicker: 'XRPUSDT',
        desc: 'XRP / TetherUS',
        category: 'CRYPTO',
        lastPrice: 0.5482,
        change: 0.0124,
        changePct: 2.31,
        precision: 4,
        exchange: 'Binance',
    },
    {
        ticker: 'BINANCE:DOGEUSDT',
        displayTicker: 'DOGEUSDT',
        desc: 'Dogecoin / TetherUS',
        category: 'CRYPTO',
        lastPrice: 0.1425,
        change: 0.0055,
        changePct: 4.01,
        precision: 4,
        exchange: 'Binance',
    },
    // FOREX
    {
        ticker: 'EURUSD',
        displayTicker: 'EURUSD',
        desc: 'Euro / US Dollar',
        category: 'FOREX',
        lastPrice: 1.0862,
        change: -0.0014,
        changePct: -0.13,
        precision: 4,
        exchange: 'FX',
    },
    {
        ticker: 'GBPUSD',
        displayTicker: 'GBPUSD',
        desc: 'British Pound / US Dollar',
        category: 'FOREX',
        lastPrice: 1.2985,
        change: 0.0022,
        changePct: 0.17,
        precision: 4,
        exchange: 'FX',
    },
    {
        ticker: 'USDJPY',
        displayTicker: 'USDJPY',
        desc: 'US Dollar / Japanese Yen',
        category: 'FOREX',
        lastPrice: 152.45,
        change: 0.35,
        changePct: 0.23,
        precision: 2,
        exchange: 'FX',
    },
    {
        ticker: 'AUDUSD',
        displayTicker: 'AUDUSD',
        desc: 'Australian Dollar / US Dollar',
        category: 'FOREX',
        lastPrice: 0.6580,
        change: -0.0018,
        changePct: -0.27,
        precision: 4,
        exchange: 'FX',
    },
    // FUTURES
    {
        ticker: 'ES1!',
        displayTicker: 'ES1!',
        desc: 'S&P 500 E-Mini Futures',
        category: 'FUTURES',
        lastPrice: 5864.25,
        change: 22.50,
        changePct: 0.39,
        precision: 2,
        exchange: 'CME',
    },
    {
        ticker: 'NQ1!',
        displayTicker: 'NQ1!',
        desc: 'Nasdaq 100 E-Mini Futures',
        category: 'FUTURES',
        lastPrice: 20412.75,
        change: 115.00,
        changePct: 0.57,
        precision: 2,
        exchange: 'CME',
    },
];

const CSS = `
.vela-watchlist-panel {
    display: flex;
    flex-direction: column;
    height: 100%;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif;
    user-select: none;
    color: var(--vela-fg, #d1d4dc);
    background: var(--vela-bg, #131722);
}

.vela-watchlist-header-slot {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
}

.vela-watchlist-title-btn {
    all: unset;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 14px;
    font-weight: 700;
    color: var(--vela-fg-bright, #f0f3fa);
    padding: 2px 4px;
    border-radius: 4px;
    transition: background var(--vela-dur-fast, 120ms) ease;
}
.vela-watchlist-title-btn:hover {
    background: var(--vela-hover, rgba(255, 255, 255, 0.06));
}

.vela-watchlist-header-tools {
    display: flex;
    align-items: center;
    gap: 4px;
}

.vela-watchlist-tool-btn {
    all: unset;
    cursor: pointer;
    width: 26px;
    height: 26px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    color: var(--vela-fg-muted, #787b86);
    transition: color 120ms ease, background 120ms ease;
}
.vela-watchlist-tool-btn:hover {
    color: var(--vela-fg-bright, #f0f3fa);
    background: var(--vela-hover, rgba(255, 255, 255, 0.08));
}

.vela-watchlist-table-header {
    display: grid;
    grid-template-columns: 1fr 64px 54px 54px;
    padding: 6px 12px;
    font-size: 11px;
    font-weight: 600;
    color: var(--vela-fg-muted, #787b86);
    border-bottom: 1px solid var(--vela-border, #2a2e39);
    letter-spacing: 0.3px;
}

.vela-watchlist-th-right {
    text-align: right;
}

.vela-watchlist-list {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
}
.vela-watchlist-list::-webkit-scrollbar {
    width: 6px;
}
.vela-watchlist-list::-webkit-scrollbar-thumb {
    background: var(--vela-scroll, #2a2e39);
    border-radius: 3px;
}

.vela-watchlist-category {
    display: flex;
    align-items: center;
    padding: 8px 12px 6px;
    font-size: 11px;
    font-weight: 700;
    color: var(--vela-fg-muted, #787b86);
    cursor: pointer;
    letter-spacing: 0.6px;
    text-transform: uppercase;
}
.vela-watchlist-category:hover {
    color: var(--vela-fg-bright, #f0f3fa);
}
.vela-watchlist-category-chevron {
    display: inline-flex;
    margin-right: 6px;
    transition: transform 150ms ease;
}
.vela-watchlist-category.is-collapsed .vela-watchlist-category-chevron {
    transform: rotate(-90deg);
}

.vela-watchlist-row {
    display: grid;
    grid-template-columns: 1fr 64px 54px 54px;
    align-items: center;
    padding: 6px 12px;
    cursor: pointer;
    font-size: 12px;
    border-left: 2px solid transparent;
    transition: background 100ms ease;
    position: relative;
}
.vela-watchlist-row:hover {
    background: var(--vela-hover, rgba(255, 255, 255, 0.05));
}
.vela-watchlist-row.is-active {
    background: rgba(41, 98, 255, 0.12);
    border-left-color: #2962ff;
}

.vela-watchlist-sym-col {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
}

.vela-watchlist-badge {
    width: 18px;
    height: 18px;
    border-radius: 50%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: 700;
    flex-shrink: 0;
    color: #fff;
}
.badge-commodity { background: #f5a623; }
.badge-crypto { background: #f7931a; }
.badge-forex { background: #2962ff; }
.badge-futures { background: #9c27b0; }

.vela-watchlist-sym-meta {
    display: flex;
    flex-direction: column;
    min-width: 0;
}
.vela-watchlist-sym-ticker {
    font-weight: 600;
    color: var(--vela-fg-bright, #f0f3fa);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.vela-watchlist-sym-desc {
    font-size: 10px;
    color: var(--vela-fg-muted, #787b86);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.vela-watchlist-val {
    text-align: right;
    font-variant-numeric: tabular-nums;
    font-size: 12px;
    white-space: nowrap;
}
.vela-watchlist-last {
    color: var(--vela-fg-bright, #f0f3fa);
    font-weight: 500;
}
.vela-watchlist-up {
    color: #089981;
}
.vela-watchlist-down {
    color: #f23645;
}

.vela-watchlist-del-btn {
    display: none;
    position: absolute;
    right: 4px;
    top: 50%;
    transform: translateY(-50%);
    background: var(--vela-surface-elev, #1e222d);
    border: none;
    border-radius: 3px;
    padding: 2px 4px;
    color: var(--vela-fg-muted, #787b86);
    cursor: pointer;
    font-size: 10px;
}
.vela-watchlist-row:hover .vela-watchlist-del-btn {
    display: inline-flex;
}
.vela-watchlist-del-btn:hover {
    color: #f23645;
}

.vela-watchlist-menu {
    position: absolute;
    background: var(--vela-surface-elev, #1e222d);
    border: 1px solid var(--vela-border, #2a2e39);
    border-radius: 6px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    z-index: 100;
    min-width: 170px;
    padding: 4px 0;
    font-size: 12px;
}
.vela-watchlist-menu-item {
    padding: 6px 12px;
    cursor: pointer;
    color: var(--vela-fg, #d1d4dc);
    display: flex;
    align-items: center;
    justify-content: space-between;
}
.vela-watchlist-menu-item:hover {
    background: var(--vela-hover, rgba(255, 255, 255, 0.08));
    color: var(--vela-fg-bright, #f0f3fa);
}
.vela-watchlist-menu-sep {
    height: 1px;
    background: var(--vela-border, #2a2e39);
    margin: 4px 0;
}
`;

function formatPrice(val: number, precision: number): string {
    return val.toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    });
}

function formatChange(val: number, precision: number): string {
    const s = Math.abs(val).toLocaleString('en-US', {
        minimumFractionDigits: precision,
        maximumFractionDigits: precision,
    });
    return (val >= 0 ? '+' : '-') + s;
}

function formatPct(val: number): string {
    const s = Math.abs(val).toFixed(2);
    return (val >= 0 ? '+' : '-') + s + '%';
}

export function mountWatchlistPanel(
    ctx: WidgetContext,
    body: HTMLElement,
    header: SidePanelHeader
): SidePanelHandle {
    // Inject local styles
    const doc = body.ownerDocument;
    const styleTag = doc.createElement('style');
    styleTag.textContent = CSS;
    body.appendChild(styleTag);

    // Load persisted or default watchlist
    const STORAGE_KEY = 'vela-pinets.watchlist';
    let items: WatchlistItem[] = [...DEFAULT_WATCHLIST];
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            const parsed = JSON.parse(stored) as unknown;
            if (Array.isArray(parsed) && parsed.length > 0) items = parsed as WatchlistItem[];
        }
    } catch {
        // use default
    }

    const saveItems = (): void => {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
        } catch {
            // ignore
        }
    };

    const collapsedCategories = new Set<string>();

    // ── Setup Header Slot ──
    header.setTitle(''); // Clear default text to replace with our custom title button
    header.slot.replaceChildren();

    const headerSlotContainer = doc.createElement('div');
    headerSlotContainer.className = 'vela-watchlist-header-slot';

    const titleBtn = doc.createElement('button');
    titleBtn.className = 'vela-watchlist-title-btn';
    titleBtn.innerHTML = `<span>Watchlist</span> <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2.5 3.5L5 6.5L7.5 3.5Z"/></svg>`;

    const toolsContainer = doc.createElement('div');
    toolsContainer.className = 'vela-watchlist-header-tools';

    // "+" Add symbol button
    const addBtn = doc.createElement('button');
    addBtn.className = 'vela-watchlist-tool-btn';
    addBtn.title = 'Add symbol';
    addBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 2v10M2 7h10"/></svg>`;
    addBtn.onclick = () => {
        ctx.openSymbolSearch();
    };

    // Table view icon button
    const viewBtn = doc.createElement('button');
    viewBtn.className = 'vela-watchlist-tool-btn';
    viewBtn.title = 'Table columns';
    viewBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1.5" y="2" width="11" height="10" rx="1.5"/><path d="M1.5 5.5h11M5.5 5.5v6.5M9.5 5.5v6.5"/></svg>`;

    // "..." More menu button
    const moreBtn = doc.createElement('button');
    moreBtn.className = 'vela-watchlist-tool-btn';
    moreBtn.title = 'More options';
    moreBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><circle cx="3" cy="7" r="1.2"/><circle cx="7" cy="7" r="1.2"/><circle cx="11" cy="7" r="1.2"/></svg>`;

    toolsContainer.append(addBtn, viewBtn, moreBtn);
    headerSlotContainer.append(titleBtn, toolsContainer);
    header.slot.appendChild(headerSlotContainer);

    // ── Build Main Panel DOM ──
    const panelRoot = doc.createElement('div');
    panelRoot.className = 'vela-watchlist-panel';

    // Table Column Header
    const tableHeader = doc.createElement('div');
    tableHeader.className = 'vela-watchlist-table-header';
    tableHeader.innerHTML = `
        <div>Symbol</div>
        <div class="vela-watchlist-th-right">Last</div>
        <div class="vela-watchlist-th-right">Chg</div>
        <div class="vela-watchlist-th-right">Chg%</div>
    `;

    // Scrolling List Container
    const listContainer = doc.createElement('div');
    listContainer.className = 'vela-watchlist-list';

    panelRoot.append(tableHeader, listContainer);
    body.appendChild(panelRoot);

    // Active symbol tracking
    const getActiveSymbol = (): string => {
        try {
            return ctx.symbol || '';
        } catch {
            return '';
        }
    };

    const isMatch = (itemTicker: string, curSymbol: string): boolean => {
        if (!curSymbol) return false;
        if (itemTicker === curSymbol) return true;
        const normItem = itemTicker.replace(/^BINANCE:|^COINBASE:|^HYPERLIQUID:/i, '');
        const normCur = curSymbol.replace(/^BINANCE:|^COINBASE:|^HYPERLIQUID:/i, '');
        return normItem === normCur;
    };

    // Render list
    const renderList = (): void => {
        listContainer.replaceChildren();
        const activeSym = getActiveSymbol();

        const categories: Array<'COMMODITY' | 'CRYPTO' | 'FOREX' | 'FUTURES'> = [
            'COMMODITY',
            'CRYPTO',
            'FOREX',
            'FUTURES',
        ];

        for (const cat of categories) {
            const catItems = items.filter((i) => i.category === cat);
            if (catItems.length === 0) continue;

            const isCollapsed = collapsedCategories.has(cat);

            // Category row
            const catEl = doc.createElement('div');
            catEl.className = 'vela-watchlist-category' + (isCollapsed ? ' is-collapsed' : '');
            catEl.innerHTML = `
                <span class="vela-watchlist-category-chevron">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><path d="M1.5 2.5L4 5.5L6.5 2.5Z"/></svg>
                </span>
                <span>${cat}</span>
            `;
            catEl.onclick = () => {
                if (isCollapsed) collapsedCategories.delete(cat);
                else collapsedCategories.add(cat);
                renderList();
            };
            listContainer.appendChild(catEl);

            if (!isCollapsed) {
                for (const item of catItems) {
                    const activeClass = isMatch(item.ticker, activeSym) ? ' is-active' : '';
                    const isUp = item.change >= 0;
                    const valClass = isUp ? 'vela-watchlist-up' : 'vela-watchlist-down';
                    const badgeClass =
                        cat === 'COMMODITY'
                            ? 'badge-commodity'
                            : cat === 'CRYPTO'
                            ? 'badge-crypto'
                            : cat === 'FOREX'
                            ? 'badge-forex'
                            : 'badge-futures';

                    const badgeChar = item.displayTicker.charAt(0);

                    const row = doc.createElement('div');
                    row.className = 'vela-watchlist-row' + activeClass;
                    row.innerHTML = `
                        <div class="vela-watchlist-sym-col">
                            <span class="vela-watchlist-badge ${badgeClass}">${badgeChar}</span>
                            <div class="vela-watchlist-sym-meta">
                                <span class="vela-watchlist-sym-ticker">${item.displayTicker}</span>
                                <span class="vela-watchlist-sym-desc">${item.desc}</span>
                            </div>
                        </div>
                        <div class="vela-watchlist-val vela-watchlist-last">${formatPrice(item.lastPrice, item.precision)}</div>
                        <div class="vela-watchlist-val ${valClass}">${formatChange(item.change, item.precision)}</div>
                        <div class="vela-watchlist-val ${valClass}">${formatPct(item.changePct)}</div>
                        <button class="vela-watchlist-del-btn" title="Remove">✕</button>
                    `;

                    row.onclick = (e) => {
                        if ((e.target as HTMLElement).closest('.vela-watchlist-del-btn')) return;
                        ctx.setSymbol(item.ticker);
                        renderList();
                    };

                    const delBtn = row.querySelector<HTMLButtonElement>('.vela-watchlist-del-btn');
                    if (delBtn) {
                        delBtn.onclick = (e) => {
                            e.stopPropagation();
                            items = items.filter((i) => i.ticker !== item.ticker);
                            saveItems();
                            renderList();
                        };
                    }

                    listContainer.appendChild(row);
                }
            }
        }
    };

    renderList();

    // ── Dropdown Menu for "..." More button ──
    let menuEl: HTMLElement | null = null;
    const closeMenu = (): void => {
        if (menuEl?.parentElement) {
            menuEl.parentElement.removeChild(menuEl);
            menuEl = null;
        }
    };

    moreBtn.onclick = (e) => {
        e.stopPropagation();
        if (menuEl) {
            closeMenu();
            return;
        }

        menuEl = doc.createElement('div');
        menuEl.className = 'vela-watchlist-menu';

        const sortSymbol = doc.createElement('div');
        sortSymbol.className = 'vela-watchlist-menu-item';
        sortSymbol.textContent = 'Sort by Symbol (A-Z)';
        sortSymbol.onclick = () => {
            items.sort((a, b) => a.displayTicker.localeCompare(b.displayTicker));
            saveItems();
            renderList();
            closeMenu();
        };

        const sortChgDesc = doc.createElement('div');
        sortChgDesc.className = 'vela-watchlist-menu-item';
        sortChgDesc.textContent = 'Sort by Change % (High to Low)';
        sortChgDesc.onclick = () => {
            items.sort((a, b) => b.changePct - a.changePct);
            saveItems();
            renderList();
            closeMenu();
        };

        const sortChgAsc = doc.createElement('div');
        sortChgAsc.className = 'vela-watchlist-menu-item';
        sortChgAsc.textContent = 'Sort by Change % (Low to High)';
        sortChgAsc.onclick = () => {
            items.sort((a, b) => a.changePct - b.changePct);
            saveItems();
            renderList();
            closeMenu();
        };

        const sep = doc.createElement('div');
        sep.className = 'vela-watchlist-menu-sep';

        const resetBtn = doc.createElement('div');
        resetBtn.className = 'vela-watchlist-menu-item';
        resetBtn.textContent = 'Reset to Defaults';
        resetBtn.onclick = () => {
            items = [...DEFAULT_WATCHLIST];
            saveItems();
            renderList();
            closeMenu();
        };

        menuEl.append(sortSymbol, sortChgDesc, sortChgAsc, sep, resetBtn);

        const rect = moreBtn.getBoundingClientRect();
        menuEl.style.top = `${rect.bottom + 4}px`;
        menuEl.style.right = `${doc.documentElement.clientWidth - rect.right}px`;
        doc.body.appendChild(menuEl);
    };

    const onDocClick = (e: MouseEvent): void => {
        if (menuEl && !menuEl.contains(e.target as Node) && !moreBtn.contains(e.target as Node)) {
            closeMenu();
        }
    };
    doc.addEventListener('click', onDocClick);

    // Periodically re-sync active symbol highlight if user switched symbols elsewhere
    const syncInterval = setInterval(() => {
        const curActive = getActiveSymbol();
        const activeRows = listContainer.querySelectorAll('.vela-watchlist-row.is-active');
        let needsReRender = false;
        if (activeRows.length === 0 && curActive) {
            needsReRender = true;
        } else if (activeRows.length > 0) {
            const firstRowTicker = activeRows[0]?.querySelector('.vela-watchlist-sym-ticker')?.textContent;
            if (firstRowTicker && !isMatch(firstRowTicker, curActive)) {
                needsReRender = true;
            }
        }
        if (needsReRender) {
            renderList();
        }
    }, 500);

    return {
        destroy() {
            clearInterval(syncInterval);
            doc.removeEventListener('click', onDocClick);
            closeMenu();
        },
    };
}
