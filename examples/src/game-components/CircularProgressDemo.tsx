import React, { useEffect, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const CircularProgressDemo: React.FC = () => {
    const [tick, setTick] = useState(0)

    useEffect(() => {
        const id = setInterval(() => setTick(t => (t + 5) % 105), 200)
        return () => clearInterval(id)
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="CircularProgress"
                        description="Ring progress indicator. Value/max, optional center % text, optional reversed sweep direction. Defaults to gold bright + gold shadow track."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Default sizes (with text)" />
                            <div className="d-flex align-items-center gap-4">
                                {/* @ts-ignore */}
                                <gc-circular-progress value="25" show-text />
                                {/* @ts-ignore */}
                                <gc-circular-progress value="50" show-text />
                                {/* @ts-ignore */}
                                <gc-circular-progress value="75" show-text />
                                {/* @ts-ignore */}
                                <gc-circular-progress value="100" show-text />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Custom size + thickness" />
                            <div className="d-flex align-items-center gap-4">
                                {/* @ts-ignore */}
                                <gc-circular-progress value="40" size="48" thickness="4" show-text />
                                {/* @ts-ignore */}
                                <gc-circular-progress value="60" size="96" thickness="10" show-text />
                                {/* @ts-ignore */}
                                <gc-circular-progress value="80" size="128" thickness="14" show-text />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Custom colors (mythic / mana / stamina)" />
                            <div className="d-flex align-items-center gap-4">
                                {/* @ts-ignore */}
                                <gc-circular-progress value="65" size="80" color="var(--fg-mythic)" background="rgba(224,77,106,0.25)" show-text />
                                {/* @ts-ignore */}
                                <gc-circular-progress value="55" size="80" color="var(--fg-mana-bright)" background="rgba(58,108,201,0.25)" show-text />
                                {/* @ts-ignore */}
                                <gc-circular-progress value="80" size="80" color="var(--fg-stamina-bright)" background="rgba(111,159,58,0.25)" show-text />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Reverse sweep (cooldown style)" />
                            <div className="d-flex align-items-center gap-4">
                                {/* @ts-ignore */}
                                <gc-circular-progress value={tick} size="80" thickness="8" reverse show-text />
                                {/* @ts-ignore */}
                                <gc-circular-progress value={tick} size="80" thickness="8" show-text />
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="No text" />
                            {/* @ts-ignore */}
                            <gc-circular-progress value="33" size="80" thickness="8" />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CircularProgressDemo
