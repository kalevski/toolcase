import { useState } from 'react'
import {
    generateId,
    formatByteSize,
    toHex,
    bufferToHex,
    hexToBuffer,
    getNumberInRange,
} from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `generateId()        // '3a7f2b1c' (8 hex chars)
generateId(16)      // '3a7f2b1c9e4d8f01'

formatByteSize(1024)       // '1 KB'
formatByteSize(1073741824) // '1 GB'

toHex(255)          // '00ff'
toHex(255, 2)       // 'ff'

const hex = bufferToHex(new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]))
// 'deadbeef'
hexToBuffer('deadbeef') // Uint8Array [222, 173, 190, 239]

getNumberInRange('42', 0, 0, 100)   // 42
getNumberInRange('999', 0, 0, 100)  // 100 (clamped)`

export const UtilitiesDemo = () => {
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
    return (
        <DemoSection
            title="Utility Functions"
            description="Pure helper functions: generateId, formatByteSize, toHex, bufferToHex, hexToBuffer, getNumberInRange."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default UtilitiesDemo
