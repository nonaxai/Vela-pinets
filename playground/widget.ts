// The replacement proof, interactive form: Vela's own WORKSPACE playground page with
// the Pine engine coming from THIS package instead of Vela's in-tree one — same
// workspace, same providers (Binance, Coinbase, Hyperliquid), same manifest shape.
// Full Vela workspace features enabled: multi-chart layouts, shared drawing toolbar,
// user drawing tools, bottom bar, symbol watermark, multi-venue providers, live bar replay,
// and docked side panel + Code runner.
import { VelaWorkspace, encodeState } from '@luxalgo/vela/workspace';
import { BinanceProvider } from '@luxalgo/vela/providers/binance';
import { CoinbaseProvider } from '@luxalgo/vela/providers/coinbase';
import { HyperliquidProvider } from '@luxalgo/vela/providers/hyperliquid';
import {
    registerWidgetAction,
    registerIcon,
    registerSidePanel,
    registerDefaultEngine,
    registerStatePersistence,
    type WidgetContext,
    type CellStateContext,
    type InputValue,
} from '@luxalgo/vela/plugin';
import { Dialog } from '@luxalgo/vela/ui';
import { PineWorkerEngine } from '../src';
import { mountPineEditor } from './pine-editor';
import { StrategyTester } from './strategy-tester';
import type { IndicatorHandle, Vela } from '@luxalgo/vela';

interface PersistedScriptItem {
    id: string;
    title: string;
    source: string;
    visible: boolean;
    inputs?: Record<string, InputValue>;
    props?: Record<string, InputValue>;
}

interface PersistedStrategyTesterState {
    mode?: 'hidden' | 'docked' | 'expanded' | 'maximized';
    view?: 'chart' | 'table';
    height?: number;
}

interface PersistedAddonState {
    version: number;
    timestamp: number;
    scripts: Record<string, PersistedScriptItem[]>;
    drawings: Record<string, unknown>;
    strategyTester: PersistedStrategyTesterState;
}

// App-wide default engine registration: any new chart or workspace cell automatically
// uses PineWorkerEngine for 'pine' scripts.
registerDefaultEngine('pine', () => new PineWorkerEngine());

// State persistence seam: persist custom script indicators on each chart through Vela's cell ext bag
registerStatePersistence({
    key: 'pinets.custom-scripts',
    scope: 'cell',
    serialize(ctx: CellStateContext) {
        const indicators = ctx.chart.indicators();
        const scripts: PersistedScriptItem[] = [];
        for (const h of indicators) {
            if (h.source) {
                scripts.push({
                    id: h.id,
                    title: h.title,
                    source: h.source,
                    visible: h.visible,
                    inputs: typeof h.inputValues === 'function' ? h.inputValues() : {},
                    props: typeof h.propValues === 'function' ? h.propValues() : {},
                });
            }
        }
        return scripts.length > 0 ? scripts : undefined;
    },
    restore(payload: unknown, ctx: CellStateContext) {
        if (!Array.isArray(payload)) return;
        const list = payload as PersistedScriptItem[];
        void (async () => {
            for (const s of list) {
                if (typeof s?.source !== 'string') continue;
                const existing = ctx.chart.indicators().find((i) => i.title === s.title || i.source === s.source);
                if (!existing) {
                    try {
                        const res = await ctx.chart.runIndicator(s.source);
                        if (res.ok && res.handle) {
                            if (s.inputs && typeof res.handle.setInputs === 'function') {
                                res.handle.setInputs(s.inputs);
                            }
                            if (s.props && typeof res.handle.setProps === 'function') {
                                res.handle.setProps(s.props);
                            }
                            if (s.visible === false && typeof res.handle.setVisible === 'function') {
                                res.handle.setVisible(false);
                            }
                        }
                    } catch (e) {
                        console.warn('[vela-pinets] restore indicator failed:', e);
                    }
                }
            }
            syncActiveStrategy();
        })();
    },
});

