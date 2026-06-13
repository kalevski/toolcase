import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const KbdDemo: React.FC = () => {
    const comboRef = useRef<any>(null)
    const customSepRef = useRef<any>(null)

    useEffect(() => {
        if (comboRef.current) {
            comboRef.current.keys = ['Ctrl', 'K']
        }
        if (customSepRef.current) {
            customSepRef.current.keys = ['Shift', 'Alt', 'Del']
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Kbd"
                            description="Keyboard key cap(s) rendered in square mono key hints. Supports a single slotted key, a key combination via the keys JS property, and a custom separator."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Single slotted key">
                                <p className="mb-2">
                                    Press{' '}
                                    {/* @ts-ignore */}
                                    <tc-kbd>Enter</tc-kbd>
                                    {' '}to submit.
                                </p>
                            </SectionCard>

                            <SectionCard title="Key combination (keys JS property)">
                                <p className="mb-2">
                                    Quick open:{' '}
                                    {/* @ts-ignore */}
                                    <tc-kbd ref={comboRef}></tc-kbd>
                                </p>
                            </SectionCard>

                            <SectionCard title="Custom separator">
                                <p className="mb-2">
                                    Delete:{' '}
                                    {/* @ts-ignore */}
                                    <tc-kbd ref={customSepRef} separator=" then "></tc-kbd>
                                </p>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KbdDemo
