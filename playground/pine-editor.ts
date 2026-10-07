import type { WidgetContext, SidePanelHeader } from '@luxalgo/vela/plugin';

export interface PineScriptItem {
    id: string; // filename, e.g. "EMA Golden Cross Strategy.pine"
    name: string; // "EMA Golden Cross Strategy"
    filename: string;
    content: string;
    isFavorite: boolean;
    updatedAt: number;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
    'EMA Golden Cross Strategy': `//@version=5
strategy("EMA Golden Cross Strategy", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

// Input parameter untuk panjang EMA
shortLength = input.int(50, title="Fast EMA Length")
longLength = input.int(200, title="Slow EMA Length")

// Hitung nilai EMA
shortEMA = ta.ema(close, shortLength)
longEMA = ta.ema(close, longLength)

// Kondisi Golden Cross (Beli) dan Death Cross (Jual)
longCondition = ta.crossover(shortEMA, longEMA)
shortCondition = ta.crossunder(shortEMA, longEMA)

// Eksekusi Order
if (longCondition)
    strategy.entry("Golden Cross BUY", strategy.long)

if (shortCondition)
    strategy.entry("Death Cross SELL", strategy.short)

// Plot garis EMA ke chart
plot(shortEMA, title="Fast EMA", color=color.blue, linewidth=2)
plot(longEMA, title="Slow EMA", color=color.orange, linewidth=2)
`,
    'EMA Ribbons': `//@version=5
indicator("EMA Ribbon", overlay=true)
plot(ta.ema(close, 20), color=#00E676, title="EMA 20")
plot(ta.ema(close, 50), color=#2979FF, title="EMA 50")
plot(ta.ema(close, 100), color=#FF9100, title="EMA 100")
plot(ta.ema(close, 200), color=#FF1744, title="EMA 200")
`,
    SuperTrend: `//@version=5
indicator("Supertrend", overlay=true)
[supertrend, direction] = ta.supertrend(3, 10)
plot(direction < 0 ? supertrend : na, "Up Trend", color=color.green, style=plot.style_linebr)
plot(direction > 0 ? supertrend : na, "Down Trend", color=color.red, style=plot.style_linebr)
`,
    'Stochastic Oscillator': `//@version=5
indicator("Stochastic", overlay=false)
k = ta.sma(ta.stoch(close, high, low, 14), 3)
d = ta.sma(k, 3)
plot(k, "%K", color=#2962FF)
plot(d, "%D", color=#FF6D00)
h0 = hline(80, "Upper", color=#787B86)
h1 = hline(20, "Lower", color=#787B86)
fill(h0, h1, color=color.rgb(33, 150, 243, 90))
`,
};

class LocalScriptStore {
    private scripts: PineScriptItem[] = [];
    private activeId: string = 'EMA Golden Cross Strategy.pine';
    private listeners: Set<() => void> = new Set();

