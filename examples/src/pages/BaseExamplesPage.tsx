import { useState, useCallback } from 'react'
import {
    State, retry, EventEmitter, Broadcast, ObjectPool, PriorityQueue,
    Cache, VectorClock, AdjacencyMatrix, LSystem, Color,
    generateId, formatByteSize, toHex, bufferToHex, hexToBuffer,
    getNumberInRange, JSONSchema
} from '@toolcase/base'

type LogEntry = { time: string; text: string }

const ts = () => new Date().toLocaleTimeString()

const captureConsole = (fn: () => void): LogEntry[] => {
    const logs: LogEntry[] = []
    const origLog = console.log
    console.log = (...args: unknown[]) => {
        logs.push({
            time: ts(),
            text: args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '),
        })
    }
    try { fn() } finally { console.log = origLog }
    return logs
}

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

const ExampleSection = ({ title, description, code, onRun, logs, running }: {
    title: string; description: string; code: string
    onRun: () => void; logs: LogEntry[]; running?: boolean
}) => (
    <div className="example-section">
        <h3>{title}</h3>
        <p>{description}</p>
        <CodeBlock code={code} />
        <button className="btn btn-primary btn-sm" onClick={onRun} disabled={running}>
            {running ? 'Running...' : 'Run'}
        </button>
        <ConsoleOutput logs={logs} />
    </div>
)

// ─── EventEmitter ──────────────────────────────────
const EventEmitterExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const emitter = new EventEmitter()

        emitter.on('message', (text: string) => console.log('Received:', text))
        emitter.once('connect', () => console.log('Connected! (once)'))

        console.log('Listener count for "message":', emitter.listenerCount('message'))
        emitter.emit('message', 'Hello World')
        emitter.emit('connect')
        emitter.emit('connect') // won't fire — once listener already removed
        console.log('Event names:', JSON.stringify(emitter.eventNames()))

        emitter.off('message')
        console.log('After off(), listener count:', emitter.listenerCount('message'))
    }))
    return <ExampleSection title="EventEmitter" description="Typed event emitter with on, once, off, and emit." code={`const emitter = new EventEmitter()

emitter.on('message', (text) => console.log('Received:', text))
emitter.once('connect', () => console.log('Connected! (once)'))

emitter.emit('message', 'Hello World')
emitter.emit('connect')
emitter.emit('connect') // won't fire — once removes itself

emitter.off('message')
console.log('Listener count:', emitter.listenerCount('message'))`} onRun={run} logs={logs} />
}

// ─── Broadcast ─────────────────────────────────────
const BroadcastExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        class GameServer extends Broadcast {
            start() {
                this.emit('status', 'starting')
                this.emit('status', 'running')
            }
            stop() {
                this.emit('status', 'stopped')
            }
        }

        const server = new GameServer()
        server.on('status', (s: string) => console.log('Server status:', s))
        server.start()
        server.stop()
        console.log('Listener count:', server.listenerCount('status'))
        server.removeAllListeners()
        console.log('After removeAll:', server.listenerCount('status'))
    }))
    return <ExampleSection title="Broadcast" description="Base class that adds pub/sub events to any class via composition." code={`class GameServer extends Broadcast {
  start() {
    this.emit('status', 'starting')
    this.emit('status', 'running')
  }
  stop() { this.emit('status', 'stopped') }
}

const server = new GameServer()
server.on('status', (s) => console.log('Server status:', s))
server.start()
server.stop()`} onRun={run} logs={logs} />
}

// ─── State ─────────────────────────────────────────
const StateExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const state = new State({ score: 0, player: { name: 'Alice' } })
        state.on('state', (v: unknown) => console.log('state changed:', JSON.stringify(v)))
        state.on('state.score', (v: unknown) => console.log('score →', v))
        state.on('state.player.name', (v: unknown) => console.log('player.name →', v))

        console.log('Initial:', JSON.stringify(state.get()))
        state.set({ score: 10 })
        state.set({ player: { name: 'Bob' } })
        console.log('After updates:', JSON.stringify(state.get()))

        state.empty()
        console.log('After empty():', JSON.stringify(state.get()))
    }))
    return <ExampleSection title="State" description="Observable object that emits granular events when properties change, including nested paths." code={`const state = new State({ score: 0, player: { name: 'Alice' } })

state.on('state.score', (v) => console.log('score →', v))
state.on('state.player.name', (v) => console.log('name →', v))

state.set({ score: 10 })
state.set({ player: { name: 'Bob' } })
state.empty()`} onRun={run} logs={logs} />
}

