import Feature from './Feature'
import type Scene from '../engine/Scene'

const STYLE_ID = '@phaser-plus/reef/dom'

let stylesInjected = false

function injectStylesOnce(): void {
    if (stylesInjected) return
    if (document.getElementById(STYLE_ID) !== null) {
        stylesInjected = true
        return
    }
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.innerHTML = `
    .html-feature {
        pointer-events: none;
        width: 100%;
        height: 100%;
        overflow: hidden;
        position: absolute;
    }
    .html-feature * {
        pointer-events: auto;
        user-select: none;
    }`
    document.head.append(style)
    stylesInjected = true
}

export default class HTMLFeature extends Feature {

    private _node: HTMLDivElement

    constructor(scene: Scene, key: string) {
        super(scene, key)
        const container = (this.game as Phaser.Game & { domContainer?: HTMLElement | null }).domContainer
        if (!container) {
            throw new Error('dom container is not enabled, set dom.createContainer in your game config')
        }
        injectStylesOnce()
        this._node = window.document.createElement('div')
        this._node.setAttribute('id', `feature-${key}`)
        this._node.classList.add('html-feature')
        this._node.classList.add(`feature-${key}`)
        container.append(this._node)
    }

    get node(): HTMLDivElement {
        return this._node
    }

    override preDestroy(): void {
        super.preDestroy()
        this._node.remove()
    }

}
