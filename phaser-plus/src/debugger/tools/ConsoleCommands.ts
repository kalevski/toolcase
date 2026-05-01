import Panel from '../Panel'

export type CommandHandler = (args: string[]) => void | string

interface ConsoleState {
    output: string
}

const MAX_HISTORY = 200
const VIEWPORT = 12

export default class ConsoleCommands extends Panel {

    state: ConsoleState = { output: '' }

    components: Record<string, any> = {}

    private commands: Record<string, CommandHandler> = {}

    private history: string[] = []

    override draw(): void {
        this.components.input = this.base.addBlade({ view: 'text', label: 'Cmd', parse: (v: string) => v, value: '' })
        this.components.run = this.base.addButton({ title: 'Run' }).on('click', () => this.runFromInput())
        this.components.list = this.base.addButton({ title: 'List commands' }).on('click', () => this.listCommands())
        this.components.clear = this.base.addButton({ title: 'Clear' }).on('click', () => this.clear())
        this.base.addBlade({ view: 'separator' })
        this.components.output = this.base.addBinding(this.state, 'output', { readonly: true, label: 'Output' })
    }

    register(name: string, handler: CommandHandler): this {
        this.commands[name] = handler
        return this
    }

    unregister(name: string): this {
        delete this.commands[name]
        return this
    }

    run(raw: string): void {
        const trimmed = raw.startsWith('/') ? raw.slice(1) : raw
        const parts = trimmed.split(/\s+/).filter(Boolean)
        const name = parts[0]
        if (name === undefined) return
        const args = parts.slice(1)
        this.history.push(`> ${raw}`)
        const handler = this.commands[name]
        const line = handler !== undefined ? this.exec(name, handler, args) : `unknown: ${name}`
        this.history.push(line)
        this.trimHistory()
        this.flushOutput()
    }

    private runFromInput(): void {
        const raw: string = this.components.input?.value ?? ''
        if (raw === '') return
        this.run(raw)
        this.components.input.value = ''
    }

    private listCommands(): void {
        const names = Object.keys(this.commands).sort()
        this.history.push(`commands: ${names.join(', ') || '(none)'}`)
        this.trimHistory()
        this.flushOutput()
    }

    private exec(name: string, handler: CommandHandler, args: string[]): string {
        try {
            const result = handler(args)
            return typeof result === 'string' ? result : `ok: ${name}`
        } catch (err) {
            return `err: ${(err as Error).message}`
        }
    }

    private trimHistory(): void {
        if (this.history.length > MAX_HISTORY) {
            this.history = this.history.slice(-MAX_HISTORY)
        }
    }

    clear(): void {
        this.history.length = 0
        this.state.output = ''
        this.components.output?.refresh?.()
    }

    private flushOutput(): void {
        this.state.output = this.history.slice(-VIEWPORT).join(' | ')
        this.components.output?.refresh?.()
    }

}
