import { generateId } from '@toolcase/base'
import Feature from './Feature'
import GameObject from './GameObject'

class Layer extends Feature {

    /** @private */
    CAMERA_NAME = generateId(16)

    /**
     * @protected
     * @type {GameObject}
     */
    container = null

    /** @protected */
    onCreate() {
        if (this.scene.cameras.main.name === '') {
            this.scene.cameras.main.setName(this.CAMERA_NAME)
        } else {
            const { width, height } = this.game.config
            this.scene.cameras.add(0, 0, width, height, false, this.CAMERA_NAME)
        }

        this.camera.centerOn(0, 0)

        this.container = new GameObject(this.scene, 0, 0)
        this.scene.add.existing(this.container)
    }

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {
        let cameraId = this.camera.id
        let filter = 0
        for (let camera of this.scene.cameras.cameras) {
            if (camera.id === cameraId) continue
            filter |= camera.id
        }
        this.container.cameraFilter = filter
    }

    /** @protected */
    onDestroy() {
        this.container.destroy()
        this.container = null
        
        if (this.camera.id === this.scene.cameras.main.id) {
            this.camera.setName('')
        } else {
            this.scene.cameras.remove(this.camera)
        }
    }

    get camera() {
        return this.scene.cameras.getCamera(this.CAMERA_NAME)
    }

}

export default Layer