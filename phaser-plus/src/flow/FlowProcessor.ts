import type Scene from '../engine/Scene'

export default class FlowProcessor {

    protected readonly scene: Scene

    readonly eventType: string

    constructor(scene: Scene, eventType: string) {
        this.scene = scene
        this.eventType = eventType
    }

    onCreate(): void {}

    onUpdate(_time: number, _delta: number): void {}

    onDestroy(): void {}

}
