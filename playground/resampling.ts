import type { BarRange } from '@luxalgo/vela';
import type { OHLCV } from '@luxalgo/vela/plugin';

export interface SessionSymbolInfo {
    ticker: string;
    tickerid?: string;
    description?: string;
    type?: string;
    mintick?: number;
    pricescale?: number;
    timezone?: string;
    session?: string;
    session_extended?: string;
    [key: string]: unknown;
}

const nyFormatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York',
    hour12: false,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
});

export function isRegularTradingHour(timeMs: number): boolean {
    const parts = nyFormatter.formatToParts(new Date(timeMs));
    let weekday = '';
    let hour = 0;
    let minute = 0;
    for (const p of parts) {
        if (p.type === 'weekday') weekday = p.value;
        else if (p.type === 'hour') hour = Number(p.value);
        else if (p.type === 'minute') minute = Number(p.value);
    }
    if (weekday === 'Sat' || weekday === 'Sun') return false;
    const minutesOfDay = hour * 60 + minute;
    return minutesOfDay >= 570 && minutesOfDay < 960;
}

export interface ProviderBarRange extends BarRange {
    count?: number;
}

export interface ProviderSubscribeOpts {
    session?: string;
    [key: string]: unknown;
}

export function parseTimeframeSpec(timeframe: string): {
    isNative: boolean;
    bucketMs: number;
    baseTf: string;
    ratio: number;
} {
    const raw = timeframe.trim();
    if (raw === 'D') return { isNative: true, bucketMs: 86_400_000, baseTf: 'D', ratio: 1 };
    if (raw === 'W') return { isNative: true, bucketMs: 7 * 86_400_000, baseTf: 'W', ratio: 1 };
    if (raw === 'M') return { isNative: true, bucketMs: 30 * 86_400_000, baseTf: 'M', ratio: 1 };

    // Standard native minutes
    if (/^\d+$/.test(raw)) {
        const mins = parseInt(raw, 10);
        if ([1, 3, 5, 15, 30, 60, 120, 240, 360, 480, 720].includes(mins)) {
            return { isNative: true, bucketMs: mins * 60_000, baseTf: raw, ratio: 1 };
        }
        // Non-standard minutes (e.g. 7, 13, 45, 90)
        const baseMin = mins % 60 === 0 && mins > 60 ? 60 : 1;
        const ratio = mins / baseMin;
        return { isNative: false, bucketMs: mins * 60_000, baseTf: `${baseMin}`, ratio };
    }

    // Days (e.g. 2D, 3D, 5D)
    const dayMatch = /^(\d+)[dD]$/.exec(raw);
    if (dayMatch) {
        const d = parseInt(dayMatch[1]!, 10);
        if (d === 1) return { isNative: true, bucketMs: 86_400_000, baseTf: 'D', ratio: 1 };
        return { isNative: false, bucketMs: d * 86_400_000, baseTf: 'D', ratio: d };
    }

    // Weeks (e.g. 2W, 3W)
    const weekMatch = /^(\d+)[wW]$/.exec(raw);
    if (weekMatch) {
        const w = parseInt(weekMatch[1]!, 10);
        if (w === 1) return { isNative: true, bucketMs: 7 * 86_400_000, baseTf: 'W', ratio: 1 };
        return { isNative: false, bucketMs: w * 7 * 86_400_000, baseTf: 'W', ratio: w };
    }

    // Months (e.g. 2M, 3M)
    const monthMatch = /^(\d+)[mM]$/.exec(raw);
    if (monthMatch) {
        const m = parseInt(monthMatch[1]!, 10);
        if (m === 1) return { isNative: true, bucketMs: 30 * 86_400_000, baseTf: 'M', ratio: 1 };
        return { isNative: false, bucketMs: m * 30 * 86_400_000, baseTf: 'M', ratio: m };
    }

    // Hours (e.g. 2h, 3h, 5h)
    const hourMatch = /^(\d+)[hH]$/.exec(raw);
    if (hourMatch) {
        const h = parseInt(hourMatch[1]!, 10);
        const mins = h * 60;
        if ([60, 120, 240, 360, 480, 720].includes(mins)) {
            return { isNative: true, bucketMs: mins * 60_000, baseTf: `${mins}`, ratio: 1 };
        }
        return { isNative: false, bucketMs: mins * 60_000, baseTf: '60', ratio: h };
    }

    // Minutes with 'm' suffix (e.g. 7m, 13m)
    const minMatch = /^(\d+)m$/i.exec(raw);
    if (minMatch) {
        const mins = parseInt(minMatch[1]!, 10);
        if ([1, 3, 5, 15, 30].includes(mins)) {
            return { isNative: true, bucketMs: mins * 60_000, baseTf: `${mins}`, ratio: 1 };
        }
        return { isNative: false, bucketMs: mins * 60_000, baseTf: '1', ratio: mins };
    }

    return { isNative: true, bucketMs: 60_000, baseTf: raw, ratio: 1 };
}

