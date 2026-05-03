import { useState } from 'react'
import { JSONSchema } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const code = `const schema = new JSONSchema({
  type: 'object',
  properties: {
    name: { type: 'string', required: true },
    email: { type: 'email', required: true },
    age: { type: 'number', required: false },
  }
})

schema.validate({ name: 'Alice', email: 'alice@example.com' }) // ✓
schema.validate({ name: 'Bob', email: 'not-an-email' })        // ✗ throws`

export const JSONSchemaDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureConsole(() => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                name: { type: 'string', required: true },
                email: { type: 'email', required: true },
                age: { type: 'number', required: false },
            }
        })

        const valid = { name: 'Alice', email: 'alice@example.com', age: 30 }
        try {
            schema.validate(valid)
            console.log('✓ Valid:', JSON.stringify(valid))
        } catch (e: any) {
            console.log('✗ Invalid:', e.message)
        }

        const invalid = { name: 'Bob', email: 'not-an-email', age: 25 }
        try {
            schema.validate(invalid)
            console.log('✓ Valid:', JSON.stringify(invalid))
        } catch (e: any) {
            console.log('✗ Invalid:', e.message)
        }

        const missing = { email: 'test@test.com' }
        try {
            schema.validate(missing)
            console.log('✓ Valid:', JSON.stringify(missing))
        } catch (e: any) {
            console.log('✗ Invalid:', e.message)
        }
    }))
    return (
        <DemoSection
            title="JSONSchema"
            description="Data validation with built-in types: string, number, boolean, object, array, email, username, password, url."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default JSONSchemaDemo
