import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const EcosystemMapDemo: React.FC = () => {
    const twoRingsRef = useRef<any>(null)
    const threeRingsRef = useRef<any>(null)

    useEffect(() => {
        if (twoRingsRef.current) {
            twoRingsRef.current.core = { name: '@your/core', label: 'core' }
            twoRingsRef.current.rings = [
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
            ]
            twoRingsRef.current.addEventListener('tc-select', (e: CustomEvent) => {
                console.log('[tc-ecosystem-map] tc-select', e.detail)
            })
        }
    }, [])

    useEffect(() => {
        if (threeRingsRef.current) {
            threeRingsRef.current.core = { name: 'toolcase', label: 'runtime' }
            threeRingsRef.current.rings = [
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
                    items: [
                        { name: '@toolcase/react-components' },
                        { name: '@toolcase/game-components' },
                        { name: '@toolcase/web-components' },
                    ],
                },
                {
                    label: 'Integration',
                    items: [
                        { name: '@toolcase/phaser-plus' },
                        { name: '@toolcase/node' },
                    ],
                },
            ]
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="EcosystemMap"
                            description="Concentric ring diagram showing ecosystem relationships. Set core and rings via JS properties. Always renders an inline SVG diagram and a semantic list fallback."
                        />
                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Two rings — official + community packages">
                                {/* @ts-ignore */}
                                <tc-ecosystem-map ref={twoRingsRef} title="Package ecosystem" />
                            </SectionCard>

                            <SectionCard title="Three rings — custom size 560px">
                                {/* @ts-ignore */}
                                <tc-ecosystem-map ref={threeRingsRef} size="560" />
                            </SectionCard>

                            <SectionCard title="Empty state — no rings set">
                                {/* @ts-ignore */}
                                <tc-ecosystem-map title="No packages yet" />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default EcosystemMapDemo
