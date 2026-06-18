import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

function useResetCount(): [number, React.RefObject<any>] {
    const [count, setCount] = useState(0)
    const ref = useRef<any>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const handler = () => setCount(c => c + 1)
        el.addEventListener('tc-reset', handler)
        return () => el.removeEventListener('tc-reset', handler)
    }, [])

    return [count, ref]
}

const ResetToDefaultsDemo: React.FC = () => {
    const [resetCount, ref1] = useResetCount()

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Reset to Defaults"
                            description="A two-step reset action row: an idle Reset button that enters a confirmation state, where Confirm reset fires tc-reset and Cancel reverts. Built on the shared tc-setting-row scaffold."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — idle state">
                                <div style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-reset-to-defaults ref={ref1} />
                                </div>
                                <div className="form-text mt-1">
                                    Resets confirmed: {resetCount}
                                </div>
                            </SectionCard>

                            <SectionCard title="With label and description">
                                <div style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-reset-to-defaults
                                        row-label="Restore factory defaults"
                                        description="All settings will return to their factory values. This cannot be undone."
                                    />
                                </div>
                            </SectionCard>

                            <SectionCard title="Disabled">
                                <div style={{ maxWidth: 520, border: '1px solid var(--tc-border)' }}>
                                    {/* @ts-ignore */}
                                    <tc-reset-to-defaults
                                        row-label="Reset to defaults"
                                        description="Locked while a game session is active."
                                        disabled
                                    />
                                </div>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResetToDefaultsDemo
