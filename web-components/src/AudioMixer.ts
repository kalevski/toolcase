import { patchHtml } from './internal/patch-html'
import { esc } from './internal/esc'
import { Play, VolumeX, Headphones, Plus, Trash2, Scissors } from 'lucide-static'
import { icon } from './icons'

const TAG_NAME = 'tc-audio-mixer'

// Horizontal scale: pixels rendered per millisecond of timeline.
const PX_PER_MS = 0.05
// Track-lane / header height and ruler height, kept in lockstep so the header
// column lines up with the timeline lanes row-for-row.
const TRACK_H = 64
const RULER_H = 28
// Minimum clip length (ms) a resize may shrink to, and the default empty span.
const MIN_CLIP_MS = 100
const MIN_TIMELINE_MS = 10000

export const EFFECT_TYPES = ['gain', 'eq', 'reverb', 'delay'] as const
export type AudioEffectType = (typeof EFFECT_TYPES)[number]

const EFFECT_DEFAULTS: Record<AudioEffectType, Record<string, number>> = {
    gain: { gain_db: 0 },
    eq: { low_db: 0, mid_db: 0, high_db: 0 },
    reverb: { mix: 0.2, decay_s: 1.8 },
    delay: { time_ms: 250, feedback: 0.3, mix: 0.2 },
}

export interface AudioMixerEffect {
    id: string
    type: string
    params?: Record<string, number>
}

export interface AudioMixerClip {
    id: string
    startMs: number
    lengthMs: number
    label?: string
    effects?: AudioMixerEffect[]
}

export interface AudioMixerTrack {
    id: string
    name: string
    muted?: boolean
    solo?: boolean
    volume?: number
    clips: AudioMixerClip[]
}

export interface AudioMixerDocument {
    durationMs: number
    tracks: AudioMixerTrack[]
}

export interface AudioMixerSelectionState {
    trackId?: string | null
    clipId?: string | null
}

export interface AudioMixerActions {
    addTrack?: () => void
    removeTrack?: (trackId: string) => void
    toggleMute?: (trackId: string, muted: boolean) => void
    toggleSolo?: (trackId: string, solo: boolean) => void
    setVolume?: (trackId: string, volume: number) => void
    moveClip?: (clipId: string, startMs: number) => void
    resizeClip?: (clipId: string, lengthMs: number) => void
    selectClip?: (trackId: string | null, clipId: string | null) => void
    addEffect?: (trackId: string | null, clipId: string | null, effect: AudioMixerEffect) => void
    removeEffect?: (trackId: string | null, clipId: string | null, effect: AudioMixerEffect) => void
}

const EMPTY_DOCUMENT: AudioMixerDocument = { durationMs: 0, tracks: [] }

let _fxSeq = 0

function clamp(v: number, lo: number, hi: number): number {
    return Math.min(Math.max(v, lo), hi)
}

