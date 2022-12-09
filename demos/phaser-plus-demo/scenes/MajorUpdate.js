import { Perspective2D, Structs } from '@toolcase/phaser-plus'
import { Math } from 'phaser'
import Barrel from '../prefabs/Barrel'

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
        this.world.projection = Structs.Matrix2.createISO(32)

        this.world.register('barrel', Barrel)

        

        this.barrel = this.world.add('barrel', 0, 0)
        this.world.camera.startFollow(this.barrel)
    }

    update(time, delta) {
        super.update(time, delta)
    }

    onDestroy() {

    }

}

export default MajorUpdate