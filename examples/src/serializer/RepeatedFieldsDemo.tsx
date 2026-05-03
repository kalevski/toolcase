import { useState } from 'react'
import Serializer from '@toolcase/serializer'
import { captureLogs, SerializerDemoCard, type LogEntry } from './_demo/SerializerDemo'

const code = `serializer.define('Inventory', [
  { key: 'owner', type: Serializer.FieldType.STRING, rule: 'required' },
  { key: 'items', type: Serializer.FieldType.STRING, rule: 'repeated' },
  { key: 'quantities', type: Serializer.FieldType.INT32, rule: 'repeated' },
])

const inventory = {
  owner: 'Alice',
  items: ['sword', 'shield', 'potion', 'map'],
  quantities: [1, 1, 5, 1],
}

const buffer = serializer.encode('Inventory', inventory)
const decoded = serializer.decode('Inventory', buffer)`

export const RepeatedFieldsDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const serializer = new Serializer()
        serializer.define('Inventory', [
            { key: 'owner', type: Serializer.FieldType.STRING, rule: 'required' },
            { key: 'items', type: Serializer.FieldType.STRING, rule: 'repeated' },
            { key: 'quantities', type: Serializer.FieldType.INT32, rule: 'repeated' },
        ])

        const inventory = {
            owner: 'Alice',
            items: ['sword', 'shield', 'potion', 'map'],
            quantities: [1, 1, 5, 1],
        }
        console.log('Original:', JSON.stringify(inventory))

        const buf = serializer.encode('Inventory', inventory)
        console.log('Encoded:', buf.length, 'bytes')

        const dec = serializer.decode('Inventory', buf)
        console.log('Decoded:', JSON.stringify(dec))
    }))
    return (
        <SerializerDemoCard
            title="Repeated Fields (Arrays)"
            description={
                <>
                    Use <code>rule: 'repeated'</code> to encode arrays of values.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default RepeatedFieldsDemo
