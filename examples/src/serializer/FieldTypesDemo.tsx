import { useState } from 'react'
import Serializer from '@toolcase/serializer'
import { captureLogs, SerializerDemoCard, type LogEntry } from './_demo/SerializerDemo'

const code = `Serializer.FieldType.STRING   // 'string'
Serializer.FieldType.INT32    // 'int32'
Serializer.FieldType.INT64    // 'int64'
Serializer.FieldType.FLOAT    // 'float'
Serializer.FieldType.DOUBLE   // 'double'
Serializer.FieldType.BOOL     // 'bool'
Serializer.FieldType.UINT32   // 'uint32'
Serializer.FieldType.BYTES    // 'bytes'
// ... and SINT32, FIXED32, SFIXED32, UINT64, SINT64, FIXED64, SFIXED64`

export const FieldTypesDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const serializer = new Serializer()
        serializer.define('AllTypes', [
            { key: 'text', type: Serializer.FieldType.STRING, rule: 'required' },
            { key: 'count', type: Serializer.FieldType.INT32, rule: 'required' },
            { key: 'big', type: Serializer.FieldType.INT64, rule: 'optional' },
            { key: 'ratio', type: Serializer.FieldType.FLOAT, rule: 'optional' },
            { key: 'precise', type: Serializer.FieldType.DOUBLE, rule: 'optional' },
            { key: 'flag', type: Serializer.FieldType.BOOL, rule: 'optional' },
            { key: 'unsigned', type: Serializer.FieldType.UINT32, rule: 'optional' },
        ])

        const msg = { text: 'hello', count: -5, ratio: 3.14, precise: 2.718281828, flag: false, unsigned: 42 }
        console.log('Original:', JSON.stringify(msg))

        const buf = serializer.encode('AllTypes', msg)
        console.log('Encoded size:', buf.length, 'bytes')

        const dec = serializer.decode('AllTypes', buf)
        console.log('Decoded:', JSON.stringify(dec))

        console.log('')
        console.log('Scalar FieldType constants (15):')
        for (const [name, value] of Object.entries(Serializer.FieldType)) {
            if (typeof value === 'string') {
                console.log(`  ${name}: '${value}'`)
            }
        }
        console.log('')
        console.log('FieldType constructors (advanced types):')
        console.log('  ENUM(values)            — inline enum marker')
        console.log('  MAP(keyType, valueType) — map field marker')
        console.log('  PACKED_ARRAY(type)      — packed repeated marker')
    }))
    return (
        <SerializerDemoCard
            title="Field Types"
            description={
                <>
                    <code>Serializer.FieldType</code> provides 15 scalar field-type constants plus three
                    constructor helpers (<code>ENUM</code>, <code>MAP</code>, <code>PACKED_ARRAY</code>) for
                    advanced field descriptors.
                </>
            }
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default FieldTypesDemo