// ─── Cache ─────────────────────────────────────────
const CacheExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [running, setRunning] = useState(false)
    const run = async () => {
        setRunning(true); setLogs([])
        const entries: LogEntry[] = []
        const origLog = console.log
        console.log = (...args: unknown[]) => {
            entries.push({ time: ts(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
            setLogs([...entries])
        }
        try {
            let fetchCount = 0
            const cache = new Cache((key: string) => {
                fetchCount++
                console.log(`fetchFn called (#${fetchCount}) for key="${key}"`)
                return `data-for-${key}`
            }, 2000)

            const r1 = await cache.get('users')
            console.log('1st get:', r1)
            const r2 = await cache.get('users')
            console.log('2nd get (cached):', r2)
            console.log('Total fetches:', fetchCount)

            cache.invalidate('users')
            console.log('After invalidate, fetching again...')
            await cache.get('users')
            console.log('Total fetches:', fetchCount)
        } finally { console.log = origLog; setRunning(false) }
    }
    return <ExampleSection title="Cache" description="TTL-based cache that deduplicates expensive fetch calls. Re-fetches automatically when entries expire." code={`const cache = new Cache((key) => {
  console.log('fetchFn called for', key)
  return \`data-for-\${key}\`
}, 2000) // 2s TTL

await cache.get('users')  // calls fetchFn
await cache.get('users')  // cached — no fetch
cache.invalidate('users')
await cache.get('users')  // fetches again`} onRun={run} logs={logs} running={running} />
}

// ─── PriorityQueue ─────────────────────────────────
const PriorityQueueExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const pq = new PriorityQueue<{ task: string; priority: number }>(
            node => node.priority,
            node => node.task
        )

        pq.enqueue({ task: 'Send email', priority: 3 })
        pq.enqueue({ task: 'Fix critical bug', priority: 1 })
        pq.enqueue({ task: 'Update docs', priority: 5 })
        pq.enqueue({ task: 'Deploy hotfix', priority: 2 })

        console.log('Queue length:', pq.length)
        console.log('Has "Fix critical bug":', pq.has({ task: 'Fix critical bug', priority: 1 }))

        while (pq.length > 0) {
            const item = pq.dequeue()!
            console.log(`Dequeued: [priority=${item.priority}] ${item.task}`)
        }
    }))
    return <ExampleSection title="PriorityQueue" description="Min-heap priority queue. Dequeues lowest-priority-number first. Supports uniqueness tracking." code={`const pq = new PriorityQueue(
  node => node.priority,   // priority function
  node => node.task         // uniqueness function
)

pq.enqueue({ task: 'Send email', priority: 3 })
pq.enqueue({ task: 'Fix critical bug', priority: 1 })
pq.enqueue({ task: 'Update docs', priority: 5 })
pq.enqueue({ task: 'Deploy hotfix', priority: 2 })

while (pq.length > 0) {
  const item = pq.dequeue()
  // dequeues in order: 1, 2, 3, 5
}`} onRun={run} logs={logs} />
}

// ─── VectorClock ───────────────────────────────────
const VectorClockExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const clockA = new VectorClock('node-A')
        const clockB = new VectorClock('node-B')

        clockA.increment()
        clockA.increment()
        console.log('A after 2 increments:', JSON.stringify(clockA.getClock()))

        clockB.increment()
        console.log('B after 1 increment:', JSON.stringify(clockB.getClock()))

        console.log('A isAfter B?', clockA.isAfter(clockB))
        console.log('A isBefore B?', clockA.isBefore(clockB))
        console.log('Concurrent?', clockA.isConcurrent(clockB))

        clockA.update(clockB)
        console.log('A after merge with B:', JSON.stringify(clockA.getClock()))
        console.log('A isAfter B now?', clockA.isAfter(clockB))
    }))
    return <ExampleSection title="VectorClock" description="Vector clock for causal ordering in distributed systems. Tracks versions per node and detects concurrency." code={`const clockA = new VectorClock('node-A')
const clockB = new VectorClock('node-B')

clockA.increment()
clockA.increment()
clockB.increment()

console.log('Concurrent?', clockA.isConcurrent(clockB)) // true

clockA.update(clockB) // merge
console.log('A isAfter B?', clockA.isAfter(clockB))      // true`} onRun={run} logs={logs} />
}