// Worker-path instrumentation: count real Web Worker spawns so a browser probe can
// PROVE Pine runs off the main thread through the addon (window.__workerSpawns >= 1).
type PlaygroundDebugWindow = Window & { __workerSpawns: number; workspace?: VelaWorkspace; strategyTester?: StrategyTester };
const debugWin = window as unknown as PlaygroundDebugWindow;
debugWin.__workerSpawns = 0;
const RealWorker = window.Worker;
window.Worker = class extends RealWorker {
    constructor(...args: ConstructorParameters<typeof Worker>) {
        super(...args);
        debugWin.__workerSpawns++;
    }
};

const workspace = new VelaWorkspace('#chart', {
    layout: '1', // single chart from the first paint; the layout button opens multi-chart grids (up to 4x4)
    symbol: 'BTCUSDT', // bare = first declared provider (binance); or 'coinbase:BTC-USD', 'hyperliquid:BTC'
    timeframe: '60',
    live: true,
    theme: 'dark',
    autofocus: true, // the chart IS the page — shortcuts work from the first keystroke
    defaultLanguage: 'pine',

    // Multi-venue data feeds ready to query:
    providers: {
        binance: () => new BinanceProvider(),
        coinbase: () => new CoinbaseProvider(),
        hyperliquid: () => new HyperliquidProvider(),
    },

    engines: { pine: () => new PineWorkerEngine() }, // Pine served off the main thread

    // ── Full Vela Shell & Workspace Features ──
    drawings: true, // user drawings (70+ tools: trendlines, fibs, pitchforks, rects, text…)
    drawingToolbar: true, // shared floating drawing toolbar on the left for the active cell
    watermark: true, // symbol watermark behind candles
    bottombar: true, // range-presets (1D, 5D, 1M, 3M, 1Y, ALL) + timezone bar
    statusline: true, // detailed status line with OHLCV & indicator values
    persist: true, // restore market/layout/drawings/indicators across reloads (localStorage)
    timeframes: ['1', '5', '15', '30', '60', '240', 'D', 'W', 'M'], // topbar timeframe presets
    timezone: 'Etc/UTC',
    animations: { zoom: true, pan: true, liveBar: true }, // smooth zooming, panning & forming-bar glide
    glow: 0.3, // neon glow on line series under WebGL2

    // ── Pine Script Indicators Catalog ──
    indicators: [
        {
            name: 'EMA 20',
            enabled: true, // on from first paint — visible proof the addon plots through Vela
            script: `//@version=5
indicator("EMA 20", overlay=true)
plot(ta.ema(close, 20), color=color.orange, linewidth=2)`,
        },
        {
            name: 'RSI 14',
            enabled: false,
            script: `//@version=5
indicator("RSI 14", overlay=false)
r = ta.rsi(close, 14)
plot(r, color=color.purple, linewidth=2)
h1 = hline(70, "Overbought", color=color.red, linestyle=hline.style_dashed)
h2 = hline(30, "Oversold", color=color.green, linestyle=hline.style_dashed)
fill(h1, h2, color=color.rgb(128, 0, 128, 90))`,
        },
        {
            name: 'MACD (12, 26, 9)',
            enabled: false,
            script: `//@version=5
indicator("MACD", overlay=false)
[fastLine, slowLine, histLine] = ta.macd(close, 12, 26, 9)
plot(histLine, title="Histogram", style=plot.style_columns, color=(histLine >= 0 ? (histLine[1] < histLine ? #26A69A : #B2DFDB) : (histLine[1] < histLine ? #FFCDD2 : #FF5252)))
plot(fastLine, title="MACD", color=#2962FF)
plot(slowLine, title="Signal", color=#FF6D00)`,
        },
        {
            name: 'Bollinger Bands',
            enabled: false,
            script: `//@version=5
indicator("Bollinger Bands", overlay=true)
[mid, upper, lower] = ta.bb(close, 20, 2)
p1 = plot(upper, "Upper Band", color=color.teal)
plot(mid, "Basis", color=color.orange)
p2 = plot(lower, "Lower Band", color=color.teal)
fill(p1, p2, color=color.rgb(0, 150, 136, 90))`,
        },
        {
            name: 'EMA Golden Cross Strategy',
            enabled: true, // on from first paint — visible proof of strategy backtesting
            script: `//@version=5
strategy("EMA Golden Cross Strategy", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)

shortLength = input.int(50, title="Fast EMA Length")
longLength = input.int(200, title="Slow EMA Length")

shortEMA = ta.ema(close, shortLength)
longEMA = ta.ema(close, longLength)

longCondition = ta.crossover(shortEMA, longEMA)
shortCondition = ta.crossunder(shortEMA, longEMA)

if (longCondition)
    strategy.entry("Golden Cross BUY", strategy.long)

if (shortCondition)
    strategy.entry("Death Cross SELL", strategy.short)

plot(shortEMA, title="Fast EMA", color=color.blue, linewidth=2)
plot(longEMA, title="Slow EMA", color=color.orange, linewidth=2)`,
        },
        {
            name: 'SMA Cross Strategy',
            enabled: false,
            script: `//@version=5
strategy("SMA Cross Strategy", overlay=true, initial_capital=10000, default_qty_value=1)
fast = ta.sma(close, 10)
slow = ta.sma(close, 30)
plot(fast, color=color.blue, linewidth=2, title="Fast SMA")
plot(slow, color=color.yellow, linewidth=2, title="Slow SMA")
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long, comment="Buy")
if ta.crossunder(fast, slow)
    strategy.close("Long", comment="Sell")`,
        },
    ],
});

