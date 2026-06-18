import React, { useEffect, useRef, useState } from 'react'
import { RichPageHeader, RichPageHeaderChip, SectionCard } from '@toolcase/react-components'

// Reference lists feeding the conditional `$ref` selectors. `refList` backs the
// `ref` type, `arrayRefList` the array-item type, `objectRefList` the object type.
const refList = [
    { value: 'User', label: 'User' },
    { value: 'Account', label: 'Account' },
    { value: 'Address', label: 'Address' },
]
const arrayRefList = [
    { value: 'string', label: 'string' },
    { value: 'number', label: 'number' },
    { value: 'Tag', label: 'Tag' },
]
const objectRefList = [
    { value: 'Profile', label: 'Profile' },
    { value: 'Settings', label: 'Settings' },
]

// Initial uncontrolled value — a serialized array of property definitions, some
// carrying a default value.
const defaultValue = JSON.stringify([
    { key: 'id', type: 'string' },
    { key: 'age', type: 'integer', default: '18' },
    { key: 'active', type: 'boolean', default: 'true' },
    { key: 'owner', type: 'ref', ref: 'User' },
    { key: 'tags', type: 'array', ref: 'string' },
    { key: 'profile', type: 'object', ref: 'Profile' },
])

// A value containing a duplicate property name (`name` twice) to demonstrate the
// inline duplicate-name validation error.
const duplicateValue = JSON.stringify([
    { key: 'name', type: 'string' },
    { key: 'email', type: 'string', default: 'none@example.com' },
    { key: 'name', type: 'string' },
])

const JSONSchemaDefDemo: React.FC = () => {
    const editorRef = useRef<any>(null)
    const dupRef = useRef<any>(null)
    const disabledRef = useRef<any>(null)
    const [value, setValue] = useState<string>(defaultValue)
    const [schemaName, setSchemaName] = useState<string>('Person')

    useEffect(() => {
        const el = editorRef.current
        if (!el) return
        // Ref lists and defaultValue are JS properties — React can't set them as
        // attributes, so seed them through the ref.
        el.refList = refList
        el.arrayRefList = arrayRefList
        el.objectRefList = objectRefList
        const onChange = (e: Event) => setValue((e as CustomEvent).detail.value)
        const onLabel = (e: Event) => setSchemaName((e as CustomEvent).detail.label)
        el.addEventListener('tc-change', onChange)
        el.addEventListener('tc-label-change', onLabel)
        return () => {
            el.removeEventListener('tc-change', onChange)
            el.removeEventListener('tc-label-change', onLabel)
        }
    }, [])

    useEffect(() => {
        if (dupRef.current) dupRef.current.refList = refList
        if (disabledRef.current) {
            disabledRef.current.refList = refList
            disabledRef.current.arrayRefList = arrayRefList
            disabledRef.current.objectRefList = objectRefList
        }
    }, [])

    return (
        <div className="py-4">
            <div className="container">
                <div className="row">
                    <div className="col-12">
                        <RichPageHeader
                            chips={<RichPageHeaderChip>Web Components</RichPageHeaderChip>}
                            title="JSON Schema Definition"
                            description="Compact visual editor for defining JSON schema properties — editable schema name, per-property type selection, conditional $ref selectors, default-value inputs, reordering, and inline duplicate-name validation. Emits the serialized definition on every change."
                        />

                        <div className="row mt-4 g-4">
                            <div className="col-12 col-lg-7">
                                <SectionCard title={`Editor — “${schemaName}” (default-value + label)`}>
                                    {/* @ts-ignore */}
                                    <tc-json-schema-def
                                        ref={editorRef}
                                        label="Person"
                                        default-value={defaultValue}
                                    />
                                </SectionCard>
                            </div>
                            <div className="col-12 col-lg-5">
                                <SectionCard title="Serialized value">
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
                                        {JSON.stringify(JSON.parse(value), null, 2)}
                                    </pre>
                                </SectionCard>
                            </div>
                        </div>

                        <div className="mt-4">
                            <SectionCard title="Duplicate-name validation (two “name” properties)">
                                {/* @ts-ignore */}
                                <tc-json-schema-def ref={dupRef} default-value={duplicateValue} />
                            </SectionCard>
                        </div>

                        <div className="mt-4">
                            <SectionCard title="Disabled">
                                {/* @ts-ignore */}
                                <tc-json-schema-def
                                    ref={disabledRef}
                                    label="Person"
                                    default-value={defaultValue}
                                    disabled
                                />
                            </SectionCard>
                        </div>

                        <div className="mt-4">
                            <SectionCard title="Loading (skeleton)">
                                {/* @ts-ignore */}
                                <tc-json-schema-def loading />
                            </SectionCard>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default JSONSchemaDefDemo
