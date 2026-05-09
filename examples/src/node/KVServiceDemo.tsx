import { NodeDemoCard } from './_demo/NodeDemo'

const code = `import { createClient } from 'redis'
import Serializer from '@toolcase/serializer'
import { KVService } from '@toolcase/node'

const client = await createClient({ url: 'redis://localhost:6379' }).connect()

const serializer = new Serializer()
serializer.define('Player', [
    { key: 'id',    type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'score', type: Serializer.FieldType.INT32,  rule: 'optional', default: 0 },
])

const kv = new KVService({
    client,
    namespace: 'app:prod',
    serializer,
    onCommand: (op, ms) => metrics.histogram('redis.op', ms, { op }),
})

await kv.warmScripts()

// Distributed lock (auto-released, optional retry)
await kv.withLock('order:42', 5_000, async () => {
    await processOrder(42)
})

// Sliding-window rate limit
const rl = await kv.slidingWindow('login:1.2.3.4', 5, 60_000)
if (!rl.allowed) throw new RateLimitedError('login', rl.resetInSeconds)

// Leaderboard
await kv.addScore('weekly', 'alice', 1200)
const top = await kv.topN('weekly', 10)

// Typed value store (uses Serializer for binary encode)
await kv.setValue('Player', 'p:alice', { id: 'alice', score: 1200 })
const player = await kv.getValue<{ id: string; score: number }>('Player', 'p:alice')

// Optimistic-versioned set
await kv.versionedSetValue('Player', 'p:alice', /* expectedVersion */ 0,
    { id: 'alice', score: 1300 })

// Pub/sub
const sub = await kv.subscribeValue<{ id: string; score: number }>(
    'Player', 'players.scored', async (msg) => track(msg))
// later: await sub.close()

// Scoped child for a tenant
const tenant = kv.scoped('t:42')   // keys become app:prod:t:42:*

await kv.close()`

export const KVServiceDemo = () => (
    <NodeDemoCard
        title="KVService (Redis)"
        description="Single Redis-backed service that bundles Locker, RateLimiter (fixed/sliding/token-bucket), Leaderboard, ValueStore (Serializer-typed), Versioned (optimistic CAS), and SubscriberPool. Atomic ops via cached Lua scripts. Server-side only."
        code={code}
    />
)

export default KVServiceDemo
