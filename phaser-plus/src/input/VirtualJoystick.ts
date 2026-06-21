import HTMLFeature from '../features/HTMLFeature'
import type Scene from '../engine/Scene'
import type InputFeature from './InputFeature'

export interface JoystickConfig {
    size?: number
    deadZone?: number
    placement?: 'left' | 'right'
    bottomOffset?: number
    sideOffset?: number
}

export interface ButtonConfig {
    id: string
    label?: string
    placement?: 'left' | 'right'
    bottomOffset?: number
    sideOffset?: number
    size?: number
}

export const VIRTUAL_AXIS_X = 'virtual.joystick.x'

export const VIRTUAL_AXIS_Y = 'virtual.joystick.y'

const STYLE_ID = '@toolcase/phaser-plus/virtual-joystick'

let injected = false

function injectOnce(): void {
    if (injected) return
    if (document.getElementById(STYLE_ID) !== null) {
        injected = true
        return
    }
    const style = document.createElement('style')
    style.id = STYLE_ID
    style.innerHTML = `
    .phx-joystick {
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.18);
        border: 2px solid rgba(255,255,255,0.4);
        touch-action: none;
        user-select: none;
        z-index: 100;
    }
    .phx-joystick__thumb {
        position: absolute;
        left: 50%;
        top: 50%;
        border-radius: 50%;
        background: rgba(255,255,255,0.55);
        transform: translate(-50%, -50%);
        pointer-events: none;
    }
    .phx-button {
        position: absolute;
        border-radius: 50%;
        background: rgba(255,255,255,0.22);
        border: 2px solid rgba(255,255,255,0.45);
        color: #fff;
        font-family: sans-serif;
        font-weight: 600;
        font-size: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        touch-action: none;
        user-select: none;
        z-index: 100;
    }
    .phx-button.is-pressed { background: rgba(255,255,255,0.45); }`
    document.head.append(style)
    injected = true
}

interface ButtonHandle {
    config: Required<ButtonConfig>
    el: HTMLDivElement
    press: (event: PointerEvent) => void
    release: (event: PointerEvent) => void
}

export default class VirtualJoystick extends HTMLFeature {

    private input: InputFeature | null = null

    private config: Required<JoystickConfig>

    private joystickEl: HTMLDivElement | null = null

    private thumbEl: HTMLDivElement | null = null

    private joystickPointer: number = -1

    private vectorX: number = 0

    private vectorY: number = 0

    private buttons: Map<string, ButtonHandle> = new Map()

    constructor(scene: Scene, key: string) {
        super(scene, key)
        injectOnce()
        this.config = {
            size: 140,
            deadZone: 0.2,
            placement: 'left',
            bottomOffset: 32,
            sideOffset: 32
        }
    }

    setInput(input: InputFeature | null): this {
        this.input = input
        return this
    }

    setJoystickConfig(config: JoystickConfig): this {
        this.config = { ...this.config, ...config }
        if (this.joystickEl !== null) this.layoutJoystick()
        return this
    }

    addButton(config: ButtonConfig): this {
        const merged: Required<ButtonConfig> = {
            id: config.id,
            label: config.label ?? config.id,
            placement: config.placement ?? 'right',
            bottomOffset: config.bottomOffset ?? 32,
            sideOffset: config.sideOffset ?? 32,
            size: config.size ?? 80
        }
        const el = document.createElement('div')
        el.classList.add('phx-button')
        el.dataset.id = merged.id
        el.style.width = `${merged.size}px`
        el.style.height = `${merged.size}px`
        el.style.bottom = `${merged.bottomOffset}px`
        if (merged.placement === 'left') el.style.left = `${merged.sideOffset}px`
        else el.style.right = `${merged.sideOffset}px`
        el.textContent = merged.label
        const press = (event: PointerEvent) => {
            event.preventDefault()
            el.classList.add('is-pressed')
            this.input?.setVirtual(merged.id, true)
            el.setPointerCapture(event.pointerId)
        }
        const release = (event: PointerEvent) => {
            el.classList.remove('is-pressed')
            this.input?.setVirtual(merged.id, false)
            el.releasePointerCapture(event.pointerId)
        }
        el.addEventListener('pointerdown', press)
        el.addEventListener('pointerup', release)
        el.addEventListener('pointercancel', release)
        el.addEventListener('pointerleave', release)
        this.node.append(el)
        this.buttons.set(merged.id, { config: merged, el, press, release })
        return this
    }

    removeButton(id: string): this {
        const handle = this.buttons.get(id)
        if (!handle) return this
        handle.el.removeEventListener('pointerdown', handle.press)
        handle.el.removeEventListener('pointerup', handle.release)
        handle.el.removeEventListener('pointercancel', handle.release)
        handle.el.removeEventListener('pointerleave', handle.release)
        handle.el.remove()
        this.buttons.delete(id)
        return this
    }

