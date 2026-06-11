import React, { useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const OffcanvasDemo: React.FC = () => {
    const startRef = useRef<any>(null)
    const endRef = useRef<any>(null)
    const topRef = useRef<any>(null)
    const bottomRef = useRef<any>(null)
    const staticRef = useRef<any>(null)
    const scrollRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Offcanvas"
                            description="Bootstrap Offcanvas plugin wrapper. Use the placement attribute to control the slide-in direction, title for the header, and children for the body."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — start placement">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => startRef.current?.show()}
                                >
                                    Open offcanvas (start)
                                </button>
                                {/* @ts-ignore */}
                                <tc-offcanvas ref={startRef} title="Start Panel" placement="start">
                                    <p>This panel slides in from the left (start). Add any content here as children of <code>tc-offcanvas</code>.</p>
                                {/* @ts-ignore */}
                                </tc-offcanvas>
                            </SectionCard>

                            <SectionCard title="placement=&quot;end&quot; — slide in from the right">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => endRef.current?.show()}
                                >
                                    Open offcanvas (end)
                                </button>
                                {/* @ts-ignore */}
                                <tc-offcanvas ref={endRef} title="End Panel" placement="end">
                                    <p>This panel slides in from the right.</p>
                                {/* @ts-ignore */}
                                </tc-offcanvas>
                            </SectionCard>

                            <SectionCard title="placement=&quot;top&quot; — slide in from the top">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => topRef.current?.show()}
                                >
                                    Open offcanvas (top)
                                </button>
                                {/* @ts-ignore */}
                                <tc-offcanvas ref={topRef} title="Top Panel" placement="top">
                                    <p>This panel slides in from the top of the viewport.</p>
                                {/* @ts-ignore */}
                                </tc-offcanvas>
                            </SectionCard>

                            <SectionCard title="placement=&quot;bottom&quot; — slide in from the bottom">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => bottomRef.current?.show()}
                                >
                                    Open offcanvas (bottom)
                                </button>
                                {/* @ts-ignore */}
                                <tc-offcanvas ref={bottomRef} title="Bottom Panel" placement="bottom">
                                    <p>This panel slides in from the bottom of the viewport.</p>
                                {/* @ts-ignore */}
                                </tc-offcanvas>
                            </SectionCard>

                            <SectionCard title="backdrop=&quot;static&quot; — click outside does not close">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => staticRef.current?.show()}
                                >
                                    Open static offcanvas
                                </button>
                                {/* @ts-ignore */}
                                <tc-offcanvas ref={staticRef} title="Static Backdrop" placement="start" backdrop="static">
                                    <p>Clicking outside this panel will not close it. Use the Close button.</p>
                                {/* @ts-ignore */}
                                </tc-offcanvas>
                            </SectionCard>

                            <SectionCard title="scroll — allow body scroll while open">
                                <button
                                    className="btn btn-primary"
                                    onClick={() => scrollRef.current?.show()}
                                >
                                    Open scrollable offcanvas
                                </button>
                                {/* @ts-ignore */}
                                <tc-offcanvas ref={scrollRef} title="Body Scroll" placement="end" scroll>
                                    <p>The page body remains scrollable while this panel is open.</p>
                                {/* @ts-ignore */}
                                </tc-offcanvas>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default OffcanvasDemo
