import { useState } from 'react'
import Serializer from '@toolcase/serializer'
import { captureLogs, SerializerDemoCard, type LogEntry } from './_demo/SerializerDemo'

const code = `const serializer = new Serializer()

// Shared enum registered by name
serializer.enum('Status', ['pending', 'active', 'banned'])

serializer.define('Account', [
    { key: 'name',   type: Serializer.FieldType.STRING, rule: 'required' },
    // Reference the shared enum by name
    { key: 'status', type: 'Status', rule: 'optional' },
    // Inline enum (no shared registration needed)
    { key: 'role',   type: Serializer.FieldType.ENUM(['guest', 'member', 'admin']), rule: 'optional' },
    // Map: string key → int32 value
    { key: 'scores', type: Serializer.FieldType.MAP('string', 'int32'), rule: 'optional' },
    // Packed array: tightly-encoded repeated int32
    { key: 'levels', type: Serializer.FieldType.PACKED_ARRAY('int32'), rule: 'repeated' },
])

const buf = serializer.encode('Account', {
    name: 'Alice',
    status: 'active',
    role: 'admin',
    scores: { math: 95, science: 88 },
    levels: [1, 2, 3, 5, 8],
})

const decoded = serializer.decode('Account', buf)
// decoded.status  → 'active'
// decoded.role    → 'admin'
// decoded.scores  → { math: 95, science: 88 }
// decoded.levels  → [1, 2, 3, 5, 8]`

export const AdvancedFieldsDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const serializer = new Serializer()

        serializer.enum('Status', ['pending', 'active', 'banned'])

        serializer.define('Account', [
            { key: 'name',   type: Serializer.FieldType.STRING, rule: 'required' },
            { key: 'status', type: 'Status', rule: 'optional' },
            { key: 'role',   type: Serializer.FieldType.ENUM(['guest', 'member', 'admin']), rule: 'optional' },
            { key: 'scores', type: Serializer.FieldType.MAP('string', 'int32'), rule: 'optional' },
            { key: 'levels', type: Serializer.FieldType.PACKED_ARRAY('int32'), rule: 'repeated' },
        ])

        const original = {
            name: 'Alice',
            status: 'active',
            role: 'admin',
            scores: { math: 95, science: 88 },
            levels: [1, 2, 3, 5, 8],
        }
        console.log('Original:', JSON.stringify(original))

        const buf = serializer.encode('Account', original)
        console.log('Encoded size:', buf.length, 'bytes')

        const decoded = serializer.decode('Account', buf)
        console.log('Decoded:', JSON.stringify(decoded))
        console.log('')
        console.log('status round-trip ok:', decoded.status === 'active')
        console.log('role round-trip ok:  ', decoded.role === 'admin')
        console.log('scores round-trip ok:', decoded.scores.math === 95 && decoded.scores.science === 88)
        console.log('levels round-trip ok:', JSON.stringify(decoded.levels) === JSON.stringify([1, 2, 3, 5, 8]))
    }))
    return (
        <SerializerDemoCard
            title="Advanced Field Types: Enum, Map, Packed Array"
            description={
                <>
                    Demonstrates <code>s.enum()</code> shared enum registration,{' '}
                    <code>FieldType.ENUM()</code> inline enum,{' '}
                    <code>FieldType.MAP(keyType, valueType)</code> map fields, and{' '}
                    <code>FieldType.PACKED_ARRAY(type)</code> efficiently packed repeated numerics.
                    All four survive a full encode → decode round-trip.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default AdvancedFieldsDemo
