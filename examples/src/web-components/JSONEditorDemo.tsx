import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

// Schema drives the generated fields: mixed primitive types, an enum, a nested
// object (collapsible group), a primitive array, and an array of objects.
const schema = JSON.stringify([
    { key: 'name', type: 'string' },
    { key: 'port', type: 'integer', defaultValue: 8080 },
    { key: 'enabled', type: 'boolean', defaultValue: true },
    { key: 'logLevel', type: 'string', enum: ['debug', 'info', 'warn', 'error'] },
    {
        key: 'database',
        type: 'object',
        properties: [
            { key: 'host', type: 'string' },
            { key: 'port', type: 'integer' },
            { key: 'ssl', type: 'boolean' },
        ],
    },
    { key: 'tags', type: 'array', itemType: 'string' },
    {
        key: 'routes',
        type: 'array',
        properties: [
            { key: 'path', type: 'string' },
            { key: 'method', type: 'string', enum: ['GET', 'POST', 'PUT', 'DELETE'] },
        ],
    },
])

const initialValue = {
    name: 'api-gateway',
    port: 8080,
    enabled: true,
    logLevel: 'info',
    database: { host: 'localhost', port: 5432, ssl: false },
    tags: ['edge', 'public'],
    routes: [{ path: '/health', method: 'GET' }],
}

const JSONEditorDemo: React.FC = () => {
    const editorRef = useRef<any>(null)
    const disabledRef = useRef<any>(null)
    const [value, setValue] = useState<unknown>(initialValue)

    useEffect(() => {
        const el = editorRef.current
        if (!el) return
        // defaultValue is a JS property (uncontrolled initial value) — React can't
        // set it as an attribute, so seed it through the ref.
        el.defaultValue = initialValue
        const handler = (e: Event) => setValue((e as CustomEvent).detail.value)
        el.addEventListener('tc-change', handler)
        return () => el.removeEventListener('tc-change', handler)
    }, [])

    useEffect(() => {
        if (disabledRef.current) disabledRef.current.value = initialValue
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="JSON Editor"
                            description="Schema-driven form editor for JSON objects — typed fields, enum selects, collapsible nested groups, and repeatable arrays. Every edit emits the full updated value object."
                        />

                        <div className="row mt-4 g-4">
                            <div className="col-12 col-lg-6">
                                <SectionCard title="Editor (defaultValue + tc-change)">
                                    {/* @ts-ignore */}
                                    <tc-json-editor ref={editorRef} schema={schema} />
                                </SectionCard>
                            </div>
                            <div className="col-12 col-lg-6">
                                <SectionCard title="Live value">
                                    <pre
                                        style={{
                                            margin: 0,
                                            fontSize: 12.5,
                                            maxHeight: 420,
                                            overflow: 'auto',
                                            background: 'var(--tc-ink, #0f172a)',
                                            color: '#e2e8f0',
                                            padding: '0.75rem',
                                        }}
                                    >
                                        {JSON.stringify(value, null, 2)}
                                    </pre>
                                </SectionCard>
                            </div>
                        </div>

                        <div className="mt-4">
                            <SectionCard title="Disabled">
                                {/* @ts-ignore */}
                                <tc-json-editor ref={disabledRef} schema={schema} disabled />
                            </SectionCard>
                        </div>

                        <div className="mt-4">
                            <SectionCard title="Loading (skeleton)">
                                {/* @ts-ignore */}
                                <tc-json-editor schema={schema} loading />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default JSONEditorDemo
