import React, { useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const TooltipDemo: React.FC = () => {
    const manualRef = useRef<any>(null)

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="Tooltip"
                            description="Bootstrap Tooltip plugin wrapper. Wrap any trigger element with tc-tooltip and use the title attribute to control the tooltip text."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Default — hover/focus trigger">
                                {/* @ts-ignore */}
                                <tc-tooltip title="Hello, I am a tooltip!">
                                    <button className="btn btn-primary">Hover me</button>
                                {/* @ts-ignore */}
                                </tc-tooltip>
                            </SectionCard>

                            <SectionCard title="placement — top / right / bottom / left">
                                <div className="d-flex flex-wrap gap-2">
                                    {(['top', 'right', 'bottom', 'left'] as const).map(p => (
                                        <React.Fragment key={p}>
                                            {/* @ts-ignore */}
                                            <tc-tooltip title={`Tooltip on the ${p}`} placement={p}>
                                                <button className="btn btn-secondary">{p}</button>
                                            {/* @ts-ignore */}
                                            </tc-tooltip>
                                        </React.Fragment>
                                    ))}
                                </div>
                            </SectionCard>

                            <SectionCard title="trigger=&quot;click&quot; — shows on click">
                                {/* @ts-ignore */}
                                <tc-tooltip title="Click-triggered tooltip" trigger="click">
                                    <button className="btn btn-info">Click me</button>
                                {/* @ts-ignore */}
                                </tc-tooltip>
                            </SectionCard>

                            <SectionCard title="html — render HTML inside the tooltip">
                                {/* @ts-ignore */}
                                <tc-tooltip title="<strong>Bold</strong> and <em>italic</em>" html>
                                    <button className="btn btn-warning">HTML tooltip</button>
                                {/* @ts-ignore */}
                                </tc-tooltip>
                            </SectionCard>

                            <SectionCard title="trigger=&quot;manual&quot; — programmatic control">
                                <div className="d-flex gap-2 mb-3">
                                    <button className="btn btn-outline-primary" onClick={() => manualRef.current?.show()}>Show</button>
                                    <button className="btn btn-outline-secondary" onClick={() => manualRef.current?.hide()}>Hide</button>
                                    <button className="btn btn-outline-secondary" onClick={() => manualRef.current?.toggle()}>Toggle</button>
                                </div>
                                {/* @ts-ignore */}
                                <tc-tooltip ref={manualRef} title="Controlled via show() / hide() / toggle()." trigger="manual">
                                    <button className="btn btn-primary">Target</button>
                                {/* @ts-ignore */}
                                </tc-tooltip>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default TooltipDemo
