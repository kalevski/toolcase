import Feature from './Feature'
import Scene from './Scene'

/**
 * @template T
 */
 class DOMFeature extends Feature {

    /**
     * @private
     * @type {HTMLDivElement}
     */
    _node = null

    /**
     * 
     * @param {Scene} scene 
     * @param {Object<string,any>} options 
     * @param {string} key 
     */
    constructor(scene, options, key) {
        super(scene, options, key)
        let container = this.game.domContainer
        if (container === null) {
            throw new Error('dom container is not enabled, enable by setting dom.createContainer inside config')
        }
        DOMFeature.setup()
        this._node = globalThis.document.createElement('div')
        this._node.setAttribute('id', `feature-${key}`)
        this._node.classList.add('dom-feature')
        this._node.classList.add(`feature-${key}`)
        container.append(this._node)
    }

    get node() {
        return this._node
    }

    preDestroy() {
        this._node.remove()
        this._node = null
        super.preDestroy()
    }

}

DOMFeature.setup = () => {
    let style = document.getElementById('@toolcase/phaser-plus')
    if (style !== null) {
        return null
    }
    style = document.createElement('style')
    style.id = '@toolcase/phaser-plus'
    style.innerHTML = `
    .dom-feature {
        pointer-events: none;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }
    .dom-feature * {
        pointer-events: auto;
        user-select: none;
    }`
    document.head.append(style)
}

export default DOMFeature