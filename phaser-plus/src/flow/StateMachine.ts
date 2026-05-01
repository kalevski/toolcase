import type { Logger } from '@toolcase/logging'
import Feature from '../features/Feature'
import type Scene from '../engine/Scene'

export type StateHook<C> = (context: C, machine: StateMachine<C>) => void

export type StateUpdateHook<C> = (context: C, time: number, delta: number, machine: StateMachine<C>) => void

export type Guard<C> = (context: C) => boolean

export interface State<C> {
    onEnter?: StateHook<C>
    onExit?: StateHook<C>
    onUpdate?: StateUpdateHook<C>
}

interface Transition<C> {
    from: string | null
    to: string
    on: string | null
    guard: Guard<C> | null
}

export const STATE_ENTER = 'state_machine.enter'

export const STATE_EXIT = 'state_machine.exit'

export const STATE_TRANSITION = 'state_machine.transition'

export default class StateMachine<C = unknown> extends Feature {

    private states: Map<string, State<C>> = new Map()

    private transitions: Transition<C>[] = []

    private currentState: string | null = null

    private startState: string | null = null

    private machineContext!: C

    protected machineLogger!: Logger

    constructor(scene: Scene, key: string) {
        super(scene, key)
        this.machineLogger = scene.engine.getLogger(`state-machine=${key}`)
    }

    setContext(context: C): this {
        this.machineContext = context
        return this
    }

    addState(name: string, definition: State<C> = {}): this {
        if (this.states.has(name)) {
            throw new Error(`state=${name} already defined`)
        }
        this.states.set(name, definition)
        if (this.startState === null) this.startState = name
        return this
    }

    addTransition(from: string | null, to: string, on: string | null = null, guard: Guard<C> | null = null): this {
        if (!this.states.has(to)) {
            throw new Error(`transition target=${to} not defined as state`)
        }
        if (from !== null && !this.states.has(from)) {
            throw new Error(`transition source=${from} not defined as state`)
        }
        this.transitions.push({ from, to, on, guard })
        return this
    }

    setStart(name: string): this {
        if (!this.states.has(name)) {
            throw new Error(`start state=${name} not defined`)
        }
        this.startState = name
        return this
    }

    get current(): string | null {
        return this.currentState
    }

    get context(): C {
        return this.machineContext
    }

    is(name: string): boolean {
        return this.currentState === name
    }

    fire(signal: string): boolean {
        return this.evaluate(signal)
    }

    go(target: string): boolean {
        if (!this.states.has(target)) {
            throw new Error(`state=${target} not defined`)
        }
        return this.transition(target)
    }

    override onCreate(): void {
        if (this.startState !== null) {
            this.transition(this.startState)
        }
    }

    override onUpdate(time: number, delta: number): void {
        if (this.currentState === null) return
        const state = this.states.get(this.currentState)
        state?.onUpdate?.(this.machineContext, time, delta, this)
        this.evaluate(null)
    }

    override onDestroy(): void {
        if (this.currentState !== null) {
            const state = this.states.get(this.currentState)
            state?.onExit?.(this.machineContext, this)
        }
        this.states.clear()
        this.transitions = []
        this.currentState = null
    }

    private evaluate(signal: string | null): boolean {
        for (const transition of this.transitions) {
            if (transition.from !== null && transition.from !== this.currentState) continue
            if (transition.on !== null && transition.on !== signal) continue
            if (transition.on === null && signal !== null) continue
            if (transition.guard !== null && !transition.guard(this.machineContext)) continue
            return this.transition(transition.to)
        }
        return false
    }

    private transition(target: string): boolean {
        const next = this.states.get(target)
        if (!next) return false
        const previous = this.currentState
        if (previous !== null) {
            const prev = this.states.get(previous)
            prev?.onExit?.(this.machineContext, this)
            this.emit(STATE_EXIT, previous, this)
        }
        this.currentState = target
        next.onEnter?.(this.machineContext, this)
        this.emit(STATE_ENTER, target, this)
        this.emit(STATE_TRANSITION, previous, target, this)
        return true
    }

}
