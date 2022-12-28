import { Broadcast } from '@toolcase/base'
import { Game } from 'phaser'
import Scene from '../base/Scene'

class Panel extends Broadcast {

    /**
     * @protected
     * @type {Scene}
     */
    scene = null

    /**
     * @protected
     * @type {Game}
     */
    game = null

    /**
     * @protected
     * @type {import('@tweakpane/core/dist/cjs/blade/common/api/blade-rack').BladeRackApi}
     */
    base = null

    /** @private */
    _hidden = false

    /**
     * 
     * @param {Scene} scene 
     * @param {import('@tweakpane/core/dist/cjs/blade/common/api/blade-rack').BladeRackApi} base 
     * @param {Whiteboard} whiteboard 
     */
    constructor(scene, base) {
        super()
        this.scene = scene
        this.game = scene.game
        this.base = base
    }

    /** @protected */
    draw() {}

    /** @protected */
    doUpdate() {}

    /** @protected */
    dispose() {}

}

export default Panel