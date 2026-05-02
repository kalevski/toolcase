import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip } from '@toolcase/react-components'
import '@toolcase/game-components'

const PageIndicatorDemo: React.FC = () => {
    const [activeIndex, setActiveIndex] = useState(2)
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const onSelect = (event: Event) => {
            const e = event as CustomEvent<{ index: number }>
            setActiveIndex(e.detail.index)
        }
        el.addEventListener('select', onSelect)
        return () => el.removeEventListener('select', onSelect)
    }, [])

    useEffect(() => {
        if (ref.current) ref.current.setAttribute('index', String(activeIndex))
    }, [activeIndex])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="PageIndicator"
                        description="Diamond-shaped page dots. Click emits 'select' with {index}. Props: count, index, size, gap, color, activeColor."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        {/* @ts-ignore */}
                        <gc-panel bordered>
                            {/* @ts-ignore */}
                            <gc-panel-header header-title="Default (5 pages, index 2)" />
                            {/* @ts-ignore */}
                            <gc-page-indicator count="5" index="2" />
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Interactive (click a dot)" />
                            <div className="d-flex align-items-center gap-3">
                                {/* @ts-ignore */}
                                <gc-page-indicator ref={ref} count="7" index={activeIndex} />
                                <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>
                                    page {activeIndex + 1} / 7
                                </span>
                            </div>
                        {/* @ts-ignore */}
                        </gc-panel>

                        {/* @ts-ignore */}

                        <gc-panel bordered>

                            {/* @ts-ignore */}

                            <gc-panel-header header-title="Custom colors + larger size" />
                            {/* @ts-ignore */}
                            <gc-page-indicator
                                count="6"
                                index="3"
                                size="14"
                                gap="14px"
                                color="var(--fg-gold-shadow)"
                                active-color="var(--fg-mythic)"
                            />
                        {/* @ts-ignore */}
                        </gc-panel>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PageIndicatorDemo
