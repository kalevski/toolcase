import { useState } from 'react'
import Serializer from '@toolcase/serializer'
import { captureLogs, SerializerDemoCard, type LogEntry } from './_demo/SerializerDemo'

const v1Fields = [
    { key: 'name',  type: Serializer.FieldType.STRING, rule: 'required' as const },
    { key: 'score', type: Serializer.FieldType.INT32,  rule: 'optional' as const, default: 0 },
]

const v2Fields = [
    { key: 'name',  type: Serializer.FieldType.STRING, rule: 'required' as const },
    { key: 'score', type: Serializer.FieldType.INT32,  rule: 'optional' as const, default: 0 },
    { key: 'level', type: Serializer.FieldType.INT32,  rule: 'optional' as const, default: 1 },
]

const code = `import Serializer from '@toolcase/serializer'

// --- Produce a legacy v1 buffer (simulates data from an older client) ---
const legacy = new Serializer('save-v1')
legacy.define('SaveGame', [
    { key: 'name',  type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'score', type: Serializer.FieldType.INT32,  rule: 'optional', default: 0 },
])
legacy.version(1, 0)
const v1Buf = legacy.encodeVersioned('SaveGame', { name: 'Hero', score: 500 })

// --- Current serializer: v2 schema + migration from v1 ---
const s = new Serializer('save-v2')
s.define('SaveGame', [
    { key: 'name',  type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'score', type: Serializer.FieldType.INT32,  rule: 'optional', default: 0 },
    { key: 'level', type: Serializer.FieldType.INT32,  rule: 'optional', default: 1 },
])
// Register the old v1 shape so decodeVersioned can parse it
s.defineVersion('SaveGame', 1, [
    { key: 'name',  type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'score', type: Serializer.FieldType.INT32,  rule: 'optional', default: 0 },
])
// Migration: v1 → v2 fills in the new 'level' field
s.migrate('SaveGame', 1, (msg) => ({ ...msg, level: 1 }))
s.version(2, 0)

// Decode the old buffer — migration runs automatically
const { version, message } = s.decodeVersioned('SaveGame', v1Buf)
// version  → { major: 1, minor: 0 }
// message  → { name: 'Hero', score: 500, level: 1 }

// Encode a fresh v2 message and decode it (no migration needed)
const v2Buf = s.encodeVersioned('SaveGame', { name: 'Hero', score: 750, level: 3 })
const { version: v2, message: m2 } = s.decodeVersioned('SaveGame', v2Buf)
// v2  → { major: 2, minor: 0 }
// m2  → { name: 'Hero', score: 750, level: 3 }`

export const VersioningDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        // Produce a legacy v1 buffer (simulates data from an older client)
        const legacy = new Serializer('save-v1')
        legacy.define('SaveGame', v1Fields)
        legacy.version(1, 0)
        const v1Buf = legacy.encodeVersioned('SaveGame', { name: 'Hero', score: 500 })
        console.log('v1 buffer size:', v1Buf.length, 'bytes')
        console.log('v1 buffer header (magic, major, minor):', v1Buf[0].toString(16), v1Buf[1], v1Buf[2])

        // Current serializer: v2 schema + migration from v1
        const s = new Serializer('save-v2')
        s.define('SaveGame', v2Fields)
        s.defineVersion('SaveGame', 1, v1Fields)
        s.migrate('SaveGame', 1, (msg: Record<string, unknown>) => ({ ...msg, level: 1 }))
        s.version(2, 0)

        console.log('')
        console.log('--- decoding v1 buffer (migration path) ---')
        const { version, message } = s.decodeVersioned('SaveGame', v1Buf)
        console.log('decoded version:', JSON.stringify(version))
        console.log('decoded message:', JSON.stringify(message))
        console.log('migration added level:', message.level === 1)

        console.log('')
        console.log('--- encoding + decoding v2 message (no migration) ---')
        const v2Buf = s.encodeVersioned('SaveGame', { name: 'Hero', score: 750, level: 3 })
        console.log('v2 buffer size:', v2Buf.length, 'bytes')
        const { version: v2, message: m2 } = s.decodeVersioned('SaveGame', v2Buf)
        console.log('decoded version:', JSON.stringify(v2))
        console.log('decoded message:', JSON.stringify(m2))
        console.log('level preserved:', m2.level === 3)
    }))
    return (
        <SerializerDemoCard
            title="Versioning & Migration"
            description={
                <>
                    Uses <code>version()</code> / <code>getVersion()</code>, <code>defineVersion()</code>, and{' '}
                    <code>migrate()</code> to show how a v1 buffer — produced by a legacy client — is transparently
                    decoded and upgraded to the v2 schema via <code>decodeVersioned()</code>.
                    The 3-byte versioned frame header (<code>0xB5</code> magic + major + minor) is printed
                    so you can see the wire format directly.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default VersioningDemo
