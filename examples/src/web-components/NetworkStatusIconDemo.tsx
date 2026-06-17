import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const NetworkStatusIconDemo: React.FC = () => {
    const interactiveRef = useRef<any>(null)

    useEffect(() => {
        const el = interactiveRef.current
        if (!el) return

        let direction = 1
        let ping = 20
        const id = setInterval(() => {
            ping += direction * 15
            if (ping >= 250) { ping = 250; direction = -1 }
            if (ping <= 20) { ping = 20; direction = 1 }
            el.ping = ping
        }, 600)

        return () => clearInterval(id)
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="NetworkStatusIcon"
                            description="4-bar signal-strength indicator. Quality is computed from ping latency and packet loss. Tiers: good (4 bars), ok (3), warning (2), bad (1), offline (0)."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">

                            <SectionCard title="Quality tiers — with label">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="24" show-label />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="80" show-label />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="150" show-label />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="240" show-label />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon show-label />
                                </div>
                            </SectionCard>

                            <SectionCard title="Without label (compact)">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="24" />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="80" />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="150" />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="240" />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon />
                                </div>
                            </SectionCard>

                            <SectionCard title="Loss-driven tier downgrade">
                                <div className="d-flex align-items-center gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="30" loss="0" show-label />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="30" loss="2" show-label />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="30" loss="4" show-label />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="30" loss="6" show-label />
                                </div>
                            </SectionCard>

                            <SectionCard title="Sizes">
                                <div className="d-flex align-items-end gap-4 flex-wrap">
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="50" size="12" />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="50" size="16" />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="50" size="24" show-label />
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon connected ping="50" size="36" show-label />
                                </div>
                            </SectionCard>

                            <SectionCard title="Live ping update (JS property)">
                                <div className="d-flex align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-network-status-icon ref={interactiveRef} connected size="24" show-label />
                                    <span className="text-muted ms-2" style={{ fontSize: '0.8125rem' }}>
                                        Ping animates 20–250 ms every 600 ms
                                    </span>
                                </div>
                            </SectionCard>

                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default NetworkStatusIconDemo
