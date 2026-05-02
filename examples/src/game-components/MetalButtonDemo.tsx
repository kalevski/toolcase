import React, { useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const MetalButtonDemo: React.FC = () => {
    const [count, setCount] = useState(0)

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="MetalButton"
                        description="Gilded fantasy button. Variants: default, primary, danger, ghost. Sizes: sm, md, lg. Native click event."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Variants (md)">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <gc-metal-button>Default</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="primary">Primary</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="danger">Danger</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="ghost">Ghost</gc-metal-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Sizes">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <gc-metal-button size="sm" variant="primary">Small</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button size="md" variant="primary">Medium</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button size="lg" variant="primary">Large</gc-metal-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Disabled">
                            <div className="d-flex flex-wrap gap-3 align-items-center">
                                {/* @ts-ignore */}
                                <gc-metal-button disabled>Default</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="primary" disabled>Primary</gc-metal-button>
                                {/* @ts-ignore */}
                                <gc-metal-button variant="danger" disabled>Danger</gc-metal-button>
                            </div>
                        </SectionCard>

                        <SectionCard title="Interactive (click counter)">
                            <div className="d-flex align-items-center gap-3">
                                {/* @ts-ignore */}
                                <gc-metal-button variant="primary" onClick={() => setCount(c => c + 1)}>
                                    Strike
                                </gc-metal-button>
                                <span style={{ fontFamily: 'var(--fg-mono)', color: 'var(--fg-gold-bright)' }}>
                                    strikes: {count}
                                </span>
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MetalButtonDemo
