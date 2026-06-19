import React, { useEffect, useRef, useState } from 'react'

function useFPSCapValue(initial: string): [string, React.RefObject<any>] {
    const [value, setValue] = useState(initial)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = (e: Event) => {
            const detail = (e as CustomEvent<{ value: string }>).detail
            if (detail) setValue(detail.value)
        }
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    return [value, ref]
}

const FPSCapSelectDemo: React.FC = () => {
    const [v1, ref1] = useFPSCapValue('60')
    const [v2, ref2] = useFPSCapValue('30')

    // Custom option set, supplied via the `options` JS property (not an attribute).
    const ref3 = useRef<any>(null)
    useEffect(() => {
        const el = ref3.current
        if (!el) return
        el.options = [
            { value: '60', label: '60 FPS' },
            { value: '90', label: '90 FPS' },
            { value: '165', label: '165 FPS' },
            { value: '0', label: 'Uncapped' },
        ]
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="FPS Cap Select"
                            description="A preset frame-rate-cap setting row: a label/description block paired with a native select of FPS presets. Built on the shared tc-setting-row scaffold."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — six presets, defaults to 'FPS Cap'">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-fps-cap-select ref={ref1} value="60" />
                                </div>
                                <div className="form-text mt-1">Current value: {v1}</div>
                            </tc-section-card>

                            <tc-section-card title="Custom label + description">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-fps-cap-select
                                        ref={ref2}
                                        row-label="Frame rate limit"
                                        description="Cap the renderer to reduce GPU load and coil whine."
                                        value="30"
                                    />
                                </div>
                                <div className="form-text mt-1">Current value: {v2}</div>
                            </tc-section-card>

                            <tc-section-card title="Custom presets (options JS property)">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-fps-cap-select
                                        ref={ref3}
                                        row-label="Display refresh"
                                        description="Match these to your monitor's supported refresh rates."
                                        value="165"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled">
                                <div
                                    style={{ maxWidth: 480, border: '1px solid var(--tc-border)' }}
                                >
                                    {/* @ts-ignore */}
                                    <tc-fps-cap-select
                                        row-label="Frame rate limit"
                                        description="Locked while v-sync is enforced."
                                        value="120"
                                        disabled
                                    />
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FPSCapSelectDemo
