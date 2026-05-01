import type { Logger } from '@toolcase/logging'
import { Scene as PhaserScene, Scenes } from 'phaser'
import GameObject from './GameObject'
import Engine from './Engine'
import FeatureRegistry from '../features/FeatureRegistry'
import type ServiceRegistry from '../features/ServiceRegistry'
import GameObjectPool from '../pool/GameObjectPool'
import FlowEngine from '../flow/FlowEngine'
import { LAYER_DEPTH_UPDATE } from './Events'
import { CAMERA_DEPTH } from '../features/Layer'

export default class Scene extends PhaserScene {

    engine!: Engine

    services!: ServiceRegistry

    features!: FeatureRegistry

    flow!: FlowEngine

    pool!: GameObjectPool

    protected logger!: Logger

    private layerSortFlag: boolean = false

    /** @protected */
    onInit(): void {}

    /** @protected */
    onLoad(): void {}

    /** @protected */
    onCreate(): void {}

    /**
     * Per-frame user hook. Runs after features and game-object updates,
     * before the flow engine ticks.
     */
    onUpdate(_time: number, _delta: number): void {}

    /** @protected */
    onDestroy(): void {}

    goTo(key: string, payload?: Record<string, any> | null): void {
        const data = (payload && typeof payload === 'object') ? payload : null
        this.doDestroy()
        this.scene.stop()
        this.game.scene.start(key, data)
    }

    restart(payload?: Record<string, any>): void {
        this.goTo(this.scene.key, payload)
    }

    pause(): this {
        this.scene.pause()
        return this
    }

    resume(): this {
        this.scene.resume()
        return this
    }

    get payload(): Record<string, any> {
        const data = this.scene.settings.data as unknown
        return (typeof data === 'object' && data !== null) ? (data as Record<string, any>) : {}
    }

    /** @protected */
    protected beforeInit(): void {}

    init(): void {
        this.engine = this.initializeEngine()
        this.events.once(Scenes.Events.DESTROY, this.doDestroy, this)
        this.logger = this.engine.getLogger(`scene=${this.scene.key}`)
        this.services = this.engine.services
        this.features = new FeatureRegistry(this)
        this.pool = new GameObjectPool(this)
        this.flow = new FlowEngine(this)
        this.logger.info('initialized')

        this.features.on(LAYER_DEPTH_UPDATE, this.onLayerDepthUpdate, this)

        this.beforeInit()
        this.onInit()
    }

    preload(): void {
        this.onLoad()
    }

    create(): void {
        this.onCreate()
    }

    update(time: number, delta: number): void {
        if (this.layerSortFlag) {
            this.cameras.cameras.sort(this.compareCamerasFn)
            this.layerSortFlag = false
        }
        this.features.doUpdate(time, delta)
        for (const child of this.children.list) {
            if (child instanceof GameObject) {
                child.doUpdate(time, delta)
            }
        }
        this.onUpdate(time, delta)
        this.flow.doUpdate(time, delta)
    }

    private onLayerDepthUpdate(): void {
        this.layerSortFlag = true
    }

    private compareCamerasFn(cameraA: Phaser.Cameras.Scene2D.Camera, cameraB: Phaser.Cameras.Scene2D.Camera): number {
        const a = CAMERA_DEPTH.get(cameraA) ?? 0
        const b = CAMERA_DEPTH.get(cameraB) ?? 0
        return a - b
    }

    private doDestroy(): void {
        this.features.off(LAYER_DEPTH_UPDATE, this.onLayerDepthUpdate, this)
        this.onDestroy()
        this.features.destroyAll()
        this.flow.destroy()
        this.pool.dispose()
    }

    private initializeEngine(): Engine {
        const game = this.game as Phaser.Game & { engine?: Engine }
        if (game.engine instanceof Engine) {
            return game.engine
        }
        game.engine = new Engine()
        return game.engine
    }

}
