import { generateId } from '@toolcase/base'
import { Game, GameObjects } from 'phaser'
import Scene from './Scene'

class GameObject extends GameObjects.Container {

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
     * @readonly
     * @type {string}
     */
    id = null

    /**
     * 
     * @param {Scene} scene 
     * @param {number} x 
     * @param {number} y 
     */
    constructor(scene, x, y) {
        super(scene, x, y)
        this.game = scene.game
        this.id = generateId(16)
    }

    /** @protected */
    onCreate() {}

    /**
     * @protected
     * @param {GameObjects.GameObject} parent 
     */
    onAdd(parent) {}

    /**
     * 
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {}

    /**
     * @protected
     * @param {GameObjects.GameObject} parent 
     */
    onRemove(parent) {}

    /** @protected */
    onDestroy() {}

    /** @private */
    preDestroy() {
        this.onDestroy()
        super.preDestroy()
    }

    /**
     * @override
     * @param {GameObjects.GameObject | Array<GameObjects.GameObject>} child 
     */
    add(child) {
        super.add(child)
        if (Array.isArray(child)) {
            for (let entity of child) {
                if (entity instanceof GameObject) {
                    entity.onAdd(this)
                }
            }
        } else {
            if (child instanceof GameObject) {
                child.onAdd(this)
            }
        }
        return this
    }

    /**
     * @override
     * @param {GameObjects.GameObject | Array<GameObjects.GameObject>} child 
     * @param {boolean} [destroyChild] 
     */
    remove(child, destroyChild = false) {
        if (Array.isArray(child)) {
            for (let entity of child) {
                if (entity instanceof GameObject) {
                    entity.onRemove(this)
                }
            }
        } else {
            if (child instanceof GameObject) {
                child.onRemove(this)
            }
        }
        return super.remove(child, destroyChild)
    }

    /**
     * @override
     * @param {boolean} [destroyChild] 
     */
    removeAll(destroyChild = false) {
        for (let child of this.list) {
            if (child instanceof GameObject) {
                child.onRemove(this)
            }
        }
        return super.removeAll(destroyChild)
    }

    /**
     * 
     * @param {number} time 
     * @param {number} delta 
     */
    doUpdate(time, delta) {
        this.onUpdate(time, delta)
        for (let child of this.list) {
            if (child instanceof GameObject) {
                child.doUpdate(time, delta)
            }
        }
    }

}



export default GameObject