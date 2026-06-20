import FlowProcessor from './FlowProcessor'
import type Scene from '../engine/Scene'

export type Status = 'success' | 'failure' | 'running'

export const SUCCESS: Status = 'success'

export const FAILURE: Status = 'failure'

export const RUNNING: Status = 'running'

export interface TickContext {
    scene: Scene
    time: number
    delta: number
    blackboard: Record<string, unknown>
}

export abstract class BTNode {

    abstract tick(ctx: TickContext): Status

    reset(_ctx: TickContext): void {}

}

export class Action extends BTNode {

    constructor(private fn: (ctx: TickContext) => Status) {
        super()
    }

    tick(ctx: TickContext): Status {
        return this.fn(ctx)
    }

}

export class Condition extends BTNode {

    constructor(private predicate: (ctx: TickContext) => boolean) {
        super()
    }

    tick(ctx: TickContext): Status {
        return this.predicate(ctx) ? SUCCESS : FAILURE
    }

}

abstract class Composite extends BTNode {

    protected children: BTNode[]

    constructor(children: BTNode[]) {
        super()
        this.children = children
    }

    override reset(ctx: TickContext): void {
        for (const child of this.children) child.reset(ctx)
    }

}

export class Sequence extends Composite {

    private cursor: number = 0

    tick(ctx: TickContext): Status {
        for (; this.cursor < this.children.length; this.cursor++) {
            const status = this.children[this.cursor]!.tick(ctx)
            if (status === RUNNING) return RUNNING
            if (status === FAILURE) {
                this.cursor = 0
                return FAILURE
            }
        }
        this.cursor = 0
        return SUCCESS
    }

    override reset(ctx: TickContext): void {
        super.reset(ctx)
        this.cursor = 0
    }

}

export class Selector extends Composite {

    private cursor: number = 0

    tick(ctx: TickContext): Status {
        for (; this.cursor < this.children.length; this.cursor++) {
            const status = this.children[this.cursor]!.tick(ctx)
            if (status === RUNNING) return RUNNING
            if (status === SUCCESS) {
                this.cursor = 0
                return SUCCESS
            }
        }
        this.cursor = 0
        return FAILURE
    }

    override reset(ctx: TickContext): void {
        super.reset(ctx)
        this.cursor = 0
    }

}

export class Parallel extends Composite {

    constructor(children: BTNode[], private successThreshold: number = children.length) {
        super(children)
    }

    tick(ctx: TickContext): Status {
        let successes = 0
        let failures = 0
        for (const child of this.children) {
            const status = child.tick(ctx)
            if (status === SUCCESS) successes++
            else if (status === FAILURE) failures++
        }
        if (successes >= this.successThreshold) return SUCCESS
        if (failures > this.children.length - this.successThreshold) return FAILURE
        return RUNNING
    }

}

abstract class Decorator extends BTNode {

    constructor(protected child: BTNode) {
        super()
    }

    override reset(ctx: TickContext): void {
        this.child.reset(ctx)
    }

}

export class Inverter extends Decorator {

    tick(ctx: TickContext): Status {
        const status = this.child.tick(ctx)
        if (status === SUCCESS) return FAILURE
        if (status === FAILURE) return SUCCESS
        return RUNNING
    }

}

export class Repeater extends Decorator {

    private counter: number = 0

    constructor(child: BTNode, private times: number = -1) {
        super(child)
    }

    tick(ctx: TickContext): Status {
        const status = this.child.tick(ctx)
        if (status === RUNNING) return RUNNING
        if (this.times < 0) return RUNNING
        this.counter++
        if (this.counter >= this.times) {
            this.counter = 0
            return SUCCESS
        }
        return RUNNING
    }

    override reset(ctx: TickContext): void {
        super.reset(ctx)
        this.counter = 0
    }

}

export class AlwaysSucceed extends Decorator {

    tick(ctx: TickContext): Status {
        const status = this.child.tick(ctx)
        if (status === RUNNING) return RUNNING
        return SUCCESS
    }

}

export class AlwaysFail extends Decorator {

    tick(ctx: TickContext): Status {
        const status = this.child.tick(ctx)
        if (status === RUNNING) return RUNNING
        return FAILURE
    }

}

interface TreeEntry {
    id: string
    root: BTNode
    blackboard: Record<string, unknown>
    paused: boolean
    interval: number
    elapsed: number
    lastStatus: Status
}

export default class BehaviorTreeProcessor extends FlowProcessor {

    static readonly EVENT_TYPE = 'behavior_tree'

    private trees: Map<string, TreeEntry> = new Map()

    add(id: string, root: BTNode, blackboard: Record<string, unknown> = {}, interval: number = 0): TreeEntry {
        if (this.trees.has(id)) {
            throw new Error(`tree id=${id} already registered`)
        }
        const entry: TreeEntry = {
            id, root, blackboard,
            paused: false,
            interval,
            elapsed: 0,
            lastStatus: RUNNING
        }
        this.trees.set(id, entry)
        return entry
    }

    remove(id: string): this {
        const entry = this.trees.get(id)
        if (!entry) return this
        entry.root.reset({
            scene: this.scene,
            time: 0, delta: 0,
            blackboard: entry.blackboard
        })
        this.trees.delete(id)
        return this
    }

    pause(id: string, flag: boolean = true): this {
        const entry = this.trees.get(id)
        if (entry) entry.paused = flag
        return this
    }

    get(id: string): TreeEntry | null {
        return this.trees.get(id) ?? null
    }

    has(id: string): boolean {
        return this.trees.has(id)
    }

    override onUpdate(time: number, delta: number): void {
        const dt = delta / 1000
        for (const entry of this.trees.values()) {
            if (entry.paused) continue
            if (entry.interval > 0) {
                entry.elapsed += dt
                if (entry.elapsed < entry.interval) continue
                entry.elapsed -= entry.interval
            }
            const ctx: TickContext = {
                scene: this.scene,
                time, delta,
                blackboard: entry.blackboard
            }
            entry.lastStatus = entry.root.tick(ctx)
        }
    }

    override onDestroy(): void {
        this.trees.clear()
    }

}
