import { Scene, Features, Perspective2D, Flow, Structs } from '@toolcase/phaser-plus'
import GameUI from '../features/GameUI'
import HTMLFeature from '../features/HTMLFeature'
import Barrel from '../prefabs/Barrel'
import TestChildObject from '../prefabs/TestChildObject'
import TestObject from '../prefabs/TestObject'

class World extends Scene {

    inputs = {
        /** @type {Features.KeyboardInput} */
        A: null,
        /** @type {Features.KeyboardInput} */
        B: null
    }
    
    /** @type {Perspective2D.World} */
    world = null
    
    /** @type {Features.SplitScreen} */
    screen = null
    
    /** @type {GameUI} */
    ui = null
    
    onCreate() {
        let debug = this.features.register('debug', Perspective2D.DebugGrid)
        this.pool.register('test', TestObject)
        this.pool.register('child_test', TestChildObject)

        let sensorProcessor = new Flow.MatterJSProcessor(this.matter.world)
        this.flow.setSensorProcessor(sensorProcessor)
        
        this.inputs.A = this.features.register('input_A', Features.KeyboardInput, {
            movement: [ 'W', 'S', 'A', 'D' ],
            action: 'F'
        })
        
        this.inputs.A = this.features.register('input_B', Features.KeyboardInput, {
            movement: ['UP', 'DOWN', 'LEFT', 'RIGHT'],
            action: 'ENTER'
        })
        
        this.world = this.features.register('world', Perspective2D.World, {
            projection: Structs.Matrix2.create(64, 64)
        })
        
        
        

        this.screen = this.features.register('screen', Features.SplitScreen)
        this.ui = this.features.register('ui', GameUI)

        debug.draw(this.world.projection)
        this.screen.cameras.ui.ignore(debug)
        

        this.features.register('html', HTMLFeature)

        this.screen.cameras.A.ignore(this.ui)
        this.screen.cameras.B.ignore(this.ui)
        this.screen.cameras.ui.ignore(this.world)

        this.world.objects.register('barrel', Barrel)

        // this.screen.cameras.A.setZoom(.2)
        

        let distance = 2

        let barrelA = this.world.objects.add('barrel', -distance, -distance)
        let barrelB = this.world.objects.add('barrel', distance, distance)
        let barrelC = this.world.objects.add('barrel', -distance, distance)
        let barrelD = this.world.objects.add('barrel', distance, -distance)

        // this.screen.follow(barrelC, barrelD)

        // let bg = this.add.image(0, 0, 'lobby')
        // this.world.add(bg)

        // this.world.grid.draw()

        setTimeout(() => {
            console.log(this.screen.cameras.A.x, this.screen.cameras.A.y)
            this.world.objects.remove(barrelA)
            this.world.objects.remove(barrelB)
        }, 6000)

        setTimeout(() => {
            barrelA = this.world.objects.add('barrel', -distance, -distance)
            barrelB = this.world.objects.add('barrel', distance, distance)
        }, 7000)

        setTimeout(() => {
            console.log('======================================')
            // this.goTo('map')
        }, 8000)

        if (typeof this.matter.world.debugGraphic !== 'undefined') {
            this.screen.cameras.ui.ignore(this.matter.world.debugGraphic)
        }

    }

}

export default World