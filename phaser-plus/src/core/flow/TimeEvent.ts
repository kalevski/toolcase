import type Scene from '../Scene'
import type FlowEngine from './FlowEngine'

export default class TimeEvent {

    protected readonly scene: Scene

    protected readonly flow: FlowEngine

    constructor(scene: Scene) {
        this.scene = scene
        this.flow = scene.flow
    }

    onCreate(): void {}

    onFire(times: number): void {}

    onDestroy(): void {}

    get type(): string {
        return 'time_event'
    }

}
