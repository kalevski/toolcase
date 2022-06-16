import GameObject from './GameObject'
import Scene from './Scene'

class Feature extends GameObject {

    /**
     * @protected
     * @type {Object<string,any>}
     */
    options = null

    /**
     * 
     * @param {Scene} scene 
     * @param {Object<string,any>} options 
     */
    constructor(scene, options = {}) {
        super(scene)
        this.options = options
    }

    /**
     * @protected
     * @param {string} eventName 
     * @param  {...any} messages 
     */
    dispatch(eventName, ...messages) {
        this.scene.flow.dispatch(eventName, ...messages)
    }
}

export default Feature