void workspace.cells()[0]?.chart.ready().then(() => console.log('[vela-pinets] chart ready — Pine served by the addon engine'));

// Playground-only debug handle: expose the workspace for console poking.
debugWin.workspace = workspace;

// ── Icons registration ──
registerIcon(
    'code',
    '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="m5.5 4.5-4 3.5 4 3.5M10.5 4.5l4 3.5-4 3.5"/></svg>',
);
registerIcon(
    'cloud-save',
    '<svg viewBox="0 0 16 16" width="1.1em" height="1.1em" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 13.5h7a3.5 3.5 0 0 0 1.5-6.66A4.5 4.5 0 0 0 4.5 6.5a3 3 0 0 0 0 7z"/><path d="M8 8.5v4M6.5 10l1.5-1.5 1.5 1.5"/></svg>',
);

// ── "Replay" topbar entry — Bar Replay across the workspace ──
registerWidgetAction({
    id: 'pinets.replay',
    target: 'topbar',
    label: 'Bar Replay',
    icon: 'replay',
    order: 5,
    align: 'left',
    run: (ctx) => {
        void (async (): Promise<void> => {
            const wsCtx = ctx as WidgetContext & {
                replay?: {
                    state: { active: boolean };
                    start(opts: { from: number }): Promise<void>;
                    play(ms?: number): void;
                    stop(): void;
                };
            };
            const replay = wsCtx.replay;
            if (!replay) return;
            if (replay.state.active) {
                replay.stop();
                ctx.toast('Replay stopped — live stream restored', 'info');
            } else {
                const bounds = ctx.chart.replay.bounds;
                if (!bounds || bounds.last <= bounds.first) {
                    ctx.toast('Not enough history to replay', 'error');
                    return;
                }
                // Rewind to roughly the last 15% of loaded history
                const span = bounds.last - bounds.first;
                const from = Math.max(bounds.first, bounds.last - Math.max(span * 0.15, 60_000));
                await replay.start({ from });
                replay.play(800);
                ctx.toast('Replay started. Click Replay again to exit.', 'info');
            }
        })();
    },
});

// ── "Code" topbar entry — paste arbitrary Pine and Run it on demand ──
let codeDialog: Dialog | null = null;
let codeArea: HTMLTextAreaElement | null = null;
let codeStatus: HTMLElement | null = null;
let codeRun: HTMLButtonElement | null = null;

