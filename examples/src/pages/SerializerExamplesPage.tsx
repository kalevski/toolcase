import { useState } from 'react'
import Serializer from '@toolcase/serializer'

type LogEntry = { time: string; text: string }

const ts = () => new Date().toLocaleTimeString()

const CodeBlock = ({ code }: { code: string }) => (
    <pre className="code-block">{code.trim()}</pre>
)

const ConsoleOutput = ({ logs }: { logs: LogEntry[] }) => (
    logs.length > 0 ? (
        <pre className="console-output">
            {logs.map((l, i) => <div key={i}><span className="console-time">{l.time}</span> {l.text}</div>)}
        </pre>
    ) : null
)

// ─── Basic encode/decode ───────────────────────────
const BasicExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        const entries: LogEntry[] = []
        const origLog = console.log
        console.log = (...args: unknown[]) => {
            entries.push({ time: ts(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' ') })
        }
        try {
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
        } finally { console.log = origLog }
        setLogs(entries)
    }

    return (
        <div className="example-section">
            <h3>Basic Encode / Decode</h3>
            <p>Define a message schema, encode to binary, and decode back. Typically much smaller than JSON.</p>
            <CodeBlock code={`import Serializer from '@toolcase/serializer'

const serializer = new Serializer()

serializer.define('Player', [
  { key: 'name', type: Serializer.FieldType.STRING, rule: 'required' },
  { key: 'score', type: Serializer.FieldType.INT32, rule: 'optional', default: 0 },
  { key: 'alive', type: Serializer.FieldType.BOOL, rule: 'optional', default: true },
])

const buffer = serializer.encode('Player', { name: 'Alice', score: 42 })
const decoded = serializer.decode('Player', buffer)
// { name: 'Alice', score: 42, alive: true }`} />
            <button className="btn btn-primary btn-sm" onClick={run}>Run</button>
            <ConsoleOutput logs={logs} />
        </div>
    )
}

