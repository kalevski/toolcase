import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const SettingRowsDemo: React.FC = () => {
    const [lastChange, setLastChange] = useState<string>('—')
    const selectRef = useRef<HTMLElement>(null)
    const fpsRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const sel = selectRef.current as any
        if (sel) sel.options = [
            { value: 'borderless', label: 'Borderless window' },
            { value: 'fullscreen', label: 'Fullscreen' },
            { value: 'windowed', label: 'Windowed' },
        ]
    }, [])

    const onChange = (label: string) => (e: any) => {
        setLastChange(`${label} → ${JSON.stringify(e.detail)}`)
    }

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Setting Rows"
                        description="Setting list components extending SettingRowBase: sliders, toggles, selects, preset picker, reset."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Sliders" />
                            {/* @ts-ignore */}
                            <gc-panel bordered>
                                {/* @ts-ignore */}
                                <gc-fov-slider value="100" min="60" max="120" description="Wider FOV shows more world but distorts edges." onChange={onChange('FOV')} />
                                {/* @ts-ignore */}
                                <gc-deadzone-slider value="0.18" description="Stick movement below this fraction is ignored." onChange={onChange('Deadzone')} />
                                {/* @ts-ignore */}
                                <gc-volume-slider value="0.65" description="Master output level." onChange={onChange('Volume')} />
                                {/* @ts-ignore */}
                                <gc-mouse-sensitivity value="2.4" ads="1.2" description="Camera pan rate per pixel of mouse delta." onChange={onChange('Mouse')} />
                                {/* @ts-ignore */}
                            </gc-panel>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Toggles" />
                            {/* @ts-ignore */}
                            <gc-panel bordered>
                                {/* @ts-ignore */}
                                <gc-fullscreen-toggle checked description="Use exclusive fullscreen for max performance." onChange={onChange('Fullscreen')} />
                                {/* @ts-ignore */}
                                <gc-invert-axis-toggle description="Invert vertical mouse / stick look." onChange={onChange('Invert Y')} />
                                {/* @ts-ignore */}
                                <gc-vsync-toggle checked description="Reduces tearing, may add input latency." onChange={onChange('V-Sync')} />
                                {/* @ts-ignore */}
                                <gc-toggle-row row-label="Motion blur" description="Adds per-object motion blur to fast objects." onChange={onChange('Motion blur')} />
                                {/* @ts-ignore */}
                            </gc-panel>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Selects & preset" />
                            {/* @ts-ignore */}
                            <gc-panel bordered>
                                {/* @ts-ignore */}
                                <gc-fps-cap-select ref={fpsRef} value="144" description="Limit how many frames per second are rendered." onChange={onChange('FPS cap')} />
                                {/* @ts-ignore */}
                                <gc-select-row ref={selectRef} row-label="Display mode" value="borderless" description="How the game window covers your screen." onChange={onChange('Display mode')} />
                                {/* @ts-ignore */}
                                <gc-graphics-preset-picker value="high" description="Quick set of all graphics options." onChange={onChange('Quality')} />
                                {/* @ts-ignore */}
                            </gc-panel>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Reset to defaults" />
                            {/* @ts-ignore */}
                            <gc-panel bordered>
                                {/* @ts-ignore */}
                                <gc-reset-to-defaults description="Returns all settings to factory values." onReset={() => setLastChange('Reset → defaults')} />
                                {/* @ts-ignore */}
                            </gc-panel>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Last event" />
                            <div style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>{lastChange}</div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default SettingRowsDemo
