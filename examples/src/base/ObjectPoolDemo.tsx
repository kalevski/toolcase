import { useState } from 'react'
import { ObjectPool } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `class Bullet { x = 0; y = 0; active = false }

const pool = new ObjectPool(Bullet, (b) => {
  b.x = 0; b.y = 0; b.active = false
})

const b1 = pool.obtain()
b1.x = 100; b1.y = 200

pool.release(b1)          // reset & return to pool
const b2 = pool.obtain()  // reuses b1
console.log(b2 === b1)    // true`

export const ObjectPoolDemo = () => {
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
    return (
        <DemoSection
            title="ObjectPool"
            description="Object pool for reusing instances and reducing garbage collection. Objects are reset on release."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default ObjectPoolDemo
