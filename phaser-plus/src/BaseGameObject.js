import logging from '@toolcase/logging'
import { GameObjects } from 'phaser'
import Scene from './Scene'

class BaseGameObject extends GameObjects.Container {

    /**
     * @private
     * @type {GameObjects.DOMElement}
     */
    baseHTML = null

    /**
     * 
     * @param {Scene} scene 
     * @param {number} x 
     * @param {number} y 
     */
    constructor(scene, x, y) {
        super(scene, x, y)
        if (this.scene.game.config.domCreateContainer) {
            this.baseHTML = this.scene.add.dom(0, 0, 'div')
            this.baseHTML.setOrigin(0)
            this.baseHTML.setClassName('base-html-element')
            this.add(this.baseHTML)
        }
    }

    /**
     * 
     * @param {string | HTMLElement} element 
     */
    setHTML(element) {
        if (this.baseHTML === null) {
            logging.getLogger('base game object').warning('enable DOM feature to use setHTML')
            return this
        }
        if (element instanceof HTMLElement) {
            this.baseHTML.node.innerHTML = ''
            this.baseHTML.node.appendChild(element)
        } else if (typeof element === 'string') {
            this.baseHTML.node.innerHTML = element
        }
        return this
    }



}

export default BaseGameObject