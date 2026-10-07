// TradingView-style Floating Replay Bar & Interactive Candle Selector for Vela
// Primitives used:
// - `workspace.replay` / `chart.replay` (start, step, play, pause, stop, state, bounds)
// - `chart.renderer.set('crosshairOverride', ...)` (vertical blue cut line + shadeRight veil)
// - Draggable floating bar with Start bar, Play/Pause, Step, Speed, Time readout, Bars left, Pin, and Close

import type { VelaWorkspace } from '@luxalgo/vela/workspace';

const SPEED_PRESETS = [
    { label: '0.1x', intervalMs: 10_000 },
    { label: '0.2x', intervalMs: 5_000 },
    { label: '0.5x', intervalMs: 2_000 },
    { label: '1x', intervalMs: 1_000 },
    { label: '2x', intervalMs: 500 },
    { label: '3x', intervalMs: 333 },
    { label: '5x', intervalMs: 200 },
    { label: '10x', intervalMs: 100 },
];

function formatReplayTime(epochMs: number): string {
    const d = new Date(epochMs);
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const month = months[d.getUTCMonth()];
    const date = d.getUTCDate();
    const hours = String(d.getUTCHours()).padStart(2, '0');
    const minutes = String(d.getUTCMinutes()).padStart(2, '0');
    return `${month} ${date}, ${hours}:${minutes}`;
}

export class ReplayManager {
    private isSelecting = false;
    private selectionCleanup: (() => void) | null = null;
    private floatingBarEl: HTMLElement | null = null;
    private speedMenuEl: HTMLElement | null = null;
    private currentSpeedIndex = 3; // '1x' (1000ms) default
    private isPinned = false;

    // UI elements to update live
    private playBtn: HTMLButtonElement | null = null;
    private timeReadoutEl: HTMLElement | null = null;
    private remainingBadgeEl: HTMLElement | null = null;
    private speedBtnLabel: HTMLElement | null = null;

    private unsubs: Array<() => void> = [];

    constructor(private readonly workspace: VelaWorkspace) {
        this.bindWorkspaceEvents();
    }

    private bindWorkspaceEvents(): void {
        const replay = this.workspace.replay;
        if (!replay) return;

        this.unsubs.push(
            replay.on('replay:play', () => {
                this.updatePlayBtn(true);
            }),
            replay.on('replay:pause', () => {
                this.updatePlayBtn(false);
            }),
            replay.on('replay:step', (e) => {
                this.updateReadouts(e.cursorTime, e.remaining);
            }),
            replay.on('replay:tick', (e) => {
                this.updateReadouts(e.cursorTime, replay.state.remaining);
            }),
            replay.on('replay:start', (e) => {
                this.showFloatingBar();
                this.updatePlayBtn(replay.state.playing);
                this.updateReadouts(e.cursorTime, e.remaining);
            }),
            replay.on('replay:end', () => {
                this.hideFloatingBar();
                this.cancelSelecting();
            }),
        );
    }

    /** Primary trigger when user clicks the Replay button in the topbar */
    toggleReplay(): void {
        const replay = this.workspace.replay;
        if (!replay) return;

        if (this.isSelecting) {
            this.cancelSelecting();
            return;
        }

        if (replay.state.active) {
            // Already active: if floating bar hidden, show it; else re-enter start bar selection
            if (!this.floatingBarEl || this.floatingBarEl.style.display === 'none') {
                this.showFloatingBar();
            } else {
                this.promptStartBarSelection();
            }
            return;
        }

        // Not active yet: initiate candle cut point selection
        this.promptStartBarSelection();
    }