registerWidgetAction({
    id: 'pinets.code',
    target: 'topbar',
    label: 'Code',
    icon: 'code',
    run: (ctx) => {
        if (!codeDialog) {
            codeArea = document.createElement('textarea');
            codeArea.value = `//@version=5
indicator("My RSI", overlay=false)
plot(ta.rsi(close, 14), color=color.purple)`;
            codeArea.spellcheck = false;
            codeArea.style.cssText =
                'width:560px;max-width:80vw;height:260px;resize:vertical;background:var(--vela-surface-overlay);color:var(--vela-fg);border:1px solid var(--vela-border-soft);border-radius:var(--vela-radius-md);padding:10px;font:12px/1.5 ui-monospace,Consolas,monospace;outline:none;';
            // Ctrl/⌘+Enter runs without leaving the keyboard.
            codeArea.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                    e.preventDefault();
                    codeRun?.click();
                }
            });
            codeRun = document.createElement('button');
            codeRun.textContent = 'Run';
            codeRun.style.cssText =
                'all:unset;margin-top:8px;padding:6px 18px;border-radius:var(--vela-radius-sm);background:var(--vela-accent);color:#0b0e14;font-weight:600;cursor:pointer;';
            codeStatus = document.createElement('div');
            codeStatus.style.cssText = 'margin-top:8px;min-height:1.3em;font-size:var(--vela-font-size-md);white-space:pre-wrap;';
            codeDialog = new Dialog({
                title: 'Run a Pine indicator',
                host: ctx.host,
                closeOnInteractOutside: true,
                content: (body) => body.append(codeArea!, codeRun!, codeStatus!),
            });
        }
        codeRun!.onclick = () => void runCode(ctx);
        codeStatus!.textContent = '';
        codeDialog.show();
        setTimeout(() => codeArea?.focus(), 0);
    },
});

async function runCode(ctx: WidgetContext): Promise<void> {
    if (!codeArea || !codeStatus) return;
    codeStatus.style.color = 'var(--vela-fg-muted)';
    codeStatus.textContent = 'Running…';
    const r = await ctx.chart.runIndicator(codeArea.value);
    if (r.ok) {
        codeStatus.style.color = 'var(--vela-accent)';
        codeStatus.textContent = `✓ ${r.handle!.title || 'Indicator'} added to the chart`;
    } else {
        codeStatus.style.color = 'var(--vela-danger)';
        codeStatus.textContent = `✗ ${r.error!.message}`;
    }
}

// ── "Save" topbar entry — TradingView-style manual save & shortcut ──
registerWidgetAction({
    id: 'pinets.save',
    target: 'topbar',
    label: 'Save',
    icon: 'cloud-save',
    order: -5,
    align: 'right',
    run: (ctx) => {
        saveAllCharts(ctx);
    },
});

// ── "Pine Scripts" docked side panel ──
registerSidePanel({
    id: 'pinets.scripts',
    title: 'Pine Scripts',
    icon: 'code',
    width: 520,
    minWidth: 380,
    maxWidth: 900,
    resizable: true,
    overlay: true,
    mount: (ctx, body, header) => mountPineEditor(ctx, body, header),
});

// The workspace is already built — project freshly registered actions + panels into its chrome.
workspace.refreshActions();

// ── Backtesting Panel for Pine Strategy indicators ──
const strategyTester = new StrategyTester({
    host: workspace.root,
    getActiveChart: () => workspace.active?.chart ?? null,
});
debugWin.strategyTester = strategyTester;