// ─── AdjacencyMatrix ───────────────────────────────
const AdjacencyMatrixExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const graph = new AdjacencyMatrix()
        graph.addVertex('A')
        graph.addVertex('B')
        graph.addVertex('C')
        graph.addVertex('D')

        graph.addEdge('A', 'B')
        graph.addEdge('A', 'C')
        graph.addEdge('B', 'D')
        graph.addEdge('C', 'D')

        console.log('Vertices:', JSON.stringify(graph.vertices))
        console.log('Edges from A:', JSON.stringify(graph.getEdges('A')))
        console.log('Edges from B:', JSON.stringify(graph.getEdges('B')))
        console.log('A→B exists?', graph.hasEdge('A', 'B'))
        console.log('B→A exists?', graph.hasEdge('B', 'A'))

        graph.removeEdge('A', 'B')
        console.log('After removing A→B:', JSON.stringify(graph.getEdges('A')))

        graph.removeVertex('D')
        console.log('After removing D, vertices:', JSON.stringify(graph.vertices))
    }))
    return <ExampleSection title="AdjacencyMatrix" description="Directed graph using an adjacency matrix. Supports weighted edges via generic types." code={`const graph = new AdjacencyMatrix()
graph.addVertex('A')
graph.addVertex('B')
graph.addVertex('C')

graph.addEdge('A', 'B')
graph.addEdge('A', 'C')

console.log(graph.getEdges('A'))  // ['B', 'C']
console.log(graph.hasEdge('B', 'A')) // false (directed)

graph.removeVertex('C')`} onRun={run} logs={logs} />
}

// ─── ObjectPool ────────────────────────────────────
const ObjectPoolExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        class Bullet { x = 0; y = 0; active = false }

        const pool = new ObjectPool(Bullet, (b) => {
            b.x = 0; b.y = 0; b.active = false
        })

        console.log('Pool instances:', pool.instances)
        const b1 = pool.obtain()
        b1.x = 100; b1.y = 200; b1.active = true
        console.log('Obtained bullet:', JSON.stringify({ x: b1.x, y: b1.y, active: b1.active }))
        console.log('Pool instances:', pool.instances)

        const b2 = pool.obtain()
        console.log('Pool instances after 2nd obtain:', pool.instances)

        pool.release(b1)
        console.log('Released b1 back to pool')

        const b3 = pool.obtain()
        console.log('b3 (reused):', JSON.stringify({ x: b3.x, y: b3.y, active: b3.active }))
        console.log('b3 === b1?', b3 === b1)
    }))
    return <ExampleSection title="ObjectPool" description="Object pool for reusing instances and reducing garbage collection. Objects are reset on release." code={`class Bullet { x = 0; y = 0; active = false }

const pool = new ObjectPool(Bullet, (b) => {
  b.x = 0; b.y = 0; b.active = false
})

const b1 = pool.obtain()
b1.x = 100; b1.y = 200

pool.release(b1)          // reset & return to pool
const b2 = pool.obtain()  // reuses b1
console.log(b2 === b1)    // true`} onRun={run} logs={logs} />
}

// ─── LSystem ───────────────────────────────────────
const LSystemExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const lsystem = new LSystem({
            axiom: 'A',
            rules: { A: 'AB', B: 'A' }
        })

        console.log('Initial:', lsystem.state)
        for (let i = 0; i < 7; i++) {
            lsystem.iterate()
            console.log(`Iteration ${lsystem.iteration}: ${lsystem.state} (length: ${lsystem.state.length})`)
        }

        console.log('')
        const tree = new LSystem({
            axiom: 'X',
            rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }
        })
        console.log('Tree L-System:')
        console.log('Start:', tree.state)
        for (let i = 0; i < 3; i++) {
            tree.iterate()
            console.log(`Iteration ${tree.iteration}: (length ${tree.state.length})`)
        }
    }))
    return <ExampleSection title="LSystem" description="Lindenmayer system for procedural generation. Iteratively rewrites a string using production rules." code={`// Fibonacci-like growth
const lsystem = new LSystem({
  axiom: 'A',
  rules: { A: 'AB', B: 'A' }
})

lsystem.iterate() // 'AB'
lsystem.iterate() // 'ABA'
lsystem.iterate() // 'ABAAB'

// Tree branching
const tree = new LSystem({
  axiom: 'X',
  rules: { X: 'F+[[X]-X]-F[-FX]+X', F: 'FF' }
})`} onRun={run} logs={logs} />
}