    /** Activate interactive candle selection with blue vertical cut line and right shading */
    promptStartBarSelection(): void {
        const activeCell = this.workspace.active;
        if (!activeCell) return;

        const chart = activeCell.chart;
        const bounds = chart.replay.bounds;
        if (!bounds || bounds.last <= bounds.first) {
            this.workspace.toast('Not enough history to replay', 'error');
            return;
        }

        // Cancel previous selection if any
        this.cancelSelecting();
        this.isSelecting = true;

        // Pause current replay if it was playing
        if (this.workspace.replay.state.playing) {
            this.workspace.replay.pause();
        }

        // 1. Set crosshairOverride with vertical cut line and right-side shade
        chart.renderer.set('crosshairOverride', {
            vertical: true,
            horizontal: false,
            color: '#2962ff',
            width: 2,
            style: 'solid',
            opacity: 1,
            shadeRight: { color: 'rgba(0, 0, 0, 0.55)', opacity: 0.55 },
        });

        // 2. Track candle under cursor
        let hoveredTime: number | null = null;
        const unsubCrosshair = chart.renderer.onCrosshairMove((e) => {
            if (typeof e.time === 'number') {
                hoveredTime = e.time;
            }
        });

        // 3. Floating tooltip hint attached to chart
        const root = document.querySelector('.vela-workspace-root') || activeCell.host;
        const doc = root.ownerDocument;
        this.injectStyles(doc);

        const hintEl = doc.createElement('div');
        hintEl.className = 'vela-replay-hint';
        hintEl.innerHTML = `<span>Select a bar to start replay</span><button type="button" class="vela-replay-hint-close" title="Cancel selection">✕</button>`;
        root.appendChild(hintEl);

        const onHintClose = (e: MouseEvent): void => {
            e.stopPropagation();
            this.cancelSelecting();
        };
        hintEl.querySelector('.vela-replay-hint-close')?.addEventListener('click', onHintClose as EventListener);

        // 4. Capture click on chart to confirm cut point
        const onChartClick = (e: MouseEvent): void => {
            // Ignore if clicked on the hint or floating bar
            if ((e.target as HTMLElement).closest?.('.vela-replay-hint, .vela-replay-bar')) {
                return;
            }
            e.stopPropagation();
            e.preventDefault();

            if (hoveredTime != null) {
                const targetTime = hoveredTime;
                this.cancelSelecting();
                void this.startReplayAt(targetTime);
            }
        };

        // 5. Escape key to cancel
        const onKeyDown = (e: KeyboardEvent): void => {
            if (e.key === 'Escape') {
                this.cancelSelecting();
            }
        };

        const unsubClick = chart.renderer.onClick((e) => {
            const targetTime = e.time ?? hoveredTime;
            if (targetTime != null) {
                this.cancelSelecting();
                void this.startReplayAt(targetTime);
            }
        });

        const chartHost = activeCell.host;
        chartHost.addEventListener('click', onChartClick, { capture: true });
        doc.addEventListener('keydown', onKeyDown);

        this.selectionCleanup = () => {
            this.isSelecting = false;
            chart.renderer.set('crosshairOverride', null);
            unsubCrosshair();
            unsubClick();
            chartHost.removeEventListener('click', onChartClick, { capture: true });
            doc.removeEventListener('keydown', onKeyDown);
            hintEl.remove();
        };
    }

    cancelSelecting(): void {
        if (this.selectionCleanup) {
            this.selectionCleanup();
            this.selectionCleanup = null;
        }
        this.isSelecting = false;
    }

    async startReplayAt(time: number): Promise<void> {
        const replay = this.workspace.replay;
        if (!replay) return;

        try {
            await replay.start({ from: time });
            const s = replay.state;
            this.showFloatingBar();
            this.updateReadouts(s.cursorTime ?? time, s.remaining);
            this.updatePlayBtn(false);
        } catch (err) {
            console.error('[vela-pinets] replay start failed:', err);
        }
    }

    private showFloatingBar(): void {
        if (!this.floatingBarEl) {
            this.buildFloatingBar();
        }
        if (this.floatingBarEl) {
            this.floatingBarEl.style.display = 'flex';
        }
    }

    private hideFloatingBar(): void {
        if (this.floatingBarEl) {
            this.floatingBarEl.style.display = 'none';
        }
        this.closeSpeedMenu();
    }

    private updatePlayBtn(playing: boolean): void {
        if (!this.playBtn) return;
        if (playing) {
            this.playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="0.5"/><rect x="9" y="3" width="3" height="10" rx="0.5"/></svg>`;
            this.playBtn.title = 'Pause (Space)';
        } else {
            this.playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><polygon points="5,3 13,8 5,13"/></svg>`;
            this.playBtn.title = 'Play (Space)';
        }
    }

    private updateReadouts(cursorTime: number | null, remaining: number): void {
        if (this.timeReadoutEl && cursorTime != null) {
            this.timeReadoutEl.textContent = formatReplayTime(cursorTime);
        }
        if (this.remainingBadgeEl) {
            this.remainingBadgeEl.textContent = `${remaining} bars left`;
        }
    }