// ─── Field Types ───────────────────────────────────
const FieldTypesExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        const entries: LogEntry[] = []
        const origLog = console.log
        console.log = (...args: unknown[]) => {
            entries.push({ time: ts(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
        }
        try {
            const serializer = new Serializer()

            serializer.define('AllTypes', [
                { key: 'text', type: Serializer.FieldType.STRING, rule: 'required' },
                { key: 'count', type: Serializer.FieldType.INT32, rule: 'required' },
                { key: 'big', type: Serializer.FieldType.INT64, rule: 'optional' },
                { key: 'ratio', type: Serializer.FieldType.FLOAT, rule: 'optional' },
                { key: 'precise', type: Serializer.FieldType.DOUBLE, rule: 'optional' },
                { key: 'flag', type: Serializer.FieldType.BOOL, rule: 'optional' },
                { key: 'unsigned', type: Serializer.FieldType.UINT32, rule: 'optional' },
            ])

            const msg = { text: 'hello', count: -5, ratio: 3.14, precise: 2.718281828, flag: false, unsigned: 42 }
            console.log('Original:', JSON.stringify(msg))

            const buf = serializer.encode('AllTypes', msg)
            console.log('Encoded size:', buf.length, 'bytes')

            const dec = serializer.decode('AllTypes', buf)
            console.log('Decoded:', JSON.stringify(dec))

            console.log('')
            console.log('Available FieldType constants:')
            for (const [name, value] of Object.entries(Serializer.FieldType)) {
                console.log(`  ${name}: '${value}'`)
            }
        } finally { console.log = origLog }
        setLogs(entries)
    }

    return (
        <div className="example-section">
            <h3>Field Types</h3>
            <p>All 15 protobuf field types are supported via <code>Serializer.FieldType</code> constants.</p>
            <CodeBlock code={`Serializer.FieldType.STRING   // 'string'
Serializer.FieldType.INT32    // 'int32'
Serializer.FieldType.INT64    // 'int64'
Serializer.FieldType.FLOAT    // 'float'
Serializer.FieldType.DOUBLE   // 'double'
Serializer.FieldType.BOOL     // 'bool'
Serializer.FieldType.UINT32   // 'uint32'
Serializer.FieldType.BYTES    // 'bytes'
// ... and SINT32, FIXED32, SFIXED32, UINT64, SINT64, FIXED64, SFIXED64`} />
            <button className="btn btn-primary btn-sm" onClick={run}>Run</button>
            <ConsoleOutput logs={logs} />
        </div>
    )
}

// ─── Repeated fields ───────────────────────────────
const RepeatedFieldsExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        const entries: LogEntry[] = []
        const origLog = console.log
        console.log = (...args: unknown[]) => {
            entries.push({ time: ts(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
        }
        try {
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
        } finally { console.log = origLog }
        setLogs(entries)
    }

    return (
        <div className="example-section">
            <h3>Repeated Fields (Arrays)</h3>
            <p>Use <code>rule: 'repeated'</code> to encode arrays of values.</p>
            <CodeBlock code={`serializer.define('Inventory', [
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
const decoded = serializer.decode('Inventory', buffer)`} />
            <button className="btn btn-primary btn-sm" onClick={run}>Run</button>
            <ConsoleOutput logs={logs} />
        </div>
    )
}

// ─── Multiple message types ────────────────────────
const MultipleTypesExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        const entries: LogEntry[] = []
        const origLog = console.log
        console.log = (...args: unknown[]) => {
            entries.push({ time: ts(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
        }
        try {
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
        } finally { console.log = origLog }
        setLogs(entries)
    }

    return (
        <div className="example-section">
            <h3>Multiple Message Types</h3>
            <p>Define multiple message types on a single serializer — like a protocol schema for networking or storage.</p>
            <CodeBlock code={`const serializer = new Serializer('game-protocol')

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
const decoded = serializer.decode('Position', buffer)`} />
            <button className="btn btn-primary btn-sm" onClick={run}>Run</button>
            <ConsoleOutput logs={logs} />
        </div>
    )
}

// ─── Error Handling ────────────────────────────────
const ErrorHandlingExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => {
        const entries: LogEntry[] = []
        const origLog = console.log
        console.log = (...args: unknown[]) => {
            entries.push({ time: ts(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
        }
        try {
            const serializer = new Serializer()

            serializer.define('User', [
                { key: 'name', type: Serializer.FieldType.STRING, rule: 'required' },
            ])

            // 1. Encoding with undefined type
            try {
                serializer.encode('UnknownType', { name: 'test' })
            } catch (e: any) {
                console.log('✗ Unknown type:', e.message)
            }

            // 2. Decoding garbage
            try {
                serializer.decode('User', new Uint8Array([255, 255, 255]))
            } catch (e: any) {
                console.log('✗ Bad buffer:', e.message)
            }

            // 3. Success case
            try {
                const buf = serializer.encode('User', { name: 'Alice' })
                const dec = serializer.decode('User', buf)
                console.log('✓ Success:', JSON.stringify(dec))
            } catch (e: any) {
                console.log('✗ Error:', e.message)
            }
        } finally { console.log = origLog }
        setLogs(entries)
    }

    return (
        <div className="example-section">
            <h3>Error Handling</h3>
            <p>The serializer throws descriptive errors for undefined types, validation failures, and malformed buffers.</p>
            <CodeBlock code={`try {
  serializer.encode('UnknownType', data)
} catch (e) {
  // Error: type key=UnknownType is not defined
}

try {
  serializer.decode('User', badBuffer)
} catch (e) {
  // Error: decode error: ...
}`} />
            <button className="btn btn-primary btn-sm" onClick={run}>Run</button>
            <ConsoleOutput logs={logs} />
        </div>
    )
}

// ─── Page ──────────────────────────────────────────
const serializerExamples = [
    { key: 'basic', label: 'Basic', element: <BasicExample /> },
    { key: 'field-types', label: 'Field Types', element: <FieldTypesExample /> },
    { key: 'repeated', label: 'Repeated Fields', element: <RepeatedFieldsExample /> },
    { key: 'multiple', label: 'Multiple Types', element: <MultipleTypesExample /> },
    { key: 'errors', label: 'Error Handling', element: <ErrorHandlingExample /> },
]

export const SerializerExamplesPage = () => {
    const [active, setActive] = useState('basic')
    const current = serializerExamples.find(e => e.key === active)

    return (
        <div className="example-menu">
            <div className="example-menu__header">
                <h1>@toolcase/serializer</h1>
                <p>Protobuf-based binary serializer — compact and fast</p>
            </div>
            <div className="base-examples">
                <div className="base-examples__tabs-row">
                    {serializerExamples.map(ex => (
                        <button
                            key={ex.key}
                            className={`base-examples__tab ${active === ex.key ? 'base-examples__tab--active' : ''}`}
                            onClick={() => setActive(ex.key)}
                        >
                            {ex.label}
                        </button>
                    ))}
                </div>
                <div className="base-examples__content">
                    {current?.element}
                </div>
            </div>
        </div>
    )
}
