import type { Logger } from '@toolcase/logging'
import type Scene from '../engine/Scene'
import type FlowProcessor from './FlowProcessor'
import EventProcessor from './EventProcessor'
import TimeEventProcessor from './TimeEventProcessor'
import CollisionEventProcessor from './CollisionEventProcessor'
import JobProcessor from './JobProcessor'

type ProcessorClass<T extends FlowProcessor> = new (scene: Scene, eventType: string) => T

export default class FlowEngine {

    active: boolean = true

    protected readonly scene: Scene

    protected readonly logger: Logger

    private readonly processors: FlowProcessor[] = []

    private readonly processorMap: Map<string, FlowProcessor> = new Map()

    readonly events: EventProcessor

    readonly timer: TimeEventProcessor

    readonly jobs: JobProcessor

    readonly physics: CollisionEventProcessor | null

    constructor(scene: Scene) {
        this.scene = scene
        this.logger = scene.engine.getLogger('flow')
        this.events = this.addProcessor('event', EventProcessor)
        this.timer = this.addProcessor('time_event', TimeEventProcessor)
        this.jobs = this.addProcessor('job', JobProcessor)
        this.physics = (scene as any).matter !== undefined
            ? this.addProcessor('collision_event', CollisionEventProcessor)
            : null
    }

    addProcessor<T extends FlowProcessor>(eventType: string, processorClass: ProcessorClass<T>): T {
        if (typeof eventType !== 'string') {
            throw new Error(`event type must be a string, ${typeof eventType} provided`)
        }
        const existing = this.getProcessor<T>(eventType)
        if (existing !== null) {
            this.logger.warning(`event type: ${eventType} already has a processor`)
            return existing
        }
        const processor = new processorClass(this.scene, eventType)
        processor.onCreate()
        this.processors.push(processor)
        this.processorMap.set(eventType, processor)
        return processor
    }

    getProcessor<T extends FlowProcessor>(eventType: string): T | null {
        return (this.processorMap.get(eventType) as T | undefined) ?? null
    }

    destroy(): void {
        while (this.processors.length > 0) {
            const processor = this.processors.pop()!
            processor.onDestroy()
        }
        this.processorMap.clear()
    }

    /** @internal */
    doUpdate(time: number, delta: number): void {
        if (!this.active) return
        for (const processor of this.processors) {
            processor.onUpdate(time, delta)
        }
    }

}