function isStrategyHandle(h: IndicatorHandle): boolean {
    if (h.source && /^\s*strategy\s*\(/m.test(h.source)) return true;
    if (h.title && /strategy/i.test(h.title)) return true;
    if (h.props && h.props.some((p) => p.key === 'initial_capital' || p.key === 'default_qty_value')) return true;
    return false;
}

function syncActiveStrategy(): void {
    const chart = workspace.active?.chart;
    if (!chart) {
        void strategyTester.bindStrategy(null);
        return;
    }
    const indicators = chart.indicators();
    // Find the first visible strategy indicator on this chart
    const activeStrat = indicators.find((h) => h.visible && isStrategyHandle(h)) ?? null;
    void strategyTester.bindStrategy(activeStrat);
}

function findSaveButton(): HTMLElement | null {
    const btns = document.querySelectorAll<HTMLElement>('.vela-widget-action, .vela-widget-tool');
    for (const b of btns) {
        if (b.textContent?.trim().includes('Save') || b.getAttribute('aria-label') === 'Save') {
            return b;
        }
    }
    return null;
}

function setSaveButtonFeedback(): void {
    const saveBtn = findSaveButton();
    if (!saveBtn) return;
    const textNode = Array.from(saveBtn.childNodes).find((n) => n.nodeType === Node.TEXT_NODE);
    if (textNode) {
        const originalText = textNode.textContent;
        textNode.textContent = ' Saved ✓';
        saveBtn.style.color = 'var(--vela-accent, #2962FF)';
        setTimeout(() => {
            textNode.textContent = originalText;
            saveBtn.style.color = '';
        }, 1500);
    } else {
        const orig = saveBtn.textContent;
        saveBtn.textContent = 'Saved ✓';
        saveBtn.style.color = 'var(--vela-accent, #2962FF)';
        setTimeout(() => {
            saveBtn.textContent = orig;
            saveBtn.style.color = '';
        }, 1500);
    }
}

export function saveAllCharts(ctx?: WidgetContext): void {
    try {
        // 1. Force flush workspace state
        const state = workspace.getState();
        const encoded = encodeState(state);
        localStorage.setItem('vela-workspace', encoded);

        // 2. Gather all custom script indicators and drawings across all cells
        const customScriptsByCell: Record<string, PersistedScriptItem[]> = {};
        const drawingsByCell: Record<string, unknown> = {};

        for (const cell of workspace.cells()) {
            const chart = cell.chart;
            const cellId = cell.id;

            if (chart.drawings) {
                try {
                    drawingsByCell[cellId] = chart.drawings.toJSON();
                } catch {
                    // best effort
                }
            }

            const scripts: PersistedScriptItem[] = [];

            for (const h of chart.indicators()) {
                if (h.source) {
                    scripts.push({
                        id: h.id,
                        title: h.title,
                        source: h.source,
                        visible: h.visible,
                        inputs: typeof h.inputValues === 'function' ? h.inputValues() : {},
                        props: typeof h.propValues === 'function' ? h.propValues() : {},
                    });
                }
            }
            if (scripts.length > 0) {
                customScriptsByCell[cellId] = scripts;
            }
        }

        const addonBackup: PersistedAddonState = {
            version: 1,
            timestamp: Date.now(),
            scripts: customScriptsByCell,
            drawings: drawingsByCell,
            strategyTester: {
                mode: strategyTester.getMode(),
                view: strategyTester.getView(),
                height: strategyTester.getHeight(),
            },
        };
        localStorage.setItem('vela-pinets-addon-state', JSON.stringify(addonBackup));

        // 3. Visual feedback
        setSaveButtonFeedback();

        // 4. Toast notification
        const msg = 'Saved all charts, drawings, and strategies';
        if (ctx) {
            ctx.toast(msg, 'success');
        } else if (typeof workspace.toast === 'function') {
            workspace.toast(msg, 'success');
        }
    } catch (err) {
        console.error('[vela-pinets] saveAllCharts failed:', err);
        const errMsg = 'Failed to save charts';
        if (ctx) ctx.toast(errMsg, 'error');
        else if (typeof workspace.toast === 'function') workspace.toast(errMsg, 'error');
    }
}

let autoSaveTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleAutoSave(): void {
    if (autoSaveTimer) clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
        autoSaveTimer = null;
        saveAllCharts();
    }, 600);
}

function attachChartSync(chart: Vela): () => void {
    const unsubs: Array<() => void> = [];
    unsubs.push(
        chart.on('indicator:added', () => {
            syncActiveStrategy();
            scheduleAutoSave();
        }),
    );
    unsubs.push(
        chart.on('indicator:removed', () => {
            syncActiveStrategy();
            scheduleAutoSave();
        }),
    );
    unsubs.push(
        chart.on('indicator:visibility', () => {
            syncActiveStrategy();
            scheduleAutoSave();
        }),
    );
    unsubs.push(
        chart.on('indicator:inputs', () => {
            syncActiveStrategy();
            scheduleAutoSave();
        }),
    );
    unsubs.push(chart.on('market:changed', () => syncActiveStrategy()));
    unsubs.push(chart.on('load:end', () => syncActiveStrategy()));
    unsubs.push(chart.on('drawing:created', () => scheduleAutoSave()));
    unsubs.push(chart.on('drawing:edited', () => scheduleAutoSave()));
    unsubs.push(chart.on('drawing:removed', () => scheduleAutoSave()));
    return () => {
        for (const u of unsubs) u();
    };
}

