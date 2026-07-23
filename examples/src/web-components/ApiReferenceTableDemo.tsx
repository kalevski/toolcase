import React from 'react'
import { useTc } from '@toolcase/web-components/react'

const groupedData = [
    {
        category: 'Lifecycle',
        items: [
            {
                name: 'connectedCallback',
                signature: '(): void',
                returns: 'void',
                description:
                    'Called when the element is connected to the document. Initialises the component on first call.',
            },
            {
                name: 'disconnectedCallback',
                signature: '(): void',
                returns: 'void',
                description: 'Called when the element is removed from the document.',
            },
            {
                name: 'attributeChangedCallback',
                signature: '(name: string, oldVal: string | null, newVal: string | null): void',
                returns: 'void',
                description: 'Called when an observed attribute changes value.',
                deprecated:
                    'Use the JS property setters instead of observed attributes for data binding.',
            },
        ],
    },
    {
        category: 'Properties',
        items: [
            {
                name: 'groups',
                signature: 'ApiReferenceGroup[]',
                returns: 'ApiReferenceGroup[]',
                description:
                    'Array of API groups. Each group has a category label and an items array. Setting re-renders.',
            },
            {
                name: 'items',
                signature: 'ApiItem[]',
                returns: 'ApiItem[]',
                description:
                    'Flat list of API items rendered as a single ungrouped section when groups is empty.',
            },
            {
                name: 'title',
                signature: 'string | null',
                returns: 'string | null',
                description:
                    'Optional title displayed as a header above the table. Can also be supplied as slotted children.',
                deprecated: true,
            },
        ],
    },
]

const flatItems = [
    {
        name: 'register',
        signature: '(): void',
        returns: 'void',
        description: 'Registers all tc-* custom elements via customElements.define.',
    },
    {
        name: 'icon',
        signature: '(svg: string, className?: string): string',
        returns: 'string',
        description: 'Strips fixed width/height from a Lucide SVG string and marks it aria-hidden.',
    },
    {
        name: 'deregister',
        signature: '(): void',
        returns: 'void',
        description: 'Removes all registered tc-* custom elements.',
        deprecated:
            'Custom elements cannot be unregistered after definition. This method is a no-op.',
    },
]

const ApiReferenceTableDemo: React.FC = () => {
    const groupedRef = useTc<HTMLElement>({ groups: groupedData })
    const flatRef = useTc<HTMLElement>({ items: flatItems })
    const titledRef = useTc<HTMLElement>({ groups: groupedData })
    const slottedRef = useTc<HTMLElement>({ items: flatItems })

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <tc-rich-page-header
                            title-text="ApiReferenceTable"
                            description="Documentation-style API reference table. Renders API items grouped by category with name, signature, returns, and description columns. Deprecated items render a warning badge."
                        >
                            <tc-badge slot="chips" variant="secondary">
                                Web Components
                            </tc-badge>
                        </tc-rich-page-header>

                        <div className="d-flex flex-column gap-4 mt-4">
                            <tc-section-card title="Grouped (groups property)">
                                {/* @ts-ignore */}
                                <tc-api-reference-table ref={groupedRef} />
                            </tc-section-card>

                            <tc-section-card title="Flat items (items property, no groups)">
                                {/* @ts-ignore */}
                                <tc-api-reference-table ref={flatRef} />
                            </tc-section-card>

                            <tc-section-card title="With title attribute">
                                {/* @ts-ignore */}
                                <tc-api-reference-table
                                    ref={titledRef}
                                    title="@toolcase/web-components — Public API"
                                />
                            </tc-section-card>

                            <tc-section-card title="With slotted title (React node)">
                                {/* @ts-ignore */}
                                <tc-api-reference-table ref={slottedRef}>
                                    <span
                                        style={{
                                            fontFamily: 'var(--tc-font-mono)',
                                            fontSize: '0.9375rem',
                                            fontWeight: 600,
                                        }}
                                    >
                                        tc-api-reference-table{' '}
                                        <span
                                            style={{
                                                color: 'var(--tc-text-muted)',
                                                fontWeight: 400,
                                            }}
                                        >
                                            — slotted title
                                        </span>
                                    </span>
                                </tc-api-reference-table>
                            </tc-section-card>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ApiReferenceTableDemo
