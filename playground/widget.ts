// The replacement proof, interactive form: Vela's own WORKSPACE playground page with
// the Pine engine coming from THIS package instead of Vela's in-tree one — same
// workspace, same providers (Binance, Coinbase, Hyperliquid), same manifest shape.
// Full Vela workspace features enabled: multi-chart layouts, shared drawing toolbar,
// user drawing tools, bottom bar, symbol watermark, multi-venue providers, live bar replay,
// and docked side panel + Code runner.
import { VelaWorkspace } from '@luxalgo/vela/workspace';
import { BinanceProvider } from '@luxalgo/vela/providers/binance';
import { CoinbaseProvider } from '@luxalgo/vela/providers/coinbase';
import { HyperliquidProvider } from '@luxalgo/vela/providers/hyperliquid';
import {
    registerWidgetAction,
    registerIcon,
    registerSidePanel,
    registerDefaultEngine,
    type WidgetContext,
} from '@luxalgo/vela/plugin';
import { Dialog } from '@luxalgo/vela/ui';
import { PineWorkerEngine } from '../src';

// App-wide default engine registration: any new chart or workspace cell automatically
// uses PineWorkerEngine for 'pine' scripts.
registerDefaultEngine('pine', () => new PineWorkerEngine());

// Worker-path instrumentation: count real Web Worker spawns so a browser probe can
// PROVE Pine runs off the main thread through the addon (window.__workerSpawns >= 1).
type PlaygroundDebugWindow = Window & { __workerSpawns: number; workspace?: VelaWorkspace };
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

// ── "Pine Scripts" docked side panel ──
registerSidePanel({
    id: 'pinets.scripts',
    title: 'Pine Scripts',
    icon: 'code',
    width: 320,
    resizable: true,
    mount: (ctx, body) => {
        body.style.cssText = 'padding:12px;display:flex;flex-direction:column;gap:10px;font-family:sans-serif;color:var(--vela-fg);';

        const intro = document.createElement('p');
        intro.style.cssText = 'margin:0;font-size:12px;color:var(--vela-fg-muted);line-height:1.4;';
        intro.textContent = 'Ready-to-use Pine Script templates. Click Apply to inject into the active chart:';
        body.appendChild(intro);

        const templates = [
            {
                name: 'EMA Ribbons (20/50/100/200)',
                script: `//@version=5
indicator("EMA Ribbon", overlay=true)
plot(ta.ema(close, 20), color=#00E676, title="EMA 20")
plot(ta.ema(close, 50), color=#2979FF, title="EMA 50")
plot(ta.ema(close, 100), color=#FF9100, title="EMA 100")
plot(ta.ema(close, 200), color=#FF1744, title="EMA 200")`,
            },
            {
                name: 'SuperTrend',
                script: `//@version=5
indicator("Supertrend", overlay=true)
[supertrend, direction] = ta.supertrend(3, 10)
plot(direction < 0 ? supertrend : na, "Up Trend", color=color.green, style=plot.style_linebr)
plot(direction > 0 ? supertrend : na, "Down Trend", color=color.red, style=plot.style_linebr)`,
            },
            {
                name: 'Stochastic Oscillator',
                script: `//@version=5
indicator("Stochastic", overlay=false)
k = ta.sma(ta.stoch(close, high, low, 14), 3)
d = ta.sma(k, 3)
plot(k, "%K", color=#2962FF)
plot(d, "%D", color=#FF6D00)
h0 = hline(80, "Upper", color=#787B86)
h1 = hline(20, "Lower", color=#787B86)
fill(h0, h1, color=color.rgb(33, 150, 243, 90))`,
            },
        ];

        for (const t of templates) {
            const card = document.createElement('div');
            card.style.cssText =
                'border:1px solid var(--vela-border-soft);border-radius:var(--vela-radius-md);padding:10px;background:var(--vela-surface-overlay);display:flex;flex-direction:column;gap:8px;';

            const title = document.createElement('div');
            title.style.cssText = 'font-weight:600;font-size:13px;';
            title.textContent = t.name;

            const btn = document.createElement('button');
            btn.textContent = 'Apply to Chart';
            btn.style.cssText =
                'all:unset;text-align:center;padding:5px 10px;border-radius:var(--vela-radius-sm);background:var(--vela-surface-elevated);border:1px solid var(--vela-border);font-size:11px;font-weight:600;cursor:pointer;';
            btn.onmouseenter = () => {
                btn.style.background = 'var(--vela-accent)';
                btn.style.color = '#0b0e14';
            };
            btn.onmouseleave = () => {
                btn.style.background = 'var(--vela-surface-elevated)';
                btn.style.color = 'inherit';
            };
            btn.onclick = async () => {
                btn.textContent = 'Applying…';
                const r = await ctx.chart.runIndicator(t.script);
                if (r.ok) {
                    btn.textContent = '✓ Applied';
                    ctx.toast(`Added ${t.name}`, 'success');
                    setTimeout(() => {
                        btn.textContent = 'Apply to Chart';
                    }, 2000);
                } else {
                    btn.textContent = 'Error';
                    ctx.toast(r.error!.message, 'error');
                }
            };

            card.append(title, btn);
            body.appendChild(card);
        }
    },
});

// The workspace is already built — project freshly registered actions + panels into its chrome.
workspace.refreshActions();
