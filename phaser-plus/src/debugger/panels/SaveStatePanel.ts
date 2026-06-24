import type SaveService from '../../persistence/SaveService'
import type { SaveEntry } from '../../persistence/SaveService'
import Panel from '../Panel'

export default class SaveStatePanel extends Panel {

    private service: SaveService | null = null
    private entries: SaveEntry[] = []
    private refreshing = false

    state = {
        slots: '(no service)',
        version: '',
        savedAt: '',
        preview: ''
    }

    components: Record<string, any> = {}

    override draw(): void {
        this.components.slots = this.base.addBinding(this.state, 'slots', { readonly: true, label: 'Slots' })
        this.components.slotId = this.base.addBlade({ view: 'text', label: 'Slot ID', parse: (v: string) => v, value: '' })
        this.components.version = this.base.addBinding(this.state, 'version', { readonly: true, label: 'Version' })
        this.components.savedAt = this.base.addBinding(this.state, 'savedAt', { readonly: true, label: 'Saved' })
        this.components.preview = this.base.addBinding(this.state, 'preview', { readonly: true, label: 'Data' })
        this.base.addBlade({ view: 'separator' })
        this.base.addButton({ title: 'Refresh' }).on('click', () => this.refresh())
        this.base.addButton({ title: 'Inspect' }).on('click', () => this.inspectSelected())
        this.base.addButton({ title: 'Force Load' }).on('click', () => this.forceLoad())
        this.base.addButton({ title: 'Delete Slot' }).on('click', () => this.deleteSlot())
    }

    bind(service: SaveService): this {
        this.service = service
        this.refresh()
        return this
    }

    refresh(): void {
        if (!this.service || this.refreshing) return
        this.refreshing = true
        this.service.list().then(entries => {
            this.entries = entries
            this.state.slots = entries.length === 0 ? '(empty)' : entries.map(e => e.id).join(', ')
            if (!this.components.slotId?.value && entries.length > 0) {
                this.components.slotId.value = entries[0].id
            }
            this.syncMeta()
            this.refreshing = false
        }).catch(() => { this.refreshing = false })
    }

    private inspectSelected(): void {
        this.syncMeta()
        if (!this.service) return
        const id: string = this.components.slotId?.value ?? ''
        if (!id) return
        this.service.load(id).then(data => {
            this.state.preview = data !== null ? JSON.stringify(data).slice(0, 120) : '(null)'
        }).catch(() => { this.state.preview = '(error)' })
    }

    private syncMeta(): void {
        const id: string = this.components.slotId?.value ?? ''
        const entry = this.entries.find(e => e.id === id)
        if (!entry) {
            this.state.version = ''
            this.state.savedAt = ''
            this.state.preview = ''
            return
        }
        this.state.version = `v${entry.version}`
        this.state.savedAt = new Date(entry.savedAt).toISOString().slice(0, 19).replace('T', ' ')
    }

    private forceLoad(): void {
        if (!this.service) return
        const id: string = this.components.slotId?.value ?? ''
        if (!id) return
        this.service.load(id).then(data => {
            this.emit('load', id, data)
        }).catch(() => {})
    }

    private deleteSlot(): void {
        if (!this.service) return
        const id: string = this.components.slotId?.value ?? ''
        if (!id) return
        this.service.delete(id).then(() => {
            this.emit('delete', id)
            if (this.components.slotId) this.components.slotId.value = ''
            this.refresh()
        }).catch(() => {})
    }

    override doUpdate(): void {
        for (const key in this.components) this.components[key].refresh?.()
    }

}
