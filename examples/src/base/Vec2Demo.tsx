import { useState } from 'react'
import { Vec2 } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const a = new Vec2(3, 0)
const b = new Vec2(0, 4)

// add / subtract / scale
console.log(a.add(b).toString())           // Vec2(3, 4)
console.log(a.subtract(b).toString())      // Vec2(3, -4)
console.log(a.scale(2).toString())         // Vec2(6, 0)

// length, normalize
const c = new Vec2(3, 4)
console.log('length:', c.length)           // 5
console.log('unit:', c.normalize().toString()) // Vec2(0.6, 0.8)

// dot product
console.log('dot perpendicular:', a.dot(b)) // 0
console.log('dot parallel:', a.dot(a))      // 9

// lerp
const start = new Vec2(0, 0)
const end   = new Vec2(100, 200)
console.log('lerp 50%:', start.lerp(end, 0.5).toString()) // Vec2(50, 100)

// rotate 90°
const right = new Vec2(1, 0)
const up    = right.rotate(Math.PI / 2)
console.log('rotated up:', up.toString())  // Vec2(~0, 1)

// distanceTo
console.log('dist:', new Vec2(0,0).distanceTo(new Vec2(3, 4))) // 5

// Rect type: { x, y, width, height }
import type { Rect } from '@toolcase/base'
const bounds: Rect = { x: 0, y: 0, width: 100, height: 50 }
const center = new Vec2(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
console.log('bounds center:', center.toString())`

export const Vec2Demo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const a = new Vec2(3, 0)
        const b = new Vec2(0, 4)

        console.log(a.add(b).toString())
        console.log(a.subtract(b).toString())
        console.log(a.scale(2).toString())

        const c = new Vec2(3, 4)
        console.log('length:', c.length)
        console.log('unit:', c.normalize().toString())

        console.log('dot perpendicular:', a.dot(b))
        console.log('dot self:', a.dot(a))

        const start = new Vec2(0, 0)
        const end   = new Vec2(100, 200)
        console.log('lerp 50%:', start.lerp(end, 0.5).toString())

        const right = new Vec2(1, 0)
        const up    = right.rotate(Math.PI / 2)
        console.log('rotated up:', `Vec2(${up.x.toFixed(5)}, ${up.y.toFixed(5)})`)

        console.log('dist:', new Vec2(0, 0).distanceTo(new Vec2(3, 4)))

        const bounds = { x: 0, y: 0, width: 100, height: 50 }
        const center = new Vec2(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
        console.log('bounds center:', center.toString())
    }))
    return (
        <DemoSection
            title="Vec2"
            description="Immutable 2D vector. Every operation returns a new Vec2. Use for game physics, 2D geometry, animation targets, sprite positions, or anywhere you need zero-allocation vector math."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default Vec2Demo
