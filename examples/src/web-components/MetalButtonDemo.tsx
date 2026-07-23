import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const MetalButtonDemo: React.FC = () => {
    const [log, setLog] = useState<string[]>([])
    const eventsRef = useTcEvents<HTMLElement>({
        click: () => {
            setLog((l) => ['click fired', ...l].slice(0, 6))
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="Metal Button"
                            description="Primary call-to-action button ported from gc-metal-button. Renders as the toolcase ink button with no game-specific chrome. Supports four variants (default, primary, danger, ghost), three sizes (sm, md, lg), disabled state, and slotted content. All cosmetics flow through --bs-metal-button-* custom properties."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Variants">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-metal-button>Default</tc-metal-button>
                                    {/* @ts-ignore */}
                                    <tc-metal-button variant="primary">Primary</tc-metal-button>
                                    {/* @ts-ignore */}
                                    <tc-metal-button variant="danger">Danger</tc-metal-button>
                                    {/* @ts-ignore */}
                                    <tc-metal-button variant="ghost">Ghost</tc-metal-button>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Sizes">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-metal-button variant="primary" size="sm">
                                        Small
                                    </tc-metal-button>
                                    {/* @ts-ignore */}
                                    <tc-metal-button variant="primary">
                                        Medium (default)
                                    </tc-metal-button>
                                    {/* @ts-ignore */}
                                    <tc-metal-button variant="primary" size="lg">
                                        Large
                                    </tc-metal-button>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Disabled state">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-metal-button disabled>Default</tc-metal-button>
                                    {/* @ts-ignore */}
                                    <tc-metal-button variant="primary" disabled>
                                        Primary
                                    </tc-metal-button>
                                    {/* @ts-ignore */}
                                    <tc-metal-button variant="danger" disabled>
                                        Danger
                                    </tc-metal-button>
                                    {/* @ts-ignore */}
                                    <tc-metal-button variant="ghost" disabled>
                                        Ghost
                                    </tc-metal-button>
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Events — click the button">
                                <div className="d-flex flex-wrap gap-3 align-items-center">
                                    {/* @ts-ignore */}
                                    <tc-metal-button ref={eventsRef} variant="primary">
                                        Click me
                                    </tc-metal-button>
                                </div>
                                <div className="mt-3">
                                    <strong className="d-block mb-1">Event log</strong>
                                    {log.length === 0 ? (
                                        <span className="text-muted">
                                            Click the button to see events…
                                        </span>
                                    ) : (
                                        <ul className="mb-0">
                                            {log.map((line, i) => (
                                                <li key={i}>
                                                    <code>{line}</code>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Custom theming via CSS custom properties">
                                {/* @ts-ignore */}
                                <tc-metal-button
                                    variant="primary"
                                    style={
                                        {
                                            '--bs-metal-button-bg':
                                                'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                            '--bs-metal-button-hover-bg':
                                                'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                            '--bs-metal-button-border-color': '#7c3aed',
                                            '--bs-metal-button-active-bg':
                                                'linear-gradient(135deg, #7c3aed, #4f46e5)',
                                        } as React.CSSProperties
                                    }
                                >
                                    Custom purple
                                </tc-metal-button>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default MetalButtonDemo
