import { AdjacencyMatrix } from '@toolcase/base'
import type { Logger } from '@toolcase/logging'
import { Physics } from 'phaser'
import CollisionEvent from './CollisionEvent'
import FlowProcessor from './FlowProcessor'

type MatterBody = Phaser.Types.Physics.Matter.MatterBody | MatterJS.BodyType
type CollisionEventClass<T extends CollisionEvent> = new (scene: import('../Scene').default) => T

export default class CollisionEventProcessor extends FlowProcessor {

    private readonly eventMap: Map<string, CollisionEvent> = new Map()

    private logger!: Logger

    private matrix!: AdjacencyMatrix<string | null, string | null>

    onCreate(): void {
        this.logger = this.scene.engine.getLogger('collision events')
        this.matrix = new (AdjacencyMatrix as any)(null, null)
        const matter = (this.scene as any).matter
        matter.world.on(Physics.Matter.Events.COLLISION_START, this.onCollisionEnter, this)
        matter.world.on(Physics.Matter.Events.COLLISION_END, this.onCollisionExit, this)
    }

    onUpdate(_time: number, _delta: number): void {}

    onDestroy(): void {
        for (const key of Array.from(this.eventMap.keys())) {
            this.remove(key)
        }
    }

    add<T extends CollisionEvent>(eventName: string, collisionEventClass: CollisionEventClass<T>): this {
        if (this.eventMap.has(eventName)) {
            this.logger.warning(`collision event=${eventName} is already registered`)
            return this
        }
        const event = new collisionEventClass(this.scene)
        if (event.type !== this.eventType) {
            this.logger.warning(`provided event with type ${event.type}, ${this.eventType} is acceptable`)
            return this
        }
        this.eventMap.set(eventName, event)
        event.onCreate()
        return this
    }

    remove(eventName: string): this {
        const event = this.eventMap.get(eventName)
        if (event !== undefined) {
            event.onDestroy()
            this.eventMap.delete(eventName)
        } else {
            this.logger.warning(`collision event name=${eventName} is not registered`)
        }
        return this
    }

    has(eventName: string): boolean {
        return this.eventMap.has(eventName)
    }

    setCollision(labelA: string, labelB: string, eventName: string): this {
        if (!this.eventMap.has(eventName)) {
            this.logger.warning(`[setCollision] event name=${eventName} does not exist`)
            return this
        }
        this.matrix.addVertex(labelA)
        this.matrix.addVertex(labelB)
        this.matrix.addEdge(labelA, labelB, eventName)
        this.matrix.addEdge(labelB, labelA, eventName)
        return this
    }

    removeCollision(labelA: string, labelB: string): this {
        this.matrix.removeEdge(labelA, labelB)
        this.matrix.removeEdge(labelB, labelA)
        return this
    }

    private onCollisionEnter(event: Physics.Matter.Events.CollisionStartEvent, bodyA: MatterBody, bodyB: MatterBody): void {
        const eventName = this.matrix.getEdge((bodyA as any).label, (bodyB as any).label)
        if (eventName === null) return
        const collisionEvent = this.eventMap.get(eventName) ?? null
        if (collisionEvent === null) {
            this.logger.warning(`[on collision enter] event ${eventName} is not registered`)
            return
        }
        collisionEvent.onEnter(bodyA, bodyB, event)
    }

    private onCollisionExit(event: Physics.Matter.Events.CollisionEndEvent, bodyA: MatterBody, bodyB: MatterBody): void {
        const eventName = this.matrix.getEdge((bodyA as any).label, (bodyB as any).label)
        if (eventName === null) return
        const collisionEvent = this.eventMap.get(eventName) ?? null
        if (collisionEvent === null) {
            this.logger.warning(`[on collision exit] event ${eventName} is not registered`)
            return
        }
        collisionEvent.onExit(bodyA, bodyB, event)
    }

}
