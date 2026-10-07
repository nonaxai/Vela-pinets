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
    registerLegendAction,
    registerDefaultEngine,
    registerStatePersistence,
    type WidgetContext,
    type CellStateContext,
    type InputValue,
    type IndicatorStyleSettings,
    type IndicatorVisibilitySettings,
} from '@luxalgo/vela/plugin';
import { PineWorkerEngine } from '../src';
import { mountPineEditor, scriptStore } from './pine-editor';
import { StrategyTester } from './strategy-tester';
import { CustomTimeframeManager } from './custom-timeframe';
import { mountWatchlistPanel } from './watchlist-panel';
import { ReplayManager } from './replay-bar';
import { wrapSessionProvider } from './resampling';
import type { IndicatorHandle, Vela } from '@luxalgo/vela';

interface PersistedScriptItem {
    id: string;
    title: string;
    source: string;
    visible: boolean;
    inputs?: Record<string, InputValue>;
    props?: Record<string, InputValue>;
    styleSettings?: IndicatorStyleSettings;
    visibilitySettings?: IndicatorVisibilitySettings;
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
                    styleSettings: typeof h.styleSettings === 'function' ? h.styleSettings() : undefined,
                    visibilitySettings: typeof h.visibilitySettings === 'function' ? h.visibilitySettings() : undefined,
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
                            if (s.styleSettings && typeof res.handle.setStyleSettings === 'function') {
                                res.handle.setStyleSettings(s.styleSettings);
                            }
                            if (s.visibilitySettings && typeof res.handle.setVisibilitySettings === 'function') {
                                res.handle.setVisibilitySettings(s.visibilitySettings);
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

    // Multi-venue data feeds ready to query (decorated with session metadata so RTH / ETH is available):
    providers: {
        binance: () => wrapSessionProvider(new BinanceProvider()),
        coinbase: () => wrapSessionProvider(new CoinbaseProvider()),
        hyperliquid: () => wrapSessionProvider(new HyperliquidProvider()),
    },

    engines: { pine: () => new PineWorkerEngine() }, // Pine served off the main thread

    topbar: {
        right: ['pinets.save', 'session', 'alerts', 'settings', 'screenshot', 'panels'],
    },

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
len = input.int(20, title="Length")
src = input.source(close, title="Source")
plot(ta.ema(src, len), title="EMA", color=color.orange, linewidth=2)`,
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
        {
            name: 'RSI Strategy',
            enabled: false,
            script: `//@version=5
strategy("RSI Strategy", overlay=false, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)
length = input.int(14, title="RSI Length")
overbought = input.int(70, title="Overbought Level")
oversold = input.int(30, title="Oversold Level")
vrsi = ta.rsi(close, length)
if (ta.crossover(vrsi, oversold))
    strategy.entry("RSI Long", strategy.long)
if (ta.crossunder(vrsi, overbought))
    strategy.entry("RSI Short", strategy.short)
plot(vrsi, title="RSI", color=color.purple, linewidth=2)
h1 = hline(overbought, "Overbought", color=color.red, linestyle=hline.style_dashed)
h2 = hline(oversold, "Oversold", color=color.green, linestyle=hline.style_dashed)`,
        },
        {
            name: 'Bollinger Bands Strategy',
            enabled: false,
            script: `//@version=5
strategy("Bollinger Bands Strategy", overlay=true, initial_capital=10000, default_qty_type=strategy.percent_of_equity, default_qty_value=10)
length = input.int(20, title="Length")
mult = input.float(2.0, title="StdDev")
[basis, upper, lower] = ta.bb(close, length, mult)
if (ta.crossover(close, lower))
    strategy.entry("BB Long", strategy.long)
if (ta.crossunder(close, upper))
    strategy.close("BB Long")
plot(basis, color=color.orange, title="Basis")
p1 = plot(upper, color=color.teal, title="Upper")
p2 = plot(lower, color=color.teal, title="Lower")
fill(p1, p2, color=color.rgb(0, 150, 136, 90))`,
        },
    ],

    // User's custom scripts ('My scripts') wired from Pine Editor
    myScripts: () => {
        return scriptStore.getScripts().map((s) => ({
            id: s.id,
            name: s.name,
            script: s.content,
            language: 'pine',
            sourceType: 'myscripts' as const,
            author: 'My scripts',
            isStrategy: /^\s*strategy\s*\(/m.test(s.content) || /strategy/i.test(s.name),
        }));
    },
    onAddScript: (script) => {
        if (!script.script) return;
        const activeCell = workspace.active;
        if (activeCell) {
            activeCell.addExternalIndicator({
                name: script.name,
                script: script.script,
                language: script.language,
            });
            setTimeout(() => syncActiveStrategy(), 60);
        }
    },
});

// Fallback global helper for indicator picker
(window as unknown as { __getVelaMyScripts: () => unknown[] }).__getVelaMyScripts = () => {
    return scriptStore.getScripts().map((s) => ({
        id: s.id,
        name: s.name,
        script: s.content,
        language: 'pine',
        sourceType: 'myscripts',
        author: 'My scripts',
        isStrategy: /^\s*strategy\s*\(/m.test(s.content) || /strategy/i.test(s.name),
    }));
};

void workspace.cells()[0]?.chart.ready().then(() => console.log('[vela-pinets] chart ready — Pine served by the addon engine'));

// Playground-only debug handle: expose the workspace for console poking.
debugWin.workspace = workspace;
const customTfManager = new CustomTimeframeManager(workspace);
(debugWin as unknown as { customTfManager: CustomTimeframeManager }).customTfManager = customTfManager;
const replayManager = new ReplayManager(workspace);
(debugWin as unknown as { replayManager: ReplayManager }).replayManager = replayManager;

// Ensure RTH / ETH toggle is displayed and interactive
function ensureSessionControls(): void {
    const sessionEls = document.querySelectorAll<HTMLElement>('.vela-topbar-session, .vela-bb-session');
    sessionEls.forEach((sessionEl) => {
        sessionEl.style.display = 'inline-flex';
        const btns = sessionEl.querySelectorAll<HTMLButtonElement>('.vela-topbar-session-btn, .vela-bb-session-btn');
        btns.forEach((b) => {
            b.disabled = false;
        });
    });
}
setTimeout(ensureSessionControls, 100);
setTimeout(ensureSessionControls, 500);
setTimeout(ensureSessionControls, 1500);

// ── Icons registration ──
registerIcon(
    'code',
    '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="m5.5 4.5-4 3.5 4 3.5M10.5 4.5l4 3.5-4 3.5"/></svg>',
);
registerIcon(
    'cloud-save',
    '<svg viewBox="0 0 16 16" width="1.1em" height="1.1em" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M4.5 13.5h7a3.5 3.5 0 0 0 1.5-6.66A4.5 4.5 0 0 0 4.5 6.5a3 3 0 0 0 0 7z"/><path d="M8 8.5v4M6.5 10l1.5-1.5 1.5 1.5"/></svg>',
);
registerIcon(
    'watchlist',
    '<svg viewBox="0 0 16 16" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 2.5h9a1 1 0 0 1 1 1v11l-4.5-2.5-4.5 2.5v-11a1 1 0 0 1 1-1z"/><path d="M5.5 5.5h5M5.5 8h3"/></svg>',
);

// ── "Replay" topbar entry — Bar Replay across the workspace ──
registerWidgetAction({
    id: 'pinets.replay',
    target: 'topbar',
    label: 'Bar Replay',
    icon: 'replay',
    order: 5,
    align: 'left',
    run: () => {
        replayManager.toggleReplay();
    },
});

// ── Indicator Legend "<>" Code action: opens script in Pine Scripts tab ──
registerLegendAction({
    id: 'pinets.source',
    icon: 'code',
    tooltip: 'Source code',
    order: -5,
    when: (ind) => Boolean(ind.source || scriptStore.getScripts().some((s) => s.name.toLowerCase() === ind.title.toLowerCase())),
    run: (ctx, ind) => {
        void (async () => {
            await scriptStore.openOrLoadScript(ind.title, ind.source);
            ctx.togglePanel('pinets.scripts', true);
        })();
    },
});

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

// ── "Watchlist" docked side panel ──
registerSidePanel({
    id: 'watchlist',
    title: 'Watchlist',
    icon: 'watchlist',
    order: 5,
    width: 320,
    minWidth: 260,
    maxWidth: 500,
    resizable: true,
    mount: (ctx, body, header) => mountWatchlistPanel(ctx, body, header),
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
                        styleSettings: typeof h.styleSettings === 'function' ? h.styleSettings() : undefined,
                        visibilitySettings: typeof h.visibilitySettings === 'function' ? h.visibilitySettings() : undefined,
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
        chart.on('indicator:style', () => {
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
                                    if (s.styleSettings && typeof res.handle.setStyleSettings === 'function') {
                                        res.handle.setStyleSettings(s.styleSettings);
                                    }
                                    if (s.visibilitySettings && typeof res.handle.setVisibilitySettings === 'function') {
                                        res.handle.setVisibilitySettings(s.visibilitySettings);
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
        .vela-widget-action {
            all: unset;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
            height: 26px;
            padding: 0 10px;
            border-radius: 4px;
            cursor: pointer;
            background: rgba(255, 255, 255, 0.05);
            border: 1px solid #363c4e;
            color: #d1d4dc;
            font-size: 12px;
            font-weight: 500;
            font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif;
            transition: background 120ms ease, border-color 120ms ease, color 120ms ease;
            user-select: none;
            box-sizing: border-box;
        }
        .vela-widget-action:hover {
            background: rgba(255, 255, 255, 0.1);
            border-color: rgba(255, 255, 255, 0.2);
            color: #ffffff;
        }
        .vela-widget-action:active {
            background: rgba(255, 255, 255, 0.15);
        }
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

