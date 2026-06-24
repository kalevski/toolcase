import type { Input } from 'phaser'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'
import type InputBuffer from './InputBuffer'

export interface KeyBinding {
    type: 'key'
    code: string
}

export interface MouseBinding {
    type: 'mouse'
    button: 0 | 1 | 2
}

export interface GamepadBinding {
    type: 'gamepad'
    button: number
    pad?: number
}

export interface AxisBinding {
    type: 'axis'
    axis: number
    pad?: number
    threshold?: number
    direction?: -1 | 1
}

export interface VirtualBinding {
    type: 'virtual'
    id: string
}

export type Binding = KeyBinding | MouseBinding | GamepadBinding | AxisBinding | VirtualBinding

export const ACTION_PRESS = 'input.action.press'

export const ACTION_RELEASE = 'input.action.release'

export const ACTION_HOLD = 'input.action.hold'

interface ActionState {
    bindings: Binding[]
    pressed: boolean
    pressedAt: number
    holdMs: number
}

export default class InputFeature extends Feature {

    private actions: Map<string, ActionState> = new Map()

    private virtualState: Map<string, boolean> = new Map()

    private keys: Map<string, Input.Keyboard.Key> = new Map()

    private buffer: InputBuffer | null = null

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setBuffer(buffer: InputBuffer | null): this {
        this.buffer = buffer
        return this
    }

    bind(action: string, bindings: Binding[]): this {
        const existing = this.actions.get(action)
        if (existing) {
            existing.bindings = bindings.slice()
        } else {
            this.actions.set(action, { bindings: bindings.slice(), pressed: false, pressedAt: 0, holdMs: 0 })
        }
        for (const b of bindings) {
            if (b.type === 'key') this.ensureKey(b.code)
        }
        return this
    }

    addBinding(action: string, binding: Binding): this {
        const state = this.actions.get(action)
        if (!state) {
            return this.bind(action, [binding])
        }
        state.bindings.push(binding)
        if (binding.type === 'key') this.ensureKey(binding.code)
        return this
    }

    unbind(action: string): this {
        this.actions.delete(action)
        return this
    }

    setVirtual(id: string, value: boolean): this {
        this.virtualState.set(id, value)
        return this
    }

    isPressed(action: string): boolean {
        return this.actions.get(action)?.pressed ?? false
    }

    holdTime(action: string): number {
        return this.actions.get(action)?.holdMs ?? 0
    }

    private ensureKey(code: string): void {
        if (this.keys.has(code)) return
        const keyboard = this.scene.input.keyboard
        if (!keyboard) return
        const key = keyboard.addKey(code, true, false)
        this.keys.set(code, key)
    }

    private resolveBinding(binding: Binding): boolean {
        switch (binding.type) {
            case 'key': {
                const key = this.keys.get(binding.code)
                return key?.isDown ?? false
            }
            case 'mouse': {
                const mouse = this.scene.input.activePointer as Input.Pointer | undefined
                if (!mouse) return false
                if (binding.button === 0) return mouse.leftButtonDown()
                if (binding.button === 1) return mouse.middleButtonDown()
                return mouse.rightButtonDown()
            }
            case 'gamepad': {
                const pads = this.scene.input.gamepad
                if (!pads) return false
                const pad = pads.getPad(binding.pad ?? 0)
                if (!pad) return false
                return pad.buttons[binding.button]?.pressed ?? false
            }
            case 'axis': {
                const pads = this.scene.input.gamepad
                if (!pads) return false
                const pad = pads.getPad(binding.pad ?? 0)
                if (!pad) return false
                const value = pad.axes[binding.axis]?.getValue() ?? 0
                const threshold = binding.threshold ?? 0.5
                if (binding.direction === -1) return value <= -threshold
                if (binding.direction === 1) return value >= threshold
                return Math.abs(value) >= threshold
            }
            case 'virtual': {
                return this.virtualState.get(binding.id) ?? false
            }
        }
    }

    override onUpdate(_time: number, delta: number): void {
        const now = performance.now()
        for (const [action, state] of this.actions) {
            const isDown = state.bindings.some(b => this.resolveBinding(b))
            if (isDown && !state.pressed) {
                state.pressed = true
                state.pressedAt = now
                state.holdMs = 0
                this.emit(ACTION_PRESS, action)
                this.buffer?.push(action, now)
            } else if (!isDown && state.pressed) {
                state.pressed = false
                this.emit(ACTION_RELEASE, action, state.holdMs)
                state.holdMs = 0
            } else if (isDown && state.pressed) {
                state.holdMs += delta
                this.emit(ACTION_HOLD, action, state.holdMs)
            }
        }
    }

    override onDestroy(): void {
        this.actions.clear()
        this.virtualState.clear()
        const keyboard = this.scene.input.keyboard
        for (const code of this.keys.keys()) keyboard?.removeKey(code, true, true)
        this.keys.clear()
    }

}
