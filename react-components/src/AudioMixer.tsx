import React, { useState, useCallback, useRef, useMemo, useId } from 'react'
import { Icon } from './Icon'
import { Button } from './Button'
import { Skeleton } from './Skeleton'

export type AudioEffectType = 'gain' | 'eq' | 'reverb' | 'delay'

export interface AudioEffect {
    id: string
    type: AudioEffectType
    bypass: boolean
    params: Record<string, number>
}

export interface LoopRegion {
    start_ms: number
    end_ms: number
    enabled: boolean
}

export interface MixerMaster {
    gain_db: number
    loop: LoopRegion
    effects: AudioEffect[]
}

export interface MixerClip {
    id: string
    asset_id: string
    start_ms: number
    source_in_ms: number
    source_out_ms: number
    gain_db: number
    fade_in_ms: number
    fade_out_ms: number
}

export interface MixerTrack {
    id: string
    name: string
    gain_db: number
    pan: number
    mute: boolean
    solo: boolean
    effects: AudioEffect[]
    clips: MixerClip[]
}

export interface AudioMixerDocument {
    schema: number
    sampleRate: number
    duration_ms: number
    master: MixerMaster
    tracks: MixerTrack[]
}

export type EffectTarget = { scope: 'master' } | { scope: 'track'; trackId: string }

export type MixerSelection =
    | { kind: 'none' }
    | { kind: 'master' }
    | { kind: 'track'; trackId: string }
    | { kind: 'clip'; trackId: string; clipId: string }

export const EFFECT_TYPES: AudioEffectType[] = ['gain', 'eq', 'reverb', 'delay']

export const EFFECT_DEFAULTS: Record<AudioEffectType, Record<string, number>> = {
    gain: { gain_db: 0 },
    eq: { low_db: 0, mid_db: 0, high_db: 0 },
    reverb: { mix: 0.2, decay_s: 1.8 },
    delay: { time_ms: 250, feedback: 0.3, mix: 0.2 },
}

const EMPTY_DOCUMENT: AudioMixerDocument = {
    schema: 1,
    sampleRate: 48000,
    duration_ms: 0,
    master: { gain_db: 0, loop: { start_ms: 0, end_ms: 0, enabled: false }, effects: [] },
    tracks: [],
}

const EMPTY_DOC_JSON = JSON.stringify(EMPTY_DOCUMENT)

const TRACK_H = 76
const RULER_H = 28

export const parseDocument = (raw: string): AudioMixerDocument => {
    try {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object' && Array.isArray(parsed.tracks) && parsed.master) {
            return parsed as AudioMixerDocument
        }
    } catch {
        /* ignore */
    }
    return EMPTY_DOCUMENT
}

export const clipDuration = (clip: MixerClip): number => Math.max(0, clip.source_out_ms - clip.source_in_ms)

export const documentDuration = (doc: AudioMixerDocument): number => {
    let end = doc.duration_ms
    for (const track of doc.tracks) {
        for (const clip of track.clips) {
            end = Math.max(end, clip.start_ms + clipDuration(clip))
        }
    }
    if (doc.master.loop.enabled) end = Math.max(end, doc.master.loop.end_ms)
    return end
}

export const formatTime = (ms: number): string => {
    const total = Math.max(0, Math.round(ms))
    const m = Math.floor(total / 60000)
    const s = Math.floor((total % 60000) / 1000)
    const cs = Math.floor((total % 1000) / 10)
    return `${m}:${String(s).padStart(2, '0')}.${String(cs).padStart(2, '0')}`
}

/* ---------------------------------------------------------------- *
 * Headless hook — owns the project document + selection + mutations *
 * ---------------------------------------------------------------- */

export interface UseAudioMixerOptions {
    value?: string
    defaultValue?: string
    onChange?: (value: string) => void
    disabled?: boolean
}

