import { useState } from 'react'
import { Async } from '@toolcase/base'
import { captureConsoleAsync, DemoSection, type LogEntry } from './_demo/ConsoleDemo'

const deferredCode = `const d = new Async.Deferred<string>()

// Hand off the promise to a consumer
d.promise.then(v => console.log('resolved:', v))

// Settle it from outside
d.resolve('hello')`

const semaphoreCode = `const sem = new Async.Semaphore(2) // 2 concurrent slots

const task = (id: number) => sem.run(async () => {
  console.log(\`task \${id} started\`)
  await sleep(20)
  console.log(\`task \${id} done\`)
})

// 4 tasks but only 2 run at once
await Promise.all([task(1), task(2), task(3), task(4)])`

const mutexCode = `const mutex = new Async.Mutex()

const critical = async (id: number) => {
  const release = await mutex.acquire()
  try {
    console.log(\`section entered by \${id}\`)
    await sleep(10)
    console.log(\`section leaving by \${id}\`)
  } finally {
    release()
  }
}

await Promise.all([critical(1), critical(2), critical(3)])`

const pLimitCode = `const limit = Async.pLimit(2)

const results = await Promise.all(
  [1, 2, 3, 4, 5].map(n =>
    limit(async () => {
      console.log('running', n)
      return n * 2
    })
  )
)
console.log('results:', results)`

const withTimeoutCode = `// Resolves before the deadline
const fast = await Async.withTimeout(() => Promise.resolve('fast'), 500)
console.log('fast:', fast)

// Compose with retry — retry on timeout
import { retry } from '@toolcase/base'
let attempts = 0
const result = await retry(
  () => Async.withTimeout(async () => {
    if (++attempts < 3) throw new Error('timeout will fire')
    return 'success'
  }, 50),
  { retries: 5, minTimeout: 0 }
)
console.log('result after retries:', result)`

const sleepCode = `console.log('before')
await Async.sleep(100)
console.log('after 100 ms')`

const debounceCode = `const fn = Async.debounce((v: string) => {
  console.log('called with:', v)
}, 200)

fn('a')
fn('b')
fn('c')   // only this one fires after 200 ms
await sleep(250)`

const throttleCode = `const fn = Async.throttle((v: string) => {
  console.log('called with:', v)
}, 200)

fn('a')   // fires immediately
fn('b')   // within window — deferred
fn('c')   // replaces 'b' as trailing call
await sleep(250) // trailing fires here`

const { Deferred, Semaphore, Mutex, pLimit, withTimeout, sleep, debounce, throttle } = Async

