import FlowProcessor from './FlowProcessor'
import Job from './Job'

type JobClass<T extends Job<P>, P> = new (scene: import('../engine/Scene').default, payload: P) => T

export default class JobProcessor extends FlowProcessor {

    private queue: Job<unknown>[] = []

    /**
     * Maximum number of jobs to process per frame. Default 1 keeps the
     * cooperative-scheduling guarantee; raise it for batch-style workloads.
     */
    maxJobsPerFrame: number = 1

    get queuedJobs(): number {
        return this.queue.length
    }

    onUpdate(time: number): void {
        // Cap at the queue length at the start of the frame so re-queued
        // long-running jobs cannot consume a second budget slot in the same
        // frame. Each unique job is advanced at most once per frame.
        let budget = Math.min(this.maxJobsPerFrame, this.queue.length)
        while (budget-- > 0 && this.queue.length > 0) {
            const job = this.queue.shift()!
            let signal: boolean | void
            try {
                signal = job.onUpdate(time)
            } catch (error) {
                job.onTerminate(error)
                continue
            }
            if (signal === true) {
                job.onComplete()
            } else {
                this.queue.push(job)
            }
        }
    }

    onDestroy(): void {
        while (this.queue.length > 0) {
            const job = this.queue.pop()!
            job.onTerminate()
        }
    }

    run<P, T extends Job<P>>(jobClass: JobClass<T, P>, payload?: P): T {
        const job = new jobClass(this.scene, payload as P)
        if (job.type !== this.eventType) {
            throw new Error(`provided job must be an instance of Job class`)
        }
        job.onCreate()
        this.queue.push(job as Job<unknown>)
        return job
    }

}
