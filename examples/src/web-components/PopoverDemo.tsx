import React, { useRef } from 'react'

const PopoverDemo: React.FC = () => {
    const manualRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Popover"
                            description="Bootstrap Popover plugin wrapper. Wrap any trigger element with tc-popover and use title and content attributes to control the popover text."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Default — click trigger">
                                {/* @ts-ignore */}
                                <tc-popover
                                    title="Popover title"
                                    content="And here's some amazing content. It's very engaging. Right?"
                                >
                                    <button className="btn btn-primary">
                                        Click to toggle popover
                                    </button>
                                    {/* @ts-ignore */}
                                </tc-popover>
                            </tc-section-card>

                            <tc-section-card title="placement — top / right / bottom / left">
                                <div className="d-flex flex-wrap gap-2">
                                    {(['top', 'right', 'bottom', 'left'] as const).map((p) => (
                                        <React.Fragment key={p}>
                                            {/* @ts-ignore */}
                                            <tc-popover
                                                title="Placement"
                                                content={`Popover on the ${p}`}
                                                placement={p}
                                            >
                                                <button className="btn btn-secondary">{p}</button>
                                                {/* @ts-ignore */}
                                            </tc-popover>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </tc-section-card>

                            <tc-section-card title='trigger="hover focus" — shows on hover or focus'>
                                {/* @ts-ignore */}
                                <tc-popover
                                    title="Hover or focus"
                                    content="This popover appears on hover or focus."
                                    trigger="hover focus"
                                >
                                    <button className="btn btn-info">Hover or focus me</button>
                                    {/* @ts-ignore */}
                                </tc-popover>
                            </tc-section-card>

                            <tc-section-card title="html — render HTML inside the popover">
                                {/* @ts-ignore */}
                                <tc-popover
                                    title="<strong>Bold title</strong>"
                                    content="Content with <em>italic</em> text and a <a href='#'>link</a>."
                                    html
                                >
                                    <button className="btn btn-warning">HTML popover</button>
                                    {/* @ts-ignore */}
                                </tc-popover>
                            </tc-section-card>

                            <tc-section-card title='trigger="manual" — programmatic control'>
                                <div className="d-flex gap-2 mb-3">
                                    <button
                                        className="btn btn-outline-primary"
                                        onClick={() => manualRef.current?.show()}
                                    >
                                        Show
                                    </button>
                                    <button
                                        className="btn btn-outline-secondary"
                                        onClick={() => manualRef.current?.hide()}
                                    >
                                        Hide
                                    </button>
                                    <button
                                        className="btn btn-outline-secondary"
                                        onClick={() => manualRef.current?.toggle()}
                                    >
                                        Toggle
                                    </button>
                                </div>
                                {/* @ts-ignore */}
                                <tc-popover
                                    ref={manualRef}
                                    title="Programmatic"
                                    content="Controlled via show() / hide() / toggle()."
                                    trigger="manual"
                                >
                                    <button className="btn btn-primary">Target</button>
                                    {/* @ts-ignore */}
                                </tc-popover>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default PopoverDemo
