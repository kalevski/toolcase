import { useState } from 'react'
import Serializer from '@toolcase/serializer'
import { captureLogs, SerializerDemoCard, type LogEntry } from './_demo/SerializerDemo'

const code = `const serializer = new Serializer('game-protocol')

serializer.define('JoinRequest', [
  { key: 'playerName', type: Serializer.FieldType.STRING, rule: 'required' },
  { key: 'version', type: Serializer.FieldType.INT32, rule: 'required' },
])

serializer.define('ChatMessage', [
  { key: 'sender', type: Serializer.FieldType.STRING, rule: 'required' },
  { key: 'text', type: Serializer.FieldType.STRING, rule: 'required' },
  { key: 'timestamp', type: Serializer.FieldType.INT64, rule: 'required' },
])

serializer.define('Position', [
  { key: 'x', type: Serializer.FieldType.FLOAT, rule: 'required' },
  { key: 'y', type: Serializer.FieldType.FLOAT, rule: 'required' },
  { key: 'z', type: Serializer.FieldType.FLOAT, rule: 'required' },
])

const buffer = serializer.encode('Position', { x: 1.5, y: 3.7, z: -0.2 })
const decoded = serializer.decode('Position', buffer)`

export const MultipleTypesDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const serializer = new Serializer('game-protocol')
        serializer.define('JoinRequest', [
            { key: 'playerName', type: Serializer.FieldType.STRING, rule: 'required' },
            { key: 'version', type: Serializer.FieldType.INT32, rule: 'required' },
        ])
        serializer.define('ChatMessage', [
            { key: 'sender', type: Serializer.FieldType.STRING, rule: 'required' },
            { key: 'text', type: Serializer.FieldType.STRING, rule: 'required' },
            { key: 'timestamp', type: Serializer.FieldType.INT64, rule: 'required' },
        ])
        serializer.define('Position', [
            { key: 'x', type: Serializer.FieldType.FLOAT, rule: 'required' },
            { key: 'y', type: Serializer.FieldType.FLOAT, rule: 'required' },
            { key: 'z', type: Serializer.FieldType.FLOAT, rule: 'required' },
        ])

        const join = serializer.encode('JoinRequest', { playerName: 'Alice', version: 3 })
        const chat = serializer.encode('ChatMessage', { sender: 'Alice', text: 'Hello!', timestamp: Date.now() })
        const pos = serializer.encode('Position', { x: 1.5, y: 3.7, z: -0.2 })

        console.log('JoinRequest:', join.length, 'bytes →', JSON.stringify(serializer.decode('JoinRequest', join)))
        console.log('ChatMessage:', chat.length, 'bytes →', JSON.stringify(serializer.decode('ChatMessage', chat)))
        console.log('Position:', pos.length, 'bytes →', JSON.stringify(serializer.decode('Position', pos)))

        console.log('')
        console.log('Total binary: ', join.length + chat.length + pos.length, 'bytes')
    }))
    return (
        <SerializerDemoCard
            title="Multiple Message Types"
            description="Define multiple message types on a single serializer — like a protocol schema for networking or storage."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default MultipleTypesDemo
