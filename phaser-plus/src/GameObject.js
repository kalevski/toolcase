import { Game } from 'phaser'
import { generateId } from '@toolcase/base'
import Scene from './Scene'
import Container from './Container'

class GameObject extends Container {

    /**
     * 
     * @param {Scene} scene 
     */
    constructor(scene) {
        super(scene)
        this.scene = scene
    }

    /** @protected */
    onCreate() {}

    /**
     * @protected
     * @param {GameObject} parent 
     */
    onAdd(parent) {}

    /** 
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {}

    /**
     * @protected
     * @param {GameObject} parent 
     */
    onRemove(parent) {}

    /** @protected */
    onDestroy() {}

    /**
     * @override
     * @param {GameObject} child 
     */
    add(child) {
        super.add(child)
        if (child instanceof GameObject) {
            child.setVisible(true)
            child.onAdd(this)
        }
        return this
    }

    /**
     * @override
     * @param {GameObject} child 
     * @param {boolean} destroyChild 
     */
    remove(child, destroyChild = false) {
        if (child instanceof GameObject) {
            child.setVisible(false)
            child.onRemove(this)
        }
        return super.remove(child, destroyChild)
    }

    /**
     * @private
     */
    preDestroy() {
        this.onDestroy()
        super.preDestroy()
    }

    /**
     * @override
     * @param {boolean} destroyChild 
     * @returns 
     */
    removeAll(destroyChild = false) {
        this.each(child => {
            if (child instanceof GameObject) {
                child.onRemove(this)
            }
        })
        return super.removeAll(destroyChild)
    }

    /**
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

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     */
    contains(x, y) {
        return false
    }

}

export default GameObject