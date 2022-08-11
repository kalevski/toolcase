import React, { Component } from 'react'
import { createRoot } from 'react-dom/client'
import Feature from './Feature'

/**
 * @template T
 */
 class DOMFeature extends Feature {

    /**
     * @callback StateCallback
     * @returns {void}
     */

    /**
     * @private
     * @type {HTMLDivElement}
     */
    node = null

    /**
     * @private
     * @type {import('react-dom/client').Root}
     */
    reactRoot = null

    /**
     * @private
     */
    jsxRef = React.createRef()

    /**
     * @returns {T}
     */
    get state() {
        if (this.jsxRef.current === null) {
            return null
        } else {
            return this.jsxRef.current.state
        }
    }

    /**
     * @private
     * @returns {void}
     */
    onCreate() {
        if (this.game.domContainer === null) {
            this.logger.error('DOMFeature works only with domContainer enabled')
            return
        }
        
        this.node = window.document.createElement('div')
        this.node.id = this.key
        this.node.classList.add('html-feature')

        this.game.domContainer.append(this.node)

        const JSXComponent = class JSXComponent extends Component {
            constructor(props) {
                super(props)
                this.state = props.nodeState
                this.render = props.onRender
            }
            
        }

        let nodeState = this.onStateInit()

        this.reactRoot = createRoot(this.node)
        this.reactRoot.render(<JSXComponent ref={this.jsxRef} nodeState={nodeState} onRender={() => {
            if (this.state === null){
                return <></>
            } else {
                return this.onRender()
            }
        }} />)
        setTimeout(() => {
            this.setState(nodeState)
            this.onMount()
        })

    }

    /** @private */
    onDestroy() {
        this.onUnmount()
        this.reactRoot.unmount()
        this.node.remove()
    }



    /**
     * 
     * @param {T} state 
     * @param {StateCallback} callback 
     */
    setState(state, callback) {
        this.jsxRef.current.setState(state, callback)
    }

    /**
     * @protected
     * @returns {T}
     */
    onStateInit() {
        return {}
    }

    /**
     * @protected
     */
    onRender() {}

    /** @protected */
    onMount() {}

    /** @protected */
    onUnmount() {}

}

DOMFeature.setup = () => {
    let style = document.getElementById('@toolcase/phaser-plus')
    if (style !== null) {
        return null
    }
    style = document.createElement('style')
    style.id = '@toolcase/phaser-plus'
    style.innerHTML = `
    .html-feature {
        pointer-events: none;
        width: 100%;
        height: 100%;
        overflow: hidden;
    }
    .html-feature * { pointer-events: auto; }
        user-select: none;
    `
    document.head.append(style)
}

export default DOMFeature