export interface AudioMixerActions {
    addTrack: (partial?: Partial<MixerTrack>) => string
    removeTrack: (trackId: string) => void
    updateTrack: (trackId: string, patch: Partial<MixerTrack>) => void
    moveTrack: (trackId: string, dir: -1 | 1) => void
    addClip: (trackId: string, clip: Omit<MixerClip, 'id'> & { id?: string }) => string
    removeClip: (trackId: string, clipId: string) => void
    updateClip: (trackId: string, clipId: string, patch: Partial<MixerClip>) => void
    splitClip: (trackId: string, clipId: string, atMs: number) => void
    setMasterGain: (gainDb: number) => void
    setLoop: (patch: Partial<LoopRegion>) => void
    addEffect: (target: EffectTarget, type: AudioEffectType) => void
    removeEffect: (target: EffectTarget, effectId: string) => void
    updateEffect: (target: EffectTarget, effectId: string, patch: Partial<Omit<AudioEffect, 'id'>>) => void
}

export interface AudioMixerSelectionState {
    current: MixerSelection
    select: (selection: MixerSelection) => void
    track: MixerTrack | null
    clip: MixerClip | null
}

export interface AudioMixerViewModel {
    doc: AudioMixerDocument
    actions: AudioMixerActions
    selection: AudioMixerSelectionState
    disabled: boolean
}

export interface UseAudioMixerResult {
    doc: AudioMixerDocument
    actions: AudioMixerActions
    selection: AudioMixerSelectionState
    view: AudioMixerViewModel
}

const targetEffects = (doc: AudioMixerDocument, target: EffectTarget): AudioEffect[] => {
    if (target.scope === 'master') return doc.master.effects
    return doc.tracks.find(t => t.id === target.trackId)?.effects ?? []
}

