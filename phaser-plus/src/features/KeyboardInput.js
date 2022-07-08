import { Input } from 'phaser'
import Feature from '../Feature'

class KeyboardInput extends Feature {

    /**
     * @type {Object<string, Input.Keyboard.Key>}
     */
    keys = {}

    /** @private */
    moveState = {
        UP: false,
        DOWN: false,
        LEFT: false,
        RIGHT: false
    }

    /**
     * @private
     * @type {string}
     */
     moveHash = JSON.stringify(this.moveState)

    /** @protected */
    onCreate() {
        const [ UP = 'W', DOWN = 'S', LEFT = 'A', RIGHT = 'D' ] = this.options.movement || []
        const ACTION = this.options.action || 'F'
        this.keys.UP = this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes[UP])
        this.keys.DOWN = this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes[DOWN])
        this.keys.LEFT = this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes[LEFT])
        this.keys.RIGHT = this.scene.input.keyboard.addKey(Input.Keyboard.KeyCodes[RIGHT])

        this.scene.input.keyboard.on(`keydown-${ACTION}`, this.onAction, this)
    }
    
    /** @protected */
    onUpdate() {
        this.moveState.UP = this.keys.UP.isDown
        this.moveState.DOWN = this.keys.DOWN.isDown
        this.moveState.LEFT = this.keys.LEFT.isDown
        this.moveState.RIGHT = this.keys.RIGHT.isDown

        let moveHash = JSON.stringify(this.moveState)
        if (this.moveHash !== moveHash) {
            this.dispatch(KeyboardInput.Events.MOVE, this.moveState)
            this.moveHash = moveHash
        }


    }

    /** @protected */
    onDestroy() {
        // TODO: dispose
    }

    onAction() {
        console.log('here ?')
        this.dispatch(KeyboardInput.Events.ACTION)
    }

}

KeyboardInput.Events = {
    MOVE: 'MOVE',
    ACTION: 'ACTION'
}

export default KeyboardInput