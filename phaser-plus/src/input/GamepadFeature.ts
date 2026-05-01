import type { Input } from 'phaser'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

export const GAMEPAD_CONNECTED = 'gamepad.connected'

export const GAMEPAD_DISCONNECTED = 'gamepad.disconnected'

export const GAMEPAD_BUTTON_DOWN = 'gamepad.button.down'

export const GAMEPAD_BUTTON_UP = 'gamepad.button.up'

export type Mapping = 'xbox' | 'ps' | 'switch' | 'standard'

export interface MappingPreset {
    A: number
    B: number
    X: number
    Y: number
    LB: number
    RB: number
    LT: number
    RT: number
    Start: number
    Select: number
    LStick: number
    RStick: number
    DUp: number
    DDown: number
    DLeft: number
    DRight: number
}

export const MAPPING_XBOX: MappingPreset = {
    A: 0, B: 1, X: 2, Y: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    Select: 8, Start: 9,
    LStick: 10, RStick: 11,
    DUp: 12, DDown: 13, DLeft: 14, DRight: 15
}

export const MAPPING_PS: MappingPreset = {
    A: 0, B: 1, X: 2, Y: 3,
    LB: 4, RB: 5, LT: 6, RT: 7,
    Select: 8, Start: 9,
    LStick: 10, RStick: 11,
    DUp: 12, DDown: 13, DLeft: 14, DRight: 15
}

export const MAPPING_SWITCH: MappingPreset = {
    A: 1, B: 0, X: 3, Y: 2,
    LB: 4, RB: 5, LT: 6, RT: 7,
    Select: 8, Start: 9,
    LStick: 10, RStick: 11,
    DUp: 12, DDown: 13, DLeft: 14, DRight: 15
}

export const MAPPING_STANDARD: MappingPreset = MAPPING_XBOX

const PRESETS: Record<Mapping, MappingPreset> = {
    xbox: MAPPING_XBOX,
    ps: MAPPING_PS,
    switch: MAPPING_SWITCH,
    standard: MAPPING_STANDARD
}

interface PadState {
    pad: Input.Gamepad.Gamepad
    deadZone: number
    pressedButtons: Set<number>
    mapping: MappingPreset
}

export default class GamepadFeature extends Feature {

    private states: Map<number, PadState> = new Map()

    private defaultDeadZone: number = 0.15

    private defaultMapping: Mapping = 'standard'

    constructor(scene: Scene, key: string) {
        super(scene, key)
    }

    setDefaultDeadZone(value: number): this {
        this.defaultDeadZone = value
        return this
    }

    setDefaultMapping(mapping: Mapping): this {
        this.defaultMapping = mapping
        return this
    }

    setMapping(padIndex: number, mapping: Mapping | MappingPreset): this {
        const state = this.states.get(padIndex)
        if (!state) return this
        state.mapping = typeof mapping === 'string' ? PRESETS[mapping] : mapping
        return this
    }

    setDeadZone(padIndex: number, value: number): this {
        const state = this.states.get(padIndex)
        if (!state) return this
        state.deadZone = value
        return this
    }

    getMapping(padIndex: number): MappingPreset | null {
        return this.states.get(padIndex)?.mapping ?? null
    }

    isConnected(padIndex: number): boolean {
        return this.states.has(padIndex)
    }

    axes(padIndex: number): { x: number, y: number, rx: number, ry: number } {
        const state = this.states.get(padIndex)
        if (!state) return { x: 0, y: 0, rx: 0, ry: 0 }
        const dz = state.deadZone
        const ax = state.pad.axes
        const apply = (v: number) => Math.abs(v) < dz ? 0 : v
        return {
            x: apply(ax[0]?.getValue() ?? 0),
            y: apply(ax[1]?.getValue() ?? 0),
            rx: apply(ax[2]?.getValue() ?? 0),
            ry: apply(ax[3]?.getValue() ?? 0)
        }
    }

    rumble(padIndex: number, strongMagnitude: number, weakMagnitude: number, durationMs: number): void {
        const state = this.states.get(padIndex)
        if (!state) return
        const native = (state.pad as unknown as { vibration?: GamepadHapticActuator }).vibration
        if (native && typeof native.playEffect === 'function') {
            native.playEffect('dual-rumble', {
                duration: durationMs,
                strongMagnitude: Math.max(0, Math.min(1, strongMagnitude)),
                weakMagnitude: Math.max(0, Math.min(1, weakMagnitude))
            })
        }
    }

    override onCreate(): void {
        const gamepad = this.scene.input.gamepad
        if (!gamepad) {
            this.logger.warning('gamepad input not enabled; pass input.gamepad: true to game config')
            return
        }
        gamepad.on('connected', this.onConnected, this)
        gamepad.on('disconnected', this.onDisconnected, this)
        gamepad.on('down', this.onButtonDown, this)
        gamepad.on('up', this.onButtonUp, this)
        for (const pad of gamepad.gamepads) {
            if (pad) this.onConnected(pad)
        }
    }

    private onConnected(pad: Input.Gamepad.Gamepad): void {
        this.states.set(pad.index, {
            pad,
            deadZone: this.defaultDeadZone,
            pressedButtons: new Set(),
            mapping: PRESETS[this.defaultMapping]
        })
        this.emit(GAMEPAD_CONNECTED, pad.index, pad.id)
    }

    private onDisconnected(pad: Input.Gamepad.Gamepad): void {
        this.states.delete(pad.index)
        this.emit(GAMEPAD_DISCONNECTED, pad.index)
    }

    private onButtonDown(pad: Input.Gamepad.Gamepad, button: Input.Gamepad.Button, _value: number): void {
        const state = this.states.get(pad.index)
        if (!state) return
        state.pressedButtons.add(button.index)
        this.emit(GAMEPAD_BUTTON_DOWN, pad.index, button.index)
    }

    private onButtonUp(pad: Input.Gamepad.Gamepad, button: Input.Gamepad.Button, _value: number): void {
        const state = this.states.get(pad.index)
        if (!state) return
        state.pressedButtons.delete(button.index)
        this.emit(GAMEPAD_BUTTON_UP, pad.index, button.index)
    }

    override onDestroy(): void {
        const gamepad = this.scene.input.gamepad
        gamepad?.off('connected', this.onConnected, this)
        gamepad?.off('disconnected', this.onDisconnected, this)
        gamepad?.off('down', this.onButtonDown, this)
        gamepad?.off('up', this.onButtonUp, this)
        this.states.clear()
    }

}