export function resampleBars(bars: OHLCV[], bucketMs: number): OHLCV[] {
    const buckets = new Map<number, OHLCV>();
    for (const b of bars) {
        const bucketTime = Math.floor(b.time / bucketMs) * bucketMs;
        const cur = buckets.get(bucketTime);
        if (!cur) {
            buckets.set(bucketTime, {
                time: bucketTime,
                open: b.open,
                high: b.high,
                low: b.low,
                close: b.close,
                volume: b.volume ?? 0,
            });
        } else {
            cur.high = Math.max(cur.high, b.high);
            cur.low = Math.min(cur.low, b.low);
            cur.close = b.close;
            cur.volume = (cur.volume ?? 0) + (b.volume ?? 0);
        }
    }
    return [...buckets.values()].sort((a, b) => a.time - b.time);
}

export function wrapSessionProvider<
    T extends {
        getSymbolInfo?(ticker: string): Promise<SessionSymbolInfo | undefined>;
        getBars?(ticker: string, timeframe: string, range: ProviderBarRange): Promise<OHLCV[]>;
        subscribe?(
            ticker: string,
            timeframe: string,
            onBar: (bar: OHLCV) => void,
            opts?: ProviderSubscribeOpts,
        ): () => void;
    },
>(p: T): T {
    const origInfo = p.getSymbolInfo?.bind(p);
    p.getSymbolInfo = async (ticker: string): Promise<SessionSymbolInfo> => {
        const info = origInfo ? await origInfo(ticker).catch(() => undefined) : undefined;
        if (info) {
            return {
                ...info,
                session: '0930-1600',
                session_extended: '0400-2000',
                timezone: 'America/New_York',
            };
        }
        return {
            ticker,
            tickerid: ticker,
            description: ticker,
            type: 'crypto',
            mintick: 0.01,
            pricescale: 100,
            timezone: 'America/New_York',
            session: '0930-1600',
            session_extended: '0400-2000',
        };
    };

    const origGetBars = p.getBars?.bind(p);
    if (origGetBars) {
        p.getBars = async (ticker: string, timeframe: string, range: ProviderBarRange): Promise<OHLCV[]> => {
            const spec = parseTimeframeSpec(timeframe);
            const isIntraday = !timeframe.includes('D') && !timeframe.includes('W') && !timeframe.includes('M');

            if (spec.isNative) {
                if (range && range.session === 'regular' && isIntraday) {
                    const reqRange: ProviderBarRange = { ...range };
                    if (typeof reqRange.count === 'number') {
                        reqRange.count = Math.min(2500, reqRange.count * 4);
                    }
                    const rawBars = await origGetBars(ticker, timeframe, reqRange);
                    const filtered = rawBars.filter((b) => isRegularTradingHour(b.time));
                    return reqRange.count ? filtered.slice(-reqRange.count) : filtered;
                }
                const nativeBars = await origGetBars(ticker, timeframe, range);
                if (nativeBars && nativeBars.length > 0) return nativeBars;
            }

            // Resampling fallback for non-native custom timeframes (e.g. 7m, 13m, 2D, 3D)
            const subRange: ProviderBarRange = { ...range };
            if (typeof subRange.count === 'number') {
                subRange.count = Math.min(5000, Math.ceil(subRange.count * spec.ratio * 1.5));
            }
            if (range && range.session === 'regular' && isIntraday && typeof subRange.count === 'number') {
                subRange.count = Math.min(5000, subRange.count * 4);
            }

            const baseBars = await origGetBars(ticker, spec.baseTf, subRange);
            let processed = baseBars;
            if (range && range.session === 'regular' && isIntraday) {
                processed = processed.filter((b) => isRegularTradingHour(b.time));
            }
            const resampled = resampleBars(processed, spec.bucketMs);
            return range.count ? resampled.slice(-range.count) : resampled;
        };
    }

    const origSubscribe = p.subscribe?.bind(p);
    if (origSubscribe) {
        p.subscribe = (
            ticker: string,
            timeframe: string,
            onBar: (bar: OHLCV) => void,
            opts?: ProviderSubscribeOpts,
        ): (() => void) => {
            const spec = parseTimeframeSpec(timeframe);
            const isIntraday = !timeframe.includes('D') && !timeframe.includes('W') && !timeframe.includes('M');

            if (spec.isNative) {
                return origSubscribe(
                    ticker,
                    timeframe,
                    (bar: OHLCV) => {
                        if (opts?.session === 'regular' && isIntraday && !isRegularTradingHour(bar.time)) {
                            return;
                        }
                        onBar(bar);
                    },
                    opts,
                );
            }

            // Resample streaming sub-candles into target bucket
            let curBucket: OHLCV | null = null;
            return origSubscribe(
                ticker,
                spec.baseTf,
                (subBar: OHLCV) => {
                    if (opts?.session === 'regular' && isIntraday && !isRegularTradingHour(subBar.time)) {
                        return;
                    }
                    const bucketTime = Math.floor(subBar.time / spec.bucketMs) * spec.bucketMs;
                    if (!curBucket || curBucket.time !== bucketTime) {
                        curBucket = {
                            time: bucketTime,
                            open: subBar.open,
                            high: subBar.high,
                            low: subBar.low,
                            close: subBar.close,
                            volume: subBar.volume ?? 0,
                        };
                    } else {
                        curBucket.high = Math.max(curBucket.high, subBar.high);
                        curBucket.low = Math.min(curBucket.low, subBar.low);
                        curBucket.close = subBar.close;
                        curBucket.volume = (curBucket.volume ?? 0) + (subBar.volume ?? 0);
                    }
                    onBar({ ...curBucket });
                },
                opts,
            );
        };
    }

    return p;
}
