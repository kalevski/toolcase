import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'
import '@toolcase/game-components'

const SECTIONS = [
    { role: 'Direction', names: ['Aldric Vane', 'Brina Storm'] },
    { role: 'Engineering', names: ['Caelum Brook', 'Dorin Hale', 'Eira Wynne'] },
    { role: 'Art', names: ['Faelyn Reed', 'Garrick Ash'] },
    { role: 'Sound', names: ['Hesper Lane'] }
]

const CreditsListDemo: React.FC = () => {
    const ref = useRef<HTMLElement>(null)

    useEffect(() => {
        const el = ref.current as any
        if (!el) return
        el.sections = SECTIONS
    }, [])

    return (
        <div className="container py-4">
            <div className="row">
                <div className="col-12">
                    <RichPageHeader
                        chips={<RichPageHeaderChip>Game Components</RichPageHeaderChip>}
                        title="CreditsList"
                        description="Static credits roster with role headings and names."
                    />
                    <div className="d-flex flex-column gap-4 mt-4">
                        <SectionCard title="Default">
                            <div style={{ maxWidth: 480, padding: 24, background: 'rgba(0,0,0,0.4)' }}>
                                {/* @ts-ignore */}
                                <gc-credits-list ref={ref} />
                            </div>
                        </SectionCard>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default CreditsListDemo
