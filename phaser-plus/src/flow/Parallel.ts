export type ParallelTask = (done: () => void) => void

export interface ParallelHandle {
    cancel(): void
    readonly running: number
    readonly remaining: number
    readonly done: boolean
}

export default class Parallel {

    static run(concurrency: number, tasks: ParallelTask[], onAll?: () => void): ParallelHandle {
        const limit = concurrency > 0 ? Math.floor(concurrency) : tasks.length
        let running = 0
        let index = 0
        let finished = 0
        let cancelled = false
        const total = tasks.length

        const startNext = (): void => {
            if (cancelled) return
            while (running < limit && index < total) {
                const task = tasks[index++]!
                running++
                let triggered = false
                const done = (): void => {
                    if (triggered) return
                    triggered = true
                    running--
                    finished++
                    if (cancelled) return
                    if (finished === total) {
                        onAll?.()
                        return
                    }
                    startNext()
                }
                try {
                    task(done)
                } catch {
                    done()
                }
            }
        }

        startNext()

        return {
            cancel() { cancelled = true },
            get running() { return running },
            get remaining() { return total - finished },
            get done() { return finished === total }
        }
    }

}
