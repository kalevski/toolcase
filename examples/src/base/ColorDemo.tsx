import { useState } from 'react'
import { Color } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `Color.RED           // '#f44336'
Color.BLUE          // '#2196f3'
Color.getHex('orange')   // '#ff9800'
Color.toNumber('red')    // 16007990
Color.getRandomHex()     // random palette color`

export const ColorDemo = () => {
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
    return (
        <DemoSection
            title="Color"
            description="Material Design color palette constants with hex lookup and random color generation."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default ColorDemo
