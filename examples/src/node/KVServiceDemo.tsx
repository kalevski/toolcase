import { useState } from 'react'
// KeyBuilder / KV_KEY_SEPARATOR are pure (no Redis driver, no node:crypto), so the
// examples site can import and run them. They live on the Node-only `@toolcase/node`
// entry, which the site aliases to `main.iso.ts` — reach the real source directly.
import { KeyBuilder, KV_KEY_SEPARATOR } from '../../../node/src/kv/keys'
import { captureLogs, NodeDemoCard, type LogEntry } from './_demo/NodeDemo'

// ── Runnable: the real KeyBuilder primitive that KVService composes every key with ──

const keyBuilderCode = `import { KeyBuilder, KV_KEY_SEPARATOR } from '@toolcase/node'

// KVService routes every Redis key through a KeyBuilder. It is pure (no driver),
// so the real class can run here unchanged — this is the exact composition logic
// behind kv.set(...), kv.scoped(...), and pub/sub channel stripping.
const keys = new KeyBuilder('app:prod', KV_KEY_SEPARATOR)

keys.build('session', 'alice')           // 'app:prod:session:alice'
keys.build('rate', 'login', 42)          // 'app:prod:rate:login:42'

// A separator inside a single part is percent-escaped so it can't split the key:
keys.build('leaderboard:weekly')         // 'app:prod:leaderboard%3Aweekly'

// scope() returns a child builder — this is exactly what kv.scoped('tenant-42') does:
const tenant = keys.scope('tenant-42')
tenant.build('player', 'alice')          // 'app:prod:tenant-42:player:alice'

// stripNamespace() reverses build() — used when pub/sub channels arrive prefixed:
keys.stripNamespace('app:prod:players.scored')   // 'players.scored'`

// ── Annotated only: the rest of the KV surface needs Node + a live Redis driver ──

const serviceCode = `// Everything below needs a live Redis connection (node-redis v5+) and runs only on
// the server, so it is shown as a reference rather than executed here.

import { createClient } from 'redis'
import Serializer from '@toolcase/serializer'
import {
    KVService,
    // The standalone primitives KVService wires together (all driver-backed):
    Locker, RateLimiter, Leaderboard, ValueStore, Versioned, SubscriberPool,
    // Lua machinery — LuaScript hashes its source with node:crypto (SHA1) and
    // dispatches via EVALSHA/EVAL; KV_LUA_SCRIPTS holds the raw script sources.
    LuaScript, LuaScriptCache, KV_LUA_SCRIPTS,
} from '@toolcase/node'

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

// Distributed lock (Locker) — auto-released, optional retry
await kv.withLock('order:42', 5_000, async () => {
    await processOrder(42)
})

// Sliding-window rate limit (RateLimiter; also fixedWindow / tokenBucket)
const rl = await kv.slidingWindow('login:1.2.3.4', 5, 60_000)
if (!rl.allowed) throw new RateLimitedError('login', rl.resetInSeconds)

// Leaderboard (sorted sets)
await kv.addScore('weekly', 'alice', 1200)
const top = await kv.topN('weekly', 10)

// Typed value store (ValueStore — uses Serializer for binary encode/decode)
await kv.setValue('Player', 'p:alice', { id: 'alice', score: 1200 })
const player = await kv.getValue<{ id: string; score: number }>('Player', 'p:alice')

// Optimistic-versioned set (Versioned — CAS on a version field)
await kv.versionedSetValue('Player', 'p:alice', /* expectedVersion */ 0,
    { id: 'alice', score: 1300 })

// Pub/sub (SubscriberPool manages the dedicated subscriber connection)
const sub = await kv.subscribeValue<{ id: string; score: number }>(
    'Player', 'players.scored', async (msg) => track(msg))
// later: await sub.close()

// Scoped child for a tenant — keys become app:prod:tenant-42:*
const tenant = kv.scoped('tenant-42')

await kv.close()`

export const KVServiceDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const keys = new KeyBuilder('app:prod', KV_KEY_SEPARATOR)
        const show = (expr: string, value: string) => console.log(expr, '->', value)

        show("build('session', 'alice')", keys.build('session', 'alice'))
        show("build('rate', 'login', 42)", keys.build('rate', 'login', 42))
        show("build('leaderboard:weekly')  // separator escaped", keys.build('leaderboard:weekly'))

        const tenant = keys.scope('tenant-42')
        show("scope('tenant-42').build('player', 'alice')", tenant.build('player', 'alice'))

        show(
            "stripNamespace('app:prod:players.scored')",
            keys.stripNamespace('app:prod:players.scored'),
        )
    }))

    return (
        <div className="vstack gap-3">
            <NodeDemoCard
                title="KV Key Composition (KeyBuilder)"
                description="The pure key-composition primitive every KVService key flows through — namespace prefixing, multi-part joins, separator escaping, scoped (tenant) child builders, and namespace stripping for inbound pub/sub channels. No Redis driver required, so the real class runs in-browser. Press Run."
                code={keyBuilderCode}
                onRun={run}
                logs={logs}
            />
            <NodeDemoCard
                title="KVService (Redis) — server-side"
                description="Single Redis-backed service bundling Locker, RateLimiter (fixed/sliding/token-bucket), Leaderboard, ValueStore (Serializer-typed), Versioned (optimistic CAS), and SubscriberPool, with atomic ops via cached Lua scripts (LuaScript / LuaScriptCache / KV_LUA_SCRIPTS). These require a live node-redis v5+ connection (and node:crypto for Lua SHA1 dispatch), so this block is reference-only and is not executed above."
                code={serviceCode}
            />
        </div>
    )
}

export default KVServiceDemo
