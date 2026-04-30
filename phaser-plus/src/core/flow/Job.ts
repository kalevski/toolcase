import type Scene from '../Scene'
import type FlowEngine from './FlowEngine'

export default class Job<P = unknown> {

    protected readonly scene: Scene

    protected readonly flow: FlowEngine

    protected payload: P

    constructor(scene: Scene, payload: P) {
        this.scene = scene
        this.flow = scene.flow
        this.payload = payload
    }

    get type(): string {
        return 'job'
    }

    /**
     * Called once per processor tick. Return `true` when the job is finished
     * so the processor stops re-queuing it.
     */
    onUpdate(time: number): boolean | void {
        return false
    }

    onCreate(): void {}

    onComplete(): void {}

    onTerminate(error?: unknown): void {}

}