export const useAudioMixer = (opts: UseAudioMixerOptions = {}): UseAudioMixerResult => {
    const { value, defaultValue = EMPTY_DOC_JSON, onChange, disabled = false } = opts
    const isControlled = value !== undefined
    const [internal, setInternal] = useState(defaultValue)
    const raw = isControlled ? value : internal
    const doc = useMemo(() => parseDocument(raw), [raw])

    const idSeed = useRef(0)
    const genId = useCallback((prefix: string) => {
        idSeed.current += 1
        return `${prefix}_${idSeed.current.toString(36)}${Math.floor(performance.now()).toString(36)}`
    }, [])

    const [selection, setSelection] = useState<MixerSelection>({ kind: 'none' })

    const emit = useCallback(
        (next: AudioMixerDocument) => {
            const withDuration = { ...next, duration_ms: documentDuration(next) }
            const serialized = JSON.stringify(withDuration)
            if (!isControlled) setInternal(serialized)
            onChange?.(serialized)
        },
        [isControlled, onChange],
    )

    const mapTrack = useCallback(
        (trackId: string, fn: (track: MixerTrack) => MixerTrack) => doc.tracks.map(t => (t.id === trackId ? fn(t) : t)),
        [doc.tracks],
    )

    const actions = useMemo<AudioMixerActions>(() => {
        const addTrack: AudioMixerActions['addTrack'] = partial => {
            const id = genId('trk')
            const track: MixerTrack = {
                id,
                name: `Track ${doc.tracks.length + 1}`,
                gain_db: 0,
                pan: 0,
                mute: false,
                solo: false,
                effects: [],
                clips: [],
                ...partial,
            }
            emit({ ...doc, tracks: [...doc.tracks, track] })
            setSelection({ kind: 'track', trackId: id })
            return id
        }

        const removeTrack: AudioMixerActions['removeTrack'] = trackId => {
            emit({ ...doc, tracks: doc.tracks.filter(t => t.id !== trackId) })
            setSelection(prev => (prev.kind !== 'none' && 'trackId' in prev && prev.trackId === trackId ? { kind: 'none' } : prev))
        }

        const updateTrack: AudioMixerActions['updateTrack'] = (trackId, patch) => {
            emit({ ...doc, tracks: mapTrack(trackId, t => ({ ...t, ...patch })) })
        }

        const moveTrack: AudioMixerActions['moveTrack'] = (trackId, dir) => {
            const idx = doc.tracks.findIndex(t => t.id === trackId)
            const next = idx + dir
            if (idx < 0 || next < 0 || next >= doc.tracks.length) return
            const tracks = [...doc.tracks]
            ;[tracks[idx], tracks[next]] = [tracks[next], tracks[idx]]
            emit({ ...doc, tracks })
        }

        const addClip: AudioMixerActions['addClip'] = (trackId, clip) => {
            const id = clip.id ?? genId('clip')
            emit({ ...doc, tracks: mapTrack(trackId, t => ({ ...t, clips: [...t.clips, { ...clip, id }] })) })
            setSelection({ kind: 'clip', trackId, clipId: id })
            return id
        }

        const removeClip: AudioMixerActions['removeClip'] = (trackId, clipId) => {
            emit({ ...doc, tracks: mapTrack(trackId, t => ({ ...t, clips: t.clips.filter(c => c.id !== clipId) })) })
            setSelection(prev => (prev.kind === 'clip' && prev.clipId === clipId ? { kind: 'none' } : prev))
        }

        const updateClip: AudioMixerActions['updateClip'] = (trackId, clipId, patch) => {
            emit({
                ...doc,
                tracks: mapTrack(trackId, t => ({
                    ...t,
                    clips: t.clips.map(c => (c.id === clipId ? { ...c, ...patch } : c)),
                })),
            })
        }

        const splitClip: AudioMixerActions['splitClip'] = (trackId, clipId, atMs) => {
            const track = doc.tracks.find(t => t.id === trackId)
            const clip = track?.clips.find(c => c.id === clipId)
            if (!clip) return
            const localMs = atMs - clip.start_ms
            if (localMs <= 0 || localMs >= clipDuration(clip)) return
            const splitSource = clip.source_in_ms + localMs
            const left: MixerClip = { ...clip, source_out_ms: splitSource, fade_out_ms: 0 }
            const right: MixerClip = {
                ...clip,
                id: genId('clip'),
                start_ms: clip.start_ms + localMs,
                source_in_ms: splitSource,
                fade_in_ms: 0,
            }
            emit({
                ...doc,
                tracks: mapTrack(trackId, t => ({
                    ...t,
                    clips: t.clips.flatMap(c => (c.id === clipId ? [left, right] : [c])),
                })),
            })
        }

        const setMasterGain: AudioMixerActions['setMasterGain'] = gainDb => {
            emit({ ...doc, master: { ...doc.master, gain_db: gainDb } })
        }

        const setLoop: AudioMixerActions['setLoop'] = patch => {
            emit({ ...doc, master: { ...doc.master, loop: { ...doc.master.loop, ...patch } } })
        }

        const writeEffects = (target: EffectTarget, effects: AudioEffect[]) => {
            if (target.scope === 'master') {
                emit({ ...doc, master: { ...doc.master, effects } })
            } else {
                emit({ ...doc, tracks: mapTrack(target.trackId, t => ({ ...t, effects })) })
            }
        }

        const addEffect: AudioMixerActions['addEffect'] = (target, type) => {
            const effect: AudioEffect = { id: genId('fx'), type, bypass: false, params: { ...EFFECT_DEFAULTS[type] } }
            writeEffects(target, [...targetEffects(doc, target), effect])
        }

        const removeEffect: AudioMixerActions['removeEffect'] = (target, effectId) => {
            writeEffects(target, targetEffects(doc, target).filter(e => e.id !== effectId))
        }

        const updateEffect: AudioMixerActions['updateEffect'] = (target, effectId, patch) => {
            writeEffects(
                target,
                targetEffects(doc, target).map(e =>
                    e.id === effectId ? { ...e, ...patch, params: { ...e.params, ...patch.params } } : e,
                ),
            )
        }

        return {
            addTrack,
            removeTrack,
            updateTrack,
            moveTrack,
            addClip,
            removeClip,
            updateClip,
            splitClip,
            setMasterGain,
            setLoop,
            addEffect,
            removeEffect,
            updateEffect,
        }
    }, [doc, emit, genId, mapTrack])

    const selectedTrack =
        selection.kind === 'track' || selection.kind === 'clip'
            ? doc.tracks.find(t => t.id === selection.trackId) ?? null
            : null
    const selectedClip =
        selection.kind === 'clip' ? selectedTrack?.clips.find(c => c.id === selection.clipId) ?? null : null

    const selectionState: AudioMixerSelectionState = {
        current: selection,
        select: setSelection,
        track: selectedTrack,
        clip: selectedClip,
    }

    const view: AudioMixerViewModel = { doc, actions, selection: selectionState, disabled }

    return { doc, actions, selection: selectionState, view }
}

