import React, { useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const CooldownBadgeDemo: React.FC = () => {
    const [t, setT] = useState(6)

    useEffect(() => {
        const id = setInterval(() => {
            setT(prev => (prev <= 0 ? 6 : Math.max(0, prev - 0.1)))
        }, 100)
        return () => clearInterval(id)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="CooldownBadge"
                        description="Slot-styled circular cooldown ring (32–64px). Conic-gradient sweep over a slot bevel, mono center label auto-formats remaining time, gold ready-glow on completion."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Sizes 32 / 40 / 48 / 56 / 64" />
                            <div className="d-flex align-items-center gap-4">
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="32" value={t} max="6" show-label />
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="40" value={t} max="6" show-label />
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="48" value={t} max="6" show-label />
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="56" value={t} max="6" show-label />
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="64" value={t} max="6" show-label />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Static label vs auto countdown" />
                            <div className="d-flex align-items-center gap-4">
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="48" value="0" max="6" label="READY" />
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="48" value="2.4" max="6" show-label />
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="48" value="42" max="120" show-label />
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="48" value="95" max="240" show-label />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Without label (overlay only)" />
                            <div className="d-flex align-items-center gap-4">
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="48" value={t} max="6" />
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="56" value={Math.max(0, t - 1.5)} max="6" />
                                {/* @ts-ignore */}
                                <gc-cooldown-badge size="64" value={Math.max(0, t - 3)} max="6" />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CooldownBadgeDemo
