import { Flow, Perspective2D, Structs } from '@toolcase/phaser-plus'
import TestCollider from '../events/TestCollider'
import Barrel from '../prefabs/Barrel'
import Barrel2 from '../prefabs/Barrel2'

class MajorUpdate extends Perspective2D.Scene2D {

    /**
     * @type {Barrel}
     */
    barrel = null

    onInit() {
        
    }

    onLoad() {
        this.load.atlas('objects', [
            '/assets/objects/objects.png',
            '/assets/objects/objects_n.png'
        ], '/assets/objects/objects.json')
    }
    
    onCreate() {
        this.world.drawGrid()
        this.world.projection = Structs.Matrix2.create(100, 100)

        this.world.register('barrel', Barrel)
        this.world.register('barrel2', Barrel2)


        this.world.add('barrel2', 0, -10)

        this.barrel = this.world.add('barrel', 0, 0)
        this.world.camera.startFollow(this.barrel)

        this.flow.physics.add('test_collider', TestCollider)
    }

    onDestroy() {

    }

}

export default MajorUpdate