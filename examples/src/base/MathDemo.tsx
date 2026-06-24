import { useState } from 'react'
import { clamp, lerp, inverseLerp, mapRange, smoothstep, approximately } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `// clamp — constrain to [min, max]
clamp(15, 0, 10)        // 10
clamp(-5, 0, 10)        // 0
clamp(5, 0, 10)         // 5

// lerp — linear interpolation
lerp(0, 100, 0)         // 0
lerp(0, 100, 0.5)       // 50
lerp(0, 100, 1)         // 100

// inverseLerp — inverse of lerp
inverseLerp(0, 100, 25) // 0.25
inverseLerp(0, 100, 75) // 0.75

// mapRange — remap from one range to another
mapRange(0.5, 0, 1, 0, 255)   // 127.5
mapRange(128, 0, 255, 0, 1)   // ~0.502

// smoothstep — smooth S-curve interpolation
smoothstep(0, 1, 0)    // 0
smoothstep(0, 1, 0.5)  // 0.5
smoothstep(0, 1, 1)    // 1

// approximately — float equality within epsilon
approximately(0.1 + 0.2, 0.3)          // true
approximately(1.0, 1.0 + 1e-6)         // false
approximately(1.0, 1.0 + 1e-6, 1e-5)  // true`

export const MathDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        console.log('── clamp ──')
        console.log('clamp(15, 0, 10):', clamp(15, 0, 10))
        console.log('clamp(-5, 0, 10):', clamp(-5, 0, 10))
        console.log('clamp(5, 0, 10):', clamp(5, 0, 10))

        console.log('')
        console.log('── lerp ──')
        console.log('lerp(0, 100, 0):', lerp(0, 100, 0))
        console.log('lerp(0, 100, 0.25):', lerp(0, 100, 0.25))
        console.log('lerp(0, 100, 0.5):', lerp(0, 100, 0.5))
        console.log('lerp(0, 100, 0.75):', lerp(0, 100, 0.75))
        console.log('lerp(0, 100, 1):', lerp(0, 100, 1))

        console.log('')
        console.log('── inverseLerp ──')
        console.log('inverseLerp(0, 100, 0):', inverseLerp(0, 100, 0))
        console.log('inverseLerp(0, 100, 25):', inverseLerp(0, 100, 25))
        console.log('inverseLerp(0, 100, 75):', inverseLerp(0, 100, 75))
        console.log('inverseLerp(0, 100, 100):', inverseLerp(0, 100, 100))

        console.log('')
        console.log('── mapRange ──')
        console.log('mapRange(0.5, 0, 1, 0, 255):', mapRange(0.5, 0, 1, 0, 255))
        console.log('mapRange(128, 0, 255, 0, 1):', mapRange(128, 0, 255, 0, 1).toFixed(4))
        console.log('mapRange(5, 0, 10, -100, 100):', mapRange(5, 0, 10, -100, 100))

        console.log('')
        console.log('── smoothstep ──')
        for (const x of [0, 0.25, 0.5, 0.75, 1]) {
            console.log(`smoothstep(0, 1, ${x}):`, smoothstep(0, 1, x).toFixed(5))
        }

        console.log('')
        console.log('── approximately ──')
        console.log('0.1 + 0.2 === 0.3:', 0.1 + 0.2 === 0.3)
        console.log('approximately(0.1 + 0.2, 0.3):', approximately(0.1 + 0.2, 0.3))
        console.log('approximately(1.0, 1.0 + 1e-6):', approximately(1.0, 1.0 + 1e-6))
        console.log('approximately(1.0, 1.0 + 1e-6, 1e-5):', approximately(1.0, 1.0 + 1e-6, 1e-5))
    }))
    return (
        <DemoSection
            title="Math Utilities"
            description="Scalar math helpers: clamp, lerp, inverseLerp, mapRange, smoothstep, approximately."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default MathDemo
