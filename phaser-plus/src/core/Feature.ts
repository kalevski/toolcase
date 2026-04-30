import type { Logger } from '@toolcase/logging'
import type { Game } from 'phaser'
import type Scene from './Scene'

export default class Feature {

    protected readonly scene: Scene

    protected readonly game: Game

    readonly key: string

    protected readonly logger: Logger

    constructor(scene: Scene, key: string) {
        this.scene = scene
        this.game = scene.game
        this.key = key
        this.logger = scene.engine.getLogger(`feature=${key}`)
    }

    onCreate(): void {}

    onUpdate(_time: number, _delta: number): void {}

    preDestroy(): void {}

    onDestroy(): void {}

    /**
     * Emit a feature event. Warns when no listener is registered.
     */
    protected emit(event: string, ...messages: unknown[]): void {
        const events = this.scene.features as unknown as { listenerCount(name: string): number, emit(name: string, ...args: unknown[]): boolean }
        if (events.listenerCount(event) === 0) {
            this.logger.warning(`event=(${event}) is not handled, payload sent:`, ...messages)
            return
        }
        events.emit(event, ...messages)
    }

}
