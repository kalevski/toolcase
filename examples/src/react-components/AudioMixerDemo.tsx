import React, { useEffect, useRef, useState } from 'react'
import { AudioMixer, useAudioMixer, Card, CodeSnippet } from '@toolcase/react-components'

const SEED = JSON.stringify({
    schema: 1,
    sampleRate: 48000,
    duration_ms: 32000,
    master: { gain_db: 0, loop: { start_ms: 0, end_ms: 32000, enabled: true }, effects: [{ id: 'fx_eq', type: 'eq', bypass: false, params: { low_db: 0, mid_db: -1.5, high_db: 2 } }] },
    tracks: [
        {
            id: 'trk_music', name: 'Music', gain_db: -3, pan: 0, mute: false, solo: false,
            effects: [{ id: 'fx_rev', type: 'reverb', bypass: false, params: { mix: 0.2, decay_s: 1.8 } }],
            clips: [
                { id: 'c1', asset_id: 'loop_a', start_ms: 0, source_in_ms: 0, source_out_ms: 16000, gain_db: 0, fade_in_ms: 50, fade_out_ms: 200 },
                { id: 'c2', asset_id: 'loop_a', start_ms: 16000, source_in_ms: 0, source_out_ms: 16000, gain_db: 0, fade_in_ms: 0, fade_out_ms: 200 },
            ],
        },
        {
            id: 'trk_sfx', name: 'SFX', gain_db: 0, pan: 0.2, mute: false, solo: false, effects: [],
            clips: [
                { id: 'c3', asset_id: 'hit', start_ms: 4000, source_in_ms: 0, source_out_ms: 1200, gain_db: -2, fade_in_ms: 0, fade_out_ms: 100 },
                { id: 'c4', asset_id: 'hit', start_ms: 12000, source_in_ms: 0, source_out_ms: 1200, gain_db: -2, fade_in_ms: 0, fade_out_ms: 100 },
            ],
        },
    ],
})

const LiveMixer: React.FC = () => {
    const [value, setValue] = useState(SEED)
    const { view } = useAudioMixer({ value, onChange: setValue })

    const [currentMs, setCurrentMs] = useState(0)
    const tick = useRef<number | null>(null)

    useEffect(() => {
        tick.current = window.setInterval(() => setCurrentMs(ms => (ms >= 32000 ? 0 : ms + 100)), 100)
        return () => { if (tick.current) window.clearInterval(tick.current) }
    }, [])

    return (
        <AudioMixer
            {...view}
            currentMs={currentMs}
            onSeek={ms => setCurrentMs(ms)}
        />
    )
}

const DisabledMixer: React.FC = () => {
    const { view } = useAudioMixer({ value: SEED, disabled: true })
    return <AudioMixer {...view} disabled />
}

const EmptyMixer: React.FC = () => {
    const { view } = useAudioMixer({})
    return <AudioMixer {...view} />
}

const LoadingMixer: React.FC = () => {
    const { view } = useAudioMixer({})
    return <AudioMixer {...view} loading />
}

const AudioMixerDemo: React.FC = () => (
    <div className="container my-5">
        <div className="row mb-4">
            <div className="col-12">
                <h1 className="display-4 text-gradient-primary mb-2">AudioMixer</h1>
                <p className="text-muted mb-0">
                    Headless multitrack mixer editor. <code>useAudioMixer()</code> owns the project document + mutations;
                    the <code>AudioMixer</code> view renders track headers, timeline and inspector. Visual only —
                    callback-driven, no Web Audio inside.
                </p>
            </div>
        </div>

        <div className="row mb-5">
            <div className="col-12">
                <Card>
                    <h2 className="h5 mb-3">Live (playhead simulated)</h2>
                    <LiveMixer />
                </Card>
            </div>
        </div>

        <div className="row mb-5">
            <div className="col-12">
                <Card>
                    <h2 className="h5 mb-3">Empty (uncontrolled)</h2>
                    <EmptyMixer />
                </Card>
            </div>
        </div>

        <div className="row mb-5">
            <div className="col-12">
                <Card>
                    <h2 className="h5 mb-3">Disabled</h2>
                    <DisabledMixer />
                </Card>
            </div>
        </div>

        <div className="row mb-5">
            <div className="col-12">
                <Card>
                    <h2 className="h5 mb-3">Loading</h2>
                    <LoadingMixer />
                </Card>
            </div>
        </div>

        <div className="row mb-5">
            <div className="col-12">
                <Card>
                    <h2 className="h5 mb-3">Usage</h2>
                    <CodeSnippet
                        language="typescript"
                        code={`const { view } = useAudioMixer({ value, onChange })

<AudioMixer
    {...view}
    currentMs={currentMs}
    onSeek={engine.seek}
/>`}
                    />
                </Card>
            </div>
        </div>
    </div>
)

export default AudioMixerDemo
