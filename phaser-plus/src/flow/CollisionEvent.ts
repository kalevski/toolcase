import type { Physics } from 'phaser'
import type Scene from '../engine/Scene'
import type FlowEngine from './FlowEngine'

type MatterBody = Phaser.Types.Physics.Matter.MatterBody | MatterJS.BodyType

export default class CollisionEvent {

    protected readonly scene: Scene

    protected readonly flow: FlowEngine

    constructor(scene: Scene) {
        this.scene = scene
        this.flow = scene.flow
    }

    onCreate(): void {}

    onEnter(_bodyA: MatterBody, _bodyB: MatterBody, _event: Physics.Matter.Events.CollisionStartEvent): void {}

    onExit(_bodyA: MatterBody, _bodyB: MatterBody, _event: Physics.Matter.Events.CollisionEndEvent): void {}

    onDestroy(): void {}

    get type(): string {
        return 'collision_event'
    }

}
