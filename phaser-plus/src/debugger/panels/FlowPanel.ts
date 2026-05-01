import Panel from '../Panel'

export default class FlowPanel extends Panel {

    state: { delay: number, options: any[], optionHash: string | null } = {
        delay: 0,
        options: [],
        optionHash: null
    }

    components: Record<string, any> = {
        eventList: null,
        delay: null,
        fireEvent: null
    }

    override draw(): void {
        this.components.eventList = this.base.addBlade({
            view: 'list',
            label: 'Event',
            options: this.state.options,
            value: ''
        })
        this.components.delay = this.base.addBinding(this.state, 'delay', { label: 'Delay / s', step: 0.1 })
        this.components.fireEvent = this.base.addButton({ title: 'Fire event' }).on('click', this.onFireEvent)
        this.base.addBlade({ view: 'separator' })
    }

    override doUpdate(): void {
        this.refreshComponents()
    }

    private refreshComponents(): void {
        for (const key in this.components) {
            const c = this.components[key]
            if (c && typeof c.refresh === 'function') c.refresh()
        }
        if (!this.scene.flow) return
        const eventList = this.scene.flow.events.keys
        const hash = eventList.join('')
        if (hash === this.components.eventList.hash) return
        this.components.eventList.hash = hash
        const options = eventList.map(event => ({ text: event, value: event }))
        options.unshift({ text: '', value: '' })
        this.components.eventList.options = options
        this.components.eventList.value = ''
        this.state.delay = 0
    }

    private onFireEvent = (): void => {
        const eventName: string = this.components.eventList.value
        const delay = this.state.delay
        this.state.delay = 0
        if (eventName === '') return
        this.scene.flow.events.trigger(eventName, null, delay)
    }

}
