import Scene from '../base/Scene'
import World from './World'
import LayerUI from './LayerUI'

class Scene2D extends Scene {

    /**
     * @protected
     * @type {LayerUI}
     */
    ui = null

    /**
     * @protected
     * @type {World}
     */
    world = null

    /** @private */
    beforeInit() {
        this.world = this.features.register('world', World)
        this.ui = this.features.register('ui', LayerUI)
    }

}

export default Scene2D