import Panel from '../Panel'

interface AudioState {
    masterVolume: number
    masterMute: boolean
    masterPan: number
    playing: string
}

interface BusState {
    name: string
    volume: number
    mute: boolean
    pan: number
    channels: string[]
}

export default class AudioPanel extends Panel {

    state: AudioState = {
        masterVolume: 1,
        masterMute: false,
        masterPan: 0,
        playing: ''
    }

    components: Record<string, any> = {}

    private buses: Record<string, BusState> = {}

    private busFolders: Record<string, any> = {}

    private busListeners: Record<string, (state: BusState) => void> = {}

    private busSeenSounds: Record<string, Set<any>> = {}

    override draw(): void {
        const sound = this.scene.sound as any
        this.state.masterVolume = typeof sound.volume === 'number' ? sound.volume : 1
        this.state.masterMute = typeof sound.mute === 'boolean' ? sound.mute : false

        this.components.masterVolume = this.base.addBinding(this.state, 'masterVolume', { label: 'Master vol', min: 0, max: 1, step: 0.01 })
        this.components.masterVolume.on('change', (e: { value: number }) => { sound.volume = e.value })
        this.components.masterMute = this.base.addBinding(this.state, 'masterMute', { label: 'Master mute' })
        this.components.masterMute.on('change', (e: { value: boolean }) => { sound.mute = e.value })
        this.components.masterPan = this.base.addBinding(this.state, 'masterPan', { label: 'Master pan', min: -1, max: 1, step: 0.01 })
        this.components.masterPan.on('change', (e: { value: number }) => this.applyPanToAll(e.value))
        this.base.addBlade({ view: 'separator' })
        this.components.playing = this.base.addBinding(this.state, 'playing', { readonly: true, label: 'Playing' })
    }

    addBus(name: string, onChange?: (bus: BusState) => void): BusState {
        if (this.buses[name] !== undefined) return this.buses[name]
        const bus: BusState = { name, volume: 1, mute: false, pan: 0, channels: [] }
        const folder = this.base.addFolder({ title: `Bus: ${name}` })
        const apply = () => { this.applyBus(bus, true); onChange?.(bus) }
        folder.addBinding(bus, 'volume', { label: 'Vol', min: 0, max: 1, step: 0.01 }).on('change', apply)
        folder.addBinding(bus, 'mute', { label: 'Mute' }).on('change', apply)
        folder.addBinding(bus, 'pan', { label: 'Pan', min: -1, max: 1, step: 0.01 }).on('change', apply)
        this.buses[name] = bus
        this.busFolders[name] = folder
        this.busSeenSounds[name] = new Set()
        if (onChange) this.busListeners[name] = onChange
        return bus
    }

    /**
     * Route one or more sound keys (channels) through a bus, so the bus
     * volume/mute/pan mix down onto every member sound. Lets several
     * channels collapse into a single music/SFX mixer control.
     */
    addChannel(busName: string, ...keys: string[]): this {
        const bus = this.buses[busName]
        if (bus === undefined) return this
        for (const key of keys) {
            if (!bus.channels.includes(key)) bus.channels.push(key)
        }
        this.applyBus(bus)
        return this
    }

    removeChannel(busName: string, key: string): this {
        const bus = this.buses[busName]
        if (bus === undefined) return this
        const index = bus.channels.indexOf(key)
        if (index !== -1) bus.channels.splice(index, 1)
        return this
    }

    removeBus(name: string): this {
        const folder = this.busFolders[name]
        if (folder !== undefined) {
            folder.dispose?.()
            delete this.busFolders[name]
        }
        delete this.buses[name]
        delete this.busListeners[name]
        delete this.busSeenSounds[name]
        return this
    }

    getBus(name: string): BusState | null {
        return this.buses[name] ?? null
    }

    private applyBus(bus: BusState, force = false): void {
        const sound = this.scene.sound as any
        const list: any[] = sound.sounds ?? []
        const seen = this.busSeenSounds[bus.name]
        for (const s of list) {
            if (s == null || !bus.channels.includes(s.key)) continue
            if (!force && seen?.has(s)) continue
            if (typeof s.setVolume === 'function') s.setVolume(bus.volume)
            else if ('volume' in s) s.volume = bus.volume
            if (typeof s.setMute === 'function') s.setMute(bus.mute)
            else if ('mute' in s) s.mute = bus.mute
            this.setPan(s, bus.pan)
            seen?.add(s)
        }
    }

    private applyPanToAll(value: number): void {
        const sound = this.scene.sound as any
        const list: any[] = sound.sounds ?? []
        for (const s of list) {
            if (s != null) this.setPan(s, value)
        }
    }

    private setPan(s: any, value: number): void {
        if (typeof s.setPan === 'function') s.setPan(value)
        else if ('pan' in s) s.pan = value
    }

    override doUpdate(): void {
        const sound = this.scene.sound as any
        const list: any[] = sound.sounds ?? []
        const playing: string[] = []
        for (const s of list) {
            if (s?.isPlaying) playing.push(s.key ?? '?')
        }
        this.state.playing = playing.length === 0 ? '(none)' : playing.join(' ')
        // Prune dead references then apply buses only to newly appearing sounds.
        const liveSet = new Set(list)
        for (const name in this.buses) {
            const seen = this.busSeenSounds[name]
            if (seen) for (const s of seen) if (!liveSet.has(s)) seen.delete(s)
            this.applyBus(this.buses[name])
        }
        for (const key in this.components) this.components[key].refresh?.()
    }

    override dispose(): void {
        for (const name in this.busFolders) {
            this.busFolders[name]?.dispose?.()
        }
        this.buses = {}
        this.busFolders = {}
        this.busListeners = {}
        this.busSeenSounds = {}
    }

}
