import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

const FAQ_ITEMS = [
    {
        question: 'What is @toolcase/web-components?',
        answer: 'A library of framework-free custom elements (tc-*) for building accessible UI without React, Vue, or Angular.',
    },
    {
        question: 'Do I need a build tool to use it?',
        answer: 'No. Import the ESM bundle from a CDN and drop tc-* tags into any HTML page.',
    },
    {
        question: 'Can I use it alongside React?',
        answer: 'Yes — author tc-* tags in JSX, set JS properties via refs, and listen for tc-* events.',
    },
    {
        question: 'How do I theme the components?',
        answer: 'Override --tc-* and --bs-<component>-* CSS custom properties on the host or a parent element.',
    },
]

const FAQListDemo: React.FC = () => {
    const basicRef = useRef<any>(null)
    const schemaRef = useRef<any>(null)
    const evtRef = useRef<any>(null)
    const slotRef = useRef<any>(null)
    const [lastToggle, setLastToggle] = useState<string>('')

    useEffect(() => {
        if (basicRef.current) basicRef.current.items = FAQ_ITEMS
    }, [])

    useEffect(() => {
        if (schemaRef.current) schemaRef.current.items = FAQ_ITEMS
    }, [])

    useEffect(() => {
        const el = evtRef.current
        if (!el) return
        el.items = FAQ_ITEMS
        el.defaultOpen = [0, 2]
        const handler = (e: CustomEvent) => {
            setLastToggle(`Item ${e.detail.index} ${e.detail.open ? 'opened' : 'closed'}`)
        }
        el.addEventListener('tc-toggle', handler)
        return () => el.removeEventListener('tc-toggle', handler)
    }, [])

    useEffect(() => {
        if (slotRef.current) slotRef.current.items = FAQ_ITEMS
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="FAQList"
                            description="Collapsible FAQ accordion with optional JSON-LD schema generation for SEO. Items are set via the JS items property."
                        />

                        <div className="d-flex flex-column gap-4 mt-4">
                            <SectionCard title="Basic FAQ list (title attribute)">
                                {/* @ts-ignore */}
                                <tc-faq-list ref={basicRef} title="Frequently Asked Questions" />
                            </SectionCard>

                            <SectionCard title="With JSON-LD schema (schema attribute)">
                                {/* @ts-ignore */}
                                <tc-faq-list ref={schemaRef} title="FAQ with Schema.org markup" schema />
                            </SectionCard>

                            <SectionCard title="Default-open items + tc-toggle event">
                                <p className="mb-3" style={{ fontSize: '0.8125rem', color: 'var(--tc-text-muted)' }}>
                                    Items 0 and 2 are open by default. Last event: <strong>{lastToggle || '—'}</strong>
                                </p>
                                {/* @ts-ignore */}
                                <tc-faq-list ref={evtRef} title="FAQ with default-open items" />
                            </SectionCard>

                            <SectionCard title="Slotted title">
                                {/* @ts-ignore */}
                                <tc-faq-list ref={slotRef}>
                                    <span>Custom <strong>slotted</strong> title</span>
                                {/* @ts-ignore */}
                                </tc-faq-list>
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default FAQListDemo
