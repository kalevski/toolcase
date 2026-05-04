import type Scene from '../engine/Scene'
import type FlowEngine from './FlowEngine'

export default class TimeEvent {

    protected readonly scene: Scene

    protected readonly flow: FlowEngine

    constructor(scene: Scene) {
        this.scene = scene
        this.flow = scene.flow
    }

    onCreate(): void {}

    onFire(_times: number): void {}

    onDestroy(): void {}

    get type(): string {
        return 'time_event'
    }

}
