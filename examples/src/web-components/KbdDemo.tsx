import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const KbdDemo: React.FC = () => {
    const comboRef = useTc<HTMLElement>({ keys: ['Ctrl', 'K'] })
    const customSepRef = useTc<HTMLElement>({ keys: ['Shift', 'Alt', 'Del'] })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Kbd"
                            description="Keyboard key cap(s) rendered in square mono key hints. Supports a single slotted key, a key combination via the keys JS property, and a custom separator."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Single slotted key">
                                <p className="mb-2">
                                    Press {/* @ts-ignore */}
                                    <tc-kbd>Enter</tc-kbd> to submit.
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Key combination (keys JS property)">
                                <p className="mb-2">
                                    Quick open: {/* @ts-ignore */}
                                    <tc-kbd ref={comboRef}></tc-kbd>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Custom separator">
                                <p className="mb-2">
                                    Delete: {/* @ts-ignore */}
                                    <tc-kbd ref={customSepRef} separator=" then "></tc-kbd>
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KbdDemo
