import { useState } from 'react'
import {
    easeInQuad, easeOutQuad, easeInOutQuad,
    easeInCubic, easeOutCubic, easeInOutCubic,
    easeInExpo, easeOutExpo, easeInOutExpo,
    easeInBack, easeOutBack,
    easeInElastic, easeOutElastic,
    easeInBounce, easeOutBounce,
    cubicBezier
} from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `import { easeInQuad, easeOutCubic, easeInOutExpo, cubicBezier } from '@toolcase/base'

// 30 easing functions — 10 families × 3 variants (In / Out / InOut)
// Families: Sine, Quad, Cubic, Quart, Quint, Expo, Circ, Back, Elastic, Bounce

easeInQuad(0)    // 0
easeInQuad(0.5)  // 0.25
easeInQuad(1)    // 1

easeOutCubic(0)    // 0
easeOutCubic(0.5)  // 0.875
easeOutCubic(1)    // 1

easeInOutExpo(0)    // 0
easeInOutExpo(0.5)  // 0.5
easeInOutExpo(1)    // 1

// Cubic-bezier sampler — CSS-compatible control points
const ease = cubicBezier(0.25, 0.1, 0.25, 1.0)  // browser 'ease'
ease(0)    // 0
ease(0.5)  // ~0.847
ease(1)    // 1

// Namespace form
import { Easing } from '@toolcase/base'
Easing.easeInBounce(0.5)   // ~0.234
Easing.easeOutBounce(0.75) // ~0.972`

export const EasingDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const samples = [0, 0.25, 0.5, 0.75, 1]

        console.log('── easeInQuad / easeOutQuad / easeInOutQuad ──')
        for (const t of samples) {
            console.log(
                `t=${t}`,
                `in=${easeInQuad(t).toFixed(4)}`,
                `out=${easeOutQuad(t).toFixed(4)}`,
                `inOut=${easeInOutQuad(t).toFixed(4)}`
            )
        }

        console.log('')
        console.log('── easeInCubic / easeOutCubic / easeInOutCubic ──')
        for (const t of samples) {
            console.log(
                `t=${t}`,
                `in=${easeInCubic(t).toFixed(4)}`,
                `out=${easeOutCubic(t).toFixed(4)}`,
                `inOut=${easeInOutCubic(t).toFixed(4)}`
            )
        }

        console.log('')
        console.log('── easeInExpo / easeOutExpo / easeInOutExpo ──')
        for (const t of samples) {
            console.log(
                `t=${t}`,
                `in=${easeInExpo(t).toFixed(6)}`,
                `out=${easeOutExpo(t).toFixed(6)}`,
                `inOut=${easeInOutExpo(t).toFixed(6)}`
            )
        }

        console.log('')
        console.log('── easeInBack / easeOutBack (overshoot) ──')
        for (const t of samples) {
            console.log(`t=${t}`, `in=${easeInBack(t).toFixed(4)}`, `out=${easeOutBack(t).toFixed(4)}`)
        }

        console.log('')
        console.log('── easeInElastic / easeOutElastic (spring) ──')
        for (const t of samples) {
            console.log(`t=${t}`, `in=${easeInElastic(t).toFixed(4)}`, `out=${easeOutElastic(t).toFixed(4)}`)
        }

        console.log('')
        console.log('── easeInBounce / easeOutBounce ──')
        for (const t of samples) {
            console.log(`t=${t}`, `in=${easeInBounce(t).toFixed(4)}`, `out=${easeOutBounce(t).toFixed(4)}`)
        }

        console.log('')
        console.log('── cubicBezier ──')
        const cssBrowserEase = cubicBezier(0.25, 0.1, 0.25, 1.0)
        const cssEaseIn      = cubicBezier(0.42, 0, 1, 1)
        const cssEaseOut     = cubicBezier(0, 0, 0.58, 1)
        for (const t of samples) {
            console.log(
                `t=${t}`,
                `ease=${cssBrowserEase(t).toFixed(4)}`,
                `ease-in=${cssEaseIn(t).toFixed(4)}`,
                `ease-out=${cssEaseOut(t).toFixed(4)}`
            )
        }
    }))
    return (
        <DemoSection
            title="Easing Functions"
            description="30 easing functions (10 families × In/Out/InOut) plus a cubic-bezier sampler. All endpoints map 0→0 and 1→1."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default EasingDemo
