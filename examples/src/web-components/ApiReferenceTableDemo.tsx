import React, { useEffect, useRef } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const groupedData = [
    {
        category: 'Lifecycle',
        items: [
            {
                name: 'connectedCallback',
                signature: '(): void',
                returns: 'void',
                description: 'Called when the element is connected to the document. Initialises the component on first call.',
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
                deprecated: 'Use the JS property setters instead of observed attributes for data binding.',
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
                description: 'Array of API groups. Each group has a category label and an items array. Setting re-renders.',
            },
            {
                name: 'items',
                signature: 'ApiItem[]',
                returns: 'ApiItem[]',
                description: 'Flat list of API items rendered as a single ungrouped section when groups is empty.',
            },
            {
                name: 'title',
                signature: 'string | null',
                returns: 'string | null',
                description: 'Optional title displayed as a header above the table. Can also be supplied as slotted children.',
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
        deprecated: 'Custom elements cannot be unregistered after definition. This method is a no-op.',
    },
]

const ApiReferenceTableDemo: React.FC = () => {
    const groupedRef = useRef<any>(null)
    const flatRef = useRef<any>(null)
    const titledRef = useRef<any>(null)
    const slottedRef = useRef<any>(null)

    useEffect(() => {
        if (groupedRef.current) groupedRef.current.groups = groupedData
        if (flatRef.current) flatRef.current.items = flatItems
        if (titledRef.current) titledRef.current.groups = groupedData
        if (slottedRef.current) slottedRef.current.items = flatItems
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="ApiReferenceTable"
                            description="Documentation-style API reference table. Renders API items grouped by category with name, signature, returns, and description columns. Deprecated items render a warning badge."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Grouped (groups property)">
                                {/* @ts-ignore */}
                                <tc-api-reference-table ref={groupedRef} />
                            </SectionCard>

                            <SectionCard title="Flat items (items property, no groups)">
                                {/* @ts-ignore */}
                                <tc-api-reference-table ref={flatRef} />
                            </SectionCard>

                            <SectionCard title="With title attribute">
                                {/* @ts-ignore */}
                                <tc-api-reference-table
                                    ref={titledRef}
                                    title="@toolcase/web-components — Public API"
                                />
                            </SectionCard>

                            <SectionCard title="With slotted title (React node)">
                                {/* @ts-ignore */}
                                <tc-api-reference-table ref={slottedRef}>
                                    <span style={{ fontFamily: 'var(--tc-font-mono)', fontSize: '0.9375rem', fontWeight: 600 }}>
                                        tc-api-reference-table <span style={{ color: 'var(--tc-text-muted)', fontWeight: 400 }}>— slotted title</span>
                                    </span>
                                </tc-api-reference-table>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default ApiReferenceTableDemo
