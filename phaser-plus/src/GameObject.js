import { GameObjects } from 'phaser'
import { generateId } from '@toolcase/base'
import Scene from './Scene'

class GameObject extends GameObjects.Container {

    id = generateId(12)

    /** @type {Scene} */
    scene = null

    /**
     * 
     * @param {Scene} scene 
     */
    constructor(scene) {
        super(scene)
    }

    /** @protected */
    onCreate() {}

    /** @protected */
    onUpdate(time, delta) {}

    /** @protected */
    onDestroy() {}

}

export default GameObject