import { useState } from 'react'
import Serializer from '@toolcase/serializer'
import { captureLogs, SerializerDemoCard, type LogEntry } from './_demo/SerializerDemo'

const code = `try {
  serializer.encode('UnknownType', data)
} catch (e) {
  // Error: type key=UnknownType is not defined
}

try {
  serializer.decode('User', badBuffer)
} catch (e) {
  // Error: decode error: ...
}`

export const ErrorHandlingDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const serializer = new Serializer()
        serializer.define('User', [
            { key: 'name', type: Serializer.FieldType.STRING, rule: 'required' },
        ])

        try {
            serializer.encode('UnknownType', { name: 'test' })
        } catch (e: any) {
            console.log('✗ Unknown type:', e.message)
        }

        try {
            serializer.decode('User', new Uint8Array([255, 255, 255]))
        } catch (e: any) {
            console.log('✗ Bad buffer:', e.message)
        }

        try {
            const buf = serializer.encode('User', { name: 'Alice' })
            const dec = serializer.decode('User', buf)
            console.log('✓ Success:', JSON.stringify(dec))
        } catch (e: any) {
            console.log('✗ Error:', e.message)
        }
    }))
    return (
        <SerializerDemoCard
            title="Error Handling"
            description="The serializer throws descriptive errors for undefined types, validation failures, and malformed buffers."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default ErrorHandlingDemo