    private buildFloatingBar(): void {
        const root = document.querySelector('.vela-workspace-root') || document.getElementById('chart') || document.body;
        const doc = root.ownerDocument;

        this.injectStyles(doc);

        const bar = doc.createElement('div');
        bar.className = 'vela-replay-bar';
        this.floatingBarEl = bar;

        // 1. Drag handle
        const handle = doc.createElement('div');
        handle.className = 'vela-rb-handle';
        handle.title = 'Drag to move';
        handle.innerHTML = `<svg width="12" height="14" viewBox="0 0 12 14" fill="currentColor"><circle cx="4" cy="3" r="1.2"/><circle cx="8" cy="3" r="1.2"/><circle cx="4" cy="7" r="1.2"/><circle cx="8" cy="7" r="1.2"/><circle cx="4" cy="11" r="1.2"/><circle cx="8" cy="11" r="1.2"/></svg>`;
        this.enableDrag(bar, handle);

        // 2. Start bar button
        const startBarBtn = doc.createElement('button');
        startBarBtn.type = 'button';
        startBarBtn.className = 'vela-rb-btn vela-rb-startbar-btn vela-rb-start-bar';
        startBarBtn.title = 'Jump to a new start bar';
        startBarBtn.innerHTML = `<svg width="13" height="13" viewBox="0 0 16 16" fill="currentColor"><rect x="3" y="3" width="2" height="10" rx="0.5"/><polygon points="13,3 6,8 13,13"/></svg><span>Start bar</span>`;
        startBarBtn.onclick = () => {
            this.promptStartBarSelection();
        };

        // 3. Play / Pause button
        const playBtn = doc.createElement('button');
        playBtn.type = 'button';
        playBtn.className = 'vela-rb-btn vela-rb-play-btn';
        playBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><polygon points="5,3 13,8 5,13"/></svg>`;
        playBtn.title = 'Play (Space)';
        playBtn.onclick = () => {
            const replay = this.workspace.replay;
            if (replay.state.playing) {
                replay.pause();
            } else {
                const interval = SPEED_PRESETS[this.currentSpeedIndex]?.intervalMs ?? 1000;
                replay.play(interval);
            }
        };
        this.playBtn = playBtn;

        // 4. Step forward button
        const stepBtn = doc.createElement('button');
        stepBtn.type = 'button';
        stepBtn.className = 'vela-rb-btn vela-rb-step-btn';
        stepBtn.title = 'Forward one bar (Shift+F)';
        stepBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><polygon points="3,3 10,8 3,13"/><rect x="11" y="3" width="2" height="10" rx="0.5"/></svg>`;
        stepBtn.onclick = () => {
            this.workspace.replay.step();
        };

        // Divider
        const div1 = doc.createElement('div');
        div1.className = 'vela-rb-divider';

        // 5. Speed selector button
        const speedBtn = doc.createElement('button');
        speedBtn.type = 'button';
        speedBtn.className = 'vela-rb-btn vela-rb-speed-btn';
        const speedLabel = doc.createElement('span');
        speedLabel.textContent = SPEED_PRESETS[this.currentSpeedIndex]?.label ?? '1x';
        this.speedBtnLabel = speedLabel;
        speedBtn.append(speedLabel);
        speedBtn.insertAdjacentHTML('beforeend', `<svg width="10" height="10" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 6l4 4 4-4"/></svg>`);
        speedBtn.onclick = (e) => {
            e.stopPropagation();
            this.toggleSpeedMenu(speedBtn);
        };

        // Divider
        const div2 = doc.createElement('div');
        div2.className = 'vela-rb-divider';

        // 6. Time readout
        const timeReadout = doc.createElement('div');
        timeReadout.className = 'vela-rb-readout-time';
        timeReadout.textContent = '--';
        this.timeReadoutEl = timeReadout;

        // 7. Remaining bars badge
        const remainingBadge = doc.createElement('div');
        remainingBadge.className = 'vela-rb-readout-bars';
        remainingBadge.textContent = '0 bars left';
        this.remainingBadgeEl = remainingBadge;

        // 8. Pin button
        const pinBtn = doc.createElement('button');
        pinBtn.type = 'button';
        pinBtn.className = 'vela-rb-btn vela-rb-pin-btn';
        pinBtn.title = 'Pin toolbar position';
        pinBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4"><path d="M9.5 2.5l4 4-2 2-1-1-3 3v3l-1.5-1.5L6 9l-3 3-1-1 3-3-2.5-.5 1.5-1.5h3l3-3-1-1 2-2z"/></svg>`;
        pinBtn.onclick = () => {
            this.isPinned = !this.isPinned;
            pinBtn.classList.toggle('is-pinned', this.isPinned);
        };

        // 9. Close button
        const closeBtn = doc.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'vela-rb-btn vela-rb-close-btn';
        closeBtn.title = 'Exit replay';
        closeBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 4l8 8M12 4l-8 8"/></svg>`;
        closeBtn.onclick = () => {
            this.workspace.replay.stop();
            this.workspace.toast('Replay stopped — live stream restored', 'info');
        };

        bar.append(handle, startBarBtn, playBtn, stepBtn, div1, speedBtn, div2, timeReadout, remainingBadge, pinBtn, closeBtn);
        root.appendChild(bar);

        // Global key shortcut: Space toggles play/pause while replay active
        doc.addEventListener('keydown', (e) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
            if (e.code === 'Space' && this.workspace.replay.state.active) {
                e.preventDefault();
                const replay = this.workspace.replay;
                if (replay.state.playing) replay.pause();
                else replay.play(SPEED_PRESETS[this.currentSpeedIndex]?.intervalMs ?? 1000);
            }
        });
    }

    private toggleSpeedMenu(anchor: HTMLElement): void {
        if (this.speedMenuEl) {
            this.closeSpeedMenu();
            return;
        }

        const doc = anchor.ownerDocument;
        const menu = doc.createElement('div');
        menu.className = 'vela-rb-speed-menu';

        SPEED_PRESETS.forEach((preset, idx) => {
            const item = doc.createElement('div');
            item.className = 'vela-rb-speed-item' + (idx === this.currentSpeedIndex ? ' is-active' : '');
            item.textContent = preset.label;
            item.onclick = (e) => {
                e.stopPropagation();
                this.currentSpeedIndex = idx;
                if (this.speedBtnLabel) {
                    this.speedBtnLabel.textContent = preset.label;
                }
                const replay = this.workspace.replay;
                if (replay.state.playing) {
                    replay.play(preset.intervalMs);
                }
                this.closeSpeedMenu();
            };
            menu.appendChild(item);
        });

        // Position above the speed button
        const rect = anchor.getBoundingClientRect();
        menu.style.position = 'fixed';
        menu.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        menu.style.left = `${rect.left + rect.width / 2 - 40}px`;

        doc.body.appendChild(menu);
        this.speedMenuEl = menu;

        const onOutside = (e: MouseEvent): void => {
            if (!menu.contains(e.target as Node) && !anchor.contains(e.target as Node)) {
                this.closeSpeedMenu();
            }
        };
        setTimeout(() => doc.addEventListener('click', onOutside, { once: true }), 0);
    }

    private closeSpeedMenu(): void {
        if (this.speedMenuEl) {
            this.speedMenuEl.remove();
            this.speedMenuEl = null;
        }
    }

    private enableDrag(bar: HTMLElement, handle: HTMLElement): void {
        let isDragging = false;
        let startX = 0;
        let startY = 0;
        let initialLeft = 0;
        let initialTop = 0;

        handle.addEventListener('pointerdown', (e: PointerEvent) => {
            e.preventDefault();
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;

            const rect = bar.getBoundingClientRect();
            // Convert from transform center to absolute pixel position
            bar.style.transform = 'none';
            bar.style.left = `${rect.left}px`;
            bar.style.top = `${rect.top}px`;
            bar.style.bottom = 'auto';

            initialLeft = rect.left;
            initialTop = rect.top;

            handle.setPointerCapture(e.pointerId);
            bar.classList.add('is-dragging');
        });

        handle.addEventListener('pointermove', (e: PointerEvent) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;

            let newLeft = initialLeft + dx;
            let newTop = initialTop + dy;

            // Clamp inside viewport
            const maxW = window.innerWidth - bar.offsetWidth - 8;
            const maxH = window.innerHeight - bar.offsetHeight - 8;
            newLeft = Math.max(8, Math.min(maxW, newLeft));
            newTop = Math.max(8, Math.min(maxH, newTop));

            bar.style.left = `${newLeft}px`;
            bar.style.top = `${newTop}px`;
        });

        const stopDrag = (e: PointerEvent): void => {
            if (!isDragging) return;
            isDragging = false;
            bar.classList.remove('is-dragging');
            try {
                handle.releasePointerCapture(e.pointerId);
            } catch {}
        };

        handle.addEventListener('pointerup', stopDrag);
        handle.addEventListener('pointercancel', stopDrag);
    }

    private injectStyles(doc: Document): void {
        const styleId = 'vela-replay-bar-styles';
        if (doc.getElementById(styleId)) return;

        const style = doc.createElement('style');
        style.id = styleId;
        style.textContent = `
.vela-replay-hint {
    position: fixed;
    top: 56px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(19, 23, 34, 0.94);
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    border: 1px solid var(--vela-border, #2a2e39);
    color: var(--vela-fg-bright, #f0f3fa);
    padding: 6px 14px;
    border-radius: 20px;
    font-size: 13px;
    font-weight: 500;
    display: flex;
    align-items: center;
    gap: 12px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5);
    z-index: 10000;
    pointer-events: auto;
    animation: velaFadeIn 150ms ease;
}
.vela-replay-hint-close {
    all: unset;
    cursor: pointer;
    color: var(--vela-fg-muted, #787b86);
    font-size: 13px;
    line-height: 1;
    padding: 2px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
}
.vela-replay-hint-close:hover {
    color: var(--vela-fg-bright, #f0f3fa);
}

.vela-replay-bar {
    position: fixed;
    bottom: 44px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 4px 8px;
    background: rgba(19, 23, 34, 0.94);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border: 1px solid var(--vela-border, #2a2e39);
    border-radius: 8px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    z-index: 998;
    color: var(--vela-fg, #d1d4dc);
    font-size: 13px;
    user-select: none;
    transition: opacity 120ms ease;
}
.vela-replay-bar.is-dragging {
    opacity: 0.92;
    cursor: grabbing;
}

.vela-rb-handle {
    cursor: grab;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 6px 3px;
    color: var(--vela-fg-muted, #787b86);
    transition: color 120ms ease;
}
.vela-rb-handle:hover {
    color: var(--vela-fg-bright, #f0f3fa);
}

.vela-rb-btn {
    all: unset;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 28px;
    padding: 0 7px;
    border-radius: 5px;
    font-size: 13px;
    font-weight: 500;
    color: var(--vela-fg, #d1d4dc);
    transition: background 100ms ease, color 100ms ease;
}
.vela-rb-btn:hover {
    background: var(--vela-hover, rgba(255, 255, 255, 0.08));
    color: var(--vela-fg-bright, #f0f3fa);
}
.vela-rb-startbar-btn {
    padding: 0 8px;
}
.vela-rb-speed-btn {
    gap: 4px;
    padding: 0 8px;
}
.vela-rb-pin-btn.is-pinned {
    color: #2962ff;
}

.vela-rb-divider {
    width: 1px;
    height: 16px;
    background: var(--vela-border, #2a2e39);
    margin: 0 2px;
}

.vela-rb-readout-time {
    padding: 0 6px;
    font-size: 12.5px;
    font-weight: 500;
    color: var(--vela-fg-bright, #f0f3fa);
    white-space: nowrap;
}
.vela-rb-readout-bars {
    padding: 0 6px;
    font-size: 12px;
    color: var(--vela-fg-muted, #787b86);
    white-space: nowrap;
}

.vela-rb-speed-menu {
    background: var(--vela-surface-elev, #1e222d);
    border: 1px solid var(--vela-border, #2a2e39);
    border-radius: 6px;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
    padding: 4px 0;
    z-index: 1001;
    min-width: 80px;
    animation: velaFadeIn 100ms ease;
}
.vela-rb-speed-item {
    padding: 6px 14px;
    font-size: 12.5px;
    cursor: pointer;
    color: var(--vela-fg, #d1d4dc);
    transition: background 100ms ease, color 100ms ease;
}
.vela-rb-speed-item:hover {
    background: var(--vela-hover, rgba(255, 255, 255, 0.08));
    color: var(--vela-fg-bright, #f0f3fa);
}
.vela-rb-speed-item.is-active {
    color: #2962ff;
    font-weight: 600;
}

@keyframes velaFadeIn {
    from { opacity: 0; transform: translateY(4px); }
    to { opacity: 1; transform: translateY(0); }
}
`;
        doc.head.appendChild(style);
    }

    destroy(): void {
        this.cancelSelecting();
        this.hideFloatingBar();
        this.floatingBarEl?.remove();
        this.unsubs.forEach((u) => u());
        this.unsubs = [];
    }
}
