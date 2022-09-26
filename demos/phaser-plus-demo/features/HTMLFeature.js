import React from 'react'
import { DOMFeature } from '@toolcase/phaser-plus'

class HTMLState {
    property = 1
}

/** @extends {DOMFeature<HTMLState>} */
class HTMLFeature extends DOMFeature {

    onStateInit() {
        return new HTMLState()
    }

    onMount() {
        this.logger.info('mount')
    }

    onRender() {
        return <>
            <p style={{ color: 'white' }}>{this.state.property}</p>
        </>
    }

}

export default HTMLFeature