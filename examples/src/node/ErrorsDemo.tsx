import { useState } from 'react'
import {
    ConflictError,
    NotFoundError,
    OptimisticLockError,
    RateLimitedError,
    ValidationError,
    errorMeta,
} from '@toolcase/node'

const statusCodeFromError = (err: unknown): number => errorMeta(err)?.status ?? 500
import { captureLogs, NodeDemoCard, type LogEntry } from './_demo/NodeDemo'

const code = `import {
    NotFoundError,
    ConflictError,
    ValidationError,
    OptimisticLockError,
    RateLimitedError,
    errorMeta,
} from '@toolcase/node'

const statusCodeFromError = (err: unknown): number => errorMeta(err)?.status ?? 500

throw new NotFoundError('User', 42)
//   message: 'User not found: 42', resource, identifier

statusCodeFromError(new NotFoundError('User', 1))    // 404
statusCodeFromError(new ConflictError('Email'))      // 409
statusCodeFromError(new ValidationError('bad', 42))  // 400
statusCodeFromError(new OptimisticLockError(...))    // 409
statusCodeFromError(new RateLimitedError('ip', 30))  // 429`

const cases: Array<[string, () => Error]> = [
    ['NotFoundError("User", 42)', () => new NotFoundError('User', 42)],
    ['ConflictError("Email", "already taken")', () => new ConflictError('Email', 'already taken')],
    ['ValidationError("bad payload", { field: "email" })',
        () => new ValidationError('bad payload', { field: 'email' })],
    ['OptimisticLockError("Order", 3, 4)', () => new OptimisticLockError('Order', 3, 4)],
    ['RateLimitedError("ip:1.2.3.4", 30)', () => new RateLimitedError('ip:1.2.3.4', 30)],
]

export const ErrorsDemo = () => {
    const [logs, setLogs] = useState<LogEntry[]>([])
    const run = () => setLogs(captureLogs(() => {
        for (const [label, build] of cases) {
            const err = build()
            console.log(label)
            console.log('  message:', err.message)
            console.log('  HTTP status ->', statusCodeFromError(err))
        }
        console.log('plain Error -> statusCodeFromError:', statusCodeFromError(new Error('boom')))
    }))
    return (
        <NodeDemoCard
            title="Domain Errors → HTTP"
            description="Repository / endpoint errors carry semantic meaning, then map to HTTP status via statusCodeFromError. Endpoint base class uses this in its mapError helper."
            code={code}
            onRun={run}
            logs={logs}
        />
    )
}

export default ErrorsDemo
