import { NodeDemoCard } from './_demo/NodeDemo'

const code = `import { BPlusIndex } from '@toolcase/base'
import {
    NodeStore,
    BlockStore,
    serializeBlockRef,
    deserializeBlockRef,
    BLOCK_REF_SIZE,
} from '@toolcase/node'

// ── NodeStore: put / get a record ───────────────────────────────────────────

type User = { id: string; name: string; score: number }

const enc = new TextEncoder()
const dec = new TextDecoder()

const store = await NodeStore.open<string, User>({
    path: '/data/users',
    ...BPlusIndex.keyPreset.string,     // compare + serializeKey + deserializeKey
    serializeValue:   v => enc.encode(JSON.stringify(v)),
    deserializeValue: b => JSON.parse(dec.decode(b)) as User,
})

await store.set('alice', { id: 'alice', name: 'Alice', score: 1_200 })
await store.set('bob',   { id: 'bob',   name: 'Bob',   score:   800 })

const alice = await store.get('alice')  // { id: 'alice', name: 'Alice', score: 1200 }
const size  = store.size                // 2

// Range scan — results in B+ tree key order
for await (const [key, user] of store.range({ gte: 'a', lte: 'z' })) {
    console.log(key, user.score)
}

// Compaction: reclaim dead heap blocks left by deletes / overwrites
console.log('live ratio:', store.liveRatio)  // 1.0 when no dead blocks
await store.optimize()

await store.close()

// ── BlockRef: serialize / deserialize round-trip ────────────────────────────
// BLOCK_REF_SIZE === 12 (segment u32 + offset u32 + length u32)

const ref = { segment: 0, offset: 128, length: 64 }
const buf  = serializeBlockRef(ref)                       // Uint8Array(12)
const back = deserializeBlockRef(buf)                     // { segment: 0, offset: 128, length: 64 }

console.log(buf.byteLength === BLOCK_REF_SIZE)            // true
console.log(JSON.stringify(back) === JSON.stringify(ref)) // true

// ── BlockStore: direct heap access (advanced) ───────────────────────────────

const bs = new BlockStore('/data/raw')
await bs.scanSegments()            // discover existing .dat.N files
bs.setActive(0, 0)                 // designate segment 0 as the write target
const written = await bs.append(enc.encode('hello'))   // → BlockRef
await bs.fsyncActive()
const raw = await bs.read(written) // Uint8Array containing 'hello'
await bs.close()`

export const NodeStoreDemo = () => (
    <NodeDemoCard
        title="NodeStore / BlockStore"
        description="Two-file persistent key-value store: a B+ tree index (.idx) maps typed keys to 12-byte BlockRef pointers into an append-mostly data heap (.dat.N). No external deps beyond node:fs. Server-side only."
        code={code}
    />
)

export default NodeStoreDemo