let cleanupCurrentChart: (() => void) | null = null;
function rebindActiveCell(): void {
    cleanupCurrentChart?.();
    const chart = workspace.active?.chart;
    if (chart) {
        cleanupCurrentChart = attachChartSync(chart);
    }
    syncActiveStrategy();
}

async function restoreSavedWorkspaceData(): Promise<void> {
    try {
        const raw = localStorage.getItem('vela-pinets-addon-state');
        if (!raw) return;
        const backup = JSON.parse(raw) as PersistedAddonState;
        if (!backup || typeof backup !== 'object') return;

        // Restore custom scripts for each cell
        if (backup.scripts && typeof backup.scripts === 'object') {
            for (const cell of workspace.cells()) {
                const cellScripts = backup.scripts[cell.id] || backup.scripts['c1'];
                if (Array.isArray(cellScripts)) {
                    for (const s of cellScripts) {
                        if (typeof s?.source !== 'string') continue;
                        const existing = cell.chart.indicators().find((i) => i.title === s.title || i.source === s.source);
                        if (!existing) {
                            try {
                                const res = await cell.chart.runIndicator(s.source);
                                if (res.ok && res.handle) {
                                    if (s.inputs && typeof res.handle.setInputs === 'function') {
                                        res.handle.setInputs(s.inputs);
                                    }
                                    if (s.props && typeof res.handle.setProps === 'function') {
                                        res.handle.setProps(s.props);
                                    }
                                    if (s.visible === false && typeof res.handle.setVisible === 'function') {
                                        res.handle.setVisible(false);
                                    }
                                }
                            } catch (e) {
                                console.warn('[vela-pinets] restore indicator failed:', e);
                            }
                        }
                    }
                }
            }
        }

        // Restore drawings if present
        if (backup.drawings && typeof backup.drawings === 'object') {
            for (const cell of workspace.cells()) {
                const cellDrawings = backup.drawings[cell.id] || backup.drawings['c1'];
                if (cellDrawings && cell.chart.drawings) {
                    try {
                        cell.chart.drawings.fromJSON(cellDrawings);
                    } catch (e) {
                        console.warn('[vela-pinets] restore drawings failed:', e);
                    }
                }
            }
        }

        // Restore Strategy Tester state
        if (backup.strategyTester && typeof backup.strategyTester === 'object') {
            const st = backup.strategyTester;
            if (typeof st.height === 'number') {
                strategyTester.setHeight(st.height);
            }
            if (st.view === 'chart' || st.view === 'table') {
                strategyTester.setView(st.view);
            }
            if (st.mode && st.mode !== 'hidden') {
                strategyTester.setMode(st.mode);
            }
        }

        rebindActiveCell();
        setTimeout(() => syncActiveStrategy(), 300);
        setTimeout(() => syncActiveStrategy(), 1000);
    } catch (err) {
        console.warn('[vela-pinets] restoreSavedWorkspaceData failed:', err);
    }
}

