import { Features, Perspective2D, Structs } from '@toolcase/phaser-plus'
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
        this.world.projection = Structs.Matrix2.create(100, 100, 11)

        this.features.register('dom', DOMExample)

        this.features.register('debugger', Features.Debugger)
        this.world.register('barrel', Barrel)
        this.world.register('barrel2', Barrel2)
        
        
        // this.world.add('barrel2', 0, -10)
        
        this.world.add('barrel', 0, 0).setName('barrel1')
        this.world.add('barrel', 0, 1).setName('barrel2')
        this.world.add('barrel', 1, 0).setName('barrel3')
        this.world.add('barrel', 1, 1).setName('barrel4')
        
        this.flow.physics.createEvent('test', TestCollider)
        this.flow.physics.setCollision('barrel1', 'barrel2', 'test')
        
        this.flow.events.add('manual', MyEvent)        
    }

    onDestroy() {

    }

}

export default MajorUpdate