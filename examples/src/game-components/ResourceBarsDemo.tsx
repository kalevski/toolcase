import React, { useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const ResourceBarsDemo: React.FC = () => {
    const [hp, setHp] = useState(72)
    const [mp, setMp] = useState(40)
    const [stam, setStam] = useState(85)
    const [ghost, setGhost] = useState<number | null>(95)

    useEffect(() => {
        const id = window.setInterval(() => {
            setStam(s => (s <= 5 ? 100 : s - 3))
        }, 200)
        return () => window.clearInterval(id)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="Resource Bars"
                        description="HP / MP / Stamina bars sharing ResourceBarBase. Props: value, max, ghost, segments, showText, label."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Basic" />
                            <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {/* @ts-ignore */}
                                <gc-health-bar value={hp} max="100" />
                                {/* @ts-ignore */}
                                <gc-mana-bar value={mp} max="100" />
                                {/* @ts-ignore */}
                                <gc-stamina-bar value={stam} max="100" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Labelled (label prop)" />
                            <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 14 }}>
                                {/* @ts-ignore */}
                                <gc-health-bar value="320" max="500" label="Health" />
                                {/* @ts-ignore */}
                                <gc-mana-bar value="55" max="120" label="Mana" />
                                {/* @ts-ignore */}
                                <gc-stamina-bar value="80" max="100" label="Stamina" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="showText (centered)" />
                            <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {/* @ts-ignore */}
                                <gc-health-bar value="180" max="250" show-text />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Ghost overlay (recent damage)" />
                            <div style={{ width: 320, display: 'flex', flexDirection: 'column', gap: 10 }}>
                                {/* @ts-ignore */}
                                <gc-health-bar value={hp} max="100" ghost={ghost ?? undefined} label="HP" />
                                <div className="d-flex gap-2">
                                    {/* @ts-ignore */}
                                    <gc-metal-button size="sm" onClick={() => { setHp(h => Math.max(0, h - 12)); setGhost(g => (g == null ? hp : g)) }}>Take damage</gc-metal-button>
                                    {/* @ts-ignore */}
                                    <gc-metal-button size="sm" onClick={() => { setHp(100); setGhost(null) }}>Reset</gc-metal-button>
                                </div>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Segmented (segments=4)" />
                            <div style={{ width: 320 }}>
                                {/* @ts-ignore */}
                                <gc-stamina-bar value="65" max="100" segments="4" label="Stamina" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ResourceBarsDemo