function initSaveTooltip(): void {
    const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
    const chordKbd = isMac ? '<kbd>⌘</kbd>' : '<kbd>Ctrl</kbd>';

    const styleEl = document.createElement('style');
    styleEl.textContent = `
        .vst-save-tooltip {
            position: fixed;
            z-index: 999999;
            background: #1e222d;
            border: 1px solid #363c4e;
            border-radius: 6px;
            padding: 6px 12px;
            color: #d1d4dc;
            font-size: 13px;
            line-height: 1.4;
            font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif;
            display: none;
            align-items: center;
            box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4), 0 2px 4px rgba(0, 0, 0, 0.2);
            pointer-events: none;
            white-space: nowrap;
        }
        .vst-save-tooltip::before {
            content: '';
            position: absolute;
            top: -5px;
            left: var(--vst-arrow-left, 50%);
            width: 8px;
            height: 8px;
            background: #1e222d;
            border-top: 1px solid #363c4e;
            border-left: 1px solid #363c4e;
            transform: translateX(-50%) rotate(45deg);
        }
        .vst-save-tt-text {
            color: #d1d4dc;
            font-size: 13px;
            font-weight: 400;
        }
        .vst-save-tt-divider {
            width: 1px;
            height: 16px;
            background: #363c4e;
            margin: 0 12px;
            flex-shrink: 0;
        }
        .vst-save-tt-shortcut {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            flex-shrink: 0;
        }
        .vst-save-tt-shortcut kbd {
            background: #2e2e2e;
            color: #d1d4dc;
            font-size: 11px;
            font-weight: 500;
            padding: 2px 6px;
            border-radius: 4px;
            border: 1px solid #383838;
            font-family: inherit;
            box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
        }
        .vst-save-tt-plus {
            color: #787b86;
            font-size: 11px;
            user-select: none;
        }
    `;
    document.head.appendChild(styleEl);

    const tooltipEl = document.createElement('div');
    tooltipEl.className = 'vst-save-tooltip';
    tooltipEl.innerHTML = `
        <span class="vst-save-tt-text">Save all charts for all symbols and intervals on your layout</span>
        <div class="vst-save-tt-divider"></div>
        <div class="vst-save-tt-shortcut">${chordKbd} <span class="vst-save-tt-plus">+</span> <kbd>S</kbd></div>
    `;
    document.body.appendChild(tooltipEl);

    function showTooltip(btn: HTMLElement) {
        const rect = btn.getBoundingClientRect();
        tooltipEl.style.display = 'flex';
        const ttRect = tooltipEl.getBoundingClientRect();
        let left = rect.left + rect.width / 2 - ttRect.width / 2;
        if (left + ttRect.width > window.innerWidth - 8) {
            left = window.innerWidth - ttRect.width - 8;
        }
        if (left < 8) left = 8;
        const top = rect.bottom + 8;
        tooltipEl.style.left = `${left}px`;
        tooltipEl.style.top = `${top}px`;
        const arrowOffset = rect.left + rect.width / 2 - left;
        tooltipEl.style.setProperty('--vst-arrow-left', `${arrowOffset}px`);
    }

    function hideTooltip() {
        tooltipEl.style.display = 'none';
    }

    function bindButton(btn: HTMLElement) {
        btn.addEventListener('mouseenter', () => showTooltip(btn));
        btn.addEventListener('mouseleave', hideTooltip);
        btn.addEventListener('focus', () => showTooltip(btn));
        btn.addEventListener('blur', hideTooltip);
    }

    function scan() {
        const btns = document.querySelectorAll<HTMLElement>('.vela-widget-action, .vela-widget-tool');
        for (const b of btns) {
            if (b.textContent?.trim().includes('Save') || b.getAttribute('aria-label') === 'Save') {
                if (!b.dataset.saveBound) {
                    b.dataset.saveBound = '1';
                    bindButton(b);
                }
            }
        }
    }

    scan();
    const obs = new MutationObserver(() => scan());
    obs.observe(document.body, { childList: true, subtree: true });
}

// Global keyboard shortcut
window.addEventListener(
    'keydown',
    (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
            e.preventDefault();
            e.stopPropagation();
            saveAllCharts();
        }
    },
    true,
);

// Auto-save on page unload
window.addEventListener('beforeunload', () => {
    saveAllCharts();
});

workspace.on('cell:active', () => rebindActiveCell());
workspace.on('script:run', () => syncActiveStrategy());
workspace.on('layout:changed', () => rebindActiveCell());
workspace.on('state:changed', () => scheduleAutoSave());

void workspace.cells()[0]?.chart.ready().then(async () => {
    console.log('[vela-pinets] chart ready — Pine served by the addon engine');
    rebindActiveCell();
    await restoreSavedWorkspaceData();
    initSaveTooltip();
});

