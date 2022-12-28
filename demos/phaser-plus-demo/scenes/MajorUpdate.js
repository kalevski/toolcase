import { Flow, Perspective2D, Structs } from '@toolcase/phaser-plus'
import MyEvent from '../events/MyEvent'
import TestCollider from '../events/TestCollider'
import DOMExample from '../features/DOMExample'
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
        this.world.debug()
        this.world.projection = Structs.Matrix2.create(100, 100)

        this.features.register('dom', DOMExample)

        this.world.register('barrel', Barrel)
        this.world.register('barrel2', Barrel2)


        this.world.add('barrel2', 0, -10)

        this.barrel = this.world.add('barrel', 0, 0)
        this.barrel.setName('barrel')

        this.flow.physics.createEvent('test', TestCollider)
        this.flow.physics.setCollision('barrel1', 'barrel2', 'test')

        this.flow.events.add('manual', MyEvent)

        this.flow.events.triggerFn(this.destroyObject, 2, this)

    }

    destroyObject() {
        // this.world.remove(this.barrel)
    }

    onDestroy() {

    }

}

export default MajorUpdate