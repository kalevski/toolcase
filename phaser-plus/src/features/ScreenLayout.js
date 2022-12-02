import { GameObjects } from 'phaser'
import Feature from '../Feature'

class ScreenLayout extends Feature {

    /**
     * @readonly
     * @type {GameObjects.Container}
     */
    ui = null

    

    /** @private */
    onCreate() {
        this.ui = this.scene.add.container()

        const { width, height } = this.game.config

        this.scene.cameras.main.setName('A')
        this.scene.cameras.add(0, 0, width, height, false, 'UI')

        this.scene.cameras.getCamera('UI').ignore(this)
        this.scene.cameras.getCamera('A').ignore(this.ui)

        this.mainCamera.setScroll(-width / 2, -height / 2)
        this.UICamera.setScroll(-width / 2, -height / 2)

        if (typeof this.scene.matter.world.debugGraphic !== 'undefined') {
            this.UICamera.ignore(this.scene.matter.world.debugGraphic)
        }
    }

    /** @private */
    onDestroy() {

    }

    get mainCamera() {
        return this.scene.cameras.getCamera('A')
    }

    get UICamera() {
        return this.scene.cameras.getCamera('UI')
    }

}

export default ScreenLayout