/* ---------------------------------------------------------------- *
 * View — headers + timeline + inspector. No transport, no waveform. *
 * Visual only: callback-driven, no Web Audio inside.                *
 * ---------------------------------------------------------------- */

export interface AudioMixerProps {
    doc: AudioMixerDocument
    actions: AudioMixerActions
    selection: AudioMixerSelectionState
    disabled?: boolean
    loading?: boolean
    className?: string
    currentMs?: number
    onSeek?: (ms: number) => void
    id?: string
}

const TRACK_COLORS = ['#0ea5e9', '#22c55e', '#f97316', '#a855f7', '#ef4444', '#14b8a6', '#eab308', '#ec4899']

export const AudioMixer: React.FC<AudioMixerProps> = ({
    doc,
    actions,
    selection,
    disabled = false,
    loading = false,
    className = '',
    currentMs = 0,
    onSeek,
    id: propId,
}) => {
    const generatedId = useId()
    const rootId = propId ?? generatedId
    const [pxPerMs] = useState(0.05)
    const [drag, setDrag] = useState<{ trackId: string; clipId: string; mode: 'move' | 'trim-l' | 'trim-r'; startX: number; orig: MixerClip } | null>(null)
    const lanesRef = useRef<HTMLDivElement>(null)

    const totalMs = Math.max(documentDuration(doc), 10000)
    const laneWidth = totalMs * pxPerMs + 80

    const onClipPointerDown = (e: React.PointerEvent, trackId: string, clip: MixerClip, mode: 'move' | 'trim-l' | 'trim-r') => {
        if (disabled || e.button !== 0) return
        e.stopPropagation()
        ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
        setDrag({ trackId, clipId: clip.id, mode, startX: e.clientX, orig: clip })
        selection.select({ kind: 'clip', trackId, clipId: clip.id })
    }

    const onLanesPointerMove = (e: React.PointerEvent) => {
        if (!drag) return
        const deltaMs = Math.round((e.clientX - drag.startX) / pxPerMs)
        const o = drag.orig
        if (drag.mode === 'move') {
            actions.updateClip(drag.trackId, drag.clipId, { start_ms: Math.max(0, o.start_ms + deltaMs) })
        } else if (drag.mode === 'trim-l') {
            const nextIn = Math.min(o.source_out_ms - 10, Math.max(0, o.source_in_ms + deltaMs))
            actions.updateClip(drag.trackId, drag.clipId, { source_in_ms: nextIn, start_ms: Math.max(0, o.start_ms + (nextIn - o.source_in_ms)) })
        } else {
            const nextOut = Math.max(o.source_in_ms + 10, o.source_out_ms + deltaMs)
            actions.updateClip(drag.trackId, drag.clipId, { source_out_ms: nextOut })
        }
    }

    const onLanesPointerUp = (e: React.PointerEvent) => {
        ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
        setDrag(null)
    }

    const seekFromEvent = (clientX: number) => {
        const el = lanesRef.current
        if (!el || !onSeek) return
        const rect = el.getBoundingClientRect()
        const ms = (clientX - rect.left + el.scrollLeft) / pxPerMs
        onSeek(Math.max(0, Math.round(ms)))
    }

    const trackColor = useCallback((trackId: string) => TRACK_COLORS[doc.tracks.findIndex(t => t.id === trackId) % TRACK_COLORS.length], [doc.tracks])

    const ticks = useMemo(() => {
        const stepMs = pxPerMs > 0.12 ? 1000 : pxPerMs > 0.04 ? 5000 : 15000
        const out: number[] = []
        for (let ms = 0; ms <= totalMs; ms += stepMs) out.push(ms)
        return { stepMs, out }
    }, [pxPerMs, totalMs])

    if (loading) {
        return (
            <div id={rootId} className={`component component-audio-mixer ${className}`.trim()}>
                <div style={{ padding: '1rem' }}>
                    <Skeleton variant="rect" width="100%" height="240px" />
                </div>
            </div>
        )
    }

    const loop = doc.master.loop
    const sel = selection.current

    return (
        <div id={rootId} className={`component component-audio-mixer ${className}`.trim()}>
            <div className="component-audio-mixer__main">
                <div className="component-audio-mixer__stage">
                    <div className="component-audio-mixer__headers">
                        <div className="component-audio-mixer__headers-spacer" style={{ height: RULER_H }} />
                        {doc.tracks.map(track => {
                            const active = sel.kind !== 'none' && 'trackId' in sel && sel.trackId === track.id
                            return (
                                <div
                                    key={track.id}
                                    className={`component-audio-mixer__track-header${active ? ' component-audio-mixer__track-header--active' : ''}`}
                                    style={{ height: TRACK_H, borderLeftColor: trackColor(track.id) }}
                                    onClick={() => selection.select({ kind: 'track', trackId: track.id })}
                                >
                                    <input
                                        className="component-audio-mixer__track-name"
                                        value={track.name}
                                        disabled={disabled}
                                        aria-label="Track name"
                                        onChange={e => actions.updateTrack(track.id, { name: e.target.value })}
                                        onClick={e => e.stopPropagation()}
                                    />
                                    <div className="component-audio-mixer__track-controls">
                                        <button
                                            type="button"
                                            className={`component-audio-mixer__chip${track.mute ? ' component-audio-mixer__chip--on' : ''}`}
                                            aria-pressed={track.mute}
                                            disabled={disabled}
                                            onClick={e => { e.stopPropagation(); actions.updateTrack(track.id, { mute: !track.mute }) }}
                                        >
                                            M
                                        </button>
                                        <button
                                            type="button"
                                            className={`component-audio-mixer__chip${track.solo ? ' component-audio-mixer__chip--solo' : ''}`}
                                            aria-pressed={track.solo}
                                            disabled={disabled}
                                            onClick={e => { e.stopPropagation(); actions.updateTrack(track.id, { solo: !track.solo }) }}
                                        >
                                            S
                                        </button>
                                        <input
                                            type="range"
                                            className="form-range component-audio-mixer__track-fader"
                                            min={-60}
                                            max={6}
                                            step={0.5}
                                            value={track.gain_db}
                                            disabled={disabled}
                                            aria-label={`${track.name} gain`}
                                            onClick={e => e.stopPropagation()}
                                            onChange={e => actions.updateTrack(track.id, { gain_db: Number(e.target.value) })}
                                        />
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    <div
                        className="component-audio-mixer__scroll"
                        ref={lanesRef}
                        onPointerMove={onLanesPointerMove}
                        onPointerUp={onLanesPointerUp}
                        onPointerLeave={onLanesPointerUp}
                    >
                        <div className="component-audio-mixer__timeline" style={{ width: laneWidth }}>
                            <div
                                className="component-audio-mixer__ruler"
                                style={{ height: RULER_H }}
                                onClick={e => seekFromEvent(e.clientX)}
                            >
                                {ticks.out.map(ms => (
                                    <span key={ms} className="component-audio-mixer__tick" style={{ left: ms * pxPerMs }}>
                                        {formatTime(ms)}
                                    </span>
                                ))}
                            </div>

                            <div className="component-audio-mixer__lanes">
                                {loop.enabled && (
                                    <div
                                        className="component-audio-mixer__loop-region"
                                        style={{ left: loop.start_ms * pxPerMs, width: Math.max(0, (loop.end_ms - loop.start_ms) * pxPerMs) }}
                                    />
                                )}
                                {doc.tracks.map(track => (
                                    <div key={track.id} className="component-audio-mixer__lane" style={{ height: TRACK_H }}>
                                        {track.clips.map(clip => {
                                            const dur = clipDuration(clip)
                                            const w = Math.max(8, dur * pxPerMs)
                                            const isSel = sel.kind === 'clip' && sel.clipId === clip.id
                                            return (
                                                <div
                                                    key={clip.id}
                                                    className={`component-audio-mixer__clip${isSel ? ' component-audio-mixer__clip--selected' : ''}`}
                                                    style={{ left: clip.start_ms * pxPerMs, width: w, borderColor: trackColor(track.id) }}
                                                    onPointerDown={e => onClipPointerDown(e, track.id, clip, 'move')}
                                                >
                                                    <span
                                                        className="component-audio-mixer__trim component-audio-mixer__trim--l"
                                                        onPointerDown={e => onClipPointerDown(e, track.id, clip, 'trim-l')}
                                                    />
                                                    <span
                                                        className="component-audio-mixer__trim component-audio-mixer__trim--r"
                                                        onPointerDown={e => onClipPointerDown(e, track.id, clip, 'trim-r')}
                                                    />
                                                </div>
                                            )
                                        })}
                                    </div>
                                ))}
                                <div className="component-audio-mixer__playhead" style={{ left: currentMs * pxPerMs }} />
                            </div>
                        </div>
                    </div>
                </div>

                <AudioMixerInspector doc={doc} actions={actions} selection={selection} disabled={disabled} currentMs={currentMs} />
            </div>
        </div>
    )
}

/* ---------------------------------------------------------------- *
 * Inspector — parameters for the current selection.                 *
 * ---------------------------------------------------------------- */

interface InspectorProps {
    doc: AudioMixerDocument
    actions: AudioMixerActions
    selection: AudioMixerSelectionState
    disabled: boolean
    currentMs: number
}

const EffectChain: React.FC<{ target: EffectTarget; effects: AudioEffect[]; actions: AudioMixerActions; disabled: boolean }> = ({ target, effects, actions, disabled }) => (
    <div className="component-audio-mixer__effects">
        <div className="component-audio-mixer__field-label">Effects</div>
        {effects.map(fx => (
            <div key={fx.id} className="component-audio-mixer__effect">
                <div className="component-audio-mixer__effect-head">
                    <span className="component-audio-mixer__effect-type">{fx.type}</span>
                    <label className="component-audio-mixer__bypass">
                        <input type="checkbox" className="form-check-input" checked={fx.bypass} disabled={disabled} onChange={e => actions.updateEffect(target, fx.id, { bypass: e.target.checked })} />
                        bypass
                    </label>
                    <Button variant="danger" outline size="small" disabled={disabled} aria-label="Remove effect" onClick={() => actions.removeEffect(target, fx.id)}>
                        <Icon name="x-lg" aria-hidden={true} />
                    </Button>
                </div>
                <div className="component-audio-mixer__effect-params">
                    {Object.entries(fx.params).map(([key, val]) => (
                        <label key={key} className="component-audio-mixer__param">
                            <span>{key}</span>
                            <input
                                type="number"
                                className="form-control form-control-sm"
                                value={val}
                                step={0.1}
                                disabled={disabled}
                                onChange={e => actions.updateEffect(target, fx.id, { params: { [key]: Number(e.target.value) } })}
                            />
                        </label>
                    ))}
                </div>
            </div>
        ))}
        <select
            className="form-select form-select-sm"
            value=""
            disabled={disabled}
            aria-label="Add effect"
            onChange={e => { if (e.target.value) actions.addEffect(target, e.target.value as AudioEffectType) }}
        >
            <option value="">+ Add effect…</option>
            {EFFECT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
    </div>
)

const AudioMixerInspector: React.FC<InspectorProps> = ({ doc, actions, selection, disabled, currentMs }) => {
    const sel = selection.current

    if (sel.kind === 'none') {
        return (
            <div className="component-audio-mixer__inspector">
                <div className="component-audio-mixer__inspector-empty">Select a track, clip, or the master bus</div>
                <button type="button" className="component-audio-mixer__master-link" onClick={() => selection.select({ kind: 'master' })}>
                    Edit master bus
                </button>
            </div>
        )
    }

    if (sel.kind === 'master') {
        const loop = doc.master.loop
        return (
            <div className="component-audio-mixer__inspector">
                <div className="component-audio-mixer__inspector-title">Master bus</div>
                <label className="component-audio-mixer__field">
                    <span className="component-audio-mixer__field-label">Gain (dB)</span>
                    <input type="number" className="form-control form-control-sm" value={doc.master.gain_db} step={0.5} disabled={disabled} onChange={e => actions.setMasterGain(Number(e.target.value))} />
                </label>
                <div className="component-audio-mixer__field-label">Loop region</div>
                <div className="component-audio-mixer__loop-fields">
                    <label className="component-audio-mixer__field">
                        <span className="component-audio-mixer__field-label">Start (ms)</span>
                        <input type="number" className="form-control form-control-sm" value={loop.start_ms} disabled={disabled} onChange={e => actions.setLoop({ start_ms: Number(e.target.value) })} />
                    </label>
                    <label className="component-audio-mixer__field">
                        <span className="component-audio-mixer__field-label">End (ms)</span>
                        <input type="number" className="form-control form-control-sm" value={loop.end_ms} disabled={disabled} onChange={e => actions.setLoop({ end_ms: Number(e.target.value) })} />
                    </label>
                </div>
                <EffectChain target={{ scope: 'master' }} effects={doc.master.effects} actions={actions} disabled={disabled} />
            </div>
        )
    }

    const track = selection.track
    if (!track) return <div className="component-audio-mixer__inspector"><div className="component-audio-mixer__inspector-empty">—</div></div>

    if (sel.kind === 'clip') {
        const clip = selection.clip
        if (!clip) return <div className="component-audio-mixer__inspector"><div className="component-audio-mixer__inspector-empty">—</div></div>
        const update = (patch: Partial<MixerClip>) => actions.updateClip(track.id, clip.id, patch)
        return (
            <div className="component-audio-mixer__inspector">
                <div className="component-audio-mixer__inspector-head">
                    <span className="component-audio-mixer__inspector-title">Clip</span>
                    <Button variant="danger" outline size="small" disabled={disabled} aria-label="Delete clip" onClick={() => actions.removeClip(track.id, clip.id)}>
                        <Icon name="trash" aria-hidden={true} />
                    </Button>
                </div>
                {[
                    ['Start (ms)', 'start_ms'],
                    ['Source in (ms)', 'source_in_ms'],
                    ['Source out (ms)', 'source_out_ms'],
                    ['Gain (dB)', 'gain_db'],
                    ['Fade in (ms)', 'fade_in_ms'],
                    ['Fade out (ms)', 'fade_out_ms'],
                ].map(([label, field]) => (
                    <label key={field} className="component-audio-mixer__field">
                        <span className="component-audio-mixer__field-label">{label}</span>
                        <input type="number" className="form-control form-control-sm" value={(clip as any)[field]} disabled={disabled} onChange={e => update({ [field]: Number(e.target.value) } as Partial<MixerClip>)} />
                    </label>
                ))}
                <Button variant="secondary" outline size="small" disabled={disabled} onClick={() => actions.splitClip(track.id, clip.id, currentMs)}>
                    <Icon name="scissors" aria-hidden={true} /> Split at playhead
                </Button>
            </div>
        )
    }

    return (
        <div className="component-audio-mixer__inspector">
            <div className="component-audio-mixer__inspector-head">
                <span className="component-audio-mixer__inspector-title">{track.name}</span>
                <Button variant="danger" outline size="small" disabled={disabled} aria-label="Delete track" onClick={() => actions.removeTrack(track.id)}>
                    <Icon name="trash" aria-hidden={true} />
                </Button>
            </div>
            <label className="component-audio-mixer__field">
                <span className="component-audio-mixer__field-label">Gain (dB)</span>
                <input type="number" className="form-control form-control-sm" value={track.gain_db} step={0.5} disabled={disabled} onChange={e => actions.updateTrack(track.id, { gain_db: Number(e.target.value) })} />
            </label>
            <label className="component-audio-mixer__field">
                <span className="component-audio-mixer__field-label">Pan (-1…1)</span>
                <input type="number" className="form-control form-control-sm" value={track.pan} min={-1} max={1} step={0.1} disabled={disabled} onChange={e => actions.updateTrack(track.id, { pan: Number(e.target.value) })} />
            </label>
            <div className="component-audio-mixer__order">
                <Button variant="secondary" outline size="small" disabled={disabled} aria-label="Move track up" onClick={() => actions.moveTrack(track.id, -1)}><Icon name="arrow-up" aria-hidden={true} /></Button>
                <Button variant="secondary" outline size="small" disabled={disabled} aria-label="Move track down" onClick={() => actions.moveTrack(track.id, 1)}><Icon name="arrow-down" aria-hidden={true} /></Button>
            </div>
            <EffectChain target={{ scope: 'track', trackId: track.id }} effects={track.effects} actions={actions} disabled={disabled} />
        </div>
    )
}
