import React, { useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ComboCounterDemo: React.FC = () => {
    const [combo, setCombo] = useState(1)
    const [timer, setTimer] = useState(1)

    useEffect(() => {
        const id = setInterval(() => {
            setTimer(t => {
                if (t <= 0) return 0
                return Math.max(0, t - 0.05)
            })
        }, 100)
        return () => clearInterval(id)
    }, [])

    const hit = () => {
        setCombo(c => c + 1)
        setTimer(1)
    }

    const reset = () => {
        setCombo(1)
        setTimer(0)
    }

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="ComboCounter"
                        description="Combo readout with eyebrow label + mono number + optional countdown bar. Hidden when combo ≤ 1."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Combo levels (no timer)" />
                            <div className="d-flex align-items-end gap-5" style={{ background: 'var(--fg-ink)', padding: 24 }}>
                                {/* @ts-ignore */}
                                <gc-combo-counter combo="2" />
                                {/* @ts-ignore */}
                                <gc-combo-counter combo="5" />
                                {/* @ts-ignore */}
                                <gc-combo-counter combo="12" label="Streak" />
                                {/* @ts-ignore */}
                                <gc-combo-counter combo="50" font-size="56" label="Mastery" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="With static timer bar" />
                            <div className="d-flex align-items-end gap-5" style={{ background: 'var(--fg-ink)', padding: 24 }}>
                                {/* @ts-ignore */}
                                <gc-combo-counter combo="3" timer="0.85" />
                                {/* @ts-ignore */}
                                <gc-combo-counter combo="8" timer="0.5" />
                                {/* @ts-ignore */}
                                <gc-combo-counter combo="20" timer="0.15" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Interactive (timer drains, hit to refresh)" />
                            <div className="d-flex flex-wrap gap-3 mb-3">
                                {/* @ts-ignore */}
                                <gc-metal-button variant="primary" onClick={hit}>Hit</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="ghost" onClick={reset}>Reset</gc-metal-button>
                            </div>
                            <div style={{ background: 'var(--fg-ink)', padding: 32, minHeight: 100, display: 'flex', alignItems: 'center' }}>
                                {/* @ts-ignore */}
                                <gc-combo-counter combo={combo} timer={timer.toFixed(2)} font-size="48" />
                            </div>
                            <div className="mt-3" style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>
                                combo: x{combo} · timer: {timer.toFixed(2)}
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="combo = 1 (hidden)" />
                            <div style={{ background: 'var(--fg-ink)', padding: 24 }}>
                                {/* @ts-ignore */}
                                <gc-combo-counter combo="1" />
                                <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-parch-dim)' }}>(nothing rendered)</span>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ComboCounterDemo
