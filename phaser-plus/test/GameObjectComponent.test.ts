import { describe, it, expect, vi } from 'vitest'
import GameObject from '../src/engine/GameObject'
import GameObjectComponent from '../src/engine/GameObjectComponent'

/**
 * Build a minimal GameObject-like instance without invoking the Phaser
 * Container constructor (which requires a live renderer). The private fields
 * that the component bag depends on are initialised manually so all
 * add / get / remove / lifecycle paths can be exercised in plain Node.
 */
function makeGameObject(): any {
    const obj = Object.create(GameObject.prototype) as any
    obj._components = new Map()
    obj._created = false
    // doUpdate iterates this.list — provide an empty stand-in
    obj.list = []
    // onUpdate / onCreate / onDestroy are on the prototype (no-ops)
    return obj
}

class HealthComponent extends GameObjectComponent {
    onCreate = vi.fn()
    onUpdate = vi.fn()
    onDestroy = vi.fn()
    hp = 100
}

class MoverComponent extends GameObjectComponent {
    onCreate = vi.fn()
    onUpdate = vi.fn()
    onDestroy = vi.fn()
    speed = 5
}

describe('GameObject component bag', () => {

    describe('addComponent', () => {
        it('returns a new instance of the component class', () => {
            const obj = makeGameObject()
            const health = obj.addComponent(HealthComponent)
            expect(health).toBeInstanceOf(HealthComponent)
        })

        it('sets owner to the game object', () => {
            const obj = makeGameObject()
            const health = obj.addComponent(HealthComponent)
            expect(health.owner).toBe(obj)
        })

        it('returns the same instance when called twice with the same class', () => {
            const obj = makeGameObject()
            const a = obj.addComponent(HealthComponent)
            const b = obj.addComponent(HealthComponent)
            expect(a).toBe(b)
        })

        it('does not call onCreate() when the object is not yet created', () => {
            const obj = makeGameObject()
            const health = obj.addComponent(HealthComponent)
            expect(health.onCreate).not.toHaveBeenCalled()
        })

        it('calls onCreate() immediately when the object is already live', () => {
            const obj = makeGameObject()
            obj._created = true
            const health = obj.addComponent(HealthComponent)
            expect(health.onCreate).toHaveBeenCalledOnce()
        })
    })

    describe('getComponent', () => {
        it('returns the component instance after addComponent', () => {
            const obj = makeGameObject()
            const health = obj.addComponent(HealthComponent)
            expect(obj.getComponent(HealthComponent)).toBe(health)
        })

        it('returns null when the component has not been added', () => {
            const obj = makeGameObject()
            expect(obj.getComponent(HealthComponent)).toBeNull()
        })

        it('does not confuse components of different classes', () => {
            const obj = makeGameObject()
            obj.addComponent(HealthComponent)
            expect(obj.getComponent(MoverComponent)).toBeNull()
        })
    })

    describe('removeComponent', () => {
        it('calls onDestroy() on the removed component', () => {
            const obj = makeGameObject()
            const health = obj.addComponent(HealthComponent)
            obj.removeComponent(HealthComponent)
            expect(health.onDestroy).toHaveBeenCalledOnce()
        })

        it('makes getComponent return null after removal', () => {
            const obj = makeGameObject()
            obj.addComponent(HealthComponent)
            obj.removeComponent(HealthComponent)
            expect(obj.getComponent(HealthComponent)).toBeNull()
        })

        it('is a no-op when the component is not attached', () => {
            const obj = makeGameObject()
            expect(() => obj.removeComponent(HealthComponent)).not.toThrow()
        })

        it('only removes the targeted component class', () => {
            const obj = makeGameObject()
            obj.addComponent(HealthComponent)
            const mover = obj.addComponent(MoverComponent)
            obj.removeComponent(HealthComponent)
            expect(obj.getComponent(MoverComponent)).toBe(mover)
        })
    })

    describe('doCreate() lifecycle', () => {
        it('sets _created to true', () => {
            const obj = makeGameObject()
            obj.doCreate()
            expect(obj._created).toBe(true)
        })

        it('calls onCreate() on all attached components', () => {
            const obj = makeGameObject()
            const health = obj.addComponent(HealthComponent)
            const mover = obj.addComponent(MoverComponent)
            obj.doCreate()
            expect(health.onCreate).toHaveBeenCalledOnce()
            expect(mover.onCreate).toHaveBeenCalledOnce()
        })

        it('calls the object own onCreate() before component onCreate()s', () => {
            const order: string[] = []
            const obj = makeGameObject()
            obj.onCreate = () => { order.push('object') }
            const health = obj.addComponent(HealthComponent)
            health.onCreate.mockImplementation(() => { order.push('health') })
            obj.doCreate()
            expect(order).toEqual(['object', 'health'])
        })
    })

    describe('doUpdate() lifecycle', () => {
        it('calls onUpdate() on all attached components', () => {
            const obj = makeGameObject()
            const health = obj.addComponent(HealthComponent)
            const mover = obj.addComponent(MoverComponent)
            obj.doUpdate(1000, 16)
            expect(health.onUpdate).toHaveBeenCalledWith(1000, 16)
            expect(mover.onUpdate).toHaveBeenCalledWith(1000, 16)
        })

        it('does not call onUpdate() on removed components', () => {
            const obj = makeGameObject()
            const health = obj.addComponent(HealthComponent)
            obj.removeComponent(HealthComponent)
            obj.doUpdate(1000, 16)
            expect(health.onUpdate).not.toHaveBeenCalled()
        })
    })

    describe('preDestroy() lifecycle', () => {
        function stubPhaserPreDestroy() {
            // Phaser Container.prototype.preDestroy accesses renderer state not
            // available in Node. Stub it so the GameObject path can run cleanly.
            const superProto = Object.getPrototypeOf(GameObject.prototype)
            const orig = superProto.preDestroy
            superProto.preDestroy = vi.fn()
            return () => { superProto.preDestroy = orig }
        }

        it('calls onDestroy() on all attached components', () => {
            const restore = stubPhaserPreDestroy()
            try {
                const obj = makeGameObject()
                obj._effects = null
                const health = obj.addComponent(HealthComponent)
                const mover = obj.addComponent(MoverComponent)
                obj.preDestroy()
                expect(health.onDestroy).toHaveBeenCalledOnce()
                expect(mover.onDestroy).toHaveBeenCalledOnce()
            } finally {
                restore()
            }
        })

        it('clears the component map so getComponent returns null', () => {
            const restore = stubPhaserPreDestroy()
            try {
                const obj = makeGameObject()
                obj._effects = null
                obj.addComponent(HealthComponent)
                obj.preDestroy()
                expect(obj.getComponent(HealthComponent)).toBeNull()
            } finally {
                restore()
            }
        })
    })

})
