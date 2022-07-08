import { GameObject, ISO } from '@toolcase/phaser-plus'

class Barrel extends ISO.ISOGameObject {

    /** @type {GameObjects.Image} */
    base = null

    onCreate() {

        this.base = this.scene.add.image(0, -50, 'objects', 'barrel_vertical')
            // .setPipeline('Light2D')
        this.add(this.base)

        let shape = this.scene.cache.json.get('object_physics')

        this.scene.matter.add.gameObject(this, {
            shape: shape.barrel,
            frictionAir: 1.7
        }, true)
        this.setFixedRotation()

        // this.setSensorPoint('action:take', 0, -40)

        // super.onCreate()
    }

}

export default Barrel