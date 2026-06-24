import React from 'react'

const KeyDemo: React.FC = () => {
    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Key"
                            description="Single keyboard key glyph. A sharp square mono cap for annotating keyboard keys in documentation, instructions, and UI prompts."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default (md)">
                                <p className="mb-2">
                                    Press {/* @ts-ignore */}
                                    <tc-key>Esc</tc-key> to cancel or {/* @ts-ignore */}
                                    <tc-key>Enter</tc-key> to confirm.
                                </p>
                                <p className="mb-0">
                                    Navigate with {/* @ts-ignore */}
                                    <tc-key>W</tc-key> {/* @ts-ignore */}
                                    <tc-key>A</tc-key> {/* @ts-ignore */}
                                    <tc-key>S</tc-key> {/* @ts-ignore */}
                                    <tc-key>D</tc-key>
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Sizes">
                                <div className="d-flex align-items-center gap-3">
                                    {/* @ts-ignore */}
                                    <tc-key size="sm">Ctrl</tc-key>
                                    {/* @ts-ignore */}
                                    <tc-key size="md">Ctrl</tc-key>
                                    {/* @ts-ignore */}
                                    <tc-key size="lg">Ctrl</tc-key>
                                </div>
                                <p className="text-muted mt-2 mb-0" style={{ fontSize: '0.8rem' }}>
                                    sm · md (default) · lg
                                </p>
                            </tc-section-card>

                            <tc-section-card title="Active variant">
                                <p className="mb-2">
                                    Highlighted key indicating the currently pressed or active
                                    binding:
                                </p>
                                <div className="d-flex align-items-center gap-2">
                                    {/* @ts-ignore */}
                                    <tc-key variant="active">Space</tc-key>
                                    {/* @ts-ignore */}
                                    <tc-key>F</tc-key>
                                    {/* @ts-ignore */}
                                    <tc-key>R</tc-key>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="In-context usage">
                                <p className="mb-2">
                                    Hold {/* @ts-ignore */}
                                    <tc-key variant="active">Shift</tc-key> and press{' '}
                                    {/* @ts-ignore */}
                                    <tc-key>Tab</tc-key> to move focus backward.
                                </p>
                                <p className="mb-0">
                                    Use {/* @ts-ignore */}
                                    <tc-key size="sm">↑</tc-key> {/* @ts-ignore */}
                                    <tc-key size="sm">↓</tc-key> arrow keys to select an item.
                                </p>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default KeyDemo
