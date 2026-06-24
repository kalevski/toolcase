import { useState } from 'react'
import Serializer from '@toolcase/serializer'
import { captureLogs, SerializerDemoCard, type LogEntry } from './_demo/SerializerDemo'

const fields = [
    { key: 'id',      type: Serializer.FieldType.STRING, rule: 'required' as const },
    { key: 'payload', type: Serializer.FieldType.STRING, rule: 'required' as const },
]

const code = `import Serializer from '@toolcase/serializer'

const s = new Serializer('streaming-demo')
s.define('Packet', [
    { key: 'id',      type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'payload', type: Serializer.FieldType.STRING, rule: 'required' },
])

// Encode a message
const buf = s.encode('Packet', {
    id: 'msg-001',
    payload: 'A'.repeat(200),
})

// Fragment into small chunks — use a tiny maxChunkSize to force multiple chunks
const chunks = s.fragment(buf, 32)
console.log('original size:', buf.length, 'bytes')
console.log('chunk count:', chunks.length)

// Each chunk carries a 9-byte header: 0xF5 | 4-byte frame ID | 2-byte index | 2-byte total
for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i]
    const magic = chunk[0].toString(16)
    const index = (chunk[5] << 8) | chunk[6]
    const total = (chunk[7] << 8) | chunk[8]
    console.log(\`  chunk[\${i}] magic=0x\${magic} index=\${index} total=\${total} size=\${chunk.length}\`)
}

// Reassemble (order-independent)
const reassembled = s.reassemble(chunks)
const message = s.decode('Packet', reassembled)
console.log('round-trip ok:', message.id === 'msg-001' && message.payload === 'A'.repeat(200))`

export const StreamingDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const s = new Serializer('streaming-demo')
        s.define('Packet', fields)

        const original = { id: 'msg-001', payload: 'A'.repeat(200) }
        const buf = s.encode('Packet', original)

        // Small maxChunkSize forces several fragments so the demo is illustrative
        const maxChunkSize = 32
        const chunks = s.fragment(buf, maxChunkSize)

        console.log('original size:', buf.length, 'bytes')
        console.log('chunk count:', chunks.length)
        console.log('max chunk size:', maxChunkSize, 'bytes')
        console.log('')

        for (let i = 0; i < chunks.length; i++) {
            const chunk = chunks[i]
            const magic = chunk[0].toString(16).toUpperCase()
            const index = (chunk[5] << 8) | chunk[6]
            const total = (chunk[7] << 8) | chunk[8]
            console.log(`chunk[${i}] magic=0x${magic} index=${index} total=${total} size=${chunk.length}`)
        }

        console.log('')
        console.log('--- reassembling (shuffled order) ---')
        // Shuffle to prove order-independence
        const shuffled = [...chunks].reverse()
        const reassembled = s.reassemble(shuffled)
        const message = s.decode('Packet', reassembled)

        console.log('reassembled size:', reassembled.length, 'bytes')
        console.log('id ok:', message.id === original.id)
        console.log('payload ok:', message.payload === original.payload)
        console.log('round-trip ok:', message.id === original.id && message.payload === original.payload)
    }))
    return (
        <SerializerDemoCard
            title="Streaming (Fragment / Reassemble)"
            description={
                <>
                    Encodes a message, calls <code>fragment()</code> with a small <code>maxChunkSize</code> to
                    split the buffer into multiple chunks, then inspects the 9-byte header on each chunk
                    (magic <code>0xF5</code>, frame ID, 2-byte index, 2-byte total). The chunks are passed
                    to <code>reassemble()</code> in reverse order to prove order-independence, and the
                    result is decoded to confirm the complete round-trip.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default StreamingDemo
