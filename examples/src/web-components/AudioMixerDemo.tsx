import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

interface Effect {
    id: string
    type: string
    params?: Record<string, number>
}
interface Clip {
    id: string
    startMs: number
    lengthMs: number
    label?: string
    effects?: Effect[]
}
interface Track {
    id: string
    name: string
    muted?: boolean
    solo?: boolean
    volume?: number
    clips: Clip[]
}
interface MixerDoc {
    durationMs: number
    tracks: Track[]
}
interface Selection {
    trackId?: string | null
    clipId?: string | null
}

const INITIAL_DOC: MixerDoc = {
    durationMs: 32000,
    tracks: [
        {
            id: 'drums',
            name: 'Drums',
            volume: 0.9,
            clips: [
                { id: 'd1', startMs: 0, lengthMs: 8000, label: 'Loop A', effects: [{ id: 'fx0', type: 'eq' }] },
                { id: 'd2', startMs: 12000, lengthMs: 10000, label: 'Loop B' },
            ],
        },
        {
            id: 'bass',
            name: 'Bass',
            volume: 0.75,
            muted: true,
            clips: [{ id: 'b1', startMs: 2000, lengthMs: 18000, label: 'Sub bass' }],
        },
        {
            id: 'lead',
            name: 'Lead Synth',
            volume: 0.6,
            solo: true,
            clips: [
                { id: 'l1', startMs: 6000, lengthMs: 6000, label: 'Riff' },
                { id: 'l2', startMs: 16000, lengthMs: 12000, label: 'Hook' },
            ],
        },
    ],
}

const mapTrack = (doc: MixerDoc, trackId: string, fn: (t: Track) => Track): MixerDoc => ({
    ...doc,
    tracks: doc.tracks.map(t => (t.id === trackId ? fn(t) : t)),
})

const mapClip = (doc: MixerDoc, clipId: string, fn: (c: Clip) => Clip): MixerDoc => ({
    ...doc,
    tracks: doc.tracks.map(t => ({ ...t, clips: t.clips.map(c => (c.id === clipId ? fn(c) : c)) })),
})

const findTrackOfClip = (doc: MixerDoc, clipId: string): Track | undefined =>
    doc.tracks.find(t => t.clips.some(c => c.id === clipId))

const AudioMixerDemo: React.FC = () => {
    const ref = useRef<any>(null)
    const [doc, setDoc] = useState<MixerDoc>(INITIAL_DOC)
    const [selection, setSelection] = useState<Selection>({ trackId: 'drums', clipId: 'd1' })
    const [currentMs, setCurrentMs] = useState(9000)

    // Keep the element's JS properties in sync with React state (controlled).
    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.doc = doc
        el.selection = selection
    }, [doc, selection])

    // Wire the focused CustomEvents to local-state reducers.
    useEffect(() => {
        const el = ref.current
        if (!el) return

        const onSeek = (e: Event) => setCurrentMs((e as CustomEvent).detail.ms)
        const onSelect = (e: Event) => {
            const { trackId, clipId } = (e as CustomEvent).detail
            setSelection({ trackId, clipId })
        }
        const onClipMove = (e: Event) => {
            const { clipId, startMs } = (e as CustomEvent).detail
            setDoc(d => mapClip(d, clipId, c => ({ ...c, startMs })))
        }
        const onClipResize = (e: Event) => {
            const { clipId, lengthMs } = (e as CustomEvent).detail
            setDoc(d => mapClip(d, clipId, c => ({ ...c, lengthMs })))
        }
        const onMute = (e: Event) => {
            const { trackId, muted } = (e as CustomEvent).detail
            setDoc(d => mapTrack(d, trackId, t => ({ ...t, muted })))
        }
        const onSolo = (e: Event) => {
            const { trackId, solo } = (e as CustomEvent).detail
            setDoc(d => mapTrack(d, trackId, t => ({ ...t, solo })))
        }
        const onVolume = (e: Event) => {
            const { trackId, volume } = (e as CustomEvent).detail
            setDoc(d => mapTrack(d, trackId, t => ({ ...t, volume })))
        }
        const onEffectAdd = (e: Event) => {
            const { clipId, effect } = (e as CustomEvent).detail
            setDoc(d => mapClip(d, clipId, c => ({ ...c, effects: [...(c.effects ?? []), effect] })))
        }
        const onEffectRemove = (e: Event) => {
            const { clipId, effect } = (e as CustomEvent).detail
            setDoc(d => mapClip(d, clipId, c => ({ ...c, effects: (c.effects ?? []).filter(fx => fx.id !== effect.id) })))
        }

        el.addEventListener('tc-seek', onSeek)
        el.addEventListener('tc-select', onSelect)
        el.addEventListener('tc-clip-move', onClipMove)
        el.addEventListener('tc-clip-resize', onClipResize)
        el.addEventListener('tc-track-mute', onMute)
        el.addEventListener('tc-track-solo', onSolo)
        el.addEventListener('tc-volume-change', onVolume)
        el.addEventListener('tc-effect-add', onEffectAdd)
        el.addEventListener('tc-effect-remove', onEffectRemove)
        return () => {
            el.removeEventListener('tc-seek', onSeek)
            el.removeEventListener('tc-select', onSelect)
            el.removeEventListener('tc-clip-move', onClipMove)
            el.removeEventListener('tc-clip-resize', onClipResize)
            el.removeEventListener('tc-track-mute', onMute)
            el.removeEventListener('tc-track-solo', onSolo)
            el.removeEventListener('tc-volume-change', onVolume)
            el.removeEventListener('tc-effect-add', onEffectAdd)
            el.removeEventListener('tc-effect-remove', onEffectRemove)
        }
    }, [])

    const selectedTrack = doc.tracks.find(t => t.id === selection.trackId)
    const selectedClip =
        selection.clipId != null ? findTrackOfClip(doc, selection.clipId)?.clips.find(c => c.id === selection.clipId) : undefined

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Audio Mixer"
                            description="A framework-free timeline editor: track headers with mute/solo/volume, draggable and edge-resizable clips, a keyboard-seekable ruler & playhead, and an effect-chain inspector. Fully controlled via the doc/selection/actions properties and tc-* events."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Interactive timeline">
                                {/* @ts-ignore */}
                                <tc-audio-mixer ref={ref} current-ms={currentMs} />
                                <div className="form-text mt-2">
                                    Playhead: {Math.round(currentMs)} ms · Selected:{' '}
                                    {selectedClip
                                        ? `clip "${selectedClip.label ?? selectedClip.id}"`
                                        : selectedTrack
                                          ? `track "${selectedTrack.name}"`
                                          : 'none'}
                                    . Drag a clip to move it, drag its edges to resize, click the ruler to seek, and add
                                    effects in the inspector.
                                </div>
                            </SectionCard>

                            <SectionCard title="Loading">
                                {/* @ts-ignore */}
                                <tc-audio-mixer loading />
                            </SectionCard>

                            <SectionCard title="Disabled">
                                {/* @ts-ignore */}
                                <DisabledMixer />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

// A static, frozen instance to show the disabled treatment.
const DisabledMixer: React.FC = () => {
    const ref = useRef<any>(null)
    useEffect(() => {
        const el = ref.current
        if (!el) return
        el.doc = INITIAL_DOC
        el.selection = { trackId: 'lead', clipId: 'l1' }
    }, [])
    // @ts-ignore
    return <tc-audio-mixer ref={ref} disabled current-ms={6000} />
}

export default AudioMixerDemo