    get vector(): { x: number, y: number } {
        return { x: this.vectorX, y: this.vectorY }
    }

    override onCreate(): void {
        this.joystickEl = document.createElement('div')
        this.joystickEl.classList.add('phx-joystick')
        this.thumbEl = document.createElement('div')
        this.thumbEl.classList.add('phx-joystick__thumb')
        this.joystickEl.append(this.thumbEl)
        this.node.append(this.joystickEl)
        this.layoutJoystick()
        this.joystickEl.addEventListener('pointerdown', this.onPointerDown)
        this.joystickEl.addEventListener('pointermove', this.onPointerMove)
        this.joystickEl.addEventListener('pointerup', this.onPointerUp)
        this.joystickEl.addEventListener('pointercancel', this.onPointerUp)
    }

    private layoutJoystick(): void {
        if (!this.joystickEl || !this.thumbEl) return
        const { size, placement, bottomOffset, sideOffset } = this.config
        this.joystickEl.style.width = `${size}px`
        this.joystickEl.style.height = `${size}px`
        this.joystickEl.style.bottom = `${bottomOffset}px`
        if (placement === 'left') {
            this.joystickEl.style.left = `${sideOffset}px`
            this.joystickEl.style.right = ''
        } else {
            this.joystickEl.style.right = `${sideOffset}px`
            this.joystickEl.style.left = ''
        }
        const thumbSize = Math.round(size * 0.45)
        this.thumbEl.style.width = `${thumbSize}px`
        this.thumbEl.style.height = `${thumbSize}px`
    }

    private onPointerDown = (event: PointerEvent): void => {
        if (this.joystickPointer !== -1) return
        event.preventDefault()
        this.joystickPointer = event.pointerId
        this.joystickEl?.setPointerCapture(event.pointerId)
        this.updateVector(event)
    }

    private onPointerMove = (event: PointerEvent): void => {
        if (event.pointerId !== this.joystickPointer) return
        event.preventDefault()
        this.updateVector(event)
    }

    private onPointerUp = (event: PointerEvent): void => {
        if (event.pointerId !== this.joystickPointer) return
        event.preventDefault()
        this.joystickPointer = -1
        this.vectorX = 0
        this.vectorY = 0
        this.applyToInput()
        this.moveThumb(0, 0)
    }

    private updateVector(event: PointerEvent): void {
        const el = this.joystickEl
        if (!el) return
        const rect = el.getBoundingClientRect()
        const cx = rect.left + rect.width * 0.5
        const cy = rect.top + rect.height * 0.5
        const dx = event.clientX - cx
        const dy = event.clientY - cy
        const radius = rect.width * 0.5
        const len = Math.sqrt(dx * dx + dy * dy)
        const clampedLen = Math.min(radius, len)
        const nx = len === 0 ? 0 : (dx / len) * (clampedLen / radius)
        const ny = len === 0 ? 0 : (dy / len) * (clampedLen / radius)
        const dead = this.config.deadZone
        const magnitude = Math.sqrt(nx * nx + ny * ny)
        if (magnitude < dead) {
            this.vectorX = 0
            this.vectorY = 0
        } else {
            const scale = (magnitude - dead) / (1 - dead)
            this.vectorX = (nx / magnitude) * scale
            this.vectorY = (ny / magnitude) * scale
        }
        this.applyToInput()
        this.moveThumb(nx * radius, ny * radius)
    }

    private moveThumb(dx: number, dy: number): void {
        if (!this.thumbEl) return
        this.thumbEl.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`
    }

    private applyToInput(): void {
        const input = this.input
        if (!input) return
        input.setVirtual(`${VIRTUAL_AXIS_X}:positive`, this.vectorX > 0.001)
        input.setVirtual(`${VIRTUAL_AXIS_X}:negative`, this.vectorX < -0.001)
        input.setVirtual(`${VIRTUAL_AXIS_Y}:positive`, this.vectorY > 0.001)
        input.setVirtual(`${VIRTUAL_AXIS_Y}:negative`, this.vectorY < -0.001)
    }

    override onDestroy(): void {
        for (const handle of this.buttons.values()) {
            handle.el.removeEventListener('pointerdown', handle.press)
            handle.el.removeEventListener('pointerup', handle.release)
            handle.el.removeEventListener('pointercancel', handle.release)
            handle.el.removeEventListener('pointerleave', handle.release)
            handle.el.remove()
        }
        this.buttons.clear()
        if (this.joystickEl) {
            this.joystickEl.removeEventListener('pointerdown', this.onPointerDown)
            this.joystickEl.removeEventListener('pointermove', this.onPointerMove)
            this.joystickEl.removeEventListener('pointerup', this.onPointerUp)
            this.joystickEl.removeEventListener('pointercancel', this.onPointerUp)
            this.joystickEl.remove()
        }
        this.joystickEl = null
        this.thumbEl = null
    }

}
