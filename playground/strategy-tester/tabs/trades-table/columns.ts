import type { TradesColumnKey } from '../../types';

export interface ColumnDefinition {
    key: TradesColumnKey;
    label: string;
}

export const TRADES_COLUMNS: ColumnDefinition[] = [
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

export function createDefaultActiveColumns(): Record<TradesColumnKey, boolean> {
    return {
        dateTime: true,
        signal: false,
        price: true,
        size: true,
        netPnl: true,
        returnPct: true,
        commission: false,
        favorableExcursion: false,
        adverseExcursion: false,
        cumPnl: false,
        duration: false,
    };
}
