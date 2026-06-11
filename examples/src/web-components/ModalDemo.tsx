import React, { useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const ModalDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const centeredRef = useRef<any>(null)
    const scrollableRef = useRef<any>(null)
    const staticRef = useRef<any>(null)
    const lgRef = useRef<any>(null)
    const footerRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Modal"
                            description="Bootstrap Modal plugin wrapper. Use the title attribute for the header, default children for the body, and slot='footer' children for the footer."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — basic modal with title and body">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => basicRef.current?.show()}
                                >
                                    Open modal
                                </button>
                                {/* @ts-ignore */}
                                <tc-modal ref={basicRef} title="Basic Modal">
                                    <p>This is the modal body. Add any content here as children of <code>tc-modal</code>.</p>
                                {/* @ts-ignore */}
                                </tc-modal>
                            </SectionCard>

                            <SectionCard title="centered — vertically centred dialog">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => centeredRef.current?.show()}
                                >
                                    Open centred modal
                                </button>
                                {/* @ts-ignore */}
                                <tc-modal ref={centeredRef} title="Centred Modal" centered>
                                    <p>This modal is vertically centred on the screen.</p>
                                {/* @ts-ignore */}
                                </tc-modal>
                            </SectionCard>

                            <SectionCard title="scrollable — long content with scrollable body">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => scrollableRef.current?.show()}
                                >
                                    Open scrollable modal
                                </button>
                                {/* @ts-ignore */}
                                <tc-modal ref={scrollableRef} title="Scrollable Modal" scrollable centered>
                                    {Array.from({ length: 20 }, (_, i) => (
                                        <p key={i}>Paragraph {i + 1} — scroll down to see more content inside the modal body.</p>
                                    ))}
                                {/* @ts-ignore */}
                                </tc-modal>
                            </SectionCard>

                            <SectionCard title="static-backdrop — click outside does not close">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => staticRef.current?.show()}
                                >
                                    Open static modal
                                </button>
                                {/* @ts-ignore */}
                                <tc-modal ref={staticRef} title="Static Backdrop" static-backdrop>
                                    <p>Clicking outside this modal will not close it. Use the Close button.</p>
                                {/* @ts-ignore */}
                                </tc-modal>
                            </SectionCard>

                            <SectionCard title="size — large modal (lg)">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => lgRef.current?.show()}
                                >
                                    Open large modal
                                </button>
                                {/* @ts-ignore */}
                                <tc-modal ref={lgRef} title="Large Modal" size="lg">
                                    <p>This modal uses <code>size="lg"</code> for a wider dialog. Also available: <code>sm</code> and <code>xl</code>.</p>
                                {/* @ts-ignore */}
                                </tc-modal>
                            </SectionCard>

                            <SectionCard title="slot=&quot;footer&quot; — modal with action footer">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => footerRef.current?.show()}
                                >
                                    Open modal with footer
                                </button>
                                {/* @ts-ignore */}
                                <tc-modal ref={footerRef} title="Confirm Action" centered>
                                    <p>Are you sure you want to proceed? This action cannot be undone.</p>
                                    <button
                                        slot="footer"
                                        className="btn btn-secondary"
                                        onClick={() => footerRef.current?.hide()}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        slot="footer"
                                        className="btn btn-danger"
                                        onClick={() => footerRef.current?.hide()}
                                    >
                                        Confirm
                                    </button>
                                {/* @ts-ignore */}
                                </tc-modal>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ModalDemo