    subscribe(fn: () => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    private notify(): void {
        for (const fn of this.listeners) fn();
    }

    async load(): Promise<void> {
        try {
            const res = await fetch('/api/pine-scripts');
            if (res.ok) {
                const data = (await res.json()) as { scripts: PineScriptItem[]; activeFile?: string };
                if (Array.isArray(data.scripts) && data.scripts.length > 0) {
                    this.scripts = data.scripts;
                    if (data.activeFile && this.scripts.some((s) => s.id === data.activeFile)) {
                        this.activeId = data.activeFile;
                    } else if (this.scripts[0]) {
                        this.activeId = this.scripts[0].id;
                    }
                    this.saveLocalBackup();
                    this.notify();
                    return;
                }
            }
        } catch {
            // Dev server endpoint unreachable, fallback to localStorage
        }

        // Fallback from localStorage or defaults
        const cached = localStorage.getItem('vela_pine_scripts');
        if (cached) {
            try {
                this.scripts = JSON.parse(cached) as PineScriptItem[];
                const cachedActive = localStorage.getItem('vela_pine_active_script');
                if (cachedActive && this.scripts.some((s) => s.id === cachedActive)) {
                    this.activeId = cachedActive;
                } else if (this.scripts[0]) {
                    this.activeId = this.scripts[0].id;
                }
                this.notify();
                return;
            } catch {
                // Ignore parse errors
            }
        }

        // Initialize with default templates
        this.scripts = Object.entries(DEFAULT_TEMPLATES).map(([name, code]) => ({
            id: `${name}.pine`,
            name,
            filename: `${name}.pine`,
            content: code,
            isFavorite: name === 'EMA Golden Cross Strategy',
            updatedAt: Date.now(),
        }));
        this.activeId = 'EMA Golden Cross Strategy.pine';
        this.saveLocalBackup();
        this.notify();
    }

    private saveLocalBackup(): void {
        try {
            localStorage.setItem('vela_pine_scripts', JSON.stringify(this.scripts));
            localStorage.setItem('vela_pine_active_script', this.activeId);
        } catch {
            // Ignore storage errors
        }
    }

    getScripts(): PineScriptItem[] {
        return [...this.scripts];
    }

    getActive(): PineScriptItem | undefined {
        return this.scripts.find((s) => s.id === this.activeId) ?? this.scripts[0];
    }

    setActive(id: string): void {
        if (this.scripts.some((s) => s.id === id)) {
            this.activeId = id;
            this.saveLocalBackup();
            this.notify();
        }
    }

    async save(script: { id: string; name?: string; content: string; isFavorite?: boolean }): Promise<void> {
        const existing = this.scripts.find((s) => s.id === script.id);
        const name = script.name ?? existing?.name ?? script.id.replace(/\.pine$/, '');
        const filename = script.id.endsWith('.pine') ? script.id : `${script.id}.pine`;
        const isFavorite = script.isFavorite ?? existing?.isFavorite ?? false;

        const updated: PineScriptItem = {
            id: filename,
            name,
            filename,
            content: script.content,
            isFavorite,
            updatedAt: Date.now(),
        };

        const idx = this.scripts.findIndex((s) => s.id === filename);
        if (idx >= 0) {
            this.scripts[idx] = updated;
        } else {
            this.scripts.push(updated);
        }

        this.activeId = filename;
        this.saveLocalBackup();
        this.notify();

        // Write directly to local file system through Vite dev server endpoint
        try {
            await fetch('/api/pine-scripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename,
                    name,
                    content: script.content,
                    isFavorite,
                    setActive: true,
                }),
            });
        } catch {
            // Keep local backup even if endpoint fails
        }
    }

    async toggleFavorite(id: string): Promise<void> {
        const item = this.scripts.find((s) => s.id === id);
        if (!item) return;
        item.isFavorite = !item.isFavorite;
        this.saveLocalBackup();
        this.notify();

        try {
            await fetch('/api/pine-scripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: item.filename,
                    content: item.content,
                    isFavorite: item.isFavorite,
                }),
            });
        } catch {}
    }

    async createScript(name: string, content?: string): Promise<PineScriptItem> {
        let cleanName = name.trim() || 'Untitled Script';
        let filename = `${cleanName}.pine`;
        let counter = 1;
        while (this.scripts.some((s) => s.filename.toLowerCase() === filename.toLowerCase())) {
            cleanName = `${name} (${counter++})`;
            filename = `${cleanName}.pine`;
        }

        const template =
            content ??
            `//@version=5
indicator("${cleanName}", overlay=true)

// Script logic here
plot(ta.sma(close, 14), title="SMA 14", color=color.blue)
`;

        const newScript: PineScriptItem = {
            id: filename,
            name: cleanName,
            filename,
            content: template,
            isFavorite: false,
            updatedAt: Date.now(),
        };

        this.scripts.unshift(newScript);
        this.activeId = filename;
        this.saveLocalBackup();
        this.notify();

        try {
            await fetch('/api/pine-scripts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename,
                    name: cleanName,
                    content: template,
                    isFavorite: false,
                    setActive: true,
                }),
            });
        } catch {}

        return newScript;
    }

    async deleteScript(id: string): Promise<void> {
        const idx = this.scripts.findIndex((s) => s.id === id);
        if (idx === -1) return;
        const [deleted] = this.scripts.splice(idx, 1);
        if (this.activeId === id) {
            this.activeId = this.scripts[0]?.id ?? '';
        }
        this.saveLocalBackup();
        this.notify();

        if (deleted) {
            try {
                await fetch(`/api/pine-scripts/${encodeURIComponent(deleted.filename)}`, {
                    method: 'DELETE',
                });
            } catch {}
        }
    }

    async openOrLoadScript(title: string, content?: string): Promise<PineScriptItem> {
        await this.load();
        const cleanTitle = title.replace(/\s*\([^)]*\)\s*$/, '').trim();
        const matched = this.scripts.find(
            (s) =>
                s.name.toLowerCase() === title.toLowerCase() ||
                s.name.toLowerCase() === cleanTitle.toLowerCase() ||
                s.filename.toLowerCase() === `${title.toLowerCase()}.pine` ||
                s.filename.toLowerCase() === `${cleanTitle.toLowerCase()}.pine` ||
                (content && s.content.trim() === content.trim()),
        );
        if (matched) {
            this.setActive(matched.id);
            return matched;
        }
        const active = this.getActive();
        if (active) return active;
        return this.createScript(cleanTitle || 'Indicator', content);
    }
}

export const scriptStore = new LocalScriptStore();

const COLOR_HEX_MAP: Record<string, string> = {
    blue: '#2962ff',
    orange: '#ff9800',
    green: '#00e676',
    red: '#ff5252',
    purple: '#9c27b0',
    yellow: '#ffeb3b',
    white: '#ffffff',
    black: '#000000',
    gray: '#787b86',
    navy: '#001f3f',
    maroon: '#85144b',
    aqua: '#7fdbff',
    fuchsia: '#f012be',
    lime: '#01ff70',
    silver: '#dddddd',
    teal: '#39cccc',
    olive: '#3d9970',
};

