import { Broadcast } from '@toolcase/base'
import type { Game } from 'phaser'
import type Scene from '../engine/Scene'

export type PanelHost = any

type Listener = (...args: any[]) => void

export default class Panel extends Broadcast {

    protected readonly scene: Scene

    protected readonly game: Game

    protected readonly base: PanelHost

    constructor(scene: Scene, base: PanelHost) {
        super()
        this.scene = scene
        this.game = scene.game
        this.base = base
    }

    draw(): void {}

    doUpdate(): void {}

    dispose(): void {}

    /** @internal */
    public override emit(event: string, ...messages: any[]): boolean {
        return super.emit(event, ...messages)
    }

}