function formatTime(ms: number): string {
    const total = Math.max(0, Math.round(ms))
    const m = Math.floor(total / 60000)
    const s = Math.floor((total % 60000) / 1000)
    const cs = Math.floor((total % 1000) / 10)
    return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

const playIcon = icon(Play, 'tc-audio-mixer-icon')
const muteIcon = icon(VolumeX, 'tc-audio-mixer-icon')
const soloIcon = icon(Headphones, 'tc-audio-mixer-icon')
const plusIcon = icon(Plus, 'tc-audio-mixer-icon')
const trashIcon = icon(Trash2, 'tc-audio-mixer-icon')
const scissorsIcon = icon(Scissors, 'tc-audio-mixer-icon')

interface DragState {
    trackId: string
    clipId: string
    mode: 'move' | 'trim-l' | 'trim-r'
    startX: number
    origStart: number
    origLength: number
    el: HTMLElement
    moved: boolean
    curStart: number
    curLength: number
}

export class AudioMixer extends HTMLElement {
    private _initialised = false
    private _doc: AudioMixerDocument = EMPTY_DOCUMENT
    private _actions: AudioMixerActions = {}
    private _selection: AudioMixerSelectionState = {}

    private _drag: DragState | null = null
    private _dragMoveHandler: ((e: PointerEvent) => void) | null = null
    private _dragUpHandler: (() => void) | null = null

    /** Optional callback mirroring the `tc-seek` event. */
    onSeek: ((ms: number) => void) | null = null

    static get observedAttributes(): string[] {
        return ['current-ms', 'disabled', 'loading']
    }

    connectedCallback(): void {
        if (!this._initialised) {
            this.render()
            this._initialised = true
        }
        this._attachHandlers()
    }

    disconnectedCallback(): void {
        this._detachHandlers()
        this._cleanupDrag()
    }

    attributeChangedCallback(name: string): void {
        if (!this.isConnected || !this._initialised) return
        // Scrubbing the playhead is frequent — patch it in place so an in-flight
        // drag or a focused control is never destroyed by a full re-render.
        if (name === 'current-ms') {
            this._patchPlayhead()
            return
        }
        this.render()
    }

    // ── Attribute-backed props ──────────────────────────────────────────────

    get currentMs(): number {
        const raw = parseFloat(this.getAttribute('current-ms') ?? '0')
        return isNaN(raw) ? 0 : Math.max(0, raw)
    }
    set currentMs(v: number) {
        this.setAttribute('current-ms', String(v))
    }

    get disabled(): boolean {
        return this.hasAttribute('disabled')
    }
    set disabled(v: boolean) {
        if (v) this.setAttribute('disabled', '')
        else this.removeAttribute('disabled')
    }

    get loading(): boolean {
        return this.hasAttribute('loading')
    }
    set loading(v: boolean) {
        if (v) this.setAttribute('loading', '')
        else this.removeAttribute('loading')
    }

    // ── JS-property props ───────────────────────────────────────────────────

    get doc(): AudioMixerDocument {
        return this._doc
    }
    set doc(v: AudioMixerDocument) {
        this._doc =
            v && typeof v === 'object' && Array.isArray(v.tracks)
                ? { durationMs: Number(v.durationMs) || 0, tracks: v.tracks }
                : EMPTY_DOCUMENT
        if (this._initialised) this.render()
    }

    get actions(): AudioMixerActions {
        return this._actions
    }
    set actions(v: AudioMixerActions) {
        this._actions = v && typeof v === 'object' ? v : {}
    }

    get selection(): AudioMixerSelectionState {
        return this._selection
    }
    set selection(v: AudioMixerSelectionState) {
        this._selection = v && typeof v === 'object' ? v : {}
        if (this._initialised) this.render()
    }

    // ── Derived geometry ────────────────────────────────────────────────────

    private get _totalMs(): number {
        let end = this._doc.durationMs
        for (const t of this._doc.tracks) {
            for (const c of t.clips) end = Math.max(end, (c.startMs || 0) + (c.lengthMs || 0))
        }
        return Math.max(end, MIN_TIMELINE_MS)
    }

    private _findClip(trackId: string, clipId: string): AudioMixerClip | null {
        const track = this._doc.tracks.find((t) => t.id === trackId)
        return track?.clips.find((c) => c.id === clipId) ?? null
    }

    // ── Event helpers — each fires a CustomEvent AND the matching action ─────

    private _emit(name: string, detail: Record<string, unknown>): void {
        this.dispatchEvent(new CustomEvent(name, { bubbles: true, composed: true, detail }))
    }

    private _seek(ms: number): void {
        const clamped = clamp(Math.round(ms), 0, this._totalMs)
        this._emit('tc-seek', { ms: clamped })
        if (typeof this.onSeek === 'function') this.onSeek(clamped)
    }

    private _select(trackId: string | null, clipId: string | null): void {
        this._emit('tc-select', { trackId, clipId })
        this._actions.selectClip?.(trackId, clipId)
    }

    // ── Drag (clip move / resize) — per-gesture document listeners ───────────

    private _onPointerDown = (e: PointerEvent): void => {
        if (this.disabled || e.button !== 0 || this._drag) return
        const target = e.target as Element
        const clipEl = target.closest<HTMLElement>('.tc-audio-mixer-clip')
        if (!clipEl) return
        const trackId = clipEl.dataset.trackId ?? ''
        const clipId = clipEl.dataset.clipId ?? ''
        const clip = this._findClip(trackId, clipId)
        if (!clip) return

        const edge = target.closest<HTMLElement>('.tc-audio-mixer-clip-handle')?.dataset.edge ?? ''
        const mode: DragState['mode'] = edge === 'l' ? 'trim-l' : edge === 'r' ? 'trim-r' : 'move'

        e.preventDefault()
        // Highlight immediately without a re-render (the consumer re-renders on
        // tc-select, which we defer to pointer-up to avoid killing the drag).
        this.querySelectorAll('.tc-audio-mixer-clip--selected').forEach((el) =>
            el.classList.remove('tc-audio-mixer-clip--selected'),
        )
        clipEl.classList.add('tc-audio-mixer-clip--selected')

        this._drag = {
            trackId,
            clipId,
            mode,
            startX: e.clientX,
            origStart: clip.startMs || 0,
            origLength: clip.lengthMs || 0,
            el: clipEl,
            moved: false,
            curStart: clip.startMs || 0,
            curLength: clip.lengthMs || 0,
        }
        this._startDrag()
    }

    private _startDrag(): void {
        this._dragMoveHandler = (e: PointerEvent) => {
            const d = this._drag
            if (!d) return
            const deltaMs = Math.round((e.clientX - d.startX) / PX_PER_MS)
            if (Math.abs(e.clientX - d.startX) > 2) d.moved = true
            const total = this._totalMs
            if (d.mode === 'move') {
                d.curStart = clamp(d.origStart + deltaMs, 0, total)
                d.curLength = d.origLength
            } else if (d.mode === 'trim-l') {
                const maxStart = d.origStart + d.origLength - MIN_CLIP_MS
                d.curStart = clamp(d.origStart + deltaMs, 0, maxStart)
                d.curLength = d.origLength + (d.origStart - d.curStart)
            } else {
                d.curLength = Math.max(MIN_CLIP_MS, d.origLength + deltaMs)
                d.curStart = d.origStart
            }
            d.el.style.left = `${d.curStart * PX_PER_MS}px`
            d.el.style.width = `${Math.max(8, d.curLength * PX_PER_MS)}px`
        }
        this._dragUpHandler = () => {
            const d = this._drag
            if (d) {
                this._select(d.trackId, d.clipId)
                if (d.moved) {
                    if (d.mode === 'trim-l') {
                        this._emit('tc-clip-move', { clipId: d.clipId, startMs: d.curStart })
                        this._actions.moveClip?.(d.clipId, d.curStart)
                        this._emit('tc-clip-resize', { clipId: d.clipId, lengthMs: d.curLength })
                        this._actions.resizeClip?.(d.clipId, d.curLength)
                    } else if (d.mode === 'trim-r') {
                        this._emit('tc-clip-resize', { clipId: d.clipId, lengthMs: d.curLength })
                        this._actions.resizeClip?.(d.clipId, d.curLength)
                    } else {
                        this._emit('tc-clip-move', { clipId: d.clipId, startMs: d.curStart })
                        this._actions.moveClip?.(d.clipId, d.curStart)
                    }
                }
            }
            this._cleanupDrag()
        }
        document.addEventListener('pointermove', this._dragMoveHandler)
        document.addEventListener('pointerup', this._dragUpHandler)
        document.addEventListener('pointercancel', this._dragUpHandler)
    }

    private _cleanupDrag(): void {
        if (this._dragMoveHandler) {
            document.removeEventListener('pointermove', this._dragMoveHandler)
            this._dragMoveHandler = null
        }
        if (this._dragUpHandler) {
            document.removeEventListener('pointerup', this._dragUpHandler)
            document.removeEventListener('pointercancel', this._dragUpHandler)
            this._dragUpHandler = null
        }
        this._drag = null
    }

    // ── Click delegation (buttons, ruler seek, header/clip select) ──────────

    private _onClick = (e: MouseEvent): void => {
        if (this.disabled) return
        const target = e.target as Element

        const ruler = target.closest<HTMLElement>('.tc-audio-mixer-ruler')
        if (ruler) {
            const rect = ruler.getBoundingClientRect()
            this._seek((e.clientX - rect.left) / PX_PER_MS)
            return
        }

        const btn = target.closest<HTMLButtonElement>('button[data-action]')
        if (btn) {
            const action = btn.dataset.action
            const trackId = btn.dataset.trackId ?? null
            if (action === 'add-track') {
                this._actions.addTrack?.()
            } else if (action === 'mute' && trackId) {
                const track = this._doc.tracks.find((t) => t.id === trackId)
                const muted = !track?.muted
                this._emit('tc-track-mute', { trackId, muted })
                this._actions.toggleMute?.(trackId, muted)
            } else if (action === 'solo' && trackId) {
                const track = this._doc.tracks.find((t) => t.id === trackId)
                const solo = !track?.solo
                this._emit('tc-track-solo', { trackId, solo })
                this._actions.toggleSolo?.(trackId, solo)
            } else if (action === 'remove-effect') {
                const clipId = btn.dataset.clipId ?? null
                const effectId = btn.dataset.effectId ?? ''
                const clip = trackId && clipId ? this._findClip(trackId, clipId) : null
                const effect = clip?.effects?.find((fx) => fx.id === effectId)
                if (effect) {
                    this._emit('tc-effect-remove', { trackId, clipId, effect })
                    this._actions.removeEffect?.(trackId, clipId, effect)
                }
            }
            return
        }

        const clipEl = target.closest<HTMLElement>('.tc-audio-mixer-clip')
        if (clipEl) {
            // Selection is emitted from pointer-up so it also covers drags.
            return
        }

        const header = target.closest<HTMLElement>('.tc-audio-mixer-track-header')
        if (header && header.dataset.trackId) {
            this._select(header.dataset.trackId, null)
        }
    }

    // ── Change delegation (volume range, add-effect select) ─────────────────

    private _onChange = (e: Event): void => {
        if (this.disabled) return
        const target = e.target as HTMLElement

        if (target instanceof HTMLInputElement && target.dataset.action === 'volume') {
            const trackId = target.dataset.trackId ?? ''
            const volume = Number(target.value)
            target.setAttribute('aria-valuenow', String(volume))
            this._emit('tc-volume-change', { trackId, volume })
            this._actions.setVolume?.(trackId, volume)
            return
        }

        if (target instanceof HTMLSelectElement && target.dataset.action === 'add-effect') {
            const value = target.value as AudioEffectType
            if (!value) return
            const trackId = target.dataset.trackId ?? null
            const clipId = target.dataset.clipId ?? null
            const effect: AudioMixerEffect = {
                id: `fx_${++_fxSeq}`,
                type: value,
                params: { ...(EFFECT_DEFAULTS[value] ?? {}) },
            }
            target.value = ''
            this._emit('tc-effect-add', { trackId, clipId, effect })
            this._actions.addEffect?.(trackId, clipId, effect)
        }
    }

    // ── Keyboard (ruler seek, clip move/resize/select) ──────────────────────

    private _onKeyDown = (e: KeyboardEvent): void => {
        if (this.disabled) return
        const target = e.target as Element

        const ruler = target.closest<HTMLElement>('.tc-audio-mixer-ruler')
        if (ruler) {
            const step = e.shiftKey ? 1000 : 100
            if (e.key === 'ArrowLeft') {
                e.preventDefault()
                this._seek(this.currentMs - step)
            } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                this._seek(this.currentMs + step)
            } else if (e.key === 'Home') {
                e.preventDefault()
                this._seek(0)
            } else if (e.key === 'End') {
                e.preventDefault()
                this._seek(this._totalMs)
            }
            return
        }

        const clipEl = target.closest<HTMLElement>('.tc-audio-mixer-clip')
        if (!clipEl) return
        const trackId = clipEl.dataset.trackId ?? ''
        const clipId = clipEl.dataset.clipId ?? ''
        const clip = this._findClip(trackId, clipId)
        if (!clip) return

        const step = e.shiftKey ? 1000 : 100
        const start = clip.startMs || 0
        const length = clip.lengthMs || 0

        switch (e.key) {
            case 'Enter':
            case ' ':
                e.preventDefault()
                this._select(trackId, clipId)
                break
            case 'ArrowLeft':
                e.preventDefault()
                this._emitMove(clipId, clamp(start - step, 0, this._totalMs))
                break
            case 'ArrowRight':
                e.preventDefault()
                this._emitMove(clipId, clamp(start + step, 0, this._totalMs))
                break
            case 'ArrowUp':
                e.preventDefault()
                this._emitResize(clipId, Math.max(MIN_CLIP_MS, length + step))
                break
            case 'ArrowDown':
                e.preventDefault()
                this._emitResize(clipId, Math.max(MIN_CLIP_MS, length - step))
                break
        }
    }

    private _emitMove(clipId: string, startMs: number): void {
        this._emit('tc-clip-move', { clipId, startMs })
        this._actions.moveClip?.(clipId, startMs)
    }

    private _emitResize(clipId: string, lengthMs: number): void {
        this._emit('tc-clip-resize', { clipId, lengthMs })
        this._actions.resizeClip?.(clipId, lengthMs)
    }

    private _attachHandlers(): void {
        this._detachHandlers()
        this.addEventListener('pointerdown', this._onPointerDown)
        this.addEventListener('click', this._onClick)
        this.addEventListener('change', this._onChange)
        this.addEventListener('keydown', this._onKeyDown)
    }

    private _detachHandlers(): void {
        this.removeEventListener('pointerdown', this._onPointerDown)
        this.removeEventListener('click', this._onClick)
        this.removeEventListener('change', this._onChange)
        this.removeEventListener('keydown', this._onKeyDown)
    }

    // ── Surgical playhead patch (current-ms changes) ────────────────────────

    private _patchPlayhead(): void {
        const ms = this.currentMs
        const playhead = this.querySelector<HTMLElement>('.tc-audio-mixer-playhead')
        if (playhead) playhead.style.left = `${ms * PX_PER_MS}px`
        const ruler = this.querySelector<HTMLElement>('.tc-audio-mixer-ruler')
        if (ruler) ruler.setAttribute('aria-valuenow', String(Math.round(ms)))
        const time = this.querySelector<HTMLElement>('.tc-audio-mixer-time-cur')
        if (time) time.textContent = formatTime(ms)
    }

    // ── Render ──────────────────────────────────────────────────────────────

    private render(): void {
        if (this.loading) {
            this.setAttribute('aria-busy', 'true')
            patchHtml(this, this._renderSkeleton())
            return
        }
        this.removeAttribute('aria-busy')

        // Preserve keyboard focus across the innerHTML swap.
        const active = document.activeElement
        let focusSel: string | null = null
        if (active instanceof HTMLElement && this.contains(active)) {
            if (active.dataset.clipId && active.classList.contains('tc-audio-mixer-clip')) {
                focusSel = `.tc-audio-mixer-clip[data-clip-id="${active.dataset.clipId}"]`
            } else if (active.dataset.focusKey) {
                focusSel = `[data-focus-key="${active.dataset.focusKey}"]`
            } else if (active.classList.contains('tc-audio-mixer-ruler')) {
                focusSel = '.tc-audio-mixer-ruler'
            }
        }

        const doc = this._doc
        const totalMs = this._totalMs
        const laneWidth = totalMs * PX_PER_MS
        const currentMs = this.currentMs
        const sel = this._selection
        const disabled = this.disabled

        const toolbar =
            `<div class="tc-audio-mixer-toolbar">` +
            `<button type="button" class="tc-audio-mixer-btn tc-audio-mixer-btn--primary" ` +
            `data-action="add-track" data-focus-key="add-track"${disabled ? ' disabled' : ''}>` +
            `${plusIcon}<span>Add track</span></button>` +
            `<button type="button" class="tc-audio-mixer-btn" aria-label="Play"${disabled ? ' disabled' : ''}>` +
            `${playIcon}</button>` +
            `<span class="tc-audio-mixer-time">` +
            `<span class="tc-audio-mixer-time-cur">${formatTime(currentMs)}</span>` +
            ` / ${formatTime(totalMs)}</span>` +
            `</div>`

        const headers =
            `<div class="tc-audio-mixer-tracks">` +
            `<div class="tc-audio-mixer-tracks-spacer" style="height:${RULER_H}px"></div>` +
            doc.tracks.map((track) => this._renderHeader(track, sel, disabled)).join('') +
            `</div>`

        const ruler = this._renderRuler(totalMs, laneWidth, currentMs, disabled)

        const lanes =
            `<div class="tc-audio-mixer-lanes" style="width:${laneWidth}px">` +
            doc.tracks.map((track) => this._renderLane(track, sel, disabled)).join('') +
            `<div class="tc-audio-mixer-playhead" style="left:${currentMs * PX_PER_MS}px" aria-hidden="true"></div>` +
            `</div>`

        const timeline =
            `<div class="tc-audio-mixer-timeline">` +
            `<div class="tc-audio-mixer-timeline-inner" style="width:${laneWidth}px">` +
            ruler +
            lanes +
            `</div>` +
            `</div>`

        const inspector = this._renderInspector(sel, disabled)

        patchHtml(
            this,
            `<div class="tc-audio-mixer">` +
                toolbar +
                `<div class="tc-audio-mixer-main">` +
                `<div class="tc-audio-mixer-stage">${headers}${timeline}</div>` +
                inspector +
                `</div>` +
                `</div>`,
        )

        if (focusSel) this.querySelector<HTMLElement>(focusSel)?.focus()
    }

    private _renderSkeleton(): string {
        const rows = [0, 1, 2]
            .map(() => `<div class="tc-audio-mixer-skeleton-row" aria-hidden="true"></div>`)
            .join('')
        return (
            `<div class="tc-audio-mixer tc-audio-mixer--loading">` +
            `<div class="tc-audio-mixer-skeleton" aria-hidden="true">` +
            `<div class="tc-audio-mixer-skeleton-bar"></div>${rows}` +
            `</div>` +
            `<span class="visually-hidden">Loading mixer…</span>` +
            `</div>`
        )
    }

    private _renderRuler(
        totalMs: number,
        laneWidth: number,
        currentMs: number,
        disabled: boolean,
    ): string {
        const stepMs = 5000
        const ticks: string[] = []
        for (let ms = 0; ms <= totalMs; ms += stepMs) {
            ticks.push(
                `<span class="tc-audio-mixer-tick" style="left:${ms * PX_PER_MS}px">${formatTime(ms)}</span>`,
            )
        }
        return (
            `<div class="tc-audio-mixer-ruler" role="slider" tabindex="${disabled ? -1 : 0}" ` +
            `aria-label="Playhead position" aria-valuemin="0" aria-valuemax="${Math.round(totalMs)}" ` +
            `aria-valuenow="${Math.round(currentMs)}" style="height:${RULER_H}px;width:${laneWidth}px">` +
            ticks.join('') +
            `</div>`
        )
    }

    private _renderHeader(
        track: AudioMixerTrack,
        sel: AudioMixerSelectionState,
        disabled: boolean,
    ): string {
        const active = sel.trackId === track.id && !sel.clipId
        const volume = typeof track.volume === 'number' ? track.volume : 1
        const dis = disabled ? ' disabled' : ''
        return (
            `<div class="tc-audio-mixer-track-header${active ? ' tc-audio-mixer-track-header--active' : ''}" ` +
            `data-track-id="${esc(track.id)}" style="height:${TRACK_H}px">` +
            `<div class="tc-audio-mixer-track-name" title="${esc(track.name)}">${esc(track.name)}</div>` +
            `<div class="tc-audio-mixer-track-controls">` +
            `<button type="button" class="tc-audio-mixer-chip${track.muted ? ' tc-audio-mixer-chip--mute' : ''}" ` +
            `data-action="mute" data-track-id="${esc(track.id)}" data-focus-key="mute:${esc(track.id)}" ` +
            `aria-pressed="${track.muted ? 'true' : 'false'}" aria-label="Mute ${esc(track.name)}"${dis}>` +
            `${muteIcon}</button>` +
            `<button type="button" class="tc-audio-mixer-chip${track.solo ? ' tc-audio-mixer-chip--solo' : ''}" ` +
            `data-action="solo" data-track-id="${esc(track.id)}" data-focus-key="solo:${esc(track.id)}" ` +
            `aria-pressed="${track.solo ? 'true' : 'false'}" aria-label="Solo ${esc(track.name)}"${dis}>` +
            `${soloIcon}</button>` +
            `<input type="range" class="tc-audio-mixer-fader" min="0" max="1" step="0.01" ` +
            `value="${volume}" data-action="volume" data-track-id="${esc(track.id)}" ` +
            `data-focus-key="vol:${esc(track.id)}" aria-label="${esc(track.name)} volume" ` +
            `aria-valuemin="0" aria-valuemax="1" aria-valuenow="${volume}"${dis}>` +
            `</div>` +
            `</div>`
        )
    }

    private _renderLane(
        track: AudioMixerTrack,
        sel: AudioMixerSelectionState,
        disabled: boolean,
    ): string {
        const clips = track.clips
            .map((clip) => {
                const start = clip.startMs || 0
                const length = clip.lengthMs || 0
                const w = Math.max(8, length * PX_PER_MS)
                const isSel = sel.clipId === clip.id
                const label = clip.label ?? ''
                return (
                    `<div class="tc-audio-mixer-clip${isSel ? ' tc-audio-mixer-clip--selected' : ''}" ` +
                    `data-track-id="${esc(track.id)}" data-clip-id="${esc(clip.id)}" ` +
                    `tabindex="${disabled ? -1 : 0}" role="button" ` +
                    `aria-label="${esc(label || 'Clip')} — ${formatTime(start)}, ${formatTime(length)} long" ` +
                    `style="left:${start * PX_PER_MS}px;width:${w}px">` +
                    `<span class="tc-audio-mixer-clip-handle tc-audio-mixer-clip-handle--l" data-edge="l" aria-hidden="true"></span>` +
                    `<span class="tc-audio-mixer-clip-label">${esc(label)}</span>` +
                    `<span class="tc-audio-mixer-clip-handle tc-audio-mixer-clip-handle--r" data-edge="r" aria-hidden="true"></span>` +
                    `</div>`
                )
            })
            .join('')
        return `<div class="tc-audio-mixer-lane" data-track-id="${esc(track.id)}" style="height:${TRACK_H}px">${clips}</div>`
    }

    private _renderInspector(sel: AudioMixerSelectionState, disabled: boolean): string {
        const clip = sel.trackId && sel.clipId ? this._findClip(sel.trackId, sel.clipId) : null

        if (clip) {
            const effects = Array.isArray(clip.effects) ? clip.effects : []
            const rows = effects
                .map(
                    (fx) =>
                        `<div class="tc-audio-mixer-effect">` +
                        `<span class="tc-audio-mixer-effect-type">${esc(fx.type)}</span>` +
                        `<button type="button" class="tc-audio-mixer-chip tc-audio-mixer-chip--danger" ` +
                        `data-action="remove-effect" data-track-id="${esc(sel.trackId ?? '')}" ` +
                        `data-clip-id="${esc(sel.clipId ?? '')}" data-effect-id="${esc(fx.id)}" ` +
                        `aria-label="Remove ${esc(fx.type)}"${disabled ? ' disabled' : ''}>${trashIcon}</button>` +
                        `</div>`,
                )
                .join('')
            const empty =
                effects.length === 0
                    ? `<div class="tc-audio-mixer-inspector-empty">No effects yet.</div>`
                    : ''
            const options = EFFECT_TYPES.map((t) => `<option value="${t}">${t}</option>`).join('')
            return (
                `<div class="tc-audio-mixer-inspector">` +
                `<div class="tc-audio-mixer-inspector-title">${scissorsIcon}` +
                `<span>${esc(clip.label || 'Clip')}</span></div>` +
                `<dl class="tc-audio-mixer-meta">` +
                `<div><dt>Start</dt><dd>${formatTime(clip.startMs || 0)}</dd></div>` +
                `<div><dt>Length</dt><dd>${formatTime(clip.lengthMs || 0)}</dd></div>` +
                `</dl>` +
                `<div class="tc-audio-mixer-field-label">Effect chain</div>` +
                `<div class="tc-audio-mixer-effects">${rows}${empty}</div>` +
                `<div class="tc-audio-mixer-fx-add-row">` +
                `<span class="tc-audio-mixer-icon-lead">${plusIcon}</span>` +
                `<select class="tc-audio-mixer-fx-add" data-action="add-effect" ` +
                `data-track-id="${esc(sel.trackId ?? '')}" data-clip-id="${esc(sel.clipId ?? '')}" ` +
                `aria-label="Add effect"${disabled ? ' disabled' : ''}>` +
                `<option value="">Add effect…</option>${options}` +
                `</select>` +
                `</div>` +
                `</div>`
            )
        }

        if (sel.trackId) {
            const track = this._doc.tracks.find((t) => t.id === sel.trackId)
            return (
                `<div class="tc-audio-mixer-inspector">` +
                `<div class="tc-audio-mixer-inspector-title"><span>${esc(track?.name || 'Track')}</span></div>` +
                `<div class="tc-audio-mixer-inspector-empty">Select a clip to edit its effect chain.</div>` +
                `</div>`
            )
        }

        return (
            `<div class="tc-audio-mixer-inspector">` +
            `<div class="tc-audio-mixer-inspector-empty">Select a track or clip to inspect.</div>` +
            `</div>`
        )
    }
}

declare global {
    interface HTMLElementTagNameMap {
        [TAG_NAME]: AudioMixer
    }
}
