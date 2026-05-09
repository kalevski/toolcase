import { useState } from 'react'
import { createSanitizer, type FieldSchema } from '@toolcase/node'
import { captureLogs, NodeDemoCard, type LogEntry } from './_demo/NodeDemo'

interface User {
    id: number
    email: string
    name: string
    password: string
    role: string
    createdAt: string
}

const code = `import { createSanitizer, type FieldSchema } from '@toolcase/node'

const schema: FieldSchema<User> = {
    id:        { readonly: true,  type: 'integer' },
    email:     { required: true,  type: 'string', format: 'email' },
    name:      { required: true,  type: 'string', min: 1 },
    password:  { writeOnly: true, type: 'string', min: 8 },
    role:      { private: true,   type: 'string' },
    createdAt: { readonly: true,  type: 'date' },
}

const sanitizer = createSanitizer<User>(schema)

// Strip readonly fields from incoming requests
sanitizer.input({ id: 99, email: 'a@b.c', password: 'secret123' })
//   → { email: 'a@b.c', password: 'secret123' }

// Strip private + writeOnly from outgoing responses
sanitizer.output({ id: 1, email: 'a@b.c', password: 'x', role: 'admin' })
//   → { id: 1, email: 'a@b.c' }`

export const SanitizeDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        const schema: FieldSchema<User> = {
            id: { readonly: true, type: 'integer' },
            email: { required: true, type: 'string', format: 'email' },
            name: { required: true, type: 'string', min: 1 },
            password: { writeOnly: true, type: 'string', min: 8 },
            role: { private: true, type: 'string' },
            createdAt: { readonly: true, type: 'date' },
        }
        const sanitizer = createSanitizer<User>(schema)

        const inboundReq = {
            id: 99,
            email: 'alice@example.com',
            name: 'Alice',
            password: 'hunter2hunter',
            role: 'admin',
            createdAt: '2026-01-01',
        }
        console.log('inbound:', inboundReq)
        console.log('sanitizer.input ->', sanitizer.input(inboundReq))

        const dbRow = {
            id: 1,
            email: 'alice@example.com',
            name: 'Alice',
            password: '$2b$hashed',
            role: 'admin',
            createdAt: '2026-01-01T00:00:00Z',
        }
        console.log('db row:', dbRow)
        console.log('sanitizer.output ->', sanitizer.output(dbRow))

        const restricted = sanitizer.output(dbRow, { restrictedFields: ['email'] })
        console.log('output, hide email ->', restricted)
    }))
    return (
        <NodeDemoCard
            title="API Sanitizer"
            description="Schema-driven request/response shaping. readonly strips on input, writeOnly+private strip on output, restrictedFields filters per request (e.g. role-based)."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default SanitizeDemo
