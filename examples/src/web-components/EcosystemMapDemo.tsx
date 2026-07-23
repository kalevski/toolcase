import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const EcosystemMapDemo: React.FC = () => {
    const twoRingsRef = useTc<HTMLElement>(
        {
            core: { name: '@your/core', label: 'core' },
            rings: [
                {
                    label: 'Official',
                    items: [
                        { name: '@your/auth' },
                        { name: '@your/cache' },
                        { name: '@your/queue' },
                        { name: '@your/router' },
                    ],
                },
                {
                    label: 'Community',
                    items: [
                        { name: 'lib-x' },
                        { name: 'lib-y' },
                        { name: 'lib-z' },
                        { name: 'lib-foo' },
                        { name: 'lib-bar' },
                        { name: 'lib-baz' },
                    ],
                },
            ],
        },
        {
            'tc-select': (e: CustomEvent) => {
                console.log('[tc-ecosystem-map] tc-select', e.detail)
            },
        },
    )

    const threeRingsRef = useTc<HTMLElement>({
        core: { name: 'toolcase', label: 'runtime' },
        rings: [
            {
                label: 'Base',
                items: [
                    { name: '@toolcase/base' },
                    { name: '@toolcase/logging' },
                    { name: '@toolcase/serializer' },
                ],
            },
            {
                label: 'UI',
                items: [{ name: '@toolcase/web-components' }],
            },
            {
                label: 'Integration',
                items: [{ name: '@toolcase/phaser-plus' }, { name: '@toolcase/node' }],
            },
        ],
    })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="EcosystemMap"
                            description="Concentric ring diagram showing ecosystem relationships. Set core and rings via JS properties. Always renders an inline SVG diagram and a semantic list fallback."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>
                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Two rings — official + community packages">
                                {/* @ts-ignore */}
                                <tc-ecosystem-map ref={twoRingsRef} title="Package ecosystem" />
                            </tc-section-card>

                            <tc-section-card title="Three rings — custom size 560px">
                                {/* @ts-ignore */}
                                <tc-ecosystem-map ref={threeRingsRef} size="560" />
                            </tc-section-card>

                            <tc-section-card title="Empty state — no rings set">
                                {/* @ts-ignore */}
                                <tc-ecosystem-map title="No packages yet" />
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EcosystemMapDemo