// ─── Retry ─────────────────────────────────────────
const RetryExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const [running, setRunning] = useState(false)
    const run = async () => {
        setRunning(true); setLogs([])
        const entries: LogEntry[] = []
        const origLog = console.log
        console.log = (...args: unknown[]) => {
            entries.push({ time: ts(), text: args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ') })
            setLogs([...entries])
        }
        try {
            let attempt = 0
            const result = await retry(() => {
                attempt++
                console.log(`Attempt #${attempt}...`)
                if (attempt < 3) throw new Error('API unavailable')
                return { data: 'success', attempt }
            }, { retries: 5, minTimeout: 300, factor: 2, randomize: false })
            console.log('Result:', JSON.stringify(result))
        } catch (err) {
            console.log('Failed:', String(err))
        } finally { console.log = origLog; setRunning(false) }
    }
    return <ExampleSection title="retry" description="Retry an async function with exponential backoff. Configurable retries, timeouts, and jitter." code={`const result = await retry(() => {
  // throws on first 2 attempts, succeeds on 3rd
  if (attempt < 3) throw new Error('API unavailable')
  return { data: 'success' }
}, {
  retries: 5,
  minTimeout: 300,  // ms
  factor: 2,        // exponential multiplier
  randomize: false
})`} onRun={run} logs={logs} running={running} />
}

// ─── JSONSchema ────────────────────────────────────
const JSONSchemaExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                name: { type: 'string', required: true },
                email: { type: 'email', required: true },
                age: { type: 'number', required: false },
            }
        })

        const valid = { name: 'Alice', email: 'alice@example.com', age: 30 }
        try {
            schema.validate(valid)
            console.log('✓ Valid:', JSON.stringify(valid))
        } catch (e: any) {
            console.log('✗ Invalid:', e.message)
        }

        const invalid = { name: 'Bob', email: 'not-an-email', age: 25 }
        try {
            schema.validate(invalid)
            console.log('✓ Valid:', JSON.stringify(invalid))
        } catch (e: any) {
            console.log('✗ Invalid:', e.message)
        }

        const missing = { email: 'test@test.com' }
        try {
            schema.validate(missing)
            console.log('✓ Valid:', JSON.stringify(missing))
        } catch (e: any) {
            console.log('✗ Invalid:', e.message)
        }
    }))
    return <ExampleSection title="JSONSchema" description="Data validation with built-in types: string, number, boolean, object, array, email, username, password, url." code={`const schema = new JSONSchema({
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    email: { type: 'email', required: true },
    age: { type: 'number', required: false },
  }
})

schema.validate({ name: 'Alice', email: 'alice@example.com' }) // ✓
schema.validate({ name: 'Bob', email: 'not-an-email' })        // ✗ throws`} onRun={run} logs={logs} />
}

// ─── Color ─────────────────────────────────────────
const ColorExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        console.log('Color.RED:', Color.RED)
        console.log('Color.BLUE:', Color.BLUE)
        console.log('Color.TEAL:', Color.TEAL)
        console.log('Color.getHex("orange"):', Color.getHex('orange'))
        console.log('Color.toNumber("red"):', Color.toNumber('red'))
        console.log('Random color:', Color.getRandomHex())
        console.log('Random color:', Color.getRandomHex())
        console.log('Random color:', Color.getRandomHex())
    }))
    return <ExampleSection title="Color" description="Material Design color palette constants with hex lookup and random color generation." code={`Color.RED           // '#f44336'
Color.BLUE          // '#2196f3'
Color.getHex('orange')   // '#ff9800'
Color.toNumber('red')    // 16007990
Color.getRandomHex()     // random palette color`} onRun={run} logs={logs} />
}