export const AsyncDemo = () => {
    const [deferredLogs, setDeferredLogs] = useState<any[]>([])
    const [semaphoreLogs, setSemaphoreLogs] = useState<any[]>([])
    const [mutexLogs, setMutexLogs] = useState<any[]>([])
    const [pLimitLogs, setPLimitLogs] = useState<any[]>([])
    const [withTimeoutLogs, setWithTimeoutLogs] = useState<any[]>([])
    const [sleepLogs, setSleepLogs] = useState<any[]>([])
    const [debounceLogs, setDebounceLogs] = useState<any[]>([])
    const [throttleLogs, setThrottleLogs] = useState<any[]>([])
    const [running, setRunning] = useState('')

    const run = (key: string, setLogs: (l: any[]) => void, fn: () => Promise<void>) => async () => {
        setRunning(key); setLogs([])
        await captureConsoleAsync(fn, setLogs)
        setRunning('')
    }

    const runDeferred = run('deferred', setDeferredLogs, async () => {
        const d = new Deferred<string>()
        d.promise.then(v => console.log('resolved:', v))
        d.resolve('hello')
        await d.promise
    })

    const runSemaphore = run('semaphore', setSemaphoreLogs, async () => {
        const sem = new Semaphore(2)
        const task = (id: number) => sem.run(async () => {
            console.log(`task ${id} started`)
            await sleep(10)
            console.log(`task ${id} done`)
        })
        await Promise.all([task(1), task(2), task(3), task(4)])
    })

    const runMutex = run('mutex', setMutexLogs, async () => {
        const mutex = new Mutex()
        const critical = async (id: number) => {
            const release = await mutex.acquire()
            try {
                console.log(`section entered by ${id}`)
                await sleep(5)
                console.log(`section leaving by ${id}`)
            } finally {
                release()
            }
        }
        await Promise.all([critical(1), critical(2), critical(3)])
    })

    const runPLimit = run('pLimit', setPLimitLogs, async () => {
        const limit = pLimit(2)
        const results = await Promise.all(
            [1, 2, 3, 4, 5].map(n =>
                limit(async () => {
                    console.log('running', n)
                    return n * 2
                })
            )
        )
        console.log('results:', JSON.stringify(results))
    })

    const runWithTimeout = run('withTimeout', setWithTimeoutLogs, async () => {
        const fast = await withTimeout(() => Promise.resolve('fast'), 500)
        console.log('fast:', fast)
        try {
            await withTimeout(() => new Promise<void>(r => setTimeout(r, 500)), 50)
        } catch (e) {
            console.log('caught:', String(e))
        }
    })

    const runSleep = run('sleep', setSleepLogs, async () => {
        console.log('before')
        await sleep(100)
        console.log('after 100 ms')
    })

    const runDebounce = run('debounce', setDebounceLogs, async () => {
        const fn = debounce((v: string) => {
            console.log('called with:', v)
        }, 200)
        fn('a')
        fn('b')
        fn('c')
        await sleep(250)
    })

    const runThrottle = run('throttle', setThrottleLogs, async () => {
        const fn = throttle((v: string) => {
            console.log('called with:', v)
        }, 200)
        fn('a')
        fn('b')
        fn('c')
        await sleep(250)
    })

    return (
        <>
            <DemoSection
                title="Deferred"
                description="Promise with externally controlled resolve/reject. Useful for bridging callback APIs or coordinating between unrelated code paths."
                code={deferredCode}
                onRun={runDeferred}
                logs={deferredLogs}
                running={running === 'deferred'}
            />
            <DemoSection
                title="Semaphore"
                description="Limits concurrent access to a resource. N tasks may run at once; extras wait until a slot is released."
                code={semaphoreCode}
                onRun={runSemaphore}
                logs={semaphoreLogs}
                running={running === 'semaphore'}
            />
            <DemoSection
                title="Mutex"
                description="Mutual exclusion — one caller at a time. acquire() returns a release function; run() handles it automatically."
                code={mutexCode}
                onRun={runMutex}
                logs={mutexLogs}
                running={running === 'mutex'}
            />
            <DemoSection
                title="pLimit"
                description="Concurrency gate. Returns a runner that queues tasks and ensures at most N run in parallel."
                code={pLimitCode}
                onRun={runPLimit}
                logs={pLimitLogs}
                running={running === 'pLimit'}
            />
            <DemoSection
                title="withTimeout"
                description="Races a promise against a deadline. Composes with retry — use withTimeout inside the retry callback to get per-attempt deadlines."
                code={withTimeoutCode}
                onRun={runWithTimeout}
                logs={withTimeoutLogs}
                running={running === 'withTimeout'}
            />
            <DemoSection
                title="sleep"
                description="Simple delay. Returns a Promise that resolves after ms milliseconds."
                code={sleepCode}
                onRun={runSleep}
                logs={sleepLogs}
                running={running === 'sleep'}
            />
            <DemoSection
                title="debounce"
                description="Delays fn until ms have passed since the last call. Useful for search-as-you-type, window resize, and scroll handlers."
                code={debounceCode}
                onRun={runDebounce}
                logs={debounceLogs}
                running={running === 'debounce'}
            />
            <DemoSection
                title="throttle"
                description="Calls fn at most once per ms window. Fires immediately on the leading edge then once more at the trailing edge if called again during the window."
                code={throttleCode}
                onRun={runThrottle}
                logs={throttleLogs}
                running={running === 'throttle'}
            />
        </>
    )
}

export default AsyncDemo
