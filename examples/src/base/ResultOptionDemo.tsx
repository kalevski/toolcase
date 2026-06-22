import { useState } from 'react'
import { ok, err, some, none } from '@toolcase/base'
import type { Result, Option } from '@toolcase/base'
import { captureConsole, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const resultCode = `// Result<T, E> — explicit error channel, no throwing
function divide(a: number, b: number): Result<number, string> {
    return b === 0 ? err('division by zero') : ok(a / b)
}

const r = divide(10, 2)
if (r.isOk()) console.log('value:', r.value)    // value: 5

// map transforms on success, passes through on error
divide(10, 0).map(n => n * 2).unwrapOr(-1)     // -1

// chain operations that may each fail
const result = ok<number, string>(10)
    .andThen(n => divide(n, 2))
    .andThen(n => n > 3 ? ok(n) : err('too small'))
    .map(n => \`result: \${n}\`)
console.log(result.unwrapOr('failed'))           // result: 5`

const optionCode = `// Option<T> — nullable without null
function findUser(id: number): Option<string> {
    const users: Record<number, string> = { 1: 'Alice', 2: 'Bob' }
    return id in users ? some(users[id]) : none()
}

const user = findUser(1)
if (user.isSome()) console.log('found:', user.value)  // found: Alice

findUser(99).unwrapOr('unknown')   // 'unknown'

// chain operations on an Option
const greeting = findUser(2)
    .map(name => name.toUpperCase())
    .andThen(name => name.length > 2 ? some(\`Hello \${name}\`) : none())
console.log(greeting.unwrapOr('n/a'))  // Hello BOB`

export const ResultOptionDemo = () => {
    const [resultLogs, setResultLogs] = useState<LogEntry[]>([])
    const [optionLogs, setOptionLogs] = useState<LogEntry[]>([])

    const runResult = () => setResultLogs(captureConsole(() => {
        function divide(a: number, b: number): Result<number, string> {
            return b === 0 ? err('division by zero') : ok(a / b)
        }

        const r = divide(10, 2)
        if (r.isOk()) console.log('value:', r.value)

        const r2 = divide(10, 0).map(n => n * 2).unwrapOr(-1)
        console.log('divide(10,0).map(*2).unwrapOr(-1):', r2)

        const result = ok<number, string>(10)
            .andThen(n => divide(n, 2))
            .andThen(n => n > 3 ? ok(n) : err('too small'))
            .map(n => `result: ${n}`)
        console.log(result.unwrapOr('failed'))

        const bad = ok<number, string>(10)
            .andThen(n => divide(n, 0))
            .map(n => n * 100)
        console.log('err chain unwrapOr:', bad.unwrapOr(-1))

        const mapped = err<number, string>('oops').mapErr(e => e.length)
        console.log('mapErr on err:', mapped.unwrapErr())
    }))

    const runOption = () => setOptionLogs(captureConsole(() => {
        const users: Record<number, string> = { 1: 'Alice', 2: 'Bob' }
        function findUser(id: number): Option<string> {
            return id in users ? some(users[id]) : none()
        }

        const user = findUser(1)
        if (user.isSome()) console.log('found:', user.value)

        console.log('missing user:', findUser(99).unwrapOr('unknown'))

        const greeting = findUser(2)
            .map(name => name.toUpperCase())
            .andThen(name => name.length > 2 ? some(`Hello ${name}`) : none())
        console.log(greeting.unwrapOr('n/a'))

        const missing = findUser(99).map(n => n.toUpperCase())
        console.log('map on none:', missing.isNone())
    }))

    return (
        <>
            <DemoSection
                title="Result<T, E>"
                description="Tagged union for explicit error handling without throwing. ok(value) / err(error) constructors; isOk/isErr guards; map, mapErr, andThen/flatMap combinators; unwrap/unwrapOr/unwrapErr."
                code={resultCode}
                onRun={runResult}
                logs={resultLogs}
            />
            <DemoSection
                title="Option<T>"
                description="Nullable value without null. some(value) / none() constructors; isSome/isNone guards; map, andThen/flatMap combinators; unwrap/unwrapOr."
                code={optionCode}
                onRun={runOption}
                logs={optionLogs}
            />
        </>
    )
}

export default ResultOptionDemo
