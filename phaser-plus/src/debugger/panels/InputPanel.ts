import Panel from '../Panel'

interface InputState {
    keys: string
    pointer: string
    gamepad: string
    actions: string
    lastEvent: string
}

export default class InputPanel extends Panel {

    state: InputState = {
        keys: '',
        pointer: '',
        gamepad: 'none',
        actions: '',
        lastEvent: ''
    }

    components: Record<string, any> = {}

    private downKeys = new Set<string>()

    private actionMap: Record<string, () => boolean> = {}

    private onKeyDown = (e: KeyboardEvent): void => {
        this.downKeys.add(e.code)
        this.state.lastEvent = `key↓ ${e.code}`
    }

    private onKeyUp = (e: KeyboardEvent): void => {
        this.downKeys.delete(e.code)
        this.state.lastEvent = `key↑ ${e.code}`
    }

    override draw(): void {
        this.components.keys = this.base.addBinding(this.state, 'keys', { readonly: true, label: 'Keys' })
        this.components.pointer = this.base.addBinding(this.state, 'pointer', { readonly: true, label: 'Pointer' })
        this.components.gamepad = this.base.addBinding(this.state, 'gamepad', { readonly: true, label: 'Gamepad' })
        this.components.actions = this.base.addBinding(this.state, 'actions', { readonly: true, label: 'Actions' })
        this.components.lastEvent = this.base.addBinding(this.state, 'lastEvent', { readonly: true, label: 'Last' })
        this.components.clear = this.base.addButton({ title: 'Clear actions' }).on('click', () => this.clearActions())

        this.scene.input.keyboard?.on('keydown', this.onKeyDown)
        this.scene.input.keyboard?.on('keyup', this.onKeyUp)
    }

    registerAction(name: string, isActive: () => boolean): this {
        this.actionMap[name] = isActive
        return this
    }

    unregisterAction(name: string): this {
        delete this.actionMap[name]
        return this
    }

    clearActions(): void {
        this.actionMap = {}
    }

    override doUpdate(): void {
        this.state.keys = Array.from(this.downKeys).join(' ') || '(none)'

        const ptr = this.scene.input.activePointer
        if (ptr) {
            this.state.pointer = `${ptr.x.toFixed(0)},${ptr.y.toFixed(0)} ${ptr.isDown ? '●' : '○'}`
        }

        const pads = typeof navigator.getGamepads === 'function'
            ? Array.from(navigator.getGamepads()).filter((p): p is Gamepad => p !== null)
            : []
        if (pads.length === 0) {
            this.state.gamepad = 'none'
        } else {
            this.state.gamepad = pads.map((p, i) => {
                const pressed = p.buttons.filter(b => b.pressed).length
                const ax = p.axes.map(v => v.toFixed(1)).join(',')
                return `#${i} btn:${pressed} ax:${ax}`
            }).join(' | ')
        }

        const actions: string[] = []
        for (const name in this.actionMap) {
            actions.push(`${name}:${this.actionMap[name]() ? '1' : '0'}`)
        }
        this.state.actions = actions.join(' ') || '(none)'

        for (const key in this.components) this.components[key].refresh?.()
    }

    override dispose(): void {
        this.scene.input.keyboard?.off('keydown', this.onKeyDown)
        this.scene.input.keyboard?.off('keyup', this.onKeyUp)
        this.downKeys.clear()
    }

}
