import React from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const NetworkStatusIconDemo: React.FC = () => (
    <div className="container py-4">
        <div className="row">
            <div className="col-12">
                <RichPageHeader
                    chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                    title="NetworkStatusIcon"
                    description="4-bar wifi-style indicator. Quality from ping + loss + connected. Tiers: good (4), ok (3), warning (2), bad (1), offline (0)."
                />
                <div className="d-flex flex-column gap-4 mt-4">
                    {/* @ts-ignore */}
                    <gc-panel bordered>
                        {/* @ts-ignore */}
                        <gc-panel-header header-title="Quality tiers (with label)" />
                        <div className="d-flex align-items-center gap-4">
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="24" show-label />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="80" show-label />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="150" show-label />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="240" show-label />
                            {/* @ts-ignore */}
                            <gc-network-status-icon show-label />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Without label (HUD-compact)" />
                        <div className="d-flex align-items-center gap-4">
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="24" />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="80" />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="150" />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="240" />
                            {/* @ts-ignore */}
                            <gc-network-status-icon />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Loss-driven downgrade (good ping, high loss)" />
                        <div className="d-flex align-items-center gap-4">
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="30" loss="0" show-label />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="30" loss="2" show-label />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="30" loss="4" show-label />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="30" loss="6" show-label />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>

                    {/* @ts-ignore */}

                    <gc-panel bordered>

                        {/* @ts-ignore */}

                        <gc-panel-header header-title="Sizes" />
                        <div className="d-flex align-items-center gap-4">
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="50" size="12" />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="50" size="16" />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="50" size="24" show-label />
                            {/* @ts-ignore */}
                            <gc-network-status-icon connected ping="50" size="36" show-label />
                        </div>
                    {/* @ts-ignore */}
                    </gc-panel>
                </div>
            </div>
        </div>
    </div>
)

export default NetworkStatusIconDemo