// ─── Utility Functions ─────────────────────────────
const UtilityFunctionsExample = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        console.log('── generateId ──')
        console.log('generateId():', generateId())
        console.log('generateId(16):', generateId(16))
        console.log('generateId(4):', generateId(4))

        console.log('')
        console.log('── formatByteSize ──')
        console.log('1024:', formatByteSize(1024))
        console.log('1536:', formatByteSize(1536))
        console.log('1073741824:', formatByteSize(1073741824))
        console.log('0:', formatByteSize(0))

        console.log('')
        console.log('── toHex ──')
        console.log('255:', toHex(255))
        console.log('255 (2 digits):', toHex(255, 2))
        console.log('4096:', toHex(4096))

        console.log('')
        console.log('── bufferToHex / hexToBuffer ──')
        const buf = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])
        const hex = bufferToHex(buf)
        console.log('Buffer → Hex:', hex)
        const back = hexToBuffer(hex)
        console.log('Hex → Buffer:', JSON.stringify(Array.from(back)))

        console.log('')
        console.log('── getNumberInRange ──')
        console.log('("42", default=0, 0-100):', getNumberInRange('42', 0, 0, 100))
        console.log('("999", default=0, 0-100):', getNumberInRange('999', 0, 0, 100))
        console.log('("abc", default=50):', getNumberInRange('abc', 50))
        console.log('(NaN, default=10):', getNumberInRange(NaN, 10))
    }))
    return <ExampleSection title="Utility Functions" description="Pure helper functions: generateId, formatByteSize, toHex, bufferToHex, hexToBuffer, getNumberInRange." code={`generateId()        // '3a7f2b1c' (8 hex chars)
generateId(16)      // '3a7f2b1c9e4d8f01'

formatByteSize(1024)       // '1 KB'
formatByteSize(1073741824) // '1 GB'

toHex(255)          // '00ff'
toHex(255, 2)       // 'ff'

const hex = bufferToHex(new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]))
// 'deadbeef'
hexToBuffer('deadbeef') // Uint8Array [222, 173, 190, 239]

getNumberInRange('42', 0, 0, 100)   // 42
getNumberInRange('999', 0, 0, 100)  // 100 (clamped)`} onRun={run} logs={logs} />
}

// ─── All examples ──────────────────────────────────
const categories = [
    {
        name: 'Events & State',
        icon: 'bi-broadcast',
        examples: [
            { key: 'event-emitter', label: 'EventEmitter', element: <EventEmitterExample /> },
            { key: 'broadcast', label: 'Broadcast', element: <BroadcastExample /> },
            { key: 'state', label: 'State', element: <StateExample /> },
        ]
    },
    {
        name: 'Data Structures',
        icon: 'bi-diagram-3',
        examples: [
            { key: 'cache', label: 'Cache', element: <CacheExample /> },
            { key: 'priority-queue', label: 'PriorityQueue', element: <PriorityQueueExample /> },
            { key: 'vector-clock', label: 'VectorClock', element: <VectorClockExample /> },
            { key: 'adjacency-matrix', label: 'AdjacencyMatrix', element: <AdjacencyMatrixExample /> },
            { key: 'object-pool', label: 'ObjectPool', element: <ObjectPoolExample /> },
        ]
    },
    {
        name: 'Generation & Validation',
        icon: 'bi-gear',
        examples: [
            { key: 'lsystem', label: 'LSystem', element: <LSystemExample /> },
            { key: 'json-schema', label: 'JSONSchema', element: <JSONSchemaExample /> },
            { key: 'retry', label: 'retry', element: <RetryExample /> },
        ]
    },
    {
        name: 'Utilities & Colors',
        icon: 'bi-palette',
        examples: [
            { key: 'utilities', label: 'Utility Functions', element: <UtilityFunctionsExample /> },
            { key: 'color', label: 'Color', element: <ColorExample /> },
        ]
    },
]

const allExamples = categories.flatMap(c => c.examples)

export const BaseExamplesPage = () => {
    const [active, setActive] = useState('event-emitter')
    const current = allExamples.find(e => e.key === active)

    return (
        <div className="example-menu">
            <div className="example-menu__header">
                <h1>@toolcase/base</h1>
                <p>Helper functions and data structures — zero dependencies</p>
            </div>
            <div className="base-examples">
                {categories.map(cat => (
                    <div key={cat.name} className="base-examples__category">
                        <div className="base-examples__category-header">
                            <i className={`bi ${cat.icon}`}></i>
                            <span>{cat.name}</span>
                        </div>
                        <div className="base-examples__tabs-row">
                            {cat.examples.map(ex => (
                                <button
                                    key={ex.key}
                                    className={`base-examples__tab ${active === ex.key ? 'base-examples__tab--active' : ''}`}
                                    onClick={() => setActive(ex.key)}
                                >
                                    {ex.label}
                                </button>
                            ))}
                        </div>
                    </div>
                ))}
                <div className="base-examples__content">
                    {current?.element}
                </div>
            </div>
        </div>
    )
}
