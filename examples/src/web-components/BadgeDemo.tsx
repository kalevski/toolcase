import React from 'react'

const BadgeDemo: React.FC = () => (
    <div className="py-4">
        <div className="container">
            <div className="row">
                <div className="col-12">
                    <tc-rich-page-header
                        title-text="Badge"
                        description="Small count and labelling components. Supports all Bootstrap theme variants and an optional pill shape."
                    >
                        <tc-badge slot="chips" variant="secondary">
                            Web Components
                        </tc-badge>
                    </tc-rich-page-header>

                    <div className="d-flex flex-column gap-4 mt-4">
                        <tc-section-card title="Variants (text attribute)">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-badge variant="primary" text="Primary"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="secondary" text="Secondary"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="success" text="Success"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="danger" text="Danger"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="warning" text="Warning"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="info" text="Info"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="light" text="Light"></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="dark" text="Dark"></tc-badge>
                            </div>
                        </tc-section-card>

                        <tc-section-card title="Pill shape">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-badge variant="primary" text="Primary" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="secondary" text="Secondary" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="success" text="Success" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="danger" text="Danger" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="warning" text="Warning" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="info" text="Info" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="light" text="Light" pill></tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="dark" text="Dark" pill></tc-badge>
                            </div>
                        </tc-section-card>

                        <tc-section-card title='The phone chip scale (size="xs", tone="neutral")'>
                            <p className="text-muted small mb-3">
                                <code>size=&quot;xs&quot;</code> is <code>3px 9px</code> at{' '}
                                <code>700 10px</code> — the design's season badge and card meta
                                chip. It lowers <code>--tc-font-size-min</code> on its own subtree
                                rather than out-specifying the legibility floor, which is what that
                                token is for. <code>tone=&quot;neutral&quot;</code> drops the
                                variant fill for a white pill with a hairline border and muted ink.
                            </p>
                            <div className="d-flex flex-wrap align-items-center gap-2">
                                {/* @ts-ignore */}
                                <tc-badge size="xs" pill tone="neutral" text="30 мин" />
                                {/* @ts-ignore */}
                                <tc-badge size="xs" pill tone="neutral" text="4 порции" />
                                {/* @ts-ignore */}
                                <tc-badge size="xs" pill variant="success" text="Одобрено" />
                                {/* @ts-ignore */}
                                <tc-badge size="xs" pill variant="danger" text="Ново" />
                            </div>
                            <p className="text-muted small mt-3 mb-0">
                                CONTRAST, MEASURED (white label on a solid fill): a badge's ink is{' '}
                                <code>--bs-badge-color</code>, and white does not clear AA on every
                                hue an app may hand it. Against the JADI season palette — Есен
                                #c24914 4.93:1 ✓, Зима #3e5f8a 6.54:1 ✓, Целогодишно #6e4a7e 7.13:1
                                ✓, Пролет #4e8a3c 4.18:1 ✗, Лето #dd9a10 <strong>2.41:1 ✗</strong>.
                                Dark ink (#2e2400) on Лето is 6.36:1. The neutral tone's #7d766c on
                                white is 4.49:1 — one hundredth short of 4.5.
                            </p>
                        </tc-section-card>

                        <tc-section-card title="Slotted children">
                            <div className="d-flex flex-wrap gap-2">
                                {/* @ts-ignore */}
                                <tc-badge variant="primary">42</tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="success" pill>
                                    New
                                </tc-badge>
                                {/* @ts-ignore */}
                                <tc-badge variant="danger">99+</tc-badge>
                            </div>
                        </tc-section-card>
                    </div>
                </div>
            </div>
        </div>
    </div>
)

export default BadgeDemo
