import { useState } from 'react'
import Serializer from '@toolcase/serializer'
import { captureLogs, SerializerDemoCard, type LogEntry } from './_demo/SerializerDemo'

const code = `import Serializer from '@toolcase/serializer'

const serializer = new Serializer()

serializer.define('Player', [
  { key: 'name', type: Serializer.FieldType.STRING, rule: 'required' },
  { key: 'score', type: Serializer.FieldType.INT32, rule: 'optional', default: 0 },
  { key: 'alive', type: Serializer.FieldType.BOOL, rule: 'optional', default: true },
])

const buffer = serializer.encode('Player', { name: 'Alice', score: 42 })
const decoded = serializer.decode('Player', buffer)
// { name: 'Alice', score: 42, alive: true }`

export const BasicDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const serializer = new Serializer()
        serializer.define('Player', [
            { key: 'name', type: Serializer.FieldType.STRING, rule: 'required' },
            { key: 'score', type: Serializer.FieldType.INT32, rule: 'optional', default: 0 },
            { key: 'alive', type: Serializer.FieldType.BOOL, rule: 'optional', default: true },
        ])

        const player = { name: 'Alice', score: 42, alive: true }
        console.log('Original:', JSON.stringify(player))

        const buffer = serializer.encode('Player', player)
        console.log('Encoded (bytes):', buffer.length)
        console.log('Buffer:', JSON.stringify(Array.from(buffer)))

        const decoded = serializer.decode('Player', buffer)
        console.log('Decoded:', JSON.stringify(decoded))
        console.log('')
        console.log('JSON size:', new TextEncoder().encode(JSON.stringify(player)).length, 'bytes')
        console.log('Protobuf size:', buffer.length, 'bytes')
    }))
    return (
        <SerializerDemoCard
            title="Basic Encode / Decode"
            description="Define a message schema, encode to binary, and decode back. Typically much smaller than JSON."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default BasicDemo