function escapeHtml(str: string): string {
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

const EDITOR_CSS = `
.pe-kw { color: #2979ff; font-weight: 600; }
.pe-fn { color: #448aff; }
.pe-str { color: #00e676; }
.pe-num { color: #ffa726; }
.pe-bool { color: #ff5252; font-weight: 600; }
.pe-com { color: var(--vela-fg-muted, #868a96); font-style: italic; }
.pe-ver { color: var(--vela-fg-muted, #868a96); font-weight: 700; }
.pe-textarea::-webkit-scrollbar { width: 6px; height: 6px; }
.pe-textarea::-webkit-scrollbar-thumb { background: var(--vela-scroll, rgba(255, 255, 255, 0.2)); border-radius: 3px; }
.pe-textarea::-webkit-scrollbar-track { background: transparent; }
.pe-textarea { scrollbar-width: thin; scrollbar-color: var(--vela-scroll, rgba(255, 255, 255, 0.2)) transparent; }
`;

function ensureEditorStyles(): void {
    if (document.getElementById('pine-editor-styles')) return;
    const style = document.createElement('style');
    style.id = 'pine-editor-styles';
    style.textContent = EDITOR_CSS;
    document.head.appendChild(style);
}

// ── Pine Script Single-Pass Syntax Tokenizer ──
function tokenizePine(code: string): string {
    ensureEditorStyles();

    const tokenRegex =
        /(\/\/@version=\d+)|(\/\/[^\n]*)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|\b(color\.(?:blue|orange|green|red|purple|yellow|white|black|gray|navy|maroon|aqua|fuchsia|lime|silver|teal|olive))\b|\b(indicator|strategy|input(?:\.[a-z]+)?|ta\.[a-z]+|strategy\.[a-z_]+|plot(?:[a-z]+)?|hline|fill|barcolor|bgcolor|alertcondition|if|else|for|while|var|varip|return)\b|\b(true|false|na)\b|(\b\d+(?:\.\d+)?\b)/g;

    let lastIndex = 0;
    let html = '';
    let match: RegExpExecArray | null;

    while ((match = tokenRegex.exec(code)) !== null) {
        if (match.index > lastIndex) {
            html += escapeHtml(code.slice(lastIndex, match.index));
        }

        const [full, ver, comment, str, col, kw, boolConst, num] = match;

        if (ver) {
            html += `<span class="pe-ver">${escapeHtml(ver)}</span>`;
        } else if (comment) {
            html += `<span class="pe-com">${escapeHtml(comment)}</span>`;
        } else if (str) {
            html += `<span class="pe-str">${escapeHtml(str)}</span>`;
        } else if (col) {
            const colName = col.split('.')[1] ?? 'blue';
            const hex = COLOR_HEX_MAP[colName] ?? '#2962ff';
            html += `<span style="display:inline-flex;align-items:center;gap:3px;"><span style="display:inline-block;width:9px;height:9px;background:${hex};border-radius:2px;vertical-align:middle;"></span><span class="pe-fn">${escapeHtml(col)}</span></span>`;
        } else if (kw) {
            html += `<span class="pe-kw">${escapeHtml(kw)}</span>`;
        } else if (boolConst) {
            html += `<span class="pe-bool">${escapeHtml(boolConst)}</span>`;
        } else if (num) {
            html += `<span class="pe-num">${escapeHtml(num)}</span>`;
        } else {
            html += escapeHtml(full);
        }

        lastIndex = tokenRegex.lastIndex;
    }

    if (lastIndex < code.length) {
        html += escapeHtml(code.slice(lastIndex));
    }

    return html;
}

// ── Mount Full Pine Editor ──
export function mountPineEditor(ctx: WidgetContext, body: HTMLElement, header: SidePanelHeader): { destroy(): void } {
    header.setTitle(''); // Clear default panel title so slot takes header space

    let activeScript = scriptStore.getActive();
    let currentCode = activeScript?.content ?? '';
    let dropdownOpen = false;
    let logsOpen = false;
    let logEntries: Array<{ time: string; msg: string; type: 'info' | 'error' | 'success' }> = [];

    // ── Header Slot Construction ──
    const slotEl = header.slot;
    slotEl.style.cssText = 'display:flex;align-items:center;justify-content:space-between;width:100%;min-width:0;gap:6px;';

    const leftControls = document.createElement('div');
    leftControls.style.cssText = 'display:flex;align-items:center;min-width:0;gap:6px;';

    // Script Dropdown Trigger Button
    const scriptBtn = document.createElement('button');
    scriptBtn.style.cssText =
        'all:unset;display:inline-flex;align-items:center;gap:6px;padding:4px 8px;border-radius:var(--vela-radius-sm, 4px);background:var(--vela-surface-elev, #1e1e1e);border:1px solid var(--vela-border, #2e2e2e);color:var(--vela-fg, #d1d4dc);font-size:12px;font-weight:600;cursor:pointer;max-width:180px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;transition:background 0.15s,border-color 0.15s;';
    const scriptBtnText = document.createElement('span');
    scriptBtnText.style.cssText = 'overflow:hidden;text-overflow:ellipsis;';
    scriptBtnText.textContent = activeScript?.name ?? 'Select Script';
    const scriptBtnChevron = document.createElement('span');
    scriptBtnChevron.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
    scriptBtnChevron.style.cssText = 'display:inline-flex;opacity:0.7;';
    scriptBtn.append(scriptBtnText, scriptBtnChevron);

    scriptBtn.onmouseenter = () => {
        scriptBtn.style.background = 'var(--vela-hover, rgba(255, 255, 255, 0.06))';
        scriptBtn.style.borderColor = 'var(--vela-border-strong, #383838)';
    };
    scriptBtn.onmouseleave = () => {
        scriptBtn.style.background = 'var(--vela-surface-elev, #1e1e1e)';
        scriptBtn.style.borderColor = 'var(--vela-border, #2e2e2e)';
    };

    // Run Button (Image 1: prominent white/light pill button with play icon)
    const runBtn = document.createElement('button');
    runBtn.style.cssText =
        'all:unset;display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:var(--vela-radius-sm, 4px);background:#f0f3fa;color:#0f0f0f;font-size:12px;font-weight:600;cursor:pointer;transition:opacity 0.15s;flex-shrink:0;';
    runBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Run</span>`;

    runBtn.onmouseenter = () => {
        runBtn.style.opacity = '0.9';
    };
    runBtn.onmouseleave = () => {
        runBtn.style.opacity = '1';
    };

    // Thin vertical divider
    const divider = document.createElement('div');
    divider.style.cssText = 'width:1px;height:16px;background:var(--vela-border, #2e2e2e);margin:0 2px;flex-shrink:0;';

    // Action Icons (New, Duplicate, Star)
    const actionGroup = document.createElement('div');
    actionGroup.style.cssText = 'display:flex;align-items:center;gap:3px;';

    function createIconButton(svg: string, title: string, onClick: () => void): HTMLButtonElement {
        const btn = document.createElement('button');
        btn.style.cssText =
            'all:unset;display:inline-flex;align-items:center;justify-content:center;width:24px;height:24px;border-radius:4px;color:var(--vela-fg-muted, #787b86);cursor:pointer;transition:background 0.15s,color 0.15s;flex-shrink:0;';
        btn.innerHTML = svg;
        btn.title = title;
        btn.onmouseenter = () => {
            btn.style.background = 'rgba(255, 255, 255, 0.08)';
            btn.style.color = 'var(--vela-fg, #d1d4dc)';
        };
        btn.onmouseleave = () => {
            btn.style.background = 'transparent';
            btn.style.color = 'var(--vela-fg-muted, #787b86)';
        };
        btn.onclick = onClick;
        return btn;
    }

    // New script icon
    const newBtn = createIconButton(
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="12" y1="18" x2="12" y2="12"></line><line x1="9" y1="15" x2="15" y2="15"></line></svg>`,
        'New script',
        () => {
            const name = prompt('Enter new script name:', 'My Custom Indicator');
            if (name) {
                void scriptStore.createScript(name).then((s) => {
                    ctx.toast(`Created ${s.name}`, 'info');
                });
            }
        }
    );

    // Duplicate script icon
    const copyBtn = createIconButton(
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`,
        'Duplicate script',
        () => {
            if (!activeScript) return;
            const duplicateName = `${activeScript.name} (Copy)`;
            void scriptStore.createScript(duplicateName, currentCode).then((s) => {
                ctx.toast(`Duplicated as ${s.name}`, 'info');
            });
        }
    );

    // Star / Favorite icon
    const starBtn = createIconButton(
        `<svg width="14" height="14" viewBox="0 0 24 24" fill="${activeScript?.isFavorite ? '#ffeb3b' : 'none'}" stroke="${activeScript?.isFavorite ? '#ffeb3b' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
        'Add to favorites',
        () => {
            if (activeScript) {
                void scriptStore.toggleFavorite(activeScript.id);
            }
        }
    );

    function updateStarIcon(): void {
        const isFav = activeScript?.isFavorite ?? false;
        starBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="${isFav ? '#ffeb3b' : 'none'}" stroke="${isFav ? '#ffeb3b' : 'currentColor'}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        starBtn.title = isFav ? 'Remove from favorites' : 'Add to favorites';
    }

    actionGroup.append(newBtn, copyBtn, starBtn);
    leftControls.append(scriptBtn, runBtn, divider, actionGroup);
    slotEl.appendChild(leftControls);

    // ── Dropdown Popover Menu (Image 2) ──
    const dropdownMenu = document.createElement('div');
    dropdownMenu.style.cssText =
        'position:absolute;z-index:9999;width:300px;background:var(--vela-surface-overlay, #1e1e1e);border:1px solid var(--vela-border, #2e2e2e);border-radius:6px;box-shadow:var(--vela-shadow-dialog, 0 8px 24px rgba(0,0,0,0.6));padding:6px 0;display:none;font-family:inherit;color:var(--vela-fg, #d1d4dc);max-height:380px;overflow-y:auto;';

    document.body.appendChild(dropdownMenu);

    function positionDropdown(): void {
        const rect = scriptBtn.getBoundingClientRect();
        dropdownMenu.style.top = `${rect.bottom + 6}px`;
        dropdownMenu.style.left = `${rect.left}px`;
    }

    function renderDropdownContent(): void {
        dropdownMenu.innerHTML = '';
        const allScripts = scriptStore.getScripts();
        const favScripts = allScripts.filter((s) => s.isFavorite);

        // Section: FAVORITE SCRIPTS (Image 2)
        const favHeader = document.createElement('div');
        favHeader.style.cssText = 'padding:6px 12px 4px 12px;font-size:11px;font-weight:700;color:var(--vela-fg-muted, #868a96);letter-spacing:0.5px;text-transform:uppercase;';
        favHeader.textContent = 'FAVORITE SCRIPTS';
        dropdownMenu.appendChild(favHeader);

        if (favScripts.length === 0) {
            const emptyFav = document.createElement('div');
            emptyFav.style.cssText = 'padding:6px 12px 10px 12px;font-size:12px;color:var(--vela-fg-muted, #868a96);line-height:1.4;';
            emptyFav.textContent = 'No favorite scripts yet — star the script you are editing to list it here.';
            dropdownMenu.appendChild(emptyFav);
        } else {
            for (const s of favScripts) {
                dropdownMenu.appendChild(createScriptMenuItem(s));
            }
        }

        // Section: ALL SAVED SCRIPTS (User request: list of saved local pine files)
        const allHeader = document.createElement('div');
        allHeader.style.cssText =
            'padding:10px 12px 4px 12px;font-size:11px;font-weight:700;color:var(--vela-fg-muted, #868a96);letter-spacing:0.5px;text-transform:uppercase;border-top:1px solid var(--vela-border, #2e2e2e);margin-top:4px;';
        allHeader.textContent = 'ALL SAVED SCRIPTS';
        dropdownMenu.appendChild(allHeader);

        for (const s of allScripts) {
            dropdownMenu.appendChild(createScriptMenuItem(s));
        }

        // Bottom row: + New script
        const dividerEl = document.createElement('div');
        dividerEl.style.cssText = 'height:1px;background:var(--vela-border, #2e2e2e);margin:6px 0;';
        dropdownMenu.appendChild(dividerEl);

        const newRow = document.createElement('div');
        newRow.style.cssText =
            'padding:8px 12px;display:flex;align-items:center;gap:8px;font-size:13px;font-weight:600;color:var(--vela-fg, #d1d4dc);cursor:pointer;transition:background 0.15s;';
        newRow.innerHTML = `<span style="font-size:16px;line-height:1;opacity:0.8;">+</span><span>New script</span>`;
        newRow.onmouseenter = () => {
            newRow.style.background = 'var(--vela-hover, rgba(255, 255, 255, 0.06))';
        };
        newRow.onmouseleave = () => {
            newRow.style.background = 'transparent';
        };
        newRow.onclick = () => {
            closeDropdown();
            const name = prompt('Enter new script name:', 'My Custom Indicator');
            if (name) {
                void scriptStore.createScript(name).then((created) => {
                    ctx.toast(`Created ${created.name}`, 'info');
                });
            }
        };
        dropdownMenu.appendChild(newRow);
    }

    function createScriptMenuItem(s: PineScriptItem): HTMLElement {
        const item = document.createElement('div');
        const isActive = s.id === activeScript?.id;
        item.style.cssText = `padding:6px 12px;display:flex;align-items:center;justify-content:space-between;cursor:pointer;font-size:12px;transition:background 0.15s;background:${isActive ? 'var(--vela-active, rgba(255, 255, 255, 0.08))' : 'transparent'};color:${isActive ? 'var(--vela-accent, #2962ff)' : 'var(--vela-fg, #d1d4dc)'};`;

        const nameSpan = document.createElement('div');
        nameSpan.style.cssText = 'display:flex;align-items:center;gap:6px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1 1 auto;';
        if (isActive) {
            nameSpan.innerHTML = `<span style="color:var(--vela-accent, #2962ff);font-size:10px;">●</span><span style="font-weight:600;overflow:hidden;text-overflow:ellipsis;">${s.name}</span>`;
        } else {
            nameSpan.innerHTML = `<span style="opacity:0.3;font-size:10px;">○</span><span style="overflow:hidden;text-overflow:ellipsis;">${s.name}</span>`;
        }

        const iconsRight = document.createElement('div');
        iconsRight.style.cssText = 'display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px;';

        // Star toggle
        const starToggle = document.createElement('button');
        starToggle.style.cssText = 'all:unset;cursor:pointer;display:inline-flex;align-items:center;color:var(--vela-fg-muted, #868a96);';
        starToggle.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="${s.isFavorite ? '#ffeb3b' : 'none'}" stroke="${s.isFavorite ? '#ffeb3b' : 'currentColor'}" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`;
        starToggle.onclick = (e) => {
            e.stopPropagation();
            void scriptStore.toggleFavorite(s.id);
        };

        // Trash delete
        const trashBtn = document.createElement('button');
        trashBtn.style.cssText = 'all:unset;cursor:pointer;display:inline-flex;align-items:center;color:var(--vela-fg-muted, #868a96);opacity:0.6;';
        trashBtn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        trashBtn.title = 'Delete script';
        trashBtn.onmouseenter = () => {
            trashBtn.style.color = 'var(--vela-down, #ff5252)';
            trashBtn.style.opacity = '1';
        };
        trashBtn.onmouseleave = () => {
            trashBtn.style.color = 'var(--vela-fg-muted, #868a96)';
            trashBtn.style.opacity = '0.6';
        };
        trashBtn.onclick = (e) => {
            e.stopPropagation();
            if (confirm(`Delete "${s.name}" from disk?`)) {
                void scriptStore.deleteScript(s.id);
            }
        };

        iconsRight.append(starToggle, trashBtn);
        item.append(nameSpan, iconsRight);

        item.onmouseenter = () => {
            if (!isActive) item.style.background = 'var(--vela-hover, rgba(255, 255, 255, 0.05))';
        };
        item.onmouseleave = () => {
            if (!isActive) item.style.background = 'transparent';
        };
        item.onclick = () => {
            closeDropdown();
            scriptStore.setActive(s.id);
        };

        return item;
    }

    function toggleDropdown(): void {
        dropdownOpen = !dropdownOpen;
        if (dropdownOpen) {
            positionDropdown();
            renderDropdownContent();
            dropdownMenu.style.display = 'block';
        } else {
            dropdownMenu.style.display = 'none';
        }
    }

    function closeDropdown(): void {
        dropdownOpen = false;
        dropdownMenu.style.display = 'none';
    }

    scriptBtn.onclick = (e) => {
        e.stopPropagation();
        toggleDropdown();
    };

    const onWindowClick = (e: MouseEvent) => {
        if (dropdownOpen && !dropdownMenu.contains(e.target as Node) && !scriptBtn.contains(e.target as Node)) {
            closeDropdown();
        }
    };
    window.addEventListener('click', onWindowClick);

    // ── Body & Code Editor Layout ──
    body.style.cssText =
        'padding:0;margin:0;display:flex;flex-direction:column;height:100%;overflow:hidden;background:var(--vela-bg, #0f0f0f);color:var(--vela-fg, #d1d4dc);font-family:var(--vela-font, sans-serif);';

    const editorContainer = document.createElement('div');
    editorContainer.style.cssText =
        'display:flex;flex:1 1 auto;min-height:0;position:relative;overflow:hidden;background:var(--vela-bg, #0f0f0f);';

    // Line Numbers Gutter
    const gutter = document.createElement('div');
    gutter.style.cssText =
        'width:42px;flex-shrink:0;background:var(--vela-bg, #0f0f0f);border-right:1px solid var(--vela-border, #2e2e2e);padding:12px 6px;text-align:right;user-select:none;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:22px;color:var(--vela-fg-muted, #868a96);overflow:hidden;box-sizing:border-box;';

    // Code Editor Wrapper (holds overlay + textarea + minimap)
    const codeAreaWrapper = document.createElement('div');
    codeAreaWrapper.style.cssText = 'position:relative;flex:1 1 auto;min-width:0;height:100%;overflow:hidden;';

    // Active line background highlight
    const activeLineBar = document.createElement('div');
    activeLineBar.style.cssText =
        'position:absolute;left:0;right:0;height:22px;background:var(--vela-hover, rgba(255, 255, 255, 0.04));pointer-events:none;z-index:1;display:none;';

    // Highlighted code display
    const codeHighlight = document.createElement('pre');
    codeHighlight.style.cssText =
        'position:absolute;inset:0;margin:0;padding:12px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:22px;white-space:pre;pointer-events:none;z-index:2;overflow:hidden;box-sizing:border-box;color:var(--vela-fg, #d1d4dc);';

    // Transparent interactive textarea
    const textarea = document.createElement('textarea');
    textarea.className = 'pe-textarea';
    textarea.spellcheck = false;
    textarea.setAttribute('spellcheck', 'false');
    textarea.setAttribute('autocorrect', 'off');
    textarea.setAttribute('autocapitalize', 'off');
    textarea.setAttribute('autocomplete', 'off');
    textarea.style.cssText =
        'position:absolute;inset:0;margin:0;padding:12px 14px;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;font-size:13px;line-height:22px;white-space:pre;background:transparent;color:transparent;caret-color:var(--vela-fg-bright, #ffffff);resize:none;border:none;outline:none;tab-size:4;overflow:auto;z-index:3;box-sizing:border-box;';
    textarea.value = currentCode;

    // Minimap (right edge)
    const minimap = document.createElement('div');
    minimap.style.cssText =
        'width:42px;flex-shrink:0;background:transparent;border-left:1px solid var(--vela-border, #2e2e2e);position:relative;overflow:hidden;user-select:none;cursor:pointer;';
    const minimapCanvas = document.createElement('canvas');
    minimapCanvas.style.cssText = 'width:100%;height:100%;display:block;';
    const minimapSlider = document.createElement('div');
    minimapSlider.style.cssText =
        'position:absolute;left:0;right:0;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.12);pointer-events:none;';
    minimap.append(minimapCanvas, minimapSlider);

    codeAreaWrapper.append(activeLineBar, codeHighlight, textarea);
    editorContainer.append(gutter, codeAreaWrapper, minimap);

    // ── Bottom Status Bar (Image 1) ──
    const statusBar = document.createElement('div');
    statusBar.style.cssText =
        'height:28px;flex-shrink:0;background:var(--vela-bg, #0f0f0f);border-top:1px solid var(--vela-border, #2e2e2e);display:flex;align-items:center;justify-content:space-between;padding:0 10px;font-size:11px;font-family:inherit;color:var(--vela-fg-muted, #868a96);';

    // Left: Logs toggle button (Image 1: ▾ Logs 0)
    const logsBtn = document.createElement('button');
    logsBtn.style.cssText =
        'all:unset;display:inline-flex;align-items:center;gap:4px;padding:2px 6px;border-radius:3px;background:var(--vela-surface-elev, #1e1e1e);border:1px solid var(--vela-border, #2e2e2e);color:var(--vela-fg-muted, #868a96);font-size:11px;cursor:pointer;transition:color 0.15s,background 0.15s;';
    logsBtn.innerHTML = `<span>▾ Logs</span> <span style="font-weight:700;">0</span>`;
    logsBtn.onclick = () => {
        logsOpen = !logsOpen;
        logsDrawer.style.display = logsOpen ? 'flex' : 'none';
        logsBtn.style.color = logsOpen ? 'var(--vela-fg-bright, #ffffff)' : 'var(--vela-fg-muted, #868a96)';
    };

    // Right: Pine v5 badge & Status text (Image 1: Pine v5 | ✓ EMA Golden Cross Strategy on the chart)
    const statusRight = document.createElement('div');
    statusRight.style.cssText = 'display:flex;align-items:center;gap:8px;overflow:hidden;';

    const versionBadge = document.createElement('span');
    versionBadge.style.cssText =
        'padding:2px 6px;border-radius:3px;background:var(--vela-surface-elev, #1e1e1e);border:1px solid var(--vela-border, #2e2e2e);color:var(--vela-fg-muted, #868a96);font-size:11px;';
    versionBadge.textContent = 'Pine v5';

    const statusMsg = document.createElement('span');
    statusMsg.style.cssText =
        'font-size:11px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:var(--vela-accent, #2962ff);';
    statusMsg.textContent = activeScript ? `✓ ${activeScript.name} ready` : '✓ Ready';

    statusRight.append(versionBadge, statusMsg);
    statusBar.append(logsBtn, statusRight);

    // ── Logs Console Drawer (collapsible) ──
    const logsDrawer = document.createElement('div');
    logsDrawer.style.cssText =
        'height:120px;flex-shrink:0;background:var(--vela-surface-sunken, #0f0f0f);border-top:1px solid var(--vela-border, #2e2e2e);display:none;flex-direction:column;font-family:ui-monospace,SFMono-Regular,monospace;font-size:11px;color:var(--vela-fg, #d1d4dc);';

    const logsHeader = document.createElement('div');
    logsHeader.style.cssText =
        'padding:4px 10px;background:var(--vela-surface-elev, #1e1e1e);border-bottom:1px solid var(--vela-border, #2e2e2e);display:flex;align-items:center;justify-content:space-between;color:var(--vela-fg-muted, #868a96);font-size:10px;';
    logsHeader.innerHTML = `<span>CONSOLE OUTPUT</span>`;
    const clearLogsBtn = document.createElement('button');
    clearLogsBtn.style.cssText = 'all:unset;cursor:pointer;color:var(--vela-fg-muted, #868a96);';
    clearLogsBtn.textContent = 'Clear';
    clearLogsBtn.onclick = () => {
        logEntries = [];
        renderLogs();
    };
    logsHeader.appendChild(clearLogsBtn);

    const logsContent = document.createElement('div');
    logsContent.style.cssText = 'flex:1 1 auto;overflow-y:auto;padding:6px 10px;display:flex;flex-direction:column;gap:4px;';
    logsDrawer.append(logsHeader, logsContent);

    function addLog(msg: string, type: 'info' | 'error' | 'success' = 'info'): void {
        const time = new Date().toLocaleTimeString();
        logEntries.push({ time, msg, type });
        logsBtn.innerHTML = `<span>▾ Logs</span> <span style="font-weight:700;">${logEntries.length}</span>`;
        renderLogs();
    }

    function renderLogs(): void {
        logsContent.innerHTML = '';
        for (const item of logEntries) {
            const line = document.createElement('div');
            const col = item.type === 'error' ? '#ff5252' : item.type === 'success' ? '#00e676' : '#90caf9';
            line.style.cssText = `color:${col};white-space:pre-wrap;word-break:break-all;line-height:1.4;`;
            line.textContent = `[${item.time}] ${item.msg}`;
            logsContent.appendChild(line);
        }
        logsContent.scrollTop = logsContent.scrollHeight;
    }

    body.append(editorContainer, logsDrawer, statusBar);

    // ── Line numbering & highlighting sync ──
    function updateEditorUI(): void {
        const val = textarea.value;
        const lines = val.split('\n');
        const count = lines.length;

        // Update gutter line numbers
        gutter.innerHTML = Array.from({ length: count }, (_, i) => `<div>${i + 1}</div>`).join('');

        // Update highlighted code overlay
        codeHighlight.innerHTML = tokenizePine(val) + '\n';

        // Update active line highlight
        updateActiveLineHighlight();

        // Update minimap
        renderMinimap();
    }

    function updateActiveLineHighlight(): void {
        const cursor = textarea.selectionStart;
        const before = textarea.value.slice(0, cursor);
        const lineIdx = before.split('\n').length - 1;
        const topPx = 12 + lineIdx * 22 - textarea.scrollTop;

        activeLineBar.style.top = `${topPx}px`;
        activeLineBar.style.display = 'block';

        // Gutter line highlight
        const gutterChildren = gutter.children;
        for (let i = 0; i < gutterChildren.length; i++) {
            const child = gutterChildren[i] as HTMLElement;
            if (i === lineIdx) {
                child.style.color = 'var(--vela-fg-bright, #ffffff)';
                child.style.fontWeight = '700';
            } else {
                child.style.color = 'var(--vela-fg-muted, #868a96)';
                child.style.fontWeight = 'normal';
            }
        }
    }

    function renderMinimap(): void {
        const w = minimap.clientWidth;
        const h = minimap.clientHeight;
        if (w === 0 || h === 0) return;

        minimapCanvas.width = w;
        minimapCanvas.height = h;
        const ctx2d = minimapCanvas.getContext('2d');
        if (!ctx2d) return;

        ctx2d.clearRect(0, 0, w, h);
        const lines = textarea.value.split('\n');
        const lineH = Math.max(1.5, Math.min(3, h / Math.max(lines.length, 1)));

        lines.forEach((line, i) => {
            if (line.trim().length === 0) return;
            const y = i * lineH;
            const isComment = /^\s*\/\//.test(line);
            ctx2d.fillStyle = isComment ? 'rgba(134, 138, 150, 0.35)' : 'rgba(41, 121, 255, 0.45)';
            const lw = Math.min(w - 6, Math.max(8, line.trim().length * 1.2));
            ctx2d.fillRect(3, y, lw, lineH - 0.5);
        });

        // Viewport rectangle slider on minimap
        const scrollRatio = textarea.scrollHeight > 0 ? textarea.scrollTop / textarea.scrollHeight : 0;
        const viewRatio = textarea.clientHeight > 0 ? textarea.clientHeight / textarea.scrollHeight : 1;
        const sliderTop = scrollRatio * h;
        const sliderH = Math.max(16, viewRatio * h);
        minimapSlider.style.top = `${sliderTop}px`;
        minimapSlider.style.height = `${sliderH}px`;
        minimapSlider.style.background = 'rgba(255, 255, 255, 0.05)';
        minimapSlider.style.borderColor = 'rgba(255, 255, 255, 0.12)';
    }

    // Scroll synchronization
    textarea.addEventListener('scroll', () => {
        gutter.scrollTop = textarea.scrollTop;
        codeHighlight.scrollTop = textarea.scrollTop;
        codeHighlight.scrollLeft = textarea.scrollLeft;
        updateActiveLineHighlight();
        renderMinimap();
    });

    // Minimap click to scroll
    minimap.addEventListener('click', (e) => {
        const rect = minimap.getBoundingClientRect();
        const clickRatio = (e.clientY - rect.top) / rect.height;
        textarea.scrollTop = clickRatio * textarea.scrollHeight - textarea.clientHeight / 2;
    });

    // Cursor movement updates active line
    textarea.addEventListener('keyup', () => updateActiveLineHighlight());
    textarea.addEventListener('click', () => updateActiveLineHighlight());

    // Tab key & indentation handling
    textarea.addEventListener('keydown', (e) => {
        if (e.key === 'Tab') {
            e.preventDefault();
            const start = textarea.selectionStart;
            const end = textarea.selectionEnd;
            const val = textarea.value;
            if (e.shiftKey) {
                // Dedent 4 spaces
                if (val.slice(start - 4, start) === '    ') {
                    textarea.value = val.slice(0, start - 4) + val.slice(start);
                    textarea.selectionStart = textarea.selectionEnd = start - 4;
                }
            } else {
                // Indent 4 spaces
                textarea.value = val.slice(0, start) + '    ' + val.slice(end);
                textarea.selectionStart = textarea.selectionEnd = start + 4;
            }
            onCodeChanged();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runBtn.click();
        } else if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            void saveCurrentCode();
        }
    });

    let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
    function onCodeChanged(): void {
        currentCode = textarea.value;
        updateEditorUI();
        statusMsg.style.color = '#ffa726';
        statusMsg.textContent = '• Unsaved changes';

        if (autoSaveTimer) clearTimeout(autoSaveTimer);
        autoSaveTimer = setTimeout(() => {
            void saveCurrentCode();
        }, 800);
    }

    textarea.addEventListener('input', () => onCodeChanged());

    async function saveCurrentCode(): Promise<void> {
        if (!activeScript) return;
        statusMsg.style.color = '#787b86';
        statusMsg.textContent = 'Saving…';
        await scriptStore.save({
            id: activeScript.id,
            name: activeScript.name,
            content: textarea.value,
            isFavorite: activeScript.isFavorite,
        });
        statusMsg.style.color = '#00e676';
        statusMsg.textContent = `✓ Saved to scripts/${activeScript.filename}`;
        ctx.toast(`Saved to scripts/${activeScript.filename}`, 'success');
    }

    // ── Run indicator logic ──
    async function executeCode(): Promise<void> {
        if (!activeScript) return;
        runBtn.style.opacity = '0.7';
        runBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Running…</span>`;
        statusMsg.style.color = '#787b86';
        statusMsg.textContent = 'Compiling & running…';

        // Auto-save before running
        await scriptStore.save({
            id: activeScript.id,
            name: activeScript.name,
            content: textarea.value,
            isFavorite: activeScript.isFavorite,
        });

        const r = await ctx.chart.runIndicator(textarea.value);
        runBtn.style.opacity = '1';
        runBtn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>Run</span>`;

        if (r.ok) {
            const title = activeScript.name || r.handle?.title || 'Indicator';
            statusMsg.style.color = '#2962ff';
            statusMsg.textContent = `✓ ${title} on the chart`;
            addLog(`✓ ${title} successfully compiled and mounted to active chart`, 'success');
            ctx.toast(`Applied ${title}`, 'success');
        } else {
            statusMsg.style.color = '#ff5252';
            statusMsg.textContent = `✗ ${r.error?.message || 'Compile error'}`;
            addLog(`✗ Error: ${r.error?.message || 'Compile error'}`, 'error');
            ctx.toast(r.error?.message || 'Indicator execution failed', 'error');
        }
    }

    runBtn.onclick = () => void executeCode();

    // ── React to store updates ──
    const unsubscribe = scriptStore.subscribe(() => {
        const nextActive = scriptStore.getActive();
        if (nextActive && nextActive.id !== activeScript?.id) {
            activeScript = nextActive;
            scriptBtnText.textContent = nextActive.name;
            textarea.value = nextActive.content;
            currentCode = nextActive.content;
            statusMsg.style.color = '#2962ff';
            statusMsg.textContent = `✓ ${nextActive.name} ready`;
            updateStarIcon();
            updateEditorUI();
        } else if (nextActive) {
            activeScript = nextActive;
            scriptBtnText.textContent = nextActive.name;
            updateStarIcon();
        }
    });

    // Initial load from local file system API
    void scriptStore.load().then(() => {
        const loaded = scriptStore.getActive();
        if (loaded) {
            activeScript = loaded;
            scriptBtnText.textContent = loaded.name;
            textarea.value = loaded.content;
            currentCode = loaded.content;
            updateStarIcon();
            updateEditorUI();
            statusMsg.textContent = `✓ ${loaded.name} ready`;
        }
    });

    updateEditorUI();

    return {
        destroy() {
            window.removeEventListener('click', onWindowClick);
            unsubscribe();
            if (autoSaveTimer) clearTimeout(autoSaveTimer);
            if (dropdownMenu.parentElement) dropdownMenu.parentElement.removeChild(dropdownMenu);
        },
    };
}
