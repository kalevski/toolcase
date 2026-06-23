import { useState } from 'react'
import Serializer from '@toolcase/serializer'
import { captureLogs, SerializerDemoCard, type LogEntry } from './_demo/SerializerDemo'

const code = `// validate — returns error string or null (no encode step)
serializer.validate('Event', { id: 'e1', score: 10 })  // → null (valid)
serializer.validate('Event', { id: 42,   score: 10 })  // → 'id: string expected'

// safeEncode / safeDecode — return SafeResult instead of throwing
const enc = serializer.safeEncode('Event', { id: 'e1', score: 10 })
// { ok: true, value: Uint8Array }

const dec = serializer.safeDecode('Event', enc.value!)
// { ok: true, value: Message }

const fail = serializer.safeDecode('Event', new Uint8Array([0xff, 0xff, 0xff]))
// { ok: false, error: Error }

// types() / fields(key) — introspect the registered schema
serializer.types()          // → ['Event']
serializer.fields('Event')  // → [{ key: 'id', type: 'string', ... }, ...]`

export const ValidationDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const serializer = new Serializer()
        serializer.define('Event', [
            { key: 'id',    type: Serializer.FieldType.STRING, rule: 'required' },
            { key: 'score', type: Serializer.FieldType.INT32,  rule: 'optional', default: 0 },
        ])

        console.log('--- validate ---')
        const valid = serializer.validate('Event', { id: 'e1', score: 10 })
        console.log('valid message →', valid === null ? 'null (ok)' : valid)

        const invalid = serializer.validate('Event', { id: 42 as any, score: 10 })
        console.log('invalid message →', invalid)

        console.log('')
        console.log('--- safeEncode / safeDecode ---')

        const enc = serializer.safeEncode('Event', { id: 'e1', score: 10 })
        console.log('safeEncode ok:', enc.ok, '— bytes:', enc.value?.length)

        const dec = serializer.safeDecode('Event', enc.value!)
        console.log('safeDecode ok:', dec.ok, '— value:', JSON.stringify(dec.value))

        const fail = serializer.safeDecode('Event', new Uint8Array([0xff, 0xff, 0xff]))
        console.log('safeDecode fail:', fail.ok, '— error:', fail.error?.message)

        console.log('')
        console.log('--- introspection ---')
        console.log('types():', JSON.stringify(serializer.types()))
        const fieldDescs = serializer.fields('Event').map(f => ({ key: f.key, type: f.type }))
        console.log("fields('Event'):", JSON.stringify(fieldDescs))
    }))
    return (
        <SerializerDemoCard
            title="Validation, Safe Encode/Decode & Introspection"
            description={
                <>
                    <code>validate</code> checks a message against the schema without encoding it.{' '}
                    <code>safeEncode</code>/<code>safeDecode</code> return a{' '}
                    <code>{'{ ok, value?, error? }'}</code> result instead of throwing.{' '}
                    <code>types()</code>/<code>fields(key)</code> expose the registered schema at runtime.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default ValidationDemo
