import React, { useState } from 'react'
import { useTcEvents } from '@toolcase/web-components/react'

const EntityCellDemo: React.FC = () => {
    const [lastClicked, setLastClicked] = useState<string | null>(null)
    const clickableRef = useTcEvents<HTMLElement>({
        'tc-click': (e: CustomEvent) => {
            setLastClicked(e.detail.name ?? '(unknown)')
        },
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="EntityCell"
                            description="A card showing an entity with an initials tile, name, optional sublabel, and optional click handler. Colour tints the tile for identity; slate is the default."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Color variants (md size)">
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="AJ"
                                        name="Alice Johnson"
                                        color="slate"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell initial="BK" name="Bob Karlsson" color="blue" />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="CA"
                                        name="Cara Andrade"
                                        color="green"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell initial="DM" name="David Müller" color="red" />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="EL"
                                        name="Ella Laurent"
                                        color="yellow"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="FP"
                                        name="Finn Petrov"
                                        color="purple"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="GS"
                                        name="Gloria Santos"
                                        color="orange"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Sizes">
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 320 }}>
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="SM"
                                        name="Small size"
                                        color="blue"
                                        size="sm"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="MD"
                                        name="Medium size (default)"
                                        color="blue"
                                        size="md"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="LG"
                                        name="Large size"
                                        color="blue"
                                        size="lg"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="With sublabel">
                                <div className="d-flex flex-column gap-2" style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="AJ"
                                        name="Alice Johnson"
                                        sub-label="user@example.com"
                                        color="slate"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="TC"
                                        name="Toolcase Org"
                                        sub-label="org:toolcase"
                                        color="green"
                                        size="lg"
                                    />
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        initial="R2"
                                        name="Robot Service"
                                        sub-label="svc:r2d2@internal"
                                        color="purple"
                                        size="sm"
                                    />
                                </div>
                            </tc-section-card>

                            <tc-section-card title="Clickable cell">
                                <div className="d-flex flex-column gap-3" style={{ maxWidth: 360 }}>
                                    {/* @ts-ignore */}
                                    <tc-entity-cell
                                        ref={clickableRef}
                                        initial="AJ"
                                        name="Alice Johnson"
                                        sub-label="alice@example.com"
                                        color="blue"
                                        clickable
                                    />
                                    {lastClicked !== null && (
                                        <p
                                            className="mb-0 text-muted"
                                            style={{ fontSize: '0.875rem' }}
                                        >
                                            <code>tc-click</code> fired — name:{' '}
                                            <strong>{lastClicked}</strong>
                                        </p>
                                    )}
                                </div>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EntityCellDemo
