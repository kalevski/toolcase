import ObjectLayer from '../features/ObjectLayer'
import Scene from '../engine/Scene'
import World from './World'

export default class Scene2D extends Scene {

    protected ui!: ObjectLayer

    protected world!: World

    protected override beforeInit(): void {
        this.world = this.features.register('world', World)
        this.ui = this.features.register('ui', ObjectLayer)
    }

}
