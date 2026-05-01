import Panel from '../Panel'

interface AudioState {
    masterVolume: number
    masterMute: boolean
    playing: string
}

interface BusState {
    name: string
    volume: number
    mute: boolean
}

export default class AudioPanel extends Panel {

    state: AudioState = {
        masterVolume: 1,
        masterMute: false,
        playing: ''
    }

    components: Record<string, any> = {}

    private buses: Record<string, BusState> = {}

    private busFolders: Record<string, any> = {}

    private busListeners: Record<string, (state: BusState) => void> = {}

    override draw(): void {
        const sound = this.scene.sound as any
        this.state.masterVolume = typeof sound.volume === 'number' ? sound.volume : 1
        this.state.masterMute = typeof sound.mute === 'boolean' ? sound.mute : false

        this.components.masterVolume = this.base.addBinding(this.state, 'masterVolume', { label: 'Master vol', min: 0, max: 1, step: 0.01 })
        this.components.masterVolume.on('change', (e: { value: number }) => { sound.volume = e.value })
        this.components.masterMute = this.base.addBinding(this.state, 'masterMute', { label: 'Master mute' })
        this.components.masterMute.on('change', (e: { value: boolean }) => { sound.mute = e.value })
        this.base.addBlade({ view: 'separator' })
        this.components.playing = this.base.addBinding(this.state, 'playing', { readonly: true, label: 'Playing' })
    }

    addBus(name: string, onChange?: (bus: BusState) => void): BusState {
        if (this.buses[name] !== undefined) return this.buses[name]
        const bus: BusState = { name, volume: 1, mute: false }
        const folder = this.base.addFolder({ title: `Bus: ${name}` })
        folder.addBinding(bus, 'volume', { label: 'Vol', min: 0, max: 1, step: 0.01 }).on('change', () => onChange?.(bus))
        folder.addBinding(bus, 'mute', { label: 'Mute' }).on('change', () => onChange?.(bus))
        this.buses[name] = bus
        this.busFolders[name] = folder
        if (onChange) this.busListeners[name] = onChange
        return bus
    }

    removeBus(name: string): this {
        const folder = this.busFolders[name]
        if (folder !== undefined) {
            folder.dispose?.()
            delete this.busFolders[name]
        }
        delete this.buses[name]
        delete this.busListeners[name]
        return this
    }

    getBus(name: string): BusState | null {
        return this.buses[name] ?? null
    }

    override doUpdate(): void {
        const sound = this.scene.sound as any
        const list: any[] = sound.sounds ?? []
        const playing: string[] = []
        for (const s of list) {
            if (s?.isPlaying) playing.push(s.key ?? '?')
        }
        this.state.playing = playing.length === 0 ? '(none)' : playing.join(' ')
        for (const key in this.components) this.components[key].refresh?.()
    }

    override dispose(): void {
        for (const name in this.busFolders) {
            this.busFolders[name]?.dispose?.()
        }
        this.buses = {}
        this.busFolders = {}
        this.busListeners = {}
    }